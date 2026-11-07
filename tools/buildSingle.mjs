// =============================================================================
// SINGLE-FILE BUILD: `npm run build:single` writes dist-single/sunset-galleria.html, the whole game in ONE html file
// (code, styles and the music worker inlined), so it runs by double-clicking it: no server, no Node, no internet.
// (The normal `npm run build` makes a dist/ folder that browsers only run from a web server: they refuse to load
// separate module scripts and workers from file://.)
//
// How: a normal Vite build into dist-single/ with everything in one JS chunk and one CSS file, then this script pastes
// them into index.html. The music worker (a self-contained script) becomes a Blob URL created at runtime. The Google Fonts
// link stays but loads without blocking (print-media trick), so a blocked / offline network just falls back to system fonts.
// =============================================================================

import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'dist-single';
const NAME = 'sunset-galleria.html';

rmSync(OUT, { recursive: true, force: true });
await build({
  logLevel: 'warn',
  base: './',
  build: {
    outDir: OUT,
    emptyOutDir: true,
    assetsInlineLimit: 100_000_000, // textures / small assets inline as data: URLs
    cssCodeSplit: false,
    chunkSizeWarningLimit: 4000,
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
});

const assets = join(OUT, 'assets');
const files = readdirSync(assets);
const pick = (re, what) => {
  const matches = files.filter((f) => re.test(f));
  if (matches.length !== 1) throw new Error(`single build: expected exactly one ${what}, found ${matches.join(', ') || 'none'}`);
  return join(assets, matches[0]);
};
const mainJsPath = pick(/^index-.*\.js$/, 'main script');
const cssPath = pick(/^(index|style)-.*\.css$/, 'stylesheet'); // (Vite names it style-… when CSS isn't split)
const workerPath = pick(/^musicWorker-.*\.js$/, 'music worker');
const stray = files.filter((f) => ![mainJsPath, cssPath, workerPath].some((p) => p.endsWith(f)));
if (stray.length) throw new Error(`single build: unexpected extra files would be left out: ${stray.join(', ')}`);

let js = readFileSync(mainJsPath, 'utf8');
const css = readFileSync(cssPath, 'utf8');
const worker = readFileSync(workerPath, 'utf8');

// The worker: swap `new Worker(new URL("...musicWorker-xxx.js", ...), {...})` for a Blob-URL worker.
// Vite writes it as `new Worker(new URL(""+new URL("musicWorker-HASH.js",import.meta.url).href,import.meta.url),{type:"module"})`.
// The worker file itself is a self-contained script, so a classic Blob worker runs it fine.
const workerCall = /new Worker\((?:(?!new Worker)[\s\S]){0,300}?musicWorker[\s\S]{0,200}?\{type:["']module["']\}\)/;
if (!workerCall.test(js)) throw new Error('single build: could not find the music worker call in the bundle');
// (Pasted through a function here and below: in a replacement STRING, $& and $' mean "the matched text" and "the rest", and the bundle contains them.)
js = js.replace(workerCall, () => `new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:"text/javascript"})))`);

// src/boot.js imports main.js dynamically: the code is all inlined, so the import helper needs no address.
js = js.replace(/,void 0,import\.meta\.url\)/g, ',void 0)');

const safe = (text) => text.replace(/<\/(script|style)/gi, '<\\/$1').replace(/<!--/g, '<\\!--'); // (a "</script" inside the code would end it early)

let html = readFileSync(join(OUT, 'index.html'), 'utf8');
html = html
  .replace(/<script[^>]*type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/i, '')
  .replace(/<link[^>]*rel="stylesheet"[^>]*href="\.\/assets\/[^"]*"[^>]*>\s*/i, '')
  // fonts: don't block the first paint if the network is slow or blocked
  .replace(/<link href="(https:\/\/fonts\.googleapis\.com[^"]*)" rel="stylesheet" \/>/, '<link href="$1" rel="stylesheet" media="print" onload="this.media=\'all\'" />')
  .replace('</head>', () => `    <style>${safe(css)}</style>\n  </head>`)
  .replace('</body>', () => `    <script type="module">${safe(js)}</script>\n  </body>`);

if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) throw new Error('single build: a file reference was left in the html');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, NAME), html);
for (const f of files) rmSync(join(assets, f));
rmSync(assets, { recursive: true, force: true });
rmSync(join(OUT, 'index.html'));
console.log(`${join(OUT, NAME)}: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
