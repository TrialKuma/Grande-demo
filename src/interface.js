import {enemyIntentModels,enemyIntentBadgeView,enemyTargetOfTargetView,enemyAttributeBadgesView} from './enemy-intent-ui.js';
import {enemyTargetView,skillTargetLabel} from './enemy-ui.js';
import {statusBadges,heroResourceDescription,heroConceptDescription,skillTypeBadge,attributeEffectText} from './status-details.js';
import {HEROES, BOSSES, DIFFICULTIES, SOLO_RULES, canUse, heroOf, intentInfo, activeSkills, skillPreview, resolvedSkill, bossSummary, victoryRequirements,enemyTargets} from './combat.js';
import {icon} from './icons.js';
import {normalizeChallengeParty} from './gm-tools.js';
import {actionPointInfo,baseActionPoints,ACTION_POINT_RULES} from './action-points.js';
import {LESSONS,LEARNING_TIPS} from './training.js';
import {skillGrowth,resourceColor,resourceKind} from './skill-growth-ui.js';
import {resourceIcon,skillResourcesView} from './resource-ui.js';
import {ammoProfile} from './knibbs-passive.js';

export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const portrait = id => `<span class="portrait ${id}" role="img" aria-label="${id==='youmu_inner'?'游墓':HEROES.find(h=>h.id===id)?.name || id}"></span>`;
const signed = n => n > 0 ? '+' + n : String(n);
export const bossOf = state => BOSSES[state.boss.id] || BOSSES.golem;

const soloRuleDescription=()=>`每轮基础 ${SOLO_RULES.ap} AP，全部由这一名角色使用；结束时最多保留 ${ACTION_POINT_RULES.carryLimit} 点到下一轮，因此下一轮最多 ${SOLO_RULES.ap+ACTION_POINT_RULES.carryLimit} AP。敌方生命为同难度三人模式的 ${Math.round(SOLO_RULES.bossHp*100)}%，伤害为 ${Math.round(SOLO_RULES.bossDamage*100)}%；韧性上限为 ${SOLO_RULES.stagger}，每轮恢复 ${SOLO_RULES.staggerRegen} 点。巨人核心只需任意属性命中 ${SOLO_RULES.coreHits} 次。独狼每次主动攻击技能拆除一层归零屏障，三次同步后攻击属性 +6；最终终幕需要任意属性命中 ${SOLO_RULES.finaleHits} 次，使用角色防护技能，并存活至最后一击结束。`;
function encounterDescription(b,solo){
  if(solo&&b.id==='golem')return {...b,brief:`击碎逐层解体的岩铠，再以任意属性累计命中核心 ${SOLO_RULES.coreHits} 次，完成净化。`,mechanic:'延迟地裂 · 共鸣驱散 · 任意属性净化核心'};
  if(solo&&b.id==='final')return {...b,brief:`核心即将切断避难室的供气。先击碎屏障与躯壳；进入终幕后，以任意属性累计命中 ${SOLO_RULES.finaleHits} 次，并使用角色防护技能抵住最后一次放电。`,mechanic:'归零屏障 · 任意属性命中 · 终幕防护'};
  return b;
}

