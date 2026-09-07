import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, HEROES, SKILLS, DIFFICULTIES, heroOf, canUse, useSkill, usePotion, guard, endRound, intentInfo, activeSkills} from '../src/combat.js';
import {runPolicy} from '../scripts/pressure-probe.mjs';

function snapshot(state) { return structuredClone(state); }
function valid(state) {
  assert.ok(['playing','victory','defeat'].includes(state.mode));
  assert.ok(Number.isInteger(state.ap) && state.ap >= 0 && state.ap <= state.maxAp);
  assert.ok(Number.isInteger(state.potions) && state.potions >= 0 && state.potions <= 3);
  assert.ok(Number.isInteger(state.round) && state.round >= 1);
  assert.ok(Number.isFinite(state.boss.hp) && state.boss.hp >= 0 && state.boss.hp <= state.boss.maxHp);
  assert.ok(Number.isFinite(state.boss.stagger) && state.boss.stagger >= 0 && state.boss.stagger <= state.boss.maxStagger);
  for (const key of ['corePhysical','coreMagic']) assert.ok(state.boss[key] >= 0 && state.boss[key] <= 3);
  for (const h of state.heroes) {
    assert.ok(Number.isFinite(h.hp) && h.hp >= 0 && h.hp <= h.maxHp, `${h.id} HP`);
    assert.ok(Number.isFinite(h.shield) && h.shield >= 0 && h.shield <= 60, `${h.id} shield`);
    assert.ok(Number.isFinite(h.resource) && h.resource >= (h.id === 'ric' ? -10 : 0) && h.resource <= h.maxResource, `${h.id} resource`);
    assert.ok(h.resonance >= 0 && h.resonance <= 5);
    for (const cd of Object.values(h.cooldowns)) assert.ok(Number.isInteger(cd) && cd >= 0);
  }
  function finiteTree(value) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
  }
  finiteTree(state);
}
function act(state, id, skill) { const result = useSkill(state,id,skill); assert.equal(result.ok,true,result.error); valid(state); return result; }
function next(state) { const result = endRound(state); assert.equal(result.ok,true,result.error); valid(state); return result; }
function rejected(state, action) { const before = snapshot(state); const result=action(); assert.equal(result.ok,false); assert.deepEqual(result.events,[]); assert.deepEqual(state,before); }
function freshCore(difficulty='standard') { const state=createBattle(difficulty); state.boss.hp=1; act(state,'knibbs','shot'); assert.equal(state.boss.core,true); return state; }

test('new battle: all difficulties have valid bounded state and unknown difficulty falls back',()=>{
  for (const [difficulty,config] of Object.entries(DIFFICULTIES)) {const s=createBattle(difficulty);valid(s);assert.equal(s.boss.hp,config.hp);assert.equal(s.ap,6);}
  assert.equal(createBattle('unknown').difficulty,'standard');
  assert.equal(HEROES.length,7);const original=createBattle();assert.equal(original.heroes.length,3);for(const h of original.heroes)assert.equal(activeSkills(original,h.id).length,5);
});

test('invalid skill requests do not spend AP, resources, turns, or stats',()=>{
  let s=createBattle();rejected(s,()=>useSkill(s,'missing','shot'));rejected(s,()=>useSkill(s,'knibbs','missing'));
  rejected(s,()=>useSkill(s,'constructor','shot'));rejected(s,()=>useSkill(s,'toString','shot'));
  heroOf(s,'knibbs').hp=0;rejected(s,()=>useSkill(s,'knibbs','shot'));
  s=createBattle();s.ap=0;rejected(s,()=>useSkill(s,'knibbs','shot'));
  s=createBattle();heroOf(s,'knibbs').resource=3;rejected(s,()=>useSkill(s,'knibbs','focus'));
  s=createBattle();heroOf(s,'apeilia').resource=3;rejected(s,()=>useSkill(s,'apeilia','eden'));
  s=createBattle();heroOf(s,'ric').resource=10;rejected(s,()=>useSkill(s,'ric','rune'));
  heroOf(s,'ric').resource=-10;rejected(s,()=>useSkill(s,'ric','bind'));
  s=createBattle();act(s,'knibbs','breathe');rejected(s,()=>useSkill(s,'knibbs','breathe'));
  s=createBattle();act(s,'ric','bind');rejected(s,()=>useSkill(s,'ric','bind'));
});

