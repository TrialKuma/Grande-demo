import {attackSpec,enemyThreats,BOSSES} from './combat.js';
import {icon} from './icons.js';

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

/** Snapshot of the currently announced action, before the recipient's defenses.
 * enemyThreats temporarily swaps its argument's boss alias, so it receives a
 * separate context and copied enemy objects, never the live/frozen state.
 * Pending suppression is applied before its authoritative damage rounding.
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
  // A living interceptor replaces actionSuppression with 0.5 in the resolver.
  let suppression=covered?.5:enemy.actionSuppression||1;
  if(recorded)suppression*=.75;
  if(enemy.confusion&&!redirect)suppression*=.45;
  meta.set(unitId(enemy),{enemy,spec,stopped,redirect,recorded,covered});
  return {...enemy,unitId:unitId(enemy),actionSuppression:suppression};
 });
 const context={...state,enemies:projected,boss:projected.find(e=>e.unitId===unitId(state.boss))||projected[0]};
 return enemyThreats(context).map(threat=>{
  const {enemy,spec,stopped,redirect,recorded,covered}=meta.get(threat.id);
  const attacking=!stopped&&Number.isFinite(spec.damage)&&spec.damage>0;
  const targeting=!attacking?'none':spec.group?'all':redirect?'enemy':'single';
  const targetId=targeting==='enemy'?unitId(redirect):targeting==='single'?threat.targets[0]||null:null;
  const target=targeting==='enemy'?redirect:targeting==='single'?state.heroes.find(h=>h.id===targetId):null;
  const targetName=targeting==='all'?'全体':target?targeting==='enemy'?enemyName(target):heroName(target):'—';
  let description=stopped==='core'?`核心正在重组，剩余 ${enemy.coreTurns} 个完整回合。`:stopped==='controlled'?'行动被封锁，本轮不会出手。':stopped==='broken'?'架势崩溃，本轮不会出手。':recorded?'预告已被收录：本轮最后行动，伤害降低，招式附效取消。':effectByIntent[spec.key]||(attacking?(spec.group?'攻击全体队员。':(spec.hits||1)>1?'连续攻击同一目标。':'攻击所选目标。'):'本轮不造成直接伤害。');
  if(recorded&&spec.key==='zero_end')description='预告已收录：本轮最后行动、伤害降低；停机条件仍须完成。';
  if(attacking&&enemy.confusion)description+=(redirect?'杀意已改写，这次攻击转向另一名敌人。':'杀意已压下，这次伤害降低55%。');
  if(covered)description+='出手前会受截击；若被击杀或破韧，本次行动取消。'+(attacking?'否则伤害减半。':'');
  if(!stopped&&enemy.id==='golem'&&enemy.stage>=1)description+=enemy.stage>=3?'随后追加单体飞弹与全体真空波。':'随后追加单体飞弹。';
  const kind=attacking?spec.kind:'support',label=stopped?threat.intent.name:spec.name||threat.intent.name||'等待';
  return {id:threat.id,name:enemyName(enemy),intentId:spec.key,label,description,kind,
   targeting,targetId,targetName,targetSide:targeting==='enemy'?'enemy':targeting==='none'?'none':'party',
   targetHp:target?.hp??null,targetMaxHp:target?.maxHp??null,targetHpPercent:hpPercent(target),
   damage:attacking?threat.damage:0,hits:attacking?spec.hits||1:0,
   icon:stopped==='core'?'clock':stopped?'pause':!attacking?'rune':spec.kind==='magic'?'rune':'blade',
   actionText:stopped==='core'?'等待':stopped?'停止':!attacking?(spec.key==='relay_feed'?'供能':'准备'):'攻击',
   stopped:!!stopped,waiting:stopped==='core',attacking,redirected:!!redirect,recorded,covered,
   conditional:covered,damageBasis:'before-target-defense',order:threat.order,danger:!!threat.intent.danger,
  };
 });
}

export function enemyIntentBadgeView(model){
 if(!model)return '';
 const amount=model.attacking?`<span class="intent-damage"><b>${model.damage}</b><small>×${model.hits}</small></span>`:`<span class="intent-state">${esc(model.actionText)}</span>`;
 const scope=model.attacking?`<span class="intent-scope">${model.targeting==='all'?peopleIcon():icon('target')}${model.targeting==='all'?'全体':model.targeting==='enemy'?'转向':'单体'}</span>`:'';
 return `<button type="button" class="enemy-intent-badge intent-${esc(model.kind)} targeting-${esc(model.targeting)}${model.stopped?' is-stopped':''}${model.redirected?' is-redirected':''}" data-enemy-intent="${esc(model.id)}" data-enemy-target="${esc(model.id)}" data-tooltip="enemy-intent" data-detail="${esc(model.id)}" aria-label="${esc(model.name+'：'+model.label+'，'+(model.attacking?model.damage+' × '+model.hits:model.actionText))}"><span class="intent-symbol">${icon(model.icon)}</span>${amount}${scope}<small class="intent-name">${esc(model.label)}</small></button>`;
}

export function enemyTargetOfTargetView(model){
 if(!model)return '';
 if(model.targeting==='none')return `<span class="target-of-target targeting-none" data-intent-target-of="${esc(model.id)}"><span>${model.stopped?'暂无行动':'无攻击目标'}</span></span>`;
 const hp=model.targetHpPercent;
 return `<span class="target-of-target targeting-${esc(model.targeting)}" data-intent-target-of="${esc(model.id)}"${model.targetId?` data-intent-target="${esc(model.targetId)}"`:''}>${model.targeting==='all'?peopleIcon():icon('arrow')}<span class="tot-name">${esc(model.targetName)}</span>${hp!==null?`<span class="tot-health" role="meter" aria-label="${esc(model.targetName)}生命" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${hp}"><i style="width:${hp}%"></i></span><small class="tot-percent">${hp}%</small>`:''}</span>`;
}

export function enemyIntentTooltipView(state,id){
 const model=enemyIntentModels(state).find(item=>item.id===id);if(!model)return '';
 return `<section class="enemy-intent-tooltip"><header><strong>${esc(model.name)}</strong><span>${esc(model.label)}</span></header>${model.attacking?`<p>${esc(model.kind==='magic'?'魔法':'物理')} · ${model.damage} × ${model.hits} · ${esc(model.targetName)}</p>`:''}<p>${esc(model.description)}</p>${model.attacking?'<small>每段伤害，尚未扣除目标减伤与护盾。</small>':''}</section>`;
}
