// =============================================================================
// GUN BALANCE REPORT:  npm run balance
// Prints every gun's numbers the way they play (see tools/balance.js for how each is measured):
// overview, sustained damage per second by range, trigger pulls to kill by round, and the
// Confetti Cannon's blast damage by range. Run it before and after any weapon retune.
// =============================================================================

import { weapons } from '../src/config/weapons.js';
import { economy, zombieHealthForRound } from '../src/config/economy.js';
import {
  cycleSeconds, magazineSeconds, reloadSeconds, expectedShotDamage, burstDps, sustainedDps, shotsToKill,
} from './balance.js';

const guns = Object.values(weapons);
const r0 = (n) => (Number.isFinite(n) ? Math.round(n) : '-');
const r1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '-');
const RANGES = [2, 5, 10, 15, 20, 30];
// Pellet guns are fired from the hip up close; everything else is measured aimed down sights.
const playStyle = (d) => ({ ads: !d.pellets });

console.log('\nGUN OVERVIEW (dps measured at 5 m; ADS except pellet guns)');
console.table(guns.map((d) => ({
  gun: d.name,
  price: economy.wallBuys[d.id]?.weapon ?? 'start',
  'ammo price': economy.wallBuys[d.id]?.ammo ?? '-',
  'max per shot': d.damage * (d.pellets?.count ?? 1),
  'shots/s': r1(1 / (cycleSeconds(d) / (d.burst?.count ?? 1))),
  'per pull': d.burst ? `${d.burst.count} shots` : '1 shot',
  mag: d.magazineSize,
  reserve: d.startingReserve,
  'mag s': r1(magazineSeconds(d)),
  'reload s': r1(reloadSeconds(d)),
  'burst dps': r0(burstDps(d, 5, playStyle(d))),
  'sustained dps': r0(sustainedDps(d, 5, playStyle(d))),
  falloff: d.falloff ? `full to ${d.falloff.start}m, ${Math.round(d.falloff.minMultiplier * 100)}% at ${d.falloff.end}m` : 'none',
})));

console.log('\nSUSTAINED DPS BY RANGE (magazine + reload; ADS except pellet guns, which are hip)');
console.table(guns.map((d) => Object.fromEntries([['gun', d.name], ...RANGES.map((m) => [`${m} m`, r0(sustainedDps(d, m, playStyle(d)))])])));

console.log('\nSHOTS TO KILL A SHOPPER AT 5 m (average, same play style; a shot = a dart / nail / blast; Foam: shots (trigger pulls))');
const rounds = [1, 2, 3, 5, 8, 10, 15];
console.table(rounds.map((round) => {
  const hp = zombieHealthForRound(round);
  return Object.fromEntries([['round', round], ['hp', r0(hp)], ...guns.map((d) => {
    const shots = shotsToKill(d, hp, 5, playStyle(d));
    return [d.name, d.burst ? `${shots} (${Math.ceil(shots / d.burst.count)})` : shots];
  })]);
}));
console.log('(Absolute numbers assume resting spread and a still target: compare guns with them, not stopwatch kills.)');

const cannon = weapons.confettiCannon;
console.log('\nCONFETTI CANNON: average blast damage by range');
console.table([1.5, 3, 4, 5, 7, 9, 12].map((m) => ({
  range_m: m,
  hip: r0(expectedShotDamage(cannon, m)),
  aimed: r0(expectedShotDamage(cannon, m, { ads: true })),
})));
