import * as THREE from 'three';

const TAU=Math.PI*2;
const vertex='varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const fragment=`varying vec2 vUv;uniform vec3 uColor;uniform float uTime;uniform float uNegative;
void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x);
float rim=exp(-pow((r-.83)/.012,2.));float inner=exp(-pow((r-.68)/.008,2.));
float marks=exp(-pow((r-.75)/.055,2.))*pow(abs(cos(a*8.)),30.);
float breath=.84+.16*sin(uTime*.9);float veil=pow(max(0.,1.-r),1.5)*(.035+.085*uNegative);
float weave=exp(-pow((r-(.40+.035*sin(a*6.+uTime*.22)))/.015,2.));
float alpha=(rim*(.48+.24*uNegative)+inner*.26+marks*.40+weave*.15+veil)*breath;
vec3 tint=mix(uColor,vec3(.048,.014,.092),uNegative*min(1.,veil*12.));
gl_FragColor=vec4(tint,alpha);#include <tonemapping_fragment>
#include <colorspace_fragment>}`.replace(';#include',';\n#include');

export function heroStatusFxProfile(hero={}){
 if(!(hero.hp>0))return [];
 const result=[];
 if(hero.id==='ric'){
  if(hero.resource>0)result.push({id:'ric-positive',color:'#f2f4ff',radius:1.8});
  if(hero.resource<0)result.push({id:'ric-negative',color:'#964edd',radius:5.2});
  if(hero.ricChaos===1)result.push({id:'ric-chaos',color:'#d4b1ff'});
 }
 if(hero.id==='knibbs'&&hero.intuition>=3)result.push({id:'loaded',color:'#ffd288'});
 if(hero.id==='youmu'){
  if(hero.youmuForm==='captain')result.push({id:'captain',color:'#f0c887',radius:1.2});
  else if(hero.surgicalReady)result.push({id:'surgery',color:'#b8ffe5'});
 }
 if(['haart','qianxing','patch'].includes(hero.id)&&hero.maxSecondary>0&&hero.secondary>=hero.maxSecondary)result.push({id:'mana-full',color:hero.id==='haart'?'#c9b7ff':hero.id==='patch'?'#edcf8b':'#b1f0ff'});
 if(hero.id==='apeilia'&&hero.resource>=6)result.push({id:'combo-ready',color:'#ffe096'});
 return result;
}

const mat=(color,opacity=.8)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
function band(parent,radius,color,start=0,length=TAU,width=.014){
 const node=new THREE.Mesh(new THREE.RingGeometry(radius-width,radius+width,48,1,start,length),mat(color));parent.add(node);return node;
}
function createStatus(profile,heroId){
 const root=new THREE.Group();root.name=`status-${profile.id}`;root.userData.fxLayer='status';
 if(['ric-positive','ric-negative'].includes(profile.id)){
  const material=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(profile.color)},uTime:{value:0},uNegative:{value:profile.id==='ric-negative'?1:0}},vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
  const plane=new THREE.Mesh(new THREE.PlaneGeometry(profile.radius*2.4,profile.radius*2.4),material);plane.rotation.x=-Math.PI/2;plane.position.y=.035;root.add(plane);root.userData.field=plane;
  if(profile.id==='ric-negative')material.blending=THREE.NormalBlending;
 }else if(profile.id==='ric-negative-target'){
  const glyph=new THREE.Group();glyph.position.y=.045;glyph.rotation.x=-Math.PI/2;root.add(glyph);
  const outline=band(glyph,.61,'#a864ed',0,TAU,.021);outline.material.blending=THREE.NormalBlending;outline.material.opacity=.85;
  for(let i=0;i<3;i++){const marker=new THREE.Mesh(new THREE.RingGeometry(.73,.79,3,1,i*TAU/3+.15,.52),mat('#a25ce0',.8));marker.material.blending=THREE.NormalBlending;glyph.add(marker);}
 }else if(profile.id==='ric-chaos'){
  for(let i=0;i<2;i++){const arc=band(root,.67,i?'#c185ff':'#f5f3ff',i*Math.PI,Math.PI*1.22,.022);arc.rotation.set(Math.PI/2-.30,i*.65,.4);arc.position.y=.95;}
  const center=new THREE.Mesh(new THREE.OctahedronGeometry(.075),mat('#ede6ff'));center.position.set(0,1.6,-.40);root.add(center);
 }else if(profile.id==='captain'){
  const compass=new THREE.Group();compass.position.y=.045;compass.rotation.x=-Math.PI/2;root.add(compass);
  band(compass,1.02,profile.color,0,TAU,.012);band(compass,.84,'#7cb8c4',0,TAU,.008);
  for(let i=0;i<4;i++){const tick=new THREE.Mesh(new THREE.PlaneGeometry(.045,.27),mat(profile.color));tick.position.set(Math.sin(i*TAU/4)*.95,Math.cos(i*TAU/4)*.95,0);tick.rotation.z=-i*TAU/4;compass.add(tick);}
 }else if(profile.id==='loaded'){
  for(let i=0;i<3;i++){const cartridge=new THREE.Mesh(new THREE.CapsuleGeometry(.021,.10,2,5),mat(profile.color));cartridge.position.set((i-1)*.10,.055,0);cartridge.rotation.z=-.25;root.add(cartridge);}
  root.userData.weapon=true;
 }else if(profile.id==='surgery'){
  const edge=new THREE.Mesh(new THREE.PlaneGeometry(.035,.56),mat(profile.color));edge.rotation.z=-.55;root.add(edge);
  for(const sign of [-1,1]){const tick=new THREE.Mesh(new THREE.PlaneGeometry(.13,.013),mat('#f1fff8'));tick.position.set(sign*.18,sign*.22,0);root.add(tick);}
  root.userData.weapon=true;
 }else{
  const n=profile.id==='combo-ready'?2:heroId==='haart'?5:heroId==='patch'?8:3;
  for(let i=0;i<n;i++){const angle=(i/n)*TAU,node=new THREE.Mesh(new THREE.PlaneGeometry(heroId==='haart'?.11:.035,heroId==='haart'?.16:.15),mat(profile.color,.7));node.position.set(Math.sin(angle)*.52,1.38+Math.cos(angle)*.35,-.36);node.rotation.z=-angle;root.add(node);}
 }
 root.userData.kind=profile.id;return root;
}

