import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,HEROES,heroOf,useSkill,usePotion,guard,endRound} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';

function clone(value) {return JSON.parse(JSON.stringify(value));}
function invalid(mutate) {const value=createBattle();mutate(value);assert.equal(normalizeSave(value),null);}

test('save: all fresh difficulty states normalize and old missing elapsed defaults to zero',()=>{
  for(const difficulty of ['story','standard','challenge']) {
    const value=createBattle(difficulty),restored=normalizeSave(value);assert.deepEqual(restored,{...value,elapsed:0});assert.notEqual(restored,value);
  }
});

test('save: valid in-progress state resumes with identical subsequent skill and round results',()=>{
  const value=createBattle('challenge');useSkill(value,'knibbs','focus');useSkill(value,'ric','bind');guard(value,'apeilia');value.elapsed=123.75;
  const restored=normalizeSave(clone(value));assert.deepEqual(restored,value);
  assert.deepEqual(endRound(restored),endRound(value));assert.deepEqual(restored,value);
  assert.deepEqual(useSkill(restored,'apeilia','blade'),useSkill(value,'apeilia','blade'));assert.deepEqual(restored,value);
});

test('save: exposed core retains hit counts, freshness and complete-turn deadline',()=>{
  const value=createBattle();value.boss.hp=1;useSkill(value,'knibbs','shot');useSkill(value,'apeilia','purify');endRound(value);
  const restored=normalizeSave(clone(value));assert.ok(restored);assert.equal(restored.boss.coreMagic,2);assert.equal(restored.boss.coreTurns,2);assert.equal(restored.boss.coreFresh,false);
  assert.deepEqual(endRound(restored),endRound(value));assert.equal(restored.boss.coreTurns,1);
  useSkill(restored,'knibbs','scatter');useSkill(restored,'ric','bind');assert.equal(restored.mode,'victory');
});

test('save: timed-out reformed boss and a selected fallen teammate are valid',()=>{
  const value=createBattle();value.boss.hp=1;useSkill(value,'knibbs','shot');endRound(value);endRound(value);endRound(value);
  heroOf(value,'apeilia').hp=0;value.selected='apeilia';const restored=normalizeSave(clone(value));assert.ok(restored);assert.equal(restored.boss.reforms,1);assert.equal(restored.boss.coreTurns,0);
  assert.equal(usePotion(restored,restored.selected).ok,true);assert.equal(heroOf(restored,'apeilia').hp,60);assert.equal(useSkill(restored,'apeilia','blade').ok,true);
});

test('save: invalid top-level shapes, unsupported version, finished modes and unknown difficulty fail closed',()=>{
  for(const value of [null,undefined,[],{},'bad',7])assert.equal(normalizeSave(value),null);
  invalid(s=>s.version=11);invalid(s=>s.mode='victory');invalid(s=>s.mode='defeat');invalid(s=>s.difficulty='missing');invalid(s=>s.difficulty='toString');invalid(s=>s.difficulty=['standard']);
});

test('save: invalid hero membership, selected IDs or incomplete hero records are rejected',()=>{
  invalid(s=>s.heroes=[]);invalid(s=>s.heroes[0]=null);invalid(s=>s.heroes[1].id='knibbs');invalid(s=>s.heroes[0].id='missing');invalid(s=>s.selected='missing');invalid(s=>delete s.heroes[0].cooldowns);invalid(s=>delete s.heroes[0].used);invalid(s=>s.heroes.forEach(h=>h.hp=0));
});

test('save: current hero definitions replace untrusted metadata while preserving the chosen party order',()=>{
  const value=createBattle();value.heroes.reverse();for(const hero of value.heroes){hero.name='<bad>';hero.color='red;display:none';hero.maxHp=9999;hero.maxResource=9999;hero.role='outdated';hero.extra='discard';}
  const restored=normalizeSave(value);assert.ok(restored);assert.deepEqual(restored.heroes.map(h=>h.id),value.heroes.map(h=>h.id));
  for(const hero of restored.heroes){const canonical=HEROES.find(h=>h.id===hero.id);for(const key of Object.keys(canonical))assert.equal(hero[key],canonical[key]);}
  assert.equal(restored.heroes[0].extra,undefined);
});

