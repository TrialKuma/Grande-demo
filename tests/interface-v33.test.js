import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,BOSSES,REWARDS,createBattle,heroOf,skillOf,victoryRequirements} from '../src/combat.js';
import {titleView,battleView,helpView} from '../src/interface.js';
import {heroJournalView,journalUnlockedHeroes,HERO_UNLOCKS} from '../src/hero-journal.js';
import {skillExplanation,heroResourceDescription,tooltipView,statusBadges} from '../src/status-details.js';

const words=html=>html.replace(/<[^>]*>/g,' ');
const battle=state=>battleView(state,false,'','00:00',null);
const make=(id,boss='golem',extra={})=>createBattle('standard',boss,{mode:'solo',partyIds:[id],...extra});
const valid=html=>assert.doesNotMatch(html,/undefined|NaN|\[object Object\]/);

test('journal retains the three starters and exposes exact recruit timing without granting a locked skill',()=>{
 assert.deepEqual(journalUnlockedHeroes(),['knibbs','apeilia','ric']);
 assert.deepEqual(journalUnlockedHeroes(['patch','patch','invented']),['knibbs','apeilia','ric','patch']);
 assert.deepEqual(journalUnlockedHeroes(null),['knibbs','apeilia','ric']);
 for(const [id,bossName]of [['youmu','折镜刃卫'],['haart','孢冠司祭'],['qianxing','雷脊守卫'],['patch','魔晶巨人']]){
  const html=heroJournalView({selectedHero:id,upgrades:Object.keys(REWARDS)});
  assert.match(HERO_UNLOCKS[id],new RegExp(bossName));assert.ok(html.includes(HERO_UNLOCKS[id]));
  assert.equal((html.match(/data-journal-hero=/g)||[]).length,7);assert.ok(!html.includes('data-journal-skill='));
  assert.match(html,/尚未解锁/);valid(html);
 }
});

test('each unlocked journal shows the complete skill library, five equipped slots, passive and resource loop',()=>{
 for(const hero of HEROES){
  const html=heroJournalView({unlockedHeroes:[hero.id],selectedHero:hero.id});
  assert.equal((html.match(/data-journal-skill=/g)||[]).length,SKILLS[hero.id].length);
  assert.equal((html.match(/已装配在 [QWERT] 位/g)||[]).length,5);
  for(const skill of SKILLS[hero.id])assert.ok(html.includes(`data-journal-skill="${skill.id}"`));
  assert.ok(html.includes(hero.passiveName));assert.match(html,/基础生命上限/);assert.match(html,/需要战斗奖励/);valid(html);
 }
});

test('journal distinguishes an earned reward skill from permanent character unlock and respects the actual loadout',()=>{
 const input={unlockedHeroes:['patch'],selectedHero:'patch',upgrades:['patch_revelation'],loadouts:{patch:['keyblade','bookward','chargedslash','fragments','revelation']}},before=structuredClone(input);
 const html=heroJournalView(input),card=html.match(/<article[^>]*data-journal-skill="revelation"[\s\S]*?<\/article>/)[0];
 assert.match(card,/已获得新技能/);assert.match(card,/已装配在 T 位/);assert.doesNotMatch(card,/需要战斗奖励/);
 assert.match(html,/新技能和条件强化属于本次远征/);assert.deepEqual(input,before);
 const invalid=heroJournalView({unlockedHeroes:['<script>'],selectedHero:'"><script>alert(1)</script>',upgrades:['bad'],loadouts:{}});
 assert.doesNotMatch(invalid,/<script>|alert\(1\)/);assert.match(invalid,/尼布斯/);valid(invalid);
});

test('journal describes ship skills, transplantation and both clock stances before entering combat',()=>{
 const doctor=words(heroJournalView({unlockedHeroes:['youmu'],selectedHero:'youmu'}));
 for(const name of ['移植手术','铁血弯刀','船长威严','枪弹盛宴','沉渊炼狱号','死海整帆','深海炮列'])assert.ok(doctor.includes(name),name);
 assert.match(doctor,/立即退出船长状态/);assert.match(doctor,/进入两轮虚脱/);
 const clock=words(heroJournalView({unlockedHeroes:['patch'],selectedHero:'patch'}));
 for(const name of ['充能斩','充能斩 · 镜反','时之扉 · 封存'])assert.ok(clock.includes(name),name);
 assert.match(clock,/施放时消耗 1 点行动点和 4 点魔力/);assert.match(clock,/施放时消耗 2 点行动点和 8 点魔力/);
 assert.match(clock,/消耗记录.*被动|被动.*回魔/);
});

