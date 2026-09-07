import {HEROES,SKILLS,REWARDS,createBattle,heroOf,resolvedSkill} from './combat.js';
import {heroResourceDescription,passiveDetail,skillExplanation,skillTypeBadge} from './status-details.js';
import {esc,portrait} from './interface.js';
import {icon} from './icons.js';

const starters=['knibbs','apeilia','ric'];
export const HERO_UNLOCKS={
  knibbs:'开始游戏时即可使用。',apeilia:'开始游戏时即可使用。',ric:'开始游戏时即可使用。',
  youmu:'在剧情远征中击败折镜刃卫后加入队伍。',
  haart:'在剧情远征中击败孢冠司祭后加入队伍。',
  qianxing:'在剧情远征中击败雷脊守卫后加入队伍。',
  patch:'在剧情远征中击败魔晶巨人后加入队伍。',
};
export function journalUnlockedHeroes(ids=[]){
  const requested=new Set([...starters,...(Array.isArray(ids)?ids:[])]);
  return HEROES.filter(hero=>requested.has(hero.id)).map(hero=>hero.id);
}

function conditionVariants(state,hero,skill){
  const cases=[];
  if(hero.id==='youmu'){
    if(skill.id==='surgery')cases.push(['已经保存标本',{specimen:'fog'}]);
    cases.push(['游墓接管期间',{youmuForm:'captain',captainTurns:2}]);
  }
  if(hero.id==='ric'&&skill.id==='rune')cases.push(['平衡至少为 +4，或持有剑势',{resource:4}]);
  if(hero.id==='ric'&&skill.id==='bind')cases.push(['平衡不高于 −4，或敌人正受到束缚',{resource:-4}]);
  if(hero.id==='haart'&&skill.id==='relay')cases.push(['施放前已有至少 3 条念线',{secondary:3}]);
  if(hero.id==='haart'&&skill.id==='intercept')cases.push(['施放前已有 6 条念线',{secondary:6}]);
  if(hero.id==='qianxing'&&skill.id==='beam')cases.push(['施放前已有 6 份银焱',{secondary:6}]);
  if(hero.id==='patch'&&skill.id==='chargedslash')cases.push(['观测姿态，施放前已有至少 3 条记录',{patchForm:'observe',secondary:3}],['收录姿态，施放前已有 1 至 2 条记录',{patchForm:'record',secondary:1}],['收录姿态，施放前已有至少 3 条记录',{patchForm:'record',secondary:3}]);
  if(hero.id==='patch'&&['fragments','injunction','collate'].includes(skill.id))cases.push(['观测姿态下兑现记录',{patchForm:'observe',secondary:skill.secondaryCost||1}],['收录姿态下兑现记录',{patchForm:'record',secondary:skill.secondaryCost||1}]);
  if(hero.id==='patch'&&skill.id==='revelation')cases.push(['收录姿态，施放前已有 6 条记录',{patchForm:'record',secondary:6}]);
  if(!cases.length)return '';
  return `<details class="journal-variants"><summary>查看条件满足后的具体变招</summary>${cases.map(([condition,fields])=>{
    const alternate=structuredClone(state),actor=heroOf(alternate,hero.id);Object.assign(actor,fields);
    const variant=resolvedSkill(alternate,hero.id,skill.id),explanation=skillExplanation(alternate,actor,skill.id);
    return `<section><h5>${esc(variant.name)}</h5>${skillTypeBadge(variant)}<p class="journal-condition">${esc(condition)}。</p><p>${esc(explanation.cost)}</p>${explanation.effects.map(effect=>`<p>${esc(effect)}</p>`).join('')}${variant.captainFinish?'<p>炮击后立即退出船长状态，并进入两轮虚脱。</p>':''}</section>`;
  }).join('')}</details>`;
}

