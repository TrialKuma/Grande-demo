import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,attackSpec,enemyThreats,endRound,DIFFICULTIES,SOLO_RULES} from '../src/combat.js';
import {BOSS_INTENTS} from '../src/encounters.js';
import {enemyIntentModels,enemyIntentBadgeView,enemyTargetOfTargetView,enemyIntentTooltipView,enemyAttributeBadgesView,enemyStatusModels} from '../src/enemy-intent-ui.js';
import {enemyTargetView} from '../src/enemy-ui.js';
import {attackAttribute} from '../src/attributes.js';

const main=s=>enemyIntentModels(s).find(m=>m.id==='boss');
const announced=(state,enemy=state.boss)=>{const spec=attackSpec({...state,boss:enemy});return Math.max(1,Math.round((spec.damage+attackAttribute(enemy,spec.kind))*DIFFICULTIES[state.difficulty].damage*(state.challengeMode==='solo'?SOLO_RULES.bossDamage:1)));};
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
 s.enemies[1].defeated=true;s.enemies[1].hp=0;m=enemyIntentModels(s)[0];assert.equal(m.targeting,'single');assert.equal(m.redirected,false);assert.equal(m.damage,announced(s,s.enemies[2]));
 const aoe=createBattle('standard','relay_guard');aoe.boss.intent='relay_blast';aoe.boss.confusion={actor:'haart'};assert.equal(main(aoe).targeting,'all');assert.equal(main(aoe).damage,announced(aoe));
});

test('pending attribute suppression remains separate from target defense in the actual damage resolver',()=>{
 const s=createBattle('standard','scout',{mode:'solo',partyIds:['knibbs']});s.boss.intent='scout_ram';s.boss.weakened=1;s.boss.confusion={actor:'haart'};s.boss.recordedIntent={actor:'patch',intent:'scout_ram'};
 const m=main(s),result=endRound(structuredClone(s)),hit=result.events.find(e=>e.type==='boss'&&e.amounts);
 assert.equal(m.damage,1);assert.equal(hit.amounts.knibbs,1);assert.equal(m.recorded,true);
 const stale=createBattle('standard','duelist');stale.boss.recordedIntent={actor:'patch',intent:'mirror'};assert.equal(main(stale).damage,attackSpec(stale).damage);assert.equal(main(stale).recorded,false);
});

test('stop and core states show no false damage or target while final overloading remains an attack',()=>{
 for(const flag of ['broken','hardControl','core']){const s=createBattle('standard','golem');s.boss[flag]=flag==='hardControl'?1:true;const m=main(s);assert.equal(m.targeting,'none');assert.equal(m.damage,0);assert.equal(m.hits,0);assert.doesNotMatch(enemyIntentBadgeView(m),/intent-damage/);assert.match(enemyIntentBadgeView(m),flag==='core'?/等待/:/停止/);}
 const s=createBattle('standard','final');s.boss.finale=true;s.boss.hardControl=1;const m=main(s);assert.equal(m.targeting,'all');assert.equal(m.damage,announced(s));assert.equal(m.stopped,false);
 s.boss.defeated=true;assert.deepEqual(enemyIntentModels(s),[]);
});

test('non-attacking supply and each add use their own current intent; recorded enemy keeps actual delayed order',()=>{
 const s=createBattle('standard','relay_guard');s.enemies[1].intent='escort_stamp';s.enemies[2].intent='drone_charge';s.enemies[2].supportCharge=2;
 let models=enemyIntentModels(s);assert.equal(models[0].targeting,'none');assert.equal(models[0].hits,0);assert.equal(models[0].icon,'rune');assert.match(enemyIntentBadgeView(models[0]),/供能/);
 assert.equal(models[1].targeting,'all');assert.equal(models[1].damage,announced(s,s.enemies[1]));assert.equal(models[2].damage,announced(s,s.enemies[2]));
 s.boss.recordedIntent={actor:'patch',intent:'relay_feed'};models=enemyIntentModels(s);assert.equal(models.at(-1).id,'boss');assert.equal(models.at(-1).order,3);
});

test('cover is conditional, shown as suppressed attack and remains distinct from recipient protection',()=>{
 const s=createBattle('standard','duelist');s.boss.cover={actor:'knibbs',damage:55,stagger:30};s.heroes[0].protection=55;
 const m=main(s);assert.equal(m.damage,announced(s));assert.equal(m.conditional,true);assert.match(m.description,/截击/);assert.match(enemyIntentTooltipView(s,'boss'),/尚未扣除目标防御与护盾/);
 s.heroes[0].hp=0;assert.equal(main(s).damage,attackSpec(s).damage);assert.equal(main(s).covered,false);
});

