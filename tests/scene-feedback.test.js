import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {impactTiming} from '../src/battle-feedback.js';
import {impactSchedule,reactionPose,dispatchImpacts,actorStanding,atmosphereProfile} from '../src/scene-feedback.js';
import {SceneAtmosphere} from '../src/scene-atmosphere.js';
import {BattleScene} from '../src/scene.js';

const attack=(changes={})=>({type:'attack',actor:'knibbs',targets:['boss'],bossId:'golem',style:'shot',hits:3,hpLosses:{boss:19},hitAmounts:{boss:[10,9,0]},...changes});

test('visual lifecycle: a zero-HP boss stands through delayed core and terminal reveals, then falls on visual victory',()=>{
  for(const modelId of ['golem','final','duelist']){
    const boss={id:'boss',modelId,hp:0,coreOpen:false,finaleOpen:false};
    assert.equal(actorStanding(boss,'playing'),true,'The lethal hit precedes its transition event');
    if(modelId==='golem')boss.coreOpen=true;if(modelId==='final')boss.finaleOpen=true;
    assert.equal(actorStanding(boss,'playing'),true,'Opening a second stage cannot cause a preceding collapse');
    assert.equal(actorStanding(boss,'victory'),false,'Only the visual victory event releases the standing pose');
    assert.equal(actorStanding({...boss,hp:90},'defeat'),true,'Party defeat leaves the opponent standing');
  }
});

test('visual lifecycle: heroes fall exactly at zero HP, independently of the boss transition or battle mode',()=>{
  for(const mode of ['playing','victory','defeat']){
    assert.equal(actorStanding({id:'knibbs',hp:0,coreOpen:true},mode),false);
    assert.equal(actorStanding({id:'knibbs',hp:1},mode),true);
  }
});

test('visual feedback: every hit uses the shared clock and exact HP segments, including an overkill zero',()=>{
  const event=attack(),before=structuredClone(event),beats=impactSchedule(event),clock=impactTiming(event);
  assert.deepEqual(beats.map(b=>b.hpLoss),[10,9,0]);assert.deepEqual(beats.map(b=>b.reaction),[true,true,false]);
  assert.deepEqual(beats.map(b=>b.at),[clock.impactAt,clock.impactAt+clock.interval,clock.impactAt+2*clock.interval]);
  assert.ok(beats.every(b=>b.theme==='ballistic'&&b.material==='stone'));assert.deepEqual(event,before);
});

test('visual feedback: healing, shields, preparation, evasion and a break never cause injury poses',()=>{
  for(const event of [attack({type:'heal'}),attack({type:'shield'}),attack({type:'resource'}),attack({type:'response',style:'evade'}),attack({type:'break'})])assert.deepEqual(impactSchedule(event),[]);
  const core=impactSchedule(attack({hpLosses:{boss:0},hitAmounts:{boss:[0,0,0]},amounts:{boss:90}}));
  assert.ok(core.every(beat=>!beat.reaction&&beat.kind==='contact'));
});

test('visual feedback: a shield-only recipient gets ripples while the damaged recipient independently reacts',()=>{
  const beats=impactSchedule(attack({type:'boss',actor:'boss',targets:['knibbs','ric'],hits:2,bossId:'tide',hpLosses:{knibbs:0,ric:13},hitAmounts:{knibbs:[0,0],ric:[0,13]},absorbedAmounts:{knibbs:30,ric:8}}));
  const guarded=beats.filter(b=>b.id==='knibbs'),hurt=beats.filter(b=>b.id==='ric');
  assert.ok(guarded.every(b=>b.kind==='shield'&&!b.reaction));assert.equal(guarded.reduce((n,b)=>n+b.absorbed,0),30);
  assert.deepEqual(hurt.map(b=>b.reaction),[false,true]);assert.equal(hurt.reduce((n,b)=>n+b.hpLoss,0),13);
});

test('visual feedback: long or skipped frames dispatch each due beat once and never trigger future beats',()=>{
  const calls=[],timing=impactTiming(attack({hits:6,style:'slash'}));
  const action={...timing,hitCount:timing.hits,nextHit:0,impact:index=>calls.push(index)};
  dispatchImpacts(action,timing.impactAt-.001);assert.deepEqual(calls,[]);
  dispatchImpacts(action,timing.impactAt);assert.deepEqual(calls,[0]);
  dispatchImpacts(action,timing.impactAt);assert.deepEqual(calls,[0]);
  dispatchImpacts(action,timing.duration);assert.deepEqual(calls,[0,1,2,3,4,5]);
  dispatchImpacts(action,99);assert.equal(calls.length,6);
});

test('visual feedback: body, head and arms respond directionally, then return to zero without drift',()=>{
  const frontal=reactionPose(.08,{direction:[0,-1]}),side=reactionPose(.08,{direction:[1,0]});
  assert.ok(frontal.pitch<-.1&&frontal.crouch<0&&frontal.headPitch>0&&frontal.leftArm<0&&frontal.rightArm<0);
  assert.ok(side.roll<-.1);assert.equal(side.pitch,0);
  const boss=reactionPose(.08,{boss:true,direction:[1,0]}),reduced=reactionPose(.08,{direction:[1,0],reducedMotion:true});
  assert.ok(boss.step>0&&boss.step<side.step);assert.ok(Math.abs(reduced.roll)<Math.abs(side.roll)*.4);
  for(const age of [.5,1,5]){const pose=reactionPose(age);assert.equal(pose.done,true);for(const key of ['pulse','step','crouch','pitch','roll','headPitch','leftArm','rightArm'])assert.ok(Math.abs(pose[key])<1e-10);}
});

