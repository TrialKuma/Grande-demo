import {HEROES,heroOf,skillOf,resolvedSkill,skillPreview,canUse,heroStatus,responseOptions,victoryRequirements} from './combat.js';
import {SPECIMEN_NAMES} from './expedition-heroes.js';
import {icon} from './icons.js';
import {REWARDS} from './rewards.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=value=>value>0?`+${value}`:String(value);
const kindName=kind=>kind==='physical'?'物理':'魔法';
export function skillType(skill){const id=skill?.damage>0&&['physical','magic'].includes(skill.kind)?skill.kind:'support';return {id,label:({physical:'物理',magic:'魔法',support:'辅助'})[id],icon:({physical:'blade',magic:'rune',support:'spark'})[id]};}
export function skillTypeBadge(skill){const type=skillType(skill);return `<span class="skill-type type-${type.id}" data-skill-type="${type.id}" aria-label="技能类型：${type.label}">${icon(type.icon)}${type.label}</span>`;}
export function shieldBatches(h){const layers=Array.isArray(h.shieldLayers)?h.shieldLayers.filter(layer=>layer.amount>0&&layer.turns>0).slice().sort((a,b)=>a.turns-b.turns):[];return layers.length?layers:h.shield>0?[{amount:h.shield,turns:2}]:[];}
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
    result.push(badge(h,'mindlink','book','念线',`${h.secondary||0}/6`,h.secondary>=3?'active good':'active','心智通路：积攒念线后，选择干扰、驱散或协同兑现'));
  }else if(h.id==='qianxing'){
    result.push(badge(h,'silverflame','crystal','银焱',`${h.secondary||0}/6`,h.secondary>=3?'active good':'active','升格模组：装填银焱后回收，六份可强化聚焦光束'));
  }else if(h.id==='youmu'){
    result.push(badge(h,'surgeon',h.youmuForm==='captain'?'flag':'heal',h.youmuForm==='captain'?'船长':'外科',h.youmuForm==='captain'?`${h.captainTurns}轮`:h.surgicalReady?'备':'待',h.youmuForm==='captain'||h.surgicalReady?'active good':'inactive',h.youmuForm==='captain'?`游墓接管：剩余 ${h.captainTurns} 轮`:'游木外科：手术刀准备后可切除护层'));
    if(h.specimen)result.push(badge(h,'specimen','heal','标本',1,'active good',`${SPECIMEN_NAMES[h.specimen]}标本：移植手术已就绪`));
    if(!h.captainUsed&&h.hp>0)result.push(badge(h,'bloodoath','flag','血誓','可','active good','血誓可用：主动将生命降至40%，请船长接管并嘲讽两轮'));
    if(h.exhaustedTurns)result.push(badge(h,'exhaustion','wind','虚脱',h.exhaustedTurns,'active warning',`虚脱 ${h.exhaustedTurns} 轮：输出减少20%、承伤增加20%`));
  }else if(h.id==='patch'){
    result.push(badge(h,'recorder',h.patchForm==='record'?'book':'blade',h.patchForm==='record'?'收录':'观测',`${h.secondary||0}/6`,h.secondary>=3?'active good':'active',`记录 ${h.secondary||0}/6：${h.patchForm==='record'?'收录兑现侧重驱散与封锁':'观测兑现侧重进攻与易伤'}`));
  }
  if(h.reflect>0)result.push(badge(h,'reflect','blade','',`${h.reflect}/2`,'active good',`钉刺待发 ${h.reflect}/2 层，受到物理攻击后回击`));
  if(h.grace)result.push(badge(h,'grace','shield','','余','active good','余响同调就绪：下一次肉身同调为 1 行动点、自身 38 护盾与 2 次剑势'));
  if(h.verdict)result.push(badge(h,'verdict','blade','','账','active good','清账三连就绪：下一次剑式强化为三段物理伤害'));
  if(h.shield>0)result.push(badge(h,'shield','shield','',h.shield,'active good',`护盾 ${h.shield} 点，${shieldBatches(h).map(layer=>`${layer.amount}点剩余${layer.turns}次敌方回合`).join('；')}`));
  if(h.attackBuff>0)result.push(badge(h,'attackBuff','spark','增伤',`+${h.attackBuff}%`,'active good',`下一次主动攻击伤害提高 ${h.attackBuff}%，剩余 ${h.attackBuffTurns||2} 轮`));
  if(h.tauntTurns>0)result.push(badge(h,'taunt','target','嘲讽',`${h.tauntTurns}轮`,'active warning',`嘲讽 ${h.tauntTurns} 轮：单体主招优先攻击自己`));
  if(h.regenTurns>0)result.push(badge(h,'regen','heal','恢复',`${h.regenTurns}轮`,'active good',`持续恢复：回合末回复 ${h.regenAmount||32} 生命，剩余 ${h.regenTurns} 轮`));
  if(h.guard)result.push(badge(h,'guard','parry','','55%','active good','防御中，受到伤害减少 55%'));
  if(h.resonance>0)result.push(badge(h,'resonance','crystal','',`${h.resonance}/5`,'active warning',`共鸣 ${h.resonance}/5 层，满层会引发震荡`));
  if(state.response?.actor===h.id)result.push(badge(h,'response',state.response.id,'','备','active good',`已准备${responseNames[state.response.id]||'战术应对'}，由${h.short}执行`));
  if(h.hp<=0)result.push(badge(h,'down','close','','倒','active warning','角色已倒下，可用应急药剂救起'));
  return result.join('');
}

