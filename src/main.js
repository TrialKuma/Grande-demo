import './style.css';
import './interface.css';
import './details.css';
import './campaign.css';
import './update-3.2.css';
import './gm-tools.css';
import './update-3.7.css';
import './art-review.css';
import './update-3.9.css';
import './interludes.css';
import {createSkillDragController} from './skill-drag.js';
import {ART_WORLDS,artReviewView} from './art-review.js';
import {gmToolsView,progressResetView,resetGameProgress,challengePartyView,normalizeChallengeParty,swapChallengeParty} from './gm-tools.js';
import {DialogueVoice} from './voice.js';
import {voiceCastView} from './voice-cast.js';
import {heroJournalView} from './hero-journal.js';
import {normalizeProfile,rememberCompanions,rememberBossVictories,isDialogueAdvanceGesture,unlockAllHeroes,disableAllHeroes,unlockAllBosses,disableAllBosses,canChallengeBoss,normalizeChallengeBoss} from './player-profile.js';
import voiceManifest from '../public/voices/manifest.json';
import {campaignEntry,campaignView} from './campaign-ui.js';
import {STORY_SPEAKERS} from './story.js';
import {createRun,normalizeRun,battleForRun,advanceDialogue,completeEncounter,claimReward,replacePartyMember,equipSkill,startNextChapter,regroup,currentChapter,runDialogue,chooseRoute,chooseEvent,storyHistory,unlockRunHeroes,disableRunHeroes,chooseCompanion,startPractice,interludeFor,interactInterlude,advanceInterlude,finishInterlude,updateInterludePosition} from './campaign.js';
import './boss-codex.css';
import {bossCodexView} from './boss-codex.js';
import {tooltipView} from './status-details.js';
import {createTooltipController} from './tooltips.js';
import {titleView as renderTitle,battleView as renderBattle,helpView,bossOf} from './interface.js';
import {BattleScene} from './scene.js';
import {GameAudio} from './audio.js';
import {HEROES,SKILLS,BOSSES,DIFFICULTIES,activeSkills,createBattle,useSkill,usePotion,endRound,enemyTargets,selectEnemyTarget} from './combat.js';
import {icon} from './icons.js';
import {normalizeSave} from './save.js';
import {createFeedbackState,applyFeedbackImpact} from './battle-feedback.js';

const app=document.querySelector('#app');
window.addEventListener('error',event=>console.error('游戏运行异常',event.message,event.error?.stack||''));
const RUN_SAVE='grande-expedition-v1';
const PROFILE_SAVE='grande-roster-v1';
const SAVE='grande-crystal-save-v1',PREFS='grande-crystal-prefs-v1',RECORDS='grande-crystal-records-v1';
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));}catch{}}
function remove(key){try{localStorage.removeItem(key);}catch{}}
const prefs={difficulty:'standard',bossId:'golem',speed:1,music:true,muted:false,volume:.4,voice:true,storyAuto:false,...read(PREFS,{})};
if(!DIFFICULTIES[prefs.difficulty])prefs.difficulty='standard';
if(!BOSSES[prefs.bossId])prefs.bossId='golem';
prefs.speed=prefs.speed===2?2:1;
prefs.volume=Number.isFinite(prefs.volume)?Math.max(0,Math.min(1,prefs.volume)):.4;
let state=createBattle(prefs.difficulty,prefs.bossId),screen='title',modal=null,busy=false,scene=null,timer=null,startedAt=0,elapsed=0,lastSkill=null;
let tooltips=null,codexId='golem',run=normalizeRun(read(RUN_SAVE,null)),journeyActive=false,partySlot=0,skillSlot=0,feedbackState=null;
let saved=normalizeSave(read(SAVE,null));if(!saved)remove(SAVE);
let profile=rememberBossVictories(rememberCompanions(normalizeProfile(read(PROFILE_SAVE,null)),run),run,read(RECORDS,[])),journalHero='knibbs';
let challengeSlot=0,practiceActor=null;
let artBoss='golem',artFocus=false,artConcept=false,artStatus=null,artRequest=0;
if(profile.gmAllHeroes&&run)unlockRunHeroes(run);
else if(run)disableRunHeroes(run);
prefs.partyIds=normalizeChallengeParty(prefs.partyIds,profile.unlockedHeroes);
prefs.bossId=normalizeChallengeBoss(profile,prefs.bossId)||prefs.bossId;
write(PROFILE_SAVE,profile);
prefs.challengeMode=prefs.challengeMode==='solo'?'solo':'party';
if(!profile.unlockedHeroes.includes(prefs.soloHero))prefs.soloHero='knibbs';
const audio=new GameAudio();audio.setMuted(prefs.muted);audio.setMusic(prefs.music);audio.setVolume(prefs.volume);
let autoStoryTimer=null;
let exploration=null,explorationStatus='',lastExplorationSave=0;
const walkKeys=new Set();
const voice=new DialogueVoice(voiceManifest,{onState:updateVoiceState});
voice.configure({enabled:prefs.voice,muted:prefs.muted,volume:Math.min(1,prefs.volume*1.8)});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=(id,cls='')=>`<span class="portrait ${id} ${cls}" role="img" aria-label="${HEROES.find(h=>h.id===id)?.name||id}"></span>`;
const btn=(id,label,name,extra='')=>`<button class="icon-button" data-action="${id}" aria-label="${label}" title="${label}" ${extra}>${icon(name)}</button>`;
const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function updateScene(value){scene?.updateState({...value,enemyTargets:enemyTargets(value,{includeDefeated:true})});}
function selectTarget(id){if(screen!=='battle'||busy||modal||state.mode!=='playing')return;if(selectEnemyTarget(state,id)){lastSkill=null;updateScene(state);persist();render();audio.play('select');}}
function setup(){
  app.innerHTML=`<div id="scene" aria-label="可拖动旋转的三维战场"></div><div class="vignette"></div><div id="ui"></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div><div id="action-caption" aria-live="polite"></div><div id="transition" class="transition"></div>`;
  try{scene=new BattleScene(document.querySelector('#scene'));scene.setSpeed(prefs.speed);updateScene({...state,mode:'title'});scene.onTargetSelect=selectTarget;}catch(err){console.error(err);document.querySelector('#scene').innerHTML='<div class="render-error">3D 战场未能启动。请在开启硬件加速的 Chrome 或 Edge 中重新打开。</div>';}
  tooltips=createTooltipController(({kind,owner,detail})=>tooltipView(screen==='camp'&&run?battleForRun(run,owner):state,kind,owner,detail),()=>['battle','camp'].includes(screen)&&!modal&&!busy);
  createSkillDragController({enabled:()=>screen==='camp'&&!busy&&!modal&&!!run,onStart:()=>tooltips?.hide(),onDrop:({owner,skill,slot})=>{const result=equipSkill(run,owner,slot,skill);if(result.ok){skillSlot=result.slot??slot;saveJourney();render();toast('技能位置已调整。');}else toast(result.error);}});
  render();
}
function toolbar(){return `<div class="toolbar">${btn('sound',prefs.muted?'开启声音':'静音',prefs.muted?'muted':'volume')}<button class="speed-button" data-action="speed" title="切换演出速度" ${busy?'disabled':''}>${prefs.speed}×</button>${btn('fullscreen','全屏','expand')}${btn('help','战斗手册 · H','help')}${screen!=='title'?btn('pause','暂停与设置 · Esc','pause',busy?'disabled':''):''}</div>`;}
function render(){
  tooltips?.hide();
  app.classList.toggle('in-battle',screen==='battle');
  app.classList.toggle('in-explore',screen==='explore');
  const root=document.querySelector('#ui');
  if(screen==='title')root.innerHTML=titleView();
  else if(screen==='battle')root.innerHTML=battleView();
  else if(screen==='model-review')root.innerHTML=modelReviewView();
  else if(screen==='art-review')root.innerHTML=artReviewView({bossId:artBoss,focus:artFocus,concept:artConcept,status:artStatus});
  else root.innerHTML=campaignView(run,{partySlot,skillSlot,exploration});
  renderModal();syncDialogue();if(!busy)syncScore();
}
function titleView(){const records=read(RECORDS,[]);return renderTitle(prefs,saved,toolbar(),Array.isArray(records)?records:[],campaignEntry(run),{unlockedHeroes:profile.unlockedHeroes,unlockedBosses:profile.unlockedBosses});}
function challengeOptions(){return {mode:prefs.challengeMode,partyIds:prefs.challengeMode==='solo'?[profile.unlockedHeroes.includes(prefs.soloHero)?prefs.soloHero:'knibbs']:normalizeChallengeParty(prefs.partyIds,profile.unlockedHeroes)};}
function battleView(){return renderBattle(feedbackState||state,busy,toolbar(),formatTime(elapsed+(startedAt?(Date.now()-startedAt)/1000:0)),lastSkill);}
function syncScore(){audio.setScene?.({bossId:state.boss.id,screen,phase:screen==='battle'?(state.mode==='victory'?'victory':state.mode==='defeat'?'defeat':state.boss.finale?'finale':state.boss.core?'core':state.boss.stage):0});}

