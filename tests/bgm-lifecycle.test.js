import test from 'node:test';
import assert from 'node:assert/strict';
import { BgmManager } from '../src/audio-bgm.js';

test('bgm lifecycle: all game scenes and routes map to the correct Lyria soundtracks', () => {
  const bgm = new BgmManager();

  // 1. 标题界面
  assert.equal(bgm.resolveTrack({ screen: 'title' }), '01-灯还亮着.mp3');

  // 2. 序章开局接电话
  assert.equal(bgm.resolveTrack({ screen: 'dialogue', bossId: 'scout', chapter: 0, dialogue: 'before' }), '01a-灯还亮着-开局电话版.mp3');

  // 3. 教学战与单人演练
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'scout' }), '04-先看它怎么动.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'bulwark' }), '04-先看它怎么动.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'conduit' }), '04-先看它怎么动.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'training' }), '04-先看它怎么动.mp3');

  // 4. 一般战斗胜利结算页
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'duelist', phase: 'victory' }), '17-这段路安全了.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'victory', bossId: 'scout' }), '17-这段路安全了.mp3');

  // 5. 三类战后探索间章
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'duelist' }), '02-顺着引路线.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'warden' }), '02b-拧紧最后一圈.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'tide' }), '02b-拧紧最后一圈.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'furnace' }), '02b-拧紧最后一圈.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'weaver' }), '19-还没合上的档案.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'orrery' }), '19-还没合上的档案.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'explore', interludeBossId: 'final' }), '16-七个名字.mp3');

  // 6. 营地整备、成长三选一、招募、选路与战间事件
  assert.equal(bgm.resolveTrack({ screen: 'camp' }), '15-热汤留了一份.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'reward' }), '15-热汤留了一份.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'recruit' }), '15-热汤留了一份.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'route' }), '15-热汤留了一份.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'event' }), '15-热汤留了一份.mp3');

  // 7. 途中遭遇编队战
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'patrol' }), '18-先让通道安全.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'relay_guard' }), '18-先让通道安全.mp3');

  // 8. 正式 BOSS 战
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'duelist' }), '05-刀与倒影.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'cantor' }), '06-风口之外.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'warden' }), '07-别踩那根线.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'tide' }), '08-水会退下去.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'furnace' }), '09-炉火未熄.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'golem' }), '10-一条缝.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'weaver' }), '11-签名不在场.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'orrery' }), '12-没被改过的时间.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'arbiter' }), '13-让后面的人通过.mp3');

  // 9. 魔晶巨人核心暴露
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'golem', phase: 'core' }), '10a-一条缝-核心暴露版.mp3');

  // 10. 最终决战全流程
  assert.equal(bgm.resolveTrack({ screen: 'dialogue', bossId: 'final', dialogue: 'before' }), '14a-还在这儿-危机对话版.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'final' }), '14b-还在这儿-最终战版.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'final', phase: 'finale' }), '14c-还在这儿-守住最后放电.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'battle', bossId: 'final', phase: 'victory' }), '16-七个名字.mp3');

  // 11. 三种结局后日谈
  assert.equal(bgm.resolveTrack({ screen: 'complete', endingId: 'rescue' }), '16a-七个名字-救援结局.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'dialogue', dialogue: 'ending', endingId: 'evidence' }), '16b-七个名字-证据结局.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'ending', endingId: 'infrastructure' }), '16c-七个名字-设施结局.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'ending' }), '16-七个名字.mp3');

  // 12. 普通对白
  assert.equal(bgm.resolveTrack({ screen: 'dialogue', bossId: 'duelist', dialogue: 'after' }), '03-你说我听着.mp3');
  assert.equal(bgm.resolveTrack({ screen: 'dialogue', dialogue: 'route' }), '03-你说我听着.mp3');
});
