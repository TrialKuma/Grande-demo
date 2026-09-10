import * as THREE from 'three';
import {IMPACT_COLORS} from './scene-feedback.js';
import {impactLens} from './scene-spellfx.js';

const TAU=Math.PI*2;
const SURFACE={metal:'#e5d6aa',stone:'#a2a1b4',crystal:'#dcbdff',organic:'#adc9b9',paper:'#e5d7b9',cloth:'#c8acc7'};
export function contactEffect(stage,beat,position,direction){
  const reduced=stage.reducedMotion,color=IMPACT_COLORS[beat.theme]||'#d7b9ff';
  if(beat.absorbed>0){
    const ripple=new THREE.Group();ripple.position.copy(position);ripple.quaternion.copy(stage.camera.quaternion);
    ripple.userData.fxLayer='impact';
    const material=new THREE.MeshBasicMaterial({color:'#91e7ff',transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    for(let i=0;i<2;i++){const ring=new THREE.Mesh(new THREE.RingGeometry(.43+i*.2,.455+i*.2,32),material);ripple.add(ring);}
    stage.addEffect(ripple,.38,t=>{ripple.scale.setScalar(.55+t*(reduced?.4:1.25));material.opacity=(1-t)*.8;});
  }
  // Core registrations and zero-damage contacts stay readable but never use a
  // body flash or flying pieces which would imply an injury.
  if(!beat.reaction){stage.flashAt(position,beat.absorbed?'#bcf2ff':color,reduced?.5:.8);return;}
  stage.flashAt(position,'#fff3d5',reduced?.65:1.05+beat.strength*.30);
  impactLens(stage,beat,position,color);
  const group=new THREE.Group();group.position.copy(position);group.quaternion.copy(stage.camera.quaternion);
  group.userData.fxLayer='impact';
  const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.96,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const blade=['blade','surgery'].includes(beat.theme),rings=['arcane','mind','clockwork','edict','crystal'].includes(beat.theme);
  if(blade){
    const streak=new THREE.Mesh(new THREE.PlaneGeometry(beat.theme==='surgery'?1.35:2.25,.045),material);streak.rotation.z=(beat.index%2?-.7:.7);group.add(streak);
    const thin=streak.clone();thin.scale.set(.73,.4,1);thin.position.y=.11;group.add(thin);
  }else if(rings&&['clockwork','edict'].includes(beat.theme)){
    const ring=new THREE.Mesh(new THREE.RingGeometry(.42,.47,beat.theme==='edict'?6:40),material);group.add(ring);
    if(beat.theme==='clockwork'||beat.theme==='edict')for(let i=0;i<8;i++){const angle=i/8*TAU;const tick=new THREE.Mesh(new THREE.PlaneGeometry(.04,.16),material);tick.position.set(Math.sin(angle)*.56,Math.cos(angle)*.56,0);tick.rotation.z=-angle;group.add(tick);}
  }else if(!rings&&!reduced){
    const rays=beat.theme==='ballistic'?5:8;
    for(let i=0;i<rays;i++){const angle=i/rays*TAU+beat.index*.41;const streak=new THREE.Mesh(new THREE.PlaneGeometry(.035,.35+(i%2)*.2),material);streak.position.set(Math.sin(angle)*.24,Math.cos(angle)*.24,0);streak.rotation.z=-angle;group.add(streak);}
  }
  if(group.children.length)stage.addEffect(group,.24,t=>{group.scale.setScalar((reduced?.65:1)*(1+t*.52));material.opacity=(1-t)**1.5;});
  else material.dispose();
  const count=reduced?2:beat.id==='boss'?6:4;
  const chips=new THREE.Group();chips.position.copy(position);
  chips.userData.fxLayer='debris';
  const hard=['stone','metal','crystal'].includes(beat.material);
  const geometry=hard?new THREE.TetrahedronGeometry(beat.material==='stone'?.058:.038):new THREE.PlaneGeometry(.055,.10);
  const fragmentMaterial=new THREE.MeshBasicMaterial({color:SURFACE[beat.material],transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,blending:hard?THREE.AdditiveBlending:THREE.NormalBlending});
  const fragments=[];
  for(let i=0;i<count;i++){
    const mesh=new THREE.Mesh(geometry,fragmentMaterial);chips.add(mesh);
    if(beat.material==='metal')mesh.scale.set(.4,2.6,.4);
    const angle=i/count*TAU+beat.index*.9,velocity=new THREE.Vector3(Math.cos(angle),.35+(i%4)*.25,Math.sin(angle)).multiplyScalar((hard?2.5:1.1)*(reduced?.25:1)).addScaledVector(direction,.75);
    fragments.push({mesh,velocity,scale:mesh.scale.clone()});
  }
  stage.addEffect(chips,.46,(t,age)=>{fragmentMaterial.opacity=(1-t)*.85;for(const fragment of fragments){fragment.mesh.position.copy(fragment.velocity).multiplyScalar(age);fragment.mesh.position.y-=age*age*(hard?3.4:.7);fragment.mesh.rotation.set(age*7,age*5,age*9);fragment.mesh.scale.copy(fragment.scale).multiplyScalar(1-t*.7);}});
}
