// Public-API balance probe. Policies never edit battle HP, AP, intentions or resources.
const {BOSSES,DIFFICULTIES,createBattle,activeSkills,canUse,heroOf,skillPreview,useSkill,usePotion,endRound,intentInfo,enemyById,enemyTargets,selectEnemyTarget}=await import(process.env.PRESSURE_COMBAT_MODULE||new URL('../src/combat.js',import.meta.url));

const foe=s=>enemyById(s,s.selectedEnemyId)||s.boss;
function targetPriority(s){const es=enemyTargets(s);const target=es.find(e=>e.role==='device')||es.find(e=>e.guardianFor)||es.find(e=>e.id==='boss')||es[0];if(target)selectEnemyTarget(s,target.id);}
const names=['pass-only','raw-damage','defense-greedy','tactical'];
const totalHp=s=>s.heroes.reduce((n,h)=>n+h.hp,0);
const minRatio=s=>Math.min(...s.heroes.map(h=>h.hp/h.maxHp));
const living=s=>s.heroes.filter(h=>h.hp>0);
const healingSkills=new Set(['shelter','breathe','reboot','equilibrium','firstaid','suture','repair']);
const probeLoadouts={knibbs:['shot','focus','loadburst','cover'],apeilia:['blade','purify','eden','reboot'],ric:['rune','bind','shelter','mend']};
function policyLoadouts(bossId,policy){
  if(policy!=='tactical')return probeLoadouts;
  // Scatter only prepares a six-hit shot; loading does not remove boss layers.
  // Ric and Apeilia supply defense while the fourth slot restores breath.
  return {...probeLoadouts,knibbs:['shot','focus',['golem','warden','cantor'].includes(bossId)?'scatter':'loadburst','breathe']};
}
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
function cast(s,stats,id,k,target){if(target)selectEnemyTarget(s,target);if(canUse(s,id,k))return false;const p=skillPreview(s,id,k);if(healingSkills.has(k))stats.recoveryAp+=p.ap;outgoing(s,stats,useSkill(s,id,k));stats.actions.push(`R${s.round} ${id}/${k}${target?' @'+target:''}`);return true;}
function response(s,stats){
  if(foe(s).core||foe(s).broken||foe(s).hardControl||!s.ap)return false;
  const target=heroOf(s,foe(s).intentTarget),ric=heroOf(s,'ric');
  if(!foe(s).finale||!foe(s).finaleProtected){
    if(!foe(s).cover&&cast(s,stats,'knibbs','cover'))return true;
    const gunner=heroOf(s,'knibbs'),load=activeSkills(s,'knibbs').find(k=>k.loadAmmo);
    if(!foe(s).cover&&activeSkills(s,'knibbs').some(k=>k.id==='cover')&&gunner?.ammo==='normal'&&!gunner.specialSpent&&s.ap>=3&&load&&cast(s,stats,'knibbs',load.id))return true;
    if(target?.id==='apeilia'&&!target.evasion&&cast(s,stats,'apeilia','reboot'))return true;
    if(target?.id==='ric'&&target.shield<30&&cast(s,stats,'ric','shelter'))return true;
    // Negative domain is derived from Ric's balance, not boss.weakened.
    if(ric?.resource>=0&&cast(s,stats,'ric','mend'))return true;
    if(foe(s).finale&&(cast(s,stats,'apeilia','reboot')||cast(s,stats,'ric','shelter')))return true;
  }
  return false;
}
function next(s,stats){
  const attacks=!foe(s).broken&&!foe(s).core;
  const round=s.round,r=endRound(s);outgoing(s,stats,r);stats.actions.push(`R${round} end`);if(attacks)stats.enemyActions++;
  stats.refunds+=s.ap===7?1:0;
}
function bestDamage(s,{lethal=false}={}){
  return s.heroes.flatMap(h=>activeSkills(s,h.id).map(k=>({h:h.id,k:k.id,p:skillPreview(s,h.id,k.id)})))
    .filter(x=>!canUse(s,x.h,x.k)&&x.p.damage>0&&(!lethal||x.p.damage>=foe(s).hp))
    .sort((a,b)=>b.p.damage/b.p.ap-a.p.damage/a.p.ap||b.p.damage-a.p.damage)[0];
}
function typedDamage(s,stats,kind){
  const options=living(s).flatMap(h=>activeSkills(s,h.id).map(k=>({h:h.id,k:k.id,p:skillPreview(s,h.id,k.id)})))
    .filter(x=>!canUse(s,x.h,x.k)&&x.p.kind===kind&&x.p.hits>0)
    .sort((a,b)=>b.p.hits-a.p.hits||b.p.damage-a.p.damage);
  return !!options.length&&cast(s,stats,options[0].h,options[0].k);
}
function gunCycle(s,stats){
  const h=heroOf(s,'knibbs');if(!h||h.hp<=0)return false;
  const loader=activeSkills(s,'knibbs').find(k=>k.loadAmmo)?.id;
  // Complete the finite confirmation window. After firing a special round,
  // this same loader becomes a one-AP ordinary reload rather than another load.
  if(h.followupReady&&!h.followupUsed?.includes('load')&&h.ammo==='normal'&&!h.specialSpent&&loader&&cast(s,stats,'knibbs',loader))return true;
  if(h.followupReady&&!h.followupUsed?.includes('shot')&&cast(s,stats,'knibbs','shot'))return true;
  if(h.specialSpent&&loader&&cast(s,stats,'knibbs',loader))return true;
  if(!h.followupReady&&cast(s,stats,'knibbs','focus'))return true;
  if(h.ammo!=='normal'&&cast(s,stats,'knibbs','shot'))return true;
  return false;
}
function terminal(s,stats,policy){
  const b=foe(s);
  if(!b.core&&!b.finale)return false;
  if(!stats.firstExposure)stats.firstExposure={round:s.round,hp:s.heroes.map(h=>h.hp)};
  const p=b.core?b.corePhysical<3:!b.finalePhysical,m=b.core?b.coreMagic<3:!b.finaleMagic;
  const needed=living(s).flatMap(h=>activeSkills(s,h.id).map(k=>({h:h.id,k:k.id,preview:skillPreview(s,h.id,k.id)})))
    .filter(c=>!canUse(s,c.h,c.k)&&c.preview.hits>0&&(c.preview.kind==='physical'?p:m))
    .sort((a,c)=>c.preview.hits/c.preview.ap-a.preview.hits/a.preview.ap);
  if(needed.length){cast(s,stats,needed[0].h,needed[0].k);return true;}
  if(b.finale&&!b.finaleProtected&&policy!=='raw-damage'&&response(s,stats))return true;
  if(b.finale&&policy==='tactical'&&!p&&!m&&s.ap&&s.potions){const hurt=[...living(s)].sort((a,b)=>a.hp-b.hp)[0];if(hurt?.hp<35){stats.recoveryAp++;outgoing(s,stats,usePotion(s,hurt.id));stats.actions.push(`R${s.round} potion/${hurt.id}`);return true;}}
  next(s,stats);return true;
}
function needsDefense(s){
  const projected=structuredClone(s);endRound(projected);
  // Judge the attack's base danger consistently across difficulties. A hard-mode
  // multiplier should not make the policy spend every AP on repeated defense.
  // Actual lethal damage always takes priority over this offensive risk budget.
  const threshold=Number(process.env.PRESSURE_THREAT_THRESHOLD||.24)*DIFFICULTIES[s.difficulty].damage;
  return s.heroes.some((h,index)=>h.hp>0&&(projected.heroes[index].hp<=0||(h.hp-projected.heroes[index].hp)/h.maxHp>threshold));
}
function tactical(s,stats){
  targetPriority(s);
  const b=foe(s),low=[...s.heroes].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
  // A confirmed finishing blow prevents the enemy action altogether. Do not
  // spend several turns healing through an attack that can already be stopped.
  if(!b.core&&!b.finale){
    const finisher=bestDamage(s,{lethal:true});
    if(finisher){cast(s,stats,finisher.h,finisher.k);return;}
  }
  if(b.finale&&!b.finaleProtected&&response(s,stats))return;
  // Complete the exposed mechanism before spending the shared AP on optional
  // healing. The terminal round is won by registration plus a role defense.
  if(terminal(s,stats,'tactical'))return;
  if(low.hp<45&&s.ap&&s.potions){stats.recoveryAp++;outgoing(s,stats,usePotion(s,low.id));stats.actions.push(`R${s.round} potion/${low.id}`);return;}
  if(!b.broken&&!b.controlImmune&&(b.charging||['pierce','duel','drain','bloom','storm','silence','rewrite','zero_pulse'].includes(b.intent))&&cast(s,stats,'ric','bind'))return;
  if((b.id==='cantor'&&b.spores||b.id==='warden'&&b.charge>=3)&&(gunCycle(s,stats)||typedDamage(s,stats,'physical')))return;
  if(!b.broken&&low.hp/low.maxHp<Number(process.env.PRESSURE_HEAL_THRESHOLD||.5)){
    if(low.id==='knibbs'&&cast(s,stats,'knibbs','breathe'))return;
    if(low.id==='apeilia'&&cast(s,stats,'apeilia','reboot'))return;
    if(heroOf(s,'ric')?.resource>=0&&cast(s,stats,'ric','mend'))return;
    if(low.id==='ric'&&heroOf(s,'ric')?.resource<-1&&cast(s,stats,'ric','shelter'))return;
  }
  if(!b.broken&&s.ap&&(!b.finale||!b.finaleProtected)&&needsDefense(s)){
    if(response(s,stats))return;
  }
  if(b.id==='duelist'&&b.mirror&&typedDamage(s,stats,'magic'))return;
  if(b.id==='weaver'&&b.seals){
    if(typedDamage(s,stats,b.sealedKind==='physical'?'magic':'physical'))return;
  }
  if(b.id==='final'&&b.seals&&b.lastKind&&typedDamage(s,stats,b.lastKind==='physical'?'magic':'physical'))return;
  if(gunCycle(s,stats))return;
  const apeilia=heroOf(s,'apeilia');
  if(apeilia?.lastKind==='physical'&&(cast(s,stats,'apeilia','sentinel')||cast(s,stats,'apeilia','purify')))return;
  if(apeilia?.lastKind==='magic'&&cast(s,stats,'apeilia','eden'))return;
  if(cast(s,stats,'apeilia','blade')||cast(s,stats,'knibbs','shot'))return;
  next(s,stats);
}
function teamScore(s,depth=0){
 if(s.mode==='victory')return 1e6-depth;
 if(s.mode==='defeat')return -1e6;
 const b=s.boss,units=s.enemies||[b];
 const enemies=units.reduce((value,e)=>value+(1-e.hp/e.maxHp)*(e.unitId==='boss'?180:65)+(e.defeated?40:0)+(e.broken?6:0),0);
 const party=s.heroes.reduce((value,h)=>{const ratio=h.hp/h.maxHp;return value+ratio*40-Math.pow(1-ratio,3)*35+(h.hp<=0?-65:0)+h.shield*.12+(h.id==='ric'?(h.ricEdge||0)*3:h.resource*(h.id==='apeilia'?1.1:.4));},0);
 return enemies+party+s.potions*5+(b.core?45+b.corePhysical*12+b.coreMagic*12:0)+(b.finale?70+(b.finalePhysical?25:0)+(b.finaleMagic?25:0)+(b.finaleProtected?30:0):0)-b.reforms*35;
}
function teamActions(s){
 const targets=enemyTargets(s),choices=[];
 for(const h of living(s))for(const skill of activeSkills(s,h.id))for(const e of targets)if(!canUse(s,h.id,skill.id,e.id))choices.push(['skill',h.id,skill.id,e.id]);
 if(s.ap>0&&s.potions>0)for(const h of s.heroes)if(h.hp<h.maxHp)choices.push(['potion',h.id]);
 return choices;
}
function applyTeamAction(s,[kind,id,skill,target]){return kind==='skill'?useSkill(s,id,skill,target):kind==='potion'?usePotion(s,id):endRound(s);}
/** Sealed attacks and the final overload reward planning a full round. Every
 * candidate is a legal public-action simulation on a copy, with fixed loadouts. */
