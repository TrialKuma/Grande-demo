import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf} from '../src/combat.js';
import {tooltipView,skillExplanation} from '../src/status-details.js';
import {heroJournalView} from '../src/hero-journal.js';

const words=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const recovery=html=>html.match(/<section class="mana-recovery[^>]*>[\s\S]*?<\/section>/)?.[0]||'';
const refunds=html=>[...recovery(html).matchAll(/class="mana-recovery-gain[^>]*>\+(\d+)<\/td>/g)].map(match=>Number(match[1]));
const journalSkill=(html,id)=>html.match(new RegExp(`<article[^>]*data-journal-skill="${id}"[^>]*>[\\s\\S]*?<\\/article>`))?.[0]||'';

test('the journal and secondary BUFF expose every refund bracket and its actual trigger',()=>{
 for(const [id,expected]of [['haart',[3,4,5,5]],['qianxing',[4,5,6]],['patch',[2,3]]]){
  const state=createBattle('standard','warden',{partyIds:[id]}),before=structuredClone(state);
  const views=[heroJournalView({unlockedHeroes:[id],selectedHero:id}),tooltipView(state,'status',id,'secondary')];
  for(const html of views){
   assert.deepEqual(refunds(html),expected);
   const text=words(recovery(html));
   assert.match(text,/每次行动实际消耗.*后，触发一次回魔/);
   assert.match(text,/多段命中和反击不重复触发/);
   assert.match(text,/普通攻击在没有库存时不回魔/);
   assert.match(text,/持有库存时自动使用一份强化，并触发回魔/);
   assert.match(text,/魔力不随回合恢复/);assert.match(text,/超出魔力上限的回复会损失/);
   if(id==='patch'){assert.match(text,/出手前姿态 观测 收录/);assert.match(text,/与消耗的记录数量无关/);assert.match(text,/钥刃在回魔后切换到观测/);}
  }
  assert.deepEqual(state,before);
 }
});

test('skill hovers disclose nominal refunds at full mana for large and stance-dependent cashouts',()=>{
 for(const [id,skill,stock,form,kind,refund,upgrade]of [
  ['haart','network',4,undefined,'mindline',5,'haart_network'],
  ['qianxing','beam',3,undefined,'charge',6],
  ['patch','revelation',10,'observe','record',2,'patch_revelation'],
  ['patch','revelation',10,'record','record',3,'patch_revelation'],
 ]){
  const state=createBattle('standard','warden',{partyIds:[id],upgrades:upgrade?[upgrade]:[]}),h=heroOf(state,id);
  Object.assign(h,{resource:10,secondary:stock,...(form?{patchForm:form}:{})});
  const before=structuredClone(state),html=tooltipView(state,'skill',id,skill),explanation=skillExplanation(state,id,skill);
  assert.match(html,new RegExp(`data-resource="${kind}" data-amount="-${stock}"`));
  assert.match(html,new RegExp(`is-gain[^>]*data-resource="mana" data-amount="${refund}"`));
  assert.match(html,/aria-label="魔力 10 → 10"/);assert.doesNotMatch(html,/<small>\/ /);
  assert.match(explanation.recovery,new RegExp(`回复 ${refund} 魔力，只结算一次`));
  assert.match(recovery(html),/is-current/);
  if(form)assert.match(explanation.recovery,new RegExp(`出手前的${form==='record'?'收录':'观测'}姿态`));
  assert.deepEqual(state,before);
 }
});

test('basic hovers distinguish zero-stock attacks from one-stock attacks and preserve Patch timing',()=>{
 for(const [id,skill,kind,refund]of [['haart','page','mindline',3],['qianxing','spike','charge',4],['patch','keyblade','record',3]]){
  const state=createBattle('standard','warden',{partyIds:[id]}),h=heroOf(state,id);h.patchForm='record';
  const plain=tooltipView(state,'skill',id,skill);
  assert.doesNotMatch(plain,/data-resource="mana" data-amount="[1-9]/);
  assert.match(words(plain),/空库存普攻不回魔；有库存耗1强化并回魔/);
  h.secondary=1;const before=structuredClone(state),enhanced=tooltipView(state,'skill',id,skill);
  assert.match(enhanced,new RegExp(`data-resource="${kind}" data-amount="-1"`));
  assert.match(enhanced,new RegExp(`data-resource="mana" data-amount="${refund}"`));
  assert.deepEqual(state,before);
 }
});

test('optional journal skills and conditional variants give exact refunds without a missing-reference instruction',()=>{
 const haart=heroJournalView({unlockedHeroes:['haart'],selectedHero:'haart'});
 assert.match(words(journalSkill(haart,'network')),/回复 5 魔力，只结算一次/);
 assert.match(words(journalSkill(haart,'intercept')),/尝试封锁敌人的下一次普通行动，须通过目标的意志抵抗判定/);
 const qian=heroJournalView({unlockedHeroes:['qianxing'],selectedHero:'qianxing'});
 assert.match(words(journalSkill(qian,'beam')),/回复 5 魔力，只结算一次/);
 assert.match(words(journalSkill(qian,'beam')),/回复 6 魔力，只结算一次/);
 const patch=heroJournalView({unlockedHeroes:['patch'],selectedHero:'patch'});
 for(const id of ['keyblade','chargedslash','revelation']){
  const text=words(journalSkill(patch,id));
  assert.match(text,/回复 2 魔力，只结算一次/);assert.match(text,/回复 3 魔力，只结算一次/);
  assert.match(text,/按出手前的收录姿态结算/);
 }
 for(const html of [haart,qian,patch])assert.doesNotMatch(words(html),/回魔规则见角色被动/);
});

test('Haart insight describes its independent agility effect after HP damage without promising a weak mark',()=>{
 const state=createBattle('standard','warden',{partyIds:['haart'],upgrades:['haart_insight']}),h=heroOf(state,'haart');
 h.secondary=2;state.boss.weakened=1;
 const before=structuredClone(state),text=words(tooltipView(state,'skill','haart','relay'));
 assert.match(text,/造成生命损失后施加破绽提醒：目标敏捷 −8/);
 assert.match(text,/持续至本次敌方回合结束/);assert.doesNotMatch(text,/施加弱者标记/);
 assert.deepEqual(state,before);
});
