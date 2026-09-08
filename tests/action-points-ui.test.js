import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,endRound,prepareResponse,heroOf,responseOptions} from '../src/combat.js';
import {battleView,helpView} from '../src/interface.js';

const words=html=>html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ');
const render=state=>battleView(state,false,'','00:00');

test('AP UI: meter separates base and prior carry while the end button previews current leftovers',()=>{
  const state=createBattle('story','duelist');state.ap=2;endRound(state);state.ap=1;
  const before=structuredClone(state),html=render(state),text=words(html);
  assert.match(text,/基础 6 ＋ 保留 2 AP/);
  assert.match(text,/下轮 7 AP · 保留 1/);
  assert.match(html,/aria-label="结束回合" aria-describedby="next-round-ap"/);
  assert.match(html,/id="next-round-ap"/);
  assert.deepEqual(state,before);
});

test('AP UI: solo manual explains five base and at most seven total without calling the current cap the base',()=>{
  const state=createBattle('story','duelist',{mode:'solo',partyIds:['knibbs']});state.ap=2;endRound(state);
  const html=helpView(state),text=words(html);
  assert.match(text,/每轮基础 5 AP/);assert.match(text,/下一轮最多 7 AP/);
  assert.match(text,/最多保留 2 点未使用 AP/);
  assert.match(text,/不会延长护盾、核心或终幕/);
  assert.doesNotMatch(text,/每轮恢复到 7 AP|每轮基础 7 AP|每轮基础 6 AP/);
  assert.match(words(render(state)),/基础 5 ＋ 保留 2 AP/);
});

test('AP UI: cancelled enemy action shows the next budget, not the current enlarged cap',()=>{
  const state=createBattle('story','duelist');state.ap=2;endRound(state);
  state.ap=0;state.boss.broken=true;state.boss.stagger=0;
  assert.match(words(render(state)),/下轮 6 AP · 保留 0/);
  for(const response of responseOptions(state)){
    assert.match(response.description,/不退款/);
    assert.match(response.description,/基础 6 AP/);
    assert.match(response.description,/最多 2 点未使用 AP/);
  }
});

test('AP UI: removed universal response is unavailable and cannot reserve or refund AP',()=>{
 const state=createBattle('story','duelist',{mode:'solo',partyIds:['knibbs']}),before=structuredClone(state);
 assert.equal(prepareResponse(state,'parry','knibbs').ok,false);assert.deepEqual(state,before);assert.deepEqual(responseOptions(state),[]);
 assert.doesNotMatch(render(state),/data-response=|data-action="guard"/);
});
