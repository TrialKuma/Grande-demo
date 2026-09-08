import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {BOSS_DETAIL_PLANS,ENVIRONMENT_DETAIL_PLANS,detailEnemy,detailEnvironment} from '../src/scene-details.js';

const base=new URL('../',import.meta.url),require=createRequire(import.meta.url);
const file=await fs.readFile(new URL('public/models/grande-detail-kit.glb',base));
const json=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
const gltf=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
const detailLibrary=new Map();gltf.scene.traverse(node=>{if(node.userData.grande_module)detailLibrary.set(node.name,node);});
let source=await fs.readFile(new URL('src/scene.js',base),'utf8');
source=source.replace(/from '(three(?:\/[^']+)?)'/g,(_,specifier)=>`from '${pathToFileURL(require.resolve(specifier)).href}'`);
source=source.replace(/from '(\.\/[^']+)'/g,(_,specifier)=>`from '${new URL('src/'+specifier,base).href}'`);
source+='\nexport { ENEMY_FACTORIES };';
const {ENEMY_FACTORIES}=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('3.7 Blender kit exports all 20 named modules without external dependencies',()=>{
  assert.equal(detailLibrary.size,20);
  assert(!json.images?.some(image=>image.uri));assert(!json.buffers.some(buffer=>buffer.uri));
  assert(json.meshes.length<100,'material batches keep the kit below 100 mesh objects');
  for(const plans of [...Object.values(BOSS_DETAIL_PLANS),...Object.values(ENVIRONMENT_DETAIL_PLANS)]){
    for(const [name] of plans)assert(detailLibrary.has(name),`Missing GLB module ${name}`);
  }
  for(const [name,object] of detailLibrary){
    const bounds=new THREE.Box3().setFromObject(object),size=bounds.getSize(new THREE.Vector3());
    assert(size.toArray().every(value=>Number.isFinite(value)&&value>0),name);
    object.traverse(node=>{if(node.geometry)assert([...node.geometry.attributes.position.array].every(Number.isFinite),name);});
  }
});

test('3.7 scenery installs each of the five detail plans exactly once',()=>{
  for(const [id,plan] of Object.entries(ENVIRONMENT_DETAIL_PLANS)){
    const entry={root:new THREE.Group()};detailEnvironment({detailLibrary},id,entry);
    assert(entry.root.userData.blenderDetails);
    assert.equal(entry.root.children[0].children.length,plan.length,id);
    detailEnvironment({detailLibrary},id,entry);assert.equal(entry.root.children.length,1,id);
  }
});

test('3.7 each enemy detail follows its own animation pivot and owns its flash materials',()=>{
  for(const [id,plan] of Object.entries(BOSS_DETAIL_PLANS)){
    const actor=ENEMY_FACTORIES[id](),originalCount=actor.mats.size;
    detailEnemy({detailLibrary},actor);assert(actor.blenderDetails,id);
    assert(actor.mats.size>originalCount,id);
    for(const [name,pivot,position] of plan){
      const parent=actor[pivot]||actor.bones?.[pivot]||actor.body;
      const added=parent.children.find(child=>child.name===`Blender / ${name}`);
      assert(added,`${id} attaches to ${pivot}`);assert.deepEqual(added.position.toArray(),position);
      const sourceMaterials=new Set();detailLibrary.get(name).traverse(node=>{if(node.material)sourceMaterials.add(node.material);});
      added.traverse(node=>{if(node.material)assert(!sourceMaterials.has(node.material),id+' cannot flash source/shared actor material');});
    }
    const count=actor.mats.size;detailEnemy({detailLibrary},actor);assert.equal(actor.mats.size,count);
  }
});

test('3.7 training monsters have finite, distinct small silhouettes and all reaction pivots',()=>{
  const sizes=[];
  for(const id of ['scout','bulwark','conduit']){
    const actor=ENEMY_FACTORIES[id]();assert.equal(actor.modelId,id);
    for(const key of ['head','leftArm','rightArm'])assert(actor.bones[key],id+key);
    const size=new THREE.Box3().setFromObject(actor.root).getSize(new THREE.Vector3());
    assert(size.y>1.2&&size.y<3.1,id);sizes.push(size.toArray());
    actor.root.traverse(node=>{if(node.geometry)assert([...node.geometry.attributes.position.array].every(Number.isFinite),id);});
  }
  assert(sizes[0][1]<sizes[1][1]);assert(sizes[0][0]>sizes[2][0]);
});
