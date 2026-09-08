export const STARTING_HEROES=['knibbs'];
export const LEGACY_STARTING_HEROES=['knibbs','apeilia','ric'];
export const RECRUIT_AFTER={duelist:'youmu',cantor:'haart',warden:'qianxing',golem:'patch'};

// Only completed story encounters grant permanent companions. GM availability
// and historical party members are deliberately not recruitment evidence.
export function earnedCompanions(run){
  if([5,6].includes(run?.version))return [...new Set(['knibbs',...(Array.isArray(run.recruits)?run.recruits:[]).map(r=>r.heroId).filter(id=>['apeilia','ric','haart','qianxing','youmu','patch'].includes(id))])];
  return [...new Set([...([1,2,3,4].includes(run?.version)||Array.isArray(run?.history)?LEGACY_STARTING_HEROES:STARTING_HEROES),...(Array.isArray(run?.history)?run.history:[]).map(entry=>RECRUIT_AFTER[entry?.bossId]).filter(Boolean)])];
}
