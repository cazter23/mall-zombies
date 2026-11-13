// GUN ROLES: what each gun is FOR, checked on its real numbers (tools/balance.js measures them the
// way `npm run balance` prints them). These are relationships, not exact values, so a retune passes as
// long as every gun still does its job, and an upgrade/mod that breaks a role is caught here.
// Pellet guns are measured from the hip, everything else aimed down sights; Shopper target, chest aim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weapons } from '../src/config/weapons.js';
import { zombieHealthForRound, zombieCountForRound, economy } from '../src/config/economy.js';
import { sustainedDps, expectedShotDamage, shotsToKill, killsPerSecond, hitChance, magazineSeconds, reloadSeconds } from '../tools/balance.js';
import { seededRandom } from '../src/world/textures.js';
import { hitDamage } from '../src/weapons/gunStats.js';

const style = (d) => ({ ads: !d.pellets, samples: 1500 });
const dps = (d, m) => sustainedDps(d, m, style(d));
// The role tests below compare the guns of the WALL. A claw-only gun (GRAB-A-GUN) has its own job, checked at the end of this file.
const all = Object.values(weapons).filter((d) => !d.clawOnly);
const clawGuns = Object.values(weapons).filter((d) => d.clawOnly);
const others = (gun) => all.filter((d) => d !== gun);
const { stapleGun, priceGun, nailGun, foamDartBlaster, confettiCannon } = weapons;

test('every falloff is well formed (full damage to start, down to minMultiplier at end)', () => {
  for (const d of all) {
    if (!d.falloff) continue;
    assert.ok(d.falloff.start < d.falloff.end, d.id);
    assert.ok(d.falloff.minMultiplier >= 0 && d.falloff.minMultiplier <= 1, d.id);
  }
});

test('Confetti Cannon: the room-clearer has the strongest sustained damage up close...', () => {
  const close = dps(confettiCannon, 2);
  for (const d of others(confettiCannon)) {
    assert.ok(close > dps(d, 2), `cannon ${Math.round(close)} vs ${d.name} ${Math.round(dps(d, 2))} at 2 m`);
  }
});

test('...and the weakest gun at range, near useless past 20 m', () => {
  const at12 = dps(confettiCannon, 12);
  for (const d of others(confettiCannon)) assert.ok(at12 < dps(d, 12), `cannon vs ${d.name} at 12 m`);
  assert.ok(dps(confettiCannon, 20) < 0.1 * dps(confettiCannon, 2));
});

test('Confetti Cannon blast targets: a close round-8 body kill, with hip range still limited', () => {
  const hp = zombieHealthForRound(8);
  assert.ok(expectedShotDamage(confettiCannon, 2) >= hp, 'point-blank blast vs round 8');
  assert.ok(expectedShotDamage(confettiCannon, 3) >= hp, 'average 3 m blast vs round 8');
  assert.ok(expectedShotDamage(confettiCannon, 5) < hp, 'hip fire at 5 m needs another shell');
});

test('Cannon close-range reliability: round-8 chest kills are dependable at 3 m and aimed at 5 m', () => {
  // Count individual blasts, rather than hiding inconsistent kills inside an average damage figure.
  // Independent seeded spread sequences keep this repeatable without aligning the first pellet of every blast.
  function killRate(range, ads = false) {
    const random = seededRandom(421), trials = 1500;
    let kills = 0;
    for (let i = 0; i < trials; i++) {
      const damage = expectedShotDamage(confettiCannon, range, {
        ads, samples: 1, seed: 1 + Math.floor(random() * 2147483645),
      });
      if (damage >= zombieHealthForRound(8)) kills++;
    }
    return kills / trials;
  }
  assert.ok(killRate(3) > 0.95, 'close chest blasts should rarely require a second shell');
  assert.ok(killRate(4) > 0.35, 'hip fire should still be useful one step farther out');
  assert.ok(killRate(5, true) > 0.95, 'aiming should reliably extend a round-8 kill to 5 m');
  assert.ok(expectedShotDamage(confettiCannon, 7, { ads: true })
    > 1.5 * expectedShotDamage(confettiCannon, 7), 'aiming remains valuable beyond hip range');
});

