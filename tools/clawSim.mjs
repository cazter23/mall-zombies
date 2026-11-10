// =============================================================================
// GRAB-A-GUN ODDS REPORT:  npm run sim:claw   (optional: npm run sim:claw -- 1500  to try another grab price)
// Reproduces docs/claw-machine-plan.md's odds tables from config/clawMachine.js (the simulation: tools/clawOdds.js):
// what a grab wins at each timing, how long a site lasts and how it closes, the wall value of a prize, and what one
// specific gun costs from the claw against its wall. Run it after changing the prize weights, plush odds, stock or price.
// =============================================================================

import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { MODES, POOL, TIMED_ERROR_SECONDS, CLAW_ENTRY, simulate, clawCostPerGun, wallRouteCost, wallPrice } from './clawOdds.js';

const GRABS = 400_000;
const price = Number(process.argv[2]) || economy.claw.grab;
const pct = (n, of) => `${((100 * n) / of).toFixed(1)}%`;
const r0 = (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '-');
const name = (id) => weapons[id].name;

console.log(`\nGRAB-A-GUN at ${price} points a grab, ${GRABS.toLocaleString('en-US')} simulated grabs per timing, nothing carried.`);
console.log(`Stock ${cfg.stock} a site; plush chance by grab ${cfg.plushChance.map((p) => `${p * 100}%`).join(' / ')}; sweep ${cfg.sweep.firstSeconds} s down to ${cfg.sweep.minSeconds} s.`);
console.log(`Timing: perfect; 3-in-4 (a miss lands on a neighbouring lane); random lane; timed (press error ${TIMED_ERROR_SECONDS} s, real lane windows).`);

const runs = Object.fromEntries(MODES.map((mode) => [mode, simulate({ mode, grabs: GRABS, price })]));

console.log('\nWON PER GRAB (the player aims for the dearest wall gun and away from the plush)');
const total = POOL.reduce((s, p) => s + p.weight, 0);
console.table([
  ...POOL.map((p) => ({
    prize: name(p.id), weight: p.weight, capsule: p.capsule, 'wall price': wallPrice(p.id),
    'in the pit': pct(runs.perfect.appeared[p.id] ?? 0, runs.perfect.grabs),
    ...Object.fromEntries(MODES.map((m) => [m, pct(runs[m].won[p.id] ?? 0, runs[m].grabs)])),
  })),
  { prize: 'Plush (refunded)', ...Object.fromEntries(MODES.map((m) => [m, pct(runs[m].plush, runs[m].grabs)])) },
  { prize: 'Average wall value of a gun won', ...Object.fromEntries(MODES.map((m) => [m, r0(runs[m].valueSum / Object.values(runs[m].won).reduce((a, b) => a + b, 0))])) },
  { prize: 'Wall value per point spent', ...Object.fromEntries(MODES.map((m) => [m, (runs[m].valueSum / runs[m].netSpent).toFixed(2)])) },
]);
console.log(`(weights total ${total}: a single capsule is a Coil Nailer ${pct(POOL.find((p) => p.id === 'coilNailer')?.weight ?? 0, total)} of the time)`);

console.log('\nSITES (how long a site lasts and how it closes)');
console.table(MODES.map((m) => {
  const r = runs[m];
  const closes = r.plushCloses + r.soldOutCloses;
  return { timing: m, 'grabs per site': (r.grabs / r.sites).toFixed(2), 'closed by plush': pct(r.plushCloses, closes), 'sold out': pct(r.soldOutCloses, closes) };
}));

console.log('\nTHE EARLY JUMP (a site\'s first grab: no plush yet)');
console.table(MODES.map((m) => ({
  timing: m, 'Blue or better': pct(runs[m].firstGrab.blueOrBetter, runs[m].firstGrab.grabs),
  'average wall value': r0(runs[m].firstGrab.valueSum / runs[m].firstGrab.grabs),
  'value / price': (runs[m].firstGrab.valueSum / runs[m].firstGrab.grabs / price).toFixed(2),
  'points for the Hallway + one grab': CLAW_ENTRY + price,
})));
console.log('(the same points on a wall: the Hallway + the Nail Gun is 1,500; Blue guns start at 2,450 with their doors)');

console.log('\nONE SPECIFIC GUN: points of grabs per copy (aiming for it when it\'s in the pit; plush grabs refunded) vs the wall');
console.log(`(the claw also needs the Hallway, ${CLAW_ENTRY}; the wall route is the cheapest doors from the start room plus the gun)`);
console.table(POOL.map((p) => {
  const clawOnly = weapons[p.id]?.clawOnly;
  const row = { gun: name(p.id), 'wall route': clawOnly ? 'none: claw only' : wallRouteCost(p.id) };
  for (const m of ['3-in-4', 'timed', 'random']) row[`claw ${m}`] = r0(clawCostPerGun(p.id, { mode: m, grabs: GRABS / 2, price }));
  const perfect = clawCostPerGun(p.id, { mode: 'perfect', grabs: GRABS / 2, price }) + CLAW_ENTRY;
  row['claw perfect + Hallway'] = r0(perfect);
  row['claw cheaper?'] = clawOnly ? 'the only way' : perfect < wallRouteCost(p.id) ? 'YES: rule broken' : 'no';
  return row;
}));

// Every cost above scales with the price (a plush refunds the price too): what other prices would do, from the same runs.
console.log('\nBY PRICE (the same simulated grabs, scaled)');
const firstValue = (m) => runs[m].firstGrab.valueSum / runs[m].firstGrab.grabs;
console.table([1000, 1250, 1500, 1750].map((p) => ({
  'grab price': p,
  'first grab value / price (3-in-4)': (firstValue('3-in-4') / p).toFixed(2),
  'first grab value / price (timed)': (firstValue('timed') / p).toFixed(2),
  'value per point, whole site (3-in-4)': ((runs['3-in-4'].valueSum / runs['3-in-4'].netSpent) * (price / p)).toFixed(2),
  'Hallway + one grab': CLAW_ENTRY + p,
  'closest gun: claw (perfect) / wall': (Math.min(...POOL.filter((g) => !weapons[g.id]?.clawOnly).map((g) => (clawCostPerGun(g.id, { mode: 'perfect', grabs: GRABS / 4, price: p }) + CLAW_ENTRY) / wallRouteCost(g.id)))).toFixed(2),
})));
