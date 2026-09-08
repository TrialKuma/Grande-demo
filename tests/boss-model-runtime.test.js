import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BattleScene} from '../src/scene.js';
import {dispatchImpacts} from '../src/scene-feedback.js';
import {BOSS_CAST_IDS,prepareBossCast,loadBossModels,applyBossModel,playBossAnimation,reactBossToImpact,updateBossAnimation,resetBossAnimation,disposeBossModels} from '../src/scene-boss-models.js';

function castFixture(){
 const scene=new THREE.Group(),animations=[];
 for(const id of BOSS_CAST_IDS){
  const root=new THREE.Group();root.name=`boss_${id}`;root.userData.grande_boss=id;
  const arm=new THREE.Group();arm.name=`${id}_arm`;root.add(arm);
  arm.add(new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial({color:'#748da8',emissive:'#223344',emissiveIntensity:.4})));
  scene.add(root);
  for(const [kind,peak] of [['idle',.08],['attack',1.2],['hit',-.65]])animations.push(new THREE.AnimationClip(`${id}_${kind}`,1,[new THREE.NumberKeyframeTrack(`${arm.name}.rotation[x]`,[0,.4,1],[0,peak,0])]));
 }
 return {scene,animations};
}
function actor(modelId='golem'){
 const root=new THREE.Group(),body=new THREE.Group();root.add(body);
 return {id:'boss',modelId,root,body,mats:[],bones:{head:new THREE.Group(),leftArm:new THREE.Group(),rightArm:new THREE.Group()},animated:[],armor:[],height:4,hp:100,basePosition:new THREE.Vector3(0,.48,-2),baseRotation:0,visualScale:new THREE.Vector3(1,1,1),markerRoot:new THREE.Group(),marker:{material:new THREE.MeshBasicMaterial()},shield:new THREE.Group(),accent:'#80bbce'};
}
function stageFixture(){
 const stage=Object.create(BattleScene.prototype),boss=actor();
 Object.assign(stage,{disposed:false,scene:new THREE.Scene(),state:{mode:'title'},modelReview:null,bossCache:new Map([['golem',boss]]),actors:new Map([['boss',boss]]),actions:[],effects:[],activePartyIds:['knibbs'],reducedMotion:false,effectRoot:new THREE.Group(),glowTexture:new THREE.Texture(),camera:new THREE.PerspectiveCamera(),shake:0});
 stage.scene.add(boss.root);stage.bossModelLibrary=prepareBossCast(castFixture());
 return stage;
}

const bossFile=await readFile(new URL('../public/models/grande-boss-cast.glb',import.meta.url));
const exportedCast=await new GLTFLoader().parseAsync(bossFile.buffer.slice(bossFile.byteOffset,bossFile.byteOffset+bossFile.byteLength),'');
const exportedLibrary=prepareBossCast(exportedCast);
const nodeTransforms=root=>{
 const result=[];root.traverse(node=>result.push(...node.position.toArray(),...node.quaternion.toArray(),...node.scale.toArray()));return result;
};

test('boss cast: every actual Blender GLB clip changes its cloned model through the production mixer',()=>{
 const sourceTransforms=nodeTransforms(exportedCast.scene);
 for(const id of BOSS_CAST_IDS){
  const boss=actor(id),stage={disposed:false,bossModelLibrary:exportedLibrary};assert.equal(applyBossModel(stage,boss).status,'ready');
  for(const kind of ['idle','attack','hit']){
   assert.equal(playBossAnimation(boss,kind),true);
   const before=nodeTransforms(boss.blenderVisual);updateBossAnimation(boss,boss.bossAnimation.actions.get(kind).getClip().duration*.36);
   assert.ok(nodeTransforms(boss.blenderVisual).some((value,index)=>Math.abs(value-before[index])>1e-5),`${id}/${kind} must visibly animate the exported nodes`);
  }
 }
 assert.deepEqual(nodeTransforms(exportedCast.scene),sourceTransforms,'Preview and battle never animate the shared source library');
});

