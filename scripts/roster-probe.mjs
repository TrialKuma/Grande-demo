// End-to-end recruit probe. Every action goes through a public combat API;
// no HP, AP, intent, resource, loadout or reward fields are edited during play.
import {BOSSES,createBattle,activeSkills,canUse,heroOf,skillPreview,useSkill,usePotion,prepareResponse,endRound} from '../src/combat.js';

const parties=[['haart','apeilia','qianxing'],['haart','ric','qianxing']];
const living=state=>state.heroes.filter(h=>h.hp>0);
const ready=(state)=>state.heroes.flatMap(h=>activeSkills(state,h.id).map(s=>({hero:h,skill:s,preview:skillPreview(state,h.id,s.id)}))).filter(c=>!canUse(state,c.hero.id,c.skill.id));
const ratio=h=>h.hp/h.maxHp;
function record(state,stats,result,label,ap,category){
  if(!result.ok)throw new Error(`${label}: ${result.error}`);
  stats.actions.push(`R${state.round} ${label}`);
  if(category)stats[category]+=ap;
  for(const e of result.events)if(e.type==='boss')stats.damageTaken+=Object.values(e.amounts||{}).reduce((n,v)=>n+v,0);
}
function cast(state,stats,c){
  // Mana recovery actions also heal their user; count each AP once, under
  // manaRecoveryAp. recoveryAp records the remaining healing/protection uses.
  const category=c.skill.id==='rest'||c.skill.id==='repair'?'manaRecoveryAp':c.preview.heal||c.preview.shield?'recoveryAp':null;
  const result=useSkill(state,c.hero.id,c.skill.id);record(state,stats,result,`${c.hero.id}/${c.skill.id}`,c.preview.ap,category);
}
function respond(state,stats,id){
  if(state.response||state.boss.broken||state.boss.core||!state.ap)return false;
  const actor=[...living(state)].sort((a,b)=>a.resource/a.maxResource-b.resource/b.maxResource)[0];
  const result=prepareResponse(state,id,actor.id);if(!result.ok)return false;
  stats.responses[id]++;record(state,stats,result,`${actor.id}/${id}`,1,'tacticalAp');return true;
}
function next(state,stats){record(state,stats,endRound(state),'end',0);}
function damageScore(state,c){
  const b=state.boss,s=c.skill,p=c.preview;
  let bonus=p.stagger*.36;
  if(b.id==='duelist'&&b.mirror&&s.kind==='magic')bonus+=Math.min(b.mirror,p.hits)*18;
  if(b.id==='cantor'&&b.spores&&s.kind==='physical')bonus+=Math.min(b.spores,p.hits)*16;
  if(b.id==='warden'&&b.charge&&s.kind==='physical')bonus+=Math.min(b.charge,p.hits)*15;
  if(b.id==='weaver'&&b.seals&&s.kind!==b.sealedKind)bonus+=Math.min(b.seals,p.hits)*18;
  if(b.id==='final'&&b.seals&&b.lastKind&&s.kind!==b.lastKind)bonus+=25;
  if(c.hero.id==='apeilia')bonus+=Math.max(0,p.resourceAfter-p.resourceBefore)*8;
  return (p.damage+bonus)/p.ap;
}
export function probeRoster(partyIds,boss){
  const state=createBattle('standard',boss,{partyIds}),stats={actions:[],tacticalAp:0,recoveryAp:0,manaRecoveryAp:0,damageTaken:0,responses:{parry:0,evade:0,counter:0}};
  for(let step=0;state.mode==='playing'&&state.round<=45&&step<700;step++){
    const options=ready(state),b=state.boss,low=[...state.heroes].sort((a,b)=>ratio(a)-ratio(b))[0];
    const find=(hero,skill)=>options.find(c=>c.hero.id===hero&&c.skill.id===skill);
    const finisher=options.filter(c=>c.preview.damage>=b.hp&&c.preview.damage>0&&!b.core&&!b.finale).sort((a,b)=>a.preview.ap-b.preview.ap)[0];
    if(finisher){cast(state,stats,finisher);continue;}
    if(state.potions&&state.ap&&low.hp<40){record(state,stats,usePotion(state,low.id),`potion/${low.id}`,1,'recoveryAp');continue;}
    if(b.core||b.finale){
      const physical=b.core?Math.max(0,3-b.corePhysical):1-b.finalePhysical,magic=b.core?Math.max(0,3-b.coreMagic):1-b.finaleMagic;
      const missing=options.filter(c=>c.preview.hits>0&&(c.skill.kind==='physical'?physical:magic)>0).sort((a,c)=>Math.min(c.preview.hits,c.skill.kind==='physical'?physical:magic)/c.preview.ap-Math.min(a.preview.hits,a.skill.kind==='physical'?physical:magic)/a.preview.ap)[0];
      if(missing){cast(state,stats,missing);continue;}
      if(b.finale&&respond(state,stats,'evade'))continue;
      next(state,stats);continue;
    }
    const interrupt=find('ric','bind');
    if(interrupt&&interrupt.preview.notes.some(n=>n.includes('直接打断'))){cast(state,stats,interrupt);continue;}
    const missingHp=living(state).reduce((sum,h)=>sum+h.maxHp-h.hp,0);
    if(!b.broken&&(ratio(low)<.58||missingHp>125)){
      const heal=find('haart','soothe')||find('ric','mend');
      if(heal){cast(state,stats,heal);continue;}
      const mana=find('haart','rest');
      if(mana&&heroOf(state,'haart').resource<5&&state.ap>=3){cast(state,stats,mana);continue;}
      const balance=find('ric','shelter');
      if(balance&&heroOf(state,'ric').resource<0){cast(state,stats,balance);continue;}
    }
    if(!state.response&&!b.broken){
      const key=b.charging?'quake':b.intent;
      const choose=['reclaim','weave','drain','rewrite','zero_reset'].includes(key)?'parry':['fog','charge'].includes(key)?'counter':'evade';
      if(respond(state,stats,choose))continue;
    }
    // Recharge is a real 1 AP opportunity cost. Use it before the burst is
    // unaffordable, and especially when the same action also repairs damage.
    const recharge=options.find(c=>(c.skill.id==='rest'||c.skill.id==='repair')&&c.hero.resource<=5&&(state.ap>=3||ratio(c.hero)<.85));
    if(recharge){cast(state,stats,recharge);continue;}
    const damage=options.filter(c=>c.preview.damage>0).sort((a,b)=>damageScore(state,b)-damageScore(state,a))[0];
    if(damage){cast(state,stats,damage);continue;}
    const fallback=options.find(c=>(c.skill.id==='rest'||c.skill.id==='repair')&&c.hero.resource<10);
    if(fallback){cast(state,stats,fallback);continue;}
    next(state,stats);
  }
  return {party:partyIds.join('/'),boss,result:state.mode,round:state.round,hp:state.heroes.map(h=>h.hp).join('/'),potionsUsed:3-state.potions,tacticalAp:stats.tacticalAp,recoveryAp:stats.recoveryAp,manaRecoveryAp:stats.manaRecoveryAp,damageTaken:stats.damageTaken,healed:state.stats.healed,breaks:state.stats.breaks,responses:stats.responses,actions:stats.actions,bossHp:state.boss.hp,core:state.boss.core,finale:state.boss.finale};
}

if(process.argv[1]?.endsWith('roster-probe.mjs')){
  const rows=parties.flatMap(party=>Object.keys(BOSSES).map(boss=>probeRoster(party,boss)));
  if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));
  else console.table(rows.map(({actions,responses,...row})=>row));
  if(rows.some(row=>row.result!=='victory'))process.exitCode=1;
}
