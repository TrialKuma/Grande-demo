import {attackSpec} from '../src/combat.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSSES,BOSS_INTENTS,HEROES,DIFFICULTIES,SOLO_RULES,createBattle,heroOf,canUse,useSkill,skillPreview,resolvedSkill,prepareResponse,responseOptions,endRound,guard,intentInfo,victoryRequirements} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {bossCodexView} from '../src/boss-codex.js';
import {runSolo,chooseSoloTurn} from '../scripts/solo-probe.mjs';

const added=['tide','furnace','orrery','arbiter'];
const cast=(s,h,k)=>{const p=skillPreview(s,h,k),r=useSkill(s,h,k);assert.equal(r.ok,true,r.error);const hit=r.events.find(e=>e.type==='attack');if(hit){assert.equal(hit.amount,p.damage,`${s.boss.id}/${h}/${k} damage preview`);assert.equal(hit.hits,p.hits);}return r;};
const solo=(hero='knibbs',boss='golem',options={})=>createBattle('standard',boss,{mode:'solo',partyIds:[hero],...options});
const mainDamage=(result,id)=>result.events.filter(e=>e.type==='boss'&&e.amounts).reduce((n,e)=>n+(e.amounts[id]||0),0);

test('3.3: six-combo finishers require full payment and an alternating cycle funds either reward',()=>{
  for(const id of ['eden','sentinel']){
    const s=createBattle('standard','tide'),h=heroOf(s,'apeilia');h.resource=5;
    assert.match(canUse(s,h.id,id),/需要 6/);
    h.resource=6;assert.equal(canUse(s,h.id,id),'');assert.equal(resolvedSkill(s,h.id,id).cost,6);
  }
  const eden=solo('apeilia','tide',{upgrades:['apeilia_cascade']});
  cast(eden,'apeilia','blade');cast(eden,'apeilia','purify');assert.equal(eden.heroes[0].resource,6);
  const p=skillPreview(eden,'apeilia','eden');assert.equal(p.hits,6);assert.equal(p.stagger,50);assert.equal(p.ap,2);
  cast(eden,'apeilia','eden');assert.equal(eden.heroes[0].resource,1);assert.equal(eden.ap,0);
  const sentinel=solo('apeilia','tide',{upgrades:['apeilia_zero']});
  cast(sentinel,'apeilia','purify');cast(sentinel,'apeilia','blade');assert.equal(sentinel.heroes[0].resource,6);
  assert.equal(skillPreview(sentinel,'apeilia','sentinel').ap,1);cast(sentinel,'apeilia','sentinel');
  assert.equal(sentinel.heroes[0].resource,1);assert.equal(sentinel.ap,1);
});

test('3.3: each added boss has four moves, a scene, and live telegraphs matching actual role-defense damage',()=>{
  assert.equal(Object.values(BOSSES).filter(b=>!b.isTutorial&&!b.isSkirmish&&!b.isMinion).length,10);
  for(const mode of ['party','solo'])for(const difficulty of Object.keys(DIFFICULTIES))for(const boss of added)for(const intent of BOSS_INTENTS[boss])for(const tactic of ['none','armor']){
    const s=createBattle(difficulty,boss,{mode,partyIds:mode==='solo'?['qianxing']:['qianxing','haart','knibbs']});
    s.boss.intent=intent;s.boss.stage=1;
    if(boss==='tide')s.boss.waterLevel=4;
    if(boss==='furnace')s.boss.heat=6;
    if(boss==='orrery')s.boss.prediction=3;
    if(boss==='arbiter')s.boss.violations=3;
    const info=intentInfo(s),before=s.heroes[0].hp;const spec=attackSpec(s);if(tactic==='armor'){s.heroes[0].secondary=1;cast(s,'qianxing','armor');}const expected=Math.max(0,Math.round(spec.damage*DIFFICULTIES[difficulty].damage*(mode==='solo'?SOLO_RULES.bossDamage:1)*(tactic==='armor'?45:100)/100)*(spec.hits||1)-(tactic==='armor'?36:0));
    assert.ok(info.name&&info.desc&&info.icon,`${boss}/${intent}`);
    assert.match(info.desc,/(物理|魔法)伤害/);
    assert.equal(mainDamage(endRound(s),'qianxing'),Math.min(before,expected),`${mode}/${difficulty}/${intent}/${tactic}`);
  }
  for(const id of added){assert.equal(BOSS_INTENTS[id].length,4);assert.ok(BOSSES[id].scene);}
});

