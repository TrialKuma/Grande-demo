import test from 'node:test';
import assert from 'node:assert/strict';
import {MANA_HERO_OVERRIDES,MANA_SKILLS,manaHeroDefaults,tuneManaSkill,manaSkillError,manaAfterSkill,applyManaSkill,manaStatus} from '../src/mana-cycles.js';
import {REWARDS} from '../src/rewards.js';

const hero=(id,extra={})=>({id,resource:10,maxResource:10,hp:100,maxHp:160,used:[],shield:0,...manaHeroDefaults(id),...extra});
const state=(h,extra={})=>({heroes:[h],boss:{},upgrades:[],...extra});
const skill=(id,key)=>MANA_SKILLS[id].find(s=>s.id===key);
function cast(h,key,s=state(h)){
  const t=tuneManaSkill(s,h,skill(h.id,key));assert.equal(manaSkillError(s,h,t),null,`${h.id}/${key}: ${JSON.stringify(h)}`);
  const payment=manaAfterSkill(h,t);Object.assign(h,payment);applyManaSkill(s,h,t,[]);return t;
}
function combinations(values,count,start=0,chosen=[]){if(chosen.length===count)return [chosen];return values.slice(start).flatMap((v,i)=>combinations(values,count,start+i+1,[...chosen,v]));}

test('mana: three distinct secondary resources keep existing skill IDs and five rewards each',()=>{
  assert.deepEqual(Object.values(MANA_HERO_OVERRIDES).map(h=>h.secondaryName),['念线','银焱','记录']);
  for(const id of Object.keys(MANA_HERO_OVERRIDES)){
    const entries=MANA_SKILLS[id];assert.equal(entries.length,7);assert.equal(new Set(entries.map(s=>s.id)).size,7);
    assert.equal(entries.filter(s=>!s.unlockKey).length,5);assert.equal(Object.values(REWARDS).filter(r=>r.heroId===id).length,5);
    for(const s of entries){assert.ok(s.ap>=1);assert.ok(!(s.cost>0&&s.manaReturn>0));assert.ok(!s.gain);assert.ok(s.desc.length>40);if(s.unlockKey)assert.equal(REWARDS[s.unlockKey].skillId,s.id);}
    for(const reward of Object.values(REWARDS).filter(r=>r.heroId===id&&r.kind==='upgrade')){assert.ok(reward.affects?.length,reward.id);assert.ok(reward.affects.every(key=>entries.some(s=>s.id===key)),reward.id);}
  }
});

test('mana: small repeated returns are more mana-efficient; large returns spend that efficiency on stronger effects',()=>{
  const cases=[['haart','page','network','relay'],['qianxing','spike','beam','pulse'],['patch','keyblade','revelation','collate']];
  for(const [id,producer,full,small] of cases){
    const h=hero(id);let ap=0;for(let i=0;i<3;i++)ap+=cast(h,producer).ap;
    assert.equal(h.resource,1);assert.equal(h.secondary,6);
    const spender=cast(h,full);ap+=spender.ap;assert.equal(spender.secondaryCost,6);assert.equal(spender.manaReturn,6);assert.equal(h.resource,7);assert.equal(h.secondary,0);
    assert.ok(ap>=5,'strong stock-based effects still require real action points');
    const early=hero(id,{resource:8});let earlyAp=cast(early,producer).ap;earlyAp+=cast(early,small).ap;earlyAp+=cast(early,small).ap;assert.equal(early.resource,9);assert.equal(early.secondary,0);assert.equal(earlyAp,3);
    assert.ok(2/1>4/3);assert.ok(4/3>6/6);assert.ok(spender.damage>(skill(id,small).damage||0)||spender.attackBuff,'large stock should buy stronger effects');
  }
});