export function passiveDetail(state,h){
  if(h.id==='youmu')return {symbol:'heal',name:h.passiveName,subtitle:`气息 ${h.resource}/10 · ${h.youmuForm==='captain'?'游墓接管':'游木行医'}`,description:h.passiveDesc,facts:['手术刀 → 切除手术 → 移植手术：准备和标本均跨回合保留；移植完成后重新准备。','只切除镜片、孢压、蓄电、封页或迷雾，不能转移 BOSS 阶段和抗控状态。','血誓可主动将生命降至 40% 后让游墓接管；已经低于该值时不再扣血。每战一次，接管并嘲讽两轮；承伤减少 35%，但仍可能倒下。炮击可提前结束。','即时急救负责单体抢救，精密缝合负责单体两轮持续恢复；持续恢复不能救起倒下队员。','虚脱两轮内输出 −20%、承伤 +20%；治疗与药剂仍能正常使用。气息每轮恢复 2，整备每轮可用一次。']};
  if(['haart','qianxing','patch'].includes(h.id))return {symbol:h.id==='qianxing'?'crystal':h.id==='patch'?'clock':'book',name:h.passiveName,subtitle:`魔力 ${h.resource}/${h.maxResource} · ${h.secondaryName||'二级资源'} ${h.secondary||0}/${h.maxSecondary||6}`,description:h.passiveDesc,facts:[`先将魔力转化成${h.secondaryName||'二级资源'}，最多保存 ${h.maxSecondary||6} 点；它和魔力分别计量。`,`兑现技能消耗${h.secondaryName||'二级资源'}并返还魔力，不再重复支付魔力。不同技能的消耗与返还数量分别列在技能说明中。`,'转化和兑现各有用途，需要先满足当前技能的资源条件；本次返还不能用于垫付本次消耗。','魔力不足且二级资源为零时，整备技能可生成 1 点二级资源，不直接回复魔力。']};
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
  return {
    symbol:'rune',name:'领域投影',subtitle:`平衡 ${signed(h.resource)} / ±10 · 每轮向零回 2`,
    description:h.passiveDesc,
    facts:['正域：肉身同调强化自己，给予护盾与两次剑势。平衡至少 +4 或持有剑势时，剑式直接变为斩影。','负域：缚足同化使敌方下次行动伤害 −20%。平衡不高于 −4 或敌人仍被束缚时，咒弹变为封行咒弹。','每轮开始平衡自动向零恢复 2；不会越过零。主动领域换向每轮一次，可在两条路线之间转换。','由负向过零，全队获得 10 护盾；由正向过零，全队回复 8 生命。初始从零出发不触发，会超出 ±10 的技能不能施放。']
  };
}

