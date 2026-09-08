import {HEROES,SKILLS,DIFFICULTIES,createBattle,normalizeLoadouts} from './combat.js';
import {REWARDS} from './rewards.js';
import {normalizeSave} from './save.js';
import {CHAPTER_BY_BOSS,ROUTE_CHOICES,CAMP_EVENTS,ENDINGS} from './story.js';
import {TUTORIAL_CHAPTERS} from './tutorial-story.js';
import {LEARNING_ORDER,TUTORIAL_IDS} from './training.js';
import {grantShield} from './shields.js';
import {beginInterlude,interludeFor,interactInterlude,updateInterludePosition,advanceInterlude as advanceWalkingDialogue,canFinishInterlude,normalizeInterlude,interludeRequiredLines,SKIRMISH_AFTER,SKIRMISH_STORIES} from './interludes.js';
export {interludeFor,interactInterlude,updateInterludePosition};

const heroIds=Object.keys(LEARNING_ORDER),known=id=>heroIds.includes(id);
const isTutorial=id=>TUTORIAL_IDS.includes(id);
const chapterFor=id=>TUTORIAL_CHAPTERS.find(c=>c.bossId===id)||CHAPTER_BY_BOSS[id];
const copy=value=>structuredClone(value);
const recruitAfter=['scout','conduit','duelist','cantor','warden','golem'];
export const isLearningRun=run=>run?.version===5||run?.version===6;
export const naturalHeroes=run=>['knibbs',...(run.recruits||[]).map(r=>r.heroId)];
export const pathFor=run=>['scout','bulwark','conduit','duelist','cantor','warden',run.routes?.crossing||null,'golem','weaver',run.routes?.archive||null,'final'];
const routeGroup=run=>run.chapter===6?'crossing':run.chapter===9?'archive':null;
const eventGroup=run=>['tide','furnace'].includes(pathFor(run)[run.chapter])?'crossing':['orrery','arbiter'].includes(pathFor(run)[run.chapter])?'archive':null;
export function currentChapter(run){const id=pathFor(run)[run.chapter];return id?chapterFor(id):{...CHAPTER_BY_BOSS[routeGroup(run)==='crossing'?'warden':'weaver'],title:ROUTE_CHOICES[routeGroup(run)]?.title||'选择路线',isChoice:true};}
export const currentEvent=run=>CAMP_EVENTS[eventGroup(run)]||null;
export const routeOptions=run=>run.phase==='route'?ROUTE_CHOICES[routeGroup(run)]?.options||[]:[];
export function runRoute(run){return pathFor(run).map((id,index)=>({index,id,bossId:id,chapter:id?chapterFor(id):null,choices:index===6||index===9?ROUTE_CHOICES[index===6?'crossing':'archive'].options:[],cleared:index<run.history.length,current:index===run.chapter,recruit:run.recruits.find(r=>r.after===id)?.heroId||null}));}
export const formalLearning=run=>run.chapter>=3||(run.history||[]).some(h=>h.bossId==='conduit');
const oldTrainingCount=(run,id)=>Math.min(3,(run.history||[]).filter(entry=>entry.partyIds?.includes(id)).length+(run.practiceWins?.[id]||0));
const V5_LEARNING_ORDER={knibbs:['shot','breathe','cover','focus','scatter'],apeilia:['blade','purify','reboot','eden','sentinel'],ric:['rune','shelter','bind','mend','crossing'],haart:['page','soothe','anchor','rest','relay'],qianxing:['spike','pulse','armor','repair','beam'],youmu:['scalpel','sterilize','firstaid','surgery','bloodoath'],patch:['keyblade','chargedslash','bookward','collate','fragments']};
export function trainingCount(run,id){return Math.max(formalLearning(run)?2:0,Math.min(3,(run.learnedBasics?.[id]??(2+oldTrainingCount(run,id)))-2));}
export function skillAccessFor(run){return Object.fromEntries(heroIds.map(id=>[id,[...LEARNING_ORDER[id].slice(0,2+trainingCount(run,id)),...SKILLS[id].filter(s=>s.unlockKey&&run.upgrades.includes(s.unlockKey)).map(s=>s.id)]]));}
function refreshLoadouts(run){
 run.learnedBasics??=Object.fromEntries(heroIds.map(id=>[id,2+oldTrainingCount(run,id)]));
 if(formalLearning(run))for(const id of heroIds)run.learnedBasics[id]=Math.max(4,run.learnedBasics[id]||2);
 run.loadouts=normalizeLoadouts(run.upgrades,run.loadouts,skillAccessFor(run));
}
function learnOnce(run,ids){for(const id of ids)run.learnedBasics[id]=Math.min(5,2+trainingCount(run,id)+1);}
function settle(run){
 run.unlockedHeroes=run.gmAllHeroes?[...heroIds]:naturalHeroes(run);
 const size=Math.min(3,naturalHeroes(run).length);
 run.partyIds=[...new Set([...run.partyIds,...naturalHeroes(run)])].filter(id=>run.unlockedHeroes.includes(id)).slice(0,size);
 if(!run.unlockedHeroes.includes(run.focusHero))run.focusHero=run.partyIds[0];
 refreshLoadouts(run);delete run.gmBattleParty;
 return run;
}
export function createLearningRun(difficulty='standard',{gmAllHeroes=false,seed}={}){
 if(!Object.hasOwn(DIFFICULTIES,difficulty))difficulty='standard';
 const run={version:6,id:String(Date.now()),seed:Number.isInteger(seed)?seed>>>0:Math.floor(Math.random()*4294967296),difficulty,chapter:0,phase:'dialogue',dialogue:'before',line:0,legacyRoute:false,routes:{crossing:null,archive:null},events:{crossing:null,archive:null},partyIds:['knibbs'],unlockedHeroes:['knibbs'],recruits:[],practiceWins:{},learnedBasics:Object.fromEntries(heroIds.map(id=>[id,2])),skirmishHistory:[],interludesDone:[],rewardHistory:[],upgrades:[],loadouts:{},history:[],battle:null,lastReward:null,lastLearning:[],focusHero:'knibbs',...(gmAllHeroes?{gmAllHeroes:true}:{})};
 return settle(run);
}
export function unlockRunHeroes(run){run.gmAllHeroes=true;run.unlockedHeroes=[...heroIds];delete run.gmBattleParty;return run;}
export function disableRunHeroes(run){delete run.gmAllHeroes;run.unlockedHeroes=naturalHeroes(run);if(run.phase==='battle'&&(run.partyIds.some(id=>!run.unlockedHeroes.includes(id))||run.drill&&!run.unlockedHeroes.includes(run.drill.heroId)))run.gmBattleParty=true;else settle(run);return run;}

