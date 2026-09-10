import test from 'node:test';
import assert from 'node:assert/strict';
import {ammoProfile,knibbsPassiveDefaults,intuitionFromLoading,loadAmmoPlan,shotPassivePlan,counterPassivePlan,reloadAmmoPlan,endKnibbsFollowup} from '../src/knibbs-passive.js';

const hero=fields=>({resource:10,maxResource:10,intuition:0,...knibbsPassiveDefaults(),...fields});
const apply=(h,plan)=>{assert.equal(plan.ok,true,plan.error);Object.assign(h,plan.changes);return plan;};

test('Knibbs source: battle begins with ordinary ammunition, and plain shooting gives no breath or intuition',()=>{
 const h=hero({resource:2}),before=structuredClone(h),plan=shotPassivePlan(h);
 assert.deepEqual(h,before);assert.equal(plan.ammoEffect.id,'normal');assert.equal(plan.gain,0);assert.equal(plan.intuitionGain,0);
 apply(h,plan);assert.equal(h.resource,2);assert.equal(h.intuition,0);assert.equal(h.followupReady,false);
});

test('Knibbs source: actual loading cost grants one intuition per two breath, with one replaceable special round',()=>{
 assert.equal(intuitionFromLoading(6),3);assert.equal(intuitionFromLoading(4),2);assert.equal(intuitionFromLoading(0),0);
 const h=hero();apply(h,loadAmmoPlan(h,'breach'));assert.equal(h.resource,6);assert.equal(h.intuition,2);assert.equal(h.ammo,'breach');
 const p=apply(h,loadAmmoPlan(h,'blast'));assert.equal(p.intuitionGain,3);assert.equal(h.resource,0);assert.equal(h.intuition,3);assert.equal(h.ammo,'blast');
 assert.equal(ammoProfile(h.ammo).extraHits,1);assert.equal(ammoProfile('scatter').extraHits,5);
});

test('Knibbs source: loading pays the full cost before any follow-up refund and refused plans preserve state',()=>{
 const h=hero({resource:5,followupReady:true}),before=structuredClone(h);
 assert.equal(loadAmmoPlan(h,'scatter',{quick:true}).ok,false,'the pending +1 refund cannot fund a six-breath load');
 assert.equal(loadAmmoPlan(h,'normal').ok,false);assert.equal(loadAmmoPlan(h,'unknown').ok,false);assert.deepEqual(h,before);
 assert.equal(loadAmmoPlan(hero(),'blast',{quick:true}).ok,false,'plain attacks never create a quick-load window');
});

test('Knibbs source: an actual confirmation chain allows quick load, quick shot and reload, each refunding once',()=>{
 const h=hero({resource:8}); // The caller already paid the original confirmation's two breath.
 apply(h,shotPassivePlan(h,{confirm:true}));assert.equal(h.resource,8);
 const load=apply(h,loadAmmoPlan(h,'scatter',{quick:true}));assert.equal(load.ap,0);assert.equal(load.gain,1);assert.equal(h.resource,3);assert.equal(h.intuition,3);
 assert.equal(loadAmmoPlan({...h,resource:10},'blast',{quick:true}).ok,false,'a confirmation cannot repeat zero-AP loading');
 const shot=apply(h,shotPassivePlan(h,{quick:true}));assert.equal(shot.gain,1);assert.equal(shot.intuitionSpent,3);assert.equal(shot.mark,true);assert.equal(h.resource,4);
 assert.equal(shot.ammoEffect.extraHits,5);assert.equal(h.ammo,'normal');assert.equal(h.intuition,0);
 const reload=apply(h,reloadAmmoPlan(h));assert.equal(reload.ap,1);assert.equal(reload.gain,1);assert.equal(h.resource,5);
 assert.equal(shotPassivePlan(h,{quick:true}).ok,false);assert.equal(reloadAmmoPlan(h).ok,false);
 Object.assign(h,endKnibbsFollowup());assert.equal(h.followupReady,false);assert.deepEqual(h.followupUsed,[]);
});

test('Knibbs source: a two-layer damage cash-out and a three-layer counter are distinct, counter preserves loaded ammunition',()=>{
 const h=hero();apply(h,loadAmmoPlan(h,'breach'));
 assert.equal(counterPassivePlan(h).ok,false);
 const shot=shotPassivePlan(h);assert.equal(shot.intuitionSpent,2);assert.equal(shot.mark,true);assert.equal(shot.ammoEffect.stripBuffs,1);assert.equal(shot.ammoEffect.refundOnDispel,4);
 assert.equal(shot.gain,0,'breach refund is conditional on an actual dispel and is not awarded by firing');
 const counterHero=hero();apply(counterHero,loadAmmoPlan(counterHero,'blast'));const before=counterHero.resource;
 const counter=apply(counterHero,counterPassivePlan(counterHero));assert.equal(counter.intuitionSpent,3);assert.equal(counterHero.ammo,'blast');assert.equal(counterHero.resource,before);
 assert.equal(shotPassivePlan(counterHero).intuitionSpent,0);assert.equal(shotPassivePlan(counterHero).ammoEffect.id,'blast');
});

test('Knibbs source: capped breath still reports nominal additional-action refund, and ordinary ammo cannot unlock reload',()=>{
 const h=hero({followupReady:true}),p=shotPassivePlan(h,{quick:true});assert.equal(p.gain,1);assert.equal(p.changes.resource,10);
 assert.equal(reloadAmmoPlan(h).ok,false);assert.equal(shotPassivePlan(h,{quick:true,confirm:true}).ok,false);
});

test('Knibbs demo adaptation: breach can use the confirmation window without granting extra intuition for its refund',()=>{
 const h=hero({resource:4,followupReady:true}),p=apply(h,loadAmmoPlan(h,'breach',{quick:true}));
 assert.equal(p.ap,0);assert.equal(p.cost,4);assert.equal(p.gain,1);assert.equal(p.intuitionGain,2);
 assert.equal(h.resource,1);assert.equal(h.intuition,2);assert.deepEqual(h.followupUsed,['load']);
});
