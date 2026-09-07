// Pure mana/secondary-resource rules. Battle payment invokes the passive once per action.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number.isFinite(value)?value:0));
const owned=(state,id)=>(state.upgrades||[]).includes(id);
const otherActed=(state,h,skillId)=>state.challengeMode==='solo'||state.heroes?.length===1?h.used?.some(id=>id!==skillId):state.heroes?.some(a=>a.id!==h.id&&a.used?.length>0);

export const MANA_REFUND_TABLES={haart:[0,3,4,5,5],qianxing:[0,4,5,6],patch:{observe:2,record:3}};
export const MANA_HERO_OVERRIDES={
  haart:{secondaryName:'念线',maxSecondary:4,tag:'魔力 · 念线 · 心智布局',passiveName:'心智通路',passiveDesc:'念线最多保留 4 条。每次行动实际拆解念线后，心智通路只结算一次回魔：拆 1 / 2 / 3 / 4 条，分别恢复 3 / 4 / 5 / 5 魔力。书页以微弱攻击慢慢准备；展开心智领域则一次投入 8 魔力，花 2 行动点编好 4 条念线。小额拆解适合维持续航，大笔投入用于强力回响、全队协同或精神截流。多段命中不会多次回魔，超出魔力上限的部分会损失；魔力不会随回合自动恢复。',bio:'嫌麻烦的年轻院长，发起脾气时反而格外细心。他把念头编进书页，替同伴指出破绽，也让敌人突然忘记下一步该做什么。'},
  qianxing:{secondaryName:'充能',maxSecondary:3,tag:'魔力 · 充能 · 战甲爆发',passiveName:'反应炉回收',passiveDesc:'战甲最多储存 3 格充能。每次行动实际使用充能后，反应炉只回收一次魔力：用 1 / 2 / 3 格，分别恢复 4 / 5 / 6 魔力。钉刺花 3 魔力逐格装填，反应炉灌注花 2 行动点、9 魔力一次装满。单格脉冲或护甲更利于续航；两格光束与满载火力换取更强的单次输出。充能用于防护也会触发回收，反击与多段命中不会重复触发；魔力不会自动恢复。'},
  patch:{secondaryName:'记录',maxSecondary:10,tag:'魔力 · 记录 · 观测与收录',passiveName:'费阿尼书记官',passiveDesc:'记录最多保留 10 条。每次行动实际销毁记录后，书记官只回魔一次：观测姿态固定恢复 2 魔力，收录姿态固定恢复 3 魔力，与此次销毁的记录数量、命中次数无关。钥刃切换观测，书阵切换收录；批量抄录能一次花 8 魔力、2 行动点写下 6 条记录。逐条兑现的回魔效率最好；时之扉可一次烧掉 6—10 条记录，换取按库存增加的多段效果。受击、破盾与回合更替不会生成记录或魔力。'}
};

const stock=h=>Math.floor(clamp(h.secondary,0,MANA_HERO_OVERRIDES[h.id]?.maxSecondary||0));
const formOf=h=>h.patchForm==='record'?'record':'observe';
/** The caller passes the amount actually consumed, not a requested cost or hit count. */
export function manaRefundFor(h,spent){
  const n=Math.floor(clamp(spent,0,MANA_HERO_OVERRIDES[h.id]?.maxSecondary||0));
  if(!n)return 0;
  return h.id==='patch'?MANA_REFUND_TABLES.patch[formOf(h)]:(MANA_REFUND_TABLES[h.id]?.[n]||0);
}
export function manaPassiveDescription(h){return MANA_HERO_OVERRIDES[h.id]?.passiveDesc||'';}

