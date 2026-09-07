import {HEROES,heroOf,skillOf,resolvedSkill,skillPreview,canUse,heroStatus,responseOptions} from './combat.js';
import {SPECIMEN_NAMES} from './expedition-heroes.js';
import {icon} from './icons.js';
import {REWARDS} from './rewards.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=value=>value>0?`+${value}`:String(value);
const kindName=kind=>kind==='physical'?'物理':'魔法';
const responseNames={parry:'招架',evade:'回避',counter:'迎击'};
const passiveIds={knibbs:'intuition',apeilia:'alternation',ric:'harmony',haart:'mindlink',qianxing:'silverflame',youmu:'surgeon',patch:'recorder'};
const ownedRewards=(state,h)=>Object.values(REWARDS).filter(reward=>reward.heroId===h.id&&(state.upgrades||[]).includes(reward.id));
const rewardSkills={knibbs_deadeye:'focus',knibbs_expose:'shot',apeilia_cascade:'eden',apeilia_zero:'sentinel',ric_grace:'shelter',ric_verdict:'rune',haart_triage:'soothe',haart_echo:'page',qianxing_reinforce:'armor',qianxing_focus:'beam',youmu_transplant:'surgery',youmu_resolve:'bloodoath',patch_precision:['chargedslash','fragments','revelation'],patch_archive:['bookward','chargedslash']};

function header(symbol,title,subtitle){
  return `<div class="tooltip-header">${icon(symbol)}<div><h3>${esc(title)}</h3>${subtitle?`<small>${esc(subtitle)}</small>`:''}</div></div>`;
}
function paragraph(text,cls='tooltip-description'){return `<p class="${cls}">${esc(text)}</p>`;}
function stats(items){return `<div class="tooltip-stats">${items.map(([label,value])=>`<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}</div>`;}
function notes(items){return items.length?`<ul class="tooltip-notes">${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'';}
function badge(h,id,symbol,label,count,tone,aria){
  return `<button type="button" class="status-badge ${tone||''}" data-tooltip="status" data-owner="${esc(h.id)}" data-detail="${esc(id)}" aria-label="${esc(aria)}">${icon(symbol)}${label?`<span class="badge-label">${esc(label)}</span>`:''}${count!==undefined?`<span class="badge-count">${esc(count)}</span>`:''}</button>`;
}

