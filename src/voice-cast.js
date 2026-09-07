import {HEROES} from './combat.js';
import {STORY_SPEAKERS} from './story.js';
import {icon} from './icons.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Casting direction is a design choice, not a claim of actor-level performance.
export const VOICE_CAST = [
  {id:'knibbs',tone:'成熟 · 爽朗 · 有分量',direction:'身经百战的探险家。安排事情干脆，安慰同伴时稳得住。',sample:'这个回来再谈'},
  {id:'ric',tone:'偏低 · 从容 · 留一点玩笑',direction:'圆滑的老熟人，话里有余地。保留年轻外形下的老练。',sample:'在。他刚说'},
  {id:'apeilia',tone:'清亮 · 利落 · 不太客气',direction:'爱抬杠的年轻女性。说熟人的坏话很顺口，正事也不含糊。',sample:'老板，你以前'},
  {id:'haart',tone:'男青年 · 懒散 · 有小脾气',direction:'怕麻烦、嘴上不饶人的青年院长。熟人多管两句会顶嘴，遇到正事仍会把人照顾好。',sample:'一晚上听七个人同时说话'},
  {id:'qianxing',tone:'平稳 · 克制 · 清楚',direction:'沉着的探索者。语气起伏少，说明故障和做决定都很直接。'},
  {id:'youmu',tone:'明亮 · 认真 · 青年感',direction:'二十五岁的医生。关心伤员，也会为了救人顶回去。',sample:'够做急救'},
  {id:'youmu_inner',tone:'低沉 · 强势 · 年长感',direction:'借医生身体说话的船长。和游木换用不同基础声音，接管要听得出区别。'},
  {id:'patch',tone:'斯文 · 清晰 · 不急不慢',direction:'表面老实的侦探，擅长从记录里挑出漏洞。'},
  {id:'narrator',tone:'平静 · 温和 · 交代现场',direction:'用较舒缓的女声把地点、动作和前因后果说清楚。'},
];

export function voiceCastView(manifest){
  const cards=VOICE_CAST.map(cast=>{
    const speaker=cast.id==='youmu'?{...HEROES.find(h=>h.id==='youmu'),name:'游木'}:STORY_SPEAKERS[cast.id]||HEROES.find(h=>h.id===cast.id);
    const clips=(manifest.clips||[]).filter(c=>c.speaker===cast.id&&typeof c.text==='string'&&c.text.trim()&&typeof c.src==='string'&&c.src.trim());
    const clip=clips.find(c=>cast.sample&&c.text.includes(cast.sample))||clips[0];
    const portrait=cast.id==='narrator'?icon('book'):`<span class="portrait ${cast.id}" role="img" aria-label="${esc(speaker.name)}"></span>`;
    return `<article class="voice-cast-card"><div class="voice-cast-heading">${portrait}<div><h3>${esc(speaker.name)}</h3><small>${esc(cast.tone)}</small></div></div><p>${esc(cast.direction)}</p><blockquote>${esc(clip?.text||'尚未生成')}</blockquote><button data-voice-speaker="${cast.id}" data-voice-text="${esc(clip?.text)}" ${clip?'':'disabled'}>${icon('volume')}试听 · ${esc(speaker.name)}</button></article>`;
  }).join('');
  return `<div class="modal-eyebrow">角色选声</div><h2>听听他们的声音</h2><p class="modal-lead">按人设选择基础声线，再分别调整语速与音高。以下直接播放游戏中的配音片段。</p><div class="voice-cast-controls"><span class="voice-status" role="status">选择角色试听</span><button data-action="voice-stop">${icon('muted')}停止试听</button></div><div class="voice-cast-grid">${cards}</div><p class="voice-cast-footnote">中文神经合成配音。部分角色共用基础声线；人物表演和情绪仍有合成语音的局限。</p>`;
}
