import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,activeSkills} from '../src/combat.js';
import {createRun,unlockRunHeroes,disableRunHeroes,normalizeRun,advanceDialogue,battleForRun,completeEncounter,rewardOptions,claimReward,replacePartyMember,equipSkill,startNextChapter,regroup,chooseRoute,chooseEvent} from '../src/campaign.js';

const all=HEROES.map(hero=>hero.id);
function restore(run){
  const before=structuredClone(run),restored=normalizeRun(JSON.parse(JSON.stringify(run)));
  assert.ok(restored,`${run.chapter}/${run.phase}/${run.dialogue}`);
  assert.deepEqual(restored,run);assert.deepEqual(run,before,'Restoring never mutates the original save');
  return restored;
}
function toFirstReward(run){
  advanceDialogue(run,true);run.battle=battleForRun(run);run.battle.elapsed=0;
  assert.equal(completeEncounter(run,{...run.battle,mode:'victory'}),true);
  advanceDialogue(run,true);
  return run;
}
function toFirstCamp(run){
  toFirstReward(run);assert.equal(claimReward(run,'knibbs_ricochet').ok,true);
  return run;
}

test('GM roster: unlocking a live expedition changes only access metadata and is idempotent',()=>{
  const run=createRun();advanceDialogue(run,true);run.battle=battleForRun(run);run.battle.elapsed=18;
  const before=structuredClone(run),battle=run.battle,history=run.history,upgrades=run.upgrades;
  assert.equal(unlockRunHeroes(run),run);assert.equal(run.battle,battle);assert.equal(run.history,history);assert.equal(run.upgrades,upgrades);
  assert.deepEqual(run,{...before,gmAllHeroes:true,unlockedHeroes:all});
  const unlocked=structuredClone(run);assert.equal(unlockRunHeroes(run),run);assert.deepEqual(run,unlocked);restore(run);
  assert.equal(replacePartyMember(run,0,'patch'),false,'GM does not allow swapping in the middle of combat');
  assert.equal(regroup(run),true);assert.equal(replacePartyMember(run,0,'patch'),true);restore(run);
  assert.deepEqual(battleForRun(run).heroes.map(hero=>hero.id),run.partyIds);
});

test('GM roster: all seven companions can swap at camp and restore without granting skill rewards',()=>{
  for(const legacyRoute of [false,true]){
    const run=toFirstCamp(createRun('standard',{legacyRoute,gmAllHeroes:true}));
    const upgrades=[...run.upgrades],loadouts=structuredClone(run.loadouts);
    for(const heroId of all){
      assert.equal(replacePartyMember(run,0,heroId),true);assert.equal(new Set(run.partyIds).size,3);
      assert.equal(run.partyIds[0],heroId);restore(run);
      const battle=battleForRun(run);assert.equal(battle.heroes[0].id,heroId);assert.equal(activeSkills(battle,heroId).length,5);
    }
    const locked=equipSkill(run,'patch',0,'revelation');
    assert.equal(locked.ok,false);assert.match(locked.error,/尚未通过战斗奖励解锁/);
    assert.deepEqual(run.upgrades,upgrades);assert.deepEqual(run.loadouts,loadouts);
    assert.deepEqual(run.unlockedHeroes,all);
  }
});

test('GM roster: every transition on both expedition formats preserves access and valid progress',()=>{
  for(const legacyRoute of [false,true]){
    let run=createRun('standard',{legacyRoute,gmAllHeroes:true});
    for(let steps=0;steps<100;steps++){
      if(run.phase==='battle'&&!run.battle){run.battle=battleForRun(run);run.battle.elapsed=0;}
      run=restore(run);assert.deepEqual(run.unlockedHeroes,all);assert.equal(run.gmAllHeroes,true);
      if(run.phase==='complete')break;
      if(run.phase==='dialogue')advanceDialogue(run,true);
      else if(run.phase==='camp'){
        assert.equal(replacePartyMember(run,0,'patch'),true);assert.equal(replacePartyMember(run,1,'haart'),true);
        assert.equal(startNextChapter(run),true);
      }else if(run.phase==='battle')assert.equal(completeEncounter(run,{...run.battle,mode:'victory'}),true);
      else if(run.phase==='route')assert.equal(chooseRoute(run,run.chapter===3?'furnace':'arbiter').ok,true);
      else if(run.phase==='event')assert.equal(chooseEvent(run,run.chapter===3?'supply':'repair').ok,true);
      else if(run.phase==='reward')assert.equal(claimReward(run,rewardOptions(run)[0].id).ok,true);
      else assert.fail(`Unexpected phase ${run.phase}`);
    }
    assert.equal(run.phase,'complete');assert.equal(run.history.length,legacyRoute?6:8);assert.equal(run.upgrades.length,legacyRoute?5:7);
  }
});

test('GM roster: recruitment overrides do not bypass chapter, reward, party, or skill validation',()=>{
  for(const legacyRoute of [false,true]){
    const plain=createRun('standard',{legacyRoute}),gm=createRun('standard',{legacyRoute,gmAllHeroes:true});
    assert.equal(Object.hasOwn(plain,'gmAllHeroes'),false);
    assert.equal(normalizeRun({...plain,unlockedHeroes:all,partyIds:['patch','haart','qianxing']}),null);
    for(const flag of [false,'true',1,{},[]])assert.equal(normalizeRun({...plain,gmAllHeroes:flag,partyIds:['patch','haart','qianxing']}),null);
    for(const change of [{chapter:1},{partyIds:['patch','patch','ric']},{partyIds:['unknown','haart','ric']},{upgrades:['patch_archive']},{history:[{bossId:'duelist',round:1}]}])assert.equal(normalizeRun({...gm,...change}),null);
    toFirstReward(gm);toFirstReward(plain);
    assert.deepEqual(rewardOptions(gm),rewardOptions(plain),'GM does not add unrelated reward offers');
    assert.equal(claimReward(gm,'knibbs_ricochet').ok,true);const camp=gm;
    const invalid=structuredClone(camp);invalid.upgrades=['patch_archive'];assert.equal(normalizeRun(invalid),null);
  }
});

