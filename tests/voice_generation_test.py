"""Offline regression tests for incremental voice generation; no TTS requests."""
import argparse
import asyncio
from contextlib import redirect_stdout
from copy import deepcopy
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import AsyncMock, patch

PROJECT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('grande_voice_build', PROJECT / 'scripts/generate-neural-voices.py')
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)
SOURCE = json.loads((PROJECT / 'public/voices/manifest.json').read_text(encoding='utf-8'))


def encode_json(value):
    return json.dumps(value, ensure_ascii=False, indent=2) + '\n'


class IncrementalVoiceTests(unittest.TestCase):
    def setUp(self):
        self.scratch = tempfile.TemporaryDirectory(prefix='grande-voice-test-')
        self.addCleanup(self.scratch.cleanup)
        self.root = Path(self.scratch.name)
        self.output = self.root / 'public/voices'
        self.output.mkdir(parents=True)
        (self.root / 'scripts').mkdir()
        selected = [c for c in SOURCE['clips'] if c['speaker'] == 'knibbs'][:2]
        selected += [c for c in SOURCE['clips'] if c['speaker'] == 'ric'][:1]
        self.clips = deepcopy(selected)
        self.profiles = {s: deepcopy(SOURCE['profiles'][s]) for s in ['knibbs', 'ric']}
        self.previous = {**deepcopy(SOURCE), 'clips': self.clips, 'profiles': self.profiles}
        for clip in self.clips:
            data = (PROJECT / 'public' / clip['src'].removeprefix('/')).read_bytes()
            clip['audioSha256'] = hashlib.sha256(data).hexdigest()
            (self.output / Path(clip['src']).name).write_bytes(data)
        self.good_audio = (self.output / Path(self.clips[0]['src']).name).read_bytes()
        self.lines = [{'speaker': c['speaker'], 'text': c['text']} for c in self.clips]
        self.chapters = [{'before': self.lines, 'after': []}]
        self.write_inputs()

    def write_inputs(self):
        (self.output / 'manifest.json').write_text(encode_json(self.previous), encoding='utf-8')
        self.write_profiles()

    def write_profiles(self):
        (self.root / 'scripts/neural-voice-profiles.json').write_text(encode_json(self.profiles), encoding='utf-8')

    def snapshot(self):
        return {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in self.output.iterdir() if p.is_file()}

    def run_build(self, *, dry_run=False, full=False, online=False, failure=False):
        capture = io.StringIO()
        listed = list(SOURCE['voiceCatalog'].values())
        network = AsyncMock(return_value=listed) if online else AsyncMock(side_effect=AssertionError('Unexpected network request'))
        saves = []

        class FakeSpeech:
            def __init__(inner, text, **options):
                inner.text = text
                inner.options = options

            async def save(inner, destination):
                saves.append((inner.text, inner.options))
                if failure:
                    raise RuntimeError('Simulated synthesis failure')
                Path(destination).write_bytes(self.good_audio)

        args = argparse.Namespace(concurrency=3, incremental=True, full=full, dry_run=dry_run)
        with patch.object(build, 'ROOT', self.root), patch.object(build, 'read_story', return_value=self.chapters), \
             patch.object(build.edge_tts, 'list_voices', network), patch.object(build.edge_tts, 'Communicate', FakeSpeech), \
             patch.object(build.asyncio, 'sleep', AsyncMock()), redirect_stdout(capture):
            asyncio.run(build.main(args))
        messages = [json.loads(line) for line in capture.getvalue().splitlines() if line.startswith('{')]
        return next(m for m in messages if m['stage'] == 'plan'), messages[-1], saves, network

    def counts(self, plan, *, total=3, reused=3, generated=0, removed=0):
        self.assertEqual({k: plan[k] for k in ['clips', 'reused', 'toGenerate', 'removed']},
                         {'clips': total, 'reused': reused, 'toGenerate': generated, 'removed': removed})

    def test_unchanged_default_is_offline_and_does_not_rewrite_assets(self):
        # Legacy assets without checksums remain valid; missing migration metadata is not a reason to rewrite.
        for clip in self.clips:
            clip.pop('audioSha256')
        self.write_inputs()
        before = self.snapshot()
        plan, result, saves, network = self.run_build()
        self.counts(plan)
        self.assertEqual(result['stage'], 'unchanged')
        self.assertEqual(saves, [])
        network.assert_not_awaited()
        self.assertEqual(self.snapshot(), before)

    def test_preview_new_and_edited_lines_never_writes_or_connects(self):
        self.lines[0] = {**self.lines[0], 'text': self.lines[0]['text'] + '先等等。'}
        self.lines.append({'speaker': 'ric', 'text': '新增的门就在这里。'})
        before = self.snapshot()
        plan, _, saves, network = self.run_build(dry_run=True)
        self.counts(plan, total=4, reused=2, generated=2, removed=1)
        self.assertEqual(plan['affectedSpeakers'], {'knibbs': 1, 'ric': 1})
        self.assertEqual(saves, [])
        network.assert_not_awaited()
        self.assertEqual(self.snapshot(), before)

    def test_reordering_dialogue_and_editing_cast_notes_do_not_resynthesize(self):
        self.lines.reverse()
        self.profiles['ric']['reason'] += '仅修改设计说明。'
        self.write_profiles()
        audio_before = {k: v for k, v in self.snapshot().items() if k.endswith('.mp3')}
        plan, _, saves, network = self.run_build()
        self.counts(plan)
        self.assertEqual(saves, [])
        network.assert_not_awaited()
        self.assertEqual({k: v for k, v in self.snapshot().items() if k.endswith('.mp3')}, audio_before)
        updated = json.loads((self.output / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual([c['text'] for c in updated['clips']], [l['text'] for l in self.lines])
        self.assertEqual(updated['profiles'], self.profiles)

    def test_cast_change_invalidates_only_that_character(self):
        self.profiles['knibbs']['rate'] = '+1%'
        self.write_profiles()
        plan, _, _, _ = self.run_build(dry_run=True)
        self.counts(plan, reused=1, generated=2)
        self.assertEqual(plan['affectedSpeakers'], {'knibbs': 2})

    def test_same_text_spoken_by_another_character_is_not_reused(self):
        self.lines.append({'speaker': 'ric', 'text': self.lines[0]['text']})
        plan, _, _, _ = self.run_build(dry_run=True)
        self.counts(plan, total=4, generated=1)
        self.assertEqual(plan['affectedSpeakers'], {'ric': 1})

    def test_same_size_content_corruption_invalidates_only_one_clip(self):
        target = self.output / Path(self.clips[0]['src']).name
        data = bytearray(target.read_bytes())
        data[-1] ^= 1
        target.write_bytes(data)
        plan, _, _, _ = self.run_build(dry_run=True)
        self.counts(plan, reused=2, generated=1)

    def test_missing_and_unreadable_audio_are_individual_cache_misses(self):
        for mode in ['missing', 'unreadable']:
            with self.subTest(mode=mode):
                target = self.output / Path(self.clips[0]['src']).name
                if target.exists():
                    target.unlink()
                if mode == 'unreadable':
                    target.write_bytes(b'x' * self.clips[0]['bytes'])
                plan, _, _, _ = self.run_build(dry_run=True)
                self.counts(plan, reused=2, generated=1)

    def test_one_new_line_generates_once_and_preserves_old_audio(self):
        self.lines.append({'speaker': 'ric', 'text': '新增的门就在这里。'})
        old_audio = {k: v for k, v in self.snapshot().items() if k.endswith('.mp3')}
        plan, _, saves, network = self.run_build(online=True)
        self.counts(plan, total=4, generated=1)
        self.assertEqual([text for text, _ in saves], ['新增的门就在这里。'])
        network.assert_awaited_once()
        after = self.snapshot()
        for name, original in old_audio.items():
            self.assertEqual(after[name], original)
        updated = json.loads((self.output / 'manifest.json').read_text(encoding='utf-8'))
        self.assertEqual(len(updated['clips']), 4)
        for clip in updated['clips']:
            self.assertEqual(clip['audioSha256'], hashlib.sha256((self.output / Path(clip['src']).name).read_bytes()).hexdigest())

    def test_removed_line_does_not_resynthesize_or_delete_manual_audio(self):
        removed_name = Path(self.clips[0]['src']).name
        self.lines.pop(0)
        manual = self.output / 'designer-reference.mp3'
        manual.write_bytes(b'manual reference, not managed by the voice builder')
        before = manual.read_bytes()
        plan, _, saves, network = self.run_build()
        self.counts(plan, total=2, reused=2, removed=1)
        self.assertEqual(saves, [])
        network.assert_not_awaited()
        self.assertFalse((self.output / removed_name).exists())
        self.assertEqual(manual.read_bytes(), before)

    def test_synthesis_failure_preserves_complete_formal_assets(self):
        self.lines.append({'speaker': 'ric', 'text': '这句模拟生成失败。'})
        before = self.snapshot()
        with self.assertRaises(RuntimeError):
            self.run_build(online=True, failure=True)
        self.assertEqual(self.snapshot(), before)

    def test_manifest_commit_failure_preserves_old_references(self):
        self.lines.pop(0)
        before = self.snapshot()
        original_replace = Path.replace

        def replace(path, target):
            if Path(target) == self.output / 'manifest.json':
                raise OSError('Simulated manifest commit failure')
            return original_replace(path, target)

        with patch.object(Path, 'replace', replace), self.assertRaises(OSError):
            self.run_build()
        for name, original in before.items():
            self.assertEqual((self.output / name).read_bytes(), original[0])

    def test_full_is_an_explicit_opt_in(self):
        plan, _, saves, network = self.run_build(dry_run=True, full=True)
        self.counts(plan, reused=0, generated=3)
        self.assertEqual(saves, [])
        network.assert_not_awaited()


if __name__ == '__main__':
    unittest.main()