function fakeStage(){
  const stage=Object.create(BattleScene.prototype);Object.assign(stage,{disposed:false,modelReview:null,reducedMotion:false,actions:[],effects:[],activePartyIds:['knibbs'],camera:new THREE.PerspectiveCamera(),shake:0,effectRoot:new THREE.Group(),glowTexture:new THREE.Texture()});
  const actor=id=>({id,modelId:id==='boss'?'golem':undefined,root:new THREE.Group(),body:new THREE.Group(),bones:{leftArm:new THREE.Group(),rightArm:new THREE.Group(),head:new THREE.Group()},basePosition:new THREE.Vector3(id==='boss'?0:2,.48,id==='boss'?-2:3),baseRotation:0,visualScale:new THREE.Vector3(1,1,1),height:id==='boss'?4.8:2.4,action:false,hp:100});
  stage.actors=new Map([['knibbs',actor('knibbs')],['boss',actor('boss')]]);for(const actor of stage.actors.values())actor.root.position.copy(actor.basePosition);
  for(const name of ['flashAt','runeCircle','bolt','burst','slash','shockwave','floatingText'])stage[name]=()=>{};
  return stage;
}

test('visual feedback: actual Scene.play invokes presentation callbacks per beat and only positive HP beats reset a reaction',async()=>{
  const stage=fakeStage(),calls=[],promise=stage.play(attack(),{onImpact:index=>calls.push(index)}),action=stage.actions[0],boss=stage.actors.get('boss');
  dispatchImpacts(action,action.impactAt);assert.deepEqual(calls,[0]);assert.ok(boss.reaction);const first=boss.reaction;
  dispatchImpacts(action,action.impactAt+action.interval);assert.deepEqual(calls,[0,1]);assert.notEqual(boss.reaction,first);const second=boss.reaction;
  dispatchImpacts(action,action.duration);assert.deepEqual(calls,[0,1,2]);assert.equal(boss.reaction,second,'The zero overkill segment does not restart the hurt pose');
  stage.clearReactionOverlay(boss);const base=boss.body.rotation.clone();stage.applyReaction(boss,.08);assert.notEqual(boss.body.rotation.x,base.x);
  stage.clearReactionOverlay(boss);assert.equal(boss.body.rotation.x,base.x);assert.deepEqual(boss.root.position,boss.basePosition);
  action.finish();await promise;for(const effect of stage.effects)stage.removeEffect(effect.object);
});

test('visual feedback: a shield-only Scene.play beat never produces a body reaction or white body flash',async()=>{
  const stage=fakeStage(),event=attack({hpLosses:{boss:0},hitAmounts:{boss:[0,0,0]},absorbedAmounts:{boss:40}});
  const promise=stage.play(event),action=stage.actions[0];dispatchImpacts(action,action.duration);
  assert.equal(stage.actors.get('boss').reaction,undefined);assert.equal(stage.actors.get('boss').flash,undefined);assert.ok(stage.effects.length>0);
  action.finish();await promise;for(const effect of stage.effects)stage.removeEffect(effect.object);
});

test('visual feedback: healing, shield grants and phase effects still notify the first presentation impact',async()=>{
  for(const type of ['heal','shield','phase']){
    const stage=fakeStage(),calls=[],event=attack({type,hits:1,style:type==='shield'?'guard':'rune',targets:['knibbs'],amount:20});
    const promise=stage.play(event,{onImpact:index=>calls.push(index)}),action=stage.actions[0];
    dispatchImpacts(action,action.impactAt-.001);assert.equal(calls.length,0);
    dispatchImpacts(action,action.impactAt);assert.deepEqual(calls,[0]);assert.equal(stage.actors.get('knibbs').reaction,undefined);
    action.finish();await promise;for(const effect of stage.effects)stage.removeEffect(effect.object);stage.glowTexture.dispose();
  }
});

test('environment: all ten bosses use bounded theme buffers which recycle without allocating new geometry',()=>{
  const parent=new THREE.Group(),texture=new THREE.Texture(),kinds=new Set();
  for(const id of ['golem','duelist','cantor','warden','tide','furnace','weaver','orrery','arbiter','final']){
    const layer=new SceneAtmosphere(parent,texture,id),positions=layer.positions,geometry=layer.geometry;kinds.add(layer.profile.kind);
    assert.ok(layer.profile.count<=170);assert.ok(layer.root.children.length<=21);
    assert.equal(layer.material.sizeAttenuation,false,'Orthographic dots keep a readable pixel size');
    assert.ok(layer.material.size>=3&&layer.material.size<=5,`${id} ambient dots must not regress to subpixel sizes`);
    assert.equal(layer.material.size,layer.profile.pointSize,'The renderer, rather than particle code, applies DPR');
    for(let frame=0;frame<200;frame++)layer.update(.05);
    assert.equal(layer.positions,positions);assert.equal(layer.geometry,geometry);assert.ok([...positions].every(Number.isFinite));
    let disposals=0;geometry.addEventListener('dispose',()=>disposals++);layer.dispose();layer.dispose();assert.equal(disposals,1);assert.equal(parent.children.length,0);
  }
  assert.deepEqual([...kinds].sort(),['crystal','ember','paper','spark','spore','star','water']);
});

test('environment: reduced-motion preferences freeze ambient travel and retain restrained particles',()=>{
  for(const id of ['tide','furnace','weaver','final']){
    const profile=atmosphereProfile(id,true);assert.equal(profile.speed,0);assert.equal(profile.count,32);
    const layer=new SceneAtmosphere(new THREE.Group(),new THREE.Texture(),id,true),before=[...layer.positions],pagePositions=layer.pages.map(p=>p.object.position.clone());
    layer.update(30);assert.deepEqual([...layer.positions],before);assert.deepEqual(layer.pages.map(p=>p.object.position),pagePositions);layer.dispose();
  }
});
