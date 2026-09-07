import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,resolvedSkill,skillPreview,endRound,prepareResponse} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {grantShield} from '../src/shields.js';
import {createFeedbackState,applyFeedbackImpact,impactTiming,hpLossFor} from '../src/battle-feedback.js';

function playView(before,after,events){const view=createFeedbackState(before,after);for(const event of events)for(let i=0;i<impactTiming(event).hits;i++)applyFeedbackImpact(view,event,i);return view;}
const act=(s,id,key)=>{const r=useSkill(s,id,key);assert.equal(r.ok,true,r.error);return r;};

test('v3.5 final audit: transplant and captain replacements cannot retain doctor damage-over-time or recovery fields',()=>{
  const s=createBattle('standard','duelist',{partyIds:['youmu','knibbs','apeilia'],upgrades:['youmu_pathology','youmu_suture','youmu_aftercare']}),h=heroOf(s,'youmu');h.specimen='mirror';
  const transplant=resolvedSkill(s,'youmu','surgery');assert.equal(transplant.damage,0);assert.ok(!transplant.dotDamage);assert.ok(!transplant.healSuppression);
  act(s,'youmu','surgery');assert.equal(s.boss.dot,null);assert.equal(s.boss.healSuppression,0);
  act(s,'youmu','bloodoath');
  assert.ok(!resolvedSkill(s,'youmu','surgery').dotDamage);
  const barrage=resolvedSkill(s,'youmu','firstaid');for(const key of ['heal','revive','targetCleanse','aftercare'])assert.ok(!barrage[key],key);
  const cannon=resolvedSkill(s,'youmu','suture');for(const key of ['regenTurns','regenAmount','heal'])assert.ok(!cannon[key],key);
  assert.ok(normalizeSave(s));
});

test('v3.5 final audit: self-blood payment preserves shield batches and presentation pays the exact same HP once',()=>{
  const s=createBattle('standard','duelist',{partyIds:['youmu','knibbs','apeilia']}),h=heroOf(s,'youmu');grantShield(h,30);h.shieldLayers[0].turns=1;
  const before=structuredClone(s),r=act(s,'youmu','bloodoath'),blood=r.events.find(e=>e.label==='血誓 · 主动献血');
  assert.equal(hpLossFor(blood,'youmu'),99);assert.equal(blood.absorbedAmounts.youmu,0);assert.deepEqual(h.shieldLayers,[{amount:30,turns:1},{amount:24,turns:2}]);
  const view=playView(before,s,r.events);assert.equal(heroOf(view,'youmu').hp,h.hp);assert.equal(heroOf(view,'youmu').shield,h.shield);assert.ok(normalizeSave(s));
});

test('v3.5 final audit: expiry plus fresh harmony has the same final shield value in playback and saved combat',()=>{
  const s=createBattle('standard','duelist'),ric=heroOf(s,'ric');for(const h of s.heroes){grantShield(h,14);h.shieldLayers[0].turns=1;}
  ric.resource=-2;s.boss.broken=true;s.boss.stagger=0;
  const before=structuredClone(s),r=endRound(s),view=playView(before,s,r.events);
  for(const h of s.heroes){assert.equal(h.shield,10);assert.equal(heroOf(view,h.id).shield,10);assert.deepEqual(h.shieldLayers,[{amount:10,turns:2}]);}
  assert.ok(normalizeSave(s));
});

test('v3.5 final audit: forced control and posture break cannot bank two cancelled enemy turns in either order',()=>{
  for(const order of ['control-first','break-first']){
    const s=createBattle('standard','warden',{partyIds:['qianxing','knibbs','apeilia'],upgrades:['qianxing_lock']}),h=heroOf(s,'qianxing');s.loadouts.qianxing=['spike','beam','armor','repair','lock'];h.secondary=3;s.boss.stagger=1;
    if(order==='control-first'){act(s,'qianxing','lock');act(s,'knibbs','shot');}else{act(s,'knibbs','shot');act(s,'qianxing','lock');}
    assert.equal(s.boss.broken,true);assert.equal(s.boss.hardControl,0);assert.ok(normalizeSave(s));const hp=s.heroes.map(h=>h.hp);
    endRound(s);assert.deepEqual(s.heroes.map(h=>h.hp),hp);assert.equal(s.boss.controlImmune,1);assert.equal(s.boss.exposed,false);
    endRound(s);assert.ok(s.heroes.some((h,i)=>h.hp<hp[i]));assert.equal(s.boss.controlImmune,0);assert.ok(normalizeSave(s));
  }
});

