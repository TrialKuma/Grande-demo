// Reproducible bounded searches. Only public operations commit battle actions;
// no victory, HP, AP, resource or enemy intent is edited by the probe.
import fs from 'node:fs';
import {HEROES,BOSSES,createBattle} from '../src/combat.js';
import {LEARNING_ORDER} from '../src/training.js';
import {runSolo} from './solo-probe.mjs';
import {runConfiguredParty} from './party-probe.mjs';

const formal=Object.values(BOSSES).filter(b=>!b.isTutorial&&!b.isSkirmish&&!b.isMinion).map(b=>b.id);
const rows=[];
for(const hero of HEROES)for(const boss of formal){
 const r=runSolo(hero.id,boss);rows.push({category:'solo',...r});
}
console.log('solo',rows.length,rows.filter(r=>r.result==='victory').length);
const others=HEROES.map(h=>h.id).filter(id=>id!=='knibbs');
const learned=party=>Object.fromEntries(HEROES.map(h=>[h.id,party.includes(h.id)?LEARNING_ORDER[h.id].slice(0,h.id==='knibbs'?5:4):[]]));
for(const difficulty of ['story','standard'])for(const first of others)for(const second of others){
 if(first===second)continue;
 const party=['knibbs',first,second],initial=createBattle(difficulty,'duelist',{partyIds:party,skillAccess:learned(party)});
 let width=5,r=runConfiguredParty(initial,{width});
 if(r.result!=='victory'){width=12;r=runConfiguredParty(initial,{width});}
 const {state,...result}=r;rows.push({category:'first-boss-four-skills',party,difficulty,boss:'duelist',width,...result});
}
console.log('first boss',rows.filter(r=>r.category==='first-boss-four-skills').length,rows.filter(r=>r.category==='first-boss-four-skills'&&r.result==='victory').length);
for(let a=0;a<others.length;a++)for(let b=a+1;b<others.length;b++)for(const boss of ['patrol','relay_guard']){
 const party=['knibbs',others[a],others[b]],initial=createBattle('standard',boss,{partyIds:party,skillAccess:learned(party)});
 let width=5,r=runConfiguredParty(initial,{width});
 if(r.result!=='victory'){width=12;r=runConfiguredParty(initial,{width});}
 const {state,...result}=r;rows.push({category:'skirmish-four-skills',party,boss,difficulty:'standard',width,...result});
}
const report={version:'3.9',method:'Bounded public-action search; no direct battle mutations, no upgrades, three starting potions; solo full five base skills; party companions limited to four learned skills. Search confirms existence of wins, not ease of play.',battles:rows.length,wins:rows.filter(r=>r.result==='victory').length,results:rows};
fs.writeFileSync(new URL('../docs/3.9-combat-verification.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(report.battles,report.wins);if(report.battles!==report.wins)process.exitCode=1;
