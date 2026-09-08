import {damagingEvent,hpLossFor,hitDamageFor,impactTiming,attackTheme,materialFor} from './battle-feedback.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const positive=value=>Number.isFinite(value)?Math.max(0,value):0;
export const IMPACT_COLORS={ballistic:'#ffda94',blade:'#a5fff0',arcane:'#d6a8ff',mind:'#c7bdff',silverfire:'#bfefff',surgery:'#a2eed1',clockwork:'#f1cf87',water:'#8aeced',furnace:'#ffad69',lightning:'#a5dfff',spore:'#c3e5a1',crystal:'#d2acff',edict:'#f3bbcf'};

export function dispatchImpacts(action,elapsed){
  while(action.nextHit<action.hitCount&&elapsed>=action.impactAt+action.nextHit*action.interval)action.impact(action.nextHit++);
}

// Zero boss HP can mean an upcoming core/terminal transition. Only the visual
// victory event ends its standing pose; heroes still fall at their actual zero.
export function actorStanding(actor,mode){
  if(actor.isEnemy||actor.defeated!==undefined)return !actor.defeated&&mode!=='victory';
  return actor.id==='boss'?mode!=='victory':actor.hp>0;
}

// The engine owns HP. This splits its already-resolved totals into cosmetic
// contact beats; no amount or hit count here is ever written back to combat.
export function impactSchedule(event={}){
  if(!damagingEvent(event))return [];
  const timing=impactTiming(event),hits=clamp(Math.floor(timing.hits||1),1,12);
  const ids=[...new Set((event.targets||[]).map(target=>typeof target==='string'?target:target?.id).filter(Boolean))];
  const theme=attackTheme(event),beats=[];
  for(const id of ids){
    const hpLoss=positive(hpLossFor(event,id)),absorbed=positive(event.absorbedAmounts?.[id]);
    let hpRemaining=hpLoss;
    for(let index=0;index<hits;index++){
      const shield=Math.floor(absorbed*(index+1)/hits)-Math.floor(absorbed*index/hits);
      const loss=Math.min(hpRemaining,positive(hitDamageFor(event,id,index)));hpRemaining-=loss;
      beats.push({id,index,at:timing.impactAt+index*timing.interval,hpLoss:loss,absorbed:shield,
        reaction:loss>0,kind:loss>0?'hurt':shield>0?'shield':'contact',theme,material:materialFor(id,event.bossId,event.enemyModels),
        strength:clamp(.62+Math.sqrt(loss)/10,.62,1.5)});
    }
  }
  return beats.sort((a,b)=>a.at-b.at);
}

// Fast contact, a short held pose, then a soft recovery. Direction is in the
// recipient's local space, so a side hit bends the silhouette to that side.
export function reactionPose(age,{strength=1,boss=false,direction=[0,1],reducedMotion=false,index=0}={}){
  const duration=boss?.45:.39;
  const progress=clamp(age/duration,0,1);
  const pulse=progress<.14?Math.sin(progress/.14*Math.PI/2):progress<.30?1:(1-(progress-.30)/.70)**2;
  const weight=clamp(strength,.4,1.5)*pulse*(reducedMotion?.3:1),side=direction[0]||0,back=direction[1]||0;
  return {done:age>=duration,pulse,step:(boss?.095:.20)*weight,crouch:-(boss?.11:.105)*weight,
    pitch:back*(boss?.10:.19)*weight,roll:-side*(boss?.12:.21)*weight,
    headPitch:-back*.23*weight,headRoll:side*.17*weight,
    leftArm:-(index%2?.50:.33)*weight,rightArm:-(index%2?.28:.48)*weight,
    armSpread:(boss?.12:.20)*weight};
}

export function atmosphereProfile(bossId,reducedMotion=false){
  const profiles={
    golem:{kind:'crystal',color:'#c2a0fa',secondary:'#7adddf',count:128,speed:.13},
    duelist:{kind:'crystal',color:'#9bdddc',secondary:'#dbc78f',count:110,speed:.20},
    cantor:{kind:'spore',color:'#d1d898',secondary:'#b68dd0',count:154,speed:.21},
    warden:{kind:'spark',color:'#bdeaff',secondary:'#71aaff',count:128,speed:1.2},
    tide:{kind:'water',color:'#8ddadb',secondary:'#b7e3e5',count:144,speed:1.15},
    furnace:{kind:'ember',color:'#ffb675',secondary:'#eb6c48',count:160,speed:.65},
    weaver:{kind:'paper',color:'#d6c4a4',secondary:'#ae86c7',count:104,speed:.23},
    orrery:{kind:'star',color:'#b8ccff',secondary:'#e8cda2',count:150,speed:.15},
    arbiter:{kind:'paper',color:'#edbac9',secondary:'#d6c4ad',count:118,speed:.30},
    final:{kind:'star',color:'#ebbed5',secondary:'#af9eff',count:170,speed:.23},
  };
  const profile=profiles[bossId]||profiles.golem;
  const pointSize=({crystal:3.8,spore:5,spark:3.5,water:3.5,ember:4.5,paper:3,star:4})[profile.kind];
  return {...profile,pointSize,count:reducedMotion?32:profile.count,speed:reducedMotion?0:profile.speed,pages:profile.kind==='paper'?(reducedMotion?3:12):0,steam:['water','ember'].includes(profile.kind)?(reducedMotion?2:8):0};
}
