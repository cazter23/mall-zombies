// GUN ROLES: what each gun is FOR, checked on its real numbers (tools/balance.js measures them the
// way `npm run balance` prints them). These are relationships, not exact values, so a retune passes as
// long as every gun still does its job, and an upgrade/mod that breaks a role is caught here.
// Pellet guns are measured from the hip, everything else aimed down sights; Shopper target, chest aim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weapons } from '../src/config/weapons.js';
import { zombieHealthForRound, economy } from '../src/config/economy.js';
import { sustainedDps, expectedShotDamage, shotsToKill } from '../tools/balance.js';
import { seededRandom } from '../src/world/textures.js';

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
    [priceGun, 10], [nailGun, 5], [foamDartBlaster, 8], [confettiCannon, 2],
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
