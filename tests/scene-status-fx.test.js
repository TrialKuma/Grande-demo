import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BattleScene} from '../src/scene.js';
import {SceneStatusFX,heroStatusFxProfile,bossIdleFacing} from '../src/scene-status-fx.js';
import {VfxTimeline} from '../src/vfx-timeline.js';

test('persistent state profiles follow the real field, chaos, preparation and form flags',()=>{
 const profile=(id,fields)=>heroStatusFxProfile({id,hp:100,...fields}).map(item=>item.id);
 assert.deepEqual(profile('ric',{resource:1}),['ric-positive']);assert.deepEqual(profile('ric',{resource:-1}),['ric-negative']);
 assert.deepEqual(profile('ric',{resource:0}),[]);assert.deepEqual(profile('ric',{resource:4,ricChaos:1}),['ric-positive','ric-chaos']);
 assert.equal(heroStatusFxProfile({id:'ric',hp:0,resource:4,ricChaos:1}).length,0);
 assert.deepEqual(profile('knibbs',{intuition:3}),['loaded']);assert.deepEqual(profile('knibbs',{intuition:2}),[]);
 assert.deepEqual(profile('youmu',{surgicalReady:true}),['surgery']);assert.deepEqual(profile('youmu',{surgicalReady:true,youmuForm:'captain'}),['captain']);
 for(const id of ['haart','qianxing','patch']){assert.deepEqual(profile(id,{secondary:8,maxSecondary:8}),['mana-full']);assert.deepEqual(profile(id,{secondary:7,maxSecondary:8}),[]);}
 assert.deepEqual(profile('apeilia',{resource:6}),['combo-ready']);
});

function fakeStage(){const stage=Object.assign(Object.create(BattleScene.prototype),{scene:new THREE.Scene(),camera:new THREE.PerspectiveCamera(),actors:new Map(),reducedMotion:false,glowTexture:new THREE.Texture()});for(const id of ['ric','knibbs','youmu','haart','qianxing','patch','apeilia']){const root=new THREE.Group(),weapon=new THREE.Group();root.add(weapon);stage.scene.add(root);stage.actors.set(id,{root,bones:{weapon}});}return stage;}
test('state meshes reuse geometry during updates and toggles, hide immediately and dispose once',()=>{
 const stage=fakeStage(),fx=new SceneStatusFX(stage),hero={id:'ric',hp:100,resource:4,ricChaos:1};
 fx.sync({heroes:[hero]});const nodes=[...fx.entries.values()].map(entry=>entry.object),assets=new Map();
 for(const object of nodes)object.traverse(node=>{for(const asset of [node.geometry,node.material].filter(Boolean))if(!assets.has(asset)){assets.set(asset,0);asset.addEventListener('dispose',()=>assets.set(asset,assets.get(asset)+1));}});
 for(let i=0;i<240;i++){fx.sync({heroes:[hero]});fx.update(i/60);}
 assert.equal(fx.entries.size,2);assert.deepEqual([...fx.entries.values()].map(entry=>entry.object),nodes);
 hero.resource=0;hero.ricChaos=0;fx.sync({heroes:[hero]});fx.update(4);assert.ok(nodes.every(node=>!node.visible));
 hero.resource=4;fx.sync({heroes:[hero]});fx.update(4);assert.equal(nodes[0].visible,true);
 stage.modelReview={};fx.update(4);assert.equal(fx.root.visible,false);stage.modelReview=null;fx.update(4);assert.equal(fx.root.visible,true);
 hero.hp=0;fx.sync({heroes:[hero]});fx.update(4);assert.ok(nodes.every(node=>!node.visible));
 fx.dispose();fx.dispose();assert.ok([...assets.values()].every(count=>count===1));assert.equal(stage.scene.getObjectByName('persistent-character-status'),undefined);
});

test('all status geometries remain finite, bounded and frozen by reduced-motion time',()=>{
 const stage=fakeStage(),fx=new SceneStatusFX(stage),heroes=[{id:'ric',resource:-4,ricChaos:1},{id:'knibbs',intuition:3},{id:'youmu',surgicalReady:true},...['haart','qianxing','patch'].map(id=>({id,secondary:8,maxSecondary:8})),{id:'apeilia',resource:6}].map(hero=>({...hero,hp:100}));
 fx.sync({heroes});let meshes=0;fx.root.traverse(node=>{if(node.isMesh)meshes++;for(const attribute of Object.values(node.geometry?.attributes||{}))assert.ok([...attribute.array].every(Number.isFinite));});assert.ok(meshes<=32);
 stage.reducedMotion=true;fx.update(10);const chaos=fx.entries.get('ric:ric-chaos').object,field=fx.entries.get('ric:ric-negative').object;
 assert.equal(chaos.rotation.y,0);assert.equal(field.userData.field.material.uniforms.uTime.value,0);fx.dispose();
});