/** Status tokens describe existing combat state; rendering never changes it. */
export function statusBadges(state,h){
  if(typeof h==='string')h=heroOf(state,h);
  if(!h)return '';
  const result=[];
  if(h.id==='knibbs'){
    const layers=h.intuition||0;
    result.push(badge(h,'intuition','crosshair','直感',`${layers}/3`,layers>=3?'active good':layers?'active':'inactive',`直感 ${layers}/3 层${layers>=3?'，强技与迎击已强化':''}`));
  }else if(h.id==='apeilia'){
    const next=h.lastKind==='physical'?'魔':h.lastKind==='magic'?'物':'—';
    result.push(badge(h,'alternation',h.lastKind==='physical'?'rune':h.lastKind==='magic'?'blade':'twin','交替',next,h.lastKind?'active good':'inactive',h.lastKind?`交叉火力：下一次${next==='魔'?'魔法':'物理'}技能强化`:'交叉火力：尚未施放攻击技能'));
  }else if(h.id==='ric'){
    result.push(badge(h,'harmony',h.resource<0?'crosshair':'blade',h.resource<0?'负域':'正域',signed(h.resource),h.resource?'active good':'inactive',`领域投影：当前平衡 ${signed(h.resource)}，每轮向零回复 2`));
    if(h.ricEdge)result.push(badge(h,'edge','blade','剑势',h.ricEdge,'active good',`剑势 ${h.ricEdge} 次，强化下一次剑式`));
  }else if(h.id==='haart'){
    const linked=state.heroes.some(p=>p.id!==h.id&&p.used.length>0);
    result.push(badge(h,'mindlink','book','通路',linked?'协':'待',linked?'active good':'inactive',linked?'心智通路：已有同伴行动，持有通路接续时治疗强化':'心智通路：等待其他同伴使用技能'));
  }else if(h.id==='qianxing'){
    result.push(badge(h,'silverflame','shield','银焱',h.shield>0?'盾':'—',h.shield>0?'active good':'inactive',h.shield>0?'银焱模组：护盾存在，持有稳固聚焦时光束强化':'银焱模组：当前无护盾'));
  }else if(h.id==='youmu'){
    result.push(badge(h,'surgeon',h.youmuForm==='captain'?'flag':'heal',h.youmuForm==='captain'?'船长':'外科',h.youmuForm==='captain'?`${h.captainTurns}轮`:h.surgicalReady?'备':'待',h.youmuForm==='captain'||h.surgicalReady?'active good':'inactive',h.youmuForm==='captain'?`游墓接管：剩余 ${h.captainTurns} 轮`:'游木外科：手术刀准备后可切除护层'));
    if(h.specimen)result.push(badge(h,'specimen','heal','标本',1,'active good',`${SPECIMEN_NAMES[h.specimen]}标本：移植手术已就绪`));
    if(!h.captainUsed&&h.hp>0&&h.hp<=h.maxHp*.4)result.push(badge(h,'bloodoath','flag','血誓','可','active good','低血条件满足：可请船长接管'));
    if(h.exhaustedTurns)result.push(badge(h,'exhaustion','wind','虚脱',h.exhaustedTurns,'active warning',`虚脱 ${h.exhaustedTurns} 轮：输出减少20%、承伤增加20%`));
  }else if(h.id==='patch'){
    result.push(badge(h,'recorder',h.patchForm==='record'?'book':'blade',h.patchForm==='record'?'收录':'观测',`${h.records}/6`,h.records>=3?'active good':'active',`记录 ${h.records}/6：${h.records>=3?'已达到技能强化条件':'施放魔力技能继续积累'}`));
    if(h.patchRetaliation)result.push(badge(h,'archiveward','shield','书阵','备','active good','书阵反击待发：护盾被敌人击破时回魔并反击'));
  }
  if(h.reflect>0)result.push(badge(h,'reflect','blade','',`${h.reflect}/2`,'active good',`钉刺待发 ${h.reflect}/2 层，受到物理攻击后回击`));
  if(h.grace)result.push(badge(h,'grace','shield','','余','active good','余响同调就绪：下一次肉身同调为 1 行动点、自身 38 护盾与 2 次剑势'));
  if(h.verdict)result.push(badge(h,'verdict','blade','','账','active good','清账三连就绪：下一次剑式强化为三段物理伤害'));
  if(h.shield>0)result.push(badge(h,'shield','shield','',h.shield,'active good',`护盾 ${h.shield} 点`));
  if(h.guard)result.push(badge(h,'guard','parry','','55%','active good','防御中，受到伤害减少 55%'));
  if(h.resonance>0)result.push(badge(h,'resonance','crystal','',`${h.resonance}/5`,'active warning',`共鸣 ${h.resonance}/5 层，满层会引发震荡`));
  if(state.response?.actor===h.id)result.push(badge(h,'response',state.response.id,'','备','active good',`已准备${responseNames[state.response.id]||'战术应对'}，由${h.short}执行`));
  if(h.hp<=0)result.push(badge(h,'down','close','','倒','active warning','角色已倒下，可用应急药剂救起'));
  return result.join('');
}

