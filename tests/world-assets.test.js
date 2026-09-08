import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {WORLD_IDS} from '../src/scene-worlds.js';

const file=await fs.readFile(new URL('../public/models/grande-worlds.glb',import.meta.url));
const json=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
const gltf=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
const worlds=new Map();gltf.scene.traverse(node=>{if(node.userData.grande_world)worlds.set(node.userData.world_id,node);});
gltf.scene.updateMatrixWorld(true);

test('five complete Blender worlds export offline with bounded geometry and material batches',()=>{
  assert.deepEqual([...worlds.keys()].sort(),[...WORLD_IDS].sort());
  assert(!json.images?.some(image=>image.uri));assert(!json.buffers.some(buffer=>buffer.uri));
  let triangles=0;
  for(const mesh of json.meshes)for(const primitive of mesh.primitives)triangles+=json.accessors[primitive.indices].count/3;
  assert(triangles>50000,'the file must contain complete architectural worlds');
  assert(triangles<400000,'five worlds stay inside the shared triangle budget');
  assert(json.meshes.length<115,'static source parts must be merged per world/material');
  for(const [id,root] of worlds){
    const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
    assert(size.x>12&&size.z>15&&size.y>7,id+' must include floor and full landmark architecture');
    assert.equal(root.userData.combat_surface_y,.48);
    root.traverse(node=>{if(node.geometry)assert([...node.geometry.attributes.position.array].every(Number.isFinite),id);});
  }
});

test('complete worlds retain a clear combat rectangle and a floor under all formation regions',()=>{
  const ray=new THREE.Raycaster();
  for(const [id,root] of worlds){
    for(const x of [-3.8,-1.8,.27,1.9,3.8])for(const z of [-2.8,-.7,1.2,3.2,4.8]){
      ray.set(new THREE.Vector3(x,3.9,z),new THREE.Vector3(0,-1,0));
      const hits=ray.intersectObject(root,true);
      assert(hits.length,id+': missing ground at '+x+','+z);
      assert(hits[0].point.y<=.56,id+': architecture obstructs combat at '+x+','+z+' height '+hits[0].point.y);
      assert(hits[0].point.y>=.20,id+': floor is below the walking surface at '+x+','+z);
    }
  }
});
