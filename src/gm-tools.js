import {HEROES} from './combat.js';
import {icon} from './icons.js';
import {normalizeProfile,STARTING_HEROES} from './player-profile.js';

const starters=['knibbs','apeilia','ric'];
const hero=id=>HEROES.find(h=>h.id===id);
const portrait=id=>`<span class="portrait ${id}" role="img" aria-label="${hero(id).name}"></span>`;
export const GAME_PROGRESS_KEYS=['grande-expedition-v1','grande-roster-v1','grande-crystal-save-v1','grande-crystal-records-v1'];

export function resetGameProgress(storage,prefs={}){
  for(const key of GAME_PROGRESS_KEYS)storage.removeItem(key);
  return {profile:normalizeProfile(null),prefs:{...prefs,partyIds:[...STARTING_HEROES],soloHero:STARTING_HEROES[0]}};
}

export function normalizeChallengeParty(ids,unlocked=[]){
  const available=new Set([...starters,...(Array.isArray(unlocked)?unlocked:[])]);
  return [...new Set([...(Array.isArray(ids)?ids:[]),...starters,...HEROES.map(h=>h.id)])]
    .filter(id=>hero(id)&&available.has(id)).slice(0,3);
}

export function swapChallengeParty(ids,slot,id,unlocked=[]){
  const party=normalizeChallengeParty(ids,unlocked);
  if(!Number.isInteger(slot)||slot<0||slot>=3||!hero(id)||![...starters,...unlocked].includes(id))return party;
  const other=party.indexOf(id),previous=party[slot];
  party[slot]=id;if(other>=0&&other!==slot)party[other]=previous;
  return party;
}

export function gmToolsView(profile){
  profile=normalizeProfile(profile);
  const enabled=profile.gmAllHeroes===true;
  return `<div class="modal-eyebrow">试玩工具</div><h2>GM · 角色全开</h2>
    <p class="modal-lead">解锁全部七名角色，直接试试他们各自的打法。</p>
    <div class="gm-roster">${HEROES.map(h=>`<div>${portrait(h.id)}<span>${h.short}</span></div>`).join('')}</div>
    <div class="gm-description"><p>开启后，角色图鉴、独狼选择和三人组队全部开放。当前远征与之后新开的远征，也可以在战后整备时选择全部角色。</p><p>关闭后，保留你通过剧情实际招募的角色。正在进行的战斗可以打完；后续组队与远征整备按正常招募进度开放。剧情、成长奖励和战绩不会被清除。</p>${profile.gmLegacyRecovery?'<p class="gm-migration-note">检测到旧版全开存档：旧版没有单独记录自然招募名单，本次会按当前远征的胜利记录恢复；至少保留三名初始角色。</p>':''}</div>
    <button class="primary" data-action="${enabled?'gm-disable':'gm-unlock'}">${icon(enabled?'close':'spark')}${enabled?'关闭全角色测试':'一键全开角色'}</button>
    <p class="gm-status" role="status">${enabled?'全角色测试已开启。':'全角色测试已关闭。'}剧情已解锁 ${profile.naturalHeroes.length} / ${HEROES.length} 名角色。设置保存在本机。</p>
    <div class="gm-reset-block"><span><strong>重新开始</strong><small>清空本游戏进度、角色解锁、成长与战绩，保留声音设置。</small></span><button data-action="progress-reset">重置游戏进度</button></div>
    <div class="modal-secondary"><button data-action="hero-journal">查看角色图鉴 ${icon('book')}</button><button data-action="close-modal">返回 ${icon('arrow')}</button></div>`;
}

export function progressResetView(){
  return `<div class="modal-eyebrow">重置确认</div><h2>从头开始这次旅程？</h2><p class="modal-lead">确认后，以下内容会从这台设备清除，无法在游戏内撤销。</p><ul class="gm-reset-list"><li>当前自由挑战和远征存档，包括路线选择与剧情进度。</li><li>已招募角色、成长奖励和技能配置。恢复尼布斯、艾佩莉雅、雷克三名初始角色。</li><li>通关战绩，并关闭 GM 全角色测试。</li></ul><p class="gm-status">音量、音乐开关、配音开关等偏好设置会保留。其他网站与游戏的数据不受影响。</p><div class="gm-reset-actions"><button class="primary" data-action="gm">取消，保留进度</button><button class="gm-danger" data-action="progress-reset-confirm">确认清空游戏进度</button></div>`;
}

export function challengePartyView(ids,unlocked,slot=0){
  const party=normalizeChallengeParty(ids,unlocked),available=new Set([...starters,...unlocked]);
  return `<div class="modal-eyebrow">自由挑战</div><h2>调整出战队伍</h2><p class="modal-lead">先选择要替换的位置，再点击角色。选择已在队伍中的角色会交换位置。</p>
    <div class="challenge-party-slots" role="group" aria-label="出战位置">${party.map((id,i)=>`<button data-challenge-slot="${i}" class="${slot===i?'selected':''}" aria-pressed="${slot===i}"><small>位置 ${i+1}</small>${portrait(id)}<strong>${hero(id).short}</strong></button>`).join('')}</div>
    <div class="challenge-roster" role="group" aria-label="可出战角色">${HEROES.map(h=>`<button data-challenge-hero="${h.id}" ${available.has(h.id)?'':'disabled'} class="${party.includes(h.id)?'in-party':''}">${portrait(h.id)}<span><strong>${h.name}</strong><small>${available.has(h.id)?`${h.resourceName} · ${h.role}`:'尚未解锁'}</small></span><b>${party.includes(h.id)?'位置 '+(party.indexOf(h.id)+1):available.has(h.id)?'换入':'待解锁'}</b></button>`).join('')}</div>
    <p class="gm-status">自由挑战使用每人的初始五项技能，全队共享 6 AP。队伍会自动保存。</p>
    <button class="primary" data-action="close-modal">队伍准备好了 ${icon('check')}</button>`;
}