export function titleView(prefs, saved, toolbar, records, journeyMarkup='', {unlockedHeroes=[],unlockedBosses=[]}={}) {
  const available=new Set(['knibbs',...(Array.isArray(unlockedHeroes)?unlockedHeroes:[])]),solo=prefs.challengeMode==='solo';
  const challengeBosses=Object.values(BOSSES).filter(b=>!b.isTutorial&&!b.isSkirmish&&!b.isMinion);
  const availableBosses=challengeBosses.filter(b=>Array.isArray(unlockedBosses)&&unlockedBosses.includes(b.id));
  const chosenBoss=availableBosses.find(b=>b.id===prefs.bossId)||availableBosses[0];
  const chosen=chosenBoss?encounterDescription(chosenBoss,solo):null;
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
      <div class="challenge-mode" role="group" aria-label="自由挑战模式"><button data-mode="party" aria-pressed="${!solo}" class="${solo?'':'active'}">小队挑战</button><button data-mode="solo" aria-pressed="${solo}" class="${solo?'active':''}">独狼挑战</button></div>
      ${solo?'':`<button class="challenge-party-entry" data-action="challenge-party" aria-label="调整自由挑战队伍">${icon('people')}${challengeParty.map(id=>HEROES.find(h=>h.id===id).short).join(' · ')}<span>调整队伍 →</span></button>`}
      ${solo?`<div class="solo-selection"><p>选择一名已解锁角色，独自应对整场战斗。</p><div class="solo-heroes" role="group" aria-label="选择独狼角色">${selectable.map(hero=>`<button data-solo-hero="${hero.id}" class="${soloHero.id===hero.id?'selected':''}" aria-pressed="${soloHero.id===hero.id}">${portrait(hero.id)}<span>${esc(hero.short)}</span></button>`).join('')}</div><small>${soloRuleDescription()}</small></div>`:''}
      <div class="mission-heading"><span class="tiny-label">敌人档案</span><span>可挑战 <b>${availableBosses.length} / ${challengeBosses.length}</b></span></div>
      <div class="mission-list">${availableBosses.map(b=>encounterDescription(b,solo)).map((b,i)=>`<button class="mission-card ${b.id===chosen.id?'selected':''}" style="--encounter:${b.color}" data-boss="${b.id}" aria-pressed="${b.id===chosen.id}">
        <span class="mission-number">${String(i+1).padStart(2,'0')}</span><span class="mission-symbol">${icon(b.icon)}</span>
        <span class="mission-copy"><small>${esc(b.subtitle)}</small><strong>${esc(b.name)}</strong><span>${esc(b.mechanic)}</span></span>
        <span class="mission-check">${icon(b.id===chosen.id?'check':'chevron')}</span>
      </button>`).join('')}</div>
      ${chosen?`<div class="mission-brief" style="--encounter:${chosen.color}"><span class="tiny-label">${esc(chosen.region)}</span><p>${esc(chosen.brief)}</p><button class="primary free-start" data-action="start">${icon('play')}${solo?`${esc(soloHero.short)}独自挑战`:'小队挑战'} · ${chosen.name}</button><div class="mission-links"><button data-action="boss-codex">BOSS 全部招式 ${icon('book')}</button><button data-action="help">战斗手册 ${icon('arrow')}</button></div></div>`:`<div class="mission-empty"><h3>还没有解锁自由挑战</h3><p>在剧情远征中击败 BOSS 后，它就会出现在这里，之后可以反复挑战。想直接测试敌人，可以在 GM 里单独开放 BOSS。</p><button class="primary" data-action="journey-start">${icon('play')}开始新的剧情远征</button><button data-action="gm">打开 GM 试玩开关 ${icon('arrow')}</button></div>`}
    </section>
    <footer class="title-footer"><span>GRANDE · EXPEDITION DEMO <b>03.9</b></span><button class="gm-entry" data-action="gm">GM · 试玩开关</button><button data-action="voice-cast">角色声音试听</button><button data-action="bgm-jukebox">游戏原声试听</button><button data-action="art-review">场景与 BOSS 展示</button><button data-action="model-review">模型样件 · 潜行</button><button data-action="credits">世界观与制作记录 ${icon('arrow')}</button><span>${records.length ? '已完成 '+records.length+' 次挑战' : '建议使用横屏 · 支持鼠标与键盘'}</span></footer>
  </section>`;
}

function resourceMeter(h) {
  const balance = h.id === 'ric', maximum=h.maxResource;
  const primary=`<div class="resource-heading"><span>${resourceIcon(h)}${h.resourceName}</span><strong>${balance?signed(h.resource):h.resource}<small> / ${balance?'±'+maximum:maximum}</small></strong></div>
    <div class="resource-meter ${balance?'balance-meter':''}" role="meter" aria-label="${h.short}的${h.resourceName}" aria-valuenow="${h.resource}" aria-valuemin="${balance?-maximum:0}" aria-valuemax="${maximum}">
    ${balance ? Array.from({length:maximum*2+1},(_,i)=>i-maximum).map(n=>`<i class="side-${n<0?'negative':n>0?'positive':'zero'} ${n===0?'zero ':''}${n===h.resource?'current ':''}${n&&Math.sign(n)===Math.sign(h.resource)&&Math.abs(n)<=Math.abs(h.resource)?'filled':''}"><span>${n===0?'0':n===-maximum?'−':n===maximum?'+':''}</span></i>`).join('') : Array.from({length:maximum},(_,i)=>`<i class="${i<h.resource?'filled':''}"></i>`).join('')}
    </div>${balance?`<div class="balance-caption"><span>负域 · 制敌</span><span>正域 · 强身</span></div>`:''}`;
  return primary;
}

function skillCard(state, h, baseSkill, i, busy) {
  const skill=resolvedSkill(state,h.id,baseSkill.id);
  const reason = canUse(state,h.id,skill.id);
  const preview = skillPreview(state,h.id,skill.id);
  const boosted=!skill.manaRecovery && (preview.empowered || (h.attackBuff>0&&skill.damage>0) || (h.id==='apeilia'&&h.lastKind&&skill.damage&&h.lastKind!==skill.kind));
  const ap=preview.ap??skill.ap;
  let output = preview.damage ? `预计 ${preview.damage} 伤害${preview.hits>1?' / '+preview.hits+'段':''}` : preview.shield ? (preview.selfShield?'自身':'全队')+'护盾 +'+preview.shield : preview.heal ? (preview.self?'自身生命 +':preview.allHeal?'主疗 +':'单体生命 +')+preview.heal+(preview.allHeal&&!preview.self&&preview.heal!==preview.allHeal?' / 其余 +'+preview.allHeal:'') : preview.allHeal ? '全队生命 +'+preview.allHeal : preview.secondaryGain ? '资源准备' : preview.refund ? '被动回转' : skill.hint;
  if(preview.allShield)output=`护盾 自身+${preview.shield+preview.allShield} / 其他+${preview.allShield}`;
  if(skill.regenTurns)output=`单体回合末 +${skill.regenAmount||32} × ${skill.regenTurns}轮`;
  if(skill.revive)output=`单体抢救 +${preview.heal} / 救起 ${skill.revive}`;
  if(preview.protection&&!skill.damage)output=`${preview.selfProtection?'自身':'全队'} ${attributeEffectText({protection:preview.protection})}`;
  if(preview.personalProtection&&!skill.damage)output=`自身 ${attributeEffectText({protection:Math.max(preview.personalProtection,preview.protection)})}`;
  if((skill.attackBuff||skill.selfAttackBuff)&&!skill.damage)output=`${skill.selfAttackBuff?'自身':'全队'} ${attributeEffectText({attackBuff:skill.selfAttackBuff||skill.attackBuff})}`;
  if(!skill.damage&&!preview.protection&&!preview.shield&&!preview.heal&&!preview.allHeal&&!skill.regenTurns&&!skill.attackBuff&&!skill.selfAttackBuff){
    const effects=[skill.hardControl?'封锁行动':'',skill.weaken?'力量/智力 −8':'',skill.vulnerable?'敏捷/智力 −8':'',skill.stripBuffs?`驱散 ${skill.stripBuffs} 层`:'',skill.mark?'弱者标记':'',(preview.allCleanse||skill.allCleanse)?`全队净化 ${preview.allCleanse||skill.allCleanse} 层`:preview.cleanse?`${preview.self?'自身':'全队'}净化 ${preview.cleanse} 层`:''].filter(Boolean);
    if(effects.length)output=effects.slice(0,2).join(' · ');
  }
  if(preview.coverFire)output=`预备反制 ${preview.counterDamage} · 力/智 −18`;
  if(preview.confuse)output='杀意改写 · 转向、力/智 −16';
  if(preview.recordIntent)output='记录预告 · 延后行动、封附效';
  if(preview.evasion)output='闪避下一段攻击';
  if(preview.fieldCare)output=`受击存活后急救 +${preview.fieldCare}`;
  if(skill.loadAmmo){const ammo=ammoProfile(skill.loadAmmo);output=skill.variant==='knibbs_reload'?'填入普通弹 · 恢复装填选项':ammo.extraHits?`${ammo.name} · 追加 ${ammo.extraHits} 段`:`${ammo.name} · 命中驱散 ${ammo.stripBuffs} 层`;}
  if(preview.targeting==='all'&&preview.totalDamage!==undefined)output=`全体合计 ${preview.totalDamage} 伤害`;
  const requirement=victoryRequirements(state);
  if(state.boss.finale && skill.damage)output=requirement.solo?`终幕命中 +${Math.max(0,Math.min(requirement.finaleHits-(state.boss.finaleHits||0),preview.hits||1))}`:'终幕 · '+(skill.kind==='physical'?'物理':'魔法')+'登记 '+((skill.kind==='physical'?state.boss.finalePhysical:state.boss.finaleMagic)?'已完成':'+1');
  if(state.boss.core && skill.damage)output = requirement.solo?`核心命中 +${Math.max(0,Math.min(requirement.coreHits-(state.boss.coreHits||0),preview.hits||1))}`:'核心 · '+(skill.kind==='physical'?'物理':'魔法')+'命中 +'+Math.max(0,Math.min((skill.kind==='physical'?requirement.corePhysical:requirement.coreMagic)-(skill.kind==='physical'?state.boss.corePhysical:state.boss.coreMagic),skill.hits||1));
  const growth=skillGrowth(state,h.id,baseSkill.id);
  const stagger=preview.coverFire?preview.counterStagger:state.boss.core||state.boss.finale?'—':preview.stagger||0;
  return `<button class="team-skill ${boosted?'empowered':''} ${reason?'unavailable':''}" data-owner="${h.id}" data-skill="${skill.id}" data-tooltip="skill" data-detail="${skill.id}" aria-label="${esc(h.short+' · '+skill.name+(reason?'，当前不可施放：'+reason:''))}" aria-disabled="${!!reason||busy}" ${busy?'disabled':''}>
    <span class="skill-glyph">${icon(skill.icon)}</span>
    <span class="skill-lines"><span class="skill-title"><span class="skill-name">${esc(skill.name)}</span><span class="skill-tags">${skillTypeBadge(skill)}${skillTargetLabel(preview)?`<span class="skill-target-type">${skillTargetLabel(preview)}</span>`:''}</span>${boosted?'<span class="empower-mark">强化</span>':''}<kbd>${['Q','W','E','R'][i]}</kbd></span><span class="skill-outcome"><span class="skill-result">${esc(output)}</span></span><span class="skill-bottom"><span class="skill-price">${skillResourcesView(state,h,skill,preview)}</span><span class="skill-stagger" aria-label="本次削韧 ${stagger}">削韧 <b>${stagger}</b></span></span></span>
    ${growth.length?`<span class="skill-growth-stars" data-upgrade-count="${growth.length}" aria-label="已获得 ${growth.length} 项技能强化">${'★'.repeat(growth.length)}</span>`:''}<span class="ap-chip">${ap}</span>
  </button>`;
}

function heroRow(state, h, i, busy) {
  const skills=activeSkills(state,h.id);
  return `<div class="team-row ${h.id===state.selected?'selected':''} ${h.hp<=0?'down':''}" style="--hero:${h.color};--resource-color:${resourceColor(h)}" data-resource-kind="${resourceKind(h)}">
    <button class="team-hero" data-hero="${h.id}" data-owner="${h.id}" data-tooltip="hero" aria-label="选择${h.name}" aria-pressed="${state.selected===h.id}" ${busy?'disabled':''}>
      ${portrait(h.id==='youmu'&&h.youmuForm==='captain'?'youmu_inner':h.id)}
      <span class="hero-vitals"><span class="hero-name">${h.short}<kbd>${i+1}</kbd></span><span class="hero-health">${h.hp}<small> / ${h.maxHp}</small>${h.shield?`<b>${icon('shield')}${h.shield}</b>`:''}</span><span class="hp-track"><i style="width:${h.hp/h.maxHp*100}%"></i>${h.shield>0?`<span class="hp-shield" style="width:${Math.min(100,h.shield/h.maxHp*100)}%" aria-label="护盾 ${h.shield}"></span>`:""}</span><span class="hero-effects">${h.hp<=0?'倒下 · 可用药剂救起':h.protection?`<span class="protected">防护姿态</span>`:h.resonance?'共鸣 '+h.resonance+' / 5':'生命'}</span></span>
    </button>
    <div class="hero-resource">${resourceMeter(h)}</div>
    <div class="team-skills" style="--skill-count:${Math.max(1,skills.length)}" aria-label="${h.name}的技能">${skills.map((s,j)=>skillCard(state,h,s,j,busy)).join('')}</div><div class="hero-statuses" aria-label="${h.short}的被动与状态">${statusBadges(state,h)}</div>
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
    return `<div class="finale-counts ${r.solo?'solo-counts':''}">${attacks}<span class="${b.finaleProtected?'done':''}">角色防护 <b>${b.finaleProtected?'✓':'待施放'}</b></span><strong>剩余 ${b.finaleTurns} 回合。${r.solo?'完成命中':'完成物理与魔法命中'}并使用角色防护技能后，结束回合抵住最后一击。</strong></div>`;
  }
  if(b.core)return `<div class="core-counts">${r.solo?`<span>任意属性命中 <b>${b.coreHits||0} / ${r.coreHits}</b></span>`:`<span>物理 <b>${b.corePhysical} / ${r.corePhysical}</b></span><span>魔法 <b>${b.coreMagic} / ${r.coreMagic}</b></span>`}<strong>剩余 ${b.coreTurns} 回合</strong></div>`;
  return `<div class="foe-health"><i style="width:${Math.max(0,b.hp/b.maxHp*100)}%"></i><span>${b.hp.toLocaleString()} / ${b.maxHp.toLocaleString()} · ${Math.ceil(b.hp/b.maxHp*100)}%</span></div><div class="foe-stagger"><span>${b.broken?'架势崩溃':b.exposed?'破绽 · 易伤50%':'韧性'}</span><div><i style="width:${b.stagger/b.maxStagger*100}%"></i></div><b>${b.stagger}</b></div>`;
}

