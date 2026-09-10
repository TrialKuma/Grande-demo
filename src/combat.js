import {enemyById,livingEnemies,selectEnemyTarget,enemyTargets,withEnemy,ensureEnemySelection,enemyDefaults,stampEnemyEvents,ENEMY_LIMITS} from './multi-enemy.js';
export {enemyById,selectEnemyTarget,enemyTargets};
import {BOSSES,BOSS_INTENTS} from './encounters.js';
import {REWARDS} from './rewards.js';
import {NEW_HEROES,NEW_SKILLS,CAPTAIN_SKILLS,TRANSFERABLE_LAYERS,SPECIMEN_NAMES} from './expedition-heroes.js';
import {MANA_HERO_OVERRIDES,MANA_SKILLS,tuneManaSkill,manaSkillError,manaAfterSkill,applyManaSkill,manaHeroDefaults,manaStatus,manaRefundFor} from './mana-cycles.js';
import {grantShield,absorbShield,ageShields} from './shields.js';
import {ACTION_POINT_RULES,baseActionPoints,refreshActionPoints} from './action-points.js';
import {baseAttributes,effectiveAttributes,attributeEffects,attackAttribute,defenseAttribute,ageAttributeEffects,addAttributeEffect,attemptControl,controlError,ageControl,clearControl,controlResistance} from './attributes.js';
import {comboPlan} from './boss-combos.js';
import {LEARNING_ORDER} from './training.js';
import {knibbsPassiveDefaults,ammoProfile,loadAmmoPlan,shotPassivePlan,counterPassivePlan,reloadAmmoPlan,endKnibbsFollowup} from './knibbs-passive.js';
import {ricBalanceTransition,ricChaosAttackBonus,ricChaosDefenseReduction,consumeRicChaos,expireRicChaos,ricCrossingAllowed} from './ric-passive.js';
export {BOSSES,BOSS_INTENTS};
export {REWARDS};

