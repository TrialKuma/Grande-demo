export const STARTING_HEROES=['knibbs','apeilia','ric'];
export const RECRUIT_AFTER={duelist:'youmu',cantor:'haart',warden:'qianxing',golem:'patch'};

// Only completed story encounters grant permanent companions. GM availability
// and historical party members are deliberately not recruitment evidence.
export function earnedCompanions(run){
  return [...new Set([...STARTING_HEROES,...(Array.isArray(run?.history)?run.history:[]).map(entry=>RECRUIT_AFTER[entry?.bossId]).filter(Boolean)])];
}
