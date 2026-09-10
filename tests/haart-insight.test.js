import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,useSkill,skillPreview,endRound} from '../src/combat.js';
import {effectiveAttributes} from '../src/attributes.js';
import {enemyStatusModels} from '../src/enemy-intent-ui.js';
import {normalizeSave} from '../src/save.js';

const make=(boss='warden',upgrades=['haart_insight'])=>({...createBattle('standard',boss,{partyIds:['haart','knibbs','apeilia'],upgrades}),elapsed:0});
const cast=(s,id,key)=>{const preview=skillPreview(s,id,key),r=useSkill(s,id,key);assert.equal(r.ok,true,r.error);return {preview,result:r};};
const insight=s=>s.boss.attributeBuffs.find(effect=>effect.id==='haart_insight');
const setup=s=>{cast(s,'haart','rest');cast(s,'haart','soothe');};

test('Haart insight lowers physical defense after a qualifying hit, without granting Knibbs weak-mark damage',()=>{
  const s=make();setup(s);const before=skillPreview(s,'knibbs','shot').damage;
  const {preview}=cast(s,'haart','relay');assert.equal(preview.insight,true);assert.equal(preview.mark,false);
  assert.deepEqual(insight(s).stats,{agility:-8});assert.equal(effectiveAttributes(s.boss,s).agility,-8);
  assert.equal(s.boss.marked,false);assert.equal(skillPreview(s,'knibbs','focus').markBonus,0);
  assert.equal(skillPreview(s,'knibbs','shot').damage,before+8);
  const badge=enemyStatusModels(s.boss,s).find(effect=>effect.id==='haart_insight');
  assert.equal(badge.label,'破绽提醒');assert.deepEqual(badge.stats,{agility:-8});
  const restored=normalizeSave(structuredClone(s));assert.ok(restored);assert.deepEqual(restored,s);
  const damage=cast(s,'knibbs','shot');assert.equal(damage.result.events.find(e=>e.type==='attack').amount,before+8);
  endRound(s);assert.equal(insight(s),undefined);assert.equal(effectiveAttributes(s.boss,s).agility,0);
});

test('Haart insight requires its reward and a debuff that already existed before the current relay',()=>{
  const plain=make('warden',[]);setup(plain);cast(plain,'haart','relay');assert.equal(insight(plain),undefined);
  const fresh=make();cast(fresh,'haart','rest');
  assert.equal(skillPreview(fresh,'haart','relay').insight,false);
  cast(fresh,'haart','relay');assert.equal(insight(fresh),undefined,'relay cannot use its own new suppression as a prior condition');
  cast(fresh,'haart','relay');assert.ok(insight(fresh),'the following relay can use the first one’s suppression');
});

test('Haart insight applies only to the target, not the guardian sharing the hit, and does not stack',()=>{
  const s=make('weaver');cast(s,'haart','rest');endRound(s);
  cast(s,'haart','soothe');cast(s,'haart','relay');
  const guardian=s.enemies.find(enemy=>enemy.guardianFor===s.boss.unitId);
  assert.ok(guardian.hp<guardian.maxHp,'the guardian really shared damage');
  assert.equal(guardian.attributeBuffs.some(effect=>effect.id==='haart_insight'),false);
  assert.equal(guardian.marked,false);
  cast(s,'haart','rest');cast(s,'haart','relay');
  assert.equal(s.boss.attributeBuffs.filter(effect=>effect.id==='haart_insight').length,1);
  assert.equal(effectiveAttributes(s.boss,s).agility,-8);
});

test('registering core hits without HP damage cannot create Haart insight',()=>{
  const s=make('golem');setup(s);s.boss.core=true;s.boss.hp=0;s.boss.fog=5;
  cast(s,'haart','relay');assert.equal(insight(s),undefined);assert.equal(s.boss.marked,false);
});
