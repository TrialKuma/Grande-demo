// A bounded look-ahead policy for checking learned-skill parties. Every committed
// move calls a public combat action; search only runs on isolated state copies.
import {activeSkills,canUse,skillPreview,useSkill,usePotion,endRound,enemyTargets} from '../src/combat.js';
import {normalizeSave} from '../src/save.js';

function choices(s){
 const result=enemyTargets(s).flatMap(e=>s.heroes.flatMap(h=>activeSkills(s,h.id).filter(k=>!canUse(s,h.id,k.id,e.id)).map(k=>['skill',h.id,k.id,e.id])));
 if(s.ap&&s.potions)for(const h of s.heroes)if(h.hp<h.maxHp)result.push(['potion',h.id]);
 return result;
}
function apply(s,[kind,id,skill,target]){return kind==='skill'?useSkill(s,id,skill,target):kind==='potion'?usePotion(s,id):endRound(s);}
function score(s){
 if(s.mode==='victory')return 1e6;
 if(s.mode==='defeat')return -1e6;
 const b=s.boss,health=s.heroes.reduce((n,h)=>{const r=h.hp/h.maxHp;return n+r*26-Math.pow(1-r,3)*25-(h.hp<=0?60:0)+h.shield*.13+(h.resourceName==='魔力'?(h.secondary||0)*(h.id==='qianxing'?5:h.id==='haart'?3:1.5):h.resourceName==='平衡'?h.ricEdge*1.5:h.resource*.35)+(h.attackBuff||0)*.05;},0);
 const adds=(s.enemies||[]).filter(e=>e.unitId!=='boss').reduce((n,e)=>n+(1-e.hp/e.maxHp)*30+(e.defeated?20:0),0);
 return adds+(1-b.hp/b.maxHp)*170+health+s.potions*3+(1-b.stagger/b.maxStagger)*10+(b.hardControl?5:0)+(b.vulnerable?3:0)+(b.core?50+(b.corePhysical+b.coreMagic)*14:0)+(b.finale?50+(b.finalePhysical+b.finaleMagic)*20:0)-b.reforms*40;
}
const rank=(s,plan)=>score(s)-(s.mode==='victory'?plan.length*.01:0);
function signature(s){const {log,stats,serial,...mechanics}=s;return JSON.stringify(mechanics);}
export function choosePartyTurn(state,width=10){
 let beam=[{state:structuredClone(state),plan:[]}],best=null;
 for(let depth=0;depth<=state.maxAp;depth++){
  const next=[],seen=new Set();
  for(const node of beam){
   const settled=structuredClone(node.state);if(settled.mode==='playing')endRound(settled);
   const value=rank(settled,node.plan);if(!best||value>best.score)best={score:value,plan:[...node.plan,...(node.state.mode==='playing'?[['end']]:[])]};
   if(node.state.mode!=='playing'||depth===state.maxAp)continue;
   for(const action of choices(node.state)){
    const candidate=structuredClone(node.state);const result=apply(candidate,action);if(!result.ok)throw new Error(result.error);
    const key=signature(candidate);if(seen.has(key))continue;seen.add(key);
    const future=structuredClone(candidate);if(future.mode==='playing')endRound(future);
    next.push({state:candidate,plan:[...node.plan,action],score:rank(future,[...node.plan,action])});
   }
  }
  beam=next.sort((a,b)=>b.score-a.score).slice(0,width);if(!beam.length)break;
 }
 return best;
}
export function runConfiguredParty(initial,{width=10,roundLimit=35}={}){
 const state=structuredClone(initial),actions=[];
 while(state.mode==='playing'&&state.round<=roundLimit){
  const plan=choosePartyTurn(state,width).plan;
  for(const action of plan){
   const round=state.round;
   const result=apply(state,action);if(!result.ok)throw new Error(result.error);
   actions.push(`R${round} ${action.join('/')}`);
   if(state.mode==='playing'&&!normalizeSave(state))throw new Error('Unsavable committed party action: '+action.join('/'));
   if(state.mode!=='playing')break;
  }
 }
 return {result:state.mode,round:state.round,hp:state.heroes.map(h=>h.hp),potions:3-state.potions,bossHp:state.boss.hp,state,actions};
}
