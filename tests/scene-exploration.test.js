import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SceneExploration,explorationBounds,walkablePoint,slideMovement,planWalkingPath} from '../src/scene-exploration.js';
import {enemyFormation,syncSceneEnemies,syncEnemyVisibility} from '../src/scene-enemies.js';
import {BattleScene} from '../src/scene.js';
import {dispatchImpacts} from '../src/scene-feedback.js';

const bounds={minX:-4,maxX:4,minZ:-3.5,maxZ:3.5};
test('walking stays on the platform and slides without entering devices',()=>{
  assert.deepEqual(explorationBounds({x:[-4,4],z:[-3,3]}),{minX:-4,maxX:4,minZ:-3,maxZ:3});
  const obstacles=[{x:0,z:0,width:1,depth:1}];let p=[-2,-2];
  for(let i=0;i<60;i++){p=slideMovement(p,[.1,.1],bounds,obstacles);assert(walkablePoint(p,bounds,obstacles));}
  assert(p[0]<=3.76&&p[1]<=3.26);
  for(let i=0;i<500;i++)p=slideMovement(p,[1,-1],bounds,obstacles);
  assert(p[0]<=3.76&&p[1]>=-3.26);
});

test('interlude instances preserve battle actors, camera, world and saved walking position',()=>{
  const previous=globalThis.document;
  globalThis.document={createElement(){return {getContext(){return {beginPath(){},roundRect(){},fill(){},fillText(){}};}};}};
  try{
    const stage={scene:new THREE.Scene(),environmentId:'storm',activePartyIds:['knibbs'],camera:new THREE.PerspectiveCamera(),controls:{target:new THREE.Vector3(0,3,-1),update(){}},actors:new Map(),switchEnvironment(id){this.environmentId=id;},removeEffect(o){o.removeFromParent();}};
    stage.camera.position.set(12,15,19);stage.camera.zoom=1.25;
    const original={root:new THREE.Group(),markerRoot:new THREE.Group(),shield:new THREE.Group()};stage.actors.set('boss',original);stage.scene.add(original.root,original.markerRoot);original.shield.visible=false;
    const makePerson=id=>{const root=new THREE.Group(),body=new THREE.Group();root.add(body);return {id,root,body,bones:{leftArm:new THREE.Group(),rightArm:new THREE.Group(),leftLeg:new THREE.Group(),rightLeg:new THREE.Group()}};};
    for(let attempt=0;attempt<3;attempt++){
      const config={id:'gate',layout:'gate',heroId:'knibbs',spawn:[0,2.5],position:[1,1.8],bounds,objects:[],exit:{position:[0,-3],open:true,radius:1}};
      const controller=new SceneExploration(stage,config,makePerson);
      assert.deepEqual(controller.position,[1,1.8]);assert.equal(original.root.visible,false);assert.equal(stage.environmentId,'ruins');
      assert(controller.moveTo([2,1]));const route=controller.path;controller.updateConfig({...config,done:['device']});assert.equal(controller.path,route,'dialogue/marker updates retain click navigation');
      controller.update(.05);assert.notDeepEqual(controller.position,[1,1.8]);controller.dispose();
      assert.equal(stage.environmentId,'storm');assert.equal(original.root.visible,true);assert.equal(original.shield.visible,false);
      assert.deepEqual(stage.camera.position.toArray(),[12,15,19]);assert.equal(stage.camera.zoom,1.25);assert.equal(stage.scene.children.length,2);
    }
  }finally{globalThis.document=previous;}
});