function passiveDetail(state,h){
  if(h.id==='youmu')return {symbol:'heal',name:h.passiveName,subtitle:`气息 ${h.resource}/10 · ${h.youmuForm==='captain'?'游墓接管':'游木行医'}`,description:h.passiveDesc,facts:['手术刀 → 切除手术 → 移植手术：准备和标本均跨回合保留；移植完成后重新准备。','只切除镜片、孢压、蓄电、封页或迷雾，不能转移 BOSS 阶段和抗控状态。','低血门槛为最大生命的 40%，接管每战一次，持续两轮；炮击可提前结束。船长状态承伤减少 35%，仍可能倒下。','虚脱两轮内输出 −20%、承伤 +20%；治疗与药剂仍能正常使用。气息每轮恢复 2，整备每轮可用一次。']};
  if(h.id==='patch')return {symbol:'clock',name:h.passiveName,subtitle:`${h.patchForm==='record'?'收录':'观测'}形态 · ${h.records}/6 记录`,description:h.passiveDesc,facts:['先检查足额魔力，再支付技能费用，成功后返还 2；记录按支付的魔力生成，最多 6 条，跨回合保留。','已有 3 记录时，充能斩变为断光 / 镜反；时光碎屑在 3 / 6 记录时变为裂片 / 断面。条件在施法前判断。','观测每轮第一次攻击额外回魔 1；收录每轮首次受击增加 1 记录。书阵护盾被敌方击破时可回魔与反击一次。','整理档案回复 4 魔力，不产生记录。记录用于自动强化，不能替代魔力支付技能。']};
  if(h.id==='knibbs')return {
    symbol:'crosshair',name:'直感',subtitle:`永久被动 · 当前 ${h.intuition||0}/3 层`,
    description:'每次攻击积攒 1 层直感，最多 3 层。满层时，下一次单发确认、扩散弹或战术迎击获得伤害 +40%、削韧 +12。',
    facts:[h.intuition>=3?'已蓄满：现在施放强技或准备迎击，可兑现强化。':`距离满层还需 ${3-(h.intuition||0)} 层；普通攻击每次积攒 1 层，多段不额外叠层。`,'强化会消耗满层直感，随后该次攻击重新积攒 1 层；满层时使用直感发射不会消耗。','三点校射积攒 2 层；弹道记忆生效时，直感发射也积攒 2 层。直感跨回合保留。']
  };
  if(h.id==='apeilia')return {
    symbol:'twin',name:'交叉火力',subtitle:`永久被动 · ${h.lastKind?`上一次技能为${kindName(h.lastKind)}`:'尚未施放攻击技能'}`,
    description:'物理与魔法攻击技能交替施放时，本次伤害 +25%、削韧 +6，并额外获得 1 连击。',
    facts:[h.lastKind?`下一次${h.lastKind==='physical'?'魔法':'物理'}攻击技能获得交替强化；已解锁的新约切换也参与交替。`:'先使用任意攻击技能建立属性，再切换到另一属性触发强化。','连续物理时，螳螂刀只获得 1 连击；接在魔法之后则获得 3 连击。','交替状态跨回合保留。战术迎击不会触发交叉火力，也不会改变上一次技能属性。']
  };
  if(h.id==='haart')return {
    symbol:'book',name:h.passiveName,subtitle:`魔力 ${h.resource}/${h.maxResource} · 心智协同`,
    description:h.passiveDesc,
    facts:['魔力初始 10；付费技能先支付完整消耗，成功施放后返还 2。没有每轮自动回魔。','书页投射回复 1 魔力；收拢心神消耗 1 AP，回复 4 魔力与 16 生命，每轮一次。','持有「通路接续」后，先让其他同伴使用技能，可强化本轮心智安抚；持有「护念回响」且自身有护盾时，书页投射强化。']
  };
  if(h.id==='qianxing')return {
    symbol:'shield',name:h.passiveName,subtitle:`魔力 ${h.resource}/${h.maxResource} · 银焱战甲`,
    description:h.passiveDesc,
    facts:['魔力初始 10；付费技能先支付完整消耗，成功施放后返还 2。钉刺射击回复 1 魔力。','紧急修复消耗 1 AP，回复 4 魔力与 26 生命，每轮一次；没有自动回魔或受击积热。','钉刺护甲提供自身护盾与物理反击；持有「稳固聚焦」后，自身有护盾时聚焦光束强化。护盾是生存状态，施放光束不支付护盾。']
  };
  return {
    symbol:'rune',name:'领域投影',subtitle:`平衡 ${signed(h.resource)} / ±10 · 每轮向零回 2`,
    description:h.passiveDesc,
    facts:['正域：肉身同调强化自己，给予护盾与两次剑势。平衡至少 +4 或持有剑势时，剑式直接变为斩影。','负域：缚足同化使敌方下次行动伤害 −20%。平衡不高于 −4 或敌人仍被束缚时，咒弹变为封行咒弹。','每轮开始平衡自动向零恢复 2；不会越过零。主动领域换向每轮一次，可在两条路线之间转换。','由负向过零，全队获得 10 护盾；由正向过零，全队回复 8 生命。初始从零出发不触发，会超出 ±10 的技能不能施放。']
  };
}

