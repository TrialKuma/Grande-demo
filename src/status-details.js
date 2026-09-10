import {HEROES,heroOf,skillOf,resolvedSkill,skillPreview,activeSkills,canUse,heroStatus,victoryRequirements,enemyTargets} from './combat.js';
import {SPECIMEN_NAMES} from './expedition-heroes.js';
import {icon} from './icons.js';
import {REWARDS} from './rewards.js';
import {ATTRIBUTE_NAMES,effectiveAttributes,attributeEffects} from './attributes.js';
import {skillGrowth,skillGrowthSummary,withoutResourcePayment} from './skill-growth-ui.js';
import {RESOURCE_SYMBOLS,resourceSymbol,skillResourceDeltas,resourceDeltaView,resourceRangeView,resourceBlocker,manaRecoveryDescription,manaRecoveryView} from './resource-ui.js';
import {actionPointInfo,ACTION_POINT_RULES} from './action-points.js';
import {ammoProfile} from './knibbs-passive.js';
import {RIC_PASSIVE} from './ric-passive.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=value=>value>0?`+${value}`:String(value);
const kindName=kind=>kind==='physical'?'物理':'魔法';
export function skillType(skill){const id=(skill?.damage>0||skill?.coverFire)&&['physical','magic'].includes(skill.kind)?skill.kind:'support';return {id,label:({physical:'物理',magic:'魔法',support:'辅助'})[id],icon:({physical:'blade',magic:'rune',support:'spark'})[id]};}
export function skillTypeBadge(skill){const type=skillType(skill);return `<span class="skill-type type-${type.id}" data-skill-type="${type.id}" aria-label="技能类型：${type.label}">${icon(type.icon)}${type.label}</span>`;}
export function shieldBatches(h){const layers=Array.isArray(h.shieldLayers)?h.shieldLayers.filter(layer=>layer.amount>0&&layer.turns>0).slice().sort((a,b)=>a.turns-b.turns):[];return layers.length?layers:h.shield>0?[{amount:h.shield,turns:2}]:[];}
const passiveIds={knibbs:'intuition',apeilia:'alternation',ric:'harmony',haart:'mindlink',qianxing:'silverflame',youmu:'surgeon',patch:'recorder'};
const ownedRewards=(state,h)=>Object.values(REWARDS).filter(reward=>reward.heroId===h.id&&(state.upgrades||[]).includes(reward.id));
const ownedEnemyEffects=(state,h,key)=>(state.enemies||[state.boss]).filter(enemy=>enemy&&!enemy.defeated&&!enemy.pendingSpawn&&enemy[key]?.actor===h.id);
const enemyName=(state,enemy)=>enemyTargets(state).find(target=>target.id===enemy.unitId)?.name||'指定敌人';