test('Price Gun: an affordable starter upgrade, clearly below the premium automatic guns...', () => {
  const at5 = dps(priceGun, 5);
  for (const d of [stapleGun]) {
    assert.ok(at5 > dps(d, 5), `price ${Math.round(at5)} vs ${d.name} ${Math.round(dps(d, 5))} at 5 m`);
  }
  assert.ok(dps(foamDartBlaster, 5) > 1.05 * at5, 'Foam is faster up close');
  assert.ok(dps(foamDartBlaster, 15) > 1.1 * dps(priceGun, 15), 'Foam pulls ahead at mid range');
  for (const d of [weapons.rivetRifle, weapons.coilNailer])
    assert.ok(dps(d, 5) > 1.1 * at5, `${d.name} is a meaningful upgrade`);
});

test('...but it falls off: the Nail Gun and Foam Dart Blaster beat it at 30 m', () => {
  assert.ok(dps(priceGun, 30) < dps(nailGun, 30));
  assert.ok(dps(priceGun, 30) < dps(foamDartBlaster, 30));
});

test('Nail Gun: no falloff, piercing, and a long-range advantage over the early gun', () => {
  assert.ok(dps(nailGun, 30) > 0.98 * dps(nailGun, 5));
  assert.ok(dps(nailGun, 30) > dps(priceGun, 30));
  assert.equal(nailGun.pierce.maxTargets, 3);
});

test('base guns meet the round-8 body-shot targets of the stronger-weapon pass', () => {
  const hp = zombieHealthForRound(8);
  for (const [d, expected] of [
    [priceGun, 12], [nailGun, 5], [foamDartBlaster, 8], [confettiCannon, 2],
    [weapons.rivetRifle, 8], [weapons.coilNailer, 8], [weapons.barcodeScanner, 3],
  ]) assert.equal(shotsToKill(d, hp, 5, style(d)), expected, d.name);
});

test('Foam Dart Blaster: the mid-range gun. Best sustained damage of the non-shotguns at 15 m', () => {
  for (const d of [stapleGun, priceGun, nailGun]) {
    assert.ok(dps(foamDartBlaster, 15) > dps(d, 15), `foam ${Math.round(dps(foamDartBlaster, 15))} vs ${d.name} ${Math.round(dps(d, 15))} at 15 m`);
  }
});

test('Staple Gun: the free starter is the weakest gun at every range (the cannon aside past its reach)', () => {
  for (const m of [2, 5, 10, 20, 30]) {
    for (const d of others(stapleGun)) {
      if (d === confettiCannon && m >= 5) continue; // the cannon is meant to be useless at range
      assert.ok(dps(stapleGun, m) < dps(d, m), `staple vs ${d.name} at ${m} m`);
    }
  }
});

test('Staple Gun, Foam Dart Blaster: full damage across a room (falloff starts past 10 m)', () => {
  for (const d of [stapleGun, foamDartBlaster]) assert.ok(d.falloff.start >= 10, d.id);
  assert.equal(nailGun.falloff, undefined, 'the Nail Gun has no falloff');
});

// --- Claw-only guns (GRAB-A-GUN): each does a job no wall gun does, and none is ever sold ---

test('claw-only guns are never on a wall: no price, and none is among the wall buys', () => {
  assert.ok(clawGuns.length >= 1);
  for (const d of clawGuns) assert.equal(economy.wallBuys[d.id], undefined, `${d.id} has a wall price`);
});

test('Leaf Blower: crowd control, not damage. The weakest hitter, the strongest shove, a few metres of reach, a tank that runs a few seconds', () => {
  const blower = weapons.leafBlower;
  assert.equal(blower.clawOnly, true);
  for (const d of all) {
    for (const m of [2, 5]) assert.ok(dps(blower, m) < 0.3 * dps(d, m), `blower vs ${d.name} at ${m} m: it must only tickle`);
  }
  const hp1 = zombieHealthForRound(1);
  assert.ok(blower.magazineSize * blower.damage < hp1, 'one whole tank cannot kill even a round-1 Shopper');
  const mostKnockback = Math.max(...all.map((d) => d.impact.knockback));
  assert.ok(blower.cone.knockback > 1.5 * mostKnockback, 'it shoves much harder than any bullet');
  assert.ok(blower.cone.halfAngleDegrees >= 20, 'a wide cone');
  assert.ok(blower.cone.range >= 5 && blower.cone.range <= 10, 'a few metres of reach');
  assert.ok(blower.cone.range < weapons.stapleGun.falloff.end, 'a short reach: past it, every wall gun does more');
  const blowSeconds = blower.magazineSize * blower.fireInterval; // a full tank, held down
  assert.ok(blowSeconds >= 4 && blowSeconds <= 8, `the tank runs ${blowSeconds.toFixed(1)} s`);
  const refillSeconds = blower.fuel.regenDelay + blower.magazineSize / blower.fuel.regenPerSecond;
  assert.ok(refillSeconds >= 4 && refillSeconds <= 9, `and refills in ${refillSeconds.toFixed(1)} s`);
  assert.equal(blower.startingReserve, 0, 'nothing to reload from');
  assert.ok(blower.cone.knockdownRange < blower.cone.range, 'only the close ones go down');
});

