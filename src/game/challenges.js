// Event-driven counters. A new kind supplies one factory with events and optional finish/update/reset/snapshot.
// finish handlers run only at named lifecycle boundaries; a runEnd can finalize a feat after state.over is set.
// Save & Quit replays the current round, so progress paid during it must not be paid again: `credited` is what this
// round has already earned (it travels with the save, in the skin record's `replay`), `replayed` is this attempt's count.
// Only what an attempt earns beyond `credited` is new. A new round, or a run that never loaded a save, starts both empty.
import { skins, gunSkin, skinNotices, challengeDebug } from '../config/skins.js';
import { weapons } from '../config/weapons.js';

// A kill counter: the gun named by the kill's weaponId (never the gun in hand), never a noRewards fan, and `test`.
const killsWhere = test => ({ gunId, skin, advance }) => ({
  events: {
    kill(event) {
      if (event.weaponId === gunId && !event.zombie?.noRewards && test(event, skin.challenge)) advance(1);
    },
  },
});
const farEnough = (distance, min) => min === undefined || (Number.isFinite(distance) && distance >= min);
// The zombies a shot's own hits killed: alive when it was fired (castShot skips the dead), dead now, credited to this gun.
function killedBy(shot, gunId) {
  const killed = new Set();
  for (const { target } of shot.hits ?? []) {
    if (target && !target.isAlive && target.killedByWeaponId === gunId && !target.noRewards) killed.add(target);
  }
  return killed.size;
}

const COUNTERS = {
  kills: killsWhere(() => true),
  headshotKills: killsWhere((kill, c) => kill.headshot === true && farEnough(kill.distance, c.minDistance)),
  rangedKills: killsWhere((kill, c) => farEnough(kill.distance, c.minDistance) && Number.isFinite(kill.distance)),
  quickKills: killsWhere((kill, c) => kill.firstWound?.weaponId === kill.weaponId && kill.firstWound.seconds <= c.seconds),
  typeKills: killsWhere((kill, c) => c.types.includes(kill.zombie?.type?.id)),
  bossKills: killsWhere(kill => !!kill.zombie?.type?.boss),
  bankShotKills: killsWhere((kill, c) => Number.isFinite(kill.bounces) && kill.bounces >= c.minBounces),

  multiKillShots({ gunId, skin, advance }) {
    return {
      events: {
        shot(shot) { // ('shot' is announced after its hits, so its kills have already happened)
          if (shot.weaponId === gunId && killedBy(shot, gunId) >= skin.challenge.minKills) advance(1);
        },
      },
    };
  },

  stoppedAttacks({ gunId, advance }) {
    return {
      events: {
        shot(shot) {
          if (shot.weaponId !== gunId) return;
          const stopped = (shot.hits ?? []).filter(hit => hit.interrupted === true && !hit.target?.noRewards).length;
          if (stopped > 0) advance(stopped);
        },
      },
    };
  },

  // Per-run state: the magazine in progress. A shot that leaves as many rounds as the last one or more began a new magazine
  // (a reload, a refill or a new gun came between). Saved with the run, so Continue resumes the magazine the gun resumes.
  cleanMagazines({ gunId, skin, advance }) {
    const blank = () => ({ left: null, shots: 0, clean: true });
    let mag = blank();
    return {
      events: {
        shot(shot) {
          if (shot.weaponId !== gunId || !Number.isFinite(shot.magazineLeft)) return;
          if (mag.left === null || shot.magazineLeft >= mag.left) mag = blank();
          mag.shots += 1;
          mag.clean &&= (shot.hits ?? []).some(hit => hit.target && !hit.target.noRewards);
          mag.left = shot.magazineLeft;
          if (mag.left === 0 && mag.clean && mag.shots >= skin.challenge.minShots) advance(1);
        },
      },
      reset() { mag = blank(); },
      snapshot: () => ({ ...mag }),
      serialize: () => ({ ...mag }),
      restore(data) {
        mag = blank();
        if (data && (data.left === null || Number.isSafeInteger(data.left)) && Number.isSafeInteger(data.shots)) {
          mag = { left: data.left, shots: data.shots, clean: data.clean === true };
        }
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
      gunId, skinId: skin.id, pa: skinNotices.pa(weapons[gunId].name, skin.name, skin.slot),
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
    // Save & Quit: the receipt list and the per-run counters (a magazine in progress), keyed 'gunId/skinId'.
    serialize() {
      const run = {};
      for (const { gunId, skinId, counter } of counters) if (counter.serialize) run[`${gunId}/${skinId}`] = counter.serialize();
      return { earned: this.earned, run };
    },
    restore(data) {
      earned = (Array.isArray(data?.earned) ? data.earned : [])
        .filter(({ gunId, skinId }) => gunSkin(gunId, skinId) && save.unlocked(gunId, skinId))
        .map(({ gunId, skinId }) => ({ gunId, skinId }));
      for (const { gunId, skinId, counter } of counters) counter.restore?.(data?.run?.[`${gunId}/${skinId}`]);
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
