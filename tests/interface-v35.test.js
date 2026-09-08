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
   const id=entry.attrs.match(/data-skill="([^"]+)"/)[1],skill=resolvedSkill(s,hero.id,id),type=skill.damage>0||skill.coverFire?skill.kind:'support';
   assert.match(entry.body,new RegExp(`data-skill-type="${type}"`));assert.equal((entry.body.match(/data-skill-type=/g)||[]).length,1);
   const tip=words(tooltipView(s,'skill',hero.id,id));assert.match(tip,new RegExp(type==='support'?'辅助技能':type==='physical'?'物理攻击':'魔法攻击'));valid(tip);
  }
  assert.deepEqual(s,before,'Inspecting types must not spend resources');
 }
});

test('each mana loop shows its distinct capacity and separates spell payment from actual passive recovery',()=>{
 for(const [id,convert,cashout,name,cost,cap,refund]of [['haart','page','soothe','念线',2,4,3],['qianxing','spike','pulse','充能',3,3,4],['patch','keyblade','chargedslash','记录',1,10,2]]){
  const s=make(id),h=heroOf(s,id),before=words(tooltipView(s,'skill',id,convert));
  assert.ok(before.includes(`${cost} 点魔力`));assert.ok(before.includes(`生成 1 点${name}`));assert.equal(useSkill(s,id,convert).ok,true);
  assert.equal(h.maxSecondary,cap);assert.equal(h.secondary,1);assert.equal(h.resource,10-cost);
  const html=render(s),tip=words(tooltipView(s,'skill',id,cashout));
  assert.ok(html.includes(`aria-label="${h.short}的${name}"`));assert.ok(html.includes(`aria-label="${h.short}的魔力"`));
  assert.ok(tip.includes(`1 点${name}`));assert.match(tip,/被动回魔/);assert.ok(tip.includes(`1 → 0 / ${cap}`));assert.ok(tip.includes(`${10-cost} → 10`));
  assert.ok(tip.includes(`+${Math.min(cost,refund)}${refund>cost?`（溢出 ${refund-cost}）`:''}`));
  assert.doesNotMatch(skillExplanation(s,id,cashout).cost,/返还|回魔/);
  assert.doesNotMatch(tip,/必须先拥有足额魔力|每轮第一次攻击会额外回复|受击会增加/);
  assert.equal(useSkill(s,id,cashout).ok,true);assert.equal(h.secondary,0);assert.equal(h.resource,10);
  valid(html);valid(tip);
 }
});

test('each bulk conversion spends two AP on preparation and discloses its own mana-to-stock ratio',()=>{
 for(const [id,skill,cost,gain]of [['haart','rest',8,4],['qianxing','repair',9,3],['patch','collate',8,6]]){
  const s=make(id),h=heroOf(s,id),explanation=skillExplanation(s,id,skill),tip=words(tooltipView(s,'skill',id,skill));
  assert.match(explanation.cost,new RegExp(`2 点行动点和 ${cost} 点魔力`));
  assert.ok(tip.includes(`生成 ${gain} 点${h.secondaryName}`));
  assert.match(card(s,id,skill).body,/data-skill-type="support"/);
  assert.doesNotMatch(explanation.effects.join(' '),/造成.*伤害|提供.*护盾|恢复.*生命|清除.*共鸣/);
  assert.equal(useSkill(s,id,skill).ok,true);assert.equal(s.ap,4);assert.equal(h.resource,10-cost);assert.equal(h.secondary,gain);
 }
});

test('Patch stance changes damage type while a stockpile never removes its fixed one-record cashout',()=>{
 const s=make('patch');
 assert.match(card(s,'patch','chargedslash').body,/data-skill-type="physical"/);
 assert.equal(useSkill(s,'patch','bookward').ok,true);
 assert.match(card(s,'patch','chargedslash').body,/充能斩 · 镜反/);assert.match(card(s,'patch','chargedslash').body,/data-skill-type="magic"/);
 assert.equal(useSkill(s,'patch','bookward').ok,true);
 const active=card(s,'patch','chargedslash'),tip=words(tooltipView(s,'skill','patch','chargedslash'));
 assert.match(active.body,/充能斩 · 镜反/);assert.match(tip,/1 点记录/);assert.match(tip,/被动回魔 \+3/);assert.match(tip,/6 → 5 \/ 10/);
 assert.match(tip,/2 → 5/);assert.doesNotMatch(tip,/充能斩 · 反证|消耗 3 点记录/);
});

