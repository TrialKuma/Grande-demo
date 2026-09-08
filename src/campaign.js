import {HEROES,SKILLS,SKILL_SLOTS,DIFFICULTIES,createBattle,normalizeLoadouts} from './combat.js';
import {REWARDS,reconcileRewardOffer} from './rewards.js';
import {normalizeSave} from './save.js';
import {CHAPTERS,CHAPTER_BY_BOSS,ROUTE_CHOICES,CAMP_EVENTS,ENDINGS} from './story.js';
import {migrateRoster} from './legacy-roster.js';
import {RECRUIT_AFTER,earnedCompanions} from './roster-unlocks.js';
import {grantShield} from './shields.js';
import * as learning from './campaign-learning.js';
export {recruitOptions,chooseCompanion,startPractice,skillAccessFor,trainingCount,isLearningRun,formalLearning,interludeFor,interactInterlude,advanceInterlude,finishInterlude,updateInterludePosition} from './campaign-learning.js';

export const ORIGINAL_PARTY=['knibbs','apeilia','ric'];
export const CHAPTER_RECRUITS=['youmu','haart','qianxing','patch',null,null];
const REWARD_POOLS=[
 ['knibbs_ricochet','apeilia_overture','ric_equilibrium','youmu_suture','knibbs_steadyhands','apeilia_brace','ric_discipline','youmu_pathology'],
 ['haart_network','apeilia_cascade','knibbs_deadeye','youmu_transplant','knibbs_crossfire','apeilia_puncture','haart_insight','youmu_aftercare','qianxing_grounding'],
 ['qianxing_nova','ric_grace','haart_triage','youmu_resolve','ric_erosion','haart_intercept','qianxing_grounding','patch_doubleentry'],
 ['apeilia_zero','qianxing_focus','ric_verdict','patch_revelation','qianxing_lock','patch_doubleentry','haart_insight'],
 ['knibbs_expose','haart_echo','qianxing_reinforce','patch_precision','patch_archive','patch_injunction','qianxing_lock','ric_erosion','haart_intercept']
];
const MAIN_PATH=['duelist','cantor','warden','golem','weaver','final'];
const EXTRA_POOLS={
 tide:['youmu_resolve','haart_echo','qianxing_reinforce','knibbs_expose','ric_grace','youmu_aftercare','haart_intercept','qianxing_grounding','ric_discipline'],
 furnace:['qianxing_focus','haart_triage','knibbs_deadeye','apeilia_cascade','ric_verdict','knibbs_crossfire','apeilia_puncture','youmu_pathology','qianxing_lock'],
 orrery:['patch_archive','patch_precision','haart_echo','knibbs_expose','apeilia_zero','ric_verdict','patch_doubleentry','patch_injunction','haart_insight','ric_erosion'],
 arbiter:['patch_precision','patch_archive','qianxing_reinforce','haart_triage','ric_grace','knibbs_expose','knibbs_steadyhands','apeilia_brace','youmu_aftercare','patch_injunction']
};
const poolFor=id=>EXTRA_POOLS[id]||REWARD_POOLS[MAIN_PATH.indexOf(id)]||[];
const naturalAtReward=(run,index)=>earnedCompanions({history:run.history.slice(0,index+1)});
const gmRewardKeysFor=run=>(run.upgrades||[]).filter((id,index)=>!naturalAtReward(run,index).includes(REWARDS[id]?.heroId)&&(run.gmAllHeroes===true||Array.isArray(run.gmRewardKeys)&&run.gmRewardKeys.includes(id)));
const rewardRecruitAllowed=(run,id,index)=>naturalAtReward(run,index).includes(REWARDS[id]?.heroId)||run.gmAllHeroes===true||Array.isArray(run.gmRewardKeys)&&run.gmRewardKeys.includes(id);
const routeGroup=run=>run.chapter===3?'crossing':run.chapter===6?'archive':null;
const eventGroup=run=>['tide','furnace'].includes(pathFor(run)[run.chapter])?'crossing':['orrery','arbiter'].includes(pathFor(run)[run.chapter])?'archive':null;
export function pathFor(run){if(learning.isLearningRun(run))return learning.pathFor(run);return run.legacyRoute?[...MAIN_PATH]:['duelist','cantor','warden',run.routes?.crossing||null,'golem','weaver',run.routes?.archive||null,'final'];}
export function currentChapter(run){if(learning.isLearningRun(run))return learning.currentChapter(run);
 const id=pathFor(run)[run.chapter];
 if(id)return CHAPTER_BY_BOSS[id];
 const group=routeGroup(run),choice=ROUTE_CHOICES[group],previous=CHAPTER_BY_BOSS[group==='crossing'?'warden':'weaver'];
 return {...previous,title:choice?.title||'选择接下来的路线',hook:choice?.prompt||'',isChoice:true};
}
export function runRoute(run){if(learning.isLearningRun(run))return learning.runRoute(run);return pathFor(run).map((id,index)=>({index,id,bossId:id,chapter:id?CHAPTER_BY_BOSS[id]:null,choices:!run.legacyRoute&&(index===3||index===6)?ROUTE_CHOICES[index===3?'crossing':'archive'].options:[],cleared:index<run.history.length,current:index===run.chapter,recruit:id?RECRUIT_AFTER[id]||null:null}));}
export function routeOptions(run){if(learning.isLearningRun(run))return learning.routeOptions(run);return !run.legacyRoute&&run.phase==='route'?(ROUTE_CHOICES[routeGroup(run)]?.options||[]):[];}
export function currentEvent(run){if(learning.isLearningRun(run))return learning.currentEvent(run);return !run.legacyRoute?CAMP_EVENTS[eventGroup(run)]||null:null;}
export function endingForRun(run){if(learning.isLearningRun(run))return learning.endingForRun(run);
 const scores={rescue:0,evidence:0,infrastructure:0};
 if(run.routes?.crossing==='tide')scores.rescue++;else if(run.routes?.crossing==='furnace')scores.infrastructure++;
 if(run.routes?.archive==='orrery')scores.evidence++;else if(run.routes?.archive==='arbiter')scores.rescue++;
 let last='rescue';
 for(const group of ['crossing','archive']){const event=CAMP_EVENTS[group].options.find(o=>o.id===run.events?.[group]);if(event){scores[event.score]+=2;last=event.score;}}
 const id=Object.keys(scores).sort((a,b)=>scores[b]-scores[a]||(a===last?-1:b===last?1:0))[0];
 return {...ENDINGS[id],scores};
}
export function createRun(difficulty='standard',{legacyRoute=false,gmAllHeroes=false,skipTutorial=false,seed}={}){
  if(!legacyRoute&&!skipTutorial)return learning.createLearningRun(difficulty,{gmAllHeroes,seed});
  if(typeof difficulty!=='string'||!Object.hasOwn(DIFFICULTIES,difficulty))difficulty='standard';
  const run={version:4,id:String(Date.now()),difficulty,chapter:0,phase:'dialogue',dialogue:'before',line:0,legacyRoute:!!legacyRoute,routes:{crossing:null,archive:null},events:{crossing:null,archive:null},partyIds:[...ORIGINAL_PARTY],
    unlockedHeroes:[...ORIGINAL_PARTY],upgrades:[],loadouts:normalizeLoadouts(),history:[],battle:null,lastReward:null,focusHero:'knibbs'};
  return gmAllHeroes===true?unlockRunHeroes(run):run;
}
export function unlockRunHeroes(run){if(learning.isLearningRun(run))return learning.unlockRunHeroes(run);
  if(!run||typeof run!=='object')return run;
  run.gmAllHeroes=true;run.unlockedHeroes=HEROES.map(hero=>hero.id);
  delete run.gmBattleParty;
  return run;
}
function settleRunParty(run){
  if(run.gmAllHeroes)return run;
  run.unlockedHeroes=earnedCompanions(run);
  run.partyIds=[...new Set([...run.partyIds,...ORIGINAL_PARTY])].filter(id=>run.unlockedHeroes.includes(id)).slice(0,3);
  if(!run.unlockedHeroes.includes(run.focusHero))run.focusHero=run.partyIds[0];
  delete run.gmBattleParty;
  return run;
}
export function disableRunHeroes(run){if(learning.isLearningRun(run))return learning.disableRunHeroes(run);
  if(!run||typeof run!=='object')return run;
  const gmRewardKeys=gmRewardKeysFor(run);
  if(gmRewardKeys.length)run.gmRewardKeys=gmRewardKeys;else delete run.gmRewardKeys;
  delete run.gmAllHeroes;
  run.unlockedHeroes=earnedCompanions(run);
  // A fight already in progress keeps its actors until it resolves. The flag
  // grants no camp access and is checked against the saved battle on reload.
  if(run.phase==='battle'&&run.partyIds.some(id=>!run.unlockedHeroes.includes(id)))run.gmBattleParty=true;
  else settleRunParty(run);
  return run;
}
export function runDialogue(run){if(learning.isLearningRun(run))return learning.runDialogue(run);
 if(run.dialogue==='route')return ROUTE_CHOICES[routeGroup(run)]?.options.find(o=>o.id===run.routes[routeGroup(run)])?.lines||[];
 if(run.dialogue==='event')return currentEvent(run)?.options.find(o=>o.id===run.events[eventGroup(run)])?.lines||[];
 if(run.dialogue==='ending')return endingForRun(run).lines;
 return currentChapter(run)?.[run.dialogue]||[];
}
export function dialogueNextLabel(run){if(learning.isLearningRun(run))return learning.dialogueNextLabel(run);
 if(run.line<runDialogue(run).length-1)return '继续对话';
 if(run.dialogue==='before')return '进入战斗';
 if(run.dialogue==='route')return '进入整备';
 if(run.dialogue==='ending'||run.legacyRoute&&currentChapter(run).bossId==='final')return '结束远征';
 if(currentChapter(run).bossId==='final')return '看看后来';
 return run.dialogue==='after'&&currentEvent(run)?'安排接下来的工作':'领取成长奖励';
}
export function rewardOptions(run){if(learning.isLearningRun(run))return learning.rewardOptions(run);return reconcileRewardOffer(run.rewardOfferIds,poolFor(currentChapter(run).bossId).map(id=>REWARDS[id]).filter(r=>r&&!run.upgrades.includes(r.id)&&earnedCompanions(run).includes(r.heroId)),pool=>learning.pickThree(pool,run.id+'/'+currentChapter(run).bossId));}
export function consequenceNotes(run){if(learning.isLearningRun(run))return learning.consequenceNotes(run);
 const id=currentChapter(run).bossId,notes=[];
 if(run.legacyRoute)return notes;
 if(id==='golem'){
  if(run.routes.crossing==='tide')notes.push('水闸排水：敌方初始韧性 −18');
  if(run.routes.crossing==='furnace')notes.push('隔热护具：全员初始护盾 +10');
  if(run.events.crossing==='triage')notes.push('急救接力：全员初始护盾 +18');
  if(run.events.crossing==='supply')notes.push('独立照明：敌方初始韧性 −24');
  if(run.events.crossing==='log')notes.push('传动标记：敌方首轮伤害 −20%');
 }
 if(id==='final'){
  if(run.routes.archive==='orrery')notes.push('时序校验：敌方初始屏障 −1');
  if(run.routes.archive==='arbiter')notes.push('撤销追击：敌方首轮伤害 −20%');
  if(run.events.archive==='rescue')notes.push('额外护具：全员初始护盾 +24');
  if(run.events.archive==='evidence')notes.push('许可撤回：敌方初始屏障 −1');
  if(run.events.archive==='repair')notes.push('独立接地：敌方初始韧性 −24');
 }
 return notes;
}
export function battleForRun(run,previewHero){if(learning.isLearningRun(run))return learning.battleForRun(run,previewHero);
  let partyIds=[...run.partyIds];
  if(previewHero&&!partyIds.includes(previewHero))partyIds=[previewHero,...partyIds.slice(0,2)];
  const battle=createBattle(run.difficulty,currentChapter(run).bossId,{partyIds,upgrades:run.upgrades,loadouts:run.loadouts});
  if(!run.legacyRoute){
   const boss=battle.boss,shield=n=>battle.heroes.forEach(h=>grantShield(h,n));
   if(boss.id==='golem'){
    if(run.routes.crossing==='tide')boss.stagger-=18;
    if(run.routes.crossing==='furnace')shield(10);
    if(run.events.crossing==='triage')shield(18);
    if(run.events.crossing==='supply')boss.stagger-=24;
    if(run.events.crossing==='log')boss.weakened=1;
   }
   if(boss.id==='final'){
    if(run.routes.archive==='orrery')boss.seals--;
    if(run.routes.archive==='arbiter')boss.weakened=1;
    if(run.events.archive==='rescue')shield(24);
    if(run.events.archive==='evidence')boss.seals--;
    if(run.events.archive==='repair')boss.stagger-=24;
    boss.seals=Math.max(0,boss.seals);
   }
  }
  return battle;
}
export function advanceDialogue(run,skip=false){if(learning.isLearningRun(run))return learning.advanceDialogue(run,skip);
  if(run.phase!=='dialogue')return false;
  if(!skip&&run.line<runDialogue(run).length-1){run.line++;return true;}
  run.line=0;
  if(run.dialogue==='before')run.phase='battle';
  else if(run.dialogue==='route')run.phase='camp';
  else if(run.dialogue==='ending')run.phase='complete';
  else if(run.dialogue==='event')run.phase='reward';
  else if(currentChapter(run).bossId==='final'){
   if(run.legacyRoute)run.phase='complete';else {run.dialogue='ending';run.phase='dialogue';}
  }else run.phase=currentEvent(run)?'event':'reward';
  return true;
}
export function completeEncounter(run,battle){if(learning.isLearningRun(run))return learning.completeEncounter(run,battle);
  if(run.phase!=='battle'||battle.mode!=='victory'||battle.boss.id!==pathFor(run)[run.chapter]||run.history.length!==run.chapter)return false;
  run.history.push({bossId:battle.boss.id,round:battle.round,damage:battle.stats.damage,breaks:battle.stats.breaks,partyIds:battle.heroes.map(h=>h.id)});
  const recruit=RECRUIT_AFTER[battle.boss.id];
  if(recruit&&!run.unlockedHeroes.includes(recruit))run.unlockedHeroes.push(recruit);
  run.phase='dialogue';run.dialogue='after';run.line=0;run.battle=null;
  if(!run.gmAllHeroes)settleRunParty(run);
  return true;
}
export function claimReward(run,id){if(learning.isLearningRun(run))return learning.claimReward(run,id);
  if(run.phase!=='reward'||!earnedCompanions(run).includes(REWARDS[id]?.heroId)||!rewardOptions(run).some(r=>r.id===id))return {ok:false,error:'请选择本场提供的一项同行角色奖励。'};
  const reward=REWARDS[id];
  run.upgrades.push(id);run.loadouts=normalizeLoadouts(run.upgrades,run.loadouts);
  delete run.rewardOfferIds;
  let replaced=null;
  if(reward.kind==='skill'){
    replaced=run.loadouts[reward.heroId][SKILL_SLOTS-1];
    run.loadouts[reward.heroId][SKILL_SLOTS-1]=reward.skillId;
    run.focusHero=reward.heroId;
  }
  run.lastReward={id,replaced};run.chapter++;run.phase=pathFor(run)[run.chapter]?'camp':'route';run.dialogue='before';run.line=0;
  return {ok:true,reward};
}
export function chooseRoute(run,id){if(learning.isLearningRun(run))return learning.chooseRoute(run,id);
 if(!routeOptions(run).some(o=>o.id===id))return {ok:false,error:'请在分岔处选择本次开放的一条路线。'};
 run.routes[routeGroup(run)]=id;run.phase='dialogue';run.dialogue='route';run.line=0;return {ok:true};
}
export function chooseEvent(run,id){if(learning.isLearningRun(run))return learning.chooseEvent(run,id);
 const event=currentEvent(run),option=event?.options.find(o=>o.id===id);
 if(run.phase!=='event'||!option||run.events[eventGroup(run)])return {ok:false,error:'这项安排现在不可选择。'};
 run.events[eventGroup(run)]=id;run.phase='dialogue';run.dialogue='event';run.line=0;return {ok:true};
}
export function storyHistory(run){if(learning.isLearningRun(run))return learning.storyHistory(run);
 const entries=[];
 for(const [index,id] of pathFor(run).entries()){
  if(index>run.chapter||!id)continue;
  const chapter=CHAPTER_BY_BOSS[id],group=index===3?'crossing':index===6?'archive':null;
  if(!run.legacyRoute&&group&&run.routes[group]){
   const choice=ROUTE_CHOICES[group].options.find(o=>o.id===run.routes[group]);
   entries.push({title:'路线决定 · '+choice.name,lines:index===run.chapter&&run.phase==='dialogue'&&run.dialogue==='route'?choice.lines.slice(0,run.line+1):choice.lines});
   if(index===run.chapter&&run.dialogue==='route')continue;
  }
  for(const part of ['before','after']){
   if(index===run.chapter&&(run.phase==='camp'||run.phase==='route'))continue;
   if(index===run.chapter&&part==='after'&&run.history.length<=index)continue;
   entries.push({title:chapter.title+' · '+(part==='before'?'战前':'战后'),lines:index===run.chapter&&run.phase==='dialogue'&&run.dialogue===part?chapter[part].slice(0,run.line+1):chapter[part]});
  }
  const eventId=group&&run.events[group];
  if(!run.legacyRoute&&eventId){const event=CAMP_EVENTS[group].options.find(o=>o.id===eventId);entries.push({title:'战间安排 · '+event.name,lines:index===run.chapter&&run.phase==='dialogue'&&run.dialogue==='event'?event.lines.slice(0,run.line+1):event.lines});}
 }
 if(!run.legacyRoute&&(run.dialogue==='ending'||run.phase==='complete'))entries.push({title:endingForRun(run).title,lines:run.phase==='complete'?endingForRun(run).lines:endingForRun(run).lines.slice(0,run.line+1)});
 return entries;
}
export function replacePartyMember(run,slot,heroId){if(learning.isLearningRun(run))return learning.replacePartyMember(run,slot,heroId);
  if(run.phase!=='camp'||!Number.isInteger(slot)||slot<0||slot>2||!run.unlockedHeroes.includes(heroId))return false;
  const oldIndex=run.partyIds.indexOf(heroId),outgoing=run.partyIds[slot];
  run.partyIds[slot]=heroId;if(oldIndex>=0&&oldIndex!==slot)run.partyIds[oldIndex]=outgoing;
  run.focusHero=heroId;return true;
}
export function equipSkill(run,heroId,slot,skillId){if(learning.isLearningRun(run))return learning.equipSkill(run,heroId,slot,skillId);
  if(run.phase!=='camp'||!run.unlockedHeroes.includes(heroId)||!Number.isInteger(slot)||slot<0||slot>=SKILL_SLOTS)return {ok:false,error:'请在战间整备时调整技能。'};
  const skill=SKILLS[heroId]?.find(s=>s.id===skillId);
  if(!skill)return {ok:false,error:'未知技能。'};
  if(skill.unlockKey&&!run.upgrades.includes(skill.unlockKey))return {ok:false,error:'这项技能尚未通过战斗奖励解锁。'};
  const old=run.loadouts[heroId].indexOf(skillId);
  if(old>=0){[run.loadouts[heroId][slot],run.loadouts[heroId][old]]=[run.loadouts[heroId][old],run.loadouts[heroId][slot]];return {ok:true,slot};}
  run.loadouts[heroId][slot]=skillId;return {ok:true,slot};
}
export function startNextChapter(run){if(learning.isLearningRun(run))return learning.startNextChapter(run);
  if(run.phase!=='camp')return false;
  if(!run.gmAllHeroes)settleRunParty(run);
  run.phase='dialogue';run.dialogue='before';run.line=0;run.battle=null;return true;
}
export function regroup(run){if(learning.isLearningRun(run))return learning.regroup(run);
  if(run.phase!=='battle')return false;
  run.phase='camp';run.battle=null;run.dialogue='before';run.line=0;
  if(!run.gmAllHeroes)settleRunParty(run);
  return true;
}
function normalizeLegacyRun(value){
  if(!value||typeof value!=='object'||![1,2,3].includes(value.version)||typeof value.difficulty!=='string'||!Object.hasOwn(DIFFICULTIES,value.difficulty))return null;
  if(value.version===1)value=migrateRoster(value);
  if(value.phase==='complete'&&value.chapter!==CHAPTERS.length-1)return null;
  if(!Number.isInteger(value.chapter)||value.chapter<0||value.chapter>=CHAPTERS.length||!['dialogue','battle','reward','camp','complete'].includes(value.phase))return null;
  if(!['before','after'].includes(value.dialogue)||!Array.isArray(value.history))return null;
  const won=value.phase==='complete'?6:value.phase==='reward'||value.phase==='dialogue'&&value.dialogue==='after'?value.chapter+1:value.chapter;
  if(value.history.length!==won||value.history.some((h,i)=>!h||h.bossId!==CHAPTERS[i].bossId||!Number.isInteger(h.round)||h.round<1||h.round>9999))return null;
  const gmAllHeroes=value.gmAllHeroes===true;
  const unlocked=gmAllHeroes?HEROES.map(hero=>hero.id):[...ORIGINAL_PARTY,...CHAPTER_RECRUITS.slice(0,won).filter(Boolean)];
  const gmBattleParty=!gmAllHeroes&&value.phase==='battle'&&value.gmBattleParty===true;
  if(!Array.isArray(value.partyIds)||value.partyIds.length!==3||new Set(value.partyIds).size!==3||value.partyIds.some(id=>!HEROES.some(h=>h.id===id)||!unlocked.includes(id)&&!gmBattleParty))return null;
  if(!Array.isArray(value.upgrades)||value.upgrades.length>5||new Set(value.upgrades).size!==value.upgrades.length||value.upgrades.some(id=>!REWARDS[id]))return null;
  // Rewards must come from the chapter at which each choice was offered.
  if(value.upgrades.some((id,i)=>!REWARD_POOLS[i]?.includes(id)||!rewardRecruitAllowed(value,id,i)))return null;
  const pending=value.phase==='reward'||value.phase==='dialogue'&&value.dialogue==='after';
  if(value.upgrades.length!==Math.min(5,won-(pending?1:0)))return null;
  const copy={version:3,id:String(value.id||'restored'),difficulty:value.difficulty,chapter:value.chapter,phase:value.phase,dialogue:value.dialogue,
    line:Number.isInteger(value.line)?Math.max(0,Math.min(value.line,CHAPTERS[value.chapter][value.dialogue].length-1)):0,
    partyIds:[...value.partyIds],unlockedHeroes:unlocked,upgrades:[...value.upgrades],loadouts:normalizeLoadouts(value.upgrades,value.loadouts),
    history:value.history.map((h,i)=>({bossId:CHAPTERS[i].bossId,round:h.round,damage:Number.isFinite(h.damage)?Math.max(0,h.damage):0,breaks:Number.isFinite(h.breaks)?Math.max(0,h.breaks):0,partyIds:Array.isArray(h.partyIds)?h.partyIds.filter(id=>HEROES.some(p=>p.id===id)).slice(0,3):[]})),
    battle:null,lastReward:value.lastReward&&REWARDS[value.lastReward.id]?{id:value.lastReward.id,replaced:typeof value.lastReward.replaced==='string'?value.lastReward.replaced:null}:null,
    focusHero:unlocked.includes(value.focusHero)||gmBattleParty&&value.partyIds.includes(value.focusHero)?value.focusHero:value.partyIds[0],...(gmAllHeroes?{gmAllHeroes:true}:{}),...(gmBattleParty?{gmBattleParty:true}:{}),...(gmRewardKeysFor(value).length?{gmRewardKeys:gmRewardKeysFor(value)}:{})};
  if(copy.phase==='battle'){
    const battle=normalizeSave(value.battle);
    if(battle&&battle.boss.id===CHAPTERS[copy.chapter].bossId&&battle.difficulty===copy.difficulty&&battle.heroes.map(h=>h.id).join(',')===copy.partyIds.join(',')&&battle.upgrades?.join(',')===copy.upgrades.join(','))copy.battle=battle;
    else {copy.phase='camp';copy.battle=null;settleRunParty(copy);}
  }
  if(Object.hasOwn(value,'rewardOfferIds')&&copy.phase==='reward')copy.rewardOfferIds=rewardOptions({...copy,legacyRoute:true,rewardOfferIds:value.rewardOfferIds}).map(r=>r.id);
  return copy;
}

