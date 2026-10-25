import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { upgrades } from '../src/config/upgrades.js';
import { Weapon } from '../src/weapons/weapon.js';
import { createPlayerStats } from '../src/player/stats.js';
import { createAim } from '../src/weapons/aim.js';
import { hitDamage, resolveGun } from '../src/weapons/gunStats.js';
import { withTier } from '../src/weapons/upgrades.js';
import { sustainedDps } from '../tools/balance.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';

const rifle = weapons.rivetRifle;
const dt = 1 / 60;

test('Rivet Rifle auto fire delivers its configured cadence, empties one magazine and reloads with real reserve accounting', () => {
  const w = new Weapon(rifle, createPlayerStats());
  let shots = 0;
  for (let tick = 0; tick < 60; tick++) if (w.update(dt, { triggerPressed: tick === 0, triggerHeld: true }) === 'fire') shots++;
  assert.equal(shots, 8, '7.5/s including the first instant shot');
  for (let tick = 0; tick < 200 && w.magazine; tick++) if (w.update(dt, { triggerHeld: true }) === 'fire') shots++;
  assert.equal(shots, rifle.magazineSize);
  assert.equal(w.magazine, 0);
  w.startReload();
  for (let tick = 0; tick < 119; tick++) w.update(dt, {});
  assert.equal(w.magazine, 0, 'two-second reload is not early');
  w.update(dt, {}); w.update(dt, {}); // floating-point boundary
  assert.equal(w.magazine, rifle.magazineSize);
  assert.equal(w.reserve, rifle.startingReserve - rifle.magazineSize);
});

test('Rivet Rifle remains a body-fire alternative to Foam, with smaller magazine/slower ADS; Nail retains range at every tier', () => {
  for (const tier of upgrades.tiers) {
    const at = (base) => resolveGun(base, withTier(base, [], tier.id));
    const r = at(rifle), foam = at(weapons.foamDartBlaster), nail = at(weapons.nailGun);
    const dps = (d, meters) => sustainedDps(d, meters, { ads: true, samples: 500 });
    assert.ok(dps(r, 5) > 0.95 * dps(foam, 5), tier.id);
    assert.ok(dps(r, 5) < 1.12 * dps(foam, 5), 'continuous fire is not a large raw-DPS upgrade');
    assert.ok(dps(foam, 15) > dps(r, 15));
    assert.ok(dps(nail, 30) > 1.15 * dps(r, 30));
    assert.ok(r.magazineSize < foam.magazineSize);
    assert.ok(r.ads.seconds > foam.ads.seconds);
    assert.ok(hitDamage(r, { part: 'head', distance: 10 }, 0, { damageMultiplier: 1 })
      < hitDamage(foam, { part: 'head', distance: 10 }, 0, { damageMultiplier: 1 }));
    assert.equal(r.pierce, undefined);
  }
});

test('sustained hip fire blooms; ADS is much tighter, with a real recovery delay', () => {
  const input = { actionDown: () => false, consumeAction: () => false, actionPressed: () => false, moveAxis: () => ({ y: 0 }) };
  const player = { velocity: new THREE.Vector3(), grounded: true, stats: createPlayerStats() };
  const aim = createAim({ def: rifle, input, player });
  for (let i = 0; i < 40; i++) { aim.update(dt); if (i % 8 === 0) aim.onShot(); }
  aim.onShot();
  const hip = aim.spreadDegrees;
  assert.ok(hip > rifle.spread.base * 3);
  aim.update(rifle.spread.bloomRecoveryDelay / 2);
  assert.equal(aim.spreadDegrees, hip);
  input.actionDown = () => true;
  for (let i = 0; i < 20; i++) { aim.onShot(); aim.update(dt); }
  assert.ok(aim.spreadDegrees < hip * 0.1);
  assert.equal(player.aimMoveMultiplier, rifle.ads.moveSpeedMultiplier);
});

test('real rifle hits only the first zombie, reports the firing weapon, sounds, and normal hit payouts', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(); g.rounds.update = () => {}; g.zombies.clear();
  g.gun.give(rifle); t.tick(45);
  t.standAt(0, 12, 0, Math.atan2(1 - g.player.eyeHeight, 3));
  const zs = [3, 4].map((meters) => {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 12 - meters));
    z.setState('chasing'); z.health = 100; z.speed = 0; z.updateHitboxes(); return z;
  });
  const before = g.wallet.points;
  t.press('Mouse0');
  assert.equal(zs[0].health, 100 - rifle.damage);
  assert.equal(zs[1].health, 100);
  assert.equal(g.wallet.points - before, economy.payouts.nonLethalHit);
  assert.equal(g.gun.lastShot.weaponId, rifle.id);
  assert.ok(t.sounds.includes(rifle.sounds.fire));
});

