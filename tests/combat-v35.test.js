import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,skillPreview,resolvedSkill,canUse,endRound,prepareResponse,intentInfo,REWARDS,SKILLS} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {grantShield,absorbShield,ageShields} from '../src/shields.js';
const solo=(id,boss='duelist',upgrades=[])=>createBattle('standard',boss,{mode:'solo',partyIds:[id],upgrades});
const cast=(s,id,k)=>{const result=useSkill(s,id,k);assert.equal(result.ok,true,result.error);if(s.mode==='playing')assert.ok(normalizeSave(s),'resolved action must save');return result;};

test('v3.5 shields: new grants never refresh old batches; earliest expiry absorbs first',()=>{
  const h={shield:0,shieldLayers:[]};grantShield(h,30);ageShields(h);grantShield(h,20);
  assert.deepEqual(h.shieldLayers,[{amount:30,turns:1},{amount:20,turns:2}]);
  assert.equal(absorbShield(h,12),12);assert.equal(ageShields(h),18);
  assert.equal(h.shield,20);assert.deepEqual(h.shieldLayers,[{amount:20,turns:1}]);
  grantShield(h,50);assert.equal(h.shield,60);assert.equal(ageShields(h),20);assert.equal(h.shield,40);ageShields(h);assert.equal(h.shield,0);
});

test('v3.5 shields: cancelled enemy actions still age protection; harmony creates a fresh batch regardless of party order',()=>{
  for(const partyIds of [['ric','apeilia','knibbs'],['knibbs','apeilia','ric']]){
    const s=createBattle('standard','duelist',{partyIds});for(const h of s.heroes)grantShield(h,16);
    heroOf(s,'ric').resource=-2;s.boss.broken=true;s.boss.stagger=0;endRound(s);
    for(const h of s.heroes)assert.deepEqual(h.shieldLayers,[{amount:16,turns:1},{amount:10,turns:2}]);
    s.boss.broken=true;s.boss.stagger=0;s.boss.controlImmune=0;endRound(s);
    for(const h of s.heroes)assert.deepEqual(h.shieldLayers,[{amount:10,turns:1}]);
    assert.ok(normalizeSave(s));
  }
});

test('v3.5 saves: old shields get two rounds once; current layer duration cannot be forged',()=>{
  const old=solo('patch');old.version=6;old.heroes[0].shield=31;old.heroes[0].records=4;delete old.heroes[0].shieldLayers;delete old.heroes[0].secondary;
  const migrated=normalizeSave(old);assert.ok(migrated);assert.equal(migrated.version,8);assert.equal(migrated.heroes[0].secondary,4);assert.deepEqual(migrated.heroes[0].shieldLayers,[{amount:31,turns:2}]);
  ageShields(migrated.heroes[0]);const saved=normalizeSave(migrated);assert.deepEqual(saved.heroes[0].shieldLayers,[{amount:31,turns:1}]);
  for(const mutate of [s=>s.heroes[0].shieldLayers[0].turns=3,s=>s.heroes[0].shieldLayers[0].amount=30,s=>{s.heroes[0].secondary=11;s.heroes[0].records=11;},s=>s.boss.hardControl=1.5,s=>s.heroes[0].regenAmount=50]){const bad=structuredClone(saved);mutate(bad);assert.equal(normalizeSave(bad),null);}
});

test('v3.5 control: a two-charge lock skips one ordinary action without giving a break multiplier, then enforces immunity',()=>{
  const s=solo('qianxing','warden',['qianxing_lock']);s.loadouts.qianxing=['spike','beam','armor','repair','lock'];
  cast(s,'qianxing','spike');cast(s,'qianxing','spike');const before=s.heroes[0].hp;
  cast(s,'qianxing','lock');assert.equal(s.boss.hardControl,1);assert.equal(s.boss.broken,false);assert.equal(s.heroes[0].resource,9);assert.equal(s.heroes[0].secondary,0);
  assert.match(intentInfo(s).name,/封锁/);assert.equal(prepareResponse(s,'parry').ok,false);
  endRound(s);assert.equal(s.heroes[0].hp,before);assert.equal(s.boss.controlImmune,1);assert.equal(s.boss.hardControl,0);assert.equal(s.boss.exposed,false);
  assert.ok(normalizeSave(s));const hp=s.heroes[0].hp;endRound(s);assert.ok(s.heroes[0].hp<hp);assert.equal(s.boss.controlImmune,0);
});

