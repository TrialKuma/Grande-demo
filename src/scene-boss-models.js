import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';

export const BOSS_CAST_URL='/models/grande-boss-cast.glb';
export const BOSS_CAST_IDS=['golem','duelist','cantor','warden','weaver','tide','furnace','orrery','arbiter','final'];
export const BOSS_ANIMATIONS=['idle','attack','hit'];

// The source GLB stays hidden and belongs to one BattleScene. Cached actors
// share immutable geometry but never materials, skeletons, or mixer state.
export function prepareBossCast(gltf){
 const models=new Map(),animations=new Map();
 gltf.scene.traverse(node=>{const id=node.userData.grande_boss;if(BOSS_CAST_IDS.includes(id))models.set(id,node);});
 for(const id of BOSS_CAST_IDS){
  if(!models.has(id))throw new Error(`Missing complete boss: ${id}`);
  const clips=new Map();
  for(const kind of BOSS_ANIMATIONS){
   const clip=gltf.animations.find(animation=>animation.name===`${id}_${kind}`);
   if(!clip||clip.duration<=0||!clip.tracks.length)throw new Error(`Missing authored animation: ${id}_${kind}`);
   for(const track of clip.tracks){
    const binding=THREE.PropertyBinding.parseTrackName(track.name);
    if(!THREE.PropertyBinding.findNode(models.get(id),binding.nodeName))throw new Error(`Animation escapes its boss subtree: ${clip.name} / ${track.name}`);
   }
   clips.set(kind,clip);
  }
  animations.set(id,clips);
 }
 return {models,animations};
}

export function resetBossAnimation(actor){
 const runtime=actor?.bossAnimation;if(!runtime)return false;
 runtime.mixer.stopAllAction();
 runtime.current='idle';
 const idle=runtime.actions.get('idle');idle.reset().setLoop(THREE.LoopRepeat,Infinity).setEffectiveTimeScale(1).setEffectiveWeight(1).play();
 runtime.mixer.update(0);
 return true;
}

export function playBossAnimation(actor,kind='attack',{duration}={}){
 const runtime=actor?.bossAnimation,action=runtime?.actions.get(kind);if(!action)return false;
 if(kind==='idle')return resetBossAnimation(actor);
 runtime.mixer.stopAllAction();
 action.reset().setLoop(THREE.LoopOnce,1).setEffectiveWeight(1);
 action.clampWhenFinished=true;
 action.setEffectiveTimeScale(Number.isFinite(duration)&&duration>0?action.getClip().duration/duration:1);
 runtime.current=kind;action.play();runtime.mixer.update(0);
 return true;
}

// Engine-provided HP loss is the only combat trigger. A shield absorption or
// core registration still has particles, but must never restart a hurt clip.
export function reactBossToImpact(actor,beat){
 if(!(Number.isFinite(beat?.hpLoss)&&beat.hpLoss>0))return false;
 return playBossAnimation(actor,'hit',{duration:.45});
}

export function updateBossAnimation(actor,dt,{alive=true}={}){
 const runtime=actor?.bossAnimation;if(!runtime)return false;
 if(alive&&actor.root.visible&&Number.isFinite(dt)&&dt>0){
  runtime.mixer.update(dt);runtime.elapsed+=dt;
  const mix=Math.min(1,dt*7),broken=actor.broken?1:0;
  runtime.envelope.position.y=THREE.MathUtils.lerp(runtime.envelope.position.y,-.2*broken,mix);
  runtime.envelope.rotation.x=THREE.MathUtils.lerp(runtime.envelope.rotation.x,.065*broken,mix);
  runtime.coreProgress=THREE.MathUtils.lerp(runtime.coreProgress,actor.coreOpen?1:0,mix);
  const cp=runtime.coreProgress;
  for(const core of runtime.cores){
   core.envelope.scale.setScalar(1+cp*.68);
   core.envelope.position.z=cp*.28;
   core.light.intensity=cp*(3.8+Math.sin(runtime.elapsed*5)*.7);
  }
  for(const mat of runtime.coreMats)mat.userData.mechanismIntensity=cp*(1.5+Math.sin(runtime.elapsed*5)*.35);
 }
 return true;
}