test('rifle ADS slowdown composes with player stats and switches/resets back to other guns normally', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(); g.rounds.update = () => {};
  g.gun.give(rifle); t.tick(45);
  g.stats.adsMoveSpeed = 0.5; // a future perk/wardrobe effect still participates
  t.input.held.add('Mouse2'); t.input.held.add('KeyW'); t.tick(60);
  const speed = Math.hypot(g.player.velocity.x, g.player.velocity.z);
  assert.ok(Math.abs(speed - g.stats.walkSpeed * 0.5 * rifle.ads.moveSpeedMultiplier) < 0.02);
  assert.equal(g.stats.adsMoveSpeed, 0.5, 'weapon handling never writes the stats object');
  t.input.held.delete('KeyW');
  g.gun.give(weapons.foamDartBlaster); t.tick(60);
  assert.equal(g.player.aimMoveMultiplier, 1);
  g.resetRun();
  assert.equal(g.player.aimMoveMultiplier, 1);
  assert.equal(g.player.aimAmount, 0);
});

test('rifle has a shared display, working bolt/trigger, magazine exchange, attachment mounts and clean reload blend-out', () => {
  const model = buildWeaponModel(rifle), display = buildWeaponDisplay(rifle);
  assert.ok(display.getObjectByName('pressureCylinder'));
  const magazine = model.root.getObjectByName('rivetMagazine');
  const held = model.root.getObjectByName('heldRivetMagazine');
  const bolt = model.root.getObjectByName('bolt');
  model.animate({ sinceFire: 0.022, reloadProgress: 0, reloadWeight: 0 });
  assert.ok(bolt.position.z > -0.04);
  model.animate({ sinceFire: Infinity, reloadProgress: 0.3, reloadWeight: 1 });
  assert.equal(magazine.visible, false); assert.equal(held.visible, true);
  model.animate({ sinceFire: Infinity, reloadProgress: 0.5, reloadWeight: 1 });
  assert.equal(held.visible, true);
  model.animate({ sinceFire: Infinity, reloadProgress: 0.75, reloadWeight: 1 });
  assert.equal(magazine.visible, true); assert.equal(held.visible, false);
  model.animate({ sinceFire: Infinity, reloadProgress: 0.5, reloadWeight: 0 });
  assert.equal(magazine.visible, true); assert.equal(held.visible, false);
  assert.equal(bolt.position.z, -0.04);
  for (const mount of ['barrel', 'top', 'side', 'grip', 'magazine', 'sticker']) assert.ok(model.mounts[mount]);
});

test('a wall buy in the Grand Atrium (tests/lateWallGuns.test.js buys it); the debug cycle still grants it, upgrades it and refills it at the existing cache', () => {
  const t = headlessGame();
  const { g } = t;
  assert.equal(rifle.debugOnly, undefined);
  assert.deepEqual(economy.wallBuys.rivetRifle, { weapon: 1500, ammo: 750 });
  assert.equal(g.map.features.filter((f) => f.weapon === rifle.id).length, 1);
  assert.equal(g.gun.owns(rifle.id), false);
  for (let i = 0; i < Object.keys(weapons).length && !g.gun.owns(rifle.id); i++) { g.debug.run('giveGun'); t.tick(45); }
  assert.equal(g.gun.def.id, rifle.id);
  assert.equal(g.state.assisted, true);
  g.debug.run('upgradeGun');
  assert.ok(g.gun.def.damage > rifle.damage);
  for (const door of g.map.doors) door.open(); t.tick(120);
  const cache = g.map.features.find((f) => f.kind === 'ammoCache');
  const at = cache.position.clone().addScaledVector(cache.normal, 1.2);
  g.gun.weapon.magazine = 0; g.gun.weapon.reserve = 0;
  g.wallet.earn(10000);
  t.standAt(at.x, at.z, Math.atan2(cache.normal.x, cache.normal.z) * 180 / Math.PI);
  const before = g.wallet.points;
  t.press('KeyF', 30);
  assert.equal(g.gun.weapon.isFull, true);
  assert.equal(before - g.wallet.points, g.pricing.priceOf('ammoCache', 'default'));
  g.resetRun();
  assert.deepEqual(g.gun.slots, ['stapleGun']);
});
