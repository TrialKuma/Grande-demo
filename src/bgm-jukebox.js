import {icon} from './icons.js';
import bgmManifest from '../public/bgm/bgm-manifest.json' with { type: 'json' };

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function bgmJukeboxView() {
  const cards = (bgmManifest || []).map(track => {
    const isReady = track.available;
    const badge = isReady
      ? `<span class="bgm-badge ready">已实装 · ${track.bpm} BPM</span>`
      : `<span class="bgm-badge pending">排队生成中</span>`;

    const sizeStr = isReady && track.fileSize ? ` · ${(track.fileSize / 1024 / 1024).toFixed(1)}MB` : '';
    const meterStr = track.timeSignature ? ` · ${track.timeSignature}拍` : '';

    return `
      <article class="voice-cast-card bgm-card ${isReady ? 'is-available' : 'is-disabled'}">
        <div class="voice-cast-heading">
          <span class="icon">${icon('volume')}</span>
          <div>
            <h3>${track.id} · ${esc(track.title)}</h3>
            <small>${esc(track.scene)}</small>
          </div>
          ${badge}
        </div>
        <div class="bgm-card-meta">
          <span>${track.bpm} BPM${meterStr}${sizeStr}</span>
        </div>
        <button data-action="bgm-play-track" data-bgm-filename="${esc(track.filename)}" ${isReady ? '' : 'disabled'}>
          ${icon('play')} ${isReady ? '试听原声' : '尚未就绪'}
        </button>
      </article>
    `;
  }).join('');

  return `
    <div class="modal-eyebrow">ORIGINAL SOUNDTRACK</div>
    <h2>《停机之前》游戏原声音乐</h2>
    <p class="modal-lead">全曲采用纯器乐室内乐与环境音色设计，为战斗技能音效和中文配音留出清晰空间。</p>
    <div class="voice-cast-controls">
      <span class="voice-status" id="bgm-playing-status">点击曲目直接试听</span>
      <button data-action="bgm-stop-audition">${icon('muted')} 停止试听</button>
    </div>
    <div class="voice-cast-grid">
      ${cards}
    </div>
    <p class="voice-cast-footnote">纯器乐游戏原声。支持在实际探索与战斗中无缝循环与中文对白音量避让。</p>
  `;
}
