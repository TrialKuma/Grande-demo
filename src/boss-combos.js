/** Read-only additions to the announced enemy action.
 * Capture this plan before resolving the main attack or consuming its layers.
 * Damage values are base, per hit, and use the same attribute/defense pipeline
 * as the main attack. The resolver must cancel remaining steps if the source
 * dies, is stopped, opens its core, or redirects its attack to another enemy.
 */
export const COMBO_MARKS = {
 mirror_cut:{label:'刃痕',stats:{agility:-4}},
 spore_scent:{label:'孢香',stats:{intelligence:-3,will:-3}},
 conductive_brand:{label:'导电烙印',stats:{will:-4}},
 written_name:{label:'被写入的名字',stats:{intelligence:-3,will:-3}},
 scalded_armor:{label:'热蚀',stats:{agility:-4}},
 charted_soul:{label:'星图坐标',stats:{will:-4}},
 listed_offender:{label:'判罚签名',stats:{agility:-3,will:-3}},
 zero_exposure:{label:'零域裂隙',stats:{intelligence:-4}},
};

const livingHeroes=state=>(state.heroes||[]).filter(hero=>hero.hp>0);
const name=hero=>hero?.youmuForm==='captain'?'游墓':hero?.short||hero?.name||hero?.id||'目标';
const stacks=(boss,key)=>Math.max(0,Number(boss[key])||0);
const marked=(hero,id)=>hero?.attributeBuffs?.some(effect=>effect.id===id&&effect.turns>0);
const enemyId=enemy=>enemy.unitId||'boss';
const aliveEnemy=enemy=>enemy&&!enemy.defeated&&(enemy.hp===undefined||enemy.hp>0);

