import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { DialogueVoice } from '../src/voice.js';
import { CHAPTERS } from '../src/story.js';

const first = { speaker: 'youmu', text: '我先检查伤员。' };
const second = { speaker: 'patch', text: '我把原始记录带上。' };
const clips = [
  { ...first, src: '/voices/doctor.mp3' },
  { ...second, src: '/voices/investigator.mp3' },
  { speaker: 'youmu_inner', text: first.text, src: '/voices/captain.mp3' },
];
const tick = () => new Promise(resolve => setImmediate(resolve));
const playbackError = name => Object.assign(new Error(name), { name });

class FakeAudio {
  constructor() {
    this.paused = true;
    this.currentTime = 0;
    this.src = '';
    this.volume = 1;
    this.plays = [];
    this.pauseCalls = 0;
    this.loadCalls = 0;
  }
  play() {
    this.paused = false;
    const pending = {};
    pending.promise = new Promise((resolve, reject) => Object.assign(pending, { resolve, reject }));
    this.plays.push(pending);
    return pending.promise;
  }
  pause() { this.paused = true; this.pauseCalls++; }
  removeAttribute(name) { if (name === 'src') this.src = ''; }
  load() { this.loadCalls++; this.currentTime = 0; }
  ended() { this.paused = true; this.onended?.(); }
  error() { this.onerror?.(); }
}

function player() {
  const media = [], states = [];
  const voice = new DialogueVoice({ version: 1, clips }, {
    createAudio: () => { const audio = new FakeAudio(); media.push(audio); return audio; },
    onState: state => states.push(state),
  });
  return { voice, media, states };
}

test('voice: matches both speaker and text, and repeated renders do not restart a line', async () => {
  const { voice, media } = player();
  voice.sync(first);
  assert.equal(media[0].src, '/voices/doctor.mp3');
  media[0].plays[0].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
  media[0].currentTime = 3;
  voice.sync({ ...first });
  assert.equal(media.length, 1);
  assert.equal(media[0].plays.length, 1);
  assert.equal(media[0].currentTime, 3);
  voice.sync({ speaker: 'youmu_inner', text: first.text });
  assert.equal(media.length, 2);
  assert.equal(media[1].src, '/voices/captain.mp3');
});

test('voice: changing lines releases old audio; late resolution and events cannot alter the new line', async () => {
  const { voice, media, states } = player();
  voice.sync(first);
  const old = media[0];
  old.currentTime = 4;
  voice.sync(second);
  assert.equal(old.paused, true);
  assert.equal(old.src, '');
  assert.equal(old.loadCalls, 1);
  assert.equal(old.currentTime, 0);
  assert.equal(media[1].src, '/voices/investigator.mp3');
  const before = states.length;
  old.plays[0].resolve();
  old.ended();
  old.error();
  await tick();
  assert.equal(states.length, before);
  assert.equal(voice.status, 'loading');
  media[1].plays[0].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
});

test('voice: a previous line rejecting play cannot mark the new line blocked or failed', async () => {
  for (const name of ['NotAllowedError', 'AbortError', 'NotSupportedError']) {
    const { voice, media } = player();
    voice.sync(first);
    voice.sync(second);
    media[1].plays[0].resolve();
    await tick();
    media[0].plays[0].reject(playbackError(name));
    await tick();
    assert.equal(voice.status, 'playing', name);
  }
});

test('voice: closing dialogue prevents all pending playback from reviving it', async () => {
  const { voice, media, states } = player();
  voice.sync(first);
  voice.stop();
  const before = states.length;
  media[0].plays[0].reject(playbackError('AbortError'));
  media[0].ended();
  media[0].error();
  await tick();
  assert.equal(voice.status, 'idle');
  assert.equal(voice.line, null);
  assert.equal(media[0].src, '');
  assert.equal(states.length, before);
  voice.resume();
  assert.equal(media.length, 1);
});

test('voice: disabling narration stops sound and re-enabling reads the latest page only', async () => {
  const { voice, media } = player();
  voice.sync(first);
  voice.configure({ enabled: false });
  assert.equal(voice.status, 'off');
  assert.equal(media[0].paused, true);
  assert.equal(media[0].src, '');
  voice.sync(second);
  assert.equal(media.length, 1);
  media[0].plays[0].resolve();
  await tick();
  assert.equal(voice.status, 'off');
  voice.configure({ enabled: true });
  assert.equal(media.length, 2);
  assert.equal(media[1].src, '/voices/investigator.mp3');
});

