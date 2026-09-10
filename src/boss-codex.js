import {BOSSES, BOSS_INTENTS, DIFFICULTIES, SOLO_RULES, isSolo, createBattle, intentInfo,attackSpec} from './combat.js';
import {icon} from './icons.js';
import {codex,expanded} from './boss-codex-data.js';
import {comboPlan} from './boss-combos.js';
import {ATTRIBUTE_NAMES,attributeEffects} from './attributes.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const freshBattle=(state,bossId)=>createBattle(state.difficulty,bossId,{mode:state.challengeMode,partyIds:state.heroes.map(hero=>hero.id),upgrades:state.upgrades,loadouts:state.loadouts,skillAccess:state.skillAccess});

function soloEntry(state,bossId,entry){
  if(!isSolo(state))return entry;
  const result={...entry,rules:[['独狼数值',`每轮基础 ${SOLO_RULES.ap} AP，最多保留 2 点至下一轮。敌方生命与伤害使用独狼规则；我方生命、技能费用和初始 3 瓶药剂保持原值。`],...entry.rules]};
  if(bossId==='golem'){
    result.victory=`击碎躯壳后，任意属性累计命中 ${SOLO_RULES.coreHits} 次即可净化，不要求物理与魔法分别命中。`;
    result.extras=entry.extras.map(extra=>extra.name==='核心重组'?{...extra,text:`击碎躯壳的攻击不计入核心命中；之后任意属性累计 ${SOLO_RULES.coreHits} 次，不要求伤害量。暴露后保留 2 个完整回合，核心不再攻击，但共鸣仍会结算。超时恢复 28% 生命，再次击碎即可重试。`}:extra);
  }
  if(bossId==='final'){
    result.victory=`进入终幕后，任意属性累计命中 ${SOLO_RULES.finaleHits} 次，本轮使用角色防护技能并存活至末招结算即可停机。`;
    result.rules=result.rules.map(([name,detail])=>name==='第三阶段 · 停机过载'?[name,result.victory+' 期限为 2 个完整回合，超时恢复 22% 生命。']:name==='归零屏障'?[name,'开场 3 层，每层使敏捷、智力各 +3；每次主动攻击技能拆 1 层屏障，不限制攻击属性，驱散也能拆除。']:name==='双系同步'?['独狼同步','每次主动攻击技能使同步 +1、屏障 −1，多段技能只计一次；反击与持续伤害不额外拆层。先结算伤害，再改变层数；同步最多 3，满层时攻击属性额外 +6。']:[name,detail]);
    result.skills=entry.skills.map(skill=>skill.key==='zero_end'?{...skill,tag:'独狼最终条件',detail:result.victory+' 角色反击也可计入一次任意属性命中；普通伤害与削韧不再计量。'}:skill);
    result.extras=entry.extras.map(extra=>({...extra,tag:'独狼最终条件',text:result.victory+' 最后放电为 65 基础魔法伤害，仍乘难度与独狼倍率。击碎生命的攻击不计入终幕；超时恢复 22% 生命，可重新尝试。'}));
  }
  return result;
}

