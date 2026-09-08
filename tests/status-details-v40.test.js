import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,endRound,HEROES,SKILLS,skillPreview,enemyTargets} from '../src/combat.js';
import {tooltipView,statusBadges,skillExplanation} from '../src/status-details.js';

const words=markup=>markup.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const cast=(state,hero,id)=>assert.equal(useSkill(state,hero,id).ok,true,`${hero}/${id}`);
const token=(state,hero,id)=>statusBadges(state,hero).match(new RegExp(`<button[^>]*data-detail="${id}"[^>]*>[\\s\\S]*?<\\/button>`))?.[0]||'';

test('battle skills and portraits omit teaching lists while status details and the journal retain guidance',()=>{
 for(const hero of HEROES){
  const state=createBattle('standard','golem',{partyIds:[hero.id,...HEROES.filter(h=>h.id!==hero.id).slice(0,2).map(h=>h.id)]});
  const before=structuredClone(state);
  for(const skill of SKILLS[hero.id]){
   const html=tooltipView(state,'skill',hero.id,skill.id);
   assert.doesNotMatch(html,/tooltip-notes|预计值已计入当前抗性|持有成长与触发条件|多段逐次计算层数变化/);
   assert.match(html,/本次行动点/);assert.doesNotMatch(html,/undefined|NaN/);
  }
  assert.doesNotMatch(tooltipView(state,'hero',hero.id),/tooltip-notes|点击头像|尚未获得成长奖励/);
  if(hero.id==='ric')for(const skill of SKILLS.ric)assert.doesNotMatch(tooltipView(state,'skill','ric',skill.id),/不直接消耗平衡/);
  assert.match(tooltipView(state,'status',hero.id,'passive'),/tooltip-notes/);
  assert.deepEqual(state,before);
 }
 const state=createBattle('standard','golem');
 assert.ok(skillExplanation(state,'knibbs','focus').conditions.some(text=>text.includes('直感')));
 assert.ok(skillExplanation(state,'apeilia','blade').conditions.some(text=>text.includes('交替')));
});

test('prepared enemy effects appear on their own caster, name the target and expire after real enemy actions',()=>{
 const state=createBattle('standard','patrol',{partyIds:['knibbs','haart','patch']});
 cast(state,'knibbs','cover');cast(state,'haart','page');cast(state,'haart','soothe');cast(state,'patch','bookward');cast(state,'patch','chargedslash');
 const target=enemyTargets(state).find(enemy=>enemy.id==='boss').name;
 for(const [hero,id,label] of [['knibbs','cover','反制'],['haart','confusion','控念'],['patch','recordedIntent','封录']]){
  const html=token(state,hero,id);
  assert.match(html,/active good/);assert.match(words(html),new RegExp(`${label} 1次·本轮`));
  assert.ok(tooltipView(state,'status',hero,id).includes(target));
  for(const other of state.heroes.filter(h=>h.id!==hero))assert.equal(token(state,other.id,id),'');
 }
 assert.match(words(tooltipView(state,'status','haart','confusion')),/55%/);
 assert.match(words(tooltipView(state,'status','patch','recordedIntent')),/伤害降低 25%/);
 endRound(state);
 for(const [hero,id] of [['knibbs','cover'],['haart','confusion'],['patch','recordedIntent']])assert.equal(token(state,hero,id),'');
});

test('full-intuition covering fire displays the stored reinforced counter after the passive has been spent',()=>{
 const state=createBattle('standard','patrol'),h=heroOf(state,'knibbs');h.intuition=3;
 const preview=words(tooltipView(state,'skill','knibbs','cover'));
 assert.match(preview,/预备反制 77 基础物理 \/ 削韧 42/);assert.match(preview,/直感消耗 3 层/);
 cast(state,'knibbs','cover');assert.equal(h.intuition,0);
 assert.match(words(tooltipView(state,'status','knibbs','cover')),/77 基础物理 \/ 削韧 42 · 直感强化/);
 assert.match(words(tooltipView(state,'hero','knibbs')),/掩护射击/);
});

test('evasion and reactive bandaging show one-use limits and vanish even if the protected hero was not attacked',()=>{
 const state=createBattle('standard','scout',{partyIds:['apeilia','youmu','knibbs']});
 cast(state,'apeilia','reboot');cast(state,'youmu','sterilize');
 assert.match(words(token(state,'apeilia','evasion')),/闪避 1次·本轮/);
 assert.match(words(token(state,'youmu','fieldCare')),/包扎 1次·本轮/);
 const info=words(tooltipView(state,'status','youmu','fieldCare'));
 assert.match(info,/回复 35 生命/);assert.match(info,/生命确实降低且仍存活/);assert.match(info,/护盾完全挡住攻击时不触发/);
 state.boss.intentTarget='knibbs';endRound(state);
 assert.equal(token(state,'apeilia','evasion'),'');assert.equal(token(state,'youmu','fieldCare'),'');
 assert.match(words(token(state,'youmu','surgeon')),/外科 就绪/);
});

