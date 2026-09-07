import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,REWARDS,createBattle,heroOf,useSkill,endRound,resolvedSkill,skillPreview} from '../src/combat.js';
import {createRun} from '../src/campaign.js';
import {battleView,helpView} from '../src/interface.js';
import {campaignView} from '../src/campaign-ui.js';
import {heroJournalView} from '../src/hero-journal.js';
import {tooltipView,statusBadges,skillExplanation} from '../src/status-details.js';

const words=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const render=s=>battleView(s,false,'','00:00');
const buttons=html=>[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,attrs,body])=>({attrs,body}));
const cards=(s,id)=>buttons(render(s)).filter(b=>b.attrs.includes(`data-owner="${id}"`)&&b.attrs.includes('data-skill='));
const card=(s,id,skill)=>cards(s,id).find(b=>b.attrs.includes(`data-skill="${skill}"`));
const make=id=>createBattle('standard','warden',{partyIds:[id,...HEROES.filter(h=>h.id!==id).slice(0,2).map(h=>h.id)]});
const valid=html=>assert.doesNotMatch(html,/undefined|NaN|\[object Object\]/);

test('all seven five-slot rows show the actual attack type; restorative and control slots say support',()=>{
 for(const hero of HEROES){
  const s=make(hero.id),before=structuredClone(s),visible=cards(s,hero.id);assert.equal(visible.length,5);
  for(const entry of visible){
   const id=entry.attrs.match(/data-skill="([^"]+)"/)[1],skill=resolvedSkill(s,hero.id,id),type=skill.damage>0?skill.kind:'support';
   assert.match(entry.body,new RegExp(`data-skill-type="${type}"`));assert.equal((entry.body.match(/data-skill-type=/g)||[]).length,1);
   const tip=words(tooltipView(s,'skill',hero.id,id));assert.match(tip,new RegExp(type==='support'?'辅助技能':type==='physical'?'物理攻击':'魔法攻击'));valid(tip);
  }
  assert.deepEqual(s,before,'Inspecting types must not spend resources');
 }
});

test('each mana loop shows primary and secondary payment before and after a real conversion and cashout',()=>{
 for(const [id,convert,cashout,name]of [['haart','page','relay','念线'],['qianxing','spike','pulse','银焱'],['patch','keyblade','chargedslash','记录']]){
  const s=make(id),h=heroOf(s,id),before=words(tooltipView(s,'skill',id,convert));
  assert.match(before,/3 点魔力/);assert.ok(before.includes(`生成 2 点${name}`));assert.equal(useSkill(s,id,convert).ok,true);
  assert.equal(h.secondary,2);assert.equal(h.resource,7);
  const html=render(s),tip=words(tooltipView(s,'skill',id,cashout));
  assert.ok(html.includes(`aria-label="${h.short}的${name}"`));assert.ok(html.includes(`aria-label="${h.short}的魔力"`));
  assert.ok(tip.includes(`1 点${name}`));assert.match(tip,/返还 2 点魔力/);assert.match(tip,/2 → 1 \/ 6/);assert.match(tip,/7 → 9/);
  assert.doesNotMatch(tip,/必须先拥有足额魔力|每轮第一次攻击会额外回复|受击会增加/);
  assert.equal(useSkill(s,id,cashout).ok,true);assert.equal(h.secondary,1);assert.equal(h.resource,9);
  valid(html);valid(tip);
 }
});

test('Patch stance changes damage type and the resource-three variant in both button and tooltip',()=>{
 const s=make('patch');
 assert.match(card(s,'patch','chargedslash').body,/data-skill-type="physical"/);
 assert.equal(useSkill(s,'patch','bookward').ok,true);
 assert.match(card(s,'patch','chargedslash').body,/充能斩 · 镜反/);assert.match(card(s,'patch','chargedslash').body,/data-skill-type="magic"/);
 assert.equal(useSkill(s,'patch','bookward').ok,true);
 const active=card(s,'patch','chargedslash'),tip=words(tooltipView(s,'skill','patch','chargedslash'));
 assert.match(active.body,/充能斩 · 反证/);assert.match(active.attrs,/empowered/);assert.match(tip,/3 点记录/);assert.match(tip,/返还 4 点魔力/);assert.match(tip,/4 → 1 \/ 6/);
});