function statusTooltip(state,h,id){
  if(id==='secondary')return header(h.id==='qianxing'?'crystal':h.id==='patch'?'clock':'book',h.secondaryName||'二级资源',`当前 ${h.secondary||0} / ${h.maxSecondary||6}`)+paragraph(h.passiveDesc)+notes([`先将魔力转化为${h.secondaryName||'二级资源'}，再消耗它施放兑现技能；兑现后才按该技能规则返还魔力。`,`每项技能分别显示魔力支付、${h.secondaryName||'二级资源'}生成 / 消耗和实际返魔。库存不足时的逆向提炼只回收 1 点，没有原技能效果。`]);
  if(id==='attackBuff')return header('spark','攻击强化',`伤害 +${h.attackBuff}% · 剩余 ${h.attackBuffTurns||2} 轮`)+paragraph('强化下一次主动伤害技能，施放后消耗；一项多段技能的全部命中都享受这次强化。')+notes(['战术迎击、护盾反击和持续伤害不会消费这次强化。','到期未使用则失效，不能无限储存。']);
  if(id==='taunt')return header('target','嘲讽',`剩余 ${h.tauntTurns} 轮`)+paragraph('敌人的单体主招优先攻击该角色，当前预告会立即显示新的目标。')+notes(['群体攻击仍会命中所有目标。','普通额外追击不受嘲讽影响；嘲讽本身不提供减伤。']);
  if(id==='regen')return header('heal','持续恢复',`回合末 +${h.regenAmount||32} 生命 · 剩余 ${h.regenTurns} 轮`)+paragraph('每次回合末为这个角色恢复生命。没有即时治疗，也不会治疗其他队员。')+notes(['角色必须存活才能获得恢复；这个状态不会自动复活倒下队员。','剩余次数在回合末结算后减少。']);
  if(id==='edge')return header('blade','剑势',`剩余 ${h.ricEdge} 次`)+paragraph('由肉身同调提供。即使平衡已经回落，剑势仍使下一次剑式变为斩影；施放强化剑式消耗一次，最多保存两次。');
  if(id==='specimen')return header('heal','外科标本',SPECIMEN_NAMES[h.specimen]||'尚未取得')+paragraph('已切除的敌方护层被保存为一个标本。原切除技能位变为移植手术，消耗 2 气息与 2 AP，为全队提供护盾并治疗；完成后标本消失。')+notes(['标本跨回合保留，不增加新的施法资源。','不同标本当前提供相同移植收益；不能移植 BOSS 阶段或控制免疫。']);
  if(id==='bloodoath')return header('flag','血誓就绪','主动降至 40% · 每战一次')+paragraph('将当前生命降至最大值的 40%，获得两轮护盾，让游墓接管并嘲讽两轮；已经低于 40% 时不会再扣血。五个技能位随接管切换为船长技能，沉渊炼狱号会提前结束接管。');
  if(id==='exhaustion')return header('wind','虚脱',`剩余 ${h.exhaustedTurns} 轮`)+paragraph('船长退出后的代价：造成伤害降低 20%，受到伤害增加 20%。可以继续治疗、防御与使用药剂。');
  if(id===passiveIds[h.id]||id==='passive'){
    const passive=passiveDetail(state,h);
    return header(passive.symbol,passive.name,passive.subtitle)+paragraph(passive.description)+notes(passive.facts);
  }
  if(id==='reflect')return header('blade','钉刺待发',`当前 ${h.reflect||0} / 2 层`)+paragraph('受到敌方物理攻击后，存活角色消耗 1 层钉刺，自动回击 28 基础物理伤害。护盾完全挡住伤害也能触发。')+notes(['由潜行的钉刺护甲提供，可跨回合保留。魔法攻击不会触发或消耗。','反击会按敌人的物理抗性结算，也能释放蓄电、削减孢压或参与双系同步。']);
  if(id==='grace')return header('shield','余响同调','成长强化 · 待消耗')+paragraph('下一次正域 · 肉身同调仅消耗 1 行动点，自身护盾提高至 38，并获得 2 次剑势；仍使平衡 +4，净化自身 1 层共鸣。')+notes(['持有「正域 · 余响同调」后，每次平衡过零获得余响。','施放肉身同调消耗余响；如果这次施放又从负向过零，会再次获得余响，并额外为全队附加 10 护盾。','状态跨回合保留，护盾总量上限仍为 60。']);
  if(id==='verdict')return header('blade','清账三连','成长强化 · 待消耗')+paragraph('下一次剑式变为 3 × 24 基础物理伤害、削韧 20，消耗 1 行动点，平衡 +2。')+notes(['持有「剑式 · 清账三连」后，每次平衡过零获得清账。','施放剑式消耗清账；如果此次又从负向过零，会再次获得清账。持有剑势时也会消费 1 次剑势，伤害段数仍为三段。','清账跨回合保留，枪式不会消耗清账。']);
  if(id==='shield')return header('shield','护盾',`当前 ${h.shield} / 60 · ${shieldBatches(h).length} 批`)+paragraph('新护盾分别持续 2 次敌方回合；每批独立倒计时，优先吸收快到期批次。先计算减伤，再扣护盾，耗尽后才扣生命。')+notes([...shieldBatches(h).map((layer,i)=>`第 ${i+1} 批：${layer.amount} 点，剩余 ${layer.turns} 次敌方回合${layer.turns===1?'，本次敌方回合结束后到期':''}。`),'即使敌人被打断或控制，本轮结束仍会扣除持续时间；重新施盾不会刷新旧批次。','每人护盾总量上限为 60。各技能分别说明保护自身、单体或全队。']);
  if(id==='guard')return header('parry','防御','本轮状态 · 受到伤害 −55%')+paragraph('该角色受到的伤害减少 55%，持续到下一回合开始。与战术应对的减伤相乘，随后再由护盾吸收。')+notes(['防御只保护该角色，也覆盖追击、共鸣震荡与折镜反噬。','消耗 1 行动点，每位角色每轮只能防御一次。']);
  if(id==='resonance')return header('crystal','元素共鸣',`当前 ${h.resonance} / 5 层 · 负面状态`)+paragraph('巨人的物理攻击每次命中会使存活目标增加 1 层共鸣；场上仍有迷雾时，回合结束会再为存活队员增加 1 层。')+notes(['敌方行动结束后，达到 5 层会承受 25 基础魔法伤害并清空层数；实际伤害受难度、防御、护盾与其他承伤状态影响。','游木的战地急救清除单个治疗目标 2 层；雷克的缚足同化清除全队 1 层。其他净化技能各自说明范围，应急药剂清空目标共鸣。','巨人的元素回收会按队伍共鸣总层数恢复生命；先净化可减少回复量。']);
  if(id==='response'){
    const response=state.response;
    if(!response||response.actor!==h.id)return header('shield','战术应对','当前未准备')+paragraph('每轮可消耗 1 行动点，准备一次全队战术应对。');
    const option=responseOptions({...state,selected:h.id}).find(entry=>entry.id===response.id);
    return header(response.id,`已准备 · ${responseNames[response.id]}`,`执行者：${h.name}`)+paragraph(option?.description||'应对将在下一次敌方主招时执行。')+notes([option?.reward||'','全队获得减伤；额外资源或反击由发起者执行。若其倒下，由首位存活队员接续。',`同轮可免费更改方式与执行者。主招被取消时应对不触发；下一轮固定恢复到 ${state.maxAp} AP。`,'应对只覆盖本次主招；巨人的追加飞弹、真空波，以及共鸣震荡与折镜反噬均不在覆盖范围内。'].filter(Boolean));
  }
  if(id==='down')return header('close','角色倒下','无法施放技能或获得通常治疗')+paragraph('点击该角色头像，再使用应急药剂，可使其重新站起并回复 60 生命，共鸣清零。')+notes(['应急药剂消耗 1 行动点与 1 份补给。','游木在医生形态使用战地急救，也会优先救起一名倒下队员，恢复 30 生命。','全队倒下时战斗失败。']);
  return '';
}

