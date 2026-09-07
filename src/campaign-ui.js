import {HEROES,SKILLS,BOSSES,DIFFICULTIES,skillPreview} from './combat.js';
import {REWARDS} from './rewards.js';
import {CHAPTERS,RUN_TITLE,RUN_DESCRIPTION,STORY_SPEAKERS} from './story.js';
import {runDialogue,rewardOptions,battleForRun} from './campaign.js';
import {icon} from './icons.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hero=id=>HEROES.find(h=>h.id===id);
const portrait=id=>`<span class="portrait ${id}" role="img" aria-label="${STORY_SPEAKERS[id]?.name||hero(id)?.name||id}"></span>`;
function header(run,caption){
 return `<header class="journey-header"><div class="brand">${icon('crystal')}<span>格朗德<small>G R A N D E</small></span></div><div><strong>${RUN_TITLE}</strong><span>${caption}</span></div><div class="journey-actions"><button data-action="pause">${icon('pause')}声音与设置</button><button data-action="boss-codex">${icon('book')}BOSS 招式</button><button data-action="journey-title">保存并返回标题</button></div></header>`;
}
function route(run){
 return `<nav class="journey-route" aria-label="远征进度">${CHAPTERS.map((c,i)=>`<div class="${i<run.history.length?'cleared':''} ${i===run.chapter?'current':''}"><span>${i<run.history.length?icon('check'):String(i+1).padStart(2,'0')}</span><strong>${BOSSES[c.bossId].name}</strong></div>`).join('')}</nav>`;
}
function shell(run,cls,body){
 return `<section class="journey-screen ${cls}" data-region="${CHAPTERS[run.chapter].bossId}"><div class="journey-shade"></div>${header(run,CHAPTERS[run.chapter].title)}<div class="journey-content">${route(run)}${body}</div></section>`;
}
export function campaignEntry(run){
 const continuing=run&&run.phase!=='complete';
 return `<div class="campaign-entry"><div class="campaign-label">${icon('book')}六章剧情远征 · 四名可招募队友</div><button class="primary start-button" data-action="${continuing?'journey-continue':'journey-start'}">${icon('play')}<span>${continuing?'继续远征 · 第 '+(run.chapter+1)+' 章':RUN_TITLE}</span>${icon('arrow')}</button><p>${continuing?'队伍、奖励与故事进度已保存。':RUN_DESCRIPTION}</p>${continuing?'<button class="journey-new" data-action="journey-start">重新开始剧情远征</button>':''}</div>`;
}
function dialogueView(run){
 const chapter=CHAPTERS[run.chapter],lines=runDialogue(run),line=lines[run.line],speaker=STORY_SPEAKERS[line.speaker]||{...hero(line.speaker),portrait:line.speaker};
 const last=run.line===lines.length-1;
 return `<section class="journey-screen story-screen" data-region="${chapter.bossId}"><div class="story-shade"></div>${header(run,chapter.title)}
 <div class="story-location"><span class="tiny-label">${run.dialogue==='after'?'AFTER THE BATTLE':'BEFORE SHUTDOWN'}</span><h1>${chapter.title}</h1><p>${chapter.hook}</p><span>${chapter.location}</span></div>
 <div class="dialogue-stage"><div class="dialogue-speaker ${speaker?.portrait?'':'narration'}">${speaker?.portrait?portrait(speaker.portrait):icon(line.speaker==='narrator'?'book':'flag')}</div>
 <article class="dialogue-card" aria-live="polite" data-speaker="${line.speaker}"><div class="dialogue-label"><h2 style="color:${speaker?.color||'#d3c39f'}">${speaker?.name||'旁白'}</h2><span>${run.line+1} / ${lines.length}</span></div><p>${esc(line.text)}</p>
 <div class="dialogue-voice"><button data-action="voice-replay">${icon('volume')}重听本句</button><button data-action="voice-toggle" aria-pressed="true">配音 开</button><button data-action="story-auto" aria-pressed="false">自动 停</button><button data-action="voice-cast">角色选声</button><button data-action="story-history">${icon('book')}对白记录</button><span class="voice-status" role="status">中文合成配音</span></div><div class="dialogue-controls"><button class="text-button" data-action="story-prev" ${run.line===0?'disabled':''}>上一句</button><button class="text-button" data-action="story-skip">跳过本段</button><button class="primary" data-action="story-next">${last?(run.dialogue==='before'?'进入战斗':run.chapter===5?'结束远征':'领取战利品'):'继续对话'}${icon('arrow')}</button></div></article></div>
 <div class="story-progress">${route(run)}</div></section>`;
}
function rewardView(run){
 const options=rewardOptions(run),recruit=CHAPTERS[run.chapter].recruit;
 return shell(run,'reward-screen',`<div class="journey-intro"><span class="tiny-label">LESSONS FROM THE FIELD</span><h1>带走一份新的可能</h1><p>选择一项永久保留至本次远征结束的奖励。新技能会装入第 5 个技能位，可在整备中自由调整。</p>${recruit?`<div class="recruit-announcement">${portrait(recruit)}<span><strong>${hero(recruit).name}已加入同行队伍</strong><small>${hero(recruit).tag} · 下一场开始前可替换出战成员</small></span></div>`:''}</div>
 <div class="reward-grid">${options.map(r=>`<button class="reward-card" data-reward="${r.id}" style="--hero:${hero(r.heroId).color}"><div class="reward-top">${portrait(r.heroId)}<span><small>${hero(r.heroId).name}</small><b>${r.kind==='skill'?'新主动技能':'条件强化'}</b></span>${icon(r.kind==='skill'?'spark':'target')}</div><h2>${r.name}</h2><p>${esc(r.description)}</p><span class="reward-choose">选择此奖励 ${icon('arrow')}</span></button>`).join('')}</div>
 <div class="journey-note">${options.length} 选 1 · 不消耗战斗行动点 · 奖励将立即保存</div>`);
}
function campView(run,{partySlot=0,skillSlot=0}={}){
 const h=hero(run.focusHero),loadout=run.loadouts[h.id],preview=battleForRun(run,h.id),last=REWARDS[run.lastReward?.id];
 const owned=run.upgrades.map(id=>REWARDS[id]).filter(r=>r.heroId===h.id);
 return shell(run,'camp-screen',`<div class="camp-intro"><div><span class="tiny-label">BETWEEN THE BATTLES</span><h1>整备，再向前一步</h1><p>下场挑战：<b>${BOSSES[CHAPTERS[run.chapter].bossId].name}</b>。全员生命与药剂将在入场时恢复。</p></div><button class="primary" data-action="camp-depart">队伍准备好了 ${icon('arrow')}</button></div>
 ${last?`<div class="camp-reward">${icon('spark')}<span>已获得 <b>${last.name}</b>：${esc(last.description)}${run.lastReward.replaced?' 已装入第 5 位，替换 '+(SKILLS[last.heroId].find(s=>s.id===run.lastReward.replaced)?.name||'原技能')+'。':''}</span></div>`:''}
 <div class="camp-layout"><section class="camp-party"><div class="camp-section-heading"><h2>出战三人</h2><span>先选位置，再选换入队员</span></div>
 <div class="party-slots">${run.partyIds.map((id,i)=>`<button class="${partySlot===i?'selected':''}" data-party-slot="${i}" style="--hero:${hero(id).color}">${portrait(id)}<span><small>位置 ${i+1}</small><b>${hero(id).short}</b></span></button>`).join('')}</div>
 <div class="camp-section-heading"><h2>同行队员</h2><span>${run.unlockedHeroes.length} / 7</span></div>
 <div class="camp-roster">${HEROES.map(p=>run.unlockedHeroes.includes(p.id)?`<article class="camp-member ${h.id===p.id?'viewed':''}" style="--hero:${p.color}"><button class="camp-member-view" data-view-hero="${p.id}" data-tooltip="hero" data-owner="${p.id}">${portrait(p.id)}<span><strong>${p.name}</strong><small>${p.tag}</small></span></button><button class="swap-member" data-recruit="${p.id}">${run.partyIds.includes(p.id)?'调整位置':'换入队伍'}</button></article>`:`<article class="camp-member locked"><div class="locked-portrait">${icon('help')}</div><span><strong>尚未同行</strong><small>${({youmu:'通过折镜回廊后同行',haart:'通过紫雾圣所后同行',qianxing:'通过风暴栈桥后同行',patch:'通过地质层后同行'})[p.id]||'在旅途中相遇'}</small></span></article>`).join('')}</div></section>
 <section class="camp-skills" style="--hero:${h.color}"><div class="camp-section-heading"><h2>${h.name} · 技能配置</h2><span>携带 5 项技能</span></div><p class="camp-instruction">选择一个技能位，再点下方技能即可替换。已装备技能可点选定位。</p>
 <div class="loadout-slots">${loadout.map((id,i)=>{const s=SKILLS[h.id].find(s=>s.id===id);return `<button class="${skillSlot===i?'selected':''}" data-loadout-slot="${i}" data-tooltip="skill" data-owner="${h.id}" data-detail="${id}"><kbd>${['Q','W','E','R','T'][i]}</kbd>${icon(s.icon)}<strong>${s.name}</strong></button>`;}).join('')}</div>
 <div class="skill-library">${SKILLS[h.id].map(s=>{const unlocked=!s.unlockKey||run.upgrades.includes(s.unlockKey),slot=loadout.indexOf(s.id),p=skillPreview(preview,h.id,s.id);return `<button class="library-skill ${unlocked?'':'locked'} ${slot>=0?'equipped':''}" data-equip-skill="${s.id}" data-tooltip="skill" data-owner="${h.id}" data-detail="${s.id}" aria-disabled="${!unlocked}"><span class="library-icon">${icon(s.icon)}</span><span><strong>${s.name}<small>${slot>=0?'已装备 · '+['Q','W','E','R','T'][slot]:unlocked?'可替换':'奖励解锁'}</small></strong><p>${esc(s.desc)}</p><em>${p.ap||s.ap} AP${s.unlockKey&&!unlocked?' · 获得对应新技奖励后可装备':''}</em></span></button>`;}).join('')}</div>
 <div class="owned-upgrades"><h3>本次远征的成长</h3>${owned.length?owned.map(r=>`<p><b>${r.name}</b>${esc(r.description)}</p>`).join(''):'<p>尚未获得专属奖励；基础技能与被动始终可用。</p>'}</div></section></div>`);
}
function completionView(run){
 const rounds=run.history.reduce((sum,h)=>sum+h.round,0);
 return shell(run,'completion-screen',`<div class="ending-emblem">${icon('crystal')}</div><div class="journey-intro"><span class="tiny-label">ALL SEVEN ACCOUNTED FOR</span><h1>七个人，都上来了。</h1><p>考察队已送回学院，旧设施停止运转。<br>天快亮了。先吃顿热饭，再商量修栈桥的事。</p></div><div class="journey-totals"><div><strong>6 / 6</strong><span>完成的章节</span></div><div><strong>${rounds}</strong><span>总战斗回合</span></div><div><strong>${run.upgrades.length}</strong><span>获得的成长奖励</span></div></div><div class="ending-party">${run.unlockedHeroes.map(id=>`<div>${portrait(id)}<span>${hero(id).short}</span></div>`).join('')}</div><div class="ending-actions"><button class="primary" data-action="journey-start">尝试另一套队伍与奖励 ${icon('repeat')}</button><button data-action="journey-title">返回标题</button></div>`);
}
export function campaignView(run,options){
 if(run.phase==='dialogue')return dialogueView(run);
 if(run.phase==='reward')return rewardView(run);
 if(run.phase==='camp')return campView(run,options);
 if(run.phase==='complete')return completionView(run);
 return '';
}