test('low-stock and emergency recovery variants cannot masquerade as empowered attacks',()=>{
 const s=make('qianxing'),h=heroOf(s,'qianxing');h.secondary=1;h.resource=0;
 const recovery=card(s,'qianxing','beam'),tip=words(tooltipView(s,'skill','qianxing','beam'));
 assert.match(recovery.body,/逆向提炼/);assert.match(recovery.body,/data-skill-type="support"/);assert.doesNotMatch(recovery.attrs,/empowered/);
 assert.match(tip,/没有原技能的战斗效果/);assert.doesNotMatch(tip,/本次强化已生效|魔法攻击/);
 h.secondary=0;const emergency=card(s,'qianxing','repair');
 assert.match(emergency.body,/应急提炼/);assert.match(emergency.body,/data-skill-type="support"/);assert.doesNotMatch(emergency.attrs,/empowered/);
 assert.match(words(tooltipView(s,'skill','qianxing','repair')),/另花行动点兑现/);
});

test('full stock exposes a powerful but less efficient cashout while fixed small cashout stays available',()=>{
 const s=make('qianxing'),h=heroOf(s,'qianxing');
 for(let i=0;i<3;i++)assert.equal(useSkill(s,'qianxing','spike').ok,true);
 assert.equal(h.secondary,6);const heavy=skillPreview(s,'qianxing','beam'),small=skillPreview(s,'qianxing','pulse');
 assert.equal(heavy.secondarySpend,6);assert.equal(heavy.refund,6);assert.equal(small.secondarySpend,1);assert.equal(small.refund,2);
 assert.match(card(s,'qianxing','beam').body,/超临界/);assert.match(words(tooltipView(s,'skill','qianxing','beam')),/两轮内受到的伤害增加 15%/);
 assert.match(words(tooltipView(s,'status','qianxing','secondary')),/银焱/);
 assert.ok(small.refund/small.secondarySpend>heavy.refund/heavy.secondarySpend);
});

test('auxiliary cashouts lead with their actual tactical effect and show mana return as an additional benefit',()=>{
 const h=make('haart');assert.equal(useSkill(h,'haart','page').ok,true);
 assert.match(words(card(h,'haart','soothe').body),/辅助 敌伤 −20% · 回魔 \+2/);
 const p=make('patch');assert.equal(useSkill(p,'patch','bookward').ok,true);
 assert.match(words(card(p,'patch','collate').body),/辅助 全队净化 1 层 · 回魔 \+2/);
 const q=createBattle('standard','warden',{partyIds:['qianxing','knibbs','ric'],upgrades:['qianxing_lock'],loadouts:{qianxing:['spike','beam','armor','repair','lock']}});
 assert.equal(useSkill(q,'qianxing','spike').ok,true);assert.equal(useSkill(q,'qianxing','armor').ok,true);
 assert.match(words(card(q,'qianxing','lock').body),/辅助 封锁行动 · 驱散 3 层 · 回魔 \+4/);
});

test('shield icons explain separate remaining batches and disappear when actual settlement expires them',()=>{
 const s=make('qianxing'),h=heroOf(s,'qianxing');
 assert.equal(useSkill(s,'qianxing','armor').ok,true);s.boss.broken=true;endRound(s);
 assert.deepEqual(h.shieldLayers,[{amount:22,turns:1}]);
 assert.equal(useSkill(s,'qianxing','armor').ok,true);
 const before=structuredClone(s),tip=words(tooltipView(s,'status','qianxing','shield'));
 assert.match(tip,/22 点，剩余 1 次敌方回合/);assert.match(tip,/22 点，剩余 2 次敌方回合/);
 assert.match(tip,/重新施盾不会刷新旧批次/);assert.match(statusBadges(s,h),/data-detail="shield"/);assert.deepEqual(s,before);
 s.boss.broken=true;endRound(s);assert.equal(h.shield,22);assert.deepEqual(h.shieldLayers,[{amount:22,turns:1}]);
 s.boss.hardControl=1;endRound(s);assert.equal(h.shield,0);assert.doesNotMatch(statusBadges(s,h),/data-detail="shield"/);
});

