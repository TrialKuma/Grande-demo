import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,normalizeRun,battleForRun,advanceDialogue,completeEncounter,currentChapter,recruitOptions,chooseCompanion,rewardOptions,claimReward,startNextChapter,chooseRoute,routeOptions,chooseEvent,currentEvent,startPractice,replacePartyMember,skillAccessFor,trainingCount,equipSkill,unlockRunHeroes,disableRunHeroes,regroup,interludeFor,updateInterludePosition,interactInterlude,advanceInterlude,finishInterlude} from '../src/campaign.js';
import {HEROES,activeSkills,canUse} from '../src/combat.js';
import {normalizeProfile,rememberCompanions,rememberBossVictories,unlockAllBosses} from '../src/player-profile.js';
import {LEARNING_ORDER} from '../src/training.js';
import {campaignView} from '../src/campaign-ui.js';

function restore(run){
 if(run.battle)run.battle.elapsed??=0;
 const copy=normalizeRun(JSON.parse(JSON.stringify(run)));
 assert.ok(copy,`${run.chapter}/${run.phase}/${run.dialogue}`);
 assert.deepEqual(copy,run);return copy;
}
function enter(run){if(run.phase==='camp')startNextChapter(run);advanceDialogue(run,true);assert.equal(run.phase,'battle');run.battle=battleForRun(run);restore(run);}
function win(run){const battle=run.battle||battleForRun(run);assert.equal(completeEncounter(run,{...battle,mode:'victory'}),true);restore(run);}
function finishDialogue(run){advanceDialogue(run,true);restore(run);}
function recruit(run,id){assert.ok(recruitOptions(run).some(h=>h.id===id));assert.equal(chooseCompanion(run,id).ok,true);restore(run);}

test('new expedition starts with one hero, two usable skills and 3 AP; profile unlocks only Knibbs',()=>{
 const run=createRun('standard',{seed:37});restore(run);
 assert.equal(run.version,6);assert.deepEqual(run.partyIds,['knibbs']);assert.deepEqual(run.unlockedHeroes,['knibbs']);
 const b=battleForRun(run);assert.equal(b.boss.id,'scout');assert.equal(b.ap,3);
 assert.deepEqual(activeSkills(b,'knibbs').map(s=>s.id),['shot','focus']);assert.match(canUse(b,'knibbs','breathe'),/尚未|学习/);
 assert.deepEqual(normalizeProfile(null).unlockedHeroes,['knibbs']);
 assert.equal(unlockAllBosses(null).unlockedBosses.length,10);
});