test('resources gain and spend correctly, with caps and once-per-round restoration',()=>{
  const s=createBattle();heroOf(s,'knibbs').hp-=20;
  act(s,'knibbs','breathe');assert.equal(heroOf(s,'knibbs').resource,10);assert.equal(heroOf(s,'knibbs').hp,166);
  act(s,'knibbs','focus');assert.equal(heroOf(s,'knibbs').resource,6);
  act(s,'knibbs','scatter');assert.equal(heroOf(s,'knibbs').resource,0);
  next(s);assert.equal(heroOf(s,'knibbs').resource,2);assert.equal(canUse(s,'knibbs','breathe'),'');
});

test('Apeilia repeated blades gain reduced combo and multi-hit skills spend it once',()=>{
  const s=createBattle();act(s,'apeilia','blade');act(s,'apeilia','blade');assert.equal(heroOf(s,'apeilia').resource,3);
  rejected(s,()=>useSkill(s,'apeilia','eden'));act(s,'apeilia','blade');assert.equal(heroOf(s,'apeilia').resource,4);
  rejected(s,()=>useSkill(s,'apeilia','eden'));act(s,'apeilia','reboot');assert.equal(heroOf(s,'apeilia').resource,6);
  const result=act(s,'apeilia','eden');assert.equal(heroOf(s,'apeilia').resource,0);assert.equal(result.events.find(e=>e.type==='attack').hits,4);
  rejected(s,()=>useSkill(s,'apeilia','sentinel'));
  next(s);heroOf(s,'apeilia').resource=9;act(s,'apeilia','purify');assert.equal(heroOf(s,'apeilia').resource,10);act(s,'apeilia','sentinel');assert.equal(heroOf(s,'apeilia').resource,4);
});

test('Ric can reach either balance boundary but cannot overshoot it',()=>{
  const s=createBattle();act(s,'ric','rune');act(s,'ric','shelter');act(s,'ric','shelter');assert.equal(heroOf(s,'ric').resource,10);
  rejected(s,()=>useSkill(s,'ric','rune'));act(s,'ric','crossing');assert.equal(heroOf(s,'ric').resource,-10);
  next(s);assert.equal(heroOf(s,'ric').resource,-8);rejected(s,()=>useSkill(s,'ric','mend'));
});

test('bind cooldown blocks exactly two subsequent player rounds',()=>{
  const s=createBattle();act(s,'ric','bind');assert.equal(heroOf(s,'ric').cooldowns.bind,3);
  act(s,'ric','rune');act(s,'ric','rune');next(s);assert.match(canUse(s,'ric','bind'),/2 轮冷却/);
  next(s);assert.match(canUse(s,'ric','bind'),/1 轮冷却/);next(s);assert.equal(canUse(s,'ric','bind'),'');
});

test('magic resistance, piercing and mark affect damage without overflow',()=>{
  let s=createBattle();assert.equal(act(s,'apeilia','purify').events.find(e=>e.type==='attack').amount,44);
  s=createBattle();heroOf(s,'apeilia').resource=6;assert.equal(act(s,'apeilia','sentinel').events.find(e=>e.type==='attack').amount,104);
  s=createBattle();act(s,'knibbs','focus');assert.equal(act(s,'knibbs','shot').events.find(e=>e.type==='attack').amount,31);
});

test('each physical or magic hit counts separately and counters cap at three',()=>{
  const s=freshCore();next(s);act(s,'knibbs','scatter');assert.equal(s.boss.corePhysical,3);assert.equal(s.boss.coreMagic,0);assert.equal(s.mode,'playing');
  act(s,'apeilia','purify');assert.equal(s.boss.coreMagic,2);assert.equal(s.boss.fog,3);
  const result=act(s,'ric','bind');assert.equal(s.boss.coreMagic,3);assert.equal(s.mode,'victory');assert.ok(result.events.some(e=>e.type==='victory'));
});

test('a lethal multi-hit skill has no automatic core hits from overflow',()=>{
  const s=createBattle();s.boss.hp=1;const result=act(s,'knibbs','scatter');
  assert.equal(s.boss.hp,0);assert.equal(s.stats.damage,1);assert.equal(s.boss.core,true);assert.equal(s.boss.corePhysical,0);assert.equal(s.boss.coreMagic,0);assert.equal(s.mode,'playing');
  assert.equal(result.events.find(e=>e.type==='attack').amount,1);assert.ok(result.events.some(e=>e.type==='core'));
});