test('first aid describes and performs single-target revival; suture is delayed and cannot revive',()=>{
 const s=createBattle('standard','warden',{partyIds:['youmu','knibbs','ric'],upgrades:['youmu_suture'],loadouts:{youmu:['scalpel','surgery','firstaid','bloodoath','suture']}}),youmu=heroOf(s,'youmu'),patient=heroOf(s,'knibbs'),other=heroOf(s,'ric');
 patient.hp=0;patient.resonance=4;other.hp=80;
 let tip=words(tooltipView(s,'skill','youmu','firstaid'));assert.match(tip,/优先救起一位/);assert.match(tip,/一次只处理一位/);assert.match(tip,/抢救目标 2 层/);assert.doesNotMatch(tip,/其余 \+0|全队生命/);
 assert.equal(useSkill(s,'youmu','firstaid').ok,true);assert.equal(patient.hp,30);assert.equal(patient.resonance,2);assert.equal(other.hp,80);
 const before=patient.hp;tip=words(tooltipView(s,'skill','youmu','suture'));assert.match(tip,/没有即时治疗/);assert.match(tip,/各恢复 32/);assert.match(card(s,'youmu','suture').body,/data-skill-type="support"/);
 assert.equal(useSkill(s,'youmu','suture').ok,true);assert.equal(patient.hp,before);assert.equal(patient.regenTurns,2);assert.match(statusBadges(s,patient),/data-detail="regen"/);
 assert.match(words(tooltipView(s,'status','knibbs','regen')),/不会自动复活/);assert.equal(youmu.resource,3);
});

test('blood oath is explained and usable at full health, with a live taunt icon and captain portrait',()=>{
 const s=make('youmu'),h=heroOf(s,'youmu');assert.equal(h.hp,h.maxHp);
 assert.match(statusBadges(s,h),/data-detail="bloodoath"/);
 const tip=words(tooltipView(s,'skill','youmu','bloodoath'));assert.match(tip,/主动将生命降至最大值的 40%/);assert.doesNotMatch(tip,/40% 时才可施放/);
 assert.equal(useSkill(s,'youmu','bloodoath').ok,true);assert.match(render(s),/portrait youmu_inner/);assert.match(statusBadges(s,h),/data-detail="taunt"/);
 assert.match(words(tooltipView(s,'status','youmu','taunt')),/单体主招/);assert.match(words(tooltipView(s,'status','youmu','taunt')),/额外追击不受/);
 assert.match(words(tooltipView(s,'hero','youmu')),/游墓/);
});

test('one-use attack buffs are visible on every recipient and their real consumption removes the icon',()=>{
 const s=make('haart');assert.equal(useSkill(s,'haart','anchor').ok,true);
 for(const h of s.heroes){assert.match(statusBadges(s,h),/data-detail="attackBuff"/);assert.match(words(tooltipView(s,'status',h.id,'attackBuff')),/一项多段技能的全部命中/);}
 assert.match(card(s,'knibbs','shot').attrs,/empowered/);assert.equal(useSkill(s,'knibbs','shot').ok,true);
 assert.doesNotMatch(statusBadges(s,heroOf(s,'knibbs')),/data-detail="attackBuff"/);assert.match(statusBadges(s,heroOf(s,'haart')),/data-detail="attackBuff"/);
});

test('hard control visibly cancels ordinary response preparation without claiming a posture damage bonus',()=>{
 const s=createBattle('standard','warden',{partyIds:['qianxing','knibbs','ric'],upgrades:['qianxing_lock'],loadouts:{qianxing:['spike','beam','armor','repair','lock']}});
 assert.equal(useSkill(s,'qianxing','spike').ok,true);assert.equal(useSkill(s,'qianxing','armor').ok,true);assert.equal(useSkill(s,'qianxing','lock').ok,true);
 const responseButtons=buttons(render(s)).filter(b=>b.attrs.includes('data-response='));assert.equal(responseButtons.length,3);
 for(const b of responseButtons){assert.match(b.attrs,/disabled/);assert.match(b.body,/本轮没有敌方主招/);}
 assert.match(words(tooltipView(s,'skill','qianxing','lock')),/辅助技能/);assert.match(words(tooltipView(s,'skill','qianxing','lock')),/不提供破韧增伤/);
});

