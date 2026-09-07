/**
 * Original procedural score and sound design for the Grande battle demo.
 * All audio is synthesized locally. The context is created only after a gesture.
 */
const midi = (note) => 440 * 2 ** ((note - 69) / 12);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const CHORDS = [
  [50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 48, 52],
  [50, 53, 57], [48, 52, 55], [46, 50, 53], [45, 49, 52],
];
const MELODY = [74, 77, 79, 76, 81, 79, 77, 73];

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
    this._hidden = typeof document !== 'undefined' && document.hidden;
    this._gesture = () => { void this.unlock(); };
    this._visibility = () => {
      this._hidden = document.hidden;
      if (this._hidden) {
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
    this._sfxBus.gain.value = 0.88;
    this._musicBus.connect(this._master);
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
    this._musicBus.connect(this._musicSend);
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

  setPhase(value) {
    const next = value === 'core' || value === 'victory'
      ? value
      : clamp(Math.round(Number(value) || 0), 0, 4);
    const changed = next !== this.phase;
    const wasEnded = this._ended;
    this.phase = next;
    this._ended = next === 'victory';
    if (next === 'victory') {
      this._stopMusic();
    } else if (changed || wasEnded) {
      // Align the next phrase with the changed battle state, without overlap.
      this._stopMusic();
      this._step = next === 'core' ? 0 : Number(next) * 16;
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
    const intensity = typeof this.phase === 'number' ? this.phase : 1;
    const bpm = this.phase === 'core' ? 68 : 74 + intensity * 2;
    const stepLength = 60 / bpm / 4;
    let budget = 8;
    while (this._nextNoteTime < now + 0.28 && budget-- > 0) {
      this._musicStep(this._step, this._nextNoteTime, stepLength, intensity);
      this._nextNoteTime += stepLength;
      this._step = (this._step + 1) % 128;
    }
  }

  _musicStep(index, time, tick, intensity) {
    const bar = Math.floor(index / 16);
    const beat = index % 16;
    const chord = CHORDS[bar];
    const core = this.phase === 'core';
    if (beat === 0) {
      this._strings(chord, time, tick * 15.7, core ? 0.65 : 1);
      this._bell(midi(MELODY[bar] + (core ? 12 : 0)), time + 0.025,
        tick * (core ? 8 : 5), 0.027, 'music', bar % 2 ? 0.35 : -0.35);
    }
    if (beat === 0 || beat === 8) {
      const root = midi(chord[0] - 12);
      this._tone(root, time, tick * 7.4, {
        bus: 'music', wave: 'triangle', amp: core ? 0.035 : 0.075,
        attack: 0.035, release: 0.35, cutoff: 330, endCutoff: 130,
      });
      if (!core) this._drum(time, 'music', 0.8 + intensity * 0.07, beat === 8);
    }
    if (!core && (beat === 4 || beat === 12)) {
      this._noise(time, 0.14, {
        bus: 'music', amp: 0.018, filter: 'bandpass', frequency: 1250,
        endFrequency: 700, q: 0.6, attack: 0.012, pan: beat === 4 ? -0.24 : 0.24,
      });
    }
    const arpBeat = core ? beat % 4 === 2
      : intensity >= 2 ? beat % 2 === 0 : beat % 4 === 2;
    if (arpBeat) {
      const pattern = bar % 2 ? [2, 1, 0, 1, 2, 0, 1, 2] : [0, 2, 1, 2, 0, 1, 2, 1];
      const slot = Math.floor(beat / 2);
      const note = chord[pattern[slot % 8]] + 12 + (slot > 4 && bar % 3 === 1 ? 12 : 0);
      this._tone(midi(note), time, tick * 3.9, {
        bus: 'music', wave: 'triangle', amp: core ? 0.021 : 0.029,
        attack: 0.012, release: tick * 2.4, cutoff: 1300,
        endCutoff: 450, pan: Math.sin(index * 0.8) * 0.35,
      });
    }
    if ((bar === 1 || bar === 3 || bar === 6 || core) && beat === 12) {
      this._bell(midi(MELODY[bar] - 5 + (core ? 12 : 0)), time, tick * 5,
        0.018, 'music', 0.28);
    }
    if (!core && intensity >= 3 && (beat === 6 || beat === 14)) {
      this._noise(time, 0.065, {
        bus: 'music', amp: 0.009, filter: 'highpass', frequency: 2700, pan: -0.1,
      });
    }
  }

  _strings(chord, time, duration, scale = 1) {
    chord.forEach((note, index) => {
      this._tone(midi(note), time + index * 0.018, duration, {
        bus: 'music', wave: 'sawtooth', amp: 0.019 * scale,
        attack: 0.43, release: 0.75, cutoff: 670 + index * 100,
        endCutoff: 380, detune: -4, pan: -0.37 + index * 0.37,
      });
      this._tone(midi(note), time + 0.025, duration, {
        bus: 'music', wave: 'triangle', amp: 0.022 * scale,
        attack: 0.5, release: 0.8, cutoff: 950,
        detune: 5, pan: 0.34 - index * 0.34,
      });
    });
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
    if (!this.context || this._disposed) return;
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
    if (!this.context || this._disposed) return;
    const ctx = this.context;
    const start = Math.max(time, ctx.currentTime);
    const length = Math.max(0.02, duration);
    const source = ctx.createBufferSource();
    source.buffer = this._getNoise(options.brown);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(options.amp ?? 0.08, start + (options.attack || 0.003));
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

  play(eventOrString) {
    if (this._disposed || this.muted || this._hidden || !this.context || !this.unlocked) return;
    const event = typeof eventOrString === 'string' ? { type: eventOrString } : eventOrString;
    if (!event || typeof event !== 'object') return;
    if (this.context.state === 'suspended') {
      this.context.resume().then(() => {
        if (!this._disposed && !this.muted && !this._hidden) this._playEvent(event);
      }).catch(() => {});
      return;
    }
    if (this.context.state === 'running') this._playEvent(event);
  }

  _playEvent(event) {
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
      this._ended = true;
      this._stopMusic();
      [62, 60, 57, 50].forEach((note, index) => this._tone(midi(note), time + index * 0.24,
        1.0, { amp: 0.075, wave: 'triangle', attack: 0.025, release: 0.9, cutoff: 950 }));
      this._tone(58, time + 0.15, 1.4, { amp: 0.1, endPitch: 30 });
    } else if (type === 'heal') {
      [62, 65, 69, 74].forEach((note, index) => this._bell(midi(note), time + index * 0.09,
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
    } else if (type === 'attack' || type === 'boss') {
      const style = event.style || (type === 'boss' ? 'quake' : event.kind === 'magic' ? 'rune' : 'shot');
      const count = clamp(Math.floor(Number(event.hits) || 1), 1, 6);
      const pan = type === 'boss' ? 0.2 : -0.14;
      if (style === 'quake') this._quake(time, 1);
      else if (style === 'mist') this._mist(time);
      else if (style === 'burst') {
        this._tone(120, time, 0.19, { amp: 0.1, endPitch: 360, wave: 'triangle' });
        this._noise(time, 0.28, { amp: 0.09, frequency: 550, endFrequency: 4200, attack: 0.08 });
        this._quake(time + 0.18, 0.6);
        this._magic(time + 0.19, count, pan);
      } else {
        for (let hit = 0; hit < count; hit++) {
          const at = time + hit * (style === 'slash' ? 0.11 : 0.09);
          if (style === 'shot') this._shot(at, pan);
          else if (style === 'slash') this._slash(at, pan + hit * 0.06);
          else this._magic(at, 1, pan + hit * 0.045);
        }
      }
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
    if (ctx && ctx.state !== 'closed') void ctx.close().catch(() => {});
  }
}

export default GameAudio;