test('core gets the exposure remainder plus two complete player rounds',()=>{
  const s=freshCore();assert.equal(s.round,1);assert.equal(s.boss.coreTurns,2);assert.equal(s.boss.coreFresh,true);
  next(s);assert.equal(s.round,2);assert.equal(s.boss.coreTurns,2);assert.equal(s.boss.coreFresh,false);
  next(s);assert.equal(s.round,3);assert.equal(s.boss.coreTurns,1);assert.equal(s.boss.core,true);
  const result=next(s);assert.equal(s.round,4);assert.equal(s.boss.core,false);assert.equal(s.boss.reforms,1);assert.equal(s.boss.hp,252);assert.ok(result.events.some(e=>e.label==='元素重组'));
});

test('a reformed boss can expose a clean fresh core and still be defeated',()=>{
  const s=freshCore();act(s,'apeilia','purify');next(s);next(s);next(s);assert.equal(s.boss.reforms,1);
  s.boss.hp=1;act(s,'knibbs','shot');assert.equal(s.boss.coreMagic,0);assert.equal(s.boss.corePhysical,0);assert.equal(s.boss.coreTurns,2);assert.equal(s.boss.coreFresh,true);
  next(s);act(s,'knibbs','scatter');act(s,'apeilia','purify');act(s,'ric','bind');assert.equal(s.mode,'victory');
});

test('direct bind interrupt wins over pending ground rupture and cancels boss actions',()=>{
  const s=createBattle();s.boss.charging=true;s.boss.stage=3;const result=act(s,'ric','bind');
  assert.equal(s.boss.broken,true);assert.equal(s.boss.charging,false);assert.equal(s.stats.interrupts,1);assert.ok(result.events.some(e=>e.label==='地裂打断'));
  const hp=s.heroes.map(h=>h.hp);const round=next(s);assert.deepEqual(s.heroes.map(h=>h.hp),hp);assert.equal(round.events.filter(e=>e.type==='boss').length,0);
});

test('stagger break also cancels charging and resets next round',()=>{
  const s=createBattle();s.boss.charging=true;s.boss.stagger=8;act(s,'knibbs','shot');assert.equal(s.boss.broken,true);assert.equal(s.boss.charging,false);assert.equal(s.stats.breaks,1);assert.equal(s.stats.interrupts,1);
  next(s);assert.equal(s.boss.broken,false);assert.equal(s.boss.stagger,s.boss.maxStagger);
});

test('crossing a phase on the last AP announces rupture for the next complete player round',()=>{
  const s=createBattle();s.boss.hp=725;s.ap=2;
  const result=act(s,'ric','bind');assert.equal(s.boss.stage,1);assert.equal(s.boss.broken,false);assert.equal(s.boss.charging,false);
  assert.equal(s.boss.phasePending,true);assert.equal(s.ap,0);assert.ok(result.events.some(e=>e.type==='phase'));
  const first=next(s);assert.ok(!first.events.some(e=>e.label==='地裂'));assert.equal(s.ap,6);assert.equal(s.boss.charging,true);
  const second=next(s);assert.ok(second.events.some(e=>e.label==='地裂'));
});

test('guard reduces damage before shields absorb it, and expires next round',()=>{
  const s=createBattle();s.boss.intentTarget='ric';act(s,'ric','shelter');assert.equal(heroOf(s,'ric').shield,30);assert.equal(guard(s,'ric').ok,true);rejected(s,()=>guard(s,'ric'));
  next(s);assert.equal(heroOf(s,'ric').hp,152);assert.equal(heroOf(s,'ric').shield,0);assert.equal(heroOf(s,'ric').guard,false);
});

test('shelter caps shields at sixty and cleanses living party members',()=>{
  const s=createBattle();s.heroes.forEach(h=>{h.shield=50;h.resonance=3;});act(s,'ric','shelter');
  assert.equal(heroOf(s,'ric').shield,60);assert.equal(heroOf(s,'ric').resonance,2);for(const h of s.heroes.filter(h=>h.id!=='ric')){assert.equal(h.shield,50);assert.equal(h.resonance,3);}
});

