// =============================================================================
// GRAB-A-GUN ODDS (tools/clawSim.mjs prints them: npm run sim:claw; tests/clawSim.test.js guards the plan's rules).
// A focused simulation of the claw machine from config/clawMachine.js and the game's own roll (game/features/clawMachine.js:
// rollCapsules, prizePool, plushChanceFor, sweepSeconds): NOT a whole-game economy. Nothing carried (so no Refurbished prizes),
// the shelf price (no sales), and the walk between sites is free.
//
// The player aims for the lane with the highest wall price (or for one wanted gun when it's in the pit) and away from the plush.
// Timing models, `land(target, grab, random)` -> the lane the claw drops on:
//   perfect   always the target
//   3-in-4    the target 3 times in 4, else a neighbouring lane (the plan's model)
//   random    any lane (mashing, or the auto-drop)
//   timed     a press aimed at the middle of the target's window, off by a normal error of TIMED_ERROR_SECONDS: the middle
//             lane (0.4 s a pass at first) and a fast late sweep (1.4 s) are harder, as in the real machine
//
//   simulate({ mode, grabs, random, want }) -> totals (see the bottom)
//   wallRouteCost(gunId) -> the cheapest doors + the gun off its wall, from the start room
// =============================================================================

import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { rollCapsules, prizePool, plushChanceFor, sweepSeconds, sweepPosition, laneAt } from '../src/game/features/clawMachine.js';

export const TIMED_ERROR_SECONDS = 0.12;
export const MODES = ['perfect', '3-in-4', 'random', 'timed'];

/** A seeded random (mulberry32): the report is the same every run. */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The pool with nothing carried (the Staple Gun is never a prize anyway).
export const POOL = prizePool({ owns: (id) => id === 'stapleGun', modsFor: () => [], away: null });
// What a gun is worth in the report: its wall price, or for a claw-only gun (on no wall) the nominal `value` its prize entry carries.
export const wallPrice = (id) => id === 'returnToSender' ? economy.closing.returnsDesk : economy.wallBuys[id]?.weapon ?? cfg.prizes[id]?.value ?? 0;

// The cheapest area unlocks from the start room to each wall gun (docs/map.md): Hallway first for most; HOFFMAN'S has its own
// side door off the start room; the Cinema is reached through the Service Corridor's stairs.
export const WALL_ROUTES = {
  priceGun: [],
  nailGun: ['hallway'],
  foamDartBlaster: ['hallway', 'megaMart'],
  confettiCannon: ['hallway', 'serviceCorridor'],
  rivetRifle: ['hallway', 'atrium'],
  coilNailer: ['hallway', 'serviceCorridor', 'cinema'],
  barcodeScanner: ['departmentStore'],
};
// A gun flagged clawOnly has no wall route; Return to Sender additionally has the gated Returns Desk route.
export const wallRouteCost = (id) => weapons[id]?.clawOnly ? Infinity : WALL_ROUTES[id].reduce((sum, area) => sum + economy.doors[area], 0) + wallPrice(id);
// What the claw needs before the first grab: it waits in the Hallway until you own it.
export const CLAW_ENTRY = economy.doors[cfg.sites[0].zone];

function gaussian(random) {
  const u = Math.max(1e-12, random());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

// Where in a sweep the claw is in the middle of each lane's window (lane 0 turns round at t 0, the last lane at half a period).
const windowCentre = (lane, period) => (lane === 0 ? 0 : lane === cfg.lanes - 1 ? period / 2 : (period * lane) / (2 * (cfg.lanes - 1)));

export function land(mode, target, grabNumber, random) {
  if (mode === 'perfect') return target;
  if (mode === 'random') return Math.floor(random() * cfg.lanes);
  if (mode === '3-in-4') {
    if (random() < 0.75) return target;
    const neighbours = [target - 1, target + 1].filter((l) => l >= 0 && l < cfg.lanes);
    return neighbours[Math.floor(random() * neighbours.length)];
  }
  const period = sweepSeconds(grabNumber);
  return laneAt(sweepPosition(windowCentre(target, period) + gaussian(random) * TIMED_ERROR_SECONDS, period));
}

/** The lane the player aims for: the wanted gun if it's there, else the dearest wall gun; never the plush (or an empty lane). */
function targetLane(capsules, want) {
  const wanted = capsules.findIndex((c) => c && !c.plush && c.id === want);
  if (wanted !== -1) return wanted;
  let best = 0, bestValue = -1;
  capsules.forEach((c, lane) => {
    const value = c && !c.plush ? wallPrice(c.id) : -1;
    if (value > bestValue) { best = lane; bestValue = value; }
  });
  return best;
}

/**
 * `grabs` grabs, site after site (stock and plush odds as configured). Returns:
 *   grabs, sites, plushCloses, soldOutCloses, won { gunId: n }, plush (grabs that landed on him), valueSum (wall value of the guns won),
 *   netSpent (points: a plush grab refunds itself), appeared { gunId: grabs it was in the pit },
 *   firstGrab { grabs, blueOrBetter, valueSum } (a site's grab 1: never a plush)
 */
export function simulate({ mode = '3-in-4', grabs = 400_000, random = seeded(1), want = null, price = economy.claw.grab } = {}) {
  const out = { mode, grabs: 0, sites: 0, plushCloses: 0, soldOutCloses: 0, won: {}, plush: 0, valueSum: 0, netSpent: 0, appeared: {},
    firstGrab: { grabs: 0, blueOrBetter: 0, valueSum: 0 } };
  while (out.grabs < grabs) {
    out.sites += 1;
    for (let n = 1; n <= cfg.stock && out.grabs < grabs; n++) {
      out.grabs += 1;
      const capsules = rollCapsules(POOL, plushChanceFor(n), random);
      for (const c of capsules) if (c && !c.plush) out.appeared[c.id] = (out.appeared[c.id] ?? 0) + 1;
      const prize = capsules[land(mode, targetLane(capsules, want), n, random)];
      if (n === 1) out.firstGrab.grabs += 1;
      if (prize?.plush) {
        out.plush += 1;
        out.plushCloses += 1;
        break; // refunded: costs nothing, and the site closes
      }
      out.netSpent += price;
      if (prize) {
        out.won[prize.id] = (out.won[prize.id] ?? 0) + 1;
        out.valueSum += wallPrice(prize.id);
        if (n === 1 && prize.capsule !== 'green') out.firstGrab.blueOrBetter += 1;
        if (n === 1) out.firstGrab.valueSum += wallPrice(prize.id);
      }
      if (n === cfg.stock) out.soldOutCloses += 1;
    }
  }
  return out;
}

/** Points of grabs (net of plush refunds) per copy of `id` won, aiming for it whenever it's in the pit. */
export function clawCostPerGun(id, { mode = '3-in-4', grabs = 400_000, random = seeded(2), price = economy.claw.grab } = {}) {
  const run = simulate({ mode, grabs, random, want: id, price });
  return run.won[id] ? run.netSpent / run.won[id] : Infinity;
}
