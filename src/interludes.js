// Scene-independent walking interludes. All distances use the game's X/Z plane.
const lines=rows=>rows.map(([speaker,text])=>({speaker,text}));
export const INTERLUDE_LAYOUTS={
 gate:{world:'ruins',spawn:[0,2.8],bounds:{minX:-4,maxX:4,minZ:-3.5,maxZ:3.5},device:[1.8,-.2],companion:[-1.8,.5],practice:[-2.4,-2],exit:[0,-3],obstacles:[{x:3.5,z:1.1,width:.6,depth:1.4}]},
 pump:{world:'floodworks',spawn:[-2.8,2.5],bounds:{minX:-4,maxX:4,minZ:-3.5,maxZ:3.5},device:[1.9,.4],companion:[-1.5,-.2],practice:[2.5,-2],exit:[-.2,-3],obstacles:[{x:3.5,z:2.5,width:.6,depth:.7}]},
 archive:{world:'sanctum',spawn:[0,2.8],bounds:{minX:-4,maxX:4,minZ:-3.5,maxZ:3.5},device:[2,-.2],companion:[-1.8,.7],practice:[-2.4,-1.8],exit:[.2,-3],obstacles:[{x:3.4,z:-2.6,width:.7,depth:1.1}]},
};
const MOMENTS={
 duelist:{layout:'gate',title:'回廊里的喘息',objective:'检查内门的联络灯',device:'联络灯',dialogue:lines([
  ['narrator','刃卫倒下后，回廊终于安静了。内门旁的一盏灯还亮着。'],
  ['knibbs','里面能听见吗？我们已经到内门了。别往外挤，先告诉我有没有人受伤。'],
  ['student','老师腿上伤得重，还有个人擦伤。大家都醒着，我们把备用灯都关了，只留这一盏。'],
  ['knibbs','做得对。继续留在一起，我们会把路接通。'],
 ])},
 cantor:{layout:'gate',title:'把风送进去',objective:'打开过滤站的送风开关',device:'送风开关',dialogue:lines([
  ['knibbs','空气没那么呛了。先把风送进去，里面的人比我们更需要。'],
  ['haart','等一下，别把三个开关一起推上去。旧管子承受不住。'],
  ['knibbs','你说顺序。'],
  ['haart','左边，然后中间。行了，听见风声没有？总算有一件东西肯好好工作。'],
 ])},
 warden:{layout:'pump',title:'桥的另一头',objective:'放下供救援队通行的栈桥',device:'栈桥绞盘',dialogue:lines([
  ['narrator','雷脊看守停住后，断桥旁的绞盘露了出来。后方担架队还等着过桥。'],
  ['knibbs','桥放下以后，先过两个人试试。别一起上。'],
  ['ric','我在后面看着。你们往下走，担架和药我负责送进去。'],
  ['knibbs','好。别逞强搬最重的那个，你的腰昨天还在疼。'],
  ['ric','知道了。你怎么什么都记得。'],
 ])},
 tide:{layout:'pump',title:'水位线以下',objective:'锁住排水阀',device:'排水阀',dialogue:lines([
  ['knibbs','水还在退。把这个轮子锁死，别让它又转回去。'],
  ['qianxing','插销在阀座右边。我检查过，能用。'],
  ['student','我们这边的门缝不漏水了。老师问，能不能开始往外走？'],
  ['knibbs','再等一会儿。我还没看见你们那扇门，不想让你们走到半路又退回去。'],
 ])},
 furnace:{layout:'pump',title:'余温',objective:'关闭熔炉的回流管',device:'回流闸',dialogue:lines([
  ['knibbs','炉子停了，这根管子怎么还烫？'],
  ['qianxing','余压没放完。站到侧面，再拉那根长柄。'],
  ['knibbs','明白。这个位置留个记号，后面的人别用手试。'],
  ['youmu','我来写。你们谁的袖子烧坏了，过来让我看一眼，别光说没事。'],
 ])},
 golem:{layout:'gate',title:'隔着一扇门',objective:'接通避难室门边的电话',device:'避难室电话',dialogue:lines([
  ['student','刚才整间屋子都在晃。外面还好吗？'],
  ['knibbs','已经停下了。数一遍人，把名字告诉我。'],
  ['narrator','电话那头一个接一个地报了名字。六个学生，一位老师，一个都没少。'],
  ['knibbs','好，我记下了。现在就差解除总控的封锁。你们别离开电话，我会再叫你们。'],
 ])},
 weaver:{layout:'archive',title:'被撕掉的那一页',objective:'核对总控室的门禁记录',device:'门禁记录台',dialogue:lines([
  ['patch','找到了。救援许可确实发过，只是总控一直在读上一版名单。'],
  ['knibbs','所以不是我们没带够证件，是它根本不看新的。'],
  ['patch','嗯。我把旧许可标出来，免得你到了门前又被它绕回去。'],
  ['knibbs','谢了。等人出来，你慢慢骂它，现在先给我能开门的那一页。'],
 ])},
 orrery:{layout:'archive',title:'校准之后',objective:'保存校准后的时序',device:'星图记录盘',dialogue:lines([
  ['qianxing','刻度对上了。总控不能再拿错误的时间拒绝我们的请求。'],
  ['patch','我留一份副本。出了问题，还能知道它究竟改过什么。'],
  ['knibbs','留吧。别为了多抄一页，把自己留在这里。'],
  ['patch','最后一页。好了，走。'],
 ])},
 arbiter:{layout:'archive',title:'撤回追击',objective:'盖销追击命令',device:'命令核销台',dialogue:lines([
  ['ric','追击命令还挂着。人从门里出来之前，得先把这个收掉。'],
  ['patch','找到原件了。我来核销，你按住左边，别让纸又缩回去。'],
  ['knibbs','这样就不会再派东西追他们了？'],
  ['patch','至少这条命令不会。我宁可多看这一眼，也不想让担架在半路掉头。'],
 ])},
 final:{layout:'archive',title:'门终于开了',objective:'打开避难室的最后一道门',device:'手动开门杆',dialogue:lines([
  ['narrator','总控的光熄灭了。尼布斯握住手动开门杆，门里有人轻轻敲了两下。'],
  ['knibbs','别靠着门。我要打开了。'],
  ['student','我们都退开了。老师说……谢谢你们。'],
  ['knibbs','出来再说。先把老师扶稳，担架就在外面。'],
 ])},
};
const COMPANION_LINES={
 knibbs:lines([['knibbs','我再检查一遍弹匣。你歇一会儿，走的时候叫我。']]),
 apeilia:lines([['apeilia','刚才那下还不错吧？我看见你在瞄，特意给你让了一点位置。'],['apeilia','下一次换你给我留条路。说好了。']]),
 ric:lines([['ric','别老盯着前面。肩膀放松，喝口水。'],['ric','店里的灯我没关。把人带上去，正好还能赶一顿早饭。']]),
 haart:lines([['haart','我坐两分钟。书给我就行，不用扶，我还没虚弱到那个地步。'],['haart','要出发就叫我。别趁我闭眼，把麻烦全惹完了。']]),
 qianxing:lines([['qianxing','护甲没有漏电，别担心。刚才闪的那一下是正常卸压。'],['qianxing','我把松掉的接头拧紧就走。等我十秒。']]),
 youmu:lines([['youmu','手伸出来。你说不疼没用，我得亲眼看。'],['youmu','好，只是擦伤。下次别把伤口藏在袖子里，我又不会因此不让你走。']]),
 patch:lines([['patch','这里的档案很乱。不过人名那页，我已经重新核过了。'],['patch','七个人。我们来的时候是七个，出去也得是七个。']]),
};
const PRACTICE_LINES=lines([['knibbs','还有一点时间。把刚才没敢使的那一招试一遍，别等真要用的时候才想起手该放哪。'],['ric','我看着，你放手试。做错了就在这里改。']]);
export const SKIRMISH_AFTER={duelist:'patrol',warden:'patrol',weaver:'relay_guard'};
export const SKIRMISH_STORIES={
 duelist:lines([['narrator','内门后传来脚步声。两台守卫从岔口转了出来。'],['apeilia','后面那台一直贴着前面的走。它们会互相掩护，别只盯住一个。'],['knibbs','看见了。先把走廊让出来，后方的人还要从这里过。']]),
 warden:lines([['narrator','桥刚放稳，另一侧的巡逻队就转过了头。'],['ric','担架队还没过完。你们先拦一下，我带他们绕过去。'],['knibbs','走吧，这边交给我们。']]),
 weaver:lines([['patch','等一下。总控前面的导流器还在给守卫供能。'],['knibbs','那就先拆掉供能的，别让它们一直爬起来。'],['qianxing','我盯住线路。你们动手的时候，别碰地上那条亮着的线。']]),
};

