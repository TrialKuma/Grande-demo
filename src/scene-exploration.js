import * as THREE from 'three';

const Y=.48,PLAYER_RADIUS=.24,SPEED=2.45,CELL=.30;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const EXPLORATION_WORLDS={gate:'ruins',pump:'floodworks',archive:'sanctum'};
export function explorationBounds(bounds={}){
  return {minX:bounds.minX??bounds.x?.[0]??-4,maxX:bounds.maxX??bounds.x?.[1]??4,
    minZ:bounds.minZ??bounds.z?.[0]??-3.5,maxZ:bounds.maxZ??bounds.z?.[1]??3.5};
}
export function walkablePoint(point,bounds,obstacles=[],radius=PLAYER_RADIUS){
  const [x,z]=point,b=explorationBounds(bounds);
  if(x<b.minX+radius||x>b.maxX-radius||z<b.minZ+radius||z>b.maxZ-radius)return false;
  return !obstacles.some(o=>{
    const ox=o.x??o.position?.[0]??0,oz=o.z??o.position?.[1]??0;
    if(o.width&&o.depth)return Math.abs(x-ox)<o.width/2+radius&&Math.abs(z-oz)<o.depth/2+radius;
    return Math.hypot(x-ox,z-oz)<(o.radius??.35)+radius;
  });
}
export function slideMovement(point,delta,bounds,obstacles=[]){
  const b=explorationBounds(bounds),result=[...point],steps=Math.max(1,Math.ceil(Math.hypot(...delta)/.12));
  for(let i=0;i<steps;i++){
    const x=clamp(result[0]+delta[0]/steps,b.minX+PLAYER_RADIUS,b.maxX-PLAYER_RADIUS);
    if(walkablePoint([x,result[1]],b,obstacles))result[0]=x;
    const z=clamp(result[1]+delta[1]/steps,b.minZ+PLAYER_RADIUS,b.maxZ-PLAYER_RADIUS);
    if(walkablePoint([result[0],z],b,obstacles))result[1]=z;
  }
  return result;
}

// A small navigation grid prevents click-to-walk from crossing a companion or
// machine. There is no physics simulation or path search in the render loop.
export function planWalkingPath(start,target,bounds,obstacles=[]){
  const b=explorationBounds(bounds),nx=Math.ceil((b.maxX-b.minX)/CELL),nz=Math.ceil((b.maxZ-b.minZ)/CELL);
  const pos=(ix,iz)=>[b.minX+(ix+.5)*(b.maxX-b.minX)/nx,b.minZ+(iz+.5)*(b.maxZ-b.minZ)/nz];
  const nearest=p=>{let best=null,dist=Infinity;for(let x=0;x<nx;x++)for(let z=0;z<nz;z++){
    const q=pos(x,z),d=Math.hypot(q[0]-p[0],q[1]-p[1]);if(d<dist&&walkablePoint(q,b,obstacles)){best=[x,z];dist=d;}
  }return best;};
  const a=nearest(start),end=nearest(target);if(!a||!end)return [];
  const key=(x,z)=>x+z*nx,from=key(...a),goal=key(...end),open=new Set([from]),cost=new Map([[from,0]]),prev=new Map();
  while(open.size){
    let current=null,score=Infinity;for(const id of open){const s=cost.get(id)+Math.hypot(id%nx-end[0],Math.floor(id/nx)-end[1]);if(s<score){current=id;score=s;}}
    if(current===goal){
      const route=[];for(let id=current;id!==undefined;id=prev.get(id))route.push(pos(id%nx,Math.floor(id/nx)));
      route.reverse();if(walkablePoint(target,b,obstacles))route.push(target);return route;
    }
    open.delete(current);const x=current%nx,z=Math.floor(current/nx);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const xx=x+dx,zz=z+dz;if(xx<0||xx>=nx||zz<0||zz>=nz||!walkablePoint(pos(xx,zz),b,obstacles))continue;
      if(dx&&dz&&(!walkablePoint(pos(x+dx,z),b,obstacles)||!walkablePoint(pos(x,z+dz),b,obstacles)))continue;
      const next=key(xx,zz),nextCost=cost.get(current)+Math.hypot(dx,dz);
      if(nextCost<(cost.get(next)??Infinity)){cost.set(next,nextCost);prev.set(next,current);open.add(next);}
    }
  }
  return [];
}