export const MANA_SKILLS={
  haart:[
    {id:'page',name:'书页投射',sub:'THOUGHT THREAD',ap:1,cost:2,secondaryGain:1,kind:'magic',damage:8,hits:1,stagger:4,icon:'book',style:'rune',desc:'消耗 2 魔力与 1 行动点，将一页术式编成 1 条念线，同时造成 8 魔法伤害，削韧 4。攻击只是准备过程，主要收益是为后续的心智技能建立念线。',hint:'弱攻击 · 逐条编织念线'},
    {id:'relay',name:'通路回响',sub:'LINKED ECHO',ap:2,secondaryCost:2,kind:'magic',damage:40,hits:3,stagger:30,weaken:true,icon:'twin',style:'rune',desc:'消耗 2 条念线与 2 行动点，沿心智通路造成三段各 40 魔法伤害，削韧 30，并让敌人下一次行动的全部伤害降低 20%。拆解念线会触发心智通路被动；多段命中只结算一次回魔。',hint:'两条念线 · 三段进攻并压制敌人'},
    {id:'soothe',name:'心智安抚 · 压下杀意',sub:'QUIET IMPULSE',ap:1,secondaryCost:1,weaken:true,icon:'bind',style:'rune',desc:'消耗 1 条念线与 1 行动点，让敌人下一次行动的全部伤害降低 20%。即使念线已满也只拆 1 条，适合维持压制和被动回转。重复使用不会叠加减伤，也不恢复同伴生命。',hint:'固定一条 · 压制下一次进攻'},
    {id:'rest',name:'展开心智领域',sub:'OPEN MIND FIELD',ap:2,cost:8,secondaryGain:4,icon:'wind',style:'rune',desc:'消耗 8 魔力与 2 行动点，一次编好 4 条念线。需要空出全部念线容量，准备期间没有伤害、治疗或净化效果；适合在安全窗口提前为强力协同与连续施法作准备。',hint:'纯准备 · 大量魔力转化为四条念线'},
    {id:'anchor',name:'心念锚定',sub:'MENTAL ANCHOR',ap:1,secondaryCost:1,attackBuff:25,icon:'rune',style:'guard',desc:'消耗 1 条念线与 1 行动点，为每位存活队员指出一次攻击机会：其下一项主动伤害技能提高 25% 伤害。每人各触发一次，未使用的提醒两轮后消失；重复提醒只保留较强的一次。',hint:'固定一条 · 提醒每人下一次攻击'},
    {id:'network',name:'心智协同 · 跟上我的思路',sub:'COORDINATED MIND',ap:2,secondaryCost:4,attackBuff:60,cleanse:2,unlockKey:'haart_network',icon:'twin',style:'rune',desc:'消耗 4 条念线与 2 行动点，为全队清除 2 层共鸣。每位存活队员的下一项主动伤害技能提高 60% 伤害，每人各触发一次，未使用的增幅两轮后消失。满额投入换取更强的团队进攻窗口。',hint:'四条念线 · 全队各一次强力增幅'},
    {id:'intercept',name:'精神截流',sub:'THOUGHT INTERCEPTION',ap:2,secondaryCost:3,weaken:true,stripBuffs:2,hardControl:true,cooldown:2,unlockKey:'haart_intercept',icon:'bind',style:'rune',desc:'消耗 3 条念线与 2 行动点，清除敌人 2 层可消除的强化，封锁一次普通行动，并让下一次实际进攻的伤害降低 20%。冷却 2 轮；行动封锁服从抗控，不能影响核心或终幕。',hint:'三条念线 · 驱散、封锁并压制进攻'}
  ],
  qianxing:[
    {id:'spike',name:'钉刺射击',sub:'METAL SPIKE',ap:1,cost:3,secondaryGain:1,kind:'physical',damage:12,hits:1,stagger:4,icon:'crosshair',style:'shot',desc:'消耗 3 魔力与 1 行动点，为战甲装填 1 格充能，同时射出钉刺，造成 12 物理伤害，削韧 4。钉刺的基础火力较弱，需要通过后续的充能技能兑现准备收益。',hint:'弱攻击 · 逐格装填充能'},
    {id:'beam',name:'聚焦光束',sub:'FOCUSED BEAM',ap:2,secondaryCost:2,kind:'magic',damage:140,hits:1,stagger:40,pierce:true,icon:'scope',style:'burst',desc:'消耗 2 格充能与 2 行动点，造成 140 魔法伤害，削韧 40，并无视魔法抗性。持有 3 格充能时自动改为全部使用，造成 210 魔法伤害、削韧 56，并使敌人两轮内受到的伤害增加 15%。',hint:'两格穿透 · 满载三格强化光束'},
    {id:'armor',name:'钉刺护甲',sub:'SPIKED ARMOR',ap:1,secondaryCost:1,shield:36,selfShield:true,reflect:1,icon:'shield',style:'guard',desc:'消耗 1 格充能与 1 行动点，自身获得持续两轮的 36 点护盾和 1 次钉刺反击。受到物理攻击后回击 28 物理伤害，最多储存 2 次反击。展开护甲会触发反应炉回收，后续反击不会再次回魔。',hint:'单格防护 · 两轮自身护盾与反击'},
    {id:'repair',name:'反应炉灌注',sub:'REACTOR INFUSION',ap:2,cost:9,secondaryGain:3,icon:'wind',style:'guard',desc:'消耗 9 魔力与 2 行动点，一次为反应炉装满 3 格充能。需要充能槽为空，准备期间没有攻击、治疗或护盾；提前投入行动点，换取下一次满载射击的强力火力。',hint:'纯准备 · 大量魔力一次装满反应炉'},
    {id:'pulse',name:'脉冲射线',sub:'DISRUPTING PULSE',ap:1,secondaryCost:1,kind:'magic',damage:50,hits:1,stagger:14,stripBuffs:1,icon:'scope',style:'shot',desc:'固定消耗 1 格充能与 1 行动点，造成 50 魔法伤害，削韧 14，并清除敌人 1 层可消除的强化。即使满载也只用 1 格，适合反复剥除强化、保留充能与维持被动回转。',hint:'固定一格 · 剥除敌方强化'},
    {id:'nova',name:'灭绝耀光',sub:'ANNIHILATING LIGHT',ap:3,secondaryCost:3,kind:'magic',damage:86,hits:3,stagger:60,pierce:true,unlockKey:'qianxing_nova',icon:'scatter',style:'burst',desc:'消耗全部 3 格充能与 3 行动点，发射三束各 86 魔法伤害的银焱，削韧 60，并无视魔法抗性。三段命中可拆除多层按命中计数的防护；这次行动只触发一次反应炉回收。',hint:'三格充能 · 三段穿透火力'},
    {id:'lock',name:'解除协议 · 钉锁',sub:'RELEASE PROTOCOL',ap:2,secondaryCost:2,hardControl:true,stripBuffs:3,cooldown:2,unlockKey:'qianxing_lock',icon:'bind',style:'rune',desc:'消耗 2 格充能与 2 行动点，清除敌人 3 层可消除的强化，并用战甲钉锁封锁其一次普通行动。没有直接伤害，冷却 2 轮；封锁服从抗控，不能影响核心或终幕。',hint:'两格充能 · 强控与驱散'}
  ],
  patch:[
    {id:'keyblade',name:'钥刃 · 观测',sub:'OBSERVATION',ap:1,cost:1,secondaryGain:1,kind:'physical',damage:12,hits:1,stagger:4,patchStance:'observe',icon:'blade',style:'slash',desc:'消耗 1 魔力与 1 行动点，写下 1 条记录，造成 12 物理伤害，削韧 4，并切换到观测姿态。观测中的兑现侧重进攻；这次弱攻击主要用于切换姿态和准备记录。',hint:'弱攻击 · 一条记录 · 切换观测'},
    {id:'bookward',name:'书阵 · 收录',sub:'ARCHIVE',ap:1,cost:4,secondaryGain:3,shield:8,selfShield:true,patchStance:'record',icon:'book',style:'guard',desc:'消耗 4 魔力与 1 行动点，写下 3 条记录，自身获得持续两轮的 8 点护盾，并切换到收录姿态。书阵的保护较弱，主要用于成批准备记录；收录中的兑现侧重干扰与驱散。',hint:'薄层防护 · 三条记录 · 切换收录'},
    {id:'chargedslash',name:'充能斩',sub:'CHARGED SLASH',ap:1,secondaryCost:1,kind:'physical',damage:46,hits:1,stagger:14,icon:'blade',style:'slash',desc:'固定消耗 1 条记录与 1 行动点。观测姿态造成 46 物理伤害，削韧 14；收录姿态造成 38 魔法伤害，削韧 10，并让敌人下一次行动的伤害降低 20%。无论存了多少记录，都保留逐条兑现的高效回转路线。',hint:'固定一条 · 观测进攻 / 收录压制'},
    {id:'fragments',name:'时光碎屑',sub:'TIME FRAGMENTS',ap:2,secondaryCost:3,kind:'magic',damage:40,hits:3,stagger:30,icon:'twin',style:'rune',desc:'消耗 3 条记录与 2 行动点，造成三段各 40 魔法伤害，削韧 30。观测姿态使敌人两轮内受到的伤害增加 15%；收录姿态清除敌人 2 层可消除的强化。多段效果仍只触发一次书记官回魔。',hint:'三条记录 · 观测易伤 / 收录驱散'},
    {id:'collate',name:'批量抄录',sub:'BATCH TRANSCRIPTION',ap:2,cost:8,secondaryGain:6,icon:'wind',style:'guard',desc:'消耗 8 魔力与 2 行动点，一次抄录 6 条记录，保持当前姿态。需要至少 6 格空余容量，准备期间没有伤害、标记或净化效果；适合提前积累时之扉需要的大笔记录。',hint:'纯准备 · 一次写下六条记录'},
    {id:'revelation',name:'时之扉 · 启示',sub:'REVELATION',ap:3,secondaryCost:6,kind:'magic',damage:30,hits:6,stagger:24,pierce:true,unlockKey:'patch_revelation',icon:'crystal',style:'burst',desc:'消耗 3 行动点与全部记录，至少需要 6 条，最多使用 10 条。每条记录产生一段攻击：观测中每段 30 魔法伤害并穿透魔抗，每条削韧 4；收录中每段 22 魔法伤害、每条削韧 3，驱散 2 层强化，使用至少 8 条时还封锁一次普通行动。',hint:'六至十条全额兑现 · 库存越多段数越多'},
    {id:'injunction',name:'读秒禁令',sub:'COUNTDOWN INJUNCTION',ap:2,secondaryCost:4,hardControl:true,cooldown:3,unlockKey:'patch_injunction',icon:'bind',style:'rune',desc:'消耗 4 条记录与 2 行动点，封锁敌人一次普通行动。观测姿态同时使其两轮内受到的伤害增加 15%；收录姿态额外驱散 2 层强化。没有直接伤害，冷却 3 轮；封锁服从抗控，不能影响核心或终幕。',hint:'四条记录 · 有冷却的行动封锁'}
  ]
};

