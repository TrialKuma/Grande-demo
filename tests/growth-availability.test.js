import test from 'node:test';
import assert from 'node:assert/strict';
import {REWARDS} from '../src/rewards.js';
import {createRun as createCurrentRun,advanceDialogue,battleForRun,completeEncounter,rewardOptions,claimReward,startNextChapter,chooseRoute,chooseEvent} from '../src/campaign.js';

function collectOffers({legacyRoute=false,crossing='tide',archive='orrery',seed=0}={}){
  const run=createRun('standard',{legacyRoute,seed}),offered=new Set();
  for(let steps=0;steps<120&&run.phase!=='complete';steps++){
    if(run.phase==='dialogue')advanceDialogue(run,true);
    else if(run.phase==='battle')assert.equal(completeEncounter(run,{...battleForRun(run),mode:'victory'}),true);
    else if(run.phase==='reward'){
      const options=rewardOptions(run);for(const reward of options)offered.add(reward.id);
      assert.equal(options.length,3);assert.equal(claimReward(run,options[0].id).ok,true);
    }else if(run.phase==='camp')startNextChapter(run);
    else if(run.phase==='route')assert.equal(chooseRoute(run,run.chapter===3?crossing:archive).ok,true);
    else if(run.phase==='event')assert.equal(chooseEvent(run,run.chapter===3?'triage':'evidence').ok,true);
    else assert.fail(`Unhandled phase ${run.phase}`);
  }
  assert.equal(run.phase,'complete');return offered;
}

test('growth rewards: all 35 choices remain naturally obtainable across repeated three-choice legacy and branching expeditions',()=>{
  const expected=Object.keys(REWARDS);assert.equal(expected.length,35);
  const legacy=new Set();for(let seed=0;seed<50;seed++)for(const id of collectOffers({legacyRoute:true,seed}))legacy.add(id);
  for(const id of expected)assert.ok(legacy.has(id),`Legacy route never offers ${id}`);
  const branching=new Set();
  for(let seed=0;seed<20;seed++)for(const crossing of ['tide','furnace'])for(const archive of ['orrery','arbiter'])for(const id of collectOffers({crossing,archive,seed}))branching.add(id);
  for(const id of expected)assert.ok(branching.has(id),`Branching routes never offer ${id}`);
  for(const heroId of ['knibbs','apeilia','ric','haart','qianxing','youmu','patch'])assert.equal(expected.filter(id=>REWARDS[id].heroId===heroId).length,5);
});

const createRun=(difficulty='standard',options={})=>{const run=createCurrentRun(difficulty,{...options,skipTutorial:true});run.id='legacy-fixture-'+(options.seed||0);return run;};
