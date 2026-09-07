import test from 'node:test';
import assert from 'node:assert/strict';
import {MANA_SKILLS,MANA_HERO_OVERRIDES,manaHeroDefaults,tuneManaSkill,manaSkillError,manaAfterSkill,applyManaSkill,manaRefundFor,MANA_REFUND_TABLES} from '../src/mana-cycles.js';
import {REWARDS} from '../src/rewards.js';

const hero=(id,resource=10,secondary=0,patchForm='observe')=>({id,resource,secondary,maxResource:10,used:[],shield:0,...manaHeroDefaults(id),secondary,patchForm});
const combinations=(a,k,start=0,v=[])=>v.length===k?[v]:a.slice(start).flatMap((x,i)=>combinations(a,k,start+i+1,[...v,x]));
const bases=id=>MANA_SKILLS[id];
const base=(id,key)=>bases(id).find(s=>s.id===key);
const idOf=h=>`${h.resource}/${h.secondary}/${h.patchForm}`;

test('mana v36: passive refunds are independent of hit count, skill-owned return fields and resource capacity overflow',()=>{
  for(const id of Object.keys(MANA_SKILLS))for(const form of ['observe','record']){
    const h=hero(id,0,MANA_HERO_OVERRIDES[id].maxSecondary,form);
    for(let n=1;n<=h.secondary;n++){
      const expected=id==='patch'?(form==='record'?3:2):MANA_REFUND_TABLES[id][n];
      assert.equal(manaRefundFor(h,n),expected);
      for(const hits of [1,3,10])for(const forged of [0,999])assert.equal(manaAfterSkill(h,{secondaryCost:n,hits,manaReturn:forged}).resource,expected);
      assert.ok(manaRefundFor(h,1)>=(expected/n));
      if(n>1)assert.ok(manaRefundFor(h,n-1)/(n-1)>expected/n,'unit efficiency must strictly decline');
    }
    assert.equal(manaRefundFor(h,0),0);
    assert.equal(manaAfterSkill({...h,resource:9},{secondaryCost:1,manaReturn:999}).resource,10);
    assert.equal(manaAfterSkill({...h,resource:0,secondary:1},{secondaryCost:99,manaReturn:999}).resource,manaRefundFor(h,1),'only actual stock can be reclaimed');
  }
});

test('mana v36: expensive builders cannot pretend to be free emergency while a cheaper equipped conversion is affordable',()=>{
  for(const [id,bulk,mana] of [['haart','rest',3],['qianxing','repair',3],['patch','collate',2]]){
    const h=hero(id,mana),state={heroes:[h],boss:{},upgrades:[]};
    const t=tuneManaSkill(state,h,base(id,bulk));assert.equal(t.manaEmergency,undefined);assert.match(manaSkillError(state,h,t),/魔力不足/);
    assert.match(manaSkillError(state,h,{id:bulk,cost:0,secondaryGain:1,manaEmergency:true}),/没有可支付/);
  }
  const h=hero('patch',3,0,'observe'),state={heroes:[h],boss:{},upgrades:['patch_doubleentry'],loadouts:{patch:['bookward','fragments','collate','revelation','injunction']}};
  assert.equal(tuneManaSkill(state,h,base('patch','bookward')).cost,3);
  assert.equal(tuneManaSkill(state,h,base('patch','collate')).manaEmergency,undefined,'stance discount is part of affordability');
});

test('mana v36: every legal five-slot resource state can eventually reach the maximum stock, including builderless and high-record builds',()=>{
  let checked=0;
  for(const id of Object.keys(MANA_SKILLS))for(const selected of combinations(bases(id),5))for(const upgraded of [false,true]){
    const max=MANA_HERO_OVERRIDES[id].maxSecondary,forms=id==='patch'?['observe','record']:['observe'];
    const nodes=new Map(),reverse=new Map(),targets=[];
    for(const form of forms)for(let mana=0;mana<=10;mana++)for(let stock=0;stock<=max;stock++){
      const h=hero(id,mana,stock,form),key=idOf(h);nodes.set(key,h);reverse.set(key,new Set());if(stock===max)targets.push(key);
    }
    for(const [key,h] of nodes){
      const state={heroes:[h],boss:{},upgrades:upgraded?Object.keys(REWARDS):[],loadouts:{[id]:selected.map(s=>s.id)}};
      for(const raw of selected){
        const t=tuneManaSkill(state,h,raw);if(manaSkillError(state,h,t))continue;
        const after={...h,...manaAfterSkill(h,t)};applyManaSkill(state,after,t,[]);
        assert.ok(reverse.has(idOf(after)),`${id} illegal edge ${key} -> ${idOf(after)}`);reverse.get(idOf(after)).add(key);
      }
    }
    const reachable=new Set(targets),queue=[...targets];
    for(let at=0;at<queue.length;at++)for(const prev of reverse.get(queue[at]))if(!reachable.has(prev)){reachable.add(prev);queue.push(prev);}
    const stuck=[...nodes.keys()].filter(key=>!reachable.has(key));
    assert.deepEqual(stuck,[],`${id}/${selected.map(s=>s.id)}/upgraded=${upgraded}: states trapped below full stock`);checked+=nodes.size;
  }
  assert.ok(checked>10000);
});

test('mana v36: small spenders remain small at full stock and bulk preparation never gains cash-out effects',()=>{
  for(const [id,small,big] of [['haart','soothe','rest'],['qianxing','pulse','repair'],['patch','chargedslash','collate']]){
    const h=hero(id,10,MANA_HERO_OVERRIDES[id].maxSecondary),state={heroes:[h],boss:{weakened:1},upgrades:Object.keys(REWARDS)};
    const low=tuneManaSkill(state,h,base(id,small));assert.equal(low.secondaryCost,1);assert.equal(low.ap,1);
    h.secondary=0;const prepared=tuneManaSkill(state,h,base(id,big));assert.equal(prepared.ap,2);assert.ok(prepared.cost>=8);assert.equal(prepared.manaReturn,0);
    for(const key of ['damage','heal','allHeal','shield','allShield','cleanse','allCleanse','mark','attackBuff','stripBuffs','hardControl'])assert.equal(prepared[key],undefined,`${id}/${key}`);
  }
});

test('mana v36: partial-stock reverse variants lose every original and growth combat effect',()=>{
  for(const [id,key] of [['haart','intercept'],['haart','network'],['qianxing','lock'],['qianxing','beam'],['patch','revelation'],['patch','injunction']]){
    const h=hero(id,0,1,'record'),state={heroes:[h],boss:{weakened:1},upgrades:Object.keys(REWARDS)};
    const t=tuneManaSkill(state,h,base(id,key));assert.equal(t.manaRecovery,true);assert.equal(t.ap,1);assert.equal(t.secondaryCost,1);
    for(const effect of ['damage','hits','stagger','heal','shield','weaken','vulnerable','mark','attackBuff','cleanse','stripBuffs','hardControl','cooldown'])assert.equal(t[effect],undefined,`${id}/${key}/${effect}`);
  }
});
