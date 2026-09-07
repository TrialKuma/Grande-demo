import test from 'node:test';
import assert from 'node:assert/strict';
import {GameAudio,MAX_AUDIO_VOICES} from '../src/audio.js';
import {SCORE_THEMES,scoreTheme,scoreFrame} from '../src/audio-score.js';
import {attackSoundPlan} from '../src/audio-sound-design.js';
import {impactTiming} from '../src/battle-feedback.js';

class Param{
  constructor(value=0){this.value=value;this.events=[];}
  mark(method,value,time){assert.ok(Number.isFinite(value)&&Number.isFinite(time));this.value=value;this.events.push({method,value,time});return this;}
  setValueAtTime(v,t){return this.mark('set',v,t);}
  linearRampToValueAtTime(v,t){return this.mark('linear',v,t);}
  exponentialRampToValueAtTime(v,t){assert.ok(v>0);return this.mark('exponential',v,t);}
  cancelScheduledValues(t){this.events.push({method:'cancel',time:t});}
}
function harness(t){
  const saved=new Map(['AudioContext','document','setInterval','clearInterval'].map(k=>[k,globalThis[k]]));
  const timers=new Map(),listeners=new Map();let serial=0,created=0;
  const node=()=>({connections:[],connect(other){this.connections.push(other);},disconnect(){this.disconnected=true;this.connections=[];}});
  class Context{
    constructor(){created++;this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=node();this.sources=[];this.filters=[];this.resumeCalls=0;}
    createGain(){return {...node(),gain:new Param(1)};}
    createDynamicsCompressor(){return {...node(),threshold:new Param(),knee:new Param(),ratio:new Param(),attack:new Param(),release:new Param()};}
    createConvolver(){return node();}
    createStereoPanner(){return {...node(),pan:new Param()};}
    createBiquadFilter(){const n={...node(),frequency:new Param(350),Q:new Param(1)};this.filters.push(n);return n;}
    createBuffer(channels,length,sampleRate){const data=Array.from({length:channels},()=>new Float32Array(length));return {getChannelData:c=>data[c],length,sampleRate};}
    source(kind){const s={...node(),sourceKind:kind,frequency:new Param(440),detune:new Param(),start(at){assert.ok(at>=0);this.started=at;},stop(at){this.stopAt=Math.min(this.stopAt??Infinity,at);}};this.sources.push(s);return s;}
    createOscillator(){return this.source('tone');}
    createBufferSource(){return this.source('noise');}
    async resume(){this.resumeCalls++;if(this.deferResume)await new Promise(r=>this.releaseResume=r);this.state='running';}
    async close(){this.state='closed';this.advance(1000);}
    advance(to){this.currentTime=to;for(const s of this.sources)if(!s.ended&&s.stopAt<=to){s.ended=true;s.onended?.();}}
  }
  globalThis.AudioContext=Context;
  globalThis.document={hidden:false,addEventListener:(k,fn)=>listeners.set(k,fn),removeEventListener:k=>listeners.delete(k)};
  globalThis.setInterval=fn=>{const id=++serial;timers.set(id,fn);return id;};globalThis.clearInterval=id=>timers.delete(id);
  const a=new GameAudio();
  t.after(()=>{a.dispose();for(const [k,v]of saved)if(v===undefined)delete globalThis[k];else globalThis[k]=v;});
  return {a,timers,listeners,get created(){return created;},get ctx(){return a.context;},tick(to){a.context.advance(to);for(const fn of timers.values())fn();},hidden(value){document.hidden=value;listeners.get('visibilitychange')();}};
}
const attack={type:'attack',actor:'knibbs',bossId:'duelist',targets:['boss'],style:'shot',hits:3,amount:60,hpLosses:{boss:60},hitAmounts:{boss:[20,20,20]}};
const startsAtFrequency=(ctx,frequency)=>ctx.sources.filter(s=>s.sourceKind==='tone'&&s.frequency.events.some(e=>e.method==='set'&&e.value===frequency)).map(s=>s.started);

test('audio: no graph or sound is created before unlock; repeated unlock keeps one context and timer',async t=>{
  const h=harness(t);h.a.play(attack);h.a.setScene({bossId:'tide',screen:'battle'});assert.equal(h.created,0);
  await Promise.all([h.a.unlock(),h.a.unlock()]);assert.equal(h.created,1);assert.equal(h.timers.size,1);assert.ok(h.ctx.sources.length>0);
  const step=h.a._step;h.a.setScene({bossId:'tide',screen:'battle'});assert.equal(h.a._step,step);assert.equal(h.timers.size,1);
});

