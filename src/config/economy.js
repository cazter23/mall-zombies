// =============================================================================
// ECONOMY CONFIG
// Points, prices, round timing and wave scaling. Read by game/wallet.js,
// game/rounds.js, the zombie manager, and buyable things (doors, wall buys).
// =============================================================================

import { bossTypes } from './bosses.js';

export const economy = {
  startingPoints: 500,

  // Points earned from combat
  payouts: {
    nonLethalHit: 10,
    headshotKillBonus: 40, // added on top of the zombie's kill value
    meleeKillBonus: 70, // added on top of the zombie's kill value
    helmetPopBonus: 100, // a gun or box cutter headshot that knocks Sir Waffles' helmet off
  },

  // Base points for killing each zombie type
  killValues: {
    shopper: 60,
    mallWalker: 60,
    mannequin: 100,
    cartPusher: 130, // 1.8x a Shopper's health (an even per-bullet payout would be 108), a little extra for how dangerous it is
    mascot: 300,
    janitor: 300,
    manager: 1000,
    guard: 750,
    influencer: 1000,
  },

  // Special zombie types mixed into the waves (every other spawn is a Shopper).
  //   fromRound        first round they can show up
  //   shareByRound     chance that each spawn is this type, from the last row whose fromRound is reached
  //   healthMultiplier x the round's zombie health (waves.health below)
  //   introSpawnIndex  in the first round they can appear, the spawn with this index (0 = the first) is
  //                    forced to be one if none has come yet, so the "they're here" banner always has a zombie
  //   maxAlive         further selections become Shoppers while this many are alive
  zombieMix: {
    mallWalker: {
      fromRound: 4,
      shareByRound: [
        { fromRound: 4, share: 0.15 },
        { fromRound: 6, share: 0.25 },
        { fromRound: 9, share: 0.3 },
      ],
      healthMultiplier: 0.65,
      introSpawnIndex: 2,
    },
    cartPusher: {
      fromRound: 6,
      shareByRound: [
        { fromRound: 6, share: 0.1 },
        { fromRound: 10, share: 0.15 },
      ],
      healthMultiplier: 1.8, // (was 2.2: a bullet sponge by round 12)
      introSpawnIndex: 1,
    },
    mannequin: {
      fromRound: 8, shareByRound: [{ fromRound: 8, share: .05 }, { fromRound: 12, share: .08 }],
      healthMultiplier: .8, introSpawnIndex: 3, maxAlive: 2,
    },
    mascot: {
      fromRound: 10, shareByRound: [{ fromRound: 10, share: 0.04 }],
      healthMultiplier: 5, introSpawnIndex: 4, maxAlive: 2,
    },
  },

  // One purchase per destination, through any entrance. Shared connections are free
  // once both adjoining areas are unlocked. Category stays 'door' for Flash Sales.
  doors: {
    parkingLot: 1250,
    hallway: 500,
    megaMart: 750,
    foodCourt: 1000,
    serviceCorridor: 1000,
    departmentStore: 1250,
    atrium: 1250,
    upstairs: 1250,
    cinema: 1250,
  },

  // Wall-buy weapon prices. Buying a weapon you already own refills its ammo for `ammo`.
  wallBuys: {
    priceGun: { weapon: 500, ammo: 250 },
    nailGun: { weapon: 1000, ammo: 500 },
    // Reserved for the guns planned for the Mega Mart and the Service Corridor (inert until those exist in config/weapons.js)
    foamDartBlaster: { weapon: 1200, ammo: 600 },
    confettiCannon: { weapon: 1500, ammo: 500 }, // (was 750: dearer than the 400 RESTOCK-O-MATIC refill)
    // The three late guns (priced from `npm run balance`): ammo about half the gun, like the others.
    rivetRifle: { weapon: 1500, ammo: 750 }, // stronger automatic rifle; smaller magazine and quicker handling than Coil (Grand Atrium)
    coilNailer: { weapon: 2500, ammo: 650 }, // late Cinema purchase: large drum, slow reload and 2-target pierce
    barcodeScanner: { weapon: 1750, ammo: 900 }, // weak sustained dps (180) but pierces 4 in a line, ~3x (Byte Me Electronics)
  },

  // Discounted prices (Flash Sales, game/pricing.js) are rounded to the nearest multiple of this.
  discountRoundTo: 10,

  // Gun upgrades (what they do: config/upgrades.js). Tiers are bought one at a time for the gun in your hand;
  // each tier costs about one round's earnings at the round it's meant for (round 12 pays ~3,400).
  upgrades: {
    // PLACEHOLDER PRICES: ritual and restuff are not decided yet (the economy simulation sets them). Limited Editions keep their old prices here for
    // that decision, but nothing charges them now: since phase 6 they drop free (game/features/limitedEditions.js).
    workshop: { partyTrap: 1500, clearanceRack: 1000, ritual: 1500, restuff: 750 },
    tiers: { deluxe: 1000, premium: 3000, platinum: 6000 },
    renewals: [3000, 4000, 5500, 7500, 10000], // Warranty Renewals past Platinum (config/upgrades.js renewals), each dearer than the last // (the support upgrade: a build, 1500, hits harder than any single tier)
    attachments: {
      extendedNozzle: 1000, sawnOff: 1000, // barrel (Mega Mart hardware)
      laserPointer: 750, zoomLens: 750, // sight (Byte Me Electronics)
      gripTape: 750, wristband: 750, // grip (Good Sports)
      jumboPack: 1000, speedLoader: 1000, // magazine (Play Time Toys)
    },
  },

  wardrobe: {
    paperHat: 750, aviators: 1250, glasses: 1500,
    cardigan: 2500, sandwichBoard: 1500, hiVisVest: 1250,
    lightUpSneakers: 1250, orthopedicWalkers: 1000, wheelieSneakers: 1000,
    fannyPack: 1500, foamFinger: 750, goldCard: 2000,
  },

  // Ammo cache (the vending machine in the Food Court): refills the gun in your hand, any gun, one flat price.
  ammoCache: { price: 400 },

  // FLASH SALES (game/flashSales.js): the mall PA announces a discount on one group of prices for a while. Times are
  // play time (not while paused or dead). `groups`: id, label, categories (pricing categories, game/pricing.js),
  // weight (how likely), and the PA lines ({pct} = the discount). A group is skipped when it would be useless right
  // now (every door already open, every wall gun owned, every gun already Platinum).
  flashSales: {
    enabled: true,
    firstDelaySeconds: 120, // into a run, before the first sale
    gapSeconds: { min: 120, max: 240 }, // quiet time after a sale ends
    durationSeconds: 45,
    retrySeconds: 30, // when nothing was worth discounting, look again this soon
    discounts: { min: 0.25, max: 0.5, step: 0.05 }, // "25-50% off"
    groups: [
      {
        id: 'doors', label: 'Security shutters', categories: ['door'], weight: 1,
        start: { kicker: 'Flash sale', text: 'Security shutters are {pct}% off! Please do not ask what is behind them.' },
        end: { kicker: 'Sale over', text: 'The shutter sale has ended. Thank you for shopping. Please stop.' },
      },
      {
        id: 'weapons', label: 'Wall guns', categories: ['weapon'], weight: 1,
        start: { kicker: 'Flash sale', text: 'Wall guns are {pct}% off! Limited stock. Unlimited shoppers.' },
        end: { kicker: 'Sale over', text: 'The gun sale has ended. All sales are final. So are you.' },
      },
      {
        id: 'ammo', label: 'Ammo', categories: ['ammo', 'ammoCache'], weight: 1.3,
        start: { kicker: 'Flash sale', text: 'Ammo is {pct}% off! Please shoot responsibly. Or do not.' },
        end: { kicker: 'Sale over', text: 'The ammo sale has ended. We regret nothing.' },
      },
      {
        id: 'tiers', label: 'Extended Warranties', categories: ['tier'], weight: 1,
        start: { kicker: 'Flash sale', text: 'Extended Warranties are {pct}% off at Customer Service! Dying is not covered.' },
        end: { kicker: 'Sale over', text: 'The warranty sale has ended. Your gun is now only a little bit covered.' },
      },
      {
        id: 'attachments', label: 'Gun attachments', categories: ['attachment'], weight: 1,
        start: { kicker: 'Flash sale', text: 'Gun attachments are {pct}% off in every store! Today only. (Today is all there is.)' },
        end: { kicker: 'Sale over', text: 'The attachment sale has ended. Please remove your shopping from the zombies.' },
      },
      {
        id: 'apparel', label: 'Apparel', categories: ['wardrobe'], weight: 1,
        start: { kicker: 'Flash sale', text: 'Apparel is {pct}% off! Try before you die.' },
        end: { kicker: 'Sale over', text: 'The apparel sale has ended. Fitting rooms are still free.' },
      },
    ],
  },

  // Round pacing
  rounds: {
    firstRoundDelay: 3, // seconds after the game starts before round 1's zombies begin spawning
    // When a round's last zombie dies, the next round number goes up immediately, then this
    // short break, then its zombies start trickling in.
    breakSeconds: 10,
    spawnRetrySeconds: 0.5, // no usable spawn point (none open/reachable)? try again this soon
  },

  waves: {
    // HP: 150 at round 1, +75 per round through round 9, then x1.075 per round
    health: { roundOne: 150, perRoundIncrease: 75, linearUntilRound: 9, multiplierAfter: 1.075 },
    // Zombie count: round(6 + 2.5 * (round - 1))
    count: { base: 6, perRound: 2.5 },
    // Spawn delay: a slow trickle in the first rounds (earlyRounds, seconds, for rounds 1, 2, 3, 4),
    // then max(0.5, 2.0 * 0.95^(round - 1)) seconds from round 5 on.
    spawnDelay: { earlyRounds: [3.0, 2.6, 2.2, 1.9], base: 2.0, decayPerRound: 0.95, minimum: 0.5 },
    // Max zombies alive at once. Each entry applies from that round onward.
    maxAlive: [
      { fromRound: 1, max: 5 },
      { fromRound: 2, max: 6 },
      { fromRound: 3, max: 9 },
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

// Health of one zombie of `typeId` in `round` (special types scale the round's health; see zombieMix).
export function zombieHealthFor(typeId, round) {
  const multiplier = economy.zombieMix[typeId]?.healthMultiplier ?? bossTypes[typeId]?.healthMultiplier ?? 1;
  return Math.round(zombieHealthForRound(round) * multiplier);
}

// Which type the next spawn in `round` is, from zombieMix (`roll` 0..1, random by default).
export function zombieTypeForRound(round, roll = Math.random()) {
  for (const [typeId, mix] of Object.entries(economy.zombieMix)) {
    if (round < mix.fromRound) continue;
    let share = 0;
    for (const row of mix.shareByRound) if (round >= row.fromRound) share = row.share;
    if (roll < share) return typeId;
    roll -= share;
  }
  return 'shopper';
}

export function zombieCountForRound(round) {
  const c = economy.waves.count;
  return Math.round(c.base + c.perRound * (round - 1));
}

export function spawnDelayForRound(round) {
  const s = economy.waves.spawnDelay;
  if (round <= s.earlyRounds.length) return s.earlyRounds[round - 1];
  return Math.max(s.minimum, s.base * Math.pow(s.decayPerRound, round - 1));
}

export function maxAliveForRound(round) {
  let max = economy.waves.maxAlive[0].max;
  for (const tier of economy.waves.maxAlive) {
    if (round >= tier.fromRound) max = tier.max;
  }
  return max;
}
