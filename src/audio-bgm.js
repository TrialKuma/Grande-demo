/**
 * BGM Manager for Pre-rendered Lyria 3.5 Soundtracks
 * Handles seamless looping, cross-fading, dialogue ducking, and fallback.
 * Based on docs/bgm-generation-plan.json
 */

import bgmManifest from '../public/bgm/bgm-manifest.json' with { type: 'json' };

const TRACK_MAP = {
  // 标题与开局
  title: '01-灯还亮着.mp3',
  prologue_call: '01a-灯还亮着-开局电话版.mp3',

  // 探索间章
  explore_gate: '02-顺着引路线.mp3',
  explore_pump: '02b-拧紧最后一圈.mp3',
  explore_archive: '19-还没合上的档案.mp3',

  // 对话
  dialogue_normal: '03-你说我听着.mp3',
  dialogue_crisis: '14a-还在这儿-危机对话版.mp3',

  // 战斗：教学与途中战
  battle_tutorial: '04-先看它怎么动.mp3',
  battle_skirmish: '18-先让通道安全.mp3',

  // 战斗：10 位正式 BOSS
  boss_duelist: '05-刀与倒影.mp3',
  boss_cantor: '06-风口之外.mp3',
  boss_warden: '07-别踩那根线.mp3',
  boss_tide: '08-水会退下去.mp3',
  boss_furnace: '09-炉火未熄.mp3',
  boss_golem: '10-一条缝.mp3',
  boss_golem_core: '10a-一条缝-核心暴露版.mp3',
  boss_weaver: '11-签名不在场.mp3',
  boss_orrery: '12-没被改过的时间.mp3',
  boss_arbiter: '13-让后面的人通过.mp3',
  boss_final: '14b-还在这儿-最终战版.mp3',
  boss_final_discharge: '14c-还在这儿-守住最后放电.mp3',

  // 营地与整备
  camp: '15-热汤留了一份.mp3',

  // 胜利与通关结局
  victory_regular: '17-这段路安全了.mp3',
  ending_master: '16-七个名字.mp3',
  ending_rescue: '16a-七个名字-救援结局.mp3',
  ending_evidence: '16b-七个名字-证据结局.mp3',
  ending_infrastructure: '16c-七个名字-设施结局.mp3',

  // 扩展批次
  boss_cantor_climax: '06a-风口之外-菌冠升华.mp3',
  boss_warden_overload: '07a-别踩那根线-雷脊熔断.mp3',
  boss_weaver_overwrite: '11a-签名不在场-缄默复写.mp3',
  defeat_retreat: '20-先退到安全处.mp3'
};

export class BgmManager {
  constructor({ createAudio = () => typeof Audio !== 'undefined' ? new Audio() : null, onFallback = () => {} } = {}) {
    this.createAudio = createAudio;
    this.onFallback = onFallback;
    this.manifest = new Map((bgmManifest || []).map(t => [t.filename, t]));

    this.currentTrack = null;
    this.currentMedia = null;
    this.fadingMedia = null;
    this.fadeTimer = null;

    this.unlocked = false;
    this.enabled = true;
    this.muted = false;
    this.volume = 0.4;
    this.dialogue = false;
    this.status = 'idle'; // idle | playing | paused | error
  }

  resolveTrack({ bossId = 'golem', screen = 'title', phase = 0, chapter = null, dialogue = null, endingId = null, interludeBossId = null } = {}) {
    // 结局与通关
    if (screen === 'ending' || screen === 'complete' || (screen === 'dialogue' && dialogue === 'ending')) {
      if (endingId === 'rescue') return TRACK_MAP.ending_rescue;
      if (endingId === 'evidence') return TRACK_MAP.ending_evidence;
      if (endingId === 'infrastructure') return TRACK_MAP.ending_infrastructure;
      return TRACK_MAP.ending_master;
    }

    // 战斗胜利结果页
    if (phase === 'victory' || screen === 'victory') {
      if (bossId === 'final') return TRACK_MAP.ending_master;
      return TRACK_MAP.victory_regular;
    }

    // 标题主界面
    if (screen === 'title') {
      return TRACK_MAP.title;
    }

    // 探索间章：按所属 BOSS/区域分别映射
    if (screen === 'explore') {
      const exploreBoss = interludeBossId || bossId;
      if (exploreBoss === 'final') {
        return TRACK_MAP.ending_master; // 最终开门间章
      }
      if (['warden', 'tide', 'furnace'].includes(exploreBoss)) {
        return TRACK_MAP.explore_pump; // 泵站作业探索
      }
      if (['weaver', 'orrery', 'arbiter'].includes(exploreBoss)) {
        return TRACK_MAP.explore_archive; // 档案区探索
      }
      return TRACK_MAP.explore_gate; // 前段回廊探索
    }

    // 营地、奖励、招募、路线与事件选择
    if (['camp', 'reward', 'recruit', 'route', 'event'].includes(screen)) {
      return TRACK_MAP.camp;
    }

    // 剧情对白
    if (screen === 'dialogue') {
      if (dialogue === 'before' && (bossId === 'scout' || chapter === 0)) {
        return TRACK_MAP.prologue_call; // 开局电话版
      }
      if (dialogue === 'before' && bossId === 'final') {
        return TRACK_MAP.dialogue_crisis; // 最终战前断电危机
      }
      return TRACK_MAP.dialogue_normal; // 普通联络对白
    }

    // 战斗
    if (screen === 'battle') {
      // 最终战特殊阶段
      if (bossId === 'final') {
        if (phase === 'finale' || phase === 'core') {
          return TRACK_MAP.boss_final_discharge;
        }
        return TRACK_MAP.boss_final;
      }

      // 魔晶巨人核心暴露阶段
      if (bossId === 'golem' && (phase === 'core' || phase === 'finale')) {
        return TRACK_MAP.boss_golem_core;
      }

      // 教学关与单人演练
      if (['scout', 'bulwark', 'conduit'].includes(bossId) || bossId?.startsWith('tutorial') || bossId === 'training') {
        return TRACK_MAP.battle_tutorial;
      }

      // 途中遭遇编队战
      if (['patrol', 'relay_guard', 'skirmish'].includes(bossId)) {
        return TRACK_MAP.battle_skirmish;
      }

      // 正式 BOSS 映射
      return TRACK_MAP[`boss_${bossId}`] || null;
    }

    return null;
  }

