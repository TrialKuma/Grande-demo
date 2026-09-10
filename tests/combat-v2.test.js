import {runPolicy} from '../scripts/pressure-probe.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSSES as ALL_BOSSES, HEROES as ALL_HEROES, SKILLS, DIFFICULTIES, createBattle as createCombatBattle, heroOf, canUse,
  useSkill, usePotion, endRound, prepareResponse, responseOptions,
  skillPreview, heroStatus, bossSummary
} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';

// Each fixture explicitly equips four offensive commands; swaps happen only before battle.
const createBattle=(difficulty='standard',bossId='golem',options={})=>createCombatBattle(difficulty,bossId,{...options,loadouts:{knibbs:['shot','focus','scatter','breathe'],apeilia:['blade','purify','eden','sentinel'],ric:['rune','bind','shelter','mend'],...options.loadouts}});
const clone = state => structuredClone(state);
const BOSSES=Object.fromEntries(['golem','duelist','cantor'].map(id=>[id,ALL_BOSSES[id]]));
const HEROES=ALL_HEROES.slice(0,3);
function refuse(state, action) {
  const before=clone(state), result=action();
  assert.equal(result.ok,false); assert.deepEqual(result.events,[]);
  assert.deepEqual(state,before,'a refused action must be atomic');
}
function valid(state) {
  assert.equal(state.version,11);
  assert.ok(Object.hasOwn(BOSSES,state.boss.id));
  assert.ok(['playing','victory','defeat'].includes(state.mode));
  assert.equal(state.maxAp,6+state.roundCarry);
  assert.ok(Number.isInteger(state.ap)&&state.ap>=0&&state.ap<=state.maxAp);
  assert.ok(state.boss.hp>=0&&state.boss.hp<=state.boss.maxHp);
  assert.ok(state.boss.stagger>=0&&state.boss.stagger<=state.boss.maxStagger);
  for(const hero of state.heroes) {
    assert.ok(hero.hp>=0&&hero.hp<=hero.maxHp,`${hero.id} health`);
    assert.ok(hero.shield>=0&&hero.shield<=60,`${hero.id} shield`);
    assert.ok(hero.resource>=(hero.id==='ric'?-10:0)&&hero.resource<=hero.maxResource,`${hero.id} resource`);
  }
  if(state.boss.id!=='golem')assert.equal(state.boss.core,false);
  if(state.mode==='playing')assert.ok(normalizeSave(state),'every live state is saveable');
}

test('v2: all three encounters start in each difficulty with explicit boss identity',()=>{
  assert.deepEqual(Object.keys(BOSSES).sort(),['cantor','duelist','golem']);
  for(const bossId of Object.keys(BOSSES))for(const difficulty of Object.keys(DIFFICULTIES)){
    const state=createBattle(difficulty,bossId);valid(state);
    assert.equal(state.boss.id,bossId);assert.equal(state.ap,6);
    assert.ok(BOSSES[bossId].name&&BOSSES[bossId].mechanic);
    assert.ok(bossSummary(state).length>0);
    for(const hero of state.heroes)assert.equal(typeof heroStatus(state,hero.id),'string');
  }
  assert.equal(createBattle('standard','missing').boss.id,'golem');
});



test('v2: invalid responses, absent or fallen actors and exhausted AP preserve state',()=>{
  let state=createBattle('standard','duelist');
  refuse(state,()=>prepareResponse(state,'missing','knibbs'));
  refuse(state,()=>prepareResponse(state,'parry','missing'));
  heroOf(state,'knibbs').hp=0;refuse(state,()=>prepareResponse(state,'parry','knibbs'));
  state=createBattle();state.ap=0;refuse(state,()=>prepareResponse(state,'parry','knibbs'));
  for(const mode of ['victory','defeat']){
    state=createBattle();state.mode=mode;refuse(state,()=>prepareResponse(state,'parry','knibbs'));
  }
});


