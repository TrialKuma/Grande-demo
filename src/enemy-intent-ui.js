import {attackSpec,enemyThreats,bossSummary,victoryRequirements,BOSSES} from './combat.js';
import {icon} from './icons.js';
import {ATTRIBUTE_NAMES,attributeEffects,effectiveAttributes,attackAttribute,controlResistance} from './attributes.js';
import {comboPlan} from './boss-combos.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const peopleIcon=()=>'<svg class="icon intent-people-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="6" r="3"/><path d="M6 21v-4a6 6 0 0 1 12 0v4M4 5a3 3 0 0 0 0 6M2 20v-4a4 4 0 0 1 3-4M20 5a3 3 0 0 1 0 6M22 20v-4a4 4 0 0 0-3-4"/></svg>';
const effectByIntent={
 relay_feed:'为仍存活的同伴供能。',spore_feed:'攻击后为存活的司祭恢复生命。',
 fog:'释放迷雾，魔法命中可以逐层驱散。',reclaim:'吸收队伍的共鸣，并据此恢复生命。',
 rend:'攻击后补充一面镜片。',mirror:'有镜片时，物理攻击会触发反噬；魔法命中拆镜。',
 sow:'增加孢压，并在数量限制内召出菌簇。',drain:'攻击后恢复生命；孢压会增强效果。',
 bloom:'随孢压增强，释放后清空孢压。',weave:'恢复生命并增加孢压。',
 arc:'蓄电提高每段伤害，物理命中可泄电。',ground:'攻击后消耗两点蓄电。',
 storm:'随蓄电增强，释放后清空蓄电。',charge:'攻击后增加蓄电。',
 script:'攻击后补充封页。',silence:'封页仍存在时，还会抽取全队资源。',
 rewrite:'恢复生命，并补回封页。',sever:'剩余封页越多，攻击越强。',
 zero_lance:'剩余屏障会增强每段攻击。',zero_field:'攻击后补充归零屏障。',
 zero_pulse:'剩余屏障越多，攻击越强。',zero_reset:'恢复生命、补回屏障并重置同步。',
 tide_fill:'攻击后抬高水位。',tide_breaker:'随水位增强，释放后水位清零。',tide_release:'随水位增强，攻击后降低一级水位。',
 furnace_vent:'攻击后打开炉门，暴露泄热窗口。',furnace_drop:'随炉热增强，攻击后关闭炉门并清空炉热。',furnace_feed:'攻击后升温并关闭炉门。',
 orbit_calibrate:'恢复生命并提高锁定。',orbit_collapse:'随锁定增强，攻击后清空锁定。',
 edict_revoke:'违令至少两次时，攻击还会抽取队伍资源。',
 zero_end:'完成接入与角色防护后，守住这次放电即可停机。',
};
const hpPercent=target=>target?.maxHp>0?Math.max(0,Math.min(100,Math.round(target.hp/target.maxHp*100))):null;
const heroName=hero=>hero.youmuForm==='captain'?'游墓':hero.short||hero.name||hero.id;
const enemyName=enemy=>BOSSES[enemy.id]?.name||enemy.name||enemy.id;
const unitId=enemy=>enemy.unitId||'boss';
const statText=stats=>Object.entries(stats||{}).filter(([,value])=>value).map(([key,value])=>`${ATTRIBUTE_NAMES[key]||key} ${value>0?'+':'−'}${Math.abs(value)}`).join(' · ');
const activeEffects=(enemy,state)=>attributeEffects(enemy,state).filter(effect=>Object.values(effect.stats||{}).some(Boolean));
const mechanicMeta={
 '解体':['stage','crystal'],'阶段':['stage','flag'],'迷雾':['fog','mist'],'地裂预警':['phasePending','quake'],
 '镜片':['mirror','mirror'],'折镜架势':['mirrorStance','parry'],'孢压':['spores','mushroom'],
 '蓄电':['charge','resource-charge'],'封页':['seals','book'],'水位':['waterLevel','resource-mana'],'阀击':['valveHits','settings'],
 '炉热':['heat','resource-breath'],'炉门':['furnaceOpen','shield'],'测绘锁定':['prediction','target'],
 '现行法令':['decree','book'],'违令':['violations','break'],'归零屏障':['barrier','shield'],
 '双系同步':['sync','blades'],'独狼同步':['sync','blades'],'终幕':['finale','crystal'],'剩余':['finaleTurns','clock'],
 '抗控':['controlImmune','parry'],'行动封锁':['hardControl','pause'],'手术创口':['dot','blade'],
 '嘲讽':['taunt','target'],'应对破绽':['exposed','break'],
 '弱者标记':['marked','target'],
};
const mechanicCompanions={'镜片':['拆镜'],'孢压':['菌冠'],'蓄电':['风暴'],'封页':['拆封'],'测绘锁定':['已记录']};
const mechanicMethods={
 stage:'阶段随生命与机制推进，不能驱散。',fog:'每次魔法命中驱散一层；驱散与外科切除也能减少迷雾。',
 phasePending:'先获得完整行动回合，再处理下一轮地裂蓄力；打断、破韧或提前防护均可应对。',
 mirror:'每次魔法命中拆除一面镜片；驱散或外科切除也有效。',mirrorStance:'先以魔法拆完镜片，或等待折镜架势结束；仍有镜片时，物理技能会招致反噬。',
 spores:'物理每次命中剥离一层孢压；驱散、外科切除也有效。优先清理菌簇可切断供养。',
 charge:'物理每次命中泄能一层；驱散、外科切除或摧毁中继器也可降低蓄电。风暴释放后清空。',
 seals:'使用与封存属性相反的攻击，每次命中拆除一页；也可驱散或外科切除。每轮换系并补一页。',
 waterLevel:'任意属性累计三次命中排水一级；驱散技能也能排水。浪涌释放后水位清零。',
 valveHits:'每段攻击计一次，累计三次命中便排水一级并重新计数；进度跨回合保留。',
 heat:'炉门打开时，每次命中泄热一级；驱散也能泄热。落锤后炉热清空。',
 furnaceOpen:'排汽后炉门打开，落锤或添料后关闭；敞口期间连续命中可泄热。',
 prediction:'换一项攻击降低一级锁定；反击、辅助技能不计入预测。轨道坍缩后锁定清空，也可驱散锁定。',
 decree:'遵照当前法令选择攻击的行动点费用，辅助技能不计违令；新回合换令。法令本身不能驱散。',
 violations:'新回合清零并换令；驱散也能减少违令。提前准备角色防护可承受本轮判罚。',
 controlImmune:'等待本轮结束；抗控期间不能打断，韧性最低保留一点。',hardControl:'下次普通行动会被取消，随后获得一轮抗控；不能影响核心和终幕。',
 dot:'每次行动后结算一次，次数耗尽后消失；不参与核心命中。',
 taunt:'单体主招优先攻击嘲讽者，持续时间结束后恢复正常选人；群体攻击与附加追击不改目标。',
 exposed:'本轮仍会行动；抓住破绽进攻，效果在回合结算时结束。',
 marked:'单发确认命中已有标记的目标时，独立追加 12 加目标正向力量的伤害；本次敌方回合结束后标记消失。',
};
const temporaryEffectInfo={
 intercept:['施放者存活时，在此敌人出手前反制；未打断也会压制本次攻击。','主招被打断、封锁或敌人倒下时取消反制；本次敌方回合结束后清除。'],
 confusion:['下一次单体攻击会转向另一名存活敌人；群体攻击或场上只剩此敌人时不改变目标。','本次行动后清除；被控制、破韧而跳过行动时也会清除。'],
 recordedIntent:['当前预告延后至其他敌人之后，取消该招的治疗、召唤和资源抽取等附效。','只针对被记录的招式；预告改变或该次行动结束后失效。'],
 marked:['尼布斯的单发确认命中已有标记的敌人时，追加一份弱者伤害。','本轮结束后消失；不会追溯强化施加标记的那次攻击。'],
 ric_domain_negative:['雷克的负域正在压制全部存活敌人，四项属性同时降低。','雷克平衡归零、转为正值或倒下时立即消失；同一领域不会叠加。'],
 weakened:['下一次行动的攻击与控制抵抗降低。','本次敌方回合结束后清除。'],
 };
