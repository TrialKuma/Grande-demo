import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSSES,createBattle,heroOf,useSkill,endRound} from '../src/combat.js';
import {battleView,helpView,titleView} from '../src/interface.js';
import {tooltipView,statusBadges} from '../src/status-details.js';
import {bossCodexView} from '../src/boss-codex.js';
import {LESSONS} from '../src/training.js';

const render=state=>battleView(state,false,'','00:00',null);
const plain=html=>html.replace(/<[^>]*>/g,' ');

test('3.7 UI: learning battles show only the actual learned commands and matching party layout',()=>{
 const state=createBattle('standard','scout',{partyIds:['knibbs'],skillAccess:{knibbs:['shot','focus']}}),before=structuredClone(state),html=render(state);
 assert.equal((html.match(/data-skill=/g)||[]).length,2);
 assert.match(html,/--skill-count:2/);assert.match(html,/--party-size:1/);assert.match(html,/is-small-party/);
 assert.match(tooltipView(state,'action-points','knibbs'),/基础 3 点/);assert.ok(html.includes(LESSONS.scout.text));
 assert.doesNotMatch(html,/data-response=|data-action="guard"|data-skill="breathe"/);
 assert.deepEqual(state,before);
 const pair=createBattle('standard','bulwark',{partyIds:['knibbs','haart'],skillAccess:{knibbs:['shot','breathe','cover'],haart:['page','soothe']}});
 const pairHtml=render(pair);assert.equal((pairHtml.match(/data-skill=/g)||[]).length,5);
 assert.match(pairHtml,/--skill-count:3/);assert.match(pairHtml,/--party-size:2/);assert.match(tooltipView(pair,'action-points','knibbs'),/基础 4 点/);
});

test('3.9 UI: gunner cover reports a prepared counter instead of a team shield',()=>{
 const state=createBattle('standard','duelist'),knibbs=heroOf(state,'knibbs');knibbs.intuition=3;
 assert.equal(useSkill(state,'knibbs','cover').ok,true);
 assert.equal(knibbs.shield,0);assert.equal(knibbs.protection,0);
 assert.match(statusBadges(state,knibbs),/data-detail="cover"/);
 const tip=plain(tooltipView(state,'status','knibbs','cover'));
 assert.match(tip,/行动前射击/);assert.match(tip,/力量与智力各降低 18/);
 assert.doesNotMatch(plain(tooltipView(state,'skill','knibbs','cover')),/所有存活队员.*伤害降低 30%/);
 state.boss.broken=true;endRound(state);
 assert.doesNotMatch(statusBadges(state,knibbs),/data-detail="cover"/);assert.equal(knibbs.shield,0);
});

test('3.7 UI: the finale requires a real character defense cast rather than a retired response field',()=>{
 const state=createBattle('standard','final');Object.assign(state.boss,{finale:true,hp:0,finalePhysical:1,finaleMagic:1});
 state.response={id:'parry',actor:'knibbs'};heroOf(state,'knibbs').intuition=3;
 assert.match(render(state),/角色防护 <b>待施放/);
 assert.equal(useSkill(state,'knibbs','cover').ok,true);
 assert.match(render(state),/角色防护 <b>✓/);
 for(const html of [render(state),helpView(state),bossCodexView(state),tooltipView(state,'hero','knibbs')]){
  assert.doesNotMatch(html,/招架|回避|迎击|预备应对|data-response=|data-action="guard"/);
 }
});

test('3.7 UI: codex health follows each encounter and party size, while title challenges exclude tutorials',()=>{
 for(const count of [1,2,3]){
  const partyIds=['knibbs','apeilia','ric'].slice(0,count),state=createBattle('standard','scout',{partyIds}),before=structuredClone(state);
  for(const boss of Object.values(BOSSES)){
   const expected=createBattle('standard',boss.id,{partyIds}),html=bossCodexView(state,boss.id);
   assert.ok(html.includes(`<b>${expected.boss.maxHp}</b>`),`${boss.id}/${count}`);
   assert.doesNotMatch(html,/undefined|NaN|招架|回避|迎击/);
  }
  assert.deepEqual(state,before);
 }
 const html=titleView({difficulty:'standard',challengeMode:'solo',bossId:'scout'},null,'',[],'',{unlockedBosses:Object.keys(BOSSES)});
 assert.equal((html.match(/data-boss=/g)||[]).length,10);assert.equal((html.match(/data-solo-hero=/g)||[]).length,1);
 assert.doesNotMatch(html,/data-boss="scout"|data-boss="bulwark"|data-boss="conduit"/);
});