test('3.3: tide counts hit segments across skills and turns, and filling retains its ordered effects without generic parry',()=>{
  const s=createBattle('standard','tide');
  cast(s,'knibbs','shot');cast(s,'knibbs','shot');assert.equal(s.boss.valveHits,2);assert.equal(s.boss.waterLevel,2);
  prepareResponse(s,'evade','knibbs');endRound(s);assert.equal(s.boss.valveHits,2);
  cast(s,'apeilia','purify');assert.equal(s.boss.waterLevel,1);assert.equal(s.boss.valveHits,1);
  s.boss.intent='tide_fill';cast(s,'knibbs','cover');endRound(s);assert.equal(s.boss.waterLevel,3);
  s.boss.intent='tide_breaker';prepareResponse(s,'evade','knibbs');endRound(s);assert.equal(s.boss.waterLevel,0);
});

test('3.3: furnace opens after steam, grants real vulnerability, and any hit cools only while open',()=>{
  const s=createBattle('standard','furnace');cast(s,'knibbs','shot');assert.equal(s.boss.heat,2);
  s.boss.intent='furnace_vent';prepareResponse(s,'evade','knibbs');endRound(s);assert.equal(s.boss.furnaceOpen,true);
  const closed=structuredClone(s);closed.boss.furnaceOpen=false;
  assert.ok(skillPreview(s,'apeilia','purify').damage>skillPreview(closed,'apeilia','purify').damage);
  cast(s,'apeilia','purify');assert.equal(s.boss.heat,0);
  s.boss.intent='furnace_drop';prepareResponse(s,'evade','knibbs');endRound(s);assert.equal(s.boss.furnaceOpen,false);assert.equal(s.boss.heat,0);
});

test('3.3: orrery records whole attack skills once, supports and counterattacks cannot reset repetition',()=>{
  const s=createBattle('standard','orrery');
  cast(s,'knibbs','scatter');assert.equal(s.boss.prediction,0);assert.equal(s.boss.forecastSkill,'knibbs/scatter');
  cast(s,'knibbs','breathe');assert.equal(s.boss.forecastSkill,'knibbs/scatter');
  cast(s,'knibbs','scatter');assert.equal(s.boss.prediction,1,'six hits count as one repeated skill');
  prepareResponse(s,'counter','knibbs');endRound(s);assert.equal(s.boss.forecastSkill,'knibbs/scatter');assert.equal(s.boss.prediction,1);
  cast(s,'apeilia','purify');assert.equal(s.boss.prediction,0);assert.equal(s.boss.forecastSkill,'apeilia/purify');
  s.boss.intent='orbit_calibrate';s.boss.prediction=3;const before=s.boss.hp;
  endRound(s);assert.equal(s.boss.hp,Math.min(s.boss.maxHp,before+55));assert.equal(s.boss.prediction,3);
});

test('3.3: arbiter checks actual empowered AP once per attack and clears judgement even after a break',()=>{
  const s=createBattle('standard','arbiter',{upgrades:['apeilia_zero']});const h=heroOf(s,'apeilia');h.resource=6;h.lastKind='physical';
  cast(s,h.id,'sentinel');assert.equal(s.boss.violations,0,'one-AP empowered attack obeys light decree');
  cast(s,'knibbs','scatter');assert.equal(s.boss.violations,1,'six segments are a single violation');
  cast(s,'knibbs','breathe');assert.equal(s.boss.violations,1);
  assert.match(intentInfo(s).desc,/违令 1\/3/);
  s.boss.stagger=1;cast(s,'knibbs','shot');assert.equal(s.boss.broken,true);
  endRound(s);assert.equal(s.boss.decree,'heavy');assert.equal(s.boss.violations,0);
  cast(s,'knibbs','shot');assert.equal(s.boss.violations,1);
});