function previewStatusEnemy(enemy,state,spec){
 const recorded=enemy.recordedIntent?.intent===(spec?.key||enemy.intent);
 const covered=!!enemy.cover&&(!state||state.heroes?.some(hero=>hero.id===enemy.cover.actor&&hero.hp>0));
 return {...enemy,cover:covered?enemy.cover:null,recordedIntent:recorded?enemy.recordedIntent:null};
}

export function enemyStatusModels(enemy,state){
 if(!enemy||enemy.defeated)return [];
 const context=state?{...state,boss:enemy}:null,view=previewStatusEnemy(enemy,state,context?attackSpec(context):null),effects=activeEffects(view,state),result=[];
 const summary=context?bossSummary(context):[],covered=new Set();
 for(const item of summary){
  const meta=mechanicMeta[item.label];if(!meta)continue;
  const [id,symbol]=meta,related=(mechanicCompanions[item.label]||[]).map(label=>summary.find(entry=>entry.label===label)?.value).filter(Boolean);
  const effect=effects.find(entry=>entry.id===id);if(effect)covered.add(effect.id);
  let count=typeof enemy[id]==='number'?enemy[id]:'';
  if(id==='stage')count=enemy.id==='golem'?enemy.stage:enemy.finale?3:enemy.stage+1;
  if(id==='barrier')count=enemy.seals;
  if(id==='decree')count=enemy.decree==='light'?'1':'2+';
  if(id==='dot')count=enemy.dot?.turns||'';
  if(id==='furnaceOpen')count=enemy.furnaceOpen?'✓':'';
  let method=mechanicMethods[id]||'';
  if(id==='barrier'||id==='sync')method=state.challengeMode==='solo'?'每次主动攻击拆一层屏障并增加一次同步，多段也只计一次；反击和持续伤害不计。三次同步后攻击加成提高 6。':'先攻击，再交替物理与魔法攻击，拆一层屏障并增加一次同步；三次同步后攻击加成提高 6。';
  if(id==='finale'||id==='finaleTurns'){
   const requirements=victoryRequirements(context);
   method=`${requirements.solo?`以任意属性累计命中 ${requirements.finaleHits} 次`:'分别完成物理与魔法命中'}，并使用一次角色防护技能；存活至终幕放电结束即可停机。`;
  }
  result.push({id,label:item.label,symbol,count,tone:item.tone==='good'?'is-negative':item.tone==='warning'?'is-positive':'is-mechanic',description:[item.value,...related].join('。'),method,stats:effect?.stats});
 }
 for(const effect of effects){
  if(covered.has(effect.id))continue;
  const key=Object.keys(effect.stats).find(key=>effect.stats[key]);
  const extra=temporaryEffectInfo[effect.id];
  result.push({id:effect.id,label:effect.label,symbol:{strength:'blade',intelligence:'rune',agility:'shield',will:'bind'}[key]||'rune',count:effect.turns>=99?'':effect.turns,tone:Object.values(effect.stats).some(value=>value<0)?'is-negative':'is-positive',stats:effect.stats,description:statText(effect.stats)+(extra?'。'+extra[0]:''),method:extra?.[1]||(effect.id==='rock'?'击碎躯壳、进入核心后失效。':effect.turns<99?`剩余 ${effect.turns} 轮${effect.charges?`，最多触发 ${effect.charges} 次`:''}。`:'持续到对应机制结束。')});
 }
 return result;
}
export function enemyAttributeBadgesView(enemy,state){
 const statuses=enemyStatusModels(enemy,state);if(!statuses.length)return '';
 return `<span class="enemy-status-badges" aria-label="${esc(enemyName(enemy))}机制与状态">${statuses.map(status=>`<span class="enemy-status-badge ${status.tone}" tabindex="0" data-enemy-status="${esc(status.id)}" data-tooltip="enemy-intent" data-detail="${esc(unitId(enemy)+'|status|'+status.id)}" aria-label="${esc(status.label+(status.count!==''?' '+status.count:''))}">${icon(status.symbol)}${status.count!==''?`<small>${esc(status.count)}</small>`:''}</span>`).join('')}</span>`;
}

