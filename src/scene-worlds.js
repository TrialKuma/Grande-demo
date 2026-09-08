import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const WORLD_MODEL_URL='/models/grande-worlds.glb';
export const WORLD_IDS=['ruins','storm','sanctum','floodworks','observatory'];

function softenCanalBasin(node){
  // Exact exported batch and material names: foam, pipes and the inner flow
  // streaks remain untouched. Only the outer edge of this 26m basin fades.
  // GLTFLoader sanitizes Object3D.name to WORLD_floodworks__water, but keeps
  // the exporter name in userData.name. Match that exact original batch.
  if((node.userData.name||node.name)!=='WORLD_floodworks / water'||Array.isArray(node.material)||node.material?.name!=='water')return;
  const material=node.material;
  material.color.set('#34585d');material.roughness=.56;material.metalness=.16;
  material.transparent=true;material.depthWrite=false;node.castShadow=false;
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vCanalPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvCanalPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader='varying vec3 vCanalPosition;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a*=1.0-smoothstep(10.3,12.95,max(abs(vCanalPosition.x),abs(vCanalPosition.z)));');
  };
}

function cloneWorld(source){
  const clone=source.clone(true),materials=new Map();
  clone.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=node.receiveShadow=true;
    const own=material=>{
      if(!materials.has(material))materials.set(material,material.clone());
      return materials.get(material);
    };
    node.material=Array.isArray(node.material)?node.material.map(own):own(node.material);
    softenCanalBasin(node);
  });
  return clone;
}

export function applySceneWorld(stage,id,entry){
  if(stage.disposed)return {status:'disposed'};
  if(!WORLD_IDS.includes(id)||!entry?.root)return {status:'fallback',reason:'unknown-world'};
  if(!stage.worldLibrary?.has(id))return {status:stage.worldStatus==='fallback'?'fallback':'pending'};
  if(!entry.worldGroup){
    const group=new THREE.Group();group.name=`Full Blender world / ${id}`;
    group.userData.grandeWorldInstance=id;
    group.add(cloneWorld(stage.worldLibrary.get(id)));
    entry.worldGroup=group;entry.root.add(group);
  }
  // Recheck every time: the older detail library can finish loading later.
  // Keeping fallback geometry alive also preserves legacy animation references.
  for(const child of entry.root.children)child.visible=child===entry.worldGroup;
  entry.worldGroup.visible=true;
  entry.root.userData.fullBlenderWorld=id;
  return {status:'ready',world:id};
}

export function loadSceneWorlds(stage){
  if(stage.disposed){stage.worldStatus='disposed';return Promise.resolve({status:'disposed'});}
  if(stage.worldPromise)return stage.worldPromise;
  stage.worldStatus='loading';
  stage.worldPromise=new Promise(resolve=>{
    new GLTFLoader().load(WORLD_MODEL_URL,gltf=>{
      if(stage.disposed){stage.removeEffect(gltf.scene);stage.worldStatus='disposed';resolve({status:'disposed'});return;}
      const library=new Map();
      gltf.scene.traverse(node=>{
        const id=node.userData.world_id;
        if(node.userData.grande_world&&WORLD_IDS.includes(id))library.set(id,node);
      });
      if(WORLD_IDS.some(id=>!library.has(id))){
        stage.removeEffect(gltf.scene);stage.worldStatus='fallback';
        resolve({status:'fallback',reason:'incomplete-world-library'});return;
      }
      stage.worldLibrary=library;
      // The scene owns hidden prototypes plus every clone. Existing scene
      // disposal frees their shared geometries and private materials together.
      gltf.scene.name='Full world prototypes';gltf.scene.visible=false;
      stage.scene.add(gltf.scene);stage.worldPrototypeRoot=gltf.scene;
      stage.worldStatus='ready';
      for(const [id,entry] of stage.environmentCache)applySceneWorld(stage,id,entry);
      resolve({status:'ready',worlds:library.size});
    },undefined,error=>{
      stage.worldStatus=stage.disposed?'disposed':'fallback';
      if(!stage.disposed)console.warn('完整场景暂时未载入，保留现有场地。',error);
      resolve(stage.disposed?{status:'disposed'}:{status:'fallback',reason:'load-failed'});
    });
  });
  return stage.worldPromise;
}
