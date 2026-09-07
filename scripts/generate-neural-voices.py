"""Build Chinese neural voice assets online, then publish complete local MP3s.

Requires the third-party edge-tts client and mutagen in a build-only environment.
Does not read credentials or change the game until every requested clip succeeds.
"""
import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

import edge_tts
from mutagen.mp3 import MP3

ROOT = Path(__file__).resolve().parent.parent
ASSET_NAME = re.compile(r'[0-9a-f]{20}(?:-[0-9a-f]{8})?\.mp3')


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def read_story():
    module = (ROOT / 'src' / 'story.js').as_uri()
    code = 'import { CHAPTERS } from ' + json.dumps(module) + '; process.stdout.write(JSON.stringify(CHAPTERS));'
    completed = subprocess.run(['node', '--input-type=module', '-e', code], cwd=ROOT, check=True, capture_output=True, encoding='utf-8')
    return json.loads(completed.stdout)


def is_link(path):
    return path.is_symlink() or getattr(path, 'is_junction', lambda: False)()


def output_directory():
    root = ROOT.resolve()
    public = root / 'public'
    output = public / 'voices'
    if is_link(public) or is_link(output) or public.resolve().parent != root or output.resolve().parent != public:
        raise RuntimeError('Voice output must stay in the project and cannot be a link')
    return output


def local_path(output, name):
    if not name or name in ('.', '..') or any(char in name for char in '/\\:'):
        raise RuntimeError('Unexpected local asset name')
    path = output / name
    if is_link(output) or is_link(path) or path.resolve().parent != output.resolve():
        raise RuntimeError('Refusing linked or outside voice path: ' + name)
    if path.exists() and not path.is_file():
        raise RuntimeError('Voice file path is not a regular file: ' + name)
    return path


def asset_name(clip):
    src = clip.get('src')
    key = clip.get('key')
    if not isinstance(key, str) or not re.fullmatch(r'[0-9a-f]{20}', key):
        return None
    if not isinstance(src, str) or not src.startswith('/voices/'):
        return None
    name = src[len('/voices/'):]
    if not ASSET_NAME.fullmatch(name) or name[:20] != key:
        return None
    return name