test('Tennis Ball Launcher: the corridor gun. One hit a ball in the open (weak: below the Price Gun at every range), a few bounces, no more than a cannon blast a ball', () => {
  const launcher = weapons.tennisBallLauncher;
  assert.equal(launcher.clawOnly, true);
  for (const m of [2, 5, 10, 20]) assert.ok(dps(launcher, m) < dps(priceGun, m), `launcher ${Math.round(dps(launcher, m))} vs Price Gun ${Math.round(dps(priceGun, m))} at ${m} m (one hit a ball)`);
  const p = launcher.projectile;
  assert.ok(p.maxBounces >= 4 && p.maxBounces <= 6, 'a few bounces');
  assert.ok(p.seekRange >= 2 && p.seekRange <= 6, 'it only finds zombies close together');
  assert.ok(p.restitution > 0.7 && p.restitution < 1, 'a bounce keeps most of the speed, never all of it');
  assert.ok(launcher.damage * p.maxBounces < expectedShotDamage(confettiCannon, 2), 'the best a ball can do is below a point-blank cannon blast');
  assert.ok(launcher.magazineSize >= 4 && launcher.magazineSize <= 10);
});

test('Return to Sender, the wonder weapon: a blast that returns every zombie in a wide, short cone at any round, starved by a two-shot tube, a slow reload and a half-rate refill', () => {
  const rts = weapons.returnToSender;
  const cone = rts.cone;
  assert.equal(rts.clawOnly, true);
  assert.ok(rts.instantKill && rts.refillFraction > 0 && rts.refillFraction < 1);
  assert.equal(shotsToKill(rts, zombieHealthForRound(30), 5, style(rts)), 1, 'one blast that catches a round-30 Shopper kills it');
  assert.equal(shotsToKill(rts, zombieHealthForRound(1), 5, style(rts)), 1);
  // The blast: wide and short. It kills across a room, not down a hallway; past the kill line it only knocks down.
  assert.ok(cone.halfAngleDegrees >= 25 && cone.halfAngleDegrees <= 35, 'a wide cone');
  assert.ok(cone.killRange >= 6 && cone.killRange <= 10, `kills across a room (${cone.killRange} m)`);
  assert.ok(cone.range > cone.killRange && cone.range <= 14 && cone.knockdownRange >= cone.range, 'and knocks down the next few metres');
  // Not a duellist: on one zombie at a time it is no faster than the best other gun until the late rounds.
  const everyOtherGun = Object.values(weapons).filter((d) => d !== rts);
  const best = (round) => Math.max(...everyOtherGun.map((d) => killsPerSecond(d, zombieHealthForRound(round), 5, style(d))));
  const mine = (round) => killsPerSecond(rts, zombieHealthForRound(round), 5, style(rts));
  assert.ok(mine(10) < best(10), `one at a time it is not the answer (${mine(10).toFixed(2)} kills/s at round 10 vs ${best(10).toFixed(2)})`);
  // The crowd: a blast into a crush of eight clears it, which nothing else comes near late on.
  for (const round of [20, 30]) assert.ok(8 * mine(round) > 3 * best(round), `round ${round}: into a crowd it is the answer`);
  // Starved: twelve blasts in all, a refill gives seven, two in the tube, slow to fire and reload.
  assert.equal(rts.magazineSize, 2, 'two blasts a tube');
  assert.ok(rts.magazineSize + rts.startingReserve <= 12, 'twelve blasts at most');
  assert.ok(rts.magazineSize + Math.round(rts.startingReserve * rts.refillFraction) <= 7, 'a refill gives seven at most');
  assert.ok(rts.fireInterval >= 0.6 && rts.reloadTime >= 2.5, 'slow to fire, slow to reload');
  assert.ok(1 / rts.instantKill.bigFraction >= 6 && 1 / rts.instantKill.bigFraction <= 15, 'a boss takes 6 to 15 blasts, never one');
  // The other cone gun, the Leaf Blower, shoves and never kills: the two do not overlap.
  assert.ok(!weapons.leafBlower.instantKill && cone.killRange > weapons.leafBlower.cone.range * 0.9);
});

