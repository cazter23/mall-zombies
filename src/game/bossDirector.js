import { bossTiming, bossTypes } from '../config/bosses.js';
import { economy, maxAliveForRound, zombieCountForRound } from '../config/economy.js';
import { mascotVariants } from '../config/zombies.js';
import { createJanitorBehavior } from '../zombies/bosses/janitor.js';

const behaviors = { janitor: createJanitorBehavior };

export function chooseBossSchedule(random = Math.random) {
  // A boss never shares a round with a zombie type's or a Mascot costume's debut.
  const intros = new Set([
    ...Object.values(economy.zombieMix).map(({ fromRound }) => fromRound),
    ...Object.values(mascotVariants).map(({ unlockRound }) => unlockRound),
  ]);
  const schedule = new Map();
  for (const [id, type] of Object.entries(bossTypes)) {
    const rounds = type.firstRounds.filter(round => !intros.has(round) && !schedule.has(round));
    if (rounds.length) schedule.set(rounds[Math.floor(random() * rounds.length)], id);
  }
  return schedule;
}

export function createBossDirector({ events, rounds, zombies, scene, colliders, player, stats, powerUps, state }) {
  let schedule = null;
  let active = null;
  let behavior = null;
  let spawned = false;
  let retry = 0;
  const pending = () => !spawned && !!schedule?.has(rounds.round);

  function clear() {
    active = null;
    behavior?.dispose();
    behavior = null;
    stats.surfaceSpeed = 1;
  }

  function spawn(id) {
    if (state.over || spawned || active) return null;
    const zombie = zombies.spawn(id);
    if (!zombie) return null;
    active = zombie;
    spawned = true;
    behavior = behaviors[id]({
      zombie, scene, colliders, player, powerUps,
      onPhase: (phase) => events.emit('bossPhase', { zombie, phase, round: rounds.round }),
    });
    events.emit('bossSpawn', { zombie, round: rounds.round });
    return zombie;
  }

  events.on('roundStart', () => {
    schedule ??= chooseBossSchedule();
    spawned = false;
    retry = 0;
  });
  events.on('roundDiscard', clear);
  events.on('playerDeath', () => {
    clear();
    zombies.clearBosses();
  });
  events.on('kill', ({ zombie }) => {
    if (state.over || zombie !== active) return;
    clear();
    events.emit('bossDefeated', { zombie, round: rounds.round });
  });

  return {
    get active() { return active; },
    get pending() { return pending(); },
    get patches() { return behavior?.patches ?? []; },
    get scheduledRound() { return [...(schedule?.keys() ?? [])][0] ?? null; },
    summon() { return spawn(schedule?.get(rounds.round) ?? Object.keys(bossTypes)[0]); },
    update(dt, allowSpawn = true) {
      if (active && !zombies.zombies.includes(active)) clear();
      if (active) {
        stats.surfaceSpeed = behavior.update(dt);
        return;
      }
      if (!allowSpawn || !pending() || rounds.state !== 'active') return;
      const quota = zombieCountForRound(rounds.round);
      if (quota - rounds.remainingToSpawn < Math.ceil(quota * bossTiming.waveFraction)) return;
      if (zombies.aliveCount >= maxAliveForRound(rounds.round)) return;
      retry -= dt;
      if (retry <= 0 && !spawn(schedule.get(rounds.round))) retry = bossTiming.retrySeconds;
    },
    reset() {
      clear();
      schedule = null;
      spawned = false;
      retry = 0;
    },
  };
}