/** Snapshot of the currently announced action, before the recipient's defenses.
 * enemyThreats temporarily swaps its argument's boss alias, so it receives a
 * separate context and copied enemy objects, never the live/frozen state.
 * Suppression is represented by current attributes, never a second multiplier.
 */
export function enemyIntentModels(state){
 if(!state?.boss||!Array.isArray(state.heroes))return [];
 const enemies=state.enemies||[state.boss],living=enemies.filter(e=>!e.defeated),meta=new Map();
 const projected=enemies.map(enemy=>{
  const spec=attackSpec({...state,boss:enemy});
  const stopped=enemy.core?'core':enemy.hardControl&&!enemy.finale?'controlled':enemy.broken?'broken':null;
  const redirect=!stopped&&spec.damage>0&&enemy.confusion&&!spec.group?living.find(e=>e!==enemy):null;
  const recorded=enemy.recordedIntent?.intent===spec.key;
  const covered=!!(!stopped&&enemy.cover&&state.heroes.some(h=>h.id===enemy.cover.actor&&h.hp>0));
  const view={...previewStatusEnemy(enemy,state,spec),unitId:unitId(enemy)};
  meta.set(unitId(enemy),{enemy:view,spec,stopped,redirect,recorded,covered});
  return view;
 });
 const context={...state,enemies:projected,boss:projected.find(e=>e.unitId===unitId(state.boss))||projected[0]};
 return enemyThreats(context).map(threat=>{
  const {enemy,spec,stopped,redirect,recorded,covered}=meta.get(threat.id);
  const attacking=!stopped&&Number.isFinite(spec.damage)&&spec.damage>0;
  const targeting=!attacking?'none':spec.group?'all':redirect?'enemy':'single';
  const targetId=targeting==='enemy'?unitId(redirect):targeting==='single'?threat.targets[0]||null:null;
  const target=targeting==='enemy'?redirect:targeting==='single'?state.heroes.find(h=>h.id===targetId):null;
  const targetName=targeting==='all'?'全体':target?targeting==='enemy'?enemyName(target):heroName(target):'—';
  let description=stopped==='core'?`核心正在重组，剩余 ${enemy.coreTurns} 个完整回合。`:stopped==='controlled'?'行动被封锁，本轮不会出手。':stopped==='broken'?'架势崩溃，本轮不会出手。':recorded?'预告已被收录：本轮最后行动，力量、智力各 −8，招式附效取消。':effectByIntent[spec.key]||(attacking?(spec.group?'攻击全体队员。':(spec.hits||1)>1?'连续攻击同一目标。':'攻击所选目标。'):'本轮不造成直接伤害。');
  if(recorded&&spec.key==='zero_end')description='预告已收录：本轮最后行动，力量、智力各 −8；停机条件仍须完成。';
  if(attacking&&enemy.confusion)description+=(redirect?'杀意已改写，这次攻击转向另一名敌人。':'心智扰乱：力量、智力各 −16。');
  if(covered)description+='出手前会受截击；若被击杀或破韧，本次行动取消。'+(attacking?'否则本次力量、智力各 −18，已计入预告。':'');
  if(enemy.id==='final'&&!enemy.finale&&state.challengeMode==='solo')description+='独狼：每次主动攻击技能拆 1 层屏障并增加 1 同步；多段只计一次，反击与持续伤害不额外拆层。';
  const combo=comboPlan(context,enemy,spec);
  const kind=attacking?spec.kind:'support',label=stopped?threat.intent.name:spec.name||threat.intent.name||'等待';
  return {id:threat.id,name:enemyName(enemy),intentId:spec.key,label,description,kind,
   targeting,targetId,targetName,targetSide:targeting==='enemy'?'enemy':targeting==='none'?'none':'party',
   targetHp:target?.hp??null,targetMaxHp:target?.maxHp??null,targetHpPercent:hpPercent(target),
   damage:attacking?threat.damage:0,hits:attacking?spec.hits||1:0,
   icon:stopped==='core'?'clock':stopped?'pause':!attacking?'rune':spec.kind==='magic'?'rune':'blade',
   actionText:stopped==='core'?'等待':stopped?'停止':!attacking?(spec.key==='relay_feed'?'供能':'准备'):'攻击',
   stopped:!!stopped,waiting:stopped==='core',attacking,redirected:!!redirect,recorded,covered,
   conditional:covered,damageBasis:'before-target-defense',order:threat.order,danger:!!threat.intent.danger,
   combo,attributes:effectiveAttributes(enemy,state),attributeEffects:activeEffects(enemy,state),
   baseDamage:spec.damage||0,attackAttribute:attackAttribute(enemy,spec.kind,state),pressure:spec.pressure||null,
  };
 });
}

