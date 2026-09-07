import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,HEROES} from '../src/combat.js';
import {createRun,currentChapter,pathFor,runRoute,runDialogue,advanceDialogue,battleForRun,completeEncounter,rewardOptions,claimReward,startNextChapter,chooseRoute,chooseEvent,routeOptions,currentEvent,endingForRun,normalizeRun,storyHistory,consequenceNotes,regroup} from '../src/campaign.js';
import {campaignView,campaignEntry} from '../src/campaign-ui.js';
import {ALL_CHAPTERS,CHAPTERS,ROUTE_CHOICES,CAMP_EVENTS,ENDINGS,allStoryLines,STORY_SPEAKERS} from '../src/story.js';

const planDefault={crossing:'tide',archive:'orrery',crossingEvent:'triage',archiveEvent:'rescue'};
const copy=value=>structuredClone(value);
const label=run=>`${run.chapter}/${run.phase}/${run.dialogue}`;
function check(run){
  const before=copy(run),restored=normalizeRun(JSON.parse(JSON.stringify(run)));
  assert.ok(restored,label(run));assert.deepEqual(restored,run,label(run));
  if(run.phase!=='battle')assert.doesNotMatch(campaignView(run),/undefined|NaN|\[object Object\]/,label(run));
  assert.deepEqual(run,before,'Restoring, reading, and rendering never change progress');
}
function step(run,plan=planDefault){
  if(run.phase==='route')assert.equal(chooseRoute(run,plan[run.chapter===3?'crossing':'archive']).ok,true);
  else if(run.phase==='event')assert.equal(chooseEvent(run,plan[run.chapter===3?'crossingEvent':'archiveEvent']).ok,true);
  else if(run.phase==='camp')assert.equal(startNextChapter(run),true);
  else if(run.phase==='dialogue'){
    assert.ok(runDialogue(run).length>1,label(run));
    assert.equal(advanceDialogue(run,true),true);
    if(run.phase==='battle'){run.battle=battleForRun(run);run.battle.elapsed=0;}
  }else if(run.phase==='battle'){
    const battle={...run.battle,mode:'victory'};assert.equal(completeEncounter(run,battle),true);
  }else if(run.phase==='reward'){
    const options=rewardOptions(run);assert.ok(options.length>=1,label(run));assert.equal(claimReward(run,options[0].id).ok,true);
  }else throw new Error('Unexpected '+label(run));
  return run;
}
function reach(predicate,plan=planDefault){
  const run=createRun();for(let count=0;count<100;count++){
    check(run);if(predicate(run))return run;step(run,plan);
  }throw Error('Requested campaign state was not reached');
}
function finish(plan=planDefault){return reach(r=>r.phase==='complete',plan);}

for(const crossing of ['tide','furnace'])for(const archive of ['orrery','arbiter'])test(`campaign 3.3: ${crossing}/${archive} saves every transition for all nine event pairs`,()=>{
  for(const crossingEvent of ['triage','supply','log'])for(const archiveEvent of ['rescue','evidence','repair']){
    const run=finish({crossing,archive,crossingEvent,archiveEvent});
    assert.deepEqual(run.history.map(h=>h.bossId),['duelist','cantor','warden',crossing,'golem','weaver',archive,'final']);
    assert.equal(run.history.length,8);assert.equal(run.upgrades.length,7);assert.equal(new Set(run.upgrades).size,7);
    assert.equal(run.unlockedHeroes.length,7);assert.equal(run.partyIds.length,3);
    assert.equal(runDialogue(run),endingForRun(run).lines);
    const finished=copy(run);assert.equal(regroup(run),false);assert.equal(chooseRoute(run,'tide').ok,false);assert.equal(chooseEvent(run,'repair').ok,false);assert.deepEqual(run,finished);
  }
});

test('campaign 3.3: recruitment follows mandatory boss victories, with Patch after fight five',()=>{
  const run=createRun(),expected={duelist:'youmu',cantor:'haart',warden:'qianxing',golem:'patch'};
  while(run.phase!=='complete'){
    const before=[...run.unlockedHeroes],boss=currentChapter(run).bossId,phase=run.phase;
    step(run);
    if(phase==='battle'){
      assert.deepEqual(run.unlockedHeroes,expected[boss]?[...before,expected[boss]]:before);
      if(boss==='tide')assert.ok(!run.unlockedHeroes.includes('patch'));
      if(boss==='golem')assert.equal(run.history.length,5);
    }
  }
});

