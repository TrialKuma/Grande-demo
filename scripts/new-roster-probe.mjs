// A complete encounter probe driven only through public player actions.
import {BOSSES,createBattle,activeSkills,resolvedSkill,canUse,heroOf,skillPreview,useSkill,usePotion,prepareResponse,endRound} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
const parties=[['youmu','patch','ric'],['youmu','apeilia','patch']];
export function probeNewRoster(party,boss){
 const s=createBattle('standard',boss,{partyIds:party}),actions=[];let supportAp=0,resourceAp=0;
 const ratio=h=>h.hp/h.maxHp;
 const act=(fn,label)=>{const r=fn();if(!r.ok)throw Error(`${label}: ${r.error}`);actions.push(`R${s.round} ${label}`);if(s.mode==='playing'&&!normalizeSave(s))throw Error(`unsaveable after ${label}`);};
 const cast=c=>{if(c.k.gain&&!c.p.damage)resourceAp+=c.p.ap;else if(!c.p.damage&&(c.p.heal||c.p.shield))supportAp+=c.p.ap;act(()=>useSkill(s,c.h.id,c.k.id),`${c.h.id}/${c.k.id}`);};
 const response=()=>{if(s.response||s.boss.core||s.boss.broken||!s.ap)return false;const h=s.heroes.filter(h=>h.hp>0).sort((a,b)=>a.resource/a.maxResource-b.resource/b.maxResource)[0];const id=['reclaim','weave','drain','rewrite','zero_reset'].includes(s.boss.intent)?'parry':'evade';act(()=>prepareResponse(s,id,h.id),id);return true;};
 for(let step=0;s.mode==='playing'&&s.round<=35&&step<700;step++){
  const options=s.heroes.flatMap(h=>activeSkills(s,h.id).filter(k=>!canUse(s,h.id,k.id)).map(k=>({h,k:resolvedSkill(s,h.id,k.id),p:skillPreview(s,h.id,k.id)}))),b=s.boss;
  const find=(id,key)=>options.find(c=>c.h.id===id&&c.k.id===key),low=[...s.heroes].sort((a,b)=>ratio(a)-ratio(b))[0];
  const finish=options.filter(c=>c.p.damage>=b.hp&&c.p.damage>0&&!b.core&&!b.finale).sort((a,c)=>a.p.ap-c.p.ap)[0];if(finish){cast(finish);continue;}
  if(low.hp<25&&s.ap&&s.potions){act(()=>usePotion(s,low.id),`potion/${low.id}`);continue;}
  if(b.core||b.finale){
   const remain={physical:b.core?3-b.corePhysical:1-b.finalePhysical,magic:b.core?3-b.coreMagic:1-b.finaleMagic};
   const hit=options.filter(c=>c.p.hits&&remain[c.p.kind]>0).sort((a,c)=>Math.min(c.p.hits,remain[c.p.kind])/c.p.ap-Math.min(a.p.hits,remain[a.p.kind])/a.p.ap)[0];
   if(hit){cast(hit);continue;}if(b.finale&&response())continue;act(()=>endRound(s),'end');continue;
  }
  const interrupt=find('ric','bind');if(interrupt&&interrupt.p.notes.some(n=>n.includes('直接打断'))){cast(interrupt);continue;}
  const captain=find('youmu','bloodoath');if(captain?.k.transform&&!b.broken&&s.ap>=4){cast(captain);continue;}
  const missing=s.heroes.filter(h=>h.hp>0).reduce((n,h)=>n+h.maxHp-h.hp,0);
  if(ratio(low)<.57||missing>125){
   const heal=options.filter(c=>c.p.heal&&!c.p.self&&c.h.youmuForm!=='captain').sort((a,c)=>(c.p.heal+2*c.p.allHeal)/c.p.ap-(a.p.heal+2*a.p.allHeal)/a.p.ap)[0];if(heal){cast(heal);continue;}
   const recover=find('youmu','sterilize');if(recover&&heroOf(s,'youmu').resource<4&&s.ap>=3){cast(recover);continue;}
   const reverse=find('ric','crossing');if(reverse&&heroOf(s,'ric').resource<0&&s.ap>=3){cast(reverse);continue;}
  }
  if(response())continue;
  const specimen=find('youmu','surgery');if(specimen?.k.transplant&&missing>35){cast(specimen);continue;}
  if(specimen?.k.captureLayer){cast(specimen);continue;}
  const rec=options.find(c=>['collate','sterilize'].includes(c.k.id)&&c.h.resource<=4&&(s.ap>=3||ratio(c.h)<.85));if(rec){cast(rec);continue;}
  const hit=options.filter(c=>c.p.damage>0).sort((a,c)=>{
   const score=v=>{let bonus=v.p.stagger*.35;
    if(b.id==='duelist'&&v.p.kind==='magic')bonus+=Math.min(b.mirror,v.p.hits)*14;
    if(b.id==='cantor'&&v.p.kind==='physical')bonus+=Math.min(b.spores,v.p.hits)*14;
    if(b.id==='warden'&&v.p.kind==='physical')bonus+=Math.min(b.charge,v.p.hits)*14;
    if(b.id==='weaver'&&v.p.kind!==b.sealedKind)bonus+=Math.min(b.seals,v.p.hits)*14;
    if(b.id==='final'&&b.seals&&b.lastKind&&v.p.kind!==b.lastKind)bonus+=20;
    if(v.k.surgicalSetup&&!v.h.surgicalReady&&!v.h.specimen&&s.ap>=3)bonus+=14;
    return (v.p.damage+bonus)/v.p.ap;
   };return score(c)-score(a);
  })[0];if(hit){cast(hit);continue;}
  const refill=options.find(c=>['collate','sterilize'].includes(c.k.id)&&c.h.resource<10);if(refill){cast(refill);continue;}
  act(()=>endRound(s),'end');
 }
 return {party:party.join('/'),boss,result:s.mode,round:s.round,hp:s.heroes.map(h=>h.hp).join('/'),potionsUsed:3-s.potions,supportAp,resourceAp,bossHp:s.boss.hp,actions};
}
if(process.argv[1]?.endsWith('new-roster-probe.mjs')){const results=parties.flatMap(p=>Object.keys(BOSSES).map(b=>probeNewRoster(p,b)));console.table(results.map(({actions,...r})=>r));if(process.argv.includes('--json'))console.log(JSON.stringify(results));if(results.some(r=>r.result!=='victory'))process.exitCode=1;}
