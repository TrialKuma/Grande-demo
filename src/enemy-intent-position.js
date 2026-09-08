import {Vector3} from 'three';

const point=new Vector3();
// DOM labels stay crisp and face the camera while their anchors follow actors.
export function positionEnemyIntents(stage){
  const layer=document.querySelector('#enemy-intents');
  if(!layer)return;
  const canvas=stage.renderer.domElement.getBoundingClientRect(),bounds=layer.getBoundingClientRect();
  const hud=document.querySelector('.foe-hud')?.getBoundingClientRect();
  const board=document.querySelector('.team-board')?.getBoundingClientRect();
  const placed=[];
  const labels=[...layer.querySelectorAll('[data-enemy-intent]')].map(element=>{
    const actor=stage.actors.get(element.dataset.enemyIntent);
    const x=actor?actor.root.getWorldPosition(point).project(stage.camera).x:0;
    return {element,x};
  }).sort((a,b)=>a.x-b.x);
  for(const {element} of labels){
    const actor=stage.actors.get(element.dataset.enemyIntent);
    const visible=actor?.root.visible&&!actor.pendingSpawn&&!actor.defeated;
    element.hidden=!visible;if(!visible)continue;
    actor.root.updateWorldMatrix(true,false);
    actor.root.localToWorld(point.set(0,actor.height+.3,0)).project(stage.camera);
    if(point.z < -1 || point.z > 1){element.hidden=true;continue;}
    const w=element.offsetWidth||136,h=element.offsetHeight||62;
    const anchorX=canvas.left+(point.x+1)*canvas.width/2,anchorY=canvas.top+(1-point.y)*canvas.height/2;
    let x=anchorX-w/2,y=anchorY-h-10;
    x=Math.max(canvas.left+8,Math.min(canvas.right-w-8,x));
    const top=hud&&x<hud.right&&x+w>hud.left?hud.bottom+8:canvas.top+12;
    const bottom=(board?.top??canvas.bottom)-h-12;
    if(y<top){x=Math.min(canvas.right-w-8,anchorX+30);}
    y=Math.max(Math.min(top,bottom),Math.min(bottom,y));
    const candidates=[x,anchorX-w-24,anchorX+24,...placed.flatMap(p=>[p.x-w-10,p.x+w+10])]
      .filter(value=>value>=canvas.left+8&&value+w<=canvas.right-8)
      .sort((a,b)=>Math.abs(a+w/2-anchorX)-Math.abs(b+w/2-anchorX));
    const nearest=candidates.find(value=>!placed.some(p=>Math.abs(value-p.x)<w+8&&Math.abs(y-p.y)<h+6));
    if(nearest!==undefined)x=nearest;
    else y=Math.max(canvas.top+10,y-h-8);
    placed.push({x,y});
    element.style.transform=`translate(${Math.round(x-bounds.left)}px,${Math.round(y-bounds.top)}px)`;
    element.classList.add('is-positioned');
    let leader=element.querySelector('.intent-leader');
    if(!leader){leader=document.createElement('i');leader.className='intent-leader';element.append(leader);}
    const startX=Math.max(x,Math.min(x+w,anchorX)),startY=Math.max(y,Math.min(y+h,anchorY));
    const dx=anchorX-startX,dy=anchorY-startY,length=Math.hypot(dx,dy);
    leader.style.left=`${startX-x}px`;leader.style.top=`${startY-y}px`;
    leader.style.width=`${Math.max(0,length-4)}px`;
    leader.style.transform=`rotate(${Math.atan2(dy,dx)}rad)`;
    leader.hidden=length<16;
    element.classList.toggle('has-leader',!leader.hidden);
  }
}
