import test from 'node:test';
import assert from 'node:assert/strict';
import {comboPlan,COMBO_MARKS} from '../src/boss-combos.js';

const hero=(id,extra={})=>({id,short:id,hp:170,maxHp:170,resonance:0,attributeBuffs:[],...extra});
const stateFor=(id,key,extra={})=>{
 const boss={id,unitId:'boss',intent:key,hp:900,stage:0,...extra};
 return {mode:'playing',round:2,boss,heroes:[hero('knibbs'),hero('ric'),hero('haart')],enemies:[boss]};
};
const plan=state=>comboPlan(state,state.boss,{key:state.boss.intent,group:false});
const mark=(state,id,heroId='knibbs',turns=2)=>state.heroes.find(hero=>hero.id===heroId).attributeBuffs.push({id,turns,stats:{...COMBO_MARKS[id]?.stats}});
const freeze=value=>{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};

test('combo plans do not mutate frozen snapshots or consume enemy layers',()=>{
 const state=stateFor('warden','ground',{charge:4,intentTarget:'ric'});mark(state,'conductive_brand');
 const before=JSON.stringify(state),result=plan(freeze(state));
 assert.equal(JSON.stringify(state),before);
 assert.deepEqual(result.after[0].targets,['knibbs']);
 assert.equal(result.after[0].type,'control');
 assert.equal(state.boss.charge,4);
});

test('mirror return blade follows its earlier victim and disappears when the mark or mirrors are removed',()=>{
 const state=stateFor('duelist','mirror',{mirror:2,intentTarget:'ric'});mark(state,'mirror_cut');
 assert.deepEqual(plan(state).after[0].targets,['knibbs']);
 assert.equal(plan(state).after[0].damage,8);
 state.boss.mirror=1;assert.equal(plan(state).after.length,0);
 state.boss.mirror=2;state.heroes[0].attributeBuffs=[];assert.equal(plan(state).after.length,0);
 assert.match(plan(state).hint,/净化刃痕/);
});

test('spore pursuit requires all three independently removable conditions',()=>{
 const state=stateFor('cantor','bloom',{spores:3});mark(state,'spore_scent');
 const sporeling={id:'sporeling',unitId:'enemy-1',hp:50};state.enemies.push(sporeling);
 assert.equal(plan(state).after.length,1);
 sporeling.hardControl=1;assert.equal(plan(state).after.length,0);sporeling.hardControl=0;
 sporeling.defeated=true;assert.equal(plan(state).after.length,0);sporeling.defeated=false;
 state.boss.spores=2;assert.equal(plan(state).after.length,0);state.boss.spores=3;
 state.heroes[0].attributeBuffs=[];assert.equal(plan(state).after.length,0);
});

test('grounding checks pre-action charge and cleansing the brand cancels its control',()=>{
 const state=stateFor('warden','ground',{charge:3});mark(state,'conductive_brand');
 const captured=plan(state);state.boss.charge=1;
 assert.equal(captured.after[0].control.type,'stun');
 assert.equal(plan(state).after.length,0);
 state.boss.charge=3;state.heroes[0].attributeBuffs=[];assert.equal(plan(state).after.length,0);
});

test('relay destruction or shutdown removes the storm arc',()=>{
 const state=stateFor('warden','storm',{charge:3});
 const relay={id:'relay',unitId:'enemy-1',hp:60};state.enemies.push(relay);
 assert.equal(plan(state).after[0].label,'回路余弧');
 relay.broken=true;assert.equal(plan(state).after.length,0);relay.broken=false;
 relay.pendingSpawn=true;assert.equal(plan(state).after.length,0);relay.pendingSpawn=false;
 relay.hp=0;assert.equal(plan(state).after.length,0);
});

test('weaver silence depends on both remaining pages and the written name',()=>{
 const state=stateFor('weaver','silence',{seals:2});mark(state,'written_name');
 assert.equal(plan(state).after[0].control.type,'silence');
 state.boss.seals=1;assert.equal(plan(state).after.length,0);
 state.boss.seals=2;state.heroes[0].attributeBuffs[0].turns=0;assert.equal(plan(state).after.length,0);
});

test('water-level threshold cancels the return anchor before the main action clears water',()=>{
 const state=stateFor('tide','tide_breaker',{waterLevel:3});
 const captured=plan(state);state.boss.waterLevel=0;
 assert.equal(captured.after[0].damage,8);assert.equal(plan(state).after.length,0);
 assert.match(captured.hint,/水位降到 2 以下/);
});

test('heat loss and cleansing are separate ways to remove the furnace splash',()=>{
 const state=stateFor('furnace','furnace_drop',{heat:3});mark(state,'scalded_armor');
 assert.equal(plan(state).after[0].target,'all');
 state.boss.heat=2;assert.equal(plan(state).after.length,0);state.boss.heat=3;
 state.heroes[0].attributeBuffs=[];assert.equal(plan(state).after.length,0);
});