export function normalizeRun(value){if(learning.isLearningRun(value))return learning.normalizeLearningRun(value);
 if(!value||typeof value!=='object')return null;
 if([1,2,3].includes(value.version)||value.version===4&&value.legacyRoute===true){
  const legacy=normalizeLegacyRun(value.version===4?{...value,version:3}:value);
  return legacy?{...legacy,version:4,legacyRoute:true,routes:{crossing:null,archive:null},events:{crossing:null,archive:null}}:null;
 }
 if(value.version!==4||value.legacyRoute!==false||typeof value.difficulty!=='string'||!Object.hasOwn(DIFFICULTIES,value.difficulty))return null;
 if(!Number.isInteger(value.chapter)||value.chapter<0||value.chapter>7||!['dialogue','battle','reward','camp','route','event','complete'].includes(value.phase)||!['before','after','route','event','ending'].includes(value.dialogue))return null;
 const routes={},events={};
 for(const group of ['crossing','archive']){
  const selected=value.routes?.[group],event=value.events?.[group];
  if(selected!==null&&!ROUTE_CHOICES[group].options.some(o=>o.id===selected))return null;
  if(event!==null&&!CAMP_EVENTS[group].options.some(o=>o.id===event))return null;
  routes[group]=selected;events[group]=event;
 }
 const base={...value,routes,events},path=pathFor(base);
 for(const [group,index] of [['crossing',3],['archive',6]]){
  if(value.chapter<index&&(routes[group]!==null||events[group]!==null))return null;
  if(value.chapter>index&&!routes[group])return null;
  if(value.chapter===index&&!routes[group]&&value.phase!=='route')return null;
 }
 if(value.phase==='route'&&(path[value.chapter]!==null||value.dialogue!=='before'))return null;
 if(value.dialogue==='route'&&(!routeGroup(base)||!routes[routeGroup(base)]||!['dialogue','camp'].includes(value.phase)))return null;
 const isEnding=value.dialogue==='ending'||value.phase==='complete';
 if(isEnding&&(value.chapter!==7||value.dialogue!=='ending'||!['dialogue','complete'].includes(value.phase)))return null;
 const post=value.phase==='complete'||value.phase==='reward'||value.phase==='event'||value.phase==='dialogue'&&['after','event','ending'].includes(value.dialogue);
 const won=value.chapter+(post?1:0);
 if(!Array.isArray(value.history)||value.history.length!==won||value.history.some((h,i)=>!h||h.bossId!==path[i]||!Number.isInteger(h.round)||h.round<1||h.round>9999))return null;
 for(const [group,index] of [['crossing',3],['archive',6]]){
  if(events[group]&&won<=index)return null;
  if(won>index&&!events[group]&&!(value.chapter===index&&(value.phase==='event'||value.phase==='dialogue'&&value.dialogue==='after')))return null;
 }
 if(value.phase==='event'&&(!eventGroup(base)||events[eventGroup(base)]||value.dialogue!=='after'))return null;
 if(value.dialogue==='event'&&(!eventGroup(base)||!events[eventGroup(base)]||!['dialogue','reward'].includes(value.phase)))return null;
 const gmAllHeroes=value.gmAllHeroes===true;
 const unlocked=gmAllHeroes?HEROES.map(hero=>hero.id):[...ORIGINAL_PARTY,...value.history.map(h=>RECRUIT_AFTER[h.bossId]).filter(Boolean)];
 const gmBattleParty=!gmAllHeroes&&value.phase==='battle'&&value.gmBattleParty===true;
 if(!Array.isArray(value.partyIds)||value.partyIds.length!==3||new Set(value.partyIds).size!==3||value.partyIds.some(id=>!HEROES.some(h=>h.id===id)||!unlocked.includes(id)&&!gmBattleParty))return null;
 const pending=value.phase==='reward'||value.phase==='event'||value.phase==='dialogue'&&['after','event'].includes(value.dialogue);
 if(!Array.isArray(value.upgrades)||new Set(value.upgrades).size!==value.upgrades.length||value.upgrades.length!==Math.min(7,won-(pending?1:0)))return null;
 if(value.upgrades.some((id,i)=>!REWARDS[id]||!poolFor(path[i]).includes(id)||!rewardRecruitAllowed(value,id,i)))return null;
 const copy={version:4,id:String(value.id||'restored'),difficulty:value.difficulty,chapter:value.chapter,phase:value.phase,dialogue:value.dialogue,
  line:0,legacyRoute:false,routes,events,partyIds:[...value.partyIds],unlockedHeroes:unlocked,upgrades:[...value.upgrades],loadouts:normalizeLoadouts(value.upgrades,value.loadouts),
  history:value.history.map(h=>({bossId:h.bossId,round:h.round,damage:Number.isFinite(h.damage)?Math.max(0,h.damage):0,breaks:Number.isFinite(h.breaks)?Math.max(0,h.breaks):0,partyIds:Array.isArray(h.partyIds)?h.partyIds.filter(id=>HEROES.some(p=>p.id===id)).slice(0,3):[]})),
  battle:null,lastReward:value.lastReward&&REWARDS[value.lastReward.id]?{id:value.lastReward.id,replaced:typeof value.lastReward.replaced==='string'?value.lastReward.replaced:null}:null,
  focusHero:unlocked.includes(value.focusHero)||gmBattleParty&&value.partyIds.includes(value.focusHero)?value.focusHero:value.partyIds[0],...(gmAllHeroes?{gmAllHeroes:true}:{}),...(gmBattleParty?{gmBattleParty:true}:{}),...(gmRewardKeysFor(value).length?{gmRewardKeys:gmRewardKeysFor(value)}:{})};
 const lines=runDialogue(copy);copy.line=Number.isInteger(value.line)?Math.max(0,Math.min(value.line,Math.max(0,lines.length-1))):0;
 if(copy.phase==='dialogue'&&!lines.length)return null;
 if(copy.phase==='battle'){
  const battle=normalizeSave(value.battle);
  if(battle&&battle.boss.id===path[copy.chapter]&&battle.difficulty===copy.difficulty&&battle.heroes.map(h=>h.id).join(',')===copy.partyIds.join(',')&&battle.upgrades?.join(',')===copy.upgrades.join(','))copy.battle=battle;
  else {copy.phase='camp';copy.battle=null;copy.dialogue='before';copy.line=0;settleRunParty(copy);}
 }
 if(Object.hasOwn(value,'rewardOfferIds')&&copy.phase==='reward')copy.rewardOfferIds=rewardOptions({...copy,rewardOfferIds:value.rewardOfferIds}).map(r=>r.id);
 return copy;
}
