import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAPTERS, BRANCH_CHAPTERS, ALL_CHAPTERS, CHAPTER_BY_BOSS, ROUTE_CHOICES, CAMP_EVENTS, ENDINGS, allStoryLines } from '../src/story.js';
import { TUTORIAL_CHAPTERS } from '../src/tutorial-story.js';

test('story 3.7: main scenes need at most ten advances and keep a complete rescue arc', () => {
  for (const chapter of CHAPTERS) for (const phase of ['before', 'after']) {
    assert.ok(chapter[phase].length >= 7 && chapter[phase].length <= 10, `${chapter.bossId} ${phase}`);
  }
  const introduction = [...TUTORIAL_CHAPTERS[0].before, ...CHAPTERS[0].before].map(line => line.text).join('');
  assert.match(introduction, /六个学生和一位老师/);
  assert.match(introduction, /受伤/);
  assert.match(introduction, /救援/);
  const final = CHAPTERS.find(chapter => chapter.bossId === 'final').after.map(line => line.text).join('');
  assert.match(final, /学生六位，老师一位/);
  assert.match(final, /维护原件/);
  assert.match(final, /里面没有人还在等/);
});

test('story 3.7: tutorials are voiced chapters with staged recruitment and no extra battle actors', () => {
  assert.deepEqual(TUTORIAL_CHAPTERS.map(chapter => chapter.bossId), ['scout', 'bulwark', 'conduit']);
  for (const chapter of TUTORIAL_CHAPTERS) {
    assert.equal(CHAPTER_BY_BOSS[chapter.bossId], chapter);
    assert.ok(chapter.before.length >= 5 && chapter.before.length <= 8);
    assert.ok(chapter.after.length >= 3 && chapter.after.length <= 5);
    assert.ok(chapter.tutorial);
  }
  assert.match(TUTORIAL_CHAPTERS[0].before.map(line => line.text).join(''), /频道连好了/);
  assert.match(TUTORIAL_CHAPTERS[0].after.map(line => line.text).join(''), /先来一个人/);
  assert.match(TUTORIAL_CHAPTERS[2].after.map(line => line.text).join(''), /留下的那个人也能过来/);
  const lines = allStoryLines();
  for (const line of TUTORIAL_CHAPTERS.flatMap(chapter => [...chapter.before, ...chapter.after])) {
    assert.ok(lines.some(candidate => candidate.speaker === line.speaker && candidate.text === line.text));
  }
});

test('story 3.7: all detours and endings remain short and old fixed recruitment dialogue is gone', () => {
  for (const chapter of BRANCH_CHAPTERS) {
    assert.ok(chapter.before.length <= 10);
    assert.ok(chapter.after.length <= 7);
  }
  for (const groups of [ROUTE_CHOICES, CAMP_EVENTS]) for (const group of Object.values(groups)) {
    for (const option of group.options) assert.ok(option.lines.length <= 5);
  }
  for (const ending of Object.values(ENDINGS)) assert.ok(ending.lines.length >= 7 && ending.lines.length <= 10);
  assert.equal(new Set(ALL_CHAPTERS.map(chapter => chapter.bossId)).size, ALL_CHAPTERS.length);
  const text = allStoryLines().map(line => line.text).join('');
  assert.doesNotMatch(text, /现在是五个|七人离开门前|七道影子|我们来了四个|七人走进天井|我在隔壁存档间/);
});
