// Demo adaptation of the supplied character sheets. Extra counters are conditions,
// never a second payment pool: every action still pays AP and one of four resources.
export const NEW_HEROES=[
 {id:'youmu',name:'游木 / 游墓',short:'游木',role:'外科医生 · 沉渊船长',tag:'气息 · 手术 · 双人格',color:'#8dd4b4',maxHp:165,maxResource:10,resourceName:'气息',passiveName:'医者与船长',passiveDesc:'手术刀开启切除，切除敌方护层后可移植为队伍防护。生命不高于 40% 时，每战可交由游墓接管一次，持续两轮；结束后虚脱两轮。气息每轮回复 2。',quote:'先别动，我能处理。',bio:'游木是认真而热血的年轻医生；寄宿其中的游墓博学、痴迷标本。救人的手术与船长的冒险共用一具身体。'},
 {id:'patch',name:'补丁Z',short:'补丁Z',role:'时座书记官',tag:'魔力 · 形态 · 记录强化',color:'#edc67e',maxHp:165,maxResource:10,resourceName:'魔力',passiveName:'费阿尼书记官',passiveDesc:'每支付 2 魔力积累 1 条记录，最多 6。记录达到 3 / 6 时自动强化充能斩或时光碎屑；强化消耗记录，技能仍支付魔力与行动点。钥刃选择观测，书阵选择收录。',quote:'条款我看过了。你漏了一行。',bio:'表面老实的侦探与秘法商人，擅长抓住漏洞。以计时装置协助记录法术，准备充分后集中兑现。'}
];
export const NEW_SKILLS={
 youmu:[
  {id:'scalpel',name:'手术刀',sub:'SCALPEL',ap:1,kind:'physical',damage:30,hits:1,stagger:8,gain:1,surgicalSetup:true,icon:'blade',style:'slash',desc:'30 物理伤害、削韧 8，回复 1 气息；开启切除手术。',hint:'外科准备 · 回复气息'},
  {id:'surgery',name:'切除手术',sub:'EXCISION',ap:2,cost:4,kind:'physical',damage:38,hits:1,stagger:22,surgery:true,icon:'blades',style:'slash',desc:'需先使用手术刀。38 物理伤害、削韧 22，最多切除 2 层可转移护层并保存标本；之后此槽变为移植手术。无护层时改为 58 伤害、削韧 30。',hint:'先准备 · 切除护层 · 同槽变招'},
  {id:'firstaid',name:'战地急救',sub:'FIELD TRIAGE',ap:2,cost:4,heal:48,allHeal:12,cleanse:2,icon:'heal',style:'rune',desc:'消耗 4 气息，最低生命比例队员回复 48，其余人回复 12，净化全队 2 层共鸣。',hint:'队伍恢复 · 净化'},
  {id:'bloodoath',name:'血誓 · 请船长上场',sub:'BLOOD OATH',ap:1,cost:2,transform:true,shield:24,selfShield:true,icon:'crystal',style:'guard',desc:'生命不高于 40% 时可用，每战一次。游墓接管两轮，获得 24 护盾，承伤减少 35%，五个技能换为船长技能；退出后两轮输出 −20%、承伤 +20%。',hint:'低血高亮 · 每战一次 · 双形态'},
  {id:'sterilize',name:'清创整备',sub:'STERILIZE',ap:1,gain:4,heal:18,self:true,once:true,icon:'wind',style:'guard',desc:'回复 4 气息与自身 18 生命，每轮一次。',hint:'回复气息 · 外科整备'},
  {id:'suture',name:'精密缝合',sub:'SUTURE',ap:2,cost:4,heal:62,allHeal:16,cleanse:2,unlockKey:'youmu_suture',icon:'heal',style:'rune',desc:'回复最低生命比例队员 62、其余人 16，净化 2 层共鸣。',hint:'成长技能 · 强化救治'}
 ],
 patch:[
  {id:'keyblade',name:'钥刃 · 观测',sub:'OBSERVATION',ap:1,cost:3,kind:'physical',damage:27,hits:1,stagger:8,patchStance:'observe',icon:'blade',style:'slash',desc:'先支付 3 魔力，造成 27 物理伤害、削韧 8，进入观测；成功后返还 2 魔力。观测中每轮第一次攻击额外回复 1 魔力。',hint:'攻击姿态 · 记录积累'},
  {id:'bookward',name:'书阵 · 收录',sub:'ARCHIVE',ap:2,cost:5,shield:32,selfShield:true,patchStance:'record',patchWard:true,icon:'book',style:'guard',desc:'先支付 5 魔力，自身获得 32 护盾并进入收录，成功后返还 2。收录每轮首次受击增加 1 记录；书阵的护盾被敌方击破时回魔 2 并回击一次。',hint:'防护姿态 · 受击记录 · 破盾回击'},
  {id:'chargedslash',name:'充能斩',sub:'CHARGED SLASH',ap:1,cost:2,kind:'physical',damage:30,hits:1,stagger:10,icon:'blade',style:'slash',desc:'先支付 2 魔力，30 物理伤害、削韧 10，成功后返还 2。已有 3 记录时自动消费 3：观测变为断光，收录变为镜反。',hint:'3 记录自动变招 · 仍支付魔力'},
  {id:'fragments',name:'时光碎屑',sub:'TIME FRAGMENTS',ap:2,cost:6,kind:'magic',damage:27,hits:2,stagger:20,icon:'twin',style:'rune',desc:'先支付 6 魔力，2 × 27 魔法伤害、削韧 20，成功后返还 2。已有 3 / 6 记录时自动消费相应记录，强化为裂片 / 断面。',hint:'魔法爆发 · 条件进阶'},
  {id:'collate',name:'整理档案',sub:'COLLATE',ap:1,gain:4,heal:12,self:true,once:true,icon:'wind',style:'guard',desc:'回复 4 魔力与自身 12 生命，每轮一次；不生成记录。',hint:'主动回魔 · 每轮一次'},
  {id:'revelation',name:'时之扉 · 启示',sub:'REVELATION',ap:3,cost:8,kind:'magic',damage:35,hits:3,stagger:32,unlockKey:'patch_revelation',icon:'crystal',style:'burst',desc:'先支付 8 魔力，3 × 35 魔法伤害、削韧 32，成功后返还 2。6 记录时自动消耗 6，强化为 3 × 49、削韧 44；不增加行动点或跳过敌方回合。',hint:'成长终结技 · 有界爆发'}
 ]
};
export const CAPTAIN_SKILLS={
 scalpel:{name:'铁血弯刀',kind:'physical',damage:42,hits:1,stagger:12,gain:1,ap:1,cost:0,surgicalSetup:false,icon:'blade',style:'slash',desc:'42 物理伤害、削韧 12，回复 1 气息。'},
 surgery:{name:'船长威严',kind:'magic',damage:28,hits:1,stagger:12,ap:1,cost:3,surgery:false,weaken:true,icon:'rune',style:'rune',desc:'消耗 3 气息，28 魔法伤害、削韧 12；敌人下一次行动的全部伤害降低 20%。'},
 firstaid:{name:'枪弹盛宴',kind:'physical',damage:29,hits:3,stagger:28,ap:2,cost:4,heal:0,allHeal:0,cleanse:0,icon:'scatter',style:'shot',desc:'消耗 4 气息，3 × 29 物理伤害、削韧 28。'},
 bloodoath:{name:'沉渊炼狱号',kind:'magic',damage:48,hits:3,stagger:38,ap:3,cost:6,transform:false,shield:0,selfShield:false,captainFinish:true,icon:'crystal',style:'burst',desc:'消耗 6 气息，3 × 48 魔法伤害、削韧 38；炮击后立即退出船长状态并虚脱两轮。'},
 sterilize:{name:'死海整帆',ap:1,cost:0,gain:3,heal:0,shield:24,selfShield:true,once:true,icon:'shield',style:'guard',desc:'回复 3 气息、获得 24 护盾，每轮一次。'},
 suture:{name:'深海炮列',kind:'magic',damage:35,hits:3,stagger:30,heal:0,allHeal:0,cleanse:0,ap:2,cost:5,icon:'scatter',style:'burst',desc:'消耗 5 气息，3 × 35 魔法伤害、削韧 30。'}
};
export const TRANSFERABLE_LAYERS={duelist:'mirror',cantor:'spores',warden:'charge',weaver:'seals',final:'seals',golem:'fog'};
export const SPECIMEN_NAMES={mirror:'镜片',spores:'孢压',charge:'蓄电',seals:'封页',fog:'迷雾'};
