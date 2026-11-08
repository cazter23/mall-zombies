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
// Mascot costumes (zombies/mascotVariants.js): the manager picks which costume a Mascot wears. In a costume's
// unlock round its debut is forced here: the round's first Mascot wears it, and if no Mascot has come by the
// Mascot's introSpawnIndex, that spawn is one. A costume's first appearance after the type's own fires onVariantIntro.
// =============================================================================

import {
  economy,
  zombieCountForRound,
  spawnDelayForRound,
  maxAliveForRound,
  zombieTypeForRound,
} from '../config/economy.js';
import { mascotDebutIn } from '../zombies/mascotVariants.js';

/**
 * @param zombies       zombie manager (spawn, aliveCount, clear)
 * @param onRoundStart  (round) => void   the round number just went up: show the "ROUND 3" banner
 *                                        (happens at the START of the break before that round)
 * @param onTypeIntro   (typeId, zombie) => void   a zombie type spawned for the first time this run
 * @param onVariantIntro (variant, zombie) => void a Mascot costume's first appearance this run (not the Mascot's very
 *                                        first: that one is the type's own intro)
 */
export function createRounds({ zombies, onRoundStart = null, onTypeIntro = null, onVariantIntro = null, onRoundDiscard = null }) {
  const cfg = economy.rounds;
  let started = false;
  let round = 0;
  let state = 'idle'; // 'idle' | 'active' | 'break'
  let toSpawn = 0; // zombies still to spawn this round
  let spawnTimer = 0;
  let breakTimer = 0;
  let spawnedThisRound = 0;
  const seenTypes = new Set(); // zombie types that have spawned this run
  const seenVariants = new Set(); // Mascot costumes that have spawned this run

  // The costume debuting this round that hasn't appeared yet (so the round's next Mascot must wear it), or null.
  function pendingDebut() {
    const id = mascotDebutIn(round);
    return id && !seenVariants.has(id) ? id : null;
  }

  // The type of the next spawn. In the first round a special type can appear, its
  // introSpawnIndex-th spawn is forced to be one (if none has come yet), so it always shows up.
  function nextType() {
    for (const [typeId, mix] of Object.entries(economy.zombieMix)) {
      if (!seenTypes.has(typeId) && round >= mix.fromRound && spawnedThisRound >= mix.introSpawnIndex) return typeId;
    }
    // A costume's debut works the same way. The forced spawn still rolls its dice (and ignores them), so every
    // other spawn of the round is what it would have been: the Mascot's share is unchanged.
    const roll = Math.random();
    if (pendingDebut() && spawnedThisRound >= economy.zombieMix.mascot.introSpawnIndex) return 'mascot';
    return zombieTypeForRound(round, roll);
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

    update(dt, canFinish = true) {
      if (state === 'active') {
        spawnTimer -= dt;
        if (toSpawn > 0 && spawnTimer <= 0 && zombies.aliveCount < maxAliveForRound(round)) {
          let typeId = nextType();
          const debut = typeId === 'mascot' ? pendingDebut() : null;
          const spawned = debut ? zombies.spawn(typeId, null, { variant: debut }) : zombies.spawn(typeId);
          if (spawned) {
            typeId = spawned.type?.id ?? typeId;
            toSpawn -= 1;
            spawnedThisRound += 1;
            const firstOfType = !seenTypes.has(typeId);
            if (firstOfType) {
              seenTypes.add(typeId);
              if (onTypeIntro) onTypeIntro(typeId, spawned);
            }
            const variant = spawned.type?.variant;
            if (variant && !seenVariants.has(variant)) {
              seenVariants.add(variant);
              if (!firstOfType && onVariantIntro) onVariantIntro(variant, spawned);
            }
            spawnTimer = spawnDelayForRound(round);
          } else {
            spawnTimer = cfg.spawnRetrySeconds; // no usable spawn point right now: try again shortly
          }
        }
        // Round over: the next round number goes up right away, then the short break.
        if (canFinish && toSpawn === 0 && zombies.aliveCount === 0) announce(round + 1, cfg.breakSeconds);
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
      onRoundDiscard?.();
      announce(round + 1, 0);
    },

    // Debug: clear the zombies and jump straight to round `n` (no break).
    jumpTo(n) {
      if (!started) started = true;
      zombies.clear();
      onRoundDiscard?.();
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
      seenVariants.clear();
    },
  };
}
