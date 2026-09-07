import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSSES,REWARDS,HEROES,createBattle,heroOf,skillOf,activeSkills,canUse,useSkill,skillPreview,prepareResponse,endRound} from '../src/combat.js';
import {MANA_SKILLS,MANA_HERO_OVERRIDES,manaRefundFor} from '../src/mana-cycles.js';
import {grantShield} from '../src/shields.js';
import {normalizeSave} from '../src/save.js';

const manaIds=['haart','qianxing','patch'];
const allRewards=Object.keys(REWARDS);
function setup(id,boss='golem',extra={}){
  return createBattle('standard',boss,{partyIds:[id,...['knibbs','apeilia'].filter(x=>x!==id)].slice(0,3),...extra});
}
function equip(s,id,skillId){s.loadouts[id]=[skillId,...MANA_SKILLS[id].filter(x=>!x.unlockKey&&x.id!==skillId).map(x=>x.id)].slice(0,5);}

test('mana integration: every hero starts with canonical conversion and reclaim skills; only actual spending triggers the passive',()=>{
  for(const id of manaIds){
    const s=setup(id),h=heroOf(s,id);assert.equal(h.secondary,0);assert.equal(h.resource,10);assert.equal(activeSkills(s,id).length,5);assert.equal(h.secondaryName,HEROES.find(x=>x.id===id).secondaryName);
    const producer={haart:'page',qianxing:'spike',patch:'keyblade'}[id],raw=MANA_SKILLS[id].find(x=>x.id===producer),p=skillPreview(s,id,producer);assert.equal(p.refund,0);assert.equal(p.secondaryAfter,1);assert.equal(p.resourceAfter,10-raw.cost);
    assert.ok(useSkill(s,id,producer).ok);assert.equal(h.resource,10-raw.cost);assert.equal(h.secondary,1);
    const secondary=h.secondary,mana=h.resource;endRound(s);assert.equal(h.resource,mana);assert.equal(h.secondary,secondary);
  }
});

test('mana integration: dynamic preview agrees with actual payment and direct damage across bosses, tiers, forms and upgrades',()=>{
  let checked=0;
  for(const id of manaIds)for(const bossId of Object.keys(BOSSES))for(const secondary of Array.from({length:MANA_HERO_OVERRIDES[id].maxSecondary+1},(_,n)=>n))for(const rewarded of [false,true])for(const base of MANA_SKILLS[id]){
    if(base.unlockKey&&!rewarded)continue;
    const s=setup(id,bossId,{upgrades:rewarded?allRewards:[]}),h=heroOf(s,id);equip(s,id,base.id);
    h.secondary=secondary;h.records=id==='patch'?secondary:0;h.resource=secondary?4:10;
    if(rewarded){h.patchForm=id==='patch'?'record':'observe';h.attackBuff=25;h.attackBuffTurns=2;grantShield(h,20);s.boss.weakened=1;}
    if(canUse(s,id,base.id))continue;
    const snapshot=structuredClone(s),p=skillPreview(s,id,base.id);assert.deepEqual(s,snapshot,'preview must not mutate battle');
    const beforeAp=s.ap,result=useSkill(s,id,base.id);assert.ok(result.ok);const label=`${id}/${base.id}/${bossId}/secondary${secondary}/growth${rewarded}`;
    assert.equal(h.resource,p.resourceAfter,label+' mana');assert.equal(h.secondary,p.secondaryAfter,label+' secondary');assert.equal(beforeAp-s.ap,p.ap,label+' action points');
    const actual=result.events.filter(e=>e.type==='attack'&&e.targets?.includes('boss')).reduce((n,e)=>n+(e.amount||0),0);assert.equal(actual,p.damage,label+' damage');
    if(id==='patch')assert.equal(h.records,h.secondary,label+' legacy alias');checked++;
  }
  assert.ok(checked>1000,`expected broad skill paths, got ${checked}`);
});

test('mana integration: failed overflow or insufficient-secondary casts preserve all state',()=>{
  for(const id of manaIds){
    const s=setup(id),h=heroOf(s,id),producer={haart:'page',qianxing:'spike',patch:'keyblade'}[id];h.secondary=MANA_HERO_OVERRIDES[id].maxSecondary;h.records=id==='patch'?h.secondary:0;
    let before=structuredClone(s),r=useSkill(s,id,producer);assert.equal(r.ok,false);assert.match(r.error,/放不下/);assert.deepEqual(s,before);
    h.secondary=0;h.records=0;const consumer={haart:'relay',qianxing:'pulse',patch:'chargedslash'}[id];before=structuredClone(s);r=useSkill(s,id,consumer);assert.equal(r.ok,false);assert.match(r.error,/不足/);assert.deepEqual(s,before);
  }
});

test('mana integration: emergency and low-stock reclamation do not retain the original attack, shield, heal or cooldown',()=>{
  for(const [id,producer,consumer] of [['haart','page','intercept'],['qianxing','spike','lock'],['patch','bookward','injunction']]){
    const s=setup(id,'golem',{upgrades:allRewards}),h=heroOf(s,id);h.resource=0;h.secondary=0;h.records=0;h.hp-=20;equip(s,id,consumer);
    if(!s.loadouts[id].includes(producer))s.loadouts[id][1]=producer;
    const initialHp=h.hp,initialBossHp=s.boss.hp;let p=skillPreview(s,id,producer);assert.equal(p.damage,0);assert.equal(p.heal,0);assert.equal(p.shield,0);
    assert.ok(useSkill(s,id,producer).ok);assert.equal(h.resource,0);assert.equal(h.secondary,1);assert.equal(h.hp,initialHp);assert.equal(h.shield,0);assert.equal(h.attackBuff,0);
    p=skillPreview(s,id,consumer);assert.equal(p.ap,1);assert.equal(p.damage,0);const expected=manaRefundFor(h,1);assert.ok(useSkill(s,id,consumer).ok);assert.equal(h.resource,expected);assert.equal(h.secondary,0);assert.equal(s.boss.hp,initialBossHp);assert.equal(s.boss.hardControl,0);assert.equal(s.boss.weakened,0);assert.ok(!h.cooldowns[consumer]);
  }
});

