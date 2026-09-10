import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,createBattle,skillPreview,useSkill,endRound,attackSpec,intentInfo,enemyThreats,BOSS_PRESSURE} from '../src/combat.js';
import {effectiveAttributes,addAttributeEffect,controlResistance,attemptControl} from '../src/attributes.js';
import {normalizeSave} from '../src/save.js';

const zero={strength:0,intelligence:0,agility:0,will:0};
const mainLoss=(result,id,label)=>result.events.filter(e=>e.type==='boss'&&e.label===label).reduce((sum,e)=>sum+(e.hpLosses?.[id]||0),0);

test('all heroes start at zero attribute bonuses and reference sheet values cannot change damage',()=>{
 for(const hero of HEROES){
  const state=createBattle('standard','tide',{partyIds:[hero.id],singleEnemy:true}),unit=state.heroes[0];
  assert.deepEqual(effectiveAttributes(unit),zero);unit.attributes={strength:99,intelligence:99,agility:99,will:99};
  assert.deepEqual(effectiveAttributes(unit),zero);assert.equal(controlResistance(unit),.3);
 }
 const s=createBattle('standard','tide',{singleEnemy:true}),before=skillPreview(s,'knibbs','shot');
 s.heroes[0].attributes.strength=99;s.boss.attributes.agility=99;
 assert.deepEqual(skillPreview(s,'knibbs','shot'),before);assert.equal(before.attributeBonus,0);assert.equal(before.damage,before.baseDamage);
});

test('negative strength and defense remain effective below zero on every hit and cancel arithmetically',()=>{
 const state=createBattle('standard','tide',{singleEnemy:true}),hero=state.heroes[1],before=skillPreview(state,'apeilia','purify');
 addAttributeEffect(hero,{id:'weak',label:'疲弱',stats:{intelligence:-3},turns:2});
 assert.equal(effectiveAttributes(hero).intelligence,-3);assert.equal(skillPreview(state,'apeilia','purify').damage,before.damage-6);
 addAttributeEffect(state.boss,{id:'exposed',label:'抗性破绽',stats:{intelligence:-3},turns:2});
 assert.equal(effectiveAttributes(state.boss).intelligence,-3);assert.equal(skillPreview(state,'apeilia','purify').damage,before.damage);
 addAttributeEffect(hero,{id:'boost',label:'增强',stats:{intelligence:3},turns:2});
 assert.equal(effectiveAttributes(hero).intelligence,0);assert.equal(skillPreview(state,'apeilia','purify').damage,before.damage+6);
});

test('ordinary enemy suppression reduces each hit from its listed base without a zero-clamp loophole',()=>{
 const state=createBattle('standard','duelist',{singleEnemy:true}),weak=structuredClone(state);weak.boss.weakened=1;
 assert.equal(effectiveAttributes(weak.boss).strength,-8);
 const base=endRound(state),reduced=endRound(weak);
 assert.equal(mainLoss(base,'knibbs','裂锋三连'),84);assert.equal(mainLoss(reduced,'knibbs','裂锋三连'),60);
});

test('suppressed damaging attacks show the same one-point floor as an unprotected target receives',()=>{
 const state=createBattle('standard','duelist',{singleEnemy:true});
 addAttributeEffect(state.boss,{id:'suppression',label:'强力压制',stats:{strength:-30},turns:2});
 state.boss.weakened=1;
 assert.equal(attackSpec(state).damage,28);assert.equal(effectiveAttributes(state.boss).strength,-38);
 assert.equal(enemyThreats(state)[0].damage,1);assert.match(intentInfo(state).desc,/3 × 1 物理伤害/);
 assert.equal(mainLoss(endRound(state),'knibbs','裂锋三连'),3);
});

