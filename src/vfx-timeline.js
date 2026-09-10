// A deterministic presentation clock. It owns no combat or storage state.
export class VfxTimeline{
 constructor({reset,advance,fire,render}){Object.assign(this,{reset,advance,fire,render});this.position=0;this.duration=3;this.events=[];this.next=0;}
 load(events,duration=3){this.events=events.map(entry=>({...entry})).sort((a,b)=>a.at-b.at);this.duration=Math.max(.1,duration);this.seek(0);}
 dispatch(){while(this.next<this.events.length&&this.events[this.next].at<=this.position+1e-8)this.fire(this.events[this.next++].event);}
 tick(seconds){
  const end=Math.min(this.duration,this.position+Math.max(0,seconds));this.dispatch();
  while(this.position<end-1e-8){
   const nextAt=this.events[this.next]?.at??Infinity,step=Math.min(1/60,end-this.position,nextAt-this.position);
   if(step<=1e-8){this.dispatch();continue;}
   this.advance(step);this.position+=step;this.dispatch();
  }
  this.render?.();return this.position;
 }
 seek(seconds){this.reset();this.position=0;this.next=0;return this.tick(Math.min(this.duration,Math.max(0,Number(seconds)||0)));}
}
