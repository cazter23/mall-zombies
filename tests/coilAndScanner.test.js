import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { upgrades } from '../src/config/upgrades.js';
import { Weapon } from '../src/weapons/weapon.js';
import { createPlayerStats } from '../src/player/stats.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withTier } from '../src/weapons/upgrades.js';
import { sustainedDps } from '../tools/balance.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';

const { coilNailer, barcodeScanner } = weapons;
const dt = 1 / 60;

test('Heavy Coil Nailer fires 8 nails/s from a 64-nail drum and reloads in 3.1s from its 256 reserve', () => {
  const w = new Weapon(coilNailer, createPlayerStats());
  let shots = 0;
  for (let tick = 0; tick < 60; tick++) {
    if (w.update(dt, { triggerPressed: tick === 0, triggerHeld: true }) === 'fire') shots++;
  }
  assert.equal(shots, 8, '8 shots in the first second (fireInterval 0.125)');
  for (let tick = 0; tick < 600 && w.magazine > 0; tick++) { // (64 nails at 8/s: 8 s)
    if (w.update(dt, { triggerHeld: true }) === 'fire') shots++;
  }
  assert.equal(shots, 64);
  assert.equal(w.magazine, 0);
  w.startReload();
  const reloadTicks = Math.round(coilNailer.reloadTime / dt);
  for (let tick = 0; tick < reloadTicks - 2; tick++) w.update(dt, {});
  assert.equal(w.magazine, 0, '3.1s drum reload has not finished early');
  for (let tick = 0; tick < 5; tick++) w.update(dt, {});
  assert.equal(w.magazine, 64);
  assert.equal(w.reserve, 256 - 64);
});

test('Heavy Coil Nailer pierces two targets in a line (100% then 50%) and stops before a third', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.gun.give(coilNailer);
  t.tick(45);
  t.standAt(0, 12, 0, Math.atan2(1 - g.player.eyeHeight, 3));
  const zs = [3, 4, 5].map((meters) => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 12 - meters));
    z.setState('chasing');
    z.health = 200;
    z.speed = 0;
    z.updateHitboxes();
    return z;
  });
  t.press('Mouse0');
  assert.equal(zs[0].health, 200 - coilNailer.damage);
  assert.equal(zs[1].health, 200 - coilNailer.damage * 0.5);
  assert.equal(zs[2].health, 200, 'stops after 2 targets');
  assert.equal(g.gun.lastShot.weaponId, 'coilNailer');
  assert.ok(t.sounds.includes('coilShot'));
});

test('Heavy Coil Nailer model animates nose punch, piston dome hop, and coil drum swap', () => {
  const model = buildWeaponModel(coilNailer);
  const display = buildWeaponDisplay(coilNailer);
  assert.ok(display.getObjectByName('coilDrum'));
  const drum = model.root.getObjectByName('coilDrum');
  const heldDrum = model.root.getObjectByName('heldCoilDrum');
  const nose = model.root.getObjectByName('driverNose');
  const dome = model.root.getObjectByName('pistonDome');
  const restNoseZ = nose.position.z;
  const restDomeY = dome.position.y;

  model.animate({ sinceFire: 0.015, reloadProgress: 0, reloadWeight: 0 });
  assert.ok(nose.position.z < restNoseZ, 'driver nose punches forward on shot');
  assert.ok(dome.position.y > restDomeY, 'piston dome hops on shot');

  model.animate({ sinceFire: Infinity, reloadProgress: 0.28, reloadWeight: 1 });
  assert.equal(drum.visible, false);
  assert.equal(heldDrum.visible, true);

  model.animate({ sinceFire: Infinity, reloadProgress: 0.55, reloadWeight: 1 });
  assert.equal(drum.visible, false);
  assert.equal(heldDrum.visible, true);

  model.animate({ sinceFire: Infinity, reloadProgress: 0.8, reloadWeight: 1 });
  assert.equal(drum.visible, true);
  assert.equal(heldDrum.visible, false);
});