test('campaign 3.3: each route and event response has its own playable dialogue before the next screen',()=>{
  const run=reach(r=>r.phase==='route');
  assert.deepEqual(routeOptions(run).map(o=>o.id),['tide','furnace']);
  assert.equal(chooseRoute(run,'furnace').ok,true);assert.equal(run.dialogue,'route');assert.equal(run.phase,'dialogue');
  const first=runDialogue(run)[0];assert.equal(first.speaker,'qianxing');
  advanceDialogue(run);assert.equal(run.line,1);check(run);
  assert.equal(storyHistory(run).at(-1).lines.length,2);
  advanceDialogue(run,true);assert.equal(run.phase,'camp');check(run);assert.equal(storyHistory(run).at(-1).lines.length,3);
  const event=reach(r=>r.phase==='event');assert.equal(currentEvent(event),CAMP_EVENTS.crossing);
  assert.equal(chooseEvent(event,'supply').ok,true);assert.equal(event.dialogue,'event');
  assert.equal(event.phase,'dialogue');assert.equal(runDialogue(event),CAMP_EVENTS.crossing.options[1].lines);
  advanceDialogue(event);assert.equal(storyHistory(event).at(-1).lines.length,2);check(event);
  advanceDialogue(event,true);assert.equal(event.phase,'reward');check(event);assert.equal(storyHistory(event).at(-1).lines.length,3);
});

test('campaign 3.3: route and event choices cannot be taken early, changed, repeated, or used to bypass a boss',()=>{
  for(const run of [createRun(),reach(r=>r.phase==='route'),reach(r=>r.phase==='event')]){
    for(const id of ['not-a-route','constructor','final','repair']){
      const before=copy(run);assert.equal(chooseRoute(run,id).ok,false);assert.deepEqual(run,before);
    }
  }
  const run=reach(r=>r.phase==='route');assert.equal(startNextChapter(run),false);assert.equal(claimReward(run,'haart_echo').ok,false);
  assert.equal(chooseRoute(run,'tide').ok,true);const selected=copy(run);
  assert.equal(chooseRoute(run,'furnace').ok,false);assert.deepEqual(run,selected);
  const event=reach(r=>r.phase==='event');assert.equal(chooseEvent(event,'repair').ok,false);assert.equal(chooseEvent(event,'triage').ok,true);
  const chosen=copy(event);assert.equal(chooseEvent(event,'supply').ok,false);assert.deepEqual(event,chosen);
  const battleRun=reach(r=>r.phase==='battle'&&currentChapter(r).bossId==='tide');
  const wrongBoss=createBattle('standard','furnace');wrongBoss.mode='victory';assert.equal(completeEncounter(battleRun,wrongBoss),false);
  const safe=normalizeRun({...battleRun,routes:{...battleRun.routes,crossing:'furnace'}});
  assert.equal(safe.phase,'camp');assert.equal(safe.battle,null);assert.equal(safe.history.length,3,'Mismatched combat is discarded without crediting an unplayed encounter');
});

test('campaign 3.3: both choices alter actual next-battle state, stack once, and survive save restoration',()=>{
  for(const crossing of ['tide','furnace'])for(const crossingEvent of ['triage','supply','log']){
    const run=reach(r=>r.phase==='camp'&&currentChapter(r).bossId==='golem',{...planDefault,crossing,crossingEvent});
    const before=copy(run),battle=battleForRun(run),base=createBattle(run.difficulty,'golem',{partyIds:run.partyIds,upgrades:run.upgrades,loadouts:run.loadouts});
    assert.equal(battle.boss.stagger,base.boss.stagger-(crossing==='tide'?18:0)-(crossingEvent==='supply'?24:0));
    assert.equal(battle.boss.weakened,crossingEvent==='log'?1:0);
    assert.ok(battle.heroes.every((h,i)=>h.shield===base.heroes[i].shield+(crossing==='furnace'?10:0)+(crossingEvent==='triage'?18:0)));
    assert.equal(consequenceNotes(run).length,2);assert.deepEqual(battleForRun(run),battle);assert.deepEqual(run,before);
    startNextChapter(run);advanceDialogue(run,true);run.battle=battle;run.battle.elapsed=0;check(run);
  }
  for(const archive of ['orrery','arbiter'])for(const archiveEvent of ['rescue','evidence','repair']){
    const run=reach(r=>r.phase==='camp'&&currentChapter(r).bossId==='final',{...planDefault,archive,archiveEvent});
    const battle=battleForRun(run),base=createBattle(run.difficulty,'final',{partyIds:run.partyIds,upgrades:run.upgrades,loadouts:run.loadouts});
    assert.equal(battle.boss.seals,base.boss.seals-(archive==='orrery'?1:0)-(archiveEvent==='evidence'?1:0));
    assert.equal(battle.boss.stagger,base.boss.stagger-(archiveEvent==='repair'?24:0));
    assert.equal(battle.boss.weakened,archive==='arbiter'?1:0);
    assert.ok(battle.heroes.every((h,i)=>h.shield===base.heroes[i].shield+(archiveEvent==='rescue'?24:0)));
    assert.equal(consequenceNotes(run).length,2);
  }
});