test('save: nonfinite, fractional, negative and excessive state numbers are rejected',()=>{
  for(const amount of [NaN,Infinity,-Infinity,-1,6.5,7])invalid(s=>s.ap=amount);
  invalid(s=>s.maxAp=99);invalid(s=>s.round=0);invalid(s=>s.serial=-1);invalid(s=>s.potions=4);invalid(s=>s.elapsed=NaN);invalid(s=>s.elapsed=-1);invalid(s=>s.elapsed=10000001);
  invalid(s=>s.heroes[0].hp=171);invalid(s=>s.heroes[0].hp=NaN);invalid(s=>s.heroes[0].resource=-1);invalid(s=>s.heroes[1].resource=11);invalid(s=>s.heroes[2].resource=-11);invalid(s=>s.heroes[2].resource=11);invalid(s=>s.heroes[0].shield=61);invalid(s=>s.heroes[0].resonance=6);invalid(s=>s.heroes[0].guard='yes');
});

test('save: cooldown and per-round usage records are bounded and limited to that hero skills',()=>{
  invalid(s=>s.heroes[0].used={});invalid(s=>s.heroes[0].used=['bind']);invalid(s=>s.heroes[0].used=Array(21).fill('shot'));invalid(s=>s.heroes[0].cooldowns=[]);invalid(s=>s.heroes[0].cooldowns={bind:1});invalid(s=>s.heroes[2].cooldowns={bind:21});invalid(s=>s.heroes[2].cooldowns={bind:NaN});
  const value=createBattle();value.heroes[0].used=['shot','shot'];value.heroes[2].cooldowns={bind:0};assert.ok(normalizeSave(value));
});

test('save: invalid boss numbers, structures and contradictory active states are rejected',()=>{
  invalid(s=>s.boss=null);invalid(s=>s.boss.hp=NaN);invalid(s=>s.boss.hp=901);invalid(s=>s.boss.maxHp=1000);invalid(s=>s.boss.stage=5);invalid(s=>s.boss.stagger=-1);invalid(s=>s.boss.maxStagger=200);invalid(s=>s.boss.corePhysical=4);invalid(s=>s.boss.coreTurns=3);invalid(s=>s.boss.fog=6);invalid(s=>s.boss.intent='missing');invalid(s=>s.boss.intentTarget='missing');invalid(s=>delete s.boss.coreFresh);
  invalid(s=>s.boss.hp=0);invalid(s=>s.boss.core=true);invalid(s=>{s.boss.broken=true;s.boss.charging=true;});invalid(s=>s.boss.coreFresh=true);
});

test('save: malformed stats and log entries cannot enter the presentation layer',()=>{
  invalid(s=>s.stats=null);invalid(s=>delete s.stats.actions);invalid(s=>s.stats.damage=NaN);invalid(s=>s.stats.healed=-1);invalid(s=>s.log={});invalid(s=>s.log=[null]);invalid(s=>s.log=[{text:'event',tone:'bad" onclick="alert(1)'}]);invalid(s=>s.log=[{text:123,tone:'normal'}]);invalid(s=>s.log=Array(81).fill({text:'event',tone:'normal'}));
});

test('save: normalization is pure and returns independent arrays and nested objects',()=>{
  const value=createBattle();value.elapsed=42;const before=clone(value);const restored=normalizeSave(value);assert.deepEqual(value,before);
  restored.heroes[0].used.push('shot');restored.heroes[0].cooldowns.shot=1;restored.log[0].text='changed';restored.stats.actions++;restored.boss.hp--;
  assert.deepEqual(value,before);
});