export function comboPlan(state,boss=state?.boss,spec={}){
 const key=spec.key||boss?.intent||'',plan={id:`${boss?.id||'unknown'}:${key}`,hint:'',after:[]};
 if(!state||!boss)return plan;
 const heroes=livingHeroes(state);
 if(!heroes.length)return plan;
 const target=heroes.find(hero=>hero.tauntTurns>0)||heroes.find(hero=>hero.id===boss.intentTarget)||heroes[0];
 const markedTarget=id=>heroes.find(hero=>marked(hero,id));
 const present=id=>(state.enemies||[boss]).some(enemy=>aliveEnemy(enemy)&&enemy.id===id&&!enemy.pendingSpawn&&!enemy.broken&&!enemy.hardControl);
 const notes=[];
 const add=(step,recipients)=>{
  const targets=(recipients||[]).filter(Boolean).map(hero=>hero.id);
  if(targets.length)plan.after.push({...step,target:recipients===heroes?'all':'single',targets});
 };
 const attack=(label,damage,kind,recipients,style='shot')=>add({type:'attack',label,damage,kind,hits:1,style},recipients);
 const debuff=(id,recipients,values,turns=3,label)=>{
  const definition=COMBO_MARKS[id];
  add({type:'debuff',label:label||definition?.label||id,effect:{id,label:label||definition?.label||id,stats:{...(values||definition?.stats)},turns,cleansable:true}},recipients);
 };
 const control=(type,label,recipient,power=10)=>{
  if(!recipient||recipient.control||recipient.controlGuard>0)return false;
  add({type:'control',label,control:{type,power,label}},[recipient]);return true;
 };
 const blocked=boss.defeated||boss.core||boss.finale||boss.broken||boss.hardControl;
 const recorded=boss.recordedIntent?.intent===key;
 const redirected=boss.confusion&&!spec.group&&(state.enemies||[boss]).some(enemy=>aliveEnemy(enemy)&&enemyId(enemy)!==enemyId(boss));
 if(blocked||recorded||redirected){
  if(recorded)plan.hint='预告已被收录，附加追击、属性压制与控制全部取消。';
  else if(redirected)plan.hint='攻击已转向其他敌人，不再对队伍发动连招。';
  return plan;
 }

 switch(boss.id){
  case 'golem':{
   if(key==='fog'){
    debuff('crystal_murmur',heroes,{will:-3},2,'晶体低鸣');
    notes.push('迷雾附加意志 −3；共鸣至少 3 层且迷雾至少 2 层时，后续魔力压缩会尝试眩晕一人。净化共鸣或用魔法驱散迷雾可截断。');
   }
   if(key==='compression'){
    const resonanceTarget=heroes.filter(hero=>hero.resonance>=3).sort((a,b)=>b.resonance-a.resonance)[0];
    if(stacks(boss,'fog')>=2&&resonanceTarget){
     if(control('stun','共鸣失衡',resonanceTarget,10))notes.push(`压缩结束后尝试眩晕${name(resonanceTarget)}，可用意志抵抗。`);
    }
    notes.push('眩晕条件：迷雾至少 2 层且有人共鸣至少 3 层；驱雾、净共鸣或打断可取消。');
   }
   if(stacks(boss,'stage')>=1){
    const followTarget=heroes[(state.round||0)%heroes.length];
    attack('碎岩飞弹',12,'physical',[followTarget]);
    notes.push(`躯壳解体后追加飞弹：${name(followTarget)}，12 基础物理伤害。`);
   }
   if(stacks(boss,'stage')>=3){attack('真空波',9,'magic',heroes,'rune');notes.push('深度解体后再追加全体真空波，9 基础魔法伤害。');}
   break;
  }
  case 'duelist':{
   if(key==='rend'){
    debuff('mirror_cut',[target]);
    notes.push(`裂锋在${name(target)}身上留下刃痕（敏捷 −4）；下次折镜架势会沿刃痕追击。净化刃痕或把镜片拆至不足 2 面可截断。`);
   }
   if(key==='mirror'){
    const victim=markedTarget('mirror_cut');
    if(stacks(boss,'mirror')>=2&&victim){attack('循痕返刃',8,'physical',[victim],'slash');notes.push(`循痕返刃追击${name(victim)}，8 基础物理伤害。`);}
    notes.push('追击需要至少 2 面镜片和刃痕；魔法拆镜或净化刃痕可以取消。');
   }
   break;
  }
  case 'cantor':{
   if(key==='sow'){
    debuff('spore_scent',[target]);
    notes.push(`孢香锁定${name(target)}（智力、意志各 −3），延续至冠孢绽放。孢压至少 3 且有可行动菌簇时会追击；物理剥孢、清除菌簇或净化孢香均可截断。`);
   }
   if(key==='drain')notes.push('抽髓后接冠孢绽放；本轮可提前剥孢、处理菌簇或净化孢香。');
   if(key==='bloom'){
    const victim=markedTarget('spore_scent');
    if(stacks(boss,'spores')>=3&&present('sporeling')&&victim){attack('菌丝牵引',6,'magic',[victim],'mist');notes.push(`菌丝牵引追击${name(victim)}，6 基础魔法伤害。`);}
    notes.push('追击需要至少 3 孢压、可行动菌簇和孢香；三个条件任一消失即可取消。');
   }
   break;
  }
  case 'warden':{
   if(key==='arc'&&stacks(boss,'charge')>=2){
    debuff('conductive_brand',[target]);
    notes.push(`至少 2 蓄电，雷链留下导电烙印：${name(target)}意志 −4；下一次接地冲击可能使其眩晕。物理泄能或净化烙印可截断。`);
   }else if(key==='arc')notes.push('蓄电不足 2，雷链不会留下导电烙印。');
   if(key==='ground'){
    const victim=markedTarget('conductive_brand');
    if(stacks(boss,'charge')>=3&&victim&&control('stun','接地麻痹',victim,10))notes.push(`接地结束后尝试眩晕${name(victim)}，可用意志抵抗。`);
    notes.push('眩晕需要至少 3 蓄电和导电烙印；泄能、净化烙印或破坏中继器使守卫停机可取消。');
   }
   if(key==='storm'){
    if(stacks(boss,'charge')>=3&&present('relay')){attack('回路余弧',6,'magic',[target],'shot');notes.push(`中继器追加余弧：${name(target)}，6 基础魔法伤害。`);}
    notes.push('余弧需要至少 3 蓄电和可行动中继器；物理泄能、控制或破坏中继器可取消。');
   }
   break;
  }
  case 'weaver':{
   if(key==='script'){
    debuff('written_name',[target]);
    notes.push(`刻入${name(target)}的名字（智力、意志各 −3），下一次资源封缄可能封住其魔法攻击。净化名字或异系拆页可截断。`);
   }
   if(key==='silence'){
    const victim=markedTarget('written_name');
    if(stacks(boss,'seals')>=2&&victim&&control('silence','名字封缄',victim,11))notes.push(`尝试封术${name(victim)}，可用意志抵抗；物理与辅助技能仍可用。`);
    notes.push('封术需要至少 2 封页和被写入的名字；异系拆至不足 2 页、净化名字或打断可取消。');
   }
   break;
  }
  case 'tide':{
   if(key==='tide_fill'){
    debuff('undertow',heroes,{agility:-3},2,'暗流拖拽');
    notes.push('开闸后的暗流使全队敏捷 −3；下一次破堤前有一轮排水窗口。三次命中排水一级，驱散也能排水。');
   }
   if(key==='tide_breaker'){
    if(stacks(boss,'waterLevel')>=3){attack('回卷重锚',8,'physical',[target],'slash');notes.push(`破堤后重锚回卷：${name(target)}，8 基础物理伤害。`);}
    notes.push('回卷只在出手前水位至少 3 时发生；将水位降到 2 以下可取消，破堤后水位仍会清空。');
   }
   break;
  }
  case 'furnace':{
   if(key==='furnace_vent'){
    if(stacks(boss,'heat')>=3){debuff('scalded_armor',[target]);notes.push(`高热蒸汽留下热蚀：${name(target)}敏捷 −4；下一次落锤可能溅出熔渣。`);}
    notes.push('热蚀仅在排汽前炉热至少 3 时产生；炉门开启后连续命中泄热，或净化热蚀，可截断落锤溅射。');
   }
   if(key==='furnace_drop'){
    if(stacks(boss,'heat')>=3&&markedTarget('scalded_armor')){attack('熔渣溅射',6,'magic',heroes,'burst');notes.push('落锤后向全队溅射熔渣，6 基础魔法伤害。');}
    notes.push('溅射需要至少 3 炉热且仍有人带热蚀；敞口泄热至 2 以下，或净化全部热蚀即可取消。');
   }
   break;
  }
  case 'orrery':{
   if(key==='orbit_calibrate'){
    debuff('charted_soul',[target]);
    notes.push(`把${name(target)}记入星图（意志 −4）；下一次坍缩可能封术。更换攻击技能降低锁定，或净化坐标可截断。`);
   }
   if(key==='orbit_collapse'){
    const victim=markedTarget('charted_soul');
    if(stacks(boss,'prediction')>=2&&victim&&control('silence','星图静默',victim,11))notes.push(`坍缩结束后尝试封术${name(victim)}，可用意志抵抗；物理与辅助技能仍可用。`);
    notes.push('封术需要锁定至少 2 层和星图坐标；换招使锁定降至 1 以下，或净化坐标可取消。');
   }
   break;
  }
  case 'arbiter':{
   if(key==='edict_mark'){
    if(stacks(boss,'violations')>=1){debuff('listed_offender',[target]);notes.push(`违令者被签名：${name(target)}敏捷、意志各 −3，下一次单席判决可能眩晕。`);}
    notes.push('宣告时不违令便不会留下判罚签名；下一轮守令或净化签名可截断判决控制。');
   }
   if(key==='edict_sentence'){
    const victim=markedTarget('listed_offender');
    if(stacks(boss,'violations')>=2&&victim&&control('stun','强制退庭',victim,12))notes.push(`判决结束后尝试眩晕${name(victim)}，可用意志抵抗。`);
    notes.push('眩晕需要本轮违令至少 2 次和判罚签名；本轮守令或净化签名即可取消。');
   }
   if(key==='edict_audit'&&stacks(boss,'violations')>=2){
    debuff('censured',heroes,{strength:-3,intelligence:-3},2,'权能扣押');
    notes.push('至少两次违令，核验后全队力量、智力各 −3；辅助技能不违令，可以用来整备。');
   }
   break;
  }
  case 'final':{
   const dismantle=state.challengeMode==='solo'?'主动攻击（每项技能拆 1 层）':'交替攻击';
   if(key==='zero_field'){
    debuff('zero_exposure',[target]);
    notes.push(`寂静边界撕开${name(target)}的零域裂隙（智力 −4），下一次空白脉冲可能追加实体碎片。${dismantle}拆屏障或净化裂隙可截断。`);
   }
   if(key==='zero_pulse'){
    const victim=markedTarget('zero_exposure');
    if(stacks(boss,'seals')>=2&&victim){attack('零域实体碎片',8,'physical',[victim],'shot');notes.push(`脉冲后追击${name(victim)}，8 基础物理伤害。`);}
    notes.push(`碎片追击需要至少 2 层屏障和零域裂隙；${dismantle}拆至不足 2 层、净化裂隙或打断可取消。`);
   }
   break;
  }
 }
 // A newly applied control never starts another attack in this same action.
 const order={attack:0,debuff:1,control:2};
 plan.after.sort((a,b)=>order[a.type]-order[b.type]);
 if(plan.after.length&&boss.id!=='golem')notes.push('取消主招也会取消整条连招。');
 plan.hint=notes.join('');
 return plan;
}