export function heroResourceDescription(h){
  const burstCost=id=>skillOf('apeilia',id)?.cost??0;
  if(['haart','qianxing','patch'].includes(h.id))return `魔力上限 ${h.maxResource}，${h.secondaryName||'二级资源'}上限 ${h.maxSecondary||6}。转化技能将魔力变为${h.secondaryName||'二级资源'}；兑现技能消耗它并返还魔力。魔力不会自动按回合恢复，各技能分别说明转化、消耗与返还数量。`;
  return ({
    knibbs:`气息上限为 ${h.maxResource} 点，每轮开始恢复 2 点。用直感发射积攒直感并回复气息，再以单发确认或扩散弹爆发；整息装填可以主动补给。`,
    apeilia:`连击上限为 ${h.maxResource} 点。螳螂刀与炼净双枪积攒连击，伊甸之约消耗 ${burstCost('eden')} 点，地狱哨兵消耗 ${burstCost('sentinel')} 点。物理与魔法交替时还能多获得 1 点连击。`,
    ric:'平衡范围 −10 至 +10，每轮自动向 0 回 2。剑式与肉身同调将平衡推向正域，组成强化自身的正域剑战；枪式与缚足同化将平衡推向负域，组成削弱敌人的负域枪战。领域换向可以主动反转平衡，位于零点时会进入 −4。',
    youmu:`气息上限为 ${h.maxResource} 点，入场时为满值，每轮恢复 2 点。手术刀建立准备，切除敌方护层后保存标本，原技能位随即变为移植手术。血誓可主动将生命降至 40%（已经更低时不扣血），每战让游墓接管一次并切换全部五项技能。`
  })[h.id]||'';
}

