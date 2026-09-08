import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,activeSkills,canUse,useSkill,guard,prepareResponse,responseOptions,endRound,heroOf,skillPreview,normalizeLoadouts,BOSSES,BOSS_INTENTS,attackSpec} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {actionPointInfo} from '../src/action-points.js';
import {LEARNING_ORDER} from '../src/training.js';
import {bossCodexView} from '../src/boss-codex.js';

const act=(state,id,skill)=>{const result=useSkill(state,id,skill);assert.equal(result.ok,true,result.error);return result;};
const finalState=id=>{const state=createBattle('standard','final',{mode:'solo',partyIds:[id]});Object.assign(state.boss,{hp:0,finale:true,finaleHits:2,finaleFresh:false,seals:0});return state;};

test('v37: one/two/three-member parties get 3/4/6 base AP, solo still gets 5 and unused AP carries at most 2',()=>{
 for(const [ids,ap] of [[['knibbs'],3],[['knibbs','haart'],4],[['knibbs','haart','ric'],6]]){
  const s=createBattle('standard','scout',{partyIds:ids});assert.equal(s.ap,ap);assert.equal(s.challengeMode,'party');assert.equal(s.heroes.length,ids.length);
  act(s,'knibbs','shot');assert.equal(actionPointInfo(s).base,ap);endRound(s);assert.equal(s.ap,ap+2);assert.ok(normalizeSave(s));
 }
 const solo=createBattle('standard','scout',{mode:'solo',partyIds:['haart']});assert.equal(solo.ap,5);
 const fallback=createBattle('standard','scout',{partyIds:['unknown']});assert.equal(fallback.ap,6);assert.equal(fallback.heroes.length,3);
});

test('v37: learned skill permissions constrain loadouts, UI enumeration and direct actions',()=>{
 const skillAccess={knibbs:['shot','breathe']};
 const s=createBattle('standard','scout',{partyIds:['knibbs'],skillAccess,loadouts:{knibbs:['shot','cover','breathe','focus','scatter']}});
 assert.deepEqual(activeSkills(s,'knibbs').map(x=>x.id),['shot','breathe']);assert.equal(Object.keys(s.loadouts).length,7);
 const before=structuredClone(s);assert.match(canUse(s,'knibbs','cover'),/尚未学会/);assert.equal(useSkill(s,'knibbs','cover').ok,false);assert.deepEqual(s,before);
 assert.deepEqual(normalizeSave(s).skillAccess,skillAccess);
 s.skillAccess.knibbs.push('cover');s.loadouts=normalizeLoadouts(s.upgrades,s.loadouts,s.skillAccess);
 assert.deepEqual(activeSkills(s,'knibbs').map(x=>x.id),['shot','breathe','cover']);assert.equal(canUse(s,'knibbs','cover'),'');assert.ok(normalizeSave(s));
 assert.equal(activeSkills(createBattle(),'knibbs').length,5,'ordinary challenges keep full default skills');
});

test('v37: tutorial enemies have exactly two moves, no half-health phase and predictable low damage',()=>{
 for(const id of ['scout','bulwark','conduit']){
  const s=createBattle('challenge',id,{partyIds:['knibbs']});assert.equal(BOSSES[id].isTutorial,true);assert.equal(BOSS_INTENTS[id].length,2);
  for(const intent of BOSS_INTENTS[id]){s.boss.intent=intent;const spec=attackSpec(s);assert.ok(spec.damage>=12&&spec.damage<=24);assert.ok(['physical','magic'].includes(spec.kind));}
  s.boss.hp=Math.ceil(s.boss.maxHp*.5)+1;act(s,'knibbs','shot');assert.equal(s.boss.stage,0);assert.equal(s.boss.phasePending,false);assert.ok(normalizeSave(s));
  const easy=createBattle('story',id,{partyIds:['knibbs']});assert.equal(s.boss.maxHp,easy.boss.maxHp,'teaching health does not rise with formal difficulty');
 }
 assert.equal(createBattle('standard','conduit',{partyIds:['haart']}).boss.maxHp,84);
 assert.equal(createBattle('standard','conduit',{partyIds:['haart','knibbs','ric']}).boss.maxHp,468);
});

test('v37: each character can win a short personal lesson with only their first two skills and no potion',()=>{
 for(const difficulty of ['story','standard','challenge'])for(const [id,order] of Object.entries(LEARNING_ORDER)){
  const mana=['haart','qianxing','patch'].includes(id),boss=mana?'conduit':'bulwark';
  const s=createBattle(difficulty,boss,{partyIds:[id],skillAccess:{[id]:order.slice(0,2)}});
  while(s.mode==='playing'&&s.round<=10){
   let actions=0;
   while(s.mode==='playing'){
    const candidates=activeSkills(s,id).filter(x=>!canUse(s,id,x.id)).sort((a,b)=>skillPreview(s,id,b.id).damage-skillPreview(s,id,a.id).damage);
    if(!candidates.length)break;act(s,id,candidates[0].id);assert.ok(++actions<=7);
   }
   if(s.mode==='playing')endRound(s);
  }
  assert.equal(s.mode,'victory',`${id} at ${difficulty}: round ${s.round}, hp ${s.heroes[0].hp}, enemy ${s.boss.hp}`);
  assert.ok(s.round<=8,`${id}: ${s.round} teaching rounds`);assert.equal(s.potions,3);
 }
});

