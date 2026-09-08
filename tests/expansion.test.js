import {runPolicy} from '../scripts/pressure-probe.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,BOSSES,REWARDS,createBattle,heroOf,canUse,useSkill,usePotion,guard,endRound,prepareResponse,skillPreview,activeSkills,normalizeLoadouts} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {grantShield} from '../src/shields.js';

const clone=value=>structuredClone(value);
function partyFor(id){return [id,...HEROES.filter(h=>h.id!==id).slice(0,2).map(h=>h.id)];}
function valid(state){
  assert.equal(state.version,10);assert.equal(state.heroes.length,3);assert.equal(new Set(state.heroes.map(h=>h.id)).size,3);
  assert.ok(state.ap>=0&&state.ap<=state.maxAp);assert.ok(state.boss.hp>=0&&state.boss.hp<=state.boss.maxHp);
  for(const h of state.heroes){assert.ok(h.hp>=0&&h.hp<=h.maxHp);assert.ok(h.resource>=(h.id==='ric'?-10:0)&&h.resource<=h.maxResource);assert.ok(h.reflect>=0&&h.reflect<=2);assert.equal(activeSkills(state,h.id).length,5);}
  if(state.mode==='playing')assert.ok(normalizeSave(state),'live state must restore');
}
function castPreview(state,id,skill){
  const before=clone(state),preview=skillPreview(state,id,skill);assert.deepEqual(state,before);
  const resource=heroOf(state,id).resource,ap=state.ap,result=useSkill(state,id,skill);assert.equal(result.ok,true,result.error);
  assert.equal(ap-state.ap,preview.ap);assert.equal(preview.resourceBefore,resource);assert.equal(preview.resourceAfter,heroOf(state,id).resource);
  assert.equal(preview.damage,result.events.filter(e=>e.type==='attack'&&e.targets?.includes('boss')).reduce((n,e)=>n+(e.amount||0),0));valid(state);
  return {preview,result};
}

test('expansion: the ten original-roster three-person combinations preserve identity, slot order and saves',()=>{
  assert.equal(HEROES.length,7);assert.equal(Object.values(BOSSES).filter(b=>!b.isTutorial&&!b.isSkirmish&&!b.isMinion).length,10);
  for(let a=0;a<3;a++)for(let b=a+1;b<4;b++)for(let c=b+1;c<5;c++){
    const ids=[HEROES[c].id,HEROES[a].id,HEROES[b].id],state=createBattle('standard','warden',{partyIds:ids});valid(state);
    assert.deepEqual(state.heroes.map(h=>h.id),ids);assert.deepEqual(normalizeSave(state).heroes.map(h=>h.id),ids);
    for(const h of state.heroes)assert.equal(canUse(state,h.id,activeSkills(state,h.id)[0].id),'');
  }
  assert.deepEqual(createBattle('standard','warden',{partyIds:['qianxing','qianxing','ric']}).heroes.map(h=>h.id),['knibbs','apeilia','ric']);
});

test('expansion: every reward skill requires its reward and an equipped slot, then previews its actual cost and result',()=>{
  for(const reward of Object.values(REWARDS).filter(r=>r.kind==='skill')){
    let state=createBattle('standard','warden',{partyIds:partyFor(reward.heroId)});
    const before=clone(state);assert.equal(useSkill(state,reward.heroId,reward.skillId).ok,false);assert.deepEqual(state,before);
    state=createBattle('standard','warden',{partyIds:partyFor(reward.heroId),upgrades:[reward.id]});
    assert.equal(useSkill(state,reward.heroId,reward.skillId).ok,false,'unlocked but unequipped is unavailable');
    const loadouts=normalizeLoadouts([reward.id]);loadouts[reward.heroId][3]=reward.skillId;
    state=createBattle('standard','warden',{partyIds:partyFor(reward.heroId),upgrades:[reward.id],loadouts});
    const h=heroOf(state,reward.heroId);h.resource=h.id==='ric'?2:h.maxResource;h.hp-=30;
    if(h.resourceName==='魔力'){h.resource=1;h.secondary=h.maxSecondary;if(h.id==='patch')h.records=h.secondary;}
    assert.equal(activeSkills(state,h.id).length,5);assert.ok(activeSkills(state,h.id).some(s=>s.id===reward.skillId));
    castPreview(state,h.id,reward.skillId);
  }
});

