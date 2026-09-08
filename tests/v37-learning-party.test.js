import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle} from '../src/combat.js';
import {LEARNING_ORDER} from '../src/training.js';
import {runConfiguredParty} from '../scripts/party-probe.mjs';

// These two orders intentionally arrive with very different offensive access.
// Neither uses optional practice wins, growth cards, or unrestricted skill sets.
for(const difficulty of ['story','standard'])for(const [first,second] of [['haart','patch'],['patch','haart']]){
 test(`learning party: ${first} then ${second} can enter the first formal boss directly at ${difficulty}`,()=>{
  const state=createBattle(difficulty,'duelist',{partyIds:['knibbs',first,second],skillAccess:{knibbs:LEARNING_ORDER.knibbs,[first]:LEARNING_ORDER[first].slice(0,4),[second]:LEARNING_ORDER[second].slice(0,2)}});
  const result=runConfiguredParty(state);assert.equal(result.result,'victory');assert.ok(result.round<=14);assert.ok(result.hp.some(n=>n>0));
  assert.deepEqual(state.upgrades,[]);assert.equal(state.heroes[0].hp,state.heroes[0].maxHp,'search never modifies its supplied initial battle');
 });
}