test('v37: generic guard and tactical responses are rejected without altering any state',()=>{
 const s=createBattle();const before=structuredClone(s);
 assert.equal(guard(s,'knibbs').ok,false);for(const id of ['parry','evade','counter'])assert.equal(prepareResponse(s,id,'knibbs').ok,false);
 assert.deepEqual(responseOptions(s),[]);assert.deepEqual(s,before);
 s.response={id:'parry',actor:'knibbs'};endRound(s);assert.equal(heroOf(s,'knibbs').hp,85,'a forged legacy response cannot reduce damage');assert.equal(s.response,null);
});

test('v39: cover fire uses a skill slot and AP to counter before the next enemy attack',()=>{
 const s=createBattle();assert.equal(skillPreview(s,'knibbs','cover').coverFire,true);act(s,'knibbs','cover');
 assert.equal(s.ap,4);assert.equal(heroOf(s,'knibbs').resource,7);assert.ok(s.heroes.every(h=>h.protection===0&&h.shield===0));
 endRound(s);assert.equal(heroOf(s,'knibbs').hp,127);assert.equal(s.boss.cover,null);
 s.boss.intent='slam';s.boss.intentTarget='knibbs';endRound(s);assert.equal(heroOf(s,'knibbs').hp,42);
 const omitted=createBattle('standard','golem',{loadouts:{knibbs:['shot','focus','scatter','breathe','ricochet']},upgrades:['knibbs_ricochet']});assert.match(canUse(omitted,'knibbs','cover'),/尚未装配/);
});

test('v39: evasion and covering fire are independent preparations; repeated cover cannot stack',()=>{
 const s=createBattle();act(s,'apeilia','reboot');act(s,'knibbs','cover');
 assert.equal(heroOf(s,'apeilia').evasion,1);assert.ok(s.heroes.every(h=>h.protection===0));
 const before=structuredClone(s);assert.equal(useSkill(s,'knibbs','cover').ok,false);assert.deepEqual(s,before);
});

test('v39: Haart spends a single thread to rewrite the selected enemy action without granting ally shields',()=>{
 const s=createBattle('standard','golem',{partyIds:['haart','knibbs','apeilia']});heroOf(s,'haart').secondary=1;
 assert.equal(skillPreview(s,'haart','soothe').confuse,true);act(s,'haart','soothe');
 assert.ok(s.heroes.every(h=>h.protection===0&&h.shield===0));assert.equal(s.boss.confusion.actor,'haart');assert.equal(heroOf(s,'haart').secondary,0);assert.ok(normalizeSave(s));
 endRound(s);assert.equal(heroOf(s,'haart').hp,112);assert.equal(s.boss.confusion,null);
});

test('v37: role retaliation cannot add an unannounced phase attack and core exposure receives exactly two full turns',()=>{
 for(const core of [false,true]){
  const s=createBattle('standard','golem',{partyIds:['qianxing','knibbs','ric']});s.boss.hp=core?10:Math.ceil(s.boss.maxHp*.8)+1;heroOf(s,'qianxing').secondary=1;
  act(s,'qianxing','armor');const result=endRound(s);
  assert.ok(result.events.some(e=>e.label==='钉刺反击'));assert.ok(!result.events.some(e=>e.label==='碎岩飞弹'||e.label==='地裂'));
  if(core){assert.equal(s.boss.core,true);assert.equal(s.boss.coreFresh,false);assert.equal(s.boss.coreTurns,2);endRound(s);assert.equal(s.boss.coreTurns,1);}
  else{assert.equal(s.boss.stage,1);assert.equal(s.boss.charging,true);}
  assert.ok(normalizeSave(s));
 }
});

test('v39: the fold-back upgrade improves field repair without creating another shield role',()=>{
 const s=createBattle('standard','golem',{upgrades:['apeilia_brace']});heroOf(s,'apeilia').hp-=40;act(s,'apeilia','purify');act(s,'apeilia','reboot');
 assert.equal(heroOf(s,'apeilia').evasion,1);assert.equal(heroOf(s,'apeilia').shield,0);assert.equal(heroOf(s,'apeilia').hp,135);
});