test('Stargazer 3000, the sniper: the further away, the harder it hits; the hardest hit there is at 30 m, one headshot there kills to about round 20, and clumsy up close', () => {
  const sg = weapons.stargazer;
  assert.equal(sg.clawOnly, true);
  const head = (d) => ({ ...style(d), aimAt: 'head' });
  const hit = (d, m, o = style(d)) => expectedShotDamage(d, m, o);
  // Rising damage: the only gun that hits harder at 30 m than at 5 m.
  assert.ok(hit(sg, 30) > 1.9 * hit(sg, 5), `${Math.round(hit(sg, 30))} at 30 m vs ${Math.round(hit(sg, 5))} at 5 m`);
  for (const d of Object.values(weapons)) if (d !== sg) assert.ok(hit(d, 30) <= hit(d, 5) + 1e-9, `${d.name} must not gain with range`);
  // The hardest single hit at 30 m, body or head (the instant kill aside: it ignores damage; and a blast, which hits everything round a point).
  assert.ok(hit(sg, 30, head(sg)) > weapons.bottleRocket.damage, 'a 30 m headshot beats even the centre of a rocket burst');
  for (const d of Object.values(weapons).filter((g) => g !== sg && !g.instantKill && !g.blast)) {
    assert.ok(hit(sg, 30) > 2 * hit(d, 30), `body at 30 m vs ${d.name}`);
    assert.ok(hit(sg, 30, head(sg)) > 2 * hit(d, 30, head(d)), `head at 30 m vs ${d.name}`);
  }
  // One aimed headshot: through round 20 at 30 m, only to about round 10 across a room.
  assert.equal(shotsToKill(sg, zombieHealthForRound(20), 30, head(sg)), 1, 'a round-20 Shopper, one headshot at 30 m');
  assert.equal(shotsToKill(sg, zombieHealthForRound(23), 30, head(sg)), 2, 'not forever: two by round 23');
  assert.equal(shotsToKill(sg, zombieHealthForRound(10), 5, head(sg)), 1);
  assert.equal(shotsToKill(sg, zombieHealthForRound(13), 5, head(sg)), 2, 'close up the same headshot runs out by round 13');
  // Its window: at 30 m with headshots, from round 16 to 20 it kills faster than any wall gun (no pierce counted).
  const oneShotKillsPerSecond = sg.magazineSize / (magazineSeconds(sg) + reloadSeconds(sg));
  for (const round of [16, 18, 20]) {
    const hp = zombieHealthForRound(round);
    for (const d of all) assert.ok(oneShotKillsPerSecond > killsPerSecond(d, hp, 30, head(d)), `round ${round} at 30 m vs ${d.name}`);
  }
  // Clumsy up close: below the Price Gun at 2 and 5 m, and from the hip it misses most shots at 10 m.
  for (const m of [2, 5]) assert.ok(dps(sg, m) < dps(priceGun, m), `${Math.round(dps(sg, m))} vs the Price Gun's ${Math.round(dps(priceGun, m))} at ${m} m`);
  assert.ok(hitChance(sg, 10) < 0.5, 'hip fire at 10 m lands under half the time');
  // Sniper hip fire, not a piercing shotgun (playtest, 13 November 2026): a gamble even close in.
  assert.ok(hitChance(sg, 3) <= 0.6, `hip fire at 3 m: ${Math.round(hitChance(sg, 3) * 100)}% (a coin flip, not a sure thing)`);
  assert.ok(hitChance(sg, 5) <= 0.35, `hip fire at 5 m: ${Math.round(hitChance(sg, 5) * 100)}%`);
  assert.ok(hitChance(sg, 30, { ads: true }) > 0.99, 'through the scope it is dead on');
  // A line of zombies, a real scope, and held back by a slow bolt, a small magazine and a long reload.
  assert.ok(sg.pierce.maxTargets >= 3 && sg.pierce.maxTargets <= 5);
  assert.ok(sg.scope.sway.degrees > 0 && sg.scope.boltDropTo === undefined, 'it sways, and a shot never takes the eye off the eyepiece');
  assert.ok(sg.ads.fovMultiplier <= 0.35, 'a real zoom');
  assert.ok(sg.fireInterval >= 1 && sg.reloadTime >= 3 && sg.magazineSize <= 6);
});