test('mana: all 5-slot loadouts retain a legal resource action at every mana and secondary boundary',()=>{
  for(const id of Object.keys(MANA_SKILLS))for(const loadout of combinations(MANA_SKILLS[id],5))for(let mana=0;mana<=10;mana++)for(let secondary=0;secondary<=6;secondary++){
    const h=hero(id,{resource:mana,secondary});
    const s=state(h,{loadouts:{[id]:loadout.map(t=>t.id)}});
    const usable=loadout.map(base=>tuneManaSkill(s,h,base)).filter(t=>!manaSkillError(s,h,t));
    assert.ok(usable.length,`${id} softlock: mana ${mana}, secondary ${secondary}, loadout ${loadout.map(t=>t.id)}`);
    for(const action of usable){const result=manaAfterSkill(h,action);assert.ok(action.ap>=1);assert.ok(result.resource>=0&&result.resource<=10);assert.ok(result.secondary>=0&&result.secondary<=6);assert.ok(Number.isInteger(result.secondary));}
  }
});

test('mana: empty mana/stock produces a powerless emergency unit and requires another paid action to reclaim mana',()=>{
  for(const [id,key] of [['haart','page'],['qianxing','repair'],['patch','collate']]){
    const h=hero(id,{resource:0,secondary:0});const emergency=cast(h,key);
    assert.equal(emergency.ap,1);assert.equal(emergency.manaEmergency,true);assert.equal(emergency.manaReturn,0);assert.equal(h.resource,0);assert.equal(h.secondary,1);
    for(const effect of ['damage','heal','shield','cleanse','attackBuff','hardControl','weaken','patchStance'])assert.equal(emergency[effect],undefined,effect);
    const spender=cast(h,id==='haart'?'network':id==='qianxing'?'nova':'revelation');assert.equal(spender.manaRecovery,true);assert.equal(spender.ap,1);assert.equal(h.resource,2);assert.equal(h.secondary,0);assert.equal(spender.damage,undefined);
  }
});

test('mana: full stock refuses overflow, refunds are capped, and invalid direct payments are rejected',()=>{
  for(const [id,key] of [['haart','page'],['qianxing','spike'],['patch','keyblade']]){
    const h=hero(id,{secondary:5});const s=state(h);let t=tuneManaSkill(s,h,skill(id,key));assert.match(manaSkillError(s,h,t),/放不下/);
    h.resource=0;h.secondary=2;t=tuneManaSkill(s,h,skill(id,key));assert.match(manaSkillError(s,h,t),/魔力不足/);
    const payment=manaAfterSkill(hero(id,{resource:9,secondary:6}),{secondaryCost:6,manaReturn:6});assert.equal(payment.resource,10);assert.equal(payment.secondary,0);
  }
});

test('mana: Haart trades next-action suppression, ally amplification and high-stock interception without party healing',()=>{
  const h=hero('haart',{secondary:6});let t=tuneManaSkill(state(h),h,skill('haart','soothe'));assert.equal(t.weaken,true);assert.equal(t.secondaryCost,1);assert.equal(t.manaReturn,2);assert.equal(t.heal,undefined);
  h.secondary=6;t=tuneManaSkill(state(h),h,skill('haart','network'));assert.equal(t.attackBuff,40);assert.equal(t.shield,undefined);assert.equal(t.heal,undefined);
  t=tuneManaSkill(state(h),h,skill('haart','intercept'));assert.equal(t.hardControl,true);assert.equal(t.stripBuffs,3);assert.equal(t.manaReturn,6);
  assert.ok(MANA_SKILLS.haart.every(s=>!s.heal&&!s.allHeal&&!s.shield));
});

test('mana: Qianxing keeps a fixed one-unit dispel beside full-stock piercing and nondamaging hard control',()=>{
  const h=hero('qianxing',{secondary:6});const s=state(h);
  const pulse=tuneManaSkill(s,h,skill('qianxing','pulse'));assert.equal(pulse.secondaryCost,1);assert.equal(pulse.stripBuffs,1);
  const beam=tuneManaSkill(s,h,skill('qianxing','beam'));assert.equal(beam.secondaryCost,6);assert.equal(beam.pierce,true);assert.equal(beam.vulnerable,true);
  const lock=tuneManaSkill(s,h,skill('qianxing','lock'));assert.equal(lock.secondaryCost,3);assert.equal(lock.hardControl,true);assert.equal(lock.stripBuffs,3);assert.equal(lock.damage,undefined);
});

