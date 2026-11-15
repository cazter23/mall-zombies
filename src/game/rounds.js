// =============================================================================
// ROUNDS (waves)
// COD-style round flow, on the fixed tick:
//   active -> zombies spawn one at a time (count, pace and max-alive from
//             economy.js) until the round's quota is out; when every zombie
//             is dead the round is over
//   break  -> the round number goes up IMMEDIATELY (banner + counter), a pause
//             (the shopping window: economy.rounds.breakSeconds), then the new round's zombies
//             start trickling in. endBreak() cuts it short (the player "clocks in": game/clockIn.js)
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
 * @param onWaveEnding  ({ round, remaining }) => void wave has no pending spawns and <= 2 zombies alive
 */
export function createRounds({ zombies, onRoundStart = null, onTypeIntro = null, onVariantIntro = null, onRoundDiscard = null, onWaveEnding = null }) {
  const cfg = economy.rounds;
  let started = false;
  let round = 0;
  let state = 'idle'; // 'idle' | 'active' | 'break'
  let toSpawn = 0; // zombies still to spawn this round
  let spawnTimer = 0;
  let breakTimer = 0;
  let spawnedThisRound = 0;
  let waveEndingEmitted = false;
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
    waveEndingEmitted = false;
    if (delay > 0) {
      state = 'break';
      breakTimer = delay;
    } else {
      state = 'active';
    }
    spawnTimer = 0;
    if (onRoundStart) onRoundStart(n);
  }

  // reason: 'overtime' (Stay for overtime) or 'debug' (skipRound / jumpTo). Listeners that delete what a wave left
  // behind read it (game/powerUps.js keeps an earned boss reward through the overtime transition).
  function discardWave(reason) {
    zombies.clear();
    onRoundDiscard?.(reason);
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
    // The last shoppers of the round (economy.rounds.lastShoppers): nothing left to spawn and only a few alive.
    get lastShoppers() {
      return state === 'active' && toSpawn === 0 && zombies.aliveCount > 0 && zombies.aliveCount <= cfg.lastShoppers.count;
    },
    get remainingInWave() {
      return toSpawn + zombies.aliveCount;
    },

    // Reserved reinforcements spend the existing wave budget. Failed safe spawns
    // and a full living cap keep the request pending in the encounter.
    spawnBackup(typeId, options = {}) {
      if (state !== 'active' || toSpawn <= 0 || zombies.aliveCount >= maxAliveForRound(round)) return null;
      const zombie = zombies.spawn(typeId, null, options);
      if (!zombie) return null;
      toSpawn -= 1;
      spawnedThisRound += 1;
      // (As a wave spawn does: the type that actually arrived, and the zombie itself for the guide's first sighting.)
      const arrived = zombie.type?.id ?? typeId;
      if (!seenTypes.has(arrived)) { seenTypes.add(arrived); onTypeIntro?.(arrived, zombie); }
      return zombie;
    },

    // True during the pause before a round's zombies arrive (the HUD blinks the counter).
    get inBreak() {
      return state === 'break';
    },

    // Seconds left of the current break (0 outside one).
    get breakRemaining() {
      return state === 'break' ? Math.max(0, breakTimer) : 0;
    },

    // Cut the current break short: the zombies come in `lead` seconds (or when the break would have ended anyway,
    // whichever is sooner). Returns the seconds skipped, or null outside a break.
    endBreak(lead = 0) {
      if (state !== 'break') return null;
      const before = Math.max(0, breakTimer);
      breakTimer = Math.min(before, Math.max(0, lead));
      return before - breakTimer;
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
        if (!waveEndingEmitted && toSpawn === 0 && zombies.aliveCount > 0 && zombies.aliveCount <= cfg.lastShoppers.count) {
          waveEndingEmitted = true;
          if (onWaveEnding) onWaveEnding({ round, remaining: zombies.aliveCount });
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

    // Stay for overtime (createGame's stayForOvertime). A win in the break, when the announced round has spawned
    // nothing yet: overtime continues with THAT round after a fresh full break, so no round is skipped (nothing is
    // discarded and the round is not announced a second time). A win with a wave live: the wave is discarded and the
    // next round is announced.
    startOvertime() {
      if (state === 'break') {
        breakTimer = cfg.breakSeconds;
        return;
      }
      discardWave('overtime');
      announce(round + 1, cfg.breakSeconds);
    },

    // Debug: end the current round right now and jump straight into the next one (no break).
    skipRound() {
      if (!started) return this.start();
      discardWave('debug');
      announce(round + 1, 0);
    },

    // Debug: clear the zombies and jump straight to round `n` (no break).
    jumpTo(n) {
      if (!started) started = true;
      discardWave('debug');
      announce(Math.max(1, Math.round(n)), 0);
    },

    // New run: back to "not started" (round 1 begins when play starts).
    // Save & Quit (game/saveGame.js). A save is always the START of a round, so it keeps only the round number and what this
    // run has already seen; restore() puts the run at the start of that round's break (the full break, no 'roundStart': the
    // systems that roll on it restore their own rolls).
    serialize() {
      return { round, seenTypes: [...seenTypes], seenVariants: [...seenVariants] };
    },
    restore(data) {
      started = true;
      round = data.round;
      toSpawn = zombieCountForRound(round);
      spawnedThisRound = 0;
      waveEndingEmitted = false;
      state = 'break';
      breakTimer = round === 1 ? cfg.firstRoundDelay : cfg.breakSeconds;
      spawnTimer = 0;
      seenTypes.clear();
      for (const id of data.seenTypes) seenTypes.add(id);
      seenVariants.clear();
      for (const id of data.seenVariants) seenVariants.add(id);
    },

    reset() {
      started = false;
      round = 0;
      state = 'idle';
      toSpawn = 0;
      spawnTimer = 0;
      breakTimer = 0;
      spawnedThisRound = 0;
      waveEndingEmitted = false;
      seenTypes.clear();
      seenVariants.clear();
    },
  };
}