export function manaHeroDefaults(heroId){return MANA_HERO_OVERRIDES[heroId]?{secondary:0,...(heroId==='patch'?{patchForm:'observe'}:{})}:{};}
function equippedBases(state,h){
  const ids=state.loadouts?.[h.id];
  return Array.isArray(ids)?MANA_SKILLS[h.id].filter(s=>ids.includes(s.id)):MANA_SKILLS[h.id].filter(s=>!s.unlockKey);
}
function dropEffects(t){
  for(const key of ['kind','damage','hits','stagger','weaken','vulnerable','attackBuff','hardControl','stripBuffs','mark','cleanse','allCleanse','heal','allHeal','shield','allShield','selfShield','reflect','pierce','patchStance','cooldown','once','gain','self','empowerReason'])delete t[key];
}
function recoveryVariant(t,h,produce){
  dropEffects(t);
  const name=MANA_HERO_OVERRIDES[h.id].secondaryName;
  Object.assign(t,{name:produce?'应急提炼 · '+name:'逆向提炼 · '+name,ap:1,cost:0,secondaryCost:produce?0:1,secondaryGain:produce?1:0,manaEmergency:produce,manaRecovery:true,variant:produce?'mana_emergency':'mana_recovery',icon:'wind',style:'guard'});
  t.desc=produce?`当前装配没有可支付的转化技能，且${name}为空。花 1 行动点应急提炼 1 份${name}；此次没有原技能的战斗效果，也不直接回魔。之后还要另花行动点兑现，才能触发角色回转被动。`:`库存不足以使用原技能，只能花 1 行动点拆解 1 份${name}，触发角色回转被动。此次没有原技能的伤害、增益、净化、驱散或控制效果；先准备更多资源才能使用完整招式。`;
  t.manaReturn=produce?0:manaRefundFor(h,1);
  return t;
}

