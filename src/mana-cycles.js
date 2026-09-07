// Pure mana/secondary-resource rules. This module deliberately does not import combat.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const stock=h=>Math.floor(clamp(h.secondary,0,6));
const owned=(state,id)=>(state.upgrades||[]).includes(id);
const otherActed=(state,h,skillId)=>state.challengeMode==='solo'||state.heroes?.length===1?h.used?.some(id=>id!==skillId):state.heroes?.some(a=>a.id!==h.id&&a.used?.length>0);

export const MANA_HERO_OVERRIDES={
  haart:{secondaryName:'念线',maxSecondary:6,tag:'魔力 · 念线 · 思维干扰',passiveName:'心智通路',passiveDesc:'先把魔力编成念线，最多保留 6 条，再拆解念线回魔。每次拆 1 条回 2 魔力，拆 3 条回 4，拆 6 条回 6。少量多次的回魔效率更高；大笔兑现会牺牲回魔效率，换取更强的干扰或协同效果。哈特通过削弱敌人的下一次进攻、提醒同伴抓住破绽来帮助队伍，不再负责群体治疗。魔力不会随回合自动恢复。',bio:'嫌麻烦的年轻院长，发起脾气时反而格外细心。他把念头编进书页，替同伴指出破绽，也让敌人突然忘记下一步该做什么。'},
  qianxing:{secondaryName:'银焱',maxSecondary:6,tag:'魔力 · 银焱 · 破甲钉锁',passiveName:'升格模组',passiveDesc:'先用魔力为战甲注入银焱，最多储存 6 份，再选择回收多少银焱来执行战术指令。回收 1 份返还 2 魔力，3 份返还 4，6 份返还 6。少量多次更省魔力，大量回收则以更低的回魔效率换取穿透火力和强控。钉刺负责装填，光束穿透抗性，脉冲剥除敌方强化；成长后还能钉锁非核心目标。魔力不会随回合自动恢复。'},
  patch:{secondaryName:'记录',maxSecondary:6,tag:'魔力 · 记录 · 观测与收录',passiveName:'费阿尼书记官',passiveDesc:'先支付魔力记录术式，最多保存 6 条，再销毁记录换回魔力。销毁 1 条回 2，3 条回 4，6 条回 6。钥刃切到观测，侧重物理进攻与暴露破绽；书阵切到收录，侧重驱散、净化与行动封锁。相同的记录，按姿态与数量有不同的兑现结果。受击和破盾都不会凭空生成记录或魔力。'}
};

