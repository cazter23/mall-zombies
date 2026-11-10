// =============================================================================
// GUN BALANCE REPORT:  npm run balance
// Prints every gun's numbers the way they play (see tools/balance.js for how each is measured):
// overview, sustained damage per second by range, trigger pulls to kill by round, and the
// Confetti Cannon's blast damage by range. Run it before and after any weapon retune.
// =============================================================================

import { weapons } from '../src/config/weapons.js';
import { workshopRitual, workshopStuffings, workshopHearts } from '../src/config/workshop.js';
import { gunPower } from '../src/weapons/gunStats.js';
import { economy, zombieHealthForRound, zombieHealthFor } from '../src/config/economy.js';
import { bossTypes, bossVouchers } from '../src/config/bosses.js';
import {
  cycleSeconds, magazineSeconds, reloadSeconds, expectedShotDamage, burstDps, sustainedDps, shotsToKill,
} from './balance.js';

const guns = Object.values(weapons);
const r0 = (n) => (Number.isFinite(n) ? Math.round(n) : '-');
const r1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '-');
const RANGES = [2, 5, 10, 15, 20, 30];
// Pellet guns are fired from the hip up close; everything else is measured aimed down sights.
const playStyle = (d) => ({ ads: !d.pellets });

console.log('\nBOSS ENCOUNTERS (base Nail Gun body damage at 10 m; no upgrades, headshots, misses or wave pressure)');
console.table(Object.values(bossTypes).sort((a,b)=>a.firstRounds[0]-b.firstRounds[0]).map(type=>({
  boss: type.name,
  debut: type.firstRounds.join('/'),
  'debut hp': zombieHealthFor(type.id,type.firstRounds[0]),
  'round 20 hp': zombieHealthFor(type.id,20),
  'kill points': economy.killValues[type.id],
  'base Nail Gun seconds': r1(zombieHealthFor(type.id,type.firstRounds[0])/sustainedDps(weapons.nailGun,10,{ads:true})),
  reward: bossVouchers[type.reward]?.name ?? type.reward,
})));

console.log('\nGUN OVERVIEW (dps measured at 5 m; ADS except pellet guns)');
console.table(guns.map((d) => ({
  gun: d.name,
  price: d.debugOnly ? 'debug only' : d.clawOnly ? 'claw only' : economy.wallBuys[d.id]?.weapon ?? 'start',
  'ammo price': economy.wallBuys[d.id]?.ammo ?? '-',
  'max per shot': d.damage * (d.pellets?.count ?? 1),
  'shots/s': r1(1 / (cycleSeconds(d) / (d.burst?.count ?? 1))),
  'per pull': d.burst ? `${d.burst.count} shots` : d.charge ? `charge (${d.charge.seconds}s)` : '1 shot',
  mag: d.magazineSize,
  reserve: d.startingReserve,
  'mag s': r1(magazineSeconds(d)),
  'reload s': r1(reloadSeconds(d)),
  'burst dps': r0(burstDps(d, 5, playStyle(d))),
  'sustained dps': r0(sustainedDps(d, 5, playStyle(d))),
  falloff: d.falloff ? `full to ${d.falloff.start}m, ${Math.round(d.falloff.minMultiplier * 100)}% at ${d.falloff.end}m` : 'none',
})));

// A gun with a fuel tank or a cone is judged by what it DOES, not by its damage: how long it blows, how long it refills, and how far and wide it pushes.
const pushers = guns.filter((d) => d.cone);
if (pushers.length) {
  console.log('\nCONE GUNS (a wide push and a fuel tank; the damage above is only a tickle)');
  console.table(pushers.map((d) => ({
    gun: d.name,
    'tank (pulses)': d.magazineSize,
    'blows for s': r1(d.magazineSize * d.fireInterval),
    'refills in s': r1(d.fuel ? d.fuel.regenDelay + d.magazineSize / d.fuel.regenPerSecond : 0),
    'unlocks at': d.fuel?.restartAt ?? '-',
    'range m': d.cone.range,
    'half angle': d.cone.halfAngleDegrees,
    'shove m/s (near)': d.cone.knockback,
    'knocked down within m': d.cone.knockdownRange,
    'damage per tank': d.magazineSize * d.damage,
    'strongest wall-gun shove': Math.max(...guns.filter((g) => !g.clawOnly).map((g) => g.impact.knockback)),
  })));
}

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

// Build-A-Blaster: what a build adds. One proc on a target, at each quality, against the zombie health it meets.
const noStats = { damageMultiplier: 1 };
console.log('\nBUILD-A-BLASTER: damage of one proc (Headshot heart; Last Round is x' + workshopHearts.lastRound.strength + ')');
console.table(guns.map((d) => {
  const second = gunPower(d, noStats);
  const row = { gun: d.name, 'gun per second': r0(second) };
  for (const q of workshopRitual.qualities.slice(0, 3)) {
    row[`burn ${q.name}`] = r0(second * workshopStuffings.fryerOil.burn.gunSeconds * q.power);
    row[`arc ${q.name}`] = r0(second * workshopStuffings.neonTube.chain.gunSeconds * q.power);
  }
  return row;
}));
console.log('Zombie health for comparison: ' + [5, 10, 15, 20, 30].map((r) => `round ${r} ${zombieHealthForRound(r)}`).join(', '));