test('voice: global mute stops audio without forgetting the current line or narration preference', async () => {
  const { voice, media } = player();
  voice.configure({ muted: true });
  voice.sync(first);
  assert.equal(media.length, 0);
  assert.equal(voice.status, 'off');
  voice.configure({ muted: false, volume: 0.35 });
  assert.equal(media[0].volume, 0.35);
  media[0].plays[0].resolve();
  await tick();
  voice.configure({ muted: true });
  assert.equal(media[0].src, '');
  voice.configure({ enabled: false });
  voice.configure({ muted: false });
  assert.equal(media.length, 1, 'unmuting must not override a separately disabled narration preference');
  assert.equal(voice.status, 'off');
});

test('voice: volume updates the current media and clamps outside the valid media range', () => {
  const { voice, media } = player();
  voice.sync(first);
  voice.configure({ volume: 9 });
  assert.equal(media[0].volume, 1);
  voice.configure({ volume: -2 });
  assert.equal(media[0].volume, 0);
  voice.configure({ volume: 0.42 });
  assert.equal(media[0].volume, 0.42);
  assert.equal(media.length, 1);
});

test('voice: pause and resume preserve the audio object and playhead', async () => {
  const { voice, media } = player();
  voice.sync(first);
  media[0].plays[0].resolve();
  await tick();
  media[0].currentTime = 2.75;
  voice.pause();
  assert.equal(voice.status, 'paused');
  assert.equal(media[0].paused, true);
  voice.resume();
  assert.equal(media.length, 1);
  assert.equal(media[0].currentTime, 2.75);
  assert.equal(media[0].plays.length, 2);
  media[0].plays[1].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
});

test('voice: a pending play resolving after pause does not visually resume narration', async () => {
  const { voice, media } = player();
  voice.sync(first);
  voice.pause();
  media[0].plays[0].resolve();
  await tick();
  assert.equal(voice.status, 'paused');
  assert.equal(media[0].paused, true);
});

test('voice: pausing a pending play treats its AbortError as cancellation, preserving resume', async () => {
  const { voice, media } = player();
  voice.sync(first);
  voice.pause();
  media[0].plays[0].reject(playbackError('AbortError'));
  await tick();
  assert.equal(voice.status, 'paused');
  voice.resume();
  assert.equal(media[0].plays.length, 2);
  media[0].plays[1].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
});

test('voice: a cancelled attempt cannot overwrite a later resume on the same audio object', async () => {
  const { voice, media } = player();
  voice.sync(first);
  voice.pause();
  voice.resume();
  media[0].plays[1].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
  media[0].plays[0].reject(playbackError('AbortError'));
  await tick();
  assert.equal(voice.status, 'playing');
});

test('voice: missing audio is explicit and does not prevent the following page from playing', async () => {
  const { voice, media } = player();
  voice.sync({ speaker: 'narrator', text: 'This line has no rendered clip.' });
  assert.equal(voice.status, 'unavailable');
  assert.equal(media.length, 0);
  voice.sync(first);
  media[0].plays[0].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
});

test('voice: autoplay rejection is distinguishable and a user resume can retry successfully', async () => {
  const { voice, media } = player();
  voice.sync(first);
  media[0].plays[0].reject(playbackError('NotAllowedError'));
  await tick();
  assert.equal(voice.status, 'blocked');
  voice.resume();
  assert.equal(media.length, 2);
  assert.equal(media[0].src, '');
  assert.equal(media[1].src, '/voices/doctor.mp3');
  media[1].plays[0].resolve();
  await tick();
  assert.equal(voice.status, 'playing');
});

test('voice: current media errors and completion are reported, and replay is available', async () => {
  const { voice, media } = player();
  voice.sync(first);
  media[0].plays[0].reject(playbackError('NotSupportedError'));
  await tick();
  assert.equal(voice.status, 'error');
  voice.play();
  media[1].plays[0].resolve();
  await tick();
  media[1].ended();
  assert.equal(voice.status, 'ended');
  voice.play();
  assert.equal(media.length, 3);
  media[2].error();
  assert.equal(voice.status, 'error');
});

