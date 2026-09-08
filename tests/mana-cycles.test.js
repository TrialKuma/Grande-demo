import test from 'node:test';
import assert from 'node:assert/strict';
import {MANA_HERO_OVERRIDES,MANA_SKILLS,manaHeroDefaults,tuneManaSkill,manaSkillError,manaAfterSkill,applyManaSkill,manaStatus,manaRefundFor} from '../src/mana-cycles.js';
import {REWARDS} from '../src/rewards.js';

const hero=(id,extra={})=>({id,resource:10,maxResource:10,hp:100,maxHp:160,used:[],shield:0,...manaHeroDefaults(id),...extra});
const state=(h,extra={})=>({heroes:[h],boss:{},upgrades:[],...extra});
const skill=(id,key)=>MANA_SKILLS[id].find(s=>s.id===key);
function cast(h,key,s=state(h)){
  const t=tuneManaSkill(s,h,skill(h.id,key));assert.equal(manaSkillError(s,h,t),null,`${h.id}/${key}: ${JSON.stringify(h)}`);
  const payment=manaAfterSkill(h,t);Object.assign(h,payment);applyManaSkill(s,h,t,[]);return t;
}
function combinations(values,count,start=0,chosen=[]){if(chosen.length===count)return [chosen];return values.slice(start).flatMap((v,i)=>combinations(values,count,start+i+1,[...chosen,v]));}

test('mana: distinct capacities, existing skill IDs, five rewards and no skill-owned mana returns',()=>{
  assert.deepEqual(Object.values(MANA_HERO_OVERRIDES).map(h=>[h.secondaryName,h.maxSecondary]),[['念线',4],['充能',3],['记录',10]]);
  for(const id of Object.keys(MANA_HERO_OVERRIDES)){
    const entries=MANA_SKILLS[id];assert.equal(entries.length,7);assert.equal(new Set(entries.map(s=>s.id)).size,7);
    assert.equal(entries.filter(s=>!s.unlockKey).length,5);assert.equal(Object.values(REWARDS).filter(r=>r.heroId===id).length,5);
    for(const s of entries){assert.ok(s.ap>=1);assert.ok(!Object.hasOwn(s,'manaReturn'));assert.ok(!s.gain);assert.ok(s.desc.length>40);if(s.unlockKey)assert.equal(REWARDS[s.unlockKey].skillId,s.id);}
    for(const reward of Object.values(REWARDS).filter(r=>r.heroId===id&&r.kind==='upgrade')){assert.ok(reward.affects?.length,reward.id);assert.ok(reward.affects.every(key=>entries.some(s=>s.id===key)),reward.id);}
  }
});

test('mana: costly preparation buys stronger cash-outs while small spends keep superior unit efficiency',()=>{
  const cases=[['haart','rest','network',4,8,5],['qianxing','repair','nova',3,9,6],['patch','collate','revelation',6,8,2]];
  for(const [id,producer,full,quantity,cost,refund] of cases){
    const h=hero(id);const builder=cast(h,producer);assert.equal(builder.ap,2);assert.equal(h.resource,10-cost);assert.equal(h.secondary,quantity);
    for(const effect of ['damage','heal','shield','cleanse','attackBuff'])assert.equal(builder[effect],undefined);
    const spender=cast(h,full);assert.equal(spender.secondaryCost,quantity);assert.equal(spender.manaReturn,refund);assert.equal(h.resource,10-cost+refund);assert.equal(h.secondary,0);
    assert.ok(manaRefundFor(h,1)>manaRefundFor(h,quantity)/quantity);
    assert.ok(spender.damage>=30||spender.attackBuff>=60,'preparation cash-out provides strong combat effects');
  }
});

test('mana: every five-slot loadout has a legal resource action at every mana, stock, stance and upgrade boundary',()=>{
  for(const id of Object.keys(MANA_SKILLS))for(const loadout of combinations(MANA_SKILLS[id],5))for(const patchForm of id==='patch'?['observe','record']:['observe'])for(const upgraded of [false,true])for(let mana=0;mana<=10;mana++)for(let secondary=0;secondary<=MANA_HERO_OVERRIDES[id].maxSecondary;secondary++){
    const h=hero(id,{resource:mana,secondary,patchForm});
    const s=state(h,{upgrades:upgraded?Object.keys(REWARDS):[],loadouts:{[id]:loadout.map(t=>t.id)}});
    const usable=loadout.map(base=>tuneManaSkill(s,h,base)).filter(t=>!manaSkillError(s,h,t));
    assert.ok(usable.length,`${id} softlock: mana ${mana}, stock ${secondary}, loadout ${loadout.map(t=>t.id)}`);
    for(const action of usable){const result=manaAfterSkill(h,action);assert.ok(action.ap>=1);assert.ok(result.resource>=0&&result.resource<=10);assert.ok(result.secondary>=0&&result.secondary<=MANA_HERO_OVERRIDES[id].maxSecondary);assert.ok(Number.isInteger(result.secondary));}
  }
});

