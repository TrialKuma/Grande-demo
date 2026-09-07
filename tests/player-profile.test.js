import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeProfile,rememberCompanions,unlockAllHeroes,disableAllHeroes,isDialogueAdvanceGesture,STARTING_HEROES} from '../src/player-profile.js';
import {HEROES} from '../src/combat.js';

test('profile: recruited companions remain available after starting another expedition',()=>{
  const profile=rememberCompanions(null,{history:[{bossId:'duelist'},{bossId:'cantor'}]});
  assert.deepEqual(rememberCompanions(profile,{unlockedHeroes:['knibbs','apeilia','ric']}).unlockedHeroes,profile.unlockedHeroes);
  assert.deepEqual(normalizeProfile({unlockedHeroes:['unknown','youmu','youmu']}).unlockedHeroes,['knibbs','apeilia','ric','youmu']);
});

test('profile: GM unlock is explicit, pure, and survives remembering a fresh expedition',()=>{
  const profile=normalizeProfile({unlockedHeroes:['youmu']}),before=structuredClone(profile),all=HEROES.map(hero=>hero.id);
  const unlocked=unlockAllHeroes(profile);
  assert.notEqual(unlocked,profile);assert.deepEqual(profile,before);
  assert.equal(unlocked.gmAllHeroes,true);assert.deepEqual(unlocked.unlockedHeroes,all);
  assert.deepEqual(unlockAllHeroes(unlocked),unlocked);
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(unlocked))),unlocked);
  assert.deepEqual(rememberCompanions(unlocked,{unlockedHeroes:['knibbs','apeilia','ric']}),unlocked);
  assert.deepEqual(unlocked.naturalHeroes,[...STARTING_HEROES,'youmu']);
  assert.deepEqual(rememberCompanions(null,{gmAllHeroes:true,unlockedHeroes:all}).unlockedHeroes,STARTING_HEROES,'run access cannot turn GM on or award artificial recruitment');
});

test('profile: ordinary and invalid GM flags do not bypass the normal starting roster',()=>{
  const ordinary={version:3,naturalHeroes:[...STARTING_HEROES],unlockedHeroes:[...STARTING_HEROES],defeatedBosses:[],unlockedBosses:[]};
  assert.deepEqual(normalizeProfile(null),ordinary);
  for(const flag of [false,'true',1,{},[]])assert.deepEqual(normalizeProfile({gmAllHeroes:flag,unlockedHeroes:['unknown']}),ordinary);
  assert.deepEqual(rememberCompanions(null,{unlockedHeroes:[]}),ordinary);
});

test('profile: disabling GM preserves earned recruits, including recruits earned while GM was on',()=>{
  const previous=normalizeProfile({unlockedHeroes:['patch']});
  const gm=unlockAllHeroes(previous),before=structuredClone(gm);
  const run={gmAllHeroes:true,unlockedHeroes:HEROES.map(h=>h.id),history:[{bossId:'duelist'},{bossId:'cantor'}]};
  const closed=disableAllHeroes(gm,run);
  assert.deepEqual(gm,before);assert.equal(closed.gmAllHeroes,undefined);
  assert.deepEqual(closed.unlockedHeroes,[...STARTING_HEROES,'patch','youmu','haart']);
  assert.deepEqual(rememberCompanions(closed,run),closed,'saving a still-GM expedition must not re-enable access');
  assert.deepEqual(disableAllHeroes(unlockAllHeroes(closed),null),closed);
});

test('profile: legacy GM saves recover recruits from story history without keeping synthetic unlocks',()=>{
  const old={version:1,gmAllHeroes:true,unlockedHeroes:HEROES.map(h=>h.id)};
  const migrated=rememberCompanions(old,{history:[{bossId:'duelist'}],unlockedHeroes:HEROES.map(h=>h.id)});
  assert.equal(migrated.gmLegacyRecovery,true);
  assert.deepEqual(migrated.naturalHeroes,[...STARTING_HEROES,'youmu']);
  assert.deepEqual(disableAllHeroes(migrated,null).unlockedHeroes,[...STARTING_HEROES,'youmu']);
  assert.deepEqual(disableAllHeroes(old,null).unlockedHeroes,STARTING_HEROES);
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(migrated))),migrated);
});

test('dialogue gestures: blank click advances but controls, selection, drag and modal clicks do not',()=>{
  const normal={screen:'dialogue',modal:null,busy:false,interactive:false};
  assert.equal(isDialogueAdvanceGesture(normal),true);
  for(const override of [{interactive:true},{selectedText:'这句话'},{movement:12},{modal:'pause'},{busy:true},{screen:'camp'},{button:2},{detail:2}]){
    assert.equal(isDialogueAdvanceGesture({...normal,...override}),false,JSON.stringify(override));
  }
});
