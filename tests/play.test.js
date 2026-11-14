// Getting into the game: the dev server's settings (vite.config.js) and the no-server launcher (tools/play.mjs, play.cmd).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import config, { isNotSource } from '../vite.config.js';
import { isStale, sourceFiles } from '../tools/play.mjs';

const root = resolve('.');

test('the launcher rebuilds only when something is newer than the build', () => {
  assert.equal(isStale(null, [1]), true, 'never built');
  assert.equal(isStale(10, [5, 11]), true, 'one file changed');
  assert.equal(isStale(10, [5, 10]), false, 'nothing newer');
});

test('the launcher watches everything that goes into the single file', () => {
  const files = sourceFiles();
  for (const file of ['src/main.js', 'src/ui/retail.css', 'index.html', 'package.json', 'vite.config.js', 'tools/buildSingle.mjs']) {
    assert.ok(files.includes(join(root, file)), file);
  }
  assert.ok(files.every((file) => existsSync(file)), 'and every one exists, or the launcher would crash reading its date');
});

test('npm run audition opens the gun sound audition as one file, and the dev server ignores its output', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.audition, 'node tools/openAudition.mjs');
  const script = readFileSync('tools/openAudition.mjs', 'utf8');
  for (const file of [...script.matchAll(/'(tools\/[\w.]+)'/g)].map((m) => m[1])) assert.ok(existsSync(file), `${file} (it watches it for changes)`);
  assert.equal(isNotSource(join(root, 'dist-audition/gun-sound-audition.html')), true);
  assert.match(readFileSync('.gitignore', 'utf8'), /^dist-audition\/$/m);
});

test('play.cmd runs the launcher from its own folder', () => {
  const script = readFileSync('play.cmd', 'utf8');
  assert.match(script, /cd \/d "%~dp0"/);
  assert.match(script, /node tools\\play\.mjs/);
});

test('the dev server skips folders the game never loads from', () => {
  for (const folder of ['.claude/worktrees/other/src/main.js', 'dist/index.html', 'dist-single/sunset-galleria.html', 'references/a.png', 'scratch/a.js']) {
    assert.equal(isNotSource(join(root, folder)), true, folder);
  }
  assert.equal(isNotSource(join(root, '.claude')), true, 'the folder itself');
  assert.equal(config.server.watch.ignored, isNotSource);
});

test("the dev server still watches this checkout's code, even inside .claude/worktrees", () => {
  for (const file of ['src/main.js', 'index.html', 'dist-singles.js']) assert.equal(isNotSource(join(root, file)), false, file);
  assert.equal(isNotSource(join(root, 'src/main.js').replaceAll('\\', '/')), false, 'in either kind of slash');
});

test('every file the dev server warms up exists', () => {
  for (const file of config.server.warmup.clientFiles) assert.ok(existsSync(file), file);
});
