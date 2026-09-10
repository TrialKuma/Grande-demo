import {REWARDS} from './rewards.js';

const legacyAffectedSkills={knibbs_deadeye:['focus'],knibbs_expose:['shot'],apeilia_cascade:['eden'],apeilia_zero:['sentinel'],ric_grace:['shelter'],ric_verdict:['rune'],youmu_transplant:['surgery']};

/** A learned extra skill is not an upgrade; only earned upgrades add a star. */
export function skillGrowth(state,heroId,skillId){
  const owned=new Set(state.upgrades||[]);
  return Object.values(REWARDS).filter(reward=>reward.kind==='upgrade'&&reward.heroId===heroId&&owned.has(reward.id)&&[].concat(reward.affects||reward.skillIds||reward.skillId||legacyAffectedSkills[reward.id]||[]).includes(skillId));
}

export const resourceColor=h=>h.resourceName==='气息'?'#f18b63':h.resourceName==='连击'?'#f2d16c':h.resourceName==='魔力'?'#70baff':'#bb96ec';
export const resourceKind=h=>h.resourceName==='气息'?'breath':h.resourceName==='连击'?'combo':h.resourceName==='魔力'?'mana':'balance';

export function skillGrowthSummary(reward){
  if(reward.id==='apeilia_zero')return {text:'至少持有 6 点连击，并且上一项攻击为物理时触发。',cost:{name:'AP',before:2,after:1}};
  if(reward.id==='patch_doubleentry')return {text:'从观测姿态使用书阵切入收录时触发；连续使用收录书阵不触发。',cost:{name:'魔力',before:4,after:3}};
  return {text:withoutResourcePayment(reward.description)};
}

/** Textual payment is redundant with the resource diagram on a battle hover. */
export function withoutResourcePayment(text){
  return String(text||'')
    .replace(/(?:解锁\s*)?\d+\s*(?:行动点|AP)技能[：:]?/g,'')
    .replace(/(?:以|花|施放时)?\s*\d+\s*(?:行动点|AP)(?:\s*[与和/]\s*\d+\s*(?:气息|魔力|连击|念线|充能|记录))?/g,'')
    .replace(/(?:仍须先|仍需先|仍先|先|仍|本次|此次)?(?:支付|消耗|使用|拆解|销毁)(?:全部|固定)?\s*\d+(?:[—～-]\d+)?\s*(?:点|条|份|格)?\s*(?:气息|魔力|连击|念线|充能|记录)(?:与\s*\d+\s*(?:行动点|AP))?[，、；;]?/g,'')
    .replace(/(?:消耗|费用|仅耗|只耗|只需)(?:会)?(?:降低到|降低为|降低至|降为)?\s*\d+\s*(?:点)?\s*(?:行动点|AP)[，、；;]?/g,'')
    .replace(/\s*[，、；;]\s*[，、；;]\s*/g,'，')
    .replace(/^[，、；;：:\s]+|[，、；;\s]+$/g,'');
}
