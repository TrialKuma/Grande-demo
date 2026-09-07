import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BOSSES as ALL_BOSSES, HEROES as ALL_HEROES, SKILLS, DIFFICULTIES, createBattle, heroOf, canUse,
  useSkill, usePotion, endRound, prepareResponse, responseOptions,
  skillPreview, heroStatus, bossSummary
} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';

const clone = state => structuredClone(state);
const BOSSES=Object.fromEntries(['golem','duelist','cantor'].map(id=>[id,ALL_BOSSES[id]]));
const HEROES=ALL_HEROES.slice(0,3);
function refuse(state, action) {
  const before=clone(state), result=action();
  assert.equal(result.ok,false); assert.deepEqual(result.events,[]);
  assert.deepEqual(state,before,'a refused action must be atomic');
}
function valid(state) {
  assert.equal(state.version,7);
  assert.ok(Object.hasOwn(BOSSES,state.boss.id));
  assert.ok(['playing','victory','defeat'].includes(state.mode));
  assert.equal(state.maxAp,6);
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

test('v2: response selection spends one AP, switching tactic or actor spends none',()=>{
  for(const bossId of Object.keys(BOSSES)) {
    const state=createBattle('standard',bossId);
    assert.deepEqual(responseOptions(state).map(option=>option.id).sort(),['counter','evade','parry']);
    assert.equal(prepareResponse(state,'parry','knibbs').ok,true);assert.equal(state.ap,5);
    assert.equal(state.response.id,'parry');assert.equal(state.response.actor,'knibbs');
    assert.equal(prepareResponse(state,'evade','apeilia').ok,true);assert.equal(state.ap,5);
    assert.equal(state.response.id,'evade');assert.equal(state.response.actor,'apeilia');
    state.ap=0;
    assert.equal(prepareResponse(state,'counter','ric').ok,true);assert.equal(state.ap,0);
    assert.equal(state.response.id,'counter');assert.equal(state.response.actor,'ric');valid(state);
  }
});

test('v2: changing the selected hero previews their response rewards without changing the prepared actor',()=>{
  const state=createBattle('standard','duelist');prepareResponse(state,'evade','knibbs');state.selected='apeilia';
  const before=clone(state),options=responseOptions(state);
  assert.ok(options.find(option=>option.id==='evade').reward.includes('艾佩莉雅连击'));
  assert.equal(state.response.actor,'knibbs');assert.deepEqual(state,before);
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

test('v2: the opening telegraph supports three responses with distinct resolved rewards',()=>{
  for(const bossId of Object.keys(BOSSES)){
    const outcomes=[];
    for(const responseId of ['parry','evade','counter']){
      const state=createBattle('standard',bossId);
      assert.equal(prepareResponse(state,responseId,'knibbs').ok,true);
      const result=endRound(state);assert.equal(result.ok,true);valid(state);
      outcomes.push(JSON.stringify({
        hp:state.heroes.map(hero=>hero.hp),shield:state.heroes.map(hero=>hero.shield),
        resource:state.heroes.map(hero=>hero.resource),intuition:heroOf(state,'knibbs').intuition,
        bossHp:state.boss.hp,stagger:state.boss.stagger,mirror:state.boss.mirror,spores:state.boss.spores
      }));
    }
    assert.equal(new Set(outcomes).size,3,`${bossId} response choices must produce different tradeoffs`);
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

test('v2: a prepared response survives save restoration and resolves deterministically',()=>{
  for(const bossId of Object.keys(BOSSES))for(const responseId of ['parry','evade','counter']){
    const state=createBattle('standard',bossId);
    assert.equal(prepareResponse(state,responseId,'apeilia').ok,true);
    const resumed=normalizeSave(JSON.parse(JSON.stringify(state)));assert.ok(resumed);
    assert.deepEqual(resumed.response,state.response);
    const original=endRound(state),restored=endRound(resumed);
    assert.deepEqual(restored,original);
    assert.deepEqual(resumed,{...state,elapsed:0});assert.equal(state.response,null);valid(state);
  }
});

test('v2: breaking a prepared enemy cancels its response without generating a seventh AP',()=>{
  for(const bossId of Object.keys(BOSSES)){
    const state=createBattle('standard',bossId);state.boss.stagger=8;
    assert.equal(prepareResponse(state,'parry','knibbs').ok,true);
    assert.equal(useSkill(state,'knibbs','shot').ok,true);assert.equal(state.boss.broken,true);
    const health=state.heroes.map(hero=>hero.hp);
    assert.equal(endRound(state).ok,true);assert.deepEqual(state.heroes.map(hero=>hero.hp),health);
    assert.equal(state.response,null);assert.equal(state.ap,6);assert.equal(state.maxAp,6);valid(state);
    assert.equal(endRound(state).ok,true);assert.equal(state.ap,6);assert.equal(state.maxAp,6);valid(state);
  }
});

test('v2: full intuition enhances the next heavy shot then begins a new three-step cycle',()=>{
  const state=createBattle();
  for(let index=0;index<3;index++)assert.equal(useSkill(state,'knibbs','shot').ok,true);
  assert.equal(heroOf(state,'knibbs').intuition,3);
  const before=clone(state),preview=skillPreview(state,'knibbs','focus');assert.deepEqual(state,before);
  const result=useSkill(state,'knibbs','focus');assert.equal(result.ok,true);
  assert.equal(result.events.find(event=>event.type==='attack').amount,Math.round(66*1.4));
  assert.equal(preview.damage,Math.round(66*1.4));
  assert.equal(heroOf(state,'knibbs').intuition,1);
  assert.equal(state.boss.stagger,state.boss.maxStagger-66);valid(state);
});

test('v2: alternating damage types increases Apeilia damage and refund while repeating blade slows combo',()=>{
  let state=createBattle();
  useSkill(state,'apeilia','blade');assert.equal(heroOf(state,'apeilia').resource,2);
  useSkill(state,'apeilia','blade');assert.equal(heroOf(state,'apeilia').resource,3);
  const result=useSkill(state,'apeilia','purify');assert.equal(result.ok,true);
  assert.equal(heroOf(state,'apeilia').resource,7);assert.equal(heroOf(state,'apeilia').lastKind,'magic');
  assert.equal(result.events.find(event=>event.type==='attack').amount,2*Math.round(27*1.25*.82));
  state=createBattle();heroOf(state,'apeilia').resource=6;heroOf(state,'apeilia').lastKind='physical';
  const preview=skillPreview(state,'apeilia','sentinel');useSkill(state,'apeilia','sentinel');
  assert.equal(preview.damage,130);assert.equal(heroOf(state,'apeilia').resource,1);valid(state);
});

test('v2: Ric crossing zero provides directional team support only to living allies',()=>{
  let state=createBattle();heroOf(state,'ric').resource=-1;heroOf(state,'apeilia').hp=0;
  assert.equal(useSkill(state,'ric','rune').ok,true);
  assert.equal(heroOf(state,'ric').resource,1);assert.equal(heroOf(state,'ric').balanceBursts,1);
  assert.equal(heroOf(state,'knibbs').shield,10);assert.equal(heroOf(state,'ric').shield,10);assert.equal(heroOf(state,'apeilia').shield,0);
  state=createBattle();heroOf(state,'ric').resource=1;state.heroes.forEach(hero=>hero.hp-=20);
  assert.equal(useSkill(state,'ric','bind').ok,true);
  assert.equal(heroOf(state,'ric').resource,-2);assert.equal(heroOf(state,'ric').balanceBursts,1);
  for(const hero of state.heroes)assert.equal(hero.hp,hero.maxHp-12);
  assert.equal(state.stats.healed,24);valid(state);
});

test('v2: magic hits remove individual mirrors and physical mitigation follows the remaining count',()=>{
  const state=createBattle('standard','duelist');state.boss.mirror=3;
  const preview=skillPreview(state,'apeilia','purify'),result=useSkill(state,'apeilia','purify');
  assert.equal(preview.damage,54);assert.equal(result.events.find(event=>event.type==='attack').amount,54);
  assert.equal(state.boss.mirror,1);assert.ok(preview.notes.some(note=>note.includes('拆除 2 镜片')));
  const shot=useSkill(state,'knibbs','shot');assert.equal(shot.events.find(event=>event.type==='attack').amount,24);
  assert.equal(state.boss.mirror,1);valid(state);
});

test('v2: mirror stance reflects once per physical skill after guard and shield, and magic is safe',()=>{
  const state=createBattle('standard','duelist');state.boss.intent='mirror';state.boss.mirror=3;
  const hero=heroOf(state,'knibbs');hero.guard=true;hero.shield=2;
  const preview=skillPreview(state,'knibbs','scatter'),result=useSkill(state,'knibbs','scatter');
  assert.equal(preview.damage,54);assert.equal(result.events.find(event=>event.type==='attack').amount,54);
  const reflections=result.events.filter(event=>event.label==='折镜反噬');assert.equal(reflections.length,1);
  assert.deepEqual(reflections[0].amounts,{knibbs:5});assert.equal(hero.hp,165);assert.equal(hero.shield,0);
  assert.ok(preview.notes.some(note=>note.includes('基础')&&note.includes('防御 / 护盾前')));
  const magic=useSkill(state,'apeilia','purify');assert.ok(!magic.events.some(event=>event.label==='折镜反噬'));valid(state);
});

test('v2: multi-hit physical strips spores and exposes the advertised magic vulnerability',()=>{
  const state=createBattle('standard','cantor');state.boss.spores=5;
  assert.equal(skillPreview(state,'apeilia','purify').damage,38);
  assert.equal(useSkill(state,'knibbs','scatter').ok,true);assert.equal(state.boss.spores,0);
  const preview=skillPreview(state,'apeilia','purify'),result=useSkill(state,'apeilia','purify');
  assert.equal(preview.damage,68);assert.equal(result.events.find(event=>event.type==='attack').amount,68);
  assert.ok(preview.notes.some(note=>note.includes('裸冠')));valid(state);
});

test('v2: removing spores lowers bloom damage and release clears all remaining spores',()=>{
  const damage=[];
  for(const spores of [0,5]){
    const state=createBattle('standard','cantor');state.boss.intent='bloom';state.boss.spores=spores;
    const result=endRound(state),event=result.events.find(event=>event.label==='冠孢绽放');
    damage.push(event.amounts.knibbs);assert.equal(state.boss.spores,0);valid(state);
  }
  assert.deepEqual(damage,[50,100]);
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

test('v2: a response-induced break exposes a damage window but does not skip a second enemy action',()=>{
  const state=createBattle('standard','duelist');state.boss.stagger=15;prepareResponse(state,'parry','knibbs');
  const attacked=endRound(state);assert.ok(attacked.events.some(event=>event.type==='boss'));
  assert.equal(state.boss.broken,false);assert.equal(state.boss.exposed,true);assert.equal(state.boss.controlImmune,1);assert.equal(state.ap,6);valid(state);
  const attack=useSkill(state,'knibbs','shot');assert.equal(attack.ok,true);assert.equal(state.boss.exposed,true);
  // Two remaining mirrors apply 20% physical resistance, then the 50% opening.
  assert.equal(attack.events.find(event=>event.type==='attack').amount,Math.round(27*.8*1.5));
  assert.equal(prepareResponse(state,'evade','knibbs').ok,true,'next telegraph still accepts a response');
  const recovered=endRound(state);assert.ok(recovered.events.some(event=>event.type==='boss'));
  assert.equal(state.boss.exposed,false);assert.equal(state.boss.broken,false);assert.equal(state.boss.controlImmune,0);valid(state);
});

test('v2: direct interruption previews the entire lost posture instead of ordinary skill stagger',()=>{
  for(const [bossId,intent] of [['duelist','pierce'],['cantor','drain']]){
    const state=createBattle('standard',bossId);state.boss.intent=intent;
    const preview=skillPreview(state,'ric','bind');assert.equal(preview.stagger,state.boss.maxStagger);
    assert.equal(useSkill(state,'ric','bind').ok,true);assert.equal(state.boss.stagger,0);assert.equal(state.boss.broken,true);valid(state);
  }
});

test('v2: a counter crossing a golem phase cannot add an unannounced follow-up to that action',()=>{
  const state=createBattle();state.boss.hp=750;
  prepareResponse(state,'counter','knibbs');const result=endRound(state);
  assert.equal(state.boss.stage,1);assert.equal(state.boss.charging,true);
  assert.deepEqual(result.events.filter(event=>event.type==='boss').map(event=>event.label),['势能重击']);
  assert.equal(heroOf(state,'apeilia').hp,145);assert.equal(heroOf(state,'ric').hp,160);valid(state);
});

test('v2: a counter exposes the golem core for two full rounds without an extra grace round',()=>{
  const state=createBattle();state.boss.hp=1;prepareResponse(state,'counter','knibbs');endRound(state);
  assert.equal(state.boss.core,true);assert.equal(state.boss.coreFresh,false);assert.equal(state.boss.coreTurns,2);valid(state);
  endRound(state);assert.equal(state.boss.coreTurns,1);assert.equal(state.boss.core,true);
  endRound(state);assert.equal(state.boss.core,false);assert.equal(state.boss.reforms,1);valid(state);
});

test('v2: mirror stance parry removes two mirrors while counter removes one without reflecting',()=>{
  for(const [response,remaining,damage] of [['parry',1,0],['counter',2,80]]){
    const state=createBattle('standard','duelist');state.boss.intent='mirror';state.boss.mirror=3;
    prepareResponse(state,response,'knibbs');const result=endRound(state);
    assert.equal(state.boss.mirror,remaining);assert.equal(state.boss.maxHp-state.boss.hp,damage);
    assert.ok(!result.events.some(event=>event.label==='折镜反噬'));valid(state);
  }
});

test('v2: drain parry prevents healing, while the stronger counter permits the advertised drain',()=>{
  for(const [response,healing,damage] of [['parry',0,0],['counter',66,104]]){
    const state=createBattle('standard','cantor');state.boss.intent='drain';state.boss.spores=3;state.boss.hp-=200;
    const before=state.boss.hp;prepareResponse(state,response,'knibbs');const result=endRound(state);
    assert.equal(result.events.find(event=>event.type==='heal'&&event.actor==='boss').amount,healing);
    assert.equal(state.boss.hp,before+healing-damage);valid(state);
  }
});

test('v2: bloom counter scales from the telegraphed spores even though release consumes them',()=>{
  const state=createBattle('standard','cantor');state.boss.intent='bloom';state.boss.spores=5;
  prepareResponse(state,'counter','knibbs');const result=endRound(state);
  assert.equal(result.events.find(event=>event.type==='attack').amount,125);
  assert.equal(state.boss.spores,0);valid(state);
});

test('v2: an absent response initiator is replaced by a survivor without losing the response',()=>{
  const state=createBattle('standard','cantor');prepareResponse(state,'evade','knibbs');heroOf(state,'knibbs').hp=0;
  assert.ok(normalizeSave(state));const result=endRound(state);assert.equal(result.ok,true);
  assert.equal(heroOf(state,'apeilia').resource,2);assert.equal(state.boss.spores,1);assert.equal(state.response,null);valid(state);
});

test('v2: Ric evasion approaches zero without negative-zero serialization drift',()=>{
  const state=createBattle('standard','cantor');heroOf(state,'ric').resource=-1;prepareResponse(state,'evade','ric');endRound(state);
  assert.equal(heroOf(state,'ric').resource,0);assert.equal(Object.is(heroOf(state,'ric').resource,-0),false);valid(state);
});

function playEncounter(bossId,difficulty){
  const state=createBattle(difficulty,bossId),history=[];
  function cast(id,skill){
    if(canUse(state,id,skill))return false;
    assert.equal(useSkill(state,id,skill).ok,true);history.push(`R${state.round} ${id}/${skill}`);valid(state);return true;
  }
  for(let step=0;state.mode==='playing'&&state.round<=50&&step<500;step++){
    const low=[...state.heroes].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];
    if(low.hp<40&&state.potions>0&&state.ap>0){assert.equal(usePotion(state,low.id).ok,true);valid(state);continue;}
    if(!state.boss.broken&&!state.boss.controlImmune&&['pierce','duel','drain','bloom'].includes(state.boss.intent)&&cast('ric','bind'))continue;
    if(low.hp/low.maxHp<.5&&cast('ric','mend'))continue;
    if(!state.response&&!state.boss.broken&&state.ap>0){assert.equal(prepareResponse(state,'parry','knibbs').ok,true);valid(state);continue;}
    if(bossId==='duelist'&&state.boss.mirror>0){if(cast('apeilia','purify'))continue;if(cast('ric','rune'))continue;}
    if(bossId==='cantor'&&state.boss.spores>0){if(cast('knibbs','scatter'))continue;if(cast('apeilia','eden'))continue;if(cast('apeilia','blade'))continue;}
    if(!state.boss.marked&&cast('knibbs','focus'))continue;
    const apeilia=heroOf(state,'apeilia');
    if(apeilia.lastKind==='physical'){if(cast('apeilia','sentinel'))continue;if(cast('apeilia','purify'))continue;}
    if(apeilia.lastKind==='magic'&&cast('apeilia','eden'))continue;
    if(cast('apeilia','blade'))continue;
    if(cast('knibbs','shot'))continue;
    assert.equal(endRound(state).ok,true);valid(state);
  }
  return {state,history};
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
