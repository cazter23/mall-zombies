// The single-file build (tools/buildSingle.mjs, `npm run build:single`): the whole game in ONE html file that opens by
// double-clicking it. Builds it for real and checks it is self-contained: one inline module script and style, no file
// references left, the music worker inlined as a Blob worker, nothing loaded from the network (the fonts are inlined), and
// the font licences carried inside it (it is shared on its own, as a GitHub release).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, existsSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('npm run build:single writes one self-contained sunset-galleria.html', { timeout: 120_000 }, () => {
  execFileSync(process.execPath, ['tools/buildSingle.mjs'], { stdio: 'pipe' });
  assert.deepEqual(readdirSync('dist-single'), ['sunset-galleria.html'], 'nothing else is left next to it');
  const html = readFileSync('dist-single/sunset-galleria.html', 'utf8');
  assert.ok(html.length > 500_000 && html.length < 6_000_000, `a sensible size (${(html.length / 1e6).toFixed(2)} MB)`);
  assert.match(html, /<title>Sunset Galleria<\/title>/);
  assert.equal((html.match(/<script/g) ?? []).length, 1, 'one script');
  assert.match(html, /<script type="module">/, 'inline, so it runs from file://');
  assert.equal(html.split('</body>').length, 2, 'the code went in unaltered: pasting it must not expand the $& in the bundle');
  const code = join(mkdtempSync(join(tmpdir(), 'single-')), 'inline.mjs');
  writeFileSync(code, html.match(/<script type="module">([\s\S]*)<\/script>/)[1]);
  assert.equal(spawnSync(process.execPath, ['--check', code]).status, 0, 'and the inline script is valid JavaScript');
  assert.equal((html.match(/<style>/g) ?? []).length, 1, 'one inline style block');
  assert.doesNotMatch(html, /(?:src|href)="\.{0,2}\/?assets\//, 'no reference to a separate file');
  assert.doesNotMatch(html, /import\.meta\.url/, 'no URLs resolved against the page address');
  assert.match(html, /new Worker\(URL\.createObjectURL\(new Blob\(\[/, 'the music worker is inlined as a Blob worker');
  assert.doesNotMatch(html, /musicWorker-[\w-]+\.js/, 'no leftover worker file name');
  // nothing external at all: the web fonts (config/typefaces.js) are inlined as data: URLs, so the signs look right offline
  const external = [...html.matchAll(/<link[^>]+>/g)].map((m) => m[0]).filter((tag) => /https?:/.test(tag));
  assert.deepEqual(external, [], 'no link to a font host or anything else');
  assert.doesNotMatch(html, /fonts\.(googleapis|gstatic)\.com/);
  assert.ok((html.match(/url\(data:font\/woff2;base64,/g) ?? []).length >= 35, 'every bundled font face is inlined');
  // ...and their licences travel with them (the file is shared on its own): the credits and every family's full text
  const licences = html.match(/<!--\nFONT LICENCES\.([\s\S]*?)\n-->/)?.[1] ?? '';
  for (const f of readdirSync('src/fonts/licenses')) {
    assert.ok(licences.includes(`===== ${f.replace('.txt', '')} =====`), `the single file carries ${f}`);
  }
  assert.match(licences, /SIL OPEN FONT LICENSE Version 1\.1/i);
  assert.match(licences, /Apache License\s+Version 2\.0/);
  assert.ok(html.indexOf('<meta charset') < 1024, 'the charset stays in the first 1,024 bytes');
  assert.ok(existsSync('dist-single/sunset-galleria.html'));
});
