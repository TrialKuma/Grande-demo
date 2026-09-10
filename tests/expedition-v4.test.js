import test from 'node:test';
import assert from 'node:assert/strict';
import {effectiveAttributes} from '../src/attributes.js';
import {HEROES,SKILLS,createBattle,heroOf,activeSkills,resolvedSkill,skillPreview,canUse,useSkill,endRound,prepareResponse} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {absorbShield} from '../src/shields.js';
import {createRun as createCurrentRun,advanceDialogue,battleForRun,completeEncounter,claimReward,rewardOptions,startNextChapter,normalizeRun} from '../src/campaign.js';

const battle=(boss='duelist',upgrades=[],loadouts={})=>createBattle('standard',boss,{partyIds:['youmu','patch','ric'],upgrades,loadouts});
function cast(s,id,skill){const snapshot=structuredClone(s),p=skillPreview(s,id,skill);assert.deepEqual(s,snapshot,'preview is read-only');const ap=s.ap,r=useSkill(s,id,skill);assert.equal(r.ok,true,r.error);assert.equal(ap-s.ap,p.ap);assert.equal(heroOf(s,id).resource,p.resourceAfter);assert.equal(r.events.filter(e=>e.type==='attack'&&e.targets?.includes('boss')).reduce((n,e)=>n+e.amount,0),p.damage);if(s.mode==='playing')assert.ok(normalizeSave(s),'action remains saveable');return {p,r};}
function refuse(s,id,skill){const before=structuredClone(s);assert.equal(useSkill(s,id,skill).ok,false);assert.deepEqual(s,before);}