test('Bottle Rocket Bazooka: the only gun that hurts everything around a point; it breaks a clump better than anything on the wall, duels worse than the Price Gun, and can hurt you but never one-shot you', () => {
  const rk = weapons.bottleRocket;
  assert.equal(rk.clawOnly, true);
  for (const d of Object.values(weapons)) if (d !== rk && d.blast) assert.ok(d.blast.radius < rk.blast.radius / 2 && !d.blast.self, `${d.name}: any other blast is a small pop that never hurts you`);
  const NO_STATS = { damageMultiplier: 1 };
  const at = (m) => hitDamage(rk, { part: 'body', blastDistance: m }, 0, NO_STATS);
  const cycle = magazineSeconds(rk) + reloadSeconds(rk);
  // A clump of six Shoppers 1.5 m round the burst, 15 m away: more damage a second than any wall gun can do there, even counting its pierce,
  // and over twice what any of them does to one zombie.
  const clump = (6 * at(1.5)) / cycle;
  for (const d of all) {
    assert.ok(clump > dps(d, 15) * Math.min(6, d.pierce?.maxTargets ?? 1), `clump ${Math.round(clump)} vs ${d.name} with its pierce`);
    assert.ok(clump > 2 * dps(d, 15), `clump vs ${d.name} on one zombie`);
  }
  // What one rocket does: its centre kills a round-10 Shopper, 1.5 m out a round-7 one, and the edge still stings.
  assert.ok(at(0) >= zombieHealthForRound(10) && at(1.5) >= zombieHealthForRound(7));
  assert.ok(at(rk.blast.radius) > 0 && at(rk.blast.radius + 0.01) === 0);
  assert.ok(rk.blast.radius >= 2.5 && rk.blast.radius <= 5, 'a room-corner of a blast, not the whole room');
  // A poor duellist: one rocket in the tube and a slow reload; on one zombie it is below the Price Gun.
  for (const m of [5, 15]) assert.ok(dps(rk, m) < dps(priceGun, m), `one zombie at ${m} m: ${Math.round(dps(rk, m))} vs the Price Gun's ${Math.round(dps(priceGun, m))}`);
  assert.ok(rk.magazineSize <= 2 && rk.reloadTime >= 2);
  // Your own blast: a real bite at its centre, never a one-shot from full health.
  assert.ok(rk.blast.self.share >= 0.25 && rk.blast.self.maxShare < 1);
  // Still not the wonder weapon: Return to Sender kills more a second on one zombie from round 12 (its own test checks every gun).
  assert.ok(killsPerSecond(rk, zombieHealthForRound(12), 5, style(rk)) < killsPerSecond(weapons.returnToSender, zombieHealthForRound(12), 5, style(weapons.returnToSender)));
});

test('Balloon Launcher: the gun that hits what you do not aim at. Its balloons home (a wide cone, a quick turn, a long reach) but fly slowly; on one zombie you aim at it is below the Price Gun, and its pop is small and never hurts you', () => {
  const bl = weapons.balloonLauncher;
  assert.equal(bl.clawOnly, true);
  for (const d of Object.values(weapons)) if (d !== bl) assert.equal(d.flight?.homing, undefined, `${d.name} does not home`);
  const h = bl.flight.homing;
  assert.ok(h.coneDegrees >= 45 && h.coneDegrees <= 75, 'it finds a zombie well off to one side, never one behind it');
  assert.ok(h.turnDegreesPerSecond >= 90, 'and turns hard enough to reach it');
  assert.ok(h.range >= 10 && bl.flight.speed * bl.flight.lifeSeconds >= 25, 'across a room and down a corridor');
  assert.ok(bl.flight.speed <= 12, 'slow: a balloon, not a bullet (a sprinting Mall Walker gets a head start)');
  for (const m of [2, 5, 10, 20]) assert.ok(dps(bl, m) < dps(priceGun, m), `aimed at one zombie at ${m} m: ${Math.round(dps(bl, m))} vs the Price Gun's ${Math.round(dps(priceGun, m))}`);
  assert.ok(bl.blast.radius <= 1.5 && !bl.blast.self, 'a small pop, harmless to you');
  assert.ok(bl.magazineSize >= 6 && bl.fireInterval <= 0.4, 'a handful of balloons, quickly: fire and forget');
});
