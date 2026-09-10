import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endRound,useSkill,skillPreview,canUse,SKILLS,attackSpec} from '../src/combat.js';
import {addAttributeEffect,baseAttributes} from '../src/attributes.js';
import {normalizeSave} from '../src/save.js';
import {comboPlan} from '../src/boss-combos.js';
import {enemyIntentModels,enemyIntentTooltipView} from '../src/enemy-intent-ui.js';
import {bossCodexView} from '../src/boss-codex.js';

function frozen(value,seen=new Set()){
 if(!value||typeof value!=='object'||seen.has(value))return value;
 seen.add(value);for(const child of Object.values(value))frozen(child,seen);return Object.freeze(value);
}
const event=(result,label)=>result.events.find(item=>item.label===label);

test('a main-hit reflection opening the core or finale cancels the old heal and preserves a loadable phase',()=>{
 for(const [bossId,key,phase] of [['golem','reclaim','core'],['final','zero_reset','finale']]){
  const state=createBattle('standard',bossId,{partyIds:['patch','knibbs'],singleEnemy:true});
  state.boss.intent=key;state.boss.hp=1;state.boss.intentTarget='patch';
  state.heroes[0].reflect=1;state.heroes[0].resonance=2;
  const result=endRound(state);
  assert.equal(state.boss[phase],true,bossId);assert.equal(state.boss.hp,0,bossId);
  assert.equal(result.events.some(item=>item.type==='heal'&&item.actor==='boss'),false,bossId);
  assert.ok(normalizeSave(state),bossId);
  if(bossId==='final')assert.equal(state.boss.seals,0);
 }
});

test('a stage gained during retaliation cannot add a tail that was absent from the preview',()=>{
 const state=createBattle('standard','golem',{partyIds:['patch','knibbs'],singleEnemy:true});
 state.boss.hp=Math.round(state.boss.maxHp*.8)+1;state.boss.intent='slam';state.boss.intentTarget='patch';state.heroes[0].reflect=1;
 assert.equal(comboPlan(state,state.boss,attackSpec(state)).after.length,0);
 const result=endRound(state);
 assert.equal(state.boss.stage,1);assert.equal(state.boss.charging,true);
 assert.ok(!event(result,'碎岩飞弹'));assert.ok(!event(result,'真空波'));
 assert.ok(normalizeSave(state));
});

test('reflection during the first tail opens the core and cancels later tails and control',()=>{
 const state=createBattle('standard','golem',{partyIds:['knibbs','qianxing','ric'],singleEnemy:true});
 Object.assign(state.boss,{hp:1,stage:3,intent:'compression',fog:2});
 state.heroes[0].resonance=3;state.heroes[1].reflect=1;
 const preview=comboPlan(state,state.boss,attackSpec(state));assert.equal(preview.after.length,3);
 assert.deepEqual(preview.after[0].targets,['qianxing']);
 const result=endRound(state);
 assert.ok(event(result,'碎岩飞弹'));assert.equal(state.boss.core,true);
 assert.ok(!event(result,'真空波'));assert.ok(!result.events.some(item=>/共鸣失衡/.test(item.label)));
 assert.ok(normalizeSave(state));
});

test('a one-use attack enhancement neither strengthens nor gets consumed by retaliation',()=>{
 const state=createBattle('standard','golem',{partyIds:['qianxing'],singleEnemy:true});
 state.heroes[0].reflect=1;const plain=structuredClone(state);
 state.heroes[0].attackBuff=30;state.heroes[0].attackBuffTurns=2;
 const buffedResult=endRound(state),plainResult=endRound(plain);
 assert.equal(event(buffedResult,'钉刺反击').amount,event(plainResult,'钉刺反击').amount);
 assert.equal(state.heroes[0].attackBuff,30);assert.equal(state.heroes[0].attackBuffTurns,1);
 const baseline=structuredClone(state);baseline.heroes[0].attackBuff=0;
 assert.equal(skillPreview(state,'qianxing','spike').damage-skillPreview(baseline,'qianxing','spike').damage,10);
 assert.equal(useSkill(state,'qianxing','spike').ok,true);assert.equal(state.heroes[0].attackBuff,0);
});

test('wound ticks preserve the active-attack charge and do not gain its attributes',()=>{
 const state=createBattle('standard','golem',{partyIds:['youmu'],singleEnemy:true});
 state.boss.dot={damage:10,turns:2,actor:'youmu',kind:'physical'};const plain=structuredClone(state);
 state.heroes[0].attackBuff=30;state.heroes[0].attackBuffTurns=2;
 const buffedResult=endRound(state),plainResult=endRound(plain);
 assert.equal(event(buffedResult,'手术创口').amount,event(plainResult,'手术创口').amount);
 assert.equal(state.heroes[0].attackBuff,30);
});

test('legacy five-slot version-10 battles acquire canonical attributes without losing combat progress',()=>{
 const state=createBattle('standard','warden',{singleEnemy:true});state.version=10;delete state.rngState;
 for(const unit of [...state.heroes,...state.enemies])for(const key of ['attributes','attributeBuffs','control','controlGuard'])delete unit[key];
 for(const [id,skills] of Object.entries(SKILLS))state.loadouts[id]=skills.filter(skill=>!skill.unlockKey).slice(0,5).map(skill=>skill.id);
 state.heroes[0].hp=119;state.boss.hp=state.boss.maxHp-30;
 const restored=normalizeSave(state);assert.ok(restored);
 assert.equal(restored.version,11);assert.equal(restored.heroes[0].hp,119);assert.equal(restored.boss.hp,state.boss.hp);
 assert.ok(Object.values(restored.loadouts).every(skills=>skills.length<=4));
 for(const unit of [...restored.heroes,...restored.enemies]){
  assert.deepEqual(unit.attributes,baseAttributes(unit.id));assert.deepEqual(unit.attributeBuffs,[]);
  assert.equal(unit.control,null);assert.equal(unit.controlGuard,0);
 }
 assert.ok(normalizeSave(restored));
});