export function chooseTeamTurn(state,width=12){
 let beam=[{state:structuredClone(state),plan:[]}],best=null;
 const maxActions=state.maxAp+3; // Allow the finite zero-AP follow-up window.
 for(let depth=0;depth<=maxActions;depth++){
  const next=[],seen=new Set();
  for(const node of beam){
   const settled=structuredClone(node.state);if(settled.mode==='playing')endRound(settled);
   const rank=teamScore(settled,node.plan.length);
   if(!best||rank>best.score)best={score:rank,plan:[...node.plan,...(node.state.mode==='playing'?[['end']]:[])]};
   if(node.state.mode!=='playing'||depth===maxActions)continue;
   for(const action of teamActions(node.state)){
    const candidate=structuredClone(node.state),result=applyTeamAction(candidate,action);if(!result.ok)throw new Error(result.error);
    const {log,serial,stats,...snapshot}=candidate,key=JSON.stringify(snapshot);if(seen.has(key))continue;seen.add(key);
    const future=structuredClone(candidate);if(future.mode==='playing')endRound(future);
    next.push({state:candidate,plan:[...node.plan,action],score:teamScore(future,depth+1)});
   }
  }
  beam=next.sort((a,b)=>b.score-a.score).slice(0,width);if(!beam.length)break;
 }
 return best.plan;
}
export function runPolicy(bossId,policy,difficulty='standard',{includeState=false,onState=null,loadouts=policyLoadouts(bossId,policy),searchWidth=['warden','weaver','final'].includes(bossId)?12:0}={}){
  const s=createBattle(difficulty,bossId,{loadouts}),stats={damageTaken:0,damageEvents:0,heals:0,shields:0,recoveryAp:0,minimumHpRatio:1,enemyActions:0,refunds:0,responses:{parry:0,evade:0,counter:0},actions:[],firstExposure:null,onState};
  const fixedLoadouts=JSON.stringify(s.loadouts),fixedUpgrades=JSON.stringify(s.upgrades);
  let planned=[];
  for(let step=0;step<500&&s.mode==='playing'&&s.round<40;step++){
    targetPriority(s);
    if(policy==='pass-only'){next(s,stats);continue;}
    if(policy==='tactical'){
      if(searchWidth){
        if(!stats.firstExposure&&(s.boss.core||s.boss.finale))stats.firstExposure={round:s.round,hp:s.heroes.map(h=>h.hp)};
        if(!planned.length)planned=chooseTeamTurn(s,searchWidth);
        const [kind,id,skill,target]=planned.shift();
        if(kind==='skill'){if(!cast(s,stats,id,skill,target))throw new Error(`Invalid planned skill: ${id}/${skill}`);}
        else if(kind==='potion'){stats.recoveryAp++;outgoing(s,stats,usePotion(s,id));stats.actions.push(`R${s.round} potion/${id}`);}
        else next(s,stats);
        if(JSON.stringify(s.loadouts)!==fixedLoadouts||JSON.stringify(s.upgrades)!==fixedUpgrades)throw new Error('Planned battle changed its fixed build');
      }else tactical(s,stats);
      continue;
    }
    if(terminal(s,stats,policy))continue;
    if(['parry-greedy','defense-greedy'].includes(policy)&&response(s,stats))continue;
    const best=bestDamage(s);
    if(best)cast(s,stats,best.h,best.k);else next(s,stats);
  }
  return {boss:bossId,policy,searchWidth:policy==='tactical'?searchWidth:0,loadouts:JSON.parse(fixedLoadouts),upgrades:JSON.parse(fixedUpgrades),result:s.mode,round:s.round,enemyActions:stats.enemyActions,hp:s.heroes.map(h=>h.hp).join('/'),hpPercent:Math.round(totalHp(s)/s.heroes.reduce((n,h)=>n+h.maxHp,0)*100),minimumHpPercent:Math.round(stats.minimumHpRatio*100),damageTaken:stats.damageTaken,recoveryAp:stats.recoveryAp,healed:s.stats.healed,potionsUsed:3-s.potions,breaks:s.stats.breaks,refunds:stats.refunds,responses:stats.responses,firstExposure:stats.firstExposure,actions:stats.actions,...(includeState?{state:s}:{})};
}
export function attackPressure(bossId){
  const s=createBattle('standard',bossId,{loadouts:probeLoadouts}),out=[];
  for(let i=0;i<5&&s.mode==='playing';i++){
    const info=intentInfo(s),row={boss:bossId,round:s.round,intent:info.name,description:info.desc,preparationAp:{none:0,cover:3,mend:2},unavailable:{}};
    for(const responseId of ['none','cover','mend']){
      const clone=structuredClone(s);
      if(responseId!=='none'){
        // Idle heroes have no intuition. Pay the real 2-AP special load before
        // the 1-AP counter; neither resources nor learned skills are injected.
        const sequence=responseId==='cover'?[['knibbs','loadburst'],['knibbs','cover']]:[['ric','mend']];
        for(const [hero,skill]of sequence){const prepared=useSkill(clone,hero,skill);if(!prepared.ok){row.unavailable[responseId]=prepared.error;break;}}
        if(row.unavailable[responseId]){row[responseId]=null;continue;}
      }
      const before=clone.heroes.map(h=>h.hp);endRound(clone);
      row[responseId]=clone.heroes.map((h,index)=>before[index]-h.hp).join('/');
    }
    out.push(row);endRound(s);
  }
  return out;
}

if(process.argv[1]?.endsWith('pressure-probe.mjs')){
  const battles=Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion).flatMap(id=>names.map(policy=>runPolicy(id,policy)));
  if(process.argv.includes('--json'))console.log(JSON.stringify({battles,pressure:Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion).flatMap(attackPressure)},null,2));
  else{
    console.table(battles.map(({actions,responses,firstExposure,...row})=>row));
    console.table(Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion).flatMap(attackPressure).map(({description,...row})=>row));
    console.log('Raw-damage final exposure (victory requires a character defense):',battles.find(x=>x.boss==='final'&&x.policy==='raw-damage').firstExposure);
  }
}