// The Barcode Scanner rework (13 November 2026): hold to scan, the beam fires itself when the scan completes, no weak tap, and what it hits
// is RUNG UP (game/rungUp.js).
function scannerRange(t, metersList, { health = 2000 } = {}) {
  const { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.gun.give(barcodeScanner);
  t.tick(45);
  t.standAt(0, 13.5, 0, -0.15);
  const zs = metersList.map((meters) => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 13.5 - meters));
    z.setState('chasing');
    z.health = z.maxHealth = health;
    z.speed = 0;
    z.updateHitboxes();
    return z;
  });
  return zs;
}

test('Barcode Scanner: a tap or a release before the scan completes fires nothing and spends nothing; holding fires the moment it completes, and again', () => {
  const scanTicks = Math.ceil(barcodeScanner.charge.seconds / dt);
  // A tap: one tick pressed, then let go. No shot, no ammo, no scan left running.
  const tap = new Weapon(barcodeScanner, createPlayerStats());
  assert.equal(tap.update(dt, { triggerPressed: true, triggerHeld: true }), null);
  assert.equal(tap.isCharging, true, 'the scan starts on the press');
  assert.equal(tap.update(dt, { triggerHeld: false }), null);
  assert.equal(tap.isCharging, false);
  assert.equal(tap.magazine, barcodeScanner.magazineSize, 'a tap spends nothing');
  // Let go one tick short of the scan: still nothing.
  const early = new Weapon(barcodeScanner, createPlayerStats());
  early.update(dt, { triggerPressed: true, triggerHeld: true });
  for (let i = 1; i < scanTicks - 1; i++) assert.equal(early.update(dt, { triggerHeld: true }), null);
  assert.equal(early.update(dt, { triggerHeld: false }), null, 'released just before the scan completed');
  assert.equal(early.magazine, barcodeScanner.magazineSize);
  // Held: it fires on the tick the scan completes, a full shot, with no release needed.
  const held = new Weapon(barcodeScanner, createPlayerStats());
  const fired = [];
  for (let tick = 0; tick < 180; tick++) {
    if (held.update(dt, { triggerPressed: tick === 0, triggerHeld: true }) === 'fire') fired.push(tick);
  }
  assert.equal(fired[0], scanTicks - 1, `the first beam fires as the ${barcodeScanner.charge.seconds} s scan completes`);
  assert.equal(held.lastChargeRatio, 1, 'every shot is a full shot');
  // Keep holding: it scans again after the fire interval and fires again (a beam every charge + interval).
  const cycle = Math.round((barcodeScanner.charge.seconds + barcodeScanner.fireInterval) / dt);
  assert.ok(fired.length >= 4, `held 3 s: ${fired.length} beams`);
  for (let i = 1; i < fired.length; i++) assert.ok(Math.abs(fired[i] - fired[i - 1] - cycle) <= 2, `beam ${i}: ${fired[i] - fired[i - 1]} ticks apart (~${cycle})`);
});

test('Barcode Scanner: a full beam pierces 4 in a line (1, 0.85, 0.7, 0.55), beeps, and rings up every zombie it hits', () => {
  const t = headlessGame();
  const { g } = t;
  const zs = scannerRange(t, [1.8, 2.6, 3.4, 4.2, 5.0]);
  g.zombies.update = () => {};
  const marked = [];
  g.events.on('rungUp', ({ zombie }) => marked.push(zombie));
  t.press('Mouse0', Math.ceil(barcodeScanner.charge.seconds / dt));
  assert.equal(g.runStats.shotsFired, 1);
  const falloff = barcodeScanner.pierce.damageFalloff;
  assert.deepEqual(falloff, [1, 0.85, 0.7, 0.55]);
  falloff.forEach((f, i) => assert.equal(zs[i].health, 2000 - 420 * f, `target ${i + 1}: 420 x ${f}`));
  assert.equal(zs[4].health, 2000, 'the beam stops after 4');
  assert.ok(t.sounds.includes('scannerCharge') && t.sounds.includes('scannerShot') && t.sounds.includes('scannerBeep'), 'whine, shot and checkout BEEP');
  assert.deepEqual(marked, zs.slice(0, 4), 'all four rung up');
  for (const z of zs.slice(0, 4)) {
    assert.equal(z.isRungUp, true);
    assert.equal(z.rungUpTimer, barcodeScanner.rungUp.seconds);
  }
  assert.equal(zs[4].isRungUp, false);
});

