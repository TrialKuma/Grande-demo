import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun,normalizeRun,battleForRun,advanceDialogue,completeEncounter,recruitOptions,chooseCompanion,routeOptions,chooseRoute,currentEvent,chooseEvent,rewardOptions,claimReward,startNextChapter,interludeFor,interactInterlude,advanceInterlude,finishInterlude,updateInterludePosition,unlockRunHeroes,disableRunHeroes,replacePartyMember} from '../src/campaign.js';
import {pickThree} from '../src/campaign-learning.js';
import {REWARDS,reconcileRewardOffer} from '../src/rewards.js';
import {earnedCompanions} from '../src/roster-unlocks.js';
import {unlockAllHeroes,normalizeProfile} from '../src/player-profile.js';

function step(run,choice=0){
 if(run.phase==='camp')startNextChapter(run);
 else if(run.phase==='dialogue')advanceDialogue(run,true);
 else if(run.phase==='battle')assert.equal(completeEncounter(run,{...battleForRun(run),mode:'victory'}),true);
 else if(run.phase==='recruit')assert.equal(chooseCompanion(run,recruitOptions(run)[Math.min(choice,recruitOptions(run).length-1)].id).ok,true);
 else if(run.phase==='reward')assert.equal(claimReward(run,rewardOptions(run)[0].id).ok,true);
 else if(run.phase==='event')chooseEvent(run,currentEvent(run).options[0].id);
 else if(run.phase==='route')chooseRoute(run,routeOptions(run)[choice].id);
 else if(run.phase==='explore'){
  const view=interludeFor(run);updateInterludePosition(run,view.objects.find(o=>o.id==='device').position);
  interactInterlude(run,'device');advanceInterlude(run,true);updateInterludePosition(run,view.exit.position);assert.equal(finishInterlude(run).ok,true);
 }else assert.fail(run.phase);
}
function reach(run,predicate,choice=0){for(let i=0;i<200&&!predicate(run);i++)step(run,choice);assert.ok(predicate(run));return run;}
const firstReward=(options={})=>reach(createRun('standard',{seed:41,...options}),r=>r.phase==='reward');
function roundTrip(run){const restored=normalizeRun(JSON.parse(JSON.stringify(run)));assert.ok(restored);assert.deepEqual(normalizeRun(restored),restored);return restored;}

test('reward eligibility follows this expedition recruitment, including reserves, rather than active slots or global/GM unlocks',()=>{
 const run=firstReward(),natural=earnedCompanions(run),unjoined=Object.values(REWARDS).find(r=>!natural.includes(r.heroId));
 assert.equal(natural.length,4);assert.equal(run.partyIds.length,3);
 const reserve=natural.find(id=>!run.partyIds.includes(id)),reserveReward=Object.values(REWARDS).find(r=>r.heroId===reserve);
 run.rewardOfferIds=[reserveReward.id,unjoined.id,'knibbs_steadyhands'];
 const initial=rewardOptions(run);assert.ok(initial.some(r=>r.heroId===reserve));assert.ok(initial.every(r=>natural.includes(r.heroId)));
 const profile=unlockAllHeroes(normalizeProfile(null));assert.equal(profile.unlockedHeroes.length,7);
 run.unlockedHeroes=[...profile.unlockedHeroes];unlockRunHeroes(run);
 assert.deepEqual(rewardOptions(run),initial);
 const before=structuredClone(run);assert.equal(claimReward(run,unjoined.id).ok,false);assert.deepEqual(run,before);
 assert.equal(claimReward(run,reserveReward.id).ok,true);assert.equal(run.rewardHistory.at(-1).gm,false);
 assert.equal(replacePartyMember(run,0,reserve),true);roundTrip(run);
});

test('invalid cached choices are replaced once while valid order, saved offer and later claim survive reloads',()=>{
 const original=firstReward({gmAllHeroes:true}),valid='knibbs_ricochet';
 original.rewardOfferIds=[valid,'patch_archive','does-not-exist',valid];
 const before=structuredClone(original),expected=rewardOptions(original).map(r=>r.id);
 assert.equal(expected.length,3);assert.equal(expected[0],valid);assert.deepEqual(original,before,'display is read-only');
 let restored=roundTrip(original);assert.deepEqual(restored.rewardOfferIds,expected);
 for(let i=0;i<4;i++){restored=roundTrip(restored);assert.deepEqual(rewardOptions(restored).map(r=>r.id),expected);}
 disableRunHeroes(restored);assert.deepEqual(rewardOptions(restored).map(r=>r.id),expected);
 assert.equal(claimReward(restored,expected[2]).ok,true);assert.equal(Object.hasOwn(restored,'rewardOfferIds'),false);
 assert.deepEqual(restored.rewardHistory.at(-1).offerIds,expected);roundTrip(restored);
 const forged=structuredClone(restored);forged.rewardHistory.at(-1).offerIds[0]='patch_archive';assert.equal(normalizeRun(forged),null);
});