// A five-slot build can remove both ordinary builders. One utility slot then maintains conversion access.
function backupConversion(state,h,t){
  const normal=h.id==='haart'?['page','rest']:h.id==='qianxing'?['spike','repair']:null;
  const slot=h.id==='haart'?'anchor':'armor';
  if(!normal||t.id!==slot||equippedBases(state,h).some(s=>normal.includes(s.id))||stock(h)>=MANA_HERO_OVERRIDES[h.id].maxSecondary)return;
  const bulk=h.id==='haart'?{cost:8,secondaryGain:4}:{cost:9,secondaryGain:3};
  const useBulk=stock(h)===0&&h.resource>=bulk.cost;
  dropEffects(t);
  Object.assign(t,{name:h.id==='haart'?'心念锚定 · 备用编织':'钉刺护甲 · 备用充能',ap:useBulk?2:1,cost:useBulk?bulk.cost:(h.id==='haart'?2:3),secondaryGain:useBulk?bulk.secondaryGain:1,secondaryCost:0,manaBackup:true,variant:'mana_backup',icon:'wind',style:'guard'});
  t.desc=`当前没有装配常规转化技能，这一槽暂时负责准备${MANA_HERO_OVERRIDES[h.id].secondaryName}：花 ${t.ap} 行动点、${t.cost} 魔力，生成 ${t.secondaryGain} 份。库存装满后恢复原来的兑现效果；准备期间不提供护盾、反击或攻击增幅。`;
}