test('RUNG UP: x1.35 damage from everything for 4 s, +40 on a kill while marked, gone on death, and nothing paid once the run is over', () => {
  const { rungUp } = barcodeScanner;
  assert.deepEqual([rungUp.seconds, rungUp.damageTaken, rungUp.killBonus], [4, 1.35, 40]);
  const t = headlessGame();
  const { g } = t;
  const [a, b, c] = scannerRange(t, [2, 2.8, 3.6], { health: 5000 });
  g.health.invulnerable = true;
  t.press('Mouse0', Math.ceil(barcodeScanner.charge.seconds / dt)); // rings all three up
  assert.ok(a.isRungUp && b.isRungUp && c.isRungUp);
  // More from EVERYTHING: a hazard's hit and the box cutter's, not just the scanner.
  const before = a.health;
  a.takeHit({ damage: 100, part: 'body', source: 'hazard' });
  assert.equal(before - a.health, 135, 'a hazard hit of 100 does 135');
  b.health = 50;
  const melee = b.health;
  b.takeHit({ damage: 20, part: 'body', melee: true });
  assert.equal(melee - b.health, 27, 'a box cutter hit of 20 does 27');
  // A kill while marked pays the kill (60 for a Shopper) and the bonus (40).
  const bonuses = [];
  g.events.on('rungUpKill', (e) => bonuses.push(e));
  let points = g.wallet.points;
  a.takeHit({ damage: 1e6, part: 'body', source: 'gun', weaponId: 'priceGun' });
  assert.equal(g.wallet.points - points, 60 + 40);
  assert.equal(bonuses.length, 1);
  assert.equal(a.rungUpTimer, 0, 'the mark ends with it');
  // Wears off: after its 4 s, a kill pays the plain kill only.
  b.health = 5000;
  t.tick(Math.ceil(rungUp.seconds / dt) + 2);
  assert.equal(b.isRungUp, false, 'worn off after 4 s');
  points = g.wallet.points;
  b.takeHit({ damage: 1e6, part: 'body', source: 'gun', weaponId: 'priceGun' });
  assert.equal(g.wallet.points - points, 60, 'no bonus once the mark is gone');
  // Once the run is over nothing more is paid, the bonus included.
  c.applyRungUp(rungUp.seconds, rungUp.damageTaken);
  c.rungUpBonus = rungUp.killBonus;
  g.state.over = true;
  points = g.wallet.points;
  c.takeHit({ damage: 1e6, part: 'body', source: 'gun' });
  assert.equal(g.wallet.points, points);
  assert.equal(bonuses.length, 1);
  g.state.over = false;
  // Play again: the zombies (and their marks) are gone.
  g.resetRun();
  assert.equal(g.zombies.zombies.filter((z) => z.isRungUp).length, 0);
});

