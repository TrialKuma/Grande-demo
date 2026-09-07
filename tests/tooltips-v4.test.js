import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,heroStatus,HEROES,SKILLS} from '../src/combat.js';
import {tooltipView,statusBadges} from '../src/status-details.js';

const make=(upgrades=[])=>createBattle('standard','warden',{partyIds:['ric','youmu','patch'],upgrades});
const clean=markup=>markup.replace(/<[^>]*>/g,' ');
test('tooltip: Ric portrait and growth charges match +/-10, self shield and physical sword rules',()=>{
 const s=make(['ric_grace','ric_verdict']),h=heroOf(s,'ric');h.resource=-4;useSkill(s,'ric','shelter');
 const portrait=clean(tooltipView(s,'hero','ric')),grace=clean(tooltipView(s,'status','ric','grace')),verdict=clean(tooltipView(s,'status','ric','verdict'));
 assert.match(portrait,/−10 ～ \+10/);assert.match(portrait,/每轮自动向 0 回 2/);assert.match(portrait,/正域剑战/);assert.match(portrait,/负域枪战/);
 assert.match(grace,/自身护盾提高至 38/);assert.match(grace,/平衡 \+4/);assert.match(grace,/2 次剑势/);
 assert.match(verdict,/3 × 24 基础物理伤害/);assert.match(verdict,/平衡 \+2/);assert.match(heroStatus(s,'ric'),/自身 38 护盾/);
 assert.doesNotMatch([portrait,grace,verdict,heroStatus(s,'ric'),statusBadges(s,'ric')].join(' '),/±3|−3 至 \+3|38 群盾|全队护盾提高至 38|三段魔法|清账之符|咒符 · 回响/);
});
test('tooltip: Ric self cleanse never claims it cleanses the whole party',()=>{
 const s=make(),self=clean(tooltipView(s,'skill','ric','shelter')),team=clean(tooltipView(s,'skill','ric','mend'));
 assert.match(self,/自身共鸣 −1/);assert.doesNotMatch(self,/全队共鸣 −1/);assert.match(team,/全队共鸣 −2/);
});
test('tooltip: both new portraits explain their actual loops and payment restrictions',()=>{
 const s=make(),youmu=clean(tooltipView(s,'hero','youmu')),patch=clean(tooltipView(s,'hero','patch'));
 assert.match(youmu,/手术刀建立准备/);assert.match(youmu,/生命不高于 40%/);assert.match(youmu,/虚脱两轮/);assert.match(youmu,/每轮恢复 2/);
 assert.match(patch,/每实际支付 2 魔力积累 1 记录/);assert.match(patch,/足额支付魔力与行动点/);assert.match(patch,/魔力不足时，即使满记录也不能施放/);
 const ward=clean(tooltipView(s,'status','patch','archiveward'));assert.match(ward,/28 基础魔法伤害/);assert.match(ward,/返还 2 魔力/);assert.match(ward,/不叠加次数/);
});
test('tooltip: displayed dynamic spell names, types and resource costs come from resolved skill data',()=>{
 const s=make(),p=heroOf(s,'patch');p.records=3;
 const attack=clean(tooltipView(s,'skill','patch','chargedslash'));assert.match(attack,/充能斩 · 断光/);assert.match(attack,/魔法攻击/);assert.match(attack,/2 × 25 魔法伤害/);assert.match(attack,/消耗魔力\s+2/);assert.doesNotMatch(attack,/预计物理伤害|消耗记录/);
 const y=heroOf(s,'youmu');y.hp=60;assert.equal(useSkill(s,'youmu','bloodoath').ok,true);
 const captain=clean(tooltipView(s,'skill','youmu','bloodoath'));assert.match(captain,/沉渊炼狱号/);assert.match(captain,/游墓 · 魔法攻击/);assert.match(captain,/3 × 48 魔法伤害/);assert.match(captain,/提前|立即结束/);
});
test('tooltip: every new conditional reward is linked to all skills it can affect',()=>{
 const s=make(['youmu_transplant','youmu_resolve','patch_precision','patch_archive']);
 for(const [hero,skill,reward]of [['youmu','surgery','外科 · 无菌移植'],['youmu','bloodoath','血誓 · 护住这具身体'],['patch','chargedslash','书记官 · 精确计时'],['patch','fragments','书记官 · 精确计时'],['patch','revelation','书记官 · 精确计时'],['patch','bookward','收录 · 厚页书阵'],['patch','chargedslash','收录 · 厚页书阵']])assert.ok(tooltipView(s,'skill',hero,skill).includes(reward),`${hero}/${skill}: ${reward}`);
 assert.ok(!tooltipView(s,'skill','patch','collate').includes('持有成长与触发条件'));
});
test('tooltip: specimen and ship explanations retain the actual whitelist, duration and downside',()=>{
 const s=make(),y=heroOf(s,'youmu');y.specimen='charge';
 const specimen=clean(tooltipView(s,'status','youmu','specimen'));assert.match(specimen,/蓄电/);assert.match(specimen,/2 气息与 2 AP/);assert.match(specimen,/不能移植 BOSS 阶段或控制免疫/);
 const passive=clean(tooltipView(s,'status','youmu','surgeon'));assert.match(passive,/仍可能倒下/);assert.match(passive,/承伤 \+20%/);assert.match(passive,/每战一次/);
});
test('tooltip: all seven heroes and their full skill library render without changing combat state',()=>{
 for(const h of HEROES){const s=createBattle('standard','golem',{partyIds:[h.id,...HEROES.filter(p=>p.id!==h.id).slice(0,2).map(p=>p.id)]}),before=structuredClone(s);
  const blocks=[tooltipView(s,'hero',h.id),tooltipView(s,'status',h.id,'passive'),statusBadges(s,h.id),...SKILLS[h.id].map(k=>tooltipView(s,'skill',h.id,k.id))];
  assert.ok(blocks.every(text=>text.length>0));assert.doesNotMatch(blocks.join(' '),/undefined|NaN/);assert.deepEqual(s,before);
 }
});
