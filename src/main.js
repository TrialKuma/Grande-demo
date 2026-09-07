import './style.css';
import './interface.css';
import './details.css';
import './campaign.css';
import './update-3.2.css';
import './gm-tools.css';
import {gmToolsView,progressResetView,resetGameProgress,challengePartyView,normalizeChallengeParty,swapChallengeParty} from './gm-tools.js';
import {DialogueVoice} from './voice.js';
import {voiceCastView} from './voice-cast.js';
import {heroJournalView} from './hero-journal.js';
import {normalizeProfile,rememberCompanions,isDialogueAdvanceGesture,unlockAllHeroes,disableAllHeroes} from './player-profile.js';
import voiceManifest from '../public/voices/manifest.json';
import {campaignEntry,campaignView} from './campaign-ui.js';
import {STORY_SPEAKERS} from './story.js';
import {createRun,normalizeRun,battleForRun,advanceDialogue,completeEncounter,claimReward,replacePartyMember,equipSkill,startNextChapter,regroup,currentChapter,runDialogue,chooseRoute,chooseEvent,storyHistory,unlockRunHeroes,disableRunHeroes} from './campaign.js';
import './boss-codex.css';
import {bossCodexView} from './boss-codex.js';
import {tooltipView} from './status-details.js';
import {createTooltipController} from './tooltips.js';
import {titleView as renderTitle,battleView as renderBattle,helpView,bossOf} from './interface.js';
import {BattleScene} from './scene.js';
import {GameAudio} from './audio.js';
import {HEROES,SKILLS,BOSSES,DIFFICULTIES,prepareResponse,createBattle,useSkill,usePotion,guard,endRound} from './combat.js';
import {icon} from './icons.js';
import {normalizeSave} from './save.js';
import {createFeedbackState,applyFeedbackImpact} from './battle-feedback.js';

const app=document.querySelector('#app');
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
let profile=rememberCompanions(normalizeProfile(read(PROFILE_SAVE,null)),run),journalHero='knibbs';
let challengeSlot=0;
if(profile.gmAllHeroes&&run)unlockRunHeroes(run);
else if(run)disableRunHeroes(run);
prefs.partyIds=normalizeChallengeParty(prefs.partyIds,profile.unlockedHeroes);
write(PROFILE_SAVE,profile);
prefs.challengeMode=prefs.challengeMode==='solo'?'solo':'party';
if(!profile.unlockedHeroes.includes(prefs.soloHero))prefs.soloHero='knibbs';
const audio=new GameAudio();audio.setMuted(prefs.muted);audio.setMusic(prefs.music);audio.setVolume(prefs.volume);
let autoStoryTimer=null;
const voice=new DialogueVoice(voiceManifest,{onState:updateVoiceState});
voice.configure({enabled:prefs.voice,muted:prefs.muted,volume:Math.min(1,prefs.volume*1.8)});
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const portrait=(id,cls='')=>`<span class="portrait ${id} ${cls}" role="img" aria-label="${HEROES.find(h=>h.id===id)?.name||id}"></span>`;
const btn=(id,label,name,extra='')=>`<button class="icon-button" data-action="${id}" aria-label="${label}" title="${label}" ${extra}>${icon(name)}</button>`;
const formatTime=t=>`${Math.floor(t/60).toString().padStart(2,'0')}:${Math.floor(t%60).toString().padStart(2,'0')}`;
function setup(){
  app.innerHTML=`<div id="scene" aria-label="可拖动旋转的三维战场"></div><div class="vignette"></div><div id="ui"></div><div id="modal-root"></div><div id="toast" role="status" aria-live="polite"></div><div id="action-caption" aria-live="polite"></div><div id="transition" class="transition"></div>`;
  try{scene=new BattleScene(document.querySelector('#scene'));scene.setSpeed(prefs.speed);scene.updateState({...state,mode:'title'});}catch(err){console.error(err);document.querySelector('#scene').innerHTML='<div class="render-error">3D 战场未能启动。请在开启硬件加速的 Chrome 或 Edge 中重新打开。</div>';}
  tooltips=createTooltipController(({kind,owner,detail})=>tooltipView(screen==='camp'&&run?battleForRun(run,owner):state,kind,owner,detail),()=>['battle','camp'].includes(screen)&&!modal&&!busy);
  render();
}
function toolbar(){return `<div class="toolbar">${btn('sound',prefs.muted?'开启声音':'静音',prefs.muted?'muted':'volume')}<button class="speed-button" data-action="speed" title="切换演出速度" ${busy?'disabled':''}>${prefs.speed}×</button>${btn('fullscreen','全屏','expand')}${btn('help','战斗手册 · H','help')}${screen!=='title'?btn('pause','暂停与设置 · Esc','pause',busy?'disabled':''):''}</div>`;}
function render(){
  tooltips?.hide();
  app.classList.toggle('in-battle',screen==='battle');
  const root=document.querySelector('#ui');
  if(screen==='title')root.innerHTML=titleView();
  else if(screen==='battle')root.innerHTML=battleView();
  else if(screen==='model-review')root.innerHTML=modelReviewView();
  else root.innerHTML=campaignView(run,{partySlot,skillSlot});
  renderModal();syncDialogue();if(!busy)syncScore();
}
function titleView(){const records=read(RECORDS,[]);return renderTitle(prefs,saved,toolbar(),Array.isArray(records)?records:[],campaignEntry(run),{unlockedHeroes:profile.unlockedHeroes});}
function challengeOptions(){return {mode:prefs.challengeMode,partyIds:prefs.challengeMode==='solo'?[profile.unlockedHeroes.includes(prefs.soloHero)?prefs.soloHero:'knibbs']:normalizeChallengeParty(prefs.partyIds,profile.unlockedHeroes)};}
function battleView(){return renderBattle(feedbackState||state,busy,toolbar(),formatTime(elapsed+(startedAt?(Date.now()-startedAt)/1000:0)),lastSkill);}
function syncScore(){audio.setScene?.({bossId:state.boss.id,screen,phase:screen==='battle'?(state.mode==='victory'?'victory':state.mode==='defeat'?'defeat':state.boss.finale?'finale':state.boss.core?'core':state.boss.stage):0});}

