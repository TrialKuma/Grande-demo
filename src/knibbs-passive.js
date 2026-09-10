// Source: 尼布斯拉姆.xlsx / 尼布斯拉姆-气息.
// A12:A15: one loaded special round; actual follow-up actions restore 1 breath.
// A20:A24: loading grants intuition, spent on a counter or the next damaging hit.
// A29:A30: intuition hits/counters mark their target. Damage scaling belongs to combat.
export const KNIBBS_AMMO = Object.freeze({
  normal: Object.freeze({id:'normal',name:'普通弹',cost:0,extraHits:0,kind:'physical'}),
  blast: Object.freeze({id:'blast',name:'聚爆弹',cost:6,extraHits:1,extraDamage:36,kind:'physical'}),
  scatter: Object.freeze({id:'scatter',name:'扩散弹',cost:6,extraHits:5,extraDamage:8,kind:'physical'}),
  breach: Object.freeze({id:'breach',name:'破虚弹',cost:4,extraHits:0,kind:'physical',stripBuffs:1,refundOnDispel:4,markOnDispel:true})
});

export const knibbsPassiveDefaults = () => ({ammo:'normal',followupReady:false,followupUsed:[],specialSpent:false});
export const ammoProfile = id => Object.hasOwn(KNIBBS_AMMO,id)?KNIBBS_AMMO[id]:KNIBBS_AMMO.normal;
export const intuitionFromLoading = cost => Math.floor(Math.max(0,Number.isFinite(cost)?cost:0)/2);

const intuitionOf = hero => Math.max(0,Math.min(3,Math.trunc(Number.isFinite(hero.intuition)?hero.intuition:0)));
const usedOf = hero => Array.isArray(hero.followupUsed)?hero.followupUsed.filter(id=>['load','shot','reload'].includes(id)):[];
const refundResource = (hero,cost,gain) => Math.min(hero.maxResource||10,hero.resource-cost+gain);
const fail = error => ({ok:false,error});
const validBreath = hero => Number.isFinite(hero.resource)&&hero.resource>=0;
const canFollow = (hero,action) => hero.followupReady===true&&!usedOf(hero).includes(action);

// Plans never mutate the hero. Apply `changes` only after the corresponding action succeeds.
// `gain` is nominal (not capped by current breath), matching resource-cost UI conventions.
export function loadAmmoPlan(hero,type,{quick=false}={}) {
  const ammo=KNIBBS_AMMO[type];
  if(!ammo||type==='normal')return fail('请选择一种特殊子弹');
  if(!validBreath(hero)||hero.resource<ammo.cost)return fail('气息不足');
  // The demo also permits breach in this window; the source only names quick blast/scatter.
  if(quick&&!canFollow(hero,'load'))return fail('没有可用的快速装填机会');
  const gain=quick?1:0,intuitionGain=intuitionFromLoading(ammo.cost),before=intuitionOf(hero);
  return {ok:true,ap:quick?0:2,cost:ammo.cost,gain,intuitionGain,intuitionSpent:0,
    ammoEffect:ammo,changes:{ammo:type,resource:refundResource(hero,ammo.cost,gain),intuition:Math.min(3,before+intuitionGain),specialSpent:false,
      ...(quick?{followupUsed:[...usedOf(hero),'load']}:{})}};
}

// The original sheet does not state follow-up repetition limits. The demo permits each
// follow-up once per successful confirmation, preserving quick-load -> quick-shot -> reload
// without an indefinitely repeatable zero-AP load. The caller closes the window each round.
export function shotPassivePlan(hero,{quick=false,confirm=false}={}) {
  if(!validBreath(hero))return fail('气息状态无效');
  if(quick&&confirm)return fail('单发确认不能同时作为快速发射');
  if(quick&&!canFollow(hero,'shot'))return fail('没有可用的快速发射机会');
  const ammo=ammoProfile(hero.ammo),layers=intuitionOf(hero),gain=quick?1:0;
  return {ok:true,gain,cost:0,intuitionGain:0,intuitionSpent:layers,mark:layers>0,ammoEffect:ammo,
    changes:{ammo:'normal',intuition:0,resource:refundResource(hero,0,gain),specialSpent:ammo.id!=='normal'||!!hero.specialSpent,
      ...(quick?{followupUsed:[...usedOf(hero),'shot']}:{}) ,
      ...(confirm?{followupReady:true,followupUsed:[]}:{})}};
}

// Counter AP and damage are deliberately unspecified: A21 gives its three-layer cost,
// but does not define an AP price, counter damage, or guaranteed interruption strength.
export function counterPassivePlan(hero) {
  if(intuitionOf(hero)<3)return fail('直感不足 3 层');
  return {ok:true,cost:0,gain:0,intuitionGain:0,intuitionSpent:3,mark:true,changes:{intuition:0}};
}

// P12:P15 explicitly gates this additional action behind firing a special round.
export function reloadAmmoPlan(hero) {
  if(!validBreath(hero))return fail('气息状态无效');
  if(!hero.specialSpent)return fail('尚未发射特殊子弹');
  if(usedOf(hero).includes('reload'))return fail('本次追加已经重装填');
  return {ok:true,ap:1,cost:0,gain:1,intuitionGain:0,intuitionSpent:0,
    changes:{ammo:'normal',specialSpent:false,resource:refundResource(hero,0,1),followupUsed:[...usedOf(hero),'reload']}};
}

export const endKnibbsFollowup = () => ({followupReady:false,followupUsed:[]});

export function migrateKnibbsPreset(loadouts) {
  const result=structuredClone(loadouts||{});
  if(JSON.stringify(result.knibbs)===JSON.stringify(['shot','focus','breathe','cover']))result.knibbs=['shot','focus','loadburst','cover'];
  return result;
}