test('v2: skill previews are pure and match resolved damage and resource use',()=>{
  for(const bossId of Object.keys(BOSSES))for(const hero of HEROES)for(const skill of SKILLS[hero.id].slice(0,4)){
    const state=createBattle('standard',bossId),actor=heroOf(state,hero.id);
    actor.resource=hero.id==='ric'?0:8;
    const before=clone(state),preview=skillPreview(state,hero.id,skill.id);
    assert.deepEqual(state,before,`${bossId}/${hero.id}/${skill.id} preview mutated combat`);
    assert.equal(preview.resourceBefore,actor.resource);
    assert.ok(Array.isArray(preview.notes));
    const result=useSkill(state,hero.id,skill.id);assert.equal(result.ok,true,result.error);
    const damage=result.events.filter(event=>event.type==='attack'&&event.targets?.includes('boss')).reduce((sum,event)=>sum+(event.amount||0),0);
    assert.equal(preview.damage,damage,`${bossId}/${hero.id}/${skill.id} damage preview`);
    assert.equal(preview.resourceAfter,actor.resource,`${bossId}/${hero.id}/${skill.id} resource preview`);
    valid(state);
  }
});

test('v2: each new boss dies at zero HP without entering the golem core mechanic',()=>{
  for(const bossId of ['duelist','cantor']){
    const state=createBattle('standard',bossId);state.boss.hp=1;
    const result=useSkill(state,'knibbs','shot');assert.equal(result.ok,true);
    assert.equal(state.mode,'victory');assert.equal(state.boss.hp,0);assert.equal(state.boss.core,false);
    assert.ok(result.events.some(event=>event.type==='victory'));
    refuse(state,()=>endRound(state));refuse(state,()=>prepareResponse(state,'parry','knibbs'));valid(state);
  }
});

test('v2: each new boss announces a phase change when damaged through half health',()=>{
  for(const bossId of ['duelist','cantor']){
    const state=createBattle('standard',bossId);state.boss.hp=Math.floor(state.boss.maxHp/2)+1;
    const result=useSkill(state,'knibbs','shot');assert.equal(result.ok,true);
    assert.equal(state.boss.stage,1);assert.equal(state.boss.core,false);
    assert.ok(result.events.some(event=>event.type==='phase'));valid(state);
  }
});

for(const bossId of ['duelist','cantor'])for(const difficulty of Object.keys(DIFFICULTIES)){
  test(`v2 whole battle ${bossId}/${difficulty}: doing nothing sees distinct intents and ends in defeat`,()=>{
    const state=createBattle(difficulty,bossId),seen=new Set();
    while(state.mode==='playing'&&state.round<=60){
      seen.add(state.boss.intent);assert.equal(endRound(state).ok,true);valid(state);
    }
    assert.equal(state.mode,'defeat');assert.ok(seen.size>=3);
    console.log(`SIM ${bossId}/${difficulty} defeat: round=${state.round}, intents=${seen.size}`);
  });
}



test('v2: ammunition prepares full intuition and the next heavy shot spends it once',()=>{
  const state=createBattle('standard','golem',{loadouts:{knibbs:['shot','focus','loadburst','breathe']}});
  assert.equal(useSkill(state,'knibbs','loadburst').ok,true);
  assert.equal(heroOf(state,'knibbs').intuition,3);
  const before=clone(state),preview=skillPreview(state,'knibbs','focus');assert.deepEqual(state,before);
  const result=useSkill(state,'knibbs','focus');assert.equal(result.ok,true);
  assert.equal(result.events.find(event=>event.type==='attack').amount,56+36+24);
  assert.equal(preview.damage,56+36+24);
  assert.equal(heroOf(state,'knibbs').intuition,0);
  assert.equal(state.boss.stagger,state.boss.maxStagger-30);valid(state);
});

test('v2: alternating damage types increases Apeilia damage and refund while repeating blade slows combo',()=>{
  let state=createBattle();
  useSkill(state,'apeilia','blade');assert.equal(heroOf(state,'apeilia').resource,2);
  useSkill(state,'apeilia','blade');assert.equal(heroOf(state,'apeilia').resource,3);
  const result=useSkill(state,'apeilia','purify');assert.equal(result.ok,true);
  assert.equal(heroOf(state,'apeilia').resource,7);assert.equal(heroOf(state,'apeilia').lastKind,'magic');
  assert.equal(result.events.find(event=>event.type==='attack').amount,2*(18+6-4)); // Alternation +6 INT; rock shell +4 INT.
  state=createBattle();heroOf(state,'apeilia').resource=6;heroOf(state,'apeilia').lastKind='physical';
  const preview=skillPreview(state,'apeilia','sentinel');useSkill(state,'apeilia','sentinel');
  assert.equal(preview.damage,50+6);assert.equal(heroOf(state,'apeilia').resource,1);valid(state);
});