test('percentile controls have baseline resistance, explicit will changes and exact clamped bounds',()=>{
 const unit={id:'knibbs'};assert.equal(controlResistance(unit,12),.3);assert.equal(controlResistance(unit,18),.15);
 addAttributeEffect(unit,{id:'will',label:'坚定',stats:{will:4},turns:2});assert.equal(controlResistance(unit,12),.5);
 addAttributeEffect(unit,{id:'will',label:'意志削弱',stats:{will:-4},turns:2});assert.equal(controlResistance(unit,12),.1);
 for(const [will,expected]of [[-30,.05],[30,.95]]){
  addAttributeEffect(unit,{id:'will',label:'边界',stats:{will},turns:2});assert.equal(controlResistance(unit),expected);
  const faces=new Map();for(let seed=1;seed<1500;seed++){const target=structuredClone(unit),result=attemptControl({rngState:seed},target);faces.set(result.roll,result.success);}
  assert.equal(faces.size,100);assert.equal([...faces.values()].filter(success=>!success).length,expected*100);
 }
});

test('old attribute metadata migrates while negative bonuses, HP and next control result survive reload',()=>{
 const old=createBattle('standard','warden',{singleEnemy:true,seed:41});old.heroes[0].hp-=17;
 addAttributeEffect(old.heroes[0],{id:'fatigue',label:'疲劳',stats:{strength:-4,will:-3},turns:2});
 const loaded=normalizeSave(old);assert.ok(loaded);assert.equal(loaded.heroes[0].hp,153);
 assert.deepEqual(effectiveAttributes(loaded.heroes[0]),{...zero,strength:-4,will:-3});
 assert.deepEqual(attemptControl(loaded,loaded.heroes[0]),attemptControl(old,old.heroes[0]));
});

for(const entry of [
 {boss:'tide',intent:'tide_breaker',layer:'waterLevel',count:4,low:2,actions:[['knibbs','scatter'],['knibbs','shot']],highDamage:120,lowDamage:84},
 {boss:'warden',intent:'storm',layer:'charge',count:4,low:0,actions:[['knibbs','scatter'],['knibbs','shot']],highDamage:98,lowDamage:50},
 {boss:'cantor',intent:'bloom',layer:'spores',count:5,low:0,actions:[['knibbs','scatter'],['knibbs','shot']],highDamage:126,lowDamage:46},
 {boss:'furnace',intent:'furnace_drop',layer:'heat',count:4,low:0,actions:[['knibbs','scatter'],['knibbs','shot']],highDamage:142,lowDamage:94},
])test(`${entry.boss}: public multi-hit dismantling immediately lowers the announced and actual cash-out damage`,()=>{
 const state=createBattle('standard',entry.boss,{singleEnemy:true,loadouts:{knibbs:['shot','focus','scatter','breathe']}});
 state.boss.intent=entry.intent;state.boss[entry.layer]=entry.count;
 if(entry.boss==='furnace')state.boss.furnaceOpen=true;
 const ignored=structuredClone(state),oldSpec=attackSpec(state),oldDescription=intentInfo(state).desc;
 for(const [id,key]of entry.actions)assert.equal(useSkill(state,id,key).ok,true);
 assert.equal(state.boss[entry.layer],entry.low);assert.equal(state.boss.stage,0,'fixture must not cross a phase while dismantling');
 const spec=attackSpec(state);assert.equal(spec.pressure.perLayer,BOSS_PRESSURE[entry.intent].perLayer);
 assert.ok(spec.damage<oldSpec.damage);assert.notEqual(intentInfo(state).desc,oldDescription);
 const ignoredResult=endRound(ignored),handledResult=endRound(state);
 assert.equal(mainLoss(ignoredResult,'knibbs',oldSpec.name),entry.highDamage);
 assert.equal(mainLoss(handledResult,'knibbs',spec.name),entry.lowDamage);
 if(entry.boss==='tide'){
  assert.ok(ignoredResult.events.some(event=>event.label==='回卷重锚'));
  assert.ok(!handledResult.events.some(event=>event.label==='回卷重锚'));
 }
});

test('six-charge chain lightning advertises two 65-point hits and applying suppression reduces both',()=>{
 const state=createBattle('standard','warden',{singleEnemy:true});state.boss.intent='arc';state.boss.charge=6;
 const spec=attackSpec(state);assert.equal(spec.hits,2);assert.equal(spec.damage,65);assert.equal(spec.pressure.damageBonus,30);
 assert.match(intentInfo(state).desc,/2 × 65/);state.boss.weakened=1;
 const result=endRound(state);assert.equal(mainLoss(result,'knibbs','雷链双击'),114);
});
