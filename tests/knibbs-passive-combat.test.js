import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,skillPreview,endRound,canUse,activeSkills,SKILLS} from '../src/combat.js';
import {addAttributeEffect} from '../src/attributes.js';
import {normalizeSave} from '../src/save.js';
import {createLearningRun,normalizeLearningRun,advanceDialogue,battleForRun,skillAccessFor} from '../src/campaign-learning.js';
const make=(boss='duelist',slots=['shot','focus','loadburst','cover'])=>createBattle('standard',boss,{loadouts:{knibbs:slots}});
const cast=(s,id)=>{const before=structuredClone(s),p=skillPreview(s,'knibbs',id);assert.deepEqual(s,before,'preview is pure');const r=useSkill(s,'knibbs',id);assert.equal(r.ok,true,r.error);assert.equal(heroOf(s,'knibbs').resource,p.resourceAfter);assert.equal(r.events.filter(e=>e.type==='attack'&&e.targets.includes('boss')).reduce((n,e)=>n+e.amount,0),p.damage);return {p,r};};
test('Knibbs integration: four default commands include dedicated loading and ordinary attacks restore no breath',()=>{
 const s=make();assert.deepEqual(activeSkills(s,'knibbs').map(x=>x.id),['shot','focus','loadburst','cover']);
 const h=heroOf(s,'knibbs');h.resource=2;cast(s,'shot');assert.equal(h.resource,2);assert.equal(h.intuition,0);assert.equal(h.followupReady,false);
 const y=createBattle('standard','scout',{partyIds:['youmu']});heroOf(y,'youmu').resource=2;useSkill(y,'youmu','scalpel');assert.equal(heroOf(y,'youmu').resource,2);
});
test('Knibbs integration: full confirmation chain costs four AP and five net breath, without repeatable free loads',()=>{
 const s=make(),h=heroOf(s,'knibbs');cast(s,'focus');assert.equal(h.followupReady,true);assert.equal(s.boss.marked,false);
 assert.equal(cast(s,'loadburst').p.ap,0);assert.equal(h.intuition,3);assert.equal(h.ammo,'blast');
 const shot=cast(s,'shot').p;assert.deepEqual(shot.hitDamages,[22,36]);assert.equal(shot.intuitionDamage,24);assert.equal(h.intuition,0);assert.equal(s.boss.marked,true);
 assert.equal(cast(s,'loadburst').p.name,'重装填');assert.equal(h.resource,5);assert.equal(s.ap,2);assert.deepEqual(h.followupUsed,['load','shot','reload']);
 assert.equal(skillPreview(s,'knibbs','loadburst').ap,2);assert.match(canUse(s,'knibbs','loadburst'),/气息不足/);
 endRound(s);assert.equal(h.followupReady,false);assert.deepEqual(h.followupUsed,[]);
});
test('Knibbs integration: intuition adds one packet while scatter ammunition registers exactly six weapon hits',()=>{
 const s=make('cantor',['shot','focus','scatter','cover']);cast(s,'scatter');const h=heroOf(s,'knibbs');addAttributeEffect(h,{id:'strength',label:'力量增幅',stats:{strength:4},turns:2});
 const {p,r}=cast(s,'shot');assert.deepEqual(p.hitDamages,[22,8,8,8,8,8]);assert.equal(p.intuitionSpent,3);assert.equal(p.damage,22+4+5*(8+4)+24);
 assert.equal(r.events.find(e=>e.type==='attack').hits,6);assert.equal(s.boss.spores,0);
});
test('Knibbs integration: marked confirmation gets one separate bonus and does not create a mark by itself',()=>{
 const s=make('golem'),h=heroOf(s,'knibbs');s.boss.marked=true;addAttributeEffect(s.boss,{id:'power',label:'强化',stats:{strength:5},turns:2});
 const p=cast(s,'focus').p;assert.equal(p.markBonus,17);assert.equal(p.damage,56+17);assert.equal(h.intuition,0);
});
test('Knibbs integration: counter consumes three intuition, preserves ammunition and never refunds breath',()=>{
 const s=make('golem'),h=heroOf(s,'knibbs');assert.match(canUse(s,'knibbs','cover'),/直感不足/);cast(s,'loadburst');cast(s,'cover');
 assert.equal(h.intuition,0);assert.equal(h.ammo,'blast');assert.equal(h.resource,4);assert.equal(s.ap,3);
 const r=endRound(s);assert.ok(r.events.some(e=>e.skillId==='cover_counter'));assert.equal(h.ammo,'blast');assert.equal(h.intuition,0);assert.equal(h.resource,6);
});
test('Knibbs integration: breach refunds only a real dispel and each extra packet is shared rather than duplicated by a guardian',()=>{
 for(const mirror of [0,2]){const s=make('duelist',['shot','focus','loadbreach','cover']);s.boss.mirror=mirror;cast(s,'loadbreach');const p=cast(s,'shot').p;assert.equal(heroOf(s,'knibbs').resource,mirror?10:6);assert.equal(p.resourceGain,mirror?4:0);assert.equal(s.boss.mirror,Math.max(0,mirror-1));}
 const s=make('patrol');cast(s,'loadburst');const {r}=cast(s,'shot');assert.equal(r.events.filter(e=>e.type==='attack').reduce((n,e)=>n+e.amount,0),22+36+24);
});

