import {BOSSES} from './combat.js';
import {icon} from './icons.js';

export const ART_WORLDS = [
  {id:'ruins',name:'雾蚀遗迹',tag:'断门 · 石阶 · 魔晶',bosses:['golem','duelist','cantor'],concept:'/concepts/ruins.png',description:'断裂城门围合出一块庭院。暖色石材与青色魔晶区分建筑和能量装置。'},
  {id:'storm',name:'雷暴栈桥',tag:'桥面 · 引雷塔 · 悬崖',bosses:['warden'],concept:'/concepts/storm.png',description:'宽阔的维修桥通向引雷塔。金属桥板、支架和电缆构成清楚的工业轮廓。'},
  {id:'sanctum',name:'缄页书库',tag:'藏书廊 · 目录环 · 讲台',bosses:['weaver','arbiter','final'],concept:'/concepts/sanctum.png',description:'战斗发生在书库中央的大厅。两侧书架与后方目录装置围合空间，前方保持开阔。'},
  {id:'floodworks',name:'地下水工厂',tag:'闸门 · 水渠 · 管道',bosses:['tide','furnace'],concept:'/concepts/floodworks.png',description:'维修平台连接排水闸门。水渠、阀轮和旧铜管让水工厂与石质遗迹有明显区别。'},
  {id:'observatory',name:'破碎观星台',tag:'浑仪 · 星图 · 山脊',bosses:['orrery'],concept:'/concepts/observatory.png',description:'浑仪立在破损的观星台后方。浅色地坪、黄铜圆环和远山组成安静的天文设施。'},
];
export function artWorldFor(bossId){return ART_WORLDS.find(world=>world.bosses.includes(bossId))||ART_WORLDS[0];}

export function artReviewView({bossId='golem',focus=false,concept=false,status=null}={}){
  const world=artWorldFor(bossId),boss=BOSSES[bossId]||BOSSES.golem;
  const ready=status?.currentBoss?.source==='blender-animated';
  return `<section class="art-review-screen" aria-label="场景与 BOSS 展示">
    <header class="art-review-header" ${concept?'inert':''}><div class="brand">${icon('crystal')}<span>格朗德<small>ART GALLERY</small></span></div><p>场景与 BOSS 展示</p><button data-action="art-exit">返回标题 ${icon('arrow')}</button></header>
    <aside class="art-review-sidebar" ${concept?'inert':''}><span class="tiny-label">五处战场</span><nav aria-label="场景选择">${ART_WORLDS.map(item=>`<button data-art-world="${item.id}" aria-pressed="${item.id===world.id}"><strong>${item.name}</strong><small>${item.tag}</small></button>`).join('')}</nav><div class="art-boss-picker"><span class="tiny-label">此地的敌人</span>${world.bosses.map(id=>`<button data-art-boss="${id}" aria-pressed="${id===bossId}">${BOSSES[id].name}${icon('arrow')}</button>`).join('')}</div><p>${world.description}</p><button class="art-concept-button" data-action="art-concept">${icon('book')}查看场景概念图</button></aside>
    <div class="art-stage-label"><span>${world.name}</span><h1>${boss.name}</h1><small id="art-load-status">${artLoadLabel(status)}</small></div>
    <footer class="art-review-controls" ${concept?'inert':''}><div class="art-view-switch" role="group" aria-label="展示视角"><button data-action="art-wide" aria-pressed="${!focus}">场景全景</button><button data-action="art-focus" aria-pressed="${focus}">BOSS 近看</button></div><div class="art-animation-switch" role="group" aria-label="播放 BOSS 动画"><span>动作</span><button data-art-animation="idle" ${!ready?'disabled':''}>待机</button><button data-art-animation="attack" ${!ready?'disabled':''}>攻击</button><button data-art-animation="hit" ${!ready?'disabled':''}>受击</button></div><button class="art-reset" data-action="art-camera">${icon('camera')}重置视角</button><small>拖动旋转 · 滚轮缩放</small></footer>
    ${concept?`<section class="art-concept-overlay" role="dialog" aria-modal="true" aria-label="${world.name}概念图"><header><div><strong>${world.name} · 概念图</strong><small>用来确定构图、轮廓与配色，模型采用适合试玩版的简化结构。</small></div><button data-action="art-concept-close" aria-label="关闭概念图">${icon('close')}</button></header><img src="${world.concept}" alt="${world.name}的场景美术概念图"><p>概念参考图；游戏中的场景是可旋转的三维模型。</p></section>`:''}
  </section>`;
}

export function artLoadLabel(status){
  if(!status)return '正在载入场景与模型…';
  if(status.worlds?.status==='fallback'||status.bosses?.status==='fallback')return '部分新模型未能载入，暂时显示基础造型。';
  if(status.currentBoss?.source==='blender-animated')return '可旋转查看 · 可播放待机、攻击与受击动作';
  return '正在载入场景与模型…';
}
