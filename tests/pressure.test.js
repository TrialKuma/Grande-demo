import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSSES,createBattle,useSkill,prepareResponse,endRound,skillPreview,intentInfo,responseOptions} from '../src/combat.js';
import {bossCodexView} from '../src/boss-codex.js';
import {runPolicy,attackPressure} from '../scripts/pressure-probe.mjs';

test('pressure: idle standard encounters keep the explicit 3–7 action baseline after mechanism scaling',()=>{
  const expectedActions={golem:6,duelist:5,cantor:4,warden:3,weaver:4,tide:3,furnace:6,orrery:6,arbiter:7,final:3};
  for(const id of Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion)){
    const result=runPolicy(id,'pass-only');
    assert.equal(result.result,'defeat',id);
    assert.equal(result.enemyActions,expectedActions[id],id);
    assert.equal(result.recoveryAp,0);
  }
});

test('pressure: damage-only play pays a visible survival cost and cannot brute-force the last encounter',()=>{
  const results=Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion).map(id=>runPolicy(id,'raw-damage'));
  assert.equal(results.find(result=>result.boss==='final').result,'defeat');
  assert.ok(results.filter(result=>result.minimumHpPercent<=25).length>=4,'at least four encounters put a hero in critical condition');
  for(const result of results){assert.equal(result.recoveryAp,0);assert.deepEqual(result.responses,{parry:0,evade:0,counter:0});}
});

test('pressure: fixed role defense differs from mixed skills and recovery in the later standard encounters',()=>{
  const later=['warden','weaver','final'];
  const tactical=later.map(id=>runPolicy(id,'tactical'));
  const parry=later.map(id=>runPolicy(id,'defense-greedy'));
  for(const result of tactical){
    assert.equal(result.result,'victory',result.boss);
    assert.deepEqual(result.upgrades,[],'the baseline cannot equip hidden growth rewards');
    assert.deepEqual(result.loadouts.knibbs,['shot','focus',result.boss==='warden'?'scatter':'loadburst','breathe']);
    for(const hero of ['knibbs','apeilia','ric'])assert.equal(result.loadouts[hero].length,4);
  }
  assert.ok(tactical.reduce((sum,result)=>sum+result.recoveryAp,0)>0,'this policy invests AP in recovery across the later encounters');
  assert.ok(tactical.find(result=>result.boss==='weaver').recoveryAp>0,'the weaver requires a visible investment in recovery');
  assert.ok(tactical.at(-1).recoveryAp>0,'this policy invests in recovery against the final boss');
  assert.notDeepEqual(parry.at(-1).actions,tactical.at(-1).actions,'a defense-only heuristic takes a different route from tailored play');
  assert.ok(tactical.at(-1).hpPercent>0);
  assert.ok(tactical.every(result=>Object.values(result.responses).every(value=>value===0)));
});

test('pressure: a role-defense policy prepares actual intuition and does not repeatedly buy an active negative domain',()=>{
  const result=runPolicy('golem','defense-greedy');
  const opening=result.actions.filter(action=>action.startsWith('R1 '));
  assert.ok(opening.indexOf('R1 knibbs/loadburst')<opening.indexOf('R1 knibbs/cover'));
  assert.ok(opening.includes('R1 knibbs/cover'));
  assert.equal(opening.filter(action=>action==='R1 ric/mend').length,1);
  assert.ok(opening.some(action=>action==='R1 knibbs/shot'),'the prepared round can still be fired after its intuition is used defensively');
});

test('pressure: cover comparison pays the legal three-AP setup and reports dead casters as unavailable',()=>{
  const rows=attackPressure('golem'),opening=rows[0];
  assert.deepEqual(opening.preparationAp,{none:0,cover:3,mend:2});
  const state=createBattle('standard','golem',{loadouts:{knibbs:['shot','focus','loadburst','cover']}});
  assert.equal(state.heroes[0].intuition,0);
  assert.ok(useSkill(state,'knibbs','loadburst').ok);
  assert.ok(useSkill(state,'knibbs','cover').ok);
  assert.equal(state.ap,3);
  const hp=state.heroes.map(hero=>hero.hp);endRound(state);
  assert.equal(opening.cover,state.heroes.map((hero,index)=>hp[index]-hero.hp).join('/'));
  assert.equal(opening.none,'85/0/0');assert.equal(opening.cover,'67/0/0');
  assert.equal(opening.mend,'82/0/0');
  const later=rows.find(row=>row.unavailable.cover);
  assert.ok(later);assert.equal(later.cover,null);assert.equal(later.unavailable.cover,'角色已倒下');
});

