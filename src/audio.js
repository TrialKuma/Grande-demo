/**
 * Original procedural score and sound design for the Grande battle demo.
 * All audio is synthesized locally. The context is created only after a gesture.
 */
import {scoreTheme,scoreFrame} from './audio-score.js';
import {attackSoundPlan,soundLayers} from './audio-sound-design.js';
const midi = (note) => 440 * 2 ** ((note - 69) / 12);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const MAX_AUDIO_VOICES=192;

export class GameAudio {
  constructor() {
    this.context = null;
    this.music = true;
    this.muted = false;
    this.volume = 0.4;
    this.phase = 0;
    this.unlocked = false;
    this._disposed = false;
    this._ended = false;
    this._unlocking = null;
    this._timer = null;
    this._nextNoteTime = 0;
    this._step = 0;
    this._voices = new Set();
    this._noiseBuffers = new Map();
    this._scene={bossId:'golem',screen:'title'};
    this._theme=scoreTheme(this._scene);
    this._sfxEpoch=0;
    this._hidden = typeof document !== 'undefined' && document.hidden;
    this._gesture = () => { void this.unlock(); };
    this._visibility = () => {
      this._hidden = document.hidden;
      if (this._hidden) {
        this._sfxEpoch++;
        this._stopMusic();
        this._stopVoices('sfx');
      } else if (this.unlocked) {
        if (this.context?.state === 'suspended') {
          this.context.resume().then(() => this._startMusic()).catch(() => {});
        } else {
          this._startMusic();
        }
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('pointerdown', this._gesture, { passive: true });
      document.addEventListener('keydown', this._gesture);
      document.addEventListener('visibilitychange', this._visibility);
    }
  }

  async unlock() {
    if (this._disposed) return false;
    if (this._unlocking) return this._unlocking;
    this._unlocking = this._doUnlock();
    try {
      return await this._unlocking;
    } finally {
      this._unlocking = null;
    }
  }

  async _doUnlock() {
    try {
      if (!this.context) {
        const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AudioContextClass) return false;
        this.context = new AudioContextClass({ latencyHint: 'interactive' });
        this._createGraph();
      }
      if (this.context.state === 'suspended') await this.context.resume();
      if (this._disposed || this.context.state !== 'running') return false;
      this.unlocked = true;
      this._startMusic();
      return true;
    } catch {
      // The game remains usable if audio is denied by the browser or device.
      return false;
    }
  }

  _createGraph() {
    const ctx = this.context;
    this._master = ctx.createGain();
    this._master.gain.value = this.muted ? 0 : this.volume;
    this._limiter = ctx.createDynamicsCompressor();
    this._limiter.threshold.value = -9;
    this._limiter.knee.value = 3;
    this._limiter.ratio.value = 20;
    this._limiter.attack.value = 0.003;
    this._limiter.release.value = 0.18;
    this._musicBus = ctx.createGain();
    this._musicBus.gain.value = 0;
    this._sfxBus = ctx.createGain();
    this._sfxBus.gain.value = 1.36;
    // Keep occasional music percussion peaks below the skill transients. This
    // compressor is music-only; effects retain their short impact envelopes.
    this._musicLimiter=ctx.createDynamicsCompressor();
    this._musicLimiter.threshold.value=-17;
    this._musicLimiter.knee.value=8;
    this._musicLimiter.ratio.value=6;
    this._musicLimiter.attack.value=.004;
    this._musicLimiter.release.value=.16;
    // Web Audio's compressor includes makeup gain. A post-compressor trim keeps
    // its peak control from inadvertently making the entire score louder.
    this._musicTrim=ctx.createGain();
    this._musicTrim.gain.value=.45;
    this._musicBus.connect(this._musicLimiter);
    this._musicLimiter.connect(this._musicTrim);
    this._musicTrim.connect(this._master);
    this._sfxBus.connect(this._master);

    // A quiet stereo chamber gives glass, strings, and magic a shared space.
    this._reverb = ctx.createConvolver();
    this._reverb.buffer = this._makeImpulse(1.65);
    this._wet = ctx.createGain();
    this._wet.gain.value = 0.13;
    this._musicSend = ctx.createGain();
    this._musicSend.gain.value = 0.55;
    this._sfxSend = ctx.createGain();
    this._sfxSend.gain.value = 0.27;
    this._musicTrim.connect(this._musicSend);
    this._sfxBus.connect(this._sfxSend);
    this._musicSend.connect(this._reverb);
    this._sfxSend.connect(this._reverb);
    this._reverb.connect(this._wet);
    this._wet.connect(this._master);
    this._master.connect(this._limiter);
    this._limiter.connect(ctx.destination);
  }

