// =============================================================================
// SINGLE-FILE BUILD: `npm run build:single` writes dist-single/sunset-galleria.html, the whole game in ONE html file
// (code, styles and the music worker inlined), so it runs by double-clicking it: no server, no Node, no internet.
// (The normal `npm run build` makes a dist/ folder that browsers only run from a web server: they refuse to load
// separate module scripts and workers from file://.)
//
// How: a normal Vite build into dist-single/ with everything in one JS chunk and one CSS file, then this script pastes
// them into index.html. The music worker (a self-contained script) becomes a Blob URL created at runtime. The web fonts
// (src/fonts/*.woff2) are inlined into the stylesheet as data: URLs, so the signs look right offline too.
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
const iconPath = pick(/^icon-64-.*\.png$/, 'tab icon'); // (index.html's <link rel="icon">: Vite leaves it a file, so it's inlined below)
const stray = files.filter((f) => ![mainJsPath, cssPath, workerPath, iconPath].some((p) => p.endsWith(f)));
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

// The font licences travel with the fonts: this file is shared on its own (a GitHub release), and both licences (SIL OFL 1.1,
// Apache 2.0) want their text with every copy. src/fonts/LICENSES.md (the credits) and every family's full licence, as one HTML
// comment at the end of the body (not in <head>: the charset must stay in the first 1,024 bytes).
const licenceDir = 'src/fonts/licenses';
const licenceParts = [
  'FONT LICENCES. The fonts inlined in this file are free fonts under their own licences (not the game\'s MIT licence).',
  readFileSync('src/fonts/LICENSES.md', 'utf8'),
  ...readdirSync(licenceDir).filter((f) => f.endsWith('.txt')).sort().map((f) => `===== ${f.replace('.txt', '')} =====\n${readFileSync(join(licenceDir, f), 'utf8')}`),
];
const licences = licenceParts.join('\n\n').replace(/\r\n/g, '\n');
if (/--!?>/.test(licences)) throw new Error('single build: a licence text contains "-->", which would end the comment early');

let html = readFileSync(join(OUT, 'index.html'), 'utf8');
html = html
  .replace(/<script[^>]*type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/i, '')
  .replace(/<link[^>]*rel="stylesheet"[^>]*href="\.\/assets\/[^"]*"[^>]*>\s*/i, '')
  .replace(/(<link[^>]*rel="icon"[^>]*href=")\.\/assets\/[^"]*"/i, (_, start) => `${start}data:image/png;base64,${readFileSync(iconPath).toString('base64')}"`)
  .replace('</head>', () => `    <style>${safe(css)}</style>\n  </head>`)
  .replace('</body>', () => `    <script type="module">${safe(js)}</script>\n<!--\n${licences}\n-->\n  </body>`);

if (/src="\.?\/?assets\//.test(html) || /href="\.?\/?assets\//.test(html)) throw new Error('single build: a file reference was left in the html');
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, NAME), html);
for (const f of files) rmSync(join(assets, f));
rmSync(assets, { recursive: true, force: true });
rmSync(join(OUT, 'index.html'));
console.log(`${join(OUT, NAME)}: ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
