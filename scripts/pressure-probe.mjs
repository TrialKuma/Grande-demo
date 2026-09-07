// Public-API balance probe. Policies never edit battle HP, AP, intentions or resources.
const {BOSSES,createBattle,activeSkills,canUse,heroOf,skillPreview,useSkill,usePotion,guard,prepareResponse,endRound,intentInfo}=await import(process.env.PRESSURE_COMBAT_MODULE||new URL('../src/combat.js',import.meta.url));

const names=['pass-only','raw-damage','parry-greedy','tactical'];
const totalHp=s=>s.heroes.reduce((n,h)=>n+h.hp,0);
const minRatio=s=>Math.min(...s.heroes.map(h=>h.hp/h.maxHp));
const living=s=>s.heroes.filter(h=>h.hp>0);
const healingSkills=new Set(['shelter','breathe','reboot','equilibrium','firstaid','suture','repair']);
function outgoing(s,stats,result){
  if(!result.ok)throw new Error(result.error);
  for(const e of result.events){
    if(e.type==='heal'&&e.actor!=='boss')stats.heals++;
    if(e.type==='shield'&&e.amount>0)stats.shields++;
    if(e.type==='boss'){
      const n=Object.values(e.amounts||{}).reduce((n,v)=>n+v,0);
      stats.damageTaken+=n;if(n)stats.damageEvents++;
    }
  }
  stats.minimumHpRatio=Math.min(stats.minimumHpRatio,minRatio(s));
  stats.onState?.(s);
}
function cast(s,stats,id,k){if(canUse(s,id,k))return false;const p=skillPreview(s,id,k);if(healingSkills.has(k))stats.recoveryAp+=p.ap;outgoing(s,stats,useSkill(s,id,k));stats.actions.push(`R${s.round} ${id}/${k}`);return true;}
function response(s,stats,id){
  if(s.response||s.boss.core||s.boss.broken||s.boss.hardControl||!s.ap)return false;
  let actor=living(s).find(h=>h.id==='knibbs')||living(s)[0];
  if(id==='evade')actor=living(s).find(h=>h.id==='apeilia')||actor;
  outgoing(s,stats,prepareResponse(s,id,actor.id));stats.responses[id]++;stats.actions.push(`R${s.round} ${id}`);return true;
}
function next(s,stats){
  const attacks=!s.boss.broken&&!s.boss.core;
  const r=endRound(s);outgoing(s,stats,r);if(attacks)stats.enemyActions++;
  stats.refunds+=s.ap===7?1:0;
}
function bestDamage(s,{lethal=false}={}){
  return s.heroes.flatMap(h=>activeSkills(s,h.id).map(k=>({h:h.id,k:k.id,p:skillPreview(s,h.id,k.id)})))
    .filter(x=>!canUse(s,x.h,x.k)&&x.p.damage>0&&(!lethal||x.p.damage>=s.boss.hp))
    .sort((a,b)=>b.p.damage/b.p.ap-a.p.damage/a.p.ap||b.p.damage-a.p.damage)[0];
}
function terminal(s,stats,policy){
  const b=s.boss;
  if(!b.core&&!b.finale)return false;
  if(!stats.firstExposure)stats.firstExposure={round:s.round,hp:s.heroes.map(h=>h.hp)};
  const p=b.core?b.corePhysical<3:!b.finalePhysical,m=b.core?b.coreMagic<3:!b.finaleMagic;
  const needed=living(s).flatMap(h=>activeSkills(s,h.id).map(k=>({h:h.id,k:k.id,preview:skillPreview(s,h.id,k.id)})))
    .filter(c=>!canUse(s,c.h,c.k)&&c.preview.hits>0&&(c.preview.kind==='physical'?p:m))
    .sort((a,c)=>c.preview.hits/c.preview.ap-a.preview.hits/a.preview.ap);
  if(needed.length){cast(s,stats,needed[0].h,needed[0].k);return true;}
  if(b.finale&&policy!=='raw-damage'&&response(s,stats,policy==='tactical'?'evade':'parry'))return true;
  if(b.finale&&policy==='tactical'&&!p&&!m&&s.ap&&s.potions){const hurt=[...living(s)].sort((a,b)=>a.hp-b.hp)[0];if(hurt?.hp<35){stats.recoveryAp++;outgoing(s,stats,usePotion(s,hurt.id));stats.actions.push(`R${s.round} potion/${hurt.id}`);return true;}}
  next(s,stats);return true;
}
function tactical(s,stats){
  const b=s.boss,low=[...s.heroes].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  // A confirmed finishing blow prevents the enemy action altogether. Do not
  // spend several turns healing through an attack that can already be stopped.
  if(!b.core&&!b.finale){
    const finisher=bestDamage(s,{lethal:true});
    if(finisher){cast(s,stats,finisher.h,finisher.k);return;}
  }
  if(b.finale&&response(s,stats,'evade'))return;
  // Complete the exposed mechanism before spending the shared AP on optional
  // healing. The terminal round is won by registration plus a live response.
  if(terminal(s,stats,'tactical'))return;
  if(low.hp<45&&s.ap&&s.potions){stats.recoveryAp++;outgoing(s,stats,usePotion(s,low.id));return;}
  if(!b.broken&&!b.controlImmune&&(b.charging||['pierce','duel','drain','bloom','storm','silence','rewrite','zero_pulse'].includes(b.intent))&&cast(s,stats,'ric','bind'))return;
  if(!b.broken&&low.hp/low.maxHp<Number(process.env.PRESSURE_HEAL_THRESHOLD||.5)){
    if(low.id==='knibbs'&&cast(s,stats,'knibbs','breathe'))return;
    if(low.id==='apeilia'&&cast(s,stats,'apeilia','reboot'))return;
    if(!b.weakened&&cast(s,stats,'ric','mend'))return;
    if(low.id==='ric'&&heroOf(s,'ric')?.resource<-1&&cast(s,stats,'ric','shelter'))return;
  }
  if(!s.response&&!b.broken&&s.ap){
    const key=b.charging?'quake':b.intent;
    const pick=['quake','pierce','bloom','storm','sever','zero_pulse'].includes(key)?'evade':['fog','weave','charge'].includes(key)?'counter':'parry';
    if(response(s,stats,pick))return;
  }
  if(b.id==='duelist'&&b.mirror&&(cast(s,stats,'apeilia','purify')||cast(s,stats,'ric','rune')))return;
  if((b.id==='cantor'&&b.spores||b.id==='warden'&&b.charge>=3)&&(cast(s,stats,'knibbs','scatter')||cast(s,stats,'apeilia','eden')||cast(s,stats,'apeilia','blade')))return;
  if(b.id==='weaver'&&b.seals){
    if(b.sealedKind==='physical'&&(cast(s,stats,'apeilia','purify')||cast(s,stats,'ric','rune')))return;
    if(b.sealedKind==='magic'&&(cast(s,stats,'knibbs','scatter')||cast(s,stats,'apeilia','eden')||cast(s,stats,'apeilia','blade')))return;
  }
  if(b.id==='final'&&b.seals&&b.lastKind==='physical'&&(cast(s,stats,'apeilia','sentinel')||cast(s,stats,'apeilia','purify')||cast(s,stats,'ric','rune')))return;
  if(!b.marked&&cast(s,stats,'knibbs','focus'))return;
  const apeilia=heroOf(s,'apeilia');
  if(apeilia?.lastKind==='physical'&&(cast(s,stats,'apeilia','sentinel')||cast(s,stats,'apeilia','purify')))return;
  if(apeilia?.lastKind==='magic'&&cast(s,stats,'apeilia','eden'))return;
  if(cast(s,stats,'apeilia','blade')||cast(s,stats,'knibbs','shot'))return;
  next(s,stats);
}
export function runPolicy(bossId,policy,difficulty='standard',{includeState=false,onState=null}={}){
  const s=createBattle(difficulty,bossId),stats={damageTaken:0,damageEvents:0,heals:0,shields:0,recoveryAp:0,minimumHpRatio:1,enemyActions:0,refunds:0,responses:{parry:0,evade:0,counter:0},actions:[],firstExposure:null,onState};
  for(let step=0;step<500&&s.mode==='playing'&&s.round<40;step++){
    if(policy==='pass-only'){next(s,stats);continue;}
    if(policy==='tactical'){tactical(s,stats);continue;}
    if(terminal(s,stats,policy))continue;
    if(policy==='parry-greedy'&&response(s,stats,'parry'))continue;
    const best=bestDamage(s);
    if(best)cast(s,stats,best.h,best.k);else next(s,stats);
  }
  return {boss:bossId,policy,result:s.mode,round:s.round,enemyActions:stats.enemyActions,hp:s.heroes.map(h=>h.hp).join('/'),hpPercent:Math.round(totalHp(s)/s.heroes.reduce((n,h)=>n+h.maxHp,0)*100),minimumHpPercent:Math.round(stats.minimumHpRatio*100),damageTaken:stats.damageTaken,recoveryAp:stats.recoveryAp,healed:s.stats.healed,potionsUsed:3-s.potions,breaks:s.stats.breaks,refunds:stats.refunds,responses:stats.responses,firstExposure:stats.firstExposure,actions:stats.actions,...(includeState?{state:s}:{})};
}
export function attackPressure(bossId){
  const s=createBattle('standard',bossId),out=[];
  for(let i=0;i<5&&s.mode==='playing';i++){
    const info=intentInfo(s),row={boss:bossId,round:s.round,intent:info.name,description:info.desc};
    for(const responseId of ['none','parry','evade']){
      const clone=structuredClone(s);
      if(responseId!=='none'){
        const prepared=prepareResponse(clone,responseId,living(clone)[0].id);
        if(!prepared.ok)throw new Error(prepared.error);
      }
      const before=clone.heroes.map(h=>h.hp);endRound(clone);
      row[responseId]=clone.heroes.map((h,index)=>before[index]-h.hp).join('/');
    }
    out.push(row);endRound(s);
  }
  return out;
}

if(process.argv[1]?.endsWith('pressure-probe.mjs')){
  const battles=Object.keys(BOSSES).flatMap(id=>names.map(policy=>runPolicy(id,policy)));
  if(process.argv.includes('--json'))console.log(JSON.stringify({battles,pressure:Object.keys(BOSSES).flatMap(attackPressure)},null,2));
  else{
    console.table(battles.map(({actions,responses,firstExposure,...row})=>row));
    console.table(Object.keys(BOSSES).flatMap(attackPressure).map(({description,...row})=>row));
    console.log('Raw-damage final exposure (victory requires a response by design):',battles.find(x=>x.boss==='final'&&x.policy==='raw-damage').firstExposure);
  }
}
