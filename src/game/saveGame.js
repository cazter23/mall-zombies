// =============================================================================
// SAVE & QUIT: one save slot, Black Ops 6 style. No DOM: the browser passes localStorage (tests pass their own storage).
//
// The rules (the user's): saving ENDS the run; you can save at any time while alive and at full health; the save is the
// run as it stood at the START of the current round (points, purchases and Closing Time progress made since are not
// kept); loading deletes the slot and replays that round from its break, with the same draws (boss, Flash Sale, claw site).
//
// How: each 'roundStart' raises a flag, and at the end of that tick (after every 'roundStart' listener has rolled its
// draws) createGame calls update(), which takes a snapshot: every save step's serialize(), as plain JSON. Nothing about
// live zombies is ever saved. saveAndQuit() writes that snapshot; load() runs Play again's reset, then every step's restore.
//
//   const saves = createSaveGame({ steps, events, stats, state, rounds, resetRun, storage })
//     steps          [[name, serialize, restore(data)], ...] in restore order (createGame.js saveSteps)
//   saves.markRoundStart()   a round began: snapshot at the end of this tick
//   saves.update()           (end of each tick) takes the pending snapshot
//   saves.canSave()          { ok, reason }: a round has started, you are alive, at full health
//   saves.saveAndQuit()      writes the slot, announces 'runSaved' { round }; the caller ends the run (main.js: to the title)
//   saves.peek()             { round, savedAt } or null; an older version's save is dropped (saves.dropped turns true once)
//   saves.load()             true if a run was loaded: the slot is deleted FIRST, then reset + restore; 'runLoaded' { round }
//   saves.discard()          delete the slot (Play from the title with a save present)
//   saves.reset()            Play again: no snapshot yet
// =============================================================================
import { save as cfg } from '../config/save.js';

function memoryStorage() {
  const items = new Map();
  return {
    getItem: (key) => (items.has(key) ? items.get(key) : null),
    setItem: (key, value) => { items.set(key, String(value)); },
    removeItem: (key) => { items.delete(key); },
  };
}

export function createSaveGame({ steps, events, stats, state, rounds, resetRun, storage, config = cfg }) {
  let target = storage;
  try {
    target ??= globalThis.localStorage ?? memoryStorage();
  } catch {
    target = memoryStorage(); // (blocked storage must never stop the game)
  }
  let pending = false;
  let snapshot = null; // { round, data } at the start of the current round
  let dropped = false;

  const read = () => {
    try {
      return JSON.parse(target.getItem(config.storageKey) ?? 'null');
    } catch {
      return null;
    }
  };
  const remove = () => {
    try { target.removeItem(config.storageKey); } catch { /* (nothing to do) */ }
  };
  const valid = (saved) => saved && saved.version === config.version && Number.isInteger(saved.round) && saved.data;

  const serializeAll = () => JSON.parse(JSON.stringify(Object.fromEntries(steps.map(([name, serialize]) => [name, serialize()]))));

  return {
    get snapshot() { return snapshot; },
    /** True once an older version's save was found and dropped (main.js shows a notice). */
    get dropped() { return dropped; },
    stepNames: steps.map(([name]) => name),

    /** What a snapshot taken right now would hold (tests: a load must give back exactly what was saved). */
    serializeNow: serializeAll,

    markRoundStart() {
      pending = true;
    },

    update() {
      if (!pending || state.over) return;
      pending = false;
      snapshot = { round: rounds.round, data: serializeAll() };
    },

    canSave() {
      if (state.over) return { ok: false, reason: config.reasons.dead };
      if (state.winPending) return { ok: false, reason: config.reasons.shiftComplete }; // (the win receipt is up: Clock out or overtime first)
      if (!snapshot) return { ok: false, reason: config.reasons.noRound };
      if (stats.health < stats.maxHealth) return { ok: false, reason: config.reasons.hurt };
      return { ok: true, reason: null };
    },

    saveAndQuit() {
      if (!this.canSave().ok) return false;
      // A snapshot that is due (a round or overtime began and no tick has run since: the pause screen comes up right after
      // Stay for overtime) is taken now, or the save would be the round before it.
      if (snapshot) this.update();
      try {
        target.setItem(config.storageKey, JSON.stringify({
          version: config.version, round: snapshot.round, savedAt: new Date().toISOString(), data: snapshot.data,
        }));
      } catch {
        return false; // (storage full or blocked: the run goes on)
      }
      events.emit('runSaved', { round: snapshot.round });
      return true;
    },

    peek() {
      const saved = read();
      if (!saved) return null;
      if (!valid(saved)) {
        remove();
        dropped = true;
        return null;
      }
      return { round: saved.round, savedAt: saved.savedAt };
    },

    load() {
      const saved = read();
      remove(); // (first: a load that fails part-way can't be loaded again)
      if (!valid(saved)) {
        if (saved) dropped = true;
        return false;
      }
      resetRun();
      try {
        for (const [name, , restore] of steps) if (saved.data[name] !== undefined) restore(saved.data[name]);
      } catch (error) {
        console.warn('Save & Quit: the save could not be loaded', error);
        resetRun();
        dropped = true;
        return false;
      }
      snapshot = { round: saved.round, data: saved.data }; // (save again straight away = the same save)
      pending = false;
      events.emit('runLoaded', { round: saved.round });
      return true;
    },

    discard() {
      remove();
    },

    reset() {
      pending = false;
      snapshot = null;
    },
  };
}
