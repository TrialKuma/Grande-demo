import test from 'node:test';
import assert from 'node:assert/strict';
import {createRun as createCurrentRun,runDialogue,rewardOptions,battleForRun,advanceDialogue,completeEncounter,claimReward,replacePartyMember,equipSkill,startNextChapter,regroup,normalizeRun} from '../src/campaign.js';
import {CHAPTERS} from '../src/story.js';
import {REWARDS,activeSkills} from '../src/combat.js';

// Legacy six-fight saves retain their original route after the 3.3 expansion.
const createRun=(difficulty='standard')=>{
  const run=createCurrentRun(difficulty,{legacyRoute:true,skipTutorial:true});
  // Reward draws depend on run.id. This recorded seed actually offers the
  // ricochet skill needed by the loadout regression below.
  run.id='legacy-six-fixture-0';return run;
};

function restore(run){const copy=normalizeRun(JSON.parse(JSON.stringify(run)));assert.ok(copy,`${run.chapter}/${run.phase}/${run.dialogue}`);assert.deepEqual(copy,run);return copy;}
function beforeToBattle(run){assert.equal(advanceDialogue(run,true),true);assert.equal(run.phase,'battle');run.battle=battleForRun(run);run.battle.elapsed=0;return run;}
function fixtureWin(run){const battle=run.battle;const won={...battle,mode:'victory'};assert.equal(completeEncounter(run,won),true);return won;}

for(const rewardIndex of [0,1,2])test(`campaign: all six chapters restore at every stage, reward path ${rewardIndex+1}`,()=>{
  let run=createRun('standard');const obtained=[];
  assert.equal(run.version,4);
  for(let chapter=0;chapter<6;chapter++){
    assert.equal(run.chapter,chapter);assert.equal(run.phase,'dialogue');assert.equal(run.dialogue,'before');run=restore(run);
    assert.ok(runDialogue(run).length>1);assert.equal(advanceDialogue(run),true);assert.equal(run.line,1);run=restore(run);
    beforeToBattle(run);run=restore(run);assert.equal(run.battle.boss.id,CHAPTERS[chapter].bossId);assert.equal(run.battle.version,11);
    fixtureWin(run);assert.equal(run.phase,'dialogue');assert.equal(run.dialogue,'after');assert.equal(run.history.length,chapter+1);run=restore(run);
    assert.equal(run.unlockedHeroes.includes('haart'),chapter>=1);assert.equal(run.unlockedHeroes.includes('qianxing'),chapter>=2);
    advanceDialogue(run,true);run=restore(run);
    if(chapter===5){assert.equal(run.phase,'complete');assert.equal(rewardOptions(run).length,0);break;}
    assert.equal(run.phase,'reward');const options=rewardOptions(run);assert.equal(options.length,3);
    const reward=options[rewardIndex],result=claimReward(run,reward.id);assert.equal(result.ok,true);obtained.push(reward.id);
    assert.equal(run.phase,'camp');assert.equal(run.chapter,chapter+1);assert.deepEqual(run.upgrades,obtained);run=restore(run);
    if(reward.kind==='skill'){assert.equal(run.loadouts[reward.heroId][3],reward.skillId);assert.ok(run.lastReward.replaced);}
    if(chapter===1)assert.equal(replacePartyMember(run,0,'haart'),true);
    if(chapter===2)assert.equal(replacePartyMember(run,1,'qianxing'),true);
    const next=battleForRun(run);assert.deepEqual(next.heroes.map(h=>h.id),run.partyIds);assert.deepEqual(next.upgrades,run.upgrades);
    for(const hero of next.heroes)assert.equal(activeSkills(next,hero.id).length,4);
    run=restore(run);assert.equal(startNextChapter(run),true);
  }
  assert.equal(run.history.length,6);assert.equal(run.upgrades.length,5);assert.equal(run.unlockedHeroes.length,7);
  const finished=structuredClone(run);assert.equal(regroup(run),false);assert.deepEqual(run,finished);
  assert.equal(normalizeRun({...run,chapter:0}),null);
});

test('campaign: failure and duplicate completion cannot advance chapters or award twice',()=>{
  const run=beforeToBattle(createRun());const failed={...run.battle,mode:'defeat'},before=structuredClone(run);
  assert.equal(completeEncounter(run,failed),false);assert.deepEqual(run,before);
  assert.equal(claimReward(run,'knibbs_ricochet').ok,false);assert.deepEqual(run,before);
  regroup(run);assert.equal(run.phase,'camp');assert.equal(run.chapter,0);assert.equal(run.upgrades.length,0);restore(run);
  startNextChapter(run);beforeToBattle(run);const won=fixtureWin(run),after=structuredClone(run);
  assert.equal(completeEncounter(run,won),false);assert.deepEqual(run,after);
  advanceDialogue(run,true);assert.equal(claimReward(run,'knibbs_ricochet').ok,true);const claimed=structuredClone(run);
  assert.equal(claimReward(run,'knibbs_ricochet').ok,false);assert.deepEqual(run,claimed);
});