test('GM roster: old six-fight saves can adopt all heroes without losing legacy progress',()=>{
  const current=toFirstCamp(createRun('standard',{legacyRoute:true}));
  for(const version of [2,3]){
    const old={...structuredClone(current),version};delete old.routes;delete old.events;delete old.legacyRoute;
    unlockRunHeroes(old);old.partyIds=['patch','haart','qianxing'];old.focusHero='patch';
    const restored=normalizeRun(old);assert.ok(restored);assert.equal(restored.gmAllHeroes,true);assert.equal(restored.legacyRoute,true);
    assert.equal(restored.chapter,current.chapter);assert.deepEqual(restored.history,current.history);assert.deepEqual(restored.upgrades,current.upgrades);
    assert.deepEqual(restored.partyIds,old.partyIds);assert.deepEqual(restored.unlockedHeroes,all);restore(restored);
  }
});

test('GM roster: closing at camp retains natural recruitment and sanitizes the next party on both routes',()=>{
  for(const legacyRoute of [false,true]){
    const run=toFirstCamp(createRun('standard',{legacyRoute,gmAllHeroes:true}));
    replacePartyMember(run,0,'patch');replacePartyMember(run,1,'haart');replacePartyMember(run,2,'youmu');
    const history=structuredClone(run.history),upgrades=[...run.upgrades];
    assert.equal(disableRunHeroes(run),run);assert.equal(run.gmAllHeroes,undefined);
    assert.deepEqual(run.unlockedHeroes,['knibbs','apeilia','ric','youmu']);
    assert.deepEqual(run.partyIds,['youmu','knibbs','apeilia']);
    assert.deepEqual(run.history,history);assert.deepEqual(run.upgrades,upgrades);restore(run);
    assert.equal(replacePartyMember(run,0,'patch'),false);assert.equal(replacePartyMember(run,0,'youmu'),true);
  }
});

test('GM roster: disabling during battle preserves actors on reload, then applies recruitment on victory or defeat',()=>{
  for(const legacyRoute of [false,true])for(const victory of [false,true]){
    const run=toFirstCamp(createRun('standard',{legacyRoute,gmAllHeroes:true}));
    replacePartyMember(run,0,'patch');replacePartyMember(run,1,'qianxing');replacePartyMember(run,2,'haart');
    startNextChapter(run);advanceDialogue(run,true);run.battle=battleForRun(run);run.battle.elapsed=15;
    const battle=structuredClone(run.battle),party=[...run.partyIds];
    disableRunHeroes(run);assert.equal(run.gmBattleParty,true);assert.deepEqual(run.battle,battle);assert.deepEqual(run.partyIds,party);
    const restored=restore(run);
    if(victory)completeEncounter(restored,{...restored.battle,mode:'victory'});else regroup(restored);
    assert.equal(restored.gmBattleParty,undefined);
    assert.ok(restored.partyIds.every(id=>restored.unlockedHeroes.includes(id)));
    assert.equal(restored.unlockedHeroes.includes('haart'),victory);assert.equal(restored.unlockedHeroes.includes('patch'),false);
    restore(restored);
  }
});

test('GM roster: a closed-GM battle with missing or mismatched saved actors safely regroups without locked heroes',()=>{
  const run=toFirstCamp(createRun('standard',{gmAllHeroes:true}));replacePartyMember(run,0,'patch');
  startNextChapter(run);advanceDialogue(run,true);run.battle=battleForRun(run);disableRunHeroes(run);
  for(const broken of [null,{...run.battle,heroes:run.battle.heroes.slice(1)}]){
    const restored=normalizeRun({...run,battle:broken});assert.ok(restored);assert.equal(restored.phase,'camp');
    assert.equal(restored.gmBattleParty,undefined);assert.ok(!restored.partyIds.includes('patch'));
  }
  assert.equal(normalizeRun({...run,phase:'camp',battle:null}),null,'battle-only permission cannot unlock the camp');
});

test('GM rewards: early companion upgrades restore and survive closing GM without unlocking the companion',()=>{
  for(const legacyRoute of [false,true]){
    const run=toFirstCamp(createRun('standard',{legacyRoute,gmAllHeroes:true}));
    startNextChapter(run);advanceDialogue(run,true);run.battle=battleForRun(run);
    completeEncounter(run,{...run.battle,mode:'victory'});advanceDialogue(run,true);
    assert.ok(rewardOptions(run).some(r=>r.id==='qianxing_grounding'));
    assert.equal(claimReward(run,'qianxing_grounding').ok,true);assert.deepEqual(run.gmRewardKeys,['qianxing_grounding']);restore(run);
    disableRunHeroes(run);assert.ok(run.upgrades.includes('qianxing_grounding'));assert.ok(!run.unlockedHeroes.includes('qianxing'));restore(run);
    const invalid=structuredClone(run);delete invalid.gmRewardKeys;assert.equal(normalizeRun(invalid),null);
    const oldGm={...invalid,gmAllHeroes:true,unlockedHeroes:all};assert.deepEqual(normalizeRun(oldGm).gmRewardKeys,['qianxing_grounding'],'older GM rewards acquire provenance during migration');
  }
});
