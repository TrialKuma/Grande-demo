import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

export const DETAIL_KIT_URL='/models/grande-detail-kit.glb';
export const ENVIRONMENT_DETAIL_PLANS={
  ruins:[
    ['ruin_arch',[0,.25,-8.1],1.12],
    ['fluted_pillar',[-6.7,.3,-3.4],.92],['fluted_pillar',[6.7,.3,-3.4],.92],
    ['crystal_cluster',[-6.5,.44,2.1],.65],['crystal_cluster',[6.4,.44,2.5],.70],
    ['terrace_segment',[0,.025,0],1,.6],['terrace_segment',[0,.025,0],1,2.45],
  ],
  storm:[
    ['coil_tower',[-6.2,.45,-3.7],1],['coil_tower',[6.2,.45,-3.7],1],
    ['coil_tower',[-7.1,.12,1.4],.80],['coil_tower',[7.1,.12,1.4],.80],
    ['pipe_elbow',[-6.5,.50,-2.3],.9,-Math.PI/2],['pipe_elbow',[6.5,.50,-2.3],.9,Math.PI/2],
    ['terrace_segment',[0,.025,0],1,.55],['terrace_segment',[0,.025,0],1,2.55],
  ],
  sanctum:[
    ['bookcase',[-6.5,.35,-3.5],1.1,Math.PI/3],['bookcase',[6.5,.35,-3.5],1.1,-Math.PI/3],
    ['bookcase',[-7.0,.35,1.0],.9,Math.PI/2],['bookcase',[7.0,.35,1.0],.9,-Math.PI/2],
    ['archive_lectern',[-4.8,.47,-4.6],.95,.45],['archive_lectern',[4.8,.47,-4.6],.95,-.45],
    ['fluted_pillar',[-7.2,.1,-5.8],1.1],['fluted_pillar',[7.2,.1,-5.8],1.1],
  ],
  floodworks:[
    ['flood_pump',[-7.8,.15,-3.8],1.2,.6],['flood_pump',[7.8,.15,-3.8],1.2,-.6],
    ['pipe_elbow',[-7.1,.1,1.3],1.2,-Math.PI/2],['pipe_elbow',[7.1,.1,1.3],1.2,Math.PI/2],
    ['pipe_elbow',[-6.7,.15,-6],1.5],['pipe_elbow',[6.7,.15,-6],1.5,Math.PI],
    ['coil_tower',[-4.9,.47,-4.7],.6],['coil_tower',[4.9,.47,-4.7],.6],
  ],
  observatory:[
    ['star_globe',[-6.7,.2,-3.9],1.1,.4],['star_globe',[6.7,.2,-3.9],1.1,-.4],
    ['fluted_pillar',[-7.1,.15,2.2],.65],['fluted_pillar',[7.1,.15,2.2],.65],
    ['archive_lectern',[0,.43,-6.2],.85],
    ['terrace_segment',[0,.025,0],1,.6],['terrace_segment',[0,.025,0],1,2.5],
  ],
};

export const BOSS_DETAIL_PLANS={
  golem:[['boss_golem','core',[0,0,.34],1.04]],
  duelist:[['boss_duelist','body',[0,2.80,.35],1]],
  cantor:[['boss_cantor','head',[0,.28,0],1.28]],
  warden:[['boss_warden','body',[0,1.67,1.20],1]],
  weaver:[['boss_weaver','body',[0,2.94,-.39],1.36]],
  tide:[['boss_tide','body',[0,2.30,.76],1.04]],
  furnace:[['boss_furnace','body',[0,1.83,1.015],1]],
  orrery:[['boss_orrery','head',[0,0,.36],1.15]],
  arbiter:[['boss_arbiter','head',[0,0,.27],1]],
  final:[['boss_final','head',[0,.30,-.19],1.20]],
  scout:[['boss_warden','body',[0,1.15,.58],.43]],
  bulwark:[['boss_duelist','leftArm',[-.20,-.42,.44],.7]],
  conduit:[['boss_orrery','head',[0,0,.25],.65]],
};

function instance(stage,name,parent,position,scale=1,rotation=0,actor=null){
  const original=stage.detailLibrary?.get(name);if(!original)return null;
  const root=new THREE.Group();root.name=`Blender / ${name}`;
  root.position.set(...position);root.scale.setScalar(scale);root.rotation.y=rotation;
  const model=original.clone(true);
  // Share the immutable geometry. Each actor gets its own materials so that an
  // impact flash never lights up a different enemy or the environment library.
  const materials=new Map();
  model.traverse(node=>{
    if(!node.isMesh)return;
    node.castShadow=node.receiveShadow=true;
    const cloneMaterial=source=>{
      if(materials.has(source))return materials.get(source);
      const mat=source.clone();materials.set(source,mat);
      if(mat.emissive){
        mat.userData.originalEmissive=mat.emissive.clone();
        mat.userData.originalIntensity=mat.emissiveIntensity;
        if(actor?.mats instanceof Set)actor.mats.add(mat);
        else if(actor?.mats)actor.mats.push(mat);
      }
      return mat;
    };
    node.material=Array.isArray(node.material)?node.material.map(cloneMaterial):cloneMaterial(node.material);
  });
  root.add(model);parent.add(root);return root;
}