function updateVoiceState(status){
  audio.setDialogue(status==='playing'||status==='loading');
  const labels={idle:'中文合成配音',off:'配音已关闭',loading:'正在载入语音',playing:'正在说话',paused:'配音已暂停',ended:'本句播放完毕',blocked:'点击重听，启用声音',unavailable:'本句尚无配音',error:'音频未能播放 · 可点击重听'};
  const element=document.querySelector('.modal .voice-status')||document.querySelector('.voice-status');if(element){element.textContent=labels[status]||labels.idle;element.dataset.state=status;}
  document.querySelectorAll('.voice-cast-card').forEach(card=>{const button=card.querySelector('[data-voice-speaker]');card.classList.toggle('is-playing',status==='playing'&&button?.dataset.voiceSpeaker===voice?.line?.speaker);});
  clearTimeout(autoStoryTimer);
  if(status==='ended'&&prefs.storyAuto&&currentStoryLine()&&!modal&&!document.hidden){
    const position=storyPosition();
    autoStoryTimer=setTimeout(()=>{if(currentStoryLine()&&!modal&&prefs.storyAuto&&position===storyPosition())action(screen==='explore'?'explore-next':'story-next');},900);
  }
}
function storyPosition(){const view=screen==='explore'?interludeFor(run):null;return view?`${run.chapter}/explore/${view.talking}/${view.line}`:`${run?.chapter}/${run?.dialogue}/${run?.line}`;}
function currentStoryLine(){if(screen==='explore'){const view=interludeFor(run);return view?.talking?view.dialogue[view.line]:null;}return screen==='dialogue'&&run?runDialogue(run)[run.line]:null;}
function syncDialogue(){
  const line=currentStoryLine();
  if(!line){if(voice.line)voice.stop();return;}
  if(!modal)voice.sync(line);
  const toggle=document.querySelector('[data-action="voice-toggle"]');if(toggle){toggle.textContent=`配音 ${prefs.voice?'开':'关'}`;toggle.setAttribute('aria-pressed',String(prefs.voice));}
  const auto=document.querySelector('[data-action="story-auto"]');if(auto){auto.textContent=`自动 ${prefs.storyAuto?'开':'停'}`;auto.setAttribute('aria-pressed',String(prefs.storyAuto));}
  updateVoiceState(voice.status);
}
function voiceAction(name){
  if(name==='voice-cast'){openModal('voice-cast');return true;}
  if(name==='voice-stop'){voice.stop();return true;}
  if(name==='voice-toggle'){prefs.voice=!prefs.voice;voice.configure({enabled:prefs.voice});preferences();syncDialogue();return true;}
  if(name==='voice-replay'){prefs.voice=true;prefs.muted=false;audio.setMuted(false);audio.unlock();voice.configure({enabled:true,muted:false});voice.play(currentStoryLine());preferences();syncDialogue();return true;}
  if(name==='story-auto'){prefs.storyAuto=!prefs.storyAuto;if(prefs.storyAuto){prefs.voice=true;prefs.muted=false;audio.setMuted(false);audio.unlock();voice.configure({enabled:true,muted:false});if(['ended','off','blocked'].includes(voice.status))voice.play(currentStoryLine());}preferences();syncDialogue();return true;}
  if(name==='story-history'){openModal('story-history');return true;}
  return false;
}
function storyHistoryView(){
  const entries=[];
  for(const section of storyHistory(run)){
    entries.push(`<h3>${esc(section.title)}</h3>`);
    for(const line of section.lines)entries.push(`<article><strong>${esc(STORY_SPEAKERS[line.speaker]?.name||HEROES.find(h=>h.id===line.speaker)?.name||'旁白')}</strong><p>${esc(line.text)}</p><button data-voice-speaker="${esc(line.speaker)}" data-voice-text="${esc(line.text)}" aria-label="重听这句">${icon('volume')}</button></article>`);
  }
  return `<div class="modal-eyebrow">已经走过的故事</div><h2>对白记录</h2><div class="story-history-list">${entries.join('')}</div>`;
}
function modelReviewView(){return `<section class="model-review-screen"><header class="journey-header"><div class="brand">${icon('crystal')}<span>格朗德<small>MODEL STUDY</small></span></div><div><strong>潜行 · 银焱战甲</strong><span>Blender 模型样件</span></div><div class="journey-actions"><button data-action="camera">${icon('camera')}重置视角</button><button data-action="model-exit">返回标题</button></div></header><aside class="model-review-note"><span class="tiny-label">角色模型展示</span><h1>看看细节。</h1><p>拖动旋转 360°，滚轮拉近。<br>可以从正面、侧面和背面检查轮廓。</p><small id="model-load-status">正在载入本地模型…</small></aside><footer><span>参照潜行立绘，通过 Blender 脚本建立网格、材质与关节层级。</span><span>造型样件 · 非单图自动重建</span></footer></section>`;}
async function enterModelReview(){
  if(busy||screen!=='title')return;voice.stop();screen='model-review';modal=null;app.classList.add('in-model-review');render();
  try{const loaded=await scene?.enterModelReview();const label=document.querySelector('#model-load-status');if(label)label.textContent=loaded?.status!=='ready'?'模型文件未载入，当前显示备用造型。':'可编辑网格 · 分层材质 · 关节动画';}catch(error){console.error(error);toast('模型文件未能载入。');}
}
function exitModelReview(){scene?.exitModelReview();screen='title';modal=null;app.classList.remove('in-model-review');render();}

