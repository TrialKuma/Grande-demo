// Each grant keeps its own expiry. Adding a new shield never renews an old one.
export const SHIELD_CAP=60;
export const SHIELD_TURNS=2;
export function syncShieldLayers(hero){
  hero.shieldLayers=(hero.shieldLayers||[]).filter(x=>x.amount>0&&x.turns>0).map(x=>({...x})).sort((a,b)=>a.turns-b.turns);
  const sum=hero.shieldLayers.reduce((n,x)=>n+x.amount,0);
  const total=Math.max(0,Math.min(SHIELD_CAP,hero.shield||0));
  if(sum<total)hero.shieldLayers.push({amount:total-sum,turns:SHIELD_TURNS});
  else if(sum>total){let loss=sum-total;for(const x of hero.shieldLayers){const n=Math.min(loss,x.amount);x.amount-=n;loss-=n;}}
  hero.shieldLayers=hero.shieldLayers.filter(x=>x.amount>0);hero.shield=total;
  return hero.shieldLayers;
}
export function grantShield(hero,amount){
  syncShieldLayers(hero);
  const gained=Math.min(SHIELD_CAP-hero.shield,Math.max(0,Math.round(amount)));
  if(gained){const existing=hero.shieldLayers.find(x=>x.turns===SHIELD_TURNS);if(existing)existing.amount+=gained;else hero.shieldLayers.push({amount:gained,turns:SHIELD_TURNS});}
  hero.shield+=gained;return gained;
}
export function absorbShield(hero,amount){
  syncShieldLayers(hero);let left=Math.max(0,amount),absorbed=0;
  for(const layer of hero.shieldLayers){const n=Math.min(left,layer.amount);layer.amount-=n;left-=n;absorbed+=n;}
  hero.shieldLayers=hero.shieldLayers.filter(x=>x.amount>0);hero.shield-=absorbed;return absorbed;
}
export function ageShields(hero){
  syncShieldLayers(hero);const before=hero.shield;
  for(const layer of hero.shieldLayers)layer.turns--;
  hero.shieldLayers=hero.shieldLayers.filter(x=>x.turns>0);hero.shield=hero.shieldLayers.reduce((n,x)=>n+x.amount,0);
  return before-hero.shield;
}