function updateVoiceState(status){
  audio.setDialogue(status==='playing'||status==='loading');
  const labels={idle:'中文合成配音',off:'配音已关闭',loading:'正在载入语音',playing:'正在说话',paused:'配音已暂停',ended:'本句播放完毕',blocked:'点击重听，启用声音',unavailable:'本句尚无配音',error:'音频未能播放 · 可点击重听'};
  const element=document.querySelector('.modal .voice-status')||document.querySelector('.voice-status');if(element){element.textContent=labels[status]||labels.idle;element.dataset.state=status;}
  document.querySelectorAll('.voice-cast-card').forEach(card=>{const button=card.querySelector('[data-voice-speaker]');card.classList.toggle('is-playing',status==='playing'&&button?.dataset.voiceSpeaker===voice?.line?.speaker);});
  clearTimeout(autoStoryTimer);
  if(status==='ended'&&prefs.storyAuto&&screen==='dialogue'&&!modal&&!document.hidden){
    const position=`${run.chapter}/${run.dialogue}/${run.line}`;
    autoStoryTimer=setTimeout(()=>{if(screen==='dialogue'&&!modal&&prefs.storyAuto&&position===`${run.chapter}/${run.dialogue}/${run.line}`)action('story-next');},900);
  }
}
function currentStoryLine(){return screen==='dialogue'&&run?runDialogue(run)[run.line]:null;}
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