function statusTooltip(state,h,id){
  if(id==='edge')return header('blade','剑势',`剩余 ${h.ricEdge} 次`)+paragraph('由肉身同调提供。即使平衡已经回落，剑势仍使下一次剑式变为斩影；施放强化剑式消耗一次，最多保存两次。');
  if(id==='specimen')return header('heal','外科标本',SPECIMEN_NAMES[h.specimen]||'尚未取得')+paragraph('已切除的敌方护层被保存为一个标本。原切除技能位变为移植手术，消耗 2 气息与 2 AP，为全队提供护盾并治疗；完成后标本消失。')+notes(['标本跨回合保留，不增加新的施法资源。','不同标本当前提供相同移植收益；不能移植 BOSS 阶段或控制免疫。']);
  if(id==='bloodoath')return header('flag','血誓就绪','生命不高于 40%')+paragraph('可以主动请游墓接管，获得护盾并将五个技能切换成船长技能。每战一次，持续两轮；沉渊炼狱号会提前结束接管。');
  if(id==='exhaustion')return header('wind','虚脱',`剩余 ${h.exhaustedTurns} 轮`)+paragraph('船长退出后的代价：造成伤害降低 20%，受到伤害增加 20%。可以继续治疗、防御与使用药剂。');
  if(id==='archiveward')return header('shield','书阵反击待发','护盾被敌方击破时触发一次')+paragraph('书阵或镜反提供的反击效果：护盾被敌方击破且补丁Z存活时，返还 2 魔力并回击 28 基础魔法伤害。')+notes(['有护盾而未被击破时不会触发；再次施放书阵只刷新待发状态，不叠加次数。','待发状态跨回合保留。回击服从魔法抗性，也能拆除对应护层或登记核心魔法命中。']);
  if(id===passiveIds[h.id]||id==='passive'){
    const passive=passiveDetail(state,h);
    return header(passive.symbol,passive.name,passive.subtitle)+paragraph(passive.description)+notes(passive.facts);
  }
  if(id==='reflect')return header('blade','钉刺待发',`当前 ${h.reflect||0} / 2 层`)+paragraph('受到敌方物理攻击后，存活角色消耗 1 层钉刺，自动回击 28 基础物理伤害。护盾完全挡住伤害也能触发。')+notes(['由潜行的钉刺护甲提供，可跨回合保留。魔法攻击不会触发或消耗。','反击会按敌人的物理抗性结算，也能释放蓄电、削减孢压或参与双系同步。']);
  if(id==='grace')return header('shield','余响同调','成长强化 · 待消耗')+paragraph('下一次正域 · 肉身同调仅消耗 1 行动点，自身护盾提高至 38，并获得 2 次剑势；仍使平衡 +4，净化自身 1 层共鸣。')+notes(['持有「正域 · 余响同调」后，每次平衡过零获得余响。','施放肉身同调消耗余响；如果这次施放又从负向过零，会再次获得余响，并额外为全队附加 10 护盾。','状态跨回合保留，护盾总量上限仍为 60。']);
  if(id==='verdict')return header('blade','清账三连','成长强化 · 待消耗')+paragraph('下一次剑式变为 3 × 24 基础物理伤害、削韧 20，消耗 1 行动点，平衡 +2。')+notes(['持有「剑式 · 清账三连」后，每次平衡过零获得清账。','施放剑式消耗清账；如果此次又从负向过零，会再次获得清账。持有剑势时也会消费 1 次剑势，伤害段数仍为三段。','清账跨回合保留，枪式不会消耗清账。']);
  if(id==='shield')return header('shield','护盾',`当前 ${h.shield} / 60`)+paragraph('受到伤害时，先计算防御、战术应对、领域束缚和角色状态的修正，再扣除护盾。护盾耗尽后才会扣除生命。')+notes(['护盾跨回合保留，叠加上限为 60。','各技能分别注明自身或全队护盾。雷克的肉身同调保护自身，负向过零时额外保护全队。']);
  if(id==='guard')return header('parry','防御','本轮状态 · 受到伤害 −55%')+paragraph('该角色受到的伤害减少 55%，持续到下一回合开始。与战术应对的减伤相乘，随后再由护盾吸收。')+notes(['防御只保护该角色，也覆盖追击、共鸣震荡与折镜反噬。','消耗 1 行动点，每位角色每轮只能防御一次。']);
  if(id==='resonance')return header('crystal','元素共鸣',`当前 ${h.resonance} / 5 层 · 负面状态`)+paragraph('巨人的物理攻击每次命中会使存活目标增加 1 层共鸣；场上仍有迷雾时，回合结束会再为存活队员增加 1 层。')+notes(['敌方行动结束后，达到 5 层会承受 25 基础魔法伤害并清空层数；实际伤害受难度、防御、护盾与其他承伤状态影响。','雷克的肉身同调清除自身 1 层；缚足同化、游木的战地急救可清除全队 2 层。哈特的安抚也能净化，应急药剂清空目标共鸣。','巨人的元素回收会按队伍共鸣总层数恢复生命；先净化可减少回复量。']);
  if(id==='response'){
    const response=state.response;
    if(!response||response.actor!==h.id)return header('shield','战术应对','当前未准备')+paragraph('每轮可消耗 1 行动点，准备一次全队战术应对。');
    const option=responseOptions({...state,selected:h.id}).find(entry=>entry.id===response.id);
    return header(response.id,`已准备 · ${responseNames[response.id]}`,`执行者：${h.name}`)+paragraph(option?.description||'应对将在下一次敌方主招时执行。')+notes([option?.reward||'','全队获得减伤；额外资源或反击由发起者执行。若其倒下，由首位存活队员接续。','同轮可免费更改方式与执行者。主招被取消时应对不触发；下一轮固定恢复到 6 AP。','应对只覆盖本次主招；巨人的追加飞弹、真空波，以及共鸣震荡与折镜反噬均不在覆盖范围内。'].filter(Boolean));
  }
  if(id==='down')return header('close','角色倒下','无法施放技能或获得通常治疗')+paragraph('点击该角色头像，再使用应急药剂，可使其重新站起并回复 60 生命，共鸣清零。')+notes(['应急药剂消耗 1 行动点与 1 份补给。','全队倒下时战斗失败。']);
  return '';
}

