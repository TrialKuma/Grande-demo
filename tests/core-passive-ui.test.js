import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,skillPreview,HEROES} from '../src/combat.js';
import {battleView,helpView} from '../src/interface.js';
import {statusBadges,tooltipView} from '../src/status-details.js';
import {heroJournalView} from '../src/hero-journal.js';
import {enemyStatusModels,enemyIntentTooltipView} from '../src/enemy-intent-ui.js';
import {ammoProfile} from '../src/knibbs-passive.js';

const words=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const card=(state,skill)=>battleView(state,false,'','00:00').match(new RegExp(`<button[^>]*data-owner="knibbs"[^>]*data-skill="${skill}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0]||'';

test('loaded ammunition is always visible, separately from intuition, and explains the live round',()=>{
 const state=createBattle('standard','warden'),h=heroOf(state,'knibbs');
 for(const ammo of ['normal','blast','scatter','breach']){
  h.ammo=ammo;const before=structuredClone(state),badges=statusBadges(state,h),tip=tooltipView(state,'status',h.id,'ammo');
  assert.equal((badges.match(/data-detail="ammo"/g)||[]).length,1);
  assert.equal((badges.match(/data-detail="intuition"/g)||[]).length,1);
  assert.ok(tip.includes(ammoProfile(ammo).name));assert.match(tip,/直感反制不会消耗子弹/);
  if(ammoProfile(ammo).extraHits)assert.match(tip,new RegExp(`${ammoProfile(ammo).extraHits} 段各 ${ammoProfile(ammo).extraDamage}`));
  assert.deepEqual(state,before);
 }
});

test('loading shows its effect, nominal intuition and follow-up forms in both the card and journal',()=>{
 const state=createBattle('standard','warden'),tip=tooltipView(state,'skill','knibbs','loadburst');
 assert.match(card(state,'loadburst'),/聚爆弹 · 追加 1 段/);
 assert.match(card(state,'loadburst'),/data-resource="breath" data-amount="-6"/);
 assert.match(card(state,'loadburst'),/data-resource="intuition" data-amount="3"/);
 assert.match(tip,/追加 1 段各 36/);
 const journal=heroJournalView({selectedHero:'knibbs'});
 for(const text of ['角色特性','聚爆弹','扩散弹','破虚弹','快速装填','重装填'])assert.ok(journal.includes(text),text);
 assert.doesNotMatch(journal,/怎样运用他的能力|每次攻击积攒 1 层直感/);
});

test('heterogeneous bullet hits and intuition are separate from per-hit attributes',()=>{
 const state=createBattle('standard','warden'),h=heroOf(state,'knibbs');h.ammo='scatter';h.intuition=2;
 const preview=skillPreview(state,h.id,'shot'),before=structuredClone(state),tip=words(tooltipView(state,'skill',h.id,'shot'));
 assert.deepEqual(preview.hitDamages,[22,8,8,8,8,8]);
 assert.match(tip,/基本物理伤害 22 \+ 5 × 8/);assert.match(tip,/直感追加伤害 16 独立一次/);assert.match(tip,/攻击段数 6 段/);
 assert.doesNotMatch(tip,/力量 \+12|本次目标|预计伤害|每段.*直感/);assert.deepEqual(state,before);
});

test('real confirmation, quick load, quick shot and reload keep their window and slot feedback in sync',()=>{
 const state=createBattle('standard','warden'),h=heroOf(state,'knibbs');
 assert.equal(useSkill(state,h.id,'focus').ok,true);
 assert.match(statusBadges(state,h),/data-detail="followup"/);assert.match(card(state,'loadburst'),/聚爆快速装填/);
 assert.equal(useSkill(state,h.id,'loadburst').ok,true);assert.match(card(state,'shot'),/快速发射/);
 assert.equal(useSkill(state,h.id,'shot').ok,true);assert.match(card(state,'loadburst'),/重装填/);
 assert.match(tooltipView(state,'status',h.id,'followup'),/可用：重装填/);
 assert.equal(useSkill(state,h.id,'loadburst').ok,true);assert.match(card(state,'loadburst'),/聚爆装填/);
 assert.equal((battleView(state,false,'','00:00').match(/data-skill=/g)||[]).length,12);
});

test('Ric domains project real whole-field values and chaos is a separate once-only status',()=>{
 const state=createBattle('standard','patrol'),h=heroOf(state,'ric');h.resource=-2;h.ricChaos=1;
 const before=structuredClone(state);
 for(const enemy of state.enemies){
  const effect=enemyStatusModels(enemy,state).find(effect=>effect.id==='ric_domain_negative');
  assert.deepEqual(Object.values(effect.stats),[-3,-3,-3,-3]);
  assert.match(enemyIntentTooltipView(state,`${enemy.unitId}|status|ric_domain_negative`),/归零.*正值或倒下/);
 }
 assert.match(statusBadges(state,h),/data-detail="chaos"/);assert.doesNotMatch(statusBadges(state,h),/99轮/);
 assert.match(tooltipView(state,'status',h.id,'chaos'),/先触发的一项消耗/);assert.deepEqual(state,before);
 assert.match(words(tooltipView(state,'skill',h.id,'rune')),/混沌追加伤害 12 独立一次/);
 assert.match(tooltipView(state,'skill',h.id,'crossing'),/攻击结束后翻转平衡，生成下一份混沌/);
 h.resource=0;assert.ok(state.enemies.every(e=>!enemyStatusModels(e,state).some(effect=>effect.id==='ric_domain_negative')));
 h.resource=2;assert.match(tooltipView(state,'status',h.id,'harmony'),/自身力量、智力、敏捷、意志各 \+4/);
 assert.doesNotMatch(statusBadges(state,h),/data-detail="ric_domain_positive"/);
 state.boss.marked=true;assert.ok(enemyStatusModels(state.boss,state).some(effect=>effect.id==='marked'));
});

test('portraits stay concise while surgical preparation has its own persistent tooltip',()=>{
 for(const hero of HEROES){
  const state=createBattle('standard','warden',{partyIds:[hero.id]}),portrait=words(tooltipView(state,'hero',hero.id));
  assert.ok(portrait.length<320,hero.id);assert.doesNotMatch(portrait,/每次行动只|每轮恢复|冷却|每层|触发一次本被动/);
 }
 const state=createBattle('standard','warden',{partyIds:['youmu','knibbs','ric']});
 assert.equal(useSkill(state,'youmu','scalpel').ok,true);
 assert.match(statusBadges(state,'youmu'),/data-detail="surgicalReady"/);
 assert.match(tooltipView(state,'status','youmu','surgicalReady'),/跨回合保留/);
 assert.doesNotMatch(helpView(state),/普通射击补气息|由负向过零.*护盾|过零.*全队回复/);
});
