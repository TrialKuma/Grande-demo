import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,useSkill,endRound,skillPreview,canUse,usePotion,heroOf,activeSkills} from '../src/combat.js';
import {baseAttributes,effectiveAttributes,addAttributeEffect,attemptControl,controlResistance,ageControl,clearControl} from '../src/attributes.js';
import {normalizeSave} from '../src/save.js';
import {comboPlan} from '../src/boss-combos.js';

const cast=(s,id,key)=>{const r=useSkill(s,id,key);assert.equal(r.ok,true,r.error);return r;};
const arena=(id='apeilia')=>createBattle('standard','tide',{partyIds:[id],singleEnemy:true,loadouts:{apeilia:['blade','purify','eden','reboot']}});

test('attributes: each physical hit gains one damage per strength and loses one per enemy agility',()=>{
 const s=arena();s.heroes[0].resource=10;const before=skillPreview(s,'apeilia','eden');
 const plus=structuredClone(s);addAttributeEffect(plus.heroes[0],{id:'strength',label:'力量',stats:{strength:1},turns:2});const p=skillPreview(plus,'apeilia','eden');
 assert.equal(p.damage-before.damage,4);assert.equal(p.baseDamage,before.baseDamage);assert.equal(p.attributeBonus,before.attributeBonus+1);
 addAttributeEffect(plus.boss,{id:'armor',label:'护甲',stats:{agility:1},turns:2});assert.equal(skillPreview(plus,'apeilia','eden').damage,before.damage);
 const result=cast(plus,'apeilia','eden');assert.equal(result.events.filter(e=>e.type==='attack').reduce((n,e)=>n+e.amount,0),before.damage);
});
test('attributes: intelligence applies separately to each magic hit and magic defense',()=>{
 const s=arena(),before=skillPreview(s,'apeilia','purify').damage;
 addAttributeEffect(s.heroes[0],{id:'int',label:'智力',stats:{intelligence:1},turns:2});assert.equal(skillPreview(s,'apeilia','purify').damage,before+2);
 addAttributeEffect(s.boss,{id:'int',label:'智力',stats:{intelligence:1},turns:2});assert.equal(skillPreview(s,'apeilia','purify').damage,before);
});
test('attributes: physical defense exactly counters strength on each enemy hit',()=>{
 const s=createBattle('standard','duelist',{singleEnemy:true});s.boss.mirror=0;
 const plus=structuredClone(s);addAttributeEffect(plus.heroes[0],{id:'armor',label:'防护',stats:{agility:3},turns:2});
 const hit=endRound(s).events.find(e=>e.type==='boss'&&e.amounts),protectedHit=endRound(plus).events.find(e=>e.type==='boss'&&e.amounts);
 assert.equal(hit.amounts.knibbs-protectedHit.amounts.knibbs,3);
});
test('attributes: temporary effects refresh by ID and expire after their declared turn count',()=>{
 const s=arena('ric'),h=s.heroes[0];addAttributeEffect(h,{id:'test',label:'坚定',stats:{will:4},turns:2});
 addAttributeEffect(h,{id:'test',label:'坚定',stats:{will:4},turns:2});assert.equal(h.attributeBuffs.length,1);assert.equal(effectiveAttributes(h).will,4);
 for(let n=0;n<2;n++){s.boss.broken=true;s.boss.stagger=0;endRound(s);}
 assert.equal(h.attributeBuffs.length,0);assert.equal(effectiveAttributes(h).will,0);
});
test('attributes: captain is an explicit additive state and ends with a finite negative penalty',()=>{
 const s=arena('youmu'),h=s.heroes[0];assert.deepEqual(h.attributes,baseAttributes('youmu'));
 cast(s,'youmu','bloodoath');assert.deepEqual(effectiveAttributes(h),{strength:5,intelligence:-5,agility:9,will:2});
 for(let n=0;n<2;n++){s.boss.broken=true;s.boss.stagger=0;endRound(s);}
 assert.equal(h.youmuForm,'doctor');assert.equal(h.exhaustedTurns,2);assert.equal(effectiveAttributes(h).strength,-4);
});
test('attributes: intuition and crossfire show their real conditional strengthening',()=>{
 const s=arena('knibbs');s.heroes[0].intuition=3;const p=skillPreview(s,'knibbs','focus');
 assert.equal(p.empowered,true);assert.equal(p.attributeBonus,0);assert.equal(p.intuitionDamage,24);assert.match(p.empowerReason,/额外 24/);
 const a=arena();a.heroes[0].lastKind='physical';const ap=skillPreview(a,'apeilia','purify');assert.equal(ap.empowered,true);assert.equal(ap.attributeBonus,6);
});
test('control: percentile resistance has a baseline and exactly the advertised number of resisting faces',()=>{
 const hero={id:'ric',attributes:baseAttributes('ric')};assert.equal(controlResistance(hero,12),.3);
 addAttributeEffect(hero,{id:'will',stats:{will:4},turns:2});assert.equal(controlResistance(hero,12),.5);
 const seen=new Map();for(let seed=1;seed<1000;seed++){const unit=structuredClone(hero),r=attemptControl({rngState:seed},unit,{power:12});seen.set(r.roll,r.success);}
 assert.equal(seen.size,100);assert.equal([...seen.values()].filter(x=>!x).length,50);
});
test('control: stun lasts one full turn; silence leaves physical/support skills available; cleansing grants grace',()=>{
 const s=arena('ric'),h=s.heroes[0];attemptControl(s,h,{power:100});ageControl(h);assert.match(canUse(s,'ric','rune'),/眩晕/);
 const snapshot=structuredClone(s);assert.equal(useSkill(s,'ric','rune').ok,false);assert.deepEqual(s,snapshot);
 clearControl(h);assert.equal(attemptControl(s,h,{power:100}).immune,true);ageControl(h);
 attemptControl(s,h,{type:'silence',power:100,label:'封术'});assert.equal(canUse(s,'ric','rune'),'');assert.match(canUse(s,'ric','bind'),/封术/);assert.equal(canUse(s,'ric','shelter'),'');
 const potion=usePotion(s,h.id);assert.equal(potion.ok,true);assert.equal(h.control,null);assert.equal(h.controlGuard,1);
});
test('control: preview does not consume random rolls and save/restore repeats the same result',()=>{
 const s=createBattle('standard','warden',{partyIds:['qianxing'],singleEnemy:true,upgrades:['qianxing_lock'],loadouts:{qianxing:['spike','pulse','armor','lock']},seed:125});
 s.heroes[0].secondary=2;const before=structuredClone(s);skillPreview(s,'qianxing','lock');assert.deepEqual(s,before);
 const restored=normalizeSave(s);assert.ok(restored);assert.deepEqual(cast(s,'qianxing','lock'),cast(restored,'qianxing','lock'));assert.equal(s.rngState,restored.rngState);
});
test('combo: mirror rend marks a survivor and the announced follow-up can be cleansed',()=>{
 const s=createBattle('standard','duelist',{singleEnemy:true,seed:8});endRound(s);
 const marked=s.heroes.find(h=>h.attributeBuffs.some(x=>x.id==='mirror_cut'));assert.ok(marked);assert.equal(marked.attributeBuffs[0].turns,2);
 const plan=comboPlan(s,s.boss);assert.ok(plan.after.some(x=>x.label==='循痕返刃'));
 const dirty=structuredClone(s);const r=usePotion(s,marked.id);assert.equal(r.ok,true);assert.ok(!comboPlan(s,s.boss).after.some(x=>x.label==='循痕返刃'));
 assert.ok(endRound(dirty).events.some(x=>x.label==='循痕返刃'));assert.ok(!endRound(s).events.some(x=>x.label==='循痕返刃'));
});
test('combo: control is resolved from the pre-consumption charge and survives save/restore',()=>{
 const s=createBattle('standard','warden',{singleEnemy:true,seed:125});s.boss.intent='ground';s.boss.charge=3;
 const h=s.heroes[0];addAttributeEffect(h,{id:'conductive_brand',label:'导电烙印',stats:{will:-4},turns:3,cleansable:true});
 const saved=normalizeSave(s);assert.ok(saved);const a=endRound(s),b=endRound(saved);assert.deepEqual(a,b);
 assert.ok(a.events.some(e=>/接地麻痹|意志抵抗/.test(e.label)));assert.equal(s.boss.charge,1);
 if(h.control){assert.equal(h.control.fresh,false);assert.match(canUse(s,h.id,activeSkills(s,h.id)[0].id),/眩晕/);}
});
test('combo: a lethal main hit cancels the pre-announced tail instead of retargeting it',()=>{
 const s=createBattle('standard','duelist',{singleEnemy:true});s.boss.intent='mirror';s.boss.mirror=2;
 addAttributeEffect(s.heroes[0],{id:'mirror_cut',label:'刃痕',stats:{agility:-4},turns:3});s.heroes[0].hp=1;
 const r=endRound(s);assert.equal(s.heroes[0].hp,0);assert.ok(!r.events.some(e=>e.label==='循痕返刃'));
});
