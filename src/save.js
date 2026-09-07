import {HEROES,SKILLS,SKILL_SLOTS,SOLO_RULES,DIFFICULTIES,BOSSES,BOSS_INTENTS,REWARDS,createBattle,isSkillUnlocked,normalizeLoadouts} from './combat.js';
import {migrateRoster} from './legacy-roster.js';
import {grantShield} from './shields.js';

const HERO_IDS = new Set(HEROES.map(hero => hero.id));
const LOG_TONES = new Set(['normal','system','good','warning','bad']);
const STAT_KEYS = ['damage','healed','breaks','interrupts','actions','turns'];
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const integer = (value,min,max) => Number.isInteger(value) && value >= min && value <= max;
const finite = (value,min,max) => Number.isFinite(value) && value >= min && value <= max;
const boolean = value => typeof value === 'boolean';

/** Restore only validated combat data; current definitions own names and visual metadata. */
export function normalizeSave(value) {
  if (!object(value) || ![1,2,3,4,5,6,7].includes(value.version) || value.mode !== 'playing' || typeof value.difficulty !== 'string' || !Object.hasOwn(DIFFICULTIES,value.difficulty)) return null;
  const legacy=value.version===1,expansion=value.version>=3,oldBalance=value.version<4;
  if(value.version>=6&&!['solo','party'].includes(value.challengeMode))return null;
  if(value.version<6&&value.challengeMode!==undefined&&value.challengeMode!=='party')return null;
  const solo=value.version>=6&&value.challengeMode==='solo',partySize=solo?1:3,maxAp=solo?SOLO_RULES.ap:6;
  if(value.version===3)value=migrateRoster(value);
  const bossId=legacy?'golem':value.boss?.id;
  if(typeof bossId!=='string'||!Object.hasOwn(BOSSES,bossId))return null;
  if(value.version<6&&['tide','furnace','orrery','arbiter'].includes(bossId))return null;
  if(!expansion&&!['golem','duelist','cantor'].includes(bossId))return null;
  if (!integer(value.round,1,1000000) || !(legacy||!oldBalance?[maxAp]:[6,7]).includes(value.maxAp) || !integer(value.ap,0,value.maxAp) || !HERO_IDS.has(value.selected)) return null;
  if (!integer(value.potions,0,3) || !integer(value.serial,0,100000000)) return null;
  const elapsed = value.elapsed === undefined ? 0 : value.elapsed;
  if (!finite(elapsed,0,10000000)) return null;
  if (!Array.isArray(value.heroes) || value.heroes.length !== partySize) return null;
  if (value.heroes.some(hero => !object(hero) || !HERO_IDS.has(hero.id)) || new Set(value.heroes.map(hero => hero.id)).size !== partySize) return null;
  const partyIds=value.heroes.map(hero=>hero.id);
  if(!partyIds.includes(value.selected)||(!expansion&&partyIds.some(id=>!['knibbs','apeilia','ric'].includes(id))))return null;
  let upgrades=[],loadouts={};
  if(expansion){
    if(!Array.isArray(value.upgrades)||value.upgrades.length>Object.keys(REWARDS).length||new Set(value.upgrades).size!==value.upgrades.length||value.upgrades.some(id=>typeof id!=='string'||!Object.hasOwn(REWARDS,id)))return null;
    upgrades=[...value.upgrades];
    const roster=value.version<5?HEROES.filter(h=>!['youmu','patch'].includes(h.id)):HEROES;
    if(!object(value.loadouts)||Object.keys(value.loadouts).length!==roster.length)return null;
    for(const h of roster){
      const ids=value.loadouts[h.id];
      const slots=value.version<5?4:SKILL_SLOTS;
      if(!Array.isArray(ids)||ids.length!==slots||new Set(ids).size!==slots||ids.some(id=>!isSkillUnlocked(upgrades,h.id,id)))return null;
      loadouts[h.id]=[...ids];
    }
    loadouts=normalizeLoadouts(upgrades,loadouts);
  }
  const state = createBattle(value.difficulty,bossId,{mode:solo?'solo':'party',partyIds,upgrades,loadouts});
  for (const hero of state.heroes) {
    const saved = value.heroes.find(item => item.id === hero.id);
    if (!integer(saved.hp,0,hero.maxHp) || !integer(saved.resource,hero.id === 'ric' ? (value.version<5?-3:-10) : 0,hero.id==='ric'&&value.version<5?3:hero.maxResource)) return null;
    if (!integer(saved.shield,0,60) || !integer(saved.resonance,0,5) || !boolean(saved.guard)) return null;
    const skillIds = new Set(SKILLS[hero.id].map(skill => skill.id));
    if (!Array.isArray(saved.used) || saved.used.length > 20 || saved.used.some(id => !skillIds.has(id))) return null;
    if (!object(saved.cooldowns)) return null;
    const cooldowns = {};
    for (const [id,remaining] of Object.entries(saved.cooldowns)) {
      if (!skillIds.has(id) || !integer(remaining,0,20)) return null;
      cooldowns[id] = remaining;
    }
    Object.assign(hero,{hp:saved.hp,resource:saved.resource,shield:saved.shield,resonance:saved.resonance,guard:saved.guard,used:[...saved.used],cooldowns});
    if(value.version>=7){
      if(!Array.isArray(saved.shieldLayers)||saved.shieldLayers.length>60||saved.shieldLayers.some(x=>!object(x)||!integer(x.amount,1,60)||!integer(x.turns,1,2))||saved.shieldLayers.reduce((n,x)=>n+x.amount,0)!==saved.shield)return null;
      hero.shieldLayers=saved.shieldLayers.map(x=>({amount:x.amount,turns:x.turns}));
      for(const [key,max]of Object.entries({attackBuff:50,attackBuffTurns:2,tauntTurns:2,regenTurns:2,regenAmount:64})){if(!integer(saved[key],0,max))return null;hero[key]=saved[key];}
      if(!!hero.attackBuff!==!!hero.attackBuffTurns||!!hero.regenTurns!==!!hero.regenAmount||hero.tauntTurns&&hero.id!=='youmu')return null;
      if(hero.resourceName==='魔力'){if(!integer(saved.secondary,0,6))return null;hero.secondary=saved.secondary;}
      else if(saved.secondary!==undefined&&saved.secondary!==0)return null;
    }else{hero.shield=0;grantShield(hero,saved.shield);if(hero.id==='patch')hero.secondary=saved.records||0;}
    if(hero.id==='ric'&&value.version<5)hero.resource=Math.round(saved.resource*10/3);
    if(!legacy){
      if(!integer(saved.intuition,0,3)||![null,'physical','magic'].includes(saved.lastKind)||!integer(saved.balanceBursts,0,100000000))return null;
      Object.assign(hero,{intuition:saved.intuition,lastKind:saved.lastKind,balanceBursts:saved.balanceBursts});
    }
    if(expansion){
      if(!boolean(saved.grace)||!boolean(saved.verdict)||!integer(saved.reflect,0,2))return null;
      if(saved.grace&&(hero.id!=='ric'||!upgrades.includes('ric_grace')))return null;
      if(saved.verdict&&(hero.id!=='ric'||!upgrades.includes('ric_verdict')))return null;
      Object.assign(hero,{grace:saved.grace,verdict:saved.verdict,reflect:saved.reflect});
    }
    if(value.version>=5){
      const ranges={ricEdge:[0,2],captainTurns:[0,2],exhaustedTurns:[0,2],records:[0,6],recordProgress:[0,1]};
      for(const [key,[lo,hi]] of Object.entries(ranges))if(!integer(saved[key],lo,hi))return null;
      for(const key of ['surgicalReady','captainUsed','exhaustionFresh','patchRetaliation','patchObserved','patchRecorded'])if(!boolean(saved[key]))return null;
      if(!['doctor','captain'].includes(saved.youmuForm)||!['observe','record'].includes(saved.patchForm)||![null,'mirror','spores','charge','seals','fog'].includes(saved.specimen))return null;
      if(saved.youmuForm==='captain'&&(hero.id!=='youmu'||!saved.captainUsed||saved.captainTurns<1||saved.exhaustedTurns>0))return null;
      if(saved.youmuForm==='doctor'&&saved.captainTurns!==0)return null;
      if(hero.id!=='youmu'&&(saved.surgicalReady||saved.specimen||saved.captainUsed||saved.exhaustedTurns||saved.exhaustionFresh))return null;
      if(hero.id!=='ric'&&saved.ricEdge)return null;
      if(hero.id!=='patch'&&(saved.records||saved.recordProgress||saved.patchRetaliation||saved.patchObserved||saved.patchRecorded||saved.patchForm!=='observe'))return null;
      for(const key of [...Object.keys(ranges),'surgicalReady','captainUsed','exhaustionFresh','patchRetaliation','patchObserved','patchRecorded','youmuForm','patchForm','specimen'])hero[key]=saved[key];
      if(value.version>=7&&hero.id==='patch'&&hero.records!==hero.secondary)return null;
      if(value.version<7){hero.records=hero.id==='patch'?hero.secondary:0;hero.recordProgress=0;hero.patchRetaliation=false;hero.patchObserved=false;hero.patchRecorded=false;}
    }
  }
  if (!state.heroes.some(hero => hero.hp > 0)) return null;

  const boss = value.boss;
  if(value.version>=5&&!integer(boss?.weakened,0,1))return null;
  if (!object(boss) || boss.maxHp !== state.boss.maxHp || boss.maxStagger !== (oldBalance?100:state.boss.maxStagger)) return null;
  if (!integer(boss.hp,0,boss.maxHp) || !integer(boss.stage,0,4) || !integer(boss.stagger,0,boss.maxStagger)) return null;
  if(!oldBalance&&!boolean(boss.exposed))return null;
  if (!integer(boss.corePhysical,0,3) || !integer(boss.coreMagic,0,3) || !integer(boss.coreTurns,0,2)) return null;
  if (!integer(boss.reforms,0,1000000) || !integer(boss.fog,0,5) || !BOSS_INTENTS[bossId].includes(boss.intent) || !partyIds.includes(boss.intentTarget)) return null;
  for (const key of ['core','coreFresh','broken','marked','charging']) if (!boolean(boss[key])) return null;
  if (boss.core && (boss.hp !== 0 || boss.coreTurns < 1 || boss.broken || boss.charging || (solo?boss.coreHits>=SOLO_RULES.coreHits:boss.corePhysical === 3 && boss.coreMagic === 3))) return null;
  const finale=expansion&&bossId==='final'&&boss.finale===true;
  if (!boss.core && ((!finale&&boss.hp === 0) || boss.coreFresh)) return null;
  if (boss.coreFresh && boss.coreTurns !== 2) return null;
  if (boss.broken && (boss.stagger !== 0 || boss.charging)) return null;
  for (const key of ['hp','maxHp','stage','core','corePhysical','coreMagic','coreTurns','coreFresh','reforms','stagger','broken','marked','fog','charging','intent','intentTarget']) state.boss[key]=boss[key];
  state.boss.stagger=oldBalance?Math.round(boss.stagger/100*state.boss.maxStagger):boss.stagger;
  state.boss.exposed=oldBalance?false:boss.exposed;
  state.boss.weakened=value.version>=5?boss.weakened:0;
  if(value.version>=7){
    for(const [key,max]of Object.entries({vulnerable:2,hardControl:1,healSuppression:2})){if(!integer(boss[key],0,max))return null;state.boss[key]=boss[key];}
    if(boss.hardControl&&(boss.core||boss.finale||boss.broken||boss.controlImmune))return null;
    if(boss.dot!==null){if(!object(boss.dot)||!integer(boss.dot.damage,1,24)||!integer(boss.dot.turns,1,2)||boss.dot.actor!=='youmu'||!partyIds.includes(boss.dot.actor)||boss.dot.kind!=='physical'||boss.core||boss.finale)return null;state.boss.dot={...boss.dot};}
  }
  if(state.boss.exposed&&(boss.broken||boss.core||boss.finale))return null;
  if(!legacy){
    if(!boolean(boss.phasePending)||!integer(boss.mirror,0,3)||!integer(boss.spores,0,5)||!integer(boss.controlImmune,0,1))return null;
    if(bossId!=='golem'&&(boss.core||boss.coreFresh||boss.charging||boss.phasePending||boss.stage>1||boss.fog||(bossId!=='final'&&boss.reforms)||boss.corePhysical||boss.coreMagic))return null;
    if(bossId==='golem'&&(boss.mirror||boss.spores||(oldBalance&&boss.controlImmune)))return null;
    if(bossId!=='duelist'&&boss.mirror)return null;
    if(bossId!=='cantor'&&boss.spores)return null;
    if(boss.core&&boss.phasePending)return null;
    if(boss.broken&&boss.controlImmune)return null;
    Object.assign(state.boss,{phasePending:boss.phasePending,mirror:boss.mirror,spores:boss.spores,controlImmune:boss.controlImmune});
    if(value.response!==null){
      if(!object(value.response)||!['parry','evade','counter'].includes(value.response.id)||!partyIds.includes(value.response.actor))return null;
      state.response={id:value.response.id,actor:value.response.actor};
    }
  }
  if(expansion){
    if(!integer(boss.charge,0,6)||!integer(boss.seals,0,3)||!['physical','magic'].includes(boss.sealedKind)||![null,'physical','magic'].includes(boss.lastKind)||!integer(boss.sync,0,3))return null;
    if(!boolean(boss.finale)||!boolean(boss.finaleFresh)||!integer(boss.finalePhysical,0,1)||!integer(boss.finaleMagic,0,1)||!integer(boss.finaleTurns,1,2))return null;
    if(bossId!=='warden'&&boss.charge)return null;
    if(!['weaver','final'].includes(bossId)&&boss.seals)return null;
    if(bossId!=='final'&&(boss.lastKind!==null||boss.sync||boss.finale||boss.finaleFresh||boss.finalePhysical||boss.finaleMagic))return null;
    if(finale&&(boss.hp!==0||boss.core||boss.broken||boss.controlImmune||boss.seals))return null;
    if(!boss.finale&&(boss.finaleFresh||boss.finalePhysical||boss.finaleMagic))return null;
    if(boss.finaleFresh&&boss.finaleTurns!==2)return null;
    for(const key of ['charge','seals','sealedKind','lastKind','sync','finale','finalePhysical','finaleMagic','finaleTurns','finaleFresh'])state.boss[key]=boss[key];
  }
  if(value.version>=6){
    const ranges={coreHits:[0,SOLO_RULES.coreHits],finaleHits:[0,SOLO_RULES.finaleHits],waterLevel:[0,4],valveHits:[0,2],heat:[0,6],prediction:[0,3],violations:[0,3]};
    for(const [key,[min,max]]of Object.entries(ranges))if(!integer(boss[key],min,max))return null;
    if(!boolean(boss.furnaceOpen)||!['light','heavy'].includes(boss.decree))return null;
    if(boss.forecastSkill!==null){
      if(typeof boss.forecastSkill!=='string')return null;
      const [id,skill,extra]=boss.forecastSkill.split('/');
      if(extra!==undefined||!partyIds.includes(id)||!SKILLS[id]?.some(s=>s.id===skill))return null;
    }
    if(!boss.core&&boss.coreHits||!boss.finale&&boss.finaleHits)return null;
    if(bossId!=='tide'&&(boss.waterLevel||boss.valveHits))return null;
    if(bossId!=='furnace'&&(boss.heat||boss.furnaceOpen))return null;
    if(bossId!=='orrery'&&(boss.prediction||boss.forecastSkill!==null))return null;
    if(bossId!=='arbiter'&&(boss.violations||boss.decree!=='light'))return null;
    for(const key of [...Object.keys(ranges),'furnaceOpen','decree','forecastSkill'])state.boss[key]=boss[key];
  }else{
    state.boss.coreHits=Math.min(SOLO_RULES.coreHits,boss.corePhysical+boss.coreMagic);
    state.boss.finaleHits=Math.min(SOLO_RULES.finaleHits,(boss.finalePhysical||0)+(boss.finaleMagic||0));
  }

  if (!object(value.stats)) return null;
  for (const key of STAT_KEYS) {
    if (!integer(value.stats[key],0,1000000000)) return null;
    state.stats[key] = value.stats[key];
  }
  if (!Array.isArray(value.log) || value.log.length > 80) return null;
  if (value.log.some(entry => !object(entry) || typeof entry.text !== 'string' || entry.text.length > 1000 || !LOG_TONES.has(entry.tone))) return null;
  state.log = value.log.map(({text,tone}) => ({text,tone}));
  Object.assign(state,{round:value.round,ap:Math.min(value.ap,maxAp),maxAp,selected:value.selected,potions:value.potions,serial:value.serial,elapsed});
  return state;
}