function encounterEntry(state,bossId){
  const original=codex[bossId],source=original||expanded[bossId];
  if(!source)return {victory:BOSSES[bossId].brief,rules:[['核心机制',BOSSES[bossId].mechanic]],skills:[],cycle:'',extras:[]};
  const active=state.boss.id===bossId,snapshot=active?structuredClone(state):freshBattle(state,bossId);
  Object.assign(snapshot.boss,{core:false,finale:false,broken:false,exposed:false,hardControl:0,charging:false,phasePending:false});
  snapshot.selected=snapshot.heroes.some(hero=>hero.id===state.selected)?state.selected:snapshot.heroes[0].id;
  const definitions=original?source.skills:(BOSS_INTENTS[bossId]||[]).map(key=>({key,...source.skills[key]}));
  const skills=definitions.map(meta=>{
    const preview=structuredClone(snapshot);
    if(meta.key==='quake')preview.boss.charging=true;else preview.boss.intent=meta.key;
    const actual=intentInfo(preview);
    return {...meta,name:actual.name||meta.name,icon:actual.icon||meta.icon||BOSSES[bossId].icon,tag:`${active?'当前阶段与层数':'开场阶段与层数'} · ${BOSSES[bossId].isTutorial?'教学低伤害':DIFFICULTIES[state.difficulty].name+'难度'}`,damage:actual.desc,combo:comboPlan(preview,preview.boss,attackSpec(preview)).hint};
  });
  if(bossId==='final'){
    const preview=structuredClone(snapshot);
    Object.assign(preview.boss,{finale:true,hp:0,finalePhysical:active?state.boss.finalePhysical:0,finaleMagic:active?state.boss.finaleMagic:0,finaleProtected:active?!!state.boss.finaleProtected:false});
    const actual=intentInfo(preview);
    skills.push({key:'zero_end',name:actual.name,icon:actual.icon,tag:'第三阶段 · 全队魔法 · 最终条件',damage:actual.desc,detail:'完成物理与魔法各 1 次命中，本轮使用角色防护、护盾或削弱技能，然后结束回合。角色反击也可以在主招后补足记录。治疗与纯资源准备不算建立防护；满足条件并有人存活时获胜。'});
  }
  return soloEntry(state,bossId,{...source,skills,cycle:source.cycle||skills.filter(skill=>skill.key!=='zero_end').map(skill=>skill.name).join(' → ')});
}

function skillCard(skill,current,index){
  return `<details class="codex-skill${current?' is-current':''}"${current?' open':''}>
    <summary><span class="codex-skill-number">${String(index+1).padStart(2,'0')}</span><span class="codex-skill-icon">${icon(skill.icon)}</span><span class="codex-skill-heading"><b>${esc(skill.name)}</b><small>${esc(skill.tag)}</small></span>${current?'<em>当前预告</em>':''}<span class="codex-expand">${icon('chevron')}</span></summary>
    <div class="codex-skill-body"><p class="codex-threat">${esc(skill.damage)}</p><p>${esc(skill.detail)}</p>${skill.combo?`<div class="codex-combo"><b>连招与反制</b><p>${esc(skill.combo)}</p></div>`:''}${skill.interrupt?'<div class="codex-interrupt">'+icon('bind')+' 可用具备打断效果的角色技能取消；抗控期间除外。</div>':''}</div>
  </details>`;
}