export const MANA_SKILLS={
  haart:[
    {id:'page',name:'书页投射',sub:'THOUGHT THREAD',ap:1,cost:3,secondaryGain:2,kind:'magic',damage:24,hits:1,stagger:8,icon:'book',style:'rune',desc:'消耗 3 魔力，把书页上的术式编成 2 条念线，同时造成 24 魔法伤害，削韧 8。此次不返还魔力。念线最多 6 条，装不下时需要先兑现。',hint:'把魔力编成念线 · 基础魔法'},
    {id:'relay',name:'通路回响',sub:'LINKED ECHO',ap:1,secondaryCost:1,manaReturn:2,kind:'magic',damage:34,hits:1,stagger:10,icon:'twin',style:'rune',desc:'念线不足 3 条时，拆解 1 条，返还 2 魔力，造成 34 魔法伤害，削韧 10，消耗 1 行动点。持有至少 3 条时改为拆解 3 条、返还 4 魔力，以 2 行动点造成三段各 25 魔法伤害，削韧 24，并让敌人下一次行动的伤害降低 20%。',hint:'少量即用 · 三条念线干扰出招'},
    {id:'soothe',name:'心智安抚 · 压下杀意',sub:'QUIET IMPULSE',ap:1,secondaryCost:1,manaReturn:2,weaken:true,icon:'bind',style:'rune',desc:'固定拆解 1 条念线，返还 2 魔力，让敌人下一次行动的全部伤害降低 20%，消耗 1 行动点。即使有 6 条念线也只拆 1 条，保留少量多次、高回魔效率的路线。重复压制不会叠加减伤；这项技能保护同伴，但不恢复生命。',hint:'固定一条 · 高效回魔 · 压制下一次进攻'},
    {id:'rest',name:'收拢心神',sub:'RECOLLECT',ap:1,cost:3,secondaryGain:2,cleanse:1,once:true,icon:'wind',style:'guard',desc:'消耗 3 魔力，整理出 2 条念线，并为全队清除 1 层共鸣；每轮一次。魔力不够且没有念线时，这一槽会变为应急提炼：只花 1 行动点得到 1 条念线，没有净化或直接回魔。',hint:'转化念线 · 整理共鸣'},
    {id:'anchor',name:'心念锚定',sub:'MENTAL ANCHOR',ap:1,cost:2,secondaryGain:1,attackBuff:10,icon:'rune',style:'guard',desc:'消耗 2 魔力，建立 1 条念线，并为每位存活队员指出一次攻击机会：其下一项主动伤害技能的伤害提高 10%。每人各触发一次，未使用的提醒两轮后消失；重复提醒只保留较强的一次。',hint:'小额转化 · 提醒每人下一次攻击'},
    {id:'network',name:'心智协同 · 跟上我的思路',sub:'COORDINATED MIND',ap:2,secondaryCost:6,manaReturn:6,attackBuff:40,cleanse:2,unlockKey:'haart_network',icon:'twin',style:'rune',desc:'拆解 6 条念线，返还 6 魔力，并为全队清除 2 层共鸣。每位存活队员的下一项主动伤害技能提高 40% 伤害，每人各触发一次，未使用的增幅两轮后消失。消耗 2 行动点；不足 6 条时只能作小额逆向提炼，不能获得协同效果。',hint:'六条念线回转 · 全队各一次进攻增幅'},
    {id:'intercept',name:'精神截流',sub:'THOUGHT INTERCEPTION',ap:1,secondaryCost:3,manaReturn:4,weaken:true,stripBuffs:1,cooldown:2,unlockKey:'haart_intercept',icon:'bind',style:'rune',desc:'拆解 3 条念线，返还 4 魔力，以 1 行动点清除敌人 1 层可消除的强化，并让其下一次行动伤害降低 20%。持有 6 条时改为全部拆解、返还 6 魔力、消耗 2 行动点，清除 3 层强化，并封锁一次普通行动。封锁服从抗控，不能影响核心或终幕；冷却 2 轮。',hint:'截断敌方强化 · 六条念线封锁行动'}
  ],
  qianxing:[
    {id:'spike',name:'钉刺射击',sub:'METAL SPIKE',ap:1,cost:3,secondaryGain:2,kind:'physical',damage:28,hits:1,stagger:10,icon:'crosshair',style:'shot',desc:'消耗 3 魔力，向战甲注入 2 份银焱，同时射出钉刺，造成 28 物理伤害，削韧 10。此次不返还魔力；银焱最多 6 份。',hint:'装填银焱 · 物理钉刺'},
    {id:'beam',name:'聚焦光束',sub:'FOCUSED BEAM',ap:2,secondaryCost:3,manaReturn:4,kind:'magic',damage:84,hits:1,stagger:30,pierce:true,icon:'scope',style:'burst',desc:'回收 3 份银焱，返还 4 魔力，造成 84 魔法伤害，削韧 30，并无视魔法抗性。持有 6 份时改为全部回收、返还 6 魔力，造成 124 魔法伤害，削韧 40，并让敌人在两轮内受到的伤害增加 15%。两档都消耗 2 行动点。',hint:'银焱回收 · 穿透魔抗 · 满载暴露破绽'},
    {id:'armor',name:'钉刺护甲',sub:'SPIKED ARMOR',ap:1,cost:2,secondaryGain:1,shield:22,selfShield:true,reflect:1,icon:'shield',style:'guard',desc:'消耗 2 魔力，装填 1 份银焱，自身获得持续两轮的 22 点护盾和 1 次钉刺反击。受到物理攻击后回击 28 物理伤害，最多储存 2 次反击。护盾或反击都不会返还魔力。',hint:'小额装填 · 两轮自身防护 · 物理反击'},
    {id:'repair',name:'紧急修复',sub:'FIELD REPAIR',ap:1,cost:3,secondaryGain:2,heal:22,self:true,once:true,icon:'wind',style:'guard',desc:'消耗 3 魔力，修复自身 22 生命，同时从维修线路中储存 2 份银焱；每轮一次。魔力不够且没有银焱时，这一槽改为应急提炼：以 1 行动点只得到 1 份银焱，没有治疗或直接回魔。',hint:'维修并储能 · 每轮一次'},
    {id:'pulse',name:'脉冲射线',sub:'DISRUPTING PULSE',ap:1,secondaryCost:1,manaReturn:2,kind:'magic',damage:32,hits:1,stagger:10,stripBuffs:1,icon:'scope',style:'shot',desc:'固定回收 1 份银焱，返还 2 魔力，造成 32 魔法伤害，削韧 10，并清除敌人 1 层可消除的强化。只消耗 1 行动点，即使满载也保留这条小额拆解路线；它不会触发聚焦光束的高档消耗。',hint:'固定一份 · 低耗剥除敌方强化'},
    {id:'nova',name:'灭绝耀光',sub:'ANNIHILATING LIGHT',ap:3,secondaryCost:6,manaReturn:6,kind:'magic',damage:47,hits:3,stagger:42,pierce:true,unlockKey:'qianxing_nova',icon:'scatter',style:'burst',desc:'回收全部 6 份银焱，返还 6 魔力，以 3 行动点发射三束各 47 魔法伤害的银焱，削韧 42，并无视魔法抗性。三段命中可以拆除多层按命中计数的防护；不足 6 份时只能进行小额逆向提炼。',hint:'六份银焱 · 三段穿透火力'},
    {id:'lock',name:'解除协议 · 钉锁',sub:'RELEASE PROTOCOL',ap:2,secondaryCost:3,manaReturn:4,hardControl:true,stripBuffs:3,cooldown:2,unlockKey:'qianxing_lock',icon:'bind',style:'rune',desc:'回收 3 份银焱，返还 4 魔力，以 2 行动点清除敌人 3 层可消除的强化，并用战甲钉锁封锁其一次普通行动。封锁服从抗控，不能影响核心或终幕；冷却 2 轮。此技能没有直接伤害，适合用一轮火力换取处置危机的时间。',hint:'强控与驱散 · 放弃直接火力'}
  ],
  patch:[
    {id:'keyblade',name:'钥刃 · 观测',sub:'OBSERVATION',ap:1,cost:3,secondaryGain:2,kind:'physical',damage:26,hits:1,stagger:8,patchStance:'observe',icon:'blade',style:'slash',desc:'消耗 3 魔力，写下 2 条记录，造成 26 物理伤害，削韧 8，并切换到观测姿态。观测中的充能斩侧重物理进攻，时光碎屑会暴露敌方破绽。此次不返还魔力。',hint:'记录术式 · 切换观测'},
    {id:'bookward',name:'书阵 · 收录',sub:'ARCHIVE',ap:1,cost:3,secondaryGain:2,shield:20,selfShield:true,patchStance:'record',icon:'book',style:'guard',desc:'消耗 3 魔力，写下 2 条记录，自身获得持续两轮的 20 点护盾，并切换到收录姿态。收录中的兑现技能侧重驱散和净化；受击与护盾破裂不会额外生成记录或返还魔力。',hint:'记录术式 · 两轮护盾 · 切换收录'},
    {id:'chargedslash',name:'充能斩',sub:'CHARGED SLASH',ap:1,secondaryCost:1,manaReturn:2,kind:'physical',damage:34,hits:1,stagger:10,icon:'blade',style:'slash',desc:'销毁 1 条记录，返还 2 魔力，消耗 1 行动点。观测姿态造成 34 物理伤害、削韧 10；收录姿态造成 26 魔法伤害、削韧 8，并让敌人下一次行动的伤害降低 20%。持有至少 3 条时改为销毁 3 条、返还 4 魔力、消耗 2 行动点：观测造成两段各 32 物理伤害，收录造成 52 魔法伤害并额外驱散 1 层强化。',hint:'按姿态兑现 · 三条记录自动变招'},
    {id:'fragments',name:'时光碎屑',sub:'TIME FRAGMENTS',ap:2,secondaryCost:3,manaReturn:4,kind:'magic',damage:23,hits:3,stagger:24,icon:'twin',style:'rune',desc:'固定销毁 3 条记录，返还 4 魔力，以 2 行动点造成三段各 23 魔法伤害，削韧 24。观测姿态让敌人在两轮内受到的伤害增加 15%；收录姿态清除敌人 2 层可消除的强化。即使持有 6 条也只花 3 条，给另一项兑现技能留下余量。',hint:'固定三条 · 观测易伤 / 收录驱散'},
    {id:'collate',name:'整理档案',sub:'COLLATE',ap:1,secondaryCost:1,manaReturn:2,icon:'wind',style:'guard',desc:'有记录时，固定销毁 1 条记录，返还 2 魔力；观测姿态标记敌人，使本轮全队后续伤害增加 15%，收录姿态为全队清除 1 层共鸣。没有记录时改为消耗 3 魔力抄录 2 条；连 3 魔力也不足时只以 1 行动点应急抄录 1 条，不触发标记、净化或直接回魔。',hint:'固定小额回收 · 无记录时抄录'},
    {id:'revelation',name:'时之扉 · 启示',sub:'REVELATION',ap:3,secondaryCost:6,manaReturn:6,kind:'magic',damage:46,hits:3,stagger:40,pierce:true,unlockKey:'patch_revelation',icon:'crystal',style:'burst',desc:'销毁 6 条记录，返还 6 魔力，消耗 3 行动点。观测姿态造成三段各 46 魔法伤害、削韧 40，并无视魔法抗性；收录姿态改为三段各 31 魔法伤害、削韧 28，驱散 2 层强化并封锁一次普通行动。封锁服从抗控，不能影响核心或终幕；不足 6 条时只能小额逆向提炼。',hint:'六条记录 · 观测穿透 / 收录封锁'},
    {id:'injunction',name:'读秒禁令',sub:'COUNTDOWN INJUNCTION',ap:2,secondaryCost:3,manaReturn:4,hardControl:true,cooldown:3,unlockKey:'patch_injunction',icon:'bind',style:'rune',desc:'销毁 3 条记录，返还 4 魔力，以 2 行动点封锁敌人一次普通行动。观测姿态同时使其两轮内受到的伤害增加 15%；收录姿态额外驱散 2 层强化。没有直接伤害，冷却 3 轮；封锁服从抗控，不能影响核心或终幕。',hint:'三条记录 · 有冷却的行动封锁'}
  ]
};

