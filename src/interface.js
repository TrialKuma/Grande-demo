import {statusBadges,heroResourceDescription,skillTypeBadge} from './status-details.js';
import {HEROES, SKILLS, BOSSES, DIFFICULTIES, SOLO_RULES, canUse, heroOf, intentInfo, responseOptions, skillPreview, resolvedSkill, heroStatus, bossSummary, victoryRequirements} from './combat.js';
import {icon} from './icons.js';
import {normalizeChallengeParty} from './gm-tools.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const portrait = id => `<span class="portrait ${id}" role="img" aria-label="${id==='youmu_inner'?'游墓':HEROES.find(h=>h.id===id)?.name || id}"></span>`;
const signed = n => n > 0 ? '+' + n : String(n);
const equippedSkills=(state,id)=>(state.loadouts?.[id]||SKILLS[id].filter(s=>!s.unlockKey).slice(0,5).map(s=>s.id)).map(key=>SKILLS[id].find(s=>s.id===key)).filter(Boolean);
export const bossOf = state => BOSSES[state.boss.id] || BOSSES.golem;

const soloRuleDescription=()=>`每轮获得 ${SOLO_RULES.ap} AP，全部由这一名角色使用。敌方生命为同难度小队模式的 ${Math.round(SOLO_RULES.bossHp*100)}%，伤害为 ${Math.round(SOLO_RULES.bossDamage*100)}%；韧性上限为 ${SOLO_RULES.stagger}，每轮恢复 ${SOLO_RULES.staggerRegen} 点。巨人核心只需任意属性命中 ${SOLO_RULES.coreHits} 次；最终终幕需要任意属性命中 ${SOLO_RULES.finaleHits} 次，并准备应对、存活至最后一击结束。`;
function encounterDescription(b,solo){
  if(solo&&b.id==='golem')return {...b,brief:`击碎逐层解体的岩铠，再以任意属性累计命中核心 ${SOLO_RULES.coreHits} 次，完成净化。`,mechanic:'延迟地裂 · 共鸣驱散 · 任意属性净化核心'};
  if(solo&&b.id==='final')return {...b,brief:`核心即将切断避难室的供气。先击碎屏障与躯壳；进入终幕后，以任意属性累计命中 ${SOLO_RULES.finaleHits} 次，并准备应对抵住最后一次放电。`,mechanic:'归零屏障 · 任意属性命中 · 终幕应对'};
  return b;
}

