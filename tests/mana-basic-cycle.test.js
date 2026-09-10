import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,activeSkills,heroOf,resolvedSkill,skillPreview,useSkill,canUse,REWARDS} from '../src/combat.js';
import {createRun,normalizeRun,skillAccessFor} from '../src/campaign.js';
import {normalizeSave} from '../src/save.js';
import {LEARNING_ORDER} from '../src/training.js';

const ids=['haart','qianxing','patch'];
const basic={haart:'page',qianxing:'spike',patch:'keyblade'};
const convert={haart:'rest',qianxing:'repair',patch:'bookward'};
const cashout={haart:'soothe',qianxing:'armor',patch:'chargedslash'};
const oldOrders={knibbs:['shot','focus','breathe','cover','scatter'],apeilia:['blade','purify','reboot','eden','sentinel'],ric:['rune','shelter','bind','mend','crossing'],haart:['page','soothe','anchor','relay','rest'],qianxing:['spike','pulse','armor','beam','repair'],youmu:['scalpel','sterilize','surgery','bloodoath','firstaid'],patch:['keyblade','chargedslash','bookward','fragments','collate']};
const oldDefaults=Object.fromEntries(Object.entries(oldOrders).map(([id,order])=>[id,order.slice(0,4)]));
const fresh=upgrades=>createBattle('standard','final',{partyIds:ids,singleEnemy:true,upgrades});
function setResources(hero,mana,secondary,form='observe'){
 hero.resource=mana;hero.secondary=secondary;hero.records=hero.id==='patch'?secondary:0;hero.patchForm=form;
}
function useWithPreview(state,id,skillId){
 const before=structuredClone(state),preview=skillPreview(state,id,skillId);
 assert.deepEqual(state,before,'preview is read-only');assert.equal(canUse(state,id,skillId),'');
 const result=useSkill(state,id,skillId);assert.equal(result.ok,true);
 const hero=heroOf(state,id);assert.equal(hero.resource,preview.resourceAfter);assert.equal(hero.secondary,preview.secondaryAfter);
 assert.equal(before.ap-state.ap,preview.ap);
 const damage=result.events.filter(event=>event.type==='attack').reduce((sum,event)=>sum+(event.hpLosses?.boss||0),0);
 assert.equal(damage,preview.damage,'displayed selected-enemy damage agrees with HP loss');
 if(id==='patch')assert.equal(hero.records,hero.secondary);
 return {preview,result};
}

test('empty-stock mana basics remain real attacks at zero or full mana and never generate resources',()=>{
 for(const id of ids)for(const mana of [0,4,10])for(const growth of [false,true]){
  const state=fresh(growth?Object.keys(REWARDS):[]),hero=heroOf(state,id);setResources(hero,mana,0);
  state.boss.weakened=1;
  const skill=resolvedSkill(state,id,basic[id]);assert.equal(skill.cost||0,0);assert.equal(skill.secondaryGain||0,0);assert.equal(skill.secondaryCost||0,0);
  assert.ok(skill.damage>0);assert.ok(!skill.manaRecovery&&!skill.manaBackup&&!skill.manaEmergency);
  const {preview,result}=useWithPreview(state,id,basic[id]);
  assert.equal(preview.ap,1);assert.equal(preview.refund,0);assert.equal(hero.resource,mana);assert.equal(hero.secondary,0);
  assert.ok(result.events.some(event=>event.type==='attack'&&event.hpLosses?.boss>0));
 }
});

test('stocked mana basics spend exactly one resource for stronger attacks and a single passive refund',()=>{
 for(const id of ids)for(const form of id==='patch'?['observe','record']:['observe'])for(const stock of [1,id==='haart'?4:id==='qianxing'?3:10])for(const mana of [0,9]){
  const state=fresh(),hero=heroOf(state,id);setResources(hero,mana,stock,form);
  const empty=structuredClone(state);setResources(heroOf(empty,id),mana,0,form);
  const base=skillPreview(empty,id,basic[id]),skill=resolvedSkill(state,id,basic[id]);
  assert.equal(skill.cost||0,0);assert.equal(skill.secondaryCost,1);assert.equal(skill.secondaryGain||0,0);
  const {preview}=useWithPreview(state,id,basic[id]),refund=id==='haart'?3:id==='qianxing'?4:form==='record'?3:2;
  assert.ok(preview.damage>base.damage,`${id}: stocked attack is meaningfully stronger`);
  assert.equal(hero.secondary,stock-1);assert.equal(hero.resource,Math.min(10,mana+refund));
  if(id==='patch')assert.equal(hero.patchForm,'observe');
 }
});

