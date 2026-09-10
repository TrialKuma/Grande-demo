import {HEROES,SKILLS,SKILL_SLOTS,BOSSES,DIFFICULTIES,skillPreview,resolvedSkill} from './combat.js';
import {REWARDS} from './rewards.js';
import {RUN_TITLE,RUN_DESCRIPTION,STORY_SPEAKERS,ROUTE_CHOICES} from './story.js';
import {runDialogue,rewardOptions,battleForRun,currentChapter,runRoute,pathFor,routeOptions,currentEvent,endingForRun,dialogueNextLabel,consequenceNotes,recruitOptions,skillAccessFor,trainingCount,isLearningRun,formalLearning,interludeFor} from './campaign.js';
import {LEARNING_TIPS,LEARNING_ORDER} from './training.js';
import {icon} from './icons.js';
import {skillExplanation,skillTypeBadge} from './status-details.js';
const libraryDescription=(state,heroId,skillId)=>{const text=skillExplanation(state,heroId,skillId);return [text.cost,...text.effects,...text.conditions].join(' ');};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hero=id=>HEROES.find(h=>h.id===id);
const portrait=id=>`<span class="portrait ${id}" role="img" aria-label="${STORY_SPEAKERS[id]?.name||hero(id)?.name||id}"></span>`;
function header(run,caption){
 return `<header class="journey-header"><div class="brand">${icon('crystal')}<span>格朗德<small>G R A N D E</small></span></div><div><strong>${RUN_TITLE}</strong><span>${caption}</span></div><div class="journey-actions"><button data-action="pause">${icon('pause')}声音与设置</button><button data-action="boss-codex">${icon('book')}BOSS 招式</button><button data-action="journey-title">保存并返回标题</button></div></header>`;
}
function route(run){
 return `<nav class="journey-route ${run.legacyRoute?'legacy-route':isLearningRun(run)?'learning-route':''}" aria-label="可点击的远征路线图">${runRoute(run).map(node=>`<div class="route-step ${node.cleared?'cleared':''} ${node.current?'current':''}"><span class="route-number">${node.cleared?icon('check'):String(node.index+1).padStart(2,'0')}</span><div class="route-node-options">${(node.choices.length?node.choices:[{id:node.id}]).map(choice=>`<button data-action="${run.phase==='route'&&node.current?'choose-route':'route-inspect'}" data-route="${choice.id}" class="route-node ${choice.id===node.id?'chosen':''} ${node.id&&choice.id!==node.id?'not-taken':''}" ${node.current&&choice.id===node.id?'aria-current="step"':''}><strong>${BOSSES[choice.id]?.name||choice.name||choice.id}</strong>${node.choices.length?`<small>${choice.id===node.id?'本次路线':node.id?'另一条路线':'二选一'}</small>`:node.recruit?`<small>同行：${hero(node.recruit)?.short}</small>`:''}</button>`).join('')}</div></div>`).join('')}</nav>`;
}
function shell(run,cls,body){
 return `<section class="journey-screen ${cls}" data-region="${currentChapter(run).bossId}"><div class="journey-shade"></div>${header(run,`${currentChapter(run).title} · 第 ${run.chapter+1} / ${pathFor(run).length} 战`)}<div class="journey-content">${route(run)}${body}</div></section>`;
}
export function campaignEntry(run){
 const continuing=run&&run.phase!=='complete';
 return `<div class="campaign-entry"><div class="campaign-label">${icon('book')}${continuing&&run.legacyRoute?'旧档六战路线':'入门实战 · 分段招募 · 战间探索'}</div><button class="primary start-button" data-action="${continuing?'journey-continue':'journey-start'}">${icon('play')}<span>${continuing?'继续远征 · 第 '+(run.chapter+1)+' 战':RUN_TITLE}</span>${icon('arrow')}</button><p>${continuing?'队伍、奖励、路线与故事进度已保存。':RUN_DESCRIPTION}</p>${continuing?'<button class="journey-new" data-action="journey-start">重新开始剧情远征</button>':''}</div>`;
}
function dialogueView(run){
 const chapter=currentChapter(run),lines=runDialogue(run),line=lines[run.line],speaker=STORY_SPEAKERS[line.speaker]||{...hero(line.speaker),portrait:line.speaker};
 const last=run.line===lines.length-1;
 return `<section class="journey-screen story-screen" data-region="${chapter.bossId}"><div class="story-shade"></div>${header(run,chapter.title)}
 <div class="story-location"><span class="tiny-label">${({before:'BEFORE SHUTDOWN',after:'AFTER THE BATTLE',route:'THE ROAD WE CHOSE',event:'WHAT WE CAN DO',ending:'AFTER THAT NIGHT',skirmish:'KEEP THE PASSAGE CLEAR'})[run.dialogue]}</span><h1>${run.dialogue==='ending'?endingForRun(run).title:run.dialogue==='skirmish'?'先让通道安全下来':chapter.title}</h1><p>${run.dialogue==='ending'?endingForRun(run).summary:run.dialogue==='skirmish'?'途中实战只提供技能练习与补给，不另发成长奖励。':chapter.hook}</p><span>${chapter.location} · 第 ${run.chapter+1} / ${pathFor(run).length} 战 · ${run.unlockedHeroes.length} 人同行</span></div>
 <div class="dialogue-stage"><div class="dialogue-speaker ${speaker?.portrait?'':'narration'}">${speaker?.portrait?portrait(speaker.portrait):icon(line.speaker==='narrator'?'book':'flag')}</div>
 <article class="dialogue-card" aria-live="polite" data-speaker="${line.speaker}"><div class="dialogue-label"><h2 style="color:${speaker?.color||'#d3c39f'}">${speaker?.name||'旁白'}</h2><span>${run.line+1} / ${lines.length}</span></div><p>${esc(line.text)}</p>
 <div class="dialogue-voice"><button data-action="voice-replay">${icon('volume')}重听本句</button><button data-action="voice-toggle" aria-pressed="true">配音 开</button><button data-action="story-auto" aria-pressed="false">自动 停</button><button data-action="voice-cast">角色选声</button><button data-action="story-history">${icon('book')}对白记录</button><span class="voice-status" role="status">中文合成配音</span></div><div class="dialogue-controls"><button class="text-button" data-action="story-prev" ${run.line===0?'disabled':''}>上一句</button><button class="text-button" data-action="story-skip">跳过本段</button><button class="primary" data-action="story-next">${dialogueNextLabel(run)}${icon('arrow')}</button></div></article></div>
 <div class="story-progress">${route(run)}</div></section>`;
}
function rewardView(run){
 const options=rewardOptions(run),recruit=isLearningRun(run)?run.recruits.find(r=>r.after===currentChapter(run).bossId)?.heroId:currentChapter(run).recruit;
 return shell(run,'reward-screen',`<div class="journey-intro"><span class="tiny-label">LESSONS FROM THE FIELD</span><h1>带走一份新的可能</h1><p>选择一项永久保留至本次远征结束的奖励。新技能会装入可用技能位，可在整备中自由调整。每次随机提供三项，选定前不会因读档改变。</p>${recruit?`<div class="recruit-announcement">${portrait(recruit)}<span><strong>${hero(recruit).name}已加入同行队伍</strong><small>${hero(recruit).tag} · 下一场开始前可替换出战成员</small></span></div>`:''}</div>
 <div class="reward-grid">${options.map(r=>`<button class="reward-card" data-reward="${r.id}" style="--hero:${hero(r.heroId).color}"><div class="reward-top">${portrait(r.heroId)}<span><small>${hero(r.heroId).name}</small><b>${r.kind==='skill'?'新主动技能':'条件强化'}</b></span>${icon(r.kind==='skill'?'spark':'target')}</div><h2>${r.name}</h2><p>${esc(r.description)}</p><span class="reward-choose">选择此奖励 ${icon('arrow')}</span></button>`).join('')}</div>
 <div class="journey-note">${options.length} 选 1 · 不消耗战斗行动点 · 奖励将立即保存</div>`);
}
function campView(run,{partySlot=0,skillSlot=0}={}){
 const h=hero(run.focusHero),loadout=run.loadouts[h.id],preview=battleForRun(run,h.id),last=REWARDS[run.lastReward?.id];
 const access=isLearningRun(run)?skillAccessFor(run):null;
 const owned=run.upgrades.map(id=>REWARDS[id]).filter(r=>r.heroId===h.id);
 return shell(run,'camp-screen',`<div class="camp-intro"><div><span class="tiny-label">BETWEEN THE BATTLES</span><h1>整备，再向前一步</h1><p>下场挑战：<b>${BOSSES[run.skirmish?.bossId||currentChapter(run).bossId]?.name||currentChapter(run).title}</b>。全员生命与药剂将在入场时恢复。</p></div><button class="primary" data-action="camp-depart">队伍准备好了 ${icon('arrow')}</button></div>
 ${consequenceNotes(run).length?`<div class="campaign-consequences"><strong>之前的安排，这一战会派上用场</strong>${consequenceNotes(run).map(note=>`<span>${icon('check')}${esc(note)}</span>`).join('')}</div>`:''}
 ${last?`<div class="camp-reward">${icon('spark')}<span>已获得 <b>${last.name}</b>：${esc(last.description)}${run.lastReward.replaced?' 已装入第 4 位，替换 '+(SKILLS[last.heroId].find(s=>s.id===run.lastReward.replaced)?.name||'原技能')+'。':''}</span></div>`:''}
 ${isLearningRun(run)?`<div class="learning-summary"><strong>本次学会</strong>${run.lastLearning?.length?run.lastLearning.map(item=>`<span>${hero(item.heroId).short} · ${esc(SKILLS[item.heroId].find(s=>s.id===item.skillId)?.name)}</span>`).join(''):formalLearning(run)?'<span>正式远征中的同伴至少掌握四招，每场携带四项。沿途学会的新招可在整备时替换。</span>':'<span>入门阶段逐步熟悉技能；进入正式远征前，同伴会补齐至少四项基础技能。</span>'}</div>`:''}
 <div class="camp-layout"><section class="camp-party"><div class="camp-section-heading"><h2>出战 ${run.partyIds.length} 人</h2><span>先选位置，再选换入队员</span></div>
 <div class="party-slots">${run.partyIds.map((id,i)=>`<button class="${partySlot===i?'selected':''}" data-party-slot="${i}" style="--hero:${hero(id).color}">${portrait(id)}<span><small>位置 ${i+1}</small><b>${hero(id).short}</b></span></button>`).join('')}</div>
 <div class="camp-section-heading"><h2>同行队员</h2><span>${run.unlockedHeroes.length} / ${HEROES.length}</span></div>
 <div class="camp-roster">${HEROES.map(p=>run.unlockedHeroes.includes(p.id)?`<article class="camp-member ${h.id===p.id?'viewed':''}" style="--hero:${p.color}"><button class="camp-member-view" data-view-hero="${p.id}" data-tooltip="hero" data-owner="${p.id}">${portrait(p.id)}<span><strong>${p.name}</strong><small>${p.tag}</small></span></button><button class="swap-member" data-recruit="${p.id}">${run.partyIds.includes(p.id)?'调整位置':'换入队伍'}</button></article>`:`<article class="camp-member locked"><div class="locked-portrait">${icon('help')}</div><span><strong>${p.name} · 尚未同行</strong><small>${isLearningRun(run)?'沿救援路线分批加入，每次只在附近同伴中选择':({youmu:'折镜回廊后同行',haart:'紫雾圣所后同行',qianxing:'风暴栈桥后同行',patch:'地质层后同行'})[p.id]||'在旅途中相遇'}</small></span></article>`).join('')}</div></section>
 <section class="camp-skills" style="--hero:${h.color}"><div class="camp-section-heading"><h2>${h.name} · 技能配置</h2><span>已携带 ${loadout.length} 项 · 最多 ${SKILL_SLOTS} 项</span></div><p class="camp-instruction">拖动技能可以交换位置，也可把下方已学会的技能拖进技能位。点击技能位，再点击下方技能也能调整。</p>
 <div class="loadout-slots">${loadout.map((id,i)=>{const s=resolvedSkill(preview,h.id,id);return `<button class="${skillSlot===i?'selected':''}" draggable="true" data-drag-owner="${h.id}" data-drag-skill="${id}" data-drag-slot="${i}" data-loadout-slot="${i}" data-tooltip="skill" data-owner="${h.id}" data-detail="${id}"><kbd>${['Q','W','E','R'][i]}</kbd>${icon(s.icon)}<strong>${esc(s.name)}</strong>${skillTypeBadge(s)}</button>`;}).join('')}</div>
 <div class="skill-library">${SKILLS[h.id].map(base=>{const s=resolvedSkill(preview,h.id,base.id),unlocked=access?access[h.id].includes(s.id):!s.unlockKey||run.upgrades.includes(s.unlockKey),slot=loadout.indexOf(s.id),p=skillPreview(preview,h.id,s.id);return `<button class="library-skill ${unlocked?'':'locked'} ${slot>=0?'equipped':''}" draggable="${unlocked}" data-drag-owner="${h.id}" data-drag-skill="${s.id}" data-drag-slot="${slot}" data-equip-skill="${s.id}" data-tooltip="skill" data-owner="${h.id}" data-detail="${s.id}" aria-disabled="${!unlocked}"><span class="library-icon">${icon(s.icon)}</span><span><strong>${esc(s.name)}${skillTypeBadge(s)}<small>${slot>=0?'已装备 · '+['Q','W','E','R'][slot]:unlocked?'可替换':s.unlockKey?'奖励解锁':'参与战斗学习'}</small></strong><p>${esc(unlocked?libraryDescription(preview,h.id,s.id):s.unlockKey?'从战后随机提供的成长中获得后，可以装入技能位。':`再参与 ${Math.max(1,LEARNING_ORDER[h.id].indexOf(s.id)-1-trainingCount(run,h.id))} 次胜利或完成个人演练后学会。`)}</p><em>${p.ap??s.ap} AP${s.unlockKey&&!unlocked?' · 获得对应新技奖励后可装备':''}</em></span></button>`;}).join('')}</div>
 ${isLearningRun(run)?`<div class="personal-practice"><h3>个人演练 · ${h.short}</h3><p>${LEARNING_TIPS[h.id]}</p><p>基础技能已学 ${Math.min(5,2+trainingCount(run,h.id))} / 5。可在间章操练或途中实战中学习下一招，也可以在这里做单人演练；都不发放随机强化。</p><button data-practice="${h.id}" ${trainingCount(run,h.id)>=3?'disabled':''}>${trainingCount(run,h.id)>=3?'基础技能已学齐':'开始个人演练'}</button></div>`:''}<div class="owned-upgrades"><h3>本次远征的成长<small>成长奖励 ${owned.length} / ${Object.values(REWARDS).filter(r=>r.heroId===h.id).length}</small></h3>${owned.length?owned.map(r=>`<p><b>${r.name}</b>${esc(r.description)}</p>`).join(''):'<p>尚未获得专属奖励；参与战斗可以继续学习基础技能。</p>'}</div></section></div>`);
}
function completionView(run){
 const fights=[...run.history,...(run.skirmishHistory||[])],rounds=fights.reduce((sum,h)=>sum+h.round,0),ending=endingForRun(run);
 return shell(run,'completion-screen',`<div class="ending-emblem">${icon('crystal')}</div><div class="journey-intro"><span class="tiny-label">ALL SEVEN ACCOUNTED FOR</span><h1>${run.legacyRoute?'七个人，都上来了。':ending.title}</h1><p>${run.legacyRoute?'考察队已送回学院，旧设施停止运转。天快亮了，先吃顿热饭。':ending.summary}</p></div><div class="journey-totals"><div><strong>${fights.length}</strong><span>完成的战斗</span></div><div><strong>${rounds}</strong><span>总战斗回合</span></div><div><strong>${run.upgrades.length}</strong><span>获得的成长奖励</span></div></div>${!run.legacyRoute?`<div class="ending-outcomes"><h2>你们把时间花在了这些事上</h2>${Object.entries(ending.scores).map(([key,score])=>`<div class="${key===ending.id?'primary-outcome':''}"><strong>${({rescue:'救援照护',evidence:'证据保全',infrastructure:'设施后续'})[key]}</strong><span>${score} 点倾向</span></div>`).join('')}<p>所有路线都能救出七名考察队员；途中选择决定战斗准备，以及救援结束后进一步完成的事。</p></div>`:''}<div class="ending-party">${run.unlockedHeroes.map(id=>`<div>${portrait(id)}<span>${hero(id).short}</span></div>`).join('')}</div><div class="ending-actions"><button class="primary" data-action="journey-start">尝试另一条路线与队伍 ${icon('repeat')}</button><button data-action="journey-title">返回标题</button></div>`);
}
function routeView(run){
 const group=run.chapter===(isLearningRun(run)?6:3)?'crossing':'archive',definition=ROUTE_CHOICES[group];
 return shell(run,'route-screen',`<div class="journey-intro"><span class="tiny-label">CHOOSE A WAY THROUGH</span><h1>${definition.title}</h1><p>${definition.prompt}</p></div><div class="branch-choice-grid">${routeOptions(run).map(option=>`<button class="branch-choice-card" data-action="choose-route" data-route="${option.id}"><span class="branch-location">${option.location}</span><h2>${option.name}</h2><strong>${BOSSES[option.id]?.name||option.id}</strong><p>${esc(option.consequence)}</p><span class="branch-confirm">走这条路 ${icon('arrow')}</span></button>`).join('')}</div><p class="journey-note">这一处只走一条路线。选择后先听同伴回应，再进行队伍整备；另一位 BOSS 可在新远征或单场挑战中体验。</p>`);
}
function eventView(run){
 const event=currentEvent(run);
 return shell(run,'event-screen',`<div class="journey-intro"><span class="tiny-label">A LITTLE TIME TO HELP</span><h1>${event.title}</h1><p>${event.description}</p></div><div class="event-choice-grid">${event.options.map(option=>`<button class="event-choice-card" data-action="choose-event" data-event="${option.id}"><span class="event-symbol">${icon(({rescue:'heal',evidence:'book',infrastructure:'shield'})[option.score])}</span><h2>${option.name}</h2><p>${option.effect}</p><span class="branch-confirm">就这样安排 ${icon('arrow')}</span></button>`).join('')}</div><p class="journey-note">安排会影响后续战斗与结尾；不会消耗战斗行动点。决定后，同伴会说明如何执行。</p>`);
}