test('boss cast: real crystal core exposure and broken posture preserve authored node animations',()=>{
 const boss=actor('golem');applyBossModel({disposed:false,bossModelLibrary:exportedLibrary},boss);
 const runtime=boss.bossAnimation;assert.equal(runtime.cores.length,1);assert.ok(runtime.coreMats.length>0);
 boss.coreOpen=true;boss.broken=true;updateBossAnimation(boss,.5);
 assert.ok(runtime.cores[0].envelope.scale.x>1.5);assert.ok(runtime.cores[0].light.intensity>0);assert.ok(runtime.coreMats.every(mat=>mat.userData.mechanismIntensity>0));
 assert.ok(runtime.envelope.position.y<-.15);assert.ok(runtime.envelope.rotation.x>.04);
 const core=boss.blenderVisual.getObjectByName('golem_core'),scale=core.scale.x;updateBossAnimation(boss,.15);assert.notEqual(core.scale.x,scale,'The original breathing scale track still runs inside the reveal layer');
 boss.coreOpen=false;boss.broken=false;updateBossAnimation(boss,.5);assert.equal(runtime.cores[0].envelope.scale.x,1);assert.ok(Math.abs(runtime.envelope.position.y)<1e-9);
 assert.deepEqual(boss.body.position.toArray(),[0,0,0],'Hidden fallback bones are not part of the new state animation');
});

test('boss cast: final barrier visibility follows real seals and the terminal state',()=>{
 const stage=stageFixture(),boss=actor('final');stage.actors.set('boss',boss);stage.bossCache.set('final',boss);stage.applyFormation=()=>{};
 stage.updateState({mode:'playing',boss:{id:'final',hp:100,seals:3}});assert.equal(boss.shield.visible,true);assert.equal(boss.sealCount,3);
 stage.updateState({boss:{id:'final',hp:100,seals:0}});assert.equal(boss.shield.visible,false);
 stage.updateState({boss:{id:'final',hp:0,seals:0,finale:true}});assert.equal(boss.shield.visible,true);assert.equal(boss.finaleOpen,true);
});

test('boss cast: gallery framing hides only active heroes, restores them, and faces the boss without changing its pose',()=>{
 const stage=stageFixture(),boss=stage.actors.get('boss'),hero=actor('hero');hero.id='knibbs';stage.actors.set('knibbs',hero);boss.baseRotation=.9;
 stage.container={clientWidth:1024,clientHeight:570};stage.renderer={setSize:()=>{}};stage.camera=new THREE.OrthographicCamera();stage.controls={target:new THREE.Vector3(),update:()=>{}};stage.environmentId='ruins';
 stage.resize();const battleSpan=stage.camera.top-stage.camera.bottom;stage.setArtPreview(true);assert.ok(stage.camera.top-stage.camera.bottom>battleSpan);
 stage.setBossPreviewFocus(true);assert.equal(hero.root.visible,false);assert.equal(hero.markerRoot.visible,false);assert.equal(hero.shield.visible,false);
 const direction=stage.camera.position.clone().sub(stage.controls.target);assert.ok(Math.abs(Math.atan2(direction.x,direction.z)-boss.baseRotation-.47)<1e-6);assert.equal(boss.baseRotation,.9);
 stage.setBossPreviewFocus(false);assert.equal(hero.root.visible,true);assert.equal(hero.markerRoot.visible,true);assert.equal(hero.shield.visible,true);
 stage.setArtPreview(false);assert.equal(stage.camera.top-stage.camera.bottom,battleSpan);assert.equal(stage.bossPreviewFocus,false);
});