test('each default four-slot mana kit has an explicit paid conversion and a working cash-out',()=>{
 for(const id of ids){
  const state=fresh(),hero=heroOf(state,id),equipped=activeSkills(state,id).map(skill=>skill.id);
  assert.equal(equipped.length,4);assert.ok(equipped.includes(basic[id]));assert.ok(equipped.includes(convert[id]));assert.ok(equipped.includes(cashout[id]));
  const conversion=resolvedSkill(state,id,convert[id]);assert.ok(conversion.cost>0);assert.ok(conversion.secondaryGain>0);
  assert.equal(conversion.secondaryCost||0,0);assert.equal(conversion.damage||0,0);assert.ok((conversion.shield||0)<=8);
  assert.ok(!conversion.manaBackup&&!conversion.manaRecovery);
  useWithPreview(state,id,convert[id]);const mana=hero.resource,stock=hero.secondary;
  const spender=resolvedSkill(state,id,cashout[id]);assert.equal(spender.secondaryCost,1);assert.ok(!spender.manaRecovery&&!spender.manaBackup);
  useWithPreview(state,id,cashout[id]);assert.equal(hero.secondary,stock-1);assert.ok(hero.resource>mana);
 }
});

test('a new two-skill mana lesson includes a conversion followed by a stocked basic cash-out',()=>{
 for(const id of ids){
  const learned=LEARNING_ORDER[id].slice(0,2),state=createBattle('standard','bulwark',{partyIds:[id],singleEnemy:true,skillAccess:{[id]:learned}});
  assert.deepEqual(new Set(learned),new Set([basic[id],convert[id]]));
  useWithPreview(state,id,convert[id]);assert.ok(heroOf(state,id).secondary>0);
  useWithPreview(state,id,basic[id]);assert.ok(state.ap>=0);
 }
});

test('legacy default battle kits migrate without losing HP, AP, mana, stock or chosen targets',()=>{
 const old=fresh();old.loadouts=structuredClone(oldDefaults);delete old.manaRevision;
 old.heroes.forEach((hero,index)=>{hero.hp-=index+5;setResources(hero,index+3,index+1);});
 old.ap=2;old.boss.hp-=37;old.elapsed=18;
 const before=structuredClone(old),restored=normalizeSave(old);assert.ok(restored);assert.deepEqual(old,before);
 assert.equal(restored.manaRevision,1);assert.equal(restored.ap,2);assert.equal(restored.elapsed,18);assert.equal(restored.boss.hp,old.boss.hp);
 for(const id of ids){
  assert.ok(restored.loadouts[id].includes(convert[id]),id);assert.equal(restored.loadouts[id].length,4);
  for(const key of ['hp','resource','secondary'])assert.equal(heroOf(restored,id)[key],heroOf(old,id)[key],`${id}/${key}`);
 }
 assert.deepEqual(normalizeSave(restored),restored,'migration is stable on the next save');
});

test('legacy learning saves preserve previous skills and their in-progress fight while fixing default mana kits',()=>{
 const run=createRun('standard',{seed:12,gmAllHeroes:true});run.learningRevision=2;delete run.manaRevision;
 run.learnedBasics=Object.fromEntries(Object.keys(oldOrders).map(id=>[id,4]));run.loadouts=structuredClone(oldDefaults);
 run.phase='battle';const oldAccess=structuredClone(oldDefaults);
 run.battle=createBattle('standard','scout',{partyIds:['knibbs'],singleEnemy:true,loadouts:oldDefaults,skillAccess:oldAccess});
 run.battle.loadouts=structuredClone(oldDefaults);run.battle.skillAccess=oldAccess;delete run.battle.manaRevision;
 run.battle.heroes[0].hp-=7;run.battle.ap=2;run.battle.elapsed=17;
 const restored=normalizeRun(run);assert.ok(restored);assert.equal(restored.phase,'battle');assert.ok(restored.battle);
 assert.equal(restored.battle.heroes[0].hp,run.battle.heroes[0].hp);assert.equal(restored.battle.ap,2);assert.equal(restored.battle.elapsed,17);
 const learned=skillAccessFor(restored);
 for(const id of ids){
  assert.ok(restored.loadouts[id].includes(convert[id]),id);
  for(const skill of oldDefaults[id])assert.ok(learned[id].includes(skill),`${id} retains ${skill}`);
 }
 assert.deepEqual(normalizeRun(restored),restored,'campaign migration is idempotent');
});

test('migration does not silently replace a custom four-slot mana build or turn a consumer into a converter',()=>{
 const old=fresh(Object.keys(REWARDS));delete old.manaRevision;
 const customs={haart:['page','network','intercept','relay'],qianxing:['spike','nova','lock','beam'],patch:['keyblade','revelation','injunction','fragments']};
 Object.assign(old.loadouts,customs);const restored=normalizeSave(old);assert.ok(restored);
 for(const id of ids){
  assert.deepEqual(restored.loadouts[id],customs[id]);
  for(const skillId of customs[id]){
   const skill=resolvedSkill(restored,id,skillId);assert.equal(skill.secondaryGain||0,0);assert.ok(!skill.manaBackup&&!skill.manaEmergency&&!skill.manaRecovery);
  }
 }
});