test('title solo selection keeps character and boss unlock lists independent',()=>{
 const prefs={bossId:'golem',difficulty:'standard',challengeMode:'solo',soloHero:'patch'};
 const locked=titleView(prefs,null,'',[]),open=titleView(prefs,null,'',[],'',{unlockedHeroes:['patch','<script>']});
 assert.deepEqual([...locked.matchAll(/data-solo-hero="([^"]+)"/g)].map(m=>m[1]),['knibbs','apeilia','ric']);
 assert.deepEqual([...open.matchAll(/data-solo-hero="([^"]+)"/g)].map(m=>m[1]),['knibbs','apeilia','ric','patch']);
 assert.match(open,/data-action="hero-journal"/);assert.match(open,/data-mode="party"/);assert.match(open,/data-mode="solo"/);
 assert.equal((open.match(/data-boss=/g)||[]).length,0);assert.match(open,/还没有解锁自由挑战/);
 const allBosses=titleView(prefs,null,'',[],'',{unlockedHeroes:['patch'],unlockedBosses:Object.keys(BOSSES)});
 assert.equal((allBosses.match(/data-boss=/g)||[]).length,Object.keys(BOSSES).length);assert.equal(Object.keys(BOSSES).length,10);
 assert.match(allBosses,/10 \/ 10/);assert.doesNotMatch(open,/>010<|<script>/);valid(open);valid(allBosses);
});

test('solo board renders one complete five-slot row and reads its AP limit in battle and help',()=>{
 const s=make('ric');s.round=2;s.roundCarry=2;s.maxAp=7;s.ap=7;const before=structuredClone(s),html=battle(s);
 assert.match(html,/battle-v3 is-solo/);assert.equal((html.match(/class="team-row /g)||[]).length,1);
 assert.equal((html.match(/data-skill=/g)||[]).length,5);assert.match(html,/独狼行动点/);assert.match(html,/<small> \/ 7<\/small>/);
 assert.match(helpView(s),/7 AP/);assert.doesNotMatch(helpView(s),/6 AP|四项技能|六场战斗/);
 const party=battle(createBattle());assert.equal((party.match(/class="team-row /g)||[]).length,3);assert.equal((party.match(/data-skill=/g)||[]).length,15);
 assert.deepEqual(s,before);valid(html);
});

test('solo title and help disclose numeric tuning and never advertise dual-type victory gates',()=>{
 for(const bossId of ['golem','final']){
  const title=words(titleView({bossId,difficulty:'standard',challengeMode:'solo',soloHero:'knibbs'},null,'',[]));
  assert.match(title,/5 AP/);assert.match(title,/64%/);assert.match(title,/90%/);assert.match(title,/韧性上限为 120，每轮恢复 10 点/);
  assert.match(title,/任意属性命中 4 次/);assert.match(title,/任意属性命中 2 次/);assert.doesNotMatch(title,/终幕双系与应对|双系核心|最后以双系命中|再以物理与魔法净化/);
 }
 const solo=words(helpView(make('knibbs','final')));assert.match(solo,/独狼挑战由一名角色使用全部行动点/);assert.doesNotMatch(solo,/最后以双系命中|双系核心/);
 const party=words(helpView(createBattle()));assert.match(party,/三名角色共享行动点/);assert.match(party,/双系核心/);
});

test('solo core and finale HUD and skill tooltip show any-type requirements instead of dual-type gates',()=>{
 const core=make('knibbs'),r=victoryRequirements(core);Object.assign(core.boss,{core:true,coreHits:2,coreTurns:3});
 let html=battle(core),tip=words(tooltipView(core,'skill','knibbs','shot'));
 assert.match(html,new RegExp(`任意属性命中 <b>2 / ${r.coreHits}`));assert.match(tip,/任意属性累计命中 4 次/);assert.doesNotMatch(tip,/物理需命中|还需另一系/);
 const finale=make('knibbs','final');Object.assign(finale.boss,{finale:true,finaleHits:1,finaleTurns:2});
 html=battle(finale);tip=words(tooltipView(finale,'skill','knibbs','shot'));
 assert.match(html,/任意属性命中 <b>1 \/ 2/);assert.match(tip,/任意属性累计命中 2 次/);assert.match(tip,/结束回合且存活/);assert.doesNotMatch(tip,/还需另一系|分别登记 1 次物理/);
 const party=createBattle('standard','golem');Object.assign(party.boss,{core:true,coreTurns:3});
 assert.match(words(tooltipView(party,'skill','knibbs','shot')),/物理需命中 3 次，魔法需命中 3 次/);
});

test('skill explanations use live primary or secondary costs and explicit targets',()=>{
 const a=make('apeilia');
 for(const id of ['eden','sentinel']){assert.equal(skillOf('apeilia',id).cost,6);assert.match(skillExplanation(a,'apeilia',id).cost,/6 点连击/);}
 assert.match(heroResourceDescription(heroOf(a,'apeilia')),/伊甸之约消耗 6 点，地狱哨兵消耗 6 点/);
 const h=make('haart'),support=skillExplanation(h,'haart','soothe');
 assert.match(support.cost,/1 点念线。/);assert.doesNotMatch(support.cost,/返还|回魔/);assert.match(support.conditions.join(''),/心智通路/);assert.match(support.conditions.join(''),/回魔规则见角色被动/);assert.doesNotMatch(support.effects.join(''),/恢复.*生命/);assert.match(support.effects.join(''),/伤害降低 20%/);
 const shield=skillExplanation(make('ric'),'ric','shelter');assert.match(shield.effects.join(''),/为自己提供 30 点护盾/);assert.doesNotMatch(shield.effects.join(''),/所有存活队员各.*30 点护盾/);
});

test('Haart passive badge displays current stored threads and rendering is read-only',()=>{
 const s=make('haart','golem',{upgrades:['haart_triage']}),h=heroOf(s,'haart');
 h.secondary=1;assert.match(statusBadges(s,h),/1\/4/);assert.doesNotMatch(statusBadges(s,h),/治疗强化/);
 h.secondary=3;assert.doesNotMatch(statusBadges(s,h),/active good/);
 h.secondary=4;const before=structuredClone(s);assert.match(statusBadges(s,h),/active good/);assert.match(statusBadges(s,h),/4\/4/);assert.deepEqual(s,before);
});

test('readable manual has four reachable sections and seven independent portrait cards',()=>{
 const html=helpView(createBattle());
 assert.match(html,/class="battle-manual"/);assert.doesNotMatch(html,/class="manual-heroes"/);
 const chapters=[...html.matchAll(/href="#([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(chapters,['manual-decisions','manual-companions','manual-enemies','manual-controls']);
 for(const id of chapters)assert.ok(html.includes(`id="${id}"`));
 assert.equal((html.match(/data-manual-hero=/g)||[]).length,HEROES.length);
 for(const hero of HEROES){
  const card=html.match(new RegExp(`<article[^>]*data-manual-hero="${hero.id}"[\\s\\S]*?<\\/article>`))?.[0];
  assert.ok(card,hero.id);assert.ok(card.includes(hero.name));assert.ok(card.includes(`class="portrait ${hero.id}"`));
  assert.ok(card.includes(hero.resourceName));assert.ok(card.includes(hero.passiveName));assert.ok(card.includes('<p>'));
 }
 assert.match(html,/data-action="hero-journal"/);valid(html);
});

test('manual opens only the current enemy and preserves the actual solo victory requirements',()=>{
 const s=make('knibbs','final'),before=structuredClone(s),html=helpView(s);
 const enemies=[...html.matchAll(/<details\b([^>]*)>/g)].map(match=>match[1]);
 assert.equal(enemies.length,Object.keys(BOSSES).length);assert.equal(enemies.filter(attrs=>/\bopen\b/.test(attrs)).length,1);
 assert.ok(enemies.find(attrs=>attrs.includes('data-manual-boss="final"')).includes('open'));
 assert.match(html,/任意属性累计命中 2 次/);assert.match(html,/data-action="boss-codex"/);
 assert.doesNotMatch(html,/终幕双系与应对|最后以双系命中/);assert.deepEqual(s,before);
});
