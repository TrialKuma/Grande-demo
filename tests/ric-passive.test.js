import test from 'node:test';
import assert from 'node:assert/strict';
import {RIC_PASSIVE,ricDomainEffects,ricBalanceTransition,ricChaosAttackBonus,ricChaosDefenseReduction,consumeRicChaos,expireRicChaos,ricCrossingAllowed} from '../src/ric-passive.js';

const stats=value=>({strength:value,intelligence:value,agility:value,will:value});
function fixture(balance=0){
 const ric={id:'ric',hp:160,resource:balance,ricChaos:0},ally={id:'knibbs',hp:170},boss={id:'golem',unitId:'boss',hp:1000},minion={id:'drone',unitId:'enemy-1',hp:100};
 return {heroes:[ally,ric],boss,enemies:[boss,minion],ap:6,rngState:41};
}
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

test('positive projection automatically grants only Ric all four bonuses at every positive balance',()=>{
 for(const balance of [1,4,10]){
  const state=fixture(balance),ric=state.heroes[1],effects=ricDomainEffects(state,ric);
  assert.equal(effects.length,1);assert.deepEqual(effects[0].stats,stats(4));assert.equal(effects[0].dynamic,true);
  assert.deepEqual(ricDomainEffects(state,state.heroes[0]),[]);
  for(const enemy of state.enemies)assert.deepEqual(ricDomainEffects(state,enemy),[]);
 }
});

test('negative projection automatically weakens every living enemy and no allies',()=>{
 const state=fixture(-1);
 for(const enemy of state.enemies)assert.deepEqual(ricDomainEffects(state,enemy)[0].stats,stats(-3));
 for(const hero of state.heroes)assert.deepEqual(ricDomainEffects(state,hero),[]);
 state.enemies.push({id:'drone',unitId:'enemy-2',hp:100});
 assert.deepEqual(ricDomainEffects(state,state.enemies[2])[0].stats,stats(-3));
 state.enemies[1].hp=0;state.enemies[2].defeated=true;
 assert.deepEqual(ricDomainEffects(state,state.enemies[1]),[]);assert.deepEqual(ricDomainEffects(state,state.enemies[2]),[]);
});

test('fields disappear at zero and on Ric death without leaving persistent modifiers',()=>{
 const state=fixture(4),ric=state.heroes[1];assert.equal(ricDomainEffects(state,ric).length,1);
 ric.resource=0;for(const unit of [...state.heroes,...state.enemies])assert.deepEqual(ricDomainEffects(state,unit),[]);
 ric.resource=-4;assert.equal(ricDomainEffects(state,state.boss).length,1);
 ric.hp=0;for(const unit of [...state.heroes,...state.enemies])assert.deepEqual(ricDomainEffects(state,unit),[]);
 ric.hp=1;assert.equal(ricDomainEffects(state,state.boss).length,1);
 assert.ok(!Object.hasOwn(ric,'attributeBuffs'));assert.ok(!Object.hasOwn(state.boss,'attributeBuffs'));
 state.heroes=state.heroes.filter(hero=>hero.id!=='ric');assert.deepEqual(ricDomainEffects(state,state.boss),[]);
});

test('projections accept saved unit copies and a single-boss state without mutating frozen previews',()=>{
 const state=freeze(fixture(-3)),snapshot=JSON.stringify(state);
 for(let i=0;i<20;i++)assert.deepEqual(ricDomainEffects(state,{...state.boss})[0].stats,stats(-3));
 assert.equal(JSON.stringify(state),snapshot);
 const solo={heroes:state.heroes,boss:state.boss};assert.deepEqual(ricDomainEffects(solo,state.boss)[0].stats,stats(-3));
 const first=ricDomainEffects(state,state.boss);first[0].stats.strength=999;
 assert.deepEqual(ricDomainEffects(state,state.boss)[0].stats,stats(-3));assert.equal(RIC_PASSIVE.negative,-3);
});

test('only a real positive-negative flip grants chaos and never heals, shields or spends AP',()=>{
 for(const [before,after]of [[4,-4],[-3,3],[1,-1],[-1,1]]){
  const state=fixture(before),ric=state.heroes[1],snapshot=structuredClone(state);
  assert.equal(ricBalanceTransition(ric,before,after),true);assert.equal(ric.ricChaos,1);
  snapshot.heroes[1].ricChaos=1;assert.deepEqual(state,snapshot);
 }
 for(const [before,after]of [[4,0],[-3,0],[0,-4],[0,4],[4,2],[-4,-2],[0,0]]){
  const state=fixture(before),ric=state.heroes[1],snapshot=structuredClone(state);
  assert.equal(ricBalanceTransition(ric,before,after),false);assert.deepEqual(state,snapshot);
 }
 const ally=fixture().heroes[0];assert.equal(ricBalanceTransition(ally,4,-4),false);assert.ok(!Object.hasOwn(ally,'ricChaos'));
});

test('chaos shares one charge between offense and defense, refreshes rather than stacks, and reads do not consume',()=>{
 const ric=fixture(4).heroes[1];ricBalanceTransition(ric,4,-4);ricBalanceTransition(ric,-4,4);
 for(let i=0;i<3;i++){assert.equal(ricChaosAttackBonus(ric),12);assert.equal(ricChaosDefenseReduction(ric),12);}
 assert.equal(consumeRicChaos(ric),12);assert.equal(ricChaosAttackBonus(ric),0);assert.equal(ricChaosDefenseReduction(ric),0);assert.equal(consumeRicChaos(ric),0);
 // One three-hit skill, or three AOE targets, cannot copy the 12-point packet.
 ricBalanceTransition(ric,4,-4);assert.deepEqual([consumeRicChaos(ric),consumeRicChaos(ric),consumeRicChaos(ric)],[12,0,0]);
});

test('unused chaos expires at the next enemy phase boundary and never accumulates',()=>{
 const ric=fixture(4).heroes[1];ricBalanceTransition(ric,4,-4);
 assert.equal(expireRicChaos(ric),true);assert.equal(ric.ricChaos,0);assert.equal(expireRicChaos(ric),false);
 ricBalanceTransition(ric,-4,4);assert.equal(consumeRicChaos(ric),12);assert.equal(expireRicChaos(ric),false);
});

test('crossing stays strictly inside the source ±6 boundary and zero does not create negative balance',()=>{
 for(const balance of [-5,-4,-1,1,4,5])assert.equal(ricCrossingAllowed(balance),true);
 for(const balance of [-10,-6,0,6,10,NaN,Infinity])assert.equal(ricCrossingAllowed(balance),false);
});