test('Patch gate previews six-to-ten consumed records and one stance-dependent passive payout',()=>{
 for(const form of ['observe','record'])for(const records of [6,8,10]){
  const s=createBattle('standard','warden',{partyIds:['patch','knibbs','ric'],upgrades:['patch_revelation'],loadouts:{patch:['keyblade','bookward','chargedslash','fragments','revelation']}}),h=heroOf(s,'patch');
  h.patchForm=form;h.secondary=records;h.records=records;h.resource=0;
  const tip=words(tooltipView(s,'skill','patch','revelation')),preview=skillPreview(s,'patch','revelation'),refund=form==='record'?3:2;
  assert.ok(tip.includes(`消耗记录 ${records}`));assert.ok(tip.includes(`攻击段数 ${records} 段`));assert.ok(tip.includes(`被动回魔 +${refund}`));
  assert.ok(tip.includes(`${records} → 0 / 10`));assert.equal(preview.hits,records);assert.equal(preview.refund,refund);
  if(form==='record'&&records>=8)assert.match(tip,/封锁敌人的下一次普通行动/);
  else assert.doesNotMatch(tip,/封锁敌人的下一次普通行动/);
  assert.equal(useSkill(s,'patch','revelation').ok,true);assert.equal(h.secondary,0);assert.equal(h.resource,refund);
 }
});

test('low-stock and emergency recovery variants cannot masquerade as empowered attacks',()=>{
 const s=make('qianxing'),h=heroOf(s,'qianxing');h.secondary=1;h.resource=0;
 const recovery=card(s,'qianxing','beam'),tip=words(tooltipView(s,'skill','qianxing','beam'));
 assert.match(recovery.body,/逆向提炼/);assert.match(recovery.body,/data-skill-type="support"/);assert.doesNotMatch(recovery.attrs,/empowered/);
 assert.match(tip,/没有原技能的战斗效果/);assert.doesNotMatch(tip,/本次强化已生效|魔法攻击/);
 h.secondary=0;const emergency=card(s,'qianxing','repair');
 assert.match(emergency.body,/应急提炼/);assert.match(emergency.body,/data-skill-type="support"/);assert.doesNotMatch(emergency.attrs,/empowered/);
 assert.match(words(tooltipView(s,'skill','qianxing','repair')),/本次只生成 1 份二级资源，不回魔/);
});

test('full stock exposes a powerful but less efficient cashout while fixed small cashout stays available',()=>{
 const s=make('qianxing'),h=heroOf(s,'qianxing');
 assert.equal(useSkill(s,'qianxing','repair').ok,true);
 assert.equal(h.secondary,3);const heavy=skillPreview(s,'qianxing','beam'),small=skillPreview(s,'qianxing','pulse');
 assert.equal(heavy.secondarySpend,3);assert.equal(heavy.refund,6);assert.equal(small.secondarySpend,1);assert.equal(small.refund,4);
 assert.match(card(s,'qianxing','beam').body,/超临界/);assert.match(words(tooltipView(s,'skill','qianxing','beam')),/两轮内受到的伤害增加 15%/);
 assert.match(words(tooltipView(s,'status','qianxing','secondary')),/充能/);
 assert.ok(small.refund/small.secondarySpend>heavy.refund/heavy.secondarySpend);
});

test('auxiliary cashouts lead with their tactical effect while passive recovery stays in the detailed preview',()=>{
 const h=make('haart');assert.equal(useSkill(h,'haart','page').ok,true);
 assert.match(words(card(h,'haart','soothe').body),/改写杀意 · 转向或削弱55%/);assert.doesNotMatch(words(card(h,'haart','soothe').body),/回魔/);
 assert.match(words(tooltipView(h,'skill','haart','soothe')),/下一次单体攻击转向另一名敌人/);
 assert.match(words(card(h,'haart','anchor').body),/辅助 每人下次攻击 \+25%/);
 const p=make('patch');assert.match(words(card(p,'patch','collate').body),/辅助 记录 \+6/);
 const q=createBattle('standard','warden',{partyIds:['qianxing','knibbs','ric'],upgrades:['qianxing_lock'],loadouts:{qianxing:['spike','beam','armor','repair','lock']}});
 assert.equal(useSkill(q,'qianxing','spike').ok,true);assert.equal(useSkill(q,'qianxing','spike').ok,true);
 assert.match(words(card(q,'qianxing','lock').body),/辅助 单体 封锁行动 · 驱散 3 层/);assert.doesNotMatch(words(card(q,'qianxing','lock').body),/回魔/);
 assert.match(words(tooltipView(q,'skill','qianxing','lock')),/被动回魔 \+5/);
});