/** Complete sentences shared by combat tooltips and the character journal. */
export function skillExplanation(state,owner,id){
  const h=typeof owner==='string'?heroOf(state,owner):owner;
  const s=resolvedSkill(state,h.id,id);if(!s)return {cost:'',effects:[],conditions:[]};
  const p=skillPreview(state,h.id,id),cost=p.cost??s.cost??0,ap=p.ap??s.ap,requirements=victoryRequirements(state);
  const effects=[],conditions=[],number=n=>Number(Number(n).toFixed(2));
  let payment=`施放时消耗 ${ap} 点行动点`;
  const secondaryCost=p.secondarySpend??s.secondaryCost??0,secondaryGain=p.secondaryGain??s.secondaryGain??0;
  if(secondaryCost)payment+=`和 ${secondaryCost} 点${h.secondaryName}。`;
  else if(cost>0)payment+=`和 ${cost} 点${h.resourceName}。`;
  else payment+=h.id==='ric'?'，不直接消耗平衡。':`，不消耗${h.resourceName}。`;
  if(p.refund)payment+=`兑现后返还 ${p.refund} 点魔力，超过魔力上限的部分不保留。`;
  if(secondaryGain)effects.push(`生成 ${secondaryGain} 点${h.secondaryName}，上限为 ${h.maxSecondary||6}；库存装不下时不能施放。`);
  if(s.manaRecovery)conditions.push(s.manaEmergency?'当前为应急提炼：没有原技能的攻击、治疗或净化效果。需另花行动点兑现这 1 点资源，才会回魔。':'当前为逆向提炼：只回收 1 点二级资源并返还 1 魔力，没有原技能的战斗效果。先转化更多魔力可恢复完整招式。');
  if(s.damage){
    const hits=s.hits||1,formula=hits>1?`${hits} × ${number(s.damage)}`:String(number(s.damage));
    if(state.boss.core||state.boss.finale)effects.push(`攻击当前敌人${hits>1?`${hits}次`:'一次'}，${requirements.solo?'将每次命中计入当前要求':'记录对应属性的命中次数'}。这个阶段按命中次数判断，不会按伤害数字推进。`);
    else effects.push(`攻击当前敌人${hits>1?`${hits}次`:'一次'}，造成 ${formula} ${kindName(s.kind)}伤害，并削减 ${s.stagger||0} 点韧性。实际伤害和削韧会受到敌方状态影响。`);
  }
  if(p.heal){
    if(s.revive)effects.push(`优先救起一位倒下的队员，使其恢复 ${s.revive} 生命；无人倒下时，为生命比例最低的存活队员恢复 ${p.heal} 点。一次只处理一位队员。`);
    else if(p.self)effects.push(`为自己恢复 ${p.heal} 点生命。`);
    else if(p.heal===p.allHeal)effects.push(`为所有存活队员各恢复 ${p.heal} 点生命。`);
    else effects.push(`自动为生命比例最低的存活队员恢复 ${p.heal} 点生命${p.allHeal?`，其余存活队员各恢复 ${p.allHeal} 点生命`:'，不需要手动选择治疗目标'}。`);
  }
  if(p.shield)effects.push(`为${p.selfShield?'自己':'所有存活队员各'}提供 ${p.shield} 点护盾，独立持续 2 次敌方回合。每人总量最多 60 点，新护盾不会刷新旧批次的期限。`);
  if(p.allShield)effects.push(`额外为所有存活队员各提供 ${p.allShield} 点护盾，包括施放者自己，独立持续 2 次敌方回合。`);
  if(p.cleanse)effects.push(`清除${p.self||p.selfShield&&!p.heal?'自身':'所有存活队员'}的 ${p.cleanse} 层共鸣，最低降至零层。`);
  if(p.allCleanse||s.allCleanse)effects.push(`为所有存活队员各清除 ${p.allCleanse||s.allCleanse} 层共鸣。`);
  if(s.targetCleanse)effects.push(`清除本次抢救目标 ${s.targetCleanse} 层共鸣；其他队员不受影响。`);
  if(s.regenTurns)effects.push(`为生命比例最低的存活队员提供持续恢复：之后 ${s.regenTurns} 次回合末各恢复 ${s.regenAmount||32} 生命。没有即时治疗，不能救起倒下队员；重复施放只刷新持续时间，不叠加恢复量。`);
  if(s.attackBuff||s.selfAttackBuff)effects.push(`使${s.selfAttackBuff?'自己':'每位存活队员'}的下一项主动伤害技能提高 ${s.selfAttackBuff||s.attackBuff}% 伤害，每人各使用一次，多段全部生效；${s.attackBuffTurns||2} 轮内未使用则失效。反击与持续伤害不会消耗这次强化，重复强化保留较强的一次。`);
  if(s.vulnerable)effects.push('使敌人在两轮内受到的伤害增加 15%；本次攻击也享受这次易伤。');
  if(s.hardControl)effects.push('封锁敌人的下一次普通行动；之后敌人有一完整轮抗控。不能影响核心、终幕、已破韧或已有抗控的敌人，不与破韧重复跳过行动，也不提供破韧增伤。');
  if(s.dotDamage)effects.push(`为敌人留下创口，之后两次敌人行动后各造成 ${s.dotDamage} 基础物理伤害；实际数值按结算时的敌方状态计算。创口不叠加、不拆护层，也不计入核心命中。`);
  if(s.healSuppression)effects.push(`使敌人接下来 ${s.healSuppression} 轮的生命恢复量减少 50%。`);
  if(s.stripBuffs)effects.push(`清除敌人最多 ${s.stripBuffs} 层可驱散的强化。阶段、抗控与普通生命值不属于可驱散强化。`);
  if(s.aftercare)effects.push('将本次治疗目标的共鸣清零，并强化其下一项主动伤害技能 25%，未使用的强化两轮后失效。');
  if(s.gain)effects.push(`施放后回复 ${s.gain} 点${h.resourceName}，不会超过资源上限。`);
  if(s.shift&&!s.resetBalance&&!s.crossing)effects.push(`使平衡${s.shift>0?'增加':'减少'} ${Math.abs(s.shift)} 点。过零时会触发领域调和；超出 −10 至 +10 的技能无法施放。`);
  if(s.resetBalance)effects.push('将平衡恢复到零，并按原先的方向触发一次领域调和。');
  if(s.crossing)effects.push('将当前平衡反转到另一侧；位于零点时进入 −4。这个变化可以触发领域调和。');
  if(p.mark)effects.push(`${s.damage?'攻击后':'施放后'}标记敌人，使本轮后续全队伤害提高 15%。${s.damage?'本次攻击不会享受刚施加的标记。':''}`);
  if(s.edge)effects.push(`获得 ${s.edge} 次剑势，用于强化之后的剑式。即使平衡回落，保存的剑势仍然有效。`);
  if(s.weaken)effects.push('使敌人下一次行动的全部伤害降低 20%，并满足雷克强化枪式的条件。同类削弱不会叠加。');
  if(p.reflect)effects.push(`获得 ${p.reflect} 次钉刺反击，最多保存两次。受到物理攻击并存活时，自动回击 28 基础物理伤害；魔法攻击不会触发。`);
  if(s.surgicalSetup)effects.push('完成外科准备，之后可以使用切除手术；准备状态可以跨回合保留。');
  if(s.surgery)conditions.push('需要先使用手术刀。最多切除两层镜片、孢压、蓄电、封页或迷雾，并保存一个标本；之后同一技能位变为移植手术。若敌人没有可切除的护层，则进行更强的清创攻击，不产生标本。不能转移敌人的阶段或抗控规则。');
  if(s.variant==='transplant'||s.transplant)effects.push('使用已保存的标本完成移植。完成后标本消失，需要重新用手术刀准备下一次切除。');
  if(s.transform)conditions.push('主动将生命降至最大值的 40%，已经低于该值时不再扣血，每战一次。游墓接管并嘲讽两轮，五项技能变为船长技能，承伤减少 35%；单体主招优先攻击自己，群体攻击与额外追击不改变目标。退出后虚脱两轮，输出减少 20%，承伤增加 20%。');
  if(s.captainFinish)conditions.push('炮击后立即结束船长接管，并进入两轮虚脱。请先考虑敌人的下一次攻击。');
  if(s.patchStance==='observe')effects.push('切换为观测姿态，兑现技能侧重物理进攻与暴露破绽。');
  if(s.patchStance==='record')effects.push('切换为收录姿态，兑现技能侧重驱散、净化与行动封锁。');
  if(h.id==='knibbs'&&s.damage)conditions.push(`这次攻击积攒 ${s.intuitionGain||1} 层直感，多段攻击不会按每段重复积攒。${['focus','scatter'].includes(id)?'满三层直感时会自动强化，使用后重新开始积攒。':''}`);
  if(h.id==='apeilia'&&s.damage)conditions.push('物理与魔法攻击交替时，本次伤害提高 25%，削韧增加 6 点，并额外获得 1 点连击。交替状态可以跨回合保留。');
  if(h.id==='ric'&&id==='rune')conditions.push('施放前平衡至少为 +4，或仍持有剑势时，会自动变为强化剑招。持有剑势时会使用一次剑势。');
  if(h.id==='ric'&&id==='bind')conditions.push('施放前平衡不高于 −4，或敌人带有进攻受扰状态时，会自动变为两段封行咒弹。');
  if(s.interrupt)conditions.push('可以取消预告中标为「可打断」的敌方蓄力；敌人拥有抗控状态时无法打断，最终终幕也不能被取消。');
  if(s.pierce)conditions.push('这次攻击无视魔法抗性，仍会受到标记、破韧和其他增伤效果影响。');
  if(s.once)conditions.push('每轮只能使用一次，下一轮开始时重新可用。');
  if(s.cooldown)conditions.push(`施放后进入 ${s.cooldown} 轮冷却，需等冷却结束才能再次使用。`);
  if(s.unlockKey)conditions.push(`需要先获得「${REWARDS[s.unlockKey]?.name||'对应的新技能奖励'}」，再把它装入五个技能位之一。`);
  return {cost:payment,effects,conditions};
}