export function titleView(prefs, saved, toolbar, records, journeyMarkup='', {unlockedHeroes=[]}={}) {
  const available=new Set(['knibbs','apeilia','ric',...(Array.isArray(unlockedHeroes)?unlockedHeroes:[])]),solo=prefs.challengeMode==='solo';
  const chosen = encounterDescription(BOSSES[prefs.bossId] || BOSSES.golem,solo);
  const selectable=HEROES.filter(hero=>available.has(hero.id)),soloHero=selectable.find(hero=>hero.id===prefs.soloHero)||selectable[0];
  const difficulty=DIFFICULTIES[prefs.difficulty]||DIFFICULTIES.standard;
  const challengeParty=normalizeChallengeParty(prefs.partyIds,[...available]);
  return `<section class="title-screen expedition-title">
    <div class="title-art"></div><div class="title-shade"></div>
    <header class="topbar"><div class="brand">${icon('crystal')}<span>格朗德<small>G R A N D E</small></span></div><div class="top-location"><span class="live-dot"></span>远征档案 · 停机之前</div>${toolbar}</header>
    <div class="title-content">
      <div class="eyebrow"><span></span>THE CRYSTAL ECHO</div>
      <h1>魔晶<span>回响</span></h1>
      <p class="title-description">读懂敌人的下一步。<br>用你选择的方式，夺回主动。</p>
      <div class="title-party">${HEROES.map(h=>`<div class="${available.has(h.id)?'':'unmet'}" title="${h.name} · ${available.has(h.id)?h.role:'在剧情远征中解锁'}">${portrait(h.id)}<span>${h.short}</span></div>`).join('')}<div class="party-label">${HEROES.length} 位同行者 · 已解锁 ${selectable.length} 位<br><small>气息 · 魔力 · 连击 · 平衡</small></div></div>
      <button class="journal-entry" data-action="hero-journal">${icon('book')}角色图鉴<span>查看机制、技能与加入条件</span>${icon('arrow')}</button>
      <div class="difficulty-label">远征难度</div>
      <div class="difficulty-select" role="group" aria-label="难度">${Object.entries(DIFFICULTIES).map(([id,d])=>`<button data-difficulty="${id}" class="${id===prefs.difficulty?'active':''}" aria-pressed="${id===prefs.difficulty}">${d.name}</button>`).join('')}</div>
      <p class="difficulty-desc">${difficulty.desc}</p>
      ${journeyMarkup}
      ${saved?`<button class="continue-button" data-action="continue">继续${saved.challengeMode==='solo'?'独狼挑战':''} · ${bossOf(saved).name} · 第 ${saved.round} 回合 ${icon('arrow')}</button>`:''}
      <div class="start-meta">${icon('clock')} 回合制战斗 <span>·</span> 全队自由行动 <span>·</span> 自动保存</div>
    </div>
    <section class="mission-select" aria-label="选择 BOSS">
      <div class="challenge-heading"><h2>自由挑战</h2><span>选择敌人与出战方式</span></div>
      <div class="challenge-mode" role="group" aria-label="自由挑战模式"><button data-mode="party" aria-pressed="${!solo}" class="${solo?'':'active'}">三人小队</button><button data-mode="solo" aria-pressed="${solo}" class="${solo?'active':''}">独狼挑战</button></div>
      ${solo?'':`<button class="challenge-party-entry" data-action="challenge-party" aria-label="调整自由挑战队伍">${icon('people')}${challengeParty.map(id=>HEROES.find(h=>h.id===id).short).join(' · ')}<span>调整队伍 →</span></button>`}
      ${solo?`<div class="solo-selection"><p>选择一名已解锁角色，独自应对整场战斗。</p><div class="solo-heroes" role="group" aria-label="选择独狼角色">${selectable.map(hero=>`<button data-solo-hero="${hero.id}" class="${soloHero.id===hero.id?'selected':''}" aria-pressed="${soloHero.id===hero.id}">${portrait(hero.id)}<span>${esc(hero.short)}</span></button>`).join('')}</div><small>${soloRuleDescription()}</small></div>`:''}
      <div class="mission-heading"><span class="tiny-label">敌人档案</span><span>选择挑战 <b>01 — ${String(Object.keys(BOSSES).length).padStart(2,'0')}</b></span></div>
      <div class="mission-list">${Object.values(BOSSES).map(b=>encounterDescription(b,solo)).map((b,i)=>`<button class="mission-card ${b.id===chosen.id?'selected':''}" style="--encounter:${b.color}" data-boss="${b.id}" aria-pressed="${b.id===chosen.id}">
        <span class="mission-number">${String(i+1).padStart(2,'0')}</span><span class="mission-symbol">${icon(b.icon)}</span>
        <span class="mission-copy"><small>${esc(b.subtitle)}</small><strong>${esc(b.name)}</strong><span>${esc(b.mechanic)}</span></span>
        <span class="mission-check">${icon(b.id===chosen.id?'check':'chevron')}</span>
      </button>`).join('')}</div>
      <div class="mission-brief" style="--encounter:${chosen.color}"><span class="tiny-label">${esc(chosen.region)}</span><p>${esc(chosen.brief)}</p><button class="primary free-start" data-action="start">${icon('play')}${solo?`${esc(soloHero.short)}独自挑战`:'小队挑战'} · ${chosen.name}</button><div class="mission-links"><button data-action="boss-codex">BOSS 全部招式 ${icon('book')}</button><button data-action="help">战斗手册 ${icon('arrow')}</button></div></div>
    </section>
    <footer class="title-footer"><span>GRANDE · EXPEDITION DEMO <b>03.5</b></span><button class="gm-entry" data-action="gm">GM · 角色全开</button><button data-action="voice-cast">角色声音试听</button><button data-action="model-review">模型样件 · 潜行</button><button data-action="credits">世界观与制作记录 ${icon('arrow')}</button><span>${records.length ? '已完成 '+records.length+' 次挑战' : '建议使用横屏 · 支持鼠标与键盘'}</span></footer>
  </section>`;
}

