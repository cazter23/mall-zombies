// =============================================================================
// GUN BALANCE REPORT:  npm run balance
// Prints every gun's numbers the way they play (see tools/balance.js for how each is measured):
// overview, sustained damage per second by range, trigger pulls to kill by round, and the
// Confetti Cannon's blast damage by range. Run it before and after any weapon retune.
// =============================================================================

import { weapons } from '../src/config/weapons.js';
import { workshopRitual, workshopStuffings, workshopHearts } from '../src/config/workshop.js';
import { hitDamage, resolveGun, gunPower } from '../src/weapons/gunStats.js';
import { economy, zombieHealthForRound, zombieHealthFor, zombieCountForRound } from '../src/config/economy.js';
import { withTier } from '../src/weapons/upgrades.js';
import { bossTypes, bossVouchers } from '../src/config/bosses.js';
import {
  cycleSeconds, magazineSeconds, reloadSeconds, expectedShotDamage, burstDps, sustainedDps, shotsToKill, killsPerSecond, hitChance,
} from './balance.js';

const guns = Object.values(weapons);
const r0 = (n) => (Number.isFinite(n) ? Math.round(n) : '-');
const r1 = (n) => (Number.isFinite(n) ? n.toFixed(1) : '-');
const RANGES = [2, 5, 10, 15, 20, 30];
// Pellet guns are fired from the hip up close; everything else is measured aimed down sights.
const playStyle = (d) => ({ ads: !d.pellets });

console.log('\nBOSS ENCOUNTERS (base Nail Gun body damage at 10 m; no upgrades, headshots, misses or wave pressure)');
console.table(Object.values(bossTypes).sort((a,b)=>(a.firstRounds?.[0] ?? Infinity)-(b.firstRounds?.[0] ?? Infinity)).map(type=>({
  boss: type.name,
  debut: type.firstRounds?.join('/') ?? 'booked',
  'debut hp': type.firstRounds ? zombieHealthFor(type.id,type.firstRounds[0]) : '-',
  'round 20 hp': zombieHealthFor(type.id,20),
  'kill points': economy.killValues[type.id],
  'base Nail Gun seconds': type.firstRounds ? r1(zombieHealthFor(type.id,type.firstRounds[0])/sustainedDps(weapons.nailGun,10,{ads:true})) : '-',
  reward: bossVouchers[type.reward]?.name ?? type.reward ?? '-',
})));

const finale = bossTypes.lastCustomer;
const platinumRivet = resolveGun(weapons.rivetRifle, withTier(weapons.rivetRifle, [], 'platinum'));
console.log(`\nLAST CUSTOMER (Platinum Rivet Rifle, ADS body shots at ${finale.balance.range} m; sustained fire with reloads, no crash bonus, headshots, misses or wave pressure)`);
console.table(finale.balance.rounds.map(round => {
  const hp = zombieHealthFor(finale.id, round);
  return { round, hp, 'Platinum Rivet seconds to Speechless': r1((hp - finale.damageFloor) / sustainedDps(platinumRivet, finale.balance.range, { ads: true })),
    'base RTS beam hit': r1(hitDamage(weapons.returnToSender, { part: 'body', distance: finale.balance.range }, 0, { damageMultiplier: 1 }, 1, { type: finale, maxHealth: hp })),
    'base RTS beams to Speechless': Math.ceil((hp - finale.damageFloor) / (hp * finale.returnToSenderFraction)) };
}));

console.log(`An emptied Last Customer bar requires a return: a beam during Speechless, or a ${finale.handReturn.holdSeconds} s hand stamp within ${finale.speechlessSeconds} s. A missed window restores ${finale.recoverHealthFraction * 100}% health.`);

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

const throwers = guns.filter((d) => d.projectile);
if (throwers.length) {
  console.log('\nBALL GUNS (a thrown, bouncing ball; the dps above counts ONE hit a ball: in a clump or off a wall it is hit again, up to maxBounces)');
  console.table(throwers.map((d) => ({
    gun: d.name,
    'damage per hit': d.damage,
    'most a ball can do': d.damage * d.projectile.maxBounces,
    'max bounces': d.projectile.maxBounces,
    'finds zombies within m': d.projectile.seekRange,
    'speed m/s': d.projectile.speed,
    'speed kept': d.projectile.restitution,
    'balls a second': r1(1 / d.fireInterval),
    'sustained dps, 1 hit a ball': r0(sustainedDps(d, 5, playStyle(d))),
    'sustained dps, all bounces hit': r0((d.magazineSize * d.damage * d.projectile.maxBounces) / (magazineSeconds(d) + reloadSeconds(d))),
  })));
}

