// Deterministic solo play probe. Search only simulates public actions on copies;
// the committed battle never edits HP, AP, resources, intentions or rewards.
import {BOSSES,HEROES,createBattle,activeSkills,canUse,skillPreview,useSkill,usePotion,guard,prepareResponse,endRound,enemyTargets} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';

// Fixed before entering combat. Each build must cover offense, resource flow and survival.
export const SOLO_LOADOUTS={knibbs:['shot','focus','loadburst','cover'],apeilia:['blade','purify','reboot','eden'],ric:['rune','shelter','bind','mend'],haart:['page','rest','soothe','relay'],qianxing:['spike','repair','armor','beam'],youmu:['scalpel','surgery','firstaid','bloodoath'],patch:['keyblade','bookward','chargedslash','fragments']};
export const SOLO_BOSS_LOADOUTS={haart:{weaver:['relay','soothe','rest','anchor'],arbiter:['relay','soothe','rest','anchor']},youmu:{duelist:['surgery','firstaid','bloodoath','sterilize'],final:['surgery','firstaid','bloodoath','sterilize']},patch:{final:['bookward','chargedslash','fragments','collate']}};
export const soloLoadoutFor=(heroId,bossId)=>[...(SOLO_BOSS_LOADOUTS[heroId]?.[bossId]||SOLO_LOADOUTS[heroId]||[])];
function choices(s){
  const h=s.heroes[0],actions=enemyTargets(s).flatMap(e=>activeSkills(s,h.id).filter(k=>!canUse(s,h.id,k.id,e.id)).map(k=>['skill',k.id,e.id]));
  if(s.ap&&s.potions&&h.hp<h.maxHp)actions.push(['potion']);
  return actions;
}
function apply(s,[kind,id,target]){
  const h=s.heroes[0];
  return kind==='skill'?useSkill(s,h.id,id,target):kind==='potion'?usePotion(s,h.id):kind==='guard'?guard(s,h.id):kind==='response'?prepareResponse(s,id,h.id):endRound(s);
}
function score(s){
  if(s.mode==='victory')return 1e6+s.heroes[0].hp;
  if(s.mode==='defeat')return -1e6;
  const h=s.heroes[0],b=s.boss,r=h.hp/h.maxHp;
  const resource=h.id==='ric'?h.ricEdge*2:h.resource*(h.id==='apeilia'?1.6:h.id==='knibbs'?.65:1.1);
  const addScore=(s.enemies||[]).filter(e=>e.unitId!=='boss').reduce((n,e)=>n+(1-e.hp/e.maxHp)*28+(e.defeated?22:0),0);
  return addScore+(1-b.hp/b.maxHp)*150+r*38-Math.pow(1-r,3)*38+h.shield*.16+resource+s.potions*8
    +(1-b.stagger/b.maxStagger)*9+(b.exposed?8:0)+(h.surgicalReady?3:0)+(h.specimen?5:0)+(h.secondary||0)*1.8+(h.attackBuff||0)*.08+(b.vulnerable?3:0)+(b.hardControl?6:0)
    +(h.intuition||0)*1.7+(h.ammo&&h.ammo!=='normal'?5:0)+(h.ricChaos?2:0)+(b.core?40+b.coreHits*15:0)+(b.finale?40+b.finaleHits*15:0)-b.reforms*35;
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
export function chooseSoloTurn(state,width=12,horizon=1){
  const endings=[];
  let beam=[{state:structuredClone(state),plan:[]}],best=null;
  const actionLimit=state.maxAp+Math.ceil(state.maxAp/2)+1;
  for(let depth=0;depth<=actionLimit;depth++){
    const next=[],seen=new Set();
    for(const node of beam){
      const settled=structuredClone(node.state);
      if(settled.mode==='playing')apply(settled,['end']);
      const rank=planScore(settled,node.plan);
      if(horizon>1)endings.push({score:rank,plan:[...node.plan,...(node.state.mode==='playing'?[['end']]:[])],settled});
      if(!best||rank>best.score)best={score:rank,plan:[...node.plan,...(node.state.mode==='playing'?[['end']]:[])],settled};
      if(node.state.mode!=='playing'||depth===actionLimit)continue;
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
  if(horizon>1&&best?.settled.mode!=='victory'){
    const seen=new Set(),candidates=endings.sort((a,b)=>b.score-a.score).filter(entry=>{const key=signature(entry.settled);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,Math.max(12,width));
    let futureBest=null;
    for(const candidate of candidates){
      const future=candidate.settled.mode==='playing'?chooseSoloTurn(candidate.settled,width,horizon-1):candidate;
      const rank=future.score+candidate.score*.15;
      if(!futureBest||rank>futureBest.rank)futureBest={rank,candidate};
    }
    if(futureBest)best=futureBest.candidate;
  }
  return best;
}

// Weaver's resource seal is telegraphed a round ahead; include that round when
// evaluating Haart's preparation. This changes decisions, never combat numbers.
export function runSolo(heroId,bossId,difficulty='standard',{width=heroId==='haart'&&bossId==='weaver'?8:12,policy='tactical',validate=true,includeState=false,loadout=soloLoadoutFor(heroId,bossId),upgrades=[],horizon=heroId==='haart'&&bossId==='weaver'?2:1}={}){
  const state=createBattle(difficulty,bossId,{mode:'solo',partyIds:[heroId],loadouts:{[heroId]:loadout},upgrades});
  const fixedLoadout=JSON.stringify(state.loadouts[heroId]),fixedUpgrades=JSON.stringify(state.upgrades);
  const stats={actions:[],damageTaken:0,recoveryAp:0,responseAp:0,guardAp:0,defenseAp:0,minimumHp:state.heroes[0].hp};
  for(let turn=0;state.mode==='playing'&&turn<35;turn++){
    let plan;
    if(policy==='tactical')plan=chooseSoloTurn(state,width,horizon).plan;
    else{
      const scratch=structuredClone(state);plan=[];
      while(scratch.mode==='playing'){
        const attack=activeSkills(scratch,heroId).map(k=>({id:k.id,p:skillPreview(scratch,heroId,k.id)})).filter(k=>!canUse(scratch,heroId,k.id)&&k.p.hits>0).sort((a,b)=>b.p.damage/b.p.ap-a.p.damage/a.p.ap)[0];
        if(!attack)break;const action=['skill',attack.id];apply(scratch,action);plan.push(action);
      }
      if(scratch.mode==='playing')plan.push(['end']);
    }
    for(const action of plan){
      const ap=state.ap,round=state.round,beforeHp=state.heroes[0].hp,isDefense=action[0]==='skill'&&skillPreview(state,heroId,action[1],action[2]).defensive;
      const r=apply(state,action);if(!r.ok)throw new Error(`${heroId}/${bossId}: ${action}: ${r.error}`);
      stats.actions.push(`R${round} ${action.join('/')}`);
      const spent=action[0]==='end'?0:ap-state.ap;
      if(isDefense)stats.defenseAp+=spent;
      if(action[0]==='response')stats.responseAp+=spent;
      if(action[0]==='guard')stats.guardAp+=spent;
      if(action[0]==='potion'||r.events.some(e=>e.type==='heal'&&e.actor===heroId&&e.amount>0))stats.recoveryAp+=spent;
      for(const e of r.events)if(e.type==='boss')stats.damageTaken+=e.amounts?.[heroId]||0;
      stats.minimumHp=Math.min(stats.minimumHp,state.heroes[0].hp,beforeHp);
      if(JSON.stringify(state.upgrades)!==fixedUpgrades)throw new Error(`Growth changed during combat: ${heroId}/${bossId}`);
      if(JSON.stringify(state.loadouts[heroId])!==fixedLoadout)throw new Error(`Loadout changed during combat: ${heroId}/${bossId}`);
      if(validate&&state.mode==='playing'&&!normalizeSave(state))throw new Error(`Unsavable committed state: ${heroId}/${bossId} ${action}`);
      if(state.mode!=='playing')break;
    }
  }
  return {hero:heroId,boss:bossId,loadout:JSON.parse(fixedLoadout),upgrades:JSON.parse(fixedUpgrades),horizon,difficulty,policy,result:state.mode,round:state.round,hp:state.heroes[0].hp,potionsUsed:3-state.potions,bossHp:state.boss.hp,reforms:state.boss.reforms,breaks:state.stats.breaks,healed:state.stats.healed,...stats,...(includeState?{state}:{})};
}

if(process.argv[1]?.endsWith('solo-probe.mjs')){
  const heroArg=process.argv.find(a=>a.startsWith('--hero='))?.slice(7),bossArg=process.argv.find(a=>a.startsWith('--boss='))?.slice(7);
  const policy=process.argv.includes('--raw')?'raw':'tactical',difficulty=process.argv.find(a=>a.startsWith('--difficulty='))?.slice(13)||'standard';
  const loadoutArg=process.argv.find(a=>a.startsWith('--loadout='))?.slice(10).split(','),upgradesArg=process.argv.find(a=>a.startsWith('--upgrades='))?.slice(11).split(',')||[];
  const horizonArg=process.argv.find(a=>a.startsWith('--horizon='))?.slice(10),widthArg=process.argv.find(a=>a.startsWith('--width='))?.slice(8);
  const rows=(heroArg?[heroArg]:HEROES.map(h=>h.id)).flatMap(hero=>(bossArg?[bossArg]:Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion)).map(boss=>runSolo(hero,boss,difficulty,{policy,upgrades:upgradesArg,...(horizonArg?{horizon:Number(horizonArg)}:{}),...(widthArg?{width:Number(widthArg)}:{}),...(loadoutArg?{loadout:loadoutArg}:{})})));
  if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));else console.table(rows.map(({actions,...row})=>row));
  if(rows.some(row=>row.result!=='victory'))process.exitCode=1;
}
