import * as THREE from 'three';

const TAU=Math.PI*2;
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const vertex=`varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const ribbonFragment=`
uniform vec3 uColor; uniform float uHead; uniform float uTrail; uniform float uOpacity;
varying vec2 vUv;
void main(){
 float across=abs(vUv.y*2.-1.);
 float edge=pow(max(0.,1.-across),1.7);
 float gate=smoothstep(uHead-uTrail-.08,uHead-uTrail+.015,vUv.x)*(1.-smoothstep(uHead,uHead+.035,vUv.x));
 float taper=pow(max(.001,sin(vUv.x*3.14159)),.25);
 float core=pow(max(0.,1.-across*4.),2.);
 vec3 tint=mix(uColor,vec3(1.,.98,.90),core*.42);
 gl_FragColor=vec4(tint,edge*gate*taper*uOpacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

function ribbonMaterial(color,trail=.42){
 const tint=new THREE.Color(color),hsl={};tint.getHSL(hsl);tint.setHSL(hsl.h,Math.max(.48,hsl.s),Math.min(.53,hsl.l));
 return new THREE.ShaderMaterial({uniforms:{uColor:{value:tint},uHead:{value:0},uTrail:{value:trail},uOpacity:{value:1}},vertexShader:vertex,fragmentShader:ribbonFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
}

/** One continuous strip, with tapered luminous edges, instead of separate rods. */
export function ribbonGeometry(points,width,front=V(0,0,1)){
 const positions=[],uv=[],indices=[],last=points.length-1;
 for(let i=0;i<=last;i++){
  const tangent=points[Math.min(last,i+1)].clone().sub(points[Math.max(0,i-1)]).normalize();
  const side=tangent.clone().cross(front).normalize();if(side.lengthSq()<.001)side.set(0,1,0);
  const thickness=width*(.25+.75*Math.sin(i/last*Math.PI));
  for(const sign of [-1,1]){const p=points[i].clone().addScaledVector(side,sign*thickness);positions.push(p.x,p.y,p.z);uv.push(i/last,(sign+1)/2);}
  if(i<last){const n=i*2;indices.push(n,n+1,n+2,n+1,n+3,n+2);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeBoundingSphere();return g;
}

export function spellProjectile(stage,from,to,color,{delay=0,duration=.22,width=.06,theme='arcane',index=0}={}){
 const reduced=!!stage.reducedMotion,group=new THREE.Group(),materials=[];
 const axis=to.clone().sub(from),front=V(0,0,1).applyQuaternion(stage.camera.quaternion),side=axis.clone().cross(front).normalize();
 const curved=['mind','clockwork','spore','water'].includes(theme),braided=['mind','silverfire','lightning'].includes(theme);
 const count=reduced||theme==='ballistic'?1:braided?2:2,segments=32;
 for(let lane=0;lane<count;lane++){
  const points=[];
  for(let i=0;i<=segments;i++){
   const t=i/segments,p=from.clone().lerp(to,t),envelope=Math.sin(t*Math.PI);
   if(curved)p.y+=envelope*(theme==='mind'?.5:.35);
   if(lane>0){const angle=t*TAU*(theme==='lightning'?3:1)+index+lane*Math.PI;p.addScaledVector(side,Math.sin(angle)*envelope*(theme==='mind'?.075:.12));p.y+=Math.cos(angle)*envelope*.08;}
   points.push(p);
  }
  const mat=ribbonMaterial(color,theme==='ballistic'?.22:.48);
  const strip=new THREE.Mesh(ribbonGeometry(points,width*(lane===0?.42:1.1),front),mat);strip.frustumCulled=false;
  group.add(strip);materials.push(mat);
 }
 group.name=`spell-projectile-${theme}`;
 group.userData.fxLayer='trajectory';
 const head=new THREE.Mesh(new THREE.SphereGeometry(Math.max(.035,width*.85),6,4),new THREE.MeshBasicMaterial({color:'#fffbef',transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));group.add(head);
 const afterglow=reduced?.06:theme==='mind'?.24:.14;
 stage.addEffect(group,duration+afterglow,(t,age)=>{
  const flight=Math.min(1,age/duration),fade=Math.max(0,1-Math.max(0,age-duration)/afterglow);
  for(const mat of materials){mat.uniforms.uHead.value=flight*1.08;mat.uniforms.uOpacity.value=(reduced?.55:.88)*fade;}
  head.position.copy(from).lerp(to,flight);if(curved)head.position.y+=Math.sin(flight*Math.PI)*(theme==='mind'?.5:.35);
  head.material.opacity=age<duration?.9:fade*.32;head.scale.setScalar(1+Math.sin(flight*Math.PI)*.5);
 },delay);
 return group;
}

export function bladeRibbon(stage,position,color,{delay=0,scale=1.5,index=0}={}){
 const group=new THREE.Group();group.name='blade-ribbon';group.position.copy(position);group.quaternion.copy(stage.camera.quaternion);group.rotateZ(index%2?.72:-.62);
 group.userData.fxLayer='trajectory';
 const materials=[],reduced=!!stage.reducedMotion;
 for(let lane=0;lane<(reduced?1:3);lane++){
  const points=[],radius=.88+lane*.09;
  for(let i=0;i<=40;i++){const t=i/40,a=-.8+t*Math.PI*1.48,r=radius*(.8+t*.22);points.push(V(Math.cos(a)*r,Math.sin(a)*r,.01*lane));}
  const mat=ribbonMaterial(lane===0?'#eafffa':color,.64);materials.push(mat);
  group.add(new THREE.Mesh(ribbonGeometry(points,lane===1?.105:.025),mat));
 }
 stage.addEffect(group,.52,t=>{group.scale.setScalar(scale*(reduced?.75:.88+Math.min(t,.65)*.14));for(const mat of materials){mat.uniforms.uHead.value=Math.min(1.02,t*2.1);mat.uniforms.uOpacity.value=(1-t)**.8;}},delay);
 return group;
}

const sigilFragment=`
uniform vec3 uColor; uniform float uTime; uniform float uOpacity; uniform float uStyle;
varying vec2 vUv;
float band(float x,float center,float width){return 1.-smoothstep(width*.35,width,abs(x-center));}
void main(){
 vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float turn=uTime*.4;
 float outer=band(r,.88,.012)*( .3+.7*step(.16,abs(sin(a*9.+turn))));
 float inner=band(r,.65,.009)+band(r,.70,.008);
 float ticks=band(r,.78,.055)*pow(abs(cos(a*12.-turn)),48.);
 float petals=band(r,.41+.12*cos(a*(uStyle>1.5?4.:6.)+turn),.012);
 float spokes=(1.-smoothstep(.15,.7,r))*pow(abs(cos(a*(uStyle>.5?4.:3.)-turn)),55.);
 float center=band(r,.18,.014);
 float alpha=min(1.,outer+inner*.65+ticks+petals*.85+spokes*.55+center)*uOpacity;
 gl_FragColor=vec4(mix(uColor,vec3(1.),ticks*.35),alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function castSigil(stage,position,color,{delay=0,duration=.8,radius=1.3,theme='arcane'}={}){
 const mat=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uTime:{value:0},uOpacity:{value:0},uStyle:{value:theme==='clockwork'?2:theme==='mind'?1:0}},vertexShader:vertex,fragmentShader:sigilFragment,transparent:true,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(radius*2.3,radius*2.3),mat);plane.name=`cast-sigil-${theme}`;plane.position.copy(position);plane.position.y=.55;plane.rotation.x=-Math.PI/2;
 plane.userData.fxLayer='cast';
 stage.addEffect(plane,duration,t=>{const opening=Math.min(1,t*7);plane.scale.setScalar(.85+opening*.15);mat.uniforms.uTime.value=stage.reducedMotion?0:t;mat.uniforms.uOpacity.value=opening*(1-Math.max(0,(t-.55)/.45))*(stage.reducedMotion?.45:.8);},delay);
 return plane;
}

const impactFragment=`
uniform vec3 uColor;uniform float uTime;uniform float uOpacity;uniform float uSpokes;uniform float uBlade;varying vec2 vUv;
void main(){
 vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x);float radius=.12+uTime*.76;
 float rim=exp(-pow((r-radius)/(.035+.04*uTime),2.));
 float inner=exp(-pow((r-radius*.72)/.018,2.))*.4;
 float rays=pow(abs(cos(a*uSpokes)),24.)*exp(-r*4.)*(1.-uTime);
 float core=exp(-r*r*75.)*max(0.,1.-uTime*3.);
 float cut=exp(-p.y*p.y/(.0015+uTime*.003))*exp(-abs(p.x)*1.8);
 float shape=mix(rim+inner+rays+core,cut+core*.6,uBlade);
 gl_FragColor=vec4(mix(uColor,vec3(1.,.96,.84),core),min(1.,shape)*uOpacity);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
export function impactLens(stage,beat,position,color){
 const mat=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uTime:{value:0},uOpacity:{value:.85},uSpokes:{value:beat.theme==='ballistic'?5:beat.theme==='clockwork'?8:3},uBlade:{value:['blade','surgery'].includes(beat.theme)?1:0}},vertexShader:vertex,fragmentShader:impactFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);plane.name=`impact-lens-${beat.theme}`;plane.position.copy(position);plane.quaternion.copy(stage.camera.quaternion);plane.rotateZ(beat.index*.67);
 plane.userData.fxLayer='impact';
 const size=(stage.reducedMotion?.6:1)*(beat.theme==='ballistic'?.8:1.05)*Math.min(1.4,beat.strength||1);
 plane.scale.setScalar(size);
 stage.addEffect(plane,beat.theme==='mind'?.48:.36,t=>{mat.uniforms.uTime.value=t;mat.uniforms.uOpacity.value=(1-t)**1.4*(stage.reducedMotion?.45:.85);});
 return plane;
}

const barrierVertex=`varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=-p.xyz;gl_Position=projectionMatrix*p;}`;
const barrierFragment=`uniform vec3 uColor;uniform float uTime;uniform float uOpacity;varying vec2 vUv;varying vec3 vNormal;varying vec3 vView;
void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),2.6);vec2 grid=vUv*vec2(24.,12.);grid.x+=step(1.,mod(floor(grid.y),2.))*.5;vec2 cell=abs(fract(grid)-.5);float lines=smoothstep(.40,.48,max(cell.x,cell.y));float scan=exp(-pow((vUv.y-fract(uTime*1.3))/.045,2.));float alpha=(rim*.55+lines*.12+scan*.15)*uOpacity;gl_FragColor=vec4(uColor,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;
export function shieldLattice(stage,position,color,{delay=0,radius=.9}={}){
 const mat=new THREE.ShaderMaterial({uniforms:{uColor:{value:new THREE.Color(color)},uTime:{value:0},uOpacity:{value:0}},vertexShader:barrierVertex,fragmentShader:barrierFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,toneMapped:false});
 const dome=new THREE.Mesh(new THREE.SphereGeometry(radius,20,12),mat);dome.name='shield-lattice';dome.position.copy(position);dome.position.y+=.9;dome.scale.y=1.35;
 dome.userData.fxLayer='cast';
 stage.addEffect(dome,.76,t=>{mat.uniforms.uTime.value=stage.reducedMotion?.4:t;mat.uniforms.uOpacity.value=Math.min(1,t*8)*(1-Math.max(0,(t-.4)/.6))*(stage.reducedMotion?.4:.85);},delay);
 return dome;
}
