/** Expedition rewards are canonical data. Owning a reward is what activates it. */
export const REWARDS = {
  knibbs_steadyhands:{id:'knibbs_steadyhands',heroId:'knibbs',kind:'upgrade',affects:['breathe'],name:'装填 · 稳手',description:'至少持有 2 层直感时使用整息装填，为自己的下一次主动攻击提供力量、智力各 +10。增幅两轮内有效，不消耗直感，也不叠加同类增幅。'},
  knibbs_crossfire:{id:'knibbs_crossfire',heroId:'knibbs',kind:'upgrade',affects:['cover'],name:'掩护 · 交叉封锁',description:'对已被标记的敌人使用直感反制，命中前额外清除 1 层可消除增益，包括镜片、孢压、蓄电、封页、水位、炉热或测绘锁定。驱散在敌人实际出手前的截击中结算；若敌人本轮未出手，不会白白获得驱散。'},
  apeilia_brace:{id:'apeilia_brace',heroId:'apeilia',kind:'upgrade',affects:['reboot'],name:'重整 · 折返防线',description:'上一项攻击为魔法时，战术重整的维修恢复提高到30生命。仍只闪避本轮第一段攻击，不产生护盾。'},
  apeilia_puncture:{id:'apeilia_puncture',heroId:'apeilia',kind:'upgrade',affects:['sentinel'],name:'哨兵 · 弱点回收',description:'敌人已处于架势崩溃或应对破绽时，地狱哨兵额外返还 2 连击。仍须先支付 6 连击；需要先由自己或同伴打开输出窗口。'},
  ric_erosion:{id:'ric_erosion',heroId:'ric',kind:'upgrade',affects:['mend'],name:'负域 · 侵蚀',description:'负域的压制加强：雷克平衡为负且存活时，全部存活敌人的四项属性各降低 4，替代原来的各降低 3。'},
  ric_discipline:{id:'ric_discipline',heroId:'ric',kind:'upgrade',affects:['bind'],name:'咒弹 · 封行剥夺',description:'施放前平衡不高于 −4，或敌人正处于干扰时，封行咒弹命中前额外清除 2 层可消除增益。阶段、抗控与核心规则不受影响。'},
  youmu_pathology:{id:'youmu_pathology',heroId:'youmu',kind:'upgrade',affects:['surgery'],name:'外科 · 病理标记',description:'医生形态的切除手术留下的创口提高到每轮 12 物理伤害，并使敌人两轮内意志降低 5。创口不能叠加，不拆护层，也不登记核心命中。'},
  youmu_aftercare:{id:'youmu_aftercare',heroId:'youmu',kind:'upgrade',affects:['firstaid'],name:'急救 · 术后观察',description:'战地急救会清除目标全部共鸣，并让该目标两轮内的下一次主动攻击获得力量、智力各 +9。可以救起队员后帮助其重返输出，不增加治疗量。'},
  knibbs_ricochet:{id:'knibbs_ricochet',heroId:'knibbs',kind:'skill',skillId:'ricochet',name:'新技 · 三点校射',description:'解锁三点校射：三段各 19 基础物理伤害，削韧 18。可发射已装子弹并兑现现有直感；攻击本身不积攒直感。'},
  knibbs_deadeye:{id:'knibbs_deadeye',heroId:'knibbs',kind:'upgrade',name:'直感 · 双重确认',description:'直感满 3 层时，单发确认强化为两段各 45 基础物理伤害。三层直感另外追加一次 24 伤害，不随段数重复。'},
  knibbs_expose:{id:'knibbs_expose',heroId:'knibbs',kind:'upgrade',name:'追猎 · 弹道记忆',description:'目标已有弱者标记时，普通射击的基础伤害增加 8，削韧变为 14；不额外回复气息或积攒直感。'},
  apeilia_overture:{id:'apeilia_overture',heroId:'apeilia',kind:'skill',skillId:'overture',name:'新技 · 新约切换',description:'解锁 1 行动点魔法技能：2 × 14 基础魔法伤害，获得 1 连击，每轮一次；可快速衔接物理技能。'},
  apeilia_cascade:{id:'apeilia_cascade',heroId:'apeilia',kind:'upgrade',name:'伊甸 · 六翼展开',description:'使用伊甸之约前，如果拥有至少 6 点连击，且上一次攻击为魔法，攻击会增加至六段，基础削韧提高到 44。本次仍需先支付 6 点连击，再获得交替攻击的强化与连击返还。'},
  apeilia_zero:{id:'apeilia_zero',heroId:'apeilia',kind:'upgrade',name:'哨兵 · 零时点火',description:'使用地狱哨兵前，如果拥有至少 6 点连击，且上一次攻击为物理，本次行动点消耗会降低到 1 点。仍需先支付 6 点连击，再获得交替攻击的强化与连击返还。'},
  ric_equilibrium:{id:'ric_equilibrium',heroId:'ric',kind:'skill',skillId:'equilibrium',name:'新技 · 零域归一',description:'解锁零域归一：平衡回到 0，全队回复 16 生命、净化 1 层共鸣。归零撤去领域，不产生混沌；冷却 2 轮。'},
  ric_grace:{id:'ric_grace',heroId:'ric',kind:'upgrade',name:'正域 · 余响同调',description:'平衡真正翻转正负后获得余响；下一次肉身同调只耗 1 行动点，自身护盾提高至 38，仍获得 2 次剑势。'},
  ric_verdict:{id:'ric_verdict',heroId:'ric',kind:'upgrade',name:'剑式 · 清账三连',description:'平衡真正翻转正负后获得清账；下一次剑式变为 3 × 24 物理伤害、削韧 20，施放后消耗清账。'},
  haart_network:{id:'haart_network',heroId:'haart',kind:'skill',skillId:'network',name:'新技 · 心智协同',description:'解锁心智协同：以 2 行动点拆解 4 条念线，全队每人的下一项主动伤害技能获得力量、智力各 +20，各触发一次、两轮后过期；同时净化 2 层共鸣。拆解会触发心智通路被动。'},
  haart_triage:{id:'haart_triage',heroId:'haart',kind:'upgrade',affects:['soothe'],name:'安抚 · 通路接续',description:'本轮其他同伴已经行动后，心智安抚会顺着其留下的破绽，额外驱散敌方 1 层强化。仍固定拆解 1 条念线，不改变心智通路的回魔规则。独狼时先使用另一项技能也能触发。'},
  haart_echo:{id:'haart_echo',heroId:'haart',kind:'upgrade',affects:['page'],name:'书页 · 护念回响',description:'敌人处于心智扰乱、进攻受扰或破绽暴露状态时，书页投射每段基础伤害提高 4，削韧提高 2。普通攻击仍不花魔力、不生成念线；持有念线时消耗一条强化攻击。'},
  haart_intercept:{id:'haart_intercept',heroId:'haart',kind:'skill',skillId:'intercept',name:'新技 · 精神截流',description:'解锁精神截流：以 2 行动点拆解 3 条念线，驱散 2 层强化、尝试封锁一次普通行动，并使敌人下一次实际进攻前的力量、智力各降低 8，意志降低 4。冷却 2 轮，封锁需通过意志检定并服从抗控；拆解触发心智通路被动。'},
  haart_insight:{id:'haart_insight',heroId:'haart',kind:'upgrade',affects:['relay'],name:'回响 · 破绽提醒',description:'目标在施放前已处于心智扰乱或进攻受扰时，通路回响造成伤害后，使其本轮敏捷降低 8，后续物理攻击受益。重复施加不叠加，不产生弱者标记。'},
  qianxing_nova:{id:'qianxing_nova',heroId:'qianxing',kind:'skill',skillId:'nova',name:'新技 · 灭绝耀光',description:'解锁灭绝耀光：以 3 行动点使用 3 格充能，向全部敌人各造成三段 43 基础魔法伤害，每敌削韧 30，并无视魔法抗性。三次命中可拆解按命中计数的防护，但只触发一次反应炉回收。'},
  qianxing_reinforce:{id:'qianxing_reinforce',heroId:'qianxing',kind:'upgrade',affects:['armor'],name:'护甲 · 协同装甲',description:'本轮先使用钉刺、光束、脉冲或耀光，再展开钉刺护甲时，一次获得 2 次物理反击。仍消耗 1 格充能，获得持续两轮的 36 点自身护盾；没有全队护盾。'},
  qianxing_focus:{id:'qianxing_focus',heroId:'qianxing',kind:'upgrade',affects:['beam'],name:'充能 · 稳固聚焦',description:'自身仍持有护盾时，聚焦光束额外驱散敌方强化：使用 2 格充能的光束驱散 1 层，满载使用 3 格时驱散 2 层。先部署装甲，再利用稳定的光束处理敌方强化。'},
  qianxing_lock:{id:'qianxing_lock',heroId:'qianxing',kind:'skill',skillId:'lock',name:'新技 · 解除协议',description:'解锁解除协议：以 2 行动点使用 2 格充能，驱散敌方 3 层强化并尝试封锁一次普通行动。没有直接伤害，冷却 2 轮；服从抗控，不能封锁核心或终幕。'},
  qianxing_grounding:{id:'qianxing_grounding',heroId:'qianxing',kind:'upgrade',affects:['pulse'],name:'脉冲 · 接地回路',description:'敌人正在蓄力，或蓄电、热量、水位、预测达到 2 层时，脉冲射线除了驱散 1 层强化，还使敌人下一次行动前的力量、智力各降低 8，意志降低 4。仍只使用 1 格充能，遵循反应炉回收被动。'},
  youmu_suture:{id:'youmu_suture',heroId:'youmu',kind:'skill',skillId:'suture',name:'新技 · 精密缝合',description:'消耗 3 气息与 2 行动点，使最低生命比例的存活队员在接下来的两次回合末各恢复 32 生命。没有即时治疗，不能复活、不叠加；船长状态变为深海炮列。'},
  youmu_transplant:{id:'youmu_transplant',heroId:'youmu',kind:'upgrade',name:'外科 · 无菌移植',description:'移植手术的全队护盾提高至 26，主治疗提高至 40；仍须先取得标本。'},
  youmu_resolve:{id:'youmu_resolve',heroId:'youmu',kind:'upgrade',affects:['bloodoath'],name:'血誓 · 护住这具身体',description:'血誓接管时获得的护盾提高至 36，持续两轮。仍会主动献血至 40% 生命、嘲讽两轮，并在退出后虚脱；每场一次。'},
  patch_revelation:{id:'patch_revelation',heroId:'patch',kind:'skill',skillId:'revelation',name:'新技 · 时之扉',description:'解锁时之扉：以 3 行动点销毁全部 6—10 条记录，每条产生一段攻击。观测每段 30 魔法伤害并穿透魔抗；收录每段 22、驱散 2 层，至少 8 条时尝试封锁一次普通行动。无论段数，书记官只回魔一次。'},
  patch_precision:{id:'patch_precision',heroId:'patch',kind:'upgrade',affects:['fragments','revelation'],name:'书记官 · 精确计时',description:'一次兑现至少 3 条记录的伤害技能额外削韧 6，适用于时光碎屑与时之扉。固定单条的充能斩不享受加成，需要在逐条回转和集中削韧之间作选择。'},
  patch_archive:{id:'patch_archive',heroId:'patch',kind:'upgrade',affects:['bookward'],name:'收录 · 厚页书阵',description:'使用书阵进入收录时，额外为全队净化 1 层共鸣。仍先支付 4 魔力、生成 3 条记录，8 点护盾只保护自身并持续两轮；受击、破盾都不回魔。'},
  patch_injunction:{id:'patch_injunction',heroId:'patch',kind:'skill',skillId:'injunction',name:'新技 · 读秒禁令',description:'解锁读秒禁令：以 2 行动点销毁 4 条记录，尝试封锁一次普通行动。观测中同时使敌人两轮内敏捷、智力各降低 8，收录中额外驱散 2 层；没有直接伤害，冷却 3 轮，服从抗控。'},
  patch_doubleentry:{id:'patch_doubleentry',heroId:'patch',kind:'upgrade',affects:['bookward'],name:'档案 · 交叉索引',description:'从观测姿态使用书阵切入收录时，该次转化费用从 4 魔力降低为 3。仍生成 3 条记录，不额外返还魔力；连续使用收录书阵不享受减费，免费普通攻击钥刃不受影响。'}
};

/** Keep eligible cached choices in place and fill gaps from a deterministic draw. */
export function reconcileRewardOffer(cachedIds,eligible,draw){
 const byId=new Map(eligible.map(reward=>[reward.id,reward]));
 const kept=[...new Set(Array.isArray(cachedIds)?cachedIds:[])].filter(id=>byId.has(id)).slice(0,3);
 const missing=draw(eligible.filter(reward=>!kept.includes(reward.id)));
 return [...kept.map(id=>byId.get(id)),...missing].slice(0,3);
}
