// Permanent skin data. Inject storage in Node; the browser supplies its own store.
// Loading and flushing are the only reads. Kill counters update memory until an unlock or runEnd.
import { skinStorage } from '../config/skins.js';

const blank = () => ({ version: skinStorage.version, progress: {}, unlocked: {}, equipped: {} });
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const safeKey = key => key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
const whole = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

function normalize(raw) {
  const data = blank();
  if (raw?.version !== skinStorage.version) return data;
  for (const [gunId, entries] of Object.entries(object(raw.progress))) {
    if (!safeKey(gunId)) continue;
    data.progress[gunId] = Object.fromEntries(Object.entries(object(entries))
      .filter(([skinId]) => safeKey(skinId)).map(([skinId, count]) => [skinId, whole(count)]));
  }
  for (const [gunId, entries] of Object.entries(object(raw.unlocked))) {
    if (!safeKey(gunId)) continue;
    data.unlocked[gunId] = Object.fromEntries(Object.entries(object(entries))
      .filter(([skinId, unlocked]) => safeKey(skinId) && unlocked === true));
  }
  data.equipped = Object.fromEntries(Object.entries(object(raw.equipped))
    .filter(([gunId, skinId]) => safeKey(gunId) && typeof skinId === 'string'));
  return data;
}

function merge(data, stored) {
  for (const [gunId, entries] of Object.entries(stored.progress)) {
    const progress = data.progress[gunId] ??= {};
    for (const [skinId, count] of Object.entries(entries)) progress[skinId] = Math.max(progress[skinId] ?? 0, count);
  }
  for (const [gunId, entries] of Object.entries(stored.unlocked)) Object.assign(data.unlocked[gunId] ??= {}, entries);
  Object.assign(data.equipped, stored.equipped);
}

export function createSkinSave({ storage, key = skinStorage.key } = {}) {
  let data = blank();
  let newer = false;
  const pendingClears = new Map(); // persistence work to retry after a failed debug write, independent of runs

  function read() {
    const raw = JSON.parse(storage?.getItem(key) ?? 'null');
    if (Number.isFinite(raw?.version) && raw.version > skinStorage.version) {
      newer = true;
      return blank();
    }
    return normalize(raw);
  }

  try {
    if (storage === undefined) storage = globalThis.localStorage;
    data = read();
  } catch { /* missing, corrupt, or blocked storage starts in memory */ }

  const progress = (gunId, skinId) => data.progress[gunId]?.[skinId] ?? 0;
  const unlocked = (gunId, skinId) => data.unlocked[gunId]?.[skinId] === true;

  function flush() {
    if (newer || !storage) return false;
    try {
      // A later build might have saved while this game was open. Never overwrite its record.
      let stored;
      try { stored = read(); }
      catch (error) {
        if (!(error instanceof SyntaxError)) return false;
        stored = blank();
      }
      if (newer) return false;
      const cleared = [...pendingClears.values()].map(([gunId, skinId]) => ({
        gunId, skinId, count: progress(gunId, skinId), open: unlocked(gunId, skinId),
      }));
      merge(data, stored);
      for (const { gunId, skinId, count, open } of cleared) {
        (data.progress[gunId] ??= {})[skinId] = count;
        if (open) (data.unlocked[gunId] ??= {})[skinId] = true;
        else delete data.unlocked[gunId]?.[skinId];
        if (data.equipped[gunId] === skinId) delete data.equipped[gunId];
      }
      storage.setItem(key, JSON.stringify(data));
      pendingClears.clear();
      return true;
    } catch {
      return false;
    }
  }

  return {
    progress,
    unlocked,
    snapshot: () => structuredClone(data),
    record(gunId, skinId, count, unlock = false) {
      (data.progress[gunId] ??= {})[skinId] = Math.max(progress(gunId, skinId), whole(count));
      if (unlock) (data.unlocked[gunId] ??= {})[skinId] = true;
    },
    clear(gunId, skinId) {
      (data.progress[gunId] ??= {})[skinId] = 0;
      delete data.unlocked[gunId]?.[skinId];
      if (data.equipped[gunId] === skinId) delete data.equipped[gunId];
      pendingClears.set(`${gunId}/${skinId}`, [gunId, skinId]);
      return flush();
    },
    flush,
  };
}