async function showArtBoss(id){
  if(screen!=='art-review'||!ART_WORLDS.some(world=>world.bosses.includes(id)))return;
  const request=++artRequest;artBoss=id;artStatus=null;artConcept=false;
  scene?.setBossPreviewFocus(false);
  updateScene({...createBattle('standard',id),mode:'title'});
  scene?.setPaused(false);scene?.setSpeed(1);render();scene?.resetCamera();
  if(artFocus)scene?.setBossPreviewFocus(true);
  await Promise.allSettled([scene?.worldPromise,scene?.bossModelPromise]);
  if(screen!=='art-review'||request!==artRequest)return;
  artStatus=scene?.getAssetStatus();render();if(artConcept)document.querySelector('[data-action="art-concept-close"]')?.focus();scene?.resize();if(artFocus)scene?.setBossPreviewFocus(true);else scene?.resetCamera();
}
function enterArtReview(){
  if(busy||screen!=='title')return;
  voice.stop();modal=null;screen='art-review';artFocus=false;artConcept=false;artStatus=null;
  app.classList.add('in-art-review');scene?.setArtPreview(true);showArtBoss(artBoss);
}
function exitArtReview(){
  ++artRequest;artConcept=false;scene?.setBossPreviewFocus(false);
  screen='title';modal=null;app.classList.remove('in-art-review');scene?.setArtPreview(false);
  scene?.setSpeed(prefs.speed);updateScene({...state,mode:'title'});scene?.resetCamera();render();
}
function artReviewAction(name){
  if(name==='art-review'){enterArtReview();return true;}
  if(screen!=='art-review')return false;
  if(name==='art-exit'){exitArtReview();return true;}
  if(name==='art-wide'||name==='art-focus'){
    artFocus=name==='art-focus';scene?.setBossPreviewFocus(artFocus);render();return true;
  }
  if(name==='art-camera'){
    scene?.setBossPreviewFocus(false);scene?.resetCamera();if(artFocus)scene?.setBossPreviewFocus(true);return true;
  }
  if(name==='art-concept'||name==='art-concept-close'){
    artConcept=name==='art-concept';render();
    document.querySelector(artConcept?'[data-action="art-concept-close"]':'[data-action="art-concept"]')?.focus();return true;
  }
  return false;
}

