// =============================================================================
// QUICK TESTS (npm run test:quick): run only the tests your change can affect, plus a small fast core set. The full suite
// (npm test, ~90 s) is for before a commit; this is for the edit-test loop.
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
//   - the test's name and the file's name start the same way (departmentStoreFixtures.js -> departmentStore*.test.js, cinemaStairs...).
// Changes to tests/helpers, package.json or src/main.js run everything (they can affect any test). Maps are wired through mall.js, so
// the core set always includes the real-mall, flicker and wiring tests.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const stemOf = (file) => file.replace(/\.test\.js$/, '').replace(/\.js$/, '').toLowerCase();
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
    const stem = stemOf(f.split('/').pop().replace(/\.mjs$/, '.js'));
    for (const t of testFiles) {
      if (imports.get(t).has(norm(f).replace(/\.js$/, '.js'))) add(t, `imports ${f}`);
      const ts = stemOf(t);
      if (ts.length >= 5 && stem.length >= 5 && (stem.startsWith(ts) || ts.startsWith(stem))) add(t, `named like ${f}`);
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

const started = Date.now();
const run = spawnSync(process.execPath, ['--test', ...chosen.map((t) => join('tests', t))], { cwd: root, stdio: 'inherit' });
console.log(`\ntest:quick finished in ${((Date.now() - started) / 1000).toFixed(1)} s (${chosen.length}/${testFiles.length} files)`);
process.exit(run.status ?? 1);
