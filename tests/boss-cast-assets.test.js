import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const ids=['golem','duelist','cantor','warden','weaver','tide','furnace','orrery','arbiter','final'];
const file=await fs.readFile(new URL('../public/models/grande-boss-cast.glb',import.meta.url));
const json=JSON.parse(file.toString('utf8',20,20+file.readUInt32LE(12)));
const gltf=await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'');
const manifest=JSON.parse(await fs.readFile(new URL('../assets_3d/boss-cast/manifest.json',import.meta.url),'utf8'));

test('complete boss cast contains ten self-contained full bodies with sensible bounds and material batches',()=>{
  assert.equal(json.buffers.length,1);assert(!json.buffers[0].uri);
  assert(!json.images?.some(image=>image.uri));
  assert.equal(Object.keys(manifest.bosses).length,10);
  let triangles=0;
  for(const id of ids){
    const root=gltf.scene.getObjectByName('boss_'+id);
    assert.equal(root?.userData.grande_boss,id);
    assert.deepEqual(root.position.toArray(),[0,0,0]);
    const bounds=new THREE.Box3().setFromObject(root),size=bounds.getSize(new THREE.Vector3());
    assert(size.y>=3.3&&size.y<=4.9,id+' height');
    assert(size.x>=2&&size.x<=5.1,id+' full body width');
    assert(bounds.min.y>=-.03&&bounds.min.y<=.25,id+' ground datum / hover clearance');
    let meshes=0;
    root.traverse(node=>{
      if(!node.isMesh)return;
      meshes++;
      const a=node.geometry.attributes.position.array;
      assert([...a].every(Number.isFinite),id+' finite vertices');
      triangles+=(node.geometry.index?.count||node.geometry.attributes.position.count)/3;
    });
    assert(meshes>=15&&meshes<=50,id+' rigid material batches');
    assert.equal(meshes,manifest.bosses[id].drawCalls);
    assert(root.getObjectByName(id+'_body'));
    assert(root.getObjectByName(id+'_head'));
  }
  assert.equal(triangles,manifest.totalTriangles);
  assert(triangles<=400000);
});

test('thirty Blender clips have correct durations and only animate their own boss subtree',()=>{
  assert.equal(json.animations.length,30);assert.equal(gltf.animations.length,30);
  assert.equal(new Set(json.nodes.map(n=>n.name).filter(Boolean)).size,json.nodes.length);
  for(const id of ids){
    const rootIndex=json.nodes.findIndex(n=>n.name==='boss_'+id),descendants=new Set();
    const walk=i=>{descendants.add(i);for(const c of json.nodes[i].children||[])walk(c);};walk(rootIndex);
    for(const [kind,duration] of Object.entries({idle:2.4,attack:1.1,hit:.6})){
      const name=id+'_'+kind,anim=json.animations.find(a=>a.name===name),clip=gltf.animations.find(a=>a.name===name);
      assert(anim&&clip,name);assert(Math.abs(clip.duration-duration)<1e-5,name+' duration');
      assert(anim.channels.length>=3,name+' articulated motion');
      for(const channel of anim.channels){
        assert(descendants.has(channel.target.node),name+' channel stays in subtree');
        assert.notEqual(channel.target.node,rootIndex,name+' root position belongs to runtime');
      }
      for(const track of clip.tracks){
        assert([...track.values].every(Number.isFinite),name+' finite curves');
        assert([...track.times].every(Number.isFinite),name+' finite times');
      }
    }
  }
});

test('each exported idle, attack and hit really moves articulated nodes when sampled in Three',()=>{
  for(const id of ids){
    for(const kind of ['idle','attack','hit']){
      const root=gltf.scene.getObjectByName('boss_'+id).clone(true);
      const before=new Map();root.traverse(n=>before.set(n.uuid,[...n.position,...n.quaternion,...n.scale]));
      const clip=gltf.animations.find(c=>c.name===id+'_'+kind),mixer=new THREE.AnimationMixer(root);
      const action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);action.play();mixer.update(clip.duration*(kind==='idle'?.23:kind==='attack'?.36:.22));
      let moved=0;root.traverse(n=>{const now=[...n.position,...n.quaternion,...n.scale];if(now.some((x,i)=>Math.abs(x-before.get(n.uuid)[i])>1e-4))moved++;});
      assert(moved>=3,id+' '+kind+' has real exported curves');
      mixer.stopAllAction();mixer.uncacheRoot(root);
    }
  }
});

test('boss topology reflects different full-body concepts and exposes the golem core',()=>{
  const get=id=>gltf.scene.getObjectByName('boss_'+id);
  assert(get('golem').getObjectByName('golem_core').userData.grande_core);
  assert(get('warden').getObjectByName('warden_jaw'));
  assert(get('cantor').getObjectByName('cantor_cap'));
  assert(get('weaver').getObjectByName('weaver_book'));
  assert(get('tide').getObjectByName('tide_valve_wheel'));
  assert(get('furnace').getObjectByName('furnace_fire_gate'));
  assert(get('orrery').getObjectByName('orrery_orbit_2'));
  assert(get('arbiter').getObjectByName('arbiter_scales'));
  let finalArms=0;get('final').traverse(n=>{if(n.userData.grande_joint==='arm')finalArms++;});
  assert.equal(finalArms,6);
  assert(manifest.bosses.warden.bounds.depth>manifest.bosses.duelist.bounds.depth*2);
  assert(manifest.bosses.final.bounds.width>manifest.bosses.cantor.bounds.width*1.5);
});