test('save: every snapshot from a complete normal API battle remains resumable until victory',()=>{
  let state=createBattle('story');
  for(let step=0;step<200&&state.mode==='playing';step++){
    const restored=normalizeSave(clone(state));assert.ok(restored,`snapshot ${step}`);state=restored;
    if(state.boss.core){
      if(state.boss.corePhysical<3&&useSkill(state,'knibbs','scatter').ok)continue;
      if(state.boss.coreMagic<3&&useSkill(state,'apeilia','purify').ok)continue;
      if(state.boss.coreMagic<3&&useSkill(state,'ric','rune').ok)continue;
    }else{
      if(state.boss.charging&&useSkill(state,'ric','bind').ok)continue;
      if(!state.boss.marked&&useSkill(state,'knibbs','focus').ok)continue;
      if(useSkill(state,'apeilia','eden').ok)continue;
      if(useSkill(state,'apeilia','blade').ok)continue;
    }
    endRound(state);
  }
  assert.equal(state.mode,'victory');assert.equal(normalizeSave(state),null);
});

// Captured v1 schema: intentionally does not derive state from the current factory.
function legacyV1() {
  return {
    version:1,mode:'playing',difficulty:'standard',round:1,ap:6,maxAp:6,selected:'knibbs',
    heroes:[
      {id:'knibbs',hp:170,shield:0,resource:8,resonance:0,cooldowns:{},used:[],guard:false},
      {id:'apeilia',hp:145,shield:0,resource:0,resonance:0,cooldowns:{},used:[],guard:false},
      {id:'ric',hp:160,shield:0,resource:0,resonance:0,cooldowns:{},used:[],guard:false}
    ],
    boss:{hp:900,maxHp:900,stage:0,core:false,corePhysical:0,coreMagic:0,coreTurns:2,coreFresh:false,reforms:0,stagger:100,maxStagger:100,broken:false,marked:false,fog:0,charging:false,intent:'slam',intentTarget:'knibbs'},
    potions:3,log:[{text:'你们踏入遗迹。魔晶巨人已苏醒。',tone:'system'}],
    stats:{damage:0,healed:0,breaks:0,interrupts:0,actions:0,turns:0},serial:0
  };
}

test('save v2: a real v1 shape migrates to golem with new passives and no prepared response',()=>{
  const old=legacyV1(),before=clone(old),restored=normalizeSave(old);
  assert.ok(restored);assert.deepEqual(old,before);
  assert.equal(restored.version,10);assert.equal(restored.boss.id,'golem');
  assert.equal(restored.response,null);assert.equal(restored.boss.hp,900);
  assert.equal(heroOf(restored,'knibbs').intuition,0);
  assert.equal(heroOf(restored,'apeilia').lastKind,null);
  assert.equal(heroOf(restored,'ric').balanceBursts,0);
  assert.equal(useSkill(restored,'knibbs','shot').ok,true);
  assert.equal(endRound(restored).ok,true);assert.ok(normalizeSave(restored));
});

test('save v2: legacy exposed cores retain progress and malformed legacy files still fail',()=>{
  const old=legacyV1();Object.assign(old.boss,{hp:0,core:true,coreFresh:false,corePhysical:2,coreMagic:1,coreTurns:1});old.round=7;old.ap=4;old.elapsed=66;
  const restored=normalizeSave(old);assert.ok(restored);
  assert.equal(restored.boss.corePhysical,2);assert.equal(restored.boss.coreMagic,1);
  assert.equal(restored.boss.coreTurns,1);assert.equal(restored.elapsed,66);
  assert.equal(useSkill(restored,'knibbs','shot').ok,true);
  assert.equal(useSkill(restored,'apeilia','purify').ok,true);assert.equal(restored.mode,'victory');
  const malformed=legacyV1();malformed.heroes[0].resource=11;assert.equal(normalizeSave(malformed),null);
});

test('save v2: unknown encounter, response and passive data are rejected',()=>{
  invalid(state=>state.boss.id='missing');invalid(state=>state.boss.id='toString');
  invalid(state=>state.boss.id=['golem']);invalid(state=>state.boss.phasePending='yes');
  invalid(state=>state.boss.mirror=4);invalid(state=>state.boss.spores=-1);invalid(state=>state.boss.controlImmune=2);
  invalid(state=>heroOf(state,'knibbs').intuition=4);
  invalid(state=>heroOf(state,'apeilia').lastKind='unknown');
  invalid(state=>heroOf(state,'ric').balanceBursts=-1);
  invalid(state=>state.response={id:'missing',actor:'knibbs'});
  invalid(state=>state.response={id:'parry',actor:'missing'});
  invalid(state=>state.response=[]);
});

