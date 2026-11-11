// =============================================================================
// QUICK TESTS (npm run test:quick): run only the tests your change can affect, plus a small fast core set. The full suite
// (npm test) is for before a merge; this is for the edit-test loop. Both cap how many files run at once, and a selection of more
// than 8 files waits for any other big run on this PC to finish first (tools/runTests.mjs).
//
//   npm run test:quick                 changed files (vs main, plus uncommitted and new files) -> the tests that guard them + the core set
//   npm run test:quick -- --list       print the plan and run nothing
//   npm run test:quick -- --all        run everything (same as npm test)
//   npm run test:quick -- cinema atrium    also run tests whose file name contains these words
//   npm run test:quick -- --base=<ref>     compare with another ref instead of main
//
// A changed file selects a test when
//   - the test IS the changed file,
//   - the test imports the changed file directly (tests/foo.test.js -> src/.../x.js), or
//   - the test and the file are the same area by name (departmentStoreFixtures.js -> departmentStore.test.js + departmentStoreDetails.test.js).
// Changes to tests/helpers, package.json or src/main.js run everything (they can affect any test). Maps are wired through mall.js, so
// the core set always includes the real-mall, flicker and wiring tests.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTests, testJobs } from './runTests.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const flag = (name) => args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const words = args.filter((a) => !a.startsWith('--'));

// Fast, broad tests that always run (the real mall, no z-fighting, buying, map features, the dressed rooms).
const CORE = ['mall', 'coplanar', 'interactions', 'features', 'spawning'];

const git = (...a) => {
  const r = spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : '';
};
const norm = (p) => p.split(sep).join('/');

const testFiles = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js')).sort();
const rawStem = (file) => file.replace(/\.test\.js$/, '').replace(/\.m?js$/, '');
const stemOf = (file) => rawStem(file).toLowerCase();
// The same area: names that share a leading camelCase word group of 6+ letters (departmentStoreFixtures / departmentStoreDetails.test,
// cinemaStairs / cinema.test), or one name that starts with the other (zombieManager / zombie).
function sameArea(fileA, fileB) {
  const a = rawStem(fileA), b = rawStem(fileB);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  const boundary = (s) => n === s.length || /[A-Z]/.test(s[n]);
  if (n >= 6 && boundary(a) && boundary(b)) return true;
  const la = a.toLowerCase(), lb = b.toLowerCase();
  return la.length >= 5 && lb.length >= 5 && (la.startsWith(lb) || lb.startsWith(la));
}
const plan = new Map(); // test file -> why
const add = (file, why) => { if (!plan.has(file)) plan.set(file, why); };

function changedFiles() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const given = flag('base');
  let base = given ? given.split('=')[1] : 'HEAD';
  if (!given && branch && branch !== 'main' && git('rev-parse', '--verify', 'main')) base = git('merge-base', 'HEAD', 'main') || 'HEAD';
  const out = new Set();
  for (const f of git('diff', '--name-only', base).split('\n')) if (f) out.add(f);
  for (const f of git('ls-files', '--others', '--exclude-standard').split('\n')) if (f) out.add(f);
  return { files: [...out], base, branch };
}

// Which tests import which source files (direct imports only), resolved to repo-relative paths.
function importsOf(testFile) {
  const text = readFileSync(join(root, 'tests', testFile), 'utf8');
  const found = new Set();
  for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)['"](\.[^'"]+)['"]/g)) {
    found.add(norm(relative(root, resolve(root, 'tests', m[1]))));
  }
  return found;
}

function select() {
  if (flag('all')) { testFiles.forEach((f) => add(f, '--all')); return { everything: true }; }
  const { files, base, branch } = changedFiles();
  const info = { files, base, branch };
  let everything = false;
  for (const f of files) {
    if (/^(tests\/helpers\/|package\.json|src\/main\.js)/.test(f)) { everything = true; add('*', `${f} can affect any test`); }
  }
  if (everything) { testFiles.forEach((f) => add(f, 'shared file changed')); return { ...info, everything }; }
  const imports = new Map(testFiles.map((t) => [t, importsOf(t)]));
  for (const f of files) {
    if (/^tests\/.+\.test\.js$/.test(f)) { add(f.slice('tests/'.length), 'changed'); continue; }
    if (!/^(src|tools)\/.+\.m?js$/.test(f)) continue;
    for (const t of testFiles) {
      if (imports.get(t).has(norm(f))) add(t, `imports ${f}`);
      if (sameArea(f.split('/').pop(), t)) add(t, `same area as ${f}`);
    }
  }
  for (const w of words) for (const t of testFiles) if (t.toLowerCase().includes(w.toLowerCase())) add(t, `asked for "${w}"`);
  for (const c of CORE) for (const t of testFiles) if (stemOf(t) === c) add(t, 'core');
  return { ...info, everything };
}

const info = select();
plan.delete('*');
const chosen = [...plan.keys()].filter((t) => testFiles.includes(t));
console.log(info.everything ? 'Running everything.' : `Changed vs ${info.base ? info.base.slice(0, 8) : 'HEAD'}: ${info.files.length} file(s). Running ${chosen.length} of ${testFiles.length} test files:`);
if (!info.everything) for (const t of chosen) console.log(`  ${t.padEnd(34)} ${plan.get(t)}`);
console.log('(Run `npm test` before committing: this is the quick loop, not the full guarantee.)');
if (flag('list')) process.exit(0);

// Through the shared runner, so quick runs keep the same cap on files at once as npm test (tools/runTests.mjs).
const started = Date.now();
const status = await runTests(chosen.map((t) => join('tests', t))); // (a big selection waits for the lock like npm test)
console.log(`\ntest:quick finished in ${((Date.now() - started) / 1000).toFixed(1)} s (${chosen.length}/${testFiles.length} files, ${testJobs()} at a time)`);
process.exit(status);