  _makeImpulse(seconds) {
    const ctx = this.context;
    const count = Math.ceil(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, count, ctx.sampleRate);
    let seed = 7029;
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      for (let i = 0; i < count; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const noise = seed / 2147483648 - 1;
        const envelope = (1 - i / count) ** 3;
        data[i] = noise * envelope * 0.38;
      }
    }
    return buffer;
  }

  _setGain(param, value, duration = 0.07) {
    if (!this.context || this._disposed) return;
    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + duration);
  }

  setMuted(value) {
    this.muted = Boolean(value);
    if (!this.context) return;
    this._setGain(this._master.gain, this.muted ? 0 : this.volume, 0.06);
    if (this.muted) {
      this._sfxEpoch++;
      this._stopMusic();
      this._stopVoices('sfx');
    } else {
      this._startMusic();
    }
  }

  setMusic(value) {
    this.music = Boolean(value);
    if (!this.music) this._stopMusic();
    else this._startMusic();
  }

  setVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    this.volume = clamp(number, 0, 1);
    if (this.context) this._setGain(this._master.gain, this.muted ? 0 : this.volume);
  }

  setDialogue(active) {
    this.dialogue=Boolean(active);
    if(this._musicBus&&this._timer!==null)this._setGain(this._musicBus.gain,this.dialogue ? .14 : .66,.2);
  }

  setScene({bossId=this._scene.bossId,screen=this._scene.screen,phase=this.phase}={}) {
    const sceneChanged=bossId!==this._scene.bossId||screen!==this._scene.screen;
    const theme=scoreTheme({bossId,screen}),changed=theme!==this._theme;
    this._scene={bossId,screen};this._theme=theme;
    if(sceneChanged){this._sfxEpoch++;this._stopVoices('sfx');}
    if(changed){this._stopMusic();this._step=0;}
    this.setPhase(screen==='battle'?phase:0);
    if(changed)this._startMusic();
  }

  setPhase(value) {
    const next = value === 'core' || value === 'finale' || value === 'victory' || value === 'defeat'
      ? value
      : clamp(Math.round(Number(value) || 0), 0, 4);
    const changed = next !== this.phase;
    const wasEnded = this._ended;
    this.phase = next;
    this._ended = next === 'victory' || next === 'defeat';
    if (this._ended) {
      this._stopMusic();
    } else if (changed || wasEnded) {
      // Align the next phrase with the changed battle state, without overlap.
      this._stopMusic();
      this._step = 0;
      this._startMusic();
    }
  }

  _startMusic() {
    if (this._disposed || !this.unlocked || !this.context || this._timer !== null
      || this._hidden || this.muted || !this.music || this._ended || this.phase === 'victory'
      || this.context.state !== 'running') return;
    this._nextNoteTime = this.context.currentTime + 0.09;
    this._setGain(this._musicBus.gain, this.dialogue ? .14 : .66, 0.45);
    this._scheduleMusic();
    this._timer = globalThis.setInterval(() => this._scheduleMusic(), 75);
  }

  _stopMusic() {
    if (this._timer !== null) globalThis.clearInterval(this._timer);
    this._timer = null;
    if (this._musicBus && this.context && !this._disposed) {
      this._setGain(this._musicBus.gain, 0, 0.08);
    }
    this._stopVoices('music');
  }

  _scheduleMusic() {
    if (this._disposed || this._hidden || this.muted || !this.music || !this.context
      || this.context.state !== 'running' || this._ended || this.phase === 'victory') return;
    const now = this.context.currentTime;
    // Timer throttling must never cause a burst of missed notes on foregrounding.
    if (this._nextNoteTime < now - 0.1) this._nextNoteTime = now + 0.05;
    let budget = 8;
    while (this._nextNoteTime < now + 0.28 && budget-- > 0) {
      const frame=scoreFrame(this._theme,this._step,this.phase),stepLength=60/frame.bpm/4;
      this._musicStep(this._step, this._nextNoteTime, stepLength);
      this._nextNoteTime += stepLength;
      this._step = (this._step + 1) % frame.loopSteps;
    }
  }

  _musicStep(index,time,tick) {
    for(const note of scoreFrame(this._theme,index,this.phase).notes)this._instrument(note,time+(note.offset||0)*tick*4,note.beats*tick*4);
  }

  _instrument(note,time,length) {
    const {instrument:voice,amp,pan}=note,bus='music',frequencies=(Array.isArray(note.note)?note.note:[note.note]).map(midi);
    if(['kick','tom'].includes(voice)){this._drum(time,bus,amp*.65,voice==='tom');return;}
    if(['brush','tick','gear','flow','paper'].includes(voice)){
      this._noise(time,voice==='flow'?.3:voice==='paper'?.12:voice==='brush'?.1:.035,{bus,amp,pan,filter:voice==='tick'?'highpass':'bandpass',frequency:{brush:1500,tick:4700,gear:2500,flow:780,paper:3300}[voice],endFrequency:voice==='flow'?1400:voice==='paper'?1400:undefined,q:voice==='gear'?3:.6,attack:voice==='flow'?.05:.003});
      if(voice==='gear')this._tone(2100,time,.045,{bus,amp:amp*.7,pan});return;
    }
    for(const [i,f]of frequencies.entries()){
      const p=frequencies.length>1?(i-(frequencies.length-1)/2)*.22:pan,a=frequencies.length>1?amp*.65:amp;
      if(voice==='glass'||voice==='metal'){this._bell(f,time,Math.min(1.1,length+ .2),a,bus,p);if(voice==='metal')this._tone(f*2.73,time,.13,{bus,amp:a*.16,pan:p});}
      else if(voice==='wood'){this._tone(f,time,length,{bus,amp:a*1.2,pan:p,wave:'sine',attack:.003,release:length});this._tone(f*3.99,time,.09,{bus,amp:a*.22,pan:p});}
      else if(voice==='bass')this._tone(f,time,length,{bus,amp:a,pan:p,wave:'triangle',attack:.015,cutoff:280,endCutoff:100});
      else if(voice==='pluck')this._tone(f,time,length,{bus,amp:a*1.15,pan:p,wave:'sawtooth',attack:.004,cutoff:2100,endCutoff:300,release:length});
      else if(voice==='pulse')this._tone(f,time,Math.min(.24,length),{bus,amp:a*.85,pan:p,wave:'square',cutoff:1350,endCutoff:340,attack:.006});
      else if(['flute','reed','breath'].includes(voice)){
        this._tone(f,time,length,{bus,amp:a,pan:p,wave:voice==='reed'?'triangle':'sine',attack:Math.min(.1,length*.2),release:Math.min(.22,length*.45),cutoff:voice==='reed'?2000:1100});
        if(voice!=='reed')this._noise(time,Math.min(length,.4),{bus,amp:a*.16,pan:p,frequency:f*2,q:1.4,attack:.045});
      }else if(voice==='organ'){
        this._tone(f,time,length,{bus,amp:a,pan:p,wave:'sine',attack:.035,release:.18});this._tone(f*2,time,length,{bus,amp:a*.3,pan:-p,wave:'triangle',attack:.06,cutoff:1800});
      }else if(voice==='brass')this._tone(f,time,length,{bus,amp:a*.78,pan:p,wave:'sawtooth',attack:.045,cutoff:1350,endCutoff:490,release:.2});
      else{
        const warm=voice==='warm',short=voice==='bowShort'||voice==='chamber';
        this._tone(f,time,short?Math.min(length,.58):length,{bus,amp:a,pan:p,wave:warm?'triangle':'sawtooth',attack:short?.025:.26,release:short?.16:.55,cutoff:voice==='choir'?850:650,endCutoff:380,detune:-3});
        if(!short)this._tone(f*(voice==='choir'?2:1),time+.014,length,{bus,amp:a*.48,pan:-p,wave:'sine',attack:.28,release:.6,detune:4});
      }
    }
  }

  _track(source, gain, nodes, bus, stopTime) {
    const voice = { source, gain, nodes, bus };
    this._voices.add(voice);
    source.onended = () => {
      this._voices.delete(voice);
      for (const node of [source, ...nodes]) {
        try { node.disconnect(); } catch { /* Already disconnected. */ }
      }
    };
    source.stop(stopTime);
  }

  _stopVoices(bus) {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const voice of this._voices) {
      if (bus && voice.bus !== bus) continue;
      try {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + 0.035);
        voice.source.stop(now + 0.045);
      } catch { /* An already ended voice requires no cleanup here. */ }
    }
  }

  _output(gain, bus, pan, nodes) {
    let tail = gain;
    if (this.context.createStereoPanner && pan) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = clamp(pan, -1, 1);
      gain.connect(panner);
      nodes.push(panner);
      tail = panner;
    }
    tail.connect(bus === 'music' ? this._musicBus : this._sfxBus);
  }

  _tone(frequency, time, duration, options = {}) {
    if (!this.context || this._disposed || this._voices.size>=MAX_AUDIO_VOICES) return;
    const ctx = this.context;
    const start = Math.max(time, ctx.currentTime);
    const length = Math.max(0.025, duration);
    const end = start + length;
    const oscillator = ctx.createOscillator();
    oscillator.type = options.wave || 'sine';
    oscillator.frequency.setValueAtTime(Math.max(12, frequency), start);
    if (options.endPitch) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(12, options.endPitch), end);
    }
    oscillator.detune.value = options.detune || 0;
    const gain = ctx.createGain();
    const amp = Math.max(0.0001, options.amp ?? 0.055);
    const attack = Math.min(options.attack ?? 0.005, length * 0.4);
    const release = Math.min(options.release ?? length * 0.8, length - attack);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(amp, start + attack);
    gain.gain.setValueAtTime(amp, Math.max(start + attack, end - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    const nodes = [gain];
    if (options.cutoff) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 0.65;
      filter.frequency.setValueAtTime(options.cutoff, start);
      if (options.endCutoff) filter.frequency.exponentialRampToValueAtTime(options.endCutoff, end);
      oscillator.connect(filter);
      filter.connect(gain);
      nodes.push(filter);
    } else {
      oscillator.connect(gain);
    }
    this._output(gain, options.bus, options.pan, nodes);
    oscillator.start(start);
    this._track(oscillator, gain, nodes, options.bus || 'sfx', end + 0.035);
  }

  _getNoise(brown = false) {
    const key = brown ? 'brown' : 'white';
    if (this._noiseBuffers.has(key)) return this._noiseBuffers.get(key);
    const ctx = this.context;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    let seed = brown ? 1789 : 9571;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = brown ? last * 3.5 : white;
    }
    this._noiseBuffers.set(key, buffer);
    return buffer;
  }

  _noise(time, duration, options = {}) {
    if (!this.context || this._disposed || this._voices.size>=MAX_AUDIO_VOICES) return;
    const ctx = this.context;
    const start = Math.max(time, ctx.currentTime);
    const length = Math.max(0.02, duration);
    const source = ctx.createBufferSource();
    source.buffer = this._getNoise(options.brown);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(options.amp ?? 0.08, start + Math.min(options.attack || 0.003,length*.45));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
    const filter = ctx.createBiquadFilter();
    filter.type = options.filter || 'bandpass';
    filter.Q.value = options.q ?? 0.85;
    filter.frequency.setValueAtTime(options.frequency || 1800, start);
    if (options.endFrequency) {
      filter.frequency.exponentialRampToValueAtTime(options.endFrequency, start + length);
    }
    source.connect(filter);
    filter.connect(gain);
    const nodes = [filter, gain];
    this._output(gain, options.bus, options.pan, nodes);
    source.start(start, (time * 0.17) % 0.5);
    this._track(source, gain, nodes, options.bus || 'sfx', start + length + 0.025);
  }

  _bell(frequency, time, duration = 0.6, amplitude = 0.045, bus = 'sfx', pan = 0) {
    [1, 2.01, 3.96].forEach((ratio, index) => {
      this._tone(frequency * ratio, time, duration / (1 + index * 0.7), {
        bus, amp: amplitude * [1, 0.3, 0.1][index], attack: 0.004,
        release: duration, pan,
      });
    });
  }

  _drum(time, bus = 'sfx', amplitude = 1, second = false) {
    this._tone(second ? 102 : 87, time, 0.36, {
      bus, endPitch: second ? 44 : 35, amp: 0.17 * amplitude, attack: 0.002,
    });
    this._noise(time, 0.095, {
      bus, amp: 0.08 * amplitude, brown: true, filter: 'lowpass', frequency: 650,
    });
  }

  play(eventOrString,{speed=1}={}) {
    if (this._disposed || this.muted || this._hidden || !this.context || !this.unlocked) return;
    const event = typeof eventOrString === 'string' ? { type: eventOrString } : eventOrString;
    if (!event || typeof event !== 'object') return;
    const epoch=this._sfxEpoch;
    if (this.context.state === 'suspended') {
      this.context.resume().then(() => {
        if (!this._disposed && !this.muted && !this._hidden && this._sfxEpoch===epoch)this._playEvent(event,{speed});
      }).catch(() => {});
      return;
    }
    if (this.context.state === 'running') this._playEvent(event,{speed});
  }

  _playEvent(event,{speed=1}={}) {
    const time = this.context.currentTime + 0.006;
    const type = event.type;
    if (type === 'click' || type === 'select') {
      this._tone(type === 'select' ? 660 : 880, time, 0.055, { amp: 0.035 });
      if (type === 'select') this._tone(990, time + 0.032, 0.07, { amp: 0.022 });
    } else if (type === 'error') {
      this._tone(196, time, 0.14, { wave: 'triangle', endPitch: 146, amp: 0.055 });
      this._tone(155, time + 0.075, 0.14, { amp: 0.03 });
    } else if (type === 'turn') {
      [50, 57, 62].forEach((note, index) => this._bell(midi(note), time + index * 0.055,
        0.42, 0.04));
      this._noise(time, 0.3, { amp: 0.026, frequency: 900, endFrequency: 2500, attack: 0.055 });
    } else if (type === 'victory') {
      this.setPhase('victory');
      this._victory(time);
    } else if (type === 'defeat') {
      this.setPhase('defeat');
      [62, 60, 57, 50].forEach((note, index) => this._tone(midi(note), time + index * 0.24,
        1.0, { amp: 0.075, wave: 'triangle', attack: 0.025, release: 0.9, cutoff: 950 }));
      this._tone(58, time + 0.15, 1.4, { amp: 0.1, endPitch: 30 });
    } else if(type==='response'&&event.style==='parry'){
      this._renderCue({kind:'ward',at:0,weight:.72,pan:-.15},time+.23/clamp(Number(speed)||1,.5,3),1);
      this._tone(410,time+.24/clamp(Number(speed)||1,.5,3),.13,{amp:.04,endPitch:180,wave:'triangle'});
    } else if((type==='response'&&event.style==='evade')||type==='buff'){
      this._noise(time,.22,{amp:.055,frequency:2200,endFrequency:400,pan:.4,attack:.025});
      this._tone(660,time+.12,.14,{amp:.025,endPitch:990});
    } else if (type === 'heal') {
      const transpose={haart:5,youmu:-2,qianxing:7,patch:9}[event.actor]||0;
      [62, 65, 69, 74].forEach((note, index) => this._bell(midi(note+transpose), time + index * 0.09,
        0.9, 0.054, 'sfx', (index - 1.5) * 0.16));
      this._noise(time, 0.48, { amp: 0.026, frequency: 2600, endFrequency: 4600, attack: 0.12 });
    } else if (type === 'shield' || event.style === 'guard') {
      [57, 62, 69].forEach((note, index) => this._tone(midi(note), time + index * 0.025,
        0.7, { amp: 0.065, wave: 'triangle', attack: 0.07, cutoff: 1200 }));
      this._bell(1174, time + 0.09, 0.45, 0.035);
      this._noise(time, 0.27, { amp: 0.045, frequency: 300, endFrequency: 2200, attack: 0.07 });
    } else if (type === 'break') {
      this._glass(time, false);
    } else if (type === 'core') {
      this.setPhase('core');
      this._glass(time, true);
      [74, 81, 86].forEach((note, index) => this._bell(midi(note), time + 0.25 + index * 0.12,
        1.2, 0.06));
    } else if (type === 'phase') {
      this._quake(time, 0.75);
      this._noise(time, 0.85, { amp: 0.08, frequency: 350, endFrequency: 2300, attack: 0.2 });
      this._bell(466, time + 0.3, 0.95, 0.055);
    } else if (type === 'attack' || type === 'boss' || type==='response'&&event.style==='counter') {
      const plan=attackSoundPlan(event,{speed,bossId:this._scene.bossId});
      for(const cue of plan.events)this._renderCue(cue,time,plan.speed);
    }
  }

  _renderCue(cue,time,speed=1){
    for(const layer of soundLayers(cue)){
      const at=time+cue.at+(layer.offset||0)/speed,duration=layer.duration/speed;
      if(layer.type==='noise')this._noise(at,duration,layer.options);
      else this._tone(layer.frequency,at,duration,layer.options);
    }
  }

  _shot(time, pan) {
    this._noise(time, 0.09, { amp: 0.24, filter: 'highpass', frequency: 1100, pan });
    this._noise(time + 0.014, 0.16, { amp: 0.09, brown: true, frequency: 850, endFrequency: 200, pan });
    this._tone(155, time, 0.15, { amp: 0.19, endPitch: 48, pan });
    this._tone(2300, time, 0.035, { amp: 0.025, endPitch: 900, pan });
  }

  _slash(time, pan) {
    this._noise(time, 0.22, {
      amp: 0.17, frequency: 650, endFrequency: 4200, q: 0.55, attack: 0.043, pan,
    });
    this._noise(time + 0.075, 0.075, { amp: 0.12, frequency: 3100, endFrequency: 700, pan });
    this._tone(530, time + 0.055, 0.14, {
      wave: 'triangle', amp: 0.085, endPitch: 160, pan,
    });
    this._bell(1760, time + 0.075, 0.22, 0.016, 'sfx', pan);
  }

  _magic(time, count = 1, pan = 0) {
    const base = count > 1 ? 587 : 660;
    this._tone(220, time, 0.16, { amp: 0.057, endPitch: base, wave: 'triangle', pan });
    this._bell(base, time + 0.028, 0.48, 0.074, 'sfx', pan);
    this._bell(base * 1.5, time + 0.075, 0.35, 0.03, 'sfx', -pan);
    this._noise(time, 0.23, { amp: 0.065, frequency: 4000, endFrequency: 1400, pan });
  }

  _glass(time, large) {
    this._drum(time, 'sfx', large ? 1.05 : 0.68);
    this._noise(time, 0.31, { amp: 0.17, filter: 'highpass', frequency: 1500 });
    [1100, 1467, 1870, 2490, 3325, 4510].forEach((frequency, index) => {
      this._tone(frequency, time + index * 0.023, large ? 0.8 : 0.44, {
        amp: 0.06 / (1 + index * 0.35), endPitch: frequency * 0.91,
        pan: (index % 2 ? 1 : -1) * (0.15 + index * 0.06),
      });
    });
  }

  _quake(time, amplitude) {
    this._tone(72, time, 0.88, { amp: 0.23 * amplitude, endPitch: 27, attack: 0.008 });
    this._tone(113, time + 0.018, 0.45, {
      amp: 0.085 * amplitude, wave: 'triangle', endPitch: 41, cutoff: 300,
    });
    this._noise(time, 0.9, {
      amp: 0.24 * amplitude, brown: true, filter: 'lowpass', frequency: 550, endFrequency: 90,
    });
    this._noise(time + 0.06, 0.4, {
      amp: 0.075 * amplitude, frequency: 1300, endFrequency: 300, pan: 0.15,
    });
  }

  _mist(time) {
    this._noise(time, 1.1, {
      amp: 0.13, frequency: 500, endFrequency: 2400, q: 1.2, attack: 0.25, pan: 0.15,
    });
    [146, 155, 220].forEach((frequency, index) => this._tone(frequency, time + index * 0.065,
      0.95, { amp: 0.05, endPitch: frequency * 1.15, attack: 0.2, wave: 'triangle', cutoff: 650 }));
    this._bell(1397, time + 0.4, 0.6, 0.025, 'sfx', -0.3);
  }

  _victory(time) {
    // An original ascending D-minor motif resolves to a warm D-major final chord.
    const notes = [62, 65, 69, 74, 72, 74, 78, 81];
    const beats = [0, 0.15, 0.3, 0.52, 0.82, 1.02, 1.2, 1.42];
    notes.forEach((note, index) => this._bell(midi(note), time + beats[index],
      index > 5 ? 1.4 : 0.75, 0.075, 'sfx', (index % 3 - 1) * 0.18));
    [50, 57, 62, 66].forEach((note) => this._tone(midi(note), time + 1.0, 2.0, {
      amp: 0.055, wave: 'triangle', attack: 0.16, release: 1.65, cutoff: 1500,
    }));
    this._noise(time + 1.2, 0.85, {
      amp: 0.04, filter: 'highpass', frequency: 3500, attack: 0.15,
    });
  }

  dispose() {
    if (this._disposed) return;
    this._stopMusic();
    this._stopVoices();
    this._sfxEpoch++;
    this._disposed = true;
    this.unlocked = false;
    if (typeof document !== 'undefined') {
      document.removeEventListener('pointerdown', this._gesture);
      document.removeEventListener('keydown', this._gesture);
      document.removeEventListener('visibilitychange', this._visibility);
    }
    const ctx = this.context;
    this.context = null;
    this._noiseBuffers.clear();
    this._voices.clear();
    if (ctx && ctx.state !== 'closed' && ctx.close) void ctx.close().catch(() => {});
  }
}

export default GameAudio;