function renderModal(){
  tooltips?.hide();
  const root=document.querySelector('#modal-root');document.querySelector('#ui').inert=!!modal;
  if(screen==='explore')scene?.setExplorationPaused(!!modal||!!interludeFor(run)?.talking);if(!modal){root.innerHTML='';return;}
  let body='',cls='';
  if(modal==='voice-cast'){body=voiceCastView(voiceManifest);cls='voice-cast-modal';}
  else if(modal==='gm'){body=gmToolsView(profile);}
  else if(modal==='progress-reset'){body=progressResetView();}
  else if(modal==='challenge-party'){body=challengePartyView(prefs.partyIds,profile.unlockedHeroes,challengeSlot);cls='challenge-party-modal';}
  else if(modal==='hero-journal'){body=heroJournalView({unlockedHeroes:profile.unlockedHeroes,selectedHero:journalHero,upgrades:run?.upgrades||[],loadouts:run?.loadouts||{}});cls='hero-journal-modal';}
  else if(modal==='story-history'){body=storyHistoryView();cls='story-history-modal';}
  else if(modal==='boss-codex'){body=bossCodexView(state,codexId);cls='codex-modal';}
  else if(modal==='help')body=helpView(screen==='battle'?state:screen==='title'?createBattle(prefs.difficulty,prefs.bossId,challengeOptions()):undefined);
  else if(modal==='pause')body=`<div class="modal-eyebrow">TAKE A BREATH</div><h2>稍作休整</h2><p class="modal-lead">你的远征进度已自动保存在这台设备。</p><div class="settings-list"><button class="settings-voice-cast" data-action="hero-journal">${icon('book')}角色图鉴与招募</button><button class="settings-voice-cast" data-action="voice-cast">${icon('volume')}角色声音试听</button><label>背景音乐 <input type="checkbox" data-setting="music" ${prefs.music?'checked':''}></label><label>中文对白配音 <input type="checkbox" data-setting="voice" ${prefs.voice?'checked':''}></label><label>静音 <input type="checkbox" data-setting="muted" ${prefs.muted?'checked':''}></label><label>主音量 <input type="range" min="0" max="100" value="${prefs.volume*100}" data-setting="volume" aria-label="主音量"></label><label>演出速度 <button data-action="speed">${prefs.speed}×</button></label></div><button class="primary" data-action="close-modal">继续远征 ${icon('play')}</button><div class="modal-secondary">${screen==='battle'?`<button data-action="restart">${icon('repeat')}重新挑战</button>`:''}<button data-action="back-title">返回标题</button></div>`;
  else if(modal==='log')body=`<div class="modal-eyebrow">BATTLE CHRONICLE</div><h2>战斗记录</h2><div class="full-log">${state.log.map(l=>`<p class="log-${l.tone}">${esc(l.text)}</p>`).join('')}</div>`;
  else if(modal==='credits')body=`<div class="modal-eyebrow">BEHIND THE ECHO</div><h2>格朗德 · 魔晶回响</h2><p class="modal-lead">基于格朗德既有角色设定的分支远征。十名 BOSS、两处选路，以及由沿途决定产生的不同结局。</p><div class="credits-copy"><p><b>沿用设定</b><br>尼布斯拉姆的气息、直感发射、单发确认、扩散弹；艾佩莉雅的连击与四种武器；雷克的深渊领域和正负平衡；魔晶巨人的元素解体、地裂、迷雾、共鸣与双系核心。</p><p><b>本次改编</b><br>「停机之前」救援剧情、哈特蒙斯的支援技能，以及折镜刃卫、孢冠司祭、雷脊守卫、缄页织者、四名分支守卫与归零之核为 demo 适配或原创内容。哈特蒙斯、潜行、游木／游墓和补丁 Z 均采用已有角色卡；游木使用气息，其余三人使用魔力。三名魔力角色先将魔力转化为念线、充能或记录，再消耗二级资源换回魔力并触发不同效果。潜行的钉刺护甲、聚焦光束取自既有技能稿，按本版魔力循环重新适配。三场入门实战从一人两项技能开始；同伴沿路线分批加入，每次从附近的一至两人中选择。进入正式远征后，新旧队员至少掌握四招，第五招可通过途中战或操练学习。战后随机三选一成长，最多携带五项技能，整备时可拖动交换；防守由角色自身技能承担。途中编队战可选择攻击目标，敌人之间会护卫、供能或召唤；战后可实际走近同伴与装置交谈，再从出口推进。一、二、三人小队每轮分别获得基础 3、4、6 AP，剩余点数最多保留 2 点到下一轮。</p><p><b>美术与声音</b><br>四张生成图片包含七人头像、船长形态与标题背景。潜行的银焱战甲参照立绘，通过 Blender 脚本建立可编辑网格与分层材质，提供模型展示；其余角色使用程序化模型；十名正式 BOSS 与五处场景采用 Blender 制作的模型，BOSS 使用导出的待机、攻击与受击关键帧动画，另有三种入门小怪和途中编队。五张生成环景补充水渠、山谷、建筑与天空，保留三维战场的自由旋转；远景不是可行走区域。${voiceManifest.clips.length} 句对白按角色选择七种中文神经基础声线，在线生成后保存为本地音频；标题页可逐角色试听；音乐与技能音效由程序合成。</p><p>无需账号。游戏进度仅保存在本机。</p></div><button class="primary" data-action="close-modal">返回 ${icon('arrow')}</button>`;
  else if(modal==='victory'||modal==='defeat'){
    const win=modal==='victory',survivors=state.heroes.filter(h=>h.hp>0).length;
    const grade=state.round<=8&&survivors===state.heroes.length&&state.boss.reforms===0?'S':survivors===state.heroes.length&&state.boss.reforms===0?'A':'B';cls='result-modal';
    body=`<div class="result-emblem ${win?'':'lost'}">${icon(win?'crystal':'flag')}</div><div class="modal-eyebrow">${win?'EXPEDITION COMPLETE':'THE ECHO REMAINS'}</div><h2>${win?'已击败 · '+bossOf(state).name:'远征尚未结束'}</h2><p class="modal-lead">${win?({scout:'巡检傀儡停下了。入口的警报安静下来。',bulwark:'松动石卫退回墙边，通道可以安全通过了。',conduit:'导流器断电了，接下来的路可以一起走。',golem:'核心的光逐渐熄灭。遗迹重新归于寂静。',duelist:'最后一面镜片碎裂，刃卫放下了长刀。',cantor:'孢冠失去光芒，沉积的孢雾缓缓散去。',warden:'避雷针熄灭，栈桥上的风暴终于退去。',weaver:'封页机构停止，控制室的通路已经打开。',final:'归零程序已停止，避难室重新开始通风。',tide:'压力阀停止转动。维修通道的积水开始退去。',furnace:'炉膛渐渐暗下来，备用线路恢复供电。',orrery:'星轨归位。总控留下的观测记录终于能够读出。',arbiter:'执行官放下封令。被拦住的救援器械开始通行。'}[state.boss.id]||'敌人的队形已经瓦解，可以继续前进了。'):'带上这一次的经验，再试一次。'}</p>${win?`<div class="result-rank">${grade}<span>远征评级</span></div>`:''}<div class="result-stats"><div><strong>${state.round}</strong><span>战斗回合</span></div><div><strong>${state.stats.damage.toLocaleString()}</strong><span>累计伤害</span></div><div><strong>${state.stats.breaks}</strong><span>架势击破</span></div><div><strong>${state.stats.interrupts}</strong><span>行动打断</span></div></div><div class="result-party">${state.heroes.map(h=>`<div class="${h.hp<=0?'down':''}">${portrait(h.id)}<span>${h.short}</span><small>${h.hp<=0?'失去意识':h.hp+' / '+h.maxHp}</small></div>`).join('')}</div>${!win?'<p class="defeat-tip">根据敌人的预告，给角色的减伤、护盾、弱化或恢复技能留出 AP。初探难度同样保留全部机制。</p>':''}<button class="primary" data-action="${journeyActive&&win?'journey-resume':'restart'}">${journeyActive&&win?'继续旅程':'再次挑战'} ${icon(journeyActive&&win?'arrow':'repeat')}</button>${journeyActive&&!win?'<button class="regroup-button" data-action="journey-resume">返回整备 · 调整队伍与技能</button>':''}<div class="modal-secondary"><button data-action="back-title">返回标题</button><button data-action="log">查看战斗记录</button></div>`;
  }
  root.innerHTML=`<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="${modal}" class="modal ${cls}">${!['victory','defeat'].includes(modal)?`<button class="modal-close icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>`:''}${body}${modal==='pause'?'<button class="gm-pause-entry" data-action="gm">GM · 试玩开关</button>':''}</section></div>`;
}

