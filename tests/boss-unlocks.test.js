import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSSES,createBattle,prepareResponse,endRound} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {normalizeProfile,rememberCompanions,rememberBossVictories,unlockAllHeroes,disableAllHeroes,unlockAllBosses,disableAllBosses,canChallengeBoss,normalizeChallengeBoss} from '../src/player-profile.js';
import {gmToolsView,progressResetView,resetGameProgress,GAME_PROGRESS_KEYS} from '../src/gm-tools.js';
import {titleView} from '../src/interface.js';
import {createRun,advanceDialogue,battleForRun,completeEncounter} from '../src/campaign.js';
import {campaignEntry} from '../src/campaign-ui.js';

const all=Object.keys(BOSSES),victory=(bossId,extra={})=>({bossId,round:3,...extra});
const view=(profile,prefs={},saved=null)=>titleView({bossId:'final',difficulty:'standard',...prefs},saved,'',[],campaignEntry(null),profile);
const listed=markup=>[...markup.matchAll(/data-boss="([^"]+)"/g)].map(match=>match[1]);

test('boss access: fresh and old character-only GM profiles do not unlock any enemy',()=>{
  for(const value of [null,{version:2,gmAllHeroes:true,unlockedHeroes:['knibbs','apeilia','ric','haart','qianxing','youmu','patch']},{unlockedBosses:all}]){
    const profile=normalizeProfile(value);assert.deepEqual(profile.defeatedBosses,[]);assert.deepEqual(profile.unlockedBosses,[]);assert.equal(normalizeChallengeBoss(profile,'final'),null);
    assert.ok(all.every(id=>!canChallengeBoss(profile,id)));
  }
  for(const flag of ['true',1,{},[]])assert.deepEqual(normalizeProfile({gmAllBosses:flag}).unlockedBosses,[]);
});

test('boss access: character and boss GM switches are independent, pure and reversible',()=>{
  const earned=rememberBossVictories(normalizeProfile({naturalHeroes:['youmu']}),null,[victory('duelist')]),before=structuredClone(earned);
  const characters=unlockAllHeroes(earned);assert.deepEqual(characters.unlockedBosses,['duelist']);
  const bosses=unlockAllBosses(earned);assert.deepEqual(bosses.unlockedHeroes,earned.unlockedHeroes);assert.deepEqual(bosses.defeatedBosses,['duelist']);assert.deepEqual(bosses.unlockedBosses,all);
  const both=unlockAllBosses(characters);assert.deepEqual(disableAllBosses(both),characters);assert.deepEqual(disableAllHeroes(both,null),bosses);
  assert.deepEqual(disableAllBosses(bosses),earned);assert.deepEqual(unlockAllBosses(bosses),bosses);assert.deepEqual(earned,before);
  assert.deepEqual(normalizeProfile(JSON.parse(JSON.stringify(both))),both);
});

test('boss access: eleven legacy victory records and current expedition history migrate without loss or duplicates',()=>{
  const records=Array.from({length:11},(_,index)=>victory(all[index%all.length],{at:index+1,damage:200}));
  const old={version:2,naturalHeroes:['knibbs','apeilia','ric','youmu'],unlockedHeroes:['knibbs','apeilia','ric','youmu'],gmAllHeroes:false};
  const run={history:[victory('duelist'),victory('cantor')]},before=structuredClone({records,old,run});
  const profile=rememberBossVictories(old,run,records);assert.deepEqual(profile.defeatedBosses,all);assert.deepEqual(profile.unlockedBosses,all);assert.equal(profile.gmAllBosses,undefined);assert.ok(profile.naturalHeroes.includes('youmu'));
  assert.deepEqual(rememberBossVictories(profile,run,records),profile);assert.deepEqual({records,old,run},before);
  assert.deepEqual(rememberBossVictories(profile,createRun(),[]).defeatedBosses,all,'a new journey or trimmed records cannot forget a victory');
});

test('boss access: selection, running battles, defeat records and invalid data never count as victories',()=>{
  const rejected=[victory('final',{result:'defeat'}),victory('final',{mode:'playing'}),victory('final',{round:0}),victory('final',{round:1.5}),victory('final',{round:10000}),victory('final',{result:false}),victory('toString'),{bossId:'final'},null];
  const profile=rememberBossVictories(null,{bossId:'final',gmAllBosses:true,unlockedBosses:all,battle:createBattle('standard','final'),history:rejected},rejected);
  assert.deepEqual(profile.defeatedBosses,[]);assert.deepEqual(profile.unlockedBosses,[]);
  assert.deepEqual(rememberCompanions(profile,{gmAllBosses:true,unlockedBosses:all}),profile);
});