export const attributeEffectText=(unit,state)=>attributeEffects(unit,state).map(effect=>attributeText(effect.stats)).join('；');
export const attributeText=values=>Object.entries(values||{}).filter(([,value])=>value!==0).map(([key,value])=>`${ATTRIBUTE_NAMES[key]||key} ${signed(value)}`).join('、');
export const heroConceptDescription=h=>({
 knibbs:'话不多的老枪手，总会给自己留一颗合适的子弹。装填积攒直感，再选择用左轮打出弱者标记，或留着直感截击敌人；单发确认命中后可以连续追加。',
 apeilia:'爱逞强，也确实有一身火力。交替使用刀刃与双枪积攒连击，再用重火力收尾；战术重整能让她躲过一次攻击。',
 ric:'雷克习惯把局面控制在自己手里。正域强化自身，负域压制全场敌人；翻转领域得到的混沌，既能补一击，也能替他挡一下。',
 haart:'嫌麻烦的年轻院长，关键时刻却总能注意到旁人漏掉的细节。他把魔力编成念线，再拆解念线协同队友、扰乱敌人，并收回魔力。',
 qianxing:'潜行把情绪藏在战甲后面，出手却很果断。先给反应炉充能，再选择钉刺防护、精确拆解或集中火力；用掉充能时回收魔力。',
 youmu:'游木愿意救人，也懂得哪里下刀最有效。手术准备让他切下敌人的强化并保存标本；危急时可以付出生命，请游墓接管身体，以炮火和承伤打开局面。',
 patch:'补丁习惯先看清楚，再把重要的事记下来。书阵准备记录，钥刃用于观测；销毁记录时回魔，观测偏进攻，收录偏干扰。',
})[h.id]||h.bio||'';
function header(symbol,title,subtitle){
  return `<div class="tooltip-header">${icon(symbol)}<div><h3>${esc(title)}</h3>${subtitle?`<small>${esc(subtitle)}</small>`:''}</div></div>`;
}
function paragraph(text,cls='tooltip-description'){return `<p class="${cls}">${esc(text)}</p>`;}
const paragraphs=text=>String(text||'').split(/(?<=。)/).map(part=>part.trim()).filter(Boolean).map(text=>paragraph(text)).join('');
const damageFormula=values=>{
  const groups=[];
  for(const value of values||[]){const last=groups.at(-1);if(last?.value===value)last.count++;else groups.push({value,count:1});}
  return groups.map(({value,count})=>count>1?`${count} × ${value}`:String(value)).join(' + ');
};
function ammoDescription(id){
  const ammo=ammoProfile(id);
  return ammo.extraHits?`下一次左轮攻击额外追加 ${ammo.extraHits} 段${ammo.extraDamage?`各 ${ammo.extraDamage} 点基础物理伤害`:'弹种伤害'}。`:ammo.stripBuffs?`下一次左轮攻击驱散 ${ammo.stripBuffs} 层可消除强化；成功时返还 ${ammo.refundOnDispel} 气息并施加弱者标记。`:'发射普通左轮弹，不附加弹种效果。';
}
function stats(items){return `<div class="tooltip-stats">${items.map(([label,value])=>`<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('')}</div>`;}
function notes(items){return items.length?`<ul class="tooltip-notes">${items.map(text=>`<li>${esc(text)}</li>`).join('')}</ul>`:'';}
function badge(h,id,symbol,label,count,tone,aria){
  const compactCount=String(count??'').match(/[+−-]?\d+(?:\/\d+|%)?/)?.[0]||'';
  return `<button type="button" class="status-badge ${tone||''}" data-tooltip="status" data-owner="${esc(h.id)}" data-detail="${esc(id)}" aria-label="${esc(aria)}">${icon(symbol)}${label?`<span class="badge-label">${esc(label)}</span>`:''}${count!==undefined?`<span class="badge-count" data-count="${esc(compactCount)}">${esc(count)}</span>`:''}</button>`;
}

/** Status tokens describe existing combat state; rendering never changes it. */
export function statusBadges(state,h){
  if(typeof h==='string')h=heroOf(state,h);
  if(!h)return '';
  const result=[];
  if(h.secondaryName)result.push(badge(h,'secondary',resourceSymbol(h,true),h.secondaryName,`${h.secondary||0}/${h.maxSecondary}`,`active secondary-token secondary-token-${h.id} ${h.secondary>=h.maxSecondary?'ready good':''}`,`${h.secondaryName} ${h.secondary||0}/${h.maxSecondary}，悬浮查看回魔被动`));
  if(h.id==='knibbs'){
    const ammo=ammoProfile(h.ammo);
    result.push(badge(h,'ammo',`ammo-${ammo.id}`,ammo.name,undefined,ammo.id==='normal'?'active':'active good',`已装填：${ammo.name}，下一次左轮攻击发射`));
    const layers=h.intuition||0;
    result.push(badge(h,'intuition','crosshair','直感',`${layers}/3`,layers>=3?'active good':layers?'active':'inactive',`直感 ${layers}/3 层${layers>=3?'，可预备直感反制':layers?'，下一次左轮攻击追加伤害':''}`));
    if(h.followupReady||h.specialSpent)result.push(badge(h,'followup','followup','追加',undefined,'active good',h.followupReady?'确认命中：追加行动窗口已打开':'特殊弹已发射：可以重装填'));
  }else if(h.id==='apeilia'){
    const next=h.lastKind==='physical'?'魔':h.lastKind==='magic'?'物':'—';
    result.push(badge(h,'alternation',h.lastKind==='physical'?'rune':h.lastKind==='magic'?'blade':'twin','交替',next,h.lastKind?'active good':'inactive',h.lastKind?`交叉火力：下一次${next==='魔'?'魔法':'物理'}技能强化`:'交叉火力：尚未施放攻击技能'));
  }else if(h.id==='ric'){
    result.push(badge(h,'harmony',h.resource<0?'crosshair':h.resource>0?'blade':'resource-balance',h.resource<0?'负域':h.resource>0?'正域':'零域',signed(h.resource),h.resource?'active good':'inactive',`领域投影：${h.resource<0?'全体存活敌人四属性降低':h.resource>0?'自身四属性提高 4':'零点无领域效果'}，当前平衡 ${signed(h.resource)}`));
    if(h.ricEdge)result.push(badge(h,'edge','blade','剑势',`${h.ricEdge}次`,'active good',`剑势 ${h.ricEdge} 次，强化下一次剑式，跨回合保留`));
    if(h.ricChaos)result.push(badge(h,'chaos','chaos','混沌','1','active good','混沌：下一次攻击追加 12 伤害，或抵挡下一次命中的 12 伤害；共用一次'));
  }else if(h.id==='haart'){
  }else if(h.id==='qianxing'){
  }else if(h.id==='youmu'){
    result.push(badge(h,h.youmuForm==='captain'?'captain':'surgeon',h.youmuForm==='captain'?'flag':'heal',h.youmuForm==='captain'?'船长':'外科',h.youmuForm==='captain'?`${h.captainTurns}轮`:undefined,'active good',h.youmuForm==='captain'?`游墓接管：${attributeEffectText({youmuForm:'captain'})}，剩余 ${h.captainTurns} 轮`:'游木行医：手术准备、切除与标本移植'));
    if(h.surgicalReady)result.push(badge(h,'surgicalReady','surgical-ready','手术准备','1','active good','手术准备已完成：可以切除敌方护层，跨回合保留'));
    if(h.specimen)result.push(badge(h,'specimen','heal','标本','1份','active good',`${SPECIMEN_NAMES[h.specimen]}标本：移植手术已就绪`));
    if(!h.captainUsed&&h.hp>0&&activeSkills(state,h.id).some(skill=>skill.id==='bloodoath'))result.push(badge(h,'bloodoath','flag','血誓','可','active good','血誓可用：主动将生命降至40%，请船长接管并嘲讽两轮'));
  }else if(h.id==='patch'){
    result.push(badge(h,'recorder',h.patchForm==='record'?'book':'blade',h.patchForm==='record'?'收录':'观测',undefined,'active',`记录 ${h.secondary||0}/${h.maxSecondary}：${h.patchForm==='record'?'收录消耗记录时，被动回魔 3；侧重驱散与封锁':'观测消耗记录时，被动回魔 2；侧重进攻与易伤'}`));
  }
  const covered=ownedEnemyEffects(state,h,'cover'),confused=ownedEnemyEffects(state,h,'confusion'),recorded=ownedEnemyEffects(state,h,'recordedIntent');
  if(covered.length)result.push(badge(h,'cover','crosshair','反制',`${covered.length}次·本轮`,'active good','反制射击已预备：目标出手前射击，压制其本次攻击，本轮结束清除'));
  if(confused.length)result.push(badge(h,'confusion','rune','控念',`${confused.length}次·本轮`,'active good','杀意改写已施加：指定敌人的单体攻击转向其他敌人，力量与智力 −16'));
  if(recorded.length)result.push(badge(h,'recordedIntent','book','封录',`${recorded.length}次·本轮`,'active good','预告收录已生效：指定行动延后、力量与智力 −8，取消招式附效'));
  if(h.evasion>0)result.push(badge(h,'evasion','wind','闪避',`${h.evasion}次·本轮`,'active good','闪避就绪：本轮躲开下一段敌方攻击'));
  if(h.fieldCare>0)result.push(badge(h,'fieldCare','heal','包扎','1次·本轮','active good',`预备包扎：本轮受伤存活后回复 ${h.fieldCare} 生命，只触发一次`));
  if(h.reflect>0)result.push(badge(h,'reflect','blade','钉刺',`${h.reflect}次`,'active good',`钉刺待发 ${h.reflect}/2 层，受到物理攻击后回击，跨回合保留`));
  if(h.grace)result.push(badge(h,'grace','shield','余响','1次','active good','余响同调就绪：下一次肉身同调为 1 行动点、自身 38 护盾与 2 次剑势'));
  if(h.verdict)result.push(badge(h,'verdict','blade','清账','1次','active good','清账三连就绪：下一次剑式强化为三段物理伤害'));
  if(h.shield>0)result.push(badge(h,'shield','shield',`护盾${h.shield}`,`首批${shieldBatches(h)[0].turns}轮`,'active good',`护盾 ${h.shield} 点，最先到期批次剩余 ${shieldBatches(h)[0].turns} 次敌方回合；${shieldBatches(h).map(layer=>`${layer.amount}点剩余${layer.turns}次敌方回合`).join('；')}`));
  if(h.tauntTurns>0)result.push(badge(h,'taunt','target','嘲讽',`${h.tauntTurns}轮`,'active warning',`嘲讽 ${h.tauntTurns} 轮：单体主招优先攻击自己`));
  if(h.regenTurns>0)result.push(badge(h,'regen','heal','恢复',`${h.regenTurns}轮`,'active good',`持续恢复：回合末回复 ${h.regenAmount||32} 生命，剩余 ${h.regenTurns} 轮`));
  if(h.resonance>0)result.push(badge(h,'resonance','crystal','共鸣',`${h.resonance}/5`,'active warning',`共鸣 ${h.resonance}/5 层，满层会引发震荡`));
  for(const effect of attributeEffects(h,state)){
    if(['captain','ric_domain_positive'].includes(effect.id))continue;
    const symbols={strength:'blade',intelligence:'rune',agility:'shield',will:'spark'},main=Object.keys(effect.stats||{})[0];
    result.push(badge(h,effect.id,symbols[main]||'spark',effect.label,effect.charges?`${effect.charges}次·${effect.turns}轮`:`${effect.turns}轮`,`active ${effect.tone}`,`${effect.label}：${attributeText(effect.stats)}；剩余 ${effect.turns} 轮${effect.charges?`，${effect.charges} 次`:''}`));
  }
  if(h.control)result.push(badge(h,'control',h.control.type==='stun'?'break':'rune',h.control.label,h.control.turns,'active warning',`${h.control.label}：剩余 ${h.control.turns} 轮`));
  if(h.controlGuard>0)result.push(badge(h,'controlGuard','shield','抗控',h.controlGuard,'active good',`控制免疫：剩余 ${h.controlGuard} 轮`));
  if(h.hp<=0)result.push(badge(h,'down','close','倒下',undefined,'active warning','角色已倒下，可用应急药剂救起'));
  return result.join('');
}

export function passiveDetail(state,h){
  if(h.id==='youmu')return {symbol:'heal',name:h.passiveName,subtitle:h.youmuForm==='captain'?'游墓接管':'游木行医',description:'手术刀或清创整备完成外科准备。切除敌方护层后保存一个标本，同一技能位变为移植手术；准备和标本跨回合保留。血誓每战可用一次：生命降至上限的 40%，游墓接管并嘲讽两轮，技能切换为船长技能。接管时力量 +5、智力 −5、敏捷 +9、意志 +2；结束后虚脱两轮，力量、智力、敏捷各 −4。',facts:[]};
  if(['haart','qianxing','patch'].includes(h.id)){
    return {symbol:resourceSymbol(h,true),name:h.passiveName,subtitle:`魔力 ${h.resource}/${h.maxResource} · ${h.secondaryName} ${h.secondary||0}/${h.maxSecondary}`,description:manaRecoveryDescription(h),facts:[]};
  }
  if(h.id==='knibbs')return {
    symbol:'crosshair',name:'直感',subtitle:`永久被动 · 当前 ${h.intuition||0}/3 层`,
    description:'装填每实际消耗 2 气息，获得 1 层直感，上限 3 层。下一次左轮攻击消耗所有现有直感，每层追加 8 点独立伤害，并施加弱者标记；多段攻击不会重复计算。也可以消耗 3 层直感预备一次反制，不发射已装子弹。直感跨回合保留；普通射击不会积攒直感，也不会回复气息。',facts:[]
  };
  if(h.id==='apeilia')return {
    symbol:'twin',name:'交叉火力',subtitle:`永久被动 · ${h.lastKind?`上一次技能为${kindName(h.lastKind)}`:'尚未施放攻击技能'}`,
    description:'物理与魔法攻击技能交替施放时，本次对应攻击属性 +6、削韧 +6，并额外获得 1 连击。',
    facts:[]
  };
  return {
    symbol:'rune',name:'领域投影',subtitle:`平衡 ${signed(h.resource)} / ±10 · 每轮向零回 2`,
    description:`平衡为正时，自身力量、智力、敏捷、意志各 +${RIC_PASSIVE.positive}；为负时，全部存活敌人的四项属性各 ${state.upgrades?.includes('ric_erosion')?-4:RIC_PASSIVE.negative}。平衡归零或雷克倒下时，领域消失。平衡每轮向零恢复 2，不会自动跨到另一侧。由正变负或由负变正时获得一份混沌：下一次攻击追加 ${RIC_PASSIVE.chaos} 伤害，或抵挡下一次命中的 ${RIC_PASSIVE.chaos} 伤害，先触发的一项消耗它；本次敌方回合结束后失效。到达零点、从零出发都不会产生混沌。`,facts:[]
  };
}

function statusTooltip(state,h,id){
  const attribute=attributeEffects(h,state).find(effect=>effect.id===id);
  if(attribute?.dynamic)return header('rune',attribute.label,attribute.condition)+stats(Object.entries(attribute.stats).map(([key,value])=>[ATTRIBUTE_NAMES[key],signed(value)]))+paragraph('领域随当前平衡立即变化；回到零点或雷克倒下时消失，不能靠重复施放叠加。');
  if(attribute)return header(({attackBuff:'spark',protection:'shield',captain:'flag',exhaustion:'wind'})[id]||'rune',attribute.label,`剩余 ${attribute.turns} 轮${attribute.charges?` · ${attribute.charges} 次`:''}`)+stats(Object.entries(attribute.stats).map(([key,value])=>[ATTRIBUTE_NAMES[key],signed(value)]))+paragraph(id==='attackBuff'?'下一项主动伤害技能的每一段都获得属性加成，施放后消耗；反击与持续伤害不消耗。':id==='captain'?'当前四个技能位切换为船长技能。接管结束后进入两轮虚脱；嘲讽另行计时。':id==='exhaustion'?'船长接管结束后的疲惫状态。仍可使用治疗、防御和药剂。':id==='protection'?'本轮提升物理防御、魔法防御与控制抵抗；敌方回合结束后失效。同类防护保留较强的一项。':'属性效果在对应行动结算时生效，到期后清除。');
  if(id==='ammo'){
    const ammo=ammoProfile(h.ammo);
    return header(`ammo-${ammo.id}`,ammo.name,'已装子弹 · 跨回合保留')+paragraph(ammoDescription(ammo.id))+paragraph('下一次左轮攻击会发射当前子弹，随后恢复普通弹。重新装填会替换当前弹种；直感反制不会消耗子弹。');
  }
  if(id==='followup'){
    const used=new Set(h.followupUsed||[]),available=[];
    if(h.followupReady&&!used.has('load'))available.push('快速装填');
    if(h.followupReady&&!used.has('shot'))available.push('快速发射');
    if(h.specialSpent&&!used.has('reload'))available.push('重装填');
    return header('followup','左轮追加',available.length?`可用：${available.join('、')}`:'本次追加已用尽')+paragraph('单发确认命中后打开追加窗口。快速装填与快速发射各可追加一次；实际执行追加时恢复 1 气息。')+paragraph('特殊弹射出后，装填技能位暂时变为重装填，使用后恢复装填选项。窗口在本次敌方回合结束后关闭。');
  }
  if(id==='chaos')return header('chaos','混沌','共享一次 · 本次敌方回合结束后失效')+paragraph(`下一次攻击追加 ${RIC_PASSIVE.chaos} 伤害，或抵挡下一次命中的 ${RIC_PASSIVE.chaos} 伤害。先触发的一项消耗混沌，多段攻击和群体攻击不会重复追加。`)+paragraph('仅当平衡由正变负或由负变正时获得；再次翻转只刷新这一份，不能储存多份。');
  if(id==='surgicalReady')return header('surgical-ready','手术准备','已就绪 · 跨回合保留')+paragraph('下一次切除手术可以切下敌人的护层，保存为标本并让该技能位变为移植手术。')+paragraph('敌人没有可切除护层时，改为清创攻击，不会生成标本。');
  if(id==='control')return header(h.control?.type==='stun'?'break':'rune',h.control?.label||'控制',`剩余 ${h.control?.turns||0} 轮`)+paragraph(h.control?.type==='stun'?'本回合无法使用技能。药剂可以解除；其他队员仍能行动。':'本回合无法使用魔法攻击，仍可使用物理攻击和辅助技能。药剂可以解除。');
  if(id==='controlGuard')return header('shield','控制免疫',`剩余 ${h.controlGuard} 轮`)+paragraph('控制结束或被解除后获得短暂免疫，期间不会再次受到眩晕或封术。');
  if(id==='cover')return header('crosshair','直感反制','每个目标 1 次 · 本轮有效')+paragraph('在指定敌人行动前射击、削韧并施加弱者标记；未能打断时，也使其本次行动的力量与智力各降低 18。')+stats(ownedEnemyEffects(state,h,'cover').map(enemy=>[enemyName(state,enemy),`${enemy.cover.damage} 基础物理 / 削韧 ${enemy.cover.stagger}`]))+paragraph('反制不会发射已装子弹。尼布斯倒下、目标已被打断或击败时取消；未触发的准备在本次敌方回合结束后清除。');
  if(id==='confusion')return header('rune','杀意改写','每个目标 1 次 · 本轮有效')+paragraph('指定敌人本次行动的力量与智力各降低 16，单体攻击还会转向另一名存活敌人；只有一个敌人或发动群体攻击时不转向。')+stats(ownedEnemyEffects(state,h,'confusion').map(enemy=>['受影响的敌人',enemyName(state,enemy)]))+notes(['该敌人本次行动结束后清除；控制、破韧导致它跳过行动时也会清除。','改写攻击目标本身不会取消敌人招式附带的回复或召唤。']);
  if(id==='recordedIntent')return header('book','预告收录','每个目标 1 次 · 本轮有效')+paragraph('把已记录的敌方行动排到其他敌人之后，力量与智力各降低 8，并取消该招附带的回复、召唤、供电和资源抽取等效果。')+stats(ownedEnemyEffects(state,h,'recordedIntent').map(enemy=>['已记录的敌人',enemyName(state,enemy)]))+notes(['只影响施放时记录的那项预告。若预告因阶段变化而改变，新招式不会受到属性削弱或附效封锁。','该敌人行动结束后清除；不能取消核心或终幕的阶段规则。']);
  if(id==='evasion')return header('wind','战术闪避',`剩余 ${h.evasion} 次 · 本轮有效`)+paragraph('躲开下一段敌方攻击。多段攻击只躲其中一段，后续命中仍须承受；适合应对单发重击。')+notes(['未消耗的闪避在本次敌方回合结束时清除。']);
  if(id==='fieldCare')return header('heal','预备包扎',`1 次 · 本轮受伤存活后回复 ${h.fieldCare} 生命`)+paragraph('先承受伤害，生命确实降低且仍存活后才执行包扎；护盾完全挡住攻击时不触发。它不能救回被这次攻击击倒的角色。')+notes(['由清创整备提供，只为自己包扎一次；未触发的准备在本次敌方回合结束时清除。']);
  if(id==='secondary')return header(resourceSymbol(h,true),h.secondaryName||'二级资源',`当前 ${h.secondary||0} / ${h.maxSecondary}`)+manaRecoveryView(h);
  if(id==='taunt')return header('target','嘲讽',`剩余 ${h.tauntTurns} 轮`)+paragraph('敌人的单体主招优先攻击该角色，当前预告会立即显示新的目标。')+notes(['群体攻击仍会命中所有目标。','普通额外追击不受嘲讽影响；嘲讽本身不提供减伤。']);
  if(id==='regen')return header('heal','持续恢复',`回合末 +${h.regenAmount||32} 生命 · 剩余 ${h.regenTurns} 轮`)+paragraph('每次回合末为这个角色恢复生命。没有即时治疗，也不会治疗其他队员。')+notes(['角色必须存活才能获得恢复；这个状态不会自动复活倒下队员。','剩余次数在回合末结算后减少。']);
  if(id==='edge')return header('blade','剑势',`剩余 ${h.ricEdge} 次`)+paragraph('由肉身同调提供。即使平衡已经回落，剑势仍使下一次剑式变为斩影；施放强化剑式消耗一次，最多保存两次。');
  if(id==='specimen')return header('heal','外科标本',SPECIMEN_NAMES[h.specimen]||'尚未取得')+paragraph('已切除的敌方护层被保存为一个标本。原切除技能位变为移植手术，消耗 2 气息与 2 AP，为全队提供护盾并治疗；完成后标本消失。')+notes(['标本跨回合保留，不增加新的施法资源。','不同标本当前提供相同移植收益；不能移植 BOSS 阶段或控制免疫。']);
  if(id==='bloodoath')return header('flag','血誓就绪','主动降至 40% · 每战一次')+paragraph('将当前生命降至最大值的 40%，获得两轮护盾，让游墓接管并嘲讽两轮；已经低于 40% 时不会再扣血。四个技能位随接管切换为船长技能，沉渊炼狱号会提前结束接管。');
  if(id===passiveIds[h.id]||id==='passive'){
    const passive=passiveDetail(state,h);
    return header(passive.symbol,passive.name,passive.subtitle)+(h.secondaryName?manaRecoveryView(h):`<div class="tooltip-mechanism">${paragraphs(passive.description)}</div>`);
  }
  if(id==='reflect')return header('blade','钉刺待发',`当前 ${h.reflect||0} / 2 层`)+paragraph('受到敌方物理攻击后，存活角色消耗 1 层钉刺，自动回击 28 基础物理伤害。护盾完全挡住伤害也能触发。')+notes(['由潜行的钉刺护甲提供，可跨回合保留。魔法攻击不会触发或消耗。','反击计入自己的力量，并减去敌人的敏捷，也能释放蓄电、削减孢压或参与双系同步。']);
  if(id==='grace')return header('shield','余响同调','成长强化 · 待消耗')+paragraph('下一次肉身同调只消耗 1 行动点，自身护盾提高至 38，并获得 2 次剑势；仍使平衡 +4，净化自身 1 层共鸣。')+paragraph('获得此成长后，平衡真正翻转到另一侧时获得余响；使用肉身同调后消耗。');
  if(id==='verdict')return header('blade','清账三连','成长强化 · 待消耗')+paragraph('下一次剑式变为 3 × 24 基础物理伤害、削韧 20，消耗 1 行动点，平衡 +2。')+paragraph('获得此成长后，平衡真正翻转到另一侧时获得清账。剑式消耗清账；若持有剑势，也消耗一次剑势。');
  if(id==='shield')return header('shield','护盾',`当前 ${h.shield} / 60 · ${shieldBatches(h).length} 批`)+paragraph('新护盾分别持续 2 次敌方回合；每批独立倒计时，优先吸收快到期批次。先计算属性防御，再扣护盾，耗尽后才扣生命。')+notes([...shieldBatches(h).map((layer,i)=>`第 ${i+1} 批：${layer.amount} 点，剩余 ${layer.turns} 次敌方回合${layer.turns===1?'，本次敌方回合结束后到期':''}。`),'即使敌人被打断或控制，本轮结束仍会扣除持续时间；重新施盾不会刷新旧批次。','每人护盾总量上限为 60。各技能分别说明保护自身、单体或全队。']);
  if(id==='resonance')return header('crystal','元素共鸣',`当前 ${h.resonance} / 5 层 · 负面状态`)+paragraph('巨人的物理攻击每次命中会使存活目标增加 1 层共鸣；场上仍有迷雾时，回合结束会再为存活队员增加 1 层。')+notes(['敌方行动结束后，达到 5 层会承受 25 基础魔法伤害并清空层数；实际伤害受难度、防御、护盾与其他承伤状态影响。','游木的战地急救清除单个治疗目标 2 层；雷克的深渊虚影清除全队 1 层。其他净化技能各自说明范围，应急药剂清空目标共鸣。','巨人的元素回收会按队伍共鸣总层数恢复生命；先净化可减少回复量。']);
  if(id==='down')return header('close','角色倒下','无法施放技能或获得通常治疗')+paragraph('点击该角色头像，再使用应急药剂，可使其重新站起并回复 60 生命，共鸣清零。')+notes(['应急药剂消耗 1 行动点与 1 份补给。','游木在医生形态使用战地急救，也会优先救起一名倒下队员，恢复 30 生命。','全队倒下时战斗失败。']);
  return '';
}

export function heroResourceDescription(h){
  const burstCost=id=>skillOf('apeilia',id)?.cost??0;
  if(['haart','qianxing','patch'].includes(h.id))return `魔力上限 ${h.maxResource}，${h.secondaryName}上限 ${h.maxSecondary}。先花行动点和魔力准备${h.secondaryName}，再使用它换取强效果。成功消耗二级资源后，由角色被动回魔；魔力不会随回合自动恢复。`;
  return ({
    knibbs:`气息上限 ${h.maxResource}，每轮恢复 2。装填消耗气息并积攒直感；普通射击不回气，实际追加动作恢复 1 气息。`,
    apeilia:`连击上限为 ${h.maxResource} 点。螳螂刀与炼净双枪积攒连击，伊甸之约消耗 ${burstCost('eden')} 点，地狱哨兵消耗 ${burstCost('sentinel')} 点。物理与魔法交替时还能多获得 1 点连击。`,
    ric:'平衡范围 −10 至 +10，每轮向零回 2。正值强化自身，负值压制敌人；真正翻转正负才能获得混沌。',
    youmu:`气息上限 ${h.maxResource}，每轮恢复 2。手术准备、切除与标本移植构成医生的循环；血誓让游墓接管，切换四项技能。`
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
  else payment+=h.id==='ric'?'。':`，不消耗${h.resourceName}。`;
  const recovery=secondaryCost?`本次成功消耗${h.secondaryName}后，「${h.passiveName}」回复 ${p.resourceGain??p.refund??s.manaReturn??0} 魔力，只结算一次${h.id==='patch'?`，按出手前的${h.patchForm==='record'?'收录':'观测'}姿态结算`:''}；超出上限的部分损失。`:s.manaBasic?'无库存的普通攻击不回魔；持有库存时自动使用一份强化，并触发回魔。':'';
  if(recovery)conditions.push(recovery);
  if(secondaryGain)effects.push(`生成 ${secondaryGain} 点${h.secondaryName}，上限为 ${h.maxSecondary||6}；库存装不下时不能施放。`);
  if(s.manaEmergency)conditions.push('魔力和二级资源同时耗尽时，独立准备技能变为应急准备；没有攻击、防护或治疗效果。');
  if(s.damage){
    const hits=s.hits||1,formula=damageFormula(p.hitDamages?.length?p.hitDamages:Array(hits).fill(number(s.damage)));
    if(state.boss.core||state.boss.finale)effects.push(`攻击当前敌人${hits>1?`${hits}次`:'一次'}，${requirements.solo?'将每次命中计入当前要求':'记录对应属性的命中次数'}。这个阶段按命中次数判断，不会按伤害数字推进。`);
    else effects.push(`攻击当前敌人${hits>1?`${hits}次`:'一次'}，造成 ${formula} ${kindName(s.kind)}伤害，并削减 ${s.stagger||0} 点韧性。实际伤害和削韧会受到敌方状态影响。`);
  }
  if(s.loadAmmo){
    if(s.variant==='knibbs_reload')effects.push('填入普通弹，结束特殊弹后的重装填状态；该槽恢复为原来的装填技能。');
    else{
      effects.push(`填入${ammoProfile(s.loadAmmo).name}，替换已装子弹。${ammoDescription(s.loadAmmo)}`);
      effects.push(`装填获得 ${p.intuitionGain||s.knibbsPlan?.intuitionGain||Math.floor(cost/2)} 层直感，上限 3 层。`);
    }
    conditions.push('单发确认命中后可快速装填；特殊弹射出后，此槽暂时变为重装填。');
  }
  if(h.id==='knibbs'&&id==='focus')effects.push('命中后打开追加窗口。目标已有弱者标记时，额外造成 12 加目标正向力量的独立伤害。');
  if(p.intuitionDamage)effects.push(`直感额外造成 ${p.intuitionDamage} 点独立伤害，多段不重复计算。`);
  if(p.coverFire)effects.push(`预备对选中敌人的反制射击：它行动前造成 ${p.counterDamage} 基础物理伤害、削韧 ${p.counterStagger}，并施加弱者标记。未打断时也使其本次行动的力量与智力各降低 18，反制后消耗准备；不会发射已装子弹。`);
  if(p.confuse)effects.push('干扰选中敌人的杀意：下一次单体攻击转向另一名敌人；本次行动的力量与智力各降低 16；只有一名敌人或群体攻击时不转移目标。');
  if(p.recordIntent)effects.push('记下选中敌人的当前预告：它的这次行动移到其他敌人之后，力量与智力各降低 8，并取消该次行动附带的回复、召唤等效果。');
  if(p.evasion)effects.push(`让自己躲开下一段敌方攻击，获得 ${p.evasion} 次闪避。它适合单发重击，多段攻击的剩余命中仍然有效。`);
  if(p.fieldCare)effects.push(`为自己准备受击后的急救：承受伤害后仍存活，便回复 ${p.fieldCare} 生命。无法抢救被这次攻击击倒的人。`);
  if(p.targeting==='all')effects.push('命中全部存活敌人，逐个计算各自的抗性与状态；只支付一次行动点和施法资源，角色被动也不会按目标数重复触发。');
  if(p.heal){
    if(s.revive)effects.push(`优先救起一位倒下的队员，使其恢复 ${s.revive} 生命；无人倒下时，为生命比例最低的存活队员恢复 ${p.heal} 点。一次只处理一位队员。`);
    else if(p.self)effects.push(`为自己恢复 ${p.heal} 点生命。`);
    else if(p.heal===p.allHeal)effects.push(`为所有存活队员各恢复 ${p.heal} 点生命。`);
    else effects.push(`自动为生命比例最低的存活队员恢复 ${p.heal} 点生命${p.allHeal?`，其余存活队员各恢复 ${p.allHeal} 点生命`:'，不需要手动选择治疗目标'}。`);
  }
  if(p.shield)effects.push(`为${p.selfShield?'自己':'所有存活队员各'}提供 ${p.shield} 点护盾，独立持续 2 次敌方回合。每人总量最多 60 点，新护盾不会刷新旧批次的期限。`);
  if(p.allShield)effects.push(`额外为所有存活队员各提供 ${p.allShield} 点护盾，包括施放者自己，独立持续 2 次敌方回合。`);
  if(p.personalProtection)effects.push(`本轮使自己${attributeEffectText({protection:Math.max(p.personalProtection,p.protection)})}，其余存活队友${attributeEffectText({protection:p.protection})}；敌方回合结束后失效。`);
  else if(p.protection)effects.push(`本轮使${p.selfProtection?'自己':'所有存活队员'}${attributeEffectText({protection:p.protection})}；敌方回合结束后失效，同类防护取最高值。`);
  if(p.cleanse)effects.push(`清除${p.self||p.selfShield&&!p.heal?'自身':'所有存活队员'}的 ${p.cleanse} 层共鸣，最低降至零层。`);
  if(p.allCleanse||s.allCleanse)effects.push(`为所有存活队员各清除 ${p.allCleanse||s.allCleanse} 层共鸣。`);
  if(s.targetCleanse)effects.push(`清除本次抢救目标 ${s.targetCleanse} 层共鸣；其他队员不受影响。`);
  if(s.regenTurns)effects.push(`为生命比例最低的存活队员提供持续恢复：之后 ${s.regenTurns} 次回合末各恢复 ${s.regenAmount||32} 生命。没有即时治疗，不能救起倒下队员；重复施放只刷新持续时间，不叠加恢复量。`);
  if(s.attackBuff||s.selfAttackBuff)effects.push(`使${s.selfAttackBuff?'自己':'每位存活队员'}${attributeEffectText({attackBuff:s.selfAttackBuff||s.attackBuff})}，对下一项主动伤害技能的每段攻击生效；${s.attackBuffTurns||2} 轮内未使用则失效。反击与持续伤害不消耗，重复强化保留较强的一次。`);
  if(s.vulnerable)effects.push(`使敌人${attributeEffectText({vulnerable:2})}，持续两轮；本次攻击也享受属性削弱。`);
  if(s.hardControl)effects.push('尝试封锁敌人的下一次普通行动，须通过目标的意志抵抗判定；成功后敌人有一完整轮抗控。不能影响核心、终幕、已破韧或已有抗控的敌人，不与破韧重复跳过行动，也不提供破韧增伤。');
  if(s.dotDamage)effects.push(`为敌人留下创口，之后两次敌人行动后各造成 ${s.dotDamage} 基础物理伤害；实际数值按结算时的敌方状态计算。创口不叠加、不拆护层，也不计入核心命中。`);
  if(s.healSuppression)effects.push(`使敌人${attributeEffectText({healSuppression:s.healSuppression})}，持续 ${s.healSuppression} 轮。`);
  if(s.stripBuffs)effects.push(`清除敌人最多 ${s.stripBuffs} 层可驱散的强化。阶段、抗控与普通生命值不属于可驱散强化。`);
  if(s.aftercare)effects.push(`将本次治疗目标的共鸣清零，并使其${attributeEffectText({attackBuff:25})}；下一项主动攻击生效，两轮后失效。`);
  if(s.gain)effects.push(`施放后回复 ${s.gain} 点${h.resourceName}，不会超过资源上限。`);
  if(s.shift&&!s.resetBalance&&!s.crossing)effects.push(`使平衡${s.shift>0?'增加':'减少'} ${Math.abs(s.shift)} 点；领域随新平衡变化，真正翻转正负时获得混沌。`);
  if(s.resetBalance)effects.push('将平衡恢复到零，领域消失；归零不会生成混沌。');
  if(s.crossing)effects.push('将当前平衡翻转到另一侧并获得混沌。平衡必须非零且绝对值小于 6。');
  if(p.mark)effects.push('命中后施加弱者标记，持续至本次敌方回合结束。');
  if(s.edge)effects.push(`获得 ${s.edge} 次剑势，用于强化之后的剑式。即使平衡回落，保存的剑势仍然有效。`);
  if(s.weaken)effects.push(`使敌人${attributeEffectText({weakened:true})}，持续到本次敌方回合结束。同类削弱不叠加。`);
  if(s.insight)effects.push('造成生命损失后施加破绽提醒：目标敏捷 −8，持续至本次敌方回合结束；同类效果不叠加。');
  if(p.reflect)effects.push(`获得 ${p.reflect} 次钉刺反击，最多保存两次。受到物理攻击并存活时，自动回击 28 基础物理伤害；魔法攻击不会触发。`);
  if(s.surgicalSetup)effects.push('完成外科准备，之后可以使用切除手术；准备状态可以跨回合保留。');
  if(s.surgery)conditions.push('需要先使用手术刀。最多切除两层镜片、孢压、蓄电、封页或迷雾，并保存一个标本；之后同一技能位变为移植手术。若敌人没有可切除的护层，则进行更强的清创攻击，不产生标本。不能转移敌人的阶段或抗控规则。');
  if(s.variant==='transplant'||s.transplant)effects.push('使用已保存的标本完成移植。完成后标本消失，需要重新用手术刀准备下一次切除。');
  if(s.transform)conditions.push('主动将生命降至最大值的 40%，已经低于该值时不再扣血，每战一次。游墓接管并嘲讽两轮，四项技能变为船长技能，力量 +5、智力 −5、敏捷 +9、意志 +2；单体主招优先攻击自己，群体攻击与额外追击不改变目标。退出后虚脱两轮，力量、智力、敏捷各 −4。');
  if(s.captainFinish)conditions.push('炮击后立即结束船长接管，并进入两轮虚脱。请先考虑敌人的下一次攻击。');
  if(s.patchStance==='observe')effects.push('切换为观测姿态，兑现技能侧重物理进攻与暴露破绽。');
  if(s.patchStance==='record')effects.push('切换为收录姿态，兑现技能侧重驱散、净化与行动封锁。');
  if(h.id==='knibbs'&&s.damage)conditions.push('左轮攻击发射当前弹种，并消耗所有现有直感追加独立伤害、施加弱者标记；每次技能只兑现一次直感。');
  if(h.id==='apeilia'&&s.damage)conditions.push('物理与魔法攻击交替时，本次对应攻击属性提高 6 点，削韧增加 6 点，并额外获得 1 点连击。交替状态可以跨回合保留。');
  if(h.id==='ric'&&id==='rune')conditions.push('施放前平衡至少为 +4，或仍持有剑势时，会自动变为强化剑招。持有剑势时会使用一次剑势。');
  if(h.id==='ric'&&id==='bind')conditions.push('施放前平衡不高于 −4，或敌人带有进攻受扰状态时，会自动变为两段封行咒弹。');
  if(s.interrupt)conditions.push('可以取消预告中标为「可打断」的敌方蓄力；敌人拥有抗控状态时无法打断，最终终幕也不能被取消。');
  if(s.pierce)conditions.push('这次攻击无视魔法抗性，仍会受到标记、破韧和其他增伤效果影响。');
  if(s.once)conditions.push('每轮只能使用一次，下一轮开始时重新可用。');
  if(s.cooldown)conditions.push(`施放后进入 ${s.cooldown} 轮冷却，需等冷却结束才能再次使用。`);
  if(s.unlockKey)conditions.push(`需要先获得「${REWARDS[s.unlockKey]?.name||'对应的新技能奖励'}」，再把它装入四个技能位之一。`);
  return {cost:payment,effects,conditions,recovery};
}

function heroTooltip(state,h){
  const base=HEROES.find(entry=>entry.id===h.id)||h;
  const symbols={knibbs:'crosshair',apeilia:'twin',ric:'rune',haart:'book',qianxing:'shield',youmu:h.youmuForm==='captain'?'flag':'heal',patch:'clock'};
  const passive=passiveDetail(state,h);
  const rewards=ownedRewards(state,h);
  return header(symbols[h.id]||'spark',h.youmuForm==='captain'?'游墓':base.name,`${h.youmuForm==='captain'?'船长接管':base.role} · ${base.tag}`)
    +stats([['生命',`${h.hp} / ${h.maxHp}`],['护盾',`${h.shield} / 60`],[h.resourceName,h.id==='ric'?`${signed(h.resource)}（−10 ～ +10）`:`${h.resource} / ${h.maxResource}`],...(h.secondaryName?[[h.secondaryName,`${h.secondary||0} / ${h.maxSecondary||6}`]]:[])])
    +`<div class="tooltip-mechanism">${paragraphs(heroConceptDescription(h))}</div>`
    +(rewards.length?paragraph('已获得的成长')+notes(rewards.map(reward=>`${reward.name}：${reward.description}`)):'');
}

// Detailed learning remains in the journal; battle hovers show effects and a compact cost diagram.
function battleSkillEffects(state,h,skill,preview,explanation){
  const resourceNames=['气息','魔力','连击',h.secondaryName].filter(Boolean).join('|');
  const resourceEffect=new RegExp(`^(生成 .*(${resourceNames})|施放后回复 .*(${resourceNames})|使平衡|将平衡|将当前平衡)`);
  const effects=explanation.effects.filter(effect=>!effect.startsWith('攻击当前敌人')&&!resourceEffect.test(effect)&&!effect.startsWith('命中全部存活敌人')&&!effect.startsWith('装填获得')&&!effect.startsWith('直感额外造成')).map(effect=>effect
    .replace('实际傷害和削韧会受到敌方状态影响。','')
    .replace('每人总量最多 60 点，新护盾不会刷新旧批次的期限。','')
    .replace('它适合单发重击，多段攻击的剩余命中仍然有效。','多段攻击只闪避一段，本轮结束失效。')
    .replace('即使平衡回落，保存的剑势仍然有效。','')
    .replace('，不需要手动选择治疗目标','')
    .replace(/；成功时返还 \d+ 气息并/,'；成功时')
    .replace('并满足雷克强化枪式的条件。','')
    .replace('切换为观测姿态，兑现技能侧重物理进攻与暴露破绽。','切换为观测姿态。')
    .replace('切换为收录姿态，兑现技能侧重驱散、净化与行动封锁。','切换为收录姿态。'));
  if(skill.manaEmergency||skill.variant==='mana_conversion')effects.push('只完成准备，不附带攻击、防护或治疗效果。');
  if(preview.fieldCare)effects.push('同时完成切除准备，并使敌人意志降低 5，持续两轮；包扎只触发一次，本轮结束失效。');
  if(skill.surgery)effects.push('需要外科准备。最多切除两层镜片、孢压、蓄电、封页或迷雾，保存一个标本并将此槽变为移植手术；没有可切除护层时改为清创，不生成标本。');
  if(skill.transform)effects.push('主动将生命降至最大值的 40%，已低于此值时不扣血，每战一次。游墓接管并嘲讽两轮，四项技能切换为船长技能，力量 +5、智力 −5、敏捷 +9、意志 +2；退出后虚脱两轮，力量、智力、敏捷各 −4。');
  if(skill.captainFinish)effects.push('炮击后立即结束船长接管，并进入两轮虚脱。');
  if(skill.interrupt)effects.push('打断可打断的蓄力；抗控与最终终幕不受影响。');
  if(skill.deviceInterrupt)effects.push('目标为装置且未抗控时，直接打断其可打断的蓄力。');
  if(skill.pierce)effects.push('无视目标的魔法防御。');
  if(skill.execute)effects.push('目标生命不高于 30% 时，伤害额外提高 40%。');
  if(h.id==='ric'&&skill.id==='rune')effects.push('平衡至少 +4 或持有剑势时强化；有剑势时消耗一次。');
  if(h.id==='ric'&&skill.id==='bind')effects.push('平衡不高于 −4 或目标进攻受扰时，变为两段封行咒弹。');
  if(skill.crossing)effects.push('平衡非零且绝对值小于 6 时可用。此次攻击使用当前领域，攻击结束后翻转平衡，生成下一份混沌。');
  if(h.id==='patch'&&skill.id==='revelation'&&!skill.manaRecovery)effects.push(h.patchForm==='record'?'收录姿态：驱散强化；至少 8 条记录时额外封锁一次普通行动。':'观测姿态：每条记录产生一段穿透攻击。');
  if(state.boss.core&&skill.damage)effects.push('每段攻击登记一次对应属性的核心命中。');
  if(state.boss.finale&&skill.damage)effects.push('攻击登记对应属性的终幕命中。');
  return effects.map(withoutResourcePayment).filter(Boolean);
}

const graphStats=items=>`<div class="tooltip-stats">${items.map(([label,value])=>`<div><small>${esc(label)}</small><strong>${value}</strong></div>`).join('')}</div>`;
function growthDetail(reward){
  const summary=skillGrowthSummary(reward),cost=summary.cost;
  const diagram=cost?`<span class="tooltip-growth-cost" role="img" aria-label="${esc(cost.name)}费用 ${cost.before} → ${cost.after}">${icon(RESOURCE_SYMBOLS[cost.name==='AP'?'ap':'mana'].symbol,'resource-symbol')}<span>${cost.before}</span>${icon('arrow')}<span>${cost.after}</span></span>`:'';
  return `<div class="growth-detail"><strong>${esc(reward.name)}</strong><p>${esc(summary.text)}</p>${diagram}</div>`;
}
function skillTooltip(state,h,id){
  const skill=resolvedSkill(state,h.id,id);if(!skill)return '';
  const preview=skillPreview(state,h.id,id),blocked=canUse(state,h.id,id),explanation=skillExplanation(state,h,id),type=skillType(skill);
  const ap=Math.max(0,preview.ap??skill.ap??0),items=[['AP 消耗',`<span class="tooltip-ap-pips" data-insufficient="${state.ap<ap}" role="img" aria-label="消耗 ${ap} AP">${Array.from({length:ap},()=>'<i></i>').join('')||'<small>0</small>'}</span>`]];
  if(skill.damage||preview.coverFire){
    const base=preview.coverFire?preview.counterDamage:preview.baseDamage??skill.damage;
    const bonus=preview.coverFire?effectiveAttributes(h,state).strength:(preview.attributeBonus??effectiveAttributes(h,state)[skill.kind==='magic'?'intelligence':'strength']);
    const varied=!preview.coverFire&&preview.hitDamages?.length&&new Set(preview.hitDamages).size>1;
    const formula=varied?damageFormula(preview.hitDamages):String(Number(Number(base).toFixed(2)));
    items.push([`基本${kindName(skill.kind||'physical')}伤害`,`${formula}${bonus?` <span class="tooltip-attribute-change">(${signed(bonus)}${varied?' / 段':''})</span>`:''}`]);
    items.push(['攻击段数',`${preview.coverFire?1:preview.hits||1} 段`]);
    items.push(['预计削韧',String(state.boss.core||state.boss.finale?'—':preview.coverFire?preview.counterStagger:preview.stagger||0)]);
    if(preview.intuitionDamage)items.push(['直感追加伤害',`${preview.intuitionDamage} <small>独立一次</small>`]);
    if(preview.markBonus)items.push(['弱者追加伤害',`${preview.markBonus} <small>独立一次</small>`]);
    if(preview.chaosDamage)items.push(['混沌追加伤害',`${preview.chaosDamage} <small>独立一次</small>`]);
  }
  const deltas=skillResourceDeltas(state,h,skill,preview);
  items.push([h.secondaryName&&preview.secondarySpend>0?'魔力 · 被动回魔':h.resourceName,resourceRangeView(h,preview,deltas)]);
  if(h.id==='knibbs'&&deltas.some(delta=>delta.kind==='intuition'))items.push(['直感',deltas.filter(delta=>delta.kind==='intuition').map(resourceDeltaView).join('')]);
  if(h.secondaryName)items.push([h.secondaryName,resourceRangeView(h,preview,deltas,true)]);
  const conditions=[];
  if(skill.cooldown)conditions.push(h.cooldowns?.[skill.id]>0?`冷却剩余 ${h.cooldowns[skill.id]} 轮`:`冷却 ${skill.cooldown} 轮`);
  if(skill.once)conditions.push(h.used.includes(skill.id)?'本轮已使用':'每轮一次');
  const growth=skillGrowth(state,h.id,id),empower=withoutResourcePayment(String(preview.empowerReason||'').replace('使用一份二级资源强化本次普通攻击，并触发角色的回魔被动。','').replace(/，实际追加回复 \d+ 气息/g,''));
  return header(skill.icon,skill.name,`${h.youmuForm==='captain'?'游墓':h.short} · ${type.id==='support'?'辅助技能':type.label+'攻击'}${preview.targeting==='all'?' · 全体':''}`)
    +graphStats(items)
    +manaRecoveryView(h,{compact:true,spent:preview.secondarySpend||0})
    +battleSkillEffects(state,h,skill,preview,explanation).map(effect=>paragraph(effect)).join('')
    +(conditions.length?paragraph(conditions.join(' · '),'tooltip-footnote'):'')
    +(preview.empowered&&!skill.manaRecovery&&empower?paragraph(`本次强化：${empower}`,'tooltip-description tooltip-empowered'):'')
    +(growth.length?`<section class="tooltip-growth"><h4>${'★'.repeat(growth.length)} 已获得的技能强化</h4>${growth.map(growthDetail).join('')}</section>`:'')
    +(blocked&&!resourceBlocker(blocked)?paragraph(`当前不可施放：${blocked}`,'tooltip-blocked'):'');
}

/** The tooltip controller owns visibility, position and ARIA linkage. */
export function tooltipView(state,kind,owner,detail=''){
  if(kind==='action-points'){
    const ap=actionPointInfo(state);
    return header('resource-ap',detail==='end'?'结束回合':'队伍行动点',`当前 ${state.ap} / ${state.maxAp}`)+paragraph(`本轮由基础 ${ap.base} 点与上轮保留的 ${ap.carry} 点组成。`)+paragraph(`现在结束回合，会留下 ${ap.nextCarry} 点；下一轮获得 ${ap.nextTotal} 点行动点。`)+paragraph(`最多保留 ${ACTION_POINT_RULES.carryLimit} 点，保留行动点不会延长护盾或阶段倒计时。`);
  }
  const h=heroOf(state,owner);if(!h)return '';
  if(kind==='skill')return skillTooltip(state,h,detail);
  if(kind==='hero')return heroTooltip(state,h);
  if(kind==='status')return statusTooltip(state,h,detail);
  return '';
}
