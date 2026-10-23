// =============================================================================
// CAREER STATS: persistent results across completed runs.
// Pure data apart from the injected storage object, so aggregation and recovery
// can be tested in Node. The browser wires it to localStorage in main.js.
// =============================================================================

export const CAREER_STATS_KEY = 'sunsetGalleria.careerStats';
export const CAREER_STATS_VERSION = 1;
export const RECENT_RUN_LIMIT = 12;
export const ACCURACY_RECORD_MIN_SHOTS = 25;

const TOTAL_FIELDS = [
  'runs', 'timeAlive', 'kills', 'headshotKills', 'meleeKills',
  'shotsFired', 'shotsHit', 'pointsEarned', 'pointsSpent',
];
const RUN_FIELDS = [
  'round', 'timeAlive', 'kills', 'headshotKills', 'meleeKills',
  'shotsFired', 'shotsHit', 'pointsEarned', 'pointsSpent',
];

function blank() {
  return {
    version: CAREER_STATS_VERSION,
    totals: Object.fromEntries(TOTAL_FIELDS.map((field) => [field, 0])),
    bests: {
      round: 0,
      timeAlive: 0,
      kills: 0,
      headshotKills: 0,
      pointsEarned: 0,
      accuracy: null,
    },
    recentRuns: [],
  };
}

const number = (value) => (Number.isFinite(value) && value >= 0 ? value : 0);
const whole = (value) => Math.floor(number(value));

function cleanRun(run = {}) {
  const cleaned = Object.fromEntries(RUN_FIELDS.map((field) => [field, number(run[field])]));
  for (const field of ['round', 'kills', 'headshotKills', 'meleeKills', 'shotsFired', 'shotsHit', 'pointsEarned', 'pointsSpent']) {
    cleaned[field] = whole(cleaned[field]);
  }
  cleaned.shotsHit = Math.min(cleaned.shotsHit, cleaned.shotsFired);
  cleaned.accuracy = cleaned.shotsFired > 0 ? cleaned.shotsHit / cleaned.shotsFired : 0;
  return cleaned;
}

function normalize(raw) {
  const data = blank();
  if (!raw || raw.version !== CAREER_STATS_VERSION) return data;
  for (const field of TOTAL_FIELDS) data.totals[field] = number(raw.totals?.[field]);
  for (const field of ['runs', 'kills', 'headshotKills', 'meleeKills', 'shotsFired', 'shotsHit', 'pointsEarned', 'pointsSpent']) {
    data.totals[field] = whole(data.totals[field]);
  }
  data.totals.shotsHit = Math.min(data.totals.shotsHit, data.totals.shotsFired);
  for (const field of ['round', 'timeAlive', 'kills', 'headshotKills', 'pointsEarned']) {
    data.bests[field] = number(raw.bests?.[field]);
  }
  for (const field of ['round', 'kills', 'headshotKills', 'pointsEarned']) data.bests[field] = whole(data.bests[field]);
  data.bests.accuracy = Number.isFinite(raw.bests?.accuracy)
    ? Math.max(0, Math.min(1, raw.bests.accuracy))
    : null;
  data.recentRuns = Array.isArray(raw.recentRuns)
    ? raw.recentRuns.slice(0, RECENT_RUN_LIMIT).map((run) => ({
      ...cleanRun(run),
      endedAt: typeof run.endedAt === 'string' ? run.endedAt : '',
    }))
    : [];
  return data;
}

const clone = (data) => JSON.parse(JSON.stringify(data));

export function createCareerStats({ storage, key = CAREER_STATS_KEY, now = () => new Date() } = {}) {
  let targetStorage = storage;
  let data;
  try {
    targetStorage ??= globalThis.localStorage;
    data = normalize(JSON.parse(targetStorage?.getItem(key) ?? 'null'));
  } catch {
    data = blank();
  }

  function save() {
    try {
      targetStorage?.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      return false; // private/blocked storage must never prevent playing
    }
  }

  return {
    snapshot() {
      const result = clone(data);
      result.totals.accuracy = result.totals.shotsFired > 0
        ? result.totals.shotsHit / result.totals.shotsFired
        : 0;
      return result;
    },

    recordRun(summary) {
      if (summary?.assisted) return { saved: false, reason: 'assisted', newRecords: [], snapshot: this.snapshot() };
      const run = cleanRun(summary);
      const newRecords = [];
      const records = [
        ['round', 'Highest round'],
        ['timeAlive', 'Longest shift'],
        ['kills', 'Most kills'],
        ['headshotKills', 'Most headshots'],
        ['pointsEarned', 'Most points earned'],
      ];
      for (const [field, label] of records) {
        if (run[field] > data.bests[field]) {
          data.bests[field] = run[field];
          newRecords.push(label);
        }
      }
      if (run.shotsFired >= ACCURACY_RECORD_MIN_SHOTS
          && (data.bests.accuracy === null || run.accuracy > data.bests.accuracy)) {
        data.bests.accuracy = run.accuracy;
        newRecords.push('Best accuracy');
      }

      data.totals.runs += 1;
      for (const field of TOTAL_FIELDS.filter((field) => field !== 'runs')) data.totals[field] += run[field];
      data.recentRuns.unshift({ ...run, endedAt: now().toISOString() });
      data.recentRuns.length = Math.min(data.recentRuns.length, RECENT_RUN_LIMIT);
      save();
      return { saved: true, newRecords, snapshot: this.snapshot() };
    },

    reset() {
      data = blank();
      save();
      return this.snapshot();
    },
  };
}