function heroTooltip(state,h){
  const base=HEROES.find(entry=>entry.id===h.id)||h;
  const loops={
    knibbs:'气息上限 10；每轮开始恢复 2。直感发射通常回复 1，整息装填回复 4；单发确认消耗 4，扩散弹消耗 6。成长可以改变直感积攒方式与爆发段数。',
    apeilia:'连击上限 10；螳螂刀 / 炼净积攒连击，伊甸之约 / 地狱哨兵消耗 4。交替属性额外获得 1 连击；成长可在高连击时改变段数或行动点。',
    ric:'平衡范围 −10 至 +10，每轮自动向 0 回 2。剑式 +2、肉身同调 +4，走强化自身的正域剑战；枪式 −3、缚足同化 −4，走削弱敌人的负域枪战。领域换向可主动反转平衡，零点时进入 −4。',
    haart:'魔力上限 10，初始满。付费技能施放后返还 2 魔力，书页投射回 1，收拢心神回 4；每轮不会自动回复。根据队友行动和护盾状态触发已获得的技能强化。',
    qianxing:'魔力上限 10，初始满。付费技能施放后返还 2 魔力，钉刺射击回 1，紧急修复回 4。钉刺护甲保护自身，银焱光束消耗魔力输出；护盾存在时可触发成长强化。',
    youmu:'气息上限 10，初始满值、每轮恢复 2。手术刀建立准备，切除护层保存标本，原技能槽随即变为移植手术；无可转移护层时切除改为高削韧的清创。生命不高于 40% 时，每战可让游墓接管一次，切换全部五槽技能。',
    patch:'魔力上限 10，初始满；付费技能成功后返还 2，整理档案每轮可回复 4。每实际支付 2 魔力积累 1 记录；施放前已有 3 / 6 记录时自动强化并消耗相应记录，所有技能仍需足额支付魔力与行动点。钥刃选择观测进攻，书阵选择收录防护。'
  };
  const symbols={knibbs:'crosshair',apeilia:'twin',ric:'rune',haart:'book',qianxing:'shield',youmu:h.youmuForm==='captain'?'flag':'heal',patch:'clock'};
  const facts={knibbs:'直感通常每次攻击积攒 1 层，三点校射与生效的弹道记忆可积攒 2 层。',apeilia:'交替状态跨回合保留，战术迎击不参与交替。',ric:'回到 0 也算过零；初始从 0 出发不触发。自动回中、回避与零域归一回到 0 都能触发；各方式只触发一次。',haart:'付费技能必须先有足额魔力；返还的 2 点不能用于垫付本次消耗。',qianxing:'钉刺只在受到物理攻击时消耗并反击；光束可以接在钉刺射击后补上魔法输出。',youmu:'船长接管持续两轮，承伤 −35%，仍可能倒下。炮击可提前退出；退出后虚脱两轮，输出 −20%、承伤 +20%，仍可治疗和使用药剂。',patch:'记录只判断自动强化，不能单独支付技能。魔力不足时，即使满记录也不能施放；本次支付新生成的记录不会反过来强化本次施法。'};
  const rewards=ownedRewards(state,h);
  return header(symbols[h.id]||'spark',base.name,`${base.role} · ${base.tag}`)
    +stats([['生命',`${h.hp} / ${h.maxHp}`],['护盾',`${h.shield} / 60`],[h.resourceName,h.id==='ric'?`${signed(h.resource)}（−10 ～ +10）`:`${h.resource} / ${h.maxResource}`]])
    +paragraph(loops[h.id]||base.bio)
    +paragraph(`${base.passiveName}：${base.passiveDesc}`)
    +notes([`当前：${heroStatus(state,h.id)}。`,facts[h.id],'点击头像选择药剂、防御与战术应对的执行者；任意队员的技能都可直接点击。'].filter(Boolean))
    +(rewards.length?paragraph('已获得的成长')+notes(rewards.map(reward=>`${reward.name}：${reward.description}`)):paragraph('尚未获得成长奖励；完成战役遭遇后，可在营地选择新技能或条件强化。'));
}