test('all 35 growth rewards are listed automatically, including every skill unlock, in journal and camp',()=>{
 assert.equal(Object.keys(REWARDS).length,35);
 const run=createRun();run.phase='camp';run.unlockedHeroes=HEROES.map(h=>h.id);run.upgrades=Object.keys(REWARDS);
 for(const h of HEROES){
  run.focusHero=h.id;const owned=Object.values(REWARDS).filter(r=>r.heroId===h.id),before=structuredClone(run),camp=campaignView(run),journal=heroJournalView({selectedHero:h.id,unlockedHeroes:[h.id],upgrades:run.upgrades});
  assert.equal(owned.length,5);assert.equal((journal.match(/data-growth-reward=/g)||[]).length,5);assert.match(words(journal),/已获得 5 \/ 5 项/);assert.match(words(camp),/成长奖励 5 \/ 5/);
  assert.equal((camp.match(/data-loadout-slot=/g)||[]).length,5);assert.equal((camp.match(/data-equip-skill=/g)||[]).length,SKILLS[h.id].length);
  for(const r of owned)assert.ok(journal.includes(`data-growth-reward="${r.id}"`));
  assert.deepEqual(run,before);valid(journal);valid(camp);
 }
});

test('reward effect metadata connects every new modifier to its affected skill tooltips',()=>{
 for(const reward of Object.values(REWARDS).filter(r=>r.affects)){
  const s=createBattle('standard','warden',{partyIds:[reward.heroId,...HEROES.filter(h=>h.id!==reward.heroId).slice(0,2).map(h=>h.id)],upgrades:[reward.id]});
  for(const id of reward.affects)assert.ok(tooltipView(s,'skill',reward.heroId,id).includes(reward.name),`${reward.id} must explain its effect on ${id}`);
 }
});

test('the upgraded book ward separates a self-only two-round shield from its actual party cleanse',()=>{
 const s=createBattle('standard','warden',{partyIds:['patch','ric','youmu'],upgrades:['patch_archive']});
 s.heroes.forEach(h=>h.resonance=3);
 const tip=words(tooltipView(s,'skill','patch','bookward'));
 assert.match(tip,/为自己提供 20 点护盾/);assert.match(tip,/为所有存活队员各清除 1 层共鸣/);assert.doesNotMatch(tip,/为所有存活队员各提供 20 点护盾/);
 assert.equal(useSkill(s,'patch','bookward').ok,true);assert.deepEqual(s.heroes.map(h=>h.resonance),[2,2,2]);assert.deepEqual(s.heroes.map(h=>h.shield),[20,0,0]);
});

test('transplantation is an auxiliary form of surgery with no active damage or new wound',()=>{
 const s=createBattle('standard','warden',{partyIds:['youmu','knibbs','ric']});
 assert.equal(useSkill(s,'youmu','scalpel').ok,true);assert.equal(useSkill(s,'youmu','surgery').ok,true);
 const tip=words(tooltipView(s,'skill','youmu','surgery')),entry=card(s,'youmu','surgery');
 assert.match(entry.body,/移植手术/);assert.match(entry.body,/data-skill-type="support"/);assert.match(tip,/辅助技能/);assert.doesNotMatch(tip,/预计物理伤害|为敌人留下创口/);
 assert.equal(resolvedSkill(s,'youmu','surgery').dotDamage,0);
});

test('the manual and portraits state the current two-resource economy without obsolete recovery promises',()=>{
 const s=make('patch'),texts=[helpView(s),...['haart','qianxing','patch'].map(id=>tooltipView(make(id),'hero',id))].map(words).join(' ');
 assert.doesNotMatch(texts,/返还 9|回 9|高档回转效率更高|每轮第一次攻击会额外回复|护盾被敌方击破.*回复 2 点魔力/);
 assert.match(texts,/念线/);assert.match(texts,/银焱/);assert.match(texts,/记录/);assert.match(texts,/主动献血至 40%/);
});
