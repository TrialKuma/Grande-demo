import { readFile, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

// This build is independent of Vite's dist output. The result runs from file://.
const root = fileURLToPath(new URL('../', import.meta.url));
const destination = resolve(root, '开始游戏.html');
const assetNames = ['party.png', 'title.png', 'recruits.png', 'expedition-recruits.png'];
const [template, favicon, ...artBuffers] = await Promise.all([
  readFile(resolve(root, 'index.html'), 'utf8'),
  readFile(resolve(root, 'public/favicon.svg'), 'utf8'),
  ...assetNames.map(name => readFile(resolve(root, 'public/art', name))),
]);
const art = new Map(assetNames.map((name, index) => [
  `/art/${name}`, `data:image/png;base64,${artBuffers[index].toString('base64')}`,
]));
const result = await build({
  absWorkingDir: root,
  entryPoints: ['src/main.js'],
  outfile: resolve(root, '.offline-bundle.js'),
  write: false,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020'],
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  metafile: true,
  external: ['/art/*'],
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.jpeg': 'dataurl', '.svg': 'dataurl' },
  logLevel: 'warning',
});

const jsFiles = result.outputFiles.filter(file => extname(file.path) === '.js');
const cssFiles = result.outputFiles.filter(file => extname(file.path) === '.css');
assert.equal(jsFiles.length, 1, 'The offline build must contain exactly one JavaScript bundle.');
assert.equal(cssFiles.length, 1, 'The offline build must contain exactly one stylesheet.');
assert.equal(result.outputFiles.length, 2, 'Every generated asset must be embedded, not written separately.');
for (const [path, output] of Object.entries(result.metafile.outputs)) {
  if (path.endsWith('.js')) {
    assert.equal(output.imports.length, 0, 'The JavaScript bundle still has an external dependency.');
  }
}

let css = cssFiles[0].text;
const embeddedArt = new Set();
css = css.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]*))\s*\)/gi, (whole, double, single, bare) => {
  const url = double ?? single ?? bare;
  const embedded = art.get(url);
  if (embedded) {
    embeddedArt.add(url);
    return `url("${embedded}")`;
  }
  assert.ok(url.startsWith('data:') || url.startsWith('#'), `Non-embedded CSS resource: ${url}`);
  return whole;
});
for (const name of assetNames) {
  assert.ok(embeddedArt.has(`/art/${name}`), `Expected artwork is missing from the stylesheet: ${name}`);
}
assert.ok(!/@import\b/i.test(css), 'CSS imports cannot remain in the offline build.');
assert.ok(!css.includes('/art/'), 'An unresolved artwork path remains.');

// HTML parses script/style contents before JavaScript/CSS gets a chance to run.
// Escaping the opening '<' sequence here prevents source strings ending the tag.
const manifest = JSON.parse(await readFile(resolve(root, 'public/voices/manifest.json'), 'utf8'));
const mediaPaths = [...new Set(manifest.clips.map(clip => clip.src)), '/models/qianxing.glb'];
const mediaBuffers = await Promise.all(mediaPaths.map(path => readFile(resolve(root, `public${path}`))));
const media = new Map(mediaPaths.map((path, i) => [path,
  `data:${path.endsWith('.glb') ? 'model/gltf-binary' : 'audio/mpeg'};base64,${mediaBuffers[i].toString('base64')}`]));
const embeddedMedia = new Set();
const js = jsFiles[0].text.replace(/(["'])(\/(?:voices|models)\/[^"']+)\1/g, (whole, quote, path) => {
  const data = media.get(path);
  assert.ok(data, `Unexpected local media resource: ${path}`);
  embeddedMedia.add(path);
  return JSON.stringify(data);
}).replace(/<\/script/gi, '<\\/script');
for (const path of mediaPaths) assert.ok(embeddedMedia.has(path), `Missing embedded media: ${path}`);
assert.ok(!/["']\/(?:voices|models)\//.test(js), 'An unresolved media path remains.');
css = css.replace(/<\/style/gi, '<\\/style');
const faviconUrl = `data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}`;
let shell = template.replace(/<link\b[^>]*\brel\s*=\s*["']icon["'][^>]*>/gi,
  `<link rel="icon" type="image/svg+xml" href="${faviconUrl}" />`);
const entries = shell.match(/<script\b[^>]*\bsrc\s*=\s*["'][^"']+["'][^>]*>\s*<\/script\s*>/gi) || [];
assert.equal(entries.length, 1, 'The template must have one external entry script to replace.');
assert.ok(/src\s*=\s*["']\/?src\/main\.js["']/.test(entries[0]), 'Unexpected template entry script.');
shell = shell.replace(entries[0], '<!-- OFFLINE_GAME_SCRIPT -->');
assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(shell), 'An external script remains in the HTML.');
assert.ok(!/<link\b[^>]*\brel\s*=\s*["'](?:stylesheet|preload|modulepreload)["']/i.test(shell),
  'An external stylesheet or preload remains in the HTML.');
for (const match of shell.matchAll(/\b(?:src|href|poster)\s*=\s*["']([^"']*)["']/gi)) {
  assert.ok(match[1].startsWith('data:') || match[1].startsWith('#'), `External HTML resource: ${match[1]}`);
}
assert.ok(!/<\/script/i.test(js), 'The inline script contains an unescaped closing script tag.');
assert.ok(!/<\/style/i.test(css), 'The inline stylesheet contains an unescaped closing style tag.');

const html = shell
  .replace('</head>', () => `<style>${css}</style>\n  </head>`)
  .replace('<!-- OFFLINE_GAME_SCRIPT -->', () => `<script>${js}</script>`);
assert.equal((html.match(/<script\b/gi) || []).length, 1, 'Expected a single inline classic script.');
assert.ok(!/<script\b[^>]*\btype\s*=\s*["']module["']/i.test(html), 'file:// requires a classic script.');
assert.ok(!/<script\b[^>]*\bsrc\s*=/i.test(html), 'The final HTML contains an external script.');
assert.ok(!/<link\b[^>]*\bhref\s*=\s*["'](?:https?:|\/\/|\.?\.?\/)/i.test(html),
  'The final HTML contains an external link asset.');
await writeFile(destination, html, 'utf8');
const bytes = Buffer.byteLength(html, 'utf8');
console.log(`Offline game built: ${destination}`);
console.log(`Size: ${(bytes / 1024 / 1024).toFixed(2)} MiB (${bytes.toLocaleString('en-US')} bytes)`);
console.log(`Embedded: ${assetNames.length} PNG artworks, ${manifest.clips.length} Chinese voice clips, Blender GLB, SVG favicon, CSS, Three.js, game logic and synthesized music.`);
console.log('Verified: no external script, stylesheet, preload, CSS URL, or JavaScript import; dist was not changed.');