def audio_hash(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def casting_hash(profile):
    return hashlib.sha256(('\n'.join(profile[field] for field in ['voice', 'rate', 'pitch'])).encode('utf-8')).hexdigest()[:8]


def inspect_audio(path):
    info = MP3(path).info
    size = path.stat().st_size
    if size < 500 or info.length <= 0 or info.channels != 1 or info.sample_rate != 24000 or info.bitrate != 48000:
        raise ValueError('Unexpected or empty audio output')
    return {'duration': round(info.length, 3), 'bytes': size, 'sampleRate': info.sample_rate,
            'bitrate': info.bitrate, 'audioSha256': audio_hash(path)}


def inspect_cached_clip(job, clip, output):
    if not clip or any(clip.get(field) != job[field] for field in ['key', 'speaker', 'text']):
        return None
    profile = job['profile']
    if any(clip.get(field) != profile[field] for field in ['voice', 'rate', 'pitch']):
        return None
    voice_hash = casting_hash(profile)
    name = asset_name(clip)
    if name not in (job['key'] + '.mp3', job['key'] + '-' + voice_hash + '.mp3'):
        return None
    if clip.get('voiceHash', voice_hash) != voice_hash:
        return None
    path = local_path(output, name)
    try:
        info = inspect_audio(path)
        if info['bytes'] != clip.get('bytes'):
            return None
        if 'audioSha256' in clip and clip['audioSha256'] != info['audioSha256']:
            return None
    except Exception:
        # A missing or corrupt cache entry only invalidates this line.
        return None
    return {**clip, **info, 'voiceHash': voice_hash, 'src': '/voices/' + job['key'] + '-' + voice_hash + '.mp3'}


def managed_assets(previous, output):
    names = set()
    for clip in previous.get('clips', []):
        name = asset_name(clip)
        if name:
            local_path(output, name)
            names.add(name)
    return names


def copy_verified(source, destination):
    shutil.copy2(source, destination)
    if audio_hash(source) != audio_hash(destination):
        raise RuntimeError('Asset copy verification failed')


def atomic_copy(source, destination):
    local_path(destination.parent, destination.name)
    descriptor, temporary = tempfile.mkstemp(prefix='.' + destination.name + '-', suffix='.next', dir=destination.parent)
    os.close(descriptor)
    temporary = Path(temporary)
    try:
        copy_verified(source, temporary)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def publish_assets(output, rendered, manifest, previous, scratch):
    # All synthesis has completed before this function touches the public set.
    if output_directory() != output:
        raise RuntimeError('Unexpected output directory')
    old_names = managed_assets(previous, output)
    expected_names = {asset_name(clip) for clip in manifest['clips']}
    if None in expected_names:
        raise RuntimeError('Unexpected generated asset name')
    for name in expected_names | {'manifest.json'}:
        local_path(output, name)
    output.mkdir(parents=True, exist_ok=True)
    backup = scratch / 'previous-voices'
    backup.mkdir()
    for name in old_names | expected_names | {'manifest.json'}:
        source = local_path(output, name)
        if source.is_file():
            copy_verified(source, backup / name)

    installed = []
    try:
        for clip in manifest['clips']:
            name = asset_name(clip)
            destination = local_path(output, name)
            if destination.is_file() and audio_hash(destination) == clip['audioSha256']:
                continue
            existed = destination.exists()
            atomic_copy(rendered / name, destination)
            installed.append((name, existed))
        # Until this atomic commit succeeds, every old referenced file still exists.
        atomic_copy(rendered / 'manifest.json', local_path(output, 'manifest.json'))
    except Exception:
        for name, existed in reversed(installed):
            destination = local_path(output, name)
            if existed:
                atomic_copy(backup / name, destination)
            else:
                destination.unlink()
        raise

    cleanup_warnings = []
    for name in sorted(old_names - expected_names):
        try:
            old_file = local_path(output, name)
            if old_file.exists():
                if not (backup / name).is_file() or audio_hash(old_file) != audio_hash(backup / name):
                    raise RuntimeError('Old audio changed after backup')
                old_file.unlink()
        except Exception as error:
            # Publication succeeded. An unremoved stale file cannot break playback.
            cleanup_warnings.append({'file': name, 'error': type(error).__name__})
    return backup, cleanup_warnings


async def main(args):
    output = output_directory()
    profiles = json.loads((ROOT / 'scripts' / 'neural-voice-profiles.json').read_text(encoding='utf-8'))
    manifest_path = local_path(output, 'manifest.json')
    previous = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.is_file() else {}
    old_index = {clip['key']: clip for clip in previous.get('clips', [])}
    managed_assets(previous, output)  # Validate managed paths before reading audio or creating scratch files.
    jobs = {}
    for chapter in read_story():
        for phase in ['before', 'after']:
            for line in chapter[phase]:
                profile = profiles[line['speaker']]
                key = hashlib.sha256((line['speaker'] + '\n' + line['text']).encode('utf-8')).hexdigest()[:20]
                if key in jobs and (jobs[key]['speaker'], jobs[key]['text']) != (line['speaker'], line['text']):
                    raise RuntimeError('Ambiguous subtitle key')
                jobs[key] = {**line, 'key': key, 'profile': profile}

    incremental = getattr(args, 'incremental', True) and not getattr(args, 'full', False)
    reused = {}
    pending = []
    affected = {}
    for key, job in jobs.items():
        clip = inspect_cached_clip(job, old_index.get(key), output) if incremental else None
        if clip:
            reused[key] = clip
        else:
            pending.append(job)
            affected[job['speaker']] = affected.get(job['speaker'], 0) + 1
    counts = {'clips': len(jobs), 'reused': len(reused), 'toGenerate': len(pending),
              'removed': len(set(old_index) - set(jobs)), 'affectedSpeakers': affected}
    print(json.dumps({'stage': 'plan', **counts}, ensure_ascii=False), flush=True)
    if getattr(args, 'dry_run', False):
        return

    comparable = []
    for key, clip in reused.items():
        value = dict(clip)
        # Existing releases acquire checksums on their next real update, not by
        # rewriting an otherwise identical manifest during every build.
        if 'audioSha256' not in old_index[key]:
            value.pop('audioSha256')
        comparable.append(value)
    if not pending and profiles == previous.get('profiles') and comparable == previous.get('clips'):
        print(json.dumps({'stage': 'unchanged', **counts}, ensure_ascii=False), flush=True)
        return

    scratch = Path(tempfile.mkdtemp(prefix='grande-neural-render-'))
    rendered = scratch / 'rendered'
    rendered.mkdir()
    print(json.dumps({'stage': 'prepare', 'scratch': str(scratch)}, ensure_ascii=False), flush=True)
    voices = None
    voice_index = dict(previous.get('voiceCatalog', {}))
    if pending:
        voices = await asyncio.wait_for(edge_tts.list_voices(), timeout=45)
        live_index = {voice['ShortName']: voice for voice in voices}
        missing = {job['profile']['voice'] for job in pending} - live_index.keys()
        if missing:
            raise RuntimeError('Voices not currently offered: ' + ', '.join(sorted(missing)))
        voice_index.update(live_index)
        write_json(scratch / 'live-voices.json', voices)
    for key, clip in reused.items():
        copy_verified(local_path(output, asset_name(old_index[key])), rendered / asset_name(clip))

    limiter = asyncio.Semaphore(getattr(args, 'concurrency', 3))
    completed = 0

    async def generate(job):
        nonlocal completed
        profile = job['profile']
        voice_hash = casting_hash(profile)
        filename = job['key'] + '-' + voice_hash + '.mp3'
        destination = rendered / filename
        async with limiter:
            last_error = None
            for attempt in range(1, 4):
                try:
                    communicate = edge_tts.Communicate(job['text'], voice=profile['voice'], rate=profile['rate'], pitch=profile['pitch'])
                    await asyncio.wait_for(communicate.save(str(destination)), timeout=60)
                    info = inspect_audio(destination)
                    completed += 1
                    if completed % 20 == 0 or completed == len(pending):
                        print(json.dumps({'stage': 'synthesize', 'completed': completed, 'total': len(pending)}, ensure_ascii=False), flush=True)
                    return {'key': job['key'], 'speaker': job['speaker'], 'text': job['text'],
                            'src': '/voices/' + filename, 'voiceHash': voice_hash,
                            'voice': profile['voice'], 'rate': profile['rate'], 'pitch': profile['pitch'], **info}
                except Exception as error:
                    last_error = type(error).__name__
                    status = getattr(error, 'status', None)
                    print(json.dumps({'stage': 'retry', 'key': job['key'], 'attempt': attempt, 'error': last_error, 'status': status}), flush=True)
                    if status in (401, 403):
                        raise RuntimeError('Service declined access; assets were not published') from None
                    if attempt < 3:
                        await asyncio.sleep(2 * attempt)
            raise RuntimeError('Synthesis failed for ' + job['key'] + ': ' + str(last_error))

    tasks = [asyncio.create_task(generate(job)) for job in pending]
    try:
        generated = await asyncio.gather(*tasks)
    except BaseException:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        raise
    ready = {**reused, **{clip['key']: clip for clip in generated}}
    clips = [ready[key] for key in jobs]
    now = datetime.now(timezone.utc).isoformat()
    provenance = dict(previous.get('provenance', {}))
    if voices is not None:
        provenance.update({
            'client': 'edge-tts', 'clientVersion': importlib.metadata.version('edge-tts'),
            'clientIsMicrosoftSdk': False, 'generationRequiresNetwork': True, 'playbackRequiresNetwork': False,
            'sourceUrl': 'https://github.com/rany2/edge-tts', 'customEmotionSsmlSupported': False,
            'voiceListRetrievedAt': now, 'offeredVoiceCount': len(voices),
        })
    manifest = {
        **previous, 'version': 1,
        'source': 'Microsoft Edge Read Aloud online neural voices via third-party edge-tts',
        'synthesis': 'Online neural generation; pre-rendered MP3 playback is fully offline. Synthetic voices, not human actors.',
        'encoding': 'MP3 mono, 24000 Hz, 48 kbps', 'generatedAt': now,
        'provenance': provenance, 'profiles': profiles,
        'voiceCatalog': {name: voice_index[name] for name in sorted({p['voice'] for p in profiles.values()}) if name in voice_index},
        'clips': clips,
    }
    write_json(rendered / 'manifest.json', manifest)
    backup, warnings = publish_assets(output, rendered, manifest, previous, scratch)
    print(json.dumps({'stage': 'complete', **counts, 'seconds': sum(c['duration'] for c in clips),
                      'bytes': sum(c['bytes'] for c in clips), 'distinctVoices': len(manifest['voiceCatalog']),
                      'manifest': str(output / 'manifest.json'), 'backup': str(backup),
                      'cleanupWarnings': warnings}, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--concurrency', type=int, choices=range(1, 5), default=3)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--incremental', action='store_true', default=True, help='Reuse valid unchanged clips (the default; retained for compatibility).')
    mode.add_argument('--full', action='store_true', help='Explicitly regenerate every current subtitle.')
    parser.add_argument('--dry-run', action='store_true', help='Print the read-only plan without network requests or creating files.')
    asyncio.run(main(parser.parse_args()))