export function battleView(state, busy, toolbar, time, lastSkill) {
  const b=state.boss, meta=bossOf(state), h=heroOf(state,state.selected), intent=intentInfo(state);
  const ap=actionPointInfo(state), lesson=LESSONS[b.id], learning=!!state.skillAccess, intents=enemyIntentModels(state);
  return `<section class="battle-screen battle-v2 battle-v3 ${state.challengeMode==='solo'?'is-solo':''} battle-layout ${state.heroes.length<3?'is-small-party':''} ${learning?'is-learning':''} ${enemyTargets(state,{includeDefeated:true}).length>1?'has-multiple-enemies':''}" style="--party-size:${state.heroes.length}">
    <header class="topbar"><button class="brand" data-action="pause">${icon('crystal')}<span>格朗德<small>G R A N D E</small></span></button><div class="top-location">${esc(meta.region)} <span>/</span> <b>${meta.isSkirmish?'沿途遭遇':meta.isTutorial?'教学实战':DIFFICULTIES[state.difficulty].name}</b></div><span class="battle-clock" id="elapsed">${time}</span>${toolbar}</header>
    <div class="fight-round"><span class="tiny-label">ROUND</span><strong>${String(state.round).padStart(2,'0')}</strong><span>${busy?'行动演出中':state.mode==='playing'?'我方行动':state.mode==='victory'?'挑战完成':'挑战结束'}</span><div class="round-tools"><button data-action="log" title="战斗记录">${icon('book')}</button><button data-action="camera" title="重置视角">${icon('camera')}</button></div></div>
    <section class="foe-hud" style="--encounter:${meta.color}" aria-label="敌人状态">
      <div class="foe-title"><span class="foe-symbol">${icon(meta.icon)}</span><div><small>${esc(meta.subtitle)}</small><h1>${b.finale?'归零终幕':b.core?'魔晶核心':esc(meta.name)}</h1></div></div>
      <div class="enemy-vitals-line"><div class="enemy-primary-vitals">${specialProgress(state)}</div>${enemyTargetOfTargetView(intents.find(item=>item.id==='boss'))}</div>
      ${enemyTargets(state,{includeDefeated:true}).length===1?enemyAttributeBadgesView(b,state):''}
      ${enemyTargetView(state,busy)}
    </section>
    <div id="enemy-intents" class="enemy-intents" aria-label="敌方行动预告">${intents.map(enemyIntentBadgeView).join('')}</div>
    <div class="battle-reference"><button data-action="boss-codex">${icon('book')}敌人招式 <kbd>B</kbd></button></div>
    ${lesson?`<details class="battle-tutorial" open><summary>${esc(lesson.title)}</summary><p>${esc(lesson.text)}</p>${LEARNING_TIPS[h.id]?`<p>${esc(h.short)}：${esc(LEARNING_TIPS[h.id])}</p>`:''}</details>`:''}
    <div class="field-note">${icon('spark')}<span>${esc(state.log[0]?.text || '')}</span></div>
    <section class="team-board" aria-label="全队战斗技能">
      <div class="board-heading">
        <div class="team-ap" role="status" tabindex="0" data-tooltip="action-points" data-owner="${h.id}" data-detail="current" aria-label="队伍行动点 ${state.ap}/${state.maxAp}"><span>${state.challengeMode==='solo'?'独狼行动点':'队伍行动点'}</span><strong>${state.ap}<small> / ${state.maxAp}</small></strong><div>${Array.from({length:state.maxAp},(_,i)=>`<i class="${i<state.ap?'filled':''}"></i>`).join('')}</div></div>
        <div class="board-actions"><button data-action="potion" ${busy||!state.ap||!state.potions?'disabled':''} title="1 AP · 为选中队员回复65生命，也可救起倒下的队员">${icon('potion')}<span>药剂 ×${state.potions}</span><kbd>V</kbd></button><button class="finish-turn" data-action="end" data-tooltip="action-points" data-owner="${h.id}" data-detail="end" aria-label="${busy?'行动演出中':'结束回合'}" ${busy||state.mode!=='playing'?'disabled':''}><span class="finish-copy">${busy?'<i class="spinner"></i> 演出中':'结束回合'}</span>${icon('arrow')}<kbd>空格</kbd></button></div>
      </div>
      <div class="team-roster">${state.heroes.map((p,i)=>heroRow(state,p,i,busy)).join('')}</div>
    </section>
  </section>`;
}