function persist(){if(journeyActive&&run){if(run.phase==='battle'&&state.mode==='playing')run.battle={...state,elapsed:elapsed+(startedAt?(Date.now()-startedAt)/1000:0)};write(RUN_SAVE,run);return;}if(state.mode==='playing'){write(SAVE,{...state,elapsed:elapsed+(startedAt?(Date.now()-startedAt)/1000:0)});saved=normalizeSave(read(SAVE,null));}else{remove(SAVE);saved=null;}}
function preferences(){write(PREFS,prefs);}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),2800);}
function openModal(type){if(busy)return;stopWalking();voice.pause();clearTimeout(autoStoryTimer);modal=type;scene?.setPaused(true);if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}renderModal();requestAnimationFrame(()=>document.querySelector('.modal button')?.focus());}
function closeModal(){if(modal==='model-review'){exitModelReview();return;}modal=null;scene?.setPaused(false);if(screen==='battle'&&state.mode==='playing'&&!startedAt)startedAt=Date.now();renderModal();syncDialogue();if(currentStoryLine())voice.resume();}
async function begin(resume=false){
  if(busy)return;
  if(!(resume&&saved)){const bossId=normalizeChallengeBoss(profile,prefs.bossId);if(!bossId){toast('先在远征中击败 BOSS，或在 GM 中开放 BOSS 自由挑战。');return;}prefs.bossId=bossId;}
  journeyActive=false;busy=true;await audio.unlock();closeModal();
  state=resume&&saved?structuredClone(saved):createBattle(prefs.difficulty,prefs.bossId,challengeOptions());screen='battle';busy=false;elapsed=resume?(state.elapsed||0):0;startedAt=Date.now();lastSkill=null;
  prefs.bossId=state.boss.id;prefs.difficulty=state.difficulty;preferences();render();window.scrollTo(0,0);
  scene?.setPaused(false);scene?.resetCamera();updateScene(state);syncScore();render();persist();
  const t=document.querySelector('#transition');t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),850);
}
function perform(resolve){const before=structuredClone(state);return execute(resolve(),before);}
async function execute(result,before){
  if(!result.ok){toast(result.error);audio.play('error');return;}
  feedbackState=before?createFeedbackState(before,state):null;busy=true;updateScene(feedbackState||state);render();
  try{
    for(const rawEvent of result.events){
      const event={...rawEvent,bossId:rawEvent.bossId||state.boss.id};
      audio.play(event,{speed:prefs.speed});if(['phase','core','victory','defeat'].includes(event.type))syncScore();
      const caption=document.querySelector('#action-caption');caption.innerHTML=`<small>${event.actor==='boss'?bossOf(state).name:enemyTargets(state,{includeDefeated:true}).find(enemy=>enemy.id===event.actor)?.name||HEROES.find(h=>h.id===event.actor)?.name||''}</small><strong>${esc(event.label||'')}</strong>`;caption.classList.add('show');
      await scene?.play(event,{onImpact:index=>{if(feedbackState){applyFeedbackImpact(feedbackState,event,index);updateScene(feedbackState);document.querySelector('#ui').innerHTML=battleView();}}});caption.classList.remove('show');
    }
  }catch(error){console.error(error);toast('演出被跳过，战斗继续。');}
  feedbackState=null;busy=false;updateScene(state);
  if(journeyActive&&run&&run.phase==='battle'){if(state.mode==='victory'){completeEncounter(run,state);rememberUnlocks();}else if(state.mode==='defeat')regroup(run);}
  persist();render();
  if(state.mode!=='playing'){
    if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}
    if(state.mode==='victory'){const value=read(RECORDS,[]),records=Array.isArray(value)?value:[],record={bossId:state.boss.id,round:state.round,difficulty:state.difficulty,challengeMode:state.challengeMode||'party',partyIds:state.heroes.map(h=>h.id),at:Date.now(),damage:state.stats.damage,result:'victory'};if(!BOSSES[state.boss.id].isTutorial&&!BOSSES[state.boss.id].isSkirmish&&!BOSSES[state.boss.id].isMinion){records.push(record);write(RECORDS,records.slice(-50));profile=rememberBossVictories(profile,run,[record]);write(PROFILE_SAVE,profile);}audio.setPhase('victory');}
    openModal(state.mode);
  }
}
function action(name){
  if(explorationAction(name))return;
  if(artReviewAction(name))return;
  if(name==='gm'){if(!busy)openModal('gm');return;}
  if(name==='gm-unlock'){if(busy||modal!=='gm')return;profile=unlockAllHeroes(profile);write(PROFILE_SAVE,profile);if(run){unlockRunHeroes(run);saveJourney();}render();toast('七名角色已全部解锁。');return;}
  if(name==='gm-boss-unlock'||name==='gm-boss-disable'){
    if(busy||modal!=='gm')return;
    profile=name==='gm-boss-unlock'?unlockAllBosses(profile):disableAllBosses(profile);write(PROFILE_SAVE,profile);
    prefs.bossId=normalizeChallengeBoss(profile,prefs.bossId)||prefs.bossId;preferences();render();
    toast(profile.gmAllBosses?'全部 BOSS 已开放自由挑战。':'已关闭 BOSS 全开，仅显示实际击败过的敌人。');return;
  }
  if(name==='gm-disable'){
    if(busy||modal!=='gm')return;
    if(screen==='battle')persist();
    profile=disableAllHeroes(profile,run);write(PROFILE_SAVE,profile);
    if(run){disableRunHeroes(run);saveJourney();}
    prefs.partyIds=normalizeChallengeParty(prefs.partyIds,profile.unlockedHeroes);
    if(!profile.unlockedHeroes.includes(prefs.soloHero))prefs.soloHero='knibbs';
    preferences();if(screen==='explore'){const view=interludeFor(run);scene?.enterExploration({...view,onPosition:receiveExplorationPosition});scene?.setExplorationPaused(true);}render();toast('已关闭全角色测试，保留正常招募进度。');return;
  }
  if(name==='progress-reset'){if(!busy&&modal==='gm')openModal('progress-reset');return;}
  if(name==='progress-reset-confirm'){
    if(busy||modal!=='progress-reset')return;
    const cleared=resetGameProgress({removeItem:remove},prefs);
    exitExploration();voice.stop();clearTimeout(autoStoryTimer);run=null;saved=null;journeyActive=false;
    profile=cleared.profile;Object.assign(prefs,cleared.prefs);write(PROFILE_SAVE,profile);preferences();
    journalHero='knibbs';challengeSlot=0;partySlot=0;skillSlot=0;feedbackState=null;lastSkill=null;startedAt=0;elapsed=0;
    screen='title';modal=null;state=createBattle(prefs.difficulty,prefs.bossId,challengeOptions());
    scene?.setPaused(false);updateScene({...state,mode:'title'});render();window.scrollTo(0,0);toast('进度已重置，声音设置已保留。');return;
  }
  if(name==='challenge-party'){if(!busy&&screen==='title'){challengeSlot=0;openModal('challenge-party');}return;}
  if(name==='hero-journal'){openModal('hero-journal');return;}
  if(name==='model-exit'){exitModelReview();return;}
  if(voiceAction(name))return;
  if(name==='model-review'){enterModelReview();return;}
  if(journeyAction(name))return;
  if(name==='boss-codex'){if(!busy){if(screen==='title')state=createBattle(prefs.difficulty,prefs.bossId,challengeOptions());codexId=screen==='title'?prefs.bossId:journeyActive&&screen!=='battle'?currentChapter(run).bossId:state.boss.id;openModal('boss-codex');}return;}
  if(name==='sound'){prefs.muted=!prefs.muted;audio.setMuted(prefs.muted);voice.configure({muted:prefs.muted});audio.unlock();preferences();render();return;}
  if(name==='speed'){if(busy)return;prefs.speed=prefs.speed===1?2:1;scene?.setSpeed(prefs.speed);preferences();render();return;}
  if(name==='fullscreen'){if(document.fullscreenElement)document.exitFullscreen?.();else document.documentElement.requestFullscreen?.().catch(()=>toast('当前窗口不支持全屏，可在浏览器中打开。'));return;}
  if(name==='help'){if(busy){toast('请等待当前行动完成。');return;}openModal('help');return;}
  if(name==='close-modal'){if(state.mode!=='playing'&&screen==='battle'&&modal==='log'){openModal(state.mode);return;}closeModal();return;}
  if(name==='log'){if(!busy)openModal('log');return;}
  if(name==='credits'){openModal('credits');return;}
  if(name==='pause'){if(!busy)openModal('pause');return;}
  if(name==='camera'){scene?.resetCamera();return;}
  if(busy)return;
  if(name==='start'){begin(false);return;}
  if(name==='restart'&&journeyActive&&run){if(practiceActor){if(run.phase==='battle')regroup(run);if(!profile.gmAllHeroes)disableRunHeroes(run);const result=startPractice(run,practiceActor);if(result.ok)launchJourneyBattle(false);else showJourney();return;}run.phase='camp';if(!profile.gmAllHeroes)disableRunHeroes(run);run.phase='battle';run.battle=null;launchJourneyBattle(false);return;}
  if(name==='restart'){
    if(!canChallengeBoss(profile,state.boss.id)){persist();prefs.bossId=normalizeChallengeBoss(profile,prefs.bossId)||prefs.bossId;preferences();screen='title';closeModal();startedAt=0;updateScene({...state,mode:'title'});render();toast(state.mode==='playing'?'这个 BOSS 尚未击败。可以继续原战斗，或在 GM 中重新开放。':'这个 BOSS 尚未击败，请在远征中挑战，或在 GM 中重新开放。');return;}
    prefs.difficulty=state.difficulty;prefs.bossId=state.boss.id;prefs.challengeMode=state.challengeMode||'party';if(state.heroes.length===1)prefs.soloHero=state.heroes[0].id;else prefs.partyIds=state.heroes.map(h=>h.id);preferences();begin(false);return;
  }
  if(name==='continue'){begin(true);return;}
  if(name==='back-title'&&journeyActive){journeyAction('journey-title');return;}
  if(name==='back-title'){persist();screen='title';closeModal();startedAt=0;updateScene({...state,mode:'title'});render();window.scrollTo(0,0);return;}
  if(screen!=='battle'||modal||state.mode!=='playing')return;
  if(name==='end')perform(()=>endRound(state));
  if(name==='potion')perform(()=>usePotion(state,state.selected));
}


