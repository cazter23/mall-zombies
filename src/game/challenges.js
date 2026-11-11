// Event-driven counters. A new kind supplies one factory with events and optional finish/update/reset/snapshot.
// A factory gets { gunId, skin, advance, best, live, tick }: advance(n) adds to a running total (slots 1 and 2); best(value) records a
// feat's best attempt (slot 3: progress is the best ever, never a sum, so a replayed round cannot pay twice); live({ value, failed })
// tells the tracker how the attempt in progress stands ('challengeLive'); tick() = this game's tick count (to tell shots apart).
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

  // --- Slot 3: feats (one run). Round feats are decided when the round is cleared ('roundStart' announces the next one at that moment);
  // a round thrown away by a debug skip or by overtime is not decided. Run feats keep their state in the Save & Quit slot. ---

  // Reach a round having never bought, won or fired another gun (the box cutter and equipment are fine). Progress = the round reached.
  loyalty({ gunId, best, live }) {
    let spoiled = false;
    const spoil = () => { if (!spoiled) { spoiled = true; live({ value: 0, failed: true }); } };
    return {
      events: {
        purchase({ kind, id }) { if (kind === 'weapon' && id !== gunId) spoil(); },
        clawPrize({ gunId: prize }) { if (prize && prize !== gunId) spoil(); },
        shot({ weaponId }) { if (weaponId && weaponId !== gunId) spoil(); },
        roundDiscard({ reason }) { if (reason === 'debug') spoil(); }, // (a debug jump is not reaching a round)
        roundStart({ round }) { // (round 1 is reached by everyone: nothing to record)
          if (spoiled) return;
          if (round > 1) best(round);
          live({ value: round });
        },
      },
      reset() { spoiled = false; },
      snapshot: () => ({ spoiled }), serialize: () => ({ spoiled }),
      restore(data) { spoiled = data?.spoiled === true; },
    };
  },

  // Kill a boss (from minRound on) that nothing but this gun ever hurt.
  soloBoss({ gunId, skin, best, live }) {
    const onlyThis = zombie => zombie.woundedBy.size > 0 && [...zombie.woundedBy].every(id => id === gunId);
    let round = 0;
    const counts = () => round >= (skin.challenge.minRound ?? 0);
    return {
      events: {
        roundStart({ round: next }) { round = next; },
        bossSpawn() { if (counts()) live({ value: 0 }); },
        hit({ target }) { if (counts() && target?.type?.boss && !target.noRewards && !onlyThis(target)) live({ value: 0, failed: true }); },
        kill(event) {
          const zombie = event.zombie;
          if (counts() && event.weaponId === gunId && zombie?.type?.boss && !zombie.noRewards && onlyThis(zombie)) { best(1); live({ value: 1 }); }
        },
      },
      reset() { round = 0; },
      snapshot: () => ({ round }), serialize: () => ({ round }),
      restore(data) { round = Number.isSafeInteger(data?.round) ? data.round : 0; },
    };
  },

  // Kills with this gun inside one round.
  roundKills({ gunId, best, live }) {
    let kills = 0;
    return {
      events: {
        kill(event) {
          if (event.weaponId !== gunId || event.zombie?.noRewards) return;
          kills += 1;
          best(kills); live({ value: kills });
        },
        roundStart() { kills = 0; },
        roundDiscard() { kills = 0; },
      },
      reset() { kills = 0; },
    };
  },

  // A round from minRound on in which every kill (whatever made it) was a headshot kill with this gun.
  headshotRound({ gunId, skin, best, live }) {
    let round = 0, kills = 0, failed = false;
    const counts = () => round >= skin.challenge.minRound;
    return {
      events: {
        kill(event) {
          if (event.zombie?.noRewards || !counts() || failed) return;
          if (event.weaponId === gunId && event.headshot === true) { kills += 1; live({ value: kills }); }
          else { failed = true; live({ value: kills, failed: true }); }
        },
        roundStart({ round: next }) {
          if (counts() && !failed && kills > 0) best(1);
          round = next; kills = 0; failed = false;
          if (counts()) live({ value: 0 });
        },
        roundDiscard() { failed = true; },
      },
      reset() { round = 0; kills = 0; failed = false; },
      snapshot: () => ({ round }), serialize: () => ({ round }),
      restore(data) { round = Number.isSafeInteger(data?.round) ? data.round : 0; }, // (a loaded run replays this round from its break)
    };
  },

  // Finish a Mascot within maxBlasts blasts of this gun after its helmet comes off, with nothing else hurting it in between.
  mascotFinish({ gunId, skin, best, live, tick }) {
    const popped = new Map(); // zombie -> { at: the tick it popped, blasts, spoiled, before: what had hurt it by then }
    const spoils = (entry, zombie) => entry.spoiled || [...zombie.woundedBy].some(id => id !== gunId && !entry.before.has(id));
    return {
      events: {
        mascotHeadPop({ zombie, again }) {
          if (!again && !zombie.noRewards) popped.set(zombie, { at: tick(), blasts: 0, spoiled: false, before: new Set(zombie.woundedBy) });
        },
        mascotReclaim({ zombie }) { popped.delete(zombie); },
        shot(shot) {
          // A later blast (not the one that popped it) that leaves it standing; another gun's shot spoils it.
          const targets = new Set((shot.hits ?? []).map(hit => hit.target));
          for (const target of targets) {
            const entry = popped.get(target);
            if (!entry || !target.isAlive || entry.at === tick()) continue;
            if (shot.weaponId !== gunId) entry.spoiled = true;
            else if (++entry.blasts >= skin.challenge.maxBlasts) entry.spoiled = true;
          }
        },
        hit({ target, melee }) { if (melee && popped.has(target)) popped.get(target).spoiled = true; },
        kill(event) {
          const entry = popped.get(event.zombie);
          if (!entry) return;
          popped.delete(event.zombie);
          if (event.weaponId === gunId && !spoils(entry, event.zombie)) { best(1); live({ value: 1 }); }
        },
        roundStart() { popped.clear(); },
      },
      reset() { popped.clear(); },
    };
  },

  // Headshot kills with this gun in a row; a hit with it anywhere but the head starts again. Progress = the longest run.
  headshotStreak({ gunId, best, live }) {
    let streak = 0;
    return {
      events: {
        kill(event) {
          if (event.weaponId !== gunId || event.zombie?.noRewards || event.headshot !== true) return;
          streak += 1;
          best(streak); live({ value: streak });
        },
        shot(shot) {
          if (shot.weaponId !== gunId || streak === 0) return;
          if ((shot.hits ?? []).some(hit => hit.target?.type && !hit.target.noRewards && hit.part !== 'head')) {
            live({ value: streak, failed: true });
            streak = 0;
          }
        },
      },
      reset() { streak = 0; },
      snapshot: () => ({ streak }), serialize: () => ({ streak }),
      restore(data) { streak = Number.isSafeInteger(data?.streak) && data.streak > 0 ? data.streak : 0; },
    };
  },

  // Bosses killed with this gun in one run.
  bossKillsInRun({ gunId, best, live }) {
    let bosses = 0;
    return {
      events: {
        kill(event) {
          if (event.weaponId !== gunId || !event.zombie?.type?.boss || event.zombie.noRewards) return;
          bosses += 1;
          best(bosses); live({ value: bosses });
        },
      },
      reset() { bosses = 0; },
      snapshot: () => ({ bosses }), serialize: () => ({ bosses }),
      restore(data) { bosses = Number.isSafeInteger(data?.bosses) && data.bosses > 0 ? data.bosses : 0; },
    };
  },

  // A cleared round in which every shot of this gun hit something, and it fired at least minShots.
  perfectRound({ gunId, skin, best, live }) {
    let shots = 0, failed = false;
    return {
      events: {
        shot(shot) {
          if (shot.weaponId !== gunId || failed) return;
          if ((shot.hits ?? []).some(hit => hit.target)) { shots += 1; live({ value: shots }); }
          else { failed = true; live({ value: shots, failed: true }); }
        },
        roundStart() {
          if (!failed && shots >= skin.challenge.minShots) best(1);
          shots = 0; failed = false;
        },
        roundDiscard() { failed = true; },
      },
      reset() { shots = 0; failed = false; },
    };
  },

  // A cleared round from minRound on without being hurt, having blown minStopped zombies out of an attack with this gun.
  calmRound({ gunId, skin, best, live }) {
    let round = 0, stopped = 0, hurt = false;
    const counts = () => round >= skin.challenge.minRound;
    const ouch = () => { if (!hurt && counts()) live({ value: stopped, failed: true }); hurt = true; };
    return {
      events: {
        playerHit({ damage }) { if (damage > 0) ouch(); },
        playerFall({ damage }) { if (damage > 0) ouch(); },
        shot(shot) {
          if (shot.weaponId !== gunId || hurt || !counts()) return;
          const n = (shot.hits ?? []).filter(hit => hit.interrupted === true && !hit.target?.noRewards).length;
          if (n > 0) { stopped += n; live({ value: stopped }); }
        },
        roundStart({ round: next }) {
          if (counts() && !hurt && stopped >= skin.challenge.minStopped) best(1);
          round = next; stopped = 0; hurt = false;
        },
        roundDiscard() { hurt = true; },
      },
      reset() { round = 0; stopped = 0; hurt = false; },
      snapshot: () => ({ round }), serialize: () => ({ round }),
      restore(data) { round = Number.isSafeInteger(data?.round) ? data.round : 0; }, // (a loaded run replays this round from its break)
    };
  },

  // Kills by one ball of this gun. Progress = the most any one ball has made.
  ballKills({ gunId, best, live }) {
    const perBall = new Map();
    return {
      events: {
        kill(event) {
          if (event.weaponId !== gunId || event.projectile == null || event.zombie?.noRewards) return;
          const kills = (perBall.get(event.projectile) ?? 0) + 1;
          perBall.set(event.projectile, kills);
          best(kills); live({ value: kills });
        },
        roundStart() { perBall.clear(); },
      },
      reset() { perBall.clear(); },
    };
  },

  // Finish a zombie of one of these types with this gun (Return to Sender: the Last Customer, returned while Speechless).
  finishType({ gunId, skin, best, live }) {
    return {
      events: {
        kill(event) {
          if (event.weaponId === gunId && !event.zombie?.noRewards && skin.challenge.types.includes(event.zombie?.type?.id)) { best(1); live({ value: 1 }); }
        },
      },
    };
  },

  // The Closing Time rewards (slots 4 and 5, one copy per gun, all unlocked by the same win): the shift is won ('runWon' is announced the
  // moment the van leaves, before the clock-out choice) in one of the skin's modes. A debug-assisted run earns nothing.
  closingWin({ skin, best }) {
    return {
      events: {
        runWon({ summary }) {
          if (summary?.won && !summary.assisted && skin.challenge.modes.includes(summary.closingMode)) best(1);
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
  // A skin was earned. A shared reward (every gun gets it at once) is announced, and listed on the receipt, only once.
  function announce(gunId, skin) {
    if (skin.shared && earned.some(entry => entry.skinId === skin.id)) return;
    const gunName = weapons[gunId].name;
    events.emit('skinUnlocked', {
      gunId, skinId: skin.id, shared: skin.shared === true,
      pa: skin.shared ? skinNotices.sharedPa(skin.name) : skinNotices.pa(gunName, skin.name, skin.slot),
    });
  }
  // A feat's best attempt: progress only ever goes up, to its count (unlocking there). Idempotent, so Save & Quit needs no ledger.
  function best(gunId, skin, value) {
    const needed = skin.challenge.count;
    const before = save.progress(gunId, skin.id);
    const count = Math.min(needed, Math.max(before, Math.floor(value)));
    if (count <= before) return before;
    const unlock = !save.unlocked(gunId, skin.id) && count >= needed;
    save.record(gunId, skin.id, count, unlock);
    if (unlock) save.flush();
    events.emit('challengeProgress', { gunId, skinId: skin.id, count, needed });
    if (unlock) announce(gunId, skin);
    return count;
  }
  // How the attempt in progress stands, for the tracker: { value, needed, failed }. Announced only when it changes.
  const attempts = new Map();
  function live(gunId, skin, { value, failed = false }) {
    const key = `${gunId}/${skin.id}`, last = attempts.get(key);
    if (last && last.value === value && last.failed === failed) return;
    const attempt = { value, needed: skin.challenge.count, failed };
    attempts.set(key, attempt);
    events.emit('challengeLive', { gunId, skinId: skin.id, ...attempt });
  }
  let ticks = 0;
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
    if (unlock) announce(gunId, skin);
    return count;
  }

  const counters = [];
  const lifecycle = new Map();
  for (const [gunId, entries] of Object.entries(skins)) {
    for (const skin of entries) {
      const factory = COUNTERS[skin.challenge?.kind];
      if (!factory) continue;
      const counter = factory({
        gunId, skin, advance: amount => advance(gunId, skin, amount), best: value => best(gunId, skin, value),
        live: attempt => live(gunId, skin, attempt), tick: () => ticks,
      });
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
      attempts.clear();
      for (const { gunId, skinId, counter } of counters) { counter.reset?.(); counter.restore?.(data?.run?.[`${gunId}/${skinId}`]); }
    },
    /** The tracker's view of an attempt in progress this run ({ value, needed, failed }), or null before anything happened. */
    attempt(gunId, skinId) {
      const attempt = attempts.get(`${gunId}/${skinId}`);
      return attempt ? { ...attempt } : null;
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
      ticks += 1;
      if (state.assisted || state.over) return;
      for (const { counter } of counters) counter.update?.(dt);
    },
    /** Write unsaved progress now (main.js: the page is closing). No-op when storage is already current. */
    flush: flushIfDirty,
    reset() {
      earned = [];
      attempts.clear();
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
