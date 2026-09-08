// Demo adaptation of the supplied character sheets. Mana characters additionally
// convert their primary resource into a character-specific secondary resource.
export const NEW_HEROES=[
 {id:'youmu',name:'游木 / 游墓',short:'游木',role:'外科医生 · 沉渊船长',tag:'气息 · 手术 · 双人格',color:'#8dd4b4',maxHp:165,maxResource:10,resourceName:'气息',passiveName:'医者与船长',passiveDesc:'手术刀开启切除，切除留下两轮创口并可取走敌方护层。血誓主动献血至 40% 生命，使游墓接管并嘲讽两轮，每战一次；结束后虚脱两轮。急救立即救起一个队员，缝合则在之后两轮恢复。气息每轮回复 2。',quote:'先别动，我能处理。',bio:'游木是认真而热血的年轻医生；寄宿其中的游墓博学、痴迷标本。救人的手术与船长的冒险共用一具身体。'},
 {id:'patch',name:'补丁Z',short:'补丁Z',role:'时座书记官',tag:'魔力 · 形态 · 记录强化',color:'#edc67e',maxHp:165,maxResource:10,resourceName:'魔力',passiveName:'费阿尼书记官',passiveDesc:'魔力记录为术式，销毁不同数量的记录返还不同数量的魔力；观测和收录拥有不同的兑现效果。',quote:'条款我看过了。你漏了一行。',bio:'表面老实的侦探与秘法商人，擅长抓住漏洞。以计时装置协助记录法术，准备充分后集中兑现。'}
];
export const NEW_SKILLS={
 youmu:[
  {id:'scalpel',name:'手术刀',sub:'SCALPEL',ap:1,kind:'physical',damage:30,hits:1,stagger:8,gain:1,surgicalSetup:true,icon:'blade',style:'slash',desc:'30 物理伤害、削韧 8，回复 1 气息；开启切除手术。',hint:'外科准备 · 回复气息'},
  {id:'surgery',name:'切除手术',sub:'EXCISION',ap:2,cost:4,kind:'physical',damage:38,hits:1,stagger:22,surgery:true,dotDamage:8,icon:'blades',style:'slash',desc:'需先使用手术刀。38 物理伤害、削韧 22，最多切除 2 层可转移护层并保存标本；之后此槽变为移植手术。无护层时改为 58 伤害、削韧 30。手术留下两轮创口，每次敌人行动后造成 8 物理伤害；不叠加，不拆层，不计核心命中。',hint:'先准备 · 切除护层 · 同槽变招'},
  {id:'firstaid',name:'战地急救',sub:'FIELD TRIAGE',ap:2,cost:4,heal:48,revive:30,targetCleanse:2,icon:'heal',style:'rune',desc:'消耗 4 气息，立即为最低生命比例队员恢复 48 生命，并清除其 2 层共鸣。若有人倒下，优先救起一名倒地队员并恢复 30 生命。只处理一个目标，不治疗全队。',hint:'单体即时抢救 · 可救起倒地同伴'},
  {id:'bloodoath',name:'血誓 · 请船长上场',sub:'BLOOD OATH',ap:1,cost:2,transform:true,shield:24,selfShield:true,icon:'crystal',style:'guard',desc:'消耗 2 气息，主动献血使自身生命降至 40%；已经不高于 40% 时不再扣血。游墓接管并嘲讽两轮：单体主招优先攻击自己，承伤减少 35%，获得 24 护盾并切换为船长技能。每场一次；退出后虚脱两轮，伤害降低 20%、承伤增加 20%。',hint:'主动献血 · 嘲讽 · 双形态'},
  {id:'sterilize',name:'清创整备',sub:'STERILIZE',ap:1,gain:4,heal:18,self:true,once:true,fieldCare:35,icon:'wind',style:'guard',desc:'回复4气息与自身18生命，准备切除并令选中敌人两轮内治疗减半。本轮第一次受伤后，若仍存活，自动包扎回复35生命。每轮一次，包扎不能阻止致死伤害。',hint:'回复气息 · 外科整备'},
  {id:'suture',name:'精密缝合',sub:'SUTURE',ap:2,cost:3,regenTurns:2,regenAmount:32,unlockKey:'youmu_suture',icon:'heal',style:'rune',desc:'消耗 3 气息，为最低生命比例的存活队员缝合伤口。在接下来的两次回合末各回复 32 生命，不提供即时治疗、不能复活，也不叠加持续恢复。需要先保证伤员能撑过敌人的攻击。',hint:'延迟恢复 · 节省气息 · 无即时治疗'}
 ],

};
export const CAPTAIN_SKILLS={
 scalpel:{name:'铁血弯刀',kind:'physical',damage:42,hits:1,stagger:12,gain:1,ap:1,cost:0,surgicalSetup:false,icon:'blade',style:'slash',desc:'42 物理伤害、削韧 12，回复 1 气息。'},
 surgery:{name:'船长威严',kind:'magic',damage:28,hits:1,stagger:12,ap:1,cost:3,surgery:false,dotDamage:0,weaken:true,icon:'rune',style:'rune',desc:'消耗 3 气息，28 魔法伤害、削韧 12；敌人下一次行动的全部伤害降低 20%。'},
 firstaid:{name:'枪弹盛宴',kind:'physical',targeting:'all',damage:18,hits:3,stagger:20,ap:2,cost:4,heal:0,allHeal:0,cleanse:0,revive:0,targetCleanse:0,icon:'scatter',style:'shot',desc:'消耗4气息与2行动点，对全部敌人各造成3段18物理伤害，每敌削韧20，资源只支付一次。'},
 bloodoath:{name:'沉渊炼狱号',kind:'magic',damage:48,hits:3,stagger:38,ap:3,cost:6,transform:false,shield:0,selfShield:false,captainFinish:true,icon:'crystal',style:'burst',desc:'消耗 6 气息，3 × 48 魔法伤害、削韧 38；炮击后立即退出船长状态并虚脱两轮。'},
 sterilize:{name:'死海整帆',ap:1,cost:0,gain:3,heal:0,shield:0,selfShield:false,fieldCare:0,protection:0,selfProtection:false,selfAttackBuff:30,once:true,icon:'shield',style:'guard',desc:'回复3气息，接下来的主动攻击伤害提高30%，两轮内使用有效。每轮一次。'},
 suture:{name:'深海炮列',kind:'magic',damage:35,hits:3,stagger:30,heal:0,allHeal:0,cleanse:0,regenTurns:0,regenAmount:0,ap:2,cost:5,icon:'scatter',style:'burst',desc:'消耗 5 气息，3 × 35 魔法伤害、削韧 30。'}
};
export const TRANSFERABLE_LAYERS={duelist:'mirror',cantor:'spores',warden:'charge',weaver:'seals',final:'seals',golem:'fog'};
export const SPECIMEN_NAMES={mirror:'镜片',spores:'孢压',charge:'蓄电',seals:'封页',fog:'迷雾'};
