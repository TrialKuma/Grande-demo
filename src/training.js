// The order is deliberate: a playable resource loop first, a defensive choice next.
export const LEARNING_ORDER={
 knibbs:['shot','focus','loadburst','cover','scatter','breathe','loadbreach'],
 apeilia:['blade','purify','reboot','eden','sentinel'],
 ric:['rune','shelter','bind','mend','crossing'],
 haart:['page','rest','soothe','relay','anchor'],
 qianxing:['spike','repair','armor','beam','pulse'],
 youmu:['scalpel','sterilize','surgery','bloodoath','firstaid'],
 patch:['keyblade','bookward','chargedslash','fragments','collate']
};
export const LEARNING_TIPS={
 knibbs:'普通射击不回气息。先用单发确认命中，再衔接快速装填、快速发射和重装填，每种追加各能用一次，并各回复一点气息。装填花掉气息才能积攒直感：可以随射击兑现，也可以保留三层，在敌人出手前反制。每轮自然恢复两点气息，资源紧张时别把所有机会都花完。',
 apeilia:'螳螂刀是物理，炼净双枪是魔法。交替使用能更快积攒连击；以后学到的重招会消耗六点连击。战术重整可闪避本轮第一段攻击；面对连击仍要留意后续伤害。',
 ric:'剑式把平衡推向正面，同调强化自己。先熟悉这条进攻路线，再用负域和枪式学习削弱敌人。平衡每轮会向零回复。',
 haart:'书页可以直接攻击，不花魔力，也不生成念线。先用心智领域把魔力编成念线，再花念线强化书页或安抚敌人。安抚会触发被动回魔，还能让单体招式打向另一名敌人；群攻或只剩一个敌人时则压低伤害，适合先练熟准备和兑现的顺序。',
 qianxing:'钉刺可以直接攻击，不花魔力，也不产生充能。先用反应炉灌注准备充能，再选择强化射击、展开护甲或集中打出光束。',
 youmu:'手术刀和清创都能准备切除，清创还能预备受伤后的包扎。切除留下创口并取走护层；血誓让船长主动接管，代价是自身生命。',
 patch:'钥刃免费攻击并进入观测，不会写记录。书阵消耗魔力记录并进入收录，随后可用记录强化钥刃或施放充能斩，再比较两种姿态的回魔效率。'
};
export const TUTORIAL_IDS=['scout','bulwark','conduit'];
export const LESSONS={
 scout:{title:'确认命中，再跟上一枪',text:'单发确认花 2 AP 和 2 气息，命中后普通射击会暂时变成快速发射。它花 1 AP，作为追加行动回复 1 气息；平时的普通射击不会回气息。结束回合还能自然恢复 2 点。'},
 bulwark:{title:'把特殊子弹接进连招',text:'先用单发确认命中，再点聚爆装填：这次快速装填不花 AP，支付 6 气息并返还 1 点，同时积攒三层直感。接快速发射打出特殊弹与直感伤害，再用装填槽里的重装填结束这一串动作。同伴也需要行动点，先看敌人的预告再决定打多长。'},
 conduit:{title:'把直感留给反制',text:'装填后先别急着射击。三层直感也可以用来预备反制：花 1 AP，等目标出手前回击并压低它的攻击；当前特殊子弹会保留下来。直感用来防守后，这发子弹就没有直感的额外伤害了。每场最多携带四项技能，按需要选择弹种与防护。'}
};