export function manaHeroDefaults(heroId){return MANA_HERO_OVERRIDES[heroId]?{secondary:0,...(heroId==='patch'?{patchForm:'observe'}:{})}:{};}

function dropEffects(t){
  for(const key of ['kind','damage','hits','stagger','weaken','vulnerable','attackBuff','hardControl','stripBuffs','mark','cleanse','allCleanse','heal','allHeal','shield','allShield','selfShield','reflect','pierce','patchStance','cooldown','once','gain','self'])delete t[key];
}
function recoveryVariant(t,h,produce){
  dropEffects(t);
  Object.assign(t,{name:produce?'应急提炼 · '+MANA_HERO_OVERRIDES[h.id].secondaryName:'逆向提炼 · '+MANA_HERO_OVERRIDES[h.id].secondaryName,ap:1,cost:0,secondaryCost:produce?0:1,secondaryGain:produce?1:0,manaReturn:produce?0:2,manaEmergency:produce,manaRecovery:true,variant:produce?'mana_emergency':'mana_recovery',icon:'wind',style:'guard'});
  t.desc=produce?`魔力不足且没有${MANA_HERO_OVERRIDES[h.id].secondaryName}，当前只能花 1 行动点提炼 1 ${MANA_HERO_OVERRIDES[h.id].secondaryName}。此次没有原技能的战斗效果，也不直接返还魔力；之后还要另花行动点兑现。`:`库存不足以使用原技能，当前只能花 1 行动点，拆解 1 ${MANA_HERO_OVERRIDES[h.id].secondaryName}并返还 2 魔力，没有原技能的战斗效果。可以先转化更多魔力，再使用完整招式。`;
  return t;
}

