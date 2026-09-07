import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VOICE_CAST, voiceCastView } from '../src/voice-cast.js';
import { DialogueVoice } from '../src/voice.js';
import { CHAPTERS } from '../src/story.js';

const manifest = JSON.parse(await readFile(new URL('../public/voices/manifest.json', import.meta.url), 'utf8'));
const expectedCast = [
  ['knibbs', '尼布斯拉姆'], ['ric', '雷克老板'], ['apeilia', '艾佩莉雅'],
  ['haart', '哈特蒙斯'], ['qianxing', '潜行'], ['youmu', '游木'],
  ['youmu_inner', '游墓'], ['patch', '补丁Z'], ['narrator', '旁白'],
];
const decode = value => value.replace(/&(amp|lt|gt|quot|#39);/g, (_, entity) => ({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"})[entity]);
function cards(html) {
  return [...html.matchAll(/<article class="voice-cast-card">([\s\S]*?)<\/article>/g)].map(([, body]) => {
    const [, speaker, text, attributes] = body.match(/<button data-voice-speaker="([^"]*)" data-voice-text="([^"]*)"([^>]*)>/);
    return {
      body, speaker, text: decode(text), disabled: /\bdisabled\b/.test(attributes),
      name: decode(body.match(/<h3>([\s\S]*?)<\/h3>/)[1]),
      quote: decode(body.match(/<blockquote>([\s\S]*?)<\/blockquote>/)[1]),
    };
  });
}

test('voice audition: nine named entries include all seven heroes, the captain and narrator', () => {
  assert.deepEqual(VOICE_CAST.map(cast => cast.id), expectedCast.map(([id]) => id));
  const rendered = cards(voiceCastView(manifest));
  assert.deepEqual(rendered.map(card => [card.speaker, card.name]), expectedCast);
  assert.equal(new Set(rendered.map(card => card.speaker)).size, 9);
  for (const card of rendered) {
    assert.equal(card.disabled, false, card.speaker);
    assert.ok(card.text.length > 0, card.speaker);
    if (card.speaker === 'narrator') assert.doesNotMatch(card.body, /class="portrait/);
    else assert.ok(card.body.includes(`class="portrait ${card.speaker}" role="img" aria-label="${card.name}"`));
  }
});

test('voice audition: doctor and captain select different speakers, story samples and base voices', () => {
  const rendered = cards(voiceCastView(manifest));
  const doctor = rendered.find(card => card.speaker === 'youmu');
  const captain = rendered.find(card => card.speaker === 'youmu_inner');
  assert.equal(doctor.name, '游木');
  assert.equal(captain.name, '游墓');
  assert.notEqual(doctor.text, captain.text);
  const source = card => manifest.clips.find(clip => clip.speaker === card.speaker && clip.text === card.text);
  assert.notEqual(source(doctor).src, source(captain).src);
  assert.notEqual(source(doctor).voice, source(captain).voice);
});

test('voice audition: every rendered sample resolves to exactly one current subtitle and local MP3', () => {
  const lines = CHAPTERS.flatMap(chapter => [...chapter.before, ...chapter.after]);
  const media = [];
  const voice = new DialogueVoice(manifest, {createAudio: () => {
    const audio = {pause(){},removeAttribute(){},load(){},play(){return Promise.resolve();}};
    media.push(audio);
    return audio;
  }});
  for (const card of cards(voiceCastView(manifest))) {
    assert.equal(card.quote, card.text, 'the heard line must be the displayed quotation');
    const clips = manifest.clips.filter(clip => clip.speaker === card.speaker && clip.text === card.text);
    assert.equal(clips.length, 1, card.speaker);
    assert.equal(lines.filter(line => line.speaker === card.speaker && line.text === card.text).length, 1, card.speaker);
    assert.match(clips[0].src, /^\/voices\/[a-f0-9-]+\.mp3$/);
    voice.play({speaker:card.speaker,text:card.text});
    assert.equal(media.at(-1).src, clips[0].src, 'button data must resolve through the real playback key');
  }
  assert.equal(media.length, 9);
  voice.stop();
});

test('voice audition: preferred excerpts stay speaker-specific, with a usable fallback when absent', () => {
  const fixture = {clips:[
    {speaker:'knibbs',text:'较早的一句。',src:'/voices/first.mp3'},
    {speaker:'ric',text:'这个回来再谈，是别人说的。',src:'/voices/other-speaker.mp3'},
    {speaker:'knibbs',text:'这个回来再谈。先去救人。',src:'/voices/preferred.mp3'},
  ]};
  const original = structuredClone(fixture);
  let rendered = cards(voiceCastView(fixture));
  assert.equal(rendered.find(card => card.speaker === 'knibbs').text, fixture.clips[2].text);
  assert.equal(rendered.find(card => card.speaker === 'ric').text, fixture.clips[1].text);
  assert.deepEqual(fixture, original, 'rendering must not reorder or mutate the manifest');
  fixture.clips.pop();
  rendered = cards(voiceCastView(fixture));
  assert.equal(rendered.find(card => card.speaker === 'knibbs').text, fixture.clips[0].text);
});

test('voice audition: unavailable generated samples keep all character labels and disable only missing entries', () => {
  const empty = voiceCastView({clips:[]});
  const rendered = cards(empty);
  assert.deepEqual(rendered.map(card => [card.speaker, card.name]), expectedCast);
  for (const card of rendered) {
    assert.equal(card.disabled, true, card.speaker);
    assert.equal(card.text, '');
    assert.equal(card.quote, '尚未生成');
  }
  assert.doesNotMatch(empty, /<img\b|undefined|null/);
  const partial = cards(voiceCastView({clips:[{speaker:'patch',text:'这一句已经生成。',src:'/voices/patch.mp3'}]}));
  assert.deepEqual(partial.filter(card => !card.disabled).map(card => card.speaker), ['patch']);
  assert.equal(partial.filter(card => card.disabled).length, 8);
});

test('voice audition: subtitle HTML and quotes remain inert text and round-trip through button data', () => {
  const text = `"><img src=x onerror="alert('x')"><script>alert(1)</script>&amp; '片段'`;
  const html = voiceCastView({clips:[{speaker:'patch',text,src:'/voices/safe.mp3'}]});
  assert.doesNotMatch(html, /<img\b|<script\b|\sonerror="/);
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('&amp;amp;'));
  const patch = cards(html).find(card => card.speaker === 'patch');
  assert.equal(patch.text, text);
  assert.equal(patch.quote, text);
  assert.equal(patch.disabled, false);
  assert.equal(cards(html).length, 9, 'untrusted text cannot introduce extra cards or buttons');
  assert.equal((html.match(/<button data-voice-speaker=/g)||[]).length, 9);
});
