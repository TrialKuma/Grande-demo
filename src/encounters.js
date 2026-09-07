export const BOSSES = {
  golem: {id:'golem',name:'魔晶巨人',subtitle:'CRYSTAL COLOSSUS',region:'博洛伦 · 雾蚀遗迹',brief:'击碎逐层解体的岩铠，再以物理与魔法净化暴露的核心。',mechanic:'延迟地裂 · 共鸣驱散 · 双系核心',color:'#80d9df',icon:'crystal',hpMultiplier:1},
  duelist: {id:'duelist',name:'折镜刃卫',subtitle:'MIRROR SENTINEL',region:'博洛伦 · 折镜回廊',brief:'遗迹机械剑士借镜片折返攻击。拆镜、拆招，或承受刀锋换取反击窗口。',mechanic:'镜甲减伤 · 魔法拆镜 · 折镜反击',color:'#69d8e2',icon:'blades',hpMultiplier:1.2},
  cantor: {id:'cantor',name:'孢冠司祭',subtitle:'SPORE-CROWN CANTOR',region:'博洛伦 · 紫雾圣所',brief:'菌丝托举着无人的面具。物理连击剥离孢冠，魔法趁裸露时终结祷告。',mechanic:'孢压增伤 · 物理剥孢 · 裸冠魔法易伤',color:'#cf9eea',icon:'rune',hpMultiplier:1.15},
  warden: {id:'warden',name:'雷脊守卫',subtitle:'THUNDERSPINE WARDEN',region:'博洛伦 · 风暴栈桥',brief:'嵌入背脊的避雷针积蓄风暴。物理连击先手泄能，护盾挡住电涌；选择招架还能引走余电。',mechanic:'蓄电增伤 · 物理泄能 · 招架接地',color:'#edc35c',icon:'quake',hpMultiplier:1.38},
  weaver: {id:'weaver',name:'缄页织者',subtitle:'SILENT-PAGE WEAVER',region:'博洛伦 · 缄默书庭',brief:'它将战斗写进封页。每轮交替封存物理与魔法，用另一系逐层拆封，才能保持资源与节奏。',mechanic:'交替封页 · 异系拆封 · 封缄抽取资源',color:'#dd9fc7',icon:'book',hpMultiplier:1.42},
  final: {id:'final',name:'归零之核',subtitle:'THE ZERO HEART',region:'博洛伦 · 归零天井',brief:'核心即将切断避难室的供气。交替攻击拆开屏障；最后以双系命中接入停机指令，并准备应对抵住最后一次放电。',mechanic:'双系同步 · 归零屏障 · 终幕双系与应对',color:'#f4e6bd',icon:'crystal',hpMultiplier:1.85}
};
export const BOSS_INTENTS = {
  golem:['slam','fog','missiles','compression','reclaim'],duelist:['rend','mirror','pierce','duel'],cantor:['sow','drain','bloom','weave'],
  warden:['arc','ground','storm','charge'],weaver:['script','silence','rewrite','sever'],final:['zero_lance','zero_field','zero_pulse','zero_reset']
};
