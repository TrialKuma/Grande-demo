import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,HEROES,attackSpec} from '../src/combat.js';
import {battleView} from '../src/interface.js';
import {tooltipView} from '../src/status-details.js';
import {heroJournalView} from '../src/hero-journal.js';
import {bossCodexView} from '../src/boss-codex.js';
import {enemyStatusModels,enemyAttributeBadgesView,enemyIntentTooltipView,enemyIntentModels,enemyIntentBadgeView} from '../src/enemy-intent-ui.js';

test('boss mechanism icons retain zero progress, merge duplicate defenses and resolve their own live hover',()=>{
 for(const [boss,ids] of [['duelist',['mirror','stage']],['tide',['waterLevel','valveHits','stage']],['furnace',['heat','furnaceOpen','stage']],['weaver',['seals','stage']],['final',['barrier','sync','stage']]]){
  const state=createBattle('standard',boss),before=structuredClone(state),models=enemyStatusModels(state.boss,state),html=enemyAttributeBadgesView(state.boss,state);
  for(const id of ids){
   assert.equal(models.filter(model=>model.id===id).length,1,`${boss}/${id}`);
   assert.equal((html.match(new RegExp(`data-enemy-status="${id}"`,'g'))||[]).length,1);
   assert.ok(enemyIntentTooltipView(state,`boss|status|${id}`).includes(models.find(model=>model.id===id).label));
  }
  assert.doesNotMatch(battleView(state,false,'','00:00'),/class="foe-summary"|class="foe-phase"/);
  assert.doesNotMatch(html,/title=|每层|魔法命中|累计三次|<b>/);
  assert.deepEqual(state,before);
 }
 const tide=createBattle('standard','tide');
 assert.match(enemyAttributeBadgesView(tide.boss,tide),/aria-label="阀击 0"/);
 assert.match(enemyIntentTooltipView(tide,'boss|status|valveHits'),/每段攻击计一次.*跨回合保留/);
 tide.boss.waterLevel=4;tide.boss.valveHits=2;
 assert.match(enemyIntentTooltipView(tide,'boss|status|waterLevel'),/4\/4/);assert.match(enemyAttributeBadgesView(tide.boss,tide),/aria-label="阀击 2"/);
});

test('single-hit overhead cues omit the multiplier while multi-hit and pressure detail stay exact',()=>{
 const state=createBattle('standard','warden');state.boss.intent='arc';
 let model=enemyIntentModels(state).find(m=>m.id==='boss');assert.match(enemyIntentBadgeView(model),/×2/);
 state.boss.intent='ground';model=enemyIntentModels(state).find(m=>m.id==='boss');assert.doesNotMatch(enemyIntentBadgeView(model),/×\s*1/);
 const pressure=attackSpec(state).pressure,tip=enemyIntentTooltipView(state,'boss');
 assert.match(tip,new RegExp(`每层使本招每段基础伤害 \\+${pressure.perLayer}`));
 assert.match(tip,new RegExp(`合计 \\+${pressure.damageBonus}`));
});

test('mechanism and secondary hovers have readable paragraphs without duplicated teaching bullets',()=>{
 for(const hero of HEROES){
  const state=createBattle('standard','warden',{partyIds:[hero.id]}),h=heroOf(state,hero.id);
  const passive=tooltipView(state,'status',hero.id,'passive');
  assert.match(passive,h.secondaryName?/mana-recovery/:/tooltip-mechanism/);assert.doesNotMatch(passive,/tooltip-notes|<li>/);
  if(h.secondaryName){
   const secondary=tooltipView(state,'status',hero.id,'secondary');
   assert.ok((secondary.match(/<p(?: |\>)/g)||[]).length>=2);assert.doesNotMatch(secondary,/tooltip-notes|<li>/);
   assert.match(secondary,new RegExp(`当前 0 / ${h.maxSecondary}`));
   const expected={haart:[3,4,5,5],qianxing:[4,5,6],patch:[2,3]}[hero.id];
   for(const html of [passive,secondary]){
    assert.deepEqual([...html.matchAll(/class="mana-recovery-gain[^>]*>\+(\d+)<\/td>/g)].map(match=>Number(match[1])),expected);
    assert.match(html,/每次行动实际消耗.*后，触发一次回魔/);
    assert.match(html,/魔力不随回合恢复；超出魔力上限的回复会损失/);
    if(hero.id==='patch')assert.match(html,/按出手前的姿态结算，与消耗的记录数量无关/);
   }
  }
 }
});

test('portraits, journals and the boss codex show real status effects without fixed four-attribute grids',()=>{
 for(const hero of HEROES){
  const state=createBattle('standard','warden',{partyIds:[hero.id]});
  const portrait=tooltipView(state,'hero',hero.id),journal=heroJournalView({unlockedHeroes:[hero.id],selectedHero:hero.id});
  assert.doesNotMatch(portrait,/<small>(力量|智力|敏捷|意志)<\/small>|控制抵抗 · 强度/);
  assert.doesNotMatch(journal,/<span>(力量|智力|敏捷|意志)<\/span><strong>|控制抵抗 · 强度/);
 }
 const state=createBattle('standard','duelist');
 assert.doesNotMatch(bossCodexView(state),/data-codex-attributes|enemy-attribute-values/);assert.match(bossCodexView(state),/镜甲/);
});