export const HEROES = [
  {id:'knibbs',name:'尼布斯拉姆',short:'尼布斯',role:'直感枪手',tag:'装弹 · 直感 · 反制',color:'#efbc75',maxHp:170,maxResource:10,resourceName:'气息',passiveName:'装弹 · 直感 · 弱者标记',passiveDesc:'特殊装填每消耗 2 气息获得 1 直感，最多 3。下一次射击消耗所有直感，每层额外造成 8 伤害；也可消费 3 层预备反制。直感伤害或反制命中会施加弱者标记。实际追加行动回复 1 气息，普通射击不回气。',quote:'探险家岂能老死于病榻？',bio:'尼布斯联合工会的创始人。用不同子弹应付危险，在确认命中后衔接追加行动，并把直感留给进攻或反制。'},
  {id:'apeilia',name:'艾佩莉雅',short:'艾佩莉雅',role:'深渊监视器',tag:'双系 · 交替 · 连击',color:'#80d9df',maxHp:145,maxResource:10,resourceName:'连击',passiveName:'交叉火力',passiveDesc:'物理与魔法技能交替时，本次力量或智力 +6、削韧 +6，并额外获得 1 连击。连续使用螳螂刀只获得 1 连击。',quote:'以绝对的火力击垮敌人！',bio:'来自钢核都市的人形构造体。交替使用螳螂刀与双枪，驱动高效的双系武装循环。'},
  {id:'ric',name:'雷克老板',short:'雷克',role:'领域驱魔师',tag:'魔法 · 打断 · 调和',color:'#bf9aef',maxHp:160,maxResource:3,resourceName:'平衡',passiveName:'领域调和',passiveDesc:'平衡由负向过零（含回到 0），全队获得 10 护盾；由正向过零，全队回复 8 生命。初始 0 出发不触发。',quote:'今天的账，记在谁头上？',bio:'酒吧的老板，也是深渊之门的守门人。交替正负领域，把治疗、防护与控制编织成循环。'},
  {id:'haart',name:'哈特蒙斯',short:'哈特',role:'心灵操纵师',tag:'魔力 · 念线 · 干扰',color:'#afa2eb',maxHp:150,maxResource:10,resourceName:'魔力',passiveName:'心智通路',passiveDesc:'魔力转化为二级资源，兑现二级资源后返还魔力。',quote:'行了，别催。我在看。',bio:'博洛伦特纳的院长，嫌麻烦，却总在奇怪的地方出现。用书本建立队友间的心智通路，安排攻击、安抚与保护。'},
  {id:'qianxing',name:'潜行',short:'潜行',role:'升格机械师',tag:'魔力 · 双系 · 战甲',color:'#88d2e6',maxHp:195,maxResource:10,resourceName:'魔力',passiveName:'升格模组',passiveDesc:'魔力转化为二级资源，兑现二级资源后返还魔力。',quote:'先把人带出去，样本可以回来再取。',bio:'接受登天试炼、来到格朗德的探索者。沉着寡言，对未知事物十分执着；以战甲钉刺、银焱光束和修复装置完成任务。'}
];
export const SKILLS = {
  knibbs:[
    {id:'shot',name:'直感发射',sub:'REVOLVER',ap:1,kind:'physical',damage:27,hits:1,stagger:8,gain:1,icon:'crosshair',style:'shot',desc:'27 物理伤害、削韧 8，回复 1 气息，积攒 1 直感。',hint:'稳定输出 · 回复气息 · 积攒直感'},
    {id:'focus',name:'单发确认',sub:'DEAD RECKONING',ap:2,cost:4,kind:'physical',damage:66,hits:1,stagger:30,mark:true,icon:'target',style:'shot',desc:'消耗 4 气息，66 物理伤害、削韧 30；本轮目标敏捷 −8。满直感时强化。',hint:'先手标记 · 团队增伤 · 直感爆发'},
    {id:'scatter',name:'扩散弹',sub:'SCATTERSHOT',ap:2,cost:6,kind:'physical',damage:13,hits:6,stagger:18,icon:'scatter',style:'burst',desc:'消耗 6 气息，6 × 13 物理伤害、削韧 18；每段剥离司祭 1 孢压或计入核心命中。',hint:'六段物理 · 剥离孢冠 · 核心终结'},
    {id:'breathe',name:'整息装填',sub:'SECOND WIND',ap:1,gain:4,heal:16,self:true,once:true,icon:'wind',style:'guard',desc:'回复 4 气息与自身 16 生命，每轮一次。尼布斯每轮开始额外回复 2 气息。',hint:'补充气息 · 自我维持 · 每轮一次'},
    {id:'ricochet',name:'三点校射',sub:'TRIANGULATION',ap:2,cost:3,kind:'physical',damage:25,hits:3,stagger:18,intuitionGain:2,unlockKey:'knibbs_ricochet',icon:'scatter',style:'burst',desc:'消耗 3 气息，3 × 25 物理伤害、削韧 18；积攒 2 直感。',hint:'三段物理 · 快速积攒直感'}
  ],
  apeilia:[
    {id:'blade',name:'「圣餐」螳螂刀',sub:'EUCHARIST',ap:1,kind:'physical',damage:28,hits:1,stagger:10,gain:2,icon:'blade',style:'slash',desc:'28 物理伤害、削韧 10，获得 2 连击；连续物理只获 1 连击。接魔法之后强化并再获 1 连击。',hint:'物理衔接 · 拆孢 · 与魔法交替'},
    {id:'purify',name:'「炼净」双枪',sub:'PURIFICATION',ap:2,kind:'magic',damage:27,hits:2,stagger:12,gain:3,icon:'twin',style:'shot',desc:'2 × 27 魔法伤害、削韧 12，获得 3 连击。每段拆除 1 镜片或迷雾；接物理之后强化。',hint:'魔法衔接 · 双段拆镜 · 与物理交替'},
    {id:'eden',name:'「伊甸之约」',sub:'EDEN PACT',ap:2,cost:6,kind:'physical',damage:25,hits:4,stagger:32,icon:'blades',style:'slash',desc:'消耗 6 连击，4 × 25 物理伤害、削韧 32。接魔法之后本次力量或智力 +6、削韧 +6，并返还 1 连击。',hint:'物理爆发 · 削韧 · 交替返还连击'},
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
Object.assign(HEROES.find(h=>h.id==='ric'),{role:'领域剑客 · 咒弹枪手',tag:'平衡 · 正负领域 · 混沌',maxResource:10,passiveName:'深渊领域法规',passiveDesc:'正领域强化自身，负领域削弱所有敌人。正负翻转获得混沌，用于下一次伤害或抵御攻击；平衡每轮向零恢复。',bio:'酒吧老板、深渊之门的守门人，也喜欢耍一点帅。正域中拔剑迎战，负域中用左轮追击受束的敌人。'});
Object.assign(SKILLS,NEW_SKILLS);
SKILLS.ric=[
 {id:'rune',name:'剑式 · 试锋',sub:'DRAWN BLADE',ap:1,kind:'physical',damage:32,hits:1,stagger:10,shift:2,icon:'blade',style:'slash',desc:'32 物理伤害、削韧 10，平衡 +2。施放前平衡至少 +4 或持有剑势时，直接变为强化剑招。',hint:'正向剑战 · 平衡 +2'},
 {id:'bind',name:'枪式 · 咒弹',sub:'HEX REVOLVER',ap:2,kind:'magic',damage:66,hits:1,stagger:28,shift:-3,interrupt:true,cooldown:2,icon:'crosshair',style:'shot',desc:'66 魔法伤害、削韧 28，平衡 −3，冷却 2 轮；可打断指定蓄力，服从抗控。平衡不高于 −4 或目标被束缚时，变为两段封行咒弹。',hint:'负向枪战 · 可打断 · 平衡 −3'},
 {id:'shelter',name:'正域 · 肉身同调',sub:'EMPOWERED FLESH',ap:2,shield:30,selfShield:true,shift:4,cleanse:1,edge:2,icon:'shield',style:'guard',desc:'自身获得 30 护盾与 2 次剑势，并清除 1 层共鸣。剑势强化之后的剑式；领域属性由平衡所在区域自动生效。',hint:'护盾 · 剑势'},
 {id:'mend',name:'深渊虚影',sub:'ABYSSAL PHANTOM',ap:2,kind:'magic',damage:32,hits:1,stagger:16,shift:-4,cleanse:1,icon:'bind',style:'rune',desc:'以虚影攻击敌人，清除全队 1 层共鸣。行动后向负平衡移动，领域随平衡自动展开。',hint:'虚影攻击 · 负向偏移'},
 {id:'crossing',name:'领域换向',sub:'CROSS THE THRESHOLD',ap:0,crossing:true,kind:'magic',damage:8,hits:1,stagger:12,targeting:'all',once:true,icon:'repeat',style:'rune',desc:'对全体敌人释放领域冲击，随后将平衡反转。只能在非零且绝对值小于 6 时使用，每轮一次；偏移越深，冲击越强。',hint:'全体冲击 · 正负翻转'},
 {...SKILLS.ric.find(s=>s.id==='equilibrium')}
];
SKILLS.knibbs.push({id:'cover',name:'掩护射击',sub:'COVER FIRE',ap:2,cost:3,kind:'physical',damage:43,hits:1,stagger:14,shield:14,protection:30,icon:'crosshair',style:'shot',desc:'消耗 3 气息，造成 43 物理伤害、削韧 14。全队获得两轮的 14 护盾，并使本轮剩余时间受到的伤害降低 30%；多次保护只取最高值。',hint:'边打边护 · 团队缓冲'});
SKILLS.apeilia.push({id:'reboot',name:'战术重整',sub:'TACTICAL RESET',ap:1,gain:2,heal:15,self:true,once:true,protection:55,selfProtection:true,icon:'wind',style:'guard',desc:'回复 2 连击与自身 15 生命，并通过战术位移让自身本轮敏捷 +20、智力 +13、意志 +10。每轮一次，不改变上一击属性。',hint:'主动准备连击 · 每轮一次'});
for(const hero of HEROES)if(MANA_HERO_OVERRIDES[hero.id])Object.assign(hero,MANA_HERO_OVERRIDES[hero.id]);
Object.assign(SKILLS,MANA_SKILLS);
// Functional identity: covering fire, one-hit evasion, self empowerment and surgery.
Object.assign(SKILLS.knibbs.find(s=>s.id==='cover'),{name:'直感反制',ap:1,cost:0,damage:0,hits:0,stagger:0,shield:0,protection:0,coverFire:true,counterDamage:55,counterStagger:30,once:true,intuitionCost:3,desc:'消费 3 层直感，预备在目标出手前反击 55 物理伤害、削韧 30。命中施加弱者标记；若未打断或击杀，目标本次行动力量、智力各 −18。保留当前弹药。',hint:'三层直感 · 出手前反制'});
Object.assign(SKILLS.knibbs.find(s=>s.id==='scatter'),{name:'扩散装填',kind:undefined,damage:0,hits:0,stagger:0,loadAmmo:'scatter',self:true,desc:'填入扩散弹，替换当前特殊子弹。下一次左轮攻击追加五段各 8 基础物理伤害。',hint:'准备扩散弹 · 单体六段'});
Object.assign(SKILLS.knibbs.find(s=>s.id==='shot'),{gain:0,desc:'发射当前子弹，造成基础物理伤害。普通发射不回复气息，也不产生直感。',hint:'发射当前子弹'});
Object.assign(SKILLS.knibbs.find(s=>s.id==='focus'),{cost:2,mark:false,desc:'发射当前子弹。成功命中后开启快速装填、快速发射和重装填的追加窗口，每类各一次。对已被弱者标记的目标额外造成 12 加目标正向力量的伤害。',hint:'确认命中 · 开启追加'});
Object.assign(SKILLS.knibbs.find(s=>s.id==='ricochet'),{intuitionGain:0,desc:'连续发射三次，造成三段基础物理伤害。可以使用当前弹药与直感，不产生新直感。'});
SKILLS.knibbs.push({id:'loadburst',name:'聚爆装填',sub:'BURST ROUND',ap:2,cost:6,loadAmmo:'blast',self:true,icon:'crosshair',style:'guard',desc:'填入聚爆弹，替换当前特殊子弹。下一次左轮攻击追加一段 36 基础物理伤害。',hint:'准备聚爆弹 · 单发爆发'},
 {id:'loadbreach',name:'破虚装填',sub:'BREACH ROUND',ap:2,cost:4,loadAmmo:'breach',self:true,icon:'target',style:'guard',desc:'填入破虚弹，替换当前特殊子弹。下一次射击驱散一层强化；成功驱散时返还 4 气息并施加弱者标记。',hint:'准备破虚弹 · 驱散返气'});
Object.assign(SKILLS.apeilia.find(s=>s.id==='reboot'),{protection:0,evasion:1,desc:'花1行动点，回复2连击与自身15生命，并准备一次战术位移：本轮受到的第一段攻击完全闪开，后续段仍会命中。每轮一次，保留上一击属性。',hint:'一段闪避 · 补充连击 · 每轮一次'});
Object.assign(SKILLS.apeilia.find(s=>s.id==='eden'),{execute:true,desc:'花2行动点与6连击，对选中敌人造成4段各25物理伤害，削韧32。目标生命不高于30%时，处决伤害再提高40%；接在魔法后仍享受交叉火力。',hint:'单体处决 · 高削韧 · 六连击'});
Object.assign(SKILLS.apeilia.find(s=>s.id==='sentinel'),{targeting:'all',damage:62,desc:'花2行动点与6连击，向全部敌人投放穿透炮火，每敌62魔法伤害、削韧22，无视魔抗。每名敌人分别受击，交叉火力与资源仅结算一次。',hint:'全体穿透 · 清理护卫'});
Object.assign(SKILLS.ric.find(s=>s.id==='equilibrium'),{desc:'将平衡调回零，全队回复 16 生命并净化 1 层共鸣。冷却 2 轮；归零收起领域，不触发混沌。',hint:'收起领域 · 全队小恢复'});
export const SKILL_SLOTS=4;
for(const hero of HEROES)hero.attributes=baseAttributes(hero.id);
// Preserve each weapon's identity after adding the attribute contribution per hit.
const ATTRIBUTE_BASE_DAMAGE={knibbs:{shot:22,focus:56,ricochet:19},apeilia:{blade:20,purify:18,eden:17,sentinel:50,overture:14},ric:{rune:28,bind:58},youmu:{scalpel:25},haart:{page:18},qianxing:{spike:18,beam:130,pulse:42},patch:{keyblade:16,chargedslash:40,fragments:32}};
for(const [heroId,skills]of Object.entries(ATTRIBUTE_BASE_DAMAGE))for(const [id,damage]of Object.entries(skills)){const skill=SKILLS[heroId]?.find(s=>s.id===id);if(skill)skill.damage=damage;}
for(const hero of HEROES)if(hero.resourceName==='气息')for(const skill of SKILLS[hero.id])if(skill.damage&&!skill.cost)skill.gain=0;
export const SOLO_RULES=Object.freeze({ap:ACTION_POINT_RULES.solo,bossHp:.64,bossDamage:.9,stagger:120,staggerRegen:10,coreHits:4,finaleHits:2});
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
export function normalizeSkillAccess(skillAccess){
  if(!skillAccess||typeof skillAccess!=='object'||Array.isArray(skillAccess))return null;
  const result={};
  for(const h of HEROES){
    const ids=skillAccess[h.id];
    // Omitted heroes keep their normal challenge access; an explicit empty list
    // remains empty. Campaign code supplies the learned list for every member.
    if(Array.isArray(ids))result[h.id]=[...new Set(ids.filter(id=>skillOf(h.id,id)))];
  }
  return result;
}
export function normalizeLoadouts(upgrades=[],loadouts={},skillAccess=null){
  const result={};
  for(const h of HEROES){
    const ids=loadouts?.[h.id];
    const access=skillAccess?.[h.id],allowed=id=>(!Array.isArray(access)||access.includes(id))&&isSkillUnlocked(upgrades,h.id,id);
    const order=[...(LEARNING_ORDER[h.id]||[]),...SKILLS[h.id].filter(s=>!s.unlockKey).map(s=>s.id)];
    const defaults=[...new Set(order)].filter(allowed).slice(0,SKILL_SLOTS);
    const valid=Array.isArray(ids)&&ids.length<=5&&new Set(ids).size===ids.length&&ids.every(allowed)&&(Array.isArray(access)||[4,5].includes(ids.length));
    result[h.id]=valid?[...ids,...defaults.filter(id=>!ids.includes(id))].slice(0,SKILL_SLOTS):defaults;
  }
  return result;
}
export function activeSkills(state,heroId){
  const loadout=normalizeLoadouts(state.upgrades,state.loadouts,state.skillAccess)[heroId]||[];
  return loadout.map(id=>skillOf(heroId,id));
}
export function createBattle(difficulty='standard',bossId='golem',options={}) {
  if(!Object.hasOwn(DIFFICULTIES,difficulty))difficulty='standard';
  if(!Object.hasOwn(BOSSES,bossId))bossId='golem';
  const upgrades=[...new Set(Array.isArray(options.upgrades)?options.upgrades.filter(id=>typeof id==='string'&&Object.hasOwn(REWARDS,id)):[])];
  const requested=options.partyIds;
  const solo=options.mode==='solo'||options.challengeMode==='solo',partySize=solo?1:Array.isArray(requested)&&[1,2,3].includes(requested.length)?requested.length:3;
  const partyIds=Array.isArray(requested)&&requested.length===partySize&&new Set(requested).size===partySize&&requested.every(id=>HEROES.some(h=>h.id===id))?requested:solo?['knibbs']:['knibbs','apeilia','ric'];
  const skillAccess=normalizeSkillAccess(options.skillAccess),loadouts=normalizeLoadouts(upgrades,options.loadouts,skillAccess);
  const tutorialScale=BOSSES[bossId].isTutorial?({scout:[1,1,1],bulwark:[.4,.85,1],conduit:[.18,.65,1]}[bossId][partyIds.length-1]):1;
  const hp=Math.round((BOSSES[bossId].isTutorial?900:DIFFICULTIES[difficulty].hp)*BOSSES[bossId].hpMultiplier*tutorialScale*(solo?SOLO_RULES.bossHp:1)),maxAp=baseActionPoints({challengeMode:solo?'solo':'party',partySize:partyIds.length}),maxStagger=BOSSES[bossId].isTutorial?{scout:48,bulwark:64,conduit:80}[bossId]:solo?SOLO_RULES.stagger:160;
  const state={version:11,manaRevision:1,knibbsRevision:1,ricRevision:1,rngState:(options.seed||0x9e3779b9)>>>0,selectedEnemyId:'boss',mode:'playing',challengeMode:solo?'solo':'party',difficulty,upgrades,loadouts,skillAccess,round:1,roundCarry:0,ap:maxAp,maxAp,selected:partyIds[0],response:null,
    heroes:partyIds.map(id=>HEROES.find(h=>h.id===id)).map(h=>({...h,...manaHeroDefaults(h.id),hp:h.maxHp,shield:0,shieldLayers:[],attackBuff:0,attackBuffTurns:0,tauntTurns:0,regenTurns:0,regenAmount:0,resource:['knibbs','haart','qianxing','youmu','patch'].includes(h.id)?10:0,resonance:0,cooldowns:{},used:[],guard:false,protection:0,intuition:0,lastKind:null,balanceBursts:0,grace:false,verdict:false,reflect:0,ricEdge:0,youmuForm:'doctor',surgicalReady:false,specimen:null,captainTurns:0,captainUsed:false,exhaustedTurns:0,exhaustionFresh:false,patchForm:'observe',records:0,recordProgress:0,patchRetaliation:false,patchObserved:false,patchRecorded:false,evasion:0,fieldCare:0,executionRefund:false})),
    boss:{...enemyDefaults(bossId,'boss',BOSSES[bossId].modelId?'minion':'boss'),id:bossId,hp,maxHp:hp,stage:0,core:false,corePhysical:0,coreMagic:0,coreHits:0,coreTurns:2,coreFresh:false,reforms:0,stagger:maxStagger,maxStagger,broken:false,exposed:false,marked:false,weakened:0,vulnerable:0,hardControl:0,healSuppression:0,dot:null,fog:0,charging:false,phasePending:false,mirror:bossId==='duelist'?2:0,spores:bossId==='cantor'?1:0,controlImmune:0,charge:bossId==='warden'?2:0,seals:bossId==='weaver'?2:bossId==='final'?3:0,sealedKind:'physical',lastKind:null,sync:0,finale:false,finaleProtected:false,finalePhysical:0,finaleMagic:0,finaleHits:0,finaleTurns:2,finaleFresh:false,waterLevel:bossId==='tide'?2:0,valveHits:0,heat:bossId==='furnace'?2:0,furnaceOpen:false,prediction:0,forecastSkill:null,decree:'light',violations:0,intent:BOSS_INTENTS[bossId][0],intentTarget:partyIds[0]},
    potions:3,log:[{text:`你们踏入${BOSSES[bossId].region}。${BOSSES[bossId].name}已现身。`,tone:'system'}],stats:{damage:0,healed:0,breaks:0,interrupts:0,actions:0,turns:0},serial:0};
  state.enemies=[state.boss];
  for(const hero of state.heroes){hero.attributes=baseAttributes(hero.id);hero.attributeBuffs=[];hero.control=null;hero.controlGuard=0;hero.ricChaos=0;if(hero.id==='knibbs')Object.assign(hero,knibbsPassiveDefaults());}
  if(!options.singleEnemy)seedEncounter(state);
  return state;
}

function ensureEnemyState(state){if(!state.enemies)state.enemies=[state.boss];else if((state.boss.unitId||'boss')==='boss')state.enemies[0]=state.boss;}
function selectedEnemy(state,targetId){return enemyById(state,targetId===undefined?(state.selectedEnemyId||state.boss.unitId||'boss'):targetId);}
export function canUse(state,id,skillId,targetId){const e=selectedEnemy(state,targetId);return e?canUseCurrent({...state,boss:e},id,skillId):'未知敌方目标';}
export function resolvedSkill(state,id,skillId,targetId){const e=selectedEnemy(state,targetId);return e?resolvedSkillCurrent({...state,boss:e},id,skillId):skillOf(id,skillId);}
export function skillPreview(state,id,skillId,targetId){
 const e=selectedEnemy(state,targetId);if(!e)return {damage:0,hits:0,stagger:0,notes:['未知敌方目标']};
 const preview=skillPreviewCurrent({...state,boss:e},id,skillId);
 const projected=structuredClone(state);projected.boss=projected.enemies?.[0]||projected.boss;projected.ap=Math.max(projected.ap,preview.ap||0);
 if(!canUse(projected,id,skillId,e.unitId)){
   const result=useSkill(projected,id,skillId,e.unitId),damages={};
   for(const event of result.events.filter(event=>event.type==='attack'))for(const target of event.targets||[])if(enemyById(projected,target))damages[target]=(damages[target]||0)+(event.hpLosses?.[target]??event.amounts?.[target]??0);
   preview.damage=damages[e.unitId]||0;preview.targetDamages=damages;preview.totalDamage=Object.values(damages).reduce((a,b)=>a+b,0);
   preview.stagger=Math.max(0,e.stagger-enemyById(projected,e.unitId).stagger);
   preview.resourceAfter=heroOf(projected,id).resource;
 }
 if(livingEnemies(state).some(other=>other.guardianFor===e.unitId&&!other.broken&&!other.hardControl)&&preview.targeting!=='all')preview.notes.push('护卫分担此目标50%的单体伤害；先击破护卫或使用群体攻击可绕过分担。');
 return preview;
}
export function useSkill(state,id,skillId,targetId){
 const e=selectedEnemy(state,targetId);if(!e)return {ok:false,error:'未知敌方目标',events:[]};
 const result=withEnemy(state,e,()=>useSkillCurrent(state,id,skillId));
 ensureEnemySelection(state);stampEnemyEvents(state,result.events);return result;
}
export function enemyThreats(state){
 return livingEnemies(state).map((e,i)=>{
  const view={...state,boss:e},spec=attackSpec(view);
  return {id:e.unitId,name:BOSSES[e.id].name,intent:intentInfo(view),order:i+1,targets:spec.group?alive(view).map(h=>h.id):[enemyTarget(view)],damage:spec.damage?Math.max(1,scaled(view,spec.damage+attackAttribute(e,spec.kind,view))):0,hits:spec.hits||1,kind:spec.kind,interruptible:canInterrupt(view)};
 }).sort((a,b)=>(!!enemyById(state,a.id).recordedIntent)-(!!enemyById(state,b.id).recordedIntent)).map((x,i)=>({...x,order:i+1}));
}
function spawnEnemy(state,id,{role='minion',guardianFor=null}={},events=[]){
 if(livingEnemies(state).length>=ENEMY_LIMITS.alive||state.enemies.length>=ENEMY_LIMITS.history)return null;
 const base=createBattle(state.difficulty,id,{mode:state.challengeMode,partyIds:state.heroes.map(h=>h.id),singleEnemy:true}).boss;
 const unitId='enemy-'+state.enemies.length;Object.assign(base,enemyDefaults(id,unitId,role),{guardianFor,intentTarget:alive(state)[state.enemies.length%alive(state).length].id});
 state.enemies.push(base);events.push({type:'spawn',actor:state.boss.unitId,targets:[unitId],label:BOSSES[id].name+'加入战斗'});return base;
}
function seedEncounter(state){
 if(['patrol','weaver'].includes(state.boss.id))spawnEnemy(state,'escort',{guardianFor:'boss'});
 if(state.boss.id==='warden')spawnEnemy(state,'relay',{role:'device'});
 if(state.boss.id==='relay_guard'){state.boss.role='device';spawnEnemy(state,'escort');spawnEnemy(state,'drone');}
}
function defeatEnemy(state,events,label){
 const e=state.boss;if(e.defeated)return;e.defeated=true;e.hp=0;e.charging=false;e.broken=false;e.exposed=false;e.cover=null;e.confusion=null;e.recordedIntent=null;e.dot=null;e.core=false;e.coreFresh=false;e.corePhysical=0;e.coreMagic=0;e.coreHits=0;e.finale=false;e.finaleFresh=false;e.finaleProtected=false;e.finalePhysical=0;e.finaleMagic=0;e.finaleHits=0;
 events.push({type:'enemy-defeat',actor:e.unitId,targets:[e.unitId],label});
 if(e.role==='device')for(const other of livingEnemies(state)){other.charge=0;other.supportCharge=0;if(!other.core&&!other.finale){other.broken=true;other.stagger=0;other.hardControl=0;other.controlImmune=0;}events.push({type:'break',actor:other.unitId,targets:[other.unitId],label:'供能中断 · 停机'});}
 ensureEnemySelection(state);
 if(!livingEnemies(state).length){state.mode='victory';events.push({type:'victory',actor:e.unitId,targets:[e.unitId],label});log(state,'敌方全部失去行动能力。战斗结束。','good');}
}

export function heroOf(state,id){return state.heroes.find(h=>h.id===id);}
export function skillOf(id,skill){return Object.hasOwn(SKILLS,id)?SKILLS[id].find(s=>s.id===skill):undefined;}
export const isDefensiveSkill=skill=>!!(skill&&(skill.protection||skill.personalProtection||skill.shield||skill.allShield||skill.weaken||skill.selfGuard||skill.transform||skill.coverFire||skill.evasion||skill.fieldCare||skill.confuse||skill.recordIntent));
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
  return {type,actor:state.boss.unitId||'boss',targets:[state.boss.unitId||'boss'],bossId:b.id,label,hpAfter:b.hp,phaseAfter:{stage:b.stage,core:b.core,finale:b.finale}};
}
const usesMana=h=>h.resourceName==='魔力';
const manaRefund=(h,s)=>usesMana(h)?manaRefundFor(h,s.secondaryCost||0):0;
const allyActed=(state,h,skillId)=>isSolo(state)||state.heroes.length===1?h.used.some(id=>id!==skillId):state.heroes.some(other=>other.id!==h.id&&other.used.length>0);
function resourceAfterSkill(h,s,alternating=false){
  if(usesMana(h))return manaAfterSkill(h,s).resource;
  return clamp(h.resource-(s.cost||0)+(s.gain||0)+(s.shift||0)+(alternating?1:0),h.id==='ric'?-10:0,h.maxResource);
}
function canUseCurrent(state,id,skillId){
  const h=heroOf(state,id),source=skillOf(id,skillId);
  if(state.mode!=='playing')return '战斗已结束';
  if(!h||!source)return '未知技能';
  if(Array.isArray(state.skillAccess?.[id])&&!state.skillAccess[id].includes(skillId))return '此技能尚未学会，推进旅程后解锁';
  if(!isSkillUnlocked(state.upgrades,id,skillId))return '此技能尚未在战间奖励中解锁';
  if(!activeSkills(state,id).some(s=>s.id===skillId))return '此技能尚未装配，请在战间营地调整';
  const {skill:s}=tunedSkill(state,h,source);
  if(h.hp<=0)return '角色已倒下';
  const blockedControl=controlError(h,s);if(blockedControl)return blockedControl;
  if(state.boss.defeated)return '目标已倒下';
  if(s.coverFire&&state.boss.cover)return '该目标本轮已有掩护射击';
  if(s.intuitionCost&&h.intuition<s.intuitionCost)return `直感不足（需要 ${s.intuitionCost} 层）`;
  if(s.knibbsError)return s.knibbsError;
  if(s.confuse&&state.boss.confusion)return '该目标已有杀意改写';
  if(s.recordIntent&&state.boss.recordedIntent)return '当前预告已被记录';
  if(state.ap<s.ap)return '行动点不足';
  if(s.cost&&h.resource<s.cost)return `${h.resourceName}不足（需要 ${s.cost}）`;
  if(usesMana(h)){const error=manaSkillError(state,h,s);if(error)return error;}
  if(s.shift&&Math.abs(h.resource+s.shift)>10)return `平衡超出范围，请先换向或使用${s.shift>0?'负向':'正向'}技能`;
  if(s.crossing&&!ricCrossingAllowed(h.resource))return '平衡须非零且处于 −5 至 +5';
  if(s.surgery&&!h.specimen&&!h.surgicalReady)return '先用手术刀建立手术准备';
  if(s.transform&&h.captainUsed)return '本场已经请船长接管过';
  if(h.cooldowns[s.id]>0)return `还需 ${h.cooldowns[s.id]} 轮冷却`;
  if(s.once&&h.used.includes(s.id))return '本轮已使用';
  return '';
}
function canInterrupt(state){
  const b=state.boss;
  return !b.core&&!b.finale&&!b.broken&&!b.controlImmune&&(b.charging||['relay_blast','relay_feed','drone_charge','escort_stamp','scout_ram','bulwark_stamp','conduit_discharge','tide_breaker','furnace_drop','orbit_collapse','edict_audit'].includes(b.intent)||(b.id==='duelist'&&['pierce','duel'].includes(b.intent))||(b.id==='cantor'&&['drain','bloom'].includes(b.intent))||(b.id==='warden'&&b.intent==='storm')||(b.id==='weaver'&&['silence','rewrite'].includes(b.intent))||(b.id==='final'&&b.intent==='zero_pulse'));
}
function breakBoss(state,events,label='架势击破'){
  const b=state.boss;if(b.core||b.finale||b.broken)return;
  if(b.controlImmune){b.stagger=Math.max(1,b.stagger);return;}
  const interrupted=canInterrupt(state);
  b.stagger=0;b.broken=true;b.hardControl=0;state.stats.breaks++;if(interrupted)state.stats.interrupts++;b.charging=false;
  events.push({type:'break',actor:state.boss.unitId||'boss',targets:[state.boss.unitId||'boss'],label});
  log(state,`${label}！${bossName(state)}韧性归零，受到伤害 +50%；恢复架势后有一整轮抗控。`,'good');
}
function reduceStagger(state,n,events){
  const b=state.boss;if(b.core||b.finale||b.broken)return;
  b.stagger=Math.max(b.controlImmune?1:0,b.stagger-n);if(b.stagger<=0)breakBoss(state,events);
}
function coreCheck(state,events){
  const b=state.boss;
  if(b.core&&(isSolo(state)?b.coreHits>=SOLO_RULES.coreHits:b.corePhysical>=3&&b.coreMagic>=3)){defeatEnemy(state,events,'核心净化');log(state,isSolo(state)?'连续命中切断了核心供能。博洛伦的雾，散了。':'物理与魔法同时击穿核心。博洛伦的雾，散了。','good');}
}
function tunedSkill(state,h,s){
  const t=usesMana(h)?tuneManaSkill(state,h,s):{...s},notes=[],empowerNotes=t.empowerReason?[t.empowerReason]:[],owned=id=>(state.upgrades||[]).includes(id);
  if(h.id==='ric'){
    if(s.id==='rune'&&(h.resource>=4||h.ricEdge>0)){Object.assign(t,{name:'正域剑式 · 斩影',damage:24,hits:2,stagger:18,consumeEdge:h.ricEdge>0,variant:'ric_sword',desc:'1 AP，2 × 24 物理伤害、削韧 18，平衡 +2；持有剑势时消费 1 次。'});empowerNotes.push('正域 / 剑势：剑式变为 2 × 24 物理伤害、削韧 18');}
    if(s.id==='bind'&&(h.resource<=-4||state.boss.weakened)){Object.assign(t,{name:'负域枪式 · 封行咒弹',damage:43,hits:2,stagger:36,variant:'ric_gun',desc:'2 AP，2 × 43 魔法伤害、削韧 36，平衡 −3，冷却 2 轮；可打断指定蓄力，服从抗控。'});empowerNotes.push('负域 / 束缚：枪式变为 2 × 43 魔法伤害、削韧 36');}
    if(s.crossing){t.shift=-2*h.resource;t.damage=8+8*Math.abs(h.resource);}
  }
  if(h.id==='youmu'){
    if(h.youmuForm==='captain'){Object.assign(t,CAPTAIN_SKILLS[s.id]||{}, {variant:'captain'});empowerNotes.push(`游墓接管：${t.name}`);}
    else if(s.id==='surgery'){
      if(h.specimen){Object.assign(t,{name:'移植手术',damage:0,kind:undefined,stagger:0,dotDamage:0,cost:2,heal:30,allHeal:10,shield:18,selfShield:false,surgery:false,transplant:true,icon:'heal',style:'rune',variant:'transplant',desc:`将${SPECIMEN_NAMES[h.specimen]}标本转化为全队 18 护盾，主目标回复 30、其他人 10；标本随后消耗。`});empowerNotes.push(`${SPECIMEN_NAMES[h.specimen]}标本已就绪：切除变为移植`);}
      else if(h.surgicalReady){const key=TRANSFERABLE_LAYERS[state.boss.id];t.captureLayer=!state.boss.core&&!state.boss.finale&&state.boss[key]>0?key:null;if(!t.captureLayer){t.damage=58;t.stagger=30;t.name='切除手术 · 清创';}empowerNotes.push(t.captureLayer?`手术准备：切除最多 2 层${SPECIMEN_NAMES[t.captureLayer]}`:'无可转移护层：清创伤害 58、削韧 30');}
    }
    if(h.exhaustedTurns>0&&t.damage)notes.push('虚脱：力量、智力与敏捷 −4');
    if(owned('youmu_transplant')&&t.transplant){t.shield=26;t.heal=40;t.desc=`将${SPECIMEN_NAMES[h.specimen]}标本转化为全队 26 护盾，主目标回复 40、其他人 10；支付 2 气息 / 2 AP，标本随后消耗。`;empowerNotes.push('无菌移植：全队护盾 26、主目标治疗 40');}
    if(owned('youmu_resolve')&&s.id==='bloodoath'&&t.transform){t.shield=36;t.desc='花 1 AP / 2 气息，主动献血至 40% 生命（已低于则不扣），游墓接管并嘲讽两轮，获得 36 护盾；船长架势力量 +5、智力 −5、敏捷 +9、意志 +2，退出后虚脱两轮，每场一次。';}
  }
  if(h.id==='knibbs'&&s.coverFire&&h.intuition>=3)empowerNotes.push('直感反制已就绪：消费三层，保留弹药');
  const intuition=h.id==='knibbs'&&h.intuition>0&&!!t.damage;
  const alternating=h.id==='apeilia'&&s.kind&&h.lastKind&&h.lastKind!==s.kind&&s.id!=='response_counter';
  let consumeGrace=false,consumeVerdict=false;
  if(owned('knibbs_deadeye')&&s.id==='focus'&&h.intuition>=3){t.damage=45;t.hits=2;empowerNotes.push('双重确认：满直感改为 2 × 45 基础物理伤害');}
  if(owned('knibbs_expose')&&s.id==='shot'&&state.boss.marked){t.damage+=8;t.stagger=14;empowerNotes.push('弹道记忆：已标记目标，基础伤害 +8、削韧 14');}
  if(owned('apeilia_cascade')&&s.id==='eden'&&alternating&&h.resource>=6){t.hits=6;t.stagger=44;empowerNotes.push('六翼展开：6 连击与魔法衔接，伊甸 6 段 / 基础削韧 44');}
  if(owned('apeilia_zero')&&s.id==='sentinel'&&alternating&&h.resource>=6){t.ap=1;empowerNotes.push('零时点火：6 连击与物理衔接，哨兵仅耗 1 行动点');}
  if(owned('ric_grace')&&s.id==='shelter'&&h.grace){t.ap=1;t.shield=38;t.desc='消耗余响，自身获得 38 护盾和 2 次剑势。';consumeGrace=true;empowerNotes.push('余响同调：消耗余响，1 行动点施放 38 自身护盾与剑势');}
  if(owned('ric_verdict')&&s.id==='rune'&&h.verdict){t.name='剑式 · 清账三连';t.damage=24;t.hits=3;t.stagger=20;t.desc='1 AP，3 × 24 物理伤害、削韧 20，平衡 +2；消费清账，若持有剑势也会消费 1 次。';consumeVerdict=true;empowerNotes.push('清账三连：消耗清账，3 × 24 物理伤害 / 削韧 20');}
  if(s.execute&&state.boss.hp>0&&state.boss.hp/state.boss.maxHp<=.30){t.damage*=1.4;empowerNotes.push('处决窗口：目标生命不高于30%，伤害增加40%');}
  if(s.resetBalance)t.shift=-h.resource;
  if(h.id==='knibbs'){
    if(s.loadAmmo){
      const reloading=!!h.specialSpent,quick=!reloading&&h.followupReady&&!h.followupUsed?.includes('load');
      const plan=reloading?reloadAmmoPlan(h):loadAmmoPlan(h,s.loadAmmo,{quick});
      Object.assign(t,{ap:reloading?1:quick?0:2,cost:reloading?0:ammoProfile(s.loadAmmo).cost,gain:reloading||quick?1:0,knibbsPlan:plan,knibbsError:plan.ok?'':plan.error,
        name:reloading?'重装填':quick?ammoProfile(s.loadAmmo).name.replace('弹','快速装填'):s.name,variant:reloading?'knibbs_reload':quick?'knibbs_quickload':null,
        desc:reloading?'发射特殊子弹后的追加行动：重新填入普通弹。':s.desc});
      if(reloading||quick)empowerNotes.push(reloading?'特殊子弹已发射：重装填就绪':'确认命中：快速装填就绪');
    }else if(t.damage){
      const quick=s.id==='shot'&&h.followupReady&&!h.followupUsed?.includes('shot');
      const plan=shotPassivePlan({...h,resource:Math.max(0,h.resource-(t.cost||0))},{quick,confirm:s.id==='focus'}),ammo=ammoProfile(h.ammo);
      const hitDamages=Array(t.hits||1).fill(t.damage);
      if(ammo.extraHits)hitDamages.push(...Array(ammo.extraHits).fill(ammo.extraDamage));
      Object.assign(t,{gain:quick?1:0,knibbsPlan:plan,hitDamages,hits:hitDamages.length,intuitionSpent:h.intuition||0,intuitionDamage:(h.intuition||0)*8,
        markBonus:s.id==='focus'&&state.boss.marked?12+Math.max(0,effectiveAttributes(state.boss,state).strength):0,mark:(h.intuition||0)>0,
        breachRound:ammo.id==='breach'});
      t.flatDamage=t.intuitionDamage+t.markBonus;
      if(quick){t.name='快速发射';t.desc='确认命中后的追加射击，发射当前子弹。';t.variant='knibbs_quickshot';empowerNotes.push('确认命中：快速发射，实际追加回复 1 气息');}
      if(ammo.id!=='normal')empowerNotes.push(`已装${ammo.name}：${ammo.id==='blast'?'追加一段 36 物理伤害':ammo.id==='scatter'?'追加五段各 8 物理伤害':'命中驱散一层，成功返还 4 气息'}`);
      if(t.intuitionSpent)empowerNotes.push(`兑现 ${t.intuitionSpent} 层直感：额外 ${t.intuitionDamage} 伤害，命中施加弱者标记`);
      if(t.markBonus)empowerNotes.push(`弱者标记：单发确认额外 ${t.markBonus} 伤害`);
    }
  }
  if(h.resourceName==='气息'&&s.id==='scalpel')t.gain=0;
  if(alternating){t.castAttributeBonus=(t.castAttributeBonus||0)+6;t.stagger=(t.stagger||0)+6;empowerNotes.push('交叉火力：本次攻击属性 +6、削韧 +6、连击 +1');}
  if(h.id==='apeilia'&&s.id==='blade'&&h.lastKind==='physical'){t.gain=1;notes.push('连续物理：螳螂刀仅获得 1 连击');}
  if(owned('knibbs_steadyhands')&&s.id==='breathe'&&h.intuition>=2){t.selfAttackBuff=30;empowerNotes.push('稳手装填：至少 2 直感时，下一次主动攻击力量、智力各 +10，两轮内有效');}
  if(owned('knibbs_crossfire')&&s.id==='cover'&&state.boss.marked){t.stripBuffs=1;empowerNotes.push('交叉封锁：掩护射击命中前额外清除 1 层敌方增益');}
  if(owned('apeilia_brace')&&s.id==='reboot'&&h.lastKind==='magic'){t.heal=30;empowerNotes.push('折返防线：魔法攻击后重整，维修恢复提高到30生命');}
  if(owned('apeilia_puncture')&&s.id==='sentinel'&&(state.boss.broken||state.boss.exposed)){t.gain=2;empowerNotes.push('弱点回收：打入破绽额外回收 2 连击');}
  if(owned('ric_erosion')&&h.id==='ric'&&t.shift<0)empowerNotes.push('负域侵蚀：负平衡时，敌方四属性各降低 4');
  if(owned('ric_discipline')&&s.id==='bind'&&(h.resource<=-4||state.boss.weakened)){t.stripBuffs=2;empowerNotes.push('封行剥夺：强化咒弹命中前清除 2 层敌方增益');}
  if(owned('youmu_pathology')&&s.id==='surgery'&&t.surgery){t.dotDamage=12;t.healSuppression=2;empowerNotes.push('病理标记：创口每轮 12 伤害，两轮内敌方意志 −5');}
  if(owned('youmu_aftercare')&&s.id==='firstaid'&&h.youmuForm!=='captain'){t.aftercare=true;empowerNotes.push('术后观察：为急救目标清除全部共鸣，并给予两轮内下一次主动攻击力量、智力各 +9');}
  if(h.attackBuff>0&&t.damage&&!['retaliation','response_counter','wound_dot'].includes(t.id)){t.consumeAttackBuff=true;notes.push('战术增幅：本次力量与智力 +'+Math.ceil(h.attackBuff/3)+'，施放后消耗');}
  if(t.damage)t.attributeBonus=attackAttribute(h,t.kind,state)+(t.castAttributeBonus||0)+(state.boss.id==='final'&&state.boss.sync>=3?6:0);
  if(t.damage&&ricChaosAttackBonus(h)){t.chaosDamage=ricChaosAttackBonus(h);t.flatDamage=(t.flatDamage||0)+t.chaosDamage;empowerNotes.push('混沌：本次伤害额外追加 12，仅一次');}
  if(t.shield)t.desc+=' 每次获得的护盾分别持续两次敌方回合，新护盾不会延长旧护盾。';
  notes.push(...empowerNotes);
  return {skill:t,intuition,alternating,consumeGrace,consumeVerdict,notes,empowered:empowerNotes.length>0&&(!usesMana(h)||!manaSkillError(state,h,t)),empowerReason:empowerNotes.join('；')};
}
function resolvedSkillCurrent(state,heroId,skillId){const h=heroOf(state,heroId),s=skillOf(heroId,skillId);return h&&s?tunedSkill(state,h,s).skill:s;}
function damageFactor(b,s){
  return b.broken||b.exposed?1.5:1;
}
function incomingSkillDamage(target,skill,index=0,state){const defense=skill.pierce&&skill.kind==='magic'?0:defenseAttribute(target,skill.kind,state),base=skill.hitDamages?.[index]??skill.damage??0,factor=damageFactor(target,skill);return Math.max(1,Math.round((base+(skill.attributeBonus||0)-defense)*factor))+(index===0?Math.round((skill.flatDamage||0)*factor):0);}
function shiftBossLayers(b,s,soloCast){
  if(s.noLayers)return;
  if(s.kind==='magic'){b.fog=Math.max(0,b.fog-1);if(b.id==='duelist')b.mirror=Math.max(0,b.mirror-1);}
  if(s.kind==='physical'&&b.id==='cantor')b.spores=Math.max(0,b.spores-1);
  if(s.kind==='physical'&&b.id==='warden')b.charge=Math.max(0,b.charge-1);
  if(b.id==='weaver'&&s.kind&&s.kind!==b.sealedKind)b.seals=Math.max(0,b.seals-1);
  if(b.id==='final'&&s.kind){
    if(soloCast===undefined?(b.lastKind&&b.lastKind!==s.kind):soloCast){b.sync=Math.min(3,b.sync+1);b.seals=Math.max(0,b.seals-1);}
    b.lastKind=s.kind;
  }
  if(b.id==='tide'&&s.kind){b.valveHits++;if(b.valveHits>=3){b.valveHits=0;b.waterLevel=Math.max(0,b.waterLevel-1);}}
  if(b.id==='furnace'&&b.furnaceOpen&&s.kind)b.heat=Math.max(0,b.heat-1);
}
function trackBossSkill(b,s,actor,{response=false}={}){
  if(!s.damage||response||b.core||b.finale)return;
  if(b.id==='orrery'){
    const key=`${actor}/${s.id}`;
    b.prediction=clamp(b.prediction+(b.forecastSkill===key?1:-1),0,3);b.forecastSkill=key;
  }
  if(b.id==='arbiter'&&((b.decree==='light'&&s.ap>=2)||(b.decree==='heavy'&&s.ap===1)))b.violations=Math.min(3,b.violations+1);
}
function skillPreviewCurrent(state,heroId,skillId){
  const h=heroOf(state,heroId),s=skillOf(heroId,skillId);
  if(!h||!s)return {damage:0,hits:0,stagger:0,resourceBefore:0,resourceAfter:0,notes:['未知技能']};
  const {skill:t,alternating,notes,empowered,empowerReason}=tunedSkill(state,h,s),b={...state.boss};let damage=0;
  if(t.captureLayer)b[t.captureLayer]=Math.max(0,b[t.captureLayer]-2);
  if(t.stripBuffs)stripBossBuffs(b,t.stripBuffs);
  const breachRefund=t.breachRound&&stripBossBuffs(b,1)>0?4:0;
  if(t.vulnerable)b.vulnerable=2;
  for(let i=0;i<(t.damage?(t.hits||1):0);i++){
    if(!b.core&&!b.finale){const n=Math.min(b.hp,incomingSkillDamage(b,t,i,state));damage+=n;b.hp-=n;}
    shiftBossLayers(b,t,isSolo(state)?i===0:undefined);
  }
  trackBossSkill(b,t,h.id);
  let resourceAfter=Math.min(h.maxResource,resourceAfterSkill(h,t,alternating)+breachRefund);
  if(usesMana(h))notes.push(t.secondaryCost?`消耗 ${t.secondaryCost} ${h.secondaryName}，自动触发「${h.passiveName}」，每次行动只结算一次回魔`:t.secondaryGain?`${t.manaEmergency?'应急提炼':`支付 ${t.cost||0} 魔力`}，获得 ${t.secondaryGain} ${h.secondaryName}`:'本次不改变魔力循环');
  if(state.boss.core&&t.damage)notes.push(isSolo(state)?`独狼核心：任意属性命中 +${Math.min(SOLO_RULES.coreHits-b.coreHits,t.hits||1)}`:`核心：${t.kind==='physical'?'物理':'魔法'}命中 +${Math.min(3-(t.kind==='physical'?b.corePhysical:b.coreMagic),t.hits||1)}`);
  if(state.boss.id==='duelist'&&t.kind==='physical'&&state.boss.mirror&&!t.captureLayer)notes.push(`${state.boss.mirror} 镜片：敏捷 +${state.boss.mirror*3}`);
  if(state.boss.id==='duelist'&&state.boss.intent==='mirror'&&!state.boss.broken&&t.kind==='physical'&&state.boss.mirror){
    // Backlash may consume a retaliation or trigger another boss phase.
    // Resolve this conditional chain on a copy instead of duplicating its rules.
    if(!canUseCurrent(state,heroId,skillId)){
      const projected=structuredClone(state),result=useSkill(projected,heroId,skillId,state.boss.unitId);
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
  if(state.boss.id==='cantor'&&t.kind==='magic'&&state.boss.spores===0)notes.push('裸冠：敌人智力 −4');
  if(state.boss.id==='cantor'&&t.kind==='magic'&&state.boss.spores>=3&&!s.pierce)notes.push('厚孢冠：敌人智力 +6');
  if(state.boss.id==='warden'&&t.kind==='physical')notes.push(`泄能 ${Math.min(state.boss.charge,t.hits||1)} 点蓄电`);
  if(state.boss.id==='weaver'&&t.kind){
    notes.push(t.kind===state.boss.sealedKind?(state.boss.seals>0&&!s.pierce?'命中封存系：每页使对应防御属性 +4':'封页已破或攻击穿透抗性'):`拆除 ${Math.min(state.boss.seals,t.hits||1)} 封页`);
  }
  if(state.boss.id==='final'&&t.kind){
    if(state.boss.finale)notes.push(isSolo(state)?`独狼终幕：任意属性命中 +${Math.min(SOLO_RULES.finaleHits-b.finaleHits,t.hits||1)}；仍需角色防护与存活`:`终幕登记：${t.kind==='physical'?'物理':'魔法'}命中完成；还需另一系与角色防护`);
    else if(state.boss.lastKind&&state.boss.lastKind!==t.kind)notes.push('双系同步 +1，归零屏障 −1');
  }
  if(state.boss.id==='tide'&&t.damage)notes.push(`三击排水：水位 ${state.boss.waterLevel} → ${b.waterLevel}，阀击进度 ${b.valveHits}/3`);
  if(state.boss.id==='furnace'&&t.damage)notes.push(state.boss.furnaceOpen?`炉门敞口：敌人敏捷、智力各 −8，炉热 ${state.boss.heat} → ${b.heat}`:'炉门关闭：本次命中不会泄热；排汽之后再利用敞口');
  if(state.boss.id==='orrery'&&t.damage)notes.push(`测绘锁定 ${state.boss.prediction} → ${b.prediction}/3：${state.boss.forecastSkill===`${h.id}/${t.id}`?'重复上一项攻击':'改用另一项攻击可打乱预测'}`);
  if(state.boss.id==='arbiter'&&t.damage)notes.push(`${state.boss.decree==='light'?'轻击令：允许 1 AP 攻击':'重击令：允许至少 2 AP 攻击'}；违令 ${state.boss.violations} → ${b.violations}/3（按实际 AP 计算，辅助技能不受限）`);
  if(t.shift&&h.resource*resourceAfter<0)notes.push('正负翻转：本次行动结束后获得混沌');
  if(t.interrupt&&canInterrupt(state))notes.push('直接打断当前预告');
  if(state.boss.controlImmune&&t.damage)notes.push('本轮抗控：无法打断，韧性最低保留 1');
  if(state.boss.exposed&&t.damage)notes.push('反击破韧留下破绽：伤害 +50%，敌人本轮仍会出招');
  if(t.targeting==='all')notes.push('攻击当前全部存活敌人；每名敌人分别结算伤害，行动点、资源与回转被动仅支付或触发一次。');
  if(t.coverFire)notes.push('消费三层直感，目标出手前反击55物理/削韧30。击杀或破韧取消出手，否则本次行动力量、智力各 −18；命中施加弱者标记，保留弹药。');
  if(t.evasion)notes.push('本轮闪开受到的第一段攻击；多段攻击的后续段仍会命中。');
  if(t.fieldCare)notes.push('准备切除并抑制敌人治疗；本轮首次受伤后若仍存活，立即自行包扎恢复'+t.fieldCare+'生命。');
  if(t.confuse)notes.push('改写下次杀意：单体攻击转向另一名敌人；群体攻击或敌方只剩一人时，改为本次行动力量、智力各 −16。不影响终幕规则。');
  if(t.deviceInterrupt)notes.push('选中装置时可直接打断供能或放电；其他角色仍可通过削韧或击毁装置阻止供能。');
  if(t.recordIntent)notes.push('记录当前预告：该招本轮最后出手，力量、智力各 −8，取消治疗、召唤、补充护层与抽取资源的附加效果；核心与终幕附加规则不受影响。');
  if(t.shield)notes.push(`${t.selfShield?'自身':'全队'}护盾 +${t.shield}`);
  if(t.protection)notes.push(`${t.selfProtection?'自身':'全队'}本轮敏捷 +${Math.round(t.protection*.36)}、智力 +${Math.round(t.protection*.24)}、意志 +${Math.round(t.protection*.18)}；同类姿态只取最高值`);
  if(t.personalProtection)notes.push(`施法者自身本轮敏捷 +${Math.round(t.personalProtection*.36)}、智力 +${Math.round(t.personalProtection*.24)}、意志 +${Math.round(t.personalProtection*.18)}；同类姿态不叠加`);
  if(state.boss.finale&&isDefensiveSkill(t))notes.push('这次角色防护会建立本轮的终幕防护；完成命中登记后，存活度过最后放电即可停机');
  if(t.allShield)notes.push(`额外全队护盾 +${t.allShield}`);
  if(t.reflect)notes.push(`钉刺反击 +${t.reflect} 次：受到物理攻击后回击 28 物理伤害`);
  if(t.heal)notes.push(t.self?`自身回复 ${t.heal}`:`最低生命比例回复 ${t.heal}，其他人 +${t.allHeal||0}`);
  if(t.weaken)notes.push('思维 / 领域干扰：敌人下一次行动力量、智力各 −8、意志 −4，不叠加');
  if(t.vulnerable)notes.push('破绽暴露：两轮内敌人敏捷、智力各 −8，不叠加');
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
  return {chaosDamage:t.chaosDamage||0,intuitionDamage:t.intuitionDamage||0,intuitionSpent:t.intuitionCost||t.intuitionSpent||0,intuitionGain:t.knibbsPlan?.intuitionGain||0,markBonus:t.markBonus||0,hitDamages:t.hitDamages||Array(t.damage?t.hits||1:0).fill(t.damage||0),ammo:h.ammo||'normal',ammoAfter:t.knibbsPlan?.changes?.ammo||h.ammo||'normal',targeting:t.targeting||(t.damage||t.coverFire||t.confuse||t.recordIntent||t.weaken||t.hardControl||t.vulnerable?'single':t.self||t.selfShield?'self':'allies'),coverFire:!!t.coverFire,counterDamage:t.counterDamage||0,counterStagger:t.counterStagger||0,evasion:t.evasion||0,fieldCare:t.fieldCare||0,confuse:!!t.confuse,recordIntent:!!t.recordIntent,protection:t.protection||0,personalProtection:t.personalProtection||0,selfProtection:!!t.selfProtection,defensive:isDefensiveSkill(t),baseDamage:t.damage||0,attributeBonus:t.attributeBonus||0,damage,hits:t.damage?t.hits||1:0,stagger,resourceBefore:h.resource,resourceAfter,resourceSpend:h.id==='ric'?0:t.cost||0,resourceGain:h.id==='ric'?0:usesMana(h)?manaRefund(h,t):(t.gain||0)+(alternating?1:0)+breachRefund,resourceShift:h.id==='ric'?resourceAfter-h.resource:0,notes,empowered,empowerReason,ap:t.ap,cost:t.cost||0,refund:manaRefund(h,t),heal:t.heal||0,allHeal:t.allHeal||0,shield:t.shield||0,allShield:t.allShield||0,cleanse:t.cleanse||0,allCleanse:t.allCleanse||0,weaken:!!t.weaken,vulnerable:!!t.vulnerable,hardControl:!!t.hardControl,stripBuffs:t.stripBuffs||0,self:!!t.self,selfShield:!!t.selfShield,reflect:t.reflect||0,regenTurns:t.regenTurns||0,regenAmount:t.regenAmount||0,revive:t.revive||0,attackBuff:t.attackBuff||t.selfAttackBuff||0,mark:!!t.mark,insight:!!t.insight,name:t.name,description:t.desc,desc:t.desc,icon:t.icon,style:t.style,kind:t.kind,variant:t.variant||null,variantReason:empowerReason,secondaryBefore:h.secondary||0,secondaryAfter:usesMana(h)?manaAfterSkill(h,t).secondary:0,secondarySpend:t.secondaryCost||0,secondaryCost:t.secondaryCost||0,secondaryGain:t.secondaryGain||0,recordsBefore:h.secondary||0,recordsAfter:usesMana(h)?manaAfterSkill(h,t).secondary:0};
}
export function heroStatus(state,heroId){
  const h=heroOf(state,heroId);if(!h)return '';
  if(h.id==='knibbs')return `${ammoProfile(h.ammo).name} · 直感 ${h.intuition}/3${h.intuition>=3?' · 可预备反制':''}${h.followupReady?' · 追加窗口':''}`;
  if(h.id==='apeilia')return !h.lastKind?'交叉火力 · 物理 / 魔法交替强化':`上一击${h.lastKind==='physical'?'物理':'魔法'} · 下一${h.lastKind==='physical'?'魔法':'物理'}技攻击属性 +6 / 削韧 +6 / 连击 +1`;
  if(h.id==='haart')return manaStatus(h);
  if(h.id==='qianxing')return manaStatus(h);
  if(h.id==='youmu')return h.youmuForm==='captain'?`游墓接管 · 剩余 ${h.captainTurns} 轮 · 炮击可提前收尾`:h.exhaustedTurns?`虚脱 ${h.exhaustedTurns} 轮 · 力量、智力、敏捷各 −4`:h.specimen?`${SPECIMEN_NAMES[h.specimen]}标本 · 移植手术就绪`:h.surgicalReady?'手术准备 · 切除就绪':'外科医生 · 手术刀开启切除';
  if(h.id==='patch')return manaStatus(h);
  if(h.grace||h.verdict)return `调和余响 · ${h.grace?'同调 1 AP / 自身 38 护盾 / 剑势 2 次 ':''}${h.verdict?'剑式三段物理强化':''}`;
  return `${h.resource>0?'正域剑战':h.resource<0?'负域枪战':'领域平衡'} ${h.resource}/±10 · ${h.ricEdge?`剑势 ${h.ricEdge} 次 · `:''}每轮向 0 回 2`;
}
export function bossSummary(state){
  const b=state.boss,result=[];
  if(isSolo(state))result.push({label:'独狼',value:`${SOLO_RULES.ap} AP · 敌方生命×${SOLO_RULES.bossHp} / 伤害×${SOLO_RULES.bossDamage} · 韧性${SOLO_RULES.stagger}`,tone:'normal'});
  if(b.exposed)result.push({label:'应对破绽',value:'受到伤害 +50% · 本轮仍会出招',tone:'good'});
  if(b.weakened)result.push({label:'进攻受扰',value:'下一次行动力量、智力各 −8、意志 −4',tone:'good'});
  if(b.vulnerable)result.push({label:'易伤',value:`敏捷、智力各 −8 · 剩余 ${b.vulnerable} 轮`,tone:'good'});
  if(b.hardControl)result.push({label:'行动封锁',value:'取消下次普通行动 · 恢复后一轮抗控',tone:'good'});
  if(b.healSuppression)result.push({label:'意志裂隙',value:`意志 −5 · 剩余 ${b.healSuppression} 轮`,tone:'good'});
  if(b.dot)result.push({label:'手术创口',value:`每次行动后 ${b.dot.damage} 物理伤害 · 剩余 ${b.dot.turns} 次 · 不计核心命中`,tone:'good'});
  const taunter=alive(state).find(h=>h.tauntTurns>0);if(taunter)result.push({label:'嘲讽',value:`单体主招优先攻击${taunter.short} · 剩余 ${taunter.tauntTurns} 轮`,tone:'warning'});
  if(b.id==='golem'){
    result.push({label:'解体',value:`${b.stage} / 4`,tone:'normal'});
    if(b.fog)result.push({label:'迷雾',value:`${b.fog} 层 · 魔法命中驱散`,tone:'warning'});
    if(b.phasePending)result.push({label:'地裂预警',value:'下一轮蓄力 · 先获得完整行动点',tone:'warning'});
  }
  if(b.id==='duelist'){
    result.push({label:'镜片',value:`${b.mirror} / 3 · 敏捷 +${b.mirror*3}`,tone:b.mirror?'warning':'good'},{label:'拆镜',value:'魔法每次命中 −1 镜片',tone:'normal'});
    if(b.intent==='mirror'&&!b.broken&&b.mirror)result.push({label:'折镜架势',value:'物理技能使攻击者承受反噬',tone:'warning'});
  }
  if(b.id==='cantor')result.push({label:'孢压',value:`${b.spores} / 5 · 物理每次命中 −1`,tone:b.spores>=3?'warning':'normal'},{label:'菌冠',value:b.spores===0?'裸冠 · 智力 −4':b.spores>=3?'厚孢冠 · 智力 +6':'薄孢冠 · 智力不变',tone:b.spores===0?'good':'normal'});
  if(b.id==='warden')result.push({label:'蓄电',value:`${b.charge} / 6 · 物理每次命中泄能 1`,tone:b.charge>=4?'warning':'normal'},{label:'风暴',value:'蓄电提高主招伤害 · 角色防护与护盾均能缓解',tone:'normal'});
  if(b.id==='weaver')result.push({label:'封页',value:`${b.seals} / 3 · 封存${b.sealedKind==='physical'?'物理':'魔法'}`,tone:b.seals?'warning':'good'},{label:'拆封',value:`${b.sealedKind==='physical'?'魔法':'物理'}每次命中 −1 封页 · 每轮換系并补 1 页`,tone:'normal'});
  if(b.id==='tide')result.push({label:'水位',value:`${b.waterLevel}/4 · 满潮破堤每层基础伤害 +${BOSS_PRESSURE.tide_breaker.perLayer}`,tone:b.waterLevel>=3?'warning':'normal'},{label:'阀击',value:`${b.valveHits}/3 · 任意属性累计三次命中排水 1，进度保留`,tone:'normal'});
  if(b.id==='furnace')result.push({label:'炉热',value:`${b.heat}/6 · 排汽与落锤随炉热增强`,tone:b.heat>=4?'warning':'normal'},{label:'炉门',value:b.furnaceOpen?'敞口 · 敏捷、智力各 −8，每次命中泄热 1':'关闭 · 排汽后敞口，落锤后关闭',tone:b.furnaceOpen?'good':'normal'});
  if(b.id==='orrery')result.push({label:'测绘锁定',value:`${b.prediction}/3 · 重复上一项攻击 +1，换招 −1`,tone:b.prediction>=2?'warning':'normal'},{label:'已记录',value:b.forecastSkill?skillOf(...b.forecastSkill.split('/'))?.name||'上一项攻击':'尚未记录；反击与辅助技能不纳入预测',tone:'normal'});
  if(b.id==='arbiter')result.push({label:'现行法令',value:b.decree==='light'?'轻击令 · 允许 1 AP 攻击':'重击令 · 允许至少 2 AP 攻击',tone:'warning'},{label:'违令',value:`${b.violations}/3 · 增强本轮判罚；辅助技能不计，新回合清零换令`,tone:b.violations?'warning':'normal'});
  if(b.id==='final'){
    if(b.finale)result.push({label:'终幕',value:`${isSolo(state)?`任意属性 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1 · 魔法 ${b.finaleMagic}/1`} · ${b.finaleProtected?'角色防护已建立':'还需使用角色防护技能'}`,tone:'warning'},{label:'剩余',value:`${b.finaleTurns} 个完整回合 · 命中与角色防护齐备后存活结束回合`,tone:'warning'});
    else result.push({label:'归零屏障',value:`${b.seals} / 3 · 敏捷、智力各 +${b.seals*3}`,tone:b.seals?'warning':'good'},{label:isSolo(state)?'独狼同步':'双系同步',value:`${b.sync} / 3 · ${isSolo(state)?'每次主动攻击拆 1 屏障；多段只计一次':b.lastKind?`上次${b.lastKind==='physical'?'物理':'魔法'}，换系拆 1 屏障`:'先攻击，再用另一系衔接'}${b.sync>=3?' · 攻击属性 +6':''}`,tone:b.sync>=3?'good':'normal'});
  }
  if(b.id!=='golem')result.push({label:'阶段',value:b.finale?'第三阶段 · 停机过载':b.stage?'第二阶段':'第一阶段',tone:b.stage?'warning':'normal'});
  if(b.controlImmune)result.push({label:'抗控',value:'本轮无法打断 · 韧性最低 1',tone:'warning'});
  if(b.marked)result.push({label:'弱者标记',value:'单发确认可获得额外伤害',tone:'good'});
  return result;
}
function dealToBoss(state,skill,events,actor,{response=false}={}){
  const b=state.boss;if(b.defeated)return;
  if(skill.attributeBonus===undefined&&!skill.noAttribute){
    const source=heroOf(state,actor)||enemyById(state,actor);
    // A one-use active-attack charge never buffs retaliation or wound ticks.
    if(source)skill={...skill,attributeBonus:attackAttribute(response?{...source,attackBuff:0}:source,skill.kind,state)+(skill.castAttributeBonus||0)};
  }
  const guardian=skill.targeting!=='all'&&!skill.bypassGuard&&!b.core&&!b.finale?livingEnemies(state).find(e=>e.guardianFor===b.unitId&&!e.broken&&!e.hardControl):null;
  if(guardian){const divided={damage:skill.damage*.5,hitDamages:skill.hitDamages?.map(n=>n*.5),flatDamage:(skill.flatDamage||0)*.5,attributeBonus:(skill.attributeBonus||0)*.5};const split={...skill,...divided,bypassGuard:true,stagger:0,interrupt:false,mark:false};withEnemy(state,guardian,()=>dealToBoss(state,split,events,actor,{response:true}));skill={...skill,...divided};}
  const wasCore=b.core,wasFinale=b.finale,h=heroOf(state,actor),reflect=b.id==='duelist'&&b.intent==='mirror'&&!b.broken&&b.mirror&&skill.kind==='physical'&&!response,reflection=7+b.mirror*3;
  let total=0;const hitAmounts=[];
  for(let i=0;i<(skill.hits||1);i++){
    if(wasCore){if(skill.kind==='physical')b.corePhysical=Math.min(3,b.corePhysical+1);if(skill.kind==='magic')b.coreMagic=Math.min(3,b.coreMagic+1);b.coreHits=Math.min(SOLO_RULES.coreHits,b.coreHits+1);}
    else if(wasFinale){if(skill.kind==='physical')b.finalePhysical=1;if(skill.kind==='magic')b.finaleMagic=1;b.finaleHits=Math.min(SOLO_RULES.finaleHits,b.finaleHits+1);}
    else{const n=incomingSkillDamage(b,skill,i,state),taken=Math.min(b.hp,n);b.hp-=taken;total+=taken;hitAmounts.push(taken);}
    if(wasCore||wasFinale)hitAmounts.push(0);
    shiftBossLayers(b,skill,isSolo(state)?!response&&i===0:undefined);
  }
  trackBossSkill(b,skill,actor,{response});
  state.stats.damage+=total;
  if(total>0&&skill.chaosDamage&&consumeRicChaos(h))events.push({type:'buff',actor:h.id,targets:[h.id],style:'rune',label:'混沌 · 追加伤害'});
  events.push({type:'attack',actor,targets:[state.boss.unitId||'boss'],bossId:b.id,skillId:skill.id,variant:skill.variant||null,kind:skill.kind,style:skill.style,hits:skill.hits||1,amount:total,amounts:{[b.unitId||'boss']:total},hpLosses:{[b.unitId||'boss']:total},hitAmounts:{[b.unitId||'boss']:hitAmounts},absorbedAmounts:{[b.unitId||'boss']:0},label:skill.name});
  if(wasCore){log(state,`${h?.short||BOSSES[enemyById(state,actor)?.id]?.name||'反制'} · ${skill.name}：核心 ${isSolo(state)?`任意命中 ${b.coreHits}/${SOLO_RULES.coreHits}`:`物理 ${b.corePhysical}/3，魔法 ${b.coreMagic}/3`}。`,'good');coreCheck(state,events);return;}
  if(wasFinale){log(state,`${h?.short||BOSSES[enemyById(state,actor)?.id]?.name||'反制'} · ${skill.name}：接入 ${isSolo(state)?`任意命中 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1，魔法 ${b.finaleMagic}/1`}；使用角色防护技能，守住最后放电后关闭核心。`,'good');return;}
  log(state,`${h?.short||BOSSES[enemyById(state,actor)?.id]?.name||'反制'} · ${skill.name}，造成 ${total} ${skill.kind==='magic'?'魔法':'物理'}伤害。`);
  if(b.hp<=0){
    if(b.id==='final'){
      b.hardControl=0;b.dot=null;b.finale=true;b.finaleProtected=false;b.finaleFresh=true;b.finaleTurns=2;b.finalePhysical=0;b.finaleMagic=0;b.finaleHits=0;b.broken=false;b.exposed=false;b.charging=false;b.controlImmune=0;b.seals=0;
      events.push(bossPhaseEvent(state,'phase','停机过载'));
      log(state,`核心进入停机过载！接下来 2 个完整回合内，${isSolo(state)?'以任意属性累计命中 2 次':'以物理与魔法各命中一次完成双系接入'}，再使用角色防护技能。守住最后放电即可停机；超时则核心恢复 22% 生命。`,'warning');return;
    }
    if(b.id!=='golem'){
      defeatEnemy(state,events,'敌人倒下');return;
    }
    b.hardControl=0;b.dot=null;b.core=true;b.coreFresh=true;b.corePhysical=0;b.coreMagic=0;b.coreHits=0;b.coreTurns=2;b.broken=false;b.exposed=false;b.charging=false;b.phasePending=false;b.fog=5;
    events.push(bossPhaseEvent(state,'core','核心暴露'));log(state,`躯壳崩解！在接下来的 2 个完整回合内，${isSolo(state)?'对核心累计造成 4 次任意属性命中':'对核心造成 3 次物理与 3 次魔法命中'}。`,'warning');return;
  }
  const stage=BOSSES[b.id].isTutorial||BOSSES[b.id].isSkirmish||BOSSES[b.id].isMinion?0:b.id==='golem'?Math.min(4,Math.floor((1-b.hp/b.maxHp)*5)):(b.hp<=b.maxHp*.5?1:0);
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
  // Haart exposes a physical opening after the hit; Knibbs alone owns weak marks.
  if(skill.insight&&total>0&&!response){
    addAttributeEffect(b,{id:'haart_insight',label:'破绽提醒',stats:{agility:-8},turns:1});
    events.push({type:'buff',actor,targets:[b.unitId||'boss'],style:'rune',label:'破绽提醒 · 敏捷 −8'});
  }
  if(reflect&&state.mode==='playing')hurtParty(state,events,[actor],reflection,'physical','折镜反噬','slash',false);
}
function healHero(state,h,n){const real=Math.min(n,h.maxHp-h.hp);h.hp+=real;state.stats.healed+=real;return real;}
function harmony(state,h,before,events){
  if(!ricBalanceTransition(h,before,h.resource))return;
  if((state.upgrades||[]).includes('ric_grace'))h.grace=true;
  if((state.upgrades||[]).includes('ric_verdict'))h.verdict=true;
  h.balanceBursts++;
  events.push({type:'buff',actor:h.id,targets:[h.id],style:'rune',label:'混沌 · 领域翻转'});
  log(state,'正负领域翻转：雷克获得混沌，下一次伤害追加 12，或抵御一次承伤 12。','good');
}
function useSkillCurrent(state,id,skillId){
  const error=canUseCurrent(state,id,skillId);if(error)return{ok:false,error,events:[]};
  const h=heroOf(state,id),source=skillOf(id,skillId),{skill:s,intuition,alternating,consumeGrace,consumeVerdict,empowerReason}=tunedSkill(state,h,source),events=[],before=h.resource;
  state.ap-=s.ap;state.selected=id;state.stats.actions++;state.serial++;h.used.push(s.id);
  const mana=usesMana(h)?manaAfterSkill(h,s):null;
  const nextResource=mana?mana.resource:resourceAfterSkill(h,s,alternating);
  // Ric's old field stays active throughout this action, including every AOE target.
  if(h.id!=='ric')h.resource=nextResource;
  if(mana){h.secondary=mana.secondary;h.records=h.id==='patch'?h.secondary:0;applyManaSkill(state,h,s,events);}
  if(s.consumeAttackBuff){h.attackBuff=0;h.attackBuffTurns=0;}
  if(s.consumeEdge)h.ricEdge=Math.max(0,h.ricEdge-1);
  if(s.edge)h.ricEdge=Math.min(2,s.edge);
  if(s.coverFire){state.boss.cover={actor:id,damage:s.counterDamage||55,stagger:s.counterStagger||30,stripBuffs:s.stripBuffs||0,intuition:false};Object.assign(h,counterPassivePlan(h).changes);events.push({type:'buff',actor:id,targets:[state.boss.unitId],style:'shot',label:'直感反制 · 监视出手'});}
  if(s.loadAmmo){Object.assign(h,s.knibbsPlan.changes);events.push({type:'buff',actor:id,targets:[id],style:'guard',label:s.name});}
  if(s.evasion)h.evasion=1;
  if(s.fieldCare){h.fieldCare=s.fieldCare;h.surgicalReady=true;state.boss.healSuppression=2;}
  if(s.confuse){state.boss.confusion={actor:id};state.boss.weakened=0;}
  if(s.recordIntent)state.boss.recordedIntent={actor:id,intent:state.boss.finale?'zero_end':state.boss.charging?'quake':state.boss.intent};
  if(s.weaken)state.boss.weakened=1;
  if(s.vulnerable)state.boss.vulnerable=2;
  if(s.healSuppression)state.boss.healSuppression=2;
  if(s.stripBuffs&&!s.coverFire)stripBossBuffs(state.boss,s.stripBuffs);
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
  if(mana)log(state,`${h.short}：${s.secondaryCost?'被动「'+h.passiveName+'」触发，':''}魔力 ${before} → ${h.resource}，${h.secondaryName}现有 ${h.secondary}/${h.maxSecondary}。`);
  if(s.cooldown)h.cooldowns[s.id]=s.cooldown+1;
  if(consumeGrace)h.grace=false;if(consumeVerdict)h.verdict=false;
  if(empowerReason)log(state,empowerReason+'。','good');
  if(s.damage){
    if(intuition)log(state,`直感兑现：${s.intuitionSpent} 层额外造成 ${s.intuitionDamage} 伤害。`,'good');
    if(alternating)log(state,'交叉火力：交替强化伤害、削韧，回收 1 连击。','good');
    if(s.breachRound&&stripBossBuffs(state.boss,1)>0){h.resource=Math.min(h.maxResource,h.resource+4);s.mark=true;log(state,'破虚弹驱散成功：回复 4 气息，并施加弱者标记。','good');}
    const targets=s.targeting==='all'?[...livingEnemies(state)]:[state.boss];
    let packetUsed=false,hitEnemy=false;
    for(const target of targets){
      if(target.defeated||state.mode!=='playing')continue;
      const start=events.length;
      withEnemy(state,target,()=>dealToBoss(state,packetUsed?{...s,flatDamage:0,chaosDamage:0}:s,events,id));
      const damaged=events.slice(start).some(e=>e.type==='attack'&&e.actor===id&&Object.values(e.hpLosses||{}).some(n=>n>0));
      packetUsed||=damaged;hitEnemy||=damaged;
    }
    if(h.id==='knibbs'&&s.knibbsPlan?.ok){
      const {resource,...changes}=s.knibbsPlan.changes;
      if(!hitEnemy){delete changes.intuition;if(s.id==='focus'){delete changes.followupReady;delete changes.followupUsed;}}
      Object.assign(h,changes);
    }
    if(h.id==='apeilia')h.lastKind=s.kind;
  }
  if(s.protection){
    const targets=s.selfProtection?[h]:alive(state);
    for(const target of targets)target.protection=Math.max(target.protection||0,s.protection);
    if(s.personalProtection)h.protection=Math.max(h.protection,s.personalProtection);
    events.push({type:'buff',actor:id,targets:targets.map(target=>target.id),style:'guard',label:`${s.name} · 防护姿态`});
    log(state,`${h.short}建立防护，${s.selfProtection?'自身':'全队'}本轮敏捷 +${Math.round(s.protection*.36)}、智力 +${Math.round(s.protection*.24)}、意志 +${Math.round(s.protection*.18)}；同类姿态只取最高值。`,'good');
  }
  if(isDefensiveSkill(s))for(const enemy of livingEnemies(state))if(enemy.finale)enemy.finaleProtected=true;
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
    if(s.targetCleanse||s.aftercare)cleanseAttributes(target);
    if(s.allHeal)alive(state).filter(p=>p!==target).forEach(p=>{amounts[p.id]=healHero(state,p,s.allHeal);});
    if(s.cleanse)alive(state).forEach(p=>p.resonance=Math.max(0,p.resonance-s.cleanse));
    events.push({type:'heal',actor:id,targets:s.allHeal?alive(state).map(p=>p.id):[target.id],amount,amounts,style:s.style,label:s.name});log(state,`${s.name}：${target.short}回复 ${amount} 生命${s.allHeal?`，其余队员回复 ${s.allHeal}`:''}${s.cleanse?`，净化 ${s.cleanse} 层共鸣`:''}。`,'good');
  }
  if(s.regenTurns){const target=[...alive(state)].sort((a,b)=>a.hp/a.maxHp-b.hp/b.maxHp)[0];target.regenTurns=s.regenTurns;target.regenAmount=s.regenAmount;events.push({type:'buff',actor:id,targets:[target.id],style:'rune',label:'精密缝合 · 持续恢复'});}
  if(s.attackBuff||s.selfAttackBuff){const targets=s.selfAttackBuff?[h]:alive(state);for(const target of targets){target.attackBuff=Math.max(target.attackBuff,s.selfAttackBuff||s.attackBuff);target.attackBuffTurns=2;}events.push({type:'buff',actor:id,targets:targets.map(x=>x.id),style:'rune',label:'心智增幅 · 下次攻击强化'});}
  if(s.hardControl&&!state.boss.core&&!state.boss.finale&&!state.boss.broken&&!state.boss.controlImmune&&!state.boss.hardControl){const result=attemptControl(state,state.boss,{power:18,source:id,label:'行动封锁'});if(result.success){state.boss.hardControl=1;state.stats.interrupts++;}events.push({type:'buff',actor:id,targets:[state.boss.unitId||'boss'],style:'rune',label:result.success?'强制停机 · 行动封锁':'意志抵抗 · 封锁失败'});log(state,`${bossName(state)}${result.success?'行动被封锁':'抵抗了行动封锁'}（抵抗率 ${Math.round(result.resistance*100)}%）。`,result.success?'good':'warning');}
  if(s.cleanse&&!s.shield&&!s.heal)for(const target of alive(state))target.resonance=Math.max(0,target.resonance-s.cleanse);
  if(s.allCleanse)for(const target of alive(state))target.resonance=Math.max(0,target.resonance-s.allCleanse);
  if(s.cleanse||s.allCleanse)for(const target of (s.self||s.selfShield?[h]:alive(state)))cleanseAttributes(target);
  if(h.id==='ric'){h.resource=nextResource;if(s.shift||s.resetBalance)harmony(state,h,before,events);}
  if(s.captainFinish)leaveCaptain(state,h);
  if(!events.length)events.push({type:'buff',actor:id,targets:s.weaken||s.vulnerable||s.stripBuffs||s.mark||s.confuse||s.recordIntent?[state.boss.unitId]:[id],style:s.style,label:s.name});
  return{ok:true,events};
}
function leaveCaptain(state,h){h.youmuForm='doctor';h.captainTurns=0;h.tauntTurns=0;h.exhaustedTurns=2;h.exhaustionFresh=true;log(state,'游墓退去。游木虚脱两轮：力量、智力与敏捷 −4；仍可治疗、用药与行动。','warning');}
function cleanseAttributes(hero){clearControl(hero);hero.attributeBuffs=(hero.attributeBuffs||[]).filter(effect=>effect.cleansable===false||!Object.values(effect.stats||{}).some(n=>n<0));}
export function usePotion(state,targetId){
  if(state.mode!=='playing')return{ok:false,error:'战斗已结束',events:[]};
  if(state.ap<1||state.potions<=0)return{ok:false,error:state.ap<1?'行动点不足':'补给已用尽',events:[]};
  const h=heroOf(state,targetId===undefined?state.selected:targetId);
  if(!h)return{ok:false,error:'未知的药剂目标',events:[]};if(h.hp>=h.maxHp&&!h.control&&!h.attributeBuffs?.some(e=>Object.values(e.stats||{}).some(n=>n<0)))return{ok:false,error:'这位队员生命已满',events:[]};
  const down=h.hp<=0;state.ap--;state.potions--;state.serial++;state.stats.actions++;const amount=healHero(state,h,down?60:65);h.resonance=0;cleanseAttributes(h);
  log(state,`使用应急药剂：${h.short}${down?'重新站起，并':''}回复 ${amount} 生命，共鸣清零。`,'good');
  return{ok:true,events:[{type:'heal',actor:state.selected,targets:[h.id],amount,amounts:{[h.id]:amount},style:'rune',label:down?'重新站起':'应急药剂'}]};
}
export function guard(){return {ok:false,error:'通用防御已合并到角色技能，请装配并使用角色的防护能力。',events:[]};}
const enemyMultiplier=state=>(BOSSES[state.boss.id].isTutorial?.75:DIFFICULTIES[state.difficulty].damage)*(isSolo(state)?SOLO_RULES.bossDamage:1);
function scaled(state,n){return Math.round(n*enemyMultiplier(state));}
// Each layer bonus is visible in the current intent before the player commits.
export const BOSS_PRESSURE={
 compression:{key:'fog',label:'迷雾',perLayer:6},
 mirror:{key:'mirror',label:'镜片',perLayer:10},pierce:{key:'mirror',label:'镜片',perLayer:8},
 drain:{key:'spores',label:'孢压',perLayer:8},bloom:{key:'spores',label:'孢压',perLayer:14},
 arc:{key:'charge',label:'蓄电',perLayer:5},ground:{key:'charge',label:'蓄电',perLayer:6},storm:{key:'charge',label:'蓄电',perLayer:12},
 sever:{key:'seals',label:'封页',perLayer:12},
 zero_lance:{key:'seals',label:'屏障',perLayer:7},zero_pulse:{key:'seals',label:'屏障',perLayer:14},
 tide_hook:{key:'waterLevel',label:'水位',perLayer:8},tide_breaker:{key:'waterLevel',label:'水位',perLayer:18},tide_release:{key:'waterLevel',label:'水位',perLayer:12},
 furnace_vent:{key:'heat',label:'炉热',perLayer:11},furnace_drop:{key:'heat',label:'炉热',perLayer:12},
 orbit_lance:{key:'prediction',label:'锁定',perLayer:18},orbit_sweep:{key:'prediction',label:'锁定',perLayer:10},orbit_collapse:{key:'prediction',label:'锁定',perLayer:16},
 edict_mark:{key:'violations',label:'违令',perLayer:7},edict_sentence:{key:'violations',label:'违令',perLayer:20},edict_audit:{key:'violations',label:'违令',perLayer:14},edict_revoke:{key:'violations',label:'违令',perLayer:8}
};
export function attackSpec(state){
  const b=state.boss,bonus=b.stage?(b.id==='duelist'?6:b.id==='final'?7:5):0;
  if(b.finale)return{key:'zero_end',name:'停机过载 · 最后放电',damage:65,kind:'magic',group:true,style:'burst'};
  if(b.charging)return{key:'quake',name:'地裂',damage:70,kind:'physical',group:true,style:'quake'};
  const table={
    drone_shot:{name:'瞄准射击',damage:25+(b.supportCharge||0)*8,kind:'physical',style:'shot'},drone_charge:{name:'蓄能贯射',damage:40+(b.supportCharge||0)*8,kind:'physical',style:'shot'},
    escort_bash:{name:'护卫推击',damage:22,kind:'physical',style:'quake'},escort_stamp:{name:'重踏警戒',damage:18,kind:'physical',group:true,style:'quake'},
    relay_feed:{name:'中继供能',damage:0,kind:'magic',style:'rune'},relay_blast:{name:'中继放电',damage:18,kind:'magic',group:true,style:'burst'},
    spore_shot:{name:'游孢喷吐',damage:15,kind:'magic',style:'mist'},spore_feed:{name:'菌丝供养',damage:10,kind:'magic',style:'rune'},
    scout_swing:{name:'迟缓挥臂',damage:12,kind:'physical',style:'slash'},scout_ram:{name:'亮灯冲撞',damage:24,kind:'physical',style:'quake'},
    bulwark_punch:{name:'石拳推击',damage:18,kind:'physical',style:'quake'},bulwark_stamp:{name:'碎石踏步',damage:20,kind:'physical',group:true,style:'quake'},
    conduit_zap:{name:'短路电击',damage:22,kind:'magic',style:'shot'},conduit_discharge:{name:'积电释放',damage:24,kind:'magic',group:true,style:'burst'},
    slam:{name:'势能重击',damage:85,kind:'physical',style:'quake'},missiles:{name:'碎岩连弹',damage:31,hits:3,kind:'physical',style:'shot'},
    fog:{name:'迷雾孢子',damage:24,kind:'magic',group:true,style:'mist'},compression:{name:'魔力压缩',damage:48,kind:'magic',group:true,style:'rune'},reclaim:{name:'元素回收',damage:22,kind:'magic',group:true,style:'rune'},
    rend:{name:'裂锋三连',damage:28+bonus,hits:3,kind:'physical',style:'slash'},mirror:{name:'折镜架势',damage:75+bonus,kind:'physical',style:'slash'},
    pierce:{name:'贯镜突刺',damage:44+bonus,kind:'physical',group:true,style:'slash'},duel:{name:'双刃决斗',damage:98+bonus,kind:'physical',style:'slash'},
    sow:{name:'播孢细雨',damage:35+bonus,kind:'magic',group:true,style:'mist'},drain:{name:'抽髓祷告',damage:74+bonus,kind:'magic',style:'rune'},
    bloom:{name:'冠孢绽放',damage:50+bonus,kind:'magic',group:true,style:'burst'},weave:{name:'菌丝重织',damage:28+bonus,kind:'magic',group:true,style:'rune'},
    arc:{name:'雷链双击',damage:35+bonus,hits:2,kind:'physical',style:'shot'},ground:{name:'接地冲击',damage:44+bonus,kind:'physical',group:true,style:'quake'},
    storm:{name:'风暴倾泻',damage:50+bonus,kind:'magic',group:true,style:'burst'},charge:{name:'雷针充能',damage:30+bonus,kind:'magic',group:true,style:'rune'},
    script:{name:'缄页刻写',damage:42+bonus,kind:'magic',group:true,style:'rune'},silence:{name:'资源封缄',damage:42+bonus,hits:2,kind:'magic',style:'shot'},
    rewrite:{name:'命运复写',damage:32+bonus,kind:'magic',group:true,style:'rune'},sever:{name:'断章裁切',damage:50+bonus,kind:'physical',group:true,style:'slash'},
    zero_lance:{name:'归零贯星',damage:40+bonus,hits:2,kind:'physical',style:'shot'},zero_field:{name:'寂静边界',damage:45+bonus,kind:'magic',group:true,style:'rune'},
    zero_pulse:{name:'空白脉冲',damage:56+bonus,kind:'magic',group:true,style:'burst'},zero_reset:{name:'回响重置',damage:30+bonus,kind:'magic',group:true,style:'rune'},
    tide_hook:{name:'牵流重锚',damage:84+bonus,kind:'physical',style:'slash'},tide_fill:{name:'开闸蓄水',damage:32+bonus,kind:'magic',group:true,style:'mist'},
    tide_breaker:{name:'满潮破堤',damage:48+bonus,kind:'magic',group:true,style:'quake'},tide_release:{name:'泄流穿刺',damage:72+bonus,kind:'physical',style:'shot'},
    furnace_lift:{name:'吊臂连摆',damage:39+bonus,hits:2,kind:'physical',style:'slash'},furnace_vent:{name:'炉门排汽',damage:36+bonus,kind:'magic',group:true,style:'mist'},
    furnace_drop:{name:'熔核落锤',damage:94+bonus,kind:'physical',style:'quake'},furnace_feed:{name:'投料升温',damage:28+bonus,kind:'magic',group:true,style:'rune'},
    orbit_lance:{name:'定轨贯星',damage:80+bonus,kind:'magic',style:'shot'},orbit_sweep:{name:'测距扫弧',damage:43+bonus,kind:'physical',group:true,style:'slash'},
    orbit_calibrate:{name:'星图校准',damage:27+bonus,kind:'magic',group:true,style:'rune'},orbit_collapse:{name:'轨道坍缩',damage:57+bonus,kind:'magic',group:true,style:'burst'},
    edict_mark:{name:'缄令宣告',damage:35+bonus,kind:'magic',group:true,style:'rune'},edict_sentence:{name:'单席判决',damage:84+bonus,kind:'physical',style:'slash'},
    edict_audit:{name:'全庭核验',damage:46+bonus,kind:'magic',group:true,style:'burst'},edict_revoke:{name:'权限收回',damage:33+bonus,kind:'magic',group:true,style:'rune'}
  };
  const spec={key:b.intent,...table[b.intent]},rule=BOSS_PRESSURE[b.intent];
  if(rule){const layers=b[rule.key]||0;spec.pressure={...rule,layers,damageBonus:layers*rule.perLayer};spec.damage+=spec.pressure.damageBonus;}
  return spec;
}
export function responseOptions(){return [];}
export function prepareResponse(){return {ok:false,error:'通用应对已合并到角色技能，请选择角色的防护、削弱或控制能力。',events:[]};}
function hurtParty(state,events,ids,base,kind,label,style='quake',resonance=true){
  let total=0;const amounts={},absorbedAmounts={},afterHit=[],targets=ids.filter(id=>heroOf(state,id)?.hp>0),reflections=[];
  for(const id of targets){
    const h=heroOf(state,id);let n=Math.max(1,Math.round((base+attackAttribute(state.boss,kind,state)-defenseAttribute(h,kind,state))*enemyMultiplier(state)));
    if(h.evasion>0){h.evasion--;n=0;events.push({type:'buff',actor:id,targets:[id],style:'guard',label:'战术位移 · 闪开一击'});}
    if(n>0&&ricChaosDefenseReduction(h)){const prevented=Math.min(n,consumeRicChaos(h));n-=prevented;for(const enemy of livingEnemies(state))if(enemy.finale)enemy.finaleProtected=true;events.push({type:'buff',actor:id,targets:[id],style:'guard',amount:prevented,label:'混沌 · 抵御攻击'});}
    const shield=absorbShield(h,n);n-=shield;const actual=Math.min(h.hp,n);h.hp-=actual;total+=actual;amounts[id]=actual;absorbedAmounts[id]=shield;
    if(h.reflect>0&&h.hp>0&&(h.id!=='qianxing'||kind==='physical')){h.reflect--;reflections.push(h.id);}
    if(resonance&&h.hp>0&&state.boss.id==='golem')h.resonance=Math.min(5,h.resonance+(kind==='physical'?1:0));
    if(h.fieldCare>0&&actual>0&&h.hp>0){const healed=healHero(state,h,h.fieldCare);h.fieldCare=0;afterHit.push({type:'heal',actor:id,targets:[id],amount:healed,amounts:{[id]:healed},style:'rune',label:'预备包扎 · 受击后处理'});}
    if(h.hp<=0)log(state,`${h.short}倒下了。可选择其头像，使用药剂救起。`,'bad');
  }
  events.push({type:'boss',actor:state.boss.unitId||'boss',targets,bossId:state.boss.id,intentId:state.boss.intent,kind,style,amount:total/Math.max(1,targets.length),amounts,hpLosses:{...amounts},absorbedAmounts,label});events.push(...afterHit);
  if(total)log(state,`${label}命中，队伍受到 ${total} 生命伤害。`,'bad');else log(state,`${label}被角色防护与护盾化解。`,'good');
  if(alive(state).length===0){state.mode='defeat';events.push({type:'defeat',actor:state.boss.unitId||'boss',targets:state.heroes.map(h=>h.id),label:'远征未竟'});}
  for(const id of reflections){
    if(state.mode!=='playing')break;
    const physical=id==='qianxing';
    dealToBoss(state,{id:'retaliation',name:physical?'钉刺反击':id==='patch'?'镜反回击':'防护回击',kind:physical?'physical':'magic',damage:28,hits:1,stagger:0,style:physical?'shot':'rune'},events,id,{response:true});
  }
}
function healBoss(state,events,amount,label){
  const n=Math.min(state.boss.maxHp-state.boss.hp,Math.round(amount));state.boss.hp+=n;
  events.push({type:'heal',actor:state.boss.unitId||'boss',targets:[state.boss.unitId||'boss'],amount:n,amounts:{[state.boss.unitId||'boss']:n},label});log(state,`${label}：${bossName(state)}回复 ${n} 生命。`,n?'warning':'good');
}
export function intentInfo(state){
  const b=state.boss;
  if(b.finale)return{name:'停机过载 · 最后放电',desc:`${isSolo(state)?'独狼':'全队'}承受 ${Math.max(1,scaled(state,65+attackAttribute(b,'magic',state)))} 魔法伤害 · ${isSolo(state)?`任意命中 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1、魔法 ${b.finaleMagic}/1`}、${b.finaleProtected?'角色防护已建立':'还需使用角色防护技能'} · 接入后守住最后放电即可关闭核心 · 剩余 ${b.finaleTurns} 个完整回合，超时恢复 22% 生命`,icon:'crystal',danger:true,responses:responseOptions(state)};
  if(b.core)return{name:'核心重组',desc:`剩余 ${b.coreTurns} 个完整回合 · ${isSolo(state)?`任意属性累计命中 ${b.coreHits}/${SOLO_RULES.coreHits}`:'需要物理与魔法各 3 次'}`,icon:'crystal',danger:true,responses:responseOptions(state)};
  if(b.defeated)return {name:'已倒下',desc:'不能行动；其余敌人仍须击败。',icon:'break',good:true,responses:[]};
  if(b.hardControl&&!b.core&&!b.finale)return{name:'行动封锁',desc:'下一次普通敌方行动被取消；之后一整轮抗控。此状态不附带破韧增伤。',icon:'bind',good:true,responses:responseOptions(state)};
  if(b.broken)return{name:'架势崩溃',desc:'本轮停止行动 · 受到伤害 +50% · 下一轮抗控',icon:'break',good:true,responses:responseOptions(state)};
  const spec=attackSpec(state),target=heroOf(state,enemyTarget(state))?.short||'队员',base=spec.damage?Math.max(1,scaled(state,spec.damage+attackAttribute(b,spec.kind,state))):0,hits=spec.hits||1;
  let desc=spec.damage?`${spec.group?'全队':`目标：${target}`} · ${hits>1?`${hits} × `:''}${base} ${spec.kind==='magic'?'魔法':'物理'}伤害`:'',icon={scout_swing:'blade',scout_ram:'quake',bulwark_punch:'hammer',bulwark_stamp:'quake',conduit_zap:'rune',conduit_discharge:'crystal',slam:'hammer',missiles:'scatter',fog:'mist',compression:'rune',reclaim:'heal',quake:'quake',rend:'blades',mirror:'shield',pierce:'blade',duel:'blades',sow:'mist',drain:'rune',bloom:'crystal',weave:'heal',arc:'scatter',ground:'quake',storm:'crystal',charge:'rune',script:'book',silence:'bind',rewrite:'heal',sever:'blade',zero_lance:'twin',zero_field:'shield',zero_pulse:'crystal',zero_reset:'repeat',tide_hook:'blade',tide_fill:'mist',tide_breaker:'quake',tide_release:'scope',furnace_lift:'hammer',furnace_vent:'mist',furnace_drop:'quake',furnace_feed:'rune',orbit_lance:'target',orbit_sweep:'blades',orbit_calibrate:'heal',orbit_collapse:'crystal',edict_mark:'book',edict_sentence:'blade',edict_audit:'rune',edict_revoke:'bind'}[spec.key];
  if(spec.pressure)desc+=` · ${spec.pressure.label} ${spec.pressure.layers} 层：每层基础伤害 +${spec.pressure.perLayer}${hits>1?' / 段':''}，当前共 +${spec.pressure.damageBonus}${hits>1?' / 段':''}`;
  if(b.cover)desc+=' · 已被掩护射击盯住，出手前受截击';
  if(b.confusion)desc+=' · 杀意改写：力量、智力各 −16，单体攻击优先转向其他敌人';
  if(b.recordedIntent)desc+=' · 预告被收录：最后行动、力量智力各 −8，取消招式附效';
  if(b.id==='escort')desc+=' · 未被击破或强控时替主敌分担50%单体伤害';
  if(['relay','relay_guard'].includes(b.id))desc+=' · 供能增强同伴；破坏装置令其余敌人停机一轮';
  if(b.id==='sporeling')desc+=' · 供养回合替司祭回复22生命';
  if(BOSSES[b.id].isTutorial)desc+=['scout_ram','bulwark_stamp','conduit_discharge'].includes(spec.key)?' · 特殊招式：用角色防护技能降低承伤，或先削尽韧性取消攻击':' · 普通攻击：观察下轮预告，留好角色资源';
  if(spec.key==='fog')desc+=' · 释放 5 层迷雾 · 每次魔法命中驱散 1 层';
  if(spec.key==='reclaim')desc+=` · 吸收全队共鸣，回复 ${alive(state).reduce((n,h)=>n+h.resonance,0)*8} 生命 · 先用净化技能清除共鸣`;
  if(spec.key==='rend')desc+=' · 招后补充 1 镜片';
  if(spec.key==='mirror')desc+=` · 本轮每次物理技能反噬 ${scaled(state,7+b.mirror*3)}（无镜片则不反噬） · 魔法拆镜`;
  if(spec.key==='drain')desc+=` · 同时回复 ${30+b.spores*12} 生命`;
  if(spec.key==='sow')desc+=` · 孢压 +${b.stage?3:2}`;
  if(spec.key==='bloom')desc+=' · 释放后清空孢压';
  if(spec.key==='weave')desc+=` · 回复 ${60+b.spores*12} 生命，孢压 +2 · 打断或强控可阻止恢复，意志削弱可提高强控成功率`;
  if(spec.key==='arc')desc+=' · 物理命中泄能';
  if(spec.key==='ground')desc+=' · 释放后蓄电 −2';
  if(spec.key==='storm')desc+=' · 释放后清空蓄电';
  if(spec.key==='charge')desc+=' · 蓄电 +3（最多 6） · 先用物理攻击泄能，或以角色防护承受充能冲击';
  if(spec.key==='script')desc+=' · 刻写后封页 +1';
  if(spec.key==='silence')desc+=` · 若还存在封页，全队资源向 0 减少 ${b.stage?2:1} · 异系拆封或打断可阻止抽取`;
  if(spec.key==='rewrite')desc+=` · 回复 ${b.stage?100:80} 生命，封页恢复至 3 · 削弱意志可提高强控成功率；打断或强控取消此次行动`;
  if(spec.key==='sever')desc+=' · 先用异系连击拆封';
  if(spec.key==='zero_field')desc+=' · 招后归零屏障 +1';
  if(spec.key==='zero_pulse')desc+=isSolo(state)?' · 每次主动攻击拆 1 屏障':' · 交替攻击拆屏障';
  if(spec.key==='zero_reset')desc+=` · 回复 ${b.stage?90:65} 生命，屏障恢复至 3、同步归零 · 削弱意志可提高强控成功率；打断或强控取消此次行动`;
  if(b.id==='tide')desc+=` · 水位 ${b.waterLevel}/4 · 任意属性累计 3 次命中排水 1（当前 ${b.valveHits}/3）`;
  if(spec.key==='tide_fill')desc+=' · 攻击后水位 +2，上限 4；任意三次命中排水 1';
  if(spec.key==='tide_breaker')desc+=' · 释放后水位清零';
  if(spec.key==='tide_release')desc+=' · 释放后排水 1';
  if(spec.key==='furnace_vent')desc+=` · 炉热 ${b.heat}/6 · 释放后炉门敞开：敏捷、智力各 −8，每次命中泄热 1`;
  if(spec.key==='furnace_drop')desc+=` · 炉热 ${b.heat}/6 · 趁敞口连击泄热；落锤后关闭炉门并清空炉热`;
  if(spec.key==='furnace_feed')desc+=' · 释放后炉热 +3（最多 6）、炉门关闭；在开炉后连击泄热，或用驱散削减炉热';
  if(spec.key==='orbit_lance'||spec.key==='orbit_sweep'||spec.key==='orbit_collapse')desc+=` · 锁定 ${b.prediction}/3 · 重复上一项攻击技能 +1，换攻击技能 −1${spec.key==='orbit_collapse'?'；释放后锁定清零':''}`;
  if(spec.key==='orbit_calibrate')desc+=' · 回复 55 生命、锁定 +1（最多 3）；换招降低锁定，削弱意志后用强控阻止恢复';
  if(b.id==='arbiter')desc+=` · ${b.decree==='light'?'轻击令：只允许 1 AP 攻击':'重击令：只允许至少 2 AP 攻击'} · 违令 ${b.violations}/3，当前伤害已计入判罚；辅助技能不计，新回合清零换令`;
  if(spec.key==='edict_revoke')desc+=' · 若违令至少 2，资源向 0 减少 2；遵守轻重击令或取消此次行动可防止抽取';
  if(canInterrupt(state))desc+=' · 可用咒弹或破韧打断';if(b.controlImmune)desc+=' · 本轮抗控，无法打断';

  if(b.phasePending)desc+=' · 下一轮将完整预告地裂';
  if(b.exposed)desc+=' · 破绽：本轮受到伤害 +50%，仍会出招';
  return{name:b.charging?'地裂 · 蓄力中':spec.name,desc,icon,danger:b.charging||['scout_ram','bulwark_stamp','conduit_discharge','bloom','pierce','storm','sever','zero_pulse','tide_breaker','furnace_drop','orbit_collapse','edict_audit'].includes(spec.key),responses:responseOptions(state)};
}
function resolveEnemyRound(state){
  if(state.mode!=='playing')return{ok:false,error:'战斗已结束',events:[]};
  const b=state.boss,events=[],wasControlled=!!b.hardControl&&!b.core&&!b.finale,wasBroken=b.broken,wasCore=b.core,wasFinale=b.finale;state.response=null;
  if(b.defeated)return {ok:true,events};
  if(b.recordedIntent?.intent!==attackSpec(state).key)b.recordedIntent=null;
  const cover=b.cover;b.cover=null;
  if(cover&&!wasControlled&&!wasBroken&&!wasCore&&heroOf(state,cover.actor)?.hp>0){
    if(cover.stripBuffs)stripBossBuffs(b,cover.stripBuffs);
    dealToBoss(state,{id:'cover_counter',name:'直感反制 · 截击',kind:'physical',damage:cover.damage,hits:1,stagger:cover.stagger,mark:true,style:'shot'},events,cover.actor,{response:true});
    b.actionSuppression=.5;
  }
  if(b.defeated||state.mode!=='playing')return {ok:true,events};
  if(b.core){
    if(b.coreFresh){b.coreFresh=false;log(state,`核心稳定显形。接下来有 2 个完整回合完成${isSolo(state)?'四次任意命中':'双系净化'}。`,'warning');}
    else{b.coreTurns--;if(b.coreTurns<=0){
      b.core=false;b.coreFresh=false;b.reforms++;b.hp=Math.round(b.maxHp*.28);b.stagger=Math.round(b.maxStagger*.65);b.stage=3;b.broken=false;b.exposed=false;b.charging=false;b.phasePending=false;b.fog=0;b.corePhysical=0;b.coreMagic=0;b.coreHits=0;
      events.push(bossPhaseEvent(state,'phase','元素重组'));log(state,'核心重新凝结出躯壳！巨人恢复 28% 生命，击碎后仍可再次净化。','warning');
    }else log(state,`核心正在重组！还剩 ${b.coreTurns} 个回合。`,'warning');}
  }else if(wasControlled)log(state,`${bossName(state)}的行动被封锁，本轮无法出招。`,'good');
  else if(b.broken)log(state,`${bossName(state)}重新稳住架势，错过本轮行动。`,'good');
  else{
    const spec=attackSpec(state),recorded=b.recordedIntent?.intent===spec.key,confused=b.confusion;
    const redirected=confused&&!spec.group?livingEnemies(state).find(e=>e!==b):null;
    // Snapshot after interception strips layers, before the announced move consumes them.
    const plan=comboPlan(state,b,spec);
    const ids=alive(state).map(h=>h.id),target=enemyTarget(state),sporesBefore=b.spores;
    if(redirected&&spec.damage){for(let i=0;i<(spec.hits||1)&&state.mode==='playing'&&!redirected.defeated;i++)withEnemy(state,redirected,()=>dealToBoss(state,{id:'confused_attack',name:spec.name+' · 杀意改写',kind:spec.kind,damage:Math.round(spec.damage*enemyMultiplier({...state,boss:b})),hits:1,stagger:0,bypassGuard:true,noLayers:true,style:spec.style},events,b.unitId,{response:true}));}
    if(!redirected&&spec.damage)for(let i=0;i<(spec.hits||1)&&state.mode==='playing'&&!b.defeated&&!b.core&&(wasFinale||!b.finale);i++){
      const currentTarget=heroOf(state,target)?.hp>0?target:alive(state)[0]?.id;
      hurtParty(state,events,spec.group?alive(state).map(h=>h.id):[currentTarget],spec.damage,spec.kind,spec.name,spec.style,true);
    }
    if(state.mode==='playing'&&!b.defeated&&!(!wasCore&&b.core)&&!(!wasFinale&&b.finale)){
      if(!recorded){
      if(spec.key==='fog'){b.fog=5;events.push({type:'boss',actor:state.boss.unitId||'boss',targets:ids,style:'mist',kind:'magic',amount:0,label:'迷雾孢子'});log(state,'迷雾孢子扩散：每次魔法命中可清除 1 层。','warning');}
      if(spec.key==='reclaim'){const stacks=alive(state).reduce((n,h)=>n+h.resonance,0);healBoss(state,events,stacks*8,'元素回收');alive(state).forEach(h=>h.resonance=0);}
      if(spec.key==='rend')b.mirror=Math.min(3,b.mirror+1);
      if(spec.key==='sow'){b.spores=Math.min(5,b.spores+(b.stage?3:2));if(b.summons<3){const add=spawnEnemy(state,'sporeling',{},events);if(add)b.summons++;}}
      if(spec.key==='drain')healBoss(state,events,(30+sporesBefore*12),'抽髓祷告');
      if(spec.key==='bloom')b.spores=0;
      if(spec.key==='weave'){healBoss(state,events,(60+sporesBefore*12),'菌丝重织');b.spores=Math.min(5,b.spores+2);}
      if(spec.key==='ground')b.charge=Math.max(0,b.charge-2);
      if(spec.key==='storm')b.charge=0;
      if(spec.key==='charge'){b.charge=Math.min(6,b.charge+3);events.push({type:'boss',actor:state.boss.unitId||'boss',targets:[state.boss.unitId||'boss'],style:'rune',amount:0,label:'雷针充能'});log(state,`雷针充能：蓄电升至 ${b.charge}/6。`,'warning');}
      if(spec.key==='script')b.seals=Math.min(3,b.seals+1);
      if(spec.key==='silence'&&b.seals>0){
        const loss=b.stage?2:1;
        for(const h of alive(state))h.resource=h.id==='ric'?(Math.sign(h.resource)*Math.max(0,Math.abs(h.resource)-loss)||0):Math.max(0,h.resource-loss);
        log(state,`资源封缄：封页未破，全队资源向 0 减少 ${loss}。`,'warning');
      }
      if(spec.key==='rewrite'){healBoss(state,events,(b.stage?100:80),'命运复写');b.seals=3;}
      if(spec.key==='zero_field')b.seals=Math.min(3,b.seals+1);
      if(spec.key==='zero_reset'){healBoss(state,events,(b.stage?90:65),'回响重置');b.seals=3;b.sync=0;b.lastKind=null;}
      if(spec.key==='tide_fill')b.waterLevel=Math.min(4,b.waterLevel+2);
      if(spec.key==='tide_breaker')b.waterLevel=0;
      if(spec.key==='tide_release')b.waterLevel=Math.max(0,b.waterLevel-1);
      if(spec.key==='furnace_vent')b.furnaceOpen=true;
      if(spec.key==='furnace_drop'){b.furnaceOpen=false;b.heat=0;}
      if(spec.key==='furnace_feed'){b.heat=Math.min(6,b.heat+3);b.furnaceOpen=false;}
      if(spec.key==='orbit_calibrate'){healBoss(state,events,55,'星图校准');b.prediction=Math.min(3,b.prediction+1);}
      if(spec.key==='orbit_collapse')b.prediction=0;
      if(spec.key==='edict_revoke'&&b.violations>=2){
        for(const h of alive(state))h.resource=h.id==='ric'?(Math.sign(h.resource)*Math.max(0,Math.abs(h.resource)-2)||0):Math.max(0,h.resource-2);
        log(state,'权限收回：违令至少 2，全队资源向 0 减少 2。','warning');
      }
      if(spec.key==='relay_feed')for(const other of livingEnemies(state).filter(e=>e!==b)){if(['drone','patrol'].includes(other.id))other.supportCharge=Math.min(2,other.supportCharge+1);if(other.id==='warden')other.charge=Math.min(6,other.charge+2);}
      if(spec.key==='spore_feed'){const cantor=livingEnemies(state).find(e=>e.id==='cantor');if(cantor)withEnemy(state,cantor,()=>healBoss(state,events,22,'菌丝供养'));}
      }
      if(b.charging)b.charging=false;
      if(state.mode==='playing'&&spec.key==='zero_end'&&b.finale){
        if(b.finaleProtected&&(isSolo(state)?b.finaleHits>=SOLO_RULES.finaleHits:b.finalePhysical&&b.finaleMagic)){
          b.finaleFresh=false;state.response=null;
          defeatEnemy(state,events,'核心关闭');log(state,'接入完成，最后一道电流被挡住。核心终于停止运转，维修组的撤离通道重新打开了。','good');
        }else{
          if(b.finaleFresh)b.finaleFresh=false;else b.finaleTurns--;
          if(b.finaleTurns<=0){
            b.finale=false;b.finaleProtected=false;b.finaleFresh=false;b.finaleTurns=2;b.finalePhysical=0;b.finaleMagic=0;b.finaleHits=0;b.hp=Math.round(b.maxHp*.22);b.seals=3;b.sync=0;b.lastKind=null;b.stagger=Math.round(b.maxStagger*.65);b.reforms++;
            events.push(bossPhaseEvent(state,'phase','停机失败 · 再启动'));log(state,'未能在期限内完成接入与防护。核心恢复 22% 生命；再次击破后可以重新尝试停机。','warning');
          }else log(state,`终幕尚未结束：${isSolo(state)?`任意命中 ${b.finaleHits}/${SOLO_RULES.finaleHits}`:`物理 ${b.finalePhysical}/1、魔法 ${b.finaleMagic}/1`}，还需在使用角色防护技能后结束回合。`,'warning');
        }
      }
      for(const step of plan.after){
        if(state.mode!=='playing'||b.defeated||b.core||b.finale||b.broken||b.hardControl)break;
        const targets=step.targets.filter(id=>heroOf(state,id)?.hp>0);
        if(!targets.length)continue;
        if(step.type==='attack')hurtParty(state,events,targets,step.damage,step.kind,step.label,step.style,false);
        else if(step.type==='debuff'){
          for(const id of targets)addAttributeEffect(heroOf(state,id),step.effect);
          events.push({type:'buff',actor:b.unitId||'boss',targets,style:'rune',label:step.label});
          log(state,`${targets.map(id=>heroOf(state,id).short).join('、')}受到「${step.label}」影响，可净化解除。`,'warning');
        }else if(step.type==='control')for(const id of targets){
          const hero=heroOf(state,id),result=attemptControl(state,hero,{...step.control,source:b.unitId||'boss'});
          const label=result.success?`${step.label} · ${step.control.type==='stun'?'眩晕':'封术'}`:'意志抵抗';
          events.push({type:'buff',actor:b.unitId||'boss',targets:[id],style:'rune',label});
          log(state,`${hero.short}${result.success?'受到「'+step.label+'」，持续下一完整回合':'抵抗了「'+step.label+'」'}（抵抗率 ${Math.round(result.resistance*100)}%）。`,result.success?'bad':'good');
        }
      }
    }
  }
  // Damage over time settles after the telegraphed action. Crossing a body/core
  // boundary cannot replace that action with an unseen attack from a new phase.
  if(state.mode==='playing'&&!b.defeated)tickWound(state,events);
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
  b.finaleProtected=false;b.actionSuppression=1;b.confusion=null;b.recordedIntent=null;b.control=null;
  // A response breaks posture after the boss has already acted. Carry only its
  // damage window into the next player turn, not another cancelled enemy turn.
  const responseBreak=b.broken&&!wasBroken&&!wasControlled;
  b.exposed=responseBreak;b.hardControl=0;b.controlImmune=(wasBroken||responseBreak||wasControlled)?1:Math.max(0,b.controlImmune-1);
  b.broken=false;b.stagger=Math.min(b.maxStagger,b.stagger<=0?b.maxStagger:b.stagger+(isSolo(state)?SOLO_RULES.staggerRegen:12));b.marked=false;
  if(responseBreak)log(state,'角色反击击出破绽：下一玩家回合伤害 +50%，敌人仍会按预告出招；该回合无法再次打断。','good');
  if(b.id==='duelist'&&b.stage)b.mirror=Math.min(3,b.mirror+1);
  if(b.id==='warden'&&b.stage)b.charge=Math.min(6,b.charge+1);
  if(b.id==='weaver'){b.sealedKind=b.sealedKind==='physical'?'magic':'physical';b.seals=Math.min(3,b.seals+1);}
  if(b.id==='arbiter'){b.decree=b.decree==='light'?'heavy':'light';b.violations=0;}
  if(b.finale||b.core){b.broken=false;b.exposed=false;b.controlImmune=0;}
  if(!wasBroken&&!wasCore&&!wasControlled)b.weakened=0;
  b.vulnerable=Math.max(0,b.vulnerable-1);b.healSuppression=Math.max(0,b.healSuppression-1);ageAttributeEffects(b);
  if(!b.defeated){const cycle=BOSS_INTENTS[b.id];b.intent=cycle[state.round%cycle.length];b.intentTarget=alive(state)[state.round%alive(state).length].id;
  if(b.phasePending&&!b.core){b.charging=!b.broken;b.phasePending=false;}}
  return {ok:true,events};
}
export function endRound(state){
  ensureEnemyState(state);
  if(state.mode!=='playing')return {ok:false,error:'战斗已结束',events:[]};
  state.stats.turns++;state.serial++;const events=[];
  // Resolve a snapshot. New summons wait until the next enemy phase; dead units never act.
  const order=[...livingEnemies(state)].sort((a,b)=>(!!a.recordedIntent)-(!!b.recordedIntent));
  for(const enemy of order){if(state.mode!=='playing')break;if(enemy.defeated)continue;const result=withEnemy(state,enemy,()=>resolveEnemyRound(state));events.push(...result.events);}
  for(const enemy of state.enemies||[state.boss]){enemy.actionSuppression=1;enemy.cover=null;}
  for(const h of state.heroes){expireRicChaos(h);if(h.id==='knibbs')Object.assign(h,endKnibbsFollowup());}
  if(state.mode!=='playing'){ensureEnemySelection(state);return {ok:true,events:stampEnemyEvents(state,events)};}
  state.round++;refreshActionPoints(state);
  // Every shield layer ages once at the completed enemy-phase boundary.
  for(const h of state.heroes){const expired=ageShields(h);if(expired)events.push({type:'shield-expire',actor:h.id,targets:[h.id],amount:expired,amounts:{[h.id]:expired},style:'guard',label:'护盾到期'});}
  for(const h of state.heroes){
    ageAttributeEffects(h);ageControl(h);
    if(h.regenTurns>0&&h.hp>0){const amount=healHero(state,h,h.regenAmount);events.push({type:'heal',actor:'youmu',targets:[h.id],amount,amounts:{[h.id]:amount},style:'rune',label:'精密缝合 · 伤口愈合'});}
    h.regenTurns=Math.max(0,h.regenTurns-1);if(!h.regenTurns||h.hp<=0){h.regenTurns=0;h.regenAmount=0;}
    h.tauntTurns=Math.max(0,h.tauntTurns-1);h.attackBuffTurns=Math.max(0,h.attackBuffTurns-1);if(!h.attackBuffTurns)h.attackBuff=0;
    h.guard=false;h.protection=0;h.evasion=0;h.fieldCare=0;h.executionRefund=false;h.used=[];h.patchObserved=false;h.patchRecorded=false;
    for(const key of Object.keys(h.cooldowns))h.cooldowns[key]=Math.max(0,h.cooldowns[key]-1);
    if(['knibbs','youmu'].includes(h.id)&&h.hp>0)h.resource=Math.min(10,h.resource+2);
    if(h.id==='knibbs')Object.assign(h,endKnibbsFollowup());
    if(h.id==='ric'&&h.hp>0){const before=h.resource;h.resource=Math.abs(before)<=2?0:Math.sign(before)*(Math.abs(before)-2);harmony(state,h,before,events);}
    if(h.youmuForm==='captain'){h.captainTurns--;if(h.captainTurns<=0||h.hp<=0)leaveCaptain(state,h);}
    if(h.exhaustionFresh)h.exhaustionFresh=false;else if(h.exhaustedTurns>0)h.exhaustedTurns--;
  }

  if(heroOf(state,state.selected)?.hp<=0)state.selected=alive(state)[0].id;
  ensureEnemySelection(state);log(state,'第 '+state.round+' 回合 · 行动点 '+state.ap+'。','system');
  return {ok:true,events:stampEnemyEvents(state,events)};
}
