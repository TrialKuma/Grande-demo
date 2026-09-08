export const BOSSES = {
  patrol:{id:'patrol',modelId:'scout',name:'巡防小队',subtitle:'PATROL SQUAD',region:'博洛伦 · 石阶巡路',scene:'ruins',isSkirmish:true,brief:'石卫会替巡路机分担单体伤害。先集中解决护卫，或用群体火力一起压低血线。',mechanic:'双敌编队 · 护卫分担',color:'#b9bcac',icon:'shield',hpMultiplier:.28},
  relay_guard:{id:'relay_guard',modelId:'conduit',name:'中继哨站',subtitle:'RELAY OUTPOST',region:'博洛伦 · 中继通路',scene:'archive',isSkirmish:true,brief:'导流装置交替供能与放电，强化巡路机射击。拆掉装置会打断充能并暴露所有护卫，也可以先消灭攻击最危险的敌人。',mechanic:'三敌编队 · 可破坏装置',color:'#8dcedd',icon:'rune',hpMultiplier:.20},
  escort:{id:'escort',modelId:'bulwark',name:'缄页护卫',subtitle:'PAGE GUARD',region:'护卫',isMinion:true,brief:'存活且未受控时，分担主敌受到的一半单体伤害；群体攻击不分担。',mechanic:'护卫分担',color:'#a9bdcc',icon:'shield',hpMultiplier:.20},
  drone:{id:'drone',modelId:'scout',name:'巡路机',subtitle:'PATROL DRONE',region:'巡卫',isMinion:true,brief:'脆弱但每轮都会开火。充能后攻击更强。',mechanic:'集中射击',color:'#ccb580',icon:'crosshair',hpMultiplier:.15},
  sporeling:{id:'sporeling',modelId:'scout',name:'游走菌簇',subtitle:'WANDERING SPORELING',region:'菌冠召物',isMinion:true,brief:'喷吐与供养交替，供养回合会为仍然存活的司祭回复生命。',mechanic:'召物 · 孢子供养',color:'#c39ace',icon:'mist',hpMultiplier:.10},
  relay:{id:'relay',modelId:'conduit',name:'雷能中继器',subtitle:'THUNDER RELAY',region:'供能装置',isMinion:true,brief:'供能与群体放电交替，为主敌补充蓄电。任何攻击都可以破坏；装置被破坏时主敌停机一轮。',mechanic:'供能 · 破坏中断',color:'#9dd2e7',icon:'rune',hpMultiplier:.17},
  scout: {id:'scout',name:'巡路残机',subtitle:'STRAY SCOUT',region:'博洛伦 · 遗迹外沿',scene:'ruins',isTutorial:true,brief:'废弃的小型巡逻机，只会挥臂和提前亮灯的冲撞。先试着分配行动点，再用角色技能保护自己。',mechanic:'基础行动 · 两招交替',color:'#c0b08a',icon:'crosshair',hpMultiplier:.15},
  bulwark: {id:'bulwark',name:'松动石卫',subtitle:'CRACKED BULWARK',region:'博洛伦 · 石阶哨站',scene:'ruins',isTutorial:true,brief:'躯壳松动的旧石卫，挥拳之后会重踏地面。用新同伴的资源循环和防护技能合作通过。',mechanic:'资源循环 · 轮流行动',color:'#a9cbd3',icon:'shield',hpMultiplier:.3},
  conduit: {id:'conduit',name:'失控导流器',subtitle:'FAULTY CONDUIT',region:'博洛伦 · 引流前室',scene:'foundry',isTutorial:true,brief:'它用短促电击驱赶靠近的人，随后把积蓄的电流释放到整个房间。让三名队员分工，集中削韧或提前保护。',mechanic:'群体预告 · 三人协作',color:'#a5cddc',icon:'rune',hpMultiplier:.52},
  golem: {id:'golem',name:'魔晶巨人',subtitle:'CRYSTAL COLOSSUS',region:'博洛伦 · 雾蚀遗迹',brief:'击碎逐层解体的岩铠，再以物理与魔法净化暴露的核心。',mechanic:'延迟地裂 · 共鸣驱散 · 双系核心',color:'#80d9df',icon:'crystal',hpMultiplier:1},
  duelist: {id:'duelist',name:'折镜刃卫',subtitle:'MIRROR SENTINEL',region:'博洛伦 · 折镜回廊',brief:'遗迹机械剑士借镜片折返攻击。拆镜、拆招，或承受刀锋换取反击窗口。',mechanic:'镜甲减伤 · 魔法拆镜 · 折镜反击',color:'#69d8e2',icon:'blades',hpMultiplier:1.2},
  cantor: {id:'cantor',name:'孢冠司祭',subtitle:'SPORE-CROWN CANTOR',region:'博洛伦 · 紫雾圣所',brief:'司祭播孢时召出会攻击和供养的菌簇。选择先切断供养，或用群体火力压低全场；司祭与菌簇全部倒下才算胜利。',mechanic:'有限召唤 · 清理供养者 · 裸冠窗口',color:'#cf9eea',icon:'rune',hpMultiplier:1.15},
  warden: {id:'warden',name:'雷脊守卫',subtitle:'THUNDERSPINE WARDEN',region:'博洛伦 · 风暴栈桥',brief:'中继器不断为守卫补充雷能。先摧毁装置可清空蓄电并让守卫停机；也能用物理泄能、驱散或打断处理风暴。两名敌人都须击败。',mechanic:'可破坏中继器 · 断电停机 · 风暴打断',color:'#edc35c',icon:'quake',hpMultiplier:1.38},
  weaver: {id:'weaver',name:'缄页织者',subtitle:'SILENT-PAGE WEAVER',region:'博洛伦 · 缄默书庭',brief:'缄页护卫替织者分担单体伤害。先击败或控制护卫，也可用群体攻击绕过分担；再用异系拆页，阻止封缄与复写。',mechanic:'护卫分担 · 群攻绕行 · 异系拆页',color:'#dd9fc7',icon:'book',hpMultiplier:1.42},
  tide: {id:'tide',name:'水闸监守',subtitle:'FLOODGATE KEEPER',region:'博洛伦 · 下层水闸',scene:'floodworks',brief:'监守靠高水位推动重锚。任意属性累计三次命中即可打开一轮排水阀，降低下一次浪涌；驱散技能也能排水。',mechanic:'水位压迫 · 三击排水 · 浪涌清空',color:'#61c8d4',icon:'wind',hpMultiplier:1.34},
  furnace: {id:'furnace',name:'熔炉搬运者',subtitle:'FURNACE CARRIER',region:'博洛伦 · 废热铸造间',scene:'foundry',brief:'背负熔炉的搬运者在排汽后打开炉门。抓住敞口连续命中，可以泄热并放大伤害；在落锤前决定是否抢攻。',mechanic:'炉热增伤 · 排汽开炉 · 敞口泄热',color:'#e5a66d',icon:'hammer',hpMultiplier:1.46},
  orrery: {id:'orrery',name:'星轨测绘仪',subtitle:'ORBITAL CARTOGRAPHER',region:'博洛伦 · 星轨观测台',scene:'observatory',brief:'测绘仪会记录上一项攻击技能。连续重复会提高锁定；换一项攻击即可打乱预测，降低贯星与轨道坍缩的伤害。',mechanic:'重复锁定 · 换招解算 · 轨道坍缩',color:'#a7a4ed',icon:'target',hpMultiplier:1.52},
  arbiter: {id:'arbiter',name:'缄令执行官',subtitle:'SILENT ARBITER',region:'博洛伦 · 缄令档案库',scene:'archive',brief:'执行官交替宣布轻击令与重击令。违令的攻击会提高本轮判罚；可以顺从节奏，也可以用护盾承担判罚换取爆发。',mechanic:'轻重击令 · 违令判罚 · 战术减责',color:'#d6be87',icon:'book',hpMultiplier:1.62},
  final: {id:'final',name:'归零之核',subtitle:'THE ZERO HEART',region:'博洛伦 · 归零天井',brief:'核心即将切断避难室的供气。交替攻击拆开屏障；最后以双系命中接入停机指令，并使用角色防护技能抵住最后一次放电。',mechanic:'双系同步 · 归零屏障 · 终幕双系与防护',color:'#f4e6bd',icon:'crystal',hpMultiplier:1.85}
};
export const BOSS_INTENTS = {
  patrol:['drone_shot','drone_charge'],relay_guard:['relay_feed','relay_blast'],escort:['escort_bash','escort_stamp'],drone:['drone_shot','drone_charge'],sporeling:['spore_shot','spore_feed'],relay:['relay_feed','relay_blast'],
  scout:['scout_swing','scout_ram'],bulwark:['bulwark_punch','bulwark_stamp'],conduit:['conduit_zap','conduit_discharge'],
  golem:['slam','fog','missiles','compression','reclaim'],duelist:['rend','mirror','pierce','duel'],cantor:['sow','drain','bloom','weave'],
  warden:['arc','ground','storm','charge'],weaver:['script','silence','rewrite','sever'],
  tide:['tide_hook','tide_fill','tide_breaker','tide_release'],furnace:['furnace_lift','furnace_vent','furnace_drop','furnace_feed'],
  orrery:['orbit_lance','orbit_sweep','orbit_calibrate','orbit_collapse'],arbiter:['edict_mark','edict_sentence','edict_audit','edict_revoke'],
  final:['zero_lance','zero_field','zero_pulse','zero_reset']
};
