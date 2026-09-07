// Version 3 named two demo-only recruits. Keep earned chapters and choices when
// replacing them with characters from the supplied character sheets.
const heroes={lumen:'haart',voss:'qianxing'};
const skills={lumen:{needle:'page',ray:'relay',bloomheal:'soothe',veil:'rest',prism:'network'},voss:{cleave:'spike',eruption:'beam',bulwark:'armor',vent:'repair',furnace:'nova'}};
const rewards={lumen_prism:'haart_network',lumen_overflow:'haart_triage',lumen_refraction:'haart_echo',voss_furnace:'qianxing_nova',voss_temper:'qianxing_reinforce',voss_execution:'qianxing_focus'};
export const currentHero=id=>heroes[id]||id;
const currentSkill=(hero,id)=>skills[hero]?.[id]||id;
export function migrateRoster(value){
  const copy=structuredClone(value);
  for(const key of ['selected','focusHero'])if(copy[key])copy[key]=currentHero(copy[key]);
  for(const key of ['partyIds','unlockedHeroes'])if(Array.isArray(copy[key]))copy[key]=copy[key].map(currentHero);
  if(Array.isArray(copy.upgrades))copy.upgrades=copy.upgrades.map(id=>rewards[id]||id);
  if(copy.loadouts&&typeof copy.loadouts==='object')copy.loadouts=Object.fromEntries(Object.entries(copy.loadouts).map(([hero,ids])=>[currentHero(hero),Array.isArray(ids)?ids.map(id=>currentSkill(hero,id)):ids]));
  if(Array.isArray(copy.heroes))copy.heroes=copy.heroes.map(hero=>{
    if(!hero||!heroes[hero.id])return hero;
    const old=hero.id;
    // A different casting loop cannot meaningfully preserve heat/prism charges.
    // Validate the old bound before granting the replacement's initial mana.
    const resource=Number.isInteger(hero.resource)&&hero.resource>=0&&hero.resource<=(old==='lumen'?5:6)?10:NaN;
    const hp=old==='voss'?(Number.isInteger(hero.hp)&&hero.hp>=0&&hero.hp<=205?Math.round(hero.hp/205*195):NaN):hero.hp;
    return {...hero,id:currentHero(old),hp,resource,reflect:0,used:Array.isArray(hero.used)?hero.used.map(id=>currentSkill(old,id)):hero.used,cooldowns:hero.cooldowns&&Object.fromEntries(Object.entries(hero.cooldowns).map(([id,n])=>[currentSkill(old,id),n]))};
  });
  if(copy.boss)copy.boss.intentTarget=currentHero(copy.boss.intentTarget);
  if(copy.response)copy.response.actor=currentHero(copy.response.actor);
  if(copy.lastReward){
    const old=copy.lastReward.id?.startsWith('lumen_')?'lumen':copy.lastReward.id?.startsWith('voss_')?'voss':null;
    copy.lastReward={...copy.lastReward,id:rewards[copy.lastReward.id]||copy.lastReward.id,replaced:currentSkill(old,copy.lastReward.replaced)};
  }
  if(Array.isArray(copy.history))copy.history=copy.history.map(h=>h&&({...h,partyIds:Array.isArray(h.partyIds)?h.partyIds.map(currentHero):h.partyIds}));
  return copy;
}