function recruitmentView(run){
 const options=recruitOptions(run),first=run.recruits.length<2,formal=formalLearning(run);
 const contexts=['艾佩莉雅和雷克已到维修道后门。一人先来帮忙，另一人暂时照看搬运队。','中继站接通了，留在后门的同伴可以赶来。三人一起去打开内门。','通风站就在前面。哈特蒙斯能稳住受影响的同伴，游木医生能照顾伤员；先让谁赶上来？','过滤站已恢复，留下接应的同伴也赶到了。下一段要穿过危险的栈桥。','桥已接通，设备人员到了。潜行擅长处理失控机器，补丁正在核对总控的命令；先请谁来？','避难室的位置已确认。另一位设备人员也到齐了，接下来要穿过书库，解除总控的封锁。'];
 return shell(run,'recruitment-screen',`<div class="journey-intro"><span class="tiny-label">WHO GOES NEXT</span><h1>${options.length===1?'同伴赶到了':'这段路，谁先来帮忙？'}</h1><p>${contexts[run.recruits.length]||'附近的同伴已经准备好接替。'}</p><p>${first?'这次招募会增加一个出战位置。':'队伍最多三人，新的同伴可以在整备时换入。'}${formal?'新同伴至少掌握四项基础技能；最后一招可在途中实战或间章操练中学会。':'入门时先用少量技能；进入正式远征前，同伴会补齐至少四招。'}</p></div><div class="recruitment-grid">${options.map(h=>`<button class="recruitment-card" data-companion="${h.id}" style="--hero:${h.color}">${portrait(h.id)}<div><h2>${h.name}</h2><strong>${h.role} · ${h.resourceName}</strong><p>${LEARNING_TIPS[h.id]}</p><small>加入时掌握：${LEARNING_ORDER[h.id].slice(0,Math.max(formal?4:2,2+trainingCount(run,h.id))).map(id=>SKILLS[h.id].find(s=>s.id===id)?.name).join('、')}</small><b>让${h.short}加入 ${icon('arrow')}</b></div></button>`).join('')}</div>`);
}

