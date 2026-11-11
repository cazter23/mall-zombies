// The test runner (tools/runTests.mjs): the cap on files at once, which runs take the machine-wide lock, and the lock
// itself (one holder, release only by the holder, a dead or stuck run's lock taken over). Each test uses its own lock
// file, a fake clock and a fake process table, so it never touches the real lock that `npm test` itself holds.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createTestLock, DEFAULT_JOBS, LOCK_FREE_FILES, LOCK_STALE_MINUTES, needsLock, processAlive, testJobs,
} from '../tools/runTests.mjs';

function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mall-lock-test-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const path = join(dir, 'tests.lock');
  let time = 1_000_000;
  const living = new Set([1, 2, 3]);
  const lock = (pid) => createTestLock({ path, pid, now: () => time, alive: (p) => living.has(p) });
  return { path, lock, living, advance: (ms) => { time += ms; } };
}

test('the cap: MALL_TEST_JOBS when it is a whole number >= 1, else the default, never above the CPU', () => {
  assert.equal(testJobs({}), DEFAULT_JOBS);
  assert.equal(testJobs({ MALL_TEST_JOBS: '2' }), 2);
  for (const bad of ['0', '-3', 'abc', '']) assert.equal(testJobs({ MALL_TEST_JOBS: bad }), DEFAULT_JOBS, bad);
  assert.ok(testJobs({ MALL_TEST_JOBS: '9999' }) < 9999);
});

test('only a big run takes the lock: fixing a failure with a few files never waits', () => {
  const files = (n) => Array.from({ length: n }, (_, i) => `tests/t${i}.test.js`);
  assert.equal(needsLock(files(1)), false);
  assert.equal(needsLock(files(LOCK_FREE_FILES)), false);
  assert.equal(needsLock(files(LOCK_FREE_FILES + 1)), true);
});

test('one holder at a time; only the holder releases; then the next run gets it', (t) => {
  const { lock, path } = sandbox(t);
  const a = lock(1), b = lock(2);
  assert.equal(a.tryAcquire({ worktree: 'a', files: 157 }).ok, true);
  const refused = b.tryAcquire({ worktree: 'b' });
  assert.equal(refused.ok, false);
  assert.equal(refused.holder.pid, 1);
  assert.equal(refused.holder.worktree, 'a', 'the waiter can say whose run it waits for');
  assert.equal(a.tryAcquire().ok, true, 'asking again while holding it is fine');
  assert.equal(b.release(), false, 'a waiter cannot remove the holder\'s lock');
  assert.ok(existsSync(path));
  assert.equal(a.release(), true);
  assert.equal(existsSync(path), false);
  assert.equal(b.tryAcquire().ok, true);
});

test('a lock whose run is gone (killed by a timeout) is taken over', (t) => {
  const { lock, living } = sandbox(t);
  assert.equal(lock(1).tryAcquire().ok, true);
  living.delete(1);
  const result = lock(2).tryAcquire();
  assert.equal(result.ok, true);
  assert.equal(result.tookOver.pid, 1);
  assert.equal(lock(2).holder().pid, 2);
});

test('a lock older than the stale limit is taken over even if its process id is alive (an id reused, or a stuck run)', (t) => {
  const { lock, advance } = sandbox(t);
  assert.equal(lock(1).tryAcquire().ok, true);
  advance((LOCK_STALE_MINUTES - 1) * 60_000);
  assert.equal(lock(2).tryAcquire().ok, false, 'a long run is still a run');
  advance(2 * 60_000);
  assert.equal(lock(2).tryAcquire().ok, true);
});

test('an unreadable lock file counts as held for a moment (caught mid-write), then as stale', (t) => {
  const { lock, path } = sandbox(t);
  writeFileSync(path, '');
  const realNow = Date.now();
  const at = (ms) => createTestLock({ path, pid: 2, now: () => ms, alive: () => true });
  utimesSync(path, realNow / 1000, realNow / 1000);
  assert.equal(at(realNow + 1000).tryAcquire().ok, false);
  assert.equal(at(realNow + 60_000).tryAcquire().ok, true);
  assert.equal(lock(2).holder().pid, 2);
});

test('processAlive: this process is, a made-up id is not', () => {
  assert.equal(processAlive(process.pid), true);
  assert.equal(processAlive(2 ** 30), false);
});