test('voice assets: every story line has exactly one matching, non-empty MP3 with a current text hash', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/voices/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.version, 1);
  const lines = CHAPTERS.flatMap(chapter => [...chapter.before, ...chapter.after]);
  const expectedKeys = new Set(lines.map(line => `${line.speaker}\0${line.text}`));
  const actualKeys = new Set();
  for (const clip of manifest.clips) {
    const match = `${clip.speaker}\0${clip.text}`;
    assert.ok(expectedKeys.has(match), 'orphaned or stale subtitle: ' + clip.text);
    assert.ok(!actualKeys.has(match), 'ambiguous subtitle: ' + clip.text);
    actualKeys.add(match);
    const hash = createHash('sha256').update(clip.speaker + '\n' + clip.text).digest('hex').slice(0, 20);
    assert.equal(clip.key, hash);
    const voiceHash = createHash('sha256').update(clip.voice + '\n' + clip.rate + '\n' + clip.pitch).digest('hex').slice(0, 8);
    assert.equal(clip.voiceHash, voiceHash);
    assert.equal(clip.src, `/voices/${hash}-${voiceHash}.mp3`, 'changing casting must change the media URL to invalidate old voice caches');
    assert.ok(Number.isFinite(clip.duration) && clip.duration > 0);
    const mp3 = await readFile(new URL('../public' + clip.src, import.meta.url));
    assert.equal(mp3.length, clip.bytes);
    assert.ok(mp3.length > 500, 'empty or truncated audio: ' + clip.src);
    assert.equal(mp3[0], 0xff, 'missing MPEG frame sync: ' + clip.src);
    assert.equal(mp3[1] & 0xe0, 0xe0, 'invalid MPEG frame sync: ' + clip.src);
    assert.equal((mp3[1] >> 3) & 3, 2, 'neural assets must be MPEG-2 audio');
    assert.equal((mp3[1] >> 1) & 3, 1, 'neural assets must be Layer III');
    assert.equal((mp3[2] >> 2) & 3, 1, 'neural assets must use the 24 kHz MPEG-2 sample rate');
    assert.equal(mp3[2] >> 4, 6, 'neural assets must use the 48 kbps MPEG-2 Layer III bitrate');
    assert.equal(mp3[3] >> 6, 3, 'neural assets must be mono');
    assert.equal(clip.sampleRate, 24000);
    assert.equal(clip.bitrate, 48000);
    assert.equal(clip.voice, manifest.profiles[clip.speaker].voice);
    assert.equal(clip.rate, manifest.profiles[clip.speaker].rate);
    assert.equal(clip.pitch, manifest.profiles[clip.speaker].pitch);
  }
  assert.deepEqual(actualKeys, expectedKeys);
});

test('voice casting: distinct neural bases and honest online-generation/offline-playback metadata', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/voices/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.provenance.client, 'edge-tts');
  assert.equal(manifest.provenance.clientIsMicrosoftSdk, false);
  assert.equal(manifest.provenance.generationRequiresNetwork, true);
  assert.equal(manifest.provenance.playbackRequiresNetwork, false);
  assert.equal(manifest.provenance.customEmotionSsmlSupported, false);
  const voices = new Set(Object.values(manifest.profiles).map(profile => profile.voice));
  assert.equal(voices.size, 7, 'casting uses seven real neural voices, not one voice with pitch presets');
  for (const voice of voices) {
    assert.match(voice, /^zh-(CN|TW)-[A-Za-z]+Neural$/);
    assert.equal(manifest.voiceCatalog[voice].ShortName, voice);
  }
  assert.notEqual(manifest.profiles.youmu.voice, manifest.profiles.youmu_inner.voice, 'the doctor and captain need different base voices');
  assert.equal(manifest.voiceCatalog[manifest.profiles.apeilia.voice].Gender, 'Female');
  for (const speaker of ['knibbs', 'ric', 'haart', 'qianxing', 'youmu', 'youmu_inner', 'patch']) {
    assert.equal(manifest.voiceCatalog[manifest.profiles[speaker].voice].Gender, 'Male', speaker);
    assert.ok(manifest.profiles[speaker].reason.length > 10, 'casting rationale missing: ' + speaker);
  }
});
