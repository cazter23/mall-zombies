// GUN ROLES: what each gun is FOR, checked on its real numbers (tools/balance.js measures them the
// way `npm run balance` prints them). These are relationships, not exact values, so a retune passes as
// long as every gun still does its job, and an upgrade/mod that breaks a role is caught here.
// Pellet guns are measured from the hip, everything else aimed down sights; Shopper target, chest aim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weapons } from '../src/config/weapons.js';
import { zombieHealthForRound } from '../src/config/economy.js';
import { sustainedDps, expectedShotDamage } from '../tools/balance.js';
import { seededRandom } from '../src/world/textures.js';

const style = (d) => ({ ads: !d.pellets, samples: 1500 });
const dps = (d, m) => sustainedDps(d, m, style(d));
const all = Object.values(weapons);
const others = (gun) => all.filter((d) => d !== gun);
const { stapleGun, priceGun, nailGun, foamDartBlaster, confettiCannon } = weapons;

test('every falloff is well formed (full damage to start, down to minMultiplier at end)', () => {
  for (const d of all) {
    if (!d.falloff) continue;
    assert.ok(d.falloff.start < d.falloff.end, d.id);
    assert.ok(d.falloff.minMultiplier >= 0 && d.falloff.minMultiplier <= 1, d.id);
  }
});

test('Confetti Cannon: the room-clearer. Clearly the strongest gun up close...', () => {
  const close = dps(confettiCannon, 2);
  for (const d of others(confettiCannon)) {
    assert.ok(close >= 1.4 * dps(d, 2), `cannon ${Math.round(close)} vs ${d.name} ${Math.round(dps(d, 2))} at 2 m (needs 1.4x)`);
  }
});

test('...and the weakest gun at range, near useless past 20 m', () => {
  const at12 = dps(confettiCannon, 12);
  for (const d of others(confettiCannon)) assert.ok(at12 < dps(d, 12), `cannon vs ${d.name} at 12 m`);
  assert.ok(dps(confettiCannon, 20) < 0.1 * dps(confettiCannon, 2));
});

test('Confetti Cannon blast targets: one blast kills round 3 up close; no single BODY blast can kill round 5 (room for upgrades)', () => {
  assert.ok(expectedShotDamage(confettiCannon, 2) >= zombieHealthForRound(3), 'average point-blank blast vs round 3');
  assert.ok(confettiCannon.damage * confettiCannon.pellets.count < zombieHealthForRound(5), 'best possible body blast vs round 5');
  // (A point-blank HEAD blast can: 2x per pellet. That's a deliberate, risky close-range reward.)
});

test('Cannon close-range reliability: round-3 chest kills are dependable at 3 m, useful at 4 m, and aimed at 5 m', () => {
  // Count individual blasts, rather than hiding inconsistent kills inside an average damage figure.
  // Independent seeded spread sequences keep this repeatable without aligning the first pellet of every blast.
  function killRate(range, ads = false) {
    const random = seededRandom(421), trials = 1500;
    let kills = 0;
    for (let i = 0; i < trials; i++) {
      const damage = expectedShotDamage(confettiCannon, range, {
        ads, samples: 1, seed: 1 + Math.floor(random() * 2147483645),
      });
      if (damage >= zombieHealthForRound(3)) kills++;
    }
    return kills / trials;
  }
  assert.ok(killRate(3) > 0.98, 'close chest blasts should rarely require a second shell');
  assert.ok(killRate(4) > 0.65, 'hip fire should still be useful one step farther out');
  assert.ok(killRate(5, true) > 0.95, 'aiming should reliably extend a round-3 kill to 5 m');
  assert.ok(expectedShotDamage(confettiCannon, 7, { ads: true })
    > 1.5 * expectedShotDamage(confettiCannon, 7), 'aiming remains valuable beyond hip range');
});

test('Price Gun: an affordable starter upgrade, clearly below the premium automatic guns...', () => {
  const at5 = dps(priceGun, 5);
  for (const d of [stapleGun]) {
    assert.ok(at5 > dps(d, 5), `price ${Math.round(at5)} vs ${d.name} ${Math.round(dps(d, 5))} at 5 m`);
  }
  for (const d of [foamDartBlaster, weapons.rivetRifle, weapons.coilNailer])
    assert.ok(dps(d, 5) > 1.1 * at5, `${d.name} is a meaningful upgrade`);
});

test('...but it falls off: the Nail Gun and Foam Dart Blaster beat it at 30 m', () => {
  assert.ok(dps(priceGun, 30) < dps(nailGun, 30));
  assert.ok(dps(priceGun, 30) < dps(foamDartBlaster, 30));
});

test('Nail Gun: the long-range gun. Best sustained damage at 30 m (at least 10% ahead)', () => {
  for (const d of others(nailGun)) {
    assert.ok(dps(nailGun, 30) > 1.1 * dps(d, 30), `nail ${Math.round(dps(nailGun, 30))} vs ${d.name} ${Math.round(dps(d, 30))} at 30 m`);
  }
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