export function pickThree(options,key){
 let seed=2166136261;for(const char of String(key))seed=Math.imul(seed^char.charCodeAt(0),16777619)>>>0;
 const list=[...options];for(let i=list.length-1;i>0;i--){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const j=seed%(i+1);[list[i],list[j]]=[list[j],list[i]];}
 return list.slice(0,3);
}
function offerAt(run,bossId,owned=run.upgrades){
 const index=pathFor(run).indexOf(bossId);
 const unlocked=run.gmAllHeroes?heroIds:['knibbs',...run.recruits.filter(r=>pathFor(run).indexOf(r.after)<=index).map(r=>r.heroId)];
 const pool=Object.values(REWARDS).filter(r=>unlocked.includes(r.heroId)&&!owned.includes(r.id));
 return pickThree(pool,`${run.seed}/${bossId}/${owned.length}`);
}
export const rewardOptions=run=>run.phase==='reward'?offerAt(run,currentChapter(run).bossId):[];
const RECRUIT_GROUPS=[['apeilia','ric'],['apeilia','ric'],['haart','youmu'],['haart','youmu'],['qianxing','patch'],['qianxing','patch']];
export function recruitOptions(run){
 if(run.phase!=='recruit')return [];
 const owned=naturalHeroes(run),group=RECRUIT_GROUPS[run.recruits.length]||[];
 let ids=group.filter(id=>!owned.includes(id));
 // Older saves may have invited someone outside the new order. Fill the next
 // missing group without removing or postponing anyone already recruited.
 if(!ids.length)ids=[...new Set(RECRUIT_GROUPS.flat())].filter(id=>!owned.includes(id)).slice(0,2);
 return ids.map(id=>HEROES.find(h=>h.id===id));
}
function moveOn(run){run.chapter++;run.phase=pathFor(run)[run.chapter]?'camp':'route';run.dialogue='before';run.line=0;run.battle=null;delete run.interlude;delete run.skirmish;settle(run);}
function afterDialogue(run){
 if(recruitAfter.includes(currentChapter(run).bossId)&&naturalHeroes(run).length<7){run.phase='recruit';return;}
 if(isTutorial(currentChapter(run).bossId)){moveOn(run);return;}
 run.phase=currentEvent(run)?'event':'reward';
}
export function chooseCompanion(run,id){
 if(!recruitOptions(run).some(h=>h.id===id))return {ok:false,error:'请选择一位尚未同行的角色。'};
 run.recruits.push({heroId:id,after:currentChapter(run).bossId});run.focusHero=id;settle(run);
 if(isTutorial(currentChapter(run).bossId))moveOn(run);else run.phase='reward';
 return {ok:true,heroId:id};
}
export function endingForRun(run){
 const scores={rescue:0,evidence:0,infrastructure:0};
 scores[run.routes.crossing==='furnace'?'infrastructure':'rescue']++;scores[run.routes.archive==='orrery'?'evidence':'rescue']++;
 let last='rescue';for(const group of ['crossing','archive']){const event=CAMP_EVENTS[group].options.find(o=>o.id===run.events[group]);if(event){scores[event.score]+=2;last=event.score;}}
 const id=Object.keys(scores).sort((a,b)=>scores[b]-scores[a]||(a===last?-1:b===last?1:0))[0];return {...ENDINGS[id],scores};
}
export function runDialogue(run){
 if(run.dialogue==='skirmish')return SKIRMISH_STORIES[run.skirmish?.afterBossId]||[];
 if(run.dialogue==='route')return ROUTE_CHOICES[routeGroup(run)]?.options.find(o=>o.id===run.routes[routeGroup(run)])?.lines||[];
 if(run.dialogue==='event')return currentEvent(run)?.options.find(o=>o.id===run.events[eventGroup(run)])?.lines||[];
 if(run.dialogue==='ending')return endingForRun(run).lines;
 return currentChapter(run)?.[run.dialogue]||[];
}
export function dialogueNextLabel(run){if(run.line<runDialogue(run).length-1)return '继续对话';if(['before','skirmish'].includes(run.dialogue))return '进入战斗';if(run.dialogue==='ending')return '结束远征';if(run.dialogue==='route')return '进入整备';if(currentChapter(run).bossId==='final')return '看看后来';if(recruitAfter.includes(currentChapter(run).bossId))return '选择下一位同伴';return isTutorial(currentChapter(run).bossId)?'查看新学会的技能':currentEvent(run)?'安排接下来的工作':'三选一，领取成长';}
export function advanceDialogue(run,skip=false){
 if(run.phase!=='dialogue')return false;if(!skip&&run.line<runDialogue(run).length-1){run.line++;return true;}run.line=0;
 if(['before','skirmish'].includes(run.dialogue))run.phase='battle';else if(run.dialogue==='route')run.phase='camp';else if(run.dialogue==='ending')run.phase='complete';else if(run.dialogue==='event')run.phase='reward';else if(currentChapter(run).bossId==='final'){run.dialogue='ending';run.phase='dialogue';}else afterDialogue(run);
 return true;
}
export function consequenceNotes(run){const id=currentChapter(run).bossId,notes=[];if(id==='golem'){if(run.routes.crossing==='tide')notes.push('水闸排水：敌方初始韧性 −18');if(run.routes.crossing==='furnace')notes.push('隔热护具：全员初始护盾 +10');if(run.events.crossing==='triage')notes.push('急救接力：全员初始护盾 +18');if(run.events.crossing==='supply')notes.push('独立照明：敌方初始韧性 −24');if(run.events.crossing==='log')notes.push('传动标记：敌方首轮伤害 −20%');}if(id==='final'){if(run.routes.archive==='orrery')notes.push('时序校验：敌方初始屏障 −1');if(run.routes.archive==='arbiter')notes.push('撤销追击：敌方首轮伤害 −20%');if(run.events.archive==='rescue')notes.push('额外护具：全员初始护盾 +24');if(run.events.archive==='evidence')notes.push('许可撤回：敌方初始屏障 −1');if(run.events.archive==='repair')notes.push('独立接地：敌方初始韧性 −24');}return notes;}
export function battleForRun(run,previewHero){
 let partyIds=run.drill?[run.drill.heroId]:[...run.partyIds];if(previewHero&&!partyIds.includes(previewHero))partyIds=[previewHero,...partyIds.slice(0,-1)];
 const battle=createBattle(run.difficulty,run.drill?.bossId||run.skirmish?.bossId||currentChapter(run).bossId,{partyIds,upgrades:run.upgrades,loadouts:run.loadouts,skillAccess:skillAccessFor(run)});
 if(run.drill)return battle;
 const boss=battle.boss,shield=n=>battle.heroes.forEach(h=>grantShield(h,n));
 if(boss.id==='golem'){if(run.routes.crossing==='tide')boss.stagger-=18;if(run.routes.crossing==='furnace')shield(10);if(run.events.crossing==='triage')shield(18);if(run.events.crossing==='supply')boss.stagger-=24;if(run.events.crossing==='log')boss.weakened=1;}
 if(boss.id==='final'){if(run.routes.archive==='orrery')boss.seals--;if(run.routes.archive==='arbiter')boss.weakened=1;if(run.events.archive==='rescue')shield(24);if(run.events.archive==='evidence')boss.seals--;if(run.events.archive==='repair')boss.stagger-=24;boss.seals=Math.max(0,boss.seals);}
 return battle;
}
function recordLearning(run,before){const access=skillAccessFor(run);run.lastLearning=heroIds.filter(id=>run.unlockedHeroes.includes(id)).flatMap(id=>access[id].filter(skill=>!before[id].includes(skill)).map(skillId=>({heroId:id,skillId})));refreshLoadouts(run);}
export function completeEncounter(run,battle){
 if(run.phase!=='battle'||battle.mode!=='victory')return false;
 const before=skillAccessFor(run);
 if(run.drill){if(battle.boss.id!==run.drill.bossId||battle.heroes.length!==1||battle.heroes[0].id!==run.drill.heroId)return false;const id=run.drill.heroId;learnOnce(run,[id]);run.practiceWins[id]=Math.min(3,(run.practiceWins[id]||0)+1);delete run.drill;run.battle=null;run.phase='camp';recordLearning(run,before);settle(run);return true;}
 if(run.skirmish){
  if(battle.boss.id!==run.skirmish.bossId||run.skirmishHistory.some(h=>h.afterBossId===run.skirmish.afterBossId))return false;
  learnOnce(run,battle.heroes.map(h=>h.id));run.skirmishHistory.push({...run.skirmish,partyIds:battle.heroes.map(h=>h.id),round:battle.round});delete run.skirmish;run.battle=null;run.dialogue='after';run.line=0;recordLearning(run,before);settle(run);afterDialogue(run);return true;
 }
 if(battle.boss.id!==pathFor(run)[run.chapter]||run.history.length!==run.chapter)return false;
 learnOnce(run,battle.heroes.map(h=>h.id));run.history.push({bossId:battle.boss.id,round:battle.round,damage:battle.stats.damage,breaks:battle.stats.breaks,partyIds:battle.heroes.map(h=>h.id)});
 run.phase='dialogue';run.dialogue='after';run.line=0;run.battle=null;recordLearning(run,before);if(!run.gmAllHeroes)settle(run);
 if(!isTutorial(battle.boss.id))beginInterlude(run,battle.boss.id);
 return true;
}
export function advanceInterlude(run,skip=false){const before=skillAccessFor(run),result=advanceWalkingDialogue(run,skip);if(result.practice){learnOnce(run,run.partyIds);recordLearning(run,before);}return result;}
export function finishInterlude(run){
 if(!canFinishInterlude(run))return {ok:false,error:interludeFor(run)?.exit.open?'走到出口再继续。':'先把这里的事情处理好。'};
 const id=currentChapter(run).bossId;run.interludesDone.push(id);delete run.interlude;
 if(SKIRMISH_AFTER[id]&&!run.skirmishHistory.some(h=>h.afterBossId===id)){run.skirmish={afterBossId:id,bossId:SKIRMISH_AFTER[id]};run.phase='dialogue';run.dialogue='skirmish';run.line=0;return {ok:true,battle:true};}
 if(id==='final'){run.phase='dialogue';run.dialogue='ending';run.line=0;}else afterDialogue(run);
 return {ok:true};
}
export function claimReward(run,id){
 if(run.phase!=='reward'||!rewardOptions(run).some(r=>r.id===id))return {ok:false,error:'请从本次随机提供的三个奖励中选择一个。'};
 const reward=REWARDS[id];run.rewardHistory.push({bossId:currentChapter(run).bossId,id,gm:!!run.gmAllHeroes});run.upgrades.push(id);refreshLoadouts(run);
 let replaced=null;if(reward.kind==='skill'){const slots=run.loadouts[reward.heroId];if(!slots.includes(reward.skillId)){const index=Math.min(4,slots.length);replaced=slots[index]||null;slots[index]=reward.skillId;}run.focusHero=reward.heroId;}
 run.lastReward={id,replaced};moveOn(run);return {ok:true,reward};
}
export function chooseRoute(run,id){if(!routeOptions(run).some(o=>o.id===id))return {ok:false,error:'请选择这一处分岔开放的路线。'};run.routes[routeGroup(run)]=id;run.phase='dialogue';run.dialogue='route';run.line=0;return {ok:true};}
export function chooseEvent(run,id){const option=currentEvent(run)?.options.find(o=>o.id===id);if(run.phase!=='event'||!option||run.events[eventGroup(run)])return {ok:false,error:'这项安排现在不可选择。'};run.events[eventGroup(run)]=id;run.phase='dialogue';run.dialogue='event';run.line=0;return {ok:true};}
export function replacePartyMember(run,slot,id){if(run.phase!=='camp'||!Number.isInteger(slot)||slot<0||slot>=run.partyIds.length||!run.unlockedHeroes.includes(id))return false;const old=run.partyIds.indexOf(id),out=run.partyIds[slot];run.partyIds[slot]=id;if(old>=0&&old!==slot)run.partyIds[old]=out;run.focusHero=id;return true;}
export function equipSkill(run,id,slot,skillId){if(run.phase!=='camp'||!run.unlockedHeroes.includes(id)||!Number.isInteger(slot)||slot<0||slot>=run.loadouts[id].length)return {ok:false,error:'请在整备中选择已开放的技能位。'};if(!skillAccessFor(run)[id].includes(skillId))return {ok:false,error:'这项技能尚未学会；实战或间章操练可以学习基础技能。'};const old=run.loadouts[id].indexOf(skillId);if(old>=0){[run.loadouts[id][slot],run.loadouts[id][old]]=[run.loadouts[id][old],run.loadouts[id][slot]];return {ok:true,slot};}run.loadouts[id][slot]=skillId;return {ok:true,slot};}
export function startNextChapter(run){if(run.phase!=='camp')return false;settle(run);delete run.drill;run.phase='dialogue';run.dialogue=run.skirmish?'skirmish':'before';run.line=0;run.battle=null;return true;}
export function startPractice(run,id){if(run.phase!=='camp'||!run.unlockedHeroes.includes(id)||trainingCount(run,id)>=3)return {ok:false,error:'该角色已学齐基础技能，或当前不能演练。'};run.drill={heroId:id,bossId:id==='knibbs'?'scout':id==='apeilia'||id==='ric'||id==='youmu'?'bulwark':'conduit'};run.phase='battle';run.battle=null;return {ok:true};}
export function regroup(run){if(run.phase!=='battle')return false;delete run.drill;run.phase='camp';run.battle=null;run.dialogue='before';run.line=0;settle(run);return true;}
export function storyHistory(run){
 const entries=[];for(const [index,id]of pathFor(run).entries()){if(!id||index>run.chapter)continue;const chapter=chapterFor(id),group=index===6?'crossing':index===9?'archive':null;
  if(group&&run.routes[group]){const choice=ROUTE_CHOICES[group].options.find(o=>o.id===run.routes[group]);entries.push({title:'路线决定 · '+choice.name,lines:index===run.chapter&&run.dialogue==='route'?choice.lines.slice(0,run.line+1):choice.lines});if(index===run.chapter&&run.dialogue==='route')continue;}
  for(const part of ['before','after']){
   if(index===run.chapter&&['camp','route'].includes(run.phase)&&!run.skirmish)continue;
   if(index===run.chapter&&part==='after'&&run.history.length<=index)continue;
   if(part==='after'&&(run.interludesDone?.includes(id)||run.interlude?.afterBossId===id)){
    const view=run.interlude?.afterBossId===id?interludeFor(run):null,heard=!view||view.done.includes('device')?interludeRequiredLines(id):view.talking==='device'?view.dialogue.slice(0,view.line+1):[];
    if(heard.length)entries.push({title:chapter.title+' · 战间探索',lines:heard});
   }else entries.push({title:chapter.title+' · '+(part==='before'?'战前':'战后'),lines:index===run.chapter&&run.phase==='dialogue'&&run.dialogue===part?chapter[part].slice(0,run.line+1):chapter[part]});
  }
  if(run.skirmishHistory?.some(h=>h.afterBossId===id)||run.skirmish?.afterBossId===id){const lines=SKIRMISH_STORIES[id];entries.push({title:chapter.title+' · 继续开路',lines:run.skirmish?.afterBossId===id&&run.phase==='dialogue'?lines.slice(0,run.line+1):lines});}
  if(group&&run.events[group]){const option=CAMP_EVENTS[group].options.find(o=>o.id===run.events[group]);entries.push({title:'战间安排 · '+option.name,lines:index===run.chapter&&run.dialogue==='event'?option.lines.slice(0,run.line+1):option.lines});}
 }if(run.dialogue==='ending'||run.phase==='complete')entries.push({title:endingForRun(run).title,lines:run.phase==='complete'?endingForRun(run).lines:endingForRun(run).lines.slice(0,run.line+1)});return entries;
}

