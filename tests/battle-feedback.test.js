import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,heroOf,useSkill,endRound,prepareResponse} from '../src/combat.js';
import {damagingEvent,hpLossFor,hitDamageFor,impactTiming,attackTheme,materialFor,createFeedbackState,applyFeedbackImpact} from '../src/battle-feedback.js';
import {battleView} from '../src/interface.js';
import {addAttributeEffect} from '../src/attributes.js';

test('feedback: each hit reports real HP loss, including overkill and changing enemy layers',()=>{
  const s=createBattle('standard','duelist',{loadouts:{knibbs:['shot','focus','scatter','cover']}});useSkill(s,'knibbs','scatter');heroOf(s,'knibbs').intuition=0;s.boss.hp=3;
  addAttributeEffect(s.boss,{id:'impact-fixture',label:'防护',stats:{agility:30},turns:1});
  const event=useSkill(s,'knibbs','shot').events.find(e=>e.type==='attack');
  assert.equal(event.skillId,'shot');assert.equal(event.bossId,'duelist');
  assert.deepEqual(event.hitAmounts.boss,[1,1,1,0,0,0]);
  assert.equal(hpLossFor(event,'boss'),3);
  assert.equal(Array.from({length:6},(_,i)=>hitDamageFor(event,'boss',i)).reduce((a,b)=>a+b),3);
  const caster=createBattle('standard','duelist'),before=caster.boss.hp;
  const magic=useSkill(caster,'apeilia','purify').events.find(e=>e.type==='attack');
  assert.equal(magic.hitAmounts.boss.reduce((a,b)=>a+b),before-caster.boss.hp);
});

test('feedback: full shield absorption produces zero injuries, partial absorption reports only lost life',()=>{
  for(const shield of [60,10]){
    const s=createBattle('standard','duelist'),h=heroOf(s,'knibbs');useSkill(s,'knibbs','loadburst');useSkill(s,'knibbs','cover');h.shield=shield;
    const before=h.hp;
    const events=endRound(s).events.filter(e=>e.type==='boss'&&e.amounts);
    assert.ok(events.length>0);assert.ok(events.some(e=>e.absorbedAmounts.knibbs>0));
    assert.equal(events.reduce((n,e)=>n+hpLossFor(e,'knibbs'),0),before-h.hp);
    if(shield===60)assert.ok(events.every(e=>hpLossFor(e,'knibbs')===0));
    else assert.ok(before-h.hp>0);
  }
});

test('feedback: registering core hits, healing and shield grants never become HP injuries',()=>{
  const s=createBattle('standard','golem',{loadouts:{knibbs:['shot','focus','scatter','cover']}});useSkill(s,'knibbs','scatter');s.boss.core=true;s.boss.hp=0;
  const e=useSkill(s,'knibbs','shot').events.find(e=>e.type==='attack');
  assert.equal(e.amount,0);assert.equal(hpLossFor(e,'boss'),0);assert.ok(e.hitAmounts.boss.every(n=>n===0));
  for(const type of ['heal','shield','buff','phase','break']){
    const harmless={type,amount:99,amounts:{knibbs:99},hpLosses:{knibbs:99}};
    assert.equal(damagingEvent(harmless),false);assert.equal(hpLossFor(harmless,'knibbs'),0);
  }
  assert.equal(hpLossFor({type:'boss',hpLosses:{knibbs:0},amount:50},'knibbs'),0);
});

test('feedback: every multi-hit impact fits inside its animation and split damage preserves the total',()=>{
  for(const style of ['shot','slash','quake','mist','rune','burst','counter'])for(let hits=1;hits<=6;hits++){
    const e={type:'attack',style,hits,amounts:{boss:17}},t=impactTiming(e);
    assert.ok(t.impactAt>0);assert.ok(t.duration>=t.impactAt+(hits-1)*t.interval+.35);
    assert.equal(Array.from({length:hits},(_,i)=>hitDamageFor(e,'boss',i)).reduce((a,b)=>a+b),17);
  }
});

test('feedback: weapon themes and target materials are independent of each other',()=>{
  assert.equal(attackTheme({actor:'knibbs',style:'shot'}),'ballistic');
  assert.equal(attackTheme({actor:'qianxing',kind:'magic'}),'silverfire');
  assert.equal(attackTheme({actor:'haart',kind:'magic'}),'mind');
  assert.equal(attackTheme({actor:'boss',bossId:'tide'}),'water');
  assert.equal(attackTheme({actor:'boss',bossId:'furnace'}),'furnace');
  assert.equal(materialFor('boss','golem'),'stone');
  assert.equal(materialFor('boss','duelist'),'metal');
  assert.equal(materialFor('boss','weaver'),'paper');
  assert.equal(materialFor('qianxing','golem'),'metal');
});

test('feedback: health display advances only at contact and never mutates the resolved battle',()=>{
  const state=createBattle('standard','tide'),before=structuredClone(state);
  const event=useSkill(state,'apeilia','purify').events.find(e=>e.type==='attack');
  const resolved=structuredClone(state),view=createFeedbackState(before,state);
  assert.equal(view.boss.hp,before.boss.hp);assert.equal(view.ap,state.ap);
  applyFeedbackImpact(view,event,0);assert.equal(view.boss.hp,before.boss.hp-event.hitAmounts.boss[0]);
  applyFeedbackImpact(view,event,1);assert.equal(view.boss.hp,state.boss.hp);
  assert.deepEqual(state,resolved);
  const old=view.heroes[0].hp;view.heroes[0].hp-=30;
  applyFeedbackImpact(view,{type:'heal',targets:['knibbs'],amounts:{knibbs:10}},0);
  assert.equal(view.heroes[0].hp,old-20);
  applyFeedbackImpact(view,{type:'shield',targets:['knibbs'],amounts:{knibbs:18}},0);
  assert.equal(view.heroes[0].shield,18);
});

