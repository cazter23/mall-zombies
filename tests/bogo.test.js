// BOGO (Buy One Get One): the akimbo SMGs, a claw-only prize. One gun to the game (one magazine, one trigger, one reload), a PAIR on screen:
// the shots alternate between the two guns (the muzzle and its flash move), and attachments, trims and skins go on both.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { clawMachine } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { Weapon } from '../src/weapons/weapon.js';
import { createPlayerStats } from '../src/player/stats.js';

const bogo = weapons.bogo;
const dt = 1 / 60;
const worldX = (object) => object.getWorldPosition(new THREE.Vector3()).x;

test('BOGO is a claw-only purple prize, on no wall', () => {
  assert.equal(bogo.clawOnly, true);
  assert.equal(clawMachine.prizes.bogo?.capsule, 'purple');
  assert.equal(economy.wallBuys.bogo, undefined);
});

test('BOGO fires faster than any other gun, out of one shared magazine, and reloads both guns at once', () => {
  for (const d of Object.values(weapons)) if (d !== bogo && d.fireInterval) assert.ok(bogo.fireInterval < d.fireInterval, d.name);
  const w = new Weapon(bogo, createPlayerStats());
  let shots = 0;
  for (let tick = 0; tick < 60; tick++) if (w.update(dt, { triggerPressed: tick === 0, triggerHeld: true }) === 'fire') shots++;
  assert.ok(shots >= 17 && shots <= 19, `about 18 a second (${shots})`);
  for (let tick = 0; tick < 400 && w.magazine; tick++) w.update(dt, { triggerHeld: true });
  assert.equal(w.magazine, 0);
  w.startReload();
  for (let tick = 0; tick < Math.ceil(bogo.reloadTime / dt) + 2; tick++) w.update(dt, {});
  assert.equal(w.magazine, bogo.magazineSize, 'one reload fills both guns');
});

test('the model is a pair: a right gun and a mirrored left one, and the shots alternate between their muzzles (the flash goes with them)', () => {
  const model = buildWeaponModel(bogo);
  model.root.updateMatrixWorld(true);
  const guns = [];
  model.root.traverse((o) => { if (o.name === 'bogoGun') guns.push(o); });
  assert.equal(guns.length, 2);
  const flash = new THREE.Object3D();
  model.muzzle.add(flash);
  model.animate({ sinceFire: 0, reloadProgress: 0, reloadWeight: 0, time: 0, aimAmount: 0 });
  const sides = [];
  for (let i = 0; i < 4; i++) {
    model.onFire(flash);
    model.root.updateMatrixWorld(true);
    assert.equal(flash.parent, model.muzzle, 'the flash sits on the gun that fired');
    sides.push(Math.sign(worldX(model.muzzle)));
  }
  assert.deepEqual(sides, [1, -1, 1, -1], 'right, left, right, left');
});

test('right mouse pulls the pair in: the guns sit closer together than at the hip', () => {
  const model = buildWeaponModel(bogo);
  const spread = (aimAmount) => {
    model.animate({ sinceFire: 1, reloadProgress: 0, reloadWeight: 0, time: 1, aimAmount });
    model.root.updateMatrixWorld(true);
    const at = [];
    model.root.traverse((o) => { if (o.name === 'bogoGun') at.push(worldX(o)); });
    return Math.abs(at[0] - at[1]);
  };
  assert.ok(spread(1) < spread(0) - 0.05);
});

test('the reload empties both guns: both magazines drop out of sight together, then come back', () => {
  const model = buildWeaponModel(bogo);
  const mags = [];
  model.root.traverse((o) => { if (o.name === 'bogoMagazine') mags.push(o); });
  assert.equal(mags.length, 2);
  const r = bogo.viewmodel.reload;
  const at = (p) => { model.animate({ sinceFire: 1, reloadProgress: p, reloadWeight: 1, time: p, aimAmount: 0 }); return mags.map((m) => m.visible); };
  assert.deepEqual(at((r.magazineDrop[1] + r.magazineIn[0]) / 2), [false, false]);
  assert.deepEqual(at(0.95), [true, true]);
});

test('attachments and the warranty sticker go on BOTH guns; the box cutter swing hides the left gun', () => {
  const model = buildWeaponModel(bogo);
  const upgrades = model.createUpgradeVisuals();
  assert.equal(upgrades.perGun.length, 2);
  for (const each of upgrades.perGun) for (const id of ['zoomLens', 'laserPointer', 'jumboPack']) assert.ok(each.parts[id], `${id} has a mount on each gun`);
  upgrades.show({ tier: 'premium', attachments: { optic: 'zoomLens', magazine: 'jumboPack' } });
  for (const each of upgrades.perGun) {
    assert.equal(each.parts.zoomLens.visible, true);
    assert.equal(each.parts.jumboPack.visible, true);
    assert.equal(each.parts.laserPointer.visible, false);
  }
  model.leftHandVisible = false;
  const mirror = model.root.getObjectByName('bogoLeftHand');
  assert.equal(mirror.visible, false);
  model.leftHandVisible = true;
  assert.equal(mirror.visible, true);
});

test('the chute display shows the pair', () => {
  const display = buildWeaponDisplay(bogo);
  let guns = 0;
  display.traverse((o) => { if (o.name === 'bogoGun') guns++; });
  assert.equal(guns, 2);
});