function rememberUnlocks(){profile=rememberBossVictories(rememberCompanions(profile,run),run);write(PROFILE_SAVE,profile);}
function saveJourney(){if(run){rememberUnlocks();write(RUN_SAVE,run);}}
async function launchJourneyBattle(resume=false){
  if(busy)return;
  exitExploration();busy=true;await audio.unlock();modal=null;journeyActive=true;
  practiceActor=run.drill?.heroId||null;
  state=resume&&run.battle?structuredClone(run.battle):battleForRun(run);
  run.phase='battle';screen='battle';busy=false;elapsed=resume?(state.elapsed||0):0;startedAt=Date.now();lastSkill=null;
  render();window.scrollTo(0,0);scene?.setPaused(false);scene?.resetCamera();updateScene(state);syncScore();persist();
}
function showJourney(){
  journeyActive=true;modal=null;busy=false;tooltips?.hide();
  if(run.phase==='battle'){launchJourneyBattle(true);return;}
  const wasExploring=screen==='explore';
  if(run.phase!=='explore')exitExploration();
  if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}
  screen=run.phase;
  if(screen==='explore'){
    if(!wasExploring){state=battleForRun(run);updateScene({...state,mode:'title'});}
    const view=interludeFor(run);scene?.setPaused(false);scene?.enterExploration({...view,onPosition:receiveExplorationPosition});
    exploration=scene?.getExplorationState()||exploration;scene?.setExplorationPaused(!!view?.talking);
    saveJourney();render();window.scrollTo(0,0);return;
  }
  if(!(run.phase==='dialogue'&&run.dialogue==='after'))state=battleForRun(run);
  scene?.setPaused(false);updateScene({...state,mode:'title'});syncScore();saveJourney();render();window.scrollTo(0,0);
}
function journeyAction(name){
  if(!['journey-start','journey-continue','journey-resume','journey-title','story-next','story-prev','story-skip','camp-depart'].includes(name))return false;
  if(busy)return true;
  tooltips?.hide();
  if(name==='journey-start'){run=createRun(prefs.difficulty,{gmAllHeroes:profile.gmAllHeroes});partySlot=0;skillSlot=0;showJourney();audio.unlock();return true;}
  if(name==='journey-continue'||name==='journey-resume'){if(run)showJourney();return true;}
  if(name==='journey-title'){
    persist();if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}
    exitExploration();journeyActive=false;screen='title';modal=null;scene?.setPaused(false);updateScene({...state,mode:'title'});render();window.scrollTo(0,0);return true;
  }
  if(!journeyActive||!run)return true;
  if(name==='story-prev'){run.line=Math.max(0,run.line-1);saveJourney();showJourney();return true;}
  if(name==='story-next'||name==='story-skip'){advanceDialogue(run,name==='story-skip');saveJourney();showJourney();return true;}
  if(name==='camp-depart'){startNextChapter(run);saveJourney();showJourney();return true;}
  return true;
}

