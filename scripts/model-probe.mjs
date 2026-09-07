// Validate the actual exported model and scene factories without a GPU.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const require = createRequire(import.meta.url);
const base = new URL('../', import.meta.url);
const file = await fs.readFile(new URL('public/models/qianxing.glb', base));
assert.equal(file.toString('ascii', 0, 4), 'glTF');
assert.equal(file.readUInt32LE(4), 2);
assert.equal(file.readUInt32LE(8), file.length);
const json = JSON.parse(file.toString('utf8', 20, 20 + file.readUInt32LE(12)));
assert(!json.images?.some(image => image.uri), 'Model must not fetch remote textures');
assert(!json.skins?.length, 'This rigid-pivot sample must not claim a skinned rig');
const triangles = json.meshes.flatMap(mesh => mesh.primitives).reduce((n, primitive) => n + json.accessors[primitive.indices].count / 3, 0);
const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
const bounds = new THREE.Box3().setFromObject(gltf.scene);
const size = bounds.getSize(new THREE.Vector3());
assert(size.y > 2.3 && size.y < 2.6);
assert(size.x > 1 && size.x < 1.4);
for (const name of ['head', 'rightArm', 'leftArm']) {
  const pivot = gltf.scene.getObjectByName(name);
  assert(pivot && pivot.children.length > 0, `Missing editable pivot: ${name}`);
  const before = pivot.getWorldPosition(new THREE.Vector3());
  pivot.rotation.x = -.7;
  gltf.scene.updateMatrixWorld(true);
  assert(before.distanceTo(pivot.getWorldPosition(new THREE.Vector3())) < 1e-6, `${name} rotation moves its own pivot`);
  pivot.rotation.x = 0;
}
gltf.scene.traverse(node => {
  if (!node.geometry) return;
  const positions = node.geometry.attributes.position.array;
  assert([...positions].every(Number.isFinite), `Non-finite vertices in ${node.name}`);
});

// Import a temporary module view with factory exports, leaving runtime source unchanged.
let source = await fs.readFile(new URL('src/scene.js', base), 'utf8');
source = source.replace(/from '(three(?:\/[^']+)?)'/g, (_, specifier) => `from '${pathToFileURL(require.resolve(specifier)).href}'`);
source = source.replace(/from '(\.\/[^']+)'/g,(_,specifier)=>`from '${new URL('src/'+specifier,base).href}'`);
source += '\nexport { person, PARTY_PLACEMENTS, BOSS_POSITION, facingCenter, ENEMY_FACTORIES };';
const scene = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const actors = ['youmu', 'patch'].map(scene.person);
for (const actor of actors) {
  assert(actor.bones.head && actor.bones.rightArm && actor.bones.leftArm);
  assert(new THREE.Box3().setFromObject(actor.root).getSize(new THREE.Vector3()).y > 2);
}
assert.deepEqual(scene.BOSS_POSITION, [0, .48, 0]);
const centroid = scene.PARTY_PLACEMENTS.reduce((sum, p) => sum.add(new THREE.Vector3(...p)), new THREE.Vector3()).divideScalar(3);
assert(Math.abs(centroid.x) + Math.abs(centroid.z) < 1e-8);
for (const p of scene.PARTY_PLACEMENTS) {
  const position = new THREE.Vector3(...p);
  const direction = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), scene.facingCenter(position));
  assert(direction.dot(position.clone().setY(0).normalize().negate()) > .99999);
}
console.log(JSON.stringify({bytes: file.length, triangles, gltf_meshes: json.meshes.length, gltf_nodes: json.nodes.length, materials: json.materials.length, bounds: size.toArray(), pivots: ['head', 'rightArm', 'leftArm'], new_hero_factories: 'passed', legacy_formation_facing: 'passed'}, null, 2));
const {formationFor}=await import('../src/scene-expansion.js');
for(const id of ['tide','furnace','orrery','arbiter']){
  const enemy=scene.ENEMY_FACTORIES[id]();
  const bounds=new THREE.Box3().setFromObject(enemy.root).getSize(new THREE.Vector3());
  assert(bounds.y>3&&bounds.y<6,id+' silhouette');
  let meshes=0;enemy.root.traverse(node=>{if(node.geometry){meshes++;assert([...node.geometry.attributes.position.array].every(Number.isFinite));}});
  assert(meshes>20,id+' designed geometry');
}
for(const id of Object.keys(scene.ENEMY_FACTORIES))for(const count of [1,3]){
  const layout=formationFor(id,count);assert.equal(layout.party.length,count);
  for(const position of layout.party)assert(new THREE.Vector3(...position).distanceTo(new THREE.Vector3(...layout.boss))>2.8,id+' separation');
}
console.log('Ten boss factories and distinct scene formations, including solo, passed.');