test('Barcode Scanner charge is cancelled cleanly by reload, weapon switch, or blocking without spending ammo', () => {
  const w = new Weapon(barcodeScanner, createPlayerStats());
  w.magazine = 4;
  w.update(dt, { triggerPressed: true, triggerHeld: true });
  assert.equal(w.isCharging, true);
  assert.ok(w.chargeProgress > 0);
  // Pressing reload aborts the charge and starts reloading
  const res = w.update(dt, { triggerHeld: true, reloadPressed: true });
  assert.equal(res, null);
  assert.equal(w.isCharging, false);
  assert.equal(w.isReloading, true);
  assert.equal(w.magazine, 4, 'no ammo spent on cancelled charge');

  // Blocking mid-charge also drops the charge without firing
  const w2 = new Weapon(barcodeScanner, createPlayerStats());
  w2.update(dt, { triggerPressed: true, triggerHeld: true });
  assert.equal(w2.isCharging, true);
  assert.equal(w2.update(dt, { blocked: true }), null);
  assert.equal(w2.isCharging, false);
  assert.equal(w2.magazine, barcodeScanner.magazineSize);
});

test('Barcode Scanner model ramps LED charge bars and emitter glow with chargeProgress and swaps battery on reload', () => {
  const model = buildWeaponModel(barcodeScanner);
  const display = buildWeaponDisplay(barcodeScanner);
  assert.ok(display.getObjectByName('emitterWindow'));
  const win = model.root.getObjectByName('emitterWindow');
  const led0 = model.root.getObjectByName('chargeLed0');
  const led2 = model.root.getObjectByName('chargeLed2');
  const battery = model.root.getObjectByName('scannerBattery');
  const heldBattery = model.root.getObjectByName('heldScannerBattery');

  model.animate({ sinceFire: Infinity, reloadProgress: 0, reloadWeight: 0, chargeProgress: 0 });
  const idleGlow = win.material.emissiveIntensity;
  assert.ok(led0.material.emissiveIntensity < 1);
  assert.ok(led2.material.emissiveIntensity < 1);

  model.animate({ sinceFire: Infinity, reloadProgress: 0, reloadWeight: 0, chargeProgress: 1 });
  assert.ok(win.material.emissiveIntensity > idleGlow + 1, 'emitter window glows brighter at full charge');
  assert.ok(led0.material.emissiveIntensity > 1.5);
  assert.ok(led2.material.emissiveIntensity > 1.5);

  model.animate({ sinceFire: Infinity, reloadProgress: 0.25, reloadWeight: 1, chargeProgress: 0 });
  assert.equal(battery.visible, false);
  assert.equal(heldBattery.visible, true);

  model.animate({ sinceFire: Infinity, reloadProgress: 0.75, reloadWeight: 1, chargeProgress: 0 });
  assert.equal(battery.visible, true);
  assert.equal(heldBattery.visible, false);
});

test('both guns are wall buys (tests/lateWallGuns.test.js buys them) while still supporting debug giveGun, upgrades, and roles across tiers', () => {
  const t = headlessGame();
  const { g } = t;
  for (const gun of [coilNailer, barcodeScanner]) {
    assert.equal(gun.debugOnly, undefined);
    assert.ok(economy.wallBuys[gun.id].weapon > 0 && economy.wallBuys[gun.id].ammo > 0);
    assert.equal(g.map.features.filter((f) => f.weapon === gun.id).length, 1);
  }
  for (const tier of upgrades.tiers) {
    const at = (base) => resolveGun(base, withTier(base, [], tier.id));
    const coil = at(coilNailer);
    const scanner = at(barcodeScanner);
    const nail = at(weapons.nailGun);
    const staple = at(weapons.stapleGun);
    const dps = (d, m) => sustainedDps(d, m, { ads: true, samples: 500 });
    assert.ok(dps(coil, 5) > dps(staple, 5), tier.id);
    assert.ok(dps(scanner, 5) > dps(staple, 5), tier.id);
    assert.ok(dps(coil, 5) > dps(at(weapons.rivetRifle), 5), `${tier.id}: heavy sustained-fire role`);
    assert.ok(dps(nail, 30) > 0.98 * dps(nail, 5), `${tier.id}: Nail damage holds at range`);
    assert.equal(scanner.pierce.maxTargets, 4, `${tier.id}: Scanner keeps its crowd role`);
  }
});
