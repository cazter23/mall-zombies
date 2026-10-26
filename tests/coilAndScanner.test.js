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

test('Heavy Coil Nailer fires 10 nails/s from a 64-nail drum and reloads in 3.1s from its 256 reserve', () => {
  const w = new Weapon(coilNailer, createPlayerStats());
  let shots = 0;
  for (let tick = 0; tick < 60; tick++) {
    if (w.update(dt, { triggerPressed: tick === 0, triggerHeld: true }) === 'fire') shots++;
  }
  assert.equal(shots, 10, '10 shots in the first second');
  for (let tick = 0; tick < 400 && w.magazine > 0; tick++) {
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

test('Barcode Scanner charge-and-release: tap fires a weak 1-target snap shot; full hold fires a 4-target railgun beam', () => {
  // 1. Quick tap (1 tick press, then release) -> low chargeRatio, 1 target pierced
  {
    const t = headlessGame();
    const { g } = t;
    t.tick();
    g.rounds.update = () => {};
    g.zombies.clear();
    g.gun.give(barcodeScanner);
    t.tick(45);
    t.standAt(0, 12, 0, -0.15);
    const zs = [3, 4, 5, 6].map((meters) => {
      const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 12 - meters));
      z.setState('chasing');
      z.health = 500;
      z.speed = 0;
      z.updateHitboxes();
      return z;
    });
    t.press('Mouse0', 1); // 1 tick held (starts charge)
    assert.ok(t.sounds.includes('scannerCharge'), 'plays capacitor whine when charge begins');
    t.tick(1); // released on next tick -> fires snap shot
    assert.equal(g.runStats.shotsFired, 1);
    assert.ok(g.gun.lastShot.chargeRatio < 0.1, 'near-zero charge ratio on quick tap');
    const tapDamage = 500 - zs[0].health;
    assert.ok(tapDamage >= barcodeScanner.damage * barcodeScanner.charge.minDamageMultiplier && tapDamage < barcodeScanner.damage * 0.5);
    assert.equal(zs[1].health, 500, 'tap shot only hits the first zombie');
  }

  // 2. Full charge hold -> auto-discharges at chargeRatio = 1, pierces all 4 targets
  {
    const t = headlessGame();
    const { g } = t;
    t.tick();
    g.rounds.update = () => {};
    g.zombies.clear();
    g.gun.give(barcodeScanner);
    t.tick(45);
    t.standAt(0, 13.5, 0, -0.15);
    const zs = [1.8, 2.6, 3.4, 4.2, 5.0].map((meters) => {
      const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 13.5 - meters));
      z.setState('chasing');
      z.health = 500;
      z.speed = 0;
      z.updateHitboxes();
      return z;
    });
    g.zombies.update = () => {};
    const chargeTicks = Math.ceil(barcodeScanner.charge.seconds / dt);
    t.press('Mouse0', chargeTicks);
    assert.equal(g.runStats.shotsFired, 1);
    assert.equal(g.gun.lastShot.chargeRatio, 1);
    assert.equal(zs[0].health, 500 - barcodeScanner.damage * 1.0);
    assert.equal(zs[1].health, 500 - barcodeScanner.damage * 0.85);
    assert.equal(zs[2].health, 500 - barcodeScanner.damage * 0.7);
    assert.equal(zs[3].health, 500 - barcodeScanner.damage * 0.55);
    assert.equal(zs[4].health, 500, 'beam stops after 4 targets');
  }
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