// An instant-kill gun (the wonder weapon) kills one zombie per shot that connects, at any health: judged by kills a second against the best other gun, and by
// the ammo it carries against a wave. The Build-A-Blaster playtest (npm run balance:bab -- returnToSender 25,30) is its builds' rows.
const instantGuns = guns.filter((d) => d.instantKill);
if (instantGuns.length) {
  const waveSize = zombieCountForRound(25);
  console.log('INSTANT-KILL GUNS (kills a second, one target, sustained over magazine + reload, against the best other gun)');
  console.table(instantGuns.flatMap((d) => [10, 15, 20, 25, 30].map((round) => {
    const hp = zombieHealthForRound(round);
    const mine = killsPerSecond(d, hp, 5, playStyle(d));
    const best = Math.max(...guns.filter((g) => g !== d).map((g) => killsPerSecond(g, hp, 5, playStyle(g))));
    return {
      gun: d.name, round, 'zombie hp': r0(hp), 'kills/s': mine.toFixed(2), 'best other gun': best.toFixed(2), 'x the best': (mine / best).toFixed(1),
      carries: d.magazineSize + d.startingReserve, 'a refill gives': d.magazineSize + Math.round(d.startingReserve * (d.refillFraction ?? 1)),
      'wave 25': waveSize, 'beams for a boss': r1(1 / d.instantKill.bigFraction),
    };
  })));
}

// A scoped gun (the Stargazer 3000): its damage RISES with range (falloff minMultiplier above 1). Judged at 30 m with headshots, where it is meant to
// be the best, against the best wall gun aimed at the head too. "1 head kills to": the last round one aimed headshot at that range still kills a Shopper.
const scopedGuns = guns.filter((d) => d.scope);
if (scopedGuns.length) {
  const head = (d) => ({ ...playStyle(d), aimAt: 'head' });
  const lastOneShotRound = (d, m) => { let round = 0; while (round < 60 && shotsToKill(d, zombieHealthForRound(round + 1), m, head(d)) === 1) round += 1; return round; };
  const oneShotKills = (d, hp, m) => d.magazineSize / (magazineSeconds(d) + reloadSeconds(d)) / shotsToKill(d, hp, m, head(d)); // (no overkill credit)
  console.log('\nSCOPED GUNS (damage rises with range; headshots through the scope; kills/s at 30 m, one target, against the best wall gun, both aimed at the head)');
  console.table(scopedGuns.flatMap((d) => [5, 15, 30].map((m) => ({
    gun: d.name, range: `${m} m`, 'body hit': r0(expectedShotDamage(d, m, playStyle(d))), 'head hit': r0(expectedShotDamage(d, m, head(d))),
    '1 head kills to round': lastOneShotRound(d, m), 'hip lands': `${Math.round(100 * hitChance(d, m))}%`,
    pierces: d.pierce?.maxTargets ?? 1,
  }))));
  console.table(scopedGuns.flatMap((d) => [10, 15, 18, 20, 25].map((round) => {
    const hp = zombieHealthForRound(round);
    const mine = oneShotKills(d, hp, 30);
    const best = Math.max(...guns.filter((g) => !g.clawOnly).map((g) => killsPerSecond(g, hp, 30, head(g))));
    return { gun: d.name, round, 'zombie hp': r0(hp), 'kills/s at 30 m': mine.toFixed(2), 'best wall gun': best.toFixed(2), 'x the best': (mine / best).toFixed(2) };
  })));
}

// A blast gun (the Bottle Rocket Bazooka): its rocket bursts and hurts every zombie round the point (weapons/blast.js). The overview above counts ONE zombie at
// the centre; here, what a burst does by distance from it, the round a zombie there still dies in one, and a clump of six 1.5 m out against the wall.
const blastGuns = guns.filter((d) => d.blast);
if (blastGuns.length) {
  const noStats = { damageMultiplier: 1 };
  const lastRound = (damage) => { let round = 0; while (round < 60 && zombieHealthForRound(round + 1) <= damage) round += 1; return round; };
  console.log('\nBLAST GUNS (damage by distance from the burst; your own blast: share of your max health)');
  console.table(blastGuns.flatMap((d) => [0, 1, 1.5, 2.5, d.blast.radius].map((m) => {
    const damage = hitDamage(d, { part: 'body', blastDistance: m }, 0, noStats);
    const self = Math.min(d.blast.self.share * (1 + (d.blast.edgeFraction - 1) * m / d.blast.radius), d.blast.self.maxShare);
    return { gun: d.name, 'from the burst': `${m} m`, damage: r0(damage), 'kills to round': lastRound(damage), 'to you': `${Math.round(100 * self)}%` };
  })));
  console.table(blastGuns.map((d) => {
    const cycle = magazineSeconds(d) + reloadSeconds(d);
    const clump = (6 * hitDamage(d, { part: 'body', blastDistance: 1.5 }, 0, noStats)) / cycle;
    const best = guns.filter((g) => !g.clawOnly).map((g) => [g.name, sustainedDps(g, 15, playStyle(g)) * Math.min(6, g.pierce?.maxTargets ?? 1)]).sort((a, b) => b[1] - a[1])[0];
    return { gun: d.name, 'clump of 6 at 1.5 m, dps': r0(clump), 'best wall gun at 15 m (x its pierce)': `${best[0]} ${r0(best[1])}`, 'x the best': (clump / best[1]).toFixed(2) };
  }));
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
