import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,resolvedSkill,skillPreview,useSkill} from '../src/combat.js';
import {battleView} from '../src/interface.js';
import {tooltipView,statusBadges} from '../src/status-details.js';
import {heroJournalView} from '../src/hero-journal.js';
import {RESOURCE_SYMBOLS,resourceSymbol,skillResourceDeltas} from '../src/resource-ui.js';
import {icon} from '../src/icons.js';

const words=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const card=(state,id,skill)=>battleView(state,false,'','00:00').match(new RegExp(`<button[^>]*data-owner="${id}"[^>]*data-skill="${skill}"[^>]*>[\\s\\S]*?<\\/button>`))[0];
const receipt=(state,id,skill)=>skillResourceDeltas(state,heroOf(state,id),resolvedSkill(state,id,skill),skillPreview(state,id,skill));

test('the four primary resources and three secondary inventories use seven distinct vector symbols',()=>{
 const kinds=['breath','combo','mana','balance','mindline','charge','record'];
 assert.equal(new Set(kinds.map(kind=>icon(RESOURCE_SYMBOLS[kind].symbol))).size,7);
 for(const id of ['haart','qianxing','patch']){
  const state=createBattle('standard','warden',{partyIds:[id]}),h=heroOf(state,id),badges=statusBadges(state,h);
  assert.ok(badges.includes(icon(resourceSymbol(h,true))));
  assert.match(badges,/^<button[^>]*data-detail="secondary"/);
 }
});

test('full-resource recovery shows its full yield and retains its capped before-after preview',()=>{
 const state=createBattle('standard','warden',{loadouts:{knibbs:['shot','focus','loadburst','breathe']}}),h=heroOf(state,'knibbs'),before=structuredClone(state);
 const skill=resolvedSkill(state,'knibbs','breathe'),html=card(state,'knibbs','breathe'),tip=tooltipView(state,'skill','knibbs','breathe');
 assert.match(html,new RegExp(`data-resource="breath" data-amount="${skill.gain}"`));
 assert.match(tip,new RegExp(`aria-label="回复 ${skill.gain} 气息"`));assert.match(tip,/aria-label="气息 10 → 10"/);
 assert.equal(receipt(state,'knibbs','breathe').find(d=>d.kind==='breath').amount,skill.gain);
 assert.deepEqual(state,before);
 assert.equal(useSkill(state,'knibbs','breathe').ok,true);assert.equal(h.resource,10);
});

test('insufficient resources keep exact cost icons visible without replacing the row with error prose',()=>{
 const state=createBattle('standard','warden'),h=heroOf(state,'knibbs');h.resource=0;state.ap=1;
 const html=card(state,'knibbs','focus'),tip=tooltipView(state,'skill','knibbs','focus');
 assert.match(html,/class="resource-delta[^\"]*is-insufficient[^\"]*"[^>]*data-resource="ap" data-amount="-2"/);
 assert.match(html,/class="resource-delta[^\"]*is-insufficient[^\"]*"[^>]*data-resource="breath" data-amount="-2"/);
 assert.match(html,/aria-label="消耗 2 气息，当前 0"/);assert.doesNotMatch(words(html),/不足|需要|气息|AP/);
 assert.match(tip,/data-insufficient="true"/);assert.doesNotMatch(words(tip),/不足|需要|当前不可施放/);
});

test('dedicated conversion commands disclose both nominal sides outside the hover',()=>{
 for(const [id,skill,secondary,cost,gain] of [['haart','rest','mindline',8,4],['qianxing','repair','charge',9,3],['patch','bookward','record',4,3]]){
  const state=createBattle('standard','warden',{partyIds:[id]}),html=card(state,id,skill),before=structuredClone(state);
  assert.match(html,new RegExp(`data-resource="mana" data-amount="-${cost}"`));
  assert.match(html,new RegExp(`data-resource="${secondary}" data-amount="${gain}"`));assert.match(html,/resource-conversion-arrow/);
  assert.doesNotMatch(words(html),/魔力|念线|充能|记录|不足|需要/);assert.deepEqual(state,before);
 }
});

test('mana basics stay free at zero stock and visibly spend one secondary resource when empowered',()=>{
 for(const [id,skill,secondary,refund] of [['haart','page','mindline',3],['qianxing','spike','charge',4],['patch','keyblade','record',2]]){
  const state=createBattle('standard','warden',{partyIds:[id]}),h=heroOf(state,id);
  h.resource=0;assert.deepEqual(receipt(state,id,skill).map(d=>d.kind),['ap']);assert.equal(useSkill(state,id,skill).ok,true);
  h.secondary=1;h.resource=10;const before=structuredClone(state),html=card(state,id,skill),tip=tooltipView(state,'skill',id,skill);
  assert.match(html,/· 强化/);assert.match(html,new RegExp(`data-resource="${secondary}" data-amount="-1"`));
  assert.match(html,new RegExp(`data-resource="mana" data-amount="${refund}"`));assert.match(tip,/aria-label="魔力 10 → 10"/);
  assert.doesNotMatch(words(tip),/使用一份二级资源|消耗 1 (?:念线|充能|记录)/);
  assert.deepEqual(state,before);assert.equal(useSkill(state,id,skill).ok,true);assert.equal(h.secondary,0);assert.equal(h.resource,10);
  const journal=heroJournalView({unlockedHeroes:[id],selectedHero:id});assert.match(journal,/持有至少 1 .*时自动强化/);
 }
});

test('an unavailable cashout displays its full future refund as well as the missing stock requirement',()=>{
 const state=createBattle('standard','warden',{partyIds:['qianxing']}),h=heroOf(state,'qianxing');h.secondary=0;h.resource=10;
 const html=card(state,'qianxing','beam'),tip=tooltipView(state,'skill','qianxing','beam');
 assert.match(html,/is-insufficient[^>]*data-resource="charge" data-amount="-2"/);
 assert.match(html,/data-resource="mana" data-amount="5"/);assert.match(tip,/data-resource="mana" data-amount="5"/);
 assert.doesNotMatch(words(html),/不足|转化技能|逆向提炼/);assert.doesNotMatch(words(tip),/不足|先使用转化/);
});

test('alternation gains remain visible at the combo cap and balance changes keep their direction',()=>{
 const state=createBattle('standard','warden'),a=heroOf(state,'apeilia'),r=heroOf(state,'ric');a.resource=10;a.lastKind='magic';
 assert.equal(receipt(state,'apeilia','blade').find(d=>d.kind==='combo').amount,3);
 assert.match(card(state,'apeilia','blade'),/data-resource="combo" data-amount="3"/);
 r.resource=6;state.loadouts.ric[3]='crossing';
 assert.equal(receipt(state,'ric','crossing').find(d=>d.kind==='balance').amount,-12);
 assert.match(card(state,'ric','crossing'),/data-resource="balance" data-amount="-12"/);
 const html=battleView(state,false,'','00:00');assert.match(html,/side-negative/);assert.match(html,/side-positive/);assert.match(html,/side-zero/);
});