const CONDITIONS=[
  ['knibbs_deadeye','focus',h=>{h.intuition=3;h.resource=4;},p=>{assert.equal(p.hits,2);assert.equal(p.damage,126);} ],
  ['knibbs_expose','shot',(h,s)=>s.boss.marked=true,p=>assert.equal(p.stagger,14)],
  ['apeilia_cascade','eden',h=>{h.resource=6;h.lastKind='magic';},p=>{assert.equal(p.hits,6);assert.equal(p.stagger,50);} ],
  ['apeilia_zero','sentinel',h=>{h.resource=6;h.lastKind='physical';},p=>assert.equal(p.ap,1)],
  ['ric_grace','shelter',h=>h.grace=true,p=>{assert.equal(p.ap,1);assert.equal(p.shield,38);} ],
  ['ric_verdict','rune',h=>h.verdict=true,p=>{assert.equal(p.hits,3);assert.equal(p.damage,72);} ],
  ['haart_triage','soothe',(h,s)=>{s.heroes.find(p=>p.id!==h.id).used.push('shot');},p=>{assert.equal(p.heal,0);assert.equal(p.allHeal,0);assert.ok(p.notes.some(n=>n.includes('剥除')));} ],
  ['haart_echo','page',(h,s)=>s.boss.weakened=1,p=>{assert.equal(p.hits,2);assert.equal(p.damage,12);} ],
  ['qianxing_reinforce','armor',h=>h.used.push('spike'),p=>{assert.equal(p.cost,0);assert.equal(p.shield,36);assert.equal(p.allShield,0);assert.equal(p.reflect,2);} ],
  ['qianxing_focus','beam',h=>grantShield(h,1),p=>{assert.equal(p.damage,140);assert.equal(p.stagger,40);assert.ok(p.notes.some(n=>n.includes('剥除')));} ]
];
for(const [rewardId,skill,condition,check] of CONDITIONS)test(`expansion conditional upgrade ${rewardId}: ownership and trigger are both required`,()=>{
  const id=REWARDS[rewardId].heroId;
  const make=owned=>{const s=createBattle('standard','warden',{partyIds:partyFor(id),upgrades:owned?[rewardId]:[]});const h=heroOf(s,id);h.resource=id==='ric'?0:['haart','qianxing'].includes(id)?10:3;if(id==='haart'&&skill==='soothe')h.secondary=1;if(id==='qianxing'&&skill==='beam')h.secondary=2;if(id==='qianxing'&&skill==='armor')h.secondary=1;h.hp-=50;return s;};
  const absent=make(false);condition(heroOf(absent,id),absent);assert.equal(skillPreview(absent,id,skill).empowered,false);
  const dormant=make(true);
  assert.equal(skillPreview(dormant,id,skill).empowered,false);
  const active=make(true);condition(heroOf(active,id),active);
  const {preview}=castPreview(active,id,skill);assert.equal(preview.empowered,true);assert.ok(preview.empowerReason);check(preview);
});

test('expansion: Haart links conversion, small cash-outs and enemy debuffs without automatic mana',()=>{
  const state=createBattle('standard','warden',{partyIds:['haart','knibbs','ric']}),h=heroOf(state,'haart');
  assert.equal(h.resource,10);
  castPreview(state,'haart','rest');assert.equal(h.resource,2);assert.equal(h.secondary,4);assert.ok(state.heroes.every(x=>x.shield===0));
  castPreview(state,'haart','anchor');assert.equal(h.resource,5);assert.equal(h.secondary,3);assert.ok(state.heroes.every(x=>x.attackBuff===25));
  castPreview(state,'haart','soothe');assert.equal(h.resource,8);assert.equal(h.secondary,2);assert.equal(state.boss.confusion?.actor,'haart');
  const afterMana=h.resource;endRound(state);assert.equal(h.resource,afterMana);valid(state);
  const {preview}=castPreview(state,'haart','relay');assert.equal(preview.hits,3);assert.equal(preview.refund,4);assert.equal(h.resource,10);assert.equal(h.secondary,0);
  const before=clone(state);assert.match(canUse(state,'haart','soothe'),/念线不足/);
  assert.equal(useSkill(state,'haart','soothe').ok,false);assert.deepEqual(state,before);
});

