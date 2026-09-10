import {icon} from './icons.js';
import {resourceKind,resourceColor} from './skill-growth-ui.js';
import {MANA_REFUND_TABLES} from './mana-cycles.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=n=>n<0?`−${Math.abs(n)}`:`+${n}`;
export const RESOURCE_SYMBOLS=Object.freeze({
 ap:{name:'行动点',symbol:'resource-ap',color:'#e8ca85'},
 breath:{name:'气息',symbol:'resource-breath',color:'#f18b63'},
 combo:{name:'连击',symbol:'resource-combo',color:'#f2d16c'},
 mana:{name:'魔力',symbol:'resource-mana',color:'#70baff'},
 balance:{name:'平衡',symbol:'resource-balance',color:'#bb96ec'},
 intuition:{name:'直感',symbol:'crosshair',color:'#efc376'},
 mindline:{name:'念线',symbol:'resource-mindline',color:'#a6baff'},
 charge:{name:'充能',symbol:'resource-charge',color:'#83e2ff'},
 record:{name:'记录',symbol:'resource-record',color:'#e3b5ff'},
});
export const secondaryResourceKind=h=>({haart:'mindline',qianxing:'charge',patch:'record'})[h.id];
export const resourceSymbol=(h,secondary=false)=>RESOURCE_SYMBOLS[secondary?secondaryResourceKind(h):resourceKind(h)]?.symbol||'resource-mana';
export const resourceIcon=(h,secondary=false)=>icon(resourceSymbol(h,secondary),'resource-symbol');

/** Present the same refund tables that combat uses, including both of Patch's stances. */
function manaRecoveryRule(h){
 const table=MANA_REFUND_TABLES[h.id];if(!table)return null;
 const stance=h.id==='patch';
 const entries=stance?[['观测',table.observe],['收录',table.record]]:table.slice(1).map((refund,index)=>[index+1,refund]);
 return {stance,entries,
  trigger:`每次行动实际消耗${h.secondaryName}后，触发一次回魔；多段命中和反击不重复触发。`,
  timing:stance?'按出手前的姿态结算，与消耗的记录数量无关；钥刃在回魔后切换到观测。':'',
  basic:'普通攻击在没有库存时不回魔；持有库存时自动使用一份强化，并触发回魔。',
  limits:'魔力不随回合恢复；超出魔力上限的回复会损失。'};
}

export function manaRecoveryDescription(h){
 const rule=manaRecoveryRule(h);if(!rule)return '';
 const table=rule.stance?`观测回复 ${rule.entries[0][1]} 魔力，收录回复 ${rule.entries[1][1]} 魔力。`:`消耗 ${rule.entries.map(([spent])=>spent).join('／')} ${h.secondaryName}，分别回复 ${rule.entries.map(([,refund])=>refund).join('／')} 魔力。`;
 return [rule.trigger,table,rule.timing,rule.basic,rule.limits].filter(Boolean).join('');
}

export function manaRecoveryView(h,{compact=false,spent=0}={}){
 const rule=manaRecoveryRule(h);if(!rule)return '';
 const current=rule.stance?(h.patchForm==='record'?'收录':'观测'):spent;
 const trigger=compact?`消耗${h.secondaryName}后回魔，每次行动仅一次。`:rule.trigger;
 const timing=rule.stance&&compact?'按出手前姿态，回魔量与消耗条数无关；钥刃随后转观测。':rule.timing;
 const ending=compact?'空库存普攻不回魔；有库存耗1强化并回魔。无自然回魔，溢出损失。':rule.basic+rule.limits;
 return `<section class="mana-recovery ${compact?'is-compact':''}" data-mana-recovery="${esc(h.id)}"><h4>${esc(h.passiveName)} · 回魔被动</h4><p>${esc(trigger)}</p><table aria-label="${esc(h.passiveName)}回魔规则"><tbody><tr><th scope="row">${rule.stance?'出手前姿态':`消耗${esc(h.secondaryName)}`}</th>${rule.entries.map(([key])=>`<td class="${spent>0&&key===current?'is-current':''}">${key}</td>`).join('')}</tr><tr><th scope="row">回复魔力</th>${rule.entries.map(([key,refund])=>`<td class="mana-recovery-gain ${spent>0&&key===current?'is-current':''}">+${refund}</td>`).join('')}</tr></tbody></table>${timing?`<p>${esc(timing)}</p>`:''}<p>${esc(ending)}</p></section>`;
}

