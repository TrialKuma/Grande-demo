// The order is deliberate: a playable resource loop first, a defensive choice next.
export const LEARNING_ORDER={
 knibbs:['shot','breathe','cover','focus','scatter'],
 apeilia:['blade','purify','reboot','eden','sentinel'],
 ric:['rune','shelter','bind','mend','crossing'],
 haart:['page','soothe','anchor','relay','rest'],
 qianxing:['spike','pulse','armor','beam','repair'],
 youmu:['scalpel','sterilize','surgery','bloodoath','firstaid'],
 patch:['keyblade','chargedslash','bookward','fragments','collate']
};
export const LEARNING_TIPS={
 knibbs:'射击能积攒直感，整息装填能恢复气息。先看剩余行动点，再决定继续射击还是为下轮准备。学到掩护射击后，盯住危险敌人，在它出手前反击与压制。',
 apeilia:'螳螂刀是物理，炼净双枪是魔法。交替使用能更快积攒连击；以后学到的重招会消耗六点连击。战术重整可闪避本轮第一段攻击；面对连击仍要留意后续伤害。',
 ric:'剑式把平衡推向正面，同调强化自己。先熟悉这条进攻路线，再用负域和枪式学习削弱敌人。平衡每轮会向零回复。',
 haart:'先用书页把魔力编成念线，再花一条念线安抚敌人。安抚会触发被动回魔，还能让单体招式打向另一名敌人；群攻或只剩一个敌人时则压低伤害，适合先练熟准备和兑现的顺序。',
 qianxing:'钉刺把魔力转成充能，脉冲花一格充能回收魔力并驱散强化。学到护甲后，可以把同一格充能用于保护自己。',
 youmu:'手术刀和清创都能准备切除，清创还能预备受伤后的包扎。切除留下创口并取走护层；血誓让船长主动接管，代价是自身生命。',
 patch:'钥刃花魔力写记录，充能斩逐条消费记录并触发回魔。先把这一步循环练熟，学到书阵后再比较观测和收录的差别。'
};
export const TUTORIAL_IDS=['scout','bulwark','conduit'];
export const LESSONS={
 scout:{title:'先学会用完这一轮',text:'每个技能都会花行动点。行动点不够时结束回合，敌人才会出手。第一场只有射击和整息装填；无需急着记住完整技能表。'},
 bulwark:{title:'先准备资源，再决定进攻还是防守',text:'同伴与尼布斯共用行动点。资源转化通常只带很弱的即时效果；看到敌人准备重击时，试试已经学到的防护技能。'},
 conduit:{title:'让两个人接上彼此的节奏',text:'不用平均分配行动点。可以让一个人准备或防守，把剩下的机会交给另一个人。学会看预告后，再进入正式 BOSS 战。'}
};
