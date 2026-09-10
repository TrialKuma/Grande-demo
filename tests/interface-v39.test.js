import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,selectEnemyTarget,useSkill,skillPreview,enemyTargets,heroOf} from '../src/combat.js';
import {battleView} from '../src/interface.js';
import {tooltipView} from '../src/status-details.js';
import {bossCodexView} from '../src/boss-codex.js';
const plain=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');

test('3.9 enemy UI matches the selected unit and shows source damage without mutating the battle',()=>{
 const state=createBattle('standard','relay_guard'),targets=enemyTargets(state);assert.equal(targets.length,3);
 selectEnemyTarget(state,targets[2].id);const before=structuredClone(state);
 const html=battleView(state,false,'','00:00'),tip=plain(tooltipView(state,'skill','knibbs','shot'));
 for(const target of targets)assert.ok(html.includes(`data-enemy-target="${target.id}"`));
 assert.doesNotMatch(tip,/本次目标|预计扣血/);assert.match(tip,/基本物理伤害/);assert.deepEqual(state,before);
 const preview=skillPreview(state,'knibbs','shot'),hp=state.enemies[2].hp;useSkill(state,'knibbs','shot');
 assert.equal(hp-state.enemies[2].hp,preview.damage);assert.equal(state.boss.hp,before.boss.hp);
});
test('3.9 AOE is visible before casting and keeps source stats independent of recipient estimates while spending once',()=>{
 const state=createBattle('standard','patrol',{loadouts:{apeilia:['blade','purify','eden','sentinel']}});heroOf(state,'apeilia').resource=6;const beforeAP=state.ap,beforeResource=heroOf(state,'apeilia').resource;
 const preview=skillPreview(state,'apeilia','sentinel'),tip=plain(tooltipView(state,'skill','apeilia','sentinel'));
 assert.match(tip,/魔法攻击 · 全体/);assert.match(tip,/基本魔法伤害/);
 for(const enemy of enemyTargets(state))assert.ok(!tip.includes(enemy.name+' · 预计扣血'));
 const result=useSkill(state,'apeilia','sentinel');assert.equal(result.ok,true);
 assert.equal(beforeAP-state.ap,preview.ap);assert.equal(beforeResource-heroOf(state,'apeilia').resource,preview.cost);
 assert.ok(state.enemies.every(enemy=>enemy.hp<enemy.maxHp));
});
test('3.9 codex describes the encounter objectives beyond the primary HP bar',()=>{
 for(const id of ['cantor','warden','weaver','patrol','relay_guard']){
  const state=createBattle('standard',id),before=structuredClone(state),html=plain(bossCodexView(state));
  assert.doesNotMatch(html,/undefined|NaN/);assert.deepEqual(state,before);
  assert.match(html,/全部|所有|随从|菌簇|装置|护卫/);
 }
});