export function helpView(state) {
  const solo=state?.challengeMode==='solo',size=state?.heroes?.length||3;
  return `<div class="battle-manual"><header class="manual-introduction"><div class="modal-eyebrow">战斗手册</div><h2>看清下一招，把行动分给合适的人。</h2><p>${state?`本场 ${size} 名角色共享每轮基础 <b>${baseActionPoints(state)} AP</b>。`:'剧情从一名角色开始：一人每轮基础 3 AP，两人 4 AP，三人 6 AP。独狼挑战使用独立的 5 AP 规则。'}技能花费行动点，你结束回合以后，敌人才会出手。教学阶段先学少量技能；进入正式 BOSS 流程后，所有同行者至少拥有四项技能。沿途遭遇和整备操练可学习备选技能，每人最多装配四项。</p><p>结束时最多保留 <b>${ACTION_POINT_RULES.carryLimit} 点未使用 AP</b> 到下一轮。例如剩 1 点，下轮便多 1 点；剩 3 点也只能留下 2 点。保留行动点不会延长护盾、核心或终幕的期限。</p>${solo?`<p class="manual-mode-rules">${soloRuleDescription()}</p>`:''}</header>
  <nav class="manual-navigation" aria-label="手册章节"><a href="#manual-decisions">回合判断</a><a href="#manual-companions">角色与资源</a><a href="#manual-enemies">敌人机制</a><a href="#manual-controls">操作与远征</a></nav>
  <section class="manual-section" id="manual-decisions"><div class="manual-section-title"><span>01</span><h3>防守也是角色技能的一部分</h3></div><div class="manual-principles"><article>${icon('shield')}<h4>给自己的防护留一个位置</h4><p>看清敌人要攻击谁，再使用掩护射击、战术重整、护甲或削弱等角色技能。是否带上这些能力，会影响你的四个技能位与行动分配。</p><p><b>防护姿态</b>提高敏捷、智力和意志，用来减少逐段伤害并抵抗控制，本次敌方回合结束后清除。同类防护取较强的一项；每批<b>护盾持续两次敌方回合</b>，先算属性防御，再扣护盾。</p></article><article>${icon('break')}<h4>破韧能创造进攻窗口</h4><p>我方行动时打空韧性，会取消本轮敌招，并获得 <b>50% 伤害加成</b>。若角色被动反击在敌人出手后破韧，易伤留到下一轮，但敌人下一轮仍会行动。</p><p>恢复架势后有一轮抗控，不能连续封锁；这时安排防护、护盾与治疗，或把输出集中在已有破绽上。</p></article></div></section>
  <section class="manual-section" id="manual-companions"><div class="manual-section-title"><span>02</span><h3>每个人都有自己的资源循环</h3><button data-action="hero-journal">完整角色图鉴 ${icon('arrow')}</button></div><div class="manual-roster">${HEROES.map(h=>`<article class="manual-hero-card" data-manual-hero="${h.id}" style="--hero:${h.color};--resource-color:${resourceColor(h)}" data-resource-kind="${resourceKind(h)}"><header>${portrait(h.id)}<div><h4>${esc(h.name)}</h4><span>${esc(h.role)}</span><strong>${esc(h.resourceName)} · ${esc(h.passiveName)}</strong></div></header><p>${esc(heroConceptDescription(h))}</p></article>`).join('')}</div></section>
  <section class="manual-section" id="manual-enemies"><div class="manual-section-title"><span>03</span><h3>读懂敌人，再调整出招</h3><button data-action="boss-codex">全部招式与数值 ${icon('book')}</button></div><p>点击敌人名称展开概要。按 <b>B</b> 可以随时查看完整招式、当前伤害和机制。先在三场教学里认识行动点、资源准备和配合，再面对正式 BOSS。</p><div class="manual-enemy-list">${Object.values(BOSSES).filter(b=>(!b.isTutorial&&!b.isSkirmish&&!b.isMinion)||b.id===state?.boss?.id).map(b=>encounterDescription(b,solo)).map(b=>`<details class="manual-enemy" data-manual-boss="${b.id}" style="--encounter:${b.color}" ${state?.boss?.id===b.id?'open':''}><summary>${icon(b.icon)}<span><strong>${esc(b.name)}</strong><small>${esc(b.mechanic)}</small></span>${icon('chevron')}</summary><p>${esc(b.brief)}</p></details>`).join('')}</div></section>
  <section class="manual-section" id="manual-controls"><div class="manual-section-title"><span>04</span><h3>操作与旅程</h3></div><p>悬浮技能、状态图标和头像可查看完整说明。新旅程有三场教学和八场正式战斗，两处分支会改变路线与结局。每处招募只提供当前遇到的一两位同伴；战后随机出现三项成长，选一项，然后调整队伍和已学技能。正式流程加入的同伴带齐四项技能。战后可以操控角色行走，靠近同伴或装置按 E 互动，再从出口前进；也可点目标自动走近。技能配置支持拖动交换，或先点击槽位再选技能。</p><p>多敌人战斗中，点击场上的敌人或上方目标卡，再用单体技能。标为「全体」的技能会命中所有存活敌人，但只支付一次费用。右侧逐一预告敌人的下一步；清掉随从能减少当轮压力，也可能使主敌失去支援。</p><div class="manual-shortcuts"><span><kbd>1 2 3</kbd>选择队员</span><span><kbd>Q W E R</kbd>对应行技能</span><span><kbd>V</kbd>药剂</span><span><kbd>B</kbd>敌人手册</span><span><kbd>空格</kbd>结束回合</span><span><kbd>Esc</kbd>暂停</span></div></section><button class="primary manual-return" data-action="close-modal">返回战场 ${icon('arrow')}</button></div>`;
}
