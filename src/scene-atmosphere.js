import * as THREE from 'three';
import {atmosphereProfile} from './scene-feedback.js';

// One fixed-size buffer and at most twenty auxiliary meshes. Particles wrap
// through their emitter volume rather than accumulating new objects per frame.
export class SceneAtmosphere {
  constructor(parent,texture,bossId,reducedMotion=false){
    this.profile=atmosphereProfile(bossId,reducedMotion);this.reducedMotion=reducedMotion;
    this.root=new THREE.Group();this.root.name='encounter-atmosphere';parent.add(this.root);this.time=0;this.disposed=false;
    let seed=173+bossId.length*337;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    const p=this.profile,count=p.count;this.positions=new Float32Array(count*3);this.seeds=new Float32Array(count*4);
    const colors=new Float32Array(count*3),a=new THREE.Color(p.color),b=new THREE.Color(p.secondary);
    for(let i=0;i<count;i++){
      const angle=random()*Math.PI*2,radius=4+random()*5;
      this.positions.set([Math.cos(angle)*radius,.5+random()*5.8,Math.sin(angle)*radius],i*3);
      this.seeds.set([random()*Math.PI*2,random(),this.positions[i*3],this.positions[i*3+2]],i*4);
      const c=i%3?a:b;colors.set([c.r,c.g,c.b],i*3);
    }
    this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3));this.geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    // The combat camera is orthographic. PointsMaterial.size is in CSS pixels;
    // Three.js applies the renderer's pixel ratio, so multiplying by DPR here
    // would double-scale the dots on high-density displays.
    this.material=new THREE.PointsMaterial({map:texture,vertexColors:true,size:p.pointSize,sizeAttenuation:false,transparent:true,opacity:.78,depthWrite:false,blending:THREE.AdditiveBlending});
    this.points=new THREE.Points(this.geometry,this.material);this.points.frustumCulled=false;this.root.add(this.points);
    this.pages=[];this.steam=[];
    if(p.pages){
      this.pageGeometry=new THREE.PlaneGeometry(.12,.20);this.pageMaterial=new THREE.MeshStandardMaterial({color:p.color,side:THREE.DoubleSide,transparent:true,opacity:.56,roughness:.9});
      for(let i=0;i<p.pages;i++){const page=new THREE.Mesh(this.pageGeometry,this.pageMaterial);const angle=i/p.pages*Math.PI*2;page.position.set(Math.cos(angle)*5.6,1+i*.36,Math.sin(angle)*5.6);page.rotation.set(i*.43,i*.73,i*.38);this.root.add(page);this.pages.push({object:page,x:page.position.x,y:page.position.y,z:page.position.z,phase:i*.71});}
    }
    for(let i=0;i<p.steam;i++){
      const material=new THREE.SpriteMaterial({map:texture,color:p.kind==='ember'?'#88979e':'#a6d4d6',transparent:true,opacity:.08,depthWrite:false});
      const steam=new THREE.Sprite(material);steam.scale.set(1.3,1.9,1);this.root.add(steam);this.steam.push({object:steam,phase:i/p.steam,x:i%2?5.6:-5.6,z:-4+(i%4)*2.3});
    }
    this.update(0);
  }
  update(dt){
    if(this.disposed)return;this.time+=dt;const p=this.profile,t=this.time,speed=p.speed;
    if(speed>0){
      for(let i=0;i<p.count;i++){
        const n=i*3,s=i*4,phase=this.seeds[s],variation=this.seeds[s+1];
        let y=this.positions[n+1];
        if(p.kind==='water')y-=dt*speed*(1.4+variation*2);
        else if(p.kind==='spark')y+=dt*speed*(.65+variation*2.6);
        else y+=dt*speed*(.35+variation);
        if(y<.5)y=6.2;if(y>6.3)y=.5;this.positions[n+1]=y;
        const wobble=p.kind==='water'?.10:p.kind==='spark'?.17:.48;
        this.positions[n]=this.seeds[s+2]+Math.sin(t*.45+phase+y*.16)*wobble;
        this.positions[n+2]=this.seeds[s+3]+Math.cos(t*.34+phase)*wobble;
      }
      this.geometry.attributes.position.needsUpdate=true;
    }
    for(const page of this.pages){const motion=speed?t:0;page.object.position.set(page.x+Math.sin(motion*.5+page.phase)*.45,page.y+Math.sin(motion*.37+page.phase)*.24,page.z+Math.cos(motion*.4+page.phase)*.25);page.object.rotation.set(Math.sin(motion*.6+page.phase)*.8,page.phase+motion*.25,Math.sin(motion*.4+page.phase)*.5);}
    for(const steam of this.steam){const cycle=((speed?t*.16:0)+steam.phase)%1;steam.object.position.set(steam.x+Math.sin(cycle*3+steam.phase)*.3,.6+cycle*3.6,steam.z);steam.object.scale.set(1+cycle*1.2,1.5+cycle*1.7,1);steam.object.material.opacity=Math.sin(cycle*Math.PI)*.095;}
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;this.root.removeFromParent();this.geometry.dispose();this.material.dispose();this.pageGeometry?.dispose();this.pageMaterial?.dispose();
    for(const steam of this.steam)steam.object.material.dispose();this.root.clear();this.pages.length=0;this.steam.length=0;
  }
}