test('v2: Ric sign flips grant one chaos charge without party healing or shields',()=>{
  let state=createBattle();heroOf(state,'ric').resource=-1;heroOf(state,'apeilia').hp=0;
  assert.equal(useSkill(state,'ric','rune').ok,true);
  assert.equal(heroOf(state,'ric').resource,1);assert.equal(heroOf(state,'ric').balanceBursts,1);
  assert.ok(state.heroes.every(h=>h.shield===0));assert.equal(heroOf(state,'ric').ricChaos,1);
  state=createBattle();heroOf(state,'ric').resource=1;state.heroes.forEach(hero=>hero.hp-=20);
  assert.equal(useSkill(state,'ric','bind').ok,true);
  assert.equal(heroOf(state,'ric').resource,-2);assert.equal(heroOf(state,'ric').balanceBursts,1);
  for(const hero of state.heroes)assert.equal(hero.hp,hero.maxHp-20);
  assert.equal(state.stats.healed,0);assert.equal(heroOf(state,'ric').ricChaos,1);valid(state);
});

test('v2: magic hits remove individual mirrors and physical mitigation follows the remaining count',()=>{
  const state=createBattle('standard','duelist');state.boss.mirror=3;
  const preview=skillPreview(state,'apeilia','purify'),result=useSkill(state,'apeilia','purify');
  assert.equal(preview.damage,2*18);assert.equal(result.events.find(event=>event.type==='attack').amount,2*18);
  assert.equal(state.boss.mirror,1);assert.ok(preview.notes.some(note=>note.includes('拆除 2 镜片')));
  const shot=useSkill(state,'knibbs','shot');assert.equal(shot.events.find(event=>event.type==='attack').amount,22-3); // The last mirror grants 3 AGI.
  assert.equal(state.boss.mirror,1);valid(state);
});

test('v2: mirror stance reflects once per physical skill after guard and shield, and magic is safe',()=>{
  const state=createBattle('standard','duelist');state.boss.intent='mirror';state.boss.mirror=3;
  useSkill(state,'knibbs','scatter');heroOf(state,'knibbs').intuition=0;
  const hero=heroOf(state,'knibbs');hero.guard=true;hero.shield=2;
  const preview=skillPreview(state,'knibbs','shot'),result=useSkill(state,'knibbs','shot');
  assert.equal(preview.damage,(22-9)+5);assert.equal(result.events.find(event=>event.type==='attack').amount,(22-9)+5);
  const reflections=result.events.filter(event=>event.label==='折镜反噬');assert.equal(reflections.length,1);
  assert.deepEqual(reflections[0].amounts,{knibbs:0});assert.equal(hero.hp,170);assert.equal(hero.shield,1);
  assert.ok(preview.notes.some(note=>note.includes('基础')&&note.includes('防御 / 护盾前')));
  const magic=useSkill(state,'apeilia','purify');assert.ok(!magic.events.some(event=>event.label==='折镜反噬'));valid(state);
});

test('v2: multi-hit physical strips spores and exposes the advertised magic vulnerability',()=>{
  const state=createBattle('standard','cantor');state.boss.spores=5;
  assert.equal(skillPreview(state,'apeilia','purify').damage,2*(18-6));
  assert.equal(useSkill(state,'knibbs','scatter').ok,true);assert.equal(useSkill(state,'knibbs','shot').ok,true);assert.equal(state.boss.spores,0);
  const preview=skillPreview(state,'apeilia','purify'),result=useSkill(state,'apeilia','purify');
  assert.equal(preview.damage,2*(18-(-4)));assert.equal(result.events.find(event=>event.type==='attack').amount,2*(18-(-4)));
  assert.ok(preview.notes.some(note=>note.includes('裸冠')));valid(state);
});