function resolveTactical(state,h,base){
  const t={...base,cost:base.cost||0,secondaryCost:base.secondaryCost||0,secondaryGain:base.secondaryGain||0};
  delete t.gain;delete t.manaReturn;delete t.manaRefund;
  const n=stock(h),form=formOf(h),notes=[];
  if(h.id==='haart'){
    if(owned(state,'haart_echo')&&base.id==='page'&&(state.boss?.weakened||state.boss?.vulnerable||state.boss?.vulnerableTurns)){Object.assign(t,{damage:6,hits:2,stagger:6});notes.push('护念回响：敌人心智松动，书页变为两段各 6 魔法伤害，削韧 6；仍以准备念线为主。');}
    if(owned(state,'haart_triage')&&base.id==='soothe'&&otherActed(state,h,base.id)){t.stripBuffs=1;notes.push('通路接续：本轮已完成前置行动，额外驱散 1 层强化。');}
    if(owned(state,'haart_insight')&&base.id==='relay'&&state.boss?.weakened){t.mark=true;notes.push('破绽提醒：回响击中已经被压制的敌人，留下本轮标记，使全队后续伤害提高 15%。');}
  }
  if(h.id==='qianxing'){
    if(base.id==='beam'&&n>=3){Object.assign(t,{name:'聚焦光束 · 超临界',secondaryCost:3,damage:210,stagger:56,vulnerable:true,variant:'qianxing_critical'});notes.push('满载射击：消耗 3 格充能，伤害 210、削韧 56，并造成两轮易伤。');}
    if(owned(state,'qianxing_reinforce')&&base.id==='armor'&&h.used?.some(id=>['spike','beam','pulse','nova'].includes(id))){t.reflect=2;notes.push('协同装甲：本轮先开火再展开护甲，一次获得 2 次反击。');}
    if(owned(state,'qianxing_focus')&&base.id==='beam'&&h.shield>0){t.stripBuffs=n>=3?2:1;notes.push(`稳固聚焦：护甲稳定光束，额外驱散 ${t.stripBuffs} 层强化。`);}
    if(owned(state,'qianxing_grounding')&&base.id==='pulse'&&(state.boss?.charging||['charge','heat','waterLevel','prediction'].some(key=>state.boss?.[key]>=2))){t.weaken=true;notes.push('接地回路：脉冲抑制正在蓄能的敌人，使其下一次行动伤害降低 20%。');}
  }
  if(h.id==='patch'){
    if(base.id==='chargedslash'&&form==='record'){
      Object.assign(t,{name:'充能斩 · 镜反',kind:'magic',damage:38,stagger:10,weaken:true,style:'rune',variant:'patch_mirror'});
      notes.push('收录变招：仍只消耗 1 条记录，改为 38 魔法伤害、削韧 10，并压制敌人下一次进攻。');
    }
    if(base.id==='fragments'||base.id==='injunction'){if(form==='record')t.stripBuffs=2;else t.vulnerable=true;notes.push(form==='record'?'收录兑现：驱散敌方 2 层强化。':'观测兑现：让敌人在两轮内受到的伤害增加 15%。');}
    if(base.id==='revelation'&&n>=6){
      Object.assign(t,{secondaryCost:n,hits:n,damage:form==='record'?22:30,stagger:n*(form==='record'?3:4),pierce:form!=='record',name:form==='record'?'时之扉 · 封存':'时之扉 · 启示',variant:form==='record'?'patch_archive_gate':'patch_observation_gate'});
      if(form==='record'){t.stripBuffs=2;if(n>=8)t.hardControl=true;}
      notes.push(`此次销毁全部 ${n} 条记录，产生 ${n} 段各 ${t.damage} 魔法伤害，削韧 ${t.stagger}。${form==='record'?(n>=8?'收录满额：驱散 2 层并封锁一次普通行动。':'收录：驱散 2 层，至少 8 条记录才有行动封锁。'):'观测：每段均穿透魔法抗性。'}`);
    }
    if(owned(state,'patch_precision')&&t.secondaryCost>=3&&t.damage){t.stagger=(t.stagger||0)+6;notes.push('精确计时：兑现至少 3 条记录时，额外削韧 6。');}
    if(owned(state,'patch_archive')&&base.id==='bookward'){t.allCleanse=1;notes.push('厚页书阵：进入收录时为全队清除 1 层共鸣。');}
    if(owned(state,'patch_doubleentry')&&base.id==='bookward'&&form==='observe'){t.cost=Math.max(1,t.cost-1);notes.push('交叉索引：本次由观测切入收录，书阵费用减少 1 魔力；记录数量与回转被动不变。');}
  }
  if(notes.length){t.empowerReason=notes.join(' ');t.desc=`${notes.join(' ')} ${t.desc}`;t.variant||='mana_upgrade';}
  backupConversion(state,h,t);
  return t;
}
function hasPaidConversion(state,h){
  return equippedBases(state,h).some(base=>{
    const s=resolveTactical(state,h,base);
    return s.secondaryGain>0&&s.cost>0&&s.cost<=h.resource&&stock(h)+s.secondaryGain<=MANA_HERO_OVERRIDES[h.id].maxSecondary;
  });
}

