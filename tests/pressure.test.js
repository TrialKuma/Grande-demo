import test from 'node:test';
import assert from 'node:assert/strict';
import {BOSSES,createBattle,useSkill,prepareResponse,endRound,skillPreview,intentInfo,responseOptions} from '../src/combat.js';
import {bossCodexView} from '../src/boss-codex.js';
import {runPolicy} from '../scripts/pressure-probe.mjs';

test('pressure: idle standard encounters defeat the party in 4–7 enemy actions',()=>{
  for(const id of Object.keys(BOSSES)){
    const result=runPolicy(id,'pass-only');
    assert.equal(result.result,'defeat',id);
    assert.ok(result.enemyActions>=4&&result.enemyActions<=(id==='arbiter'?7:6),`${id}: ${result.enemyActions}`);
    assert.equal(result.recoveryAp,0);
  }
});

test('pressure: damage-only play pays a visible survival cost and cannot brute-force the last encounter',()=>{
  const results=Object.keys(BOSSES).map(id=>runPolicy(id,'raw-damage'));
  assert.equal(results.find(result=>result.boss==='final').result,'defeat');
  assert.ok(results.filter(result=>result.minimumHpPercent<=25).length>=4,'at least four encounters put a hero in critical condition');
  for(const result of results){assert.equal(result.recoveryAp,0);assert.deepEqual(result.responses,{parry:0,evade:0,counter:0});}
});

test('pressure: fixed parry differs from mixed response and recovery in the later standard encounters',()=>{
  const later=['warden','weaver','final'];
  const tactical=later.map(id=>runPolicy(id,'tactical'));
  const parry=later.map(id=>runPolicy(id,'parry-greedy'));
  for(const result of tactical)assert.equal(result.result,'victory',result.boss);
  assert.ok(tactical.reduce((sum,result)=>sum+result.recoveryAp,0)>0,'this policy invests AP in recovery across the later encounters');
  assert.ok(tactical.find(result=>result.boss==='weaver').hpPercent>30,'the updated sword/gun policy survives the weaver with an observable margin');
  assert.ok(tactical.at(-1).recoveryAp>0,'this policy invests in recovery against the final boss');
  for(const result of parry)assert.equal(result.recoveryAp,0);
  assert.ok(parry.at(-1).result==='defeat'||parry.at(-1).hpPercent<15,'fixed parry must not trivially preserve the party at the final boss');
  assert.ok(parry.at(-1).result==='defeat'||tactical.at(-1).hpPercent>parry.at(-1).hpPercent+15,'responding and recovering changes defeat into victory or creates a meaningful survival margin');
  assert.ok(tactical.some(result=>Object.values(result.responses).filter(value=>value>0).length>1));
});

test('pressure: standard single-target openers take roughly half of an unprotected hero',()=>{
  for(const id of ['golem','duelist','warden','final']){
    const state=createBattle('standard',id),before=state.heroes[0].hp;
    endRound(state);
    const fraction=(before-state.heroes[0].hp)/state.heroes[0].maxHp;
    assert.ok(fraction>=.45&&fraction<=.7,`${id}: ${fraction}`);
  }
});

test('pressure: one generic response cannot erase a dangerous party-wide attack',()=>{
  const situations=[['golem',{charging:true}],['duelist',{intent:'pierce'}],['cantor',{intent:'bloom',spores:3}],['warden',{intent:'storm',charge:3}],['weaver',{intent:'sever',seals:3}],['final',{intent:'zero_pulse',seals:3}]];
  for(const [boss,fields]of situations){
    const damages=[];
    for(const tactic of [null,'parry','evade']){
      const state=createBattle('standard',boss);Object.assign(state.boss,fields);
      if(tactic)assert.equal(prepareResponse(state,tactic,'knibbs').ok,true);
      const event=endRound(state).events.find(event=>event.type==='boss'&&event.amounts);
      damages.push(event.amounts.knibbs);
    }
    assert.ok(damages[0]>=50&&damages[0]<=105,`${boss} dangerous base damage: ${damages}`);
    assert.ok(damages[1]>=damages[0]*.69,`${boss} parry should retain roughly 70% incoming damage`);
    assert.ok(damages[2]>=damages[0]*.39,`${boss} evade should retain roughly 40% incoming damage`);
    assert.ok(damages[2]<damages[1]&&damages[1]<damages[0]);
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

test('pressure: an enemy-phase posture break gives one damage window while the next telegraph remains live',()=>{
  const state=createBattle('standard','duelist');state.boss.stagger=15;
  prepareResponse(state,'parry','knibbs');endRound(state);
  assert.equal(state.boss.exposed,true);assert.equal(state.boss.broken,false);assert.equal(state.boss.controlImmune,1);
  assert.equal(state.boss.stagger,state.boss.maxStagger);
  assert.match(intentInfo(state).desc,/仍会出招/);
  assert.ok(responseOptions(state).every(option=>!option.description.includes('无敌方主招')));
  const plain=structuredClone(state);plain.boss.exposed=false;
  assert.ok(skillPreview(state,'apeilia','purify').damage>skillPreview(plain,'apeilia','purify').damage);
  const preview=skillPreview(state,'apeilia','purify');
  const attack=useSkill(state,'apeilia','purify').events.find(event=>event.type==='attack');assert.equal(attack.amount,preview.damage);
  prepareResponse(state,'evade','knibbs');const events=endRound(state).events;
  assert.ok(events.some(event=>event.type==='boss'&&event.amounts));assert.equal(state.boss.exposed,false);
});

test('pressure: all ten in-game dossiers use current calculation and current party resource descriptions',()=>{
  const state=createBattle('standard','warden',{partyIds:['knibbs','haart','qianxing']});
  for(const id of Object.keys(BOSSES)){
    const markup=bossCodexView(state,id);
    assert.ok(markup.includes('最大韧性 160'));assert.ok(markup.includes('群体主招的招架减伤 30%、回避减伤 60%'));
    assert.ok(markup.includes('哈特与潜行回复魔力'));
    assert.ok(!/露弥|沃斯|棱光|蓄热|共 7 AP/.test(markup));
    assert.ok(markup.includes('下列招式与应对直接按战斗规则推演'));
  }
});