test('save v4: current saves cannot add a seventh AP and bosses cannot inherit foreign mechanics',()=>{
  const refunded=createBattle('standard','duelist');refunded.maxAp=7;refunded.ap=7;
  assert.equal(normalizeSave(refunded),null);
  for(const bossId of ['duelist','cantor']){
    const state=createBattle('standard',bossId);state.boss.intent='slam';assert.equal(normalizeSave(state),null);
    const core=createBattle('standard',bossId);Object.assign(core.boss,{core:true,hp:0,coreFresh:true});assert.equal(normalizeSave(core),null);
  }
});

test('save v3: a captured v2 duelist response migrates without losing resources and refunds the obsolete response',()=>{
  const value=legacyV1();value.version=2;value.ap=5;value.response={id:'evade',actor:'apeilia'};
  value.heroes.forEach(hero=>Object.assign(hero,{intuition:0,lastKind:null,balanceBursts:0}));
  value.heroes[0].intuition=2;value.heroes[1].resource=4;value.heroes[1].lastKind='magic';
  Object.assign(value.boss,{id:'duelist',hp:1080,maxHp:1080,intent:'rend',phasePending:false,mirror:2,spores:0,controlImmune:0});
  const restored=normalizeSave(value);assert.ok(restored);assert.equal(restored.version,10);
  assert.equal(restored.response,null);assert.equal(restored.ap,6);assert.deepEqual(restored.upgrades,[]);
  assert.equal(heroOf(restored,'knibbs').intuition,2);assert.equal(heroOf(restored,'apeilia').lastKind,'magic');
  assert.equal(endRound(restored).ok,true);assert.ok(normalizeSave(restored));
});

test('save v3: invalid unlocks, loadout slots and unearned conditional charges are rejected',()=>{
  invalid(s=>s.upgrades=['missing']);invalid(s=>s.upgrades=['ric_grace','ric_grace']);
  invalid(s=>s.loadouts.knibbs=['shot','shot','scatter','breathe']);
  invalid(s=>s.loadouts.knibbs=['shot','focus','scatter','ricochet']);
  invalid(s=>delete s.loadouts.haart);invalid(s=>heroOf(s,'ric').grace=true);
  invalid(s=>heroOf(s,'ric').verdict=true);invalid(s=>s.heroes[0].reflect=3);
  const value=createBattle('standard','warden',{partyIds:['qianxing','haart','ric']});
  value.heroes[0].resource=11;assert.equal(normalizeSave(value),null);
});

// Legacy AP refund is normalized to the new fixed team budget without losing the encounter.
test('save v4: old seven-AP turns migrate to six and stagger keeps its remaining proportion',()=>{
  const old=legacyV1();old.version=2;old.ap=7;old.maxAp=7;old.response=null;old.boss.stagger=50;
  old.heroes.forEach(h=>Object.assign(h,{intuition:0,lastKind:null,balanceBursts:0}));
  Object.assign(old.boss,{id:'golem',phasePending:false,mirror:0,spores:0,controlImmune:0});
  const saved=normalizeSave(old);assert.ok(saved);assert.equal(saved.ap,6);assert.equal(saved.maxAp,6);
  assert.equal(saved.boss.stagger,saved.boss.maxStagger/2);assert.equal(saved.boss.exposed,false);
});

test('save v4: response-created exposure resumes and conflicting control states are rejected',()=>{
  const state=createBattle('standard','duelist');state.boss.exposed=true;state.boss.controlImmune=1;
  const saved=normalizeSave(state);assert.ok(saved);assert.equal(saved.boss.exposed,true);
  assert.deepEqual(endRound(saved),endRound(state));
  invalid(s=>s.boss.exposed='yes');
  invalid(s=>{s.boss.exposed=true;s.boss.broken=true;s.boss.stagger=0;});
});
