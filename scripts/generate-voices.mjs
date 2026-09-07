// Offline build tool. Windows System.Speech performs synthesis; lamejs only encodes PCM to MP3.
// Usage: node scripts/generate-voices.mjs --encoder <path-to-lamejs/dist/lamejs.js>
// Install the build-only encoder outside the game with npm install --prefix <tools> @breezystack/lamejs.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { CHAPTERS } from '../src/story.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = process.argv.indexOf('--encoder');
const encoderPath = arg >= 0 ? process.argv[arg + 1] : process.env.GRANDE_LAMEJS_PATH;
if (!encoderPath) throw new Error('Pass --encoder <path-to-@breezystack/lamejs/dist/lamejs.js> (build dependency only).');
const { Mp3Encoder } = await import(pathToFileURL(path.resolve(encoderPath)).href);
const out = path.join(root, 'public', 'voices');
const scratch = path.join(tmpdir(), 'grande-voices-' + Date.now());
await mkdir(out, { recursive: true });
await mkdir(scratch, { recursive: true });

const profiles = {
  narrator: { voice: 'Microsoft Huihui', rate: 0, pitch: '-3%' },
  clerk: { voice: 'Microsoft Yaoyao', rate: 0, pitch: '-2%' },
  student: { voice: 'Microsoft Kangkang', rate: 0, pitch: '+12%' },
  knibbs: { voice: 'Microsoft Kangkang', rate: 0, pitch: '-3%' },
  ric: { voice: 'Microsoft Kangkang', rate: -1, pitch: '-11%' },
  apeilia: { voice: 'Microsoft Yaoyao', rate: 0, pitch: '-4%' },
  haart: { voice: 'Microsoft Kangkang', rate: -1, pitch: '+4%' },
  qianxing: { voice: 'Microsoft Kangkang', rate: 0, pitch: '0%' },
  youmu: { voice: 'Microsoft Kangkang', rate: 0, pitch: '+9%' },
  youmu_inner: { voice: 'Microsoft Kangkang', rate: -1, pitch: '-16%' },
  patch: { voice: 'Microsoft Kangkang', rate: 0, pitch: '-6%' },
};
const unique = new Map();
for (const chapter of CHAPTERS) for (const phase of ['before', 'after']) for (const line of chapter[phase]) {
  const profile = profiles[line.speaker];
  if (!profile) throw new Error('Missing voice profile: ' + line.speaker);
  const key = createHash('sha256').update(line.speaker + '\n' + line.text).digest('hex').slice(0, 20);
  unique.set(key, { key, speaker: line.speaker, text: line.text, ...profile, wav: path.join(scratch, key + '.wav'), mp3: path.join(out, key + '.mp3'), src: '/voices/' + key + '.mp3' });
}
const jobs = [...unique.values()];
const jobPath = path.join(scratch, 'jobs.json');
await writeFile(jobPath, JSON.stringify(jobs), 'utf8');
await new Promise((resolve, reject) => {
  const taskProcess = spawn(process.env.GRANDE_POWERSHELL_PATH || 'pwsh.exe', ['-NoProfile', '-File', path.join(root, 'scripts', 'generate-voices.ps1'), '-JobsPath', jobPath], { windowsHide: true, stdio: 'inherit' });
  taskProcess.on('error', reject);
  taskProcess.on('exit', code => code === 0 ? resolve() : reject(new Error('Speech synthesis exited ' + code)));
});

function pcmWav(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Not a RIFF WAV');
  let format, pcm;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const tag = buffer.toString('ascii', offset, offset + 4), length = buffer.readUInt32LE(offset + 4), start = offset + 8;
    if (tag === 'fmt ') format = { code: buffer.readUInt16LE(start), channels: buffer.readUInt16LE(start + 2), sampleRate: buffer.readUInt32LE(start + 4), bits: buffer.readUInt16LE(start + 14) };
    if (tag === 'data') pcm = buffer.subarray(start, start + length);
    offset = start + length + (length % 2);
  }
  if (!format || format.code !== 1 || format.channels !== 1 || format.bits !== 16 || !pcm?.length) throw new Error('Expected non-empty mono PCM16 WAV');
  const samples = new Int16Array(pcm.length / 2);
  for (let i = 0; i < samples.length; i++) samples[i] = pcm.readInt16LE(i * 2);
  return { ...format, samples };
}

const clips = [];
for (const [index, job] of jobs.entries()) {
  const wave = pcmWav(await readFile(job.wav));
  const encoder = new Mp3Encoder(1, wave.sampleRate, 48);
  const chunks = [];
  for (let offset = 0; offset < wave.samples.length; offset += 1152) {
    const encoded = encoder.encodeBuffer(wave.samples.subarray(offset, offset + 1152));
    if (encoded.length) chunks.push(Buffer.from(encoded));
  }
  chunks.push(Buffer.from(encoder.flush()));
  await writeFile(job.mp3, Buffer.concat(chunks));
  const bytes = (await stat(job.mp3)).size;
  if (bytes < 500) throw new Error('Suspiciously small encoded clip: ' + job.key);
  clips.push({ key: job.key, speaker: job.speaker, text: job.text, src: job.src, duration: Number((wave.samples.length / wave.sampleRate).toFixed(3)), voice: job.voice, rate: job.rate, pitch: job.pitch, bytes });
  if ((index + 1) % 25 === 0 || index + 1 === jobs.length) console.log('Encoded', index + 1, '/', jobs.length);
}
const manifest = { version: 1, source: 'Windows System.Speech / Microsoft Chinese voices', synthesis: 'Offline synthetic narration; not human voice actors.', encoding: 'MP3 mono, 22050 Hz, 48 kbps', profiles, clips };
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ clips: clips.length, seconds: clips.reduce((sum, clip) => sum + clip.duration, 0), bytes: clips.reduce((sum, clip) => sum + clip.bytes, 0), manifest: path.join(out, 'manifest.json') }, null, 2));