function resourceMeter(h) {
  const balance = h.id === 'ric', maximum=h.maxResource;
  const primary=`<div class="resource-heading"><span>${h.resourceName}</span><strong>${balance?signed(h.resource):h.resource}<small> / ${balance?'±'+maximum:maximum}</small></strong></div>
    <div class="resource-meter ${balance?'balance-meter':''}" role="meter" aria-label="${h.short}的${h.resourceName}" aria-valuenow="${h.resource}" aria-valuemin="${balance?-maximum:0}" aria-valuemax="${maximum}">
    ${balance ? Array.from({length:maximum*2+1},(_,i)=>i-maximum).map(n=>`<i class="${n===0?'zero ':''}${n===h.resource?'current ':''}${n&&Math.sign(n)===Math.sign(h.resource)&&Math.abs(n)<=Math.abs(h.resource)?'filled':''}"><span>${n===0?'0':n===-maximum?'−':n===maximum?'+':''}</span></i>`).join('') : Array.from({length:maximum},(_,i)=>`<i class="${i<h.resource?'filled':''}"></i>`).join('')}
    </div>${balance?`<div class="balance-caption"><span>负域 · 制敌</span><span>正域 · 强身</span></div>`:''}`;
  if(!h.secondaryName)return primary;
  const value=h.secondary||0,max=h.maxSecondary||6;
  return `<div class="resource-pair"><div class="primary-resource">${primary}</div><button class="secondary-resource ${value>=3?'ready':''}" data-tooltip="status" data-detail="secondary" data-owner="${h.id}" aria-label="${esc(h.secondaryName)} ${value} / ${max}，悬浮查看魔力循环"><span>${esc(h.secondaryName)}</span><strong>${value}<small> / ${max}</small></strong><span class="secondary-pips" role="meter" aria-label="${esc(h.short)}的${esc(h.secondaryName)}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${value}">${Array.from({length:max},(_,i)=>`<i class="${i<value?'filled':''}"></i>`).join('')}</span></button></div>`;
}

