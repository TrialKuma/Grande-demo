import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,endRound,skillPreview,canUse,enemyThreats} from '../src/combat.js';
import {effectiveAttributes,attributeEffects} from '../src/attributes.js';
import {normalizeSave} from '../src/save.js';
const cast=(state,key)=>{const result=useSkill(state,'ric',key);assert.equal(result.ok,true,result.error);return result;};
const arena=(loadout=['rune','bind','shelter','mend'])=>createBattle('standard','tide',{partyIds:['ric','apeilia','youmu'],singleEnemy:true,loadouts:{ric:loadout}});
const hits=result=>result.events.filter(e=>e.type==='attack').reduce((n,e)=>n+(e.hpLosses?.boss||0),0);

test('Ric skill establishes a field passively after its own damage; it does not cast a separate debuff',()=>{
 const state=arena(),ric=heroOf(state,'ric'),hp=state.boss.hp;
 assert.equal(skillPreview(state,'ric','mend').damage,32);
 cast(state,'mend');assert.equal(hp-state.boss.hp,32);assert.equal(ric.resource,-4);
 assert.equal(state.boss.weakened,0);assert.equal(state.boss.vulnerable,0);
 assert.deepEqual(effectiveAttributes(state.boss,state),{strength:-3,intelligence:-3,agility:-3,will:-3});
 assert.equal(skillPreview(state,'apeilia','purify').attributeBonus,0);
 assert.equal(skillPreview(state,'apeilia','purify').damage,42);
 assert.equal(enemyThreats(state)[0].damage,97);
});

test('positive shelter supplies only its shield and edge; all four stat bonuses come from the field',()=>{
 const state=arena(),ric=heroOf(state,'ric');cast(state,'shelter');
 assert.equal(ric.shield,30);assert.equal(ric.protection,0);assert.equal(ric.ricEdge,2);
 assert.deepEqual(attributeEffects(ric,state).map(e=>e.id),['ric_domain_positive']);
 ric.resource=0;assert.equal(effectiveAttributes(ric,state).agility,0);
 assert.equal(ric.shield,30);
});

test('only a true sign flip grants chaos, with no incidental party shields or healing',()=>{
 const state=arena(),ric=heroOf(state,'ric');state.heroes.forEach(h=>h.hp-=20);ric.resource=-2;
 cast(state,'rune');assert.equal(ric.resource,0);assert.equal(ric.ricChaos||0,0);
 assert.ok(state.heroes.every(h=>h.shield===0&&h.hp===h.maxHp-20));
 ric.resource=-1;cast(state,'rune');assert.equal(ric.resource,1);assert.equal(ric.ricChaos,1);
 assert.ok(state.heroes.every(h=>h.shield===0&&h.hp===h.maxHp-20));
});

test('existing chaos adds one packet to a multihit attack, new flip chaos belongs to the following action',()=>{
 const state=arena(),ric=heroOf(state,'ric');ric.resource=4;ric.ricChaos=1;
 const plain=structuredClone(state);heroOf(plain,'ric').ricChaos=0;
 const before=structuredClone(state),preview=skillPreview(state,'ric','rune');assert.deepEqual(state,before);
 assert.equal(preview.damage-skillPreview(plain,'ric','rune').damage,12);
 const result=cast(state,'rune');assert.equal(hits(result),preview.damage);assert.equal(ric.ricChaos,0);
 ric.resource=-1;state.ap=6;cast(state,'rune');assert.equal(ric.ricChaos,1);
 assert.equal(ric.resource,1);
});

test('chaos defense reduces one real hit and expires when no hit arrives',()=>{
 const state=createBattle('standard','duelist',{partyIds:['ric'],singleEnemy:true}),ric=heroOf(state,'ric');
 const plain=structuredClone(state);ric.ricChaos=1;
 const a=endRound(state),b=endRound(plain);
 const loss=r=>r.events.filter(e=>e.type==='boss'&&e.label==='裂锋三连').reduce((n,e)=>n+(e.hpLosses?.ric||0),0);
 assert.equal(loss(b)-loss(a),12);assert.equal(ric.ricChaos,0);
 const skipped=arena();heroOf(skipped,'ric').ricChaos=1;skipped.boss.broken=true;endRound(skipped);assert.equal(heroOf(skipped,'ric').ricChaos,0);
});

test('crossing is limited, once per round, and its AOE cannot copy a chaos packet to each target',()=>{
 const state=createBattle('standard','weaver',{partyIds:['ric'],loadouts:{ric:['rune','bind','shelter','crossing']}}),ric=heroOf(state,'ric');
 assert.match(canUse(state,'ric','crossing'),/平衡/);ric.resource=6;assert.match(canUse(state,'ric','crossing'),/平衡/);
 ric.resource=4;ric.ricChaos=1;const plain=structuredClone(state);heroOf(plain,'ric').ricChaos=0;
 const hp=s=>s.enemies.reduce((n,e)=>n+e.hp,0),before=hp(state),baseline=hp(plain);
 const result=cast(state,'crossing');cast(plain,'crossing');
 assert.equal(before-hp(state)-(baseline-hp(plain)),12);assert.equal(state.ap,state.maxAp);
 assert.equal(ric.resource,-4);assert.equal(ric.ricChaos,1);assert.match(canUse(state,'ric','crossing'),/本轮/);
 assert.ok(result.events.some(e=>e.label==='混沌 · 领域翻转'));
});

test('Ric negative field and a pending chaos charge restore faithfully; zero recovery does not mint a new charge',()=>{
 const state=arena(),ric=heroOf(state,'ric');ric.resource=-1;ric.ricChaos=1;
 const restored=normalizeSave(state);assert.ok(restored);assert.equal(heroOf(restored,'ric').ricChaos,1);
 assert.equal(effectiveAttributes(restored.boss,restored).strength,-3);
 restored.boss.broken=true;endRound(restored);
 assert.equal(heroOf(restored,'ric').resource,0);assert.equal(heroOf(restored,'ric').ricChaos,0);
 assert.equal(effectiveAttributes(restored.boss,restored).strength,0);
});
