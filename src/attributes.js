import {ricDomainEffects} from './ric-passive.js';
// Source-sheet values are reference metadata, never hidden combat bonuses.
export const ATTRIBUTE_NAMES={strength:'力量',intelligence:'智力',agility:'敏捷',will:'意志'};
const stats=(strength,intelligence,agility,will)=>({strength,intelligence,agility,will});
export const HERO_ATTRIBUTES={knibbs:stats(8,3,9,8),apeilia:stats(9,8,9,6),ric:stats(4,8,8,8),haart:stats(8,3,9,8),qianxing:stats(6,9,6,9),youmu:stats(5,9,7,10),patch:stats(6,10,4,8)};
export const ENEMY_ATTRIBUTES={scout:stats(2,2,0,2),bulwark:stats(4,2,2,3),conduit:stats(2,4,1,4),patrol:stats(5,3,3,4),relay_guard:stats(3,5,2,5),escort:stats(7,3,7,5),drone:stats(6,3,2,4),sporeling:stats(2,5,1,3),relay:stats(2,7,3,5),golem:stats(12,9,9,10),duelist:stats(12,5,12,8),cantor:stats(5,12,4,10),warden:stats(12,11,9,10),weaver:stats(6,13,5,12),tide:stats(13,10,8,10),furnace:stats(15,8,10,9),orrery:stats(7,14,7,13),arbiter:stats(12,12,8,14),final:stats(14,15,10,15)};
export function baseAttributes(id,form){return {...(id==='youmu'&&form==='captain'?stats(10,4,4,8):HERO_ATTRIBUTES[id]||ENEMY_ATTRIBUTES[id]||stats(0,0,0,0))};}
export function attributeEffects(unit,state){
 const effects=[],add=(id,label,values,turns=1,charges)=>effects.push({id,label,stats:values,turns,...(charges?{charges}:{}),tone:Object.values(values).some(n=>n<0)?'warning':'good'});
 const protection=Math.max(unit.guard?55:0,unit.protection||0);
 if(protection)add('protection','防护姿态',{agility:Math.round(protection*.36),intelligence:Math.round(protection*.24),will:Math.round(protection*.18)},1);
 if(unit.attackBuff>0)add('attackBuff','战术增幅',{strength:Math.ceil(unit.attackBuff/3),intelligence:Math.ceil(unit.attackBuff/3)},unit.attackBuffTurns||2,1);
 if(unit.youmuForm==='captain')add('captain','船长架势',{strength:5,intelligence:-5,agility:9,will:2},unit.captainTurns||2);
 if(unit.exhaustedTurns>0)add('exhaustion','虚脱',{strength:-4,intelligence:-4,agility:-4},unit.exhaustedTurns);
 if(unit.weakened)add('weakened','进攻受扰',{strength:-8,intelligence:-8,will:-4},1);
 if(unit.vulnerable)add('vulnerable','破绽暴露',{agility:-8,intelligence:-8},unit.vulnerable);
 if(unit.healSuppression)add('healSuppression','意志裂隙',{will:-5},unit.healSuppression);
 if(unit.actionSuppression>0&&unit.actionSuppression<1)add('intercept','截击压制',{strength:-18,intelligence:-18},1);
 else if(unit.cover)add('intercept','预备截击',{strength:-18,intelligence:-18},1);
 if(unit.confusion)add('confusion','心智扰乱',{strength:-16,intelligence:-16},1);
 if(unit.recordedIntent)add('recordedIntent','预告封录',{strength:-8,intelligence:-8},1);
 if(unit.id==='golem'&&!unit.core)add('rock','岩晶外壳',{intelligence:4},99);
 if(unit.id==='duelist'&&unit.mirror)add('mirror','镜甲',{agility:unit.mirror*3},99);
 if(unit.id==='cantor')add('spores',unit.spores>=3?'厚孢冠':unit.spores===0?'裸冠':'薄孢冠',{intelligence:unit.spores>=3?6:unit.spores===0?-4:0},99);
 if(unit.id==='weaver'&&unit.seals)add('seals','封页',{[unit.sealedKind==='physical'?'agility':'intelligence']:unit.seals*4},99);
 if(unit.id==='final'&&unit.seals&&!unit.finale)add('barrier','归零屏障',{agility:unit.seals*3,intelligence:unit.seals*3},99);
 if(unit.id==='furnace'&&unit.furnaceOpen)add('furnaceOpen','炉门敞口',{agility:-8,intelligence:-8},1);
 for(const effect of unit.attributeBuffs||[])if(effect.turns>0)effects.push({...effect,tone:effect.tone|| (Object.values(effect.stats||{}).some(n=>n<0)?'warning':'good')});
 effects.push(...ricDomainEffects(state||{heroes:unit.id==='ric'?[unit]:[],boss:null},unit));
 return effects;
}
export function effectiveAttributes(unit,state){
 const base=stats(0,0,0,0);
 for(const effect of attributeEffects(unit,state))for(const key of Object.keys(ATTRIBUTE_NAMES))base[key]+=(effect.stats?.[key]||0);
 for(const key of Object.keys(base))base[key]=Math.round(base[key]);
 return base;
}
export const attackAttribute=(unit,kind,state)=>effectiveAttributes(unit,state)[kind==='magic'?'intelligence':'strength'];
export const defenseAttribute=(unit,kind,state)=>effectiveAttributes(unit,state)[kind==='magic'?'intelligence':'agility'];
export function addAttributeEffect(unit,effect){
 unit.attributeBuffs||=[];
 unit.attributeBuffs=unit.attributeBuffs.filter(item=>item.id!==effect.id);
 unit.attributeBuffs.push({...effect,stats:{...effect.stats}});
}
export function ageAttributeEffects(unit){unit.attributeBuffs=(unit.attributeBuffs||[]).map(effect=>({...effect,turns:effect.turns-1})).filter(effect=>effect.turns>0);}
export const controlResistance=(target,power=12,state)=>Math.max(5,Math.min(95,Math.round(30+effectiveAttributes(target,state).will*5-(power-12)*2.5)))/100;
function nextD100(state){let seed=(state.rngState||0x9e3779b9)>>>0;seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;state.rngState=seed>>>0;return state.rngState%100+1;}
export function attemptControl(state,target,{type='stun',power=12,source='boss',label='眩晕'}={}){
 if(target.controlGuard>0||target.controlImmune>0||target.control)return {success:false,immune:true,roll:null,resistance:1};
 const resistance=controlResistance(target,power,state),roll=nextD100(state),success=roll>Math.round(resistance*100);
 if(success)target.control={type,turns:1,source,label,fresh:true};
 return {success,roll,resistance};
}
export function controlError(hero,skill){
 if(!hero.control)return '';
 if(hero.control.type==='stun')return '眩晕：本回合无法使用技能；药剂可以解除';
 if(hero.control.type==='silence'&&skill.kind==='magic')return '封术：本回合无法施放魔法攻击；仍可使用物理与辅助技能';
 return '';
}
export function ageControl(hero){
 if(hero.control?.fresh){hero.control.fresh=false;return;}
 if(hero.control){hero.control=null;hero.controlGuard=1;return;}
 hero.controlGuard=Math.max(0,(hero.controlGuard||0)-1);
}
export function clearControl(hero){if(hero.control){hero.control=null;hero.controlGuard=1;}}