test('a real enemy control lasts a whole player turn and recovery protects the following enemy turn',()=>{
 const state=createBattle('standard','warden',{singleEnemy:true,seed:1}),hero=state.heroes[0];
 const arm=()=>{state.boss.intent='ground';state.boss.charge=3;addAttributeEffect(state.boss,{id:'test_pressure',label:'测试减压',stats:{strength:-20},turns:2});addAttributeEffect(hero,{id:'conductive_brand',label:'导电烙印',stats:{will:-4},turns:3,cleansable:true});};
 arm();endRound(state);assert.equal(hero.control?.type,'stun');assert.equal(hero.control.fresh,false);assert.match(canUse(state,hero.id,'shot'),/眩晕/);
 const seed=state.rngState;arm();endRound(state);assert.equal(hero.control,null);assert.equal(hero.controlGuard,1);assert.equal(state.rngState,seed);
 assert.equal(canUse(state,hero.id,'shot'),'');
 arm();endRound(state);assert.equal(hero.control,null);assert.equal(hero.controlGuard,0);assert.equal(state.rngState,seed);
 hero.hp=hero.maxHp;arm();endRound(state);assert.equal(hero.control?.type,'stun');assert.notEqual(state.rngState,seed);
});

test('reading battle, skill and manual previews repeatedly cannot advance a pending control roll',()=>{
 const state=createBattle('standard','weaver',{singleEnemy:true,seed:125});state.boss.intent='silence';
 addAttributeEffect(state.heroes[0],{id:'written_name',label:'被写入的名字',stats:{will:-3,intelligence:-3},turns:3,cleansable:true});
 const original=structuredClone(state),actual=structuredClone(state);frozen(state);
 for(let index=0;index<3;index++){
  enemyIntentModels(state);enemyIntentTooltipView(state,'boss');bossCodexView(state);skillPreview(state,'knibbs','shot');
 }
 assert.deepEqual(state,original);assert.deepEqual(endRound(actual),endRound(original));assert.equal(actual.rngState,original.rngState);
});

test('live combo effects execute in the same target and action order announced by the head model',()=>{
 const state=createBattle('standard','golem',{singleEnemy:true,seed:125});
 Object.assign(state.boss,{stage:3,hp:Math.round(state.boss.maxHp*.35),intent:'compression',fog:2});
 state.heroes[0].resonance=3;addAttributeEffect(state.heroes[0],{id:'test_low_will',label:'意志低落',stats:{will:-20},turns:3});
 const preview=enemyIntentModels(state)[0].combo,result=endRound(state);
 const indexes=preview.after.map(step=>{
  const index=result.events.findIndex(item=>item.label===step.label||item.label.startsWith(step.label+' ·'));
  assert.ok(index>=0,step.label);assert.deepEqual(result.events[index].targets,step.targets);return index;
 });
 assert.deepEqual(indexes,[...indexes].sort((a,b)=>a-b));
 assert.equal(result.events.filter(item=>item.label==='碎岩飞弹').length,1);
 assert.equal(result.events.filter(item=>item.label==='真空波').length,1);
});

test('solo active spells dismantle one final barrier per cast even when repeated or multi-hit',()=>{
 for(const [id,skill] of [['haart','page'],['apeilia','purify']]){
  const state=createBattle('standard','final',{mode:'solo',partyIds:[id],singleEnemy:true});
  for(let cast=1;cast<=2;cast++){
   assert.equal(useSkill(state,id,skill).ok,true);
   assert.equal(state.boss.seals,3-cast,id);assert.equal(state.boss.sync,cast,id);
  }
 }
});

test('solo retaliations and wound ticks never dismantle or synchronize the final barrier',()=>{
 for(const [id,kind,label] of [['qianxing','magic','钉刺反击'],['patch','physical','镜反回击'],['youmu','magic','手术创口']]){
  const state=createBattle('standard','final',{mode:'solo',partyIds:[id],singleEnemy:true});
  state.boss.intent='zero_lance';state.boss.lastKind=kind;
  if(id==='youmu')state.boss.dot={damage:10,turns:2,actor:id,kind:'physical'};
  else state.heroes[0].reflect=1;
  const result=endRound(state);
  assert.ok(event(result,label),label);assert.equal(state.boss.seals,3,label);assert.equal(state.boss.sync,0,label);
 }
});

test('party final barriers still require alternating attack types and count each type change once',()=>{
 const state=createBattle('standard','final',{partyIds:['apeilia','haart','knibbs'],singleEnemy:true});
 assert.equal(useSkill(state,'haart','page').ok,true);assert.equal(state.boss.seals,3);
 assert.equal(useSkill(state,'apeilia','purify').ok,true);assert.equal(state.boss.seals,3);
 assert.equal(useSkill(state,'apeilia','blade').ok,true);assert.equal(state.boss.seals,2);assert.equal(state.boss.sync,1);
 assert.equal(useSkill(state,'apeilia','purify').ok,true);assert.equal(state.boss.seals,1);assert.equal(state.boss.sync,2);
});