function heroTooltip(state,h){
  const base=HEROES.find(entry=>entry.id===h.id)||h;
  const symbols={knibbs:'crosshair',apeilia:'twin',ric:'rune',haart:'book',qianxing:'shield',youmu:h.youmuForm==='captain'?'flag':'heal',patch:'clock'};
  const passive=passiveDetail(state,h);
  const rewards=ownedRewards(state,h);
  return header(symbols[h.id]||'spark',h.youmuForm==='captain'?'游墓':base.name,`${h.youmuForm==='captain'?'船长接管':base.role} · ${base.tag}`)
    +stats([['生命',`${h.hp} / ${h.maxHp}`],['护盾',`${h.shield} / 60`],[h.resourceName,h.id==='ric'?`${signed(h.resource)}（−10 ～ +10）`:`${h.resource} / ${h.maxResource}`],...(h.secondaryName?[[h.secondaryName,`${h.secondary||0} / ${h.maxSecondary||6}`]]:[])])
    +paragraph(heroResourceDescription(h)||base.bio)
    +paragraph(`${base.passiveName}：${passive.description}`)
    +notes([`当前：${heroStatus(state,h.id)}。`,...passive.facts,'点击头像选择药剂、防御与战术应对的执行者；任意队员的技能都可直接点击。'].filter(Boolean))
    +(rewards.length?paragraph('已获得的成长')+notes(rewards.map(reward=>`${reward.name}：${reward.description}`)):paragraph('尚未获得成长奖励；完成战役遭遇后，可在营地选择新技能或条件强化。'));
}

