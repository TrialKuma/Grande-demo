import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,useSkill,heroOf,endRound} from '../src/combat.js';
import {battleView} from '../src/interface.js';
const render=state=>battleView(state,false,'','00:00');
test('combat HUD moves intent and targeted ally health out of the retired sidebar',()=>{
 const s=createBattle('standard','golem'),before=structuredClone(s),html=render(s);
 assert.match(html,/id="enemy-intents"/);assert.match(html,/data-enemy-intent="boss"/);
 assert.match(html,/data-intent-target="knibbs"/);assert.match(html,/class="tot-health"/);
 assert.doesNotMatch(html,/class="tactics-panel"|class="party-protection"/);assert.deepEqual(s,before);
});
test('shield outline and temporary BUFFs appear and expire with actual combat state',()=>{
 const s=createBattle('standard','golem');useSkill(s,'ric','shelter');useSkill(s,'knibbs','cover');
 let html=render(s);assert.match(html,/class="hp-shield" style="width:18.75%" aria-label="护盾 30"/);
 assert.match(html,/data-detail="cover"/);assert.match(html,/data-detail="protection"/);
 endRound(s);html=render(s);assert.doesNotMatch(html,/data-tooltip="status"[^>]*data-detail="(?:cover|protection)"/);
 assert.equal(heroOf(s,'ric').shield,30);assert.match(html,/class="hp-shield"/);
});
test('each enemy in a group gets its own head intent and target-of-target',()=>{
 const s=createBattle('standard','relay_guard'),html=render(s);
 assert.equal((html.match(/data-enemy-intent=/g)||[]).length,3);
 assert.match(html,/data-intent-target-of="enemy-1"/);assert.match(html,/data-intent-target-of="enemy-2"/);
});
