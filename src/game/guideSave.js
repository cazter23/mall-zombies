// The Survival Guide's permanent record: which pages have been seen and how many of each subject were cleared.
// Its own localStorage key (config/guide.js guideStorage), apart from the run save, career stats and skins.
// Inject storage in Node; the browser supplies its own. Counting changes memory only: game/guide.js decides when to
// write (a page gaining a paragraph, a run ending, Save & Quit, the page closing), never once per kill.
import { guideStorage, guideEntry } from '../config/guide.js';

const blank = () => ({ version: guideStorage.version, seen: {}, kills: {} });
const object = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});
const whole = (value) => (Number.isSafeInteger(value) && value >= 0 ? value : 0);
// Only pages the book has: an unknown id (a later build's page, or junk) is dropped, never trusted as a key.
const counts = (value) => Object.fromEntries(Object.entries(object(value))
  .filter(([id, count]) => guideEntry(id) && whole(count) > 0).map(([id, count]) => [id, whole(count)]));

function normalize(raw) {
  const data = blank();
  if (raw?.version !== guideStorage.version) return data;
  data.kills = counts(raw.kills);
  for (const [id, seen] of Object.entries(object(raw.seen))) if (guideEntry(id) && seen === true) data.seen[id] = true;
  // What the round a Save & Quit will replay has already been counted (game/guide.js), by page id.
  const replay = counts(raw.replay);
  if (Object.keys(replay).length) data.replay = replay;
  return data;
}

export function createGuideSave({ storage, key = guideStorage.key } = {}) {
  let data = blank();
  let newer = false; // a later build's record is in storage: read nothing from it and never overwrite it
  let dirty = false; // memory holds something storage does not
  const cleared = new Set(); // pages the debug command emptied: a merge must not bring their old count back

  function read() {
    const raw = JSON.parse(storage?.getItem(key) ?? 'null');
    if (Number.isFinite(raw?.version) && raw.version > guideStorage.version) {
      newer = true;
      return blank();
    }
    return normalize(raw);
  }

  try {
    if (storage === undefined) storage = globalThis.localStorage;
    data = read();
  } catch { /* missing, corrupt or blocked storage starts in memory */ }

  const kills = (id) => data.kills[id] ?? 0;
  const seen = (id) => data.seen[id] === true;

  function flush() {
    if (newer || !storage) return false;
    try {
      // Another tab may have written since this one loaded: keep the larger count of each page, and every sighting.
      let stored;
      try { stored = read(); } catch (error) {
        if (!(error instanceof SyntaxError)) return false;
        stored = blank();
      }
      if (newer) return false;
      for (const [id, count] of Object.entries(stored.kills)) if (!cleared.has(id)) data.kills[id] = Math.max(kills(id), count);
      for (const id of Object.keys(stored.seen)) if (!cleared.has(id)) data.seen[id] = true;
      storage.setItem(key, JSON.stringify(data));
      cleared.clear();
      dirty = false;
      return true;
    } catch {
      return false;
    }
  }

  return {
    kills,
    seen,
    snapshot: () => structuredClone(data),
    /** Mark a page seen. True when that is news. */
    see(id) {
      if (!guideEntry(id) || seen(id)) return false;
      data.seen[id] = true;
      dirty = true;
      return true;
    },
    /** Add kills to a page (memory only). Returns the new count. */
    add(id, amount = 1) {
      if (!guideEntry(id) || whole(amount) <= 0) return kills(id);
      data.kills[id] = kills(id) + whole(amount);
      dirty = true;
      return data.kills[id];
    },
    /** True while memory holds something storage does not. */
    get dirty() { return dirty; },
    /** What the round a saved run will replay has already been counted, by page id. Written by Save & Quit only. */
    get replay() { return { ...(data.replay ?? {}) }; },
    setReplay(amounts) {
      const replay = counts(amounts);
      if (Object.keys(replay).length) data.replay = replay;
      else delete data.replay;
      dirty = true;
    },
    /** Debug: empty one page and write at once. */
    clear(id) {
      delete data.kills[id];
      delete data.seen[id];
      cleared.add(id);
      dirty = true;
      return flush();
    },
    flush,
  };
}
