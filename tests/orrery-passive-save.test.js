import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,useSkill,endRound,heroOf} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
const cast=(s,id,key)=>{const r=useSkill(s,id,key);assert.equal(r.ok,true,r.error);return r;};

for(const [id,loadout,steps,label,intent] of [
 ['knibbs',['shot','loadburst','breathe','cover'],['shot','loadburst','cover'],'直感反制'],
 ['qianxing',['spike','repair','armor','beam'],['repair','armor','spike'],'钉刺反击','orbit_sweep'],
 ['youmu',['scalpel','surgery','sterilize','bloodoath'],['scalpel','surgery'],'手术创口']
])test(`orrery keeps a valid active-skill prediction after ${id}'s passive damage`,()=>{
 const partyIds=[id,...['apeilia','ric','knibbs'].filter(h=>h!==id)].slice(0,3);
 const s=createBattle('standard','orrery',{partyIds,singleEnemy:true,loadouts:{[id]:loadout}});
 if(intent)s.boss.intent=intent;
 for(const key of steps)cast(s,id,key);
 const previous=s.boss.forecastSkill,result=endRound(s);
 assert.ok(result.events.some(e=>e.label?.includes(label)),`must actually produce ${label}`);
 assert.equal(s.boss.forecastSkill,previous);
 assert.ok(normalizeSave(s),'counter/DOT ids must not make the battle unsavable');
});

test('zero-AP active crossing remains a predicted skill while its chaos passive is not a separate one',()=>{
 const s=createBattle('standard','orrery',{partyIds:['ric'],singleEnemy:true,loadouts:{ric:['rune','crossing','bind','shelter']}});
 cast(s,'ric','rune');cast(s,'ric','crossing');assert.equal(s.boss.forecastSkill,'ric/crossing');
 assert.equal(heroOf(s,'ric').ricChaos,1);assert.ok(normalizeSave(s));
});
