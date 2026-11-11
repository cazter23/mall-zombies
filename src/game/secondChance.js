// =============================================================================
// SECOND CHANCE: one automatic self-revive per run, sold at Customer Service (game/features/upgradeDesk.js, the window
// opposite Sharpening; price: g.pricing 'secondChance').
//
//   status     'available' (not bought) | 'held' (bought, waiting) | 'used' (spent this run: it cannot be bought again)
//   buy()      the desk has charged for it: now held
//   redeem()   called by createGame's onPlayerDeath on a lethal hit. Held: the player is back at full health where they stand
//              (health.revive, with feel.health.secondChance.protectionSeconds of damage immunity), nearby zombies are shoved
//              back (zombies.staggerNearby), and it returns true = the run goes on. Otherwise false = the death stands.
//   reset()    Play again: available again
//
// Announces 'secondChance' { status } (game/events.js) on every change; the HUD tag and the PA line are listeners in createGame.
// =============================================================================

import { feel } from '../config/feel.js';

export function createSecondChance({ health, zombies, player, events }) {
  let status = 'available';

  function set(next) {
    if (status === next) return;
    status = next;
    events.emit('secondChance', { status });
  }

  return {
    get status() {
      return status;
    },

    buy() {
      set('held');
    },

    redeem() {
      if (status !== 'held') return false;
      const { protectionSeconds, shove } = feel.health.secondChance;
      health.revive(protectionSeconds);
      zombies.staggerNearby(player, shove);
      set('used');
      return true;
    },

    // Save & Quit (game/saveGame.js): held / used carry over (the 'secondChance' event redraws the HUD tag).
    serialize() {
      return { status };
    },
    restore(data) {
      set(data.status);
    },

    reset() {
      set('available');
    },
  };
}