test('orbital lock and current-round violations gate their marked control chains',()=>{
 for(const [id,key,field,markId,type] of [['orrery','orbit_collapse','prediction','charted_soul','silence'],['arbiter','edict_sentence','violations','listed_offender','stun']]){
  const state=stateFor(id,key,{[field]:2});mark(state,markId);
  assert.equal(plan(state).after[0].control.type,type);
  state.boss[field]=1;assert.equal(plan(state).after.length,0);state.boss[field]=2;
  state.heroes[0].attributeBuffs=[];assert.equal(plan(state).after.length,0);
 }
});

test('zero pulse needs exposure and shielding; the finale never acquires an extra combo',()=>{
 const state=stateFor('final','zero_pulse',{seals:2});mark(state,'zero_exposure');
 assert.equal(plan(state).after[0].kind,'physical');
 state.boss.seals=1;assert.equal(plan(state).after.length,0);
 state.boss.seals=3;state.boss.finale=true;assert.equal(plan(state).after.length,0);
});

test('existing giant stage tails are represented once and precede newly applied control',()=>{
 const state=stateFor('golem','compression',{stage:3,fog:2});state.heroes[0].resonance=3;
 const result=plan(state);
 assert.deepEqual(result.after.map(step=>step.type),['attack','attack','control']);
 assert.deepEqual(result.after.filter(step=>step.type==='attack').map(step=>step.damage),[12,9]);
 assert.equal(result.after.filter(step=>step.type==='control').length,1);
 state.boss.fog=1;assert.equal(plan(state).after.filter(step=>step.type==='control').length,0);
 state.boss.fog=2;state.heroes[0].resonance=2;assert.equal(plan(state).after.filter(step=>step.type==='control').length,0);
});

test('disabled sources, recorded actions, and hostile redirection cannot execute their combo',()=>{
 for(const field of ['broken','core','finale','hardControl','defeated']){
  const state=stateFor('duelist','mirror',{mirror:3,[field]:true});mark(state,'mirror_cut');
  assert.equal(plan(state).after.length,0,field);
 }
 const state=stateFor('duelist','mirror',{mirror:3});mark(state,'mirror_cut');
 state.boss.recordedIntent={intent:'mirror'};assert.equal(plan(state).after.length,0);
 state.boss.recordedIntent={intent:'rend'};assert.equal(plan(state).after.length,1);
 state.boss.recordedIntent=null;state.boss.confusion=true;state.enemies.push({id:'escort',unitId:'enemy-1',hp:50});
 assert.equal(plan(state).after.length,0);
});

test('control never targets a dead, already controlled, or recently recovered hero',()=>{
 const state=stateFor('weaver','silence',{seals:3});mark(state,'written_name');
 for(const values of [{hp:0},{control:{type:'stun'}},{controlGuard:1}]){
  Object.assign(state.heroes[0],{hp:170,control:null,controlGuard:0},values);
  assert.equal(plan(state).after.length,0);
 }
});

test('all formal bosses have a legible chain while teaching enemies remain simple',()=>{
 const setups=[['golem','fog'],['duelist','rend'],['cantor','sow'],['warden','arc',{charge:2}],['weaver','script'],['tide','tide_fill'],['furnace','furnace_vent',{heat:3}],['orrery','orbit_calibrate'],['arbiter','edict_mark',{violations:1}],['final','zero_field']];
 for(const [id,key,extra] of setups){
  const result=plan(stateFor(id,key,extra));assert.ok(result.after.length,id);assert.ok(result.hint.length>25,id);
  for(const step of result.after.filter(step=>step.type==='debuff')){
   assert.equal(step.effect.cleansable,true);assert.ok(step.effect.turns>=2);
   assert.ok(Object.keys(step.effect.stats).every(key=>['strength','intelligence','agility','will'].includes(key)));
  }
 }
 for(const id of ['scout','bulwark','conduit','patrol','relay_guard','escort','drone','sporeling','relay'])assert.deepEqual(plan(stateFor(id,'anything')).after,[]);
});

test('all-target attacks remain AOE in solo mode, and marked dead heroes do not transfer their pursuit',()=>{
 const solo=stateFor('furnace','furnace_drop',{heat:3});solo.heroes=solo.heroes.slice(0,1);mark(solo,'scalded_armor');
 assert.equal(plan(solo).after[0].target,'all');
 const state=stateFor('duelist','mirror',{mirror:3,intentTarget:'ric'});mark(state,'mirror_cut');state.heroes[0].hp=0;
 assert.equal(plan(state).after.length,0);
});

test('setup marks last through intervening rounds and keep their duration independent of returned objects',()=>{
 const state=stateFor('cantor','sow'),result=plan(state),effect=result.after[0].effect;
 assert.equal(effect.turns,3);effect.stats.will=-99;
 assert.equal(COMBO_MARKS.spore_scent.stats.will,-3);
 assert.equal(plan(state).after[0].effect.stats.will,-3);
});
