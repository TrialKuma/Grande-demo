import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,REWARDS,BOSSES,createBattle,heroOf,canUse,useSkill,guard,endRound,skillPreview,activeSkills,resolvedSkill} from '../src/combat.js';
import {grantShield,absorbShield} from '../src/shields.js';
const roster=['haart','qianxing','knibbs'];
const battle=(upgrades=[],boss='golem',loadouts={})=>createBattle('standard',boss,{partyIds:roster,upgrades,loadouts});
const equip=(hero,id)=>({[hero]:[...SKILLS[hero].slice(0,4).map(s=>s.id),id]});
const cast=(state,id,skill)=>{const result=useSkill(state,id,skill);assert.equal(result.ok,true,result.error);return result;};
test('canon: seven heroes keep four primary resource types, five base slots and five rewards each',()=>{
  assert.deepEqual(HEROES.map(h=>h.id),['knibbs','apeilia','ric','haart','qianxing','youmu','patch']);
  assert.deepEqual([...new Set(HEROES.map(h=>h.resourceName))].sort(),['平衡','气息','连击','魔力'].sort());
  const state=battle();assert.equal(state.version,8);assert.equal(Object.keys(REWARDS).length,35);
  for(const id of roster)assert.equal(heroOf(state,id).resource,10);
  for(const id of ['haart','qianxing']){assert.equal(SKILLS[id].length,7);assert.equal(activeSkills(state,id).length,5);assert.equal(Object.values(REWARDS).filter(r=>r.heroId===id).length,5);assert.equal(heroOf(state,id).secondary,0);}
  assert.equal(createBattle().heroes.find(h=>h.id==='apeilia').resource,0);assert.equal(createBattle().heroes.find(h=>h.id==='ric').resource,0);
  assert.doesNotMatch(JSON.stringify([HEROES,SKILLS,REWARDS]),/棱光|蓄热|炉心过热|露弥|沃斯/);
});
for(const [id,convert,cash,rest,cost,refund] of [['haart','page','soothe','rest',2,3],['qianxing','spike','pulse','repair',3,4]]){
  test(`canon: ${id} pays conversion first and only secondary spending returns mana`,()=>{
    const state=battle(),h=heroOf(state,id);h.resource=cost-1;h.secondary=1;
    const before=structuredClone(state);assert.match(canUse(state,id,convert),/魔力不足/);assert.equal(useSkill(state,id,convert).ok,false);assert.deepEqual(state,before);
    h.resource=cost;h.secondary=0;const p=skillPreview(state,id,convert);assert.equal(p.cost,cost);assert.equal(p.refund,0);
    cast(state,id,convert);assert.equal(h.resource,0);assert.equal(h.secondary,1);cast(state,id,cash);assert.equal(h.resource,refund);assert.equal(h.secondary,0);
    const burst=battle(),e=heroOf(burst,id);cast(burst,id,convert);cast(burst,id,convert);assert.equal(e.secondary,2);assert.equal(e.resource,10-2*cost);
    const spend=id==='haart'?'relay':'beam',bulkRefund=id==='haart'?4:5;assert.equal(skillPreview(burst,id,spend).refund,bulkRefund);cast(burst,id,spend);assert.equal(e.resource,Math.min(10,10-2*cost+bulkRefund));assert.equal(e.secondary,0);
    assert.ok(bulkRefund<2*refund,'one larger payoff returns less mana than two one-stock payoffs');
  });
  test(`canon: ${id} emergency recovery separates conversion and cash-out and rounds never grant mana`,()=>{
    const state=battle(),h=heroOf(state,id);h.resource=0;
    const p=skillPreview(state,id,convert);assert.equal(p.damage,0);assert.equal(p.refund,0);cast(state,id,convert);assert.equal(h.secondary,1);assert.equal(h.resource,0);
    cast(state,id,cash);assert.equal(h.secondary,0);assert.equal(h.resource,refund);endRound(state);assert.equal(h.resource,refund);
    assert.equal(skillPreview(state,id,convert).variant,null);cast(state,id,convert);assert.equal(h.resource,refund-cost);assert.equal(h.secondary,1);cast(state,id,cash);const mana=h.resource;assert.equal(guard(state,id).ok,true);endRound(state);assert.equal(h.resource,mana);
    const prepared=battle(),q=heroOf(prepared,id),hp=prepared.heroes.map(x=>x.hp);cast(prepared,id,rest);assert.equal(q.resource,id==='haart'?2:1);assert.equal(q.secondary,q.maxSecondary);assert.deepEqual(prepared.heroes.map(x=>x.hp),hp);assert.ok(prepared.heroes.every(x=>x.shield===0));
    const before=structuredClone(prepared);assert.equal(useSkill(prepared,id,rest).ok,false);assert.deepEqual(prepared,before);
  });
}
test('canon: Haart teamwork reward strips buffs and protects through debuffs without healing',()=>{
  const state=battle(['haart_triage']);cast(state,'haart','page');assert.equal(skillPreview(state,'haart','soothe').empowered,false);cast(state,'knibbs','shot');state.boss.fog=2;
  for(const h of state.heroes)h.hp-=20;
  const hp=state.heroes.map(h=>h.hp),p=skillPreview(state,'haart','soothe');assert.equal(p.empowered,true);assert.equal(p.heal,0);assert.equal(p.allHeal,0);assert.equal(resolvedSkill(state,'haart','soothe').stripBuffs,1);
  cast(state,'haart','soothe');assert.equal(state.boss.fog,1);assert.equal(state.boss.weakened,1);assert.deepEqual(state.heroes.map(h=>h.hp),hp);endRound(state);assert.equal(skillPreview(state,'haart','soothe').empowered,false);
  const unowned=battle();cast(unowned,'haart','page');cast(unowned,'knibbs','shot');assert.equal(skillPreview(unowned,'haart','soothe').empowered,false);
});
test('canon: Haart weakness and Qianxing shield conditions require reward and live state',()=>{
  const state=battle(['haart_echo','qianxing_focus']);heroOf(state,'qianxing').secondary=2;
  assert.equal(skillPreview(state,'haart','page').empowered,false);assert.equal(skillPreview(state,'qianxing','beam').empowered,false);state.boss.weakened=1;grantShield(heroOf(state,'qianxing'),1);
  const h=skillPreview(state,'haart','page');assert.equal(h.hits,2);assert.equal(h.stagger,6);assert.equal(h.resourceAfter,8);assert.equal(resolvedSkill(state,'qianxing','beam').stripBuffs,1);assert.equal(skillPreview(state,'qianxing','beam').empowered,true);
  state.boss.weakened=0;absorbShield(heroOf(state,'qianxing'),1);assert.equal(skillPreview(state,'haart','page').empowered,false);assert.equal(skillPreview(state,'qianxing','beam').empowered,false);
});
test('canon: coordinated armor requires own fire, gives two retaliations, and caps only self shields',()=>{
  const state=battle(['qianxing_reinforce']),h=heroOf(state,'qianxing');assert.equal(skillPreview(state,h.id,'armor').empowered,false);cast(state,'knibbs','shot');assert.equal(skillPreview(state,h.id,'armor').empowered,false);
  cast(state,h.id,'repair');assert.equal(skillPreview(state,h.id,'armor').empowered,false);cast(state,h.id,'pulse');assert.equal(skillPreview(state,h.id,'armor').reflect,2);cast(state,h.id,'armor');assert.equal(h.shield,36);assert.equal(h.reflect,2);assert.ok(state.heroes.filter(p=>p.id!==h.id).every(p=>p.shield===0));cast(state,h.id,'armor');assert.equal(h.shield,60);assert.equal(h.reflect,2);assert.equal(h.secondary,0);
});
test('canon: spiked armor retaliates only against physical hits and never returns mana',()=>{
  const state=battle([], 'duelist'),h=heroOf(state,'qianxing');cast(state,h.id,'spike');cast(state,h.id,'armor');const mana=h.resource;state.boss.intentTarget=h.id;
  const retaliation=endRound(state).events.filter(e=>e.label==='钉刺反击');assert.equal(retaliation.length,1);assert.equal(retaliation[0].kind,'physical');assert.equal(h.reflect,0);assert.equal(h.resource,mana);assert.equal(h.secondary,0);
  const magic=battle([], 'cantor'),m=heroOf(magic,'qianxing');cast(magic,m.id,'spike');cast(magic,m.id,'armor');const magicMana=m.resource,r=endRound(magic);assert.equal(m.reflect,1);assert.ok(!r.events.some(e=>e.label==='钉刺反击'));assert.equal(m.resource,magicMana);
});
for(const [id,skill,key,prepare] of [['haart','network','haart_network','rest'],['qianxing','nova','qianxing_nova','repair']])test(`canon: ${id} reward skill needs an earned slot and a fully converted stock`,()=>{
  assert.match(canUse(battle(),id,skill),/尚未.*解锁/);assert.match(canUse(battle([key]),id,skill),/尚未装配/);const state=battle([key],'golem',equip(id,skill)),h=heroOf(state,id);cast(state,id,prepare);
  assert.equal(h.resource,id==='haart'?2:1);assert.equal(h.secondary,h.maxSecondary);const p=skillPreview(state,id,skill);assert.equal(p.cost,0);assert.equal(p.refund,id==='haart'?5:6);assert.equal(p.secondarySpend,h.maxSecondary);cast(state,id,skill);assert.equal(h.resource,7);assert.equal(h.secondary,0);if(id==='haart')assert.ok(state.heroes.every(p=>p.attackBuff===60&&p.shield===0));
});
for(const boss of Object.keys(BOSSES))test(`canon: previews match actual damage, mana and stagger for every mana skill against ${boss}`,()=>{
  for(const id of ['haart','qianxing'])for(const skill of SKILLS[id])for(const upgrade of [false,true]){
    const rewards=Object.keys(REWARDS).filter(key=>upgrade||REWARDS[key].kind==='skill');const state=battle(rewards,boss,skill.unlockKey?equip(id,skill.id):{}),h=heroOf(state,id);state.boss.hp=state.boss.maxHp=10000;
    h.resource=10;h.secondary=skill.secondaryCost?h.maxSecondary:0;if(upgrade){grantShield(h,10);state.boss.weakened=1;if(id==='qianxing')h.used.push('spike');cast(state,'knibbs','shot');}for(const p of state.heroes)p.hp-=40;
    const before=structuredClone(state),p=skillPreview(state,id,skill.id);assert.deepEqual(state,before);const result=cast(state,id,skill.id);const damage=result.events.filter(e=>e.type==='attack'&&e.targets.includes('boss')).reduce((sum,e)=>sum+e.amount,0);
    assert.equal(p.damage,damage,`${id}/${skill.id} damage`);assert.equal(p.resourceAfter,h.resource,`${id}/${skill.id} mana`);assert.equal(p.secondaryAfter,h.secondary,`${id}/${skill.id} secondary`);assert.equal(p.stagger,before.boss.stagger-state.boss.stagger,`${id}/${skill.id} stagger`);
  }
});
test('canon: mirror backlash preview includes retaliation and the shot conversion still pays full mana',()=>{
  const state=battle([], 'duelist'),h=heroOf(state,'qianxing');cast(state,h.id,'spike');cast(state,h.id,'armor');state.boss.intent='mirror';const before=structuredClone(state),p=skillPreview(state,h.id,'spike');assert.deepEqual(state,before);const attacks=cast(state,h.id,'spike').events.filter(e=>e.type==='attack');
  assert.equal(attacks.length,2);assert.equal(p.damage,attacks.reduce((sum,e)=>sum+e.amount,0));assert.equal(h.resource,7);assert.equal(p.resourceAfter,7);assert.equal(h.secondary,1);assert.ok(p.notes.some(note=>note.includes('钉刺反击')));
});
