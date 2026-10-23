// =============================================================================
// ROUNDS (waves)
// COD-style round flow, on the fixed tick:
//   active -> zombies spawn one at a time (count, pace and max-alive from
//             economy.js) until the round's quota is out; when every zombie
//             is dead the round is over
//   break  -> the round number goes up IMMEDIATELY (banner + counter), a short
//             pause (BO2-style), then the new round's zombies start trickling in
// Zombie health and gait mix scale with the round (see the zombie manager). Each spawn's TYPE comes
// from economy.zombieMix (Mall Walkers from round 4); the first time a type shows up in a run,
// onTypeIntro fires (the "Mall Walkers have entered the building" banner).
// =============================================================================

import {
  economy,
  zombieCountForRound,
  spawnDelayForRound,
  maxAliveForRound,
  zombieTypeForRound,
} from '../config/economy.js';

/**
 * @param zombies       zombie manager (spawn, aliveCount, clear)
 * @param onRoundStart  (round) => void   the round number just went up: show the "ROUND 3" banner
 *                                        (happens at the START of the break before that round)
 * @param onTypeIntro   (typeId) => void   a zombie type spawned for the first time this run
 */
export function createRounds({ zombies, onRoundStart = null, onTypeIntro = null }) {
  const cfg = economy.rounds;
  let started = false;
  let round = 0;
  let state = 'idle'; // 'idle' | 'active' | 'break'
  let toSpawn = 0; // zombies still to spawn this round
  let spawnTimer = 0;
  let breakTimer = 0;
  let spawnedThisRound = 0;
  const seenTypes = new Set(); // zombie types that have spawned this run

  // The type of the next spawn. In the first round a special type can appear, its
  // introSpawnIndex-th spawn is forced to be one (if none has come yet), so it always shows up.
  function nextType() {
    for (const [typeId, mix] of Object.entries(economy.zombieMix)) {
      if (!seenTypes.has(typeId) && round >= mix.fromRound && spawnedThisRound >= mix.introSpawnIndex) return typeId;
    }
    return zombieTypeForRound(round);
  }

  // Announce round n now; its zombies start spawning after `delay` seconds.
  function announce(n, delay) {
    round = n;
    toSpawn = zombieCountForRound(n);
    spawnedThisRound = 0;
    if (delay > 0) {
      state = 'break';
      breakTimer = delay;
    } else {
      state = 'active';
    }
    spawnTimer = 0;
    if (onRoundStart) onRoundStart(n);
  }

  return {
    get round() {
      return round;
    },
    get state() {
      return state;
    },
    get started() {
      return started;
    },
    get remainingToSpawn() {
      return toSpawn;
    },

    // True during the pause before a round's zombies arrive (the HUD blinks the counter).
    get inBreak() {
      return state === 'break';
    },

    // Kick off round 1 (call when the player first starts playing).
    start() {
      if (started) return;
      started = true;
      announce(1, cfg.firstRoundDelay);
    },

    update(dt) {
      if (state === 'active') {
        spawnTimer -= dt;
        if (toSpawn > 0 && spawnTimer <= 0 && zombies.aliveCount < maxAliveForRound(round)) {
          const typeId = nextType();
          if (zombies.spawn(typeId)) {
            toSpawn -= 1;
            spawnedThisRound += 1;
            if (!seenTypes.has(typeId)) {
              seenTypes.add(typeId);
              if (onTypeIntro) onTypeIntro(typeId);
            }
            spawnTimer = spawnDelayForRound(round);
          } else {
            spawnTimer = cfg.spawnRetrySeconds; // no usable spawn point right now: try again shortly
          }
        }
        // Round over: the next round number goes up right away, then the short break.
        if (toSpawn === 0 && zombies.aliveCount === 0) announce(round + 1, cfg.breakSeconds);
      } else if (state === 'break') {
        breakTimer -= dt;
        if (breakTimer <= 0) {
          state = 'active';
          spawnTimer = 0; // the first zombie of the round comes right as the break ends
        }
      }
    },

    // Debug: end the current round right now and jump straight into the next one (no break).
    skipRound() {
      if (!started) return this.start();
      zombies.clear();
      announce(round + 1, 0);
    },

    // Debug: clear the zombies and jump straight to round `n` (no break).
    jumpTo(n) {
      if (!started) started = true;
      zombies.clear();
      announce(Math.max(1, Math.round(n)), 0);
    },

    // New run: back to "not started" (round 1 begins when play starts).
    reset() {
      started = false;
      round = 0;
      state = 'idle';
      toSpawn = 0;
      spawnTimer = 0;
      breakTimer = 0;
      spawnedThisRound = 0;
      seenTypes.clear();
    },
  };
}
