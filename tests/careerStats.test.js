import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCURACY_RECORD_MIN_SHOTS,
  CAREER_STATS_KEY,
  RECENT_RUN_LIMIT,
  createCareerStats,
} from '../src/game/careerStats.js';

function memoryStorage(seed = null) {
  const values = new Map(seed === null ? [] : [[CAREER_STATS_KEY, seed]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    value: () => values.get(CAREER_STATS_KEY),
  };
}

const run = (overrides = {}) => ({
  round: 4,
  timeAlive: 125.5,
  kills: 24,
  headshotKills: 8,
  meleeKills: 2,
  shotsFired: 100,
  shotsHit: 50,
  pointsEarned: 2200,
  pointsSpent: 1750,
  ...overrides,
});

test('career stats aggregate completed runs, keep weighted accuracy, records and dated recent runs', () => {
  const storage = memoryStorage();
  const dates = [new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z')];
  const stats = createCareerStats({ storage, now: () => dates.shift() });
  const first = stats.recordRun(run());
  assert.equal(first.saved, true);
  assert.deepEqual(first.newRecords, ['Highest round', 'Longest shift', 'Most kills', 'Most headshots', 'Most points earned', 'Best accuracy']);
  const second = stats.recordRun(run({ round: 3, timeAlive: 90, kills: 10, headshotKills: 2, shotsFired: 20, shotsHit: 20, pointsEarned: 900, pointsSpent: 500 }));
  assert.deepEqual(second.newRecords, [], 'a short 100% run cannot steal the accuracy record');
  const saved = stats.snapshot();
  assert.equal(saved.totals.runs, 2);
  assert.equal(saved.totals.kills, 34);
  assert.equal(saved.totals.pointsSpent, 2250);
  assert.equal(saved.totals.accuracy, 70 / 120, 'lifetime accuracy uses total hits / total shots');
  assert.equal(saved.bests.round, 4);
  assert.equal(saved.bests.accuracy, 0.5);
  assert.equal(saved.recentRuns[0].endedAt, '2026-01-02T00:00:00.000Z');
  assert.equal(JSON.parse(storage.value()).totals.runs, 2);
});

test('assisted runs do not affect totals, records, history or storage', () => {
  const storage = memoryStorage();
  const stats = createCareerStats({ storage });
  const result = stats.recordRun(run({ assisted: true, round: 99 }));
  assert.deepEqual(result, { saved: false, reason: 'assisted', newRecords: [], snapshot: stats.snapshot() });
  assert.equal(stats.snapshot().totals.runs, 0);
  assert.equal(storage.value(), undefined);
});

test('history is bounded, reset preserves the store, and malformed data recovers safely', () => {
  const storage = memoryStorage('{broken');
  const stats = createCareerStats({ storage, now: () => new Date('2026-01-01T00:00:00Z') });
  assert.equal(stats.snapshot().totals.runs, 0);
  for (let i = 0; i < RECENT_RUN_LIMIT + 4; i++) stats.recordRun(run({ round: i + 1 }));
  assert.equal(stats.snapshot().recentRuns.length, RECENT_RUN_LIMIT);
  assert.equal(stats.snapshot().recentRuns[0].round, RECENT_RUN_LIMIT + 4);
  stats.reset();
  assert.equal(stats.snapshot().totals.runs, 0);
  assert.deepEqual(stats.snapshot().recentRuns, []);
  assert.equal(JSON.parse(storage.value()).totals.runs, 0);
});

test('invalid loaded values are clamped and unavailable storage stays in memory', () => {
  const storage = {
    getItem: () => JSON.stringify({
      version: 1,
      totals: { runs: -5, shotsFired: 2, shotsHit: 20 },
      bests: { accuracy: 7 },
      recentRuns: [{ shotsFired: 1, shotsHit: 5 }],
    }),
    setItem: () => { throw new Error('blocked'); },
  };
  const stats = createCareerStats({ storage });
  assert.equal(stats.snapshot().totals.runs, 0);
  assert.equal(stats.snapshot().totals.shotsHit, 2);
  assert.equal(stats.snapshot().bests.accuracy, 1);
  assert.equal(stats.snapshot().recentRuns[0].shotsHit, 1);
  assert.doesNotThrow(() => stats.recordRun(run({ shotsFired: ACCURACY_RECORD_MIN_SHOTS })));
  assert.equal(stats.snapshot().totals.runs, 1);
});