export function detailEnvironment(stage,id,entry){
  if(!stage.detailLibrary||!entry?.root||entry.root.userData.blenderDetails)return;
  const group=new THREE.Group();group.name=`Blender scenery / ${id}`;entry.root.add(group);
  for(const [name,position,scale,rotation] of ENVIRONMENT_DETAIL_PLANS[id]||[])instance(stage,name,group,position,scale,rotation);
  // The detailed arch replaces the old stacked hexagonal columns after loading.
  // Fallback geometry remains available if the optional GLB cannot be read.
  if(id==='ruins')entry.root.traverse(node=>{if(node.userData.detailReplacement==='ruins-masonry')node.visible=false;});
  entry.root.userData.blenderDetails=true;
}

export function beginModelStudio(stage){
  const review=stage.modelReview;if(!review||review.studio)return;
  const root=new THREE.Group();root.name='Model review studio';stage.scene.add(root);
  review.studio={root,background:stage.scene.background,fog:stage.scene.fog,environmentVisible:stage.environment.visible,lights:Object.values(stage.stageLights).map(light=>[light,light.visible])};
  stage.environment.visible=false;if(stage.atmosphere?.root)stage.atmosphere.root.visible=false;
  for(const [light] of review.studio.lights)light.visible=false;
  stage.scene.background=new THREE.Color('#111c25');stage.scene.fog=null;
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.MeshStandardMaterial({color:'#182833',roughness:.77}));
  floor.rotation.x=-Math.PI/2;floor.position.y=.32;floor.receiveShadow=true;root.add(floor);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(.91,1.01,.20,64),new THREE.MeshStandardMaterial({color:'#263d48',metalness:.30,roughness:.53}));
  plinth.position.y=.42;plinth.receiveShadow=true;root.add(plinth);
  root.add(new THREE.HemisphereLight('#d2e0ea','#353b42',2.0));
  for(const [color,intensity,position] of [['#f8e6d2',3.4,[-3,5,5]],['#91c3df',2.2,[4,4,-3]],['#dddde4',1.7,[3,2,5]]]){
    const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);root.add(light);
  }
}

export function endModelStudio(stage){
  const studio=stage.modelReview?.studio;if(!studio)return;
  stage.removeEffect(studio.root);stage.scene.background=studio.background;stage.scene.fog=studio.fog;
  stage.environment.visible=studio.environmentVisible;if(stage.atmosphere?.root)stage.atmosphere.root.visible=true;
  for(const [light,visible] of studio.lights)light.visible=visible;
}

export function detailEnemy(stage,actor){
  if(!stage.detailLibrary||!actor||actor.blenderDetails)return;
  const plan=BOSS_DETAIL_PLANS[actor.modelId]||[];
  for(const [name,pivot,position,scale] of plan){
    const parent=actor[pivot]||actor.bones?.[pivot]||actor.body;
    instance(stage,name,parent,position,scale,0,actor);
  }
  actor.blenderDetails=true;
}

export function loadSceneDetails(stage){
  if(stage.detailPromise)return stage.detailPromise;
  stage.detailPromise=new Promise(resolve=>{
    new GLTFLoader().load(DETAIL_KIT_URL,gltf=>{
      if(stage.disposed){stage.removeEffect(gltf.scene);resolve({status:'disposed'});return;}
      stage.detailLibrary=new Map();
      gltf.scene.traverse(node=>{if(node.userData.grande_module)stage.detailLibrary.set(node.name,node);});
      // Own hidden prototypes with the scene, so one disposal covers templates,
      // cached environments, clones, shared geometry and all private materials.
      gltf.scene.name='Blender detail prototypes';gltf.scene.visible=false;stage.scene.add(gltf.scene);
      for(const [id,entry] of stage.environmentCache)detailEnvironment(stage,id,entry);
      for(const actor of stage.bossCache.values())detailEnemy(stage,actor);
      resolve({status:'ready',modules:stage.detailLibrary.size});
    },undefined,error=>{
      console.warn('场景细节模型载入失败，基础场景仍可使用。',error);
      resolve({status:'fallback'});
    });
  });
  return stage.detailPromise;
}
