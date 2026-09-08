import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,attackSpec,enemyThreats,endRound} from '../src/combat.js';
import {BOSS_INTENTS} from '../src/encounters.js';
import {enemyIntentModels,enemyIntentBadgeView,enemyTargetOfTargetView,enemyIntentTooltipView} from '../src/enemy-intent-ui.js';

const main=s=>enemyIntentModels(s).find(m=>m.id==='boss');
function freeze(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return value;seen.add(value);Object.values(value).forEach(v=>freeze(v,seen));return Object.freeze(value);}

test('intent models use every actual attack resolver and preserve enemy identities without mutating state',()=>{
 for(const [id,intents]of Object.entries(BOSS_INTENTS))for(const intent of intents){
  const s=createBattle('standard',id);s.boss.intent=intent;const before=structuredClone(s),spec=attackSpec(s),expected=enemyThreats(s)[0];freeze(s);
  const model=main(s);assert.equal(model.intentId,intent);assert.equal(model.damage,expected.damage);assert.equal(model.hits,spec.damage?spec.hits||1:0);
  assert.equal(model.targeting,spec.damage?spec.group?'all':'single':'none');assert.deepEqual(s,before);
 }
});

test('single target honors taunt, fallback, current HP and never follows the player selected enemy',()=>{
 const s=createBattle('standard','patrol');s.boss.intentTarget='apeilia';s.heroes[1].hp=Math.round(s.heroes[1].maxHp/2);s.selectedEnemyId='enemy-1';
 let m=main(s);assert.equal(m.targetId,'apeilia');assert.equal(m.targetHpPercent,50);assert.match(enemyTargetOfTargetView(m),/aria-valuenow="50"/);
 s.heroes[2].tauntTurns=2;assert.equal(main(s).targetId,'ric');s.heroes[2].hp=0;assert.equal(main(s).targetId,'apeilia');s.heroes[1].hp=0;assert.equal(main(s).targetId,'knibbs');
});

