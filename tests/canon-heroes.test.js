import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,REWARDS,BOSSES,createBattle,heroOf,canUse,useSkill,guard,endRound,skillPreview,activeSkills} from '../src/combat.js';

const roster=['haart','qianxing','knibbs'];
function battle(upgrades=[],boss='golem',equipped={}){
  return createBattle('standard',boss,{partyIds:roster,upgrades,loadouts:equipped});
}
function grantFifth(hero,id){return {[hero]:[...SKILLS[hero].slice(0,3).map(s=>s.id),id]};}

test('canon: seven heroes use only the four established resource types',()=>{
  assert.deepEqual(HEROES.map(h=>h.id),['knibbs','apeilia','ric','haart','qianxing','youmu','patch']);
  assert.deepEqual([...new Set(HEROES.map(h=>h.resourceName))].sort(),['平衡','气息','连击','魔力'].sort());
  const state=battle();assert.equal(state.version,5);
  for(const id of roster)assert.equal(heroOf(state,id).resource,10);
  assert.equal(createBattle().heroes.find(h=>h.id==='apeilia').resource,0);
  assert.equal(createBattle().heroes.find(h=>h.id==='ric').resource,0);
  assert.equal(Object.keys(REWARDS).length,21);
  for(const id of ['haart','qianxing']){
    assert.equal(SKILLS[id].length,6);assert.equal(activeSkills(state,id).length,5);
    assert.equal(Object.values(REWARDS).filter(r=>r.heroId===id).length,3);
  }
  assert.doesNotMatch(JSON.stringify([HEROES,SKILLS,REWARDS]),/棱光|蓄热|炉心过热|露弥|沃斯/);
});

for(const [id,cast,base,rest,cost] of [['haart','relay','page','rest',6],['qianxing','beam','spike','repair',6]]){
  test(`canon: ${id} pays the full mana cost before receiving its refund`,()=>{
    const state=battle(),h=heroOf(state,id);h.resource=cost-1;
    const before=structuredClone(state);
    assert.match(canUse(state,id,cast),/魔力不足/);
    assert.equal(useSkill(state,id,cast).ok,false);assert.deepEqual(state,before);
    h.resource=cost;
    const preview=skillPreview(state,id,cast);
    assert.equal(preview.cost,cost);assert.equal(preview.refund,2);assert.equal(preview.resourceAfter,2);
    assert.equal(useSkill(state,id,cast).ok,true);assert.equal(h.resource,2);
  });
  test(`canon: ${id} free attacks and once-per-round recovery have no paid-spell refund`,()=>{
    const state=battle(),h=heroOf(state,id);h.resource=0;h.hp-=50;
    assert.equal(useSkill(state,id,base).ok,true);assert.equal(h.resource,1);
    assert.equal(skillPreview(state,id,rest).refund,0);
    assert.equal(useSkill(state,id,rest).ok,true);assert.equal(h.resource,5);
    const before=structuredClone(state);
    assert.equal(useSkill(state,id,rest).ok,false);assert.deepEqual(state,before);
    assert.equal(useSkill(state,id,base).ok,true);assert.equal(h.resource,6);
    assert.equal(guard(state,id).ok,true);assert.equal(h.resource,6);
    assert.equal(endRound(state).ok,true);assert.equal(h.resource,6,'passing a round and taking damage cannot restore mana');
    assert.equal(useSkill(state,id,rest).ok,true);assert.equal(h.resource,10,'recovery is capped at ten');
  });
}

test('canon: haart healing needs both its reward and a different teammate to have acted',()=>{
  const state=battle(['haart_triage']),h=heroOf(state,'haart');
  assert.equal(skillPreview(state,'haart','soothe').empowered,false);
  useSkill(state,'haart','page');assert.equal(skillPreview(state,'haart','soothe').empowered,false,'own action cannot trigger teamwork');
  useSkill(state,'knibbs','shot');
  for(const p of state.heroes){p.hp=20;p.resonance=3;}
  const before=structuredClone(state),preview=skillPreview(state,'haart','soothe');
  assert.equal(preview.empowered,true);assert.equal(preview.heal,58);assert.equal(preview.allHeal,22);assert.equal(preview.cleanse,2);
  assert.equal(useSkill(state,'haart','soothe').ok,true);
  assert.equal(state.stats.healed-before.stats.healed,102);assert.equal(h.resource,preview.resourceAfter);
  assert.ok(state.heroes.every(p=>p.resonance===1));
  endRound(state);assert.equal(skillPreview(state,'haart','soothe').empowered,false,'teamwork resets with the round');
  const unowned=battle();useSkill(unowned,'knibbs','shot');assert.equal(skillPreview(unowned,'haart','soothe').empowered,false);
});

test('canon: shield-dependent spell upgrades are live conditions, not new resource bars',()=>{
  const state=battle(['haart_echo','qianxing_focus']);
  assert.equal(skillPreview(state,'haart','page').empowered,false);
  assert.equal(skillPreview(state,'qianxing','beam').empowered,false);
  heroOf(state,'haart').shield=1;heroOf(state,'qianxing').shield=1;
  let preview=skillPreview(state,'haart','page');assert.equal(preview.hits,2);assert.equal(preview.stagger,16);assert.equal(preview.resourceAfter,10);
  preview=skillPreview(state,'qianxing','beam');assert.equal(preview.empowered,true);assert.equal(preview.stagger,44);
  heroOf(state,'haart').shield=0;heroOf(state,'qianxing').shield=0;
  assert.equal(skillPreview(state,'haart','page').empowered,false);assert.equal(skillPreview(state,'qianxing','beam').empowered,false);
});