test('captain self-empowerment uses the same real one-use buff as team empowerment and clears on attack',()=>{
 const state=createBattle('standard','warden',{partyIds:['youmu','haart','knibbs']});
 cast(state,'youmu','bloodoath');cast(state,'youmu','sterilize');
 const h=heroOf(state,'youmu');assert.equal(h.attackBuff,30);
 assert.match(words(token(state,h.id,'attackBuff')),/增伤\+30% 1次·2轮/);
 assert.match(words(token(state,h.id,'captain')),/船长 2轮/);assert.match(words(token(state,h.id,'taunt')),/嘲讽 2轮/);
 assert.match(words(tooltipView(state,'status',h.id,'captain')),/承伤减少 35%/);
 assert.equal(token(state,'haart','attackBuff'),'');
 cast(state,'youmu','scalpel');assert.equal(token(state,h.id,'attackBuff'),'');
 assert.notEqual(token(state,h.id,'captain'),'');
});

test('temporary reaction charges, independent shields and bad states each have readable names and durations',()=>{
 const state=createBattle('standard','scout',{partyIds:['ric','qianxing','youmu'],upgrades:['ric_grace','ric_verdict']});
 const ric=heroOf(state,'ric');ric.resource=-4;cast(state,'ric','shelter');
 for(const [id,label] of [['edge','剑势 2次'],['grace','余响 1次'],['verdict','清账 1次']])assert.ok(words(token(state,ric.id,id)).includes(label));
 cast(state,'qianxing','spike');cast(state,'qianxing','armor');
 assert.match(words(token(state,'qianxing','reflect')),/钉刺 1次/);
 assert.match(words(token(state,'qianxing','protection')),/防护55% 本轮/);
 assert.match(words(token(state,'qianxing','shield')),/护盾46 首批2轮/);
 const youmu=heroOf(state,'youmu');youmu.exhaustedTurns=2;youmu.resonance=4;
 assert.match(words(token(state,youmu.id,'exhaustion')),/虚脱 2轮/);assert.match(token(state,youmu.id,'exhaustion'),/active warning/);
 assert.match(words(token(state,youmu.id,'resonance')),/共鸣 4\/5/);
});

test('skill hovers retain exact transformation, interrupt, AOE, payment and recovery facts without teaching lists',()=>{
 const state=createBattle('standard','warden',{partyIds:['youmu','qianxing','patch']});
 assert.match(words(tooltipView(state,'skill','youmu','bloodoath')),/主动将生命降至最大值的 40%.*每战一次.*承伤减少 35%.*虚脱两轮/);
 assert.match(words(tooltipView(state,'skill','youmu','surgery')),/需要外科准备.*最多切除两层/);
 const qianxing=heroOf(state,'qianxing');qianxing.secondary=3;
 assert.match(words(tooltipView(state,'skill','qianxing','pulse')),/目标为装置且未抗控时/);
 qianxing.secondary=0;qianxing.resource=0;
 const emergency=tooltipView(state,'skill','qianxing','repair');
 assert.match(words(emergency),/本次只生成 1 份二级资源，不回魔/);assert.doesNotMatch(emergency,/tooltip-notes/);
 const aoe=createBattle('standard','patrol'),preview=skillPreview(aoe,'knibbs','scatter'),tip=words(tooltipView(aoe,'skill','knibbs','scatter'));
 assert.match(tip,/作用范围 全体 2 名敌人/);assert.match(tip,/只支付一次费用，不被护卫分担/);
 for(const enemy of enemyTargets(aoe))assert.ok(tip.includes(`${enemy.name} · 预计扣血 ${preview.targetDamages[enemy.id]}`));
});

test('reward names remain linked while full reward conditions stay on the character portrait',()=>{
 const state=createBattle('standard','warden',{partyIds:['knibbs','ric','youmu'],upgrades:['knibbs_steadyhands']});
 const skill=tooltipView(state,'skill','knibbs','breathe'),hero=tooltipView(state,'hero','knibbs');
 assert.match(skill,/关联成长：装填 · 稳手/);assert.doesNotMatch(skill,/tooltip-notes/);assert.match(hero,/tooltip-notes/);
 heroOf(state,'knibbs').intuition=2;
 assert.match(words(tooltipView(state,'skill','knibbs','breathe')),/下一项主动伤害技能提高 30%/);
});