export function interludeFor(run){
 const id=run?.interlude?.afterBossId,entry=MOMENTS[id];if(!entry)return null;
 const layout=INTERLUDE_LAYOUTS[entry.layout],done=run.interlude.done||[];
 const companion=run.interlude.companionId||run.partyIds.find(id=>id!==run.partyIds[0])||'ric';
 const objects=[
  {id:'device',type:'device',model:entry.layout==='pump'?'valve':'console',name:entry.device,position:[...layout.device],radius:1.35,required:true,dialogue:entry.dialogue},
  {id:'companion',type:'hero',heroId:companion,name:'和同伴聊聊',position:[...layout.companion],radius:1.45,required:false,dialogue:COMPANION_LINES[companion]},
  {id:'practice',type:'practice',model:'training',name:'顺手练一招',position:[...layout.practice],radius:1.35,required:false,dialogue:PRACTICE_LINES},
 ];
 const active=objects.find(o=>o.id===run.interlude.talking);
 return {id,layout:entry.layout,world:layout.world,title:entry.title,description:entry.objective,objective:entry.objective,heroId:run.partyIds[0],spawn:[...layout.spawn],position:[...run.interlude.position],bounds:{...layout.bounds},obstacles:layout.obstacles.map(o=>({...o})),objects,exit:{id:'exit',name:SKIRMISH_AFTER[id]?'继续开路':'继续前进',position:[...layout.exit],radius:1.35,open:done.includes('device')&&!active},done:[...done],dialogue:active?.dialogue||[],line:active?run.interlude.line:0,talking:active?.id||null};
}
export function beginInterlude(run,bossId){if(!MOMENTS[bossId])return false;const p=INTERLUDE_LAYOUTS[MOMENTS[bossId].layout].spawn;run.interlude={afterBossId:bossId,companionId:run.partyIds.find(id=>id!==run.partyIds[0])||'ric',position:[...p],done:[],talking:null,line:0};run.phase='explore';run.dialogue='after';run.line=0;return true;}
export function updateInterludePosition(run,position){
 const view=interludeFor(run);if(run.phase!=='explore'||!view||!Array.isArray(position)||position.length!==2||!position.every(Number.isFinite))return false;
 const b=view.bounds;run.interlude.position=[Math.max(b.minX,Math.min(b.maxX,position[0])),Math.max(b.minZ,Math.min(b.maxZ,position[1]))];return true;
}
const near=(position,object)=>Math.hypot(position[0]-object.position[0],position[1]-object.position[1])<=object.radius+.08;
export function interactInterlude(run,id){
 const view=interludeFor(run);if(run.phase!=='explore'||!view||view.talking)return {ok:false,error:'先把这段话说完。'};
 const object=view.objects.find(o=>o.id===id);if(!object)return {ok:false,error:'这里没有可互动的目标。'};
 if(!near(view.position,object))return {ok:false,error:'走近一点，再按互动。'};
 if(view.done.includes(id))return {ok:false,error:id==='practice'?'这一处已经练过了。':'这边已经处理好了。'};
 run.interlude.talking=id;run.interlude.line=0;return {ok:true,dialogue:object.dialogue};
}
export function advanceInterlude(run,skip=false){
 const view=interludeFor(run);if(run.phase!=='explore'||!view?.talking)return {ok:false};
 if(!skip&&run.interlude.line<view.dialogue.length-1){run.interlude.line++;return {ok:true,finished:false};}
 const id=run.interlude.talking;run.interlude.done.push(id);run.interlude.talking=null;run.interlude.line=0;
 return {ok:true,finished:true,practice:id==='practice'};
}
export function canFinishInterlude(run){const view=interludeFor(run);return !!(run.phase==='explore'&&view?.exit.open&&near(view.position,view.exit));}
export function normalizeInterlude(run){
 const value=run.interlude;if(!value||!MOMENTS[value.afterBossId]||!Array.isArray(value.position)||value.position.length!==2||!value.position.every(Number.isFinite)||!Array.isArray(value.done)||new Set(value.done).size!==value.done.length||value.done.some(id=>!['device','companion','practice'].includes(id))||value.talking!==null&&!['device','companion','practice'].includes(value.talking)||value.talking&&value.done.includes(value.talking)||!Number.isInteger(value.line)||value.line<0)return false;
 if(value.companionId!==undefined&&!Object.hasOwn(COMPANION_LINES,value.companionId))return false;
 const view=interludeFor(run);if(value.talking&&value.line>=view.dialogue.length)return false;
 const b=view.bounds;if(value.position[0]<b.minX||value.position[0]>b.maxX||value.position[1]<b.minZ||value.position[1]>b.maxZ)return false;
 return true;
}
export const interludeRequiredLines=id=>MOMENTS[id]?.dialogue||[];
export function allInterludeLines(){return [...Object.values(MOMENTS).flatMap(m=>m.dialogue),...Object.values(COMPANION_LINES).flat(),...PRACTICE_LINES,...Object.values(SKIRMISH_STORIES).flat()];}
