import {BOSSES} from './encounters.js';

export const ENEMY_LIMITS=Object.freeze({alive:3,history:8});
export function enemyById(state,id){return (state.enemies||[state.boss]).find(enemy=>(enemy.unitId||'boss')===id);}
export function livingEnemies(state){return (state.enemies||[state.boss]).filter(enemy=>!enemy.defeated);}
export function selectEnemyTarget(state,id){
  const target=enemyById(state,id);
  if(state.mode!=='playing'||!target||target.defeated)return false;
  state.selectedEnemyId=id;return true;
}
export function enemyTargets(state,{includeDefeated=false}={}){
  return (state.enemies||[state.boss]).filter(e=>includeDefeated||!e.defeated).map(e=>({
    id:e.unitId||'boss',modelId:e.modelId||BOSSES[e.id]?.modelId||e.id,archetypeId:e.id,
    name:BOSSES[e.id]?.name||e.id,hp:e.hp,maxHp:e.maxHp,stagger:e.stagger,maxStagger:e.maxStagger,
    role:e.role||'boss',pendingSpawn:!!e.pendingSpawn,defeated:!!e.defeated,selected:(state.selectedEnemyId||'boss')===(e.unitId||'boss'),
    core:!!e.core,finale:!!e.finale,broken:!!e.broken,hardControl:e.hardControl||0,
    guardianFor:e.guardianFor||null,confused:!!e.confusion,delayed:!!e.recordedIntent,charged:e.supportCharge||0
  }));
}
/** A synchronous target context lets all existing phase rules operate on one unit.
 * Always restore the primary alias, including when a callback throws. */
export function withEnemy(state,enemy,fn){
  const previous=state.boss;state.boss=enemy;
  try{return fn();}finally{state.boss=previous;}
}
export function ensureEnemySelection(state){
  if(!enemyById(state,state.selectedEnemyId)?.defeated&&enemyById(state,state.selectedEnemyId))return;
  state.selectedEnemyId=livingEnemies(state)[0]?.unitId||'boss';
}
export function enemyDefaults(id,unitId='boss',role='boss'){
  return {unitId,modelId:BOSSES[id]?.modelId||id,role,defeated:false,guardianFor:null,supportCharge:0,
    confusion:null,recordedIntent:null,cover:null,summons:0,actionSuppression:1};
}
export function stampEnemyEvents(state,events){
  const models=Object.fromEntries((state.enemies||[state.boss]).map(e=>[e.unitId||'boss',e.modelId||e.id]));
  for(const event of events)event.enemyModels={...models};
  return events;
}