/** Resolve all costs before payment. No state is mutated here. */
export function tuneManaSkill(state,h,base){
  const t={...base};if(!MANA_HERO_OVERRIDES[h.id])return t;
  // Defensive cleanup also prevents old manaRefund/gain properties from surviving an old skill object.
  t.cost=base.cost||0;t.secondaryCost=base.secondaryCost||0;t.secondaryGain=base.secondaryGain||0;t.manaReturn=base.manaReturn||0;delete t.gain;
  const n=stock(h),form=h.patchForm==='record'?'record':'observe',notes=[];
  if(h.id==='haart'){
    if(base.id==='relay'&&n>=3){Object.assign(t,{name:'通路回响 · 三重干扰',ap:2,secondaryCost:3,manaReturn:4,damage:25,hits:3,stagger:24,weaken:true,variant:'haart_interference'});notes.push('拆解 3 条念线，返还 4 魔力；三段魔法并削弱下一次进攻。');}
    if(base.id==='intercept'&&n>=6){Object.assign(t,{name:'精神截流 · 忘掉下一步',ap:2,secondaryCost:6,manaReturn:6,hardControl:true,stripBuffs:3,variant:'haart_sever'});notes.push('拆解 6 条念线，返还 6 魔力；驱散 3 层并封锁一次普通行动。');}
    if(owned(state,'haart_echo')&&base.id==='page'&&(state.boss?.weakened||state.boss?.vulnerable||state.boss?.vulnerableTurns)){Object.assign(t,{damage:18,hits:2,stagger:14});notes.push('护念回响：敌人心智松动，书页追加为两段各 18 魔法伤害，削韧 14。');}
    if(owned(state,'haart_triage')&&base.id==='soothe'&&otherActed(state,h,base.id)){t.stripBuffs=1;notes.push('通路接续：本轮已完成前置行动，额外驱散 1 层强化。');}
    if(owned(state,'haart_insight')&&base.id==='relay'&&n<3&&state.boss?.weakened){t.mark=true;notes.push('破绽提醒：小额回响击中已被压制的敌人，留下本轮标记。');}
  }
  if(h.id==='qianxing'){
    if(base.id==='beam'&&n>=6){Object.assign(t,{name:'聚焦光束 · 超临界',secondaryCost:6,manaReturn:6,damage:124,stagger:40,vulnerable:true,variant:'qianxing_critical'});notes.push('回收 6 份银焱，返还 6 魔力；伤害 124、削韧 40，并造成两轮易伤。');}
    if(owned(state,'qianxing_reinforce')&&base.id==='armor'&&h.used?.some(id=>['spike','beam','pulse','nova'].includes(id))){t.reflect=2;notes.push('协同装甲：本轮先开火再展开护甲，一次装填 2 次反击。');}
    if(owned(state,'qianxing_focus')&&base.id==='beam'&&h.shield>0){t.stripBuffs=n>=6?2:1;notes.push(`稳固聚焦：护甲稳定光束，额外驱散 ${t.stripBuffs} 层强化。`);}
    if(owned(state,'qianxing_grounding')&&base.id==='pulse'&&(state.boss?.charging||['charge','heat','waterLevel','prediction'].some(key=>state.boss?.[key]>=2))){t.weaken=true;notes.push('接地回路：脉冲抑制正在蓄能的敌人，使其下一次行动伤害降低 20%。');}
  }
  if(h.id==='patch'){
    if(base.id==='chargedslash'){
      if(form==='record')Object.assign(t,{name:'充能斩 · 镜反',kind:'magic',damage:26,stagger:8,weaken:true,style:'rune',variant:'patch_mirror'});
      if(n>=3){Object.assign(t,{name:form==='record'?'充能斩 · 反证':'充能斩 · 断光',ap:2,secondaryCost:3,manaReturn:4,damage:form==='record'?52:32,hits:form==='record'?1:2,stagger:form==='record'?18:24,variant:form==='record'?'patch_rebuttal':'patch_daybreak'});if(form==='record')t.stripBuffs=1;notes.push(`销毁 3 条记录，返还 4 魔力；${form==='record'?'魔法反证并驱散 1 层强化':'两段物理断光'}。`);}
    }
    if(base.id==='fragments'||base.id==='injunction'){if(form==='record')t.stripBuffs=2;else t.vulnerable=true;notes.push(form==='record'?'收录兑现：驱散敌方 2 层强化。':'观测兑现：让敌人在两轮内受到的伤害增加 15%。');}
    if(base.id==='revelation'&&form==='record'){Object.assign(t,{name:'时之扉 · 封存',damage:31,stagger:28,pierce:false,hardControl:true,stripBuffs:2,variant:'patch_archive_gate'});notes.push('收录兑现：三段各 31 魔法伤害，驱散 2 层强化并封锁一次普通行动。');}
    if(base.id==='collate'){
      const equipped=state.loadouts?.patch,onlyCopy=Array.isArray(equipped)&&!equipped.some(id=>['keyblade','bookward'].includes(id));
      if(n===0||(onlyCopy&&n<=4)){Object.assign(t,{name:onlyCopy?'整理档案 · 备用抄录':'整理档案 · 抄录',cost:3,secondaryGain:2,secondaryCost:0,manaReturn:0,manaCollateFallback:onlyCopy,desc:onlyCopy?'当前没有装配钥刃或书阵，整理档案承担抄录工作：记录不超过 4 条时，花 1 行动点、3 魔力抄录 2 条；达到 5 / 6 条后恢复小额回收。此次没有标记、净化或直接回魔。':'当前没有记录。花 1 行动点、3 魔力抄录 2 条记录；此次没有标记、净化或直接回魔。'});}
      else if(form==='record')t.cleanse=1;else t.mark=true;
    }
    if(owned(state,'patch_precision')&&t.secondaryCost>=3&&t.damage){t.stagger=(t.stagger||0)+6;notes.push('精确计时：兑现至少 3 条记录时，额外削韧 6。');}
    if(owned(state,'patch_archive')&&base.id==='bookward'){t.allCleanse=1;notes.push('厚页书阵：进入收录时为全队清除 1 层共鸣。');}
    if(owned(state,'patch_doubleentry')&&t.patchStance&&t.patchStance!==form&&h.resource>=5&&n<=3){t.cost=5;t.secondaryGain=3;notes.push('交叉索引：换姿态时投入 5 魔力，一次抄录 3 条；用更多魔力节省装填行动。');}
  }
  if(t.secondaryGain&&h.resource<t.cost&&n===0)return recoveryVariant(t,h,true);
  if(t.secondaryCost>n&&n>0)return recoveryVariant(t,h,false);
  if(notes.length){t.empowerReason=notes.join(' ');t.desc=`${notes.join(' ')} ${t.desc}`;t.variant||='mana_upgrade';}
  return t;
}

