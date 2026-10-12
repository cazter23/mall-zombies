// =============================================================================
// ECONOMY CONFIG
// Points, prices, and wave scaling. Step 1: data only. Nothing reads this yet;
// later steps (shooting, zombies, waves, doors) will.
// =============================================================================

export const economy = {
  startingPoints: 500,

  // Points earned from combat
  payouts: {
    nonLethalHit: 10,
    headshotKillBonus: 40, // added on top of the zombie's kill value
    meleeKillBonus: 70, // added on top of the zombie's kill value
  },

  // Base points for killing each zombie type
  killValues: {
    shopper: 60,
  },

  // Door / shutter prices
  doors: {
    startShutter: 500,
  },

  waves: {
    // HP: 150 at round 1, +100 per round through round 9, then x1.1 per round
    health: { roundOne: 150, perRoundIncrease: 100, linearUntilRound: 9, multiplierAfter: 1.1 },
    // Zombie count: round(6 + 2.5 * (round - 1))
    count: { base: 6, perRound: 2.5 },
    // Spawn delay: max(0.5, 2.0 * 0.95^(round - 1)) seconds
    spawnDelay: { base: 2.0, decayPerRound: 0.95, minimum: 0.5 },
    // Max zombies alive at once. Each entry applies from that round onward.
    maxAlive: [
      { fromRound: 1, max: 8 },
      { fromRound: 3, max: 10 },
      { fromRound: 4, max: 12 },
      { fromRound: 6, max: 14 },
      { fromRound: 8, max: 16 },
      { fromRound: 10, max: 20 },
      { fromRound: 15, max: 24 },
    ],
  },
};

// --- Helpers that turn the wave data above into numbers for a given round ---

export function zombieHealthForRound(round) {
  const h = economy.waves.health;
  const linearRound = Math.min(round, h.linearUntilRound);
  const linearHealth = h.roundOne + h.perRoundIncrease * (linearRound - 1);
  if (round <= h.linearUntilRound) return linearHealth;
  return Math.round(linearHealth * Math.pow(h.multiplierAfter, round - h.linearUntilRound));
}

export function zombieCountForRound(round) {
  const c = economy.waves.count;
  return Math.round(c.base + c.perRound * (round - 1));
}

export function spawnDelayForRound(round) {
  const s = economy.waves.spawnDelay;
  return Math.max(s.minimum, s.base * Math.pow(s.decayPerRound, round - 1));
}

export function maxAliveForRound(round) {
  let max = economy.waves.maxAlive[0].max;
  for (const tier of economy.waves.maxAlive) {
    if (round >= tier.fromRound) max = tier.max;
  }
  return max;
}