/** A receipt reports the skill's full yield, independently of the player's remaining capacity. */
export function skillResourceDeltas(state,h,skill,preview){
 const primary=resourceKind(h),secondary=secondaryResourceKind(h),deltas=[];
 const add=(kind,amount,{available,overflow=false,verb}={})=>{
  if(!Number.isFinite(amount)||!amount)return;
  const info=RESOURCE_SYMBOLS[kind];
  deltas.push({kind,amount,name:info.name,color:info.color,symbol:info.symbol,
   insufficient:amount<0&&available!==undefined&&available<Math.abs(amount),overflow,
   label:`${kind==='balance'?`平衡变化 ${signed(amount)}`:`${verb||(amount<0?'消耗':'获得')} ${Math.abs(amount)} ${info.name}`}${available!==undefined?`，当前 ${available}`:''}${overflow?'，库存空位不足':''}`});
 };
 add('ap',-Math.max(0,preview.ap??skill.ap??0),{available:state.ap});
 const spend=preview.resourceSpend??preview.cost??skill.cost??0;
 const secondSpend=preview.secondarySpend??skill.secondaryCost??0;
 const secondGain=preview.secondaryGain??skill.secondaryGain??0;
 // resourceGain includes the tuned skill's recovery, alternating bonus and passive mana payout.
 const gain=preview.resourceGain??(primary==='mana'?preview.refund??skill.manaReturn??0:skill.gain||0);
 if(primary==='balance'){
  const shift=preview.resourceShift??(skill.resetBalance?-h.resource:skill.crossing?(h.resource?-h.resource*2:-4):skill.shift||0);
  add(primary,shift,{overflow:Math.abs(h.resource+shift)>h.maxResource});
 }else add(primary,-spend,{available:h.resource});
 if(secondary)add(secondary,-secondSpend,{available:h.secondary||0});
 if(secondary)add(secondary,secondGain,{overflow:(h.secondary||0)-secondSpend+secondGain>h.maxSecondary});
 if(h.id==='knibbs'){
  add('intuition',-(preview.intuitionSpent||0),{available:h.intuition||0});
  add('intuition',preview.intuitionGain||0);
 }
 if(primary!=='balance')add(primary,gain,{verb:primary==='mana'?'被动回复':'回复'});
 return deltas;
}

export function resourceDeltaView(delta){
 return `<span class="resource-delta ${delta.amount<0?'is-spend':'is-gain'} ${delta.insufficient?'is-insufficient':''} ${delta.overflow?'is-overflow':''}" style="--resource-color:${delta.color}" data-resource="${delta.kind}" data-amount="${delta.amount}" role="img" aria-label="${esc(delta.label)}">${icon(delta.symbol,'resource-symbol')}<b>${signed(delta.amount)}</b></span>`;
}

export function skillResourcesView(state,h,skill,preview){
 const deltas=skillResourceDeltas(state,h,skill,preview),isConversion=h.secondaryName&&deltas.some(d=>d.kind!=='ap'&&d.amount<0)&&deltas.some(d=>d.kind!=='ap'&&d.amount>0);
 let positive=false;
 return `<span class="skill-resources">${deltas.map(delta=>{
  const arrow=isConversion&&!positive&&delta.amount>0?icon('arrow','resource-conversion-arrow'):'';
  if(delta.amount>0)positive=true;
  return arrow+resourceDeltaView(delta);
 }).join('')}</span>`;
}

export function resourceRangeView(h,preview,deltas,secondary=false){
 const kind=secondary?secondaryResourceKind(h):resourceKind(h),info=RESOURCE_SYMBOLS[kind];
 const before=secondary?preview.secondaryBefore||0:preview.resourceBefore,after=secondary?preview.secondaryAfter||0:preview.resourceAfter;
 const changes=deltas.filter(delta=>delta.kind===kind),change=changes.reduce((sum,delta)=>sum+delta.amount,0);
 const number=n=>kind==='balance'&&n>0?`+${n}`:n;
 return `<span class="tooltip-resource-diagram">${changes.map(resourceDeltaView).join('')}<span class="tooltip-resource-change" style="--resource-color:${secondary?info.color:resourceColor(h)}" aria-label="${esc(info.name)} ${number(before)} → ${number(after)}">${icon(info.symbol,'resource-symbol')}<span>${esc(number(before))}</span>${icon('arrow')}<span class="resource-result ${change>0?'is-gain':change<0?'is-spend':''}">${esc(number(after))}</span></span></span>`;
}

/** Resource requirements are already visible as exact red tokens, so only non-resource blockers need prose. */
export const resourceBlocker=reason=>/行动点不足|(?:气息|连击|魔力|念线|充能|记录|直感).*?(?:不足|最多保留)|平衡超出|只有二级资源为空/.test(reason||'');