/** Resolve display costs without mutating battle. manaReturn is a preview of the passive, never skill data. */
export function tuneManaSkill(state,h,base){
  if(!MANA_HERO_OVERRIDES[h.id])return {...base};
  const t=resolveTactical(state,h,base),n=stock(h);
  if(t.secondaryGain&&h.resource<t.cost&&n===0&&!hasPaidConversion(state,h))return recoveryVariant(t,h,true);
  if(t.secondaryCost>n&&n>0)return recoveryVariant(t,h,false);
  t.manaReturn=manaRefundFor(h,Math.min(n,t.secondaryCost));
  return t;
}
export function manaSkillError(state,h,s){
  const info=MANA_HERO_OVERRIDES[h.id];if(!info)return null;
  const n=stock(h);
  if(s.cost>h.resource)return `魔力不足，需要 ${s.cost} 魔力来转化${info.secondaryName}`;
  if((s.secondaryCost||0)>n)return `${info.secondaryName}不足，需要 ${s.secondaryCost}；先使用转化技能`;
  if(n-(s.secondaryCost||0)+(s.secondaryGain||0)>info.maxSecondary)return `${info.secondaryName}最多保留 ${info.maxSecondary}，当前放不下新增的 ${s.secondaryGain}；请先兑现`;
  if(s.manaEmergency&&(n!==0||hasPaidConversion(state,h)))return '只有二级资源为空，且当前装配没有可支付的转化技能时才能应急提炼';
  return null;
}
export function manaAfterSkill(h,s){
  const actualSpent=Math.min(stock(h),Math.max(0,Math.floor(s.secondaryCost||0)));
  return {resource:clamp(h.resource-(s.cost||0)+manaRefundFor(h,actualSpent),0,h.maxResource||10),secondary:Math.floor(clamp(stock(h)-actualSpent+(s.secondaryGain||0),0,MANA_HERO_OVERRIDES[h.id]?.maxSecondary||0))};
}
/** Only stance is a module-owned combat side effect; the caller commits payment once. */
export function applyManaSkill(state,h,s,events){if(h.id==='patch'&&s.patchStance)h.patchForm=s.patchStance;}
export function manaStatus(h){
  const info=MANA_HERO_OVERRIDES[h.id];if(!info)return '';
  const rule=h.id==='haart'?'每次拆 1 / 2 / 3 / 4 条，回魔 3 / 4 / 5 / 5':h.id==='qianxing'?'每次用 1 / 2 / 3 格，回魔 4 / 5 / 6':`${formOf(h)==='record'?'收录':'观测'}中每次销毁记录固定回 ${manaRefundFor(h,1)} 魔力，与数量、段数无关`;
  return `${info.secondaryName} ${stock(h)} / ${info.maxSecondary}${h.id==='patch'?` · ${formOf(h)==='record'?'收录':'观测'}`:''}。${info.passiveName}：${rule}。先花行动点准备，再兑现技能；魔力和二级资源都不会随回合自动恢复。`;
}
