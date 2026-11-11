// Permanent skin data. Inject storage in Node; the browser supplies its own store.
// Loading and flushing are the only reads. Kill counters update memory until an unlock or runEnd.
import { skinStorage, skins, gunSkin } from '../config/skins.js';

const blank = () => ({ version: skinStorage.version, progress: {}, unlocked: {}, equipped: {} });
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const safeKey = key => key !== '__proto__' && key !== 'constructor' && key !== 'prototype';
const whole = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
// Progress already paid for the round a Save & Quit will replay: { 'gunId/skinId': amount } (game/challenges.js).
const cleanReplay = value => Object.fromEntries(Object.entries(object(value))
  .filter(([key, amount]) => safeKey(key) && whole(amount) > 0).map(([key, amount]) => [key, whole(amount)]));

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
  const replay = cleanReplay(raw.replay);
  if (Object.keys(replay).length) data.replay = replay;
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
  let dirty = false; // memory holds something storage does not
  const pendingClears = new Map(); // persistence work to retry after a failed debug write, independent of runs
  const pendingEquipped = new Map(); // local choices win over an older stored choice for this gun only

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
      for (const [gunId, skinId] of pendingEquipped) {
        data.equipped[gunId] = gunSkin(gunId, skinId) && unlocked(gunId, skinId) ? skinId : 'default';
      }
      storage.setItem(key, JSON.stringify(data));
      pendingClears.clear();
      pendingEquipped.clear();
      dirty = false;
      return true;
    } catch {
      return false;
    }
  }

  return {
    progress,
    unlocked,
    snapshot: () => structuredClone(data),
    equippedFor(gunId) {
      const id = data.equipped[gunId];
      return gunSkin(gunId, id) && unlocked(gunId, id) ? id : 'default';
    },
    equip(gunId, skinId) {
      if (!Object.hasOwn(skins, gunId) || (skinId !== 'default' && (!gunSkin(gunId, skinId) || !unlocked(gunId, skinId)))) return false;
      data.equipped[gunId] = skinId;
      pendingEquipped.set(gunId, skinId);
      dirty = true;
      flush();
      return true;
    },
    record(gunId, skinId, count, unlock = false) {
      const next = Math.max(progress(gunId, skinId), whole(count));
      if (next !== progress(gunId, skinId) || (unlock && !unlocked(gunId, skinId))) dirty = true;
      (data.progress[gunId] ??= {})[skinId] = next;
      if (unlock) (data.unlocked[gunId] ??= {})[skinId] = true;
    },
    /** True while memory holds progress that storage does not (a run quit or restarted before any write). */
    get dirty() { return dirty; },
    /** What the round a saved run will replay has already been paid, by 'gunId/skinId'. Written by Save & Quit only. */
    get replay() { return { ...(data.replay ?? {}) }; },
    setReplay(amounts) {
      const replay = cleanReplay(amounts);
      if (Object.keys(replay).length) data.replay = replay;
      else delete data.replay;
      dirty = true;
    },
    clear(gunId, skinId) {
      (data.progress[gunId] ??= {})[skinId] = 0;
      delete data.unlocked[gunId]?.[skinId];
      if (data.equipped[gunId] === skinId) delete data.equipped[gunId];
      if (pendingEquipped.get(gunId) === skinId) pendingEquipped.delete(gunId);
      pendingClears.set(`${gunId}/${skinId}`, [gunId, skinId]);
      dirty = true;
      return flush();
    },
    flush,
  };
}