export function manaSkillError(state,h,s){
  if(!MANA_HERO_OVERRIDES[h.id])return null;
  const n=stock(h),name=MANA_HERO_OVERRIDES[h.id].secondaryName;
  if(s.cost>h.resource)return `魔力不足，需要 ${s.cost} 魔力来转化${name}`;
  if((s.secondaryCost||0)>n)return `${name}不足，需要 ${s.secondaryCost}；先使用转化技能`;
  if(n-(s.secondaryCost||0)+(s.secondaryGain||0)>6)return `${name}最多保留 6，当前放不下新增的 ${s.secondaryGain}；请先兑现`;
  if(s.manaEmergency&&(n!==0||h.resource>=(MANA_SKILLS[h.id].find(skill=>skill.id===s.id)?.cost||3)))return '只有魔力不足且二级资源为空时才能应急提炼';
  return null;
}

export function manaAfterSkill(h,s){return {resource:clamp(h.resource-(s.cost||0)+(s.manaReturn||0),0,h.maxResource||10),secondary:Math.floor(clamp(stock(h)-(s.secondaryCost||0)+(s.secondaryGain||0),0,6))};}

/** Only stance is a module-owned combat side effect; the caller commits payment once. */
export function applyManaSkill(state,h,s,events){if(h.id==='patch'&&s.patchStance)h.patchForm=s.patchStance;}

export function manaStatus(h){const info=MANA_HERO_OVERRIDES[h.id];if(!info)return '';return `${info.secondaryName} ${stock(h)} / 6${h.id==='patch'?` · ${h.patchForm==='record'?'收录':'观测'}`:''}。转化技能先支付魔力；兑现 1 / 3 / 6 份，分别返还 2 / 4 / 6 魔力。魔力与二级资源都不会随回合自动恢复。`;}