test('audio: shot launches precede each material impact and both follow shared speed-scaled timing',async t=>{
  const h=harness(t);h.a.setMusic(false);await h.a.unlock();h.a.play(attack,{speed:2});
  const expected=impactTiming(attack),launches=startsAtFrequency(h.ctx,138),impacts=startsAtFrequency(h.ctx,620);
  assert.equal(launches.length,3);assert.equal(impacts.length,3);
  impacts.forEach((at,i)=>{assert.ok(Math.abs(at-(.006+(expected.impactAt+i*expected.interval)/2))<1e-8);assert.ok(launches[i]<at);});
  assert.ok(h.ctx.sources.every(s=>s.stopAt>s.started));
});

test('audio: fully absorbed and zero-HP trailing hits never synthesize body/material thumps',async t=>{
  const h=harness(t);h.a.setMusic(false);await h.a.unlock();
  const event={...attack,hits:6,amount:30,hpLosses:{boss:30},hitAmounts:{boss:[30,0,0,0,0,0]}};
  h.a.play(event);assert.equal(startsAtFrequency(h.ctx,620).length,1);assert.equal(startsAtFrequency(h.ctx,138).length,6);
  const shield={type:'boss',actor:'boss',bossId:'tide',style:'shot',targets:['knibbs'],amount:90,hpLosses:{knibbs:0},absorbedAmounts:{knibbs:90}};
  const plan=attackSoundPlan(shield);assert.equal(plan.events.filter(c=>c.kind==='impact').length,0);assert.equal(plan.events.filter(c=>c.kind==='ward').length,1);
  const before=startsAtFrequency(h.ctx,117).length;h.a.play(shield);assert.equal(startsAtFrequency(h.ctx,117).length,before);assert.ok(startsAtFrequency(h.ctx,730).length>0);
});

test('audio: rapid hits normalize gain and heavy weight is a distinct final low-frequency layer',async t=>{
  const h=harness(t);h.a.setMusic(false);await h.a.unlock();
  const single=attackSoundPlan({...attack,hits:1,style:'burst'}),multi=attackSoundPlan({...attack,hits:6,style:'burst',hitAmounts:{boss:[10,10,10,10,10,10]}});
  assert.ok(multi.events.find(c=>c.kind==='launch').weight<single.events.find(c=>c.kind==='launch').weight);
  assert.equal(multi.events.filter(c=>c.heavy).length,1);
  h.a.play({...attack,hits:6,style:'burst',hitAmounts:{boss:[10,10,10,10,10,10]}});assert.equal(startsAtFrequency(h.ctx,76).length,1);
  for(let i=0;i<30;i++)h.a.play(attack);assert.ok(h.a._voices.size<=MAX_AUDIO_VOICES);
  h.ctx.advance(10);assert.equal(h.a._voices.size,0);assert.ok(h.ctx.sources.every(s=>s.disconnected));
});

test('audio: thirteen attack designs and six target materials create different real synthesis schedules',async t=>{
  const h=harness(t);h.a.setMusic(false);await h.a.unlock();
  const signatures=[];
  for(const theme of ['ballistic','blade','arcane','mind','silverfire','surgery','clockwork','water','furnace','lightning','spore','crystal','edict']){
    h.ctx.advance(h.ctx.currentTime+3);const start=h.ctx.sources.length,filters=h.ctx.filters.length;
    h.a._renderCue({kind:'launch',at:0,theme,weight:1},h.ctx.currentTime);
    const sources=h.ctx.sources.slice(start);assert.ok(sources.length>=2,theme);
    signatures.push(JSON.stringify({voices:sources.map(s=>[s.sourceKind,s.type,s.frequency.events.map(e=>[e.method,e.value,Math.round((e.time-s.started)*1000)]),Math.round((s.stopAt-s.started)*1000)]),filters:h.ctx.filters.slice(filters).map(f=>[f.type,f.frequency.events.map(e=>e.value)])}));
  }
  assert.equal(new Set(signatures).size,13);
  const materials=[];
  for(const material of ['metal','stone','crystal','organic','paper','cloth']){
    h.ctx.advance(h.ctx.currentTime+3);const start=h.ctx.sources.length;
    h.a._renderCue({kind:'impact',material,at:0,weight:1,heavy:true},h.ctx.currentTime);
    materials.push(JSON.stringify(h.ctx.sources.slice(start).map(s=>[s.sourceKind,s.frequency.events.map(e=>e.value),s.stopAt-s.started])));
  }
  assert.equal(new Set(materials).size,6);
});