function skillTooltip(state,h,id){
  const skill=resolvedSkill(state,h.id,id);if(!skill)return '';
  const preview=skillPreview(state,h.id,id),blocked=canUse(state,h.id,id),items=[];
  const effective={...skill,...Object.fromEntries(['heal','allHeal','shield','cleanse','self','selfShield','reflect','mark'].filter(key=>preview[key]!==undefined).map(key=>[key,preview[key]]))};
  items.push(['本次行动点',`${preview.ap??skill.ap} AP`]);
  if((preview.cost??skill.cost)>0)items.push([`消耗${h.resourceName}`,String(preview.cost??skill.cost)]);
  if(skill.damage){
    if(state.boss.finale){
      const before=skill.kind==='physical'?state.boss.finalePhysical:state.boss.finaleMagic;
      items.push([`${kindName(skill.kind)}终幕记录`,`${before} → 1 / 1`]);
    }else if(state.boss.core){
      const before=skill.kind==='physical'?state.boss.corePhysical:state.boss.coreMagic;
      items.push([`${kindName(skill.kind)}核心命中`,`${before} → ${Math.min(3,before+preview.hits)} / 3`]);
    }else items.push([`预计${kindName(skill.kind)}伤害`,String(preview.damage)]);
    items.push(['攻击段数',`${preview.hits} 段`]);
    if(!state.boss.core&&!state.boss.finale)items.push(['预计削韧',String(preview.stagger)]);
  }
  if(preview.refund)items.push(['施放成功返还',`魔力 +${preview.refund}`]);
  if(preview.allShield)items.push(['追加全队护盾',`+${preview.allShield}（含自身）`]);
  if(effective.shield)items.push([effective.selfShield?'自身护盾':'全队护盾',`+${effective.shield}（上限 60）`]);
  if(effective.heal)items.push(['本次治疗',effective.self?`自身 +${effective.heal}`:`最低比例 +${effective.heal} / 其余 +${effective.allHeal||0}`]);
  if(effective.reflect)items.push([effective.selfShield?'自身钉刺待发':'全队钉刺待发',`+${effective.reflect} 层（上限 2）`]);
  items.push([h.resourceName,`${h.id==='ric'?signed(preview.resourceBefore):preview.resourceBefore} → ${h.id==='ric'?signed(preview.resourceAfter):preview.resourceAfter}`]);
  if(skill.cooldown)items.push(['冷却',h.cooldowns[skill.id]>0?`剩余 ${h.cooldowns[skill.id]} 轮`:`${skill.cooldown} 轮 · 就绪`]);
  if(skill.once)items.push(['使用限制',h.used.includes(skill.id)?'本轮已使用':'每轮一次 · 可用']);
  const detailNotes=[...preview.notes];
  if(skill.damage&&state.boss.core)detailNotes.unshift('核心阶段按命中次数净化，不按伤害量结算；物理与魔法各满 3 次即可胜利。');
  if(skill.damage&&state.boss.finale)detailNotes.unshift('终幕需要分别登记 1 次物理与魔法命中，并准备任意战术应对；结束回合、承受终幕攻击后完成胜利。');
  if(skill.damage&&!state.boss.core&&!state.boss.finale)detailNotes.unshift('预计值已计入当前抗性、标记、破韧、角色被动与成长；多段逐次计算层数变化。');
  if(effective.cleanse)detailNotes.push(`${effective.self||effective.selfShield&&!effective.heal?'自身':'全队'}共鸣 −${effective.cleanse} 层（最低 0）。`);
  if(effective.mark)detailNotes.push('标记在本次攻击后生效，强化本轮后续全队伤害；本次不会享受新施加的标记。');
  if(skill.pierce)detailNotes.push('穿透魔法抗性；仍享受裸冠、标记与破韧增伤。');
  const rewards=ownedRewards(state,h).filter(reward=>reward.skillId===id||[].concat(rewardSkills[reward.id]||[]).includes(id));
  return header(skill.icon,skill.name,`${h.youmuForm==='captain'?'游墓':h.short} · ${skill.kind?kindName(skill.kind)+'攻击':'辅助技能'}`)
    +paragraph(`当前效果：${skill.desc}`)
    +(preview.empowered?paragraph(`本次强化已生效：${preview.empowerReason}`,'tooltip-description tooltip-empowered'):'')
    +stats(items)+notes([...new Set(detailNotes)])
    +(rewards.length?paragraph('持有成长与触发条件')+notes(rewards.map(reward=>`${reward.name}：${reward.description}`)):'')
    +(blocked?paragraph(`当前不可施放：${blocked}`,'tooltip-blocked'):'');
}

/** The tooltip controller owns visibility, position and ARIA linkage. */
export function tooltipView(state,kind,owner,detail=''){
  const h=heroOf(state,owner);if(!h)return '';
  if(kind==='skill')return skillTooltip(state,h,detail);
  if(kind==='hero')return heroTooltip(state,h);
  if(kind==='status')return statusTooltip(state,h,detail);
  return '';
}