function skillCard(state, h, baseSkill, i, busy) {
  const skill=resolvedSkill(state,h.id,baseSkill.id);
  const reason = canUse(state,h.id,skill.id);
  const preview = skillPreview(state,h.id,skill.id);
  const boosted=!skill.manaRecovery && (preview.empowered || (h.attackBuff>0&&skill.damage>0) || (h.id==='knibbs'&&h.intuition>=3&&['focus','scatter'].includes(skill.id)) || (h.id==='apeilia'&&h.lastKind&&skill.damage&&h.lastKind!==skill.kind));
  const ap=preview.ap??skill.ap,resourceCost=preview.cost??skill.cost??0;
  const secondarySpend=preview.secondarySpend??skill.secondaryCost??0;
  const cost = resourceCost ? ` · ${resourceCost}${h.resourceName}` : secondarySpend ? ` · ${secondarySpend}${h.secondaryName||'二级资源'}` : skill.shift ? ` · 平衡${signed(skill.shift)}` : '';
  let output = preview.damage ? `预计 ${preview.damage} 伤害${preview.hits>1?' / '+preview.hits+'段':''}` : preview.shield ? (preview.selfShield?'自身':'全队')+'护盾 +'+preview.shield : preview.heal ? (preview.self?'自身生命 +':preview.allHeal?'主疗 +':'单体生命 +')+preview.heal+(preview.allHeal&&!preview.self&&preview.heal!==preview.allHeal?' / 其余 +'+preview.allHeal:'') : preview.allHeal ? '全队生命 +'+preview.allHeal : preview.secondaryGain ? `${h.secondaryName} +${preview.secondaryGain}` : preview.refund ? `魔力 +${preview.refund}` : skill.hint;
  if(preview.allShield)output=`护盾 自身+${preview.shield+preview.allShield} / 其他+${preview.allShield}`;
  if(skill.regenTurns)output=`单体回合末 +${skill.regenAmount||32} × ${skill.regenTurns}轮`;
  if(skill.revive)output=`单体抢救 +${preview.heal} / 救起 ${skill.revive}`;
  if((skill.attackBuff||skill.selfAttackBuff)&&!skill.damage)output=`${skill.selfAttackBuff?'自身':'每人'}下次攻击 +${skill.selfAttackBuff||skill.attackBuff}%`;
  if(!skill.damage&&!preview.shield&&!preview.heal&&!preview.allHeal&&!skill.regenTurns&&!skill.attackBuff&&!skill.selfAttackBuff){
    const effects=[skill.hardControl?'封锁行动':'',skill.weaken?'敌伤 −20%':'',skill.vulnerable?'敌方承伤 +15%':'',skill.stripBuffs?`驱散 ${skill.stripBuffs} 层`:'',skill.mark?'标记 · 后续伤害 +15%':'',(preview.allCleanse||skill.allCleanse)?`全队净化 ${preview.allCleanse||skill.allCleanse} 层`:preview.cleanse?`${preview.self?'自身':'全队'}净化 ${preview.cleanse} 层`:''].filter(Boolean);
    if(effects.length)output=effects.slice(0,2).join(' · ')+(preview.refund?` · 回魔 +${preview.refund}`:'');
  }
  const requirement=victoryRequirements(state);
  if(state.boss.finale && skill.damage)output=requirement.solo?`终幕命中 +${Math.max(0,Math.min(requirement.finaleHits-(state.boss.finaleHits||0),preview.hits||1))}`:'终幕 · '+(skill.kind==='physical'?'物理':'魔法')+'登记 '+((skill.kind==='physical'?state.boss.finalePhysical:state.boss.finaleMagic)?'已完成':'+1');
  if(state.boss.core && skill.damage)output = requirement.solo?`核心命中 +${Math.max(0,Math.min(requirement.coreHits-(state.boss.coreHits||0),preview.hits||1))}`:'核心 · '+(skill.kind==='physical'?'物理':'魔法')+'命中 +'+Math.max(0,Math.min((skill.kind==='physical'?requirement.corePhysical:requirement.coreMagic)-(skill.kind==='physical'?state.boss.corePhysical:state.boss.coreMagic),skill.hits||1));
  const stagger=state.boss.core||state.boss.finale?'—':preview.stagger||0;
  return `<button class="team-skill ${boosted?'empowered':''} ${reason?'unavailable':''}" data-owner="${h.id}" data-skill="${skill.id}" data-tooltip="skill" data-detail="${skill.id}" aria-label="${h.short} · ${skill.name}" aria-disabled="${!!reason||busy}" ${busy?'disabled':''}>
    <span class="skill-glyph">${icon(skill.icon)}</span>
    <span class="skill-lines"><span class="skill-title"><span class="skill-name">${esc(skill.name)}</span>${boosted?'<span class="empower-mark">强化</span>':''}<kbd>${['Q','W','E','R','T'][i]}</kbd></span><span class="skill-outcome">${skillTypeBadge(skill)}<span class="skill-result">${esc(output)}</span></span><span class="skill-bottom"><span class="skill-price ${reason?'blocked':''}">${esc(reason || ap+' AP'+cost)}</span><span class="skill-stagger" aria-label="本次削韧 ${stagger}">削韧 <b>${stagger}</b></span></span></span>
    <span class="ap-chip">${ap}</span>
  </button>`;
}

function heroRow(state, h, i, busy) {
  return `<div class="team-row ${h.id===state.selected?'selected':''} ${h.hp<=0?'down':''}" style="--hero:${h.color}">
    <button class="team-hero" data-hero="${h.id}" data-owner="${h.id}" data-tooltip="hero" aria-label="选择${h.name}" aria-pressed="${state.selected===h.id}" ${busy?'disabled':''}>
      ${portrait(h.id==='youmu'&&h.youmuForm==='captain'?'youmu_inner':h.id)}
      <span class="hero-vitals"><span class="hero-name">${h.short}<kbd>${i+1}</kbd></span><span class="hero-health">${h.hp}<small> / ${h.maxHp}</small>${h.shield?`<b>${icon('shield')}${h.shield}</b>`:''}</span><span class="hp-track"><i style="width:${h.hp/h.maxHp*100}%"></i></span><span class="hero-effects">${h.hp<=0?'倒下 · 可用药剂救起':h.resonance?'共鸣 '+h.resonance+' / 5':h.guard?'防御中':'生命'}</span></span>
    </button>
    <div class="hero-resource">${resourceMeter(h)}<div class="hero-statuses" aria-label="${h.short}的被动与状态">${statusBadges(state,h)}</div></div>
    <div class="team-skills" aria-label="${h.name}的技能">${equippedSkills(state,h.id).map((s,j)=>skillCard(state,h,s,j,busy)).join('')}</div>
  </div>`;
}