test('negative domain weakens the enemy and exposes it without duplicating the doctor healing role',()=>{
  const s=createBattle();heroOf(s,'knibbs').hp=70;heroOf(s,'apeilia').hp=0;heroOf(s,'ric').hp=100;s.heroes.forEach(h=>h.resonance=3);
  act(s,'ric','mend');assert.equal(heroOf(s,'knibbs').hp,70);assert.equal(heroOf(s,'ric').hp,100);assert.equal(heroOf(s,'apeilia').hp,0);assert.equal(heroOf(s,'knibbs').resonance,2);assert.equal(s.boss.weakened,1);assert.equal(s.boss.vulnerable,2);assert.equal(s.stats.healed,0);
});

test('potions revive fallen heroes, clear resonance and spend one AP and one supply',()=>{
  const s=createBattle();const h=heroOf(s,'apeilia');h.hp=0;h.resonance=5;const result=usePotion(s,h.id);assert.equal(result.ok,true);assert.equal(h.hp,60);assert.equal(h.resonance,0);assert.equal(s.ap,5);assert.equal(s.potions,2);assert.equal(canUse(s,h.id,'blade'),'');valid(s);
  h.hp=h.maxHp-10;usePotion(s,h.id);assert.equal(h.hp,h.maxHp);assert.equal(s.stats.healed,70);
});

test('full-health, depleted and no-AP potion requests preserve all state',()=>{
  const s=createBattle();rejected(s,()=>usePotion(s,'knibbs'));heroOf(s,'knibbs').hp=20;s.potions=0;rejected(s,()=>usePotion(s,'knibbs'));s.potions=1;s.ap=0;rejected(s,()=>usePotion(s,'knibbs'));
});

test('explicit invalid potion targets are rejected while an omitted target uses selected hero',()=>{
  const s=createBattle();heroOf(s,'knibbs').hp=100;
  for(const target of ['missing','',null,0])rejected(s,()=>usePotion(s,target));
  const result=usePotion(s);assert.equal(result.ok,true);assert.equal(heroOf(s,'knibbs').hp,165);assert.equal(s.ap,5);assert.equal(s.potions,2);valid(s);
});

test('crossing another HP phase while broken cannot re-arm ground rupture next round',()=>{
  const s=createBattle();s.boss.hp=780;s.boss.stagger=8;
  act(s,'knibbs','shot');assert.equal(s.boss.broken,true);assert.equal(s.boss.stage,0);
  const result=act(s,'knibbs','focus');assert.equal(s.boss.stage,1);assert.equal(s.boss.broken,true);assert.equal(s.boss.charging,false);
  assert.ok(result.events.some(e=>e.type==='phase'));assert.ok(s.log.some(l=>l.text.includes('无法蓄力')));
  const hp=s.heroes.map(h=>h.hp);next(s);assert.deepEqual(s.heroes.map(h=>h.hp),hp);assert.equal(s.boss.broken,false);assert.equal(s.boss.charging,false);
});

test('healing events expose exact per-target HP gains including capped overheal',()=>{
  const s=createBattle();heroOf(s,'knibbs').hp=70;heroOf(s,'apeilia').hp=140;heroOf(s,'ric').hp=100;
  heroOf(s,'ric').resource=2;const result=act(s,'ric','crossing'),event=result.events.find(e=>e.type==='heal');
  assert.deepEqual(event.amounts,{knibbs:8,apeilia:5,ric:8});assert.equal(Object.values(event.amounts).reduce((a,b)=>a+b,0),s.stats.healed);
  next(s);heroOf(s,'knibbs').hp=168;const self=act(s,'knibbs','breathe').events.find(e=>e.type==='heal');assert.deepEqual(self.amounts,{knibbs:2});
});

test('damage events expose exact per-target losses after guard, shields and lethal HP cap',()=>{
  const s=createBattle();s.boss.charging=true;heroOf(s,'knibbs').shield=60;assert.equal(guard(s,'apeilia').ok,true);heroOf(s,'ric').hp=4;
  const before=s.heroes.map(h=>h.hp);const event=next(s).events.find(e=>e.label==='地裂');assert.deepEqual(event.amounts,{knibbs:10,apeilia:32,ric:4});
  s.heroes.forEach((h,i)=>assert.equal(event.amounts[h.id],before[i]-h.hp));assert.equal(heroOf(s,'ric').hp,0);valid(s);
});