test('multi-target Scene.play sends projectiles and HP reactions to actual units',async()=>{
  const stage=Object.create(BattleScene.prototype);Object.assign(stage,{disposed:false,modelReview:null,reducedMotion:false,actions:[],effects:[],activePartyIds:['knibbs'],camera:new THREE.PerspectiveCamera(),effectRoot:new THREE.Group(),glowTexture:new THREE.Texture(),state:{selectedEnemyId:'enemy-1'}});
  const make=(id,x,z)=>({id,isEnemy:id!=='knibbs',modelId:id==='boss'?'golem':'scout',root:new THREE.Group(),body:new THREE.Group(),bones:{leftArm:new THREE.Group(),rightArm:new THREE.Group(),head:new THREE.Group()},basePosition:new THREE.Vector3(x,.48,z),baseRotation:0,visualScale:new THREE.Vector3(1,1,1),height:id==='boss'?4.8:2.2,hp:100});
  stage.actors=new Map([['knibbs',make('knibbs',0,3)],['boss',make('boss',0,-2)],['enemy-1',make('enemy-1',-3,-.5)],['enemy-2',make('enemy-2',3,-.5)]]);
  for(const a of stage.actors.values())a.root.position.copy(a.basePosition);
  for(const name of ['flashAt','runeCircle','burst','slash','shockwave','floatingText'])stage[name]=()=>{};
  const bolts=[];stage.bolt=(from,to)=>bolts.push(to.clone());
  const promise=stage.play({type:'attack',style:'shot',actor:'knibbs',targets:['enemy-1','enemy-2'],hits:2,kind:'physical',amount:20,hpLosses:{'enemy-1':20,'enemy-2':0},hitAmounts:{'enemy-1':[10,10],'enemy-2':[0,0]},absorbedAmounts:{'enemy-2':20},enemyModels:{'enemy-1':'scout','enemy-2':'conduit',boss:'golem'}});
  assert.equal(bolts.length,4);assert.equal(bolts.filter(p=>p.x<-2.5).length,2);assert.equal(bolts.filter(p=>p.x>2.5).length,2);
  const action=stage.actions[0];dispatchImpacts(action,action.duration);
  assert(stage.actors.get('enemy-1').reaction);assert.equal(stage.actors.get('enemy-2').reaction,undefined);assert.equal(stage.actors.get('boss').reaction,undefined);
  action.finish();await promise;for(const effect of stage.effects)stage.removeEffect(effect.object);stage.glowTexture.dispose();
});
test('click navigation goes around a machine and cannot cut a blocked corner',()=>{
  const obstacles=[{x:0,z:0,width:1.7,depth:3.8}],start=[-2.8,0],end=[2.8,0];
  const route=planWalkingPath(start,end,bounds,obstacles);assert(route.length>5);
  assert(route.some(p=>Math.abs(p[1])>2.14));
  for(const point of route)assert(walkablePoint(point,bounds,obstacles));
  let p=start;
  for(const target of route){for(let step=0;step<100;step++){
    const d=Math.hypot(target[0]-p[0],target[1]-p[1]);if(d<.04)break;
    p=slideMovement(p,[(target[0]-p[0])/d*Math.min(.1,d),(target[1]-p[1])/d*Math.min(.1,d)],bounds,obstacles);
    assert(walkablePoint(p,bounds,obstacles));
  }}
  assert(Math.hypot(p[0]-end[0],p[1]-end[1])<.10);
});
test('multiple enemies retain actual unit identities, corpses and selection',()=>{
  const make=modelId=>({modelId,root:new THREE.Group(),body:new THREE.Group(),height:2,markerRoot:new THREE.Group()}),boss=make('golem');
  boss.id='boss';boss.basePosition=new THREE.Vector3();
  const hero={basePosition:new THREE.Vector3(0,.48,3)},stage={actors:new Map([['boss',boss],['knibbs',hero]]),activePartyIds:['knibbs'],scene:new THREE.Scene(),createActorMarker(a){a.markerRoot=new THREE.Group();},removeEffect(o){o.removeFromParent();}};
  const targets=[{id:'boss',modelId:'golem',hp:500,defeated:false},{id:'enemy-1',modelId:'scout',hp:40,selected:true},{id:'enemy-2',modelId:'conduit',hp:50}];
  syncSceneEnemies(stage,targets,make);assert.equal(stage.actors.size,4);
  assert.equal(stage.actors.get('enemy-1').id,'enemy-1');assert(stage.actors.get('enemy-1').enemySelected);
  assert.deepEqual(stage.actors.get('enemy-2').basePosition.toArray(),enemyFormation(2,3));
  const actor=stage.actors.get('enemy-1');targets[1].defeated=true;targets[1].hp=0;
  syncSceneEnemies(stage,targets,make);assert.equal(stage.actors.get('enemy-1'),actor);assert(actor.defeated);assert(actor.root.visible);
  syncSceneEnemies(stage,[targets[0]],make);assert.equal(stage.actors.has('enemy-1'),false);assert.equal(actor.root.visible,false);
  targets[1].defeated=false;targets[1].hp=40;targets[1].pendingSpawn=true;
  syncSceneEnemies(stage,targets,make);assert.equal(actor.root.visible,false);assert.equal(actor.markerRoot.visible,false);
  targets[1].pendingSpawn=false;syncSceneEnemies(stage,targets,make);assert.equal(actor.root.visible,true);
});

test('combat extras cannot leak into title, gallery, studio or interlude; resume restores only active units',()=>{
  const actor=id=>({id,root:new THREE.Group(),markerRoot:new THREE.Group(),shield:new THREE.Group()});
  const boss=actor('boss'),oldBoss=actor('boss'),add=actor('enemy-1'),removed=actor('enemy-2');
  const stage={state:{mode:'playing'},actors:new Map([['boss',boss],['enemy-1',add]]),bossCache:new Map([['warden',boss],['conduit',oldBoss]]),minionCache:new Map([['enemy-1',add],['enemy-2',removed]])};
  syncEnemyVisibility(stage);assert(add.root.visible);assert.equal(removed.root.visible,false);assert.equal(oldBoss.root.visible,false);
  for(const mode of ['title','artPreview','modelReview','exploration']){
    stage.state.mode=mode==='title'?'title':'playing';if(mode!=='title')stage[mode]=true;
    syncEnemyVisibility(stage);assert.equal(add.root.visible,false,mode);assert.equal(add.markerRoot.visible,false,mode);
    if(mode!=='title')stage[mode]=false;
    stage.state.mode='playing';syncEnemyVisibility(stage);assert.equal(add.root.visible,true,`resume from ${mode}`);
  }
  add.pendingSpawn=true;syncEnemyVisibility(stage);assert.equal(add.root.visible,false);
});