test('pressure: standard single-target openers take roughly half of an unprotected hero',()=>{
  for(const id of ['golem','duelist','warden','final']){
    const state=createBattle('standard',id),before=state.heroes[0].hp;
    endRound(state);
    const fraction=(before-state.heroes[0].hp)/state.heroes[0].maxHp;
    assert.ok(fraction>=.45&&fraction<=.72,`${id}: ${fraction}`);
  }
});

test('pressure: role cover costs AP and preserves visible pressure from dangerous party-wide attacks',()=>{
 const situations=[['golem',{charging:true}],['duelist',{intent:'pierce'}],['cantor',{intent:'bloom',spores:3}],['warden',{intent:'storm',charge:3}],['weaver',{intent:'sever',seals:3}],['final',{intent:'zero_pulse',seals:3}]];
 for(const [boss,fields]of situations){
  const plain=createBattle('standard',boss);Object.assign(plain.boss,fields);const covered=structuredClone(plain);covered.heroes[0].intuition=3;
  assert.ok(useSkill(covered,'knibbs','cover').ok);assert.equal(covered.ap,5);
  const base=endRound(plain).events.find(e=>e.type==='boss').amounts.knibbs;
  const reduced=endRound(covered).events.find(e=>e.type==='boss').amounts.knibbs;
  assert.ok(reduced>0&&reduced<base,`${boss}: ${base} → ${reduced}`);
 }
});

test('pressure: setup and healing turns advertise their actual damaging pulse',()=>{
  const situations=[['golem','fog'],['golem','reclaim'],['cantor','weave'],['warden','charge'],['weaver','rewrite'],['final','zero_reset']];
  for(const [boss,intent]of situations){
    const state=createBattle('standard',boss);state.boss.intent=intent;
    const info=intentInfo(state);
    const event=endRound(state).events.find(event=>event.type==='boss'&&event.amounts);
    assert.ok(event.amounts.knibbs>0,`${boss}/${intent} must apply the advertised pulse`);
    assert.ok(info.desc.includes(`${event.amounts.knibbs} 魔法伤害`),`${boss}/${intent}: ${info.desc}`);
  }
});

test('pressure: role-skill posture break cancels exactly one turn and then restores a live telegraph',()=>{
 const state=createBattle('standard','duelist');state.boss.stagger=10;state.heroes[0].intuition=3;
 assert.ok(useSkill(state,'knibbs','cover').ok);assert.equal(state.boss.broken,false);assert.ok(state.boss.cover);
 const hp=state.heroes.map(h=>h.hp);endRound(state);assert.deepEqual(state.heroes.map(h=>h.hp),hp);assert.equal(state.boss.controlImmune,1);
 const next=endRound(state);assert.ok(next.events.some(e=>e.type==='boss'));assert.equal(state.boss.controlImmune,0);
});

test('pressure: all ten in-game dossiers use current calculation and current party resource descriptions',()=>{
  const state=createBattle('standard','warden',{partyIds:['knibbs','haart','qianxing']});
  for(const id of Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial&&!BOSSES[id].isSkirmish&&!BOSSES[id].isMinion)){
    const markup=bossCodexView(state,id);
    assert.ok(markup.includes('最大韧性 160'));assert.ok(markup.includes('角色防护'));
    assert.ok(markup.includes('敏捷'));
    assert.ok(!/露弥|沃斯|棱光|蓄热|共 7 AP/.test(markup));
    assert.ok(markup.includes('招式伤害已经计入攻击属性'));
  }
});