test('3.3: solo owns one hero, separate boss numbers, and five base AP plus capped carry',()=>{
  for(const h of HEROES){const s=solo(h.id);assert.equal(s.heroes.length,1);assert.equal(s.heroes[0].id,h.id);assert.equal(s.heroes[0].maxHp,h.maxHp);assert.equal(s.boss.maxHp,576);assert.equal(s.boss.maxStagger,120);assert.equal(s.maxAp,5);}
  assert.equal(solo('missing').heroes[0].id,'knibbs');assert.equal(createBattle().maxAp,6);assert.equal(createBattle().boss.maxStagger,160);
  const s=solo('knibbs','tide');s.boss.stagger=1;prepareResponse(s,'parry');cast(s,'knibbs','shot');endRound(s);
  assert.equal(s.ap,7);assert.equal(s.maxAp,7);assert.equal(s.roundCarry,2);assert.equal(s.response,null);assert.ok(normalizeSave(s));
  assert.deepEqual(victoryRequirements(s),{solo:true,coreHits:4,corePhysical:0,coreMagic:0,finaleHits:2,finalePhysical:0,finaleMagic:0});
});

test('3.3: single-attribute solo attacks legally complete the core and terminal still needs character defense',()=>{
  for(const hero of ['knibbs','haart']){
    const s=solo(hero);s.boss.hp=1;cast(s,hero,hero==='knibbs'?'shot':'page');assert.equal(s.boss.coreHits,0);
    if(hero==='knibbs')cast(s,hero,'scatter');else{cast(s,hero,'page');assert.equal(s.boss.coreHits,1);assert.ok(normalizeSave(s));cast(s,hero,'relay');}
    assert.equal(s.mode,'victory');assert.equal(s.boss.reforms,0);
  }
  const s=solo('haart','final');s.boss.hp=1;cast(s,'haart','page');assert.equal(s.boss.finaleHits,0);
  cast(s,'haart','page');cast(s,'haart','page');assert.equal(s.boss.finaleHits,2);assert.equal(s.boss.finalePhysical,0);assert.ok(normalizeSave(s));
  const unprotected=structuredClone(s);endRound(unprotected);assert.equal(unprotected.mode,'playing','the hit condition alone cannot win');
  cast(s,'haart','soothe');endRound(s);assert.equal(s.mode,'victory');assert.ok(s.heroes[0].hp>0);
  const dead=solo('haart','final');Object.assign(dead.boss,{hp:0,finale:true,finaleHits:2,finaleMagic:1,seals:0});dead.heroes[0].hp=1;prepareResponse(dead,'evade');endRound(dead);assert.equal(dead.mode,'defeat');
});

test('3.3: solo synergy requires a different prior skill and never starts enabled',()=>{
  const s=solo('haart','tide',{upgrades:['haart_triage']});assert.equal(resolvedSkill(s,'haart','soothe').stripBuffs,undefined);
  cast(s,'haart','rest');assert.equal(resolvedSkill(s,'haart','soothe').stripBuffs,1);
  const repeated=solo('haart','tide',{upgrades:['haart_triage']});repeated.heroes[0].secondary=2;cast(repeated,'haart','soothe');assert.equal(resolvedSkill(repeated,'haart','soothe').stripBuffs,undefined);
  const q=solo('qianxing','tide',{upgrades:['qianxing_reinforce']});cast(q,'qianxing','spike');assert.equal(resolvedSkill(q,'qianxing','armor').reflect,2);assert.equal(resolvedSkill(q,'qianxing','armor').allShield,undefined);
});