export function inspect(state, owner, id) {
  const h=heroOf(state,owner), s=resolvedSkill(state,owner,id), p=skillPreview(state,owner,s.id);
  const delta=p.resourceAfter-p.resourceBefore;
  return `<strong style="color:${h.color}">${h.short} · ${s.name}</strong><span>${esc(s.desc)}</span><b>${h.resourceName} ${p.resourceBefore} → ${p.resourceAfter} ${delta?'('+signed(delta)+')':''}${p.stagger?' · 削韧 '+p.stagger:''}</b>${p.notes?.length?`<em>${esc(p.notes.join(' · '))}</em>`:''}`;
}

function specialProgress(state){
  const b=state.boss,r=victoryRequirements(state);
  if(b.finale){
    const attacks=r.solo?`<span class="${b.finaleHits>=r.finaleHits?'done':''}">任意属性命中 <b>${b.finaleHits||0} / ${r.finaleHits}</b></span>`:`<span class="${b.finalePhysical?'done':''}">物理命中 <b>${b.finalePhysical?'✓':'待命中'}</b></span><span class="${b.finaleMagic?'done':''}">魔法命中 <b>${b.finaleMagic?'✓':'待命中'}</b></span>`;
    return `<div class="finale-counts ${r.solo?'solo-counts':''}">${attacks}<span class="${state.response?'done':''}">预备应对 <b>${state.response?'✓':'待选择'}</b></span><strong>剩余 ${b.finaleTurns} 回合。${r.solo?'完成命中':'完成物理与魔法命中'}并准备应对后，结束回合抵住最后一击。</strong></div>`;
  }
  if(b.core)return `<div class="core-counts">${r.solo?`<span>任意属性命中 <b>${b.coreHits||0} / ${r.coreHits}</b></span>`:`<span>物理 <b>${b.corePhysical} / ${r.corePhysical}</b></span><span>魔法 <b>${b.coreMagic} / ${r.coreMagic}</b></span>`}<strong>剩余 ${b.coreTurns} 回合</strong></div>`;
  return `<div class="foe-health"><i style="width:${Math.max(0,b.hp/b.maxHp*100)}%"></i><span>${b.hp.toLocaleString()} / ${b.maxHp.toLocaleString()}</span></div><div class="foe-stagger"><span>${b.broken?'架势崩溃':b.exposed?'破绽 · 易伤50%':'韧性'}</span><div><i style="width:${b.stagger/b.maxStagger*100}%"></i></div><b>${b.stagger}</b></div>`;
}

