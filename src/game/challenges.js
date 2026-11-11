// Event-driven counters. A new kind supplies one factory with events and optional finish/update/reset/snapshot.
// finish handlers run only at named lifecycle boundaries; a runEnd can finalize a feat after state.over is set.
// Save & Quit replays the current round, so progress paid during it must not be paid again: `credited` is what this
// round has already earned (it travels with the save, in the skin record's `replay`), `replayed` is this attempt's count.
// Only what an attempt earns beyond `credited` is new. A new round, or a run that never loaded a save, starts both empty.
import { skins, gunSkin, skinNotices, challengeDebug } from '../config/skins.js';
import { weapons } from '../config/weapons.js';

const COUNTERS = {
  kills({ gunId, advance }) {
    return {
      events: {
        kill({ weaponId, zombie }) {
          if (weaponId === gunId && !zombie?.noRewards) advance(1);
        },
      },
    };
  },
};

export function createChallenges({ events, state, save }) {
  let earned = []; // this shift's receipt; permanent unlocks are never rolled back by Continue
  events.on('skinUnlocked', ({ gunId, skinId }) => {
    if (!earned.some(entry => entry.gunId === gunId && entry.skinId === skinId)) earned.push({ gunId, skinId });
  });
  const credited = new Map(); // 'gunId/skinId' -> progress this unfinished round has been paid, over every attempt at it
  const replayed = new Map(); // 'gunId/skinId' -> what this attempt at the round has earned so far
  function newlyEarned(key, amount) {
    const before = replayed.get(key) ?? 0, after = before + amount, paid = credited.get(key) ?? 0;
    replayed.set(key, after);
    if (after > paid) credited.set(key, after);
    return Math.max(0, after - Math.max(paid, before));
  }
  const clearRound = () => { credited.clear(); replayed.clear(); };
  function advance(gunId, skin, amount, persist = false) {
    if (!persist) amount = newlyEarned(`${gunId}/${skin.id}`, amount); // (the debug command is not a kill: it is never a replay)
    if (amount <= 0) return save.progress(gunId, skin.id);
    const needed = skin.challenge.count;
    const before = save.progress(gunId, skin.id);
    const count = Math.max(before, Math.min(needed, before + amount));
    const unlock = !save.unlocked(gunId, skin.id) && count >= needed;
    save.record(gunId, skin.id, count, unlock);
    if (unlock || persist) save.flush();
    if (count !== before) events.emit('challengeProgress', { gunId, skinId: skin.id, count, needed });
    if (unlock) events.emit('skinUnlocked', {
      gunId, skinId: skin.id, pa: skinNotices.pa(weapons[gunId].name, skin.name),
    });
    return count;
  }

  const counters = [];
  const lifecycle = new Map();
  for (const [gunId, entries] of Object.entries(skins)) {
    for (const skin of entries) {
      const factory = COUNTERS[skin.challenge?.kind];
      if (!factory) continue;
      const counter = factory({ gunId, skin, advance: amount => advance(gunId, skin, amount) });
      counters.push({ gunId, skinId: skin.id, counter });
      for (const [event, handler] of Object.entries(counter.events ?? {})) {
        events.on(event, payload => { if (!state.assisted && !state.over) handler(payload); });
      }
      for (const [event, handler] of Object.entries(counter.finish ?? {})) {
        if (!lifecycle.has(event)) lifecycle.set(event, []);
        lifecycle.get(event).push(handler);
      }
    }
  }
  for (const [event, handlers] of lifecycle) events.on(event, payload => {
    if (state.assisted || (state.over && event !== 'runEnd')) return;
    for (const handler of handlers) handler(payload);
  });
  // Write prior eligible progress, including when the rest of the run became assisted (nothing new = no write).
  const flushIfDirty = () => (save.dirty ? save.flush() : false);
  events.on('runEnd', flushIfDirty);
  // Save & Quit keeps the progress and records what the round it will replay has already been paid.
  events.on('runSaved', () => { save.setReplay(Object.fromEntries(credited)); save.flush(); });
  events.on('roundStart', clearRound); // (the save's snapshot moves here: nothing before it is replayed)
  events.on('runLoaded', () => { // (after the load's own reset and any 'roundStart' its restore announced)
    clearRound();
    for (const [key, amount] of Object.entries(save.replay)) credited.set(key, amount);
  });
  // Quit to title and Restart run end a run without a 'runEnd': write what it earned (nothing to write = no write).
  events.on('runReset', flushIfDirty);

  return {
    get earned() { return earned.map(entry => ({ ...entry })); },
    serialize() { return { earned: this.earned }; },
    restore(data) {
      earned = (Array.isArray(data?.earned) ? data.earned : [])
        .filter(({ gunId, skinId }) => gunSkin(gunId, skinId) && save.unlocked(gunId, skinId))
        .map(({ gunId, skinId }) => ({ gunId, skinId }));
    },
    snapshot() {
      return {
        ...save.snapshot(),
        earned: this.earned,
        run: Object.fromEntries(counters.filter(({ counter }) => counter.snapshot)
          .map(({ gunId, skinId, counter }) => [`${gunId}/${skinId}`, counter.snapshot()])),
      };
    },
    update(dt) {
      if (state.assisted || state.over) return;
      for (const { counter } of counters) counter.update?.(dt);
    },
    /** Write unsaved progress now (main.js: the page is closing). No-op when storage is already current. */
    flush: flushIfDirty,
    reset() {
      earned = [];
      clearRound();
      for (const { counter } of counters) counter.reset?.();
    },
    debug(gunId, skinId, action, amount = 1) {
      const skin = gunSkin(gunId, skinId);
      if (!skin?.challenge || !COUNTERS[skin.challenge.kind]) return challengeDebug.unknownChallenge;
      if (action === 'clear') {
        save.clear(gunId, skinId);
        events.emit('challengeProgress', { gunId, skinId, count: 0, needed: skin.challenge.count });
        return challengeDebug.cleared(skin.name);
      }
      if (action !== 'add' && action !== 'complete') return challengeDebug.usage;
      if (action === 'add' && (!Number.isSafeInteger(amount) || amount <= 0)) return challengeDebug.invalidAmount;
      const count = advance(gunId, skin, action === 'complete' ? skin.challenge.count : amount, true);
      return challengeDebug.changed(skin.name, count, skin.challenge.count);
    },
  };
}