test('expansion: Qianxing armor survives saves, retaliates against physical hits and never gains mana from damage',()=>{
  const state=createBattle('standard','duelist',{partyIds:['qianxing','haart','ric']}),h=heroOf(state,'qianxing');
  castPreview(state,'qianxing','repair');assert.equal(h.resource,1);assert.equal(h.secondary,3);assert.equal(h.shield,0);
  castPreview(state,'qianxing','armor');assert.equal(h.resource,5);assert.equal(h.secondary,2);assert.equal(h.reflect,1);
  assert.equal(guard(state,'qianxing').ok,false);assert.equal(h.protection,55);assert.equal(h.resource,5);
  const saved=normalizeSave(state);assert.equal(heroOf(saved,'qianxing').reflect,1);
  const result=endRound(state);assert.equal(h.resource,5);assert.equal(h.reflect,0);
  assert.equal(result.events.filter(e=>e.label==='钉刺反击').length,1);valid(state);
  castPreview(state,'qianxing','beam');assert.equal(h.resource,10);assert.equal(h.secondary,0);
  castPreview(state,'qianxing','repair');assert.equal(h.resource,1);assert.equal(h.secondary,3);
  castPreview(state,'qianxing','pulse');assert.equal(h.resource,5);assert.equal(h.secondary,2);
  state.boss.intent='duel';state.boss.intentTarget='haart';const hp=h.hp;endRound(state);
  assert.equal(h.hp,hp,'mana and charge never inflict overheat damage');assert.equal(h.resource,5);valid(state);
});

test('expansion: Ric crossing zero grants one-use reward charges that remain valid in a save',()=>{
  const state=createBattle('standard','warden',{upgrades:['ric_grace','ric_verdict']}),h=heroOf(state,'ric');h.resource=-1;
  useSkill(state,'ric','rune');assert.equal(h.grace,true);assert.equal(h.verdict,true);
  const saved=normalizeSave(state);assert.equal(heroOf(saved,'ric').grace,true);assert.equal(heroOf(saved,'ric').verdict,true);
  castPreview(state,'ric','shelter');assert.equal(h.grace,false);assert.equal(h.verdict,true);
  castPreview(state,'ric','rune');assert.equal(h.verdict,false);valid(state);
});

test('expansion: Warden physical hits discharge, and Weaver changes its sealed damage type each round',()=>{
  const warden=createBattle('standard','warden');warden.boss.charge=6;
  castPreview(warden,'knibbs','scatter');assert.equal(warden.boss.charge,0);
  const weaver=createBattle('standard','weaver');assert.equal(skillPreview(weaver,'knibbs','shot').damage,7);
  castPreview(weaver,'apeilia','purify');assert.equal(weaver.boss.seals,0);assert.equal(skillPreview(weaver,'knibbs','shot').damage,14);
  endRound(weaver);assert.equal(weaver.boss.sealedKind,'magic');assert.equal(weaver.boss.seals,2);valid(weaver);
});

test('expansion: Qianxing pays conversion mana with either surviving or lethal mirror strikes',()=>{
  for(const lethal of [false,true]){
    const state=createBattle('standard','duelist',{partyIds:['qianxing','haart','ric']});state.boss.intent='mirror';heroOf(state,'qianxing').resource=3;
    if(lethal)state.boss.hp=1;
    const {preview}=castPreview(state,'qianxing','spike');assert.equal(preview.resourceAfter,0);assert.equal(preview.secondaryAfter,1);
  }
});

test('expansion: total skill damage preview includes a surviving mirror-backlash physical retaliation',()=>{
  const state=createBattle('standard','duelist',{partyIds:['qianxing','haart','ric']});state.boss.intent='mirror';
  const h=heroOf(state,'qianxing');h.resource=3;h.reflect=1;
  const {preview,result}=castPreview(state,'qianxing','spike');assert.ok(preview.damage>0);assert.equal(result.events.filter(e=>e.label==='钉刺反击').length,1);assert.equal(h.reflect,0);
  assert.ok(result.events.filter(e=>e.type==='attack').every(e=>e.kind==='physical'));
});

