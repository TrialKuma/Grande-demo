import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,createBattle,useSkill} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {normalizeChallengeParty,swapChallengeParty,resetGameProgress,GAME_PROGRESS_KEYS,gmToolsView,progressResetView} from '../src/gm-tools.js';
import {unlockAllHeroes,normalizeProfile} from '../src/player-profile.js';

test('challenge roster: normalization and swapping preserve three distinct available heroes',()=>{
  const available=HEROES.map(h=>h.id);
  assert.deepEqual(normalizeChallengeParty(['haart','haart','unknown']),['knibbs','apeilia','ric']);
  const original=['haart','youmu','patch'];
  assert.deepEqual(normalizeChallengeParty(original,available),original);
  assert.deepEqual(swapChallengeParty(original,0,'patch',available),['patch','youmu','haart']);
  assert.deepEqual(swapChallengeParty(original,1,'qianxing',available),['haart','qianxing','patch']);
  assert.deepEqual(swapChallengeParty(original,5,'qianxing',available),original);
  assert.deepEqual(swapChallengeParty(['knibbs','apeilia','ric'],0,'haart'),['knibbs','apeilia','ric']);
  assert.deepEqual(original,['haart','youmu','patch']);
});

test('GM reset: clears only Grande progress and restores starters while keeping all audio preferences',()=>{
  const values=new Map([...GAME_PROGRESS_KEYS.map(key=>[key,'old progress']),['grande-crystal-prefs-v1','audio preferences'],['other-game-save','keep me']]);
  const prefs={muted:true,music:false,voice:false,volume:.27,speed:2,partyIds:['patch','haart','qianxing'],soloHero:'patch'};
  const before=structuredClone(prefs);
  const result=resetGameProgress({removeItem:key=>values.delete(key)},prefs);
  assert.deepEqual(result.profile,normalizeProfile(null));assert.deepEqual(result.prefs.partyIds,['knibbs','apeilia','ric']);assert.equal(result.prefs.soloHero,'knibbs');
  for(const key of ['muted','music','voice','volume','speed'])assert.equal(result.prefs[key],prefs[key]);
  assert.deepEqual(prefs,before);assert.equal(values.size,2);assert.equal(values.get('other-game-save'),'keep me');assert.equal(values.get('grande-crystal-prefs-v1'),'audio preferences');
});

test('GM UI: all-open mode can be disabled and destructive reset has a separate confirmation screen',()=>{
  const initial=gmToolsView(null),opened=gmToolsView(unlockAllHeroes(null));
  assert.match(initial,/data-action="gm-unlock"/);assert.match(opened,/data-action="gm-disable"/);
  assert.match(initial,/data-action="progress-reset"/);assert.doesNotMatch(initial,/data-action="progress-reset-confirm"/);
  const confirm=progressResetView();assert.match(confirm,/data-action="progress-reset-confirm"/);assert.match(confirm,/取消，保留进度/);assert.match(confirm,/音量/);
});

test('challenge roster: selected nonstarter trio enters, acts, restores and restarts with initial skills',()=>{
  const partyIds=normalizeChallengeParty(['haart','youmu','patch'],HEROES.map(h=>h.id));
  const state=createBattle('standard','duelist',{mode:'party',partyIds});
  assert.deepEqual(state.heroes.map(h=>h.id),partyIds);assert.equal(state.maxAp,6);
  assert.deepEqual(state.upgrades,[]);
  for(const id of partyIds){
    assert.equal(state.loadouts[id].length,5);
    assert.ok(state.loadouts[id].every(key=>!SKILLS[id].find(s=>s.id===key).unlockKey));
    assert.equal(useSkill(state,id,state.loadouts[id][0]).ok,true);
  }
  const restored=normalizeSave(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(restored.heroes.map(h=>h.id),partyIds);
  const retry=createBattle(restored.difficulty,restored.boss.id,{mode:restored.challengeMode,partyIds:restored.heroes.map(h=>h.id)});
  assert.deepEqual(retry.heroes.map(h=>h.id),partyIds);assert.equal(retry.ap,6);
});