test('boss cast: authored actions move cloned nodes, return to idle and keep material/mixer state private',()=>{
 const stage=stageFixture(),first=stage.actors.get('boss'),second=actor();
 const source=stage.bossModelLibrary.models.get('golem'),sourceMesh=source.getObjectByProperty('isMesh',true);
 const marker=first.markerRoot,body=first.body;
 assert.equal(applyBossModel(stage,first).status,'ready');applyBossModel(stage,second);
 assert.equal(first.body,body);assert.equal(first.body.visible,false);assert.equal(first.markerRoot,marker);
 assert.notEqual(first.mats[0],second.mats[0]);assert.notEqual(first.mats[0],sourceMesh.material);
 first.mats[0].emissive.set('#ffffff');assert.notEqual(first.mats[0].emissive.getHex(),second.mats[0].emissive.getHex());
 const node=first.blenderVisual.getObjectByName('golem_arm');updateBossAnimation(first,.2);assert.ok(node.rotation.x>0);
 assert.ok(Math.abs(second.blenderVisual.getObjectByName('golem_arm').rotation.x)<1e-9);
 assert.equal(playBossAnimation(first,'attack'),true);updateBossAnimation(first,.4);assert.ok(node.rotation.x>1);
 assert.equal(source.getObjectByName('golem_arm').rotation.x,0,'Source prototypes are immutable');
 updateBossAnimation(first,.7);assert.equal(first.bossAnimation.current,'idle');updateBossAnimation(first,.2);assert.ok(node.rotation.x>0&&node.rotation.x<.1);
 const children=first.root.children.length;applyBossModel(stage,first);assert.equal(first.root.children.length,children);
});

test('boss cast: a real HP-loss beat plays hit; shield, registration, healing and zero overkill do not restart it',()=>{
 const stage=stageFixture(),boss=stage.actors.get('boss');applyBossModel(stage,boss);playBossAnimation(boss,'attack');
 for(const hpLoss of [0,-2,undefined,NaN])assert.equal(reactBossToImpact(boss,{hpLoss}),false);
 assert.equal(boss.bossAnimation.current,'attack');assert.equal(reactBossToImpact(boss,{hpLoss:4}),true);updateBossAnimation(boss,.15);
 assert.ok(boss.blenderVisual.getObjectByName('golem_arm').rotation.x<0);
 const time=boss.bossAnimation.actions.get('hit').time;reactBossToImpact(boss,{hpLoss:0,absorbed:80});assert.equal(boss.bossAnimation.actions.get('hit').time,time);
});

test('boss cast: Scene.play dispatches only positive damage segments to the exported hit action',async()=>{
 const stage=stageFixture(),boss=stage.actors.get('boss'),hero=actor('hero');hero.id='knibbs';hero.basePosition.set(2,.48,3);hero.root.position.copy(hero.basePosition);stage.actors.set('knibbs',hero);
 for(const name of ['flashAt','runeCircle','bolt','burst','slash','shockwave','floatingText'])stage[name]=()=>{};
 applyBossModel(stage,boss);
 const event={type:'attack',actor:'knibbs',targets:['boss'],style:'shot',hits:2,hpLosses:{boss:10},hitAmounts:{boss:[10,0]}};
 const promise=stage.play(event),action=stage.actions[0];dispatchImpacts(action,action.impactAt);assert.equal(boss.bossAnimation.current,'hit');
 updateBossAnimation(boss,.15);const time=boss.bossAnimation.actions.get('hit').time;
 dispatchImpacts(action,action.duration);assert.equal(boss.bossAnimation.actions.get('hit').time,time);
 stage.clearReactionOverlay(boss);const rotation=boss.blenderVisual.rotation.toArray();stage.applyReaction(boss,.08);assert.deepEqual(boss.blenderVisual.rotation.toArray(),rotation,'Procedural head/arm poses never overwrite the Blender hierarchy');
 action.finish();await promise;stage.clearCombatEffects();assert.equal(boss.bossAnimation.current,'idle');
});

