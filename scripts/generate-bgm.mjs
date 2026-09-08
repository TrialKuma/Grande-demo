#!/usr/bin/env node

/**
 * 《停机之前》BGM 批量生成与管理脚本 v2.0
 * 基于 docs/bgm-generation-plan.json 规划
 * 使用 Google Gemini Lyria 3.5 模型直接生成 44.1kHz 高品质纯器乐 MP3
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const PLAN_PATH = path.resolve(ROOT_DIR, 'docs/bgm-generation-plan.json');
const OUTPUT_DIR = path.resolve(ROOT_DIR, 'public/bgm');
const DIST_DIR = path.resolve(ROOT_DIR, 'dist/bgm');

if (fs.existsSync(path.resolve(ROOT_DIR, '.env'))) process.loadEnvFile?.(path.resolve(ROOT_DIR, '.env'));
const API_KEY = process.env.GEMINI_API_KEY || '';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${API_KEY}`;

function loadPlan() {
  if (!fs.existsSync(PLAN_PATH)) {
    throw new Error(`找不到 BGM 规划文件: ${PLAN_PATH}`);
  }
  return JSON.parse(fs.readFileSync(PLAN_PATH, 'utf-8'));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestLyriaMusic(prompt, retries = 3) {
  if (!API_KEY) throw new Error('请在本机 .env 或环境变量中设置 GEMINI_API_KEY。');
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const startTime = Date.now();
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'lyria-3.5',
          input: prompt
        })
      });

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      if (!res.ok) {
        const errorText = await res.text();
        console.warn(`  [尝试 ${attempt}/${retries}] HTTP ${res.status}: ${errorText.slice(0, 300)}`);
        if (res.status === 429) {
          console.log(`  遇到频率限制 (429)，等待 35 秒后自动重试...`);
          await sleep(35000);
          continue;
        }
        await sleep(5000);
        continue;
      }

      const data = await res.json();
      if (data.error) {
        console.warn(`  [尝试 ${attempt}/${retries}] API 报错:`, data.error);
        if (data.error.code === 429 || data.error.status === 'RESOURCE_EXHAUSTED') {
          console.log(`  遇到配额限流，等待 35 秒后重试...`);
          await sleep(35000);
          continue;
        }
        await sleep(5000);
        continue;
      }

      let audioBase64 = null;
      if (data.output_audio?.data) {
        audioBase64 = data.output_audio.data;
      } else if (data.steps) {
        for (const step of data.steps) {
          if (step.content) {
            for (const item of step.content) {
              if (item.type === 'audio' && item.data) {
                audioBase64 = item.data;
                break;
              }
            }
          }
          if (audioBase64) break;
        }
      }

      if (audioBase64) {
        return { buffer: Buffer.from(audioBase64, 'base64'), elapsed };
      } else {
        console.warn(`  [尝试 ${attempt}/${retries}] 响应中未找到音频数据`);
        await sleep(5000);
      }
    } catch (err) {
      console.warn(`  [尝试 ${attempt}/${retries}] 网络或未知异常:`, err.message);
      await sleep(5000);
    }
  }
  return null;
}

function updateManifest(allTracks) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const manifest = allTracks.map(t => {
    const filePath = path.join(OUTPUT_DIR, t.filename);
    const exists = fs.existsSync(filePath) && fs.statSync(filePath).size > 100000;
    return {
      ...t,
      available: exists,
      fileSize: exists ? fs.statSync(filePath).size : 0,
      url: `/bgm/${t.filename}`
    };
  });

  const manifestPath = path.join(OUTPUT_DIR, 'bgm-manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

  // 同步到 dist
  syncToDist();
  return manifest;
}

function syncToDist() {
  if (fs.existsSync(path.resolve(ROOT_DIR, 'dist'))) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    if (fs.existsSync(OUTPUT_DIR)) {
      const files = fs.readdirSync(OUTPUT_DIR);
      for (const file of files) {
        fs.copyFileSync(path.join(OUTPUT_DIR, file), path.join(DIST_DIR, file));
      }
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const allTracks = loadPlan();

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const isListOnly = args.includes('--list');
  const isSyncOnly = args.includes('--sync-manifest');
  const onlyIndex = args.indexOf('--only');
  const fromIndex = args.indexOf('--from');
  const batchIndex = args.indexOf('--batch');
  const isAll = args.includes('--all');

  if (isSyncOnly) {
    updateManifest(allTracks);
    console.log(`✅ 已根据本地磁盘文件同步更新 bgm-manifest.json！`);
    return;
  }

  if (isListOnly) {
    console.log(`\n🎵 《停机之前》BGM 全清单（共 ${allTracks.length} 首，来源: docs/bgm-generation-plan.json）：\n`);
    allTracks.forEach((t, i) => {
      const outPath = path.join(OUTPUT_DIR, t.filename);
      const exists = fs.existsSync(outPath) && fs.statSync(outPath).size > 100000;
      const sizeStr = exists ? `${(fs.statSync(outPath).size / 1024 / 1024).toFixed(2)}MB` : '------';
      console.log(`  [${String(i+1).padStart(2, '0')}] (${t.id.padEnd(3, ' ')}) [${t.batch.padEnd(8, ' ')}] ${t.title.padEnd(20, ' ')} -> ${t.filename.padEnd(30, ' ')} [${t.bpm} BPM] ${exists ? '✅ 已生成 ' + sizeStr : '⏳ 待生成'}`);
    });
    console.log('');
    return;
  }

  let selectedTracks = allTracks;

  if (onlyIndex !== -1 && args[onlyIndex + 1]) {
    const target = args[onlyIndex + 1];
    selectedTracks = allTracks.filter(t => t.id === target || t.filename.includes(target));
  } else if (fromIndex !== -1 && args[fromIndex + 1]) {
    const target = args[fromIndex + 1];
    const startIndex = allTracks.findIndex(t => t.id === target || t.filename.includes(target));
    if (startIndex !== -1) {
      selectedTracks = allTracks.slice(startIndex);
    }
  } else if (batchIndex !== -1 && args[batchIndex + 1]) {
    const b = args[batchIndex + 1];
    selectedTracks = allTracks.filter(t => t.batch === b);
  } else if (!isAll) {
    // 默认执行主批次 (main) + 已有之外的项
    selectedTracks = allTracks.filter(t => t.batch === 'main');
  }

  console.log(`\n==================================================`);
  console.log(`🎵 《停机之前》BGM 批量生成器 v2.0 (Google Lyria 3.5)`);
  console.log(`📁 规划数据: docs/bgm-generation-plan.json`);
  console.log(`📁 输出目录: ${OUTPUT_DIR}`);
  console.log(`🎯 计划处理曲目数: ${selectedTracks.length}`);
  console.log(`==================================================\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (let i = 0; i < selectedTracks.length; i++) {
    const track = selectedTracks[i];
    const outPath = path.join(OUTPUT_DIR, track.filename);
    const progress = `[${i + 1}/${selectedTracks.length}]`;

    // 检查是否已经存在
    if (fs.existsSync(outPath)) {
      const stat = fs.statSync(outPath);
      if (stat.size > 100000) {
        console.log(`${progress} ⏩ 跳过已有文件: ${track.filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
        skipCount++;
        continue;
      }
    }

    console.log(`\n${progress} 🚀 正在生成 [${track.id}]: ${track.title} (${track.filename})...`);
    console.log(`   场景: ${track.scene} | ${track.bpm} BPM | 批次: ${track.batch}`);
    console.log(`   提示词: ${track.prompt.slice(0, 80)}...`);

    const result = await requestLyriaMusic(track.prompt);
    if (result) {
      fs.writeFileSync(outPath, result.buffer);
      const sizeMB = (result.buffer.length / 1024 / 1024).toFixed(2);
      console.log(`   ✨ 成功! 耗时 ${result.elapsed}s, 文件大小: ${sizeMB} MB`);
      successCount++;

      // 实时保存 manifest 与同步
      updateManifest(allTracks);
    } else {
      console.error(`   ❌ 生成失败: ${track.filename}`);
      failCount++;
    }

    // 适度冷却，避免请求突发触发风控
    if (i < selectedTracks.length - 1) {
      console.log(`   ⏳ 冷却 4 秒后处理下一首...`);
      await sleep(4000);
    }
  }

  // 最终更新一次清单
  updateManifest(allTracks);

  console.log(`\n==================================================`);
  console.log(`🏁 任务统计: 成功 ${successCount} 首, 跳过 ${skipCount} 首, 失败 ${failCount} 首`);
  console.log(`📁 最新 manifest 已写入: ${path.join(OUTPUT_DIR, 'bgm-manifest.json')}`);
  console.log(`==================================================\n`);
}

main().catch(console.error);