test('shield icons explain separate remaining batches and disappear when actual settlement expires them',()=>{
 const s=make('qianxing'),h=heroOf(s,'qianxing');
 assert.equal(useSkill(s,'qianxing','spike').ok,true);assert.equal(useSkill(s,'qianxing','armor').ok,true);s.boss.broken=true;endRound(s);
 assert.deepEqual(h.shieldLayers,[{amount:36,turns:1}]);
 assert.equal(useSkill(s,'qianxing','spike').ok,true);
 assert.equal(useSkill(s,'qianxing','armor').ok,true);
 const before=structuredClone(s),tip=words(tooltipView(s,'status','qianxing','shield'));
 assert.match(tip,/36 点，剩余 1 次敌方回合/);assert.match(tip,/24 点，剩余 2 次敌方回合/);
 assert.match(tip,/重新施盾不会刷新旧批次/);assert.match(statusBadges(s,h),/data-detail="shield"/);assert.deepEqual(s,before);
 s.boss.broken=true;endRound(s);assert.equal(h.shield,24);assert.deepEqual(h.shieldLayers,[{amount:24,turns:1}]);
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
 const s=make('haart');assert.equal(useSkill(s,'haart','page').ok,true);assert.equal(useSkill(s,'haart','anchor').ok,true);
 for(const h of s.heroes){assert.match(statusBadges(s,h),/data-detail="attackBuff"/);assert.match(words(tooltipView(s,'status',h.id,'attackBuff')),/一项多段技能的全部命中/);}
 assert.match(card(s,'knibbs','shot').attrs,/empowered/);assert.equal(useSkill(s,'knibbs','shot').ok,true);
 assert.doesNotMatch(statusBadges(s,heroOf(s,'knibbs')),/data-detail="attackBuff"/);assert.match(statusBadges(s,heroOf(s,'haart')),/data-detail="attackBuff"/);
});

test('hard control explains the cancelled enemy action without showing retired response buttons',()=>{
 const s=createBattle('standard','warden',{partyIds:['qianxing','knibbs','ric'],upgrades:['qianxing_lock'],loadouts:{qianxing:['spike','beam','armor','repair','lock']}});
 assert.equal(useSkill(s,'qianxing','spike').ok,true);assert.equal(useSkill(s,'qianxing','spike').ok,true);assert.equal(useSkill(s,'qianxing','lock').ok,true);
 const responseButtons=buttons(render(s)).filter(b=>b.attrs.includes('data-response='));assert.equal(responseButtons.length,0);
 assert.match(render(s),/行动封锁|停止/);assert.doesNotMatch(render(s),/data-action="guard"/);
 assert.match(words(tooltipView(s,'skill','qianxing','lock')),/辅助技能/);assert.match(words(tooltipView(s,'skill','qianxing','lock')),/不提供破韧增伤/);
});

test('all 35 growth rewards are listed automatically, including every skill unlock, in journal and camp',()=>{
 assert.equal(Object.keys(REWARDS).length,35);
 const run=createRun('standard',{legacyRoute:true,gmAllHeroes:true});run.phase='camp';run.upgrades=Object.keys(REWARDS);
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
 assert.match(tip,/为自己提供 8 点护盾/);assert.match(tip,/为所有存活队员各清除 1 层共鸣/);assert.doesNotMatch(tip,/为所有存活队员各提供 8 点护盾/);
 assert.equal(useSkill(s,'patch','bookward').ok,true);assert.deepEqual(s.heroes.map(h=>h.resonance),[2,2,2]);assert.deepEqual(s.heroes.map(h=>h.shield),[8,0,0]);
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
 assert.match(texts,/念线/);assert.match(texts,/充能/);assert.match(texts,/记录/);assert.match(texts,/主动献血至 40%/);
});