function receiveExplorationPosition(snapshot){
  if(screen!=='explore'||!run||run.phase!=='explore')return;
  exploration=snapshot;updateInterludePosition(run,snapshot.position);
  const status=`${snapshot.nearbyId||''}/${snapshot.nearExit?'exit':''}/${!!snapshot.moving}`;
  if(status!==explorationStatus){explorationStatus=status;render();}
  if(Date.now()-lastExplorationSave>750){lastExplorationSave=Date.now();write(RUN_SAVE,run);}
}
function syncWalking(){scene?.setMoveInput({x:(walkKeys.has('d')||walkKeys.has('arrowright')?1:0)-(walkKeys.has('a')||walkKeys.has('arrowleft')?1:0),z:(walkKeys.has('s')||walkKeys.has('arrowdown')?1:0)-(walkKeys.has('w')||walkKeys.has('arrowup')?1:0)});}
function stopWalking(){walkKeys.clear();scene?.setMoveInput({x:0,z:0});}
function exitExploration(){stopWalking();scene?.exitExploration();exploration=null;explorationStatus='';}
function useExplorationTarget(id){
  if(screen!=='explore'||busy||modal||!run)return;
  const view=interludeFor(run);if(!view||view.talking)return;
  const snapshot=scene?.getExplorationState();if(snapshot)receiveExplorationPosition(snapshot);
  const target=id==='exit'?view.exit:view.objects.find(object=>object.id===id);if(!target)return;
  if(id==='exit'&&!view.exit.open){toast('先处理这里的主要事情，再继续前进。');return;}
  const position=run.interlude.position,near=Math.hypot(position[0]-target.position[0],position[1]-target.position[1])<=target.radius+.08;
  if(!near){scene?.moveToInteraction(id);toast('正在走近。到达后按 E 互动，也可再次点击目标。');return;}
  stopWalking();
  const result=id==='exit'?finishInterlude(run):interactInterlude(run,id);
  if(result.ok){saveJourney();showJourney();}else toast(result.error||'现在还不能前进。');
}
function explorationAction(name){
  if(!['explore-next','explore-skip','explore-interact'].includes(name))return false;
  if(screen!=='explore'||busy||modal||!run)return true;
  if(name==='explore-interact'){
    const snapshot=scene?.getExplorationState();if(snapshot)receiveExplorationPosition(snapshot);
    const id=snapshot?.nearExit?'exit':snapshot?.nearbyId;
    if(id)useExplorationTarget(id);else toast('先走近同伴或装置。');return true;
  }
  stopWalking();const result=advanceInterlude(run,name==='explore-skip');
  if(result.ok){saveJourney();showJourney();}return true;
}
document.addEventListener('keyup',event=>{const key=event.key.toLowerCase();if(walkKeys.delete(key))syncWalking();});
window.addEventListener('blur',()=>{stopWalking();if(screen==='explore'){scene?.setExplorationPaused(true);saveJourney();}});
window.addEventListener('focus',()=>{if(screen==='explore')scene?.setExplorationPaused(!!modal||!!currentStoryLine());});

