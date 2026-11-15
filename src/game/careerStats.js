// =============================================================================
// CAREER STATS: persistent results across completed runs.
// Pure data apart from the injected storage object, so aggregation and recovery
// can be tested in Node. The browser wires it to localStorage in main.js.
// =============================================================================

import { CAREER_STATS_VERSION, PREVIOUS_CAREER_STATS_VERSION, RECENT_RUN_LIMIT, ACCURACY_RECORD_MIN_SHOTS } from '../config/careerStats.js';

export const CAREER_STATS_KEY = 'sunsetGalleria.careerStats';
export { CAREER_STATS_VERSION, RECENT_RUN_LIMIT, ACCURACY_RECORD_MIN_SHOTS };

const TOTAL_FIELDS = [
  'runs', 'wins', 'timeAlive', 'kills', 'headshotKills', 'meleeKills',
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
      fastestWin: null,
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
  cleaned.won = run.won === true;
  cleaned.winTime = cleaned.won && Number.isFinite(run.winTime) && run.winTime >= 0 ? run.winTime : null;
  return cleaned;
}

function normalize(raw) {
  const data = blank();
  if (raw?.version !== CAREER_STATS_VERSION && raw?.version !== PREVIOUS_CAREER_STATS_VERSION) return data;
  for (const field of TOTAL_FIELDS) data.totals[field] = number(raw.totals?.[field]);
  for (const field of ['runs', 'kills', 'headshotKills', 'meleeKills', 'shotsFired', 'shotsHit', 'pointsEarned', 'pointsSpent']) {
    data.totals[field] = whole(data.totals[field]);
  }
  if (raw.version === CAREER_STATS_VERSION) {
    data.totals.wins = Math.min(whole(raw.totals?.wins), data.totals.runs);
    const fastest = raw.bests?.fastestWin;
    if (Number.isFinite(fastest) && fastest >= 0) data.bests.fastestWin = fastest;
  } else {
    data.totals.wins = 0;
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
      ...cleanRun(raw.version === PREVIOUS_CAREER_STATS_VERSION ? { ...run, won: false } : run),
      endedAt: typeof run.endedAt === 'string' ? run.endedAt : '',
    }))
    : [];
  return data;
}

const clone = (data) => JSON.parse(JSON.stringify(data));

export function createCareerStats({ storage, key = CAREER_STATS_KEY, now = () => new Date() } = {}) {
  let targetStorage = storage;
  let data;
  // A save written by a NEWER build than this one (its version is higher than this build knows): its records must not
  // be wiped. This session keeps a blank ledger in memory and never writes over the stored save. (Unknown or corrupt
  // older data is replaced by a blank ledger at the next save, as before.)
  let newerSave = false;
  try {
    targetStorage ??= globalThis.localStorage;
    const raw = JSON.parse(targetStorage?.getItem(key) ?? 'null');
    newerSave = Number.isFinite(raw?.version) && raw.version > CAREER_STATS_VERSION;
    data = normalize(raw);
  } catch {
    data = blank();
  }

  // Another tab may have recorded runs since this one read the ledger: start from what is stored NOW, so the last writer
  // never wipes the other tab's runs and records. (Nothing stored, or unreadable: this tab's ledger stands.)
  function reread() {
    try {
      const raw = JSON.parse(targetStorage?.getItem(key) ?? 'null');
      if (raw === null) return;
      newerSave = Number.isFinite(raw?.version) && raw.version > CAREER_STATS_VERSION;
      if (!newerSave) data = normalize(raw);
    } catch { /* (keep what this tab has) */ }
  }

  function save() {
    if (newerSave) return false;
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
      reread();
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
      if (run.won) {
        data.totals.wins += 1;
        if (run.winTime !== null && (data.bests.fastestWin === null || run.winTime < data.bests.fastestWin)) {
          data.bests.fastestWin = run.winTime;
          newRecords.push('Fastest win');
        }
      }
      for (const field of TOTAL_FIELDS.filter((field) => field !== 'runs' && field !== 'wins')) data.totals[field] += run[field];
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
