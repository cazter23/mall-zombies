// =============================================================================
// THE TEST RUNNER (npm test, and what test:quick runs its selection through): `node --test` with a cap on how many
// test files run at once.
//
// Why: node --test runs one file per CPU thread minus one by default (19 on a 20-thread CPU), and almost every test
// file builds the whole mall headless (about 500-600 MB a process). That is ~9 GB for one run, enough to freeze a
// 16 GB machine, and several agents in several worktrees test at once. Capped, the same files all run, just fewer
// at a time: slower, not fewer tests.
//
//   npm test                                  every tests/*.test.js, at most `jobs` files at once
//   npm test -- tests/hud.test.js tests/mall.test.js     only these files (use this, not a bare `node --test`)
//   npm test -- --test-name-pattern="Clock in"           any --flag is passed to node --test as it is
//   MALL_TEST_JOBS=8 npm test                 a different cap for this run (1 = one file at a time)
//
//   import { runTests } from './runTests.mjs'   runTests(files, nodeFlags) -> exit status (tools/testQuick.mjs)
// =============================================================================

import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Test files running at once when MALL_TEST_JOBS is not set. Measured on a 16 GB / 20-thread PC (docs/history.md, the
// test runner entry): each process peaks at ~500-600 MB, so 4 is ~2.4 GB a run where the default was ~9 GB.
export const DEFAULT_JOBS = 4;

/** How many test files may run at once: MALL_TEST_JOBS if it is a whole number >= 1, else DEFAULT_JOBS; never more than the CPU has. */
export function testJobs(env = process.env) {
  const asked = Number.parseInt(env.MALL_TEST_JOBS ?? '', 10);
  const jobs = Number.isInteger(asked) && asked >= 1 ? asked : DEFAULT_JOBS;
  return Math.min(jobs, Math.max(1, availableParallelism() - 1));
}

/** Every test file, as paths relative to the repo root (tests/x.test.js), sorted. */
export function allTestFiles() {
  return readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js')).sort().map((f) => join('tests', f));
}

/** Runs `node --test` on these files with the cap; returns the exit status. */
export function runTests(files, nodeFlags = []) {
  const jobs = testJobs();
  const run = spawnSync(process.execPath, ['--test', `--test-concurrency=${jobs}`, ...nodeFlags, ...files], { cwd: root, stdio: 'inherit' });
  if (run.error) console.error(run.error);
  return run.status ?? 1;
}

// Run from the command line (npm test): any --flag goes to node --test, anything else is a test file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const named = args.filter((a) => !a.startsWith('--'));
  const files = named.length ? named : allTestFiles();
  const started = Date.now();
  console.log(`Running ${files.length} test file(s), ${testJobs()} at a time (MALL_TEST_JOBS to change).`);
  const status = runTests(files, flags);
  console.log(`\nTests finished in ${((Date.now() - started) / 1000).toFixed(1)} s, ${testJobs()} at a time.`);
  process.exit(status);
}