test('negative field covers the stage and links every living enemy, then cancels without residue',()=>{
 const stage=fakeStage(),fx=new SceneStatusFX(stage),ric={id:'ric',hp:100,resource:-4},enemies=[{id:'golem',unitId:'boss',hp:500},{id:'drone',unitId:'enemy-1',hp:50}];
 for(const [i,enemy]of enemies.entries()){const root=new THREE.Group();root.position.set(i*2,.48,-2);stage.scene.add(root);stage.actors.set(enemy.unitId,{root,basePosition:root.position.clone()});}
 stage.actors.get('ric').root.position.set(3,.48,3);fx.sync({heroes:[ric],enemies});fx.update(1);
 assert.deepEqual(fx.entries.get('ric:ric-negative').object.position.toArray(),[0,.48,0]);
 for(const enemy of enemies)assert.equal(fx.entries.get(`${enemy.unitId}:ric-negative-target`).object.visible,true);
 enemies[1].hp=0;fx.sync({heroes:[ric],enemies});fx.update(2);assert.equal(fx.entries.get('enemy-1:ric-negative-target').object.visible,false);
 ric.resource=0;fx.sync({heroes:[ric],enemies});fx.update(2);assert.ok([...fx.entries.values()].every(entry=>!entry.object.visible));fx.dispose();
});

test('boss idle facing depends on stage position and never on selected party or threat target',()=>{
 assert.equal(bossIdleFacing(new THREE.Vector3(0,.48,-2)),0);
 assert.equal(bossIdleFacing(new THREE.Vector3(2,.48,-1)),Math.atan2(-2,6));
});

test('live updateState ignores target changes when setting boss idle rotation',()=>{
 const stage=fakeStage(),boss={id:'boss',isEnemy:true,modelId:'golem',root:new THREE.Group(),markerRoot:new THREE.Group(),basePosition:new THREE.Vector3(0,.48,-2),shield:{visible:false}};
 stage.actors.set('boss',boss);stage.activePartyIds=['knibbs','ric','youmu'];stage.state={mode:'playing'};stage.switchBoss=()=>boss;stage.applyFormation=()=>{};stage.syncArtPreviewVisibility=()=>{};
 stage.updateState({boss:{id:'golem',hp:100,intentTarget:'ric'}});const first=boss.baseRotation;
 stage.updateState({boss:{id:'golem',hp:100,intentTarget:'knibbs'}});assert.equal(boss.baseRotation,first);assert.equal(boss.root.rotation.y,0);
});

test('presentation timeline repeats the same event times and clears the previous play on seek',()=>{
 let age=0,objects=[],fired=[],resets=0;const timeline=new VfxTimeline({reset(){age=0;objects=[];fired=[];resets++;},advance(dt){age+=dt;},fire(event){objects.push(event.id);fired.push([event.id,Number(age.toFixed(6))]);}});
 timeline.load([{at:.15,event:{id:'shot'}},{at:.55,event:{id:'contact'}}],1.2);
 timeline.seek(.7);const first=structuredClone(fired);assert.deepEqual(objects,['shot','contact']);
 for(let i=0;i<20;i++){timeline.seek(.7);assert.deepEqual(fired,first);assert.equal(objects.length,2);}
 timeline.seek(.2);assert.deepEqual(objects,['shot']);assert.ok(resets>=22);
});

test('effect seeds replay exactly and rendering layers preserve rather than destroy hidden effects',()=>{
 const stage=Object.assign(Object.create(BattleScene.prototype),{effects:[],effectRoot:new THREE.Group(),fxLayers:{}});
 stage.resetEffectSeed(5);const sequence=Array.from({length:6},()=>stage.effectRandom());stage.resetEffectSeed(5);assert.deepEqual(Array.from({length:6},()=>stage.effectRandom()),sequence);
 stage.setFxLayer('trajectory',false);const object=new THREE.Group();object.userData.fxLayer='trajectory';stage.addEffect(object,1,()=>{});assert.equal(object.visible,false);assert.equal(stage.effects.length,1);stage.setFxLayer('trajectory',true);assert.equal(stage.fxLayerEnabled('trajectory'),true);stage.removeEffect(object);
});