test('mana: emergency produces one powerless unit, and recovery invokes only the passive on a later action',()=>{
  for(const [id,key] of [['haart','page'],['qianxing','repair'],['patch','collate']]){
    const h=hero(id,{resource:0,secondary:0});const emergency=cast(h,key);
    assert.equal(emergency.ap,1);assert.equal(emergency.manaEmergency,true);assert.equal(emergency.manaReturn,0);assert.equal(h.resource,0);assert.equal(h.secondary,1);
    for(const effect of ['damage','heal','shield','cleanse','attackBuff','hardControl','weaken','patchStance'])assert.equal(emergency[effect],undefined,effect);
    const spender=cast(h,id==='haart'?'network':id==='qianxing'?'nova':'revelation');assert.equal(spender.manaRecovery,true);assert.equal(spender.ap,1);assert.equal(h.resource,manaRefundFor(h,1));assert.equal(h.secondary,0);assert.equal(spender.damage,undefined);
  }
});

test('mana: overflow is rejected, mana is capped and hand-written return values cannot grant mana',()=>{
  for(const [id,key] of [['haart','page'],['qianxing','spike'],['patch','keyblade']]){
    const h=hero(id,{secondary:MANA_HERO_OVERRIDES[id].maxSecondary});const s=state(h);let t=tuneManaSkill(s,h,skill(id,key));assert.match(manaSkillError(s,h,t),/放不下/);
    h.resource=0;h.secondary=2;t=tuneManaSkill(s,h,skill(id,key));assert.match(manaSkillError(s,h,t),/魔力不足/);
    const payment=manaAfterSkill(hero(id,{resource:9,secondary:1}),{secondaryCost:1,manaReturn:999});assert.equal(payment.resource,10);assert.equal(payment.secondary,0);
    assert.equal(manaAfterSkill(hero(id,{resource:0,secondary:0}),{secondaryCost:5,manaReturn:999}).resource,0);
  }
});

test('mana: Haart splits single-thread support, fixed two-thread damage and four-thread coordination',()=>{
  const h=hero('haart',{secondary:4}),s=state(h);let t=tuneManaSkill(s,h,skill('haart','soothe'));assert.equal(t.confuse,true);assert.equal(t.secondaryCost,1);assert.equal(t.manaReturn,3);
  t=tuneManaSkill(s,h,skill('haart','anchor'));assert.equal(t.secondaryCost,1);assert.equal(t.attackBuff,25);
  t=tuneManaSkill(s,h,skill('haart','relay'));assert.equal(t.secondaryCost,2);assert.equal(t.damage*t.hits,120);assert.equal(t.manaReturn,4);
  t=tuneManaSkill(s,h,skill('haart','network'));assert.equal(t.attackBuff,60);assert.equal(t.secondaryCost,4);assert.equal(t.manaReturn,5);
  t=tuneManaSkill(s,h,skill('haart','intercept'));assert.equal(t.hardControl,true);assert.equal(t.stripBuffs,2);assert.equal(t.secondaryCost,3);
  assert.ok(MANA_SKILLS.haart.every(s=>!s.heal&&!s.allHeal&&!s.shield));
});

test('mana: Qianxing keeps single-cell dispel and defensive recovery beside two- and three-cell firepower',()=>{
  const h=hero('qianxing',{secondary:3}),s=state(h);
  const pulse=tuneManaSkill(s,h,skill('qianxing','pulse'));assert.equal(pulse.secondaryCost,1);assert.equal(pulse.stripBuffs,1);assert.equal(pulse.damage,50);
  const armor=tuneManaSkill(s,h,skill('qianxing','armor'));assert.equal(armor.secondaryCost,1);assert.equal(armor.shield,36);assert.equal(armor.manaReturn,4);
  let beam=tuneManaSkill(s,h,skill('qianxing','beam'));assert.equal(beam.secondaryCost,3);assert.equal(beam.damage,210);assert.equal(beam.vulnerable,true);
  h.secondary=2;beam=tuneManaSkill(s,h,skill('qianxing','beam'));assert.equal(beam.damage,140);assert.equal(beam.secondaryCost,2);assert.equal(beam.manaReturn,5);
  const lock=tuneManaSkill(s,h,skill('qianxing','lock'));assert.equal(lock.secondaryCost,2);assert.equal(lock.hardControl,true);assert.equal(lock.damage,undefined);
});