export function battleView(state, busy, toolbar, time, lastSkill) {
  const b=state.boss, meta=bossOf(state), h=heroOf(state,state.selected), intent=intentInfo(state);
  const summary=bossSummary(state), responses=responseOptions(state);
  const prepared=state.response;
  const responseActor=prepared?heroOf(state,prepared.actor):h;
  return `<section class="battle-screen battle-v2 battle-v3 ${state.challengeMode==='solo'?'is-solo':''} battle-layout">
    <header class="topbar"><button class="brand" data-action="pause">${icon('crystal')}<span>格朗德<small>G R A N D E</small></span></button><div class="top-location">${esc(meta.region)} <span>/</span> <b>${DIFFICULTIES[state.difficulty].name}</b></div><span class="battle-clock" id="elapsed">${time}</span>${toolbar}</header>
    <div class="fight-round"><span class="tiny-label">ROUND</span><strong>${String(state.round).padStart(2,'0')}</strong><span>${busy?'行动演出中':state.mode==='playing'?'我方行动':state.mode==='victory'?'挑战完成':'挑战结束'}</span><div class="round-tools"><button data-action="log" title="战斗记录">${icon('book')}</button><button data-action="camera" title="重置视角">${icon('camera')}</button></div></div>
    <section class="foe-hud" style="--encounter:${meta.color}" aria-label="BOSS 状态">
      <div class="foe-title"><span class="foe-symbol">${icon(meta.icon)}</span><div><small>${esc(meta.subtitle)}</small><h1>${b.finale?'归零终幕':b.core?'魔晶核心':esc(meta.name)}</h1></div><span class="foe-phase">${b.finale?'终幕':b.core?'核心暴露':'阶段 '+(b.stage+1)}</span></div>
      ${specialProgress(state)}
      <div class="foe-summary">${(b.finale?summary.filter(s=>s.label==='阶段'):summary).map(s=>`<span class="tone-${s.tone||'neutral'}">${esc(s.label)} <b>${esc(s.value)}</b></span>`).join('')}</div>
    </section>
    <aside class="tactics-panel" aria-label="敌方预告与应对">
      <div class="telegraph ${intent.danger?'danger':''} ${intent.good?'good':''}">
        <div class="telegraph-heading"><span class="tiny-label">下一步 · 敌方预告</span><button data-action="boss-codex">${icon('book')}全部招式 <kbd>B</kbd></button></div><h2>${icon(intent.icon)}${esc(intent.name)}</h2><p>${esc(intent.desc)}</p>
      </div>
      <div class="response-heading"><strong>应对 · ${responseActor.short}</strong><span>${prepared?'已支付 1 AP · 改选免费':'消耗 1 AP · 三选一'}</span></div>
      <div class="response-list">${responses.map((r,i)=>`<button class="response-option ${prepared?.id===r.id?'prepared':''}" data-response="${r.id}" title="${esc(r.description)}" ${busy||b.core||b.broken||b.hardControl||state.mode!=='playing'||(!prepared&&state.ap<1)||h.hp<=0?'disabled':''}><span class="response-icon">${icon(r.icon)}</span><span><strong>${r.name}<kbd>${['Z','X','C'][i]}</kbd></strong><small class="response-description">${b.core||b.broken||b.hardControl?'敌人本轮不会使用主招，无需准备应对。':esc(r.description)}</small><small class="response-compact">${b.core||b.broken||b.hardControl?'本轮没有敌方主招。':r.baseDamage>0?`护盾前${r.group?'每人':'目标'}承伤 ${r.damage} · 减伤 ${Math.round((1-r.damageFactor)*100)}%`:'本招没有直接伤害。'}</small><small>${esc(b.finale?r.reward.split('；')[0]:r.reward)}</small></span>${prepared?.id===r.id?icon('check'):''}</button>`).join('')}</div>
      <div class="response-owner">${b.finale?'完成命中要求并准备应对后，结束回合抵住最后一击。':b.core?'核心阶段需要完成上方显示的命中次数。':b.broken||b.hardControl?`敌方行动已取消，下一轮恢复到 ${state.maxAp} AP。`:prepared?'已预备：'+responseActor.short+' · '+(responses.find(r=>r.id===prepared.id)?.name||'应对'):'由选中队员执行：'+h.short}</div>
      
    </aside>
    <div class="field-note">${icon('spark')}<span>${esc(state.log[0]?.text || '')}</span></div>
    <section class="team-board" aria-label="全队战斗技能">
      <div class="board-heading">
        <div class="team-ap" role="status" aria-label="队伍行动点"><span>${state.challengeMode==='solo'?'独狼行动点':'队伍行动点'} <b>AP</b></span><strong>${state.ap}<small> / ${state.maxAp}</small></strong><div>${Array.from({length:state.maxAp},(_,i)=>`<i class="${i<state.ap?'filled':''}"></i>`).join('')}</div></div>
        <span class="board-hint">${state.heroes.length===1?'一人应战，五项技能。悬浮查看完整效果。':'直接点击任意队员的技能。按 1 / 2 / 3 切换快捷键队员。'}</span>
        <div class="board-actions"><button data-action="potion" ${busy||!state.ap||!state.potions?'disabled':''} title="1 AP · 为选中队员回复65生命，也可救起倒下的队员">${icon('potion')}<span>药剂 ×${state.potions}</span><kbd>V</kbd></button><button data-action="guard" ${busy||!state.ap||h.guard||h.hp<=0?'disabled':''} title="1 AP · 选中队员本轮减伤55%">${icon('shield')}<span>防御</span><kbd>F</kbd></button><button class="finish-turn" data-action="end" ${busy||state.mode!=='playing'?'disabled':''}>${busy?'<i class="spinner"></i> 演出中':'结束回合'}${icon('arrow')}<kbd>空格</kbd></button></div>
      </div>
      <div class="team-roster">${state.heroes.map((p,i)=>heroRow(state,p,i,busy)).join('')}</div>
      <div class="board-footnote">Q W E R T 使用选中队员技能 · V 药剂 · 拖动战场可 360° 旋转 · 发光或变名技能已满足条件</div>
    </section>
  </section>`;
}