test('v3.5 final audit: physical retaliation and prepared counter neither consume nor amplify a next-active-attack buff',()=>{
  for(const counter of ['retaliation','response']){
    const s=createBattle('standard','duelist',{partyIds:['qianxing','knibbs','apeilia']}),h=heroOf(s,'qianxing');h.attackBuff=40;h.attackBuffTurns=2;s.boss.intent='rend';s.boss.mirror=0;
    if(counter==='retaliation')h.reflect=1;else assert.ok(prepareResponse(s,'counter','qianxing').ok);
    const baseline=structuredClone(s);heroOf(baseline,'qianxing').attackBuff=0;heroOf(baseline,'qianxing').attackBuffTurns=0;
    const normal=endRound(baseline).events.find(e=>e.type==='attack'&&e.actor==='qianxing');
    const r=endRound(s),event=r.events.find(e=>e.type==='attack'&&e.actor==='qianxing');assert.ok(event);
    assert.equal(h.attackBuff,40);assert.equal(h.attackBuffTurns,1);assert.equal(event.amount,normal.amount);
    const unbuffed=structuredClone(s);heroOf(unbuffed,'qianxing').attackBuff=0;heroOf(unbuffed,'qianxing').attackBuffTurns=0;
    const preview=skillPreview(s,'qianxing','spike'),plain=skillPreview(unbuffed,'qianxing','spike');
    const attack=act(s,'qianxing','spike').events.find(e=>e.type==='attack'&&e.actor==='qianxing');assert.equal(h.attackBuff,0);assert.ok(preview.damage>plain.damage);assert.equal(attack.amount,preview.damage);assert.ok(normalizeSave(s));
  }
});

test('v3.5 final audit: a wound exposes the final core after the old attack and never triggers unannounced terminal damage',()=>{
  for(const controlled of [false,true]){
    const s=createBattle('standard','final',{partyIds:['youmu','knibbs','apeilia']});s.boss.hp=1;s.boss.dot={damage:8,turns:2,actor:'youmu',kind:'physical'};s.boss.hardControl=controlled?1:0;
    const r=endRound(s),phaseAt=r.events.findIndex(e=>e.label==='停机过载'),lastOldAttack=r.events.findLastIndex(e=>e.type==='boss'&&e.amount>0);
    assert.ok(phaseAt>=0);assert.ok(lastOldAttack<phaseAt);assert.ok(!r.events.some(e=>e.label==='停机过载 · 最后放电'));
    assert.equal(s.boss.finale,true);assert.equal(s.boss.finaleTurns,2);assert.equal(s.boss.finaleFresh,false);assert.equal(s.boss.finaleHits,0);assert.equal(s.boss.dot,null);assert.equal(s.boss.hardControl,0);assert.ok(normalizeSave(s));
  }
});

test('v3.5 final audit: wound-driven stage escalation cannot strengthen the attack that was already forecast',()=>{
  const s=createBattle('standard','warden',{partyIds:['youmu','knibbs','apeilia']});s.boss.hp=Math.floor(s.boss.maxHp*.5)+1;s.boss.charge=0;
  const baseline=structuredClone(s);s.boss.dot={damage:8,turns:2,actor:'youmu',kind:'physical'};
  endRound(baseline);const r=endRound(s);assert.deepEqual(s.heroes.map(h=>h.hp),baseline.heroes.map(h=>h.hp));assert.equal(s.boss.stage,1);assert.equal(baseline.boss.stage,0);
  const lastAttack=r.events.findLastIndex(e=>e.type==='boss'&&e.amount>0),woundAt=r.events.findIndex(e=>e.label==='手术创口'),phaseAt=r.events.findIndex(e=>e.type==='phase');assert.ok(lastAttack<woundAt&&woundAt<phaseAt);assert.ok(normalizeSave(s));
});

test('v3.5 final audit: a cancelled enemy action still ticks wounds, but a lethal action cannot be rescued by a postmortem wound',()=>{
  const locked=createBattle('standard','warden',{partyIds:['youmu','knibbs','apeilia']});locked.boss.hardControl=1;locked.boss.dot={damage:8,turns:2,actor:'youmu',kind:'physical'};
  const hp=locked.boss.hp;endRound(locked);assert.equal(locked.boss.hp,hp-8);assert.equal(locked.boss.dot.turns,1);assert.ok(normalizeSave(locked));
  const dying=createBattle('standard','duelist',{mode:'solo',partyIds:['youmu']});dying.heroes[0].hp=1;dying.boss.hp=1;dying.boss.dot={damage:8,turns:2,actor:'youmu',kind:'physical'};
  const r=endRound(dying);assert.equal(dying.mode,'defeat');assert.equal(dying.boss.hp,1);assert.ok(!r.events.some(e=>e.label==='手术创口'));assert.ok(!r.events.some(e=>e.type==='victory'));
});