test('v2: removing spores lowers bloom damage and release clears all remaining spores',()=>{
  const damage=[];
  for(const spores of [0,5]){
    const state=createBattle('standard','cantor');state.boss.intent='bloom';state.boss.spores=spores;
    const result=endRound(state),event=result.events.find(event=>event.label==='冠孢绽放');
    damage.push(event.amounts.knibbs);assert.equal(state.boss.spores,0);valid(state);
  }
  assert.deepEqual(damage,[50-4,50+5*14+6]); // Zero spores: -4 INT; five spores: +70 pressure and +6 INT.
});

test('v2: recovery grants one full round of control immunity and then permits a new break',()=>{
  for(const bossId of ['duelist','cantor']){
    const state=createBattle('standard',bossId);state.boss.stagger=8;
    useSkill(state,'knibbs','shot');assert.equal(state.boss.broken,true);
    endRound(state);assert.equal(state.boss.controlImmune,1);state.boss.stagger=1;
    assert.equal(useSkill(state,'ric','bind').ok,true);assert.equal(state.boss.broken,false);assert.equal(state.boss.stagger,1);
    endRound(state);assert.equal(state.boss.controlImmune,0);
    useSkill(state,'knibbs','shot');useSkill(state,'knibbs','shot');assert.equal(state.boss.broken,true);valid(state);
  }
});


test('v2: direct interruption previews the entire lost posture instead of ordinary skill stagger',()=>{
  for(const [bossId,intent] of [['duelist','pierce'],['cantor','drain']]){
    const state=createBattle('standard',bossId);state.boss.intent=intent;
    const preview=skillPreview(state,'ric','bind');assert.equal(preview.stagger,state.boss.maxStagger);
    assert.equal(useSkill(state,'ric','bind').ok,true);assert.equal(state.boss.stagger,0);assert.equal(state.boss.broken,true);valid(state);
  }
});







test('v2: Ric natural balance recovery approaches zero without negative-zero serialization drift',()=>{
  const state=createBattle('standard','cantor');heroOf(state,'ric').resource=-1;endRound(state);
  assert.equal(heroOf(state,'ric').resource,0);assert.equal(Object.is(heroOf(state,'ric').resource,-0),false);valid(state);
});

function playEncounter(bossId,difficulty){
  // Plan the complete shared-AP turn, including preparation, before choosing a
  // shot. These four-command builds stay fixed for the entire encounter.
  const loadouts={knibbs:['shot','focus','loadburst','breathe'],apeilia:['blade','purify','eden','reboot'],ric:['rune','bind','shelter','mend']};
  const r=runPolicy(bossId,'tactical',difficulty,{includeState:true,onState:valid,loadouts,searchWidth:12});return {state:r.state,history:r.actions};
}

for(const bossId of ['duelist','cantor'])for(const difficulty of Object.keys(DIFFICULTIES)){
  test(`v2 whole battle ${bossId}/${difficulty}: public-API tactics can win without state edits`,()=>{
    const {state,history}=playEncounter(bossId,difficulty);
    assert.equal(state.mode,'victory',history.join(', '));valid(state);
    console.log(`SIM ${bossId}/${difficulty} victory: round=${state.round}, actions=${state.stats.actions}, HP=${state.heroes.map(hero=>hero.hp).join('/')}, potions=${state.potions}, breaks=${state.stats.breaks}`);
  });
}

test('v2: seeded mixed actions preserve all three encounters and save every live snapshot',()=>{
  let seed=0x9c3407a1;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(const bossId of Object.keys(BOSSES))for(const difficulty of Object.keys(DIFFICULTIES))for(let run=0;run<6;run++){
    const state=createBattle(difficulty,bossId);
    for(let step=0;step<200&&state.mode==='playing';step++){
      const choice=Math.floor(random()*20),hero=HEROES[Math.floor(random()*HEROES.length)],before=clone(state);
      let result;
      if(choice<12){const owner=HEROES[Math.floor(choice/4)];result=useSkill(state,owner.id,SKILLS[owner.id][choice%4].id);}
      else if(choice<15)result=prepareResponse(state,['parry','evade','counter'][choice-12],hero.id);
      else if(choice<17)result=usePotion(state,hero.id);
      else result=endRound(state);
      if(!result.ok)assert.deepEqual(state,before);
      valid(state);
    }
  }
});