export function helpView(state) {
  const solo=state?.challengeMode==='solo';
  return `<div class="battle-manual"><header class="manual-introduction"><div class="modal-eyebrow">战斗手册</div><h2>看清威胁，再选择收益。</h2><p>${state?`${solo?'独狼挑战由一名角色使用全部行动点':'小队模式由三名角色共享行动点'}，本场每轮恢复到 <b>${state.maxAp} AP</b>。`:'小队模式由三名角色共享行动点；独狼挑战由一名角色独自使用。当前行动点上限会显示在技能面板。'}每名角色携带五项技能，出战队员的技能始终同屏。敌人会在你结束回合后行动。</p>${solo?`<p class="manual-mode-rules">${soloRuleDescription()}</p>`:''}</header>
  <nav class="manual-navigation" aria-label="手册章节"><a href="#manual-decisions">回合判断</a><a href="#manual-companions">角色与资源</a><a href="#manual-enemies">敌人机制</a><a href="#manual-controls">操作与远征</a></nav>
  <section class="manual-section" id="manual-decisions"><div class="manual-section-title"><span>01</span><h3>先决定怎样接住下一招</h3></div><div class="manual-principles"><article>${icon('shield')}<h4>预备应对，保留选择</h4><p>花费 <b>1 AP</b>，从招架、回避和迎击中选择一种。右侧会写明当前预告下的承伤和收益。由选中队员执行，支付后可以免费更换方式与执行者。</p><p>群体攻击更难完全避开。护盾与个人防御可以继续降低伤害；敌人被打断时，应对不会触发。</p></article><article>${icon('break')}<h4>分清破韧发生的时机</h4><p>在我方行动时打空韧性，会取消本轮敌招，并获得 <b>50% 伤害加成</b>。用敌方出招后的反击破韧，只会在下轮留下易伤破绽，敌人仍会继续攻击。</p><p>敌人恢复架势后有一轮抗控。这时需要重新安排防守，不能靠连续打断跳过所有攻击。</p></article></div></section>
  <section class="manual-section" id="manual-companions"><div class="manual-section-title"><span>02</span><h3>每个人都有自己的资源循环</h3><button data-action="hero-journal">完整角色图鉴 ${icon('arrow')}</button></div><div class="manual-roster">${HEROES.map(h=>`<article class="manual-hero-card" data-manual-hero="${h.id}" style="--hero:${h.color}"><header>${portrait(h.id)}<div><h4>${esc(h.name)}</h4><span>${esc(h.role)}</span><strong>${esc(h.resourceName)} · ${esc(h.passiveName)}</strong></div></header><p>${esc(heroResourceDescription(h))}</p><p class="manual-passive">${esc(h.passiveDesc)}</p></article>`).join('')}</div></section>
  <section class="manual-section" id="manual-enemies"><div class="manual-section-title"><span>03</span><h3>读懂敌人，再调整出招</h3><button data-action="boss-codex">全部招式与数值 ${icon('book')}</button></div><p>点击敌人名称展开概要。完整招式、当前伤害和三种应对的具体收益，可随时按 <b>B</b> 查看。</p><div class="manual-enemy-list">${Object.values(BOSSES).map(b=>encounterDescription(b,solo)).map(b=>`<details class="manual-enemy" data-manual-boss="${b.id}" style="--encounter:${b.color}" ${state?.boss?.id===b.id?'open':''}><summary>${icon(b.icon)}<span><strong>${esc(b.name)}</strong><small>${esc(b.mechanic)}</small></span>${icon('chevron')}</summary><p>${esc(b.brief)}</p></details>`).join('')}</div></section>
  <section class="manual-section" id="manual-controls"><div class="manual-section-title"><span>04</span><h3>操作与旅程</h3></div><p>鼠标悬浮在技能、状态图标和头像上，即可查看完整说明。剧情远征包含两次路线选择，每次行程经历八场战斗；战后可以调整队伍与五个技能位。自由挑战也可选择已解锁角色独自出战。</p><div class="manual-shortcuts"><span><kbd>1 2 3</kbd>选择队员</span><span><kbd>Q W E R T</kbd>对应行技能</span><span><kbd>Z X C</kbd>预备应对</span><span><kbd>V / F</kbd>药剂 / 防御</span><span><kbd>空格</kbd>结束回合</span><span><kbd>Esc</kbd>暂停</span></div></section><button class="primary manual-return" data-action="close-modal">返回战场 ${icon('arrow')}</button></div>`;
}
