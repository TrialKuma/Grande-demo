import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import * as THREE from 'three';

// Import actual character geometry without constructing a renderer or DOM.
const require=createRequire(import.meta.url),sceneUrl=new URL('../src/scene.js',import.meta.url);
let source=await fs.readFile(sceneUrl,'utf8');
source=source.replace(/from '(three(?:\/[^']+)?)'/g,(_,id)=>`from '${pathToFileURL(require.resolve(id)).href}'`);
source=source.replace(/from '(\.\/[^']+)'/g,(_,id)=>`from '${new URL(id,sceneUrl).href}'`);
const {person,BattleScene}=await import(`data:text/javascript;base64,${Buffer.from(source+'\nexport {person};').toString('base64')}`);

test('Qianxing uses the same articulated party body with an attached reactor, emitter and moving leg armor',()=>{
 const hero=person('qianxing'),other=person('knibbs');
 assert.equal(hero.modelSource,'procedural');
 for(const key of ['head','leftArm','rightArm','leftLeg','rightLeg','weapon'])assert.ok(hero.bones[key],key);
 const height=new THREE.Box3().setFromObject(hero.root).getSize(new THREE.Vector3()).y;
 const otherHeight=new THREE.Box3().setFromObject(other.root).getSize(new THREE.Vector3()).y;
 assert.ok(Math.abs(height-otherHeight)<.1,'same body proportions');
 const reactor=hero.body.getObjectByName('qianxing-back-reactor');
 assert.ok(reactor.position.z<0,'reactor sits behind the torso');
 assert.equal(hero.bones.weapon.name,'qianxing-arm-emitter');
 assert.ok(hero.bones.leftArm.getObjectByName('qianxing-spike-gauntlet'));
 const legArmor=hero.bones.leftLeg.children.filter(part=>part.material===hero.palette.silver);
 assert.ok(legArmor.length>=2,'armor follows the leg pivot rather than remaining on the torso');
 for(const node of [hero.root,other.root])node.traverse(part=>{
  if(part.geometry)assert.ok([...part.geometry.attributes.position.array].every(Number.isFinite));
 });
});

test('Haart holds the cover under his palm while both written pages face his eyes',()=>{
 const hero=person('haart'),book=hero.bones.weapon;
 assert.equal(book.name,'haart-reading-book');
 for(const sway of [-.14,0,.14]){
  hero.bones.leftArm.rotation.x=sway;hero.root.updateMatrixWorld(true);
  const eyes=hero.bones.head.localToWorld(new THREE.Vector3(0,.035,.23));
  for(const id of ['haart-page-left','haart-page-right']){
   const page=book.getObjectByName(id),at=page.getWorldPosition(new THREE.Vector3());
   const towardEyes=eyes.clone().sub(at).normalize();
   const readingNormal=new THREE.Vector3(...page.userData.readingNormal).transformDirection(page.matrixWorld);
   assert.ok(readingNormal.dot(towardEyes)>.8,'page front faces upward toward the reader during ordinary sway');
   assert.ok(readingNormal.y>0&&readingNormal.z<0,'cover faces outward, page faces the actor');
  }
  const palm=hero.bones.leftHand.getWorldPosition(new THREE.Vector3());
  const spine=book.localToWorld(new THREE.Vector3(0,0,.05));
  assert.ok(palm.distanceTo(spine)<.065,'the book rests on the hand rather than floating beside it');
 }
});

test('Blender comparison is opt-in and restores the exact procedural weapon and limb references',async()=>{
 const hero=person('qianxing'),stage=Object.create(BattleScene.prototype);
 stage.modelReview=null;
 assert.deepEqual(await stage.loadDetailedHero(hero),{status:'procedural'});
 assert.equal(hero.modelPromise,undefined,'no fetch is started for normal combat or exploration');
 const original={body:hero.body,bones:hero.bones,mats:hero.mats,animated:hero.animated};
 const sample=new THREE.Group();hero.root.add(sample);
 hero.reviewModel={body:sample,bones:{head:new THREE.Group()},mats:[],animated:[],modelSource:'blender'};
 stage.modelReview={};
 await stage.loadDetailedHero(hero);assert.equal(hero.body,sample);assert.equal(original.body.visible,false);
 stage.setDetailedHeroPreview(hero,false);
 for(const [key,value]of Object.entries(original))assert.equal(hero[key],value,`restored ${key}`);
 assert.equal(hero.modelSource,'procedural');assert.equal(sample.visible,false);assert.equal(original.body.visible,true);
});
