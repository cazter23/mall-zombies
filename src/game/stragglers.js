// =============================================================================
// STRAGGLER HELPER (DOM-free gameplay system)
// Finds the last few remaining zombies at the tail of a round so the player
// never wastes minutes hunting one stuck or wandering zombie across the mall.
//
// Activates once ALL conditions hold for `feel.stragglers.delaySeconds` after
// the most recent kill:
//   - feel.stragglers.enabled is true (Comfort setting)
//   - round is 'active' with no spawns left (rounds.remainingToSpawn === 0)
//   - 0 < zombies.aliveCount <= feel.stragglers.threshold (bosses count toward aliveCount)
//   - at least one of the alive zombies is NOT a boss (bosses already show a boss bar)
//
// Stays active until the round ends, spawns become pending again, aliveCount
// rises above threshold, only bosses remain, the run ends, or the setting is turned off.
// Announces 'stragglers' / 'stragglersCleared' on the event bus; visuals,
// minimap pings and the once-per-run PA line listen on the browser side.
// =============================================================================

import { feel } from '../config/feel.js';

function sameTargets(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Tracks end-of-round straggler eligibility and announces changes on `events`.
 * @param {object} deps
 * @param {object} deps.rounds   rounds state machine (`state`, `round`, `remainingToSpawn`)
 * @param {object} deps.zombies  zombie manager (`aliveCount`, `zombies`)
 * @param {object} deps.events   event bus (`emit`, `on`)
 * @param {object} deps.state    run state (`over`)
 */
export function createStragglers({ rounds, zombies, events, state }) {
  let active = false;
  let delayTimer = 0;
  let targets = [];
  let announcedThisRun = false;

  const clear = (reason) => {
    delayTimer = 0;
    if (!active) return;
    active = false;
    targets = [];
    events.emit('stragglersCleared', { round: rounds.round, reason });
  };

  events.on('kill', () => {
    // Only reset the pre-activation quiet timer; if already active and 1 of 2 dies,
    // the next update trims the target list while keeping the survivor highlighted.
    if (!active) delayTimer = 0;
  });
  events.on('roundStart', () => clear('roundEnd'));
  events.on('roundDiscard', ({ reason } = {}) => clear(reason ?? 'discard'));
  events.on('playerDeath', () => clear('over'));

  function gatherNonBossAlive() {
    const out = [];
    for (const z of zombies.zombies) {
      if (z.isAlive && !z.type?.boss) out.push(z);
    }
    return out;
  }

  function update(dt) {
    const cfg = feel.stragglers;
    if (!cfg.enabled) {
      clear('disabled');
      return;
    }
    if (state.over) {
      clear('over');
      return;
    }
    if (rounds.state !== 'active' || rounds.remainingToSpawn > 0 || zombies.aliveCount <= 0) {
      clear('roundEnd');
      return;
    }
    if (zombies.aliveCount > cfg.threshold) {
      clear('aboveThreshold');
      return;
    }

    const candidates = gatherNonBossAlive();
    if (candidates.length === 0) {
      // Only bosses remain alive; bosses already have a boss bar, so never highlight them.
      clear('bossOnly');
      return;
    }

    if (!active) {
      delayTimer += dt;
      if (delayTimer < cfg.delaySeconds) return;
      active = true;
      targets = candidates;
      const firstTime = !announcedThisRun;
      announcedThisRun = true;
      events.emit('stragglers', { round: rounds.round, zombies: targets.slice(), firstTime });
      return;
    }

    if (!sameTargets(targets, candidates)) {
      targets = candidates;
      events.emit('stragglers', { round: rounds.round, zombies: targets.slice(), firstTime: false });
    }
  }

  function reset() {
    clear('reset');
    announcedThisRun = false;
  }

  return {
    update,
    reset,
    get active() { return active; },
    get delayTimer() { return delayTimer; },
    get targets() { return targets.slice(); },
  };
}
