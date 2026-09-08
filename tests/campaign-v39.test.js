import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,normalizeRun,battleForRun,currentChapter,advanceDialogue,completeEncounter,recruitOptions,chooseCompanion,routeOptions,chooseRoute,currentEvent,chooseEvent,rewardOptions,claimReward,startNextChapter,interludeFor,interactInterlude,advanceInterlude,finishInterlude,updateInterludePosition,skillAccessFor,trainingCount,startPractice,equipSkill,regroup,disableRunHeroes,storyHistory} from '../src/campaign.js';
import {campaignView} from '../src/campaign-ui.js';
import {earnedCompanions} from '../src/roster-unlocks.js';
import {TUTORIAL_CHAPTERS} from '../src/tutorial-story.js';
import {allInterludeLines} from '../src/interludes.js';
import {allStoryLines} from '../src/story.js';

function restore(run){if(run.battle)run.battle.elapsed??=0;const restored=normalizeRun(structuredClone(run));assert.ok(restored,`${run.chapter}/${run.phase}/${run.dialogue}`);assert.deepEqual(restored,run);return restored;}
function win(run){const battle=run.battle||battleForRun(run);assert.equal(completeEncounter(run,{...battle,mode:'victory'}),true);}
function walkTalk(run,id){const view=interludeFor(run),target=view.objects.find(o=>o.id===id);updateInterludePosition(run,target.position);assert.equal(interactInterlude(run,id).ok,true);restore(run);advanceInterlude(run,true);restore(run);}
function walkExit(run){updateInterludePosition(run,interludeFor(run).exit.position);assert.equal(finishInterlude(run).ok,true);}
function step(run,choice=0){
 if(run.phase==='camp')startNextChapter(run);
 else if(run.phase==='dialogue'){advanceDialogue(run,true);if(run.phase==='battle')run.battle=battleForRun(run);}
 else if(run.phase==='battle')win(run);
 else if(run.phase==='recruit'){const choices=recruitOptions(run);assert(choices.length>=1&&choices.length<=2);chooseCompanion(run,choices[Math.min(choice,choices.length-1)].id);}
 else if(run.phase==='reward')claimReward(run,rewardOptions(run)[0].id);
 else if(run.phase==='event')chooseEvent(run,currentEvent(run).options[0].id);
 else if(run.phase==='route')chooseRoute(run,routeOptions(run)[choice].id);
 else if(run.phase==='explore'){walkTalk(run,'device');walkExit(run);}
 else assert.fail(run.phase);
}
function to(run,predicate,choice=0){for(let n=0;n<200&&!predicate(run);n++)step(run,choice);assert(predicate(run));return run;}

for(const choice of [0,1])test(`v6 full route round-trips all phases with walking, three skirmishes and bounded recruitment (${choice})`,()=>{
 const run=createRun('standard',{seed:390+choice});
 assert.equal(run.version,6);assert.deepEqual(earnedCompanions(run),['knibbs']);
 for(let n=0;n<200&&run.phase!=='complete';n++){
  restore(run);
  if(run.chapter>=3)for(const id of run.unlockedHeroes)assert(skillAccessFor(run)[id].length>=4,id);
  if(run.phase==='reward')assert.equal(rewardOptions(run).length,3);
  step(run,choice);
 }
 restore(run);assert.equal(run.phase,'complete');assert.equal(run.history.length,11);assert.equal(run.skirmishHistory.length,3);assert.equal(run.interludesDone.length,8);assert.equal(run.upgrades.length,7);assert.equal(run.recruits.length,6);assert.equal(earnedCompanions(run).length,7);
 assert.deepEqual(new Set(run.recruits.slice(0,2).map(r=>r.heroId)),new Set(['apeilia','ric']));
 assert.deepEqual(new Set(run.recruits.slice(2,4).map(r=>r.heroId)),new Set(['haart','youmu']));
 assert.deepEqual(new Set(run.recruits.slice(4).map(r=>r.heroId)),new Set(['qianxing','patch']));
});

