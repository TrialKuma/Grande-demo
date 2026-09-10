import {SKILL_SLOTS} from './combat.js';
// Delegated listeners survive the camp view being redrawn after a swap.
export function createSkillDragController({enabled, onDrop, onStart=()=>{}}, root=document) {
  let source=null, pointer=null, ignoreClickUntil=0;
  const clear=()=>{root.querySelectorAll('.skill-dragging,.skill-drop-target').forEach(el=>el.classList.remove('skill-dragging','skill-drop-target'));source=null;pointer=null;};
  const slotAt=(x,y)=>root.elementFromPoint(x,y)?.closest('[data-drag-slot]');
  const validSlot=slot=>source&&enabled()&&slot&&slot.dataset.dragOwner===source.owner&&Number.isInteger(Number(slot.dataset.dragSlot))&&Number(slot.dataset.dragSlot)>=0&&Number(slot.dataset.dragSlot)<SKILL_SLOTS;
  const highlight=slot=>{root.querySelectorAll('.skill-drop-target').forEach(el=>el.classList.remove('skill-drop-target'));if(validSlot(slot))slot.classList.add('skill-drop-target');};
  // Pointer dragging works in embedded browsers as well as ordinary desktop tabs.
  root.addEventListener('pointerdown',event=>{
    const element=event.target.closest('[draggable="true"][data-drag-skill]');
    if(event.button!==0||!element||!enabled()||element.disabled||element.getAttribute('aria-disabled')==='true')return;
    event.preventDefault();
    pointer={id:event.pointerId,x:event.clientX,y:event.clientY,element};
    element.setPointerCapture?.(event.pointerId);
  });
  root.addEventListener('pointermove',event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    if(!source&&Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>=8){
      source={owner:pointer.element.dataset.dragOwner,skill:pointer.element.dataset.dragSkill};
      onStart();pointer.element.classList.add('skill-dragging');
    }
    if(source){event.preventDefault();highlight(slotAt(event.clientX,event.clientY));}
  });
  root.addEventListener('pointerup',event=>{
    if(!pointer||pointer.id!==event.pointerId)return;
    const item=source,slot=slotAt(event.clientX,event.clientY),accepted=validSlot(slot),element=pointer.element;
    if(element.hasPointerCapture?.(event.pointerId))element.releasePointerCapture(event.pointerId);
    clear();
    if(item){event.preventDefault();ignoreClickUntil=Date.now()+250;if(accepted)onDrop({...item,slot:Number(slot.dataset.dragSlot)});}
  });
  root.addEventListener('pointercancel',clear);
  root.defaultView?.addEventListener('blur',clear);
  root.addEventListener('dragstart',event=>{
    if(pointer){event.preventDefault();return;}
    const element=event.target.closest('[draggable="true"][data-drag-skill]');
    if(!element||!enabled()||element.disabled||element.getAttribute('aria-disabled')==='true'){event.preventDefault();return;}
    source={owner:element.dataset.dragOwner,skill:element.dataset.dragSkill};
    if(!source.owner||!source.skill){event.preventDefault();clear();return;}
    onStart();element.classList.add('skill-dragging');
    event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',JSON.stringify(source));
  });
  root.addEventListener('dragover',event=>{
    const slot=event.target.closest('[data-drag-slot]');
    if(!validSlot(slot))return;
    event.preventDefault();event.dataTransfer.dropEffect='move';
    root.querySelectorAll('.skill-drop-target').forEach(el=>{if(el!==slot)el.classList.remove('skill-drop-target');});
    slot.classList.add('skill-drop-target');
  });
  root.addEventListener('drop',event=>{
    const slot=event.target.closest('[data-drag-slot]'),item=source;
    if(!item||!enabled()||!slot||slot.dataset.dragOwner!==item.owner){clear();return;}
    event.preventDefault();const index=Number(slot.dataset.dragSlot);clear();ignoreClickUntil=Date.now()+250;
    if(Number.isInteger(index)&&index>=0&&index<SKILL_SLOTS)onDrop({...item,slot:index});
  });
  root.addEventListener('dragend',()=>{ignoreClickUntil=Date.now()+250;clear();});
  root.addEventListener('click',event=>{if(Date.now()<ignoreClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
  return {clear};
}