test('uncached current offers and migrated v5 caches stay deterministic without including unchosen companions',()=>{
 const run=firstReward({gmAllHeroes:true}),expected=rewardOptions(run).map(r=>r.id);
 for(let i=0;i<3;i++)assert.deepEqual(rewardOptions(roundTrip(run)).map(r=>r.id),expected);
 const old=structuredClone(run);old.version=5;old.rewardOfferIds=['knibbs_crossfire','patch_archive','qianxing_nova'];
 const restored=roundTrip(old);assert.equal(restored.version,6);assert.equal(restored.rewardOfferIds[0],'knibbs_crossfire');
 assert.equal(restored.rewardOfferIds.length,3);assert.ok(rewardOptions(restored).every(r=>earnedCompanions(restored).includes(r.heroId)));
 assert.equal(claimReward(restored,restored.rewardOfferIds[0]).ok,true);roundTrip(restored);
});

for(const choice of [0,1])test(`GM-enabled branching expedition offers only recruited heroes and preserves every later claim (${choice})`,()=>{
 let run=createRun('standard',{seed:420+choice,gmAllHeroes:true}),count=0;
 for(let i=0;i<200&&run.phase!=='complete';i++){
  if(run.phase==='reward'){
   const options=rewardOptions(run),natural=earnedCompanions(run),before=structuredClone(run);count++;
   assert.equal(options.length,3);assert.ok(options.every(r=>natural.includes(r.heroId)&&!run.upgrades.includes(r.id)));
   assert.deepEqual(run,before);assert.deepEqual(rewardOptions(roundTrip(run)),options);
  }
  step(run,choice);
 }
 assert.equal(run.phase,'complete');assert.equal(count,7);assert.ok(run.rewardHistory.every(entry=>entry.gm===false));roundTrip(run);
});

test('previously claimed learning-format GM growth remains loadable after closing GM while the new offer is natural',()=>{
 const run=firstReward({gmAllHeroes:true});let legacyReward;
 for(let seed=0;seed<100&&!legacyReward;seed++){
  run.seed=seed;legacyReward=pickThree(Object.values(REWARDS),`${seed}/duelist/0`).find(r=>r.heroId==='qianxing'&&r.kind==='upgrade');
 }
 assert.ok(legacyReward);
 // Existing pre-fix save, already past its first reward screen.
 run.upgrades=[legacyReward.id];run.rewardHistory=[{bossId:'duelist',id:legacyReward.id,gm:true}];
 run.chapter++;run.phase='camp';run.dialogue='before';run.line=0;run.lastReward={id:legacyReward.id,replaced:null};
 let restored=roundTrip(run);disableRunHeroes(restored);restored=roundTrip(restored);
 assert.ok(restored.upgrades.includes(legacyReward.id));assert.ok(!restored.unlockedHeroes.includes('qianxing'));
 reach(restored,r=>r.phase==='reward');assert.ok(rewardOptions(restored).every(r=>earnedCompanions(restored).includes(r.heroId)));
 assert.equal(claimReward(restored,rewardOptions(restored)[0].id).ok,true);roundTrip(restored);
});

for(const legacyRoute of [true,false])test(`legacy expedition repairs a partial cached offer without granting early GM rewards (${legacyRoute})`,()=>{
 const run=firstReward({skipTutorial:true,legacyRoute,gmAllHeroes:true});
 run.rewardOfferIds=['knibbs_ricochet','haart_network','patch_archive'];
 let restored=roundTrip(run);assert.equal(restored.rewardOfferIds.length,3);assert.equal(restored.rewardOfferIds[0],'knibbs_ricochet');
 assert.ok(rewardOptions(restored).every(r=>earnedCompanions(restored).includes(r.heroId)));
 assert.equal(claimReward(restored,'haart_network').ok,false);assert.equal(claimReward(restored,restored.rewardOfferIds[0]).ok,true);
 assert.equal(Object.hasOwn(restored,'rewardOfferIds'),false);roundTrip(restored);
});

test('offer repair returns only the available distinct rewards when fewer than three remain',()=>{
 const pool=[REWARDS.knibbs_crossfire,REWARDS.knibbs_steadyhands];
 const draw=options=>pickThree(options,'nearly-exhausted');
 assert.deepEqual(reconcileRewardOffer(['patch_archive','knibbs_steadyhands','knibbs_steadyhands'],pool,draw).map(r=>r.id),['knibbs_steadyhands','knibbs_crossfire']);
 assert.deepEqual(reconcileRewardOffer(['knibbs_steadyhands'],[],draw),[]);
 assert.equal(Object.keys(REWARDS).length,35);
});
