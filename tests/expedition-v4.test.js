import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,createBattle,heroOf,activeSkills,resolvedSkill,skillPreview,canUse,useSkill,endRound,prepareResponse} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {createRun,advanceDialogue,battleForRun,completeEncounter,claimReward,rewardOptions,startNextChapter,normalizeRun} from '../src/campaign.js';

const battle=(boss='duelist',upgrades=[])=>createBattle('standard',boss,{partyIds:['youmu','patch','ric'],upgrades});
function cast(s,id,skill){const snapshot=structuredClone(s),p=skillPreview(s,id,skill);assert.deepEqual(s,snapshot,'preview is read-only');const ap=s.ap,r=useSkill(s,id,skill);assert.equal(r.ok,true,r.error);assert.equal(ap-s.ap,p.ap);assert.equal(heroOf(s,id).resource,p.resourceAfter);assert.equal(r.events.filter(e=>e.type==='attack').reduce((n,e)=>n+e.amount,0),p.damage);if(s.mode==='playing')assert.ok(normalizeSave(s),'action remains saveable');return {p,r};}
function refuse(s,id,skill){const before=structuredClone(s);assert.equal(useSkill(s,id,skill).ok,false);assert.deepEqual(s,before);}

test('3.2: seven heroes keep four resource types and have five useful base slots',()=>{
 assert.equal(HEROES.length,7);assert.deepEqual([...new Set(HEROES.map(h=>h.resourceName))].sort(),['平衡','气息','连击','魔力'].sort());
 for(const h of HEROES){const s=createBattle('standard','duelist',{partyIds:[h.id,...HEROES.filter(p=>p.id!==h.id).slice(0,2).map(p=>p.id)]});assert.equal(activeSkills(s,h.id).length,5);assert.equal(new Set(activeSkills(s,h.id).map(k=>k.id)).size,5);assert.ok(activeSkills(s,h.id).every(k=>!k.unlockKey));}
});
test('Ric positive field prepares a physical sword variant and consumes finite sword charges',()=>{
 const s=battle(),h=heroOf(s,'ric');cast(s,'ric','shelter');assert.equal(h.resource,4);assert.equal(h.ricEdge,2);assert.equal(h.shield,30);assert.equal(heroOf(s,'patch').shield,0);
 const {p}=cast(s,'ric','rune');assert.equal(p.name,'正域剑式 · 斩影');assert.equal(p.kind,'physical');assert.equal(p.hits,2);assert.equal(h.ricEdge,1);assert.equal(h.resource,6);
});
test('Ric negative field creates an actual damage debuff and empowers the gun independently of sword route',()=>{
 const s=battle('golem'),h=heroOf(s,'ric');cast(s,'ric','mend');assert.equal(h.resource,-4);assert.equal(s.boss.weakened,1);assert.equal(resolvedSkill(s,'ric','bind').name,'负域枪式 · 封行咒弹');
 const {p}=cast(s,'ric','bind');assert.equal(p.kind,'magic');assert.equal(p.hits,2);const before=heroOf(s,'youmu').hp;const events=endRound(s).events;
 assert.equal(events.find(e=>e.type==='boss').amounts.youmu,68);assert.equal(before-heroOf(s,'youmu').hp,68);assert.equal(s.boss.weakened,0);
});
test('Ric full +/-10 range, voluntary reversal and automatic two-point return retain zero-cross effects',()=>{
 const s=battle(),h=heroOf(s,'ric');h.resource=10;refuse(s,'ric','rune');cast(s,'ric','crossing');assert.equal(h.resource,-10);refuse(s,'ric','mend');prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.resource,-8);
 h.resource=-2;h.shield=0;prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.resource,0);assert.equal(Object.is(h.resource,-0),false);assert.equal(h.shield,10);
});
test('Youmu surgery requires preparation and turns a whitelisted boss layer into an actual transplant',()=>{
 const s=battle(),h=heroOf(s,'youmu');refuse(s,'youmu','surgery');cast(s,'youmu','scalpel');assert.equal(h.surgicalReady,true);
 cast(s,'youmu','surgery');assert.equal(h.specimen,'mirror');assert.equal(s.boss.mirror,0);assert.equal(h.surgicalReady,false);
 assert.equal(resolvedSkill(s,'youmu','surgery').name,'移植手术');const {p}=cast(s,'youmu','surgery');assert.equal(p.damage,0);assert.equal(h.specimen,null);assert.ok(s.heroes.every(p=>p.shield===18));assert.equal(h.resource,4);
});
for(const [boss,key]of [['golem','fog'],['duelist','mirror'],['cantor','spores'],['warden','charge'],['weaver','seals'],['final','seals']])test(`Youmu transfers only ${boss} ${key}, never stage or control immunity`,()=>{
 const s=battle(boss),h=heroOf(s,'youmu');h.surgicalReady=true;s.boss[key]=2;s.boss.controlImmune=1;s.boss.stage=1;
 cast(s,'youmu','surgery');assert.equal(h.specimen,key);assert.equal(s.boss[key],0);assert.equal(s.boss.stage,1);assert.equal(s.boss.controlImmune,1);
});
test('Youmu core has no transferable phase state and normal surgery still counts one physical hit',()=>{
 const s=battle('golem'),h=heroOf(s,'youmu');s.boss.hp=1;cast(s,'youmu','scalpel');assert.equal(s.boss.core,true);cast(s,'youmu','surgery');assert.equal(h.specimen,null);assert.equal(s.boss.core,true);assert.equal(s.boss.corePhysical,1);assert.equal(s.boss.fog,5);
});
test('Youmu low-health captain has five distinct actions, survives two rounds, then pays a finite debuff',()=>{
 const s=battle(),h=heroOf(s,'youmu');refuse(s,'youmu','bloodoath');h.hp=66;cast(s,'youmu','bloodoath');assert.equal(h.youmuForm,'captain');assert.equal(h.captainUsed,true);
 assert.deepEqual(activeSkills(s,h.id).map(k=>resolvedSkill(s,h.id,k.id).name),['铁血弯刀','船长威严','枪弹盛宴','沉渊炼狱号','死海整帆']);
 prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.captainTurns,1);prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.youmuForm,'doctor');assert.equal(h.exhaustedTurns,2);assert.equal(resolvedSkill(s,h.id,'scalpel').damage,24);refuse(s,h.id,'bloodoath');
 prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.exhaustedTurns,1);prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.exhaustedTurns,0);
});
test('Youmu captain finisher consumes real AP/breath and exits early without granting another turn',()=>{
 const s=battle('warden'),h=heroOf(s,'youmu');h.hp=60;cast(s,h.id,'bloodoath');const {p}=cast(s,h.id,'bloodoath');assert.equal(p.name,'沉渊炼狱号');assert.equal(p.hits,3);assert.equal(s.ap,2);assert.equal(h.resource,2);assert.equal(h.youmuForm,'doctor');assert.equal(h.exhaustedTurns,2);assert.equal(h.exhaustionFresh,true);
});
test('Patch records track paid mana before refunds and auto-enhance only after the threshold already exists',()=>{
 const s=battle('warden'),h=heroOf(s,'patch');cast(s,h.id,'keyblade');assert.equal(h.resource,10);assert.equal(h.records,1);assert.equal(h.recordProgress,1);
 cast(s,h.id,'chargedslash');cast(s,h.id,'chargedslash');assert.equal(h.records,3);const {p}=cast(s,h.id,'chargedslash');assert.equal(p.variant,'daybreak');assert.equal(p.kind,'magic');assert.equal(p.hits,2);assert.equal(h.records,1);assert.equal(p.recordsAfter,1);assert.equal(s.ap,2);
});
test('Patch records cannot pay a spell when mana or AP is missing',()=>{
 const s=battle(),h=heroOf(s,'patch');h.records=6;h.resource=5;refuse(s,h.id,'fragments');h.resource=10;s.ap=1;refuse(s,h.id,'fragments');
});
test('Patch collection stance records one enemy hit per round and retaliates once when shield breaks',()=>{
 const s=battle('golem'),h=heroOf(s,'patch');s.boss.intentTarget='patch';cast(s,h.id,'bookward');assert.equal(h.patchForm,'record');assert.equal(h.records,2);assert.equal(h.resource,7);
 const r=endRound(s);assert.equal(h.records,3);assert.equal(h.resource,9);assert.equal(h.patchRetaliation,false);assert.equal(r.events.filter(e=>e.label==='镜反回击').length,1);
 assert.equal(resolvedSkill(s,h.id,'chargedslash').name,'充能斩 · 镜反');const {p}=cast(s,h.id,'chargedslash');assert.equal(p.shield,18);assert.equal(h.records,1);
});
test('Patch enhanced physical-to-magic variant uses the same type for core count, preview and damage',()=>{
 const s=battle('golem'),h=heroOf(s,'patch');s.boss.hp=1;cast(s,'youmu','scalpel');h.records=3;
 const p=skillPreview(s,h.id,'chargedslash');assert.equal(p.kind,'magic');assert.ok(p.notes.some(n=>n.includes('魔法命中 +2')));cast(s,h.id,'chargedslash');assert.equal(s.boss.coreMagic,2);assert.equal(s.boss.corePhysical,0);
});
test('Both new kits and Ric dynamic states roundtrip with deterministic next actions',()=>{
 const s=battle(),y=heroOf(s,'youmu');cast(s,'youmu','scalpel');cast(s,'youmu','surgery');cast(s,'patch','bookward');const restored=normalizeSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,{...s,elapsed:0});assert.deepEqual(useSkill(restored,'ric','rune'),useSkill(s,'ric','rune'));assert.deepEqual(endRound(restored),endRound(s));
});
test('Current saves reject forged forms, impossible paid-state counters and nontransferable specimens',()=>{
 for(const mutate of [s=>heroOf(s,'youmu').specimen='controlImmune',s=>heroOf(s,'youmu').youmuForm='captain',s=>heroOf(s,'patch').records=7,s=>heroOf(s,'ric').resource=11,s=>heroOf(s,'patch').captainUsed=true]){const s=battle();mutate(s);assert.equal(normalizeSave(s),null);}
});
test('A captured v4 four-slot roster migrates Ric balance proportion and keeps every selected old slot',()=>{
 const old=createBattle();old.version=4;old.heroes.find(h=>h.id==='ric').resource=-3;old.loadouts={knibbs:['shot','focus','scatter','breathe'],apeilia:['blade','purify','eden','sentinel'],ric:['rune','bind','shelter','mend'],haart:['page','relay','soothe','rest'],qianxing:['spike','beam','armor','repair']};
 const restored=normalizeSave(old);assert.ok(restored);assert.equal(heroOf(restored,'ric').resource,-10);assert.deepEqual(restored.loadouts.ric,['rune','bind','shelter','mend','crossing']);assert.equal(restored.loadouts.patch.length,5);assert.equal(restored.version,5);
});
test('Campaign recruits all four arrivals at the promised battle boundary and supports their reward pools',()=>{
 let run=createRun();for(let chapter=0;chapter<4;chapter++){
  advanceDialogue(run,true);const s=battleForRun(run);s.mode='victory';completeEncounter(run,s);assert.ok(run.unlockedHeroes.includes(['youmu','haart','qianxing','patch'][chapter]));advanceDialogue(run,true);
  const reward=rewardOptions(run).find(r=>r.id===['youmu_suture','youmu_transplant','youmu_resolve','patch_revelation'][chapter]);assert.ok(reward);assert.equal(claimReward(run,reward.id).ok,true);assert.ok(normalizeRun(run));startNextChapter(run);
 }
 assert.equal(run.loadouts.youmu[4],'suture');assert.equal(run.loadouts.patch[4],'revelation');
});
