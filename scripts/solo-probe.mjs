// Deterministic solo play probe. Search only simulates public actions on copies;
// the committed battle never edits HP, AP, resources, intentions or rewards.
import {BOSSES,HEROES,createBattle,activeSkills,canUse,skillPreview,useSkill,usePotion,guard,prepareResponse,endRound} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';

function choices(s){
  const h=s.heroes[0],actions=activeSkills(s,h.id).filter(k=>!canUse(s,h.id,k.id)).map(k=>['skill',k.id]);
  if(s.ap&&s.potions&&h.hp<h.maxHp)actions.push(['potion']);
  if(s.ap&&!h.guard)actions.push(['guard']);
  if(s.ap&&!s.response&&!s.boss.core&&!s.boss.broken&&!s.boss.hardControl)for(const id of ['parry','evade','counter'])actions.push(['response',id]);
  return actions;
}
function apply(s,[kind,id]){
  const h=s.heroes[0];
  return kind==='skill'?useSkill(s,h.id,id):kind==='potion'?usePotion(s,h.id):kind==='guard'?guard(s,h.id):kind==='response'?prepareResponse(s,id,h.id):endRound(s);
}
function score(s){
  if(s.mode==='victory')return 1e6+s.heroes[0].hp;
  if(s.mode==='defeat')return -1e6;
  const h=s.heroes[0],b=s.boss,r=h.hp/h.maxHp;
  const resource=h.id==='ric'?h.ricEdge*2:h.resource*(h.id==='apeilia'?1.6:h.id==='knibbs'?.65:1.1);
  return (1-b.hp/b.maxHp)*150+r*38-Math.pow(1-r,3)*38+h.shield*.16+resource+s.potions*2
    +(1-b.stagger/b.maxStagger)*9+(b.exposed?8:0)+(h.surgicalReady?3:0)+(h.specimen?5:0)+(h.secondary||0)*1.8+(h.attackBuff||0)*.08+(b.vulnerable?3:0)+(b.hardControl?6:0)
    +(b.core?40+b.coreHits*15:0)+(b.finale?40+b.finaleHits*15:0)-b.reforms*35;
}
// Once a win is available, finish with the fewest actions. Extra healing before
// a lethal strike must not inflate the reported recovery investment.
const planScore=(s,plan)=>s.mode==='victory'?1e6-plan.length*10+s.heroes[0].hp*.001:score(s);
function signature(s){
  // Logs/statistics do not affect decisions. All combat state fields remain in
  // the signature; equivalent orderings can share one search entry.
  const {log,serial,stats,...combat}=s;
  return JSON.stringify(combat);
}
export function chooseSoloTurn(state,width=12){
  let beam=[{state:structuredClone(state),plan:[]}],best=null;
  for(let depth=0;depth<=state.maxAp;depth++){
    const next=[],seen=new Set();
    for(const node of beam){
      const settled=structuredClone(node.state);
      if(settled.mode==='playing')apply(settled,['end']);
      const rank=planScore(settled,node.plan);
      if(!best||rank>best.score)best={score:rank,plan:[...node.plan,...(node.state.mode==='playing'?[['end']]:[])],settled};
      if(node.state.mode!=='playing'||depth===state.maxAp)continue;
      for(const action of choices(node.state)){
        const candidate=structuredClone(node.state),r=apply(candidate,action);
        if(!r.ok)throw new Error(`${action.join('/')}: ${r.error}`);
        const key=signature(candidate);if(seen.has(key))continue;seen.add(key);
        const future=structuredClone(candidate);if(future.mode==='playing')apply(future,['end']);
        next.push({state:candidate,plan:[...node.plan,action],score:planScore(future,[...node.plan,action])});
      }
    }
    beam=next.sort((a,b)=>b.score-a.score).slice(0,width);
    if(!beam.length)break;
  }
  return best;
}

export function runSolo(heroId,bossId,difficulty='standard',{width=12,policy='tactical',validate=true,includeState=false}={}){
  const state=createBattle(difficulty,bossId,{mode:'solo',partyIds:[heroId]});
  const stats={actions:[],damageTaken:0,recoveryAp:0,responseAp:0,guardAp:0,minimumHp:state.heroes[0].hp};
  for(let turn=0;state.mode==='playing'&&turn<35;turn++){
    let plan;
    if(policy==='tactical')plan=chooseSoloTurn(state,width).plan;
    else{
      const scratch=structuredClone(state);plan=[];
      while(scratch.mode==='playing'){
        const attack=activeSkills(scratch,heroId).map(k=>({id:k.id,p:skillPreview(scratch,heroId,k.id)})).filter(k=>!canUse(scratch,heroId,k.id)&&k.p.hits>0).sort((a,b)=>b.p.damage/b.p.ap-a.p.damage/a.p.ap)[0];
        if(!attack)break;const action=['skill',attack.id];apply(scratch,action);plan.push(action);
      }
      if(scratch.mode==='playing')plan.push(['end']);
    }
    for(const action of plan){
      const ap=state.ap,round=state.round,beforeHp=state.heroes[0].hp;
      const r=apply(state,action);if(!r.ok)throw new Error(`${heroId}/${bossId}: ${action}: ${r.error}`);
      stats.actions.push(`R${round} ${action.join('/')}`);
      const spent=action[0]==='end'?0:ap-state.ap;
      if(action[0]==='response')stats.responseAp+=spent;
      if(action[0]==='guard')stats.guardAp+=spent;
      if(action[0]==='potion'||r.events.some(e=>e.type==='heal'&&e.actor===heroId&&e.amount>0))stats.recoveryAp+=spent;
      for(const e of r.events)if(e.type==='boss')stats.damageTaken+=e.amounts?.[heroId]||0;
      stats.minimumHp=Math.min(stats.minimumHp,state.heroes[0].hp,beforeHp);
      if(validate&&state.mode==='playing'&&!normalizeSave(state))throw new Error(`Unsavable committed state: ${heroId}/${bossId} ${action}`);
      if(state.mode!=='playing')break;
    }
  }
  return {hero:heroId,boss:bossId,difficulty,policy,result:state.mode,round:state.round,hp:state.heroes[0].hp,potionsUsed:3-state.potions,bossHp:state.boss.hp,reforms:state.boss.reforms,breaks:state.stats.breaks,healed:state.stats.healed,...stats,...(includeState?{state}:{})};
}

if(process.argv[1]?.endsWith('solo-probe.mjs')){
  const heroArg=process.argv.find(a=>a.startsWith('--hero='))?.slice(7),bossArg=process.argv.find(a=>a.startsWith('--boss='))?.slice(7);
  const policy=process.argv.includes('--raw')?'raw':'tactical',difficulty=process.argv.find(a=>a.startsWith('--difficulty='))?.slice(13)||'standard';
  const rows=(heroArg?[heroArg]:HEROES.map(h=>h.id)).flatMap(hero=>(bossArg?[bossArg]:Object.keys(BOSSES)).map(boss=>runSolo(hero,boss,difficulty,{policy})));
  if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));else console.table(rows.map(({actions,...row})=>row));
  if(rows.some(row=>row.result!=='victory'))process.exitCode=1;
}
