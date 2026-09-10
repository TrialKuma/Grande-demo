import test from 'node:test';
import assert from 'node:assert/strict';
import {ACTION_POINT_RULES,actionPointInfo,baseActionPoints,refreshActionPoints} from '../src/action-points.js';
import {createBattle,endRound,useSkill,prepareResponse,heroOf} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {grantShield} from '../src/shields.js';

const make=(mode='party',boss='duelist')=>createBattle('story',boss,mode==='solo'?{mode,partyIds:['knibbs']}:{mode});
const cast=(state,hero,skill)=>{const result=useSkill(state,hero,skill);assert.equal(result.ok,true,result.error);};

test('AP: opening budgets remain six for a party and five for a solo hero',()=>{
  assert.equal(ACTION_POINT_RULES.carryLimit,2);
  for(const [mode,base] of [['party',6],['solo',5]]){
    const state=make(mode);
    assert.equal(baseActionPoints(mode),base);
    assert.equal(baseActionPoints(state),base);
    assert.deepEqual(actionPointInfo(state),{base,carry:0,carryLimit:2,current:base,max:base,nextCarry:2,nextTotal:base+2});
    assert.equal(state.roundCarry,0);
    assert.ok(normalizeSave(state));
  }
});

test('AP: zero, one, or multiple unused points transfer only their capped value',()=>{
  for(const mode of ['party','solo'])for(const remaining of [0,1,2,3,5]){
    const state=make(mode);state.ap=remaining;
    const preview=actionPointInfo(state),before=structuredClone(state);
    assert.deepEqual(state,before,'preview is read-only');
    endRound(state);
    assert.equal(state.round,2);
    assert.equal(state.roundCarry,Math.min(2,remaining));
    assert.equal(state.ap,baseActionPoints(state)+Math.min(2,remaining));
    assert.equal(state.maxAp,preview.nextTotal);
    assert.ok(normalizeSave(state),`${mode}, ${remaining} unused`);
  }
});

test('AP: saved points can be spent and unused rollover cannot grow beyond two',()=>{
  const state=make();state.ap=2;endRound(state);
  assert.equal(state.ap,8);
  cast(state,'knibbs','shot');cast(state,'knibbs','shot');
  assert.equal(state.ap,6);
  assert.equal(actionPointInfo(state).nextCarry,2);
  state.ap=1;endRound(state);
  assert.equal(state.ap,7);assert.equal(state.roundCarry,1);
  state.ap=0;endRound(state);
  assert.equal(state.ap,6);assert.equal(state.roundCarry,0);
  for(let i=0;i<12;i++){
    refreshActionPoints(state);
    assert.equal(state.ap,8);assert.equal(state.maxAp,8);assert.equal(state.roundCarry,2);
  }
});

test('AP: all paid tactical actions reduce the amount available to carry',()=>{
  const state=make();state.ap=2;
  assert.equal(useSkill(state,'apeilia','reboot').ok,true);
  assert.equal(state.ap,1);assert.equal(actionPointInfo(state).nextCarry,1);
  assert.equal(prepareResponse(state,'evade','ric').ok,false);
  assert.equal(state.ap,1,'removed generic responses cannot affect the budget');
  endRound(state);
  assert.equal(state.ap,7);assert.equal(state.roundCarry,1);
});

test('AP: breaking an enemy does not refund a character defense or create carry points',()=>{
  const state=make();state.ap=2;state.boss.stagger=1;
  assert.equal(useSkill(state,'apeilia','reboot').ok,true);
  cast(state,'knibbs','shot');
  assert.equal(state.boss.broken,true);assert.equal(state.ap,0);
  endRound(state);
  assert.equal(state.ap,6);assert.equal(state.roundCarry,0);assert.equal(state.response,null);
});

test('AP: existing shields and control immunity still age on turns with carry',()=>{
  const state=make(),hero=heroOf(state,'knibbs');grantShield(hero,20);
  state.ap=2;state.boss.hardControl=1;
  endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.hardControl,0);assert.equal(state.boss.controlImmune,1);
  assert.deepEqual(hero.shieldLayers,[{amount:20,turns:1}]);
  endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.controlImmune,0);assert.equal(hero.shield,0);
});

test('AP: conserving points cannot prolong the giant core deadline',()=>{
  const state=make('party','golem');
  Object.assign(state.boss,{hp:0,core:true,coreFresh:false,coreTurns:2,fog:0});state.ap=2;
  endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.coreTurns,1);assert.equal(state.boss.core,true);
  endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.core,false);assert.equal(state.boss.reforms,1);
});

test('AP: terminal deadline advances and still requires current character protection',()=>{
  const state=make('party','final');
  Object.assign(state.boss,{hp:0,finale:true,finaleFresh:false,finaleTurns:2,seals:0,finalePhysical:1,finaleMagic:1});state.ap=2;
  for(const hero of state.heroes)hero.guard=true;
  endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.finaleTurns,1);assert.equal(state.mode,'playing');
  for(const hero of state.heroes)hero.guard=true;
  endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.finale,false);assert.equal(state.boss.reforms,1);
});

test('AP: the arbiter checks each skill cost, not the enlarged round budget',()=>{
  const state=make('party','arbiter');state.ap=2;endRound(state);
  assert.equal(state.ap,8);assert.equal(state.boss.decree,'heavy');
  cast(state,'knibbs','shot');assert.equal(state.boss.violations,1);
  cast(state,'knibbs','focus');assert.equal(state.boss.violations,1);
});

test('AP saves: current state preserves rollover and identical subsequent resolution',()=>{
  for(const mode of ['party','solo'])for(const remaining of [1,2]){
    const state=make(mode);state.ap=remaining;endRound(state);cast(state,'knibbs','shot');
    const restored=normalizeSave(JSON.parse(JSON.stringify(state)));
    assert.ok(restored);assert.deepEqual(restored,{...state,elapsed:0});
    assert.deepEqual(endRound(restored),endRound(state));
    assert.deepEqual(restored,{...state,elapsed:0});
  }
});

test('AP saves: malformed carry, mismatched totals, and opening carry are rejected',()=>{
  const good=make();good.ap=2;endRound(good);
  for(const mutate of [s=>delete s.roundCarry,s=>s.roundCarry=-1,s=>s.roundCarry=3,s=>s.roundCarry=.5,s=>s.roundCarry='2',s=>s.maxAp=7,s=>s.ap=9,s=>s.ap=-1,s=>s.round=1]){
    const bad=structuredClone(good);mutate(bad);assert.equal(normalizeSave(bad),null);
  }
  const solo=make('solo');solo.ap=1;endRound(solo);solo.maxAp=7;assert.equal(normalizeSave(solo),null);
});

test('AP saves: v6 and v7 saves without carry migrate once with their old base budget',()=>{
  for(const mode of ['party','solo'])for(const version of [6,7]){
    const old=make(mode);old.version=version;old.round=3;old.ap=2;delete old.roundCarry;
    const migrated=normalizeSave(old);assert.ok(migrated);
    assert.equal(migrated.version,11);assert.equal(migrated.roundCarry,0);assert.equal(migrated.ap,2);assert.equal(migrated.maxAp,baseActionPoints(mode));
    endRound(migrated);assert.equal(migrated.roundCarry,2);assert.equal(migrated.ap,baseActionPoints(mode)+2);
    assert.ok(normalizeSave(migrated));
  }
});