const replay=(view,event)=>{for(let i=0;i<impactTiming(event).hits;i++)applyFeedbackImpact(view,event,i);};
const hud=view=>battleView(view,true,'','00:00',null);

test('feedback: the last shell hit reaches zero on the health bar before core or finale appears',()=>{
  for(const bossId of ['golem','final']){
    const state=createBattle('standard',bossId,{loadouts:{knibbs:['shot','focus','scatter','cover']}});useSkill(state,'knibbs','scatter');state.boss.hp=1;
    const before=structuredClone(state),result=useSkill(state,'knibbs','shot'),resolved=structuredClone(state);
    const view=createFeedbackState(before,state),attack=result.events.find(e=>e.type==='attack'),phase=result.events.find(e=>['phase','core'].includes(e.type));
    assert.ok(phase);assert.equal(view.boss.hp,1);assert.equal(view.boss.core,false);assert.equal(view.boss.finale,false);
    assert.match(hud(view),/class="foe-health"/);
    replay(view,attack);
    assert.equal(view.boss.hp,0);assert.match(hud(view),/class="foe-health"><i style="width:0%"/);
    assert.equal(view.boss.core,false);assert.equal(view.boss.finale,false);
    assert.deepEqual(phase.phaseAfter,{stage:state.boss.stage,core:bossId==='golem',finale:bossId==='final'});
    assert.equal(phase.hpAfter,0);
    applyFeedbackImpact(view,phase,1);assert.match(hud(view),/class="foe-health"/);
    applyFeedbackImpact(view,phase,0);
    assert.doesNotMatch(hud(view),/class="foe-health"/);
    assert.equal(view.boss.core,state.boss.core);assert.equal(view.boss.finale,state.boss.finale);
    assert.deepEqual(state,resolved);
  }
});

test('feedback: all ordinary boss stage changes use event snapshots at their own impact',()=>{
  for(const bossId of ['golem','duelist','cantor','warden','weaver','final','tide','furnace','orrery','arbiter']){
    const state=createBattle('standard',bossId);state.boss.hp=Math.ceil(state.boss.maxHp*(bossId==='golem'?.8:.5))+1;
    const before=structuredClone(state),result=useSkill(state,'knibbs','shot');
    const phase=result.events.find(e=>e.type==='phase'),view=createFeedbackState(before,state);
    assert.ok(phase,bossId);assert.equal(view.boss.stage,0,bossId);
    replay(view,result.events.find(e=>e.type==='attack'));assert.equal(view.boss.stage,0,bossId);
    const snapshot=structuredClone(phase.phaseAfter),hpAfter=phase.hpAfter;
    state.boss.stage=9;state.boss.hp=1;
    assert.deepEqual(phase.phaseAfter,snapshot);assert.equal(phase.hpAfter,hpAfter);
    applyFeedbackImpact(view,phase,0);assert.equal(view.boss.stage,snapshot.stage);assert.equal(view.boss.hp,hpAfter);
  }
});

test('feedback: core reformation and finale restart restore the displayed health at the phase impact',()=>{
  for(const bossId of ['golem','final']){
    const state=createBattle('standard',bossId),flag=bossId==='golem'?'core':'finale';
    Object.assign(state.boss,{hp:0,[flag]:true,[flag+'Fresh']:false,[flag+'Turns']:1});
    const before=structuredClone(state),result=endRound(state),resolved=structuredClone(state),view=createFeedbackState(before,state);
    const phase=result.events.find(e=>e.type==='phase');
    assert.ok(phase);assert.equal(phase.hpAfter,Math.round(state.boss.maxHp*(bossId==='golem'?.28:.22)));
    assert.equal(view.boss[flag],true);assert.equal(view.boss.hp,0);assert.doesNotMatch(hud(view),/class="foe-health"/);
    for(const event of result.events){
      if(event===phase){assert.equal(view.boss[flag],true);assert.equal(view.boss.hp,0);}
      replay(view,event);
      if(event===phase){assert.equal(view.boss[flag],false);assert.equal(view.boss.hp,phase.hpAfter);assert.match(hud(view),/class="foe-health"/);}
    }
    assert.equal(view.boss.hp,state.boss.hp);assert.equal(view.boss.stage,state.boss.stage);assert.deepEqual(state,resolved);
  }
});

test('feedback: victory and defeat stay pending until the terminal event impact',()=>{
  for(const outcome of ['victory','defeat']){
    const state=createBattle('standard','duelist',{mode:'solo',partyIds:['knibbs']});
    if(outcome==='victory')state.boss.hp=1;else state.heroes[0].hp=1;
    const before=structuredClone(state),result=outcome==='victory'?useSkill(state,'knibbs','shot'):endRound(state),resolved=structuredClone(state);
    assert.equal(state.mode,outcome);
    const view=createFeedbackState(before,state);assert.equal(view.mode,'playing');
    for(const event of result.events){
      if(event.type===outcome){
        assert.equal(outcome==='victory'?view.boss.hp:view.heroes[0].hp,0);
        applyFeedbackImpact(view,event,1);assert.equal(view.mode,'playing');
      }
      replay(view,event);
      assert.equal(view.mode,event.type===outcome?outcome:'playing');
    }
    assert.deepEqual(state,resolved);
  }
});