test('v37: every character has an equipped defensive option that can satisfy final protection',()=>{
 const skills={knibbs:'cover',apeilia:'reboot',ric:'shelter',haart:'soothe',qianxing:'armor',youmu:'sterilize',patch:'bookward'};
 for(const [id,skill] of Object.entries(skills)){
  const s=finalState(id),h=s.heroes[0];if(h.resourceName==='魔力')h.secondary=1;
  assert.equal(skillPreview(s,id,skill).defensive,true);act(s,id,skill);assert.equal(s.boss.finaleProtected,true,id);assert.ok(normalizeSave(s),id);
  const result=endRound(s);assert.equal(s.mode,'victory',id);assert.ok(result.events.some(e=>e.label==='停机过载 · 最后放电'));
 }
});

test('v37: the finale requires active character protection, not a potion, pure conversion, or an old response',()=>{
 const s=finalState('knibbs');s.response={id:'evade',actor:'knibbs'};act(s,'knibbs','breathe');assert.equal(s.boss.finaleProtected,false);endRound(s);
 assert.equal(s.mode,'playing');assert.equal(s.boss.finaleTurns,1);assert.equal(s.boss.finaleProtected,false);
 act(s,'knibbs','cover');endRound(s);assert.equal(s.mode,'victory');
 const prepared=finalState('haart');act(prepared,'haart','rest');assert.equal(prepared.boss.finaleProtected,false,'pure bulk preparation is not defense');
});

test('v37: final protection and current HP cannot skip missing hits, and protection must be renewed next round',()=>{
 const s=finalState('knibbs');s.boss.finaleHits=0;act(s,'knibbs','cover');assert.equal(s.boss.finaleHits,0);endRound(s);
 assert.equal(s.mode,'playing');assert.equal(s.boss.finaleProtected,false);assert.equal(s.boss.finaleTurns,1);
 act(s,'knibbs','shot');endRound(s);assert.equal(s.mode,'playing');assert.equal(s.boss.finale,false);assert.equal(s.boss.reforms,1);assert.equal(s.boss.hp,Math.round(s.boss.maxHp*.22));
});

test('v37: mana emergency conversion cannot preserve armor or defensive flags for free',()=>{
 const s=finalState('qianxing'),h=s.heroes[0];h.resource=0;h.secondary=0;s.upgrades=['qianxing_nova','qianxing_lock'];s.loadouts.qianxing=['beam','armor','pulse','nova','lock'];
 const preview=skillPreview(s,'qianxing','armor');assert.equal(preview.defensive,false);assert.equal(preview.protection,0);
 act(s,'qianxing','armor');assert.equal(h.secondary,1);assert.equal(h.shield,0);assert.equal(h.protection,0);assert.equal(s.boss.finaleProtected,false);
});

test('v37: armor pays and refunds once; physical reflection does not refund again',()=>{
 const s=createBattle('standard','golem',{mode:'solo',partyIds:['qianxing']}),h=s.heroes[0];h.resource=2;h.secondary=1;
 act(s,'qianxing','armor');assert.equal(h.resource,6);assert.equal(h.protection,55);const events=endRound(s).events;
 assert.equal(h.resource,6);assert.ok(events.some(e=>e.label==='钉刺反击'));assert.equal(h.reflect,0);assert.equal(h.protection,0);
});

test('v37: v8 saves retain three-member semantics and refund pending generic responses exactly once',()=>{
 const old=createBattle();old.version=8;delete old.skillAccess;delete old.boss.finaleProtected;old.heroes.forEach(h=>delete h.protection);old.ap=4;old.response={id:'parry',actor:'knibbs'};old.heroes[0].guard=true;
 const restored=normalizeSave(old);assert.ok(restored);assert.equal(restored.version,10);assert.equal(restored.ap,5);assert.equal(restored.response,null);assert.equal(restored.heroes[0].guard,false);assert.equal(restored.heroes[0].protection,55);assert.equal(restored.skillAccess,null);
 assert.equal(normalizeSave(restored).ap,5);old.heroes.pop();assert.equal(normalizeSave(old),null);
});

test('v37: v9 rejects forged skill permissions, protections and obsolete response payloads',()=>{
 const s=createBattle('standard','scout',{partyIds:['knibbs'],skillAccess:{knibbs:['shot','breathe']}});
 for(const mutate of [x=>x.skillAccess.knibbs.push('missing'),x=>x.loadouts.knibbs.push('cover'),x=>x.heroes[0].protection=56,x=>x.boss.finaleProtected=true,x=>x.response={id:'counter',actor:'knibbs'},x=>delete x.skillAccess]){
  const broken=structuredClone(s);mutate(broken);assert.equal(normalizeSave(broken),null);
 }
});

test('v37: teaching codex exposes both enemy moves instead of an empty manual',()=>{
 for(const id of ['scout','bulwark','conduit']){
  const s=createBattle('standard',id,{partyIds:['knibbs']});const view=bossCodexView(s);
  for(const intent of BOSS_INTENTS[id]){s.boss.intent=intent;assert.ok(view.includes(attackSpec(s).name));}
 }
});
