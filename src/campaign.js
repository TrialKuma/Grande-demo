import {HEROES,SKILLS,SKILL_SLOTS,DIFFICULTIES,createBattle,normalizeLoadouts} from './combat.js';
import {REWARDS} from './rewards.js';
import {normalizeSave} from './save.js';
import {CHAPTERS} from './story.js';
import {migrateRoster} from './legacy-roster.js';

export const ORIGINAL_PARTY=['knibbs','apeilia','ric'];
export const CHAPTER_RECRUITS=['youmu','haart','qianxing','patch',null,null];
const REWARD_POOLS=[
 ['knibbs_ricochet','apeilia_overture','ric_equilibrium','youmu_suture'],
 ['haart_network','apeilia_cascade','knibbs_deadeye','youmu_transplant'],
 ['qianxing_nova','ric_grace','haart_triage','youmu_resolve'],
 ['apeilia_zero','qianxing_focus','ric_verdict','patch_revelation'],
 ['knibbs_expose','haart_echo','qianxing_reinforce','patch_precision','patch_archive']
];
export function createRun(difficulty='standard'){
  if(typeof difficulty!=='string'||!Object.hasOwn(DIFFICULTIES,difficulty))difficulty='standard';
  return {version:3,id:String(Date.now()),difficulty,chapter:0,phase:'dialogue',dialogue:'before',line:0,partyIds:[...ORIGINAL_PARTY],
    unlockedHeroes:[...ORIGINAL_PARTY],upgrades:[],loadouts:normalizeLoadouts(),history:[],battle:null,lastReward:null,focusHero:'knibbs'};
}
export function runDialogue(run){return CHAPTERS[run.chapter][run.dialogue];}
export function rewardOptions(run){return (REWARD_POOLS[run.chapter]||[]).map(id=>REWARDS[id]).filter(r=>r&&!run.upgrades.includes(r.id)&&run.unlockedHeroes.includes(r.heroId));}
export function battleForRun(run,previewHero){
  let partyIds=[...run.partyIds];
  if(previewHero&&!partyIds.includes(previewHero))partyIds=[previewHero,...partyIds.slice(0,2)];
  return createBattle(run.difficulty,CHAPTERS[run.chapter].bossId,{partyIds,upgrades:run.upgrades,loadouts:run.loadouts});
}
export function advanceDialogue(run,skip=false){
  if(run.phase!=='dialogue')return false;
  if(!skip&&run.line<runDialogue(run).length-1){run.line++;return true;}
  run.line=0;
  if(run.dialogue==='before')run.phase='battle';
  else run.phase=run.chapter===CHAPTERS.length-1?'complete':'reward';
  return true;
}
export function completeEncounter(run,battle){
  if(run.phase!=='battle'||battle.mode!=='victory'||battle.boss.id!==CHAPTERS[run.chapter].bossId||run.history.length!==run.chapter)return false;
  run.history.push({bossId:battle.boss.id,round:battle.round,damage:battle.stats.damage,breaks:battle.stats.breaks,partyIds:battle.heroes.map(h=>h.id)});
  const recruit=CHAPTER_RECRUITS[run.chapter];
  if(recruit&&!run.unlockedHeroes.includes(recruit))run.unlockedHeroes.push(recruit);
  run.phase='dialogue';run.dialogue='after';run.line=0;run.battle=null;
  return true;
}
export function claimReward(run,id){
  if(run.phase!=='reward'||!rewardOptions(run).some(r=>r.id===id))return {ok:false,error:'请选择本场提供的一项奖励。'};
  const reward=REWARDS[id];
  run.upgrades.push(id);run.loadouts=normalizeLoadouts(run.upgrades,run.loadouts);
  let replaced=null;
  if(reward.kind==='skill'){
    replaced=run.loadouts[reward.heroId][SKILL_SLOTS-1];
    run.loadouts[reward.heroId][SKILL_SLOTS-1]=reward.skillId;
    run.focusHero=reward.heroId;
  }
  run.lastReward={id,replaced};run.chapter++;run.phase='camp';run.dialogue='before';run.line=0;
  return {ok:true,reward};
}
export function replacePartyMember(run,slot,heroId){
  if(run.phase!=='camp'||!Number.isInteger(slot)||slot<0||slot>2||!run.unlockedHeroes.includes(heroId))return false;
  const oldIndex=run.partyIds.indexOf(heroId),outgoing=run.partyIds[slot];
  run.partyIds[slot]=heroId;if(oldIndex>=0&&oldIndex!==slot)run.partyIds[oldIndex]=outgoing;
  run.focusHero=heroId;return true;
}
export function equipSkill(run,heroId,slot,skillId){
  if(run.phase!=='camp'||!run.unlockedHeroes.includes(heroId)||!Number.isInteger(slot)||slot<0||slot>=SKILL_SLOTS)return {ok:false,error:'请在战间整备时调整技能。'};
  const skill=SKILLS[heroId]?.find(s=>s.id===skillId);
  if(!skill)return {ok:false,error:'未知技能。'};
  if(skill.unlockKey&&!run.upgrades.includes(skill.unlockKey))return {ok:false,error:'这项技能尚未通过战斗奖励解锁。'};
  const old=run.loadouts[heroId].indexOf(skillId);
  if(old>=0)return {ok:true,slot:old};
  run.loadouts[heroId][slot]=skillId;return {ok:true,slot};
}
export function startNextChapter(run){
  if(run.phase!=='camp')return false;
  run.phase='dialogue';run.dialogue='before';run.line=0;run.battle=null;return true;
}
export function regroup(run){
  if(run.phase!=='battle')return false;
  run.phase='camp';run.battle=null;run.dialogue='before';run.line=0;
  return true;
}
export function normalizeRun(value){
  if(!value||typeof value!=='object'||![1,2,3].includes(value.version)||typeof value.difficulty!=='string'||!Object.hasOwn(DIFFICULTIES,value.difficulty))return null;
  if(value.version===1)value=migrateRoster(value);
  if(value.phase==='complete'&&value.chapter!==CHAPTERS.length-1)return null;
  if(!Number.isInteger(value.chapter)||value.chapter<0||value.chapter>=CHAPTERS.length||!['dialogue','battle','reward','camp','complete'].includes(value.phase))return null;
  if(!['before','after'].includes(value.dialogue)||!Array.isArray(value.history))return null;
  const won=value.phase==='complete'?6:value.phase==='reward'||value.phase==='dialogue'&&value.dialogue==='after'?value.chapter+1:value.chapter;
  if(value.history.length!==won||value.history.some((h,i)=>!h||h.bossId!==CHAPTERS[i].bossId||!Number.isInteger(h.round)||h.round<1||h.round>9999))return null;
  const unlocked=[...ORIGINAL_PARTY,...CHAPTER_RECRUITS.slice(0,won).filter(Boolean)];
  if(!Array.isArray(value.partyIds)||value.partyIds.length!==3||new Set(value.partyIds).size!==3||value.partyIds.some(id=>!unlocked.includes(id)))return null;
  if(!Array.isArray(value.upgrades)||value.upgrades.length>5||new Set(value.upgrades).size!==value.upgrades.length||value.upgrades.some(id=>!REWARDS[id]))return null;
  // Rewards must come from the chapter at which each choice was offered.
  if(value.upgrades.some((id,i)=>!REWARD_POOLS[i]?.includes(id)))return null;
  const pending=value.phase==='reward'||value.phase==='dialogue'&&value.dialogue==='after';
  if(value.upgrades.length!==Math.min(5,won-(pending?1:0)))return null;
  const copy={version:3,id:String(value.id||'restored'),difficulty:value.difficulty,chapter:value.chapter,phase:value.phase,dialogue:value.dialogue,
    line:Number.isInteger(value.line)?Math.max(0,Math.min(value.line,CHAPTERS[value.chapter][value.dialogue].length-1)):0,
    partyIds:[...value.partyIds],unlockedHeroes:unlocked,upgrades:[...value.upgrades],loadouts:normalizeLoadouts(value.upgrades,value.loadouts),
    history:value.history.map((h,i)=>({bossId:CHAPTERS[i].bossId,round:h.round,damage:Number.isFinite(h.damage)?Math.max(0,h.damage):0,breaks:Number.isFinite(h.breaks)?Math.max(0,h.breaks):0,partyIds:Array.isArray(h.partyIds)?h.partyIds.filter(id=>HEROES.some(p=>p.id===id)).slice(0,3):[]})),
    battle:null,lastReward:value.lastReward&&REWARDS[value.lastReward.id]?{id:value.lastReward.id,replaced:typeof value.lastReward.replaced==='string'?value.lastReward.replaced:null}:null,
    focusHero:unlocked.includes(value.focusHero)?value.focusHero:value.partyIds[0]};
  if(copy.phase==='battle'){
    const battle=normalizeSave(value.battle);
    if(battle&&battle.boss.id===CHAPTERS[copy.chapter].bossId&&battle.difficulty===copy.difficulty&&battle.heroes.map(h=>h.id).join(',')===copy.partyIds.join(',')&&battle.upgrades?.join(',')===copy.upgrades.join(','))copy.battle=battle;
    else {copy.phase='camp';copy.battle=null;}
  }
  return copy;
}
