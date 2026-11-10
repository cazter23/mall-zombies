// =============================================================================
// CLOCK IN (ending the shopping window early)
// The break between rounds (economy.rounds.breakSeconds) is the calm moment to use the shops. A player who is
// done shopping holds the Clock in button (economy.rounds.clockIn.action: an existing ACTION, not a raw key) and
// the next round's zombies come after a short lead instead of at the end of the break.
//
// It needs a fresh press made while the offer is up (a button already held when the break starts doesn't count),
// and it reads the button with actionDown only: the press itself is left for whoever owns the action (a tap of
// Inspect still inspects the gun). Once per break; announced as 'clockIn' on the event bus.
// =============================================================================

import { economy } from '../config/economy.js';

/**
 * @param input   actionDown(action)
 * @param rounds  round, inBreak, breakRemaining, endBreak(lead)
 * @param events  the game's event bus: emits 'clockIn' { round, skipped }
 */
export function createClockIn({ input, rounds, events }) {
  const cfg = economy.rounds.clockIn;
  let holdTime = 0; // seconds the button has been held (armed presses only)
  let armed = false; // the press began while the offer was up
  let wasDown = false; // the button's state last tick (to spot a fresh press)
  let usedRound = 0; // the round whose break was already cut short

  // Is there a break to end right now? (Not the wait before round 1, and not one already ended.)
  function offered() {
    return rounds.inBreak && rounds.round >= cfg.fromRound && rounds.round !== usedRound
      && rounds.breakRemaining > cfg.leadSeconds;
  }

  function release() {
    holdTime = 0;
    armed = false;
  }

  return {
    // HUD: null, or { action, progress 0..1 } while the break can be ended.
    get prompt() {
      if (!offered()) return null;
      return { action: cfg.action, progress: armed ? Math.min(1, holdTime / cfg.holdSeconds) : 0 };
    },

    // Fixed tick. `allowed` false (an open menu): the offer stays up but the button is ignored.
    update(dt, allowed = true) {
      const down = allowed && input.actionDown(cfg.action);
      const fresh = down && !wasDown;
      wasDown = down;
      if (!offered()) return release();
      if (fresh) armed = true;
      if (!armed || !down) return release();
      holdTime += dt;
      if (holdTime < cfg.holdSeconds) return;
      const round = rounds.round;
      const skipped = rounds.endBreak(cfg.leadSeconds);
      usedRound = round;
      release();
      events.emit('clockIn', { round, skipped });
    },

    reset() {
      release();
      wasDown = false;
      usedRound = 0;
    },
  };
}