test('v3.5 control: core and terminal rules cannot be bypassed by dispelling or locking',()=>{
  for(const boss of ['golem','final']){
    const s=solo('qianxing',boss,['qianxing_lock']);s.loadouts.qianxing=['spike','beam','armor','repair','lock'];s.boss.hp=1;
    cast(s,'qianxing','spike');cast(s,'qianxing','spike');const before=structuredClone(s.boss);
    cast(s,'qianxing','lock');assert.equal(s.boss.core,before.core);assert.equal(s.boss.finale,before.finale);assert.equal(s.boss.hardControl,0);assert.equal(s.boss.coreHits,before.coreHits);assert.equal(s.boss.finaleHits,before.finaleHits);assert.equal(s.heroes[0].secondary,0);assert.equal(s.heroes[0].resource,9);
  }
});

test('v3.5 distinct treatments: first aid rescues immediately, suture heals a living target after danger',()=>{
  const s=createBattle('standard','duelist',{partyIds:['youmu','knibbs','apeilia'],upgrades:['youmu_suture']});s.loadouts.youmu=['scalpel','firstaid','suture','sterilize','bloodoath'];
  heroOf(s,'knibbs').hp=0;heroOf(s,'apeilia').hp=20;
  const rescue=cast(s,'youmu','firstaid');assert.deepEqual(rescue.events.find(e=>e.type==='heal').amounts,{knibbs:30});assert.equal(heroOf(s,'apeilia').hp,20);
  const before=heroOf(s,'apeilia').hp;cast(s,'youmu','suture');assert.equal(heroOf(s,'apeilia').hp,before);assert.equal(heroOf(s,'apeilia').regenTurns,2);
  s.boss.broken=true;s.boss.stagger=0;endRound(s);assert.equal(heroOf(s,'apeilia').hp,52);assert.equal(heroOf(s,'apeilia').regenTurns,1);
  heroOf(s,'apeilia').hp=0;s.boss.broken=true;s.boss.controlImmune=0;s.boss.stagger=0;endRound(s);assert.equal(heroOf(s,'apeilia').hp,0);assert.equal(heroOf(s,'apeilia').regenTurns,0);
});

test('v3.5 blood oath: full HP can transform, self-payment ignores shields and redirects only single-target main attacks',()=>{
  const s=createBattle('standard','duelist',{partyIds:['knibbs','youmu','apeilia']});const h=heroOf(s,'youmu');grantShield(h,30);
  const result=cast(s,'youmu','bloodoath');assert.equal(h.hp,66);assert.equal(h.shield,54);assert.equal(h.captainTurns,2);assert.equal(h.tauntTurns,2);
  const blood=result.events.find(e=>e.label==='血誓 · 主动献血');assert.equal(blood.hpLosses.youmu,99);assert.equal(blood.absorbedAmounts.youmu,0);assert.match(intentInfo(s).desc,/目标：游木/);
  const knibbsHp=heroOf(s,'knibbs').hp;prepareResponse(s,'evade','youmu');endRound(s);assert.equal(heroOf(s,'knibbs').hp,knibbsHp);
  s.boss.broken=true;s.boss.stagger=0;s.boss.controlImmune=0;endRound(s);assert.equal(h.youmuForm,'doctor');assert.equal(h.tauntTurns,0);assert.equal(h.exhaustedTurns,2);assert.match(canUse(s,'youmu','bloodoath'),/已经/);
});