test('3.3: current state and existing v5 saves roundtrip without changing damage or mode',()=>{
  for(const mode of ['party','solo'])for(const id of added){
    const s=createBattle('standard',id,{mode,partyIds:mode==='solo'?['patch']:['patch','youmu','ric']});
    cast(s,'patch','keyblade');cast(s,'patch','chargedslash');prepareResponse(s,'evade','patch');
    const restored=normalizeSave(JSON.parse(JSON.stringify(s)));assert.ok(restored,`${mode}/${id}`);
    assert.deepEqual(restored,{...s,elapsed:0});assert.deepEqual(endRound(restored),endRound(s));
  }
  const old=createBattle('standard','final');old.version=5;delete old.challengeMode;
  for(const key of ['coreHits','finaleHits','waterLevel','valveHits','heat','furnaceOpen','prediction','forecastSkill','decree','violations'])delete old.boss[key];
  const restored=normalizeSave(old);assert.ok(restored);assert.equal(restored.version,10);assert.equal(restored.challengeMode,'party');assert.equal(restored.maxAp,6);assert.equal(restored.boss.maxHp,old.boss.maxHp);
});

test('3.3: save validation rejects mode swaps, foreign mechanics and impossible new counters',()=>{
  for(const mutate of [s=>s.challengeMode='party',s=>s.maxAp=6,s=>s.boss.maxHp++,s=>s.boss.waterLevel=5,s=>s.boss.valveHits=3,s=>s.boss.heat=1,s=>s.boss.prediction=1,s=>s.boss.forecastSkill='knibbs/shot',s=>s.boss.violations=1,s=>s.boss.coreHits=1,s=>s.boss.finaleHits=1]){
    const s=solo('knibbs','tide');mutate(s);assert.equal(normalizeSave(s),null);
  }
  const orrery=solo('knibbs','orrery');orrery.boss.forecastSkill='haart/page';assert.equal(normalizeSave(orrery),null);
  const old=solo();old.version=5;assert.equal(normalizeSave(old),null);
});

test('3.3: switching dossiers preserves solo numbers and removes party-only core/terminal gates',()=>{
  const s=solo('haart','tide');
  for(const id of Object.keys(BOSSES).filter(id=>!BOSSES[id].isMinion&&!BOSSES[id].isSkirmish)){
    const markup=bossCodexView(s,id);assert.ok(markup.includes(`最大韧性 ${createBattle(s.difficulty,id,{mode:'solo',partyIds:['haart']}).boss.maxStagger}`));assert.ok(markup.includes('基础 5 AP'));assert.match(markup,/最多.*2.*(未使用|保留)/);
    assert.ok(markup.includes(`>${createBattle(s.difficulty,id,{mode:'solo',partyIds:['haart']}).boss.maxHp}</b>`));
    assert.ok(!markup.includes('物理与魔法各 3 次'),id);assert.ok(!markup.includes('先完成物理与魔法各 1 次'),id);assert.ok(!markup.includes('undefined'),id);
  }
  assert.match(bossCodexView(s,'golem'),/任意属性.*4/);assert.match(bossCodexView(s,'final'),/任意属性.*2/);
});

test('3.3: solo search takes an available lethal hit without padding recovery statistics',()=>{
  const s=solo('knibbs','tide');s.boss.hp=1;s.heroes[0].hp=50;
  const plan=chooseSoloTurn(s).plan;assert.deepEqual(plan,[['skill','shot','boss']]);
});

for(const h of HEROES)test(`3.3: ${h.id} clears all ten standard solo encounters using only public actions`,()=>{
  for(const boss of Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion)){
    const r=runSolo(h.id,boss);assert.equal(r.result,'victory',`${h.id}/${boss}: ${r.result}`);assert.ok(r.hp>0);assert.equal(r.reforms,0);assert.ok(r.actions.length>0);
    if(boss==='final'){assert.ok(r.defenseAp>0);assert.equal(r.responseAp,0);};
  }
});

test('3.3: attack-only solo play cannot brute-force the terminal for any of the seven heroes',()=>{
  for(const h of HEROES){const r=runSolo(h.id,'final','standard',{policy:'raw'});assert.equal(r.result,'defeat',h.id);assert.equal(r.responseAp,0);assert.equal(r.guardAp,0);assert.equal(r.recoveryAp,0);}
});
