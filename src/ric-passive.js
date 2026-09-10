// Adapted from 技能设计示例-雷克老板.xlsx / eg雷克老板-平衡:
// A12/B15 positive field; A21/B24 negative field; A30:B34 chaos.
// Fixed bonuses replace TRPG dice. No effect below changes base-sheet metadata.
export const RIC_PASSIVE=Object.freeze({positive:4,negative:-3,chaos:12,crossingLimit:6});
const allStats=value=>({strength:value,intelligence:value,agility:value,will:value});
const living=unit=>!!unit&&unit.hp>0&&!unit.defeated;
const sameUnit=(a,b)=>a===b||!!(a&&b&&(a.unitId||a.id)===(b.unitId||b.id));

// Pure projection: never cache these effects in persistent attributeBuffs.
// Recompute after balance changes, spawning, death, revival and loading a save.
// turns=99 is the existing UI's condition-bound lifetime marker, not 99 rounds.
export function ricDomainEffects(state,unit){
 const ric=state.heroes?.find(hero=>hero.id==='ric');
 if(!living(ric)||!living(unit)||!ric.resource)return [];
 const positive=ric.resource>0&&sameUnit(ric,unit);
 const enemies=state.enemies?.length?state.enemies:[state.boss];
 const negative=ric.resource<0&&enemies.some(enemy=>sameUnit(enemy,unit));
 if(!positive&&!negative)return [];
 const value=positive?RIC_PASSIVE.positive:RIC_PASSIVE.negative-(state.upgrades?.includes('ric_erosion')?1:0);
 return [{id:positive?'ric_domain_positive':'ric_domain_negative',label:positive?'深渊领域投影 · 正':'深渊领域投影 · 负',stats:allStats(value),turns:99,dynamic:true,source:'ric',tone:positive?'good':'warning',condition:positive?'雷克存活且平衡为正':'雷克存活且平衡为负'}];
}

// Call after committing a real balance change; merely reaching zero is not a flip.
// The caller owns resource assignment and battle events. Repeated flips refresh
// a single charge, never bank multiple charges or create party healing/shields.
export function ricBalanceTransition(hero,before,after){
 const flipped=hero?.id==='ric'&&living(hero)&&Number.isFinite(before)&&Number.isFinite(after)&&before*after<0;
 if(flipped)hero.ricChaos=1;
 return flipped;
}

const chaosReady=hero=>hero?.id==='ric'&&living(hero)&&hero.ricChaos===1;
// One packet only: no multiplying this bonus by a skill's hits or AOE targets.
// Read during previews; consume only when real damage or a non-evaded hit resolves.
export const ricChaosAttackBonus=hero=>chaosReady(hero)?RIC_PASSIVE.chaos:0;
export const ricChaosDefenseReduction=hero=>chaosReady(hero)?RIC_PASSIVE.chaos:0;
export function consumeRicChaos(hero){
 const amount=ricChaosAttackBonus(hero);
 if(amount)hero.ricChaos=0;
 return amount;
}
// End of the next enemy action phase is the one-round expiry in this demo.
export function expireRicChaos(hero){
 if(hero?.id!=='ric')return false;
 const expired=hero.ricChaos===1;hero.ricChaos=0;return expired;
}

// Source Q34: -6 < balance < 6. Zero is an explicitly disabled no-op here;
// unlike the previous demo implementation, flipping zero never creates -4.
export const ricCrossingAllowed=balance=>Number.isFinite(balance)&&balance!==0&&Math.abs(balance)<RIC_PASSIVE.crossingLimit;
