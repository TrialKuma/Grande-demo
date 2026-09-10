import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,BOSSES} from '../src/combat.js';
import {bossCodexView} from '../src/boss-codex.js';
import {enemyIntentTooltipView} from '../src/enemy-intent-ui.js';
import {attributeEffects} from '../src/attributes.js';

test('every formal boss manual describes its chain, actual buffs, and four-slot rules without fixed attribute grids',()=>{
 for(const boss of Object.values(BOSSES).filter(boss=>!boss.isTutorial&&!boss.isSkirmish&&!boss.isMinion)){
  const state=createBattle('standard',boss.id),before=structuredClone(state),html=bossCodexView(state);
  assert.doesNotMatch(html,/data-codex-attributes|enemy-attribute-values/);
  assert.match(html,/连招与反制/);assert.match(html,/每个角色装配四项技能/);
  for(const effect of attributeEffects(state.boss).filter(effect=>Object.values(effect.stats||{}).some(Boolean)))assert.ok(html.includes(effect.label));
  assert.deepEqual(state,before);
 }
});

test('manual displays live additive layer defenses and enemy debuffs',()=>{
 const state=createBattle('standard','duelist');state.boss.mirror=2;
 state.boss.attributeBuffs=[{id:'stiffness',label:'关节僵硬',stats:{agility:-4},turns:2}];
 const html=bossCodexView(state);
 assert.doesNotMatch(html,/data-codex-attributes|enemy-attribute-values/);assert.match(html,/镜甲<\/b> 敏捷 \+6/);assert.match(html,/关节僵硬/);assert.match(html,/敏捷 −4 · 2 轮/);
 assert.match(html,/每片使敏捷 \+3/);assert.match(html,/净化刃痕/);
});

test('obsolete percentage armor and healing suppression claims are absent from formal manuals',()=>{
 for(const id of ['golem','duelist','cantor','weaver','furnace','final']){
  const html=bossCodexView(createBattle('standard',id));
  assert.doesNotMatch(html,/普通魔法伤害降低 18%|每片降低 10%|魔法伤害减少 30%|攻击减伤 45%|受到伤害增加 30%|每层使所有伤害降低 12%|敌人承伤 \+20%|治疗抑制会进一步减半/);
 }
});

test('the first tutorial teaches spending breath before breathing recovery tools',()=>{
 const html=bossCodexView(createBattle('standard','scout',{partyIds:['knibbs']}));
 assert.match(html,/先用单发确认消耗气息，再用直感发射补充气息/);
 assert.doesNotMatch(html,/攻击之间使用整息装填/);
});

test('the final manual and head tooltip explain the solo barrier exception without party alternation',()=>{
 const state=createBattle('standard','final',{mode:'solo',partyIds:['haart'],singleEnemy:true});
 const html=bossCodexView(state),tooltip=enemyIntentTooltipView(state,'boss');
 assert.match(html,/独狼同步/);assert.match(html,/每次主动攻击技能拆 1 层屏障，不限制攻击属性/);
 assert.match(html,/多段技能只计一次；反击与持续伤害不额外拆层/);
 assert.match(tooltip,/每次主动攻击技能拆 1 层屏障并增加 1 同步/);
 assert.match(tooltip,/多段只计一次，反击与持续伤害不额外拆层/);
});