/** Pure view: collection progress and selection are persisted by the host. */
export function heroJournalView({unlockedHeroes=[],selectedHero='knibbs',upgrades=[],loadouts={}}={}){
  const unlocked=journalUnlockedHeroes(unlockedHeroes),selected=HEROES.find(hero=>hero.id===selectedHero)||HEROES[0];
  const available=unlocked.includes(selected.id),owned=Array.isArray(upgrades)?upgrades.filter(id=>Object.hasOwn(REWARDS,id)):[];
  const navigation=HEROES.map(hero=>`<button type="button" class="journal-hero ${hero.id===selected.id?'selected':''} ${unlocked.includes(hero.id)?'':'locked'}" data-journal-hero="${hero.id}" aria-pressed="${hero.id===selected.id}">${portrait(hero.id)}<span><strong>${esc(hero.name)}</strong><small>${unlocked.includes(hero.id)?esc(hero.role):'尚未解锁'}</small></span>${icon(unlocked.includes(hero.id)?'chevron':'flag')}</button>`).join('');
  const heading=`<header class="journal-profile" style="--hero:${selected.color}">${portrait(selected.id)}<div><span class="journal-eyebrow">${available?'已收录角色':'等待相遇'}</span><h3>${esc(selected.name)}</h3><p>${esc(selected.role)}</p><blockquote>“${esc(selected.quote)}”</blockquote></div></header>`;
  let content=heading;
  if(!available){
    content+=`<div class="journal-locked"><span>${icon('flag')}</span><h4>在远征中与他相遇</h4><p>${esc(HERO_UNLOCKS[selected.id])}</p><p>解锁后可以在这里查看完整技能，也能在自由挑战中选择该角色独自出战。</p></div>`;
  }else{
    const partyIds=[selected.id,...HEROES.filter(hero=>hero.id!==selected.id).slice(0,2).map(hero=>hero.id)];
    const state=createBattle('standard','golem',{partyIds,upgrades:owned,loadouts}),hero=heroOf(state,selected.id),passive=passiveDetail(state,hero);
    const equipped=state.loadouts[hero.id];
    const skills=SKILLS[hero.id].map(skill=>{
      const explanation=skillExplanation(state,hero,skill.id),earned=!skill.unlockKey||owned.includes(skill.unlockKey),slot=equipped.indexOf(skill.id);
      const label=skill.unlockKey?(earned?'已获得新技能':'需要战斗奖励'):'初始技能';
      return `<article class="journal-skill ${earned?'':'reward-locked'}" data-journal-skill="${skill.id}"><div class="journal-skill-heading">${icon(skill.icon)}<div><h4>${esc(resolvedSkill(state,hero.id,skill.id).name)}</h4>${skillTypeBadge(resolvedSkill(state,hero.id,skill.id))}<span>${label}${slot>=0?` · 已装配在 ${'QWERT'[slot]} 位`:''}</span></div></div><p class="journal-payment">${esc(explanation.cost)}</p>${explanation.effects.map(text=>`<p>${esc(text)}</p>`).join('')}${explanation.conditions.length?`<ul>${explanation.conditions.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:''}${conditionVariants(state,hero,skill)}</article>`;
    }).join('');
    const growth=Object.values(REWARDS).filter(reward=>reward.heroId===hero.id);
    content+=`<p class="journal-bio">${esc(selected.bio)}</p><div class="journal-stats"><div><span>基础生命上限</span><strong>${selected.maxHp}</strong></div><div><span>${esc(hero.resourceName)}上限</span><strong>${hero.id==='ric'?'−'+hero.maxResource+' ～ +'+hero.maxResource:hero.maxResource}</strong></div>${hero.secondaryName?`<div><span>${esc(hero.secondaryName)}上限</span><strong>${hero.maxSecondary||6}</strong></div>`:''}<div><span>每场技能位</span><strong>5</strong></div></div><section class="journal-mechanism"><h4>怎样运用他的能力</h4><p>${esc(heroResourceDescription(hero))}</p><h4>${esc(passive.name)} · 被动</h4><p>${esc(passive.description)}</p><ul>${passive.facts.map(text=>`<li>${esc(text)}</li>`).join('')}</ul></section><div class="journal-section-heading"><h4>完整技能</h4><span>共 ${SKILLS[hero.id].length} 项技能 · 每场装配 ${equipped.length} 项。</span></div><div class="journal-skills">${skills}</div><section class="journal-growth"><h4>可获得的成长奖励<span class="journal-growth-count">已获得 ${growth.filter(reward=>owned.includes(reward.id)).length} / ${growth.length} 项</span></h4>${growth.map(reward=>`<article data-growth-reward="${reward.id}"><strong>${esc(reward.name)}<span>${reward.kind==='skill'?'新技能 · ':'条件强化 · '}${owned.includes(reward.id)?'本次远征已获得':'战斗奖励'}</span></strong><p>${esc(reward.description)}</p></article>`).join('')}<p class="journal-note">角色解锁会保留。新技能和条件强化属于本次远征的成长，需要在战斗奖励中选择；图鉴只供查阅，不会直接发放奖励。</p></section>`;
  }
  return `<div class="modal-eyebrow">同行者档案</div><h2>角色图鉴</h2><p class="modal-lead">已解锁 ${unlocked.length} / ${HEROES.length} 位角色。了解他们的资源循环、技能用途与成长条件，再决定怎样组队。</p><div class="hero-journal"><nav class="journal-navigation" aria-label="选择要查看的角色">${navigation}</nav><section class="journal-detail" aria-label="${esc(selected.name)}的角色资料">${content}</section></div>`;
}
