import {BOSSES,BOSS_INTENTS} from './encounters.js';
import {REWARDS} from './rewards.js';
import {NEW_HEROES,NEW_SKILLS,CAPTAIN_SKILLS,TRANSFERABLE_LAYERS,SPECIMEN_NAMES} from './expedition-heroes.js';
import {MANA_HERO_OVERRIDES,MANA_SKILLS,tuneManaSkill,manaSkillError,manaAfterSkill,applyManaSkill,manaHeroDefaults,manaStatus} from './mana-cycles.js';
import {grantShield,absorbShield,ageShields} from './shields.js';
export {BOSSES,BOSS_INTENTS};
export {REWARDS};

export const HEROES = [
  {id:'knibbs',name:'尼布斯拉姆',short:'尼布斯',role:'直感枪手',tag:'物理 · 标记 · 反击',color:'#efbc75',maxHp:170,maxResource:10,resourceName:'气息',passiveName:'直感',passiveDesc:'每次攻击积攒 1 直感，最多 3。满层时，下次单发确认、扩散弹或迎击伤害 +40%、削韧 +12，消耗直感。',quote:'探险家岂能老死于病榻？',bio:'尼布斯联合工会的创始人。积攒直感，以特殊子弹标记目标，在敌人出手时反击。'},
  {id:'apeilia',name:'艾佩莉雅',short:'艾佩莉雅',role:'深渊监视器',tag:'双系 · 交替 · 连击',color:'#80d9df',maxHp:145,maxResource:10,resourceName:'连击',passiveName:'交叉火力',passiveDesc:'物理与魔法技能交替时，伤害 +25%、削韧 +6，并额外获得 1 连击。连续使用螳螂刀只获得 1 连击。',quote:'以绝对的火力击垮敌人！',bio:'来自钢核都市的人形构造体。交替使用螳螂刀与双枪，驱动高效的双系武装循环。'},
  {id:'ric',name:'雷克老板',short:'雷克',role:'领域驱魔师',tag:'魔法 · 打断 · 调和',color:'#bf9aef',maxHp:160,maxResource:3,resourceName:'平衡',passiveName:'领域调和',passiveDesc:'平衡由负向过零（含回到 0），全队获得 10 护盾；由正向过零，全队回复 8 生命。初始 0 出发不触发。',quote:'今天的账，记在谁头上？',bio:'酒吧的老板，也是深渊之门的守门人。交替正负领域，把治疗、防护与控制编织成循环。'},
  {id:'haart',name:'哈特蒙斯',short:'哈特',role:'心灵操纵师',tag:'魔力 · 念线 · 干扰',color:'#afa2eb',maxHp:150,maxResource:10,resourceName:'魔力',passiveName:'心智通路',passiveDesc:'魔力转化为二级资源，兑现二级资源后返还魔力。',quote:'行了，别催。我在看。',bio:'博洛伦特纳的院长，嫌麻烦，却总在奇怪的地方出现。用书本建立队友间的心智通路，安排攻击、安抚与保护。'},
  {id:'qianxing',name:'潜行',short:'潜行',role:'升格机械师',tag:'魔力 · 双系 · 战甲',color:'#88d2e6',maxHp:195,maxResource:10,resourceName:'魔力',passiveName:'升格模组',passiveDesc:'魔力转化为二级资源，兑现二级资源后返还魔力。',quote:'先把人带出去，样本可以回来再取。',bio:'接受登天试炼、来到格朗德的探索者。沉着寡言，对未知事物十分执着；以战甲钉刺、银焱光束和修复装置完成任务。'}
];
export const SKILLS = {
  knibbs:[
    {id:'shot',name:'直感发射',sub:'REVOLVER',ap:1,kind:'physical',damage:27,hits:1,stagger:8,gain:1,icon:'crosshair',style:'shot',desc:'27 物理伤害、削韧 8，回复 1 气息，积攒 1 直感。',hint:'稳定输出 · 回复气息 · 积攒直感'},
    {id:'focus',name:'单发确认',sub:'DEAD RECKONING',ap:2,cost:4,kind:'physical',damage:66,hits:1,stagger:30,mark:true,icon:'target',style:'shot',desc:'消耗 4 气息，66 物理伤害、削韧 30；本轮后续全队伤害 +15%。满直感时强化。',hint:'先手标记 · 团队增伤 · 直感爆发'},
    {id:'scatter',name:'扩散弹',sub:'SCATTERSHOT',ap:2,cost:6,kind:'physical',damage:13,hits:6,stagger:18,icon:'scatter',style:'burst',desc:'消耗 6 气息，6 × 13 物理伤害、削韧 18；每段剥离司祭 1 孢压或计入核心命中。',hint:'六段物理 · 剥离孢冠 · 核心终结'},
    {id:'breathe',name:'整息装填',sub:'SECOND WIND',ap:1,gain:4,heal:16,self:true,once:true,icon:'wind',style:'guard',desc:'回复 4 气息与自身 16 生命，每轮一次。尼布斯每轮开始额外回复 2 气息。',hint:'补充气息 · 自我维持 · 每轮一次'},
    {id:'ricochet',name:'三点校射',sub:'TRIANGULATION',ap:2,cost:3,kind:'physical',damage:25,hits:3,stagger:18,intuitionGain:2,unlockKey:'knibbs_ricochet',icon:'scatter',style:'burst',desc:'消耗 3 气息，3 × 25 物理伤害、削韧 18；积攒 2 直感。',hint:'三段物理 · 快速积攒直感'}
  ],
  apeilia:[
    {id:'blade',name:'「圣餐」螳螂刀',sub:'EUCHARIST',ap:1,kind:'physical',damage:28,hits:1,stagger:10,gain:2,icon:'blade',style:'slash',desc:'28 物理伤害、削韧 10，获得 2 连击；连续物理只获 1 连击。接魔法之后强化并再获 1 连击。',hint:'物理衔接 · 拆孢 · 与魔法交替'},
    {id:'purify',name:'「炼净」双枪',sub:'PURIFICATION',ap:2,kind:'magic',damage:27,hits:2,stagger:12,gain:3,icon:'twin',style:'shot',desc:'2 × 27 魔法伤害、削韧 12，获得 3 连击。每段拆除 1 镜片或迷雾；接物理之后强化。',hint:'魔法衔接 · 双段拆镜 · 与物理交替'},
    {id:'eden',name:'「伊甸之约」',sub:'EDEN PACT',ap:2,cost:6,kind:'physical',damage:25,hits:4,stagger:32,icon:'blades',style:'slash',desc:'消耗 6 连击，4 × 25 物理伤害、削韧 32。接魔法之后伤害 +25%、削韧 +6，并返还 1 连击。',hint:'物理爆发 · 削韧 · 交替返还连击'},
    {id:'sentinel',name:'「地狱哨兵」',sub:'HELL SENTINEL',ap:2,cost:6,kind:'magic',damage:104,hits:1,stagger:22,pierce:true,icon:'scope',style:'burst',desc:'消耗 6 连击，104 魔法伤害、削韧 22，无视魔法抗性。接物理之后强化并返还 1 连击。',hint:'魔法爆发 · 穿透抗性 · 交替返还连击'},
    {id:'overture',name:'「新约」切换',sub:'NEW COVENANT',ap:1,kind:'magic',damage:20,hits:2,stagger:10,gain:1,once:true,unlockKey:'apeilia_overture',icon:'twin',style:'shot',desc:'2 × 20 魔法伤害、削韧 10，获得 1 连击；每轮一次，享受交叉火力。',hint:'低耗双段魔法 · 快速切换'}
  ],
  ric:[
    {id:'rune',name:'咒符 · 回响',sub:'ECHO SIGIL',ap:1,kind:'magic',damage:30,hits:1,stagger:8,shift:1,icon:'rune',style:'rune',desc:'30 魔法伤害、削韧 8，平衡 +1。由负向回到 0 时，调和为全队附加 10 护盾。',hint:'魔法输出 · 平衡 +1 · 负向过零护盾'},
    {id:'bind',name:'负域 · 禁行',sub:'ABYSSAL BIND',ap:2,kind:'magic',damage:38,hits:1,stagger:45,shift:-2,interrupt:true,cooldown:2,icon:'bind',style:'rune',desc:'38 魔法伤害、削韧 45，平衡 −2，冷却 2 轮。预告写有「可打断」时直接打断（包含风暴、封缄、复写与空白脉冲）；抗控与最终终幕不受打断。',hint:'打断预告蓄力 · 平衡 −2 · 高削韧'},
    {id:'shelter',name:'正域 · 庇护',sub:'SANCTUARY',ap:2,shield:26,shift:2,cleanse:1,icon:'shield',style:'guard',desc:'全队获得 26 护盾并清除 1 层共鸣，平衡 +2。负向过零再附加 10 护盾；护盾最多 60。',hint:'全队护盾 · 平衡 +2 · 负向过零强化'},
    {id:'mend',name:'领域同化',sub:'ASSIMILATION',ap:2,heal:45,allHeal:12,shift:-2,cleanse:2,icon:'heal',style:'rune',desc:'最低生命比例的存活队员回复 45，其他人回复 12；全队清除 2 层共鸣，平衡 −2。正向过零额外全队回复 8。',hint:'自动救治 · 平衡 −2 · 正向过零群疗'},
    {id:'equilibrium',name:'零域 · 归一',sub:'ZERO DOMAIN',ap:1,resetBalance:true,heal:16,allHeal:16,cleanse:1,cooldown:2,unlockKey:'ric_equilibrium',icon:'rune',style:'rune',desc:'将平衡调回 0，全队回复 16 生命并净化 1 层共鸣，触发过零调和。冷却 2 轮。',hint:'低耗过零 · 全队小恢复'}
  ],

};
HEROES.push(...NEW_HEROES);
Object.assign(HEROES.find(h=>h.id==='ric'),{role:'领域剑客 · 咒弹枪手',tag:'平衡 · 正域剑战 · 负域枪战',maxResource:10,passiveName:'领域投影',passiveDesc:'平衡 −10 至 +10，每轮自动向 0 回 2。正域强化自身，剑招在平衡至少 +4 或持有剑势时变招；负域弱化敌人，枪招在平衡不高于 −4 或敌人被束缚时变招。过零保留群盾 / 群疗调和。',bio:'领域强化身体时近身使剑，束缚敌人时用左轮完成瞄准。原生深渊种、酒吧老板，也是有一颗耍帅之心的守门人。'});
Object.assign(SKILLS,NEW_SKILLS);
SKILLS.ric=[
 {id:'rune',name:'剑式 · 试锋',sub:'DRAWN BLADE',ap:1,kind:'physical',damage:32,hits:1,stagger:10,shift:2,icon:'blade',style:'slash',desc:'32 物理伤害、削韧 10，平衡 +2。施放前平衡至少 +4 或持有剑势时，直接变为强化剑招。',hint:'正向剑战 · 平衡 +2'},
 {id:'bind',name:'枪式 · 咒弹',sub:'HEX REVOLVER',ap:2,kind:'magic',damage:66,hits:1,stagger:28,shift:-3,interrupt:true,cooldown:2,icon:'crosshair',style:'shot',desc:'66 魔法伤害、削韧 28，平衡 −3，冷却 2 轮；可打断指定蓄力，服从抗控。平衡不高于 −4 或目标被束缚时，变为两段封行咒弹。',hint:'负向枪战 · 可打断 · 平衡 −3'},
 {id:'shelter',name:'正域 · 肉身同调',sub:'EMPOWERED FLESH',ap:2,shield:30,selfShield:true,shift:4,cleanse:1,edge:2,icon:'shield',style:'guard',desc:'自身获得 30 护盾与 2 次剑势，平衡 +4；剑势强化之后的剑式。负向过零额外全队获得 10 护盾。',hint:'强化自己 · 剑势 2 次 · 平衡 +4'},
 {id:'mend',name:'负域 · 缚足同化',sub:'BINDING DOMAIN',ap:2,shift:-4,cleanse:1,weaken:true,vulnerable:true,icon:'bind',style:'rune',desc:'平衡向负域移动 4 点，压低敌人下一次行动的全部伤害 20%，并令其两轮内受到伤害增加 15%。净化全队 1 层共鸣；束缚同时使枪式获得强化。重复施加不叠加数值。',hint:'削弱敌人 · 枪战准备 · 平衡 −4'},
 {id:'crossing',name:'领域换向',sub:'CROSS THE THRESHOLD',ap:1,crossing:true,shield:12,selfShield:true,once:true,icon:'repeat',style:'guard',desc:'将当前平衡反转（零点时进入 −4），自身获得 12 护盾，每轮一次。保留过零调和；切换剑战或枪战路线。',hint:'主动换向 · 每轮一次'},
 {...SKILLS.ric.find(s=>s.id==='equilibrium')}
];
SKILLS.knibbs.push({id:'cover',name:'掩护射击',sub:'COVER FIRE',ap:2,cost:3,kind:'physical',damage:43,hits:1,stagger:14,shield:14,icon:'crosshair',style:'shot',desc:'43 物理伤害、削韧 14，全队获得 14 护盾；消耗 3 气息。',hint:'边打边护 · 团队缓冲'});
SKILLS.apeilia.push({id:'reboot',name:'战术重整',sub:'TACTICAL RESET',ap:1,gain:2,heal:15,self:true,once:true,icon:'wind',style:'guard',desc:'回复 2 连击与自身 15 生命，每轮一次，不改变上一击属性。',hint:'主动准备连击 · 每轮一次'});
for(const hero of HEROES)if(MANA_HERO_OVERRIDES[hero.id])Object.assign(hero,MANA_HERO_OVERRIDES[hero.id]);
Object.assign(SKILLS,MANA_SKILLS);
export const SKILL_SLOTS=5;
export const SOLO_RULES=Object.freeze({ap:5,bossHp:.64,bossDamage:.9,stagger:120,staggerRegen:10,coreHits:4,finaleHits:2});
export const isSolo=state=>state.challengeMode==='solo';
export function victoryRequirements(state){const solo=isSolo(state);return {solo,coreHits:solo?SOLO_RULES.coreHits:6,corePhysical:solo?0:3,coreMagic:solo?0:3,finaleHits:2,finalePhysical:solo?0:1,finaleMagic:solo?0:1};}
export const DIFFICULTIES = {
  story:{name:'初探',hp:700,damage:.73,desc:'熟悉角色与机制，适合第一次踏入遗迹。'},
  standard:{name:'标准',hp:900,damage:1,desc:'观察预告、选择应对，让同伴的能力相互衔接。'},
  challenge:{name:'险境',hp:1150,damage:1.24,desc:'更强的攻击压力，要求规划交替、应对与恢复。'}
};