export function enemyIntentBadgeView(model){
 if(!model)return '';
 const amount=model.attacking?`<span class="intent-damage"><b>${model.damage}</b>${model.hits>1?`<small>×${model.hits}</small>`:''}</span>`:`<span class="intent-state">${esc(model.actionText)}</span>`;
 const scope=model.attacking?`<span class="intent-scope">${model.targeting==='all'?peopleIcon():icon('target')}${model.targeting==='all'?'全体':model.targeting==='enemy'?'转向':'单体'}</span>`:'';
 const combo=model.combo?.after?.length?`<span class="intent-combo" aria-label="连招，${model.combo.after.length} 项附效">↳${model.combo.after.length}</span>`:'';
 return `<button type="button" class="enemy-intent-badge intent-${esc(model.kind)} targeting-${esc(model.targeting)}${model.stopped?' is-stopped':''}${model.redirected?' is-redirected':''}" data-enemy-intent="${esc(model.id)}" data-enemy-target="${esc(model.id)}" data-tooltip="enemy-intent" data-detail="${esc(model.id)}" aria-label="${esc(model.name+'：'+model.label+'，'+(model.attacking?model.damage+(model.hits>1?' × '+model.hits:''):model.actionText)+(model.combo?.after?.length?'，附加连招':''))}"><span class="intent-symbol">${icon(model.icon)}</span>${amount}${scope}<small class="intent-name">${esc(model.label)}</small>${combo}</button>`;
}

