import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeEffects,effectiveAttributes,attackAttribute,defenseAttribute,controlResistance} from '../src/attributes.js';

const zero={strength:0,intelligence:0,agility:0,will:0};
function field(balance){
 const ric={id:'ric',hp:160,resource:balance,attributeBuffs:[]};
 const boss={id:'tide',unitId:'boss',hp:100,attributeBuffs:[]};
 return {heroes:[ric,{id:'knibbs',hp:170}],enemies:[boss],boss,upgrades:[]};
}

test('positive domain comes from balance alone and affects Ric, without persistent stat grants',()=>{
 const state=field(1),ric=state.heroes[0];
 assert.deepEqual(effectiveAttributes(ric,state),{strength:4,intelligence:4,agility:4,will:4});
 assert.deepEqual(effectiveAttributes(state.heroes[1],state),zero);
 assert.deepEqual(effectiveAttributes(state.boss,state),zero);
 assert.equal(controlResistance(ric,12,state),.5);
 assert.deepEqual(ric.attributeBuffs,[]);
 ric.resource=0;assert.deepEqual(effectiveAttributes(ric,state),zero);
});

test('negative domain applies to all living enemies, new summons and selected-enemy views',()=>{
 const state=field(-1),add={id:'drone',unitId:'enemy-1',hp:40};state.enemies.push(add);
 for(const target of state.enemies){
  assert.deepEqual(effectiveAttributes(target,state),{strength:-3,intelligence:-3,agility:-3,will:-3});
  assert.equal(attackAttribute(target,'physical',state),-3);
  assert.equal(defenseAttribute(target,'magic',state),-3);
  assert.equal(controlResistance(target,12,state),.15);
 }
 assert.deepEqual(effectiveAttributes(state.heroes[0],state),zero);
 assert.equal(attributeEffects(add,{...state,boss:add}).filter(x=>x.id==='ric_domain_negative').length,1);
 assert.deepEqual(effectiveAttributes({id:'drone',unitId:'unrelated',hp:20},state),zero);
});

test('domain switches immediately on death, revival, zero and stronger passive reward',()=>{
 const state=field(-4),ric=state.heroes[0];state.upgrades.push('ric_erosion');
 assert.equal(effectiveAttributes(state.boss,state).strength,-4);
 ric.hp=0;assert.deepEqual(effectiveAttributes(state.boss,state),zero);
 ric.hp=10;assert.equal(effectiveAttributes(state.boss,state).strength,-4);
 ric.resource=2;assert.deepEqual(effectiveAttributes(state.boss,state),zero);
 assert.equal(effectiveAttributes(ric,state).strength,4);
 ric.resource=0;assert.deepEqual(effectiveAttributes(ric,state),zero);
});

test('derived field survives cloned saves without duplicate or stale stat effects',()=>{
 const original=field(-3),copy=structuredClone(original);
 assert.deepEqual(effectiveAttributes(copy.boss,copy),effectiveAttributes(original.boss,original));
 copy.heroes[0].resource=0;
 assert.deepEqual(effectiveAttributes(copy.boss,copy),zero);
 assert.equal(effectiveAttributes(original.boss,original).agility,-3);
 assert.deepEqual(copy.boss.attributeBuffs,[]);
});

test('weak marks are condition tags, not an unlisted party-wide agility debuff',()=>{
 assert.deepEqual(effectiveAttributes({id:'tide',hp:10,marked:true}),zero);
});
