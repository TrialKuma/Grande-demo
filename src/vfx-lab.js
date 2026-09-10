import {BattleScene} from './scene.js';
import {HEROES,SKILLS,createBattle,useSkill,skillPreview} from './combat.js';
import {impactTiming} from './battle-feedback.js';
import {heroStatusFxProfile} from './scene-status-fx.js';
import {VfxTimeline} from './vfx-timeline.js';

const $=id=>document.getElementById(id),stage=new BattleScene($('scene'));
stage.setManualPlayback(true);stage.setFxLayer('numbers',false);
let snapshot,playing=true,last=performance.now();
const timeline=new VfxTimeline({
 reset(){stage.clearCombatEffects();stage.time=0;stage.resetEffectSeed(4187);stage.updateState(structuredClone(snapshot));},
 advance(dt){stage.advanceFrame(dt,dt,false);},fire(event){void stage.play(structuredClone(event));},render(){stage.advanceFrame(0,0,true);$('cost').textContent=`临时特效对象 ${stage.effects.length} · 持续状态 ${[...stage.statusFx.entries.values()].filter(entry=>entry.active).length}\n全场 draw calls ${stage.renderer.info.render.calls} · GPU 几何 ${stage.renderer.info.memory.geometries}`;}
});
for(const hero of HEROES){const option=document.createElement('option');option.value=hero.id;option.textContent=hero.short;$('hero').append(option);}
for(const [id,label]of [['trajectory','主轨迹 / 余辉'],['impact','命中光斑'],['debris','材质碎片'],['cast','施法符纹'],['status','持续状态'],['accent','辅助点缀']]){
 const labelNode=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=true;input.onchange=()=>{stage.setFxLayer(id,input.checked);timeline.render();};labelNode.append(input,label);$('layers').append(labelNode);
}
function fillSkills(){const id=$('hero').value;$('skill').replaceChildren();for(const skill of SKILLS[id]){const option=document.createElement('option');option.value=skill.id;option.textContent=skill.name;$('skill').append(option);}const idle=document.createElement('option');idle.value='idle';idle.textContent='仅查看状态 / 待机';$('skill').append(idle);}
function refresh(){
 try{
  const id=$('hero').value,key=$('skill').value,skill=SKILLS[id].find(item=>item.id===key),status=$('status').value;
  const party=[id,...['knibbs','ric','youmu'].filter(other=>other!==id)].slice(0,3);
  const loadout=[key,...SKILLS[id].filter(item=>!item.unlockKey&&item.id!==key).map(item=>item.id)].slice(0,4);
  const state=createBattle('standard',$('boss').value,{partyIds:party,singleEnemy:true,upgrades:skill?.unlockKey?[skill.unlockKey]:[],loadouts:skill?{[id]:loadout}:undefined});
  const hero=state.heroes.find(item=>item.id===id);state.selected=id;
  if(id==='ric')hero.resource=status==='negative'?-4:['positive','chaos','ready'].includes(status)?4:0;
  if(status==='chaos'&&id==='ric')hero.ricChaos=1;
  if(status==='ready'){
   if(id==='knibbs')hero.intuition=3;if(id==='apeilia')hero.resource=6;if(id==='youmu')hero.surgicalReady=true;
   if(hero.maxSecondary)hero.secondary=hero.maxSecondary;
  }
  if(status==='captain'&&id==='youmu'){hero.youmuForm='captain';hero.captainTurns=2;hero.captainUsed=true;}
  if(status==='dead')hero.hp=0;
  snapshot=structuredClone(state);
  let events=[],description='静态状态样本，未执行战斗逻辑。';
  if(skill&&hero.hp>0){
   const staged=structuredClone(state),actor=staged.heroes.find(item=>item.id===id);
   if(actor.maxSecondary&&status!=='ready')actor.secondary=Math.min(actor.maxSecondary,skill.secondaryCost||0);
   if(!['ric'].includes(id))actor.resource=actor.maxResource;staged.ap=8;
   const preview=skillPreview(staged,id,key),result=useSkill(staged,id,key);
   if(!result.ok)throw new Error(result.error);
   events=result.events.filter(event=>['attack','boss','buff','shield','heal','phase','core'].includes(event.type));
   description=`${preview.name}\n${events.length} 个表现事件 · ${preview.hits||0} 段\n${preview.description||''}`;
  }
  let at=.15;const schedule=events.map(event=>{const entry={at,event};at+=impactTiming(event).duration+.08;return entry;});
  timeline.load(schedule,Math.max(2.4,at+.8));$('scrub').max=timeline.duration;
  const statuses=heroStatusFxProfile(hero).map(item=>item.id).join('、')||'无';$('details').textContent=description+`\n\n状态：${statuses}\n种子：4187`;$('error').textContent='';playing=true;updateControls();
 }catch(error){$('error').textContent=`此样本暂不可施放：${error.message}`;playing=false;updateControls();}
}
function updateControls(){$('play').textContent=playing?'暂停':'播放';$('clock').textContent=`${timeline.position.toFixed(2)} / ${timeline.duration.toFixed(2)}s`;$('scrub').value=timeline.position;}
function seek(value){playing=false;timeline.seek(value);updateControls();}
$('hero').onchange=()=>{fillSkills();refresh();};for(const id of ['skill','boss'])$(id).onchange=refresh;
$('status').onchange=()=>{const required=['positive','negative','chaos'].includes($('status').value)?'ric':$('status').value==='captain'?'youmu':null;if(required&&$('hero').value!==required){$('hero').value=required;fillSkills();$('skill').value='idle';}refresh();};
$('replay').onclick=()=>{timeline.seek(0);playing=true;updateControls();};$('play').onclick=()=>{playing=!playing;if(playing&&timeline.position>=timeline.duration)timeline.seek(0);updateControls();};
$('step').onclick=()=>{playing=false;timeline.tick(1/60);updateControls();};$('scrub').oninput=()=>seek($('scrub').value);
$('motion').onchange=()=>{stage.reducedMotion=$('motion').checked;timeline.seek(timeline.position);};
$('numbers').onchange=()=>{stage.setFxLayer('numbers',$('numbers').checked);timeline.render();};
$('environment').onchange=()=>{stage.setFxLayer('environment',$('environment').checked);timeline.render();};
window.addEventListener('keydown',event=>{if(event.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(document.activeElement.tagName)){event.preventDefault();$('play').click();}});
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;if(playing){timeline.tick(dt*Number($('speed').value));if(timeline.position>=timeline.duration){if($('loop').checked)timeline.seek(0);else playing=false;}}else timeline.render();updateControls();requestAnimationFrame(frame);}
window.addEventListener('pagehide',()=>stage.dispose(),{once:true});fillSkills();refresh();requestAnimationFrame(frame);
// Explicit read-only inspection surface for local regression tools; no save API.
window.vfxLab={stage,timeline,refresh,seek,snapshot:()=>structuredClone(snapshot)};