test('expansion: unlocked extinction beam requires three converted charges and keeps its triple piercing result',()=>{
  const loadouts=normalizeLoadouts(['qianxing_nova']);loadouts.qianxing[3]='nova';
  for(const shield of [0,1]){
    const state=createBattle('standard','warden',{partyIds:partyFor('qianxing'),upgrades:['qianxing_nova'],loadouts});
    const h=heroOf(state,'qianxing');grantShield(h,shield);
    assert.match(canUse(state,'qianxing','nova'),/充能不足/);for(let i=0;i<3;i++)castPreview(state,'qianxing','spike');assert.equal(h.resource,1);assert.equal(h.secondary,3);
    const {preview}=castPreview(state,'qianxing','nova');
    assert.equal(preview.hits,3);assert.equal(preview.damage,129);assert.equal(preview.resourceAfter,7);assert.equal(preview.secondaryAfter,0);assert.equal(preview.empowered,false);
  }
});

test('expansion: final barriers fall through alternating types and third synchronization creates vulnerability',()=>{
  const state=createBattle('standard','final');
  for(const [id,skill] of [['knibbs','shot'],['apeilia','purify'],['knibbs','shot'],['apeilia','purify']])castPreview(state,id,skill);
  assert.equal(state.boss.sync,3);assert.equal(state.boss.seals,0);assert.equal(skillPreview(state,'knibbs','shot').damage,32);valid(state);
});

function finaleFixture(){const s=createBattle('standard','final');s.boss.hp=1;useSkill(s,'knibbs','shot');assert.equal(s.boss.finale,true);assert.equal(s.mode,'playing');return s;}
test('expansion: final victory requires both damage types and a character defense, never HP zero alone',()=>{
  const state=finaleFixture();assert.equal(state.boss.finalePhysical,0);assert.equal(state.boss.finaleMagic,0);
  useSkill(state,'knibbs','shot');useSkill(state,'ric','bind');assert.equal(state.mode,'playing');endRound(state);assert.equal(state.mode,'playing');
  useSkill(state,'ric','shelter');endRound(state);assert.equal(state.mode,'victory');valid(state);
});
test('expansion: finale timeout restores 22 percent HP and enemy-phase entry grants exactly two full turns',()=>{
  const state=finaleFixture();useSkill(state,'apeilia','reboot');endRound(state);assert.equal(state.boss.finaleTurns,2);
  useSkill(state,'apeilia','reboot');endRound(state);assert.equal(state.boss.finaleTurns,1);
  useSkill(state,'apeilia','reboot');endRound(state);assert.equal(state.boss.finale,false);assert.equal(state.boss.hp,Math.round(state.boss.maxHp*.22));valid(state);
  const counter=createBattle('standard','final',{partyIds:['qianxing','knibbs','ric']});counter.boss.hp=1;heroOf(counter,'qianxing').secondary=1;useSkill(counter,'qianxing','armor');endRound(counter);
  assert.equal(counter.boss.finale,true);assert.equal(counter.boss.finaleFresh,false);assert.equal(counter.boss.finaleTurns,2);valid(counter);
});

function playExpanded(id,difficulty){const r=runPolicy(id,'tactical',difficulty,{includeState:true,onState:valid});return {state:r.state,history:r.actions};}
for(const id of ['warden','weaver','final'])for(const difficulty of ['story','standard','challenge']){
  test(`expansion whole battle ${id}/${difficulty}: public APIs complete victory`,()=>{
    const {state,history}=playExpanded(id,difficulty);assert.equal(state.mode,'victory',history.join(', '));valid(state);
    console.log(`SIM ${id}/${difficulty} victory: round=${state.round}, actions=${state.stats.actions}, HP=${state.heroes.map(h=>h.hp).join('/')}, potions=${state.potions}, breaks=${state.stats.breaks}`);
  });
  test(`expansion whole battle ${id}/${difficulty}: pass-only play reaches defeat`,()=>{
    const state=createBattle(difficulty,id);while(state.mode==='playing'&&state.round<60){endRound(state);valid(state);}
    assert.equal(state.mode,'defeat');console.log(`SIM ${id}/${difficulty} defeat: round=${state.round}`);
  });
}
