import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARDS} from '../src/rewards.js';
import {createRun,advanceDialogue,battleForRun,completeEncounter,rewardOptions,claimReward,startNextChapter,chooseRoute,chooseEvent} from '../src/campaign.js';

function collectOffers({legacyRoute=false,crossing='tide',archive='orrery'}={}){
  const run=createRun('standard',{legacyRoute}),offered=new Set();
  for(let steps=0;steps<120&&run.phase!=='complete';steps++){
    if(run.phase==='dialogue')advanceDialogue(run,true);
    else if(run.phase==='battle')assert.equal(completeEncounter(run,{...battleForRun(run),mode:'victory'}),true);
    else if(run.phase==='reward'){
      const options=rewardOptions(run);for(const reward of options)offered.add(reward.id);
      assert.ok(options.length);assert.equal(claimReward(run,options[0].id).ok,true);
    }else if(run.phase==='camp')startNextChapter(run);
    else if(run.phase==='route')assert.equal(chooseRoute(run,run.chapter===3?crossing:archive).ok,true);
    else if(run.phase==='event')assert.equal(chooseEvent(run,run.chapter===3?'triage':'evidence').ok,true);
    else assert.fail(`Unhandled phase ${run.phase}`);
  }
  assert.equal(run.phase,'complete');return offered;
}

test('growth rewards: all 35 choices are naturally obtainable on both legacy and branching expeditions',()=>{
  const expected=Object.keys(REWARDS);assert.equal(expected.length,35);
  const legacy=collectOffers({legacyRoute:true});
  for(const id of expected)assert.ok(legacy.has(id),`Legacy route never offers ${id}`);
  const branching=new Set();
  for(const crossing of ['tide','furnace'])for(const archive of ['orrery','arbiter'])for(const id of collectOffers({crossing,archive}))branching.add(id);
  for(const id of expected)assert.ok(branching.has(id),`Branching routes never offer ${id}`);
  for(const heroId of ['knibbs','apeilia','ric','haart','qianxing','youmu','patch'])assert.equal(expected.filter(id=>REWARDS[id].heroId===heroId).length,5);
});
