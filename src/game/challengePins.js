// The challenges the player pinned on the board (up to config/challengeBoard.js maxPins), in the order they were pinned. Ids come from
// game/challengeCatalog.js; one the catalogue no longer knows is kept in storage but skipped by whoever reads it. Inject storage in Node; the
// browser supplies localStorage. Written on every change (a pin is a menu click, not a kill). A NEWER version in storage is left untouched.
import { challengeBoard } from '../config/challengeBoard.js';

const { key: storageKey, version } = challengeBoard.storage;

export function createChallengePins({ storage, key = storageKey } = {}) {
  let ids = [];
  let newer = false;
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    const raw = JSON.parse(storage?.getItem(key) ?? 'null');
    if (Number.isFinite(raw?.version) && raw.version > version) newer = true;
    else if (raw?.version === version && Array.isArray(raw.pins)) {
      ids = [...new Set(raw.pins.filter(id => typeof id === 'string'))].slice(0, challengeBoard.maxPins);
    }
  } catch {
    storage = null; // (a throwing or disabled store: pins live in memory for this session)
  }

  function write() {
    if (newer || !storage) return false;
    try { storage.setItem(key, JSON.stringify({ version, pins: ids })); return true; } catch { return false; }
  }

  return {
    get ids() { return [...ids]; },
    get full() { return ids.length >= challengeBoard.maxPins; },
    has: id => ids.includes(id),
    /** Pin or unpin. Returns true when it is now pinned, false when unpinned, null when the board is full (nothing changed). */
    toggle(id) {
      if (ids.includes(id)) { ids = ids.filter(other => other !== id); write(); return false; }
      if (ids.length >= challengeBoard.maxPins) return null;
      ids = [...ids, id];
      write();
      return true;
    },
  };
}
