import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,selectEnemyTarget,useSkill,skillPreview,enemyTargets,heroOf} from '../src/combat.js';
import {battleView} from '../src/interface.js';
import {tooltipView} from '../src/status-details.js';
import {bossCodexView} from '../src/boss-codex.js';
const plain=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');

test('3.9 enemy UI matches the selected unit and previews actual damage without mutating the battle',()=>{
 const state=createBattle('standard','relay_guard'),targets=enemyTargets(state);assert.equal(targets.length,3);
 selectEnemyTarget(state,targets[2].id);const before=structuredClone(state);
 const html=battleView(state,false,'','00:00'),tip=plain(tooltipView(state,'skill','knibbs','shot'));
 for(const target of targets)assert.ok(html.includes(`data-enemy-target="${target.id}"`));
 assert.match(tip,new RegExp(`本次目标 ${targets[2].name}`));assert.deepEqual(state,before);
 const preview=skillPreview(state,'knibbs','shot'),hp=state.enemies[2].hp;useSkill(state,'knibbs','shot');
 assert.equal(hp-state.enemies[2].hp,preview.damage);assert.equal(state.boss.hp,before.boss.hp);
});
test('3.9 AOE is visible before casting and reports each enemy while spending once',()=>{
 const state=createBattle('standard','patrol'),beforeAP=state.ap,beforeResource=heroOf(state,'knibbs').resource;
 const preview=skillPreview(state,'knibbs','scatter'),tip=plain(tooltipView(state,'skill','knibbs','scatter'));
 assert.match(tip,/全体 2 名敌人/);assert.match(tip,/只支付一次/);
 for(const enemy of enemyTargets(state))assert.ok(tip.includes(enemy.name+' · 预计扣血'));
 const result=useSkill(state,'knibbs','scatter');assert.equal(result.ok,true);
 assert.equal(beforeAP-state.ap,preview.ap);assert.equal(beforeResource-heroOf(state,'knibbs').resource,preview.cost);
 assert.ok(state.enemies.every(enemy=>enemy.hp<enemy.maxHp));
});
test('3.9 codex describes the encounter objectives beyond the primary HP bar',()=>{
 for(const id of ['cantor','warden','weaver','patrol','relay_guard']){
  const state=createBattle('standard',id),before=structuredClone(state),html=plain(bossCodexView(state));
  assert.doesNotMatch(html,/undefined|NaN/);assert.deepEqual(state,before);
  assert.match(html,/全部|所有|随从|菌簇|装置|护卫/);
 }
});
