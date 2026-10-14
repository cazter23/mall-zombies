// GUN ROLES: what each gun is FOR, checked on its real numbers (tools/balance.js measures them the
// way `npm run balance` prints them). These are relationships, not exact values, so a retune passes as
// long as every gun still does its job, and an upgrade/mod that breaks a role is caught here.
// Pellet guns are measured from the hip, everything else aimed down sights; Shopper target, chest aim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { weapons } from '../src/config/weapons.js';
import { zombieHealthForRound } from '../src/config/economy.js';
import { sustainedDps, expectedShotDamage } from '../tools/balance.js';

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

test('Confetti Cannon blast targets: one blast kills round 3 up close; no single blast can kill round 5 (room for upgrades)', () => {
  assert.ok(expectedShotDamage(confettiCannon, 2) >= zombieHealthForRound(3), 'average point-blank blast vs round 3');
  assert.ok(confettiCannon.damage * confettiCannon.pellets.count < zombieHealthForRound(5), 'best possible blast vs round 5');
});

test('Price Gun: the cheap close-range sprayer. Best sustained damage at 5 m of the non-shotguns...', () => {
  const at5 = dps(priceGun, 5);
  for (const d of [stapleGun, nailGun, foamDartBlaster]) {
    assert.ok(at5 > dps(d, 5), `price ${Math.round(at5)} vs ${d.name} ${Math.round(dps(d, 5))} at 5 m`);
  }
});

test('...but it falls off: the Nail Gun and Foam Dart Blaster beat it at 30 m', () => {
  assert.ok(dps(priceGun, 30) < dps(nailGun, 30));
  assert.ok(dps(priceGun, 30) < dps(foamDartBlaster, 30));
});

test('Nail Gun: the long-range gun. Best sustained damage at 30 m', () => {
  for (const d of others(nailGun)) assert.ok(dps(nailGun, 30) > dps(d, 30), `nail vs ${d.name} at 30 m`);
});

test('Staple Gun: the free starter is the weakest gun at 5 m', () => {
  for (const d of others(stapleGun)) assert.ok(dps(stapleGun, 5) < dps(d, 5), `staple vs ${d.name} at 5 m`);
});