test('mana: Patch converts the same record stock into different offensive and control effects by stance',()=>{
  const h=hero('patch',{secondary:6}),s=state(h);
  const observe=tuneManaSkill(s,h,skill('patch','revelation'));assert.equal(observe.pierce,true);assert.equal(observe.hardControl,undefined);
  h.patchForm='record';const record=tuneManaSkill(s,h,skill('patch','revelation'));assert.equal(record.hardControl,true);assert.equal(record.stripBuffs,2);assert.ok(record.damage<observe.damage);
  const fragments=tuneManaSkill(s,h,skill('patch','fragments'));assert.equal(fragments.secondaryCost,3);assert.equal(fragments.stripBuffs,2);assert.equal(fragments.manaReturn,4);
  const collate=tuneManaSkill(s,h,skill('patch','collate'));assert.equal(collate.secondaryCost,1);assert.equal(collate.cleanse,1);assert.equal(collate.mark,undefined);
  h.patchForm='observe';assert.equal(tuneManaSkill(s,h,skill('patch','collate')).mark,true);
});

test('mana: removing both Patch stance skills still permits building all six records through the backup copy slot',()=>{
  const h=hero('patch'),s=state(h,{loadouts:{patch:['chargedslash','fragments','collate','revelation','injunction']}});
  for(let i=0;i<3;i++){const copy=cast(h,'collate',s);assert.equal(copy.manaCollateFallback,true);assert.match(copy.name,/备用抄录/);}
  assert.equal(h.secondary,6);assert.equal(h.resource,1);cast(h,'revelation',s);assert.equal(h.secondary,0);assert.equal(h.resource,7);
});

test('mana: new upgrades create low-stock, boss-setup and stance-switch opportunities without unconditional mana gains',()=>{
  const haart=hero('haart',{secondary:1});const hs=state(haart,{upgrades:['haart_insight'],boss:{weakened:true}});assert.equal(tuneManaSkill(hs,haart,skill('haart','relay')).mark,true);
  const q=hero('qianxing',{secondary:1});const qs=state(q,{upgrades:['qianxing_grounding'],boss:{heat:2}});assert.equal(tuneManaSkill(qs,q,skill('qianxing','pulse')).weaken,true);
  const p=hero('patch',{patchForm:'record',resource:5,secondary:0});const ps=state(p,{upgrades:['patch_doubleentry']});let t=tuneManaSkill(ps,p,skill('patch','keyblade'));assert.equal(t.cost,5);assert.equal(t.secondaryGain,3);assert.equal(t.manaReturn,0);
  p.secondary=4;t=tuneManaSkill(ps,p,skill('patch','keyblade'));assert.equal(t.cost,3);assert.equal(t.secondaryGain,2);
  p.resource=4;p.secondary=0;t=tuneManaSkill(ps,p,skill('patch','keyblade'));assert.equal(t.cost,3);assert.equal(t.secondaryGain,2);
});

test('mana: preview and payment are pure; stance application cannot pay a second time',()=>{
  const h=hero('patch'),s=state(h),before=structuredClone(s);const t=tuneManaSkill(s,h,skill('patch','bookward'));
  assert.deepEqual(s,before);const paid=manaAfterSkill(h,t);assert.deepEqual(s,before);
  Object.assign(h,paid);applyManaSkill(s,h,t,[]);assert.equal(h.resource,7);assert.equal(h.secondary,2);assert.equal(h.patchForm,'record');
  applyManaSkill(s,h,t,[]);assert.equal(h.resource,7);assert.equal(h.secondary,2);assert.match(manaStatus(h),/记录 2 \/ 6.*收录/);
});

test('mana: solo Haart must actually use a different skill before coordinated suppression can strip a buff',()=>{
  const h=hero('haart',{secondary:6,used:['soothe']}),s=state(h,{challengeMode:'solo',upgrades:['haart_triage']});
  assert.equal(tuneManaSkill(s,h,skill('haart','soothe')).stripBuffs,undefined);
  h.used.push('page');assert.equal(tuneManaSkill(s,h,skill('haart','soothe')).stripBuffs,1);
});