  isAvailable(filename) {
    if (typeof window === 'undefined' || typeof Audio === 'undefined') return false;
    if (!filename) return false;
    const item = this.manifest.get(filename);
    return Boolean(item && item.available);
  }

  getEffectiveVolume() {
    if (!this.enabled || this.muted) return 0;
    const base = this.volume * 0.85;
    return this.dialogue ? base * 0.25 : base;
  }

  applyVolume() {
    if (this.currentMedia) {
      this.currentMedia.volume = Math.max(0, Math.min(1, this.getEffectiveVolume()));
    }
  }

  configure({ enabled = this.enabled, muted = this.muted, volume = this.volume, dialogue = this.dialogue } = {}) {
    this.enabled = Boolean(enabled);
    this.muted = Boolean(muted);
    this.volume = Math.max(0, Math.min(1, Number(volume) || 0));
    this.dialogue = Boolean(dialogue);

    if (!this.enabled || this.muted) {
      if (this.currentMedia && !this.currentMedia.paused) {
        this.currentMedia.pause();
      }
    } else if (this.unlocked && this.currentMedia && this.currentMedia.paused && this.status === 'playing') {
      this.currentMedia.play().catch(() => {});
    }
    this.applyVolume();
  }

  unlock() {
    this.unlocked = true;
    if (this.currentMedia && this.enabled && !this.muted && this.currentMedia.paused) {
      this.currentMedia.play().catch(() => {});
    }
  }

  sync({ bossId, screen, phase, chapter, endingId }) {
    const trackFile = this.resolveTrack({ bossId, screen, phase, chapter, endingId });

    // 如果该场景对应的 BGM 现阶段还没生成，触发 fallback
    if (!trackFile || !this.isAvailable(trackFile)) {
      this.stop();
      this.onFallback(true);
      return false;
    }

    // 已经在播放同一首，只需要刷新音量状态
    if (this.currentTrack === trackFile && this.currentMedia) {
      this.applyVolume();
      this.onFallback(false);
      return true;
    }

    this.play(trackFile);
    this.onFallback(false);
    return true;
  }

  play(filename) {
    const meta = this.manifest.get(filename);
    const src = meta?.url || `/bgm/${filename}`;

    const oldMedia = this.currentMedia;
    this.currentTrack = filename;

    const media = this.createAudio();
    if (!media) {
      this.onFallback(true);
      return;
    }

    media.src = src;
    media.loop = true;
    media.preload = 'auto';
    media.volume = 0; // 从 0 开始淡入

    this.currentMedia = media;
    this.status = 'playing';

    // 平滑淡入淡出 (Cross-fade: ~0.8s)
    if (oldMedia) {
      const oldVol = oldMedia.volume;
      const startTime = Date.now();
      const fadeDuration = 800;

      if (this.fadeTimer) clearInterval(this.fadeTimer);
      this.fadeTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(1, elapsed / fadeDuration);

        if (!this.muted && this.enabled) {
          oldMedia.volume = Math.max(0, oldVol * (1 - progress));
          media.volume = Math.min(1, this.getEffectiveVolume() * progress);
        }

        if (progress >= 1) {
          clearInterval(this.fadeTimer);
          this.fadeTimer = null;
          oldMedia.pause();
          oldMedia.removeAttribute('src');
          oldMedia.load();
        }
      }, 40);
    } else {
      media.volume = this.getEffectiveVolume();
    }

    if (this.unlocked && this.enabled && !this.muted) {
      media.play().catch(err => {
        if (err.name === 'NotAllowedError') {
          this.status = 'paused';
        } else {
          console.warn('BGM play error, falling back to synth score:', err);
          this.status = 'error';
          this.onFallback(true);
        }
      });
    }

    media.onerror = () => {
      console.warn(`BGM load failed for ${filename}, falling back to synth score.`);
      this.status = 'error';
      this.onFallback(true);
    };
  }

  stop() {
    this.currentTrack = null;
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.currentMedia) {
      this.currentMedia.pause();
      this.currentMedia.removeAttribute('src');
      this.currentMedia.load();
      this.currentMedia = null;
    }
    this.status = 'idle';
  }

  dispose() {
    this.stop();
  }
}
