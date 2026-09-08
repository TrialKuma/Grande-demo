import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WORLD_IDS,loadSceneWorlds,applySceneWorld} from '../src/scene-worlds.js';

function fixture(){
  const stage={scene:new THREE.Scene(),environmentCache:new Map(),removed:[],removeEffect(o){this.removed.push(o);}},scene=new THREE.Group();
  for(const id of WORLD_IDS){
    const root=new THREE.Group(),old=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
    root.add(old);stage.environmentCache.set(id,{root});stage.scene.add(root);
    const source=new THREE.Group();source.userData={grande_world:true,world_id:id};
    source.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));scene.add(source);
  }
  return {stage,scene};
}

test('world replacement handles cached worlds, later legacy props and private materials',async()=>{
  const {stage,scene}=fixture(),load=GLTFLoader.prototype.load;
  const waterMaterial=new THREE.MeshStandardMaterial({name:'water',color:'#2a9ea1',roughness:.18}),water=new THREE.Mesh(new THREE.BoxGeometry(),waterMaterial);
  water.name='WORLD_floodworks / water';scene.children.find(root=>root.userData.world_id==='floodworks').add(water);
  const foam=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name:'foam',color:'#a4dddf'}));
  foam.name='WORLD_floodworks / foam';scene.children.find(root=>root.userData.world_id==='floodworks').add(foam);
  GLTFLoader.prototype.load=function(url,onLoad){queueMicrotask(()=>onLoad({scene}));};
  try{
    const pending=loadSceneWorlds(stage);assert.equal(loadSceneWorlds(stage),pending);
    assert.deepEqual(await pending,{status:'ready',worlds:5});
    for(const id of WORLD_IDS){
      const entry=stage.environmentCache.get(id),source=stage.worldLibrary.get(id);
      assert.equal(entry.root.children[0].visible,false);
      assert.equal(entry.worldGroup.visible,true);
      const cloned=entry.worldGroup.children[0].children[0];
      assert.equal(cloned.geometry,source.children[0].geometry);
      assert.notEqual(cloned.material,source.children[0].material);
      if(id==='floodworks'){
        const basin=entry.worldGroup.getObjectByName('WORLD_floodworks / water'),flow=entry.worldGroup.getObjectByName('WORLD_floodworks / foam');
        assert.equal(basin.material.transparent,true);assert.equal(basin.material.depthWrite,false);assert.equal(basin.material.roughness,.56);
        assert.equal(water.material.transparent,false,'source material stays reusable');assert.equal(flow.material.transparent,false,'inner flow/foam is not faded');
        assert.equal(flow.material.color.getHex(),foam.material.color.getHex());
      }
      const late=new THREE.Group();entry.root.add(late);
      assert.deepEqual(applySceneWorld(stage,id,entry),{status:'ready',world:id});
      assert.equal(entry.root.children.filter(child=>child.visible).length,1);
      assert.equal(late.visible,false);
    }
    assert.equal(stage.worldPrototypeRoot.visible,false);
  }finally{GLTFLoader.prototype.load=load;}
});

test('failed or incomplete world files retain fallback geometry',async()=>{
  const load=GLTFLoader.prototype.load;
  try{
    const {stage,scene}=fixture();scene.remove(scene.children[0]);
    GLTFLoader.prototype.load=function(url,onLoad){queueMicrotask(()=>onLoad({scene}));};
    assert.deepEqual(await loadSceneWorlds(stage),{status:'fallback',reason:'incomplete-world-library'});
    assert.equal(stage.removed.length,1);
    for(const entry of stage.environmentCache.values())assert.equal(entry.root.children[0].visible,true);
    assert.equal(stage.worldLibrary,undefined);
  }finally{GLTFLoader.prototype.load=load;}
});

test('a world load resolving after stage disposal releases the uninstalled scene',async()=>{
  const {stage,scene}=fixture(),load=GLTFLoader.prototype.load;let finish;
  GLTFLoader.prototype.load=function(url,onLoad){finish=onLoad;};
  try{
    const promise=loadSceneWorlds(stage);stage.disposed=true;finish({scene});
    assert.deepEqual(await promise,{status:'disposed'});
    assert.deepEqual(stage.removed,[scene]);
    assert.deepEqual(applySceneWorld(stage,'ruins',stage.environmentCache.get('ruins')),{status:'disposed'});
    assert.deepEqual(await loadSceneWorlds(stage),{status:'disposed'});
  }finally{GLTFLoader.prototype.load=load;}
});

test('a network load failure resolves fallback without hiding a usable scene',async()=>{
  const {stage}=fixture(),load=GLTFLoader.prototype.load,warn=console.warn;
  GLTFLoader.prototype.load=function(url,onLoad,onProgress,onError){queueMicrotask(()=>onError(new Error('missing-file')));};
  console.warn=()=>{};
  try{
    assert.deepEqual(await loadSceneWorlds(stage),{status:'fallback',reason:'load-failed'});
    for(const entry of stage.environmentCache.values())assert.equal(entry.root.children[0].visible,true);
  }finally{GLTFLoader.prototype.load=load;console.warn=warn;}
});

test('real GLTFLoader names match the exported basin and preserve the inner foam',async()=>{
  const data=await readFile(new URL('../public/models/grande-worlds.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),'');
  let source;gltf.scene.traverse(node=>{if(node.userData.grande_world&&node.userData.world_id==='floodworks')source=node;});
  assert(source);
  const original=source.getObjectByName('WORLD_floodworks__water');assert(original);
  assert.equal(original.userData.name,'WORLD_floodworks / water');assert.equal(original.material.name,'water');
  const stage={worldLibrary:new Map([['floodworks',source]])},entry={root:new THREE.Group()};
  assert.equal(applySceneWorld(stage,'floodworks',entry).status,'ready');
  const basin=entry.worldGroup.getObjectByName(original.name),foam=entry.worldGroup.getObjectByName('WORLD_floodworks__foam');
  assert.equal(basin.material.color.getHexString(),'34585d');assert.equal(basin.material.roughness,.56);
  assert.equal(basin.material.transparent,true);assert.equal(basin.material.depthWrite,false);
  assert.equal(original.material.transparent,false,'runtime effect must not mutate the GLB prototype');
  assert(foam);assert.equal(foam.material.transparent,false,'foam keeps its authored shape and color');
  assert.equal(foam.material.color.getHex(),source.getObjectByName(foam.name).material.color.getHex());
  const shader={vertexShader:'#include <project_vertex>',fragmentShader:'#include <color_fragment>'};
  basin.material.onBeforeCompile(shader);assert(shader.fragmentShader.includes('smoothstep(10.3,12.95'));
});