function renderModal(){
  tooltips?.hide();
  const root=document.querySelector('#modal-root');document.querySelector('#ui').inert=!!modal;if(!modal){root.innerHTML='';return;}
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
  else if(modal==='credits')body=`<div class="modal-eyebrow">BEHIND THE ECHO</div><h2>格朗德 · 魔晶回响</h2><p class="modal-lead">基于格朗德既有角色设定的分支远征。十名 BOSS、两处选路，以及由沿途决定产生的不同结局。</p><div class="credits-copy"><p><b>沿用设定</b><br>尼布斯拉姆的气息、直感发射、单发确认、扩散弹；艾佩莉雅的连击与四种武器；雷克的深渊领域和正负平衡；魔晶巨人的元素解体、地裂、迷雾、共鸣与双系核心。</p><p><b>本次改编</b><br>「停机之前」救援剧情、哈特蒙斯的支援技能，以及折镜刃卫、孢冠司祭、雷脊守卫、缄页织者、四名分支守卫与归零之核为 demo 适配或原创内容。哈特蒙斯、潜行、游木／游墓和补丁 Z 均采用已有角色卡；游木使用气息，其余三人使用魔力。三名魔力角色先将魔力转化为念线、银焱或记录，再消耗二级资源换回魔力并触发不同效果。潜行的钉刺护甲、聚焦光束与紧急修复取自既有技能稿。七人选三、三十五项成长奖励、每人五个技能位与三种预备应对按回合制体验编写，全队共享 6 AP。</p><p><b>美术与声音</b><br>四张生成图片包含七人头像、船长形态与标题背景。潜行的银焱战甲参照立绘，通过 Blender 脚本建立可编辑网格与分层材质，提供模型展示；其余角色、十名 BOSS 和五处场景使用程序化模型。${voiceManifest.clips.length} 句对白按角色选择七种中文神经基础声线，在线生成后保存为本地音频；标题页可逐角色试听；音乐与技能音效由程序合成。</p><p>无需账号。游戏进度仅保存在本机。</p></div><button class="primary" data-action="close-modal">返回 ${icon('arrow')}</button>`;
  else if(modal==='victory'||modal==='defeat'){
    const win=modal==='victory',survivors=state.heroes.filter(h=>h.hp>0).length;
    const grade=state.round<=8&&survivors===state.heroes.length&&state.boss.reforms===0?'S':survivors===state.heroes.length&&state.boss.reforms===0?'A':'B';cls='result-modal';
    body=`<div class="result-emblem ${win?'':'lost'}">${icon(win?'crystal':'flag')}</div><div class="modal-eyebrow">${win?'EXPEDITION COMPLETE':'THE ECHO REMAINS'}</div><h2>${win?'已击败 · '+bossOf(state).name:'远征尚未结束'}</h2><p class="modal-lead">${win?({golem:'核心的光逐渐熄灭。遗迹重新归于寂静。',duelist:'最后一面镜片碎裂，刃卫放下了长刀。',cantor:'孢冠失去光芒，沉积的孢雾缓缓散去。',warden:'避雷针熄灭，栈桥上的风暴终于退去。',weaver:'封页机构停止，控制室的通路已经打开。',final:'归零程序已停止，避难室重新开始通风。',tide:'压力阀停止转动。维修通道的积水开始退去。',furnace:'炉膛渐渐暗下来，备用线路恢复供电。',orrery:'星轨归位。总控留下的观测记录终于能够读出。',arbiter:'执行官放下封令。被拦住的救援器械开始通行。'}[state.boss.id]):'带上这一次的经验，再试一次。'}</p>${win?`<div class="result-rank">${grade}<span>远征评级</span></div>`:''}<div class="result-stats"><div><strong>${state.round}</strong><span>战斗回合</span></div><div><strong>${state.stats.damage.toLocaleString()}</strong><span>累计伤害</span></div><div><strong>${state.stats.breaks}</strong><span>架势击破</span></div><div><strong>${state.stats.interrupts}</strong><span>行动打断</span></div></div><div class="result-party">${state.heroes.map(h=>`<div class="${h.hp<=0?'down':''}">${portrait(h.id)}<span>${h.short}</span><small>${h.hp<=0?'失去意识':h.hp+' / '+h.maxHp}</small></div>`).join('')}</div>${!win?'<p class="defeat-tip">留出 1 AP 应对敌方行动，并在输出、护盾和恢复之间安排资源。初探难度同样保留全部机制。</p>':''}<button class="primary" data-action="${journeyActive&&win?'journey-resume':'restart'}">${journeyActive&&win?'继续旅程':'再次挑战'} ${icon(journeyActive&&win?'arrow':'repeat')}</button>${journeyActive&&!win?'<button class="regroup-button" data-action="journey-resume">返回整备 · 调整队伍与技能</button>':''}<div class="modal-secondary"><button data-action="back-title">返回标题</button><button data-action="log">查看战斗记录</button></div>`;
  }
  root.innerHTML=`<div class="modal-backdrop"><section role="dialog" aria-modal="true" aria-label="${modal}" class="modal ${cls}">${!['victory','defeat'].includes(modal)?`<button class="modal-close icon-button" data-action="close-modal" aria-label="关闭">${icon('close')}</button>`:''}${body}${modal==='pause'?'<button class="gm-pause-entry" data-action="gm">GM · 角色全开</button>':''}</section></div>`;
}