test('campaign: recruitment gates party changes and unlocked reward skills occupy exactly four slots',()=>{
  const run=beforeToBattle(createRun());fixtureWin(run);advanceDialogue(run,true);
  assert.ok(rewardOptions(run).some(reward=>reward.id==='knibbs_ricochet'));
  assert.equal(claimReward(run,'knibbs_ricochet').ok,true);
  assert.equal(replacePartyMember(run,0,'haart'),false);
  assert.equal(equipSkill(run,'apeilia',0,'overture').ok,false);
  assert.equal(equipSkill(run,'knibbs',0,'ricochet').ok,true);assert.equal(new Set(run.loadouts.knibbs).size,4);
  assert.equal(equipSkill(run,'knibbs',3,'cover').ok,true);assert.equal(run.loadouts.knibbs[0],'ricochet');
  assert.equal(equipSkill(run,'knibbs',1,'ricochet').ok,true);assert.equal(run.loadouts.knibbs[1],'ricochet');
  const before=[...run.partyIds];assert.equal(replacePartyMember(run,0,'ric'),true);assert.deepEqual(run.partyIds,['ric',before[1],before[0]]);restore(run);
});

test('campaign: malformed progress and rewards cannot be restored, a missing battle safely returns to camp',()=>{
  for(const difficulty of ['toString','constructor',['standard']]){const run=createRun();run.difficulty=difficulty;assert.equal(normalizeRun(run),null);}
  const start=createRun();assert.equal(normalizeRun({...start,version:99}),null);
  assert.equal(normalizeRun({...start,partyIds:['knibbs','knibbs','ric']}),null);
  assert.equal(normalizeRun({...start,partyIds:['haart','apeilia','ric']}),null);
  assert.equal(normalizeRun({...start,upgrades:['haart_network']}),null);
  advanceDialogue(start,true);const restored=normalizeRun(start);assert.ok(restored);assert.equal(restored.phase,'camp');assert.equal(restored.history.length,0);
});

test('campaign: old non-tutorial default loadouts gain an ammo loader without resetting a live fight',()=>{
  for(const legacyRoute of [false,true])for(const customized of [false,true]){
    const run=createCurrentRun('standard',{legacyRoute,skipTutorial:true});
    const oldPreset=customized?['shot','scatter','breathe','cover']:['shot','focus','breathe','cover'];
    run.loadouts.knibbs=[...oldPreset];delete run.knibbsRevision;
    beforeToBattle(run);delete run.battle.knibbsRevision;
    const hero=run.battle.heroes.find(h=>h.id==='knibbs');hero.hp=79;hero.resource=3;hero.intuition=2;run.battle.ap=1;
    const copy=normalizeRun(structuredClone(run));assert.ok(copy);assert.equal(copy.phase,'battle');assert.equal(copy.knibbsRevision,1);
    const expected=customized?oldPreset:['shot','focus','loadburst','cover'];
    assert.deepEqual(copy.loadouts.knibbs,expected);assert.deepEqual(copy.battle.loadouts.knibbs,expected);
    const resumed=copy.battle.heroes.find(h=>h.id==='knibbs');assert.equal(resumed.hp,79);assert.equal(resumed.resource,3);assert.equal(resumed.intuition,2);assert.equal(copy.battle.ap,1);
    assert.deepEqual(normalizeRun(structuredClone(copy)),copy,'migration is idempotent');
  }
});

test('campaign: canonical rewards provide thirty-five distinct choices, ten new skills and twenty-five upgrades',()=>{
  assert.equal(Object.keys(REWARDS).length,35);assert.equal(Object.values(REWARDS).filter(r=>r.kind==='skill').length,10);
  assert.equal(Object.values(REWARDS).filter(r=>r.kind==='upgrade').length,25);
  assert.equal(CHAPTERS.length,6);assert.equal(new Set(CHAPTERS.map(c=>c.bossId)).size,6);
});

// A fixed v1 save records the old public format. These IDs deliberately do not
// import or derive from the production migration table.
function legacyCamp(){return {
  version:1,id:'legacy-recruitment-3',difficulty:'standard',chapter:3,phase:'camp',dialogue:'before',line:0,
  partyIds:['voss','lumen','ric'],unlockedHeroes:['knibbs','apeilia','ric','lumen','voss'],
  upgrades:['knibbs_ricochet','lumen_prism','voss_furnace'],
  loadouts:{
    knibbs:['shot','focus','scatter','ricochet'],apeilia:['blade','purify','eden','sentinel'],ric:['rune','bind','shelter','mend'],
    lumen:['needle','prism','bloomheal','veil'],voss:['cleave','eruption','furnace','vent']
  },
  history:[
    {bossId:'duelist',round:5,damage:1080,breaks:2,partyIds:['knibbs','apeilia','ric']},
    {bossId:'cantor',round:6,damage:1220,breaks:2,partyIds:['knibbs','apeilia','ric']},
    {bossId:'warden',round:7,damage:1440,breaks:3,partyIds:['lumen','knibbs','ric']}
  ],
  battle:null,lastReward:{id:'voss_furnace',replaced:'vent'},focusHero:'voss'
};}

