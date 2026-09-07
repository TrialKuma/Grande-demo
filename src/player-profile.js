import {HEROES,BOSSES} from './combat.js';
import {STARTING_HEROES,earnedCompanions} from './roster-unlocks.js';

export {STARTING_HEROES};

export function normalizeProfile(value){
  const known=new Set(HEROES.map(hero=>hero.id));
  const gmAllHeroes=value?.gmAllHeroes===true;
  const hasNatural=Array.isArray(value?.naturalHeroes);
  const previous=hasNatural?value.naturalHeroes:gmAllHeroes?[]:Array.isArray(value?.unlockedHeroes)?value.unlockedHeroes:[];
  const naturalHeroes=[...new Set([...STARTING_HEROES,...previous.filter(id=>known.has(id))])];
  const gmLegacyRecovery=value?.gmLegacyRecovery===true||gmAllHeroes&&!hasNatural;
  const bossIds=Object.keys(BOSSES),gmAllBosses=value?.gmAllBosses===true;
  const defeatedBosses=bossIds.filter(id=>Array.isArray(value?.defeatedBosses)&&value.defeatedBosses.includes(id));
  return {version:3,naturalHeroes,unlockedHeroes:gmAllHeroes?[...known]:[...naturalHeroes],defeatedBosses,unlockedBosses:gmAllBosses?bossIds:[...defeatedBosses],...(gmAllHeroes?{gmAllHeroes:true}:{}),...(gmAllBosses?{gmAllBosses:true}:{}),...(gmLegacyRecovery?{gmLegacyRecovery:true}:{})};
}

// Legacy battle records only contained victories; newer explicit result fields
// are checked as well. A selected encounter or an unfinished battle is no win.
const wonEncounter=entry=>entry&&typeof entry==='object'&&typeof entry.bossId==='string'&&Object.hasOwn(BOSSES,entry.bossId)&&Number.isInteger(entry.round)&&entry.round>0&&entry.round<=9999&&(entry.result===undefined||entry.result==='victory')&&(entry.mode===undefined||entry.mode==='victory');
export function rememberBossVictories(profile,run,records=[]){
  const remembered=normalizeProfile(profile);
  const wins=[...(Array.isArray(run?.history)?run.history:[]),...(Array.isArray(records)?records:[])].filter(wonEncounter).map(entry=>entry.bossId);
  return normalizeProfile({...remembered,defeatedBosses:[...remembered.defeatedBosses,...wins]});
}
export function unlockAllBosses(profile){return normalizeProfile({...normalizeProfile(profile),gmAllBosses:true});}
export function disableAllBosses(profile){return normalizeProfile({...normalizeProfile(profile),gmAllBosses:false});}
export function canChallengeBoss(profile,bossId){return typeof bossId==='string'&&normalizeProfile(profile).unlockedBosses.includes(bossId);}
export function normalizeChallengeBoss(profile,bossId){const available=normalizeProfile(profile).unlockedBosses;return available.includes(bossId)?bossId:available[0]||null;}

export function unlockAllHeroes(profile){
  return normalizeProfile({...normalizeProfile(profile),gmAllHeroes:true});
}

export function disableAllHeroes(profile,run){
  return normalizeProfile({...rememberCompanions(profile,run),gmAllHeroes:false});
}

export function rememberCompanions(profile,run){
  const remembered=normalizeProfile(profile);
  return normalizeProfile({...remembered,naturalHeroes:[...remembered.naturalHeroes,...earnedCompanions(run)]});
}

// Clicking controls, selecting text or dragging the camera must never skip a line.
export function isDialogueAdvanceGesture({screen,modal,busy,interactive,selectedText='',movement=0,button=0,detail=1}){
  return screen==='dialogue'&&!modal&&!busy&&!interactive&&!selectedText.trim()&&movement<8&&button===0&&detail<=1;
}