test('boss cast: cached switches reset one-shot animation and retain independent hidden actors',()=>{
 const stage=stageFixture(),golem=stage.actors.get('boss'),duelist=actor('duelist');stage.bossCache.set('duelist',duelist);stage.scene.add(duelist.root);
 stage.switchEnvironment=id=>{stage.environmentId=id;};stage.setAtmosphere=()=>{};stage.arenaPulse={material:new THREE.MeshBasicMaterial()};stage.arenaCrystalMats=[];
 applyBossModel(stage,golem);applyBossModel(stage,duelist);playBossAnimation(golem,'attack');updateBossAnimation(golem,.3);
 stage.switchBoss('duelist');assert.equal(golem.root.visible,false);assert.equal(duelist.root.visible,true);assert.equal(duelist.bossAnimation.current,'idle');
 playBossAnimation(duelist,'hit');updateBossAnimation(duelist,.2);stage.switchBoss('golem');assert.equal(golem.bossAnimation.current,'idle');
 const time=duelist.bossAnimation.mixer.time;updateBossAnimation(duelist,.2);assert.equal(duelist.bossAnimation.mixer.time,time);
 resetBossAnimation(golem);updateBossAnimation(golem,0);assert.equal(golem.bossAnimation.actions.get('idle').time,0);
});

test('boss cast: preview is read-only, rejects active battles and does not interfere with character review',()=>{
 const stage=stageFixture(),boss=stage.actors.get('boss');applyBossModel(stage,boss);
 assert.equal(stage.previewBossAnimation('attack'),true);assert.equal(boss.hp,100);assert.equal(stage.actions.length,0);
 const status=stage.getAssetStatus();status.currentBoss.animations.length=0;assert.equal(stage.getAssetStatus().currentBoss.animations.length,3);
 assert.equal(stage.previewBossAnimation('missing'),false);stage.state.mode='playing';assert.equal(stage.previewBossAnimation('hit'),false);
 stage.state.mode='title';stage.modelReview={};assert.equal(stage.previewBossAnimation('hit'),false);
});

test('boss cast: pending loading installs every cached boss and late scene disposal never resurrects models',async()=>{
 const stage=stageFixture();delete stage.bossModelLibrary;
 let complete;const loader={load:(url,onLoad)=>{complete=onLoad;}};
 const promise=loadBossModels(stage,{loader});assert.equal(applyBossModel(stage,stage.actors.get('boss')).status,'pending');
 const late=actor('tide');stage.bossCache.set('tide',late);stage.scene.add(late.root);complete(castFixture());
 assert.deepEqual(await promise,{status:'ready',bosses:10,clips:30});assert(late.bossAnimation);
 assert.equal(loadBossModels(stage,{loader}),promise);disposeBossModels(stage);assert.equal(late.bossAnimation,null);assert.equal(stage.bossModelStatus.status,'disposed');
 const disposed=stageFixture();delete disposed.bossModelLibrary;let callback,removed=0;disposed.removeEffect=()=>removed++;
 const pending=loadBossModels(disposed,{loader:{load:(url,onLoad)=>{callback=onLoad;}}});disposed.disposed=true;callback(castFixture());
 assert.deepEqual(await pending,{status:'disposed'});assert.equal(removed,1);assert.equal(disposed.bossModelLibrary,undefined);assert.equal(disposed.actors.get('boss').body.visible,true);
});

test('boss cast: missing clips and cross-boss animation tracks fail validation before fallback bodies are hidden',()=>{
 const incomplete=castFixture();incomplete.animations.pop();assert.throws(()=>prepareBossCast(incomplete),/Missing authored animation/);
 const wrong=castFixture();wrong.animations[0].tracks[0].name='duelist_arm.rotation[x]';assert.throws(()=>prepareBossCast(wrong),/escapes its boss subtree/);
 const stage=stageFixture();delete stage.bossModelLibrary;assert.equal(applyBossModel(stage,stage.actors.get('boss')).status,'pending');assert.equal(stage.actors.get('boss').body.visible,true);
});