test('mana: Patch preserves a one-record outlet and scales the final spell by six through ten records',()=>{
  for(const secondary of [6,7,8,9,10]){
    const h=hero('patch',{secondary}),s=state(h);
    const small=tuneManaSkill(s,h,skill('patch','chargedslash'));assert.equal(small.secondaryCost,1);assert.equal(small.damage,46);assert.equal(small.manaReturn,2);
    const observe=tuneManaSkill(s,h,skill('patch','revelation'));assert.equal(observe.secondaryCost,secondary);assert.equal(observe.hits,secondary);assert.equal(observe.damage,30);assert.equal(observe.stagger,secondary*4);assert.equal(observe.pierce,true);assert.equal(observe.hardControl,undefined);assert.equal(observe.manaReturn,2);
    h.patchForm='record';const record=tuneManaSkill(s,h,skill('patch','revelation'));assert.equal(!!record.hardControl,secondary>=8);assert.equal(record.stripBuffs,2);assert.equal(record.damage,22);assert.equal(record.manaReturn,3);
    const fragments=tuneManaSkill(s,h,skill('patch','fragments'));assert.equal(fragments.secondaryCost,3);assert.equal(fragments.stripBuffs,2);assert.equal(fragments.manaReturn,3);
  }
});

test('mana: removing both ordinary builders activates pure backup conversion while retaining another cheap outlet',()=>{
  for(const id of ['haart','qianxing']){
    const omitted=id==='haart'?['page','rest']:['spike','repair'],slot=id==='haart'?'anchor':'armor',small=id==='haart'?'soothe':'pulse';
    const h=hero(id),s=state(h,{loadouts:{[id]:MANA_SKILLS[id].filter(x=>!omitted.includes(x.id)).map(x=>x.id)}});
    const build=cast(h,slot,s);assert.equal(build.manaBackup,true);assert.equal(h.secondary,MANA_HERO_OVERRIDES[id].maxSecondary);assert.equal(build.damage,undefined);assert.equal(build.attackBuff,undefined);assert.equal(build.shield,undefined);
    assert.equal(tuneManaSkill(s,h,skill(id,slot)).secondaryCost,1);assert.equal(cast(h,small,s).secondaryCost,1);
    assert.equal(tuneManaSkill(s,h,skill(id,slot)).manaBackup,true);
  }
});

test('mana: upgrades strengthen tactical setup without turning preparation into high damage or granting free mana',()=>{
  const h=hero('haart',{secondary:2}),hs=state(h,{upgrades:['haart_insight','haart_echo'],boss:{weakened:true}});assert.equal(tuneManaSkill(hs,h,skill('haart','relay')).mark,true);const page=tuneManaSkill(hs,h,skill('haart','page'));assert.equal(page.damage*page.hits,12);assert.equal(page.secondaryGain,1);
  const q=hero('qianxing',{secondary:1}),qs=state(q,{upgrades:['qianxing_grounding'],boss:{heat:2}});assert.equal(tuneManaSkill(qs,q,skill('qianxing','pulse')).weaken,true);
  const p=hero('patch',{patchForm:'record',resource:1,secondary:0}),ps=state(p,{upgrades:['patch_doubleentry']});let t=tuneManaSkill(ps,p,skill('patch','keyblade'));assert.equal(t.cost,1);assert.equal(t.secondaryGain,1);assert.equal(t.manaReturn,0);assert.equal(t.manaEmergency,undefined);
  p.patchForm='observe';p.resource=3;t=tuneManaSkill(ps,p,skill('patch','bookward'));assert.equal(t.cost,3);assert.equal(t.secondaryGain,3);
});

test('mana: preview and payment are pure and applying the stance twice never pays twice',()=>{
  const h=hero('patch'),s=state(h),before=structuredClone(s);const t=tuneManaSkill(s,h,skill('patch','bookward'));
  assert.deepEqual(s,before);const paid=manaAfterSkill(h,t);assert.deepEqual(s,before);
  Object.assign(h,paid);applyManaSkill(s,h,t,[]);assert.equal(h.resource,6);assert.equal(h.secondary,3);assert.equal(h.patchForm,'record');
  applyManaSkill(s,h,t,[]);assert.equal(h.resource,6);assert.equal(h.secondary,3);assert.match(manaStatus(h),/记录 3 \/ 10.*收录/);
});

test('mana: solo Haart must use a different skill before coordinated suppression strips a buff',()=>{
  const h=hero('haart',{secondary:4,used:['soothe']}),s=state(h,{challengeMode:'solo',upgrades:['haart_triage']});
  assert.equal(tuneManaSkill(s,h,skill('haart','soothe')).stripBuffs,undefined);
  h.used.push('page');assert.equal(tuneManaSkill(s,h,skill('haart','soothe')).stripBuffs,1);
});
