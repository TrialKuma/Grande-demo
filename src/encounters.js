export const BOSSES = {
  golem: {id:'golem',name:'魔晶巨人',subtitle:'CRYSTAL COLOSSUS',region:'博洛伦 · 雾蚀遗迹',brief:'击碎逐层解体的岩铠，再以物理与魔法净化暴露的核心。',mechanic:'延迟地裂 · 共鸣驱散 · 双系核心',color:'#80d9df',icon:'crystal',hpMultiplier:1},
  duelist: {id:'duelist',name:'折镜刃卫',subtitle:'MIRROR SENTINEL',region:'博洛伦 · 折镜回廊',brief:'遗迹机械剑士借镜片折返攻击。拆镜、拆招，或承受刀锋换取反击窗口。',mechanic:'镜甲减伤 · 魔法拆镜 · 折镜反击',color:'#69d8e2',icon:'blades',hpMultiplier:1.2},
  cantor: {id:'cantor',name:'孢冠司祭',subtitle:'SPORE-CROWN CANTOR',region:'博洛伦 · 紫雾圣所',brief:'菌丝托举着无人的面具。物理连击剥离孢冠，魔法趁裸露时终结祷告。',mechanic:'孢压增伤 · 物理剥孢 · 裸冠魔法易伤',color:'#cf9eea',icon:'rune',hpMultiplier:1.15},
  warden: {id:'warden',name:'雷脊守卫',subtitle:'THUNDERSPINE WARDEN',region:'博洛伦 · 风暴栈桥',brief:'嵌入背脊的避雷针积蓄风暴。物理连击先手泄能，护盾挡住电涌；选择招架还能引走余电。',mechanic:'蓄电增伤 · 物理泄能 · 招架接地',color:'#edc35c',icon:'quake',hpMultiplier:1.38},
  weaver: {id:'weaver',name:'缄页织者',subtitle:'SILENT-PAGE WEAVER',region:'博洛伦 · 缄默书庭',brief:'它将战斗写进封页。每轮交替封存物理与魔法，用另一系逐层拆封，才能保持资源与节奏。',mechanic:'交替封页 · 异系拆封 · 封缄抽取资源',color:'#dd9fc7',icon:'book',hpMultiplier:1.42},
  tide: {id:'tide',name:'水闸监守',subtitle:'FLOODGATE KEEPER',region:'博洛伦 · 下层水闸',scene:'floodworks',brief:'监守靠高水位推动重锚。任意属性累计三次命中即可打开一轮排水阀，降低下一次浪涌；招架也能排水。',mechanic:'水位压迫 · 三击排水 · 浪涌清空',color:'#61c8d4',icon:'wind',hpMultiplier:1.34},
  furnace: {id:'furnace',name:'熔炉搬运者',subtitle:'FURNACE CARRIER',region:'博洛伦 · 废热铸造间',scene:'foundry',brief:'背负熔炉的搬运者在排汽后打开炉门。抓住敞口连续命中，可以泄热并放大伤害；在落锤前决定是否抢攻。',mechanic:'炉热增伤 · 排汽开炉 · 敞口泄热',color:'#e5a66d',icon:'hammer',hpMultiplier:1.46},
  orrery: {id:'orrery',name:'星轨测绘仪',subtitle:'ORBITAL CARTOGRAPHER',region:'博洛伦 · 星轨观测台',scene:'observatory',brief:'测绘仪会记录上一项攻击技能。连续重复会提高锁定；换一项攻击即可打乱预测，降低贯星与轨道坍缩的伤害。',mechanic:'重复锁定 · 换招解算 · 轨道坍缩',color:'#a7a4ed',icon:'target',hpMultiplier:1.52},
  arbiter: {id:'arbiter',name:'缄令执行官',subtitle:'SILENT ARBITER',region:'博洛伦 · 缄令档案库',scene:'archive',brief:'执行官交替宣布轻击令与重击令。违令的攻击会提高本轮判罚；可以顺从节奏，也可以用护盾承担判罚换取爆发。',mechanic:'轻重击令 · 违令判罚 · 战术减责',color:'#d6be87',icon:'book',hpMultiplier:1.62},
  final: {id:'final',name:'归零之核',subtitle:'THE ZERO HEART',region:'博洛伦 · 归零天井',brief:'核心即将切断避难室的供气。交替攻击拆开屏障；最后以双系命中接入停机指令，并准备应对抵住最后一次放电。',mechanic:'双系同步 · 归零屏障 · 终幕双系与应对',color:'#f4e6bd',icon:'crystal',hpMultiplier:1.85}
};
export const BOSS_INTENTS = {
  golem:['slam','fog','missiles','compression','reclaim'],duelist:['rend','mirror','pierce','duel'],cantor:['sow','drain','bloom','weave'],
  warden:['arc','ground','storm','charge'],weaver:['script','silence','rewrite','sever'],
  tide:['tide_hook','tide_fill','tide_breaker','tide_release'],furnace:['furnace_lift','furnace_vent','furnace_drop','furnace_feed'],
  orrery:['orbit_lance','orbit_sweep','orbit_calibrate','orbit_collapse'],arbiter:['edict_mark','edict_sentence','edict_audit','edict_revoke'],
  final:['zero_lance','zero_field','zero_pulse','zero_reset']
};