test('v3.5 wound DOT: prepared surgery leaves a finite wound and never supplies core hits',()=>{
  const s=solo('youmu','golem',['youmu_pathology']);cast(s,'youmu','scalpel');cast(s,'youmu','surgery');
  assert.deepEqual(s.boss.dot,{damage:12,turns:2,actor:'youmu',kind:'physical'});assert.equal(s.boss.healSuppression,2);
  s.boss.hp=1;const result=endRound(s);assert.ok(result.events.some(e=>e.label==='手术创口'));assert.equal(s.boss.core,true);assert.equal(s.boss.coreHits,0);assert.equal(s.boss.dot,null);assert.ok(normalizeSave(s));
});

test('v3.5 mind buffs: each ally consumes its own charge once; a recovery action cannot spend it',()=>{
  const s=createBattle('standard','duelist',{partyIds:['haart','knibbs','apeilia']});cast(s,'haart','page');cast(s,'haart','anchor');
  assert.ok(s.heroes.every(h=>h.attackBuff===25));const p=skillPreview(s,'knibbs','shot');cast(s,'knibbs','breathe');assert.equal(heroOf(s,'knibbs').attackBuff,25);
  const result=cast(s,'knibbs','shot');assert.equal(result.events.find(e=>e.type==='attack').amount,p.damage);assert.equal(heroOf(s,'knibbs').attackBuff,0);assert.equal(heroOf(s,'apeilia').attackBuff,25);
  cast(s,'apeilia','blade');assert.equal(heroOf(s,'apeilia').attackBuff,0);assert.equal(heroOf(s,'haart').attackBuff,25);
});

test('v3.5 mana evasion never bypasses secondary spending by returning free mana',()=>{
  for(const id of ['haart','qianxing','patch']){const s=solo(id);const h=s.heroes[0];const build=id==='haart'?'page':id==='qianxing'?'spike':'keyblade';cast(s,id,build);prepareResponse(s,'evade');const before=h.resource,secondary=h.secondary;endRound(s);assert.equal(h.resource,before);assert.equal(h.secondary,secondary);assert.equal(h.attackBuff,15);assert.equal(h.attackBuffTurns,2);assert.ok(normalizeSave(s));}
});

test('v3.5 all fourteen new upgrades change a concrete mechanic or unlock an independently selectable skill',()=>{
  const cases=[['knibbs','breathe','knibbs_steadyhands',(s,h)=>h.intuition=2,'selfAttackBuff'],['knibbs','cover','knibbs_crossfire',s=>s.boss.marked=true,'stripBuffs'],['apeilia','reboot','apeilia_brace',(s,h)=>h.lastKind='magic','selfGuard'],['apeilia','sentinel','apeilia_puncture',s=>s.boss.exposed=true,'gain'],['ric','mend','ric_erosion',()=>{},'healSuppression'],['ric','bind','ric_discipline',(s,h)=>h.resource=-4,'stripBuffs'],['youmu','surgery','youmu_pathology',(s,h)=>h.surgicalReady=true,'dotDamage'],['youmu','firstaid','youmu_aftercare',()=>{},'aftercare']];
  for(const [id,skill,key,setup,field]of cases){const s=solo(id);setup(s,s.heroes[0]);const before=resolvedSkill(s,id,skill);s.upgrades.push(key);assert.notEqual(resolvedSkill(s,id,skill)[field],before[field],key);}
  for(const id of ['knibbs','apeilia','ric','haart','qianxing','youmu','patch'])assert.equal(Object.values(REWARDS).filter(r=>r.heroId===id).length,5,id);
  for(const reward of Object.values(REWARDS).filter(r=>r.kind==='skill'))assert.equal(SKILLS[reward.heroId].find(k=>k.id===reward.skillId)?.unlockKey,reward.id);
});
