// Reproduce the 3.7 balance checks with public player actions and write the
// configurations plus complete committed action logs for review.
// npm test > .v37-final-tests.log
// node scripts/verify-combat-v37.mjs --test-log=.v37-final-tests.log
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createBattle,activeSkills,canUse,useSkill,endRound,skillPreview,HEROES,BOSSES} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';
import {LEARNING_ORDER} from '../src/training.js';
import {runConfiguredParty} from './party-probe.mjs';
import {runSolo} from './solo-probe.mjs';
import {runPolicy} from './pressure-probe.mjs';

const repo=new URL('../',import.meta.url);
const sources=['src/combat.js','src/save.js','src/encounters.js','src/mana-cycles.js','src/expedition-heroes.js','src/action-points.js','src/training.js','scripts/party-probe.mjs','scripts/solo-probe.mjs','scripts/pressure-probe.mjs','scripts/verify-combat-v37.mjs'];
const sourceSha256=Object.fromEntries(await Promise.all(sources.map(async path=>[path,createHash('sha256').update(await readFile(new URL(path,repo))).digest('hex')])));
const assertAction=(state,result,action)=>{
 if(!result.ok)throw new Error(`${action}: ${result.error}`);
 if(state.mode==='playing'&&!normalizeSave(state))throw new Error(`Unsavable state after ${action}`);
};
const formalBosses=Object.keys(BOSSES).filter(id=>!BOSSES[id].isTutorial);
const summary=rows=>({cases:rows.length,victories:rows.filter(row=>row.result==='victory').length,maximumRounds:Math.max(...rows.map(row=>row.round))});
const lessons=[];
for(const difficulty of ['story','standard','challenge'])for(const [hero,order] of Object.entries(LEARNING_ORDER)){
 const boss=['haart','qianxing','patch'].includes(hero)?'conduit':'bulwark';
 const skillAccess={[hero]:order.slice(0,2)},state=createBattle(difficulty,boss,{partyIds:[hero],skillAccess}),actions=[];
 const commit=(name,action)=>{actions.push(`R${state.round} ${name}`);assertAction(state,action(),name);};
 while(state.mode==='playing'&&state.round<=10){
  let used=0;
  while(state.mode==='playing'){
   const choices=activeSkills(state,hero).filter(skill=>!canUse(state,hero,skill.id)).sort((a,b)=>skillPreview(state,hero,b.id).damage-skillPreview(state,hero,a.id).damage);
   if(!choices.length)break;
   commit(`skill/${hero}/${choices[0].id}`,()=>useSkill(state,hero,choices[0].id));
   if(++used>7)throw new Error('A lesson spent more actions than its available AP');
  }
  if(state.mode==='playing')commit('end',()=>endRound(state));
 }
 lessons.push({difficulty,hero,boss,skillAccess,mode:'party',baseAp:3,startingUpgrades:[],result:state.mode,round:state.round,hp:state.heroes[0].hp,potionsUsed:3-state.potions,actions});
}
console.log('Personal lessons:',summary(lessons));

const firstBoss=[];
const recruits=HEROES.map(hero=>hero.id).filter(id=>id!=='knibbs');
for(const difficulty of ['story','standard'])for(const first of recruits)for(const second of recruits.filter(id=>id!==first)){
 const partyIds=['knibbs',first,second],skillAccess={knibbs:LEARNING_ORDER.knibbs,[first]:LEARNING_ORDER[first].slice(0,4),[second]:LEARNING_ORDER[second].slice(0,2)};
 const initial=createBattle(difficulty,'duelist',{partyIds,skillAccess});
 const {state,...outcome}=runConfiguredParty(initial);
 firstBoss.push({difficulty,boss:'duelist',first,second,partyIds,skillAccess,startingUpgrades:[],optionalPracticeWins:0,searchWidth:10,...outcome});
}
console.log('First formal boss, every recruitment order:',summary(firstBoss));

const solo=HEROES.flatMap(hero=>formalBosses.map(boss=>runSolo(hero.id,boss)));
console.log('Standard solo, seven heroes and ten formal bosses:',summary(solo));
const fullParty=formalBosses.map(boss=>({...runPolicy(boss,'tactical','standard',{onState:state=>{if(state.mode==='playing'&&!normalizeSave(state))throw new Error(`Unsavable full-party state: ${boss}`);}}),difficulty:'standard',partyIds:['knibbs','apeilia','ric'],startingUpgrades:[],learnedSkills:'all base skills'}));
console.log('Standard full starting party:',summary(fullParty));

const testLogArg=process.argv.find(arg=>arg.startsWith('--test-log='))?.slice(11);
let automatedSuite=null;
if(testLogArg){
 const raw=await readFile(new URL(testLogArg,repo));
 const log=raw.toString(raw[0]===0xff&&raw[1]===0xfe?'utf16le':'utf8');
 const number=label=>Number(log.match(new RegExp(`^(?:ℹ|#)\\s+${label}\\s+(\\d+)`,'m'))?.[1]??NaN);
 automatedSuite={command:'npm test',tests:number('tests'),passed:number('pass'),failed:number('fail'),skipped:number('skipped'),logSha256:createHash('sha256').update(raw).digest('hex')};
 if(!Number.isFinite(automatedSuite.tests))throw new Error('Could not read the supplied test summary');
}
const report={
 version:'3.7',generatedAt:new Date().toISOString(),
 reproduce:['npm test > .v37-final-tests.log','node scripts/verify-combat-v37.mjs --test-log=.v37-final-tests.log'],
 method:'Only public useSkill/usePotion/endRound actions are committed. Every live committed state must pass save validation. Search explores isolated copies, never changes initial HP, AP, resources, upgrades, or learned skills. No generic guard or response is allowed. Action logs use zero cheats and do not imply that unassisted new players will choose the same sequence.',
 limits:'Automated tactical search checks that encounters are solvable under these configurations. It does not measure novice readability, preference, average player win rate, or prove that every loadout is equally strong. Story/standard first-boss cases start at full health with three normal potions and no growth cards or optional practice.',
 sourceSha256,automatedSuite,
 summary:{personalLessons:summary(lessons),firstFormalBoss:summary(firstBoss),standardSolo:summary(solo),standardFullParty:summary(fullParty)},
 personalLessons:lessons,firstFormalBoss:firstBoss,standardSolo:solo,standardFullParty:fullParty
};
const output=new URL('docs/3.7-combat-verification.json',repo);
await writeFile(output,JSON.stringify(report,null,2)+'\n');
console.log('Wrote',fileURLToPath(output));
if([...lessons,...firstBoss,...solo,...fullParty].some(row=>row.result!=='victory')||automatedSuite?.failed)process.exitCode=1;
