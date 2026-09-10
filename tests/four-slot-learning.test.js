import test from 'node:test';
import assert from 'node:assert/strict';
import {HEROES,SKILLS,SKILL_SLOTS,createBattle,activeSkills,heroOf,useSkill} from '../src/combat.js';
import {createRun,normalizeRun,battleForRun,advanceDialogue,completeEncounter,chooseCompanion,startNextChapter,skillAccessFor,equipSkill} from '../src/campaign.js';
import {normalizeSave} from '../src/save.js';
import {campaignView} from '../src/campaign-ui.js';
import {createSkillDragController} from '../src/skill-drag.js';

const win=run=>{if(run.phase==='camp')startNextChapter(run);advanceDialogue(run,true);assert.equal(completeEncounter(run,{...battleForRun(run),mode:'victory'}),true);advanceDialogue(run,true);};

test('the first lesson starts with confirmation and its one-use follow-up, while ordinary shots do not recover',()=>{
 const run=createRun(),battle=battleForRun(run),hero=heroOf(battle,'knibbs');
 assert.deepEqual(activeSkills(battle,'knibbs').map(s=>s.id),['shot','focus']);
 assert.equal(useSkill(battle,'knibbs','focus').ok,true);assert.equal(hero.resource,8);
 assert.equal(useSkill(battle,'knibbs','shot').ok,true);assert.equal(hero.resource,9);assert.deepEqual(hero.followupUsed,['shot']);
 assert.equal(battle.ap,0);assert.ok(battle.boss.hp>0,'the tutorial survives the first complete output sequence');
});

test('Knibbs learns dedicated ammunition before countering, then keeps four commands when optional ammunition is learned',()=>{
 const run=createRun();win(run);chooseCompanion(run,'apeilia');
 assert.deepEqual(run.loadouts.knibbs,['shot','focus','loadburst']);
 assert.ok(!skillAccessFor(run).knibbs.includes('cover'));
 win(run);assert.deepEqual(run.loadouts.knibbs,['shot','focus','loadburst','cover']);
 win(run);chooseCompanion(run,'ric');
 assert.equal(SKILL_SLOTS,4);assert.equal(skillAccessFor(run).knibbs.length,7);assert.equal(run.loadouts.knibbs.length,4);
 assert.equal(skillAccessFor(run).ric.length,4);assert.equal(run.loadouts.ric.length,4);
 assert.equal(equipSkill(run,'knibbs',3,'scatter').ok,true);assert.equal(run.loadouts.knibbs[3],'scatter');
 assert.equal(equipSkill(run,'knibbs',4,'cover').ok,false);
 const markup=campaignView(run);assert.match(markup,/已携带 4 项 · 最多 4 项/);assert.doesNotMatch(markup,/data-loadout-slot="4"|<kbd>T<\/kbd>/);
});

test('old five-command battle saves retain their first four chosen commands and all learned rewards',()=>{
 const battle=createBattle('standard','duelist',{upgrades:['knibbs_ricochet']});
 for(const hero of HEROES)battle.loadouts[hero.id]=SKILLS[hero.id].filter(s=>!s.unlockKey).slice(0,5).map(s=>s.id);
 battle.loadouts.knibbs=['cover','breathe','focus','shot','ricochet'];
 battle.heroes[0].hp-=11;battle.ap=2;battle.elapsed=19;
 const restored=normalizeSave(structuredClone(battle));assert.ok(restored);
 assert.deepEqual(restored.loadouts.knibbs,['cover','breathe','focus','shot']);
 assert.deepEqual(restored.upgrades,['knibbs_ricochet']);assert.equal(restored.heroes[0].hp,battle.heroes[0].hp);assert.equal(restored.ap,2);assert.equal(restored.elapsed,19);
 for(const hero of HEROES)assert.equal(restored.loadouts[hero.id].length,4);
});

test('existing opening tutorial saves retain the old recovery skill and gain the missing attack without restarting',()=>{
 const old=createRun();delete old.learningRevision;
 old.loadouts.knibbs=['shot','breathe'];advanceDialogue(old,true);
 old.battle=battleForRun(old);old.battle.skillAccess.knibbs=['shot','breathe'];old.battle.loadouts.knibbs=['shot','breathe'];
 old.battle.heroes[0].hp-=8;old.battle.ap=2;old.battle.elapsed=12;
 const restored=normalizeRun(structuredClone(old));assert.ok(restored);assert.equal(restored.phase,'battle');
 assert.equal(restored.learningRevision,4);for(const id of ['shot','focus','breathe','loadburst'])assert.ok(skillAccessFor(restored).knibbs.includes(id));
 assert.deepEqual(restored.loadouts.knibbs,['shot','breathe','focus','loadburst']);assert.equal(restored.battle.heroes[0].hp,old.battle.heroes[0].hp);assert.equal(restored.battle.ap,2);assert.equal(restored.battle.elapsed,12);
 assert.deepEqual(normalizeRun(structuredClone(restored)),restored,'migration is stable on the next load');
});

test('dragging accepts the fourth command and refuses the removed fifth slot',()=>{
 const events={},drops=[],classes={add(){},remove(){}},root={addEventListener(type,fn){events[type]=fn;},querySelectorAll(){return [];},defaultView:{addEventListener(){}}};
 createSkillDragController({enabled:()=>true,onDrop:item=>drops.push(item)},root);
 const source={dataset:{dragOwner:'knibbs',dragSkill:'focus'},classList:classes,getAttribute(){return null;}};
 const event=element=>({target:{closest(){return element;}},preventDefault(){},dataTransfer:{setData(){}}});
 const slot=index=>({dataset:{dragOwner:'knibbs',dragSlot:String(index)},classList:classes});
 events.dragstart(event(source));events.drop(event(slot(3)));assert.deepEqual(drops,[{owner:'knibbs',skill:'focus',slot:3}]);
 events.dragstart(event(source));events.drop(event(slot(4)));assert.equal(drops.length,1);
});