test('AOE remains all-party with no individual target or HP bar even with only one living hero',()=>{
 const s=createBattle('standard','conduit',{partyIds:['knibbs']});s.boss.intent='conduit_discharge';const m=main(s);
 assert.equal(m.targeting,'all');assert.equal(m.targetId,null);assert.equal(m.targetName,'全体');assert.equal(m.targetHpPercent,null);
 const html=enemyTargetOfTargetView(m);assert.match(html,/全体/);assert.match(html,/intent-people-icon/);assert.doesNotMatch(html,/tot-health|tot-percent|data-intent-target="/);
 assert.match(enemyIntentBadgeView(m),/intent-scope/);assert.match(enemyIntentBadgeView(m),/targeting-all/);assert.match(enemyIntentBadgeView(m),/全体/);
});

test('confused single attack targets another living enemy; AOE and lone enemy suppress damage instead',()=>{
 const s=createBattle('standard','relay_guard');s.enemies[2].confusion={actor:'haart'};
 let m=enemyIntentModels(s).find(m=>m.id==='enemy-2');assert.equal(m.targeting,'enemy');assert.equal(m.targetId,'boss');assert.equal(m.targetName,'中继哨站');assert.equal(m.targetHpPercent,100);assert.match(enemyIntentBadgeView(m),/转向/);
 s.boss.defeated=true;s.boss.hp=0;m=enemyIntentModels(s).find(m=>m.id==='enemy-2');assert.equal(m.targetId,'enemy-1');
 s.enemies[1].defeated=true;s.enemies[1].hp=0;m=enemyIntentModels(s)[0];assert.equal(m.targeting,'single');assert.equal(m.redirected,false);assert.equal(m.damage,11);
 const aoe=createBattle('standard','relay_guard');aoe.boss.intent='relay_blast';aoe.boss.confusion={actor:'haart'};assert.equal(main(aoe).targeting,'all');assert.equal(main(aoe).damage,8);
});

test('pending recorded and confusion suppression round once through actual damage resolver',()=>{
 const s=createBattle('standard','scout',{mode:'solo',partyIds:['knibbs']});s.boss.intent='scout_ram';s.boss.weakened=1;s.boss.confusion={actor:'haart'};s.boss.recordedIntent={actor:'patch',intent:'scout_ram'};
 const m=main(s),result=endRound(structuredClone(s)),hit=result.events.find(e=>e.type==='boss'&&e.amounts);
 assert.equal(m.damage,hit.amounts.knibbs);assert.equal(m.recorded,true);
 const stale=createBattle('standard','duelist');stale.boss.recordedIntent={actor:'patch',intent:'mirror'};assert.equal(main(stale).damage,28);assert.equal(main(stale).recorded,false);
});

test('stop and core states show no false damage or target while final overloading remains an attack',()=>{
 for(const flag of ['broken','hardControl','core']){const s=createBattle('standard','golem');s.boss[flag]=flag==='hardControl'?1:true;const m=main(s);assert.equal(m.targeting,'none');assert.equal(m.damage,0);assert.equal(m.hits,0);assert.doesNotMatch(enemyIntentBadgeView(m),/intent-damage/);assert.match(enemyIntentBadgeView(m),flag==='core'?/等待/:/停止/);}
 const s=createBattle('standard','final');s.boss.finale=true;s.boss.hardControl=1;const m=main(s);assert.equal(m.targeting,'all');assert.equal(m.damage,65);assert.equal(m.stopped,false);
 s.boss.defeated=true;assert.deepEqual(enemyIntentModels(s),[]);
});

test('non-attacking supply and each add use their own current intent; recorded enemy keeps actual delayed order',()=>{
 const s=createBattle('standard','relay_guard');s.enemies[1].intent='escort_stamp';s.enemies[2].intent='drone_charge';s.enemies[2].supportCharge=2;
 let models=enemyIntentModels(s);assert.equal(models[0].targeting,'none');assert.equal(models[0].hits,0);assert.equal(models[0].icon,'rune');assert.match(enemyIntentBadgeView(models[0]),/供能/);
 assert.equal(models[1].targeting,'all');assert.equal(models[1].damage,18);assert.equal(models[2].damage,56);
 s.boss.recordedIntent={actor:'patch',intent:'relay_feed'};models=enemyIntentModels(s);assert.equal(models.at(-1).id,'boss');assert.equal(models.at(-1).order,3);
});

test('cover is conditional, shown as suppressed attack and remains distinct from recipient protection',()=>{
 const s=createBattle('standard','duelist');s.boss.cover={actor:'knibbs',damage:55,stagger:30};s.heroes[0].protection=55;
 const m=main(s);assert.equal(m.damage,14);assert.equal(m.conditional,true);assert.match(m.description,/截击/);assert.match(enemyIntentTooltipView(s,'boss'),/尚未扣除目标减伤与护盾/);
 s.heroes[0].hp=0;assert.equal(main(s).damage,28);assert.equal(main(s).covered,false);
});

test('badge and tooltip share selection IDs, escape text and do not show long effects in the standing badge',()=>{
 const s=createBattle('standard','duelist'),m=main(s);const badge=enemyIntentBadgeView({...m,label:'<img src=x>',description:'secret-effect'});
 assert.match(badge,/class="enemy-intent-badge/);assert.match(badge,/data-enemy-intent="boss"/);assert.match(badge,/data-enemy-target="boss"/);assert.match(badge,/data-tooltip="enemy-intent" data-detail="boss"/);assert.match(badge,/&lt;img src=x&gt;/);assert.doesNotMatch(badge,/<img|secret-effect/);
 assert.match(enemyIntentTooltipView(s,'boss'),/折镜刃卫|补充一面镜片/);assert.equal(enemyIntentTooltipView(s,'missing'),'');assert.equal(enemyIntentBadgeView(null),'');assert.equal(enemyTargetOfTargetView(null),'');
});
