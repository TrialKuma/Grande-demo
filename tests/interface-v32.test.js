import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,createBattle,heroOf,useSkill,activeSkills,resolvedSkill,skillPreview} from '../src/combat.js';
import {createRun,advanceDialogue,battleForRun,completeEncounter,claimReward,rewardOptions,startNextChapter} from '../src/campaign.js';
import {campaignView} from '../src/campaign-ui.js';
import {battleView,portrait,titleView} from '../src/interface.js';
import {tooltipView} from '../src/status-details.js';
import {CHAPTERS,STORY_SPEAKERS} from '../src/story.js';

const text=html=>html.replace(/<[^>]*>/g,' ');
const clean=html=>assert.doesNotMatch(html,/undefined|NaN|\[object Object\]/);
const buttons=html=>[...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(([,attrs,body])=>({attrs,body}));
const skillButtons=(html,id)=>buttons(html).filter(b=>b.attrs.includes(`data-owner="${id}"`)&&b.attrs.includes('data-skill="'));
const renderBattle=state=>battleView(state,false,'','00:00',null);
const partyFor=id=>[id,...HEROES.filter(h=>h.id!==id).slice(0,2).map(h=>h.id)];
const rewards=['youmu_suture','haart_network','qianxing_nova','patch_revelation','knibbs_expose'];

// Win fixtures cross the same public campaign boundary as the battle screen.
function reachReward(run){
  if(run.phase==='camp')assert.equal(startNextChapter(run),true);
  assert.equal(advanceDialogue(run,true),true);
  const victory=battleForRun(run);victory.mode='victory';
  assert.equal(completeEncounter(run,victory),true);
  assert.equal(advanceDialogue(run,true),true);
  assert.equal(run.phase,'reward');
}
function allRecruitedCamp(){
  const run=createRun('standard',{legacyRoute:true});
  for(let chapter=0;chapter<4;chapter++){
    reachReward(run);
    assert.equal(claimReward(run,rewards[chapter]).ok,true);
  }
  return run;
}

test('interface 3.2: all seven heroes render exactly five usable command slots and Q/W/E/R/T',()=>{
  assert.equal(HEROES.length,7);
  for(const hero of HEROES){
    const state=createBattle('standard','warden',{partyIds:partyFor(hero.id)}),before=structuredClone(state);
    const html=renderBattle(state),cards=skillButtons(html,hero.id);
    clean(html);assert.equal(cards.length,5,hero.id);
    assert.equal(buttons(html).filter(b=>b.attrs.includes('data-skill="')).length,15);
    const skills=activeSkills(state,hero.id);
    for(const [index,card]of cards.entries()){
      const skill=skills[index],preview=skillPreview(state,hero.id,skill.id);
      assert.ok(card.attrs.includes(`data-skill="${skill.id}"`));
      assert.ok(card.body.includes(`<kbd>${'QWERT'[index]}</kbd>`));
      assert.ok(card.body.includes(resolvedSkill(state,hero.id,skill.id).name));
      assert.ok(card.body.includes(`aria-label="本次削韧 ${preview.stagger||0}"`));
    }
    assert.deepEqual(state,before,'Rendering cannot consume resource or alter a skill');
  }
});

test('interface 3.2: the camp renders all seven recruits and exactly five loadout slots per hero',()=>{
  const run=allRecruitedCamp();assert.equal(run.unlockedHeroes.length,7);
  for(const hero of HEROES){
    run.focusHero=hero.id;
    const before=structuredClone(run),html=campaignView(run,{skillSlot:4});clean(html);
    assert.equal(buttons(html).filter(b=>b.attrs.includes('data-view-hero="')).length,7);
    const slots=buttons(html).filter(b=>b.attrs.includes('data-loadout-slot="'));
    assert.equal(slots.length,5,hero.id);
    for(const [index,slot]of slots.entries()){
      assert.ok(slot.attrs.includes(`data-loadout-slot="${index}"`));
      assert.ok(slot.attrs.includes(`data-owner="${hero.id}"`));
      assert.ok(slot.attrs.includes(`data-detail="${run.loadouts[hero.id][index]}"`));
      assert.ok(slot.body.includes(`<kbd>${'QWERT'[index]}</kbd>`));
    }
    assert.match(text(html),/7 \/ 7/);assert.match(text(html),/携带 5 项技能/);
    assert.deepEqual(run,before);
  }
});

test('interface 3.2: new portrait identifiers and accessible names agree across title, battle and camp',()=>{
  const state=createBattle('standard','warden',{partyIds:['youmu','patch','ric']}),camp=allRecruitedCamp();
  const screens=[titleView({bossId:'warden',difficulty:'standard'},null,'',[]),renderBattle(state),campaignView(camp)];
  for(const id of ['youmu','patch']){
    const expected=portrait(id);assert.ok(expected.includes(`class="portrait ${id}"`));
    assert.ok(expected.includes(`aria-label="${HEROES.find(h=>h.id===id).name}"`));
    for(const html of screens){clean(html);assert.ok(html.includes(expected),`${id} portrait missing from a screen`);}
  }
  assert.match(portrait('youmu_inner'),/class="portrait youmu_inner"[^>]*aria-label="游墓"/);
});

test('interface 3.2: captain activation changes all five visible skills, tooltip details and the portrait, then restores them',()=>{
  const state=createBattle('standard','warden',{partyIds:['youmu','patch','ric']}),youmu=heroOf(state,'youmu');
  const doctorNames=activeSkills(state,'youmu').map(s=>resolvedSkill(state,'youmu',s.id).name);
  assert.ok(renderBattle(state).includes(portrait('youmu')));
  youmu.hp=60;assert.equal(useSkill(state,'youmu','bloodoath').ok,true);
  assert.equal(youmu.youmuForm,'captain');
  const before=structuredClone(state),html=renderBattle(state),cards=skillButtons(html,'youmu');
  clean(html);assert.ok(html.includes(portrait('youmu_inner')));assert.ok(!html.includes(portrait('youmu')));
  const captainNames=['铁血弯刀','船长威严','枪弹盛宴','沉渊炼狱号','死海整帆'];
  for(const [index,card]of cards.entries()){
    const id=activeSkills(state,'youmu')[index].id,tooltip=tooltipView(state,'skill','youmu',id);
    assert.ok(card.body.includes(captainNames[index]));assert.ok(!card.body.includes(doctorNames[index]));
    assert.ok(tooltip.includes(captainNames[index]));assert.match(text(tooltip),/游墓 · /);clean(tooltip);
  }
  assert.deepEqual(state,before);
  assert.equal(useSkill(state,'youmu','bloodoath').ok,true);
  const restored=renderBattle(state);assert.equal(youmu.youmuForm,'doctor');
  assert.ok(restored.includes(portrait('youmu')));assert.ok(!restored.includes(portrait('youmu_inner')));
  const restoredCards=skillButtons(restored,'youmu');
  for(const [index,card]of restoredCards.entries())assert.ok(card.body.includes(doctorNames[index]));
});

test('interface 3.2: Patch collection enhancement has the same visible name and highlight as its tooltip',()=>{
  const state=createBattle('standard','warden',{partyIds:['youmu','patch','ric']});
  assert.equal(useSkill(state,'patch','bookward').ok,true);
  assert.equal(useSkill(state,'patch','bookward').ok,true);
  const patch=heroOf(state,'patch');assert.equal(patch.patchForm,'record');assert.equal(patch.secondary,4);
  const html=renderBattle(state),card=skillButtons(html,'patch').find(b=>b.attrs.includes('data-skill="chargedslash"'));
  assert.ok(card.body.includes('充能斩 · 反证'));assert.ok(card.attrs.includes('empowered'));
  assert.ok(tooltipView(state,'skill','patch','chargedslash').includes('充能斩 · 反证'));
  assert.match(text(html),/收录/);clean(html);
});

test('each reward screen states its actual choice count and a new skill occupies slot five',()=>{
  const run=createRun('standard',{legacyRoute:true});
  for(let chapter=0;chapter<5;chapter++){
    reachReward(run);
    const options=rewardOptions(run),before=structuredClone(run),html=campaignView(run),count=options.length;
    assert.ok(count>=4);clean(html);
    assert.equal(buttons(html).filter(b=>b.attrs.includes('data-reward="')).length,count);
    assert.match(text(html),new RegExp(`${count} 选 1`));assert.doesNotMatch(text(html),/三选一|3 选 1/);
    assert.deepEqual(run,before);
    const reward=options.find(r=>r.id===rewards[chapter]);assert.ok(reward);
    assert.equal(claimReward(run,reward.id).ok,true);
    if(reward.kind==='skill'){
      assert.equal(run.loadouts[reward.heroId][4],reward.skillId);
      const camp=campaignView(run),slot=buttons(camp).find(b=>b.attrs.includes('data-loadout-slot="4"'));
      assert.ok(slot.attrs.includes(`data-detail="${reward.skillId}"`));
      assert.match(text(camp),/已装入第 5 位/);
    }
  }
});

test('interface 3.2: every story line resolves its speaker and nonportrait voices use icons instead of bad portraits',()=>{
  const seen=new Set();
  for(const [chapter,definition]of CHAPTERS.entries())for(const dialogue of ['before','after']){
    for(const [line,entry]of definition[dialogue].entries()){
      const run={...createRun('standard',{legacyRoute:true}),chapter,dialogue,line},before=structuredClone(run),html=campaignView(run);
      const speaker=STORY_SPEAKERS[entry.speaker]||HEROES.find(h=>h.id===entry.speaker);assert.ok(speaker,entry.speaker);
      clean(html);assert.ok(html.includes(`data-speaker="${entry.speaker}"`));assert.ok(html.includes(speaker.name));
      if(Object.hasOwn(STORY_SPEAKERS,entry.speaker)&&!speaker.portrait){
        seen.add(entry.speaker);assert.match(html,/class="dialogue-speaker narration"/);
        assert.ok(!html.includes(`class="portrait ${entry.speaker}"`));assert.ok(!html.includes('<img'));
      }else{
        const id=speaker.portrait||entry.speaker;
        assert.match(html,new RegExp(`class="portrait ${id}"[^>]*role="img"[^>]*aria-label="${speaker.name}"`));
      }
      assert.deepEqual(run,before);
    }
  }
  assert.deepEqual([...seen].sort(),['clerk','narrator','student']);
});