export function isSkillUnlocked(upgrades,heroId,skillId){
  const skill=skillOf(heroId,skillId);return !!skill&&(!skill.unlockKey||(Array.isArray(upgrades)&&upgrades.includes(skill.unlockKey)));
}
export function normalizeLoadouts(upgrades=[],loadouts={}){
  const result={};
  for(const h of HEROES){
    const ids=loadouts?.[h.id];
    const defaults=SKILLS[h.id].filter(s=>!s.unlockKey).slice(0,SKILL_SLOTS).map(s=>s.id);
    const valid=Array.isArray(ids)&&[4,SKILL_SLOTS].includes(ids.length)&&new Set(ids).size===ids.length&&ids.every(id=>isSkillUnlocked(upgrades,h.id,id));
    result[h.id]=valid?[...ids,...defaults.filter(id=>!ids.includes(id))].slice(0,SKILL_SLOTS):defaults;
  }
  return result;
}
export function activeSkills(state,heroId){
  const loadout=normalizeLoadouts(state.upgrades,state.loadouts)[heroId]||[];
  return loadout.map(id=>skillOf(heroId,id));
}
export function createBattle(difficulty='standard',bossId='golem',options={}) {
  if(!Object.hasOwn(DIFFICULTIES,difficulty))difficulty='standard';
  if(!Object.hasOwn(BOSSES,bossId))bossId='golem';
  const upgrades=[...new Set(Array.isArray(options.upgrades)?options.upgrades.filter(id=>typeof id==='string'&&Object.hasOwn(REWARDS,id)):[])];
  const requested=options.partyIds;
  const solo=options.mode==='solo'||options.challengeMode==='solo',partySize=solo?1:3;
  const partyIds=Array.isArray(requested)&&requested.length===partySize&&new Set(requested).size===partySize&&requested.every(id=>HEROES.some(h=>h.id===id))?requested:solo?['knibbs']:['knibbs','apeilia','ric'];
  const loadouts=normalizeLoadouts(upgrades,options.loadouts);
  const hp=Math.round(DIFFICULTIES[difficulty].hp*BOSSES[bossId].hpMultiplier*(solo?SOLO_RULES.bossHp:1)),maxAp=solo?SOLO_RULES.ap:6,maxStagger=solo?SOLO_RULES.stagger:160;
  return {version:7,mode:'playing',challengeMode:solo?'solo':'party',difficulty,upgrades,loadouts,round:1,ap:maxAp,maxAp,selected:partyIds[0],response:null,
    heroes:partyIds.map(id=>HEROES.find(h=>h.id===id)).map(h=>({...h,...manaHeroDefaults(h.id),hp:h.maxHp,shield:0,shieldLayers:[],attackBuff:0,attackBuffTurns:0,tauntTurns:0,regenTurns:0,regenAmount:0,resource:['knibbs','haart','qianxing','youmu','patch'].includes(h.id)?10:0,resonance:0,cooldowns:{},used:[],guard:false,intuition:0,lastKind:null,balanceBursts:0,grace:false,verdict:false,reflect:0,ricEdge:0,youmuForm:'doctor',surgicalReady:false,specimen:null,captainTurns:0,captainUsed:false,exhaustedTurns:0,exhaustionFresh:false,patchForm:'observe',records:0,recordProgress:0,patchRetaliation:false,patchObserved:false,patchRecorded:false})),
    boss:{id:bossId,hp,maxHp:hp,stage:0,core:false,corePhysical:0,coreMagic:0,coreHits:0,coreTurns:2,coreFresh:false,reforms:0,stagger:maxStagger,maxStagger,broken:false,exposed:false,marked:false,weakened:0,vulnerable:0,hardControl:0,healSuppression:0,dot:null,fog:0,charging:false,phasePending:false,mirror:bossId==='duelist'?2:0,spores:bossId==='cantor'?1:0,controlImmune:0,charge:bossId==='warden'?2:0,seals:bossId==='weaver'?2:bossId==='final'?3:0,sealedKind:'physical',lastKind:null,sync:0,finale:false,finalePhysical:0,finaleMagic:0,finaleHits:0,finaleTurns:2,finaleFresh:false,waterLevel:bossId==='tide'?2:0,valveHits:0,heat:bossId==='furnace'?2:0,furnaceOpen:false,prediction:0,forecastSkill:null,decree:'light',violations:0,intent:BOSS_INTENTS[bossId][0],intentTarget:partyIds[0]},
    potions:3,log:[{text:`你们踏入${BOSSES[bossId].region}。${BOSSES[bossId].name}已现身。`,tone:'system'}],stats:{damage:0,healed:0,breaks:0,interrupts:0,actions:0,turns:0},serial:0};
}
export function heroOf(state,id){return state.heroes.find(h=>h.id===id);}
export function skillOf(id,skill){return Object.hasOwn(SKILLS,id)?SKILLS[id].find(s=>s.id===skill):undefined;}
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function log(state,text,tone='normal'){state.log.unshift({text,tone});if(state.log.length>80)state.log.length=80;}
function alive(state){return state.heroes.filter(h=>h.hp>0);}
function bossName(state){return BOSSES[state.boss.id].name;}
function enemyTarget(state){return alive(state).find(h=>h.tauntTurns>0)?.id||alive(state).find(h=>h.id===state.boss.intentTarget)?.id||alive(state)[0]?.id;}
// Mechanical pressure and protective stacks are removable. Phases, core rules
// and control immunity are not buffs and can never be stolen or dispelled.
function stripBossBuffs(b,n){
  const keys={golem:'fog',duelist:'mirror',cantor:'spores',warden:'charge',weaver:'seals',final:'seals',tide:'waterLevel',furnace:'heat',orrery:'prediction',arbiter:'violations'};
  if(b.core||b.finale)return 0;const key=keys[b.id],removed=Math.min(b[key]||0,n);if(key)b[key]-=removed;return removed;
}
function tickWound(state,events){
  const b=state.boss,dot=b.dot;if(!dot)return;
  dot.turns--;if(!b.core&&!b.finale)dealToBoss(state,{id:'wound_dot',name:'手术创口',kind:dot.kind,damage:dot.damage,hits:1,stagger:0,noLayers:true,style:'rune'},events,dot.actor,{response:true});
  if(dot.turns<=0||b.core||b.finale)b.dot=null;
}
// Capture the phase at this event, before later events can advance the battle.
function bossPhaseEvent(state,type,label){
  const b=state.boss;
  return {type,actor:'boss',targets:['boss'],bossId:b.id,label,hpAfter:b.hp,phaseAfter:{stage:b.stage,core:b.core,finale:b.finale}};
}
const usesMana=h=>h.resourceName==='魔力';
const manaRefund=(h,s)=>usesMana(h)?s.manaReturn||0:0;
const allyActed=(state,h,skillId)=>isSolo(state)?h.used.some(id=>id!==skillId):state.heroes.some(other=>other.id!==h.id&&other.used.length>0);
function resourceAfterSkill(h,s,alternating=false){
  if(usesMana(h))return manaAfterSkill(h,s).resource;
  return clamp(h.resource-(s.cost||0)+(s.gain||0)+(s.shift||0)+(alternating?1:0),h.id==='ric'?-10:0,h.maxResource);
}
export function canUse(state,id,skillId){
  const h=heroOf(state,id),source=skillOf(id,skillId);
  if(state.mode!=='playing')return '战斗已结束';
  if(!h||!source)return '未知技能';
  if(!isSkillUnlocked(state.upgrades,id,skillId))return '此技能尚未在战间奖励中解锁';
  if(!activeSkills(state,id).some(s=>s.id===skillId))return '此技能尚未装配，请在战间营地调整';
  const {skill:s}=tunedSkill(state,h,source);
  if(h.hp<=0)return '角色已倒下';
  if(state.ap<s.ap)return '行动点不足';
  if(s.cost&&h.resource<s.cost)return `${h.resourceName}不足（需要 ${s.cost}）`;
  if(usesMana(h)){const error=manaSkillError(state,h,s);if(error)return error;}
  if(s.shift&&Math.abs(h.resource+s.shift)>10)return `平衡超出范围，请先换向或使用${s.shift>0?'负向':'正向'}技能`;
  if(s.surgery&&!h.specimen&&!h.surgicalReady)return '先用手术刀建立手术准备';
  if(s.transform&&h.captainUsed)return '本场已经请船长接管过';
  if(h.cooldowns[s.id]>0)return `还需 ${h.cooldowns[s.id]} 轮冷却`;
  if(s.once&&h.used.includes(s.id))return '本轮已使用';
  return '';
}
function canInterrupt(state){
  const b=state.boss;
  return !b.core&&!b.finale&&!b.broken&&!b.controlImmune&&(b.charging||['tide_breaker','furnace_drop','orbit_collapse','edict_audit'].includes(b.intent)||(b.id==='duelist'&&['pierce','duel'].includes(b.intent))||(b.id==='cantor'&&['drain','bloom'].includes(b.intent))||(b.id==='warden'&&b.intent==='storm')||(b.id==='weaver'&&['silence','rewrite'].includes(b.intent))||(b.id==='final'&&b.intent==='zero_pulse'));
}
function breakBoss(state,events,label='架势击破'){
  const b=state.boss;if(b.core||b.finale||b.broken)return;
  if(b.controlImmune){b.stagger=Math.max(1,b.stagger);return;}
  const interrupted=canInterrupt(state);
  b.stagger=0;b.broken=true;b.hardControl=0;state.stats.breaks++;if(interrupted)state.stats.interrupts++;b.charging=false;
  events.push({type:'break',actor:'boss',targets:['boss'],label});
  log(state,`${label}！${bossName(state)}韧性归零，受到伤害 +50%；恢复架势后有一整轮抗控。`,'good');
}
function reduceStagger(state,n,events){
  const b=state.boss;if(b.core||b.finale||b.broken)return;
  b.stagger=Math.max(b.controlImmune?1:0,b.stagger-n);if(b.stagger<=0)breakBoss(state,events);
}
function coreCheck(state,events){
  const b=state.boss;
  if(b.core&&(isSolo(state)?b.coreHits>=SOLO_RULES.coreHits:b.corePhysical>=3&&b.coreMagic>=3)){state.mode='victory';events.push({type:'victory',actor:'boss',targets:['boss'],label:'核心净化'});log(state,isSolo(state)?'连续命中切断了核心供能。博洛伦的雾，散了。':'物理与魔法同时击穿核心。博洛伦的雾，散了。','good');}
}
function tunedSkill(state,h,s){
  const t=usesMana(h)?tuneManaSkill(state,h,s):{...s},notes=[],empowerNotes=t.empowerReason?[t.empowerReason]:[],owned=id=>(state.upgrades||[]).includes(id);
  if(h.id==='ric'){
    if(s.id==='rune'&&(h.resource>=4||h.ricEdge>0)){Object.assign(t,{name:'正域剑式 · 斩影',damage:24,hits:2,stagger:18,consumeEdge:h.ricEdge>0,variant:'ric_sword',desc:'1 AP，2 × 24 物理伤害、削韧 18，平衡 +2；持有剑势时消费 1 次。'});empowerNotes.push('正域 / 剑势：剑式变为 2 × 24 物理伤害、削韧 18');}
    if(s.id==='bind'&&(h.resource<=-4||state.boss.weakened)){Object.assign(t,{name:'负域枪式 · 封行咒弹',damage:43,hits:2,stagger:36,variant:'ric_gun',desc:'2 AP，2 × 43 魔法伤害、削韧 36，平衡 −3，冷却 2 轮；可打断指定蓄力，服从抗控。'});empowerNotes.push('负域 / 束缚：枪式变为 2 × 43 魔法伤害、削韧 36');}
    if(s.crossing)t.shift=h.resource?-2*h.resource:-4;
  }
  if(h.id==='youmu'){
    if(h.youmuForm==='captain'){Object.assign(t,CAPTAIN_SKILLS[s.id]||{}, {variant:'captain'});empowerNotes.push(`游墓接管：${t.name}`);}
    else if(s.id==='surgery'){
      if(h.specimen){Object.assign(t,{name:'移植手术',damage:0,kind:undefined,stagger:0,dotDamage:0,cost:2,heal:30,allHeal:10,shield:18,selfShield:false,surgery:false,transplant:true,icon:'heal',style:'rune',variant:'transplant',desc:`将${SPECIMEN_NAMES[h.specimen]}标本转化为全队 18 护盾，主目标回复 30、其他人 10；标本随后消耗。`});empowerNotes.push(`${SPECIMEN_NAMES[h.specimen]}标本已就绪：切除变为移植`);}
      else if(h.surgicalReady){const key=TRANSFERABLE_LAYERS[state.boss.id];t.captureLayer=!state.boss.core&&!state.boss.finale&&state.boss[key]>0?key:null;if(!t.captureLayer){t.damage=58;t.stagger=30;t.name='切除手术 · 清创';}empowerNotes.push(t.captureLayer?`手术准备：切除最多 2 层${SPECIMEN_NAMES[t.captureLayer]}`:'无可转移护层：清创伤害 58、削韧 30');}
    }
    if(h.exhaustedTurns>0&&t.damage){t.damage*=.8;notes.push('虚脱：伤害 −20%');}
    if(owned('youmu_transplant')&&t.transplant){t.shield=26;t.heal=40;t.desc=`将${SPECIMEN_NAMES[h.specimen]}标本转化为全队 26 护盾，主目标回复 40、其他人 10；支付 2 气息 / 2 AP，标本随后消耗。`;empowerNotes.push('无菌移植：全队护盾 26、主目标治疗 40');}
    if(owned('youmu_resolve')&&s.id==='bloodoath'&&t.transform){t.shield=36;t.desc='花 1 AP / 2 气息，主动献血至 40% 生命（已低于则不扣），游墓接管并嘲讽两轮，获得 36 护盾；承伤 −35%，退出后虚脱两轮，每场一次。';}
  }
  const intuition=h.id==='knibbs'&&h.intuition>=3&&(['focus','scatter'].includes(s.id)||s.id==='response_counter');
  const alternating=h.id==='apeilia'&&s.kind&&h.lastKind&&h.lastKind!==s.kind&&s.id!=='response_counter';
  let consumeGrace=false,consumeVerdict=false;
  if(owned('knibbs_deadeye')&&s.id==='focus'&&intuition){t.damage=45;t.hits=2;empowerNotes.push('双重确认：满直感改为 2 × 63 基础物理伤害');}
  if(owned('knibbs_expose')&&s.id==='shot'&&state.boss.marked){t.gain=3;t.intuitionGain=2;t.stagger=14;empowerNotes.push('弹道记忆：已标记目标，气息 +3、直感 +2、削韧 14');}
  if(owned('apeilia_cascade')&&s.id==='eden'&&alternating&&h.resource>=6){t.hits=6;t.stagger=44;empowerNotes.push('六翼展开：6 连击与魔法衔接，伊甸 6 段 / 基础削韧 44');}
  if(owned('apeilia_zero')&&s.id==='sentinel'&&alternating&&h.resource>=6){t.ap=1;empowerNotes.push('零时点火：6 连击与物理衔接，哨兵仅耗 1 行动点');}
  if(owned('ric_grace')&&s.id==='shelter'&&h.grace){t.ap=1;t.shield=38;t.desc='消费余响，1 AP 获得自身 38 护盾和 2 次剑势，平衡 +4；负向过零额外全队获得 10 护盾。';consumeGrace=true;empowerNotes.push('余响同调：消耗余响，1 行动点施放 38 自身护盾与剑势');}
  if(owned('ric_verdict')&&s.id==='rune'&&h.verdict){t.name='剑式 · 清账三连';t.damage=24;t.hits=3;t.stagger=20;t.desc='1 AP，3 × 24 物理伤害、削韧 20，平衡 +2；消费清账，若持有剑势也会消费 1 次。';consumeVerdict=true;empowerNotes.push('清账三连：消耗清账，3 × 24 物理伤害 / 削韧 20');}
  if(s.resetBalance)t.shift=-h.resource;
  if(intuition){t.damage*=1.4;t.stagger=(t.stagger||0)+12;notes.push('直感满层：伤害 +40%、削韧 +12');}
  if(alternating){t.damage*=1.25;t.stagger=(t.stagger||0)+6;notes.push('交叉火力：伤害 +25%、削韧 +6、连击 +1');}
  if(h.id==='apeilia'&&s.id==='blade'&&h.lastKind==='physical'){t.gain=1;notes.push('连续物理：螳螂刀仅获得 1 连击');}
  if(owned('knibbs_steadyhands')&&s.id==='breathe'&&h.intuition>=2){t.selfAttackBuff=30;empowerNotes.push('稳手装填：至少 2 直感时，下一次主动攻击增伤 30%，两轮内有效');}
  if(owned('knibbs_crossfire')&&s.id==='cover'&&state.boss.marked){t.stripBuffs=1;empowerNotes.push('交叉封锁：掩护射击命中前额外清除 1 层敌方增益');}
  if(owned('apeilia_brace')&&s.id==='reboot'&&h.lastKind==='magic'){t.selfGuard=true;empowerNotes.push('折返防线：魔法攻击后重整，同时进入本轮个人防御');}
  if(owned('apeilia_puncture')&&s.id==='sentinel'&&(state.boss.broken||state.boss.exposed)){t.gain=2;empowerNotes.push('弱点回收：打入破绽额外回收 2 连击');}
  if(owned('ric_erosion')&&s.id==='mend'){t.healSuppression=2;empowerNotes.push('负域侵蚀：敌方两轮内治疗效果降低 50%');}
  if(owned('ric_discipline')&&s.id==='bind'&&(h.resource<=-4||state.boss.weakened)){t.stripBuffs=2;empowerNotes.push('封行剥夺：强化咒弹命中前清除 2 层敌方增益');}
  if(owned('youmu_pathology')&&s.id==='surgery'&&t.surgery){t.dotDamage=12;t.healSuppression=2;empowerNotes.push('病理标记：创口每轮 12 伤害，两轮内敌方治疗减半');}
  if(owned('youmu_aftercare')&&s.id==='firstaid'&&h.youmuForm!=='captain'){t.aftercare=true;empowerNotes.push('术后观察：为急救目标清除全部共鸣，并给予两轮内下一次主动攻击 25% 增伤');}
  if(h.attackBuff>0&&t.damage&&!['retaliation','response_counter','wound_dot'].includes(t.id)){t.damage*=1+h.attackBuff/100;t.consumeAttackBuff=true;notes.push('心智增幅：本次主动攻击伤害 +'+h.attackBuff+'%，施放后消耗');}
  if(t.shield)t.desc+=' 每次获得的护盾分别持续两次敌方回合，新护盾不会延长旧护盾。';
  notes.push(...empowerNotes);
  return {skill:t,intuition,alternating,consumeGrace,consumeVerdict,notes,empowered:empowerNotes.length>0&&(!usesMana(h)||!manaSkillError(state,h,t)),empowerReason:empowerNotes.join('；')};
}
export function resolvedSkill(state,heroId,skillId){const h=heroOf(state,heroId),s=skillOf(heroId,skillId);return h&&s?tunedSkill(state,h,s).skill:s;}
function damageFactor(b,s){
  let factor=1;
  if(b.id==='golem'&&s.kind==='magic'&&!s.pierce)factor*=.82;
  if(b.id==='duelist'&&s.kind==='physical')factor*=1-b.mirror*.1;
  if(b.id==='cantor'&&s.kind==='magic'){
    if(b.spores>=3&&!s.pierce)factor*=.7;
    if(b.spores===0)factor*=1.25;
  }
  if(b.id==='weaver'&&b.seals>0&&s.kind===b.sealedKind&&!s.pierce)factor*=.55;
  if(b.id==='final')factor*=(1-b.seals*.12)*(b.sync>=3?1.2:1);
  if(b.id==='furnace'&&b.furnaceOpen)factor*=1.3;
  return factor*((b.broken||b.exposed)?1.5:1)*(b.marked?1.15:1)*(b.vulnerable?1.15:1);
}
function shiftBossLayers(b,s){
  if(s.noLayers)return;
  if(s.kind==='magic'){b.fog=Math.max(0,b.fog-1);if(b.id==='duelist')b.mirror=Math.max(0,b.mirror-1);}
  if(s.kind==='physical'&&b.id==='cantor')b.spores=Math.max(0,b.spores-1);
  if(s.kind==='physical'&&b.id==='warden')b.charge=Math.max(0,b.charge-1);
  if(b.id==='weaver'&&s.kind&&s.kind!==b.sealedKind)b.seals=Math.max(0,b.seals-1);
  if(b.id==='final'&&s.kind){
    if(b.lastKind&&b.lastKind!==s.kind){b.sync=Math.min(3,b.sync+1);b.seals=Math.max(0,b.seals-1);}
    b.lastKind=s.kind;
  }
  if(b.id==='tide'&&s.kind){b.valveHits++;if(b.valveHits>=3){b.valveHits=0;b.waterLevel=Math.max(0,b.waterLevel-1);}}
  if(b.id==='furnace'&&b.furnaceOpen&&s.kind)b.heat=Math.max(0,b.heat-1);
}
function trackBossSkill(b,s,actor){
  if(!s.damage||!s.ap||b.core||b.finale)return;
  if(b.id==='orrery'){
    const key=`${actor}/${s.id}`;
    b.prediction=clamp(b.prediction+(b.forecastSkill===key?1:-1),0,3);b.forecastSkill=key;
  }
  if(b.id==='arbiter'&&((b.decree==='light'&&s.ap>=2)||(b.decree==='heavy'&&s.ap===1)))b.violations=Math.min(3,b.violations+1);
}
export function skillPreview(state,heroId,skillId){
  const h=heroOf(state,heroId),s=skillOf(heroId,skillId);
  if(!h||!s)return {damage:0,hits:0,stagger:0,resourceBefore:0,resourceAfter:0,notes:['未知技能']};
  const {skill:t,alternating,notes,empowered,empowerReason}=tunedSkill(state,h,s),b={...state.boss};let damage=0;
  if(t.captureLayer)b[t.captureLayer]=Math.max(0,b[t.captureLayer]-2);
  if(t.stripBuffs)stripBossBuffs(b,t.stripBuffs);
  if(t.vulnerable)b.vulnerable=2;
  for(let i=0;i<(t.damage?(t.hits||1):0);i++){
    if(!b.core&&!b.finale){const n=Math.min(b.hp,Math.round(t.damage*damageFactor(b,t)));damage+=n;b.hp-=n;}
    shiftBossLayers(b,t);
  }
  trackBossSkill(b,t,h.id);
  let resourceAfter=resourceAfterSkill(h,t,alternating);
  if(usesMana(h))notes.push(t.secondaryCost?`消耗 ${t.secondaryCost} ${h.secondaryName}，返还 ${t.manaReturn||0} 魔力`:t.secondaryGain?`${t.manaEmergency?'应急提炼':`支付 ${t.cost||0} 魔力`}，获得 ${t.secondaryGain} ${h.secondaryName}`:'本次不改变魔力循环');
  if(state.boss.core&&t.damage)notes.push(isSolo(state)?`独狼核心：任意属性命中 +${Math.min(SOLO_RULES.coreHits-b.coreHits,t.hits||1)}`:`核心：${t.kind==='physical'?'物理':'魔法'}命中 +${Math.min(3-(t.kind==='physical'?b.corePhysical:b.coreMagic),t.hits||1)}`);
  if(state.boss.id==='duelist'&&t.kind==='physical'&&state.boss.mirror&&!t.captureLayer)notes.push(`${state.boss.mirror} 镜片：物理减伤 ${state.boss.mirror*10}%`);
  if(state.boss.id==='duelist'&&state.boss.intent==='mirror'&&!state.boss.broken&&t.kind==='physical'&&state.boss.mirror){
    // Backlash may consume a retaliation or trigger another boss phase.
    // Resolve this conditional chain on a copy instead of duplicating its rules.
    if(!canUse(state,heroId,skillId)){
      const projected=structuredClone(state),result=useSkill(projected,heroId,skillId);
      damage=result.events.filter(event=>event.type==='attack'&&event.targets?.includes('boss')).reduce((total,event)=>total+(event.amount||0),0);
      resourceAfter=heroOf(projected,heroId).resource;
      const backlash=result.events.find(event=>event.label==='折镜反噬');
      const refraction=result.events.find(event=>event.label==='钉刺反击'||event.label==='防护回击');
      if(backlash){
        notes.push(`折镜反噬：${scaled(state,7+state.boss.mirror*3)} 基础物理伤害（防御 / 护盾前）；预计自身损失 ${backlash.amounts?.[heroId]||0} 生命`);
        if(refraction)notes.push(`触发${refraction.label}：追加 ${refraction.amount} ${refraction.kind==='physical'?'物理':'魔法'}伤害，已计入总伤害`);
      }else notes.push('本次攻击击败刃卫，不触发折镜反噬');
    }else notes.push(`敌人存活时触发折镜反噬：${scaled(state,7+state.boss.mirror*3)} 基础物理伤害（防御 / 护盾前）`);
  }
  if(state.boss.id==='duelist'&&t.kind==='magic')notes.push(`拆除 ${Math.min(state.boss.mirror,t.hits||1)} 镜片`);
  if(state.boss.id==='cantor'&&t.kind==='physical')notes.push(`剥离 ${Math.min(state.boss.spores,t.hits||1)} 孢压`);
  if(state.boss.id==='cantor'&&t.kind==='magic'&&state.boss.spores===0)notes.push('裸冠：魔法伤害 +25%');
  if(state.boss.id==='cantor'&&t.kind==='magic'&&state.boss.spores>=3&&!s.pierce)notes.push('厚孢冠：魔法伤害 −30%');
  if(state.boss.id==='warden'&&t.kind==='physical')notes.push(`泄能 ${Math.min(state.boss.charge,t.hits||1)} 点蓄电`);
  if(state.boss.id==='weaver'&&t.kind){
    notes.push(t.kind===state.boss.sealedKind?(state.boss.seals>0&&!s.pierce?'命中封存系：伤害 −45%':'封页已破或攻击穿透抗性'):`拆除 ${Math.min(state.boss.seals,t.hits||1)} 封页`);
  }
  if(state.boss.id==='final'&&t.kind){
    if(state.boss.finale)notes.push(isSolo(state)?`独狼终幕：任意属性命中 +${Math.min(SOLO_RULES.finaleHits-b.finaleHits,t.hits||1)}；仍需战术应对与存活`:`终幕登记：${t.kind==='physical'?'物理':'魔法'}命中完成；还需另一系与战术应对`);
    else if(state.boss.lastKind&&state.boss.lastKind!==t.kind)notes.push('双系同步 +1，归零屏障 −1');
  }
  if(state.boss.id==='tide'&&t.damage)notes.push(`三击排水：水位 ${state.boss.waterLevel} → ${b.waterLevel}，阀击进度 ${b.valveHits}/3`);
  if(state.boss.id==='furnace'&&t.damage)notes.push(state.boss.furnaceOpen?`炉门敞口：伤害 +30%，炉热 ${state.boss.heat} → ${b.heat}`:'炉门关闭：本次命中不会泄热；排汽之后再利用敞口');
  if(state.boss.id==='orrery'&&t.damage)notes.push(`测绘锁定 ${state.boss.prediction} → ${b.prediction}/3：${state.boss.forecastSkill===`${h.id}/${t.id}`?'重复上一项攻击':'改用另一项攻击可打乱预测'}`);
  if(state.boss.id==='arbiter'&&t.damage)notes.push(`${state.boss.decree==='light'?'轻击令：允许 1 AP 攻击':'重击令：允许至少 2 AP 攻击'}；违令 ${state.boss.violations} → ${b.violations}/3（按实际 AP 计算，辅助技能不受限）`);
  if(t.shift&&h.resource<0&&resourceAfter>=0)notes.push('负向过零：全队额外获得 10 护盾');
  if(t.shift&&h.resource>0&&resourceAfter<=0)notes.push('正向过零：全队额外回复 8 生命');
  if(t.interrupt&&canInterrupt(state))notes.push('直接打断当前预告');
  if(state.boss.controlImmune&&t.damage)notes.push('本轮抗控：无法打断，韧性最低保留 1');
  if(state.boss.exposed&&t.damage)notes.push('应对破韧留下破绽：伤害 +50%，敌人本轮仍会出招');
  if(t.shield)notes.push(`${t.selfShield?'自身':'全队'}护盾 +${t.shield}`);
  if(t.allShield)notes.push(`额外全队护盾 +${t.allShield}`);
  if(t.reflect)notes.push(`钉刺反击 +${t.reflect} 次：受到物理攻击后回击 28 物理伤害`);
  if(t.heal)notes.push(t.self?`自身回复 ${t.heal}`:`最低生命比例回复 ${t.heal}，其他人 +${t.allHeal||0}`);
  if(t.weaken)notes.push('思维 / 领域干扰：敌人下一次行动全部伤害 −20%，不叠加');
  if(t.vulnerable)notes.push('易伤：两轮内受到伤害 +15%，不叠加');
  if(t.hardControl)notes.push(state.boss.controlImmune||state.boss.broken||state.boss.core||state.boss.finale||state.boss.hardControl?'当前无法强控；伤害、回转及其他效果仍生效':'强控：取消下一次普通敌方行动，之后一整轮抗控；不附带破韧增伤');
  if(t.stripBuffs)notes.push(`额外剥除 ${t.stripBuffs} 层可消除增益；不剥除阶段、抗控、核心规则`);
  if(t.regenTurns)notes.push(`最低生命比例存活队员在接下来的 ${t.regenTurns} 次回合末各回复 ${t.regenAmount}；不叠加、不复活`);
  if(t.transform)notes.push(`主动献血 ${Math.max(0,h.hp-Math.floor(h.maxHp*.4))} 生命，直接进入接管；不会降到 1 生命以下`);
  if(t.dotDamage)notes.push(`创口：接下来两次敌人行动前各造成 ${t.dotDamage} 物理伤害；不拆层、不计核心命中`);
  if(t.edge)notes.push(`获得 ${t.edge} 次剑势，强化剑式`);
  if(t.captureLayer)notes.push(`仅转移护层：${SPECIMEN_NAMES[t.captureLayer]}最多 2 层；不转移阶段、抗控或核心规则`);
  if(t.transform)notes.push('船长接管两轮，退出后虚脱两轮；每战一次');
  if(t.captainFinish)notes.push('炮击后立即结束接管并进入虚脱');
  const stagger=state.boss.core||state.boss.finale||state.boss.broken?0:t.interrupt&&canInterrupt(state)?state.boss.stagger:Math.min(t.stagger||0,Math.max(0,state.boss.stagger-(state.boss.controlImmune?1:0)));
  return {damage,hits:t.damage?t.hits||1:0,stagger,resourceBefore:h.resource,resourceAfter,notes,empowered,empowerReason,ap:t.ap,cost:t.cost||0,refund:manaRefund(h,t),heal:t.heal||0,allHeal:t.allHeal||0,shield:t.shield||0,allShield:t.allShield||0,cleanse:t.cleanse||0,allCleanse:t.allCleanse||0,weaken:!!t.weaken,vulnerable:!!t.vulnerable,hardControl:!!t.hardControl,stripBuffs:t.stripBuffs||0,self:!!t.self,selfShield:!!t.selfShield,reflect:t.reflect||0,regenTurns:t.regenTurns||0,regenAmount:t.regenAmount||0,revive:t.revive||0,attackBuff:t.attackBuff||t.selfAttackBuff||0,mark:!!t.mark,name:t.name,description:t.desc,desc:t.desc,icon:t.icon,style:t.style,kind:t.kind,variant:t.variant||null,variantReason:empowerReason,secondaryBefore:h.secondary||0,secondaryAfter:usesMana(h)?manaAfterSkill(h,t).secondary:0,secondarySpend:t.secondaryCost||0,secondaryCost:t.secondaryCost||0,secondaryGain:t.secondaryGain||0,recordsBefore:h.secondary||0,recordsAfter:usesMana(h)?manaAfterSkill(h,t).secondary:0};
}
export function heroStatus(state,heroId){
  const h=heroOf(state,heroId);if(!h)return '';
  if(h.id==='knibbs')return h.intuition>=3?'直感 3/3 · 强技 / 迎击 +40% 伤害，削韧 +12':`直感 ${h.intuition}/3 · 每次攻击积攒 1`;
  if(h.id==='apeilia')return !h.lastKind?'交叉火力 · 物理 / 魔法交替强化':`上一击${h.lastKind==='physical'?'物理':'魔法'} · 下一${h.lastKind==='physical'?'魔法':'物理'}技 +25%伤害 / 6削韧 / 1连击`;
  if(h.id==='haart')return manaStatus(h);
  if(h.id==='qianxing')return manaStatus(h);
  if(h.id==='youmu')return h.youmuForm==='captain'?`游墓接管 · 剩余 ${h.captainTurns} 轮 · 炮击可提前收尾`:h.exhaustedTurns?`虚脱 ${h.exhaustedTurns} 轮 · 输出 −20% / 承伤 +20%`:h.specimen?`${SPECIMEN_NAMES[h.specimen]}标本 · 移植手术就绪`:h.surgicalReady?'手术准备 · 切除就绪':'外科医生 · 手术刀开启切除';
  if(h.id==='patch')return manaStatus(h);
  if(h.grace||h.verdict)return `调和余响 · ${h.grace?'同调 1 AP / 自身 38 护盾 / 剑势 2 次 ':''}${h.verdict?'剑式三段物理强化':''}`;
  return `${h.resource>0?'正域剑战':h.resource<0?'负域枪战':'领域平衡'} ${h.resource}/±10 · ${h.ricEdge?`剑势 ${h.ricEdge} 次 · `:''}每轮向 0 回 2`;
}
export function bossSummary(state){
  const b=state.boss,result=[];
  if(isSolo(state))result.push({label:'独狼',value:`${SOLO_RULES.ap} AP · 敌方生命×${SOLO_RULES.bossHp} / 伤害×${SOLO_RULES.bossDamage} · 韧性${SOLO_RULES.stagger}`,tone:'normal'});
  if(b.exposed)result.push({label:'应对破绽',value:'受到伤害 +50% · 本轮仍会出招',tone:'good'});
  if(b.weakened)result.push({label:'进攻受扰',value:'下一次行动全部伤害 −20%',tone:'good'});
  if(b.vulnerable)result.push({label:'易伤',value:`受到伤害 +15% · 剩余 ${b.vulnerable} 轮`,tone:'good'});
  if(b.hardControl)result.push({label:'行动封锁',value:'取消下次普通行动 · 恢复后一轮抗控',tone:'good'});
  if(b.healSuppression)result.push({label:'治疗抑制',value:`治疗效果 −50% · 剩余 ${b.healSuppression} 轮`,tone:'good'});
  if(b.dot)result.push({label:'手术创口',value:`每次行动后 ${b.dot.damage} 物理伤害 · 剩余 ${b.dot.turns} 次 · 不计核心命中`,tone:'good'});
  const taunter=alive(state).find(h=>h.tauntTurns>0);if(taunter)result.push({label:'嘲讽',value:`单体主招优先攻击${taunter.short} · 剩余 ${taunter.tauntTurns} 轮`,tone:'warning'});
  if(b.id==='golem'){
    result.push({label:'解体',value:`${b.stage} / 4`,tone:'normal'});
    if(b.fog)result.push({label:'迷雾',value:`${b.fog} 层 · 魔法命中驱散`,tone:'warning'});
    if(b.phasePending)result.push({label:'地裂预警',value:'下一轮蓄力 · 先获得完整行动点',tone:'warning'});
  }
  if(b.id==='duelist'){
    result.push({label:'镜片',value:`${b.mirror} / 3 · 物理减伤 ${b.mirror*10}%`,tone:b.mirror?'warning':'good'},{label:'拆镜',value:'魔法每次命中 −1 镜片',tone:'normal'});
    if(b.intent==='mirror'&&!b.broken&&b.mirror)result.push({label:'折镜架势',value:'物理技能使攻击者承受反噬',tone:'warning'});
  }
  if(b.id==='cantor')result.push({label:'孢压',value:`${b.spores} / 5 · 物理每次命中 −1`,tone:b.spores>=3?'warning':'normal'},{label:'菌冠',value:b.spores===0?'裸冠 · 魔法伤害 +25%':b.spores>=3?'厚孢冠 · 魔法减伤 30%':'薄孢冠 · 无额外抗性',tone:b.spores===0?'good':'normal'});
  if(b.id==='warden')result.push({label:'蓄电',value:`${b.charge} / 6 · 物理每次命中泄能 1`,tone:b.charge>=4?'warning':'normal'},{label:'风暴',value:'蓄电提高主招伤害 · 护盾与招架均能缓解',tone:'normal'});
  if(b.id==='weaver')result.push({label:'封页',value:`${b.seals} / 3 · 封存${b.sealedKind==='physical'?'物理':'魔法'}`,tone:b.seals?'warning':'good'},{label:'拆封',value:`${b.sealedKind==='physical'?'魔法':'物理'}每次命中 −1 封页 · 每轮換系并补 1 页`,tone:'normal'});
  if(b.id==='tide')result.push({label:'水位',value:`${b.waterLevel}/4 · 浪涌每层基础伤害 +12`,tone:b.waterLevel>=3?'warning':'normal'},{label:'阀击',value:`${b.valveHits}/3 · 任意属性累计三次命中排水 1，进度保留`,tone:'normal'});
  if(b.id==='furnace')result.push({label:'炉热',value:`${b.heat}/6 · 排汽与落锤随炉热增强`,tone:b.heat>=4?'warning':'normal'},{label:'炉门',value:b.furnaceOpen?'敞口 · 受到伤害 +30%，每次命中泄热 1':'关闭 · 排汽后敞口，落锤后关闭',tone:b.furnaceOpen?'good':'normal'});
  if(b.id==='orrery')result.push({label:'测绘锁定',value:`${b.prediction}/3 · 重复上一项攻击 +1，换招 −1`,tone:b.prediction>=2?'warning':'normal'},{label:'已记录',value:b.forecastSkill?skillOf(...b.forecastSkill.split('/'))?.name||'上一项攻击':'尚未记录；反击与辅助技能不纳入预测',tone:'normal'});
  if(b.id==='arbiter')result.push({label:'现行法令',value:b.decree==='light'?'轻击令 · 允许 1 AP 攻击':'重击令 · 允许至少 2 AP 攻击',tone:'warning'},{label:'违令',value:`${b.violations}/3 · 增强本轮判罚；辅助技能不计，新回合清零换令`,tone:b.violations?'warning':'normal'});
  if(b.id==='final'){
    if(b.finale)result.push({label:'终幕',value:`${isSolo(state)?`任意属性 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1 · 魔法 ${b.finaleMagic}/1`} · ${state.response?'应对已准备':'还需准备应对'}`,tone:'warning'},{label:'剩余',value:`${b.finaleTurns} 个完整回合 · 命中与应对齐备后存活结束回合`,tone:'warning'});
    else result.push({label:'归零屏障',value:`${b.seals} / 3 · 减伤 ${b.seals*12}%`,tone:b.seals?'warning':'good'},{label:'双系同步',value:`${b.sync} / 3 · ${b.lastKind?`上次${b.lastKind==='physical'?'物理':'魔法'}，换系拆 1 屏障`:'先攻击，再用另一系衔接'}${b.sync>=3?' · 伤害 +20%':''}`,tone:b.sync>=3?'good':'normal'});
  }
  if(b.id!=='golem')result.push({label:'阶段',value:b.finale?'第三阶段 · 停机过载':b.stage?'第二阶段':'第一阶段',tone:b.stage?'warning':'normal'});
  if(b.controlImmune)result.push({label:'抗控',value:'本轮无法打断 · 韧性最低 1',tone:'warning'});
  if(b.marked)result.push({label:'已标记',value:'本轮受到伤害 +15%',tone:'good'});
  return result;
}
function dealToBoss(state,skill,events,actor,{response=false}={}){
  const b=state.boss,wasCore=b.core,wasFinale=b.finale,h=heroOf(state,actor),reflect=b.id==='duelist'&&b.intent==='mirror'&&!b.broken&&b.mirror&&skill.kind==='physical'&&!response,reflection=7+b.mirror*3;
  let total=0;const hitAmounts=[];
  for(let i=0;i<(skill.hits||1);i++){
    if(wasCore){if(skill.kind==='physical')b.corePhysical=Math.min(3,b.corePhysical+1);if(skill.kind==='magic')b.coreMagic=Math.min(3,b.coreMagic+1);b.coreHits=Math.min(SOLO_RULES.coreHits,b.coreHits+1);}
    else if(wasFinale){if(skill.kind==='physical')b.finalePhysical=1;if(skill.kind==='magic')b.finaleMagic=1;b.finaleHits=Math.min(SOLO_RULES.finaleHits,b.finaleHits+1);}
    else{const n=Math.round(skill.damage*damageFactor(b,skill)),taken=Math.min(b.hp,n);b.hp-=taken;total+=taken;hitAmounts.push(taken);}
    if(wasCore||wasFinale)hitAmounts.push(0);
    shiftBossLayers(b,skill);
  }
  trackBossSkill(b,skill,actor);
  state.stats.damage+=total;
  events.push({type:'attack',actor,targets:['boss'],bossId:b.id,skillId:skill.id,variant:skill.variant||null,kind:skill.kind,style:skill.style,hits:skill.hits||1,amount:total,amounts:{boss:total},hpLosses:{boss:total},hitAmounts:{boss:hitAmounts},absorbedAmounts:{boss:0},label:skill.name});
  if(wasCore){log(state,`${h.short} · ${skill.name}：核心 ${isSolo(state)?`任意命中 ${b.coreHits}/${SOLO_RULES.coreHits}`:`物理 ${b.corePhysical}/3，魔法 ${b.coreMagic}/3`}。`,'good');coreCheck(state,events);return;}
  if(wasFinale){log(state,`${h.short} · ${skill.name}：接入 ${isSolo(state)?`任意命中 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1，魔法 ${b.finaleMagic}/1`}；准备应对，守住最后放电后关闭核心。`,'good');return;}
  log(state,`${h.short} · ${skill.name}，造成 ${total} ${skill.kind==='magic'?'魔法':'物理'}伤害。`);
  if(b.hp<=0){
    if(b.id==='final'){
      b.hardControl=0;b.dot=null;b.finale=true;b.finaleFresh=true;b.finaleTurns=2;b.finalePhysical=0;b.finaleMagic=0;b.finaleHits=0;b.broken=false;b.exposed=false;b.charging=false;b.controlImmune=0;b.seals=0;
      events.push(bossPhaseEvent(state,'phase','停机过载'));
      log(state,`核心进入停机过载！接下来 2 个完整回合内，${isSolo(state)?'以任意属性累计命中 2 次':'以物理与魔法各命中一次完成双系接入'}，再准备战术应对。守住最后放电即可停机；超时则核心恢复 22% 生命。`,'warning');return;
    }
    if(b.id!=='golem'){
      state.mode='victory';b.charging=false;b.broken=false;b.exposed=false;state.response=null;
      const endings={duelist:['折镜崩落','镜片落地，回廊重归寂静。'],cantor:['菌冠寂灭','菌丝消散，紫雾中的面具终于落下。'],warden:['风暴熄止','雷针熄灭，栈桥上只剩远处的风声。'],weaver:['封页解开','封存的文字重新浮现，通向天井的路被写了出来。']};
      const ending=endings[b.id]||['通路已打开','设施停止运转，前方的通道重新开放。'];
      events.push({type:'victory',actor:'boss',targets:['boss'],label:ending[0]});
      log(state,`${bossName(state)}已被击败。${ending[1]}`,'good');return;
    }
    b.hardControl=0;b.dot=null;b.core=true;b.coreFresh=true;b.corePhysical=0;b.coreMagic=0;b.coreHits=0;b.coreTurns=2;b.broken=false;b.exposed=false;b.charging=false;b.phasePending=false;b.fog=5;
    events.push(bossPhaseEvent(state,'core','核心暴露'));log(state,`躯壳崩解！在接下来的 2 个完整回合内，${isSolo(state)?'对核心累计造成 4 次任意属性命中':'对核心造成 3 次物理与 3 次魔法命中'}。`,'warning');return;
  }
  const stage=b.id==='golem'?Math.min(4,Math.floor((1-b.hp/b.maxHp)*5)):(b.hp<=b.maxHp*.5?1:0);
  if(stage>b.stage){
    b.stage=stage;
    if(b.id==='golem'){
      b.phasePending=!b.broken;events.push(bossPhaseEvent(state,'phase','元素解体'));
      log(state,`第 ${stage} 次元素解体${b.broken?'；架势崩溃使其无法蓄力':'：地裂将在下一轮预告，届时先恢复完整行动点'}。`,'warning');
    }else{
      const phaseNames={duelist:'镜刃过载',cantor:'菌冠升华',warden:'雷脊熔断',weaver:'缄默复写',final:'归零重启',tide:'应急涨潮',furnace:'炉膛过热',orrery:'星轨收束',arbiter:'加急判令'};
      const phaseText={duelist:'补充 1 镜片，之后每轮开始恢复 1 镜片；招式伤害提高 6。',cantor:'孢压 +2，之后孢雨播种 3 层；招式伤害提高 5。',warden:'蓄电 +2，之后每轮额外获得 1 蓄电；主招基础伤害提高 5。',weaver:'封页恢复至 3，主招基础伤害提高 5；封缄抽取资源提高至 2。',final:'归零屏障恢复至 3，同步归零；主招基础伤害提高 7。耗尽生命后还有终幕。',tide:'水位 +1；之后每段主招基础伤害 +5，所有变化立即更新预告。',furnace:'炉热 +1；之后每段主招基础伤害 +5，开炉泄热规则不变。',orrery:'锁定 +1；之后每段主招基础伤害 +5，换招仍能消除锁定。',arbiter:'之后每段主招基础伤害 +5；法令仍逐轮切换，违令不会跨轮保留。'};
      if(b.id==='duelist')b.mirror=Math.min(3,b.mirror+1);
      if(b.id==='cantor')b.spores=Math.min(5,b.spores+2);
      if(b.id==='warden')b.charge=Math.min(6,b.charge+2);
      if(b.id==='weaver')b.seals=3;
      if(b.id==='final'){b.seals=3;b.sync=0;b.lastKind=null;}
      if(b.id==='tide')b.waterLevel=Math.min(4,b.waterLevel+1);
      if(b.id==='furnace')b.heat=Math.min(6,b.heat+1);
      if(b.id==='orrery')b.prediction=Math.min(3,b.prediction+1);
      events.push(bossPhaseEvent(state,'phase',phaseNames[b.id]));
      log(state,`${phaseNames[b.id]}：${phaseText[b.id]}`,'warning');
    }
  }
  if(skill.interrupt&&canInterrupt(state))breakBoss(state,events,b.id==='golem'?'地裂打断':'蓄力打断');
  reduceStagger(state,skill.stagger||0,events);if(skill.mark)b.marked=true;
  if(reflect&&state.mode==='playing')hurtParty(state,events,[actor],reflection,'physical','折镜反噬','slash',false);
}
function healHero(state,h,n){const real=Math.min(n,h.maxHp-h.hp);h.hp+=real;state.stats.healed+=real;return real;}
function harmony(state,h,before,events){
  if(h.id!=='ric')return;
  if(before<0&&h.resource>=0){
    if((state.upgrades||[]).includes('ric_grace'))h.grace=true;
    if((state.upgrades||[]).includes('ric_verdict'))h.verdict=true;
    h.balanceBursts++;const targets=alive(state),amounts={};for(const p of targets){amounts[p.id]=grantShield(p,10);}
    events.push({type:'shield',actor:h.id,targets:targets.map(p=>p.id),amount:10,amounts,style:'guard',label:'领域调和 · 正生'});log(state,'负向过零：领域调和为全队附加 10 护盾。','good');
  }else if(before>0&&h.resource<=0){
    if((state.upgrades||[]).includes('ric_grace'))h.grace=true;
    if((state.upgrades||[]).includes('ric_verdict'))h.verdict=true;
    h.balanceBursts++;const targets=alive(state),amounts={};for(const p of targets)amounts[p.id]=healHero(state,p,8);
    events.push({type:'heal',actor:h.id,targets:targets.map(p=>p.id),amount:8,amounts,style:'rune',label:'领域调和 · 负生'});log(state,'正向过零：领域调和为全队回复 8 生命。','good');
  }
}
export function useSkill(state,id,skillId){
  const error=canUse(state,id,skillId);if(error)return{ok:false,error,events:[]};
  const h=heroOf(state,id),source=skillOf(id,skillId),{skill:s,intuition,alternating,consumeGrace,consumeVerdict,empowerReason}=tunedSkill(state,h,source),events=[],before=h.resource;
  state.ap-=s.ap;state.selected=id;state.stats.actions++;state.serial++;h.used.push(s.id);
  const mana=usesMana(h)?manaAfterSkill(h,s):null;
  h.resource=mana?mana.resource:resourceAfterSkill(h,s,alternating);
  if(mana){h.secondary=mana.secondary;h.records=h.id==='patch'?h.secondary:0;applyManaSkill(state,h,s,events);}
  if(s.consumeAttackBuff){h.attackBuff=0;h.attackBuffTurns=0;}
  if(s.consumeEdge)h.ricEdge=Math.max(0,h.ricEdge-1);
  if(s.edge)h.ricEdge=Math.min(2,s.edge);
  if(s.weaken)state.boss.weakened=1;
  if(s.vulnerable)state.boss.vulnerable=2;
  if(s.healSuppression)state.boss.healSuppression=2;
  if(s.stripBuffs)stripBossBuffs(state.boss,s.stripBuffs);
  if(s.selfGuard)h.guard=true;
  if(s.mark&&!s.damage)state.boss.marked=true;
  if(s.dotDamage&&!state.boss.core&&!state.boss.finale)state.boss.dot={damage:s.dotDamage,turns:2,actor:id,kind:'physical'};
  if(s.surgicalSetup)h.surgicalReady=true;
  if(s.surgery){h.surgicalReady=false;if(s.captureLayer){state.boss[s.captureLayer]=Math.max(0,state.boss[s.captureLayer]-2);h.specimen=s.captureLayer;log(state,`切除${SPECIMEN_NAMES[s.captureLayer]}，标本已保存；移植手术就绪。`,'good');}}
  if(s.transplant)h.specimen=null;
  if(s.transform){
    const blood=Math.max(0,h.hp-Math.max(1,Math.floor(h.maxHp*.4)));h.hp-=blood;
    if(blood)events.push({type:'boss',actor:id,targets:[id],kind:'physical',style:'rune',amount:blood,amounts:{[id]:blood},hpLosses:{[id]:blood},absorbedAmounts:{[id]:0},label:'血誓 · 主动献血'});
    h.youmuForm='captain';h.captainTurns=2;h.captainUsed=true;h.surgicalReady=false;h.tauntTurns=2;
    log(state,'主动献血 '+blood+' 生命，游墓接管并嘲讽两轮；结束后游木虚脱两轮。','warning');
  }
  if(mana)log(state,`${h.short}：魔力 ${before} → ${h.resource}，${h.secondaryName}现有 ${h.secondary}/6。`);
  if(s.cooldown)h.cooldowns[s.id]=s.cooldown+1;
  if(consumeGrace)h.grace=false;if(consumeVerdict)h.verdict=false;
  if(empowerReason)log(state,empowerReason+'。','good');
  if(s.damage){
    if(intuition){h.intuition=0;log(state,'直感兑现：本次强技伤害 +40%、削韧 +12。','good');}
    if(alternating)log(state,'交叉火力：交替强化伤害、削韧，回收 1 连击。','good');
    dealToBoss(state,s,events,id);if(h.id==='knibbs')h.intuition=Math.min(3,h.intuition+(s.intuitionGain||1));if(h.id==='apeilia')h.lastKind=s.kind;
  }
  if(s.shield){
    const targets=s.selfShield?[h]:alive(state),amounts={};targets.forEach(p=>{amounts[p.id]=grantShield(p,s.shield);p.resonance=Math.max(0,p.resonance-(s.cleanse||0));if(s.reflect)p.reflect=Math.min(2,(p.reflect||0)+s.reflect);});
    events.push({type:'shield',actor:id,targets:targets.map(p=>p.id),amount:s.shield,amounts,style:'guard',label:s.name});log(state,`${h.short} · ${s.name}：${s.selfShield?'自身':'全队'}获得 ${s.shield} 护盾${s.reflect?`与 ${s.reflect} 次钉刺反击`:''}。`,'good');
  }
  if(s.allShield){
    const targets=alive(state),amounts={};for(const p of targets){amounts[p.id]=grantShield(p,s.allShield);}
    events.push({type:'shield',actor:id,targets:targets.map(p=>p.id),amount:s.allShield,amounts,style:'guard',label:'协同装甲'});log(state,`协同装甲：全队额外获得 ${s.allShield} 护盾。`,'good');
  }
  if(s.heal){
    const down=s.revive?state.heroes.find(p=>p.hp<=0):null,target=down||(s.self?h:[...alive(state)].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0]),amount=healHero(state,target,down?s.revive:s.heal),amounts={[target.id]:amount};
    if(s.aftercare){target.resonance=0;target.attackBuff=Math.max(target.attackBuff,25);target.attackBuffTurns=2;}
    if(s.targetCleanse)target.resonance=Math.max(0,target.resonance-s.targetCleanse);
    if(s.allHeal)alive(state).filter(p=>p!==target).forEach(p=>{amounts[p.id]=healHero(state,p,s.allHeal);});
    if(s.cleanse)alive(state).forEach(p=>p.resonance=Math.max(0,p.resonance-s.cleanse));
    events.push({type:'heal',actor:id,targets:s.allHeal?alive(state).map(p=>p.id):[target.id],amount,amounts,style:s.style,label:s.name});log(state,`${s.name}：${target.short}回复 ${amount} 生命${s.allHeal?`，其余队员回复 ${s.allHeal}`:''}${s.cleanse?`，净化 ${s.cleanse} 层共鸣`:''}。`,'good');
  }
  if(s.regenTurns){const target=[...alive(state)].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];target.regenTurns=s.regenTurns;target.regenAmount=s.regenAmount;events.push({type:'buff',actor:id,targets:[target.id],style:'rune',label:'精密缝合 · 持续恢复'});}
  if(s.attackBuff||s.selfAttackBuff){const targets=s.selfAttackBuff?[h]:alive(state);for(const target of targets){target.attackBuff=Math.max(target.attackBuff,s.selfAttackBuff||s.attackBuff);target.attackBuffTurns=2;}events.push({type:'buff',actor:id,targets:targets.map(x=>x.id),style:'rune',label:'心智增幅 · 下次攻击强化'});}
  if(s.hardControl&&!state.boss.core&&!state.boss.finale&&!state.boss.broken&&!state.boss.controlImmune&&!state.boss.hardControl){state.boss.hardControl=1;state.stats.interrupts++;events.push({type:'buff',actor:id,targets:['boss'],style:'rune',label:'强制停机 · 行动封锁'});}
  if(s.cleanse&&!s.shield&&!s.heal)for(const target of alive(state))target.resonance=Math.max(0,target.resonance-s.cleanse);
  if(s.allCleanse)for(const target of alive(state))target.resonance=Math.max(0,target.resonance-s.allCleanse);
  if(s.shift||s.resetBalance)harmony(state,h,before,events);
  if(s.captainFinish)leaveCaptain(state,h);
  if(!events.length)events.push({type:'buff',actor:id,targets:s.weaken||s.vulnerable||s.stripBuffs||s.mark?['boss']:[id],style:s.style,label:s.name});
  return{ok:true,events};
}
function leaveCaptain(state,h){h.youmuForm='doctor';h.captainTurns=0;h.tauntTurns=0;h.exhaustedTurns=2;h.exhaustionFresh=true;log(state,'游墓退去。游木虚脱两轮：输出 −20%、承伤 +20%；仍可治疗、用药与行动。','warning');}
export function usePotion(state,targetId){
  if(state.mode!=='playing')return{ok:false,error:'战斗已结束',events:[]};
  if(state.ap<1||state.potions<=0)return{ok:false,error:state.ap<1?'行动点不足':'补给已用尽',events:[]};
  const h=heroOf(state,targetId===undefined?state.selected:targetId);
  if(!h)return{ok:false,error:'未知的药剂目标',events:[]};if(h.hp>=h.maxHp)return{ok:false,error:'这位队员生命已满',events:[]};
  const down=h.hp<=0;state.ap--;state.potions--;state.serial++;state.stats.actions++;const amount=healHero(state,h,down?60:65);h.resonance=0;
  log(state,`使用应急药剂：${h.short}${down?'重新站起，并':''}回复 ${amount} 生命，共鸣清零。`,'good');
  return{ok:true,events:[{type:'heal',actor:state.selected,targets:[h.id],amount,amounts:{[h.id]:amount},style:'rune',label:down?'重新站起':'应急药剂'}]};
}
export function guard(state,id){
  const h=heroOf(state,id);
  if(state.mode!=='playing'||!h||h.hp<=0||state.ap<1||h.guard)return{ok:false,error:h?.guard?'已处于防御状态':'无法防御',events:[]};
  h.guard=true;state.ap--;state.stats.actions++;state.serial++;log(state,`${h.short}采取防御，下轮开始前受到的伤害减少 55%。`,'good');
  return{ok:true,events:[{type:'shield',actor:id,targets:[id],label:'防御',style:'guard',amount:0}]};
}
const enemyMultiplier=state=>DIFFICULTIES[state.difficulty].damage*(isSolo(state)?SOLO_RULES.bossDamage:1)*(state.boss.weakened?.8:1);
function scaled(state,n){return Math.round(n*enemyMultiplier(state));}
function attackSpec(state){
  const b=state.boss,bonus=b.stage?(b.id==='duelist'?6:b.id==='final'?7:5):0;
  if(b.finale)return{key:'zero_end',name:'停机过载 · 最后放电',damage:65,kind:'magic',group:true,style:'burst'};
  if(b.charging)return{key:'quake',name:'地裂',damage:70,kind:'physical',group:true,style:'quake'};
  const table={
    slam:{name:'势能重击',damage:85,kind:'physical',style:'quake'},missiles:{name:'碎岩连弹',damage:31,hits:3,kind:'physical',style:'shot'},
    fog:{name:'迷雾孢子',damage:24,kind:'magic',group:true,style:'mist'},compression:{name:'魔力压缩',damage:48,kind:'magic',group:true,style:'rune'},reclaim:{name:'元素回收',damage:22,kind:'magic',group:true,style:'rune'},
    rend:{name:'裂锋三连',damage:28+bonus,hits:3,kind:'physical',style:'slash'},mirror:{name:'折镜架势',damage:75+bonus+b.mirror*5,kind:'physical',style:'slash'},
    pierce:{name:'贯镜突刺',damage:44+bonus+b.mirror*4,kind:'physical',group:true,style:'slash'},duel:{name:'双刃决斗',damage:98+bonus,kind:'physical',style:'slash'},
    sow:{name:'播孢细雨',damage:35+bonus,kind:'magic',group:true,style:'mist'},drain:{name:'抽髓祷告',damage:74+bonus+b.spores*6,kind:'magic',style:'rune'},
    bloom:{name:'冠孢绽放',damage:50+bonus+b.spores*10,kind:'magic',group:true,style:'burst'},weave:{name:'菌丝重织',damage:28+bonus,kind:'magic',group:true,style:'rune'},
    arc:{name:'雷链双击',damage:35+bonus+b.charge*3,hits:2,kind:'physical',style:'shot'},ground:{name:'接地冲击',damage:44+bonus+b.charge*4,kind:'physical',group:true,style:'quake'},
    storm:{name:'风暴倾泻',damage:50+bonus+b.charge*9,kind:'magic',group:true,style:'burst'},charge:{name:'雷针充能',damage:30+bonus,kind:'magic',group:true,style:'rune'},
    script:{name:'缄页刻写',damage:42+bonus,kind:'magic',group:true,style:'rune'},silence:{name:'资源封缄',damage:42+bonus,hits:2,kind:'magic',style:'shot'},
    rewrite:{name:'命运复写',damage:32+bonus,kind:'magic',group:true,style:'rune'},sever:{name:'断章裁切',damage:50+bonus+b.seals*8,kind:'physical',group:true,style:'slash'},
    zero_lance:{name:'归零贯星',damage:40+bonus+b.seals*5,hits:2,kind:'physical',style:'shot'},zero_field:{name:'寂静边界',damage:45+bonus,kind:'magic',group:true,style:'rune'},
    zero_pulse:{name:'空白脉冲',damage:56+bonus+b.seals*9,kind:'magic',group:true,style:'burst'},zero_reset:{name:'回响重置',damage:30+bonus,kind:'magic',group:true,style:'rune'},
    tide_hook:{name:'牵流重锚',damage:84+bonus+b.waterLevel*5,kind:'physical',style:'slash'},tide_fill:{name:'开闸蓄水',damage:32+bonus,kind:'magic',group:true,style:'mist'},
    tide_breaker:{name:'满潮破堤',damage:48+bonus+b.waterLevel*12,kind:'magic',group:true,style:'quake'},tide_release:{name:'泄流穿刺',damage:72+bonus+b.waterLevel*9,kind:'physical',style:'shot'},
    furnace_lift:{name:'吊臂连摆',damage:39+bonus,hits:2,kind:'physical',style:'slash'},furnace_vent:{name:'炉门排汽',damage:36+bonus+b.heat*8,kind:'magic',group:true,style:'mist'},
    furnace_drop:{name:'熔核落锤',damage:94+bonus+b.heat*9,kind:'physical',style:'quake'},furnace_feed:{name:'投料升温',damage:28+bonus,kind:'magic',group:true,style:'rune'},
    orbit_lance:{name:'定轨贯星',damage:80+bonus+b.prediction*14,kind:'magic',style:'shot'},orbit_sweep:{name:'测距扫弧',damage:43+bonus+b.prediction*8,kind:'physical',group:true,style:'slash'},
    orbit_calibrate:{name:'星图校准',damage:27+bonus,kind:'magic',group:true,style:'rune'},orbit_collapse:{name:'轨道坍缩',damage:57+bonus+b.prediction*12,kind:'magic',group:true,style:'burst'},
    edict_mark:{name:'缄令宣告',damage:35+bonus+b.violations*7,kind:'magic',group:true,style:'rune'},edict_sentence:{name:'单席判决',damage:84+bonus+b.violations*16,kind:'physical',style:'slash'},
    edict_audit:{name:'全庭核验',damage:46+bonus+b.violations*10,kind:'magic',group:true,style:'burst'},edict_revoke:{name:'权限收回',damage:33+bonus+b.violations*8,kind:'magic',group:true,style:'rune'}
  };return{key:b.intent,...table[b.intent]};
}
// Each response trades incoming damage against a distinct, deterministic payoff.
function responseProfile(state,id){
  const key=attackSpec(state).key,b=state.boss;
  const p=id==='parry'?{factor:.45,stagger:22,resource:0,damage:0}:id==='evade'?{factor:.15,stagger:0,resource:2,damage:0}:{factor:.85,stagger:10,resource:0,damage:76};
  Object.assign(p,{special:'',mirror:0,spores:0,charge:0,seals:0,cleanse:0,water:0,heat:0,prediction:0,noSeed:false,keepResource:false,healFactor:1});
  if(id==='parry'){
    if(key==='quake'){p.factor=.5;p.stagger=34;}
    if(key==='missiles'||key==='rend'){p.factor=.35;p.stagger=30;}
    if(key==='compression')p.stagger=20;
    if(key==='fog'){p.cleanse=2;p.stagger=18;p.special='驱散 2 层迷雾';}
    if(key==='reclaim'){p.healFactor=0;p.stagger=18;p.special='阻止元素回收治疗';}
    if(key==='mirror'){p.mirror=2;p.stagger=24;p.special='拆除 2 镜片';}
    if(key==='rend'){p.mirror=1;p.special='拆除 1 镜片';}
    if(key==='pierce'){p.factor=.6;p.stagger=32;p.mirror=1;p.special='拆除 1 镜片';}
    if(key==='duel'){p.factor=.35;p.stagger=40;}
    if(key==='sow'){p.spores=1;p.stagger=18;p.special='播种后剥离 1 孢压';}
    if(key==='drain'){p.healFactor=0;p.stagger=24;p.special='阻止司祭吸血';}
    if(key==='bloom'){p.factor=.6;p.stagger=38;}
    if(key==='weave'){p.spores=2;p.stagger=24;p.special='重织后剥离 2 孢压';}
    if(key==='arc'){p.factor=.35;p.stagger=30;p.charge=2;p.special='接地泄能 2 点';}
    if(key==='ground'){p.stagger=34;p.charge=1;p.special='额外泄能 1 点';}
    if(key==='storm'){p.factor=.5;p.stagger=38;p.special='风暴清空蓄电，招架争取破韧';}
    if(key==='charge'){p.charge=3;p.stagger=24;p.special='充能后泄去 3 点蓄电';}
    if(key==='script'){p.seals=1;p.stagger=24;p.special='刻写后拆除 1 封页';}
    if(key==='silence'){p.keepResource=true;p.stagger=30;p.special='保护全队资源，不受封缄抽取';}
    if(key==='rewrite'){p.healFactor=0;p.seals=1;p.special='阻止复写治疗，复写后拆除 1 封页';}
    if(key==='sever'){p.factor=.5;p.stagger=38;p.seals=1;p.special='拆除 1 封页';}
    if(key==='zero_lance'){p.factor=.35;p.stagger=30;p.seals=1;p.special='拆除 1 归零屏障';}
    if(key==='zero_field'){p.seals=1;p.stagger=26;p.special='抵消本次增加的 1 屏障';}
    if(key==='zero_pulse'){p.factor=.5;p.stagger=40;}
    if(key==='zero_reset'){p.healFactor=0;p.seals=1;p.stagger=24;p.special='阻止重置治疗，重置后拆除 1 屏障';}
    if(key==='zero_end'){p.factor=.45;p.stagger=0;p.special='物理与魔法记录齐全时，守住终幕即可获胜';}
    if(key.startsWith('tide_')){p.water=key==='tide_fill'?2:1;p.stagger=key==='tide_breaker'?36:26;p.special=`主招之后排水 ${p.water} 级`;}
    if(key==='furnace_lift'){p.factor=.35;p.stagger=30;}
    if(key==='furnace_vent'){p.heat=2;p.stagger=26;p.special='开炉后额外泄热 2';}
    if(key==='furnace_drop'){p.factor=.4;p.stagger=38;}
    if(key==='furnace_feed'){p.heat=3;p.special='投料后泄热 3，抵消本次升温';}
    if(key==='orbit_calibrate'){p.healFactor=0;p.prediction=2;p.special='阻止校准治疗，校准后锁定 −2';}
    if(key==='orbit_lance'){p.prediction=1;p.stagger=30;p.special='主招后锁定 −1';}
    if(key==='orbit_collapse')p.stagger=38;
    if(key==='edict_sentence'){p.factor=.35;p.stagger=36;}
    if(key==='edict_audit')p.stagger=38;
    if(key==='edict_revoke'){p.keepResource=true;p.special='阻止本次权限抽取资源';}
  }
  if(id==='evade'){
    if(key==='quake'||key==='pierce'){p.factor=.1;p.resource=3;}
    if(key==='bloom'){p.factor=.2;p.resource=3;}
    if(key==='fog'){p.cleanse=3;p.special='驱散 3 层迷雾';}
    if(key==='sow'){p.noSeed=true;p.special='阻止本次播种增加孢压';}
    if(key==='drain'||key==='reclaim')p.special='敌人仍会恢复生命';
    if(key==='weave'){p.resource=3;p.special='司祭仍会重织';}
    if(key==='mirror')p.special='保留镜片，安全撤步';
    if(['storm','sever','zero_pulse'].includes(key)){p.factor=.1;p.resource=3;}
    if(key==='charge'){p.resource=3;p.special='守卫仍会充能，可在下轮用物理泄能';}
    if(key==='silence'){p.keepResource=true;p.resource=1;p.special='保护全队资源，发起者再回复 1 资源';}
    if(key==='rewrite'||key==='zero_reset'){p.resource=3;p.special='敌人仍会恢复生命与防护层';}
    if(key==='zero_end'){p.factor=.1;p.special='物理与魔法记录齐全时，以最低承伤守住终幕';}
    if(['tide_breaker','furnace_drop','orbit_collapse','edict_audit'].includes(key)){p.resource=3;p.factor=.1;}
    if(key==='tide_fill'){p.resource=3;p.special='监守仍会涨水；下轮可用三段命中排水';}
    if(key==='furnace_vent'){p.resource=3;p.special='炉门将在排汽后敞开，可在下轮连击泄热';}
    if(key==='orbit_calibrate'){p.resource=3;p.special='校准治疗与锁定仍会生效';}
    if(key==='edict_revoke'){p.keepResource=true;p.resource=1;p.special='保护自身资源，发起者回复 1';}
  }
  if(id==='counter'){
    if(key==='quake'){p.factor=.8;p.damage=110;p.stagger=18;}
    if(key==='duel'){p.factor=.75;p.damage=112;p.stagger=24;}
    if(key==='pierce'){p.damage=96;p.mirror=1;p.special='拆除 1 镜片';}
    if(key==='mirror'){p.damage=100;p.mirror=1;p.special='拆除 1 镜片，反击不触发折镜反噬';}
    if(key==='fog'){p.damage=70;p.cleanse=1;p.special='驱散 1 层迷雾';}
    if(key==='reclaim'){p.damage=92;p.healFactor=.5;p.special='元素回收治疗减半';}
    if(key==='drain'){p.damage=104;p.special='司祭仍会吸血';}
    if(key==='bloom'){p.damage=65+b.spores*12;p.stagger=18;}
    if(key==='weave'){p.damage=94;p.healFactor=.5;p.special='重织治疗减半';}
    if(key==='arc'){p.damage=88;p.charge=1;p.special='额外泄能 1 点';}
    if(key==='ground'){p.damage=104;p.stagger=24;}
    if(key==='storm'){p.damage=90+b.charge*10;p.stagger=22;}
    if(key==='charge'){p.damage=100;p.charge=1;p.special='充能后泄能 1 点';}
    if(key==='script'){p.damage=90;p.seals=1;p.special='拆除 1 封页';}
    if(key==='silence'){p.damage=104;p.special='仍会受封缄抽取资源，先拆封可阻止';}
    if(key==='rewrite'){p.damage=110;p.healFactor=.5;p.special='复写治疗减半';}
    if(key==='sever'){p.damage=116;p.stagger=24;}
    if(key==='zero_lance'){p.damage=106;p.stagger=20;}
    if(key==='zero_field'){p.damage=96;p.seals=1;p.special='拆除 1 归零屏障';}
    if(key==='zero_pulse'){p.damage=128;p.stagger=24;}
    if(key==='zero_reset'){p.damage=110;p.healFactor=.5;p.special='重置治疗减半';}
    if(key==='zero_end'){p.damage=76;p.special='迎击也计入发起者对应伤害系的终幕记录';}
    if(key.startsWith('tide_')){p.damage=key==='tide_breaker'?110:94;p.water=1;p.special='主招后排水 1；迎击命中也计入三击排水';}
    if(key==='furnace_vent'){p.damage=102;p.heat=1;p.special='开炉后泄热 1，迎击享受敞口易伤并再泄热 1';}
    if(key==='furnace_drop'){p.damage=120;p.stagger=24;}
    if(key==='furnace_feed'){p.damage=98;p.heat=1;p.special='投料后泄热 1';}
    if(key==='orbit_calibrate'){p.damage=100;p.healFactor=.5;p.special='校准治疗减半；反击不增加重复锁定';}
    if(key==='orbit_collapse'){p.damage=118;p.stagger=24;}
    if(key==='edict_sentence'){p.damage=118;p.stagger=24;}
    if(key==='edict_audit'){p.damage=110;p.stagger=24;}
    if(key==='edict_revoke'){p.damage=106;p.special='若仍有至少 2 违令，资源抽取照常生效';}
  }
  // A single team response cannot nearly erase a party-wide attack. Shields,
  // personal guard and dismantling the boss's layers still multiply its value.
  if(attackSpec(state).group){
    if(id==='parry')p.factor=Math.max(.7,p.factor);
    if(id==='evade')p.factor=Math.max(.4,p.factor);
  }
  if(isSolo(state)){
    if(id==='parry')p.factor=Math.max(.55,p.factor);
    if(id==='evade')p.factor=Math.max(attackSpec(state).group?.45:.3,p.factor);
    if(key==='zero_end')p.special=id==='counter'?'迎击也计入独狼任意命中记录':'任意属性累计命中 2 次后，准备应对并存活至主招结束即胜利';
  }
  return p;
}
export function responseOptions(state){
  const h=heroOf(state,state.selected)||state.heroes[0],inactive=state.boss.core||state.boss.broken||state.boss.hardControl;
  return ['parry','evade','counter'].map(id=>{
    const p=responseProfile(state,id),spec=attackSpec(state),names={parry:['招架','shield'],evade:['回避','wind'],counter:['迎击','blades']};
    const damage=Math.round(spec.damage*enemyMultiplier(state)*p.factor)*(spec.hits||1);
    let reward=id==='parry'?`削韧 ${p.stagger}`:id==='evade'&&usesMana(h)?`${h.short}两轮内下次主动攻击增伤 15%（不直接回魔）`:id==='evade'?`${h.short}${h.id==='ric'?'向 0 调和最多 '+p.resource+' 点':h.resourceName+' +'+p.resource}`:`${p.damage} 基础${['ric','haart','patch'].includes(h.id)?'魔法':'物理'}反击伤害，削韧 ${p.stagger}`;
    if(id==='counter'&&h.id==='knibbs'&&h.intuition>=3)reward+='；满直感再强化 40% / 12 削韧';if(p.special)reward+='；'+p.special;
    return{id,name:names[id][0],icon:names[id][1],ap:1,damage,damageFactor:p.factor,baseDamage:scaled(state,spec.damage)*(spec.hits||1),group:!!spec.group,hits:spec.hits||1,description:inactive?`当前无敌方主招；已准备的应对取消，下轮正常恢复 ${state.maxAp} 行动点`:`${spec.group?'群体主招':'单体主招'}减伤 ${Math.round((1-p.factor)*100)}%${spec.damage?`，${spec.group?'每人':'受击者'}预计承伤 ${damage}（护盾 / 防御前）`:'；本次主招无直接伤害'}`,reward};
  });
}
export function prepareResponse(state,id,actorId=state.selected){
  const h=heroOf(state,actorId),error=state.mode!=='playing'?'战斗已结束':!['parry','evade','counter'].includes(id)?'未知的战术应对':!h||h.hp<=0?'请选择存活队员':state.boss.core?'核心阶段无需准备应对':(state.boss.broken||state.boss.hardControl)?'敌人本轮无法行动，无需新增应对':!state.response&&state.ap<1?'行动点不足':'';
  if(error)return{ok:false,error,events:[]};if(!state.response){state.ap--;state.stats.actions++;}
  state.response={id,actor:actorId};state.serial++;
  const name={parry:'招架',evade:'回避',counter:'迎击'}[id];log(state,`${h.short}准备${name}：应对下一次敌方主招，同轮可免费更改。敌招被打断则取消应对，下轮正常恢复 ${state.maxAp} 行动点。`,'good');
  return{ok:true,events:[{type:'shield',actor:actorId,targets:alive(state).map(p=>p.id),style:'guard',amount:0,label:`准备${name}`}]};
}
function hurtParty(state,events,ids,base,kind,label,style='quake',resonance=true,responseFactor=1){
  let total=0;const amounts={},absorbedAmounts={},targets=ids.filter(id=>heroOf(state,id)?.hp>0),reflections=[];
  for(const id of targets){
    const h=heroOf(state,id);let n=Math.round(base*enemyMultiplier(state)*(h.guard?.45:1)*responseFactor*(h.youmuForm==='captain'?.65:1)*(h.exhaustedTurns>0?1.2:1));
    const shield=absorbShield(h,n);n-=shield;const actual=Math.min(h.hp,n);h.hp-=actual;total+=actual;amounts[id]=actual;absorbedAmounts[id]=shield;
    if(h.reflect>0&&h.hp>0&&(h.id!=='qianxing'||kind==='physical')){h.reflect--;reflections.push(h.id);}
    if(resonance&&h.hp>0&&state.boss.id==='golem')h.resonance=Math.min(5,h.resonance+(kind==='physical'?1:0));
    if(h.hp<=0)log(state,`${h.short}倒下了。可选择其头像，使用药剂救起。`,'bad');
  }
  events.push({type:'boss',actor:'boss',targets,bossId:state.boss.id,intentId:state.boss.intent,kind,style,amount:total/Math.max(1,targets.length),amounts,hpLosses:{...amounts},absorbedAmounts,label});
  if(total)log(state,`${label}命中，队伍受到 ${total} 生命伤害。`,'bad');else log(state,`${label}被应对与护盾化解。`,'good');
  if(alive(state).length===0){state.mode='defeat';events.push({type:'defeat',actor:'boss',targets:state.heroes.map(h=>h.id),label:'远征未竟'});}
  for(const id of reflections){
    if(state.mode!=='playing')break;
    const physical=id==='qianxing';
    dealToBoss(state,{id:'retaliation',name:physical?'钉刺反击':id==='patch'?'镜反回击':'防护回击',kind:physical?'physical':'magic',damage:28,hits:1,stagger:0,style:physical?'shot':'rune'},events,id,{response:true});
  }
}
function healBoss(state,events,amount,label){
  const n=Math.min(state.boss.maxHp-state.boss.hp,Math.round(amount*(state.boss.healSuppression?.5:1)));state.boss.hp+=n;
  events.push({type:'heal',actor:'boss',targets:['boss'],amount:n,amounts:{boss:n},label});log(state,`${label}：${bossName(state)}回复 ${n} 生命。`,n?'warning':'good');
}
export function intentInfo(state){
  const b=state.boss;
  if(b.finale)return{name:'停机过载 · 最后放电',desc:`${isSolo(state)?'独狼':'全队'}承受 ${scaled(state,65)} 魔法伤害 · ${isSolo(state)?`任意命中 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1、魔法 ${b.finaleMagic}/1`}、${state.response?'应对已准备':'还需准备任一应对'} · 接入后守住最后放电即可关闭核心 · 剩余 ${b.finaleTurns} 个完整回合，超时恢复 22% 生命`,icon:'crystal',danger:true,responses:responseOptions(state)};
  if(b.core)return{name:'核心重组',desc:`剩余 ${b.coreTurns} 个完整回合 · ${isSolo(state)?`任意属性累计命中 ${b.coreHits}/${SOLO_RULES.coreHits}`:'需要物理与魔法各 3 次'}`,icon:'crystal',danger:true,responses:responseOptions(state)};
  if(b.hardControl&&!b.core&&!b.finale)return{name:'行动封锁',desc:'下一次普通敌方行动被取消；之后一整轮抗控。此状态不附带破韧增伤。',icon:'bind',good:true,responses:responseOptions(state)};
  if(b.broken)return{name:'架势崩溃',desc:'本轮停止行动 · 受到伤害 +50% · 下一轮抗控',icon:'break',good:true,responses:responseOptions(state)};
  const spec=attackSpec(state),target=heroOf(state,enemyTarget(state))?.short||'队员',base=scaled(state,spec.damage),hits=spec.hits||1;
  let desc=spec.damage?`${spec.group?'全队':`目标：${target}`} · ${hits>1?`${hits} × `:''}${base} ${spec.kind==='magic'?'魔法':'物理'}伤害`:'',icon={slam:'hammer',missiles:'scatter',fog:'mist',compression:'rune',reclaim:'heal',quake:'quake',rend:'blades',mirror:'shield',pierce:'blade',duel:'blades',sow:'mist',drain:'rune',bloom:'crystal',weave:'heal',arc:'scatter',ground:'quake',storm:'crystal',charge:'rune',script:'book',silence:'bind',rewrite:'heal',sever:'blade',zero_lance:'twin',zero_field:'shield',zero_pulse:'crystal',zero_reset:'repeat',tide_hook:'blade',tide_fill:'mist',tide_breaker:'quake',tide_release:'scope',furnace_lift:'hammer',furnace_vent:'mist',furnace_drop:'quake',furnace_feed:'rune',orbit_lance:'target',orbit_sweep:'blades',orbit_calibrate:'heal',orbit_collapse:'crystal',edict_mark:'book',edict_sentence:'blade',edict_audit:'rune',edict_revoke:'bind'}[spec.key];
  if(spec.key==='fog')desc+=' · 释放 5 层迷雾 · 每次魔法命中驱散 1 层';
  if(spec.key==='reclaim')desc+=` · 吸收全队共鸣，回复 ${alive(state).reduce((n,h)=>n+h.resonance,0)*8} 生命 · 先用净化技能清除共鸣`;
  if(spec.key==='rend')desc+=' · 招后补充 1 镜片';
  if(spec.key==='mirror')desc+=` · 本轮每次物理技能反噬 ${scaled(state,7+b.mirror*3)}（无镜片则不反噬） · 魔法拆镜`;
  if(spec.key==='drain')desc+=` · 同时回复 ${30+b.spores*12} 生命`;
  if(spec.key==='sow')desc+=` · 孢压 +${b.stage?3:2}`;
  if(spec.key==='bloom')desc+=' · 每层孢压使基础伤害 +10，释放后清空';
  if(spec.key==='weave')desc+=` · 回复 ${60+b.spores*12} 生命，孢压 +2 · 可迎击削减治疗`;
  if(spec.key==='arc')desc+=` · 每点蓄电使每段基础伤害 +3 · 物理命中泄能`;
  if(spec.key==='ground')desc+=` · 每点蓄电使基础伤害 +4 · 释放后蓄电 −2`;
  if(spec.key==='storm')desc+=' · 每点蓄电使基础伤害 +9 · 释放后清空蓄电';
  if(spec.key==='charge')desc+=' · 蓄电 +3（最多 6） · 招架抵消本次充能，或迎击抢伤害';
  if(spec.key==='script')desc+=' · 刻写后封页 +1';
  if(spec.key==='silence')desc+=` · 若还存在封页，全队资源向 0 减少 ${b.stage?2:1} · 拆封 / 招架 / 回避可阻止`;
  if(spec.key==='rewrite')desc+=` · 回复 ${b.stage?100:80} 生命，封页恢复至 3 · 招架阻止治疗 / 迎击治疗减半`;
  if(spec.key==='sever')desc+=' · 每层封页使基础伤害 +8 · 先用异系连击拆封';
  if(spec.key==='zero_lance')desc+=' · 每层屏障使每段基础伤害 +5';
  if(spec.key==='zero_field')desc+=' · 招后归零屏障 +1';
  if(spec.key==='zero_pulse')desc+=' · 每层屏障使基础伤害 +9 · 交替攻击拆屏障';
  if(spec.key==='zero_reset')desc+=` · 回复 ${b.stage?90:65} 生命，屏障恢复至 3、同步归零 · 招架阻止治疗 / 迎击治疗减半`;
  if(b.id==='tide')desc+=` · 水位 ${b.waterLevel}/4 · 任意属性累计 3 次命中排水 1（当前 ${b.valveHits}/3）`;
  if(spec.key==='tide_fill')desc+=' · 攻击后水位 +2，上限 4；招架随后排水 2';
  if(spec.key==='tide_breaker')desc+=' · 每级水位使基础伤害 +12，释放后水位清零';
  if(spec.key==='tide_release')desc+=' · 每级水位使基础伤害 +9，释放后排水 1';
  if(spec.key==='tide_hook')desc+=' · 每级水位使基础伤害 +5';
  if(spec.key==='furnace_vent')desc+=` · 炉热 ${b.heat}/6，每点使基础伤害 +8 · 释放后炉门敞开：受到伤害 +30%，每次命中泄热 1`;
  if(spec.key==='furnace_drop')desc+=` · 炉热 ${b.heat}/6，每点使基础伤害 +9 · 趁敞口连击泄热；落锤后关闭炉门并清空炉热`;
  if(spec.key==='furnace_feed')desc+=' · 释放后炉热 +3（最多 6）、炉门关闭；招架抵消本次升温';
  if(spec.key==='orbit_lance'||spec.key==='orbit_sweep'||spec.key==='orbit_collapse')desc+=` · 锁定 ${b.prediction}/3 · 重复上一项攻击技能 +1，换攻击技能 −1；${spec.key==='orbit_lance'?'每层基础伤害 +14':spec.key==='orbit_sweep'?'每层基础伤害 +8':'每层基础伤害 +12，释放后锁定清零'}`;
  if(spec.key==='orbit_calibrate')desc+=' · 回复 55 生命、锁定 +1（最多 3）；招架阻止治疗并在校准后锁定 −2';
  if(b.id==='arbiter')desc+=` · ${b.decree==='light'?'轻击令：只允许 1 AP 攻击':'重击令：只允许至少 2 AP 攻击'} · 违令 ${b.violations}/3，当前伤害已计入判罚；辅助技能不计，新回合清零换令`;
  if(spec.key==='edict_revoke')desc+=' · 若违令至少 2，资源向 0 减少 2；招架或回避可阻止抽取';
  if(canInterrupt(state))desc+=' · 可用咒弹或破韧打断';if(b.controlImmune)desc+=' · 本轮抗控，无法打断';
  if(b.id==='golem'&&b.stage>=1)desc+=` · 追加 ${scaled(state,12)} 单体飞弹${b.stage>=3?`、${scaled(state,9)} 全队真空波`:''}（应对只覆盖主招）`;
  if(b.phasePending)desc+=' · 下一轮将完整预告地裂';
  if(b.exposed)desc+=' · 破绽：本轮受到伤害 +50%，仍会出招';
  return{name:b.charging?'地裂 · 蓄力中':spec.name,desc,icon,danger:b.charging||['bloom','pierce','storm','sever','zero_pulse','tide_breaker','furnace_drop','orbit_collapse','edict_audit'].includes(spec.key),responses:responseOptions(state)};
}
function applyResponseReward(state,events,response,profile){
  let h=heroOf(state,response.actor);if(!h||h.hp<=0){h=alive(state)[0];if(!h)return;log(state,`应对发起者倒下，${h.short}接续战术。`,'warning');}
  const b=state.boss;b.mirror=Math.max(0,b.mirror-profile.mirror);b.spores=Math.max(0,b.spores-profile.spores);b.charge=Math.max(0,b.charge-profile.charge);b.seals=Math.max(0,b.seals-profile.seals);b.fog=Math.max(0,b.fog-profile.cleanse);
  b.waterLevel=Math.max(0,b.waterLevel-profile.water);b.heat=Math.max(0,b.heat-profile.heat);b.prediction=Math.max(0,b.prediction-profile.prediction);
  if(profile.resource&&usesMana(h)){h.attackBuff=Math.max(h.attackBuff,15);h.attackBuffTurns=3;log(state,`${h.short}回避稳住心神，下次主动攻击增伤 15%，不直接回复魔力。`,'good');}
  else if(profile.resource){const before=h.resource;h.resource=h.id==='ric'?(Math.sign(before)*Math.max(0,Math.abs(before)-profile.resource)||0):Math.min(h.maxResource,h.resource+profile.resource);harmony(state,h,before,events);log(state,`${h.short}回避成功：${h.resourceName} ${before} → ${h.resource}。`,'good');}
  if(profile.damage){
    const s={id:'response_counter',name:'战术迎击',kind:['ric','haart','patch'].includes(h.id)?'magic':'physical',style:'counter',damage:profile.damage,stagger:profile.stagger,hits:1},t=tunedSkill(state,h,s);
    if(t.intuition)h.intuition=0;dealToBoss(state,t.skill,events,h.id,{response:true});if(h.id==='knibbs')h.intuition=Math.min(3,h.intuition+1);
  }else{reduceStagger(state,profile.stagger,events);events.push({type:'response',actor:h.id,targets:alive(state).map(p=>p.id),style:response.id,amount:0,label:response.id==='parry'?`招架 · 削韧 ${profile.stagger}`:'战术回避'});}
  if(profile.special)log(state,profile.special+'。','good');
}
export function endRound(state){
  if(state.mode!=='playing')return{ok:false,error:'战斗已结束',events:[]};
  const b=state.boss,events=[],response=state.response,cancelledResponse=!!response&&(b.core||b.broken||b.hardControl),wasControlled=!!b.hardControl&&!b.core&&!b.finale,wasBroken=b.broken,wasCore=b.core,wasFinale=b.finale;state.stats.turns++;state.serial++;
  if(b.core){
    if(b.coreFresh){b.coreFresh=false;log(state,`核心稳定显形。接下来有 2 个完整回合完成${isSolo(state)?'四次任意命中':'双系净化'}。`,'warning');}
    else{b.coreTurns--;if(b.coreTurns<=0){
      b.core=false;b.coreFresh=false;b.reforms++;b.hp=Math.round(b.maxHp*.28);b.stagger=Math.round(b.maxStagger*.65);b.stage=3;b.broken=false;b.exposed=false;b.charging=false;b.phasePending=false;b.fog=0;b.corePhysical=0;b.coreMagic=0;b.coreHits=0;
      events.push(bossPhaseEvent(state,'phase','元素重组'));log(state,'核心重新凝结出躯壳！巨人恢复 28% 生命，击碎后仍可再次净化。','warning');
    }else log(state,`核心正在重组！还剩 ${b.coreTurns} 个回合。`,'warning');}
  }else if(wasControlled)log(state,`${bossName(state)}的行动被封锁，本轮无法出招。`,'good');
  else if(b.broken)log(state,`${bossName(state)}重新稳住架势，错过本轮行动。`,'good');
  else{
    const spec=attackSpec(state),profile=response?responseProfile(state,response.id):null,ids=alive(state).map(h=>h.id),target=enemyTarget(state),healFactor=profile?.healFactor??1,sporesBefore=b.spores,followupStage=b.stage;
    if(spec.damage)for(let i=0;i<(spec.hits||1)&&state.mode==='playing';i++){
      const currentTarget=heroOf(state,target)?.hp>0?target:alive(state)[0]?.id;
      hurtParty(state,events,spec.group?alive(state).map(h=>h.id):[currentTarget],spec.damage,spec.kind,spec.name,spec.style,true,profile?.factor??1);
    }
    if(state.mode==='playing'){
      if(spec.key==='fog'){b.fog=5;events.push({type:'boss',actor:'boss',targets:ids,style:'mist',kind:'magic',amount:0,label:'迷雾孢子'});log(state,'迷雾孢子扩散：每次魔法命中可清除 1 层。','warning');}
      if(spec.key==='reclaim'){const stacks=alive(state).reduce((n,h)=>n+h.resonance,0);healBoss(state,events,stacks*8*healFactor,'元素回收');alive(state).forEach(h=>h.resonance=0);}
      if(spec.key==='rend')b.mirror=Math.min(3,b.mirror+1);
      if(spec.key==='sow'&&!profile?.noSeed)b.spores=Math.min(5,b.spores+(b.stage?3:2));
      if(spec.key==='drain')healBoss(state,events,(30+sporesBefore*12)*healFactor,'抽髓祷告');
      if(spec.key==='bloom')b.spores=0;
      if(spec.key==='weave'){healBoss(state,events,(60+sporesBefore*12)*healFactor,'菌丝重织');b.spores=Math.min(5,b.spores+2);}
      if(spec.key==='ground')b.charge=Math.max(0,b.charge-2);
      if(spec.key==='storm')b.charge=0;
      if(spec.key==='charge'){b.charge=Math.min(6,b.charge+3);events.push({type:'boss',actor:'boss',targets:['boss'],style:'rune',amount:0,label:'雷针充能'});log(state,`雷针充能：蓄电升至 ${b.charge}/6。`,'warning');}
      if(spec.key==='script')b.seals=Math.min(3,b.seals+1);
      if(spec.key==='silence'&&b.seals>0&&!profile?.keepResource){
        const loss=b.stage?2:1;
        for(const h of alive(state))h.resource=h.id==='ric'?(Math.sign(h.resource)*Math.max(0,Math.abs(h.resource)-loss)||0):Math.max(0,h.resource-loss);
        log(state,`资源封缄：封页未破，全队资源向 0 减少 ${loss}。`,'warning');
      }
      if(spec.key==='rewrite'){healBoss(state,events,(b.stage?100:80)*healFactor,'命运复写');b.seals=3;}
      if(spec.key==='zero_field')b.seals=Math.min(3,b.seals+1);
      if(spec.key==='zero_reset'){healBoss(state,events,(b.stage?90:65)*healFactor,'回响重置');b.seals=3;b.sync=0;b.lastKind=null;}
      if(spec.key==='tide_fill')b.waterLevel=Math.min(4,b.waterLevel+2);
      if(spec.key==='tide_breaker')b.waterLevel=0;
      if(spec.key==='tide_release')b.waterLevel=Math.max(0,b.waterLevel-1);
      if(spec.key==='furnace_vent')b.furnaceOpen=true;
      if(spec.key==='furnace_drop'){b.furnaceOpen=false;b.heat=0;}
      if(spec.key==='furnace_feed'){b.heat=Math.min(6,b.heat+3);b.furnaceOpen=false;}
      if(spec.key==='orbit_calibrate'){healBoss(state,events,55*healFactor,'星图校准');b.prediction=Math.min(3,b.prediction+1);}
      if(spec.key==='orbit_collapse')b.prediction=0;
      if(spec.key==='edict_revoke'&&b.violations>=2&&!profile?.keepResource){
        for(const h of alive(state))h.resource=h.id==='ric'?(Math.sign(h.resource)*Math.max(0,Math.abs(h.resource)-2)||0):Math.max(0,h.resource-2);
        log(state,'权限收回：违令至少 2，全队资源向 0 减少 2。','warning');
      }
      if(b.charging)b.charging=false;if(response)applyResponseReward(state,events,response,profile);
      if(state.mode==='playing'&&spec.key==='zero_end'&&b.finale){
        if(response&&(isSolo(state)?b.finaleHits>=SOLO_RULES.finaleHits:b.finalePhysical&&b.finaleMagic)){
          state.mode='victory';b.finaleFresh=false;state.response=null;
          events.push({type:'victory',actor:'boss',targets:['boss'],label:'核心关闭'});log(state,'接入完成，最后一道电流被挡住。核心终于停止运转，维修组的撤离通道重新打开了。','good');
        }else{
          if(b.finaleFresh)b.finaleFresh=false;else b.finaleTurns--;
          if(b.finaleTurns<=0){
            b.finale=false;b.finaleFresh=false;b.finaleTurns=2;b.finalePhysical=0;b.finaleMagic=0;b.finaleHits=0;b.hp=Math.round(b.maxHp*.22);b.seals=3;b.sync=0;b.lastKind=null;b.stagger=Math.round(b.maxStagger*.65);b.reforms++;
            events.push(bossPhaseEvent(state,'phase','停机失败 · 再启动'));log(state,'未能在期限内完成接入与防护。核心恢复 22% 生命；再次击破后可以重新尝试停机。','warning');
          }else log(state,`终幕尚未结束：${isSolo(state)?`任意命中 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1、魔法 ${b.finaleMagic}/1`}，还需在准备应对后结束回合。`,'warning');
        }
      }
      if(state.mode==='playing'&&b.id==='golem'&&!b.core&&!b.broken){
        if(followupStage>=1)hurtParty(state,events,[alive(state)[state.round%alive(state).length].id],12,'physical','碎岩飞弹','shot');
        if(state.mode==='playing'&&followupStage>=3)hurtParty(state,events,alive(state).map(h=>h.id),9,'magic','真空波','rune');
      }
    }
  }
  // Damage over time settles after the telegraphed action. Crossing a body/core
  // boundary cannot replace that action with an unseen attack from a new phase.
  if(state.mode==='playing')tickWound(state,events);
  state.response=null;if(state.mode!=='playing')return{ok:true,events};
  for(const h of alive(state)){
    if(b.fog>0)h.resonance=Math.min(5,h.resonance+1);
    if(h.resonance>=5){hurtParty(state,events,[h.id],25,'magic','共鸣震荡','rune',false);h.resonance=0;}if(state.mode!=='playing')break;
  }
  if(state.mode!=='playing')return{ok:true,events};
  // Exposure during an enemy-phase counter already leads into a full player turn.
  // It must not receive the partial-turn grace reserved for player-phase exposure.
  if(!wasCore&&b.core)b.coreFresh=false;
  if(!wasFinale&&b.finale)b.finaleFresh=false;
  state.round++;state.maxAp=isSolo(state)?SOLO_RULES.ap:6;state.ap=state.maxAp;
  if(cancelledResponse)log(state,`敌方主招未出手，预备应对已取消；本轮正常恢复 ${state.maxAp} 行动点。`,'good');
  // A response breaks posture after the boss has already acted. Carry only its
  // damage window into the next player turn, not another cancelled enemy turn.
  const responseBreak=b.broken&&!wasBroken&&!wasControlled;
  b.exposed=responseBreak;b.hardControl=0;b.controlImmune=(wasBroken||responseBreak||wasControlled)?1:Math.max(0,b.controlImmune-1);
  b.broken=false;b.stagger=Math.min(b.maxStagger,b.stagger<=0?b.maxStagger:b.stagger+(isSolo(state)?SOLO_RULES.staggerRegen:12));b.marked=false;
  if(responseBreak)log(state,'应对击出破绽：下一玩家回合伤害 +50%，敌人仍会按预告出招；该回合无法再次打断。','good');
  if(b.id==='duelist'&&b.stage)b.mirror=Math.min(3,b.mirror+1);
  if(b.id==='warden'&&b.stage)b.charge=Math.min(6,b.charge+1);
  if(b.id==='weaver'){b.sealedKind=b.sealedKind==='physical'?'magic':'physical';b.seals=Math.min(3,b.seals+1);}
  if(b.id==='arbiter'){b.decree=b.decree==='light'?'heavy':'light';b.violations=0;}
  if(b.finale||b.core){b.broken=false;b.exposed=false;b.controlImmune=0;}
  if(!wasBroken&&!wasCore&&!wasControlled)b.weakened=0;
  b.vulnerable=Math.max(0,b.vulnerable-1);b.healSuppression=Math.max(0,b.healSuppression-1);
  // Age every existing grant before any start-of-turn harmony creates new ones.
  for(const h of state.heroes){const expired=ageShields(h);if(expired)events.push({type:'shield-expire',actor:h.id,targets:[h.id],amount:expired,amounts:{[h.id]:expired},style:'guard',label:'护盾到期'});}
  for(const h of state.heroes){
    if(h.regenTurns>0&&h.hp>0){const amount=healHero(state,h,h.regenAmount);events.push({type:'heal',actor:'youmu',targets:[h.id],amount,amounts:{[h.id]:amount},style:'rune',label:'精密缝合 · 伤口愈合'});}
    h.regenTurns=Math.max(0,h.regenTurns-1);if(!h.regenTurns||h.hp<=0){h.regenTurns=0;h.regenAmount=0;}
    h.tauntTurns=Math.max(0,h.tauntTurns-1);h.attackBuffTurns=Math.max(0,h.attackBuffTurns-1);if(!h.attackBuffTurns)h.attackBuff=0;
    h.guard=false;h.used=[];h.patchObserved=false;h.patchRecorded=false;
    for(const key of Object.keys(h.cooldowns))h.cooldowns[key]=Math.max(0,h.cooldowns[key]-1);
    if(['knibbs','youmu'].includes(h.id)&&h.hp>0)h.resource=Math.min(10,h.resource+2);
    if(h.id==='ric'&&h.hp>0){const before=h.resource;h.resource=Math.abs(before)<=2?0:Math.sign(before)*(Math.abs(before)-2);harmony(state,h,before,events);}
    if(h.youmuForm==='captain'){h.captainTurns--;if(h.captainTurns<=0||h.hp<=0)leaveCaptain(state,h);}
    if(h.exhaustionFresh)h.exhaustionFresh=false;else if(h.exhaustedTurns>0)h.exhaustedTurns--;
  }
  const cycle=BOSS_INTENTS[b.id];b.intent=cycle[(state.round-1)%cycle.length];b.intentTarget=alive(state)[(state.round-1)%alive(state).length].id;
  if(b.phasePending&&!b.core){b.charging=!b.broken;b.phasePending=false;}
  if(heroOf(state,state.selected)?.hp<=0)state.selected=alive(state)[0].id;
  log(state,`第 ${state.round} 回合 · 行动点恢复至 ${state.ap}。`,'system');return{ok:true,events};
}
