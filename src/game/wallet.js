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

    earn(amount, style) {
      if (amount <= 0) return;
      this.points += amount;
      this.totalEarned += amount;
      if (onChange) onChange(amount, this.points, style);
    },

    // Returns true and deducts if affordable; false (and nothing changes) if not.
    spend(cost) {
      if (!this.canAfford(cost)) return false;
      this.points -= cost;
      this.totalSpent += cost;
      if (onChange) onChange(-cost, this.points);
      return true;
    },

    // Give back (part of) a payment: the points return and it no longer counts as spent. NOT income: totalEarned doesn't move,
    // so the results screen and the career stats see neither the payment nor the refund. (GRAB-A-GUN's plush refunds
    // exactly what that grab charged.) Never more than was ever spent.
    refund(amount) {
      const back = Math.min(amount, this.totalSpent);
      if (!(back > 0)) return;
      this.points += back;
      this.totalSpent -= back;
      if (onChange) onChange(back, this.points);
    },

    // Save & Quit (game/saveGame.js): the wallet as plain data, and back.
    serialize() {
      return { points: this.points, totalEarned: this.totalEarned, totalSpent: this.totalSpent };
    },
    restore(data) {
      Object.assign(this, data);
      if (onChange) onChange(0, this.points);
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
export function pointsForHit({ target, killed, headshot, melee, killMultiplier = 1, killPayMultiplier = 1 }) {
  if (!target.type || target.noRewards) return 0; // only reward-eligible zombies pay, including hit bonuses
  const p = economy.payouts;
  if (!killed) return p.nonLethalHit;
  let points = (economy.killValues[target.type.id] ?? 0) * killMultiplier;
  // Apparel boosts base kill credit, with combat bonuses added afterward.
  if (killPayMultiplier !== 1) points = Math.round(points * killPayMultiplier / p.nonLethalHit) * p.nonLethalHit;
  if (melee) points += p.meleeKillBonus;
  else if (headshot) points += p.headshotKillBonus;
  return points;
}