test('mana integration: choosing evade never bypasses the secondary-resource cycle',()=>{
  for(const id of manaIds){
    const s=setup(id),h=heroOf(s,id);h.resource=4;h.secondary=2;h.records=id==='patch'?2:0;
    assert.ok(prepareResponse(s,'evade',id).ok);assert.ok(endRound(s).ok);assert.equal(h.resource,4);assert.equal(h.secondary,2);assert.equal(h.attackBuff,15);assert.ok(h.attackBuffTurns>0);
  }
});

test('mana integration: Haart grants an individual next-attack buff that survives utility and is consumed once',()=>{
  const s=setup('haart','golem',{upgrades:['haart_network']}),h=heroOf(s,'haart');equip(s,'haart','network');h.secondary=4;h.resource=1;
  assert.ok(useSkill(s,'haart','network').ok);assert.equal(h.resource,6);for(const ally of s.heroes)assert.equal(ally.attackBuff,60);
  const before=skillPreview(s,'knibbs','shot').damage;assert.ok(useSkill(s,'knibbs','breathe').ok);assert.equal(heroOf(s,'knibbs').attackBuff,60);assert.equal(skillPreview(s,'knibbs','shot').damage,before);
  assert.ok(useSkill(s,'knibbs','shot').ok);assert.equal(heroOf(s,'knibbs').attackBuff,0);assert.equal(heroOf(s,'apeilia').attackBuff,60);assert.equal(h.attackBuff,60);
});

test('mana integration: Patch archive upgrade cleanses every ally despite the shield being self-only',()=>{
  const s=setup('patch','golem',{upgrades:['patch_archive']});for(const h of s.heroes)h.resonance=2;
  assert.ok(useSkill(s,'patch','bookward').ok);for(const h of s.heroes)assert.equal(h.resonance,1,h.id);
  assert.equal(heroOf(s,'patch').shield,8);assert.equal(heroOf(s,'knibbs').shield,0);assert.equal(heroOf(s,'apeilia').shield,0);
});

test('mana integration: one hard-control action skips one ordinary turn then grants a complete resistance turn',()=>{
  const s=setup('qianxing','warden',{upgrades:['qianxing_lock']}),h=heroOf(s,'qianxing');equip(s,'qianxing','lock');h.secondary=3;h.resource=1;
  const hp=s.heroes.map(x=>x.hp);assert.ok(useSkill(s,'qianxing','lock').ok);assert.equal(s.boss.hardControl,1);assert.equal(s.boss.charge,0);
  assert.ok(endRound(s).ok);assert.deepEqual(s.heroes.map(x=>x.hp),hp);assert.equal(s.boss.hardControl,0);assert.equal(s.boss.controlImmune,1);
  h.secondary=3;h.cooldowns.lock=0;assert.ok(useSkill(s,'qianxing','lock').ok);assert.equal(s.boss.hardControl,0);assert.ok(endRound(s).ok);assert.ok(s.heroes.some((x,i)=>x.hp<hp[i]));assert.equal(s.boss.controlImmune,0);
});

test('mana integration: core and finale ignore hard control and strip effects but still consume records and return mana',()=>{
  for(const bossId of ['golem','final']){
    const s=setup('patch',bossId,{upgrades:['patch_injunction']}),h=heroOf(s,'patch');equip(s,'patch','injunction');h.secondary=4;h.records=4;h.resource=1;h.patchForm='record';
    s.boss.core=bossId==='golem';s.boss.finale=bossId==='final';s.boss.fog=5;s.boss.seals=3;
    assert.ok(useSkill(s,'patch','injunction').ok);assert.equal(h.resource,4);assert.equal(h.secondary,0);assert.equal(s.boss.hardControl,0);assert.equal(s.boss.fog,5);assert.equal(s.boss.seals,3);
  }
});

test('mana integration: v8 save retains mana, secondary stock and stance after both conversion and reclamation',()=>{
  for(const id of manaIds){
    const s=setup(id),producer={haart:'page',qianxing:'spike',patch:'bookward'}[id];assert.ok(useSkill(s,id,producer).ok);
    const restored=normalizeSave(structuredClone(s));assert.ok(restored,id);assert.equal(heroOf(restored,id).resource,heroOf(s,id).resource);assert.equal(heroOf(restored,id).secondary,heroOf(s,id).secondary);
    const consumer={haart:'soothe',qianxing:'pulse',patch:'chargedslash'}[id],expected=skillPreview(restored,id,consumer);assert.ok(useSkill(restored,id,consumer).ok);const again=normalizeSave(structuredClone(restored));assert.ok(again,id);
    assert.equal(heroOf(again,id).resource,expected.resourceAfter);assert.equal(heroOf(again,id).secondary,expected.secondaryAfter);if(id==='patch')assert.equal(heroOf(again,id).patchForm,'record');
  }
});