function persist(){if(journeyActive&&run){if(run.phase==='battle'&&state.mode==='playing')run.battle={...state,elapsed:elapsed+(startedAt?(Date.now()-startedAt)/1000:0)};write(RUN_SAVE,run);return;}if(state.mode==='playing'){write(SAVE,{...state,elapsed:elapsed+(startedAt?(Date.now()-startedAt)/1000:0)});saved=normalizeSave(read(SAVE,null));}else{remove(SAVE);saved=null;}}
function preferences(){write(PREFS,prefs);}
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.classList.add('show');clearTimeout(timer);timer=setTimeout(()=>el.classList.remove('show'),2800);}
function openModal(type){if(busy)return;voice.pause();clearTimeout(autoStoryTimer);modal=type;scene?.setPaused(true);if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}renderModal();requestAnimationFrame(()=>document.querySelector('.modal button')?.focus());}
function closeModal(){if(modal==='model-review'){exitModelReview();return;}modal=null;scene?.setPaused(false);if(screen==='battle'&&state.mode==='playing'&&!startedAt)startedAt=Date.now();renderModal();syncDialogue();if(screen==='dialogue')voice.resume();}
async function begin(resume=false){
  if(busy)return;journeyActive=false;busy=true;await audio.unlock();closeModal();
  state=resume&&saved?structuredClone(saved):createBattle(prefs.difficulty,prefs.bossId,challengeOptions());screen='battle';busy=false;elapsed=resume?(state.elapsed||0):0;startedAt=Date.now();lastSkill=null;
  prefs.bossId=state.boss.id;prefs.difficulty=state.difficulty;preferences();render();window.scrollTo(0,0);
  scene?.setPaused(false);scene?.resetCamera();scene?.updateState(state);syncScore();render();persist();
  const t=document.querySelector('#transition');t.classList.add('flash');setTimeout(()=>t.classList.remove('flash'),850);
}
function perform(resolve){const before=structuredClone(state);return execute(resolve(),before);}
async function execute(result,before){
  if(!result.ok){toast(result.error);audio.play('error');return;}
  feedbackState=before?createFeedbackState(before,state):null;busy=true;render();
  try{
    for(const rawEvent of result.events){
      const event={...rawEvent,bossId:rawEvent.bossId||state.boss.id};
      audio.play(event,{speed:prefs.speed});if(['phase','core','victory','defeat'].includes(event.type))syncScore();
      const caption=document.querySelector('#action-caption');caption.innerHTML=`<small>${event.actor==='boss'?bossOf(state).name:HEROES.find(h=>h.id===event.actor)?.name||''}</small><strong>${esc(event.label||'')}</strong>`;caption.classList.add('show');
      await scene?.play(event,{onImpact:index=>{if(feedbackState){applyFeedbackImpact(feedbackState,event,index);scene?.updateState(feedbackState);document.querySelector('#ui').innerHTML=battleView();}}});caption.classList.remove('show');
    }
  }catch(error){console.error(error);toast('演出被跳过，战斗继续。');}
  feedbackState=null;busy=false;scene?.updateState(state);
  if(journeyActive&&run&&run.phase==='battle'){if(state.mode==='victory'){completeEncounter(run,state);rememberUnlocks();}else if(state.mode==='defeat')regroup(run);}
  persist();render();
  if(state.mode!=='playing'){
    if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}
    if(state.mode==='victory'){const value=read(RECORDS,[]),records=Array.isArray(value)?value:[];records.push({bossId:state.boss.id,round:state.round,difficulty:state.difficulty,challengeMode:state.challengeMode||'party',partyIds:state.heroes.map(h=>h.id),at:Date.now(),damage:state.stats.damage});write(RECORDS,records.slice(-50));audio.setPhase('victory');}
    openModal(state.mode);
  }
}
function action(name){
  if(name==='gm'){if(!busy)openModal('gm');return;}
  if(name==='gm-unlock'){if(busy||modal!=='gm')return;profile=unlockAllHeroes(profile);write(PROFILE_SAVE,profile);if(run){unlockRunHeroes(run);saveJourney();}render();toast('七名角色已全部解锁。');return;}
  if(name==='gm-disable'){
    if(busy||modal!=='gm')return;
    if(screen==='battle')persist();
    profile=disableAllHeroes(profile,run);write(PROFILE_SAVE,profile);
    if(run){disableRunHeroes(run);saveJourney();}
    prefs.partyIds=normalizeChallengeParty(prefs.partyIds,profile.unlockedHeroes);
    if(!profile.unlockedHeroes.includes(prefs.soloHero))prefs.soloHero='knibbs';
    preferences();render();toast('已关闭全角色测试，保留正常招募进度。');return;
  }
  if(name==='progress-reset'){if(!busy&&modal==='gm')openModal('progress-reset');return;}
  if(name==='progress-reset-confirm'){
    if(busy||modal!=='progress-reset')return;
    const cleared=resetGameProgress({removeItem:remove},prefs);
    voice.stop();clearTimeout(autoStoryTimer);run=null;saved=null;journeyActive=false;
    profile=cleared.profile;Object.assign(prefs,cleared.prefs);write(PROFILE_SAVE,profile);preferences();
    journalHero='knibbs';challengeSlot=0;partySlot=0;skillSlot=0;feedbackState=null;lastSkill=null;startedAt=0;elapsed=0;
    screen='title';modal=null;state=createBattle(prefs.difficulty,prefs.bossId,challengeOptions());
    scene?.setPaused(false);scene?.updateState({...state,mode:'title'});render();window.scrollTo(0,0);toast('进度已重置，声音设置已保留。');return;
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
  if(name==='restart'&&journeyActive&&run){run.phase='camp';if(!profile.gmAllHeroes)disableRunHeroes(run);run.phase='battle';run.battle=null;launchJourneyBattle(false);return;}
  if(name==='restart'){prefs.difficulty=state.difficulty;prefs.bossId=state.boss.id;prefs.challengeMode=state.challengeMode||'party';if(state.heroes.length===1)prefs.soloHero=state.heroes[0].id;else prefs.partyIds=state.heroes.map(h=>h.id);preferences();begin(false);return;}
  if(name==='continue'){begin(true);return;}
  if(name==='back-title'&&journeyActive){journeyAction('journey-title');return;}
  if(name==='back-title'){persist();screen='title';closeModal();startedAt=0;scene?.updateState({...state,mode:'title'});render();window.scrollTo(0,0);return;}
  if(screen!=='battle'||modal||state.mode!=='playing')return;
  if(name==='end')perform(()=>endRound(state));
  if(name==='potion')perform(()=>usePotion(state,state.selected));
  if(name==='guard')perform(()=>guard(state,state.selected));
}


function rememberUnlocks(){profile=rememberCompanions(profile,run);write(PROFILE_SAVE,profile);}
function saveJourney(){if(run){rememberUnlocks();write(RUN_SAVE,run);}}
async function launchJourneyBattle(resume=false){
  if(busy)return;
  busy=true;await audio.unlock();modal=null;journeyActive=true;
  state=resume&&run.battle?structuredClone(run.battle):battleForRun(run);
  run.phase='battle';screen='battle';busy=false;elapsed=resume?(state.elapsed||0):0;startedAt=Date.now();lastSkill=null;
  render();window.scrollTo(0,0);scene?.setPaused(false);scene?.resetCamera();scene?.updateState(state);syncScore();persist();
}
function showJourney(){
  journeyActive=true;modal=null;busy=false;tooltips?.hide();
  if(run.phase==='battle'){launchJourneyBattle(true);return;}
  if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}
  screen=run.phase;
  if(!(run.phase==='dialogue'&&run.dialogue==='after'))state=battleForRun(run);
  scene?.setPaused(false);scene?.updateState({...state,mode:'title'});syncScore();saveJourney();render();window.scrollTo(0,0);
}
function journeyAction(name){
  if(!['journey-start','journey-continue','journey-resume','journey-title','story-next','story-prev','story-skip','camp-depart'].includes(name))return false;
  if(busy)return true;
  tooltips?.hide();
  if(name==='journey-start'){run=createRun(prefs.difficulty,{gmAllHeroes:profile.gmAllHeroes});partySlot=0;skillSlot=0;showJourney();audio.unlock();return true;}
  if(name==='journey-continue'||name==='journey-resume'){if(run)showJourney();return true;}
  if(name==='journey-title'){
    persist();if(startedAt){elapsed+=(Date.now()-startedAt)/1000;startedAt=0;}
    journeyActive=false;screen='title';modal=null;scene?.setPaused(false);scene?.updateState({...state,mode:'title'});render();window.scrollTo(0,0);return true;
  }
  if(!journeyActive||!run)return true;
  if(name==='story-prev'){run.line=Math.max(0,run.line-1);saveJourney();showJourney();return true;}
  if(name==='story-next'||name==='story-skip'){advanceDialogue(run,name==='story-skip');saveJourney();showJourney();return true;}
  if(name==='camp-depart'){startNextChapter(run);saveJourney();showJourney();return true;}
  return true;
}