export function explorationView(run,{exploration}={}){
 const view=interludeFor(run);if(!view)return '';
 const targets=[...view.objects,view.exit],position=exploration?.position||view.position;
 const nearest=targets.filter(o=>!view.done.includes(o.id)).map(o=>({...o,distance:Math.hypot(position[0]-o.position[0],position[1]-o.position[1])})).filter(o=>o.distance<=o.radius+.08).sort((a,b)=>a.distance-b.distance)[0];
 const nearbyId=exploration?.nearExit?'exit':exploration?.nearbyId||nearest?.id,nearby=targets.find(o=>o.id===nearbyId);
 const line=view.dialogue[view.line],speaker=line?(STORY_SPEAKERS[line.speaker]||hero(line.speaker)):null;
 return `<section class="exploration-screen" data-region="${view.id}" aria-label="可行走的战间探索">${header(run,view.title)}<aside class="exploration-objectives"><span class="tiny-label">路还要继续</span><h1>${view.title}</h1><p>${view.done.includes('device')?'这里已经处理好了。可以和同伴聊聊、顺手操练，也可以走到出口继续。':view.objective}</p><div class="exploration-targets">${targets.map(o=>`<button data-explore-target="${o.id}" class="${view.done.includes(o.id)?'done':''}" ${view.talking?'disabled':''}>${icon(view.done.includes(o.id)?'check':o.id==='exit'?'arrow':o.required?'target':'spark')}<span>${esc(o.name)}<small>${view.done.includes(o.id)?'已完成':o.id==='exit'?view.exit.open?'出口已开放':'等待开路':o.required?'需要完成':'可选'}</small></span></button>`).join('')}</div></aside><footer class="exploration-controls"><span>WASD / 方向键移动 · 靠近后按 E 互动 · 拖动旋转视角</span><button data-action="explore-interact" ${!nearby||view.talking?'disabled':''}>${icon('target')}<span id="explore-interact-label">${nearby?'E · '+esc(nearby.name):'走近同伴或装置'}</span></button><small>${exploration?.moving?'正在走近…':'点击目标也可以走过去'}</small></footer>${line?`<article class="exploration-dialogue" role="dialog" aria-label="与${speaker?.name||'同伴'}交谈"><header><strong style="color:${speaker?.color||'#d4c79c'}">${speaker?.name||'旁白'}</strong><small>${view.line+1} / ${view.dialogue.length}</small></header><p>${esc(line.text)}</p><div class="exploration-voice"><button data-action="voice-replay">${icon('volume')}重听本句</button><button data-action="voice-toggle" aria-pressed="true">配音 开</button><span class="voice-status" role="status">中文合成配音</span></div><div class="exploration-dialogue-actions"><button data-action="explore-skip">结束交谈</button><button data-action="explore-next">${view.line===view.dialogue.length-1?'说完了，继续走':'继续'}${icon('arrow')}</button></div></article>`:''}</section>`;
}

export function campaignView(run,options){
 if(run.phase==='explore')return explorationView(run,options);
 if(run.phase==='recruit')return recruitmentView(run);
 if(run.phase==='dialogue')return dialogueView(run);
 if(run.phase==='reward')return rewardView(run);
 if(run.phase==='camp')return campView(run,options);
 if(run.phase==='complete')return completionView(run);
 if(run.phase==='route')return routeView(run);
 if(run.phase==='event')return eventView(run);
 return '';
}
