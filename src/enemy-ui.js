import {enemyTargets,enemyThreats} from './combat.js';
import {icon} from './icons.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function enemyTargetView(state,busy=false){
  const targets=enemyTargets(state,{includeDefeated:true});
  if(targets.length<2)return '';
  return `<section class="enemy-targets" aria-label="选择技能目标"><div class="target-heading"><span>攻击目标 · 点击敌人或下方卡片</span><span><kbd>Tab</kbd> 切换</span></div><div class="target-cards">${targets.map(enemy=>`<button class="enemy-target ${enemy.selected?'selected':''} ${enemy.defeated?'defeated':''}" data-enemy-target="${esc(enemy.id)}" aria-pressed="${enemy.selected}" ${busy||enemy.defeated?'disabled':''}><span class="enemy-target-title"><b>${esc(enemy.name)}</b><small>${enemy.defeated?'已击败':enemy.role==='device'?'装置':enemy.role==='minion'?'随从':'主敌'}</small></span><span class="enemy-target-hp"><i style="width:${Math.max(0,enemy.hp/enemy.maxHp*100)}%"></i></span><span class="enemy-target-values">${enemy.hp} / ${enemy.maxHp}<small>韧性 ${enemy.stagger}</small></span></button>`).join('')}</div></section>`;
}

export function additionalThreatsView(state,busy=false){
  const threats=enemyThreats(state).filter(threat=>threat.id!=='boss');
  if(!threats.length)return '';
  return `<section class="additional-threats" aria-label="其他敌人的行动预告"><h3>其他敌人也会行动</h3>${threats.map(threat=>`<article class="${threat.intent.danger?'danger':''}"><header><button data-enemy-target="${esc(threat.id)}" ${busy?'disabled':''}>${icon('target')}${esc(threat.name)}</button><span>顺序 ${threat.order}</span></header><strong>${icon(threat.intent.icon||'blade')}${esc(threat.intent.name)}</strong><p>${esc(threat.intent.desc)}</p></article>`).join('')}</section>`;
}

export function skillTargetLabel(preview){
  return preview?.targeting==='all'?'全体':preview?.targeting==='single'?'单体':'';
}
