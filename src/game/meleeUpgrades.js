// =============================================================================
// MELEE UPGRADES: the box cutter tiers sold at Customer Service (config/upgrades.js `melee`: Sharpened Blade, Box Cutter Pro).
//
//   offer()    the next tier the desk can sell, { id, tier (1-based), pricingId }, or null once both are bought
//   accept(o)  put it on the player: writes the melee stats (the desk has already charged for it)
//   tier       0 = plain box cutter, 1 = Sharpened Blade, 2 = Box Cutter Pro
//
// The tiers live in the stats object, not here, so the next run starts plain: resetPlayerStats puts every melee stat back
// (createGame's 'stats' reset step), and nothing here holds run state. weapons/melee.js reads the stats.
// Announces 'meleeUpgrade' { tier, id } (game/events.js) for the HUD / viewmodel.
// =============================================================================

import { upgrades } from '../config/upgrades.js';
import { weaponStatDefaults } from '../config/weapons.js';

/** Tier config by 1-based number: meleeTier(1) is Sharpened Blade. */
export const meleeTierConfig = (tier) => upgrades.melee[tier - 1] ?? null;

export function createMeleeUpgrades({ stats, events }) {
  return {
    get tier() {
      return stats.meleeTier;
    },

    /** What the desk can sell next, or null. */
    offer() {
      const next = upgrades.melee[stats.meleeTier];
      return next ? { id: next.id, tier: stats.meleeTier + 1, pricingId: next.id } : null;
    },

    accept(bought) {
      const cfg = meleeTierConfig(bought.tier);
      stats.meleeTier = bought.tier;
      stats.meleeUpgradeDamage = cfg.damage;
      stats.meleeHalfAngleDegrees = cfg.halfAngle ?? weaponStatDefaults.meleeHalfAngleDegrees;
      stats.meleeMaxTargets = cfg.maxTargets;
      events.emit('meleeUpgrade', { tier: stats.meleeTier, id: cfg.id });
    },
  };
}
