import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,HEROES,heroOf,REWARDS} from '../src/combat.js';
import {battleView} from '../src/interface.js';
import {tooltipView,statusBadges} from '../src/status-details.js';
import {skillGrowth,resourceColor} from '../src/skill-growth-ui.js';
import {effectiveAttributes,attributeEffects} from '../src/attributes.js';

const words=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const render=state=>battleView(state,false,'','00:00',null);

test('mana inventory is always the first status icon, including an empty inventory, and does not split the mana bar',()=>{
 for(const id of ['haart','qianxing','patch']){
  const state=createBattle('standard','warden',{partyIds:[id]}),h=heroOf(state,id),before=structuredClone(state);
  h.secondary=0;
  const badges=statusBadges(state,h),first=badges.match(/^<button[^>]+>/)[0];
  assert.match(first,/data-detail="secondary"/);assert.match(first,/secondary-token/);assert.match(badges,new RegExp(`data-count="0/${h.maxSecondary}"`));
  assert.doesNotMatch(render(state),/class="resource-pair"|class="secondary-resource/);
  assert.match(tooltipView(state,'status',id,'secondary'),new RegExp(h.secondaryName));
  assert.deepEqual(state,before);
 }
 assert.equal(resourceColor(HEROES.find(h=>h.id==='knibbs')),resourceColor(HEROES.find(h=>h.id==='youmu')));
 assert.equal(new Set(HEROES.map(resourceColor)).size,4);
});

test('battle tooltip separates source damage and attributes, uses the actual AP pip count and omits recipient estimates',()=>{
 const state=createBattle('standard','patrol',{partyIds:['qianxing'],upgrades:['qianxing_nova']}),h=heroOf(state,'qianxing');h.secondary=3;
 const html=tooltipView(state,'skill','qianxing','nova'),text=words(html);
 const pips=html.match(/class="tooltip-ap-pips"[\s\S]*?<\/span>/)[0];
 assert.equal((pips.match(/<i><\/i>/g)||[]).length,3);assert.match(pips,/aria-label="消耗 3 AP"/);
 assert.match(text,/基本魔法伤害 43/);assert.doesNotMatch(text,/\(\+9\)/);assert.match(text,/攻击段数 3 段/);
 assert.doesNotMatch(html,/本次目标|预计扣血|预计物理伤害|预计魔法伤害|tooltip-payment|tooltip-notes/);
 assert.match(html,/aria-label="充能 3 → 0"/);
 assert.doesNotMatch(text,/施放时消耗|消耗 3 格充能|以 3 行动点/);
});

test('permanent upgrade stars are separate from conditional empowerment and newly learned skills',()=>{
 const state=createBattle('standard','warden',{partyIds:['apeilia'],upgrades:['apeilia_overture','apeilia_zero','apeilia_puncture'],loadouts:{apeilia:['blade','purify','sentinel','overture']}});
 assert.equal(skillGrowth(state,'apeilia','overture').length,0);
 assert.equal(skillGrowth(state,'apeilia','sentinel').length,2);
 const html=render(state),tip=tooltipView(state,'skill','apeilia','sentinel');
 assert.match(html,/data-upgrade-count="2"[^>]*>★★/);
 for(const id of ['apeilia_zero','apeilia_puncture'])assert.ok(tip.includes(REWARDS[id].name));
 assert.match(tip,/tooltip-growth/);assert.doesNotMatch(tip,/本次目标|预计扣血/);
});

test('temporary attribute changes are inspectable in buffs without adding fixed attribute grids to the portrait',()=>{
 const state=createBattle('standard','warden',{partyIds:['haart']}),h=heroOf(state,'haart');
 Object.assign(h,{protection:55,attackBuff:30,attackBuffTurns:2,attributeBuffs:[{id:'test-focus',label:'专注',stats:{will:4},turns:2}],control:{type:'silence',label:'封术',turns:1},controlGuard:1});
 const before=structuredClone(state),badges=statusBadges(state,h);
 for(const effect of attributeEffects(h)){
  assert.ok(badges.includes(`data-detail="${effect.id}"`));
  const detail=tooltipView(state,'status',h.id,effect.id);assert.ok(detail.includes(effect.label));
  for(const value of Object.values(effect.stats))assert.ok(detail.includes(`+${value}`));
 }
 assert.match(badges,/data-detail="control"/);assert.match(badges,/data-detail="controlGuard"/);
 assert.match(words(tooltipView(state,'status',h.id,'control')),/无法使用魔法攻击.*物理攻击和辅助技能/);
 const portrait=tooltipView(state,'hero',h.id);
 assert.doesNotMatch(portrait,/<small>(力量|智力|敏捷|意志)<\/small>|控制抵抗 · 强度/);
 assert.doesNotMatch(tooltipView(state,'status',h.id,'protection'),/减伤.*%|伤害.*%/);
 assert.deepEqual(state,before);
});
