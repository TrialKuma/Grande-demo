import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {BattleScene} from '../src/scene.js';
import {ribbonGeometry,spellProjectile,bladeRibbon,castSigil,impactLens,shieldLattice} from '../src/scene-spellfx.js';
import {contactEffect} from '../src/scene-impact.js';

function stage(reducedMotion=false){return Object.assign(Object.create(BattleScene.prototype),{camera:new THREE.PerspectiveCamera(),reducedMotion,effects:[],effectRoot:new THREE.Group(),glowTexture:new THREE.Texture(),flashAt(){}});}
const start=new THREE.Vector3(-2,1,2),end=new THREE.Vector3(2,2,-2);
function finiteGeometry(object){object.traverse(node=>{for(const attribute of Object.values(node.geometry?.attributes||{}))assert.ok([...attribute.array].every(Number.isFinite));});}
test('continuous ribbons stay finite even on a camera-aligned or stationary path',()=>{
 for(const points of [[start,end],[start,start.clone()],[new THREE.Vector3(),new THREE.Vector3(0,0,3)]]){
  const geometry=ribbonGeometry(points,.1);assert.ok([...geometry.attributes.position.array].every(Number.isFinite));assert.equal(geometry.index.count,6);geometry.dispose();
 }
});
test('spell themes share finite, bounded geometry and release every allocated resource at expiry',()=>{
 const s=stage();
 for(const theme of ['ballistic','mind','clockwork','water','spore','silverfire','lightning','arcane'])spellProjectile(s,start,end,'#ab88ff',{theme});
 bladeRibbon(s,end,'#ab88ff');castSigil(s,start,'#ab88ff');shieldLattice(s,start,'#88eaff');impactLens(s,{theme:'ballistic',index:0,strength:1},end,'#ffc185');
 const disposed=new Map();
 for(const effect of s.effects){
  finiteGeometry(effect.object);
  effect.object.traverse(node=>{for(const asset of [node.geometry,node.material].filter(Boolean)){if(disposed.has(asset))continue;disposed.set(asset,0);asset.addEventListener('dispose',()=>disposed.set(asset,disposed.get(asset)+1));}});
  for(const t of [0,.1,.5,.9,1])effect.update(t,effect.duration*t);
  s.removeEffect(effect.object);
 }
 assert.equal(s.effectRoot.children.length,0);assert.ok([...disposed.values()].every(count=>count===1));assert.ok(disposed.size<75,'Each skill uses a handful of strips, not a particle mesh per pixel');
});
test('reduced motion uses fewer ribbons and no moving sigil rotation',()=>{
 const full=stage(),reduced=stage(true);
 const a=spellProjectile(full,start,end,'#ab88ff',{theme:'mind'}),b=spellProjectile(reduced,start,end,'#ab88ff',{theme:'mind'});
 assert.ok(b.children.length<a.children.length);
 const sigil=castSigil(reduced,start,'#ab88ff');reduced.effects.at(-1).update(.5);assert.equal(sigil.material.uniforms.uTime.value,0);
 for(const s of [full,reduced])for(const effect of s.effects)s.removeEffect(effect.object);
});
test('the new contact lens never labels a fully shielded or zero-damage contact as injury',()=>{
 for(const reaction of [false,true]){
  const s=stage(),beat={theme:'mind',index:0,strength:1,id:'boss',material:'stone',reaction,absorbed:reaction?0:12},snapshot=structuredClone(beat);
  contactEffect(s,beat,end,new THREE.Vector3(0,0,1));
  assert.equal(s.effects.some(effect=>effect.object.name==='impact-lens-mind'),reaction);assert.deepEqual(beat,snapshot);
  for(const effect of s.effects)s.removeEffect(effect.object);
 }
});
