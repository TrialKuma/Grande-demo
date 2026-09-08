import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,enemyTargets,enemyThreats,selectEnemyTarget,useSkill,endRound,heroOf,skillPreview,normalizeLoadouts} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {createFeedbackState,applyFeedbackImpact} from '../src/battle-feedback.js';
const cast=(s,h,k,t)=>{const result=useSkill(s,h,k,t);assert.equal(result.ok,true,result.error);return result;};
const copy=s=>JSON.parse(JSON.stringify(s));

test('multi: single target identity isolates damage, selection and actual impact recipients',()=>{
 const s=createBattle('standard','relay_guard'),before=s.enemies.map(e=>e.hp);
 assert.equal(selectEnemyTarget(s,'enemy-2'),true);const r=cast(s,'knibbs','shot');
 assert.equal(s.boss,s.enemies[0]);assert.deepEqual(s.enemies.map((e,i)=>before[i]-e.hp),[0,0,27]);
 assert.deepEqual(r.events[0].targets,['enemy-2']);assert.equal(r.events[0].hpLosses['enemy-2'],27);
 assert.equal(r.events[0].enemyModels['enemy-2'],'scout');
 const frozen=structuredClone(s);assert.equal(useSkill(s,'knibbs','shot','missing').ok,false);assert.deepEqual(s,frozen);
});
test('multi: dead primary stays dead while adds act, dead targets cannot act or be selected, all must fall',()=>{
 const s=createBattle('standard','relay_guard');s.boss.hp=1;
 cast(s,'knibbs','shot','boss');assert.equal(s.mode,'playing');assert.equal(s.boss.defeated,true);
 assert.equal(selectEnemyTarget(s,'boss'),false);assert.equal(useSkill(s,'knibbs','shot','boss').ok,false);
 const saved=normalizeSave(copy(s));assert.ok(saved);assert.equal(saved.boss,saved.enemies[0]);
 endRound(s);const r=endRound(s);assert.ok(!r.events.some(e=>e.type==='boss'&&e.actor==='boss'));
 for(const e of s.enemies.filter(e=>!e.defeated)){e.hp=1;cast(s,'knibbs','shot',e.unitId);}
 assert.equal(s.mode,'victory');assert.equal(enemyTargets(s).length,0);
});
test('multi: guardian splits focused damage, a broken guardian cannot intercept, AoE bypasses splitting',()=>{
 const s=createBattle('standard','patrol');let p=skillPreview(s,'knibbs','shot');
 assert.equal(p.damage,14);assert.deepEqual(p.targetDamages,{'enemy-1':14,boss:14});
 cast(s,'knibbs','shot');assert.equal(s.enemies[1].hp,166);
 s.enemies[1].broken=true;s.enemies[1].stagger=0;
 p=skillPreview(s,'knibbs','shot');assert.equal(p.damage,27);
 const before=s.enemies.map(e=>e.hp),r=cast(s,'knibbs','scatter');
 assert.equal(r.events.filter(e=>e.type==='attack').length,2);assert.equal(before[0]-s.boss.hp,54);
 assert.equal(s.enemies[1].hp,before[1]-84,'broken recipient takes its own 50% vulnerability, never intercepted extra hits');
});
test('multi: AoE pays AP and secondary resource once and passive refunds once for three enemies',()=>{
 const upgrades=['qianxing_nova'],loadouts=normalizeLoadouts(upgrades);loadouts.qianxing[4]='nova';
 const s=createBattle('standard','relay_guard',{partyIds:['qianxing','haart','knibbs'],upgrades,loadouts});
 cast(s,'qianxing','repair');const h=heroOf(s,'qianxing'),before=s.ap,actions=s.stats.actions;
 const r=cast(s,'qianxing','nova');assert.equal(before-s.ap,3);assert.equal(h.secondary,0);assert.equal(h.resource,7);
 assert.equal(s.stats.actions,actions+1);assert.equal(r.events.filter(e=>e.type==='attack').length,3);
 assert.equal(r.events.filter(e=>e.type==='attack').reduce((n,e)=>n+e.amount,0),387);
});
test('roles: covering fire arms without instant damage or shields; a real pre-attack counter can cancel the threat',()=>{
 const s=createBattle('standard','scout'),hp=s.boss.hp;cast(s,'knibbs','cover');
 assert.equal(s.boss.hp,hp);assert.ok(s.heroes.every(h=>h.shield===0&&h.protection===0));
 s.boss.stagger=20;const r=endRound(s);assert.ok(r.events.some(e=>e.skillId==='cover_counter'));
 assert.ok(!r.events.some(e=>e.type==='boss'));assert.equal(s.boss.cover,null);
 const other=createBattle('standard','duelist');cast(other,'knibbs','cover');const strike=endRound(other).events.filter(e=>e.type==='boss');
 assert.deepEqual(strike.map(e=>e.amounts.knibbs),[14,14,14]);
});
test('roles: one-hit evasion does not negate a multi-hit action',()=>{
 const s=createBattle('standard','duelist');s.boss.intentTarget='apeilia';cast(s,'apeilia','reboot');
 assert.deepEqual(endRound(s).events.filter(e=>e.type==='boss').map(e=>e.amounts.apeilia),[0,28,28]);
 assert.equal(heroOf(s,'apeilia').evasion,0);
});
test('roles: mind control redirects a single action to another foe and fallback suppresses a lone foe',()=>{
 const s=createBattle('standard','relay_guard',{partyIds:['haart','knibbs','ric']});
 cast(s,'haart','page','enemy-2');cast(s,'haart','soothe','enemy-2');
 const hp=s.boss.hp,r=endRound(s);assert.ok(s.boss.hp<hp);assert.ok(r.events.some(e=>e.actor==='enemy-2'&&e.targets.includes('boss')));
 const single=createBattle('standard','scout',{partyIds:['haart']});cast(single,'haart','page');cast(single,'haart','soothe');
 assert.equal(endRound(single).events.find(e=>e.type==='boss').amounts.haart,4);
});
test('roles: recorded intent delays a device after other enemies and blocks its supply',()=>{
 const s=createBattle('standard','relay_guard',{partyIds:['patch','knibbs','ric']});cast(s,'patch','bookward');cast(s,'patch','chargedslash','boss');
 assert.equal(enemyThreats(s).at(-1).id,'boss');endRound(s);
 assert.ok(s.enemies.every(e=>e.supportCharge===0));assert.equal(s.boss.recordedIntent,null);
});
test('boss mechanisms: summons wait until next phase, survive their summoner and use stable distinct IDs',()=>{
 const s=createBattle('story','cantor');const r=endRound(s),add=s.enemies[1];
 assert.ok(add);assert.equal(add.id,'sporeling');assert.ok(r.events.some(e=>e.type==='spawn'));
 assert.ok(!r.events.some(e=>e.type==='boss'&&e.actor===add.unitId));
 s.boss.hp=1;cast(s,'knibbs','shot','boss');assert.equal(s.mode,'playing');
 assert.ok(normalizeSave(copy(s)));const next=endRound(s);assert.ok(next.events.some(e=>e.type==='boss'&&e.actor===add.unitId));
});
test('boss mechanisms: any ordinary damage can destroy a relay, remove charge and stop the warden',()=>{
 const s=createBattle('standard','warden');s.enemies[1].hp=20;
 cast(s,'knibbs','shot','enemy-1');assert.equal(s.boss.charge,0);assert.equal(s.boss.broken,true);
 assert.ok(!endRound(s).events.some(e=>e.type==='boss'));assert.ok(normalizeSave(copy(s)));
});
test('multi save: enemy alias, selection and armed mechanics round-trip without losing follow-up behavior',()=>{
 const s=createBattle('standard','relay_guard',{partyIds:['haart','patch','knibbs']});
 cast(s,'haart','page','enemy-2');cast(s,'haart','soothe','enemy-2');cast(s,'knibbs','cover','enemy-1');selectEnemyTarget(s,'enemy-1');
 const saved=normalizeSave(copy(s));assert.ok(saved);assert.equal(saved.boss,saved.enemies[0]);
 assert.deepEqual(endRound(saved),endRound(s));
 const forged=copy(createBattle('standard','patrol'));forged.enemies[0].hp--;assert.equal(normalizeSave(forged),null);
 const duplicate=copy(createBattle('standard','patrol'));duplicate.enemies[1].unitId='boss';assert.equal(normalizeSave(duplicate),null);
 const v9=copy(createBattle('standard','warden'));v9.version=9;delete v9.enemies;delete v9.selectedEnemyId;
 const migrated=normalizeSave(v9);assert.equal(migrated.enemies.length,1,'old single boss encounters are not ambushed by new adds');
});
test('multi feedback: simultaneous HP snapshots advance only at each concrete recipient impact',()=>{
 const s=createBattle('standard','relay_guard'),before=structuredClone(s);const result=cast(s,'knibbs','scatter');
 const view=createFeedbackState(before,s);assert.deepEqual(view.enemies.map(e=>e.hp),before.enemies.map(e=>e.hp));
 const hit=result.events.find(e=>e.type==='attack'&&e.targets[0]==='enemy-2');applyFeedbackImpact(view,hit,0);
 assert.equal(view.enemies[2].hp,before.enemies[2].hp-9);assert.equal(view.boss.hp,before.boss.hp);assert.equal(view.boss,view.enemies[0]);
});
test('multi: a reflected lethal hit stops the remaining segments even while another enemy survives',()=>{
 const s=createBattle('standard','warden',{partyIds:['qianxing','haart','knibbs']});
 s.boss.hp=10;s.boss.intentTarget='qianxing';cast(s,'qianxing','spike','enemy-1');cast(s,'qianxing','armor');
 const r=endRound(s);assert.equal(s.boss.defeated,true);assert.equal(s.mode,'playing');
 assert.equal(r.events.filter(e=>e.type==='boss'&&e.actor==='boss').length,1);
 assert.ok(normalizeSave(copy(s)));
});
test('roles: reactive field care settles after damage in both combat and feedback and cannot revive a lethal wound',()=>{
 const s=createBattle('standard','golem',{partyIds:['youmu']});cast(s,'youmu','sterilize');
 const before=structuredClone(s),r=endRound(s),view=createFeedbackState(before,s);
 for(const event of r.events)applyFeedbackImpact(view,event,0);
 assert.equal(s.heroes[0].hp,115);assert.equal(view.heroes[0].hp,s.heroes[0].hp);
 const lethal=createBattle('standard','golem',{partyIds:['youmu']});lethal.heroes[0].hp=10;cast(lethal,'youmu','sterilize');
 endRound(lethal);assert.equal(lethal.mode,'defeat');assert.equal(lethal.heroes[0].hp,0);
});