export function applyBossModel(stage,actor){
 if(stage.disposed)return {status:'disposed'};
 if(actor?.bossAnimation)return {status:'ready',boss:actor.modelId};
 if(!BOSS_CAST_IDS.includes(actor?.modelId))return {status:'fallback',reason:'教学敌人使用原有专属模型'};
 const library=stage.bossModelLibrary;
 if(!library)return {status:stage.bossModelStatus?.status==='fallback'?'fallback':'pending'};
 const original=library.models.get(actor.modelId),clips=library.animations.get(actor.modelId);
 if(!original||!clips)return {status:'fallback',reason:'该 BOSS 的完整模型或动作未载入'};
 const visual=cloneSkeleton(original),materials=new Map(),coreMaterials=new Map(),mats=[],coreMats=[];
 visual.name=original.name;visual.visible=true;
 visual.traverse(node=>{
  if(!node.isMesh)return;
  node.castShadow=node.receiveShadow=true;
  let inCore=false;for(let ancestor=node;ancestor;ancestor=ancestor.parent){if(ancestor.userData.grande_core){inCore=true;break;}if(ancestor===visual)break;}
  const cache=inCore?coreMaterials:materials;
  const ownMaterial=source=>{
   if(cache.has(source))return cache.get(source);
   const mat=source.clone();cache.set(source,mat);
   if(mat.emissive){mat.userData.originalEmissive=mat.emissive.clone();mat.userData.originalIntensity=mat.emissiveIntensity;mats.push(mat);}
   if(inCore&&mat.emissive)coreMats.push(mat);
   return mat;
  };
  node.material=Array.isArray(node.material)?node.material.map(ownMaterial):ownMaterial(node.material);
 });
 const bounds=new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3());
 const envelope=new THREE.Group();envelope.name='Boss state posture';envelope.add(visual);
 const coreNodes=[];visual.traverse(node=>{if(node.userData.grande_core)coreNodes.push(node);});
 const cores=coreNodes.map(node=>{
  // An unkeyed parent supplies the core reveal. The imported node itself keeps
  // its authored scale animation, so reveal and breathing do not overwrite.
  const envelope=new THREE.Group();envelope.name='Exposed core';node.parent.add(envelope);envelope.add(node);
  const light=new THREE.PointLight('#c7a7ff',0,5,2);node.add(light);return {envelope,light};
 });
 const mixer=new THREE.AnimationMixer(visual),actions=new Map([...clips].map(([kind,clip])=>[kind,mixer.clipAction(clip)]));
 const runtime={mixer,actions,visual,envelope,cores,coreMats,current:'idle',finished:null,elapsed:0,coreProgress:0};
 runtime.finished=event=>{if(actor.bossAnimation===runtime&&event.action===actions.get(runtime.current))resetBossAnimation(actor);};
 mixer.addEventListener('finished',runtime.finished);
 actor.root.add(envelope);
 // Keep old mechanical pivots and core references intact, but they can no
 // longer render or fight the authored transforms on the separate visual.
 actor.body.visible=false;
 actor.blenderVisual=visual;actor.bossAnimation=runtime;actor.modelSource='blender-animated';
 actor.mats=mats;
 actor.modelBounds=bounds;
 if(Number.isFinite(bounds.y)&&bounds.y>0)actor.height=bounds.y;
 resetBossAnimation(actor);
 return {status:'ready',boss:actor.modelId};
}

export function loadBossModels(stage,{loader=new GLTFLoader()}={}){
 if(stage.bossModelPromise)return stage.bossModelPromise;
 if(stage.disposed)return Promise.resolve({status:'disposed'});
 stage.bossModelStatus={status:'loading',bosses:0,clips:0};
 stage.bossModelPromise=new Promise(resolve=>{
  loader.load(BOSS_CAST_URL,gltf=>{
   if(stage.disposed){stage.removeEffect(gltf.scene);resolve({status:'disposed'});return;}
   try{
    const library=prepareBossCast(gltf);
    stage.bossModelLibrary=library;
    gltf.scene.name='Blender boss cast prototypes';gltf.scene.visible=false;stage.scene.add(gltf.scene);
    for(const actor of stage.bossCache.values())applyBossModel(stage,actor);
    stage.bossModelStatus={status:'ready',bosses:library.models.size,clips:[...library.animations.values()].reduce((total,clips)=>total+clips.size,0)};
   }catch(error){
    stage.removeEffect(gltf.scene);
    stage.bossModelStatus={status:'fallback',bosses:0,clips:0,reason:'完整 BOSS 模型缺失或动作不完整'};
    console.warn('完整 BOSS 资源未能应用，保留基础模型。',error);
   }
   resolve({...stage.bossModelStatus});
  },undefined,error=>{
   stage.bossModelStatus=stage.disposed?{status:'disposed'}:{status:'fallback',bosses:0,clips:0,reason:'完整 BOSS 模型载入失败'};
   if(!stage.disposed)console.warn('完整 BOSS 资源载入失败，保留基础模型。',error);
   resolve({...stage.bossModelStatus});
  });
 });
 return stage.bossModelPromise;
}

export function disposeBossModels(stage){
 for(const actor of stage.bossCache?.values()||[]){
  const runtime=actor.bossAnimation;if(!runtime)continue;
  runtime.mixer.removeEventListener('finished',runtime.finished);
  runtime.mixer.stopAllAction();runtime.mixer.uncacheRoot(runtime.visual);
  actor.bossAnimation=null;
 }
 stage.bossModelLibrary?.models.clear();stage.bossModelLibrary?.animations.clear();
 stage.bossModelLibrary=null;stage.bossModelStatus={status:'disposed'};
}