function skillTooltip(state,h,id){
  const skill=resolvedSkill(state,h.id,id);if(!skill)return '';
  const preview=skillPreview(state,h.id,id),blocked=canUse(state,h.id,id),items=[],explanation=skillExplanation(state,h,id),requirements=victoryRequirements(state);
  const effective={...skill,...Object.fromEntries(['heal','allHeal','shield','cleanse','self','selfShield','reflect','mark'].filter(key=>preview[key]!==undefined).map(key=>[key,preview[key]]))};
  items.push(['本次行动点',`${preview.ap??skill.ap} AP`]);
  if((preview.cost??skill.cost)>0)items.push([`消耗${h.resourceName}`,String(preview.cost??skill.cost)]);
  if(preview.secondarySpend)items.push([`消耗${h.secondaryName}`,String(preview.secondarySpend)]);
  if(preview.secondaryGain)items.push([`生成${h.secondaryName}`,`+${preview.secondaryGain}`]);
  if(skill.damage){
    if(state.boss.finale){
      const before=requirements.solo?(state.boss.finaleHits||0):skill.kind==='physical'?state.boss.finalePhysical:state.boss.finaleMagic,goal=requirements.solo?requirements.finaleHits:1;
      items.push([requirements.solo?'任意属性终幕命中':`${kindName(skill.kind)}终幕记录`,`${before} → ${Math.min(goal,before+preview.hits)} / ${goal}`]);
    }else if(state.boss.core){
      const before=requirements.solo?(state.boss.coreHits||0):skill.kind==='physical'?state.boss.corePhysical:state.boss.coreMagic,goal=requirements.solo?requirements.coreHits:skill.kind==='physical'?requirements.corePhysical:requirements.coreMagic;
      items.push([requirements.solo?'任意属性核心命中':`${kindName(skill.kind)}核心命中`,`${before} → ${Math.min(goal,before+preview.hits)} / ${goal}`]);
    }else items.push([`预计${kindName(skill.kind)}伤害`,String(preview.damage)]);
    items.push(['攻击段数',`${preview.hits} 段`]);
    if(!state.boss.core&&!state.boss.finale)items.push(['预计削韧',String(preview.stagger)]);
  }
  if(preview.refund)items.push(['施放成功返还',`魔力 +${preview.refund}`]);
  if(preview.allShield)items.push(['追加全队护盾',`+${preview.allShield}（含自身）`]);
  if(effective.shield)items.push([effective.selfShield?'自身护盾':'全队护盾',`+${effective.shield} · 2 次敌方回合`]);
  if(effective.heal)items.push(['本次治疗',effective.self?`自身 +${effective.heal}`:skill.revive?`单体 +${effective.heal} / 救起 ${skill.revive}`:`最低比例 +${effective.heal}${effective.allHeal?` / 其余 +${effective.allHeal}`:''}`]);
  if(skill.regenTurns)items.push(['单体持续恢复',`回合末 +${skill.regenAmount||32} × ${skill.regenTurns} 次`]);
  if(effective.reflect)items.push([effective.selfShield?'自身钉刺待发':'全队钉刺待发',`+${effective.reflect} 层（上限 2）`]);
  items.push([h.resourceName,`${h.id==='ric'?signed(preview.resourceBefore):preview.resourceBefore} → ${h.id==='ric'?signed(preview.resourceAfter):preview.resourceAfter}`]);
  if(h.secondaryName)items.push([h.secondaryName,`${preview.secondaryBefore} → ${preview.secondaryAfter} / ${h.maxSecondary||6}`]);
  if(skill.cooldown)items.push(['冷却',h.cooldowns[skill.id]>0?`剩余 ${h.cooldowns[skill.id]} 轮`:`${skill.cooldown} 轮 · 就绪`]);
  if(skill.once)items.push(['使用限制',h.used.includes(skill.id)?'本轮已使用':'每轮一次 · 可用']);
  const detailNotes=[...preview.notes];
  if(skill.damage&&state.boss.core)detailNotes.unshift(requirements.solo?`独狼挑战只需用任意属性累计命中 ${requirements.coreHits} 次，即可完成核心净化。`:`核心阶段按命中次数净化，不按伤害量结算；物理需命中 ${requirements.corePhysical} 次，魔法需命中 ${requirements.coreMagic} 次。`);
  if(skill.damage&&state.boss.finale)detailNotes.unshift(requirements.solo?`独狼挑战需要用任意属性累计命中 ${requirements.finaleHits} 次，并准备任意战术应对；结束回合且存活后才能获胜。`:'终幕需要分别登记 1 次物理与魔法命中，并准备任意战术应对；结束回合、承受终幕攻击后完成胜利。');
  if(skill.damage&&!state.boss.core&&!state.boss.finale)detailNotes.unshift('预计值已计入当前抗性、标记、破韧、角色被动与成长；多段逐次计算层数变化。');
  if(effective.cleanse)detailNotes.push(`${effective.self||effective.selfShield&&!effective.heal?'自身':'全队'}共鸣 −${effective.cleanse} 层（最低 0）。`);
  if(effective.mark)detailNotes.push('标记在本次攻击后生效，强化本轮后续全队伤害；本次不会享受新施加的标记。');
  if(skill.pierce)detailNotes.push('穿透魔法抗性；仍享受裸冠、标记与破韧增伤。');
  const rewards=ownedRewards(state,h).filter(reward=>reward.skillId===id||[].concat(reward.affects||reward.skillIds||rewardSkills[reward.id]||[]).includes(id));
  const type=skillType(skill);
  return header(skill.icon,skill.name,`${h.youmuForm==='captain'?'游墓':h.short} · ${type.id==='support'?'辅助技能':type.label+'攻击'}`)
    +paragraph(explanation.cost,'tooltip-description tooltip-payment')
    +explanation.effects.map(effect=>paragraph(effect)).join('')
    +(preview.empowered&&!skill.manaRecovery?paragraph(`本次强化已生效：${preview.empowerReason}`,'tooltip-description tooltip-empowered'):'')
    +stats(items)+notes([...new Set([...explanation.conditions,...detailNotes])])
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