export function normalizeLearningRun(value){
 if(!isLearningRun(value)||!Object.hasOwn(DIFFICULTIES,value.difficulty)||!Number.isInteger(value.seed)||value.seed<0||value.seed>4294967295||!Number.isInteger(value.chapter)||value.chapter<0||value.chapter>10)return null;
 if(!['dialogue','battle','reward','camp','route','event','recruit','explore','complete'].includes(value.phase)||!['before','after','route','event','ending','skirmish'].includes(value.dialogue))return null;
 const migrated=value.version===5,run=copy(value);run.version=6;run.id=String(value.id||'restored');run.legacyRoute=false;
 for(const group of ['crossing','archive']){if(!run.routes||!run.events)return null;if(run.routes[group]!==null&&!ROUTE_CHOICES[group].options.some(o=>o.id===run.routes[group]))return null;if(run.events[group]!==null&&!CAMP_EVENTS[group].options.some(o=>o.id===run.events[group]))return null;}
 if(!Array.isArray(run.history)||!Array.isArray(run.recruits)||!run.practiceWins||typeof run.practiceWins!=='object'||Array.isArray(run.practiceWins))return null;
 if(migrated){
  run.learnedBasics=Object.fromEntries(heroIds.map(id=>{
   const oldCount=2+oldTrainingCount(run,id),knownSkills=[...V5_LEARNING_ORDER[id].slice(0,oldCount),...(Array.isArray(run.loadouts?.[id])?run.loadouts[id]:[]),...(Array.isArray(run.battle?.skillAccess?.[id])?run.battle.skillAccess[id]:[])];
   return [id,Math.min(5,Math.max(oldCount,...knownSkills.map(skill=>LEARNING_ORDER[id].indexOf(skill)+1)))];
  }));
  run.skirmishHistory=[];run.interludesDone=[];
  if(run.drill&&run.learnedBasics[run.drill.heroId]===5)run.drill.resumeLearned=true;
 }
 if(!run.learnedBasics||typeof run.learnedBasics!=='object'||Array.isArray(run.learnedBasics)||heroIds.some(id=>!Number.isInteger(run.learnedBasics[id])||run.learnedBasics[id]<2||run.learnedBasics[id]>5)||Object.keys(run.learnedBasics).some(id=>!known(id)))return null;
 if(!Array.isArray(run.skirmishHistory)||!Array.isArray(run.interludesDone))return null;
 const path=pathFor(run),side=!!run.skirmish;
 if(side&&(!['dialogue','battle','camp'].includes(run.phase)||run.skirmish.afterBossId!==path[run.chapter]||SKIRMISH_AFTER[run.skirmish.afterBossId]!==run.skirmish.bossId||run.dialogue!=='skirmish'&&run.phase==='dialogue'))return null;
 const post=['reward','event','recruit','explore','complete'].includes(run.phase)||run.phase==='dialogue'&&['after','event','ending'].includes(run.dialogue)||side,won=run.chapter+(post?1:0);
 if(!Array.isArray(run.history)||run.history.length!==won||run.history.some((h,i)=>!h||h.bossId!==path[i]||!Number.isInteger(h.round)||h.round<1||h.round>9999||!Array.isArray(h.partyIds)||h.partyIds.length<1||h.partyIds.length>3||h.partyIds.some(id=>!known(id))||new Set(h.partyIds).size!==h.partyIds.length))return null;
 if(!Array.isArray(run.recruits)||run.recruits.length>6||new Set(run.recruits.map(r=>r.heroId)).size!==run.recruits.length||run.recruits.some((r,i)=>!known(r.heroId)||r.heroId==='knibbs'||r.after!==recruitAfter[i]||!run.history.some(h=>h.bossId===r.after)))return null;
 const tickets=run.history.filter(h=>recruitAfter.includes(h.bossId)).length;
 const recruitPending=recruitAfter.includes(path[run.chapter])&&(run.phase==='recruit'||run.phase==='explore'||side||run.phase==='dialogue'&&run.dialogue==='after');
 if(run.recruits.length!==tickets-(recruitPending?1:0))return null;
 if(run.phase==='recruit'&&!recruitAfter.includes(path[run.chapter]))return null;
 if(!run.practiceWins||typeof run.practiceWins!=='object'||Array.isArray(run.practiceWins)||Object.entries(run.practiceWins).some(([id,n])=>!known(id)||!Number.isInteger(n)||n<0||n>3))return null;
 if(!Array.isArray(run.upgrades)||new Set(run.upgrades).size!==run.upgrades.length||run.upgrades.some(id=>!REWARDS[id])||!Array.isArray(run.rewardHistory)||run.rewardHistory.length!==run.upgrades.length)return null;
 const rewardBosses=run.history.filter(h=>!isTutorial(h.bossId)&&h.bossId!=='final').map(h=>h.bossId),pending=['reward','event','recruit','explore'].includes(run.phase)||side||run.phase==='dialogue'&&['after','event'].includes(run.dialogue);
 if(run.upgrades.length!==rewardBosses.length-(pending&&!isTutorial(path[run.chapter])&&path[run.chapter]!=='final'?1:0))return null;
 for(const [i,entry]of run.rewardHistory.entries()){if(entry.bossId!==rewardBosses[i]||entry.id!==run.upgrades[i]||!offerAt({...run,gmAllHeroes:entry.gm===true},entry.bossId,run.upgrades.slice(0,i)).some(r=>r.id===entry.id))return null;}
 for(const [group,index]of [['crossing',6],['archive',9]]){if(run.chapter<index&&(run.routes[group]||run.events[group]))return null;if(run.chapter>index&&!run.routes[group])return null;if(run.chapter===index&&!run.routes[group]&&run.phase!=='route')return null;if(run.events[group]&&won<=index)return null;if(won>index&&!run.events[group]&&!(run.chapter===index&&(run.phase==='event'||run.phase==='explore'||run.phase==='dialogue'&&run.dialogue==='after')))return null;}
 if(run.phase==='route'&&(path[run.chapter]!==null||run.dialogue!=='before'))return null;if(run.phase==='event'&&(!eventGroup(run)||run.events[eventGroup(run)]))return null;
 if((run.phase==='complete'||run.dialogue==='ending')&&(run.chapter!==10||run.dialogue!=='ending'||!['dialogue','complete'].includes(run.phase)))return null;
 if(!Array.isArray(run.partyIds)||run.partyIds.length!==Math.min(3,naturalHeroes(run).length)||new Set(run.partyIds).size!==run.partyIds.length||run.partyIds.some(id=>!known(id)||!naturalHeroes(run).includes(id)&&!run.gmAllHeroes&&!(run.phase==='battle'&&run.gmBattleParty)))return null;
 run.unlockedHeroes=run.gmAllHeroes?heroIds:naturalHeroes(run);if(!run.unlockedHeroes.includes(run.focusHero)&&!run.partyIds.includes(run.focusHero))run.focusHero=run.partyIds[0];
 if(new Set(run.skirmishHistory.map(h=>h?.afterBossId)).size!==run.skirmishHistory.length||run.skirmishHistory.some(h=>!h||SKIRMISH_AFTER[h.afterBossId]!==h.bossId||!run.history.some(w=>w.bossId===h.afterBossId)||!Array.isArray(h.partyIds)||h.partyIds.length<1||h.partyIds.length>3||h.partyIds.some(id=>!known(id))||new Set(h.partyIds).size!==h.partyIds.length||!Number.isInteger(h.round)||h.round<1))return null;
 if(side&&run.skirmishHistory.some(h=>h.afterBossId===run.skirmish.afterBossId))return null;
 if(new Set(run.interludesDone).size!==run.interludesDone.length||run.interludesDone.some(id=>isTutorial(id)||!run.history.some(h=>h.bossId===id)))return null;
 if(run.phase==='explore'){if(run.dialogue!=='after'||run.interlude?.afterBossId!==path[run.chapter]||run.interludesDone.includes(path[run.chapter])||!normalizeInterlude(run))return null;}else if(run.interlude)return null;
 refreshLoadouts(run);run.lastLearning=Array.isArray(run.lastLearning)?run.lastLearning.filter(item=>known(item.heroId)&&skillAccessFor(run)[item.heroId].includes(item.skillId)):[];
 if(run.drill&&(run.phase!=='battle'||!run.unlockedHeroes.includes(run.drill.heroId)&&!run.gmBattleParty||!known(run.drill.heroId)||!isTutorial(run.drill.bossId)||trainingCount(run,run.drill.heroId)>=3&&!run.drill.resumeLearned))return null;
 const lines=runDialogue(run);run.line=Number.isInteger(run.line)?Math.max(0,Math.min(run.line,Math.max(0,lines.length-1))):0;if(run.phase==='dialogue'&&!lines.length)return null;
 if(run.phase==='battle'){
  // v5 migration adds learning access without resetting HP, AP or resources.
  if(migrated&&run.battle){run.battle.skillAccess=skillAccessFor(run);run.battle.loadouts=normalizeLoadouts(run.upgrades,run.battle.loadouts,run.battle.skillAccess);}
  const battle=normalizeSave(run.battle),ids=run.drill?[run.drill.heroId]:run.partyIds,bossId=run.drill?.bossId||run.skirmish?.bossId||path[run.chapter];
  if(battle&&battle.boss.id===bossId&&battle.difficulty===run.difficulty&&battle.heroes.map(h=>h.id).join(',')===ids.join(',')&&JSON.stringify(battle.skillAccess)===JSON.stringify(skillAccessFor(run))&&battle.upgrades.join(',')===run.upgrades.join(','))run.battle=battle;
  else {run.phase='camp';run.battle=null;delete run.drill;run.dialogue=side?'skirmish':'before';settle(run);}
 }
 else run.battle=null;
 return run;
}