test('3.2: seven heroes keep four resource types and have four useful base slots',()=>{
 assert.equal(HEROES.length,7);assert.deepEqual([...new Set(HEROES.map(h=>h.resourceName))].sort(),['平衡','气息','连击','魔力'].sort());
 for(const h of HEROES){const s=createBattle('standard','duelist',{partyIds:[h.id,...HEROES.filter(p=>p.id!==h.id).slice(0,2).map(p=>p.id)]});assert.equal(activeSkills(s,h.id).length,4);assert.equal(new Set(activeSkills(s,h.id).map(k=>k.id)).size,4);assert.ok(activeSkills(s,h.id).every(k=>!k.unlockKey));}
});
test('Ric positive field prepares a physical sword variant and consumes finite sword charges',()=>{
 const s=battle(),h=heroOf(s,'ric');cast(s,'ric','shelter');assert.equal(h.resource,4);assert.equal(h.ricEdge,2);assert.equal(h.shield,30);assert.equal(heroOf(s,'patch').shield,0);
 const {p}=cast(s,'ric','rune');assert.equal(p.name,'正域剑式 · 斩影');assert.equal(p.kind,'physical');assert.equal(p.hits,2);assert.equal(h.ricEdge,1);assert.equal(h.resource,6);
});
test('Ric negative field creates an actual damage debuff and empowers the gun independently of sword route',()=>{
 const s=battle('golem'),h=heroOf(s,'ric');cast(s,'ric','mend');assert.equal(h.resource,-4);assert.equal(s.boss.weakened,0);assert.equal(effectiveAttributes(s.boss,s).strength,-3);assert.equal(resolvedSkill(s,'ric','bind').name,'负域枪式 · 封行咒弹');
 const {p}=cast(s,'ric','bind');assert.equal(p.kind,'magic');assert.equal(p.hits,2);const before=heroOf(s,'youmu').hp;const events=endRound(s).events;
 // Passive negative field applies -3 STR; the doctor has no hidden AGI defense.
 assert.equal(events.find(e=>e.type==='boss').amounts.youmu,85-3);assert.equal(before-heroOf(s,'youmu').hp,85-3);assert.equal(s.boss.weakened,0);
});
test('Ric full +/-10 range, voluntary reversal and automatic two-point return retain zero-cross effects',()=>{
 const s=battle('duelist',[],{ric:['rune','shelter','mend','crossing']}),h=heroOf(s,'ric');h.resource=10;refuse(s,'ric','rune');refuse(s,'ric','crossing');h.resource=-10;refuse(s,'ric','mend');prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.resource,-8);
 h.resource=-2;absorbShield(h,h.shield);prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.resource,0);assert.equal(Object.is(h.resource,-0),false);assert.equal(h.shield,0);assert.equal(h.ricChaos,0);
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
test('Youmu sacrifices full health to captain form with four actions, two-round duration and a finite debuff',()=>{
 const s=battle('scout'),h=heroOf(s,'youmu');cast(s,'youmu','bloodoath');assert.equal(h.hp,66);assert.equal(h.tauntTurns,2);assert.equal(h.youmuForm,'captain');assert.equal(h.captainUsed,true);
 assert.deepEqual(activeSkills(s,h.id).map(k=>resolvedSkill(s,h.id,k.id).name),['铁血弯刀','死海整帆','船长威严','沉渊炼狱号']);
 prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.captainTurns,1);prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.youmuForm,'doctor');assert.equal(h.exhaustedTurns,2);assert.equal(resolvedSkill(s,h.id,'scalpel').damage,25);assert.equal(skillPreview(s,h.id,'scalpel').attributeBonus,-4);refuse(s,h.id,'bloodoath');
 prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.exhaustedTurns,1);prepareResponse(s,'evade','patch');endRound(s);assert.equal(h.exhaustedTurns,0);
});
test('Youmu captain finisher consumes real AP/breath and exits early without granting another turn',()=>{
 const s=battle('warden'),h=heroOf(s,'youmu');h.hp=60;cast(s,h.id,'bloodoath');const {p}=cast(s,h.id,'bloodoath');assert.equal(p.name,'沉渊炼狱号');assert.equal(p.hits,3);assert.equal(s.ap,2);assert.equal(h.resource,2);assert.equal(h.youmuForm,'doctor');assert.equal(h.exhaustedTurns,2);assert.equal(h.exhaustionFresh,true);
});
test('Patch separates free stance attacks, paid record preparation and one-record cash-out',()=>{
 const s=battle('warden'),h=heroOf(s,'patch');cast(s,h.id,'keyblade');assert.equal(h.resource,10);assert.equal(h.records,0);assert.equal(h.secondary,0);
 cast(s,h.id,'bookward');assert.equal(h.records,3);assert.equal(h.resource,6);assert.equal(h.patchForm,'record');
 const basic=cast(s,h.id,'keyblade').p;assert.equal(basic.hits,2);assert.equal(basic.secondarySpend,1);assert.equal(basic.refund,3);assert.equal(h.resource,9);assert.equal(h.records,2);assert.equal(h.patchForm,'observe');
 const {p}=cast(s,h.id,'chargedslash');assert.equal(p.kind,'physical');assert.equal(p.hits,1);assert.equal(p.ap,1);assert.equal(p.secondarySpend,1);assert.equal(h.records,1);assert.equal(h.secondary,1);assert.equal(p.recordsAfter,1);assert.equal(h.resource,10);
 cast(s,h.id,'chargedslash');assert.equal(h.records,0);assert.equal(h.secondary,0);assert.equal(h.resource,10);assert.equal(s.ap,1);
});
test('Patch conversion needs mana, cash-out needs its full record cost, and both require AP',()=>{
 const s=battle(),h=heroOf(s,'patch');refuse(s,h.id,'fragments');h.resource=0;cast(s,h.id,'keyblade');assert.equal(h.resource,0);assert.equal(h.secondary,0);
 h.resource=7;cast(s,h.id,'bookward');s.ap=1;refuse(s,h.id,'fragments');s.ap=2;h.resource=0;cast(s,h.id,'fragments');assert.equal(h.resource,3);assert.equal(h.secondary,0);
});
test('Patch collection stance keeps paid records through hits without free records or mana on shield break',()=>{
 const s=battle('golem'),h=heroOf(s,'patch');s.boss.intentTarget='patch';cast(s,h.id,'bookward');assert.equal(h.patchForm,'record');assert.equal(h.records,3);assert.equal(h.resource,6);
 const r=endRound(s);assert.equal(h.records,3);assert.equal(h.secondary,3);assert.equal(h.resource,6);assert.equal(h.patchRetaliation,false);assert.equal(r.events.filter(e=>e.label==='镜反回击').length,0);
 assert.equal(resolvedSkill(s,h.id,'chargedslash').name,'充能斩 · 镜反');const {p}=cast(s,h.id,'chargedslash');assert.equal(p.kind,'magic');assert.equal(p.shield,0);assert.equal(h.records,2);assert.equal(h.resource,9);assert.equal(s.boss.recordedIntent?.actor,'patch');
});
test('Patch both stance variants use the same damage type and hit count for preview and core progress',()=>{
 for(const [conversion,kind,hits] of [['keyblade','physical',1],['bookward','magic',1]]){
  const s=battle('golem'),h=heroOf(s,'patch');cast(s,h.id,'bookward');if(conversion==='keyblade')cast(s,h.id,'keyblade');s.boss.hp=1;cast(s,'youmu','scalpel');
  const p=skillPreview(s,h.id,'chargedslash');assert.equal(p.kind,kind);assert.equal(p.hits,hits);cast(s,h.id,'chargedslash');assert.equal(s.boss.coreMagic,kind==='magic'?hits:0);assert.equal(s.boss.corePhysical,kind==='physical'?hits:0);
 }
});
test('Both new kits and Ric dynamic states roundtrip with deterministic next actions',()=>{
 const s=battle(),y=heroOf(s,'youmu');cast(s,'youmu','scalpel');cast(s,'youmu','surgery');cast(s,'patch','bookward');const restored=normalizeSave(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored,{...s,elapsed:0});assert.deepEqual(useSkill(restored,'ric','rune'),useSkill(s,'ric','rune'));assert.deepEqual(endRound(restored),endRound(s));
});
test('Current saves reject forged forms, impossible paid-state counters and nontransferable specimens',()=>{
 for(const mutate of [s=>heroOf(s,'youmu').specimen='controlImmune',s=>heroOf(s,'youmu').youmuForm='captain',s=>{heroOf(s,'patch').records=11;heroOf(s,'patch').secondary=11;},s=>heroOf(s,'ric').resource=11,s=>heroOf(s,'patch').captainUsed=true]){const s=battle();mutate(s);assert.equal(normalizeSave(s),null);}
});
test('A captured v4 four-slot roster migrates Ric balance proportion and keeps every selected old slot',()=>{
 const old=createBattle();old.version=4;old.heroes.find(h=>h.id==='ric').resource=-3;old.loadouts={knibbs:['shot','focus','scatter','breathe'],apeilia:['blade','purify','eden','sentinel'],ric:['rune','bind','shelter','mend'],haart:['page','relay','soothe','rest'],qianxing:['spike','beam','armor','repair']};
 const restored=normalizeSave(old);assert.ok(restored);assert.equal(heroOf(restored,'ric').resource,-10);assert.deepEqual(restored.loadouts.ric,['rune','bind','shelter','mend']);assert.equal(restored.loadouts.patch.length,4);assert.equal(restored.version,11);
});
test('Campaign recruits all four arrivals at the promised battle boundary and supports their reward pools',()=>{
 let run=createRun('standard',{legacyRoute:true});for(let chapter=0;chapter<4;chapter++){
  advanceDialogue(run,true);const s=battleForRun(run);s.mode='victory';completeEncounter(run,s);assert.ok(run.unlockedHeroes.includes(['youmu','haart','qianxing','patch'][chapter]));advanceDialogue(run,true);
  const reward=rewardOptions(run)[0];assert.ok(reward);assert.equal(claimReward(run,reward.id).ok,true);assert.ok(normalizeRun(run));startNextChapter(run);
 }
 assert.ok(run.upgrades.length===4);assert.ok(run.unlockedHeroes.includes('patch'));
});

const createRun=(difficulty='standard',options={})=>{const run=createCurrentRun(difficulty,{...options,skipTutorial:true});run.id='legacy-fixture-'+(options.seed||0);return run;};
