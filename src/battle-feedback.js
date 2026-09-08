// Shared presentation rules. These functions never change combat state.
const bounded=(n,min,max)=>Math.max(min,Math.min(max,n));
const nonnegative=n=>Number.isFinite(n)?Math.max(0,n):0;

export function damagingEvent(event={}){
  return ['attack','boss'].includes(event.type)||event.type==='response'&&event.style==='counter';
}

export function hpLossFor(event={},id){
  if(!damagingEvent(event))return 0;
  // An explicit zero is meaningful: shield absorption and core registration
  // must never be mistaken for an injury because another amount is present.
  if(event.hpLosses&&Object.hasOwn(event.hpLosses,id))return nonnegative(event.hpLosses[id]);
  if(event.amounts&&Object.hasOwn(event.amounts,id))return nonnegative(event.amounts[id]);
  return nonnegative(event.amount);
}

export function hitDamageFor(event={},id,index=0){
  if(!damagingEvent(event))return 0;
  const count=impactTiming(event).hits;
  if(!Number.isInteger(index)||index<0||index>=count)return 0;
  if(Array.isArray(event.hitAmounts?.[id]))return nonnegative(event.hitAmounts[id][index]);
  const amount=Math.round(hpLossFor(event,id));
  return Math.floor(amount*(index+1)/count)-Math.floor(amount*index/count);
}

export function materialFor(id,bossId='golem',enemyModels={}){
  const enemyModel=enemyModels[id];if(enemyModel)bossId=enemyModel;
  if(id!=='boss'&&!enemyModel&&!id?.startsWith('enemy-'))return ['apeilia','qianxing'].includes(id)?'metal':'organic';
  return ({scout:'metal',bulwark:'stone',conduit:'metal',golem:'stone',duelist:'metal',cantor:'organic',warden:'metal',weaver:'paper',tide:'metal',furnace:'metal',orrery:'crystal',arbiter:'cloth',final:'crystal'})[bossId]||'stone';
}

export function attackTheme(event={}){
  if(event.actor==='boss'||event.enemyModels?.[event.actor]||event.actor?.startsWith('enemy-'))return ({scout:'ballistic',bulwark:'crystal',conduit:'lightning',golem:'crystal',duelist:'blade',cantor:'spore',warden:'lightning',weaver:'clockwork',tide:'water',furnace:'furnace',orrery:'crystal',arbiter:'edict',final:'arcane'})[event.enemyModels?.[event.actor]||event.bossId]||'crystal';
  if(event.actor==='haart')return 'mind';
  if(event.actor==='qianxing')return event.kind==='magic'?'silverfire':'ballistic';
  if(event.actor==='patch')return 'clockwork';
  if(event.actor==='youmu')return event.variant==='captain'?(event.style==='shot'||event.style==='burst'?'ballistic':'blade'):'surgery';
  if(event.actor==='knibbs')return 'ballistic';
  if(event.kind==='magic')return 'arcane';
  return event.style==='shot'?'ballistic':'blade';
}

export function impactTiming(event={}){
  const hits=bounded(Math.floor(Number(event.hits)||1),1,6);
  const style=event.style||'rune';
  const impactAt=({shot:.28,slash:.31,quake:.43,mist:.38,counter:.33,parry:.23,evade:.23})[style]??.38;
  const interval=style==='slash'?.12:style==='shot'?.115:.105;
  const duration=Math.max(style==='quake'?1.02:hits>2?1.12:.82,impactAt+(hits-1)*interval+.38);
  return {impactAt,interval,duration,hits};
}

// HP, shields and phase changes advance at contact time. The resolved combat
// state remains authoritative and is never rolled back for animation.
export function createFeedbackState(before,after){
  const view=structuredClone(after);
  view.mode=before.mode;
  for(const enemy of view.enemies||[view.boss]){const old=(before.enemies||[before.boss]).find(e=>(e.unitId||'boss')===(enemy.unitId||'boss'));if(old)for(const key of ['hp','stage','core','finale','defeated'])enemy[key]=old[key];else enemy.pendingSpawn=true;}
  if(view.enemies)view.boss=view.enemies[0];
  for(const hero of view.heroes){const old=before.heroes.find(h=>h.id===hero.id);if(old){hero.hp=old.hp;hero.shield=old.shield;}}
  return view;
}

export function applyFeedbackImpact(view,event,index=0){
  if(index===0){
    if(['phase','core'].includes(event.type)){
      const enemy=(view.enemies||[view.boss]).find(e=>(e.unitId||'boss')===event.actor);
      if(enemy){for(const key of ['stage','core','finale'])if(Object.hasOwn(event.phaseAfter||{},key))enemy[key]=event.phaseAfter[key];
      if(Number.isFinite(event.hpAfter))enemy.hp=bounded(event.hpAfter,0,enemy.maxHp);}
    }
    if(event.type==='enemy-defeat'){const enemy=view.enemies?.find(e=>e.unitId===event.actor);if(enemy){enemy.hp=0;enemy.defeated=true;}}
    if(event.type==='spawn')for(const enemy of view.enemies||[])if(event.targets?.includes(enemy.unitId))enemy.pendingSpawn=false;
    if(event.type==='victory'||event.type==='defeat')view.mode=event.type;
  }
  const ids=event.targets||[];
  for(const id of ids){
    const enemy=(view.enemies||[view.boss]).find(e=>(e.unitId||'boss')===id),target=enemy||view.heroes.find(h=>h.id===id);if(!target)continue;
    if(damagingEvent(event)){
      target.hp=Math.max(0,target.hp-hitDamageFor(event,id,index));
      const count=impactTiming(event).hits,total=nonnegative(event.absorbedAmounts?.[id]);
      const absorbed=Math.floor(total*(index+1)/count)-Math.floor(total*index/count);
      if(!enemy)target.shield=Math.max(0,target.shield-absorbed);
    }else if(index===0){
      const amount=nonnegative(event.amounts?.[id]??event.amount);
      if(event.type==='heal')target.hp=Math.min(target.maxHp,target.hp+amount);
      if(event.type==='shield'&&!enemy)target.shield=Math.min(60,target.shield+amount);
      if(event.type==='shield-expire'&&!enemy)target.shield=Math.max(0,target.shield-amount);
    }
  }
  return view;
}