export function bossCodexView(state,bossId=state.boss.id){
  if(!Object.hasOwn(BOSSES,bossId))bossId='golem';
  const boss=BOSSES[bossId],entry=encounterEntry(state,bossId),difficulty=DIFFICULTIES[state.difficulty]||DIFFICULTIES.standard;
  const active=state.boss.id===bossId,preview=active?state:freshBattle(state,bossId);
  const effects=attributeEffects(preview.boss,preview).filter(effect=>Object.values(effect.stats||{}).some(Boolean));
  const current=active&&!state.boss.core&&!state.boss.broken&&!state.boss.hardControl?state.boss.finale?'zero_end':state.boss.charging?'quake':state.boss.intent:null;
  const actual=active?intentInfo(state):null;
  const tabs=Object.values(BOSSES).filter(item=>(!item.isTutorial&&!item.isSkirmish&&!item.isMinion)||item.id===state.boss.id||item.id===bossId);
  return `<section class="boss-codex" style="--codex-accent:${boss.color}" aria-label="BOSS 招式手册">
    <div class="modal-eyebrow">ENCOUNTER CODEX</div><h2>BOSS 招式手册</h2><p class="codex-intro">查看全部招式、阶段变化，以及哪些角色能力可以处理这些威胁。点击招式展开详情。</p>
    <nav class="codex-tabs" aria-label="选择 BOSS">${tabs.map(item=>`<button type="button" class="${item.id===bossId?'selected':''}" data-codex-boss="${item.id}" aria-pressed="${item.id===bossId}">${icon(item.icon)}<span>${esc(item.name)}</span>${state.boss.id===item.id?'<small>本场</small>':''}</button>`).join('')}</nav>
    <header class="codex-boss-heading"><span>${icon(boss.icon)}</span><div><small>${esc(boss.region)}</small><h3>${esc(boss.name)}</h3></div><div class="codex-hp"><small>${boss.isTutorial?'教学 · ':isSolo(state)?'独狼 · ':`${state.heroes.length} 人 · `}${esc(difficulty.name)} · 最大生命</small><b>${preview.boss.maxHp}</b></div></header>
    ${effects.length?`<ul class="enemy-attribute-effects">${effects.map(effect=>`<li><b>${esc(effect.label)}</b> ${Object.entries(effect.stats).filter(([,value])=>value).map(([key,value])=>`${esc(ATTRIBUTE_NAMES[key])} ${value>0?'+':'−'}${Math.abs(value)}`).join(' · ')}${effect.turns<99?` · ${effect.turns} 轮`:''}</li>`).join('')}</ul>`:''}
    <p class="codex-victory">${icon('flag')}${esc(entry.victory)}</p>
    ${actual?`<div class="codex-live"><strong>${icon(actual.icon)}本场状态 · ${esc(actual.name)}</strong><p>${esc(actual.desc)}</p></div>`:''}
    <div class="codex-rules">${entry.rules.map(([title,text])=>`<article><h4>${esc(title)}</h4><p>${esc(text)}</p></article>`).join('')}</div>
    <div class="codex-section-heading"><h3>招式与处理方法</h3><span>${entry.skills.length} 项主动招式</span></div>
    <p class="codex-cycle"><b>普通循环</b>${esc(entry.cycle)}</p>
    <p class="codex-number-note">招式伤害已经计入攻击属性、${boss.isTutorial?'教学难度':'难度与出战模式'}，不需要再次乘倍率。本场敌人使用当前阶段与层数，其他敌人使用开场状态。预告尚未扣除各角色防御与护盾；额外攻击中标为“基础”的数值仍需加上攻击属性，再按本场规则结算。</p>
    <div class="codex-skills">${entry.skills.map((skill,i)=>skillCard(skill,current===skill.key,i)).join('')}</div>
    ${entry.extras.length?`<div class="codex-section-heading"><h3>额外攻击与核心</h3><span>角色防护也覆盖追击</span></div><div class="codex-extras">${entry.extras.map(extra=>`<article><h4>${icon(extra.icon)}${esc(extra.name)}</h4><small>${esc(extra.tag)}</small><p>${esc(extra.text)}</p></article>`).join('')}</div>`:''}
    <details class="codex-common"><summary>${icon('book')}角色防护与回合结算${icon('chevron')}</summary><div>
      <p><b>技能承担防守：</b>提高自身敏捷或智力，降低敌人力量或智力，或用护盾、闪避、嘲讽和控制处理威胁。每个角色装配四项技能，防守与输出共用这些技能位。</p>
      <p><b>逐段计算属性：</b>物理每段为基础伤害加力量、减目标敏捷；魔法每段加智力、减目标智力，再按难度结算，最后扣除护盾。属性增减及剩余期限在 BUFF 栏显示。每批护盾仅持续两次敌方回合，重新施盾不会刷新旧批次。</p>
      <p><b>控制与净化：</b>敌人的眩晕或封术由意志抵抗，预告会列出连招条件；每次最多控制一人。净化铺垫减益、拆除机制层数，或取消主招都能截断对应连招。被控角色恢复后有短暂抗控期。</p>
      <p><b>破韧与抗控：</b>本场最大韧性 ${preview.boss.maxStagger}。我方行动期间击破韧性，会取消本轮普通敌招并使敌人受到伤害增加 50%。恢复架势后有一整轮抗控，韧性最低保留 1，直接打断无效；核心与终幕不计算削韧。</p>
      <p><b>角色反击：</b>钉刺等被动根据各自条件触发，不需要额外按键。反击在敌人出手后破韧时，下一轮保留易伤，敌人仍会照常进攻。治疗、反击、持续伤害的目标和收益以对应角色技能说明为准。</p>
      <p><b>轮转与保留：</b>普通循环按回合推进，控制不会暂停护盾、核心或终幕倒计时。每轮结束最多保留 2 点未使用行动点到下一轮；敌方回血不会退回已经触发的半血强化。</p>
    </div></details>
    <div class="codex-footer"><span>战斗内随时查阅 · 关闭后继续当前回合</span><button class="primary" data-action="close-modal">返回战斗 ${icon('arrow')}</button></div>
  </section>`;
}
