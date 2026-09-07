// Pre-rendered Chinese dialogue. No browser speech engine or network service.
export class DialogueVoice {
  constructor(manifest,{createAudio=()=>new Audio(),onState=()=>{}}={}) {
    this.clips=new Map((manifest.clips||[]).map(c=>[this.key(c),c]));
    this.createAudio=createAudio;this.onState=onState;this.media=null;
    this.line=null;this.generation=0;this.playAttempt=0;this.status='idle';this.enabled=true;this.muted=false;this.volume=.7;
  }
  key(line){return line?`${line.speaker}\u0000${line.text}`:'';}
  setState(status){this.status=status;this.onState(status);}
  sync(line){
    if(this.key(line)===this.key(this.line))return;
    this.stop();this.line=line||null;
    if(line)this.play();
  }
  configure({enabled=this.enabled,muted=this.muted,volume=this.volume}={}){
    const wasAudible=this.enabled&&!this.muted;
    this.enabled=!!enabled;this.muted=!!muted;this.volume=Math.max(0,Math.min(1,volume));
    if(this.media)this.media.volume=this.volume;
    if(!this.enabled||this.muted){this.halt();this.setState('off');}
    else if(!wasAudible&&this.line)this.play();
  }
  halt(){this.generation++;this.playAttempt++;if(this.media){this.media.pause();this.media.removeAttribute('src');this.media.load();this.media=null;}}
  stop(){this.halt();this.line=null;this.setState('idle');}
  pause(){if(this.media&&['loading','playing'].includes(this.status)){this.playAttempt++;this.media.pause();this.setState('paused');}}
  resume(){if(this.status==='paused'&&this.media){this.startMedia(this.media,this.generation);}else if(this.status==='blocked')this.play();}
  play(line=this.line){
    this.halt();this.line=line;
    if(!line){this.setState('idle');return;}
    if(!this.enabled||this.muted){this.setState('off');return;}
    const clip=this.clips.get(this.key(line));
    if(!clip){this.setState('unavailable');return;}
    const generation=this.generation,media=this.createAudio();this.media=media;
    media.preload='auto';media.volume=this.volume;media.src=clip.src;
    media.onended=()=>{if(generation===this.generation)this.setState('ended');};
    media.onerror=()=>{if(generation===this.generation)this.setState('error');};
    this.startMedia(media,generation);
  }
  startMedia(media,generation){
    const attempt=++this.playAttempt;
    this.setState('loading');
    Promise.resolve(media.play()).then(()=>{if(generation===this.generation&&attempt===this.playAttempt&&!media.paused)this.setState('playing');})
      .catch(error=>{if(generation===this.generation&&attempt===this.playAttempt)this.setState(error?.name==='NotAllowedError'?'blocked':'error');});
  }
}
