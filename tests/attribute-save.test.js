import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {baseAttributes,addAttributeEffect,attemptControl} from '../src/attributes.js';

const fresh=()=>({...createBattle('standard','duelist'),elapsed:0});
test('attribute buffs, control duration and random rolls survive save and reload',()=>{
 const battle=fresh(),hero=heroOf(battle,'knibbs');
 addAttributeEffect(hero,{id:'test_armor',label:'加固',stats:{agility:8,will:4},turns:2,tone:'good'});
 addAttributeEffect(battle.boss,{id:'test_weaken',label:'疲弱',stats:{strength:-8,intelligence:-8},turns:1,tone:'warning'});
 hero.control={type:'silence',turns:1,source:'duelist',label:'封术',fresh:false};
 heroOf(battle,'ric').controlGuard=1;battle.rngState=215771;
 const restored=normalizeSave(structuredClone(battle));assert.ok(restored);assert.deepEqual(restored,battle);
 const spec={type:'stun',source:'duelist',power:12,label:'眩晕'};
 assert.deepEqual(attemptControl(restored,heroOf(restored,'apeilia'),spec),attemptControl(battle,heroOf(battle,'apeilia'),spec));
 assert.deepEqual(restored,battle,'loading does not reroll the next resistance check');
});

test('save metadata cannot change canonical base attributes',()=>{
 const battle=fresh();battle.heroes[0].attributes.strength=99;battle.boss.attributes.will=99;
 const restored=normalizeSave(battle);assert.ok(restored);assert.deepEqual(restored.heroes[0].attributes,baseAttributes('knibbs'));assert.deepEqual(restored.boss.attributes,baseAttributes('duelist'));
});

test('invalid attribute and control states are rejected rather than entering combat',()=>{
 const invalid=change=>{const battle=fresh();change(battle);assert.equal(normalizeSave(battle),null);};
 invalid(s=>s.heroes[0].attributes.strength=NaN);
 invalid(s=>s.heroes[0].attributeBuffs=[{id:'x',label:'x',stats:{agility:Infinity},turns:1}]);
 invalid(s=>s.heroes[0].attributeBuffs=[{id:'x',label:'x',stats:{agility:31},turns:1}]);
 invalid(s=>s.heroes[0].attributeBuffs=[{id:'x',label:'x',stats:{hp:10},turns:1}]);
 invalid(s=>s.heroes[0].control={type:'sleep',turns:1,source:'boss',label:'x',fresh:true});
 invalid(s=>s.heroes[0].control={type:'stun',turns:2,source:'boss',label:'x',fresh:true});
 invalid(s=>s.heroes[0].controlGuard=2);invalid(s=>s.rngState=-1);invalid(s=>s.rngState=4294967296);
});

test('v10 tutorials migrate the larger enemy health pool while retaining damage already dealt',()=>{
 const battle={...createBattle('standard','scout',{partyIds:['knibbs']}),elapsed:8};battle.version=10;
 battle.boss.maxHp=135;battle.boss.hp=100;battle.heroes[0].hp=160;battle.ap=1;
 for(const unit of [...battle.heroes,...battle.enemies])for(const key of ['attributes','attributeBuffs','control','controlGuard'])delete unit[key];delete battle.rngState;
 const restored=normalizeSave(structuredClone(battle));assert.ok(restored);
 assert.equal(restored.boss.maxHp,225);assert.equal(restored.boss.hp,190);assert.equal(restored.heroes[0].hp,160);assert.equal(restored.ap,1);assert.equal(restored.elapsed,8);
 assert.deepEqual(restored.heroes[0].attributes,baseAttributes('knibbs'));assert.equal(restored.heroes[0].control,null);assert.equal(restored.version,11);
});
