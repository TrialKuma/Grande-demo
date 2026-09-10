import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,endRound} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {baseAttributes,effectiveAttributes} from '../src/attributes.js';

const fresh=()=>({...createBattle('standard','duelist',{partyIds:['haart','qianxing','patch'],upgrades:['haart_network']}),elapsed:0});
const copy=value=>structuredClone(value);

test('v8 save: new capacities round trip and reject overflow or mismatched record alias',()=>{
  const state=fresh();
  for(const hero of state.heroes)hero.secondary=hero.maxSecondary;
  heroOf(state,'patch').records=10;
  assert.deepEqual(normalizeSave(state),state);
  for(const id of ['haart','qianxing','patch']){
    const invalid=copy(state);heroOf(invalid,id).secondary++;
    if(id==='patch')heroOf(invalid,id).records++;
    assert.equal(normalizeSave(invalid),null,id);
  }
  const alias=copy(state);heroOf(alias,'patch').records=9;
  assert.equal(normalizeSave(alias),null);
});

test('v8 save: v7 stock migration preserves fullness and does not create carried AP',()=>{
  for(let amount=0;amount<=6;amount++){
    const state=fresh();state.version=7;delete state.roundCarry;
    for(const hero of state.heroes)hero.secondary=amount;
    heroOf(state,'patch').records=amount;
    const before=copy(state),restored=normalizeSave(state);
    assert.ok(restored,`legacy stock ${amount}`);
    assert.deepEqual(state,before);
    assert.equal(heroOf(restored,'haart').secondary,Math.ceil(amount*4/6));
    assert.equal(heroOf(restored,'qianxing').secondary,Math.ceil(amount*3/6));
    assert.equal(heroOf(restored,'patch').secondary,amount);
    assert.equal(heroOf(restored,'patch').records,amount);
    assert.equal(restored.roundCarry,0);assert.equal(restored.maxAp,6);
    assert.ok(normalizeSave(restored));
  }
});

test('save: full mind network preserves attribute empowerment and resumes identically',()=>{
  const state=fresh();state.loadouts.haart=['page','rest','network','soothe'];
  assert.equal(useSkill(state,'haart','rest').ok,true);
  assert.equal(useSkill(state,'haart','network').ok,true);
  for(const hero of state.heroes)assert.ok(effectiveAttributes(hero).strength>baseAttributes(hero.id).strength);
  const restored=normalizeSave(copy(state));assert.ok(restored);
  assert.deepEqual(useSkill(restored,'qianxing','spike'),useSkill(state,'qianxing','spike'));
  assert.deepEqual(restored,state);
  assert.deepEqual(endRound(restored),endRound(state));
  assert.deepEqual(restored,state);assert.ok(normalizeSave(restored));
  const invalid=copy(restored);heroOf(invalid,'haart').attackBuff=61;
  assert.equal(normalizeSave(invalid),null);
});
