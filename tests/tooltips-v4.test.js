import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,heroStatus,HEROES,SKILLS} from '../src/combat.js';
import {tooltipView,statusBadges} from '../src/status-details.js';

const make=(upgrades=[])=>createBattle('standard','warden',{partyIds:['ric','youmu','patch'],upgrades});
const clean=markup=>markup.replace(/<[^>]*>/g,' ');
test('tooltip: Ric portrait and growth charges match +/-10, self shield and physical sword rules',()=>{
 const s=make(['ric_grace','ric_verdict']),h=heroOf(s,'ric');h.resource=-2;useSkill(s,'ric','shelter');
 const portrait=clean(tooltipView(s,'hero','ric')),grace=clean(tooltipView(s,'status','ric','grace')),verdict=clean(tooltipView(s,'status','ric','verdict'));
 assert.match(portrait,/−10 ～ \+10/);assert.match(portrait,/正域强化自身/);assert.match(portrait,/负域压制全场敌人/);assert.match(portrait,/混沌/);assert.doesNotMatch(portrait,/每轮自动向 0 回 2/);
 assert.match(grace,/自身护盾提高至 38/);assert.match(grace,/平衡 \+4/);assert.match(grace,/2 次剑势/);
 assert.match(verdict,/3 × 24 基础物理伤害/);assert.match(verdict,/平衡 \+2/);assert.equal(h.grace,true);assert.equal(h.verdict,true);
 assert.doesNotMatch([portrait,grace,verdict,heroStatus(s,'ric'),statusBadges(s,'ric')].join(' '),/±3|−3 至 \+3|38 群盾|全队护盾提高至 38|三段魔法|清账之符|咒符 · 回响/);
});
test('tooltip: Ric self cleanse never claims it cleanses the whole party and group cleanse matches actual targets',()=>{
 const s=make(),self=clean(tooltipView(s,'skill','ric','shelter')),team=clean(tooltipView(s,'skill','ric','mend'));
 assert.match(self,/清除自身的 1 层共鸣/);assert.doesNotMatch(self,/清除所有存活队员的 1 层共鸣/);assert.match(team,/清除所有存活队员的 1 层共鸣/);
 s.heroes.forEach(h=>h.resonance=3);assert.equal(useSkill(s,'ric','shelter').ok,true);
 assert.deepEqual(s.heroes.map(h=>h.resonance),[2,3,3]);assert.equal(useSkill(s,'ric','mend').ok,true);assert.deepEqual(s.heroes.map(h=>h.resonance),[1,2,2]);
});
test('tooltip: both new portraits explain their actual loops and payment restrictions',()=>{
 const s=make(),youmu=clean(tooltipView(s,'hero','youmu')),patch=clean(tooltipView(s,'hero','patch'));
 assert.match(youmu,/手术准备.*保存标本/);assert.match(youmu,/请游墓接管/);assert.doesNotMatch(youmu,/虚脱两轮|每轮回复 2|40%/);
 assert.match(patch,/销毁记录时回魔/);assert.match(patch,/观测偏进攻，收录偏干扰/);assert.doesNotMatch(patch,/固定恢复 2 魔力/);assert.doesNotMatch(patch,/魔力不足时，即使满记录也不能施放/);
 assert.equal(tooltipView(s,'status','patch','archiveward'),'');
 const ward=clean(tooltipView(s,'skill','patch','bookward'));assert.match(ward,/为自己提供 8 点护盾/);assert.match(ward,/独立持续 2 次敌方回合/);assert.match(tooltipView(s,'skill','patch','bookward'),/aria-label="记录 0 → 3"/);assert.doesNotMatch(ward,/返还 2 魔力并回击|破盾.*回魔/);
});
test('tooltip: displayed dynamic spell names, types and resource costs come from resolved skill data',()=>{
 const s=make(),p=heroOf(s,'patch');p.secondary=3;
 const attack=clean(tooltipView(s,'skill','patch','chargedslash'));assert.match(attack,/充能斩/);assert.match(attack,/物理攻击/);assert.match(attack,/基本物理伤害\s+40/);assert.doesNotMatch(attack,/\(\+6\)/);assert.match(tooltipView(s,'skill','patch','chargedslash'),/aria-label="记录 3 → 2"/);assert.match(tooltipView(s,'skill','patch','chargedslash'),/aria-label="魔力 10 → 10"/);assert.doesNotMatch(attack,/预计魔法伤害|消耗魔力/);
 const y=heroOf(s,'youmu');y.hp=60;assert.equal(useSkill(s,'youmu','bloodoath').ok,true);
 const captain=clean(tooltipView(s,'skill','youmu','bloodoath'));assert.match(captain,/沉渊炼狱号/);assert.match(captain,/游墓 · 魔法攻击/);assert.match(captain,/基本魔法伤害\s+48\s+\(-5\)/);assert.match(captain,/提前|立即结束/);
});
test('tooltip: every new conditional reward is linked to all skills it can affect',()=>{
 const s=make(['youmu_transplant','youmu_resolve','patch_precision','patch_archive']);
 for(const [hero,skill,reward]of [['youmu','surgery','外科 · 无菌移植'],['youmu','bloodoath','血誓 · 护住这具身体'],['patch','fragments','书记官 · 精确计时'],['patch','revelation','书记官 · 精确计时'],['patch','bookward','收录 · 厚页书阵']])assert.ok(tooltipView(s,'skill',hero,skill).includes(reward),`${hero}/${skill}: ${reward}`);
 assert.ok(!tooltipView(s,'skill','patch','chargedslash').includes('书记官 · 精确计时'));
 assert.ok(!tooltipView(s,'skill','patch','chargedslash').includes('收录 · 厚页书阵'));
 assert.ok(!tooltipView(s,'skill','patch','collate').includes('持有成长与触发条件'));
});
test('tooltip: specimen and ship explanations retain the actual whitelist, duration and downside',()=>{
 const s=make(),y=heroOf(s,'youmu');y.specimen='charge';
 const specimen=clean(tooltipView(s,'status','youmu','specimen'));assert.match(specimen,/蓄电/);assert.match(specimen,/2 气息与 2 AP/);assert.match(specimen,/不能移植 BOSS 阶段或控制免疫/);
 const passive=clean(tooltipView(s,'status','youmu','surgeon'));assert.match(passive,/虚脱两轮/);assert.match(passive,/每战可用一次/);assert.doesNotMatch(tooltipView(s,'status','youmu','surgeon'),/tooltip-notes/);
});
test('tooltip: all seven heroes and their full skill library render without changing combat state',()=>{
 for(const h of HEROES){const s=createBattle('standard','golem',{partyIds:[h.id,...HEROES.filter(p=>p.id!==h.id).slice(0,2).map(p=>p.id)]}),before=structuredClone(s);
  const blocks=[tooltipView(s,'hero',h.id),tooltipView(s,'status',h.id,'passive'),statusBadges(s,h.id),...SKILLS[h.id].map(k=>tooltipView(s,'skill',h.id,k.id))];
  assert.ok(blocks.every(text=>text.length>0));assert.doesNotMatch(blocks.join(' '),/undefined|NaN/);assert.deepEqual(s,before);
 }
});
