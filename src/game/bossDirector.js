import { bossTiming, bossTypes } from '../config/bosses.js';
import { economy, maxAliveForRound, zombieCountForRound } from '../config/economy.js';
import { createJanitorBehavior } from '../zombies/bosses/janitor.js';
import { createManagerBehavior } from '../zombies/bosses/manager.js';
import { createGuardBehavior } from '../zombies/bosses/guard.js';
import { createInfluencerBehavior } from '../zombies/bosses/influencer.js';
import { createLastCustomerBehavior } from '../zombies/bosses/lastCustomer.js';
import * as zombieConfig from '../config/zombies.js';

const behaviors = { janitor: createJanitorBehavior, manager: createManagerBehavior, guard: createGuardBehavior, influencer: createInfluencerBehavior, lastCustomer: createLastCustomerBehavior };

export function bossIntroRounds(variants = zombieConfig.mascotVariants ?? {}) {
  return new Set([...Object.values(economy.zombieMix).map(({ fromRound }) => fromRound),
    ...Object.values(variants).map(({ unlockRound }) => unlockRound)]);
}

export function isEncoreRound(round, intros = bossIntroRounds()) {
  const cfg = bossTiming.encores;
  return round >= cfg.fromRound && (round-cfg.fromRound)%cfg.everyRounds === 0 && !intros.has(round);
}

export function chooseBossSchedule(random = Math.random) {
  const intros = bossIntroRounds(); // (never a zombie type's or a Mascot costume's debut)
  const schedule = new Map();
  for (const [id, type] of Object.entries(bossTypes)) {
    const rounds = (type.firstRounds ?? []).filter(round => !intros.has(round) && !schedule.has(round));
    if (rounds.length) schedule.set(rounds[Math.floor(random() * rounds.length)], id);
  }
  return new Map([...schedule].sort(([a], [b]) => a - b));
}

// `surfaces`: game/surfaceSlows.js. The active boss's slow (behavior.surfaceSpeed: the Janitor's wet floor, the Guard's
// taser) is reported there as 'boss', never written to the stat itself: Scoops' melt reports too and the lowest wins.
export function createBossDirector({ events, rounds, zombies, scene, colliders, player, surfaces, powerUps, state, map }) {
  let schedule = null;
  let active = null;
  let behavior = null;
  let spawned = false;
  let retry = 0;
  const met = new Set();
  let lastBoss = null;
  const pending = () => !spawned && !!schedule?.has(rounds.round);

  function clear(reason = 'clear') {
    active = null;
    behavior?.dispose(reason);
    behavior = null;
    surfaces.clear('boss');
  }

  function spawn(id) {
    if (state.over || spawned || active) return null;
    const marker = bossTypes[id].spawnMarker;
    const zombie = marker ? zombies.spawn(id, null, { spawnPoints: map.spawnPoints.filter(({ name }) => name === marker) }) : zombies.spawn(id);
    if (!zombie) return null;
    active = zombie;
    if (bossTypes[id].encore !== false) {
      met.add(id);
      lastBoss = id;
    }
    spawned = true;
    behavior = behaviors[id]({
      zombie, scene, colliders, player, powerUps, zombies, rounds, map, events,
      onPhase: (phase) => events.emit('bossPhase', { zombie, phase, round: rounds.round }),
    });
    events.emit('bossSpawn', { zombie, round: rounds.round });
    return zombie;
  }

  events.on('roundStart', () => {
    schedule ??= chooseBossSchedule();
    if (isEncoreRound(rounds.round) && !schedule.has(rounds.round) && met.size) {
      const alternatives = [...met].filter(id => id !== lastBoss);
      const pool = alternatives.length ? alternatives : [...met];
      schedule.set(rounds.round, pool[Math.floor(Math.random()*pool.length)]);
    }
    spawned = false;
    retry = 0;
  });
  events.on('roundDiscard', () => clear('discard'));
  events.on('hit', hit => { if (hit.target === active) behavior?.onHit?.(hit); });
  events.on('playerHit', hit => { if (hit.zombie === active) behavior?.onPlayerHit?.(hit); });
  events.on('playerDeath', () => {
    clear('death');
    zombies.clearBosses();
  });
  events.on('kill', ({ zombie }) => {
    if (state.over || zombie !== active) return;
    clear('defeated');
    events.emit('bossDefeated', { zombie, round: rounds.round });
  });

  return {
    get active() { return active; },
    get pending() { return pending(); },
    get patches() { return behavior?.patches ?? []; },
    get scheduledRound() { return [...(schedule?.keys() ?? [])][0] ?? null; },
    // A booking owns the one boss slot for that round, replacing an encore or a debut. It is saved in the same schedule.
    book(round, id) {
      if (state.over || !Object.hasOwn(bossTypes, id) || !Number.isInteger(round) || round <= 0 || round < rounds.round || (round === rounds.round && spawned)) return false;
      schedule ??= chooseBossSchedule();
      schedule.set(round, id);
      schedule = new Map([...schedule].sort(([a], [b]) => a - b));
      return true;
    },
    summon(id = schedule?.get(rounds.round) ?? 'janitor') { return bossTypes[id] ? spawn(id) : null; },
    update(dt, allowSpawn = true) {
      if (active && !zombies.zombies.includes(active)) {
        const zombie = active;
        clear('vanished');
        events.emit('bossVanished', { zombie, round: rounds.round });
      }
      if (active) {
        behavior.update(dt);
        surfaces.set('boss', behavior.surfaceSpeed ?? 1);
        return;
      }
      if (!allowSpawn || !pending() || rounds.state !== 'active') return;
      const quota = zombieCountForRound(rounds.round);
      if (quota - rounds.remainingToSpawn < Math.ceil(quota * bossTiming.waveFraction)) return;
      if (zombies.aliveCount >= maxAliveForRound(rounds.round)) return;
      retry -= dt;
      if (retry <= 0 && !spawn(schedule.get(rounds.round))) retry = bossTiming.retrySeconds;
    },
    // Save & Quit (game/saveGame.js): the run's boss schedule (encores included), who you have met, and the last one. The boss
    // of the saved round is still to come, so a replay meets the same boss.
    serialize() {
      return { schedule: schedule ? [...schedule] : null, met: [...met], lastBoss };
    },
    restore(data) {
      schedule = data.schedule ? new Map(data.schedule) : null;
      met.clear();
      for (const id of data.met) if (bossTypes[id]?.encore !== false) met.add(id);
      lastBoss = data.lastBoss;
      spawned = false;
      retry = 0;
    },

    reset() {
      clear('reset');
      schedule = null;
      spawned = false;
      retry = 0;
      met.clear();
      lastBoss = null;
    },
  };
}