let pointerStart=null,pointerMovement=0;
document.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};pointerMovement=0;});
document.addEventListener('pointermove',e=>{if(pointerStart)pointerMovement=Math.max(pointerMovement,Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y));});
document.addEventListener('pointercancel',()=>{pointerStart=null;pointerMovement=100;});
document.addEventListener('click',e=>{
  const button=e.target.closest('button,[data-action]');
  if(!button){
    if(screen==='explore'&&currentStoryLine()&&!modal&&pointerMovement<8&&!window.getSelection()?.toString()&&!e.target.closest('a,input,select,textarea,[role=button]')){e.preventDefault();audio.unlock();action('explore-next');pointerStart=null;return;}
    const interactive=!!e.target.closest('a,input,select,textarea,label,[role="button"],[role="dialog"],[data-tooltip]');
    if(isDialogueAdvanceGesture({screen,modal,busy,interactive,selectedText:window.getSelection()?.toString()||'',movement:pointerMovement,button:e.button,detail:e.detail})){e.preventDefault();audio.unlock();action('story-next');}
    pointerStart=null;return;
  }
  if(button.disabled)return;
  e.preventDefault();audio.unlock();audio.play('click');
  if(screen==='art-review'){
    if(button.dataset.artWorld){const world=ART_WORLDS.find(item=>item.id===button.dataset.artWorld);if(world)showArtBoss(world.bosses[0]);return;}
    if(button.dataset.artBoss){showArtBoss(button.dataset.artBoss);return;}
    if(button.dataset.artAnimation){if(!scene?.previewBossAnimation(button.dataset.artAnimation))toast('动作尚未载入，请稍等。');return;}
  }
  if(button.dataset.voiceSpeaker){prefs.voice=true;prefs.muted=false;audio.setMuted(false);audio.unlock();voice.configure({enabled:true,muted:false});voice.play({speaker:button.dataset.voiceSpeaker,text:button.dataset.voiceText});preferences();return;}
  if(button.dataset.codexBoss&&modal==='boss-codex'){codexId=button.dataset.codexBoss;renderModal();return;}
  if(button.dataset.journalHero&&modal==='hero-journal'){journalHero=button.dataset.journalHero;renderModal();return;}
  if(modal==='challenge-party'&&screen==='title'&&!busy){
    if(button.dataset.challengeSlot!==undefined){challengeSlot=Number(button.dataset.challengeSlot);renderModal();return;}
    if(button.dataset.challengeHero){prefs.partyIds=swapChallengeParty(prefs.partyIds,challengeSlot,button.dataset.challengeHero,profile.unlockedHeroes);preferences();render();return;}
  }
  if(button.dataset.mode&&screen==='title'&&!modal){prefs.challengeMode=button.dataset.mode==='solo'?'solo':'party';preferences();render();return;}
  if(button.dataset.soloHero&&screen==='title'&&!modal&&profile.unlockedHeroes.includes(button.dataset.soloHero)){prefs.soloHero=button.dataset.soloHero;preferences();render();return;}
  if(button.dataset.action==='route-inspect'&&!busy){if(BOSSES[button.dataset.route]){codexId=button.dataset.route;openModal('boss-codex');}return;}
  if(!busy&&!modal&&journeyActive&&run&&button.dataset.action==='choose-route'){const result=chooseRoute(run,button.dataset.route);if(result.ok){partySlot=0;showJourney();}else toast(result.error);return;}
  if(!busy&&!modal&&journeyActive&&run&&button.dataset.action==='choose-event'){const result=chooseEvent(run,button.dataset.event);if(result.ok)showJourney();else toast(result.error);return;}
  if(button.dataset.exploreTarget&&screen==='explore'){useExplorationTarget(button.dataset.exploreTarget);return;}
  if(button.dataset.action){action(button.dataset.action);return;}
  if(!busy&&!modal&&journeyActive&&run){
    if(button.dataset.companion&&screen==='recruit'){const result=chooseCompanion(run,button.dataset.companion);if(result.ok){partySlot=0;skillSlot=0;showJourney();}else toast(result.error);return;}
    if(button.dataset.practice&&screen==='camp'){const result=startPractice(run,button.dataset.practice);if(result.ok){saveJourney();showJourney();}else toast(result.error);return;}
    if(button.dataset.reward){const result=claimReward(run,button.dataset.reward);if(result.ok){partySlot=0;skillSlot=Math.min(4,(run.loadouts[run.focusHero]?.length||1)-1);showJourney();}else toast(result.error);return;}
    if(button.dataset.partySlot!==undefined){partySlot=Number(button.dataset.partySlot);run.focusHero=run.partyIds[partySlot];skillSlot=0;saveJourney();render();return;}
    if(button.dataset.recruit){replacePartyMember(run,partySlot,button.dataset.recruit);saveJourney();render();return;}
    if(button.dataset.viewHero){run.focusHero=button.dataset.viewHero;skillSlot=0;saveJourney();render();return;}
    if(button.dataset.loadoutSlot!==undefined){skillSlot=Number(button.dataset.loadoutSlot);render();return;}
    if(button.dataset.equipSkill){const result=equipSkill(run,run.focusHero,skillSlot,button.dataset.equipSkill);if(result.ok){skillSlot=result.slot;saveJourney();render();}else toast(result.error);return;}
  }
  if(button.dataset.boss&&screen==='title'&&!modal&&canChallengeBoss(profile,button.dataset.boss)){prefs.bossId=button.dataset.boss;preferences();render();return;}
  if(button.dataset.difficulty&&screen==='title'&&!modal){prefs.difficulty=button.dataset.difficulty;preferences();render();return;}
  if(busy||modal||screen!=='battle')return;
  if(button.dataset.enemyTarget){selectTarget(button.dataset.enemyTarget);return;}
  if(button.dataset.hero){state.selected=button.dataset.hero;lastSkill=null;updateScene(state);render();audio.play('select');return;}
  if(state.mode!=='playing')return;
  if(button.dataset.skill){lastSkill={owner:button.dataset.owner,id:button.dataset.skill};state.selected=button.dataset.owner;perform(()=>useSkill(state,state.selected,button.dataset.skill));}
});
document.addEventListener('input',e=>{const key=e.target.dataset.setting;if(key==='volume'){prefs.volume=Number(e.target.value)/100;audio.setVolume(prefs.volume);voice.configure({volume:Math.min(1,prefs.volume*1.8)});preferences();}});
document.addEventListener('change',e=>{const key=e.target.dataset.setting;if(key==='music'){prefs.music=e.target.checked;audio.setMusic(prefs.music);}else if(key==='voice'){prefs.voice=e.target.checked;voice.configure({enabled:prefs.voice});if(modal)voice.pause();}else if(key==='muted'){prefs.muted=e.target.checked;audio.setMuted(prefs.muted);voice.configure({muted:prefs.muted});if(modal)voice.pause();}else return;preferences();});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')&&!['Escape','Tab'].includes(e.key))return;
  const key=e.key.toLowerCase();
  if(['explore','dialogue'].includes(screen)&&!modal&&[' ','enter'].includes(key)&&e.target.closest('button,a,[role=button]'))return;
  if(screen==='explore'&&!modal){
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){e.preventDefault();if(!currentStoryLine()){walkKeys.add(key);syncWalking();}return;}
    if(['e',' ','enter'].includes(key)){e.preventDefault();if(!e.repeat){audio.unlock();action(currentStoryLine()?'explore-next':'explore-interact');}return;}
    if(key==='escape'){e.preventDefault();action('pause');return;}
  }
  if(!modal&&screen!=='art-review'&&[' ','escape','h','q','w','e','t','1','2','3','r','v','b'].includes(key))e.preventDefault();if(e.repeat)return;
  if(modal){if(key==='escape'&&!['victory','defeat'].includes(modal))action('close-modal');if(key==='tab'){const focus=[...document.querySelectorAll('.modal button,.modal input,.modal summary,.modal a[href],.modal select,.modal textarea,.modal [tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length);if(!focus.length)return;const i=focus.indexOf(document.activeElement);if(i<0){e.preventDefault();(e.shiftKey?focus.at(-1):focus[0]).focus();}else if(e.shiftKey&&i===0){e.preventDefault();focus.at(-1).focus();}else if(!e.shiftKey&&i===focus.length-1){e.preventDefault();focus[0].focus();}}return;}
  if(screen==='art-review'){
    if(key==='escape'){e.preventDefault();if(artConcept)artReviewAction('art-concept-close');else exitArtReview();}
    if(artConcept&&key==='tab'){e.preventDefault();document.querySelector('[data-action="art-concept-close"]')?.focus();}
    return;
  }
  if(key==='b'){action('boss-codex');return;}
  if(key==='h'){action('help');return;}
  if(screen==='model-review'){if(key==='escape')exitModelReview();return;}
  if(screen==='dialogue'){if(key===' '||key==='enter'){e.preventDefault();action('story-next');}if(key==='escape')action('pause');return;}
  if(busy||screen!=='battle')return;
  if(key==='escape'){action('pause');return;}
  if(['1','2','3'].includes(key)){const hero=state.heroes[Number(key)-1];if(!hero)return;state.selected=hero.id;lastSkill=null;audio.play('select');updateScene(state);render();return;}
  const index=['q','w','e','r','t'].indexOf(key);if(index>=0){const skill=activeSkills(state,state.selected)[index];if(!skill)return;lastSkill={owner:state.selected,id:skill.id};audio.unlock();perform(()=>useSkill(state,state.selected,lastSkill.id));return;}
  if(key==='tab'){e.preventDefault();const targets=enemyTargets(state).filter(enemy=>!enemy.defeated),index=targets.findIndex(enemy=>enemy.selected);if(targets.length)selectTarget(targets[(index+(e.shiftKey?targets.length-1:1))%targets.length].id);return;}
  if(key===' ')action('end');if(key==='v')action('potion');
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopWalking();if(screen==='explore'){scene?.setExplorationPaused(true);saveJourney();}voice.pause();clearTimeout(autoStoryTimer);}else{if(currentStoryLine()&&!modal)voice.resume();if(screen==='explore')scene?.setExplorationPaused(!!modal||!!currentStoryLine());}if(document.hidden&&screen==='battle'&&!busy&&!modal&&state.mode==='playing')openModal('pause');});
window.addEventListener('beforeunload',()=>{if(screen==='battle'||screen==='explore')persist();});
setInterval(()=>{const clock=document.querySelector('#elapsed');if(clock)clock.textContent=formatTime(elapsed+(startedAt?(Date.now()-startedAt)/1000:0));},1000);
setup();