test('audio: music themes differ in harmony, melody, meter and instruments when scheduled across phrases',async t=>{
  const h=harness(t);h.a.setMusic(false);await h.a.unlock();const signatures=[];
  for(const [id,theme]of Object.entries(SCORE_THEMES)){
    h.ctx.advance(h.ctx.currentTime+20);h.a._theme=id;const start=h.ctx.sources.length;let at=h.ctx.currentTime+.1;
    for(let i=0;i<theme.steps*2;i++){const frame=scoreFrame(id,i),tick=60/frame.bpm/4;h.a._musicStep(i,at,tick);h.ctx.advance(at);at+=tick;}
    const sources=h.ctx.sources.slice(start);assert.ok(sources.length>10,id);
    signatures.push(JSON.stringify(sources.map(s=>[s.sourceKind,s.type,s.frequency.events.map(e=>e.value),Math.round((s.stopAt-s.started)*100)])));
  }
  assert.equal(new Set(signatures).size,11);
  assert.ok(new Set(Object.values(SCORE_THEMES).map(t=>t.steps)).size>=4);
  assert.equal(scoreTheme({screen:'event'}),'camp');assert.equal(scoreTheme({screen:'battle',bossId:'final'}),'final');
  const normal=Array.from({length:16},(_,i)=>scoreFrame('final',i,1).notes).flat(),core=Array.from({length:16},(_,i)=>scoreFrame('final',i,'finale').notes).flat();
  assert.ok(normal.some(n=>n.instrument==='tom'));assert.ok(!core.some(n=>['tom','kick','brush','tick'].includes(n.instrument)));assert.ok(scoreFrame('final',0,'finale').bpm<scoreFrame('final',0,1).bpm);
});

test('audio: dialogue ducks only music and scene changes restart a single phrase without old voices',async t=>{
  const h=harness(t);await h.a.unlock();h.a.setDialogue(true);assert.equal(h.a._musicBus.gain.value,.14);assert.equal(h.a._sfxBus.gain.value,1.36);assert.equal(h.a._musicLimiter.ratio.value,6);assert.equal(h.a._musicTrim.gain.value,.45);
  const old=h.ctx.sources.slice();h.a.setScene({screen:'battle',bossId:'furnace',phase:1});assert.equal(h.a._theme,'furnace');assert.equal(h.timers.size,1);assert.equal(h.a._musicBus.gain.value,.14);
  assert.ok(old.every(s=>s.stopAt<=.045));h.a.setDialogue(false);assert.equal(h.a._musicBus.gain.value,.66);
  h.a.setPhase('victory');assert.equal(h.timers.size,0);h.a.setScene({screen:'camp'});assert.equal(h.a._ended,false);assert.equal(h.timers.size,1);assert.equal(h.a._theme,'camp');
});

test('audio: hiding or muting cancels scheduled sound and foregrounding never catches up missed music',async t=>{
  const h=harness(t);await h.a.unlock();h.a.play(attack);h.hidden(true);assert.equal(h.timers.size,0);h.ctx.advance(100);assert.equal(h.a._voices.size,0);
  const count=h.ctx.sources.length;h.a.play(attack);assert.equal(h.ctx.sources.length,count);h.hidden(false);assert.equal(h.timers.size,1);
  const fresh=h.ctx.sources.slice(count);assert.ok(fresh.length<30);assert.ok(fresh.every(s=>s.started>=100));
  h.a.setMuted(true);h.ctx.advance(101);assert.equal(h.a._voices.size,0);assert.equal(h.timers.size,0);h.a.setMuted(false);assert.equal(h.timers.size,1);
});

test('audio: defeat stays silent across state synchronization and a new battle restarts normally',async t=>{
  const h=harness(t);await h.a.unlock();h.a.setScene({screen:'battle',bossId:'final',phase:1});h.a.play('defeat');
  assert.equal(h.a.phase,'defeat');assert.equal(h.timers.size,0);
  h.a.setScene({screen:'battle',bossId:'final',phase:'defeat'});h.a.setMuted(true);h.a.setMuted(false);
  assert.equal(h.a._ended,true);assert.equal(h.timers.size,0);
  h.a.setScene({screen:'battle',bossId:'final',phase:0});assert.equal(h.a._ended,false);assert.equal(h.timers.size,1);
});

test('audio: delayed resume cannot replay an event invalidated by mute or scene change',async t=>{
  const h=harness(t);h.a.setMusic(false);await h.a.unlock();h.ctx.state='suspended';h.ctx.deferResume=true;
  h.a.play(attack);h.a.setMuted(true);h.a.setMuted(false);h.ctx.releaseResume();await Promise.resolve();await Promise.resolve();assert.equal(h.ctx.sources.length,0);
  h.ctx.state='suspended';h.a.play(attack);h.a.setScene({screen:'camp'});h.ctx.releaseResume();await Promise.resolve();await Promise.resolve();assert.equal(h.ctx.sources.length,0);
});

test('audio: disposal clears scheduled sources, listeners and buffers and cannot be restarted',async t=>{
  const h=harness(t);await h.a.unlock();h.a.play(attack);const ctx=h.ctx;h.a.dispose();assert.equal(h.timers.size,0);assert.equal(h.listeners.size,0);assert.equal(h.a._voices.size,0);assert.equal(h.a._noiseBuffers.size,0);assert.equal(ctx.state,'closed');
  assert.equal(await h.a.unlock(),false);h.a.play(attack);assert.equal(h.a.context,null);
});
