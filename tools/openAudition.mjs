// =============================================================================
// AUDITION AS ONE FILE (`npm run audition`): the gun sound audition (tools/audition.html) without the dev server.
// Bundles the page (the sound engine, the gun configs and the page's own code: not the 3D mall) into ONE html file,
// dist-audition/gun-sound-audition.html, and opens it in Firefox. Like `npm run play` it rebuilds only when the code has
// changed since the last build. Dev only: nothing here is part of the game's builds (`npm run build`, `build:single`).
// =============================================================================

import { build } from 'vite';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isStale, sourceFiles, openInBrowser } from './play.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'dist-audition');
const FILE = join(OUT, 'gun-sound-audition.html');
const PAGE = ['tools/audition.html', 'tools/audition.js', 'tools/auditionLegacy.js', 'tools/auditionPunch.js', 'tools/openAudition.mjs'];

export async function buildAudition() {
  rmSync(OUT, { recursive: true, force: true });
  await build({
    root,
    logLevel: 'warn',
    base: './',
    configFile: false, // (vite.config.js is the dev server's only)
    build: {
      outDir: OUT,
      emptyOutDir: true,
      chunkSizeWarningLimit: 4000,
      rollupOptions: { input: join(root, 'tools', 'audition.html'), output: { inlineDynamicImports: true } },
    },
  });
  const assets = join(OUT, 'assets');
  const files = readdirSync(assets);
  const one = (re, what) => {
    const found = files.filter((f) => re.test(f));
    if (found.length !== 1) throw new Error(`audition build: expected one ${what}, found ${found.join(', ') || 'none'}`);
    return join(assets, found[0]);
  };
  const jsPath = one(/^audition-.*\.js$/, 'page script');
  const workerPath = one(/^musicWorker-.*\.js$/, 'music worker');
  const stray = files.filter((f) => ![jsPath, workerPath].some((p) => p.endsWith(f)));
  if (stray.length) throw new Error(`audition build: unexpected extra files: ${stray.join(', ')}`);
  let js = readFileSync(jsPath, 'utf8');
  // The sound engine can render radio songs in a worker (the page never plays the radio): a Blob worker, as in buildSingle.mjs.
  const workerCall = /new Worker\((?:(?!new Worker)[\s\S]){0,300}?musicWorker[\s\S]{0,200}?\{type:["']module["']\}\)/;
  if (!workerCall.test(js)) throw new Error('audition build: could not find the music worker call');
  const worker = readFileSync(workerPath, 'utf8');
  js = js.replace(workerCall, () => `new Worker(URL.createObjectURL(new Blob([${JSON.stringify(worker)}],{type:"text/javascript"})))`);
  const safe = (text) => text.replace(/<\/(script|style)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  let html = readFileSync(join(OUT, 'tools', 'audition.html'), 'utf8');
  html = html
    .replace(/<script[^>]*type="module"[^>]*src="[^"]*"[^>]*><\/script>\s*/i, '')
    .replace('</body>', () => `<script type="module">${safe(js)}</script>\n</body>`);
  if (/src="[^"]*assets\//.test(html)) throw new Error('audition build: a file reference was left in the html');
  rmSync(assets, { recursive: true, force: true });
  rmSync(join(OUT, 'tools'), { recursive: true, force: true });
  writeFileSync(FILE, html);
  console.log(`${FILE}: ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB`);
}

async function main() {
  const builtAt = existsSync(FILE) ? statSync(FILE).mtimeMs : null;
  const sources = [...sourceFiles(root), ...PAGE.map((f) => join(root, f))];
  if (isStale(builtAt, sources.map((f) => statSync(f).mtimeMs))) {
    console.log('The code has changed: rebuilding the audition page...');
    await buildAudition();
  }
  openInBrowser(FILE);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
