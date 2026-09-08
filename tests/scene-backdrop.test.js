import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {SceneBackdrop,BACKDROP_URLS,panoramaView} from '../src/scene-backdrop.js';
import {BattleScene} from '../src/scene.js';

test('panorama races, studio preview and disposal preserve the active world',async()=>{
  const original=THREE.TextureLoader.prototype.load,requests=new Map();
  THREE.TextureLoader.prototype.load=function(url,success,progress,error){requests.set(url,{success,error});return new THREE.Texture();};
  const stage={scene:new THREE.Scene(),camera:new THREE.OrthographicCamera(-12,12,8,-8,.1,100),environmentCache:new Map(),removeEffect:BattleScene.prototype.removeEffect};
  stage.camera.position.set(12,10,16);stage.camera.lookAt(0,0,0);
  stage.scene.background=new THREE.Color('#000000');stage.scene.fog=new THREE.FogExp2('#333333',.02);
  const backdrop=new SceneBackdrop(stage);
  try{
    const ruins=backdrop.setWorld('ruins'),storm=backdrop.setWorld('storm');
    const ruinTexture=new THREE.Texture(),stormTexture=new THREE.Texture();
    requests.get(BACKDROP_URLS.ruins).success(ruinTexture);await ruins;
    assert(stage.scene.background.isColor,'late image from inactive world must not replace active background');
    const far=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name:'Quiet distant mountain stone'}));
    const near=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({name:'Tower masonry'}));
    const worldGroup=new THREE.Group();worldGroup.add(far,near);stage.environmentCache.set('storm',{worldGroup});
    requests.get(BACKDROP_URLS.storm).success(stormTexture);await storm;
    assert.equal(backdrop.sky.material.uniforms.panorama.value,stormTexture);assert.equal(backdrop.sky.visible,true);
    assert(stage.scene.background.isColor,'the orthographic camera uses a full-screen panorama, never a tiny unit skybox');
    assert.equal(far.visible,false);assert.equal(near.visible,true);
    stage.modelReview={};const studio=new THREE.Color('#182833');stage.scene.background=studio;
    backdrop.sync();assert.equal(stage.scene.background,studio);assert.equal(backdrop.root.visible,false);
    stage.modelReview=null;backdrop.sync();assert.equal(backdrop.sky.material.uniforms.panorama.value,stormTexture);assert.equal(backdrop.root.visible,true);
    BattleScene.prototype.setEnvironmentLighting.call(stage,'sanctum');
    assert(stage.scene.background.isColor,'switching away from a texture uses a color fallback while loading');
    const failed=backdrop.setWorld('sanctum');requests.get(BACKDROP_URLS.sanctum).error(new Error('test missing image'));
    assert.equal((await failed).status,'fallback');assert(stage.scene.background.isColor);assert.equal(backdrop.sky.visible,false);
    await backdrop.setWorld('ruins');assert.equal(backdrop.sky.material.uniforms.panorama.value,ruinTexture);
    const last=backdrop.setWorld('observatory'),late=new THREE.Texture();let disposed=0;
    late.addEventListener('dispose',()=>disposed++);backdrop.dispose();backdrop.dispose();
    requests.get(BACKDROP_URLS.observatory).success(late);assert.equal((await last).status,'disposed');assert.equal(disposed,1);
    assert.equal(stage.scene.children.length,0);stage.removeEffect(worldGroup);
  }finally{backdrop.dispose();THREE.TextureLoader.prototype.load=original;}
});

test('panorama follows full camera orbit while stabilizing a steep overhead horizon',()=>{
  const camera=new THREE.OrthographicCamera(-16,16,8,-8,.1,100);
  camera.position.set(0,12,16);camera.lookAt(0,0,0);const front=panoramaView(camera);
  camera.position.set(0,12,-16);camera.lookAt(0,0,0);const rear=panoramaView(camera);
  assert.equal(front.aspect,2);assert(Math.abs(Math.abs(front.yaw-rear.yaw)-Math.PI)<.001);
  assert(front.pitch>-.28&&front.pitch<0);assert(Math.abs(front.pitch-rear.pitch)<1e-12);
});