test('Knibbs integration: core registration uses ammunition but cannot consume intuition or open a damage-confirmation window',()=>{
 const s=make('golem'),h=heroOf(s,'knibbs');cast(s,'loadburst');Object.assign(s.boss,{core:true,hp:0,corePhysical:0,coreMagic:0,coreHits:0,coreFresh:true});
 const r=useSkill(s,'knibbs','focus');assert.equal(r.ok,true);assert.equal(h.ammo,'normal');assert.equal(h.intuition,3);assert.equal(h.followupReady,false);assert.equal(s.boss.corePhysical,2);
});

test('combat packet boundary: a target that only registers core hits cannot swallow an AoE packet meant for the first injured foe',()=>{
 // A mixed-phase fixture isolates the common AoE packet resolver; normal Knibbs skills stay single-target.
 const s=make('patrol'),h=heroOf(s,'knibbs'),skill=SKILLS.knibbs.find(x=>x.id==='shot'),old=skill.targeting;
 cast(s,'loadburst');Object.assign(s.boss,{core:true,hp:0,corePhysical:0,coreMagic:0,coreHits:0});
 try{skill.targeting='all';const r=useSkill(s,'knibbs','shot');assert.equal(r.ok,true);const hits=r.events.filter(e=>e.type==='attack');
  assert.equal(hits.find(e=>e.targets.includes('boss')).amount,0);assert.equal(hits.find(e=>e.targets.includes('enemy-1')).amount,22+36+24);assert.equal(h.intuition,0);
 }finally{if(old===undefined)delete skill.targeting;else skill.targeting=old;}
});

test('Knibbs save: every confirmation-chain snapshot restores its one-use permissions and next action exactly',()=>{
 const s=make();for(const id of ['focus','loadburst','shot','loadburst']){cast(s,id);const restored=normalizeSave(structuredClone(s));assert.ok(restored,id);assert.deepEqual(restored.heroes.find(h=>h.id==='knibbs'),heroOf(s,'knibbs'));}
 const restored=normalizeSave(structuredClone(s));assert.deepEqual(endRound(restored),endRound(s));
 for(const mutate of [h=>h.ammo='invalid',h=>h.followupUsed=['load','load'],h=>h.followupUsed=['infinite'],h=>{h.specialSpent=true;h.ammo='blast';}]){const bad=make();mutate(heroOf(bad,'knibbs'));assert.equal(normalizeSave(bad),null);}
});

test('Knibbs save: legacy defaults gain the dedicated load while customized four slots and battle progress survive',()=>{
 for(const custom of [false,true]){const s=make(),h=heroOf(s,'knibbs');delete s.knibbsRevision;s.loadouts.knibbs=custom?['shot','breathe','scatter','focus']:['shot','focus','breathe','cover'];h.hp=89;h.resource=3;h.intuition=2;s.ap=1;
  const saved=normalizeSave(s);assert.ok(saved);assert.deepEqual(saved.loadouts.knibbs,custom?s.loadouts.knibbs:['shot','focus','loadburst','cover']);assert.equal(heroOf(saved,'knibbs').hp,89);assert.equal(heroOf(saved,'knibbs').resource,3);assert.equal(heroOf(saved,'knibbs').intuition,2);assert.equal(saved.ap,1);
 }
});

test('Knibbs learning: old two-skill in-flight lessons keep AP and HP, while mastered basics retain old skills and new ammo choices',()=>{
 const run=createLearningRun('standard',{seed:51});advanceDialogue(run,true);run.battle=battleForRun(run);run.learningRevision=3;delete run.battle.knibbsRevision;
 run.battle.heroes[0].hp=71;run.battle.heroes[0].resource=4;run.battle.ap=1;const restored=normalizeLearningRun(run);
 assert.ok(restored);assert.equal(restored.phase,'battle');assert.equal(restored.battle.heroes[0].hp,71);assert.equal(restored.battle.ap,1);assert.deepEqual(skillAccessFor(restored).knibbs,['shot','focus']);
 const mastered=createLearningRun();mastered.learnedBasics.knibbs=5;const access=skillAccessFor(mastered).knibbs;for(const id of ['breathe','scatter','loadburst','loadbreach'])assert.ok(access.includes(id));assert.equal(battleForRun(mastered).loadouts.knibbs.length,4);
});