test('boss access: a real victory while GM is open stays unlocked after closing and ordinary saving',()=>{
  const open=unlockAllBosses(null),won=rememberBossVictories(open,null,[victory('warden',{result:'victory'})]);
  const closed=disableAllBosses(won);assert.deepEqual(closed.defeatedBosses,['warden']);assert.deepEqual(closed.unlockedBosses,['warden']);
  assert.equal(normalizeChallengeBoss(closed,'final'),'warden');assert.equal(normalizeChallengeBoss(closed,'warden'),'warden');assert.equal(canChallengeBoss(closed,'final'),false);
  assert.deepEqual(rememberBossVictories(closed,{gmAllBosses:true,unlockedBosses:all},[]),closed);
});

test('boss access: campaign victory is remembered at completion without waiting for a reward or next chapter',()=>{
  const run=createRun();advanceDialogue(run,true);const battle=battleForRun(run);
  assert.deepEqual(rememberBossVictories(null,run).defeatedBosses,[]);
  assert.equal(completeEncounter(run,{...battle,mode:'victory'}),true);
  assert.deepEqual(rememberBossVictories(null,run).defeatedBosses,['duelist']);assert.equal(run.phase,'dialogue');
});

test('boss access: closing GM does not mutate or invalidate a current fight, but blocks a new challenge',()=>{
  const state=createBattle('standard','final');prepareResponse(state,'evade','knibbs');const before=structuredClone(state),profile=disableAllBosses(unlockAllBosses(null));
  assert.equal(canChallengeBoss(profile,state.boss.id),false);assert.equal(normalizeChallengeBoss(profile,state.boss.id),null);assert.deepEqual(state,before);
  const restored=normalizeSave(JSON.parse(JSON.stringify(state)));assert.ok(restored);assert.deepEqual(endRound(restored),endRound(state));
  assert.match(view(profile,{},restored),/data-action="continue"/);assert.deepEqual(listed(view(profile)),[]);
});

test('boss access: title only lists allowed enemies and empty state offers a new expedition',()=>{
  const fresh=view(normalizeProfile(null));assert.deepEqual(listed(fresh),[]);assert.match(fresh,/还没有解锁自由挑战/);assert.match(fresh,/data-action="journey-start"/);assert.doesNotMatch(fresh,/data-action="start"/);
  const earned=rememberBossVictories(null,null,[victory('duelist')]),single=view(earned);assert.deepEqual(listed(single),['duelist']);assert.match(single,/小队挑战 · 折镜刃卫/);assert.doesNotMatch(single,/小队挑战 · 归零之核/);
  assert.deepEqual(listed(view(unlockAllHeroes(earned))),['duelist']);assert.deepEqual(listed(view(unlockAllBosses(earned))),all);
  assert.doesNotMatch(view({...earned,unlockedBosses:['<script>']}),/<script>/);
});

test('boss access: GM provides a separate switch and progress reset clears both access modes while retaining sound settings',()=>{
  const both=unlockAllBosses(unlockAllHeroes(rememberBossVictories(null,null,[victory('duelist')]))),markup=gmToolsView(both);
  assert.match(markup,/data-action="gm-disable"/);assert.match(markup,/data-action="gm-boss-disable"/);assert.match(gmToolsView(unlockAllHeroes(null)),/data-action="gm-boss-unlock"/);assert.match(markup,/实际获胜仍会永久解锁/);
  assert.match(progressResetView(),/角色、BOSS 两个 GM 开关/);
  const data=new Map(GAME_PROGRESS_KEYS.map(key=>[key,JSON.stringify(both)]));data.set('grande-crystal-prefs-v1','retained');const result=resetGameProgress({removeItem:key=>data.delete(key)},{music:false,voice:true,muted:true,volume:.32});
  assert.deepEqual(result.profile.defeatedBosses,[]);assert.deepEqual(result.profile.unlockedBosses,[]);assert.equal(result.profile.gmAllHeroes,undefined);assert.equal(result.profile.gmAllBosses,undefined);assert.equal(result.prefs.volume,.32);assert.deepEqual([...data.keys()],['grande-crystal-prefs-v1']);
});
