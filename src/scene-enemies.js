import * as THREE from 'three';

export function enemyFormation(index,count=3){
  const layouts=count===2?[[-1.9,.48,-1.6],[2.05,.48,-.8]]:[[-.15,.48,-2.25],[-2.65,.48,-.20],[2.65,.48,-.50]];
  return layouts[index]||[0,.48,-1.8];
}

export function syncEnemyVisibility(stage){
  const combat=['playing','victory','defeat'].includes(stage.state?.mode)&&!stage.artPreview&&!stage.modelReview&&!stage.exploration;
  for(const [id,actor] of stage.minionCache||[]){
    const visible=combat&&stage.actors.get(id)===actor&&!actor.pendingSpawn;
    actor.root.visible=actor.markerRoot.visible=visible;
    if(!visible&&actor.shield)actor.shield.visible=false;
  }
  // Cached primary enemies can also survive an earlier encounter. Only the
  // current boss may be part of a title/gallery backdrop; never its predecessor.
  const current=stage.actors.get('boss');
  for(const actor of stage.bossCache?.values()||[]){
    if(actor!==current||stage.modelReview||stage.exploration){
      actor.root.visible=actor.markerRoot.visible=false;
      if(actor.shield)actor.shield.visible=false;
    }
  }
}
function nameplate(actor,name){
  if(typeof document==='undefined')return;
  const canvas=document.createElement('canvas');canvas.width=384;canvas.height=72;
  const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(16,20,26,.88)';ctx.beginPath();ctx.roundRect(5,4,374,60,15);ctx.fill();
  ctx.fillStyle='#ead5b0';ctx.font='500 27px "Microsoft YaHei",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,192,34,360);
  const map=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map,transparent:true,depthTest:false}));
  sprite.position.y=actor.height+.43;sprite.scale.set(1.92,.36,1);sprite.renderOrder=15;actor.root.add(sprite);actor.enemyNameplate=sprite;
}

export function syncSceneEnemies(stage,targets,makeEnemy){
  if(!Array.isArray(targets))targets=[];
  stage.minionCache??=new Map();
  const active=new Set();
  for(const data of targets){
    let actor;
    if(data.id==='boss')actor=stage.actors.get('boss');
    else{
      actor=stage.minionCache.get(data.id);
      if(actor&&actor.modelId!==data.modelId){stage.actors.delete(data.id);stage.removeEffect(actor.root);stage.removeEffect(actor.markerRoot);stage.minionCache.delete(data.id);actor=null;}
      if(!actor){
        actor=makeEnemy(data.modelId);actor.id=data.id;actor.isEnemy=true;actor.enemyRole=data.role;actor.basePosition=new THREE.Vector3(0,.48,-1);
        actor.baseRotation=Math.PI;actor.visualScale=new THREE.Vector3(.80,.80,.80);actor.seed=stage.minionCache.size*1.7;
        stage.scene.add(actor.root);stage.createActorMarker(actor);nameplate(actor,data.name);stage.minionCache.set(data.id,actor);
      }
      stage.actors.set(data.id,actor);actor.root.visible=!data.pendingSpawn;actor.markerRoot.visible=!data.pendingSpawn;
    }
    if(!actor)continue;
    actor.isEnemy=true;actor.defeated=!!data.defeated;actor.pendingSpawn=!!data.pendingSpawn;actor.hp=data.hp;actor.enemySelected=!!data.selected;actor.enemyRole=data.role;
    actor.root.userData.enemyUnitId=data.id;actor.markerRoot.userData.enemyUnitId=data.id;
    actor.enemyNameplate&&(actor.enemyNameplate.visible=!data.defeated&&!data.pendingSpawn);
    active.add(data.id);
  }
  for(const [id,actor] of stage.minionCache){
    if(!active.has(id)){actor.root.visible=actor.markerRoot.visible=false;stage.actors.delete(id);}
  }
  const forthcoming=targets.filter(t=>!t.defeated);
  for(const [index,data] of forthcoming.entries())if(data.pendingSpawn){
    const actor=stage.actors.get(data.id);actor.basePosition.set(...enemyFormation(index,forthcoming.length));
    actor.root.position.copy(actor.basePosition);actor.markerRoot.position.copy(actor.basePosition);
  }
  const alive=targets.filter(t=>!t.defeated&&!t.pendingSpawn),key=alive.map(t=>t.id).join('|');
  if(alive.length>1&&stage.enemyFormationKey!==key){
    stage.enemyFormationKey=key;
    for(const [index,data] of alive.entries()){
      const actor=stage.actors.get(data.id);actor.basePosition.set(...enemyFormation(index,alive.length));
      actor.root.position.copy(actor.basePosition);actor.markerRoot.position.copy(actor.basePosition);
      const lead=stage.actors.get(stage.activePartyIds[0]);actor.baseRotation=lead?Math.atan2(lead.basePosition.x-actor.basePosition.x,lead.basePosition.z-actor.basePosition.z):Math.PI;
      actor.root.rotation.y=actor.baseRotation;
    }
  }
  if(!targets.length)stage.enemyFormationKey='';
}

export function pickedEnemy(stage,event){
  if(!stage.renderer?.domElement)return null;
  const rect=stage.renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(pointer,stage.camera);
  const roots=[...stage.actors.values()].filter(a=>a.isEnemy&&!a.defeated&&!a.pendingSpawn&&a.root.visible).map(a=>a.root);
  for(const hit of ray.intersectObjects(roots,true)){
    let node=hit.object;while(node){if(node.userData.enemyUnitId)return node.userData.enemyUnitId;node=node.parent;}
  }
  return null;
}