export class SceneStatusFX{
 constructor(stage){this.stage=stage;this.root=new THREE.Group();this.root.name='persistent-character-status';stage.scene.add(this.root);this.entries=new Map();this.enabled=true;}
 sync(state={}){
  const active=new Set();
  for(const hero of state.heroes||[])for(const profile of heroStatusFxProfile(hero)){
   const key=`${hero.id}:${profile.id}`;active.add(key);
   if(!this.entries.has(key)){const object=createStatus(profile,hero.id);this.root.add(object);this.entries.set(key,{id:hero.id,object});}
  }
  const ric=state.heroes?.find(hero=>hero.id==='ric');
  if(ric?.hp>0&&ric.resource<0)for(const enemy of state.enemies||[state.boss])if(enemy?.hp>0&&!enemy.defeated){
   const id=enemy.unitId||'boss',key=`${id}:ric-negative-target`;active.add(key);
   if(!this.entries.has(key)){const object=createStatus({id:'ric-negative-target',color:'#964edd'});this.root.add(object);this.entries.set(key,{id,object});}
  }
  for(const [key,entry]of this.entries)entry.active=entry.object.visible=active.has(key);
 }
 update(time=0){
  const stage=this.stage,combat=!stage.state?.mode||['playing','victory','defeat'].includes(stage.state.mode);this.root.visible=this.enabled&&combat&&!stage.modelReview&&!stage.artPreview&&!stage.exploration;
  for(const entry of this.entries.values()){
   const actor=stage.actors.get(entry.id),object=entry.object;
   object.visible=!!(entry.active&&actor?.root.visible);
   if(!object.visible)continue;
   object.position.copy(actor.root.position);object.rotation.set(0,0,0);
   if(object.userData.kind==='ric-negative')object.position.set(0,actor.basePosition?.y??actor.root.position.y,0);
   const t=stage.reducedMotion?0:time;
   if(object.userData.field)object.userData.field.material.uniforms.uTime.value=t;
   else if(object.userData.weapon){
    actor.bones?.weapon?.getWorldPosition(object.position);object.position.y+=.12;
    object.quaternion.copy(stage.camera.quaternion);
   }else if(object.userData.kind==='ric-chaos')object.rotation.y=t*.3;
   else if(object.userData.kind!=='captain')object.rotation.y=actor.root.rotation.y;
  }
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.stage.removeEffect(this.root);this.entries.clear();}
}

// Deliberately independent of party order and the preannounced attack target.
export const bossIdleFacing=position=>Math.atan2(-position.x,5-position.z)||0;