test('campaign 3.3: priorities lead to three distinct aftermaths while every ending keeps rescued patients stable',()=>{
  const plans=[
    {crossing:'tide',archive:'arbiter',crossingEvent:'triage',archiveEvent:'rescue'},
    {crossing:'tide',archive:'orrery',crossingEvent:'log',archiveEvent:'evidence'},
    {crossing:'furnace',archive:'orrery',crossingEvent:'supply',archiveEvent:'repair'},
  ];
  for(const [index,plan]of plans.entries()){
    const run=finish(plan),id=['rescue','evidence','infrastructure'][index],ending=endingForRun(run);
    assert.equal(ending.id,id);assert.equal(ending.outcomes.patientsStable,true);
    assert.equal(ending.outcomes.caseFiled,id==='evidence');assert.equal(ending.outcomes.siteReopened,id==='infrastructure');
    assert.ok(campaignView(run).includes(ending.title));assert.equal(storyHistory(run).at(-1).title,ending.title);
    assert.ok(!storyHistory(run).some(entry=>Object.values(ENDINGS).filter(e=>e.id!==id).some(e=>entry.title===e.title)));
  }
});

test('campaign 3.3: save validation rejects impossible future choices, missing choices, and branch reward substitution',()=>{
  const start=createRun();
  for(const changed of [{routes:{crossing:'tide',archive:null}},{events:{crossing:'triage',archive:null}},{legacyRoute:false,version:3}]){
    const value={...start,...changed};
    if(changed.version===3){assert.equal(normalizeRun(value)?.legacyRoute,true);continue;}
    assert.equal(normalizeRun(value),null);
  }
  const after=reach(r=>r.phase==='camp'&&currentChapter(r).bossId==='golem');
  for(const mutate of [r=>r.routes.crossing=null,r=>r.events.crossing=null,r=>r.events.archive='repair',r=>r.history[3].bossId='furnace',r=>r.upgrades[3]='patch_archive',r=>r.partyIds=['patch','apeilia','ric']]){
    const bad=copy(after);mutate(bad);assert.equal(normalizeRun(bad),null);
  }
  const active=reach(r=>r.phase==='battle'&&currentChapter(r).bossId==='golem');
  const safe=normalizeRun({...active,battle:null});assert.ok(safe);assert.equal(safe.phase,'camp');assert.equal(safe.history.length,4);assert.equal(safe.upgrades.length,4);
});

test('campaign 3.3: completed old v1-v3 six-fight saves stay complete on their original route',()=>{
  const old=createRun('standard',{legacyRoute:true});
  while(old.phase!=='complete')step(old);
  for(const version of [1,2,3]){
    const source={...copy(old),version};delete source.routes;delete source.events;delete source.legacyRoute;
    const restored=normalizeRun(source);assert.ok(restored);assert.equal(restored.legacyRoute,true);assert.equal(restored.phase,'complete');
    assert.equal(restored.chapter,5);assert.equal(pathFor(restored).length,6);assert.equal(restored.history.length,6);assert.equal(restored.upgrades.length,5);
    assert.equal(currentChapter(restored).bossId,'final');check(restored);
  }
});

test('campaign 3.3: the map, events, recruitment gates, and entry advertise real available actions',()=>{
  assert.match(campaignEntry(null),/八场战斗/);assert.match(campaignEntry(null),/两处分岔/);
  const first=reach(r=>r.phase==='route'),map=runRoute(first),html=campaignView(first);
  assert.equal(map.length,8);assert.equal(map.filter(n=>n.choices.length===2).length,2);
  assert.deepEqual(map.filter(n=>n.recruit).map(n=>[n.index+1,n.recruit]),[[1,'youmu'],[2,'haart'],[3,'qianxing'],[5,'patch']]);
  assert.match(html,/data-action="choose-route" data-route="tide"/);assert.match(html,/data-action="choose-route" data-route="furnace"/);
  assert.match(html,/data-action="route-inspect" data-route="final"/);
  const event=reach(r=>r.phase==='event'),eventHtml=campaignView(event);
  for(const id of ['triage','supply','log'])assert.ok(eventHtml.includes(`data-action="choose-event" data-event="${id}"`));
});

test('campaign 3.3: the complete voice collection includes each original and branch dialogue with valid speakers',()=>{
  assert.equal(ALL_CHAPTERS.length,10);assert.equal(new Set(ALL_CHAPTERS.map(c=>c.bossId)).size,10);
  const lines=allStoryLines(),keys=new Set(lines.map(l=>l.speaker+'\n'+l.text));assert.equal(lines.length,362);assert.equal(keys.size,lines.length);
  const groups=[...CHAPTERS.flatMap(c=>[c.before,c.after]),...Object.values(ROUTE_CHOICES).flatMap(g=>g.options.map(o=>o.lines)),...Object.values(CAMP_EVENTS).flatMap(g=>g.options.map(o=>o.lines)),...Object.values(ENDINGS).map(e=>e.lines)];
  for(const group of groups)for(const line of group){assert.ok(keys.has(line.speaker+'\n'+line.text));assert.ok(STORY_SPEAKERS[line.speaker]||HEROES.some(h=>h.id===line.speaker));}
});