export function enemyTargetOfTargetView(model){
 if(!model)return '';
 if(model.targeting==='none')return `<span class="target-of-target targeting-none" data-intent-target-of="${esc(model.id)}"><span>${model.stopped?'暂无行动':'无攻击目标'}</span></span>`;
 const hp=model.targetHpPercent;
 return `<span class="target-of-target targeting-${esc(model.targeting)}" data-intent-target-of="${esc(model.id)}"${model.targetId?` data-intent-target="${esc(model.targetId)}"`:''}>${model.targeting==='all'?peopleIcon():icon('arrow')}<span class="tot-name">${esc(model.targetName)}</span>${hp!==null?`<span class="tot-health" role="meter" aria-label="${esc(model.targetName)}生命" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${hp}"><i style="width:${hp}%"></i></span><small class="tot-percent">${hp}%</small>`:''}</span>`;
}

export function enemyIntentTooltipView(state,id){
 if(id?.includes('|status|')){
  const [enemyId,,statusId]=id.split('|'),enemy=(state.enemies||[state.boss]).find(unit=>unitId(unit)===enemyId),status=enemyStatusModels(enemy,state).find(item=>item.id===statusId);
  if(!status)return '';
  return `<section class="enemy-status-tooltip"><header>${icon(status.symbol)}<div><h3>${esc(status.label)}${status.count!==''?` <small>${esc(status.count)}</small>`:''}</h3><span>${esc(enemyName(enemy))}</span></div></header><p>${esc(status.description)}</p>${status.stats&&!status.description.includes(statText(status.stats))?`<p class="enemy-status-attributes">${esc(statText(status.stats))}</p>`:''}${status.method?`<p class="enemy-status-method">${esc(status.method)}</p>`:''}</section>`;
 }
 const model=enemyIntentModels(state).find(item=>item.id===id);if(!model)return '';
 const combo=model.combo,controlText=(combo?.after||[]).filter(step=>step.type==='control').map(step=>{
  const target=state.heroes.find(hero=>hero.id===step.targets[0]);
  return `${heroName(target||{id:'目标'})}抵抗${step.control.type==='stun'?'眩晕':'封术'}概率 ${Math.round(controlResistance(target||{},step.control.power,state)*100)}%`;
 }).join('；');
 return `<section class="enemy-intent-tooltip"><header><strong>${esc(model.name)}</strong><span>${esc(model.label)}</span></header>${model.attacking?`<p>${esc(model.kind==='magic'?'魔法':'物理')} · ${model.damage}${model.hits>1?` × ${model.hits}`:''} · ${esc(model.targetName)}</p>`:''}<p>${esc(model.description)}</p>${model.attacking?'<small>每段已计入攻击属性与难度，尚未扣除目标防御与护盾。</small>':''}${combo?.hint?`<div class="intent-combo-detail"><b>${combo.after.length?'附加连招':'连招条件'}</b><p>${esc(combo.hint)}</p>${controlText?`<p>${esc(controlText)}</p>`:''}</div>`:''}${model.pressure?`<p class="enemy-pressure-detail">${esc(model.pressure.label)} ${model.pressure.layers} 层：每层使本招每段基础伤害 +${model.pressure.perLayer}，合计 +${model.pressure.damageBonus}。</p>`:''}${model.attributeEffects.length?`<ul class="enemy-attribute-effects">${model.attributeEffects.map(effect=>`<li><b>${esc(effect.label)}</b> ${esc(statText(effect.stats))}${effect.turns<99?` · ${effect.turns} 轮`:''}</li>`).join('')}</ul>`:''}</section>`;
}
