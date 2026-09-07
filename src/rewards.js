/** Expedition rewards are canonical data. Owning a reward is what activates it. */
export const REWARDS = {
  knibbs_ricochet:{id:'knibbs_ricochet',heroId:'knibbs',kind:'skill',skillId:'ricochet',name:'新技 · 三点校射',description:'解锁 2 行动点技能：消耗 3 气息，3 × 25 物理伤害，削韧 18；使直感直接增加 2。'},
  knibbs_deadeye:{id:'knibbs_deadeye',heroId:'knibbs',kind:'upgrade',name:'直感 · 双重确认',description:'直感满 3 层时，单发确认强化为 2 × 63 基础物理伤害、削韧 42；仍消耗 4 气息与直感。'},
  knibbs_expose:{id:'knibbs_expose',heroId:'knibbs',kind:'upgrade',name:'追猎 · 弹道记忆',description:'目标被标记时，直感发射回复 3 气息、积攒 2 直感，并将削韧提高至 14。'},
  apeilia_overture:{id:'apeilia_overture',heroId:'apeilia',kind:'skill',skillId:'overture',name:'新技 · 新约切换',description:'解锁 1 行动点魔法技能：2 × 20 魔法伤害，获得 1 连击，每轮一次；可快速衔接物理技能。'},
  apeilia_cascade:{id:'apeilia_cascade',heroId:'apeilia',kind:'upgrade',name:'伊甸 · 六翼展开',description:'连击至少 6 且上次使用魔法时，伊甸之约强化为 6 段，基础削韧 44；仍消耗 4 连击，并享受交替强化。'},
  apeilia_zero:{id:'apeilia_zero',heroId:'apeilia',kind:'upgrade',name:'哨兵 · 零时点火',description:'连击至少 6 且上次使用物理时，地狱哨兵仅消耗 1 行动点；仍消耗 4 连击，并享受交替强化。'},
  ric_equilibrium:{id:'ric_equilibrium',heroId:'ric',kind:'skill',skillId:'equilibrium',name:'新技 · 零域归一',description:'解锁 1 行动点技能：平衡回到 0，全队回复 16 生命、净化 1 层共鸣；可触发过零调和。冷却 2 轮。'},
  ric_grace:{id:'ric_grace',heroId:'ric',kind:'upgrade',name:'正域 · 余响同调',description:'每次平衡过零后获得余响；下一次肉身同调只耗 1 行动点，自身护盾提高至 38，仍获得 2 次剑势。'},
  ric_verdict:{id:'ric_verdict',heroId:'ric',kind:'upgrade',name:'剑式 · 清账三连',description:'每次平衡过零后获得清账；下一次剑式变为 3 × 24 物理伤害、削韧 20，施放后消耗清账。'},
  haart_network:{id:'haart_network',heroId:'haart',kind:'skill',skillId:'network',name:'新技 · 心智协同',description:'解锁 2 行动点技能：先支付 6 魔力，全队获得 28 护盾、净化 1 层共鸣，成功后返还 2 魔力。'},
  haart_triage:{id:'haart_triage',heroId:'haart',kind:'upgrade',name:'安抚 · 通路接续',description:'本轮其他同伴已使用技能时，心智安抚治疗主目标提高至 58、其余人提高至 22，并净化全队 2 层共鸣；仍须先支付 5 魔力，成功后返还 2。'},
  haart_echo:{id:'haart_echo',heroId:'haart',kind:'upgrade',name:'书页 · 护念回响',description:'自身持有护盾时，书页投射强化为 2 × 24 魔法伤害、削韧 16；仍回复 1 魔力。'},
  qianxing_nova:{id:'qianxing_nova',heroId:'qianxing',kind:'skill',skillId:'nova',name:'新技 · 灭绝耀光',description:'解锁 2 行动点技能：先支付 8 魔力，3 × 40 魔法伤害、削韧 34，无视魔法抗性，成功后返还 2 魔力。'},
  qianxing_reinforce:{id:'qianxing_reinforce',heroId:'qianxing',kind:'upgrade',name:'护甲 · 协同装甲',description:'本轮其他同伴已使用技能时，钉刺护甲额外为全队附加 14 护盾；保留自身 36 护盾与 1 次物理受击反击。仍先付 5 魔力，成功后返还 2。'},
  qianxing_focus:{id:'qianxing_focus',heroId:'qianxing',kind:'upgrade',name:'银焱 · 稳固聚焦',description:'自身持有护盾时，聚焦光束强化为 118 魔法伤害、削韧 44；仍须先支付 6 魔力，成功后返还 2。'},
  youmu_suture:{id:'youmu_suture',heroId:'youmu',kind:'skill',skillId:'suture',name:'新技 · 精密缝合',description:'解锁精密缝合：消耗 4 气息 / 2 行动点，主治疗 62、其他人 16，净化 2 层共鸣；船长状态变为深海炮列。'},
  youmu_transplant:{id:'youmu_transplant',heroId:'youmu',kind:'upgrade',name:'外科 · 无菌移植',description:'移植手术的全队护盾提高至 26，主治疗提高至 40；仍须先取得标本。'},
  youmu_resolve:{id:'youmu_resolve',heroId:'youmu',kind:'upgrade',name:'血誓 · 护住这具身体',description:'请船长接管时获得的护盾提高至 36；保持低血门槛、每战一次及退出后的虚脱。'},
  patch_revelation:{id:'patch_revelation',heroId:'patch',kind:'skill',skillId:'revelation',name:'新技 · 时之扉',description:'解锁 3 AP / 8 魔力的三段魔法终结技；已有 6 记录时自动强化。施放返还 2 魔力，不增加行动点或跳回合。'},
  patch_precision:{id:'patch_precision',heroId:'patch',kind:'upgrade',name:'书记官 · 精确计时',description:'消耗记录触发的强化招式额外削韧 6；仍服从 BOSS 抗控。'},
  patch_archive:{id:'patch_archive',heroId:'patch',kind:'upgrade',name:'收录 · 厚页书阵',description:'书阵与收录姿态的镜反，提供的自身护盾额外提高 8。'}
};