test('JSON save round-trip preserves resources, cooldowns, guard and subsequent deterministic actions',()=>{
  const s=createBattle('challenge');act(s,'ric','bind');act(s,'apeilia','blade');assert.equal(guard(s,'knibbs').ok,true);
  const resumed=JSON.parse(JSON.stringify(s));assert.deepEqual(resumed,s);assert.deepEqual(endRound(resumed),endRound(s));assert.deepEqual(resumed,s);
  assert.deepEqual(useSkill(resumed,'knibbs','focus'),useSkill(s,'knibbs','focus'));assert.deepEqual(resumed,s);valid(resumed);
  const core=freshCore();act(core,'apeilia','purify');next(core);const resumedCore=JSON.parse(JSON.stringify(core));
  assert.deepEqual(endRound(resumedCore),endRound(core));assert.deepEqual(resumedCore,core);assert.equal(resumedCore.boss.coreTurns,1);valid(resumedCore);
});

test('party defeat stops boss follow-up actions and all future controls',()=>{
  const s=createBattle();s.heroes.forEach(h=>h.hp=1);s.boss.stage=3;s.boss.charging=true;const result=next(s);assert.equal(s.mode,'defeat');assert.equal(result.events.filter(e=>e.type==='boss').length,1);assert.ok(result.events.some(e=>e.type==='defeat'));
  rejected(s,()=>useSkill(s,'knibbs','shot'));rejected(s,()=>endRound(s));rejected(s,()=>usePotion(s,'knibbs'));rejected(s,()=>guard(s,'knibbs'));
});

test('victory stops all future actions without consuming remaining resources',()=>{
  const s=freshCore();next(s);act(s,'knibbs','scatter');act(s,'apeilia','purify');act(s,'ric','bind');assert.equal(s.mode,'victory');
  rejected(s,()=>useSkill(s,'knibbs','shot'));rejected(s,()=>endRound(s));rejected(s,()=>usePotion(s,'knibbs'));rejected(s,()=>guard(s,'knibbs'));
});

test('intent priority is core, broken, charging, then the ordinary action',()=>{
  const s=createBattle();assert.equal(intentInfo(s).name,'势能重击');s.boss.charging=true;assert.equal(intentInfo(s).name,'地裂 · 蓄力中');s.boss.broken=true;assert.equal(intentInfo(s).name,'架势崩溃');s.boss.core=true;assert.equal(intentInfo(s).name,'核心重组');
});

function playStrategy(difficulty, aggressive=true) {
  const result=runPolicy('golem',aggressive?'tactical':'pass-only',difficulty,{includeState:true,onState:valid});
  assert.notEqual(result.state.mode,'playing',`strategy stalled ${difficulty}: ${result.actions.join(', ')}`);
  return {state:result.state,history:result.actions};
}

for(const difficulty of Object.keys(DIFFICULTIES)) {
  test(`whole battle ${difficulty}: deliberate play can win using public APIs only`,()=>{
    const {state,history}=playStrategy(difficulty);assert.equal(state.mode,'victory',`${difficulty} failed: ${history.join(', ')}`);valid(state);
    console.log(`SIM ${difficulty} victory: round=${state.round}, turns=${state.stats.turns}, actions=${state.stats.actions}, HP=${state.heroes.map(h=>h.hp).join('/')}, potions=${state.potions}, breaks=${state.stats.breaks}, reforms=${state.boss.reforms}`);
  });
  test(`whole battle ${difficulty}: pass-only play can lose without invalid state`,()=>{
    const {state}=playStrategy(difficulty,false);assert.equal(state.mode,'defeat');valid(state);console.log(`SIM ${difficulty} defeat: round=${state.round}, turns=${state.stats.turns}`);
  });
}

test('seeded mixed legal and invalid input sequences always preserve bounds',()=>{
  let seed=0x673a5291;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const difficulty of Object.keys(DIFFICULTIES))for(let run=0;run<12;run++){
    const s=createBattle(difficulty);
    for(let step=0;step<250 && s.mode==='playing';step++){
      const choice=Math.floor(random()*18),id=HEROES[Math.floor(random()*3)].id;const before=snapshot(s);let result;
      if(choice<12)result=useSkill(s,HEROES[Math.floor(choice/4)].id,SKILLS[HEROES[Math.floor(choice/4)].id][choice%4].id);
      else if(choice<14)result=guard(s,id);
      else if(choice<16)result=usePotion(s,id);
      else result=endRound(s);
      if(!result.ok)assert.deepEqual(s,before);valid(s);
    }
  }
});