test('walking requires proximity, blocks exit until the device conversation finishes, and restores mid-dialogue',()=>{
 const run=to(createRun(),r=>r.phase==='explore');
 assert.equal(interactInterlude(run,'device').ok,false);assert.equal(finishInterlude(run).ok,false);
 const target=interludeFor(run).objects[0];updateInterludePosition(run,target.position);interactInterlude(run,'device');advanceInterlude(run);restore(run);
 const dialogueMarkup=campaignView(run);assert.match(dialogueMarkup,/data-action="voice-replay"/);assert.match(dialogueMarkup,/data-action="voice-toggle"/);assert.match(dialogueMarkup,/class="voice-status" role="status"/);
 assert.equal(interludeFor(run).line,1);assert.equal(interludeFor(run).exit.open,false);
 advanceInterlude(run,true);assert.equal(interludeFor(run).exit.open,true);assert.equal(finishInterlude(run).ok,false);
 walkExit(run);assert.equal(run.dialogue,'skirmish');assert.equal(run.skirmish.bossId,'patrol');restore(run);
});

test('late companion starts at four skills and learns the fifth with one interlude practice',()=>{
 const run=to(createRun(),r=>r.phase==='camp'&&r.recruits.length===3);
 const id=run.recruits[2].heroId;assert.equal(run.learnedBasics[id],4);
 run.partyIds[2]=id;run.focusHero=id;restore(run);
 to(run,r=>r.phase==='explore');
 // This companion may already learn during the battle. Use a newly available
 // four-skill reserve to verify the optional field lesson independently.
 const learner=Object.keys(run.learnedBasics).find(id=>run.learnedBasics[id]===4);
 const oldParty=[...run.partyIds];run.partyIds[2]=learner;run.gmAllHeroes=true;run.unlockedHeroes=Object.keys(run.learnedBasics);
 const upgrades=[...run.upgrades],history=structuredClone(run.history);walkTalk(run,'practice');
 assert.equal(skillAccessFor(run)[learner].length,5);assert.deepEqual(run.upgrades,upgrades);assert.deepEqual(run.history,history);
 assert.equal(interactInterlude(run,'practice').ok,false);run.partyIds=oldParty;
});

test('one personal drill teaches a formal-stage recruit its fifth skill without growth or story wins',()=>{
 const run=to(createRun(),r=>r.phase==='camp'&&r.recruits.length===3),id=run.recruits[2].heroId;
 const history=structuredClone(run.history),upgrades=[...run.upgrades];assert.equal(trainingCount(run,id),2);
 assert.equal(startPractice(run,id).ok,true);run.battle=battleForRun(run);restore(run);win(run);restore(run);
 assert.equal(trainingCount(run,id),3);assert.deepEqual(run.history,history);assert.deepEqual(run.upgrades,upgrades);assert.equal(startPractice(run,id).ok,false);
});

test('defeated skirmish resumes the skirmish, never repeats the won formal boss or its reward',()=>{
 const run=to(createRun(),r=>r.phase==='battle'&&!!r.skirmish);const history=structuredClone(run.history);
 assert.equal(regroup(run),true);restore(run);assert.equal(battleForRun(run).boss.id,'patrol');
 startNextChapter(run);advanceDialogue(run,true);run.battle=battleForRun(run);win(run);restore(run);
 assert.deepEqual(run.history,history);assert.equal(run.skirmishHistory.length,1);assert.equal(run.upgrades.length,0);assert.equal(run.phase,'recruit');
});

test('equipSkill swaps occupied slots and camp markup provides unlocked drag sources',()=>{
 const run=to(createRun(),r=>r.phase==='camp'&&r.chapter===3),id='knibbs';
 run.focusHero=id;const old=[...run.loadouts[id]];assert.equal(equipSkill(run,id,0,old[2]).ok,true);
 assert.equal(run.loadouts[id][0],old[2]);assert.equal(run.loadouts[id][2],old[0]);assert.equal(new Set(run.loadouts[id]).size,old.length);restore(run);
 const markup=campaignView(run);assert.match(markup,/draggable="true" data-drag-owner="knibbs" data-drag-skill=/);assert.match(markup,/data-drag-slot="0"/);
});