for(const order of [['apeilia','ric','haart','youmu','qianxing','patch'],['ric','apeilia','youmu','haart','patch','qianxing']]){
 for(const routes of [['tide','orrery'],['furnace','arbiter']])test(`11 fights restore through every phase: ${order[0]}, ${routes.join('/')}`,()=>{
  let run=createRun('standard',{seed:371});let nextRecruit=0,route=0;
  for(let step=0;step<130&&run.phase!=='complete';step++){
   restore(run);
   if(run.phase==='camp'){startNextChapter(run);continue;}
   if(run.phase==='route'){assert.ok(routeOptions(run).some(o=>o.id===routes[route]));assert.equal(chooseRoute(run,routes[route++]).ok,true);continue;}
   if(run.phase==='dialogue'){
    advanceDialogue(run,true);if(run.phase==='battle')run.battle=battleForRun(run);continue;
   }
   if(run.phase==='battle'){win(run);continue;}
   if(run.phase==='explore'){const view=interludeFor(run);updateInterludePosition(run,view.objects[0].position);interactInterlude(run,'device');advanceInterlude(run,true);updateInterludePosition(run,view.exit.position);assert.equal(finishInterlude(run).ok,true);continue;}
   if(run.phase==='recruit'){recruit(run,order[nextRecruit++]);continue;}
   if(run.phase==='event'){assert.equal(chooseEvent(run,currentEvent(run).options[0].id).ok,true);continue;}
   if(run.phase==='reward'){
    const options=rewardOptions(run);assert.equal(options.length,3);assert.equal(new Set(options.map(o=>o.id)).size,3);
    assert.equal([...campaignView(run).matchAll(/data-reward="/g)].length,3);
    assert.deepEqual(rewardOptions(restore(run)),options);assert.ok(options.every(o=>!run.upgrades.includes(o.id)&&run.unlockedHeroes.includes(o.heroId)));
    assert.equal(claimReward(run,options[step%3].id).ok,true);continue;
   }
   assert.fail(`Unexpected phase ${run.phase}`);
  }
  restore(run);assert.equal(run.phase,'complete');assert.equal(run.history.length,11);assert.equal(run.upgrades.length,7);assert.equal(run.recruits.length,6);assert.equal(run.partyIds.length,3);
  assert.deepEqual(run.recruits.map(r=>r.heroId),order);
  const p=rememberBossVictories(rememberCompanions(normalizeProfile(null),run),run);assert.equal(p.unlockedHeroes.length,7);assert.equal(p.defeatedBosses.length,8);assert.ok(!p.defeatedBosses.includes('scout'));
 });
}

test('party grows from one to two to three; skill learning follows participation and practice',()=>{
 const run=createRun('standard',{seed:21});enter(run);win(run);finishDialogue(run);recruit(run,'apeilia');
 assert.equal(run.partyIds.length,2);assert.equal(battleForRun(run).ap,4);assert.equal(skillAccessFor(run).knibbs.length,3);assert.equal(skillAccessFor(run).apeilia.length,2);
 assert.equal(equipSkill(run,'apeilia',0,'eden').ok,false);
 const history=structuredClone(run.history);assert.equal(startPractice(run,'apeilia').ok,true);run.battle=battleForRun(run);restore(run);
 assert.equal(run.battle.heroes.length,1);assert.equal(run.battle.ap,3);assert.equal(run.battle.boss.id,'bulwark');win(run);
 assert.equal(run.phase,'camp');assert.deepEqual(run.history,history);assert.equal(trainingCount(run,'apeilia'),1);assert.equal(skillAccessFor(run).apeilia.length,3);assert.equal(run.upgrades.length,0);
 enter(run);win(run);finishDialogue(run);assert.equal(run.phase,'camp');enter(run);win(run);finishDialogue(run);recruit(run,'ric');
 assert.equal(run.partyIds.length,3);assert.equal(battleForRun(run).ap,6);assert.equal(skillAccessFor(run).ric.length,4);assert.equal(skillAccessFor(run).apeilia.length,5);
 assert.equal(startPractice(run,'apeilia').ok,false);assert.equal(skillAccessFor(run).knibbs.length,7);
});

test('GM off preserves earned learning but does not keep unchosen companions in party',()=>{
 const run=createRun('standard',{seed:2});enter(run);win(run);finishDialogue(run);recruit(run,'ric');unlockRunHeroes(run);
 assert.equal(startPractice(run,'patch').ok,true);run.battle=battleForRun(run);win(run);disableRunHeroes(run);restore(run);
 assert.ok(!run.unlockedHeroes.includes('patch'));assert.equal(trainingCount(run,'patch'),1);assert.ok(!run.partyIds.includes('patch'));
 const forged=structuredClone(run);forged.partyIds[1]='patch';assert.equal(normalizeRun(forged),null);
});

test('all seven learning orders contain unique base skills including Knibbs ammo choices; old saves retain route and clamp dialogue cursor',()=>{
 for(const [id,skills]of Object.entries(LEARNING_ORDER)){const count=id==='knibbs'?7:5;assert.equal(skills.length,count);assert.equal(new Set(skills).size,count);}
 const run=createRun('standard',{skipTutorial:true});run.line=22;const restored=normalizeRun(run);assert.ok(restored);assert.equal(restored.version,4);assert.equal(currentChapter(restored).bossId,'duelist');assert.ok(restored.line<=9);
});

test('closing GM during a borrowed hero practice allows completion or safe regroup before retry',()=>{
 const run=createRun('standard',{seed:9});enter(run);win(run);finishDialogue(run);recruit(run,'ric');unlockRunHeroes(run);
 replacePartyMember(run,0,'patch');startPractice(run,'patch');run.battle=battleForRun(run);disableRunHeroes(run);
 restore(run);assert.equal(run.gmBattleParty,true);assert.equal(run.battle.heroes[0].id,'patch');
 const completed=structuredClone(run);win(completed);assert.deepEqual(completed.partyIds,['ric','knibbs']);assert.equal(completed.practiceWins.patch,1);restore(completed);
 assert.equal(regroup(run),true);assert.equal(startPractice(run,'patch').ok,false);assert.equal(run.phase,'camp');assert.ok(!run.partyIds.includes('patch'));assert.equal(run.drill,undefined);restore(run);
});