function addMesh(root,geo,color,position,metalness=.25){
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,metalness,roughness:.55}));
  mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function circle(root,r,color,y=.02){
  const mesh=new THREE.Mesh(new THREE.RingGeometry(r-.035,r,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=y;root.add(mesh);return mesh;
}
function label(root,text,y=2.45){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
  const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(10,20,28,.88)';ctx.beginPath();ctx.roundRect(8,6,496,78,18);ctx.fill();
  ctx.fillStyle='#eee2c5';ctx.font='500 30px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,45,466);
  const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
  sprite.position.y=y;sprite.scale.set(2.45,.46,1);sprite.renderOrder=18;root.add(sprite);return sprite;
}
function device(root,model){
  if(model==='practice'||model==='training'){
    addMesh(root,new THREE.CylinderGeometry(.34,.45,.16,10),'#625141',[0,.08,0]);
    addMesh(root,new THREE.CylinderGeometry(.075,.10,1.45,9),'#896647',[0,.81,0]);
    addMesh(root,new THREE.BoxGeometry(.95,.12,.14),'#896647',[0,1.15,0]);
    addMesh(root,new THREE.CylinderGeometry(.31,.27,.16,12),'#b4aa8d',[0,1.12,.15]).rotation.x=Math.PI/2;
    addMesh(root,new THREE.TorusGeometry(.19,.027,6,24),'#995646',[0,1.12,.25]);return;
  }
  addMesh(root,new THREE.CylinderGeometry(.40,.50,.20,12),'#586063',[0,.10,0]);
  addMesh(root,new THREE.BoxGeometry(.56,.90,.48),'#283e47',[0,.65,0]);
  if(model==='pump'||model==='valve'){
    const wheel=addMesh(root,new THREE.TorusGeometry(.34,.045,8,28),'#b68043',[0,.98,.30]);
    for(let i=0;i<4;i++){const spoke=addMesh(root,new THREE.BoxGeometry(.025,.64,.035),'#cfab6b',[0,.98,.30]);spoke.rotation.z=i*Math.PI/4;}
    wheel.rotation.z=.25;
  }else{
    const top=addMesh(root,new THREE.BoxGeometry(.65,.08,.48),'#b99658',[0,1.14,.06]);top.rotation.x=.22;
    addMesh(root,new THREE.OctahedronGeometry(.15),'#78d8db',[0,1.47,0]);
  }
}

export class SceneExploration{
  constructor(stage,config,makePerson){
    this.stage=stage;this.makePerson=makePerson;this.id=config.id;this.input={x:0,z:0};this.path=[];this.time=0;this.moving=false;this.paused=false;this.notifyTime=-1;
    this.root=new THREE.Group();this.root.name='Walkable interlude';stage.scene.add(this.root);
    this.saved={environment:stage.environmentId,camera:stage.camera.position.clone(),target:stage.controls.target.clone(),zoom:stage.camera.zoom,
      visible:new Map([...stage.actors.values()].map(a=>[a,{root:a.root.visible,marker:a.markerRoot.visible,shield:a.shield.visible}]))};
    for(const actor of stage.actors.values())actor.root.visible=actor.markerRoot.visible=actor.shield.visible=false;
    stage.switchEnvironment(EXPLORATION_WORLDS[config.layout]||config.environment||'ruins');
    this.hero=makePerson(config.heroId||stage.activePartyIds[0]||'knibbs');this.hero.root.scale.setScalar(1.04);this.root.add(this.hero.root);
    const initial=config.position||config.spawn||[0,2.5];this.hero.root.position.set(initial[0],Y,initial[1]);
    this.hero.root.rotation.y=Math.PI;this.hero.sceneExploration=true;
    if(this.hero.id==='qianxing')stage.loadDetailedHero(this.hero);
    this.marker=circle(this.hero.root,.48,'#e5c784',.014);
    this.items=new Map();this.updateConfig(config);
    if(!walkablePoint(this.position,this.bounds,this.obstacles)){
      const safe=planWalkingPath(this.position,this.position,this.bounds,this.obstacles)[0];if(safe)this.hero.root.position.set(safe[0],Y,safe[1]);
    }
    stage.camera.zoom=1;stage.controls.target.set(0,1.3,0);stage.camera.position.set(9.5,12.5,17);stage.controls.update();
  }
  updateConfig(config){
    this.config=config;this.bounds=explorationBounds(config.bounds);
    this.obstacles=[...(config.obstacles||[])];
    const terrainKey=JSON.stringify([this.bounds,config.obstacles]);
    if(this.terrainKey!==terrainKey){
      if(this.terrain)this.stage.removeEffect(this.terrain);this.terrain=new THREE.Group();this.root.add(this.terrain);this.terrainKey=terrainKey;
      const b=this.bounds,points=[[b.minX,.495,b.minZ],[b.maxX,.495,b.minZ],[b.maxX,.495,b.maxZ],[b.minX,.495,b.maxZ]].map(p=>new THREE.Vector3(...p));
      const edge=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#9ebfc0',transparent:true,opacity:.38}));this.terrain.add(edge);
      for(const obstacle of config.obstacles||[]){
        const x=obstacle.x??obstacle.position?.[0]??0,z=obstacle.z??obstacle.position?.[1]??0;
        const geo=obstacle.width&&obstacle.depth?new THREE.BoxGeometry(obstacle.width,.62,obstacle.depth):new THREE.CylinderGeometry(obstacle.radius||.35,obstacle.radius||.35,.62,8);
        addMesh(this.terrain,geo,'#667573',[x,Y+.31,z]);
      }
    }
    for(const data of (config.objects||[]).slice(0,5)){
      let item=this.items.get(data.id);
      if(!item){
        const root=new THREE.Group();root.position.set(...[data.position[0],Y,data.position[1]]);root.userData.interactionId=data.id;this.root.add(root);
        let actor=null;
        if(data.heroId){actor=this.makePerson(data.heroId);actor.root.scale.setScalar(1.04);root.add(actor.root);actor.root.rotation.y=Math.atan2(-data.position[0],1-data.position[1]);if(actor.id==='qianxing')this.stage.loadDetailedHero(actor);}
        else device(root,data.model||(data.type==='practice'?'practice':config.layout==='pump'?'valve':data.type));
        const indicator=circle(root,data.heroId?.58:.65,'#d9bd82');label(root,data.name||'查看',data.heroId?2.65:1.90);
        item={root,actor,indicator,data};this.items.set(data.id,item);
      }
      item.data={...data,done:!!(data.done||data.completed||config.done?.includes(data.id))};item.root.position.set(data.position[0],Y,data.position[1]);
      item.indicator.material.color.set(item.data.done?'#70b6a1':'#dbbe86');
      this.obstacles.push({x:data.position[0],z:data.position[1],radius:data.heroId?.30:.46});
    }
    for(const [id,item] of this.items)if(!(config.objects||[]).some(data=>data.id===id)){if(item.actor)item.actor.sceneReleased=true;this.stage.removeEffect(item.root);this.items.delete(id);}
    if(!this.exitRoot){this.exitRoot=new THREE.Group();this.exitRing=circle(this.exitRoot,.65,'#8fd1bd');this.exitLabel=label(this.exitRoot,'继续前行',1.55);this.root.add(this.exitRoot);}
    const exit=config.exit||{position:[0,-3.0],radius:.9,open:false};this.exitRoot.position.set(exit.position[0],Y,exit.position[1]);
    this.exitRing.material.color.set(exit.open?'#91ebcc':'#6d7781');this.exitLabel.material.opacity=exit.open?1:.45;
  }
  setInput(input){this.input={x:clamp(Number(input?.x)||0,-1,1),z:clamp(Number(input?.z)||0,-1,1)};if(this.input.x||this.input.z)this.path=[];}
  get position(){return [this.hero.root.position.x,this.hero.root.position.z];}
  moveTo(point){this.path=planWalkingPath(this.position,point,this.bounds,this.obstacles);return this.path.length>0;}
  moveToInteraction(id){
    const item=id==='exit'?this.config.exit:this.items.get(id)?.data;if(!item)return false;
    const target=item.position,r=item.radius??1.15,candidates=[];
    for(let i=0;i<20;i++){const a=i/20*Math.PI*2,q=[target[0]+Math.cos(a)*r*.76,target[1]+Math.sin(a)*r*.76];if(walkablePoint(q,this.bounds,this.obstacles))candidates.push(q);}
    candidates.sort((a,b)=>Math.hypot(a[0]-this.position[0],a[1]-this.position[1])-Math.hypot(b[0]-this.position[0],b[1]-this.position[1]));
    for(const q of candidates)if(this.moveTo(q))return true;return false;
  }
  snapshot(){
    const position=this.position,objects=[...this.items.values()].map(({data})=>({...data,distance:Math.hypot(position[0]-data.position[0],position[1]-data.position[1])}));
    const near=objects.filter(o=>o.distance<=(o.radius??1.15)).sort((a,b)=>a.distance-b.distance)[0],exit=this.config.exit;
    const exitDistance=exit?Math.hypot(position[0]-exit.position[0],position[1]-exit.position[1]):Infinity;
    return {id:this.id,position,nearbyId:near?.id||null,nearExit:!!exit&&exitDistance<=(exit.radius??.9),exitDistance,moving:this.moving,objects:objects.map(({id,distance})=>({id,distance}))};
  }
  notify(force=false){if(force||this.time-this.notifyTime>.10){this.notifyTime=this.time;this.config.onPosition?.(this.snapshot());this.stage.onExplorationPosition?.(this.snapshot());}}
  update(dt){
    this.time+=dt;const before=this.position;let delta=[0,0];
    if(!this.paused&&(this.input.x||this.input.z)){
      const forward=new THREE.Vector3();this.stage.camera.getWorldDirection(forward);forward.y=0;forward.normalize();
      const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0));
      const movement=right.multiplyScalar(this.input.x).addScaledVector(forward,-this.input.z).normalize().multiplyScalar(dt*SPEED);delta=[movement.x,movement.z];
    }else if(!this.paused&&this.path.length){
      let next=this.path[0],distance=Math.hypot(next[0]-before[0],next[1]-before[1]);
      while(distance<.12&&this.path.length){this.path.shift();next=this.path[0];if(!next)break;distance=Math.hypot(next[0]-before[0],next[1]-before[1]);}
      if(next){const step=Math.min(distance,dt*SPEED);delta=[(next[0]-before[0])/distance*step,(next[1]-before[1])/distance*step];}
    }
    const after=slideMovement(before,delta,this.bounds,this.obstacles);this.moving=Math.hypot(after[0]-before[0],after[1]-before[1])>.0001;
    this.hero.root.position.set(after[0],Y,after[1]);
    if(this.moving){const desired=Math.atan2(after[0]-before[0],after[1]-before[1]);const difference=Math.atan2(Math.sin(desired-this.hero.root.rotation.y),Math.cos(desired-this.hero.root.rotation.y));this.hero.root.rotation.y+=difference*Math.min(1,dt*15);}
    const stride=this.moving?Math.sin(this.time*12):0,bones=this.hero.bones;
    this.hero.body.position.y=this.moving?Math.abs(stride)*.035:Math.sin(this.time*1.5)*.015;
    this.hero.body.rotation.x=this.moving?.045:0;
    if(bones){if(bones.leftLeg)bones.leftLeg.rotation.x=stride*.37;if(bones.rightLeg)bones.rightLeg.rotation.x=-stride*.37;
      if(bones.leftArm)bones.leftArm.rotation.x=-stride*.25;if(bones.rightArm)bones.rightArm.rotation.x=stride*.25;}
    const near=this.snapshot().nearbyId;
    for(const [id,item] of this.items){item.indicator.material.opacity=id===near?.85+Math.sin(this.time*4)*.12:.28;if(item.actor)item.actor.body.position.y=Math.sin(this.time*1.6+item.root.position.x)*.018;}
    this.exitRing.material.opacity=this.config.exit?.open?.68+Math.sin(this.time*3)*.2:.22;
    this.notify();
  }
  dispose(){
    this.hero.sceneReleased=true;for(const item of this.items.values())if(item.actor)item.actor.sceneReleased=true;
    this.stage.removeEffect(this.root);this.stage.switchEnvironment(this.saved.environment);
    for(const [actor,v] of this.saved.visible){actor.root.visible=v.root;actor.markerRoot.visible=v.marker;actor.shield.visible=v.shield;}
    this.stage.camera.position.copy(this.saved.camera);this.stage.camera.zoom=this.saved.zoom;this.stage.controls.target.copy(this.saved.target);this.stage.controls.update();this.stage.camera.updateProjectionMatrix();
  }
}
