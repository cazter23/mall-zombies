// =============================================================================
// WALLET (points)
// The player's points: earned by hitting/killing zombies, spent on doors and
// weapons. Every change can notify a listener (the HUD shows "+60" pop-ups).
// =============================================================================

import { economy } from '../config/economy.js';

export function createWallet({ onChange = null } = {}) {
  return {
    points: economy.startingPoints,
    totalEarned: 0, // for the results screen
    totalSpent: 0, // for this run's receipt / persistent career record

    canAfford(cost) {
      return this.points >= cost;
    },

    earn(amount) {
      if (amount <= 0) return;
      this.points += amount;
      this.totalEarned += amount;
      if (onChange) onChange(amount, this.points);
    },

    // Returns true and deducts if affordable; false (and nothing changes) if not.
    spend(cost) {
      if (!this.canAfford(cost)) return false;
      this.points -= cost;
      this.totalSpent += cost;
      if (onChange) onChange(-cost, this.points);
      return true;
    },

    reset() {
      this.points = economy.startingPoints;
      this.totalEarned = 0;
      this.totalSpent = 0;
      if (onChange) onChange(0, this.points);
    },
  };
}

/**
 * COD-style points for one hit on a zombie: +10 for a hit that doesn't kill; a kill pays the
 * zombie's kill value plus a headshot or melee bonus. Returns 0 for non-zombies (practice dummies).
 */
export function pointsForHit({ target, killed, headshot, melee, killMultiplier = 1 }) {
  if (!target.type || target.noRewards) return 0; // only reward-eligible zombies pay, including hit bonuses
  const p = economy.payouts;
  if (!killed) return p.nonLethalHit;
  let points = (economy.killValues[target.type.id] ?? 0) * killMultiplier;
  if (melee) points += p.meleeKillBonus;
  else if (headshot) points += p.headshotKillBonus;
  return points;
}
