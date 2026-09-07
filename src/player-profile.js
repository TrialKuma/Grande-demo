import {HEROES} from './combat.js';
import {STARTING_HEROES,earnedCompanions} from './roster-unlocks.js';

export {STARTING_HEROES};

export function normalizeProfile(value){
  const known=new Set(HEROES.map(hero=>hero.id));
  const gmAllHeroes=value?.gmAllHeroes===true;
  const hasNatural=Array.isArray(value?.naturalHeroes);
  const previous=hasNatural?value.naturalHeroes:gmAllHeroes?[]:Array.isArray(value?.unlockedHeroes)?value.unlockedHeroes:[];
  const naturalHeroes=[...new Set([...STARTING_HEROES,...previous.filter(id=>known.has(id))])];
  const gmLegacyRecovery=value?.gmLegacyRecovery===true||gmAllHeroes&&!hasNatural;
  return {version:2,naturalHeroes,unlockedHeroes:gmAllHeroes?[...known]:[...naturalHeroes],...(gmAllHeroes?{gmAllHeroes:true}:{}),...(gmLegacyRecovery?{gmLegacyRecovery:true}:{})};
}

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
