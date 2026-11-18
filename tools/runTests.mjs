// =============================================================================
// THE TEST RUNNER (npm test, and what test:quick runs its selection through): `node --test` with a cap on how many
// test files run at once, and a lock so two big runs on this machine never overlap.
//
// Why: node --test runs one file per CPU thread minus one by default (19 on a 20-thread CPU), and almost every test
// file builds the whole mall headless (about 500-600 MB a process). That is ~9 GB for one run, enough to freeze a
// 16 GB machine, and several agents in several worktrees test at once. Capped, the same files all run, just fewer
// at a time: slower, not fewer tests. Locked, a second big run (from any worktree, any tool) waits for the first.
//
//   npm test                                  every tests/*.test.js, at most `jobs` files at once
//   npm test -- tests/hud.test.js tests/mall.test.js     only these files (use this, not a bare `node --test`)
//   npm test -- --test-name-pattern="Clock in"           any --flag is passed to node --test as it is
//   MALL_TEST_JOBS=8 npm test                 a different cap for this run (1 = one file at a time)
//
// The lock: a run of more than LOCK_FREE_FILES files takes a lock file in the system temp folder (shared by every
// worktree and every tool on this PC) and waits while another run holds it, saying whose run it is waiting for. A run
// of a few files (fixing one failure) never waits. A lock whose process is gone, or older than LOCK_STALE_MINUTES, is
// taken over (a run killed by a timeout leaves its file behind).
//
//   import { runTests } from './runTests.mjs'   await runTests(files, nodeFlags) -> exit status (tools/testQuick.mjs)
// =============================================================================

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Test files running at once when MALL_TEST_JOBS is not set. Measured on a 16 GB / 20-thread PC (docs/archive/history-2026-11-mid.md, the
// test runner entry): each process peaks at ~500-600 MB, so 4 is ~2.4-4 GB a run where the default was ~9 GB.
export const DEFAULT_JOBS = 4;
// Runs of this many files or fewer skip the lock (a handful of processes; fixing a failure should never queue).
export const LOCK_FREE_FILES = 8;
// A lock older than this is a dead run's (a full run takes ~5 min at 4 at once, longer while the PC is busy).
export const LOCK_STALE_MINUTES = 30;
// A lock file that can't be read (caught mid-write) counts as held for this long, then as stale.
const LOCK_UNREADABLE_SECONDS = 10;
const LOCK_POLL_SECONDS = 2;
const LOCK_FILE = join(tmpdir(), 'sunset-galleria-tests.lock');

/** How many test files may run at once: MALL_TEST_JOBS if it is a whole number >= 1, else DEFAULT_JOBS; never more than the CPU has. */
export function testJobs(env = process.env) {
  const asked = Number.parseInt(env.MALL_TEST_JOBS ?? '', 10);
  const jobs = Number.isInteger(asked) && asked >= 1 ? asked : DEFAULT_JOBS;
  return Math.min(jobs, Math.max(1, availableParallelism() - 1));
}

/** Whether a run of these files takes the lock. */
export const needsLock = (files) => files.length > LOCK_FREE_FILES;

/** Every test file, as paths relative to the repo root (tests/x.test.js), sorted. */
export function allTestFiles() {
  return readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.js')).sort().map((f) => join('tests', f));
}

/** True while a process with this id exists (EPERM: it exists, it just isn't ours). */
export function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

/**
 * The machine-wide lock. Everything is injectable so tests use their own file and a fake clock and process table.
 *   tryAcquire(info)  { ok: true } or { ok: false, holder }; takes over a stale lock
 *   release()         removes the file, only if this process holds it
 *   holder()          what the file says ({ pid, started, worktree, files }), or null
 */
export function createTestLock({ path = LOCK_FILE, pid = process.pid, now = Date.now, alive = processAlive } = {}) {
  const read = () => {
    try {
      return JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      return null;
    }
  };
  const age = () => {
    try {
      return now() - statSync(path).mtimeMs;
    } catch {
      return 0;
    }
  };
  const stale = (holder) => {
    if (!holder) return age() > LOCK_UNREADABLE_SECONDS * 1000; // (being written right now, or garbage)
    return !alive(holder.pid) || now() - holder.started > LOCK_STALE_MINUTES * 60 * 1000;
  };
  const create = (info) => {
    try {
      writeFileSync(path, JSON.stringify({ pid, started: now(), ...info }), { flag: 'wx' }); // (wx: fails if it exists)
      return true;
    } catch (error) {
      if (error.code === 'EEXIST') return false;
      throw error;
    }
  };
  return {
    path,
    holder: read,
    tryAcquire(info = {}) {
      if (create(info)) return { ok: true };
      const holder = read();
      if (holder?.pid === pid) return { ok: true };
      if (!stale(holder)) return { ok: false, holder };
      try { unlinkSync(path); } catch { /* (another waiter took it over first) */ }
      return create(info) ? { ok: true, tookOver: holder } : { ok: false, holder: read() };
    },
    release() {
      if (read()?.pid !== pid) return false;
      try { unlinkSync(path); } catch { /* (already gone) */ }
      return true;
    },
  };
}

const clock = (ms) => new Date(ms).toTimeString().slice(0, 5);
const sleep = (seconds) => new Promise((done) => setTimeout(done, seconds * 1000));

/** Waits until this process holds the lock, saying what it waits for. Returns the seconds waited. */
async function acquire(lock, info) {
  const since = Date.now();
  let told = 0;
  for (;;) {
    const result = lock.tryAcquire(info);
    if (result.ok) {
      if (result.tookOver) console.log(`(Took over a test lock left by pid ${result.tookOver.pid}: that run is gone or stuck.)`);
      return (Date.now() - since) / 1000;
    }
    const waited = (Date.now() - since) / 1000;
    if (told === 0 || waited - told >= 60) {
      const h = result.holder;
      const who = h ? `the run from ${h.worktree ?? 'another folder'} (pid ${h.pid}, ${h.files ?? '?'} files, started ${clock(h.started)})` : 'another run';
      console.log(told === 0
        ? `Waiting for ${who} to finish: only one big test run at a time on this PC. Runs of ${LOCK_FREE_FILES} files or fewer don't wait.`
        : `Still waiting for ${who} (${Math.round(waited / 60)} min).`);
      told = Math.max(waited, 1);
    }
    await sleep(LOCK_POLL_SECONDS);
  }
}

/** Runs `node --test` on these files with the cap (and the lock, for a big run); resolves to the exit status. */
export async function runTests(files, nodeFlags = []) {
  const lock = needsLock(files) ? createTestLock() : null;
  if (lock) {
    const release = () => lock.release();
    process.on('exit', release);
    for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) {
      try { process.on(signal, () => { release(); process.exit(130); }); } catch { /* (not on this platform) */ }
    }
    const waited = await acquire(lock, { worktree: basename(root), files: files.length });
    if (waited >= 1) console.log(`Waited ${Math.round(waited)} s for the other run.`);
  }
  const jobs = testJobs();
  const child = spawn(process.execPath, ['--test', `--test-concurrency=${jobs}`, ...nodeFlags, ...files], { cwd: root, stdio: 'inherit' });
  const status = await new Promise((done) => {
    child.on('error', (error) => { console.error(error); done(1); });
    child.on('close', (code) => done(code ?? 1));
  });
  lock?.release();
  return status;
}

// Run from the command line (npm test): any --flag goes to node --test, anything else is a test file.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const flags = args.filter((a) => a.startsWith('--'));
  const named = args.filter((a) => !a.startsWith('--'));
  const files = named.length ? named : allTestFiles();
  const started = Date.now();
  console.log(`Running ${files.length} test file(s), ${testJobs()} at a time (MALL_TEST_JOBS to change).`);
  const status = await runTests(files, flags);
  console.log(`\nTests finished in ${((Date.now() - started) / 1000).toFixed(1)} s, ${testJobs()} at a time.`);
  process.exit(status);
}