test('campaign migration: v1 recruitment, earned rewards and custom slots survive replacement without losing chapters',()=>{
  const old=legacyCamp(),before=structuredClone(old),run=normalizeRun(old);
  assert.deepEqual(old,before,'loading does not mutate the original save');assert.ok(run);assert.equal(run.version,4);
  assert.equal(run.chapter,3);assert.equal(run.phase,'camp');assert.equal(run.history.length,3);
  assert.deepEqual(run.partyIds,['qianxing','haart','ric']);
  assert.deepEqual(run.unlockedHeroes,['knibbs','apeilia','ric','youmu','haart','qianxing']);
  assert.deepEqual(run.upgrades,['knibbs_ricochet','haart_network','qianxing_nova']);
  assert.deepEqual(run.loadouts.haart,['page','network','soothe','rest']);
  assert.deepEqual(run.loadouts.qianxing,['spike','beam','nova','repair']);
  assert.deepEqual(run.lastReward,{id:'qianxing_nova',replaced:'repair'});assert.equal(run.focusHero,'qianxing');
  assert.deepEqual(run.history[2].partyIds,['haart','knibbs','ric']);restore(run);
  const battle=battleForRun(run);assert.equal(battle.boss.id,'golem');assert.equal(battle.version,11);
  assert.deepEqual(activeSkills(battle,'haart').map(s=>s.id),['page','network','soothe','rest']);
  assert.deepEqual(activeSkills(battle,'qianxing').map(s=>s.id),['spike','beam','nova','repair']);
  const cannotSkip=structuredClone(old);cannotSkip.upgrades[1]='voss_furnace';assert.equal(normalizeRun(cannotSkip),null,'migration must still enforce chapter reward pools');
  const cannotRecruit=structuredClone(old);cannotRecruit.chapter=1;cannotRecruit.history=old.history.slice(0,1);cannotRecruit.upgrades=['knibbs_ricochet'];
  assert.equal(normalizeRun(cannotRecruit),null,'old IDs cannot bypass recruitment gates');
});

test('campaign migration: an ongoing v1 chapter resumes its v3 battle with new roster and full mana',()=>{
  const old=legacyCamp(),current=normalizeRun(old),battle=battleForRun(current);
  // Preserve actual old engine dimensions independently of current definitions.
  battle.version=3;battle.round=4;battle.serial=12;battle.elapsed=84;battle.ap=7;battle.maxAp=7;
  battle.selected='voss';battle.upgrades=['knibbs_ricochet','lumen_prism','voss_furnace'];battle.loadouts=structuredClone(old.loadouts);
  battle.heroes=[
    {...battle.heroes[0],id:'voss',name:'沃斯',maxHp:205,hp:205,maxResource:6,resourceName:'蓄热',resource:6,used:['cleave','vent'],cooldowns:{vent:0},reflect:0},
    {...battle.heroes[1],id:'lumen',name:'露弥',maxHp:150,hp:130,maxResource:5,resourceName:'棱光',resource:4,used:['needle'],cooldowns:{veil:0},reflect:1},
    {...battle.heroes[2]}
  ];
  battle.response={id:'parry',actor:'lumen'};battle.boss.intentTarget='voss';battle.boss.maxStagger=100;battle.boss.stagger=50;delete battle.boss.exposed;
  old.phase='battle';old.battle=battle;
  const before=structuredClone(old),run=normalizeRun(old);assert.deepEqual(old,before);
  assert.ok(run);assert.equal(run.phase,'battle','valid old active combat must not silently fall back to camp');assert.equal(run.chapter,3);
  assert.equal(run.battle.version,11);assert.equal(run.battle.round,4);assert.equal(run.battle.elapsed,84);
  assert.equal(run.battle.ap,6);assert.equal(run.battle.maxAp,6);
  assert.equal(run.battle.boss.stagger,run.battle.boss.maxStagger/2);assert.equal(run.battle.boss.exposed,false);
  assert.deepEqual(run.battle.heroes.map(h=>h.id),['qianxing','haart','ric']);
  const q=run.battle.heroes[0],h=run.battle.heroes[1];
  assert.equal(q.hp,q.maxHp);assert.equal(q.resource,10);assert.equal(h.hp,130);assert.equal(h.resource,10);assert.equal(h.reflect,0);
  assert.deepEqual(q.used,['spike','repair']);assert.deepEqual(h.used,['page']);assert.deepEqual(q.cooldowns,{repair:0});assert.deepEqual(h.cooldowns,{rest:0});
  assert.equal(run.battle.response,null);assert.equal(run.battle.selected,'qianxing');assert.equal(run.battle.boss.intentTarget,'qianxing');restore(run);
  const invalid=structuredClone(old);invalid.battle.heroes[0].resource=7;
  const safe=normalizeRun(invalid);assert.ok(safe);assert.equal(safe.phase,'camp');assert.equal(safe.battle,null);assert.deepEqual(safe.upgrades,['knibbs_ricochet','haart_network','qianxing_nova']);
});
