// =============================================================================
// ROUNDS (waves)
// COD-style round flow, on the fixed tick:
//   active -> zombies spawn one at a time (count, pace and max-alive from
//             economy.js) until the round's quota is out; when every zombie
//             is dead the round is over
//   break  -> a short pause, then the next round is announced and starts
// Zombie health and gait mix scale with the round (see the zombie manager).
// =============================================================================

import {
  economy,
  zombieCountForRound,
  spawnDelayForRound,
  maxAliveForRound,
} from '../config/economy.js';

/**
 * @param zombies       zombie manager (spawn, aliveCount, clear)
 * @param onRoundStart  (round) => void   e.g. show the "ROUND 3" banner
 * @param onRoundEnd    (round) => void   e.g. flash the round counter
 */
export function createRounds({ zombies, onRoundStart = null, onRoundEnd = null }) {
  const cfg = economy.rounds;
  let started = false;
  let round = 0;
  let state = 'idle'; // 'idle' | 'active' | 'break'
  let toSpawn = 0; // zombies still to spawn this round
  let spawnTimer = 0;
  let breakTimer = 0;

  function begin(n, delay) {
    round = n;
    state = 'active';
    toSpawn = zombieCountForRound(n);
    spawnTimer = delay;
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

    // Kick off round 1 (call when the player first starts playing).
    start() {
      if (started) return;
      started = true;
      begin(1, cfg.firstRoundDelay);
    },

    update(dt) {
      if (state === 'active') {
        spawnTimer -= dt;
        if (toSpawn > 0 && spawnTimer <= 0 && zombies.aliveCount < maxAliveForRound(round)) {
          zombies.spawn('shopper');
          toSpawn -= 1;
          spawnTimer = spawnDelayForRound(round);
        }
        if (toSpawn === 0 && zombies.aliveCount === 0) {
          state = 'break';
          breakTimer = cfg.breakSeconds;
          if (onRoundEnd) onRoundEnd(round);
        }
      } else if (state === 'break') {
        breakTimer -= dt;
        if (breakTimer <= 0) begin(round + 1, cfg.roundStartDelay);
      }
    },

    // Debug: end the current round right now and start the next one.
    skipRound() {
      if (!started) return this.start();
      zombies.clear();
      begin(round + 1, cfg.roundStartDelay);
    },

    // New run: back to "not started" (round 1 begins when play starts).
    reset() {
      started = false;
      round = 0;
      state = 'idle';
      toSpawn = 0;
      spawnTimer = 0;
      breakTimer = 0;
    },
  };
}
