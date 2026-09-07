/** One shared tooltip for skills, portraits and live status effects. */
export function createTooltipController(content, enabled) {
  const box = document.createElement('aside');
  box.id = 'game-tooltip';
  box.setAttribute('role','tooltip');
  box.hidden = true;
  document.body.append(box);
  let anchor=null, showTimer=0, hideTimer=0, touchTimer=0, pinned=false, suppressClickUntil=0;
  function hide() {
    clearTimeout(showTimer); clearTimeout(hideTimer); clearTimeout(touchTimer);
    anchor?.removeAttribute('aria-describedby');
    anchor=null; pinned=false; box.hidden=true; box.innerHTML='';
  }
  function position() {
    if(!anchor?.isConnected)return hide();
    const vw=document.documentElement.clientWidth, vh=window.innerHeight, margin=12;
    box.style.maxHeight=(vh-margin*2)+'px';
    const r=anchor.getBoundingClientRect(), w=box.offsetWidth, naturalHeight=box.offsetHeight;
    let left=r.left+(r.width-w)/2, top;
    if(anchor.dataset.tooltip==='hero' && r.right+w+14<vw) {
      left=r.right+12; top=Math.max(margin,Math.min(r.top,vh-naturalHeight-margin));
    } else {
      const above=r.top-margin-10, below=vh-r.bottom-margin-10;
      const useAbove=naturalHeight<=above || above>=below;
      box.style.maxHeight=Math.max(0,useAbove?above:below)+'px';
      top=useAbove?r.top-box.offsetHeight-10:r.bottom+10;
    }
    left=Math.max(margin,Math.min(left,vw-w-margin));
    box.style.left=left+'px'; box.style.top=top+'px';
  }
  function show(target, pin=false) {
    clearTimeout(showTimer); clearTimeout(hideTimer);
    if(!enabled()||!target?.isConnected)return;
    if(anchor!==target)anchor?.removeAttribute('aria-describedby');
    anchor=target;pinned=pin;
    box.innerHTML=content({kind:target.dataset.tooltip,owner:target.dataset.owner||target.dataset.hero,detail:target.dataset.detail||target.dataset.skill});
    if(!box.innerHTML)return hide();
    box.hidden=false; box.scrollTop=0; target.setAttribute('aria-describedby',box.id); position();
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    if(!pinned)hideTimer=setTimeout(hide,180);
  }
  document.addEventListener('pointerover',e=>{
    if(e.pointerType==='touch')return;
    if(box.contains(e.target)){clearTimeout(hideTimer);return;}
    const target=e.target.closest('[data-tooltip]');
    if(!target||target.contains(e.relatedTarget))return;
    if(target===anchor){clearTimeout(hideTimer);return;}
    if(pinned)hide();
    clearTimeout(showTimer);
    showTimer=setTimeout(()=>show(target),120);
  });
  document.addEventListener('pointerout',e=>{
    if(e.pointerType==='touch')return;
    const from=e.target.closest('[data-tooltip]');
    if(from&&from.contains(e.relatedTarget))return;
    if(box.contains(e.relatedTarget))return;
    if(from||box.contains(e.target)){clearTimeout(showTimer);scheduleHide();}
  });
  document.addEventListener('focusin',e=>{
    const target=e.target.closest('[data-tooltip]');
    if(target)show(target);
    else if(!box.contains(e.target))hide();
  });
  document.addEventListener('focusout',e=>{
    if(!e.target.closest('[data-tooltip]')||box.contains(e.relatedTarget))return;
    scheduleHide();
  });
  document.addEventListener('click',e=>{
    if(box.contains(e.target))return;
    const target=e.target.closest('[data-tooltip]');
    if(Date.now()<suppressClickUntil&&target===anchor){
      e.preventDefault();e.stopImmediatePropagation();return;
    }
    if(target?.dataset.tooltip==='status'){
      e.preventDefault();e.stopImmediatePropagation();
      if(anchor===target&&pinned)hide();else show(target,true);
      return;
    }
    hide();
  },true);
  document.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch')return;
    const target=e.target.closest('[data-tooltip]');if(!target)return;
    clearTimeout(touchTimer);
    touchTimer=setTimeout(()=>{show(target,true);suppressClickUntil=Date.now()+1000;},450);
  });
  document.addEventListener('pointerup',()=>clearTimeout(touchTimer));
  document.addEventListener('pointercancel',()=>clearTimeout(touchTimer));
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&!box.hidden){
      hide();e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('resize',hide);
  document.addEventListener('scroll',e=>{if(!box.contains(e.target))hide();},true);
  return {hide,show,isOpen:()=>!box.hidden};
}