test('v5 migration keeps arbitrary existing recruits, learned skills, rewards and in-flight battle values',()=>{
 const run=to(createRun(),r=>r.phase==='camp'&&r.chapter===3);run.version=5;delete run.learnedBasics;delete run.skirmishHistory;delete run.interludesDone;
 run.recruits=[{heroId:'patch',after:'scout'},{heroId:'haart',after:'conduit'}];run.partyIds=['knibbs','patch','haart'];run.focusHero='patch';
 run.history[1].partyIds=['knibbs','patch'];run.history[2].partyIds=['knibbs','patch'];
 const migrated=normalizeRun(run);assert.ok(migrated);assert.deepEqual(migrated.recruits,run.recruits);assert.deepEqual(migrated.partyIds,run.partyIds);assert.equal(migrated.version,6);assert(skillAccessFor(migrated).patch.length>=4);
 startNextChapter(migrated);advanceDialogue(migrated,true);migrated.battle=battleForRun(migrated);migrated.battle.elapsed=12;migrated.battle.heroes[0].hp-=7;migrated.battle.ap=2;
 migrated.version=5;delete migrated.learnedBasics;delete migrated.skirmishHistory;delete migrated.interludesDone;
 const active=normalizeRun(migrated);assert.ok(active);assert.equal(active.phase,'battle');assert.equal(active.battle.heroes[0].hp,migrated.battle.heroes[0].hp);assert.equal(active.battle.ap,2);assert.equal(active.battle.elapsed,12);
});

test('tutorial dialogue is short human conversation and every interlude line enters the voice catalogue',()=>{
 for(const chapter of TUTORIAL_CHAPTERS)for(const part of ['before','after']){assert(chapter[part].length>=5&&chapter[part].length<=8);for(const line of chapter[part])assert(!/\bAP\b|行动点|资源转化|三选一|二级资源|技能位/.test(line.text),line.text);}
 const keys=new Set(allStoryLines().map(l=>l.speaker+'\n'+l.text));for(const line of allInterludeLines())assert(keys.has(line.speaker+'\n'+line.text));
});

test('v5 migration preserves learned skills moved later in the v6 learning order',()=>{
 const run=to(createRun(),r=>r.phase==='camp'&&r.chapter===3);run.version=5;
 delete run.learnedBasics;delete run.skirmishHistory;delete run.interludesDone;
 run.recruits=[{heroId:'youmu',after:'scout'},{heroId:'qianxing',after:'conduit'}];run.partyIds=['knibbs','youmu','qianxing'];run.focusHero='youmu';
 run.history[1].partyIds=['knibbs','youmu'];run.history[2].partyIds=['knibbs','youmu'];run.loadouts.youmu=['scalpel','sterilize','firstaid','surgery'];
 const migrated=normalizeRun(run);assert.ok(migrated);assert(skillAccessFor(migrated).youmu.includes('firstaid'));assert(migrated.loadouts.youmu.includes('firstaid'));restore(migrated);
});

test('turning GM off during an interlude keeps the active NPC conversation and restores the natural party',()=>{
 const run=to(createRun('standard',{gmAllHeroes:true}),r=>r.phase==='camp'&&r.chapter===3);
 run.partyIds=['knibbs','patch','haart'];to(run,r=>r.phase==='explore');
 const view=interludeFor(run);assert.equal(view.objects[1].heroId,'patch');updateInterludePosition(run,view.objects[1].position);interactInterlude(run,'companion');advanceInterlude(run);
 const text=interludeFor(run).dialogue[1].text;disableRunHeroes(run);restore(run);
 assert.deepEqual(run.partyIds,['knibbs','apeilia','ric']);assert.equal(interludeFor(run).dialogue[1].text,text);assert.equal(interludeFor(run).objects[1].heroId,'patch');
});

test('story history records heard walking dialogue instead of the replaced legacy after-battle scene',()=>{
 const run=to(createRun(),r=>r.phase==='explore');
 assert(!storyHistory(run).some(e=>/战间探索/.test(e.title)));
 const view=interludeFor(run);updateInterludePosition(run,view.objects[0].position);interactInterlude(run,'device');advanceInterlude(run);
 assert.deepEqual(storyHistory(run).at(-1).lines,view.objects[0].dialogue.slice(0,2));
 advanceInterlude(run,true);walkExit(run);const history=storyHistory(run);
 assert.deepEqual(history.find(e=>/战间探索/.test(e.title)).lines,view.objects[0].dialogue);
 assert(!history.some(e=>e.title===currentChapter(run).title+' · 战后'));
 assert.equal(history.at(-1).lines.length,1);
});