test('canon: coordinated armor protects the whole party and respects shield caps',()=>{
  const state=battle(['qianxing_reinforce']);
  assert.equal(skillPreview(state,'qianxing','armor').allShield,0);
  useSkill(state,'knibbs','shot');
  const preview=skillPreview(state,'qianxing','armor');assert.equal(preview.empowered,true);assert.equal(preview.allShield,14);
  assert.equal(useSkill(state,'qianxing','armor').ok,true);
  assert.equal(heroOf(state,'qianxing').shield,50);
  assert.equal(heroOf(state,'haart').shield,14);assert.equal(heroOf(state,'knibbs').shield,14);
  heroOf(state,'qianxing').resource=10;
  useSkill(state,'qianxing','armor');assert.equal(heroOf(state,'qianxing').shield,60);
  assert.equal(heroOf(state,'qianxing').reflect,2);
});

test('canon: spiked armor retaliates only against physical hits and does not generate mana',()=>{
  const state=battle([], 'duelist'),h=heroOf(state,'qianxing');
  useSkill(state,'qianxing','armor');assert.equal(h.resource,7);
  state.boss.intentTarget='qianxing';
  const result=endRound(state),retaliation=result.events.filter(e=>e.label==='钉刺反击');
  assert.equal(retaliation.length,1);assert.equal(retaliation[0].kind,'physical');assert.equal(h.reflect,0);assert.equal(h.resource,7);
  const magic=battle([], 'cantor'),m=heroOf(magic,'qianxing');useSkill(magic,'qianxing','armor');
  const magicRound=endRound(magic);assert.equal(m.reflect,1);
  assert.ok(!magicRound.events.some(e=>e.label==='钉刺反击'));assert.equal(m.resource,7);
});

for(const [hero,skill,key,cost] of [['haart','network','haart_network',6],['qianxing','nova','qianxing_nova',8]]){
  test(`canon: ${hero} reward skill remains a real unlocked and equipped reward`,()=>{
    const locked=battle();assert.match(canUse(locked,hero,skill),/尚未.*解锁/);
    const unpacked=battle([key]);assert.match(canUse(unpacked,hero,skill),/尚未装配/);
    const state=battle([key],'golem',grantFifth(hero,skill)),h=heroOf(state,hero);
    const preview=skillPreview(state,hero,skill);assert.equal(preview.cost,cost);
    assert.equal(useSkill(state,hero,skill).ok,true);assert.equal(h.resource,12-cost);
    if(skill==='network')assert.ok(state.heroes.every(p=>p.shield===28));
  });
}

for(const boss of Object.keys(BOSSES)){
  test(`canon: previews match actual damage, mana, healing and stagger for every new skill against ${boss}`,()=>{
    for(const hero of ['haart','qianxing'])for(const skill of SKILLS[hero])for(const upgrade of [false,true]){
      const rewards=Object.keys(REWARDS).filter(key=>upgrade||REWARDS[key].kind==='skill');
      const loadout=skill.unlockKey?grantFifth(hero,skill.id):{};
      const state=battle(rewards,boss,loadout);state.boss.hp=state.boss.maxHp=10000;
      const h=heroOf(state,hero);h.resource=8;h.shield=upgrade?10:0;
      for(const p of state.heroes)p.hp-=70;
      if(upgrade)useSkill(state,'knibbs','shot');
      const before=structuredClone(state),preview=skillPreview(state,hero,skill.id);
      assert.deepEqual(state,before,'preview is pure');
      const result=useSkill(state,hero,skill.id);assert.equal(result.ok,true,`${hero}/${skill.id}`);
      const damage=result.events.filter(e=>e.type==='attack'&&e.targets.includes('boss')).reduce((sum,e)=>sum+e.amount,0);
      assert.equal(preview.damage,damage,`${hero}/${skill.id} damage`);
      assert.equal(preview.resourceAfter,h.resource,`${hero}/${skill.id} mana`);
      assert.equal(preview.stagger,before.boss.stagger-state.boss.stagger,`${hero}/${skill.id} stagger`);
    }
  });
}

test('canon: mirror backlash preview includes physical armor retaliation without a hidden heat gain',()=>{
  const state=battle([], 'duelist'),h=heroOf(state,'qianxing');
  useSkill(state,'qianxing','armor');state.boss.intent='mirror';
  const before=structuredClone(state),preview=skillPreview(state,'qianxing','spike');assert.deepEqual(state,before);
  const result=useSkill(state,'qianxing','spike');
  const attacks=result.events.filter(e=>e.type==='attack');assert.equal(attacks.length,2);
  assert.equal(preview.damage,attacks.reduce((sum,e)=>sum+e.amount,0));assert.equal(h.resource,8);assert.equal(preview.resourceAfter,8);
  assert.ok(preview.notes.some(note=>note.includes('钉刺反击')));
});