let pointerStart=null,pointerMovement=0;
document.addEventListener('pointerdown',e=>{pointerStart={x:e.clientX,y:e.clientY};pointerMovement=0;});
document.addEventListener('pointermove',e=>{if(pointerStart)pointerMovement=Math.max(pointerMovement,Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y));});
document.addEventListener('pointercancel',()=>{pointerStart=null;pointerMovement=100;});
document.addEventListener('click',e=>{
  const button=e.target.closest('button,[data-action]');
  if(!button){
    const interactive=!!e.target.closest('a,input,select,textarea,label,[role="button"],[role="dialog"],[data-tooltip]');
    if(isDialogueAdvanceGesture({screen,modal,busy,interactive,selectedText:window.getSelection()?.toString()||'',movement:pointerMovement,button:e.button,detail:e.detail})){e.preventDefault();audio.unlock();action('story-next');}
    pointerStart=null;return;
  }
  if(button.disabled)return;
  e.preventDefault();audio.unlock();audio.play('click');
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
  if(button.dataset.action){action(button.dataset.action);return;}
  if(!busy&&!modal&&journeyActive&&run){
    if(button.dataset.reward){const result=claimReward(run,button.dataset.reward);if(result.ok){partySlot=0;skillSlot=4;showJourney();}else toast(result.error);return;}
    if(button.dataset.partySlot!==undefined){partySlot=Number(button.dataset.partySlot);run.focusHero=run.partyIds[partySlot];skillSlot=0;saveJourney();render();return;}
    if(button.dataset.recruit){replacePartyMember(run,partySlot,button.dataset.recruit);saveJourney();render();return;}
    if(button.dataset.viewHero){run.focusHero=button.dataset.viewHero;skillSlot=0;saveJourney();render();return;}
    if(button.dataset.loadoutSlot!==undefined){skillSlot=Number(button.dataset.loadoutSlot);render();return;}
    if(button.dataset.equipSkill){const result=equipSkill(run,run.focusHero,skillSlot,button.dataset.equipSkill);if(result.ok){skillSlot=result.slot;saveJourney();render();}else toast(result.error);return;}
  }
  if(button.dataset.boss&&screen==='title'&&!modal){prefs.bossId=button.dataset.boss;preferences();render();return;}
  if(button.dataset.difficulty&&screen==='title'&&!modal){prefs.difficulty=button.dataset.difficulty;preferences();render();return;}
  if(busy||modal||screen!=='battle')return;
  if(button.dataset.hero){state.selected=button.dataset.hero;lastSkill=null;scene?.updateState(state);render();audio.play('select');return;}
  if(state.mode!=='playing')return;
  if(button.dataset.response){perform(()=>prepareResponse(state,button.dataset.response,state.selected));return;}
  if(button.dataset.skill){lastSkill={owner:button.dataset.owner,id:button.dataset.skill};state.selected=button.dataset.owner;perform(()=>useSkill(state,state.selected,button.dataset.skill));}
});
document.addEventListener('input',e=>{const key=e.target.dataset.setting;if(key==='volume'){prefs.volume=Number(e.target.value)/100;audio.setVolume(prefs.volume);voice.configure({volume:Math.min(1,prefs.volume*1.8)});preferences();}});
document.addEventListener('change',e=>{const key=e.target.dataset.setting;if(key==='music'){prefs.music=e.target.checked;audio.setMusic(prefs.music);}else if(key==='voice'){prefs.voice=e.target.checked;voice.configure({enabled:prefs.voice});if(modal)voice.pause();}else if(key==='muted'){prefs.muted=e.target.checked;audio.setMuted(prefs.muted);voice.configure({muted:prefs.muted});if(modal)voice.pause();}else return;preferences();});
document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')&&!['Escape','Tab'].includes(e.key))return;
  const key=e.key.toLowerCase();if(!modal&&[' ','escape','h','q','w','e','t','1','2','3','r','v','f','z','x','c','b'].includes(key))e.preventDefault();if(e.repeat)return;
  if(modal){if(key==='escape'&&!['victory','defeat'].includes(modal))action('close-modal');if(key==='tab'){const focus=[...document.querySelectorAll('.modal button,.modal input,.modal summary,.modal a[href],.modal select,.modal textarea,.modal [tabindex]')].filter(x=>!x.disabled&&x.tabIndex>=0&&x.getClientRects().length);if(!focus.length)return;const i=focus.indexOf(document.activeElement);if(i<0){e.preventDefault();(e.shiftKey?focus.at(-1):focus[0]).focus();}else if(e.shiftKey&&i===0){e.preventDefault();focus.at(-1).focus();}else if(!e.shiftKey&&i===focus.length-1){e.preventDefault();focus[0].focus();}}return;}
  if(key==='b'){action('boss-codex');return;}
  if(key==='h'){action('help');return;}
  if(screen==='model-review'){if(key==='escape')exitModelReview();return;}
  if(screen==='dialogue'){if(key===' '||key==='enter'){e.preventDefault();action('story-next');}if(key==='escape')action('pause');return;}
  if(busy||screen!=='battle')return;
  if(key==='escape'){action('pause');return;}
  if(['1','2','3'].includes(key)){const hero=state.heroes[Number(key)-1];if(!hero)return;state.selected=hero.id;lastSkill=null;audio.play('select');scene?.updateState(state);render();return;}
  const index=['q','w','e','r','t'].indexOf(key);if(index>=0){lastSkill={owner:state.selected,id:(state.loadouts?.[state.selected]?.[index]||SKILLS[state.selected][index].id)};audio.unlock();perform(()=>useSkill(state,state.selected,lastSkill.id));return;}
  const response=['z','x','c'].indexOf(key);if(response>=0){audio.unlock();perform(()=>prepareResponse(state,['parry','evade','counter'][response],state.selected));return;}
  if(key===' ')action('end');if(key==='v')action('potion');if(key==='f')action('guard');
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){voice.pause();clearTimeout(autoStoryTimer);}else if(screen==='dialogue'&&!modal)voice.resume();if(document.hidden&&screen==='battle'&&!busy&&!modal&&state.mode==='playing')openModal('pause');});
window.addEventListener('beforeunload',()=>{if(screen==='battle')persist();});
setInterval(()=>{const clock=document.querySelector('#elapsed');if(clock)clock.textContent=formatTime(elapsed+(startedAt?(Date.now()-startedAt)/1000:0));},1000);
setup();