test('attribute reductions add arithmetically without multiplying legacy cover, confusion or record percentages',()=>{
 const s=createBattle('standard','duelist');s.boss.attributes.strength=60;s.boss.attributeBuffs=[{id:'power',label:'强攻',stats:{strength:60},turns:2}];
 Object.assign(s.boss,{weakened:1,cover:{actor:'knibbs'},confusion:{actor:'haart'},recordedIntent:{intent:'rend'}});
 const m=main(s);assert.equal(m.attributes.strength,10);assert.equal(m.damage,38);
 assert.equal(m.attributeEffects.filter(effect=>['weakened','intercept','confusion','recordedIntent'].includes(effect.id)).length,4);
 assert.doesNotMatch(enemyIntentTooltipView(s,'boss'),/减半|降低55%|降低25%/);
});

test('combo badge and hover list its live conditions and cleansing immediately removes the queued tail',()=>{
 const s=createBattle('standard','duelist');s.boss.intent='mirror';s.boss.mirror=2;
 s.heroes[0].attributeBuffs=[{id:'mirror_cut',label:'刃痕',stats:{agility:-4},turns:2}];
 let m=main(s);assert.equal(m.combo.after.length,1);assert.match(enemyIntentBadgeView(m),/intent-combo/);
 assert.match(enemyIntentTooltipView(s,'boss'),/循痕返刃|净化刃痕/);
 s.heroes[0].attributeBuffs=[];m=main(s);assert.equal(m.combo.after.length,0);assert.doesNotMatch(enemyIntentBadgeView(m),/class="intent-combo"/);
 assert.match(enemyIntentTooltipView(s,'boss'),/连招条件/);
});

test('control hover displays the marked recipient will resistance without mutating or rolling',()=>{
 const s=createBattle('standard','weaver');s.boss.intent='silence';s.boss.seals=2;
 s.heroes[0].attributeBuffs=[{id:'written_name',label:'被写入的名字',stats:{will:-3,intelligence:-3},turns:2}];
 const before=structuredClone(s);const html=enemyIntentTooltipView(freeze(s),'boss');
 assert.match(html,/尼布斯抵抗封术概率 18%/);assert.match(html,/异系拆至不足 2 页/);assert.deepEqual(s,before);
});

test('enemy attribute icons expose actual modifiers, expiry and status routing on each enemy card',()=>{
 const s=createBattle('standard','weaver');s.boss.attributeBuffs=[{id:'test_debuff',label:'临时虚弱',stats:{strength:-4,will:-2},turns:2}];
 const before=structuredClone(s),html=enemyAttributeBadgesView(s.boss,s),cards=enemyTargetView(s);
 assert.match(html,/data-enemy-status="test_debuff"/);assert.match(enemyIntentTooltipView(s,'boss|status|test_debuff'),/力量 −4/);assert.match(enemyIntentTooltipView(s,'boss|status|test_debuff'),/剩余 2 轮/);
 assert.match(html,/data-tooltip="enemy-intent" data-detail="boss\|status\|test_debuff"/);assert.match(cards,/enemy-status-badges/);
 assert.match(enemyIntentTooltipView(s,'boss'),/临时虚弱/);assert.deepEqual(s,before);
 s.boss.attributeBuffs[0].turns=0;assert.doesNotMatch(enemyAttributeBadgesView(s.boss,s),/test_debuff/);
});

test('dead interceptors do not leave a phantom enemy debuff icon',()=>{
 const s=createBattle('standard','golem');s.boss.cover={actor:'knibbs'};
 assert.match(enemyAttributeBadgesView(s.boss,s),/data-enemy-status="intercept"/);
 s.heroes[0].hp=0;assert.doesNotMatch(enemyAttributeBadgesView(s.boss,s),/data-enemy-status="intercept"/);
});

test('badge and tooltip share selection IDs, escape text and do not show long effects in the standing badge',()=>{
 const s=createBattle('standard','duelist'),m=main(s);const badge=enemyIntentBadgeView({...m,label:'<img src=x>',description:'secret-effect'});
 assert.match(badge,/class="enemy-intent-badge/);assert.match(badge,/data-enemy-intent="boss"/);assert.match(badge,/data-enemy-target="boss"/);assert.match(badge,/data-tooltip="enemy-intent" data-detail="boss"/);assert.match(badge,/&lt;img src=x&gt;/);assert.doesNotMatch(badge,/<img|secret-effect/);
 assert.match(enemyIntentTooltipView(s,'boss'),/折镜刃卫|补充一面镜片/);assert.equal(enemyIntentTooltipView(s,'missing'),'');assert.equal(enemyIntentBadgeView(null),'');assert.equal(enemyTargetOfTargetView(null),'');
});
