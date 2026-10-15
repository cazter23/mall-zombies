import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { createUpgradeVisuals } from '../src/weapons/models/upgradeParts.js';
import { upgrades } from '../src/config/upgrades.js';
import { attachmentFits } from '../src/weapons/upgrades.js';

const bounds = (o) => new THREE.Box3().setFromObject(o);
const overlaps = (a, b) => ['x', 'y', 'z'].every((axis) =>
  Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]) > 1e-6,
);

test('Price Gun sight post is attached to the housing in both model and wall display', () => {
  for (const root of [buildWeaponModel(weapons.priceGun).root, buildWeaponDisplay(weapons.priceGun)]) {
    root.updateMatrixWorld(true);
    assert.ok(overlaps(bounds(root.getObjectByName('priceSightPost')), bounds(root.getObjectByName('priceHousing'))));
  }
});

test('Confetti Cannon breech clears its receiver throughout opening and closing', () => {
  const model = buildWeaponModel(weapons.confettiCannon);
  const receiver = model.root.getObjectByName('confettiReceiver');
  const barrels = model.root.getObjectByName('confettiBarrels');
  for (let frame = 0; frame <= 100; frame++) {
    model.animate({ sinceFire: Infinity, reloadProgress: frame / 100, reloadWeight: 1 });
    model.root.updateMatrixWorld(true);
    assert.ok(bounds(barrels).max.z <= bounds(receiver).min.z + 1e-6, `breech enters receiver at ${frame / 100}`);
  }
  model.animate({ sinceFire: Infinity, reloadProgress: 0, reloadWeight: 0 });
  model.root.updateMatrixWorld(true);
  assert.ok(model.muzzle.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(0, 0.012, -0.303)) < 1e-6,
    'hinge correction preserves the closed muzzle position');
});

test('Confetti support palm, fingers and thumb clear the receiver at rest and during shell loading', () => {
  const model = buildWeaponModel(weapons.confettiCannon);
  const root = model.root;
  for (let frame = 0; frame <= 100; frame++) {
    model.animate({ sinceFire: Infinity, reloadProgress: frame / 100, reloadWeight: 1 });
    root.updateMatrixWorld(true);
    for (const hand of ['supportPalm', 'supportFingers', 'gripThumb']) {
      for (const body of ['confettiReceiver', 'confettiReceiverTrim']) {
        assert.equal(overlaps(bounds(root.getObjectByName(hand)), bounds(root.getObjectByName(body))), false,
          `${hand} clips ${body} at ${frame / 100}`);
      }
    }
  }
});

// --- Upgrade parts (models/upgradeParts.js): store attachments + the tier sticker on every gun ---

const GUN_IDS = ['stapleGun', 'priceGun', 'nailGun', 'foamDartBlaster', 'confettiCannon'];

test('every gun model has every upgrade mount, and every attachment that fits it has a part', () => {
  for (const id of GUN_IDS) {
    const model = buildWeaponModel(weapons[id]);
    for (const mount of ['barrel', 'top', 'side', 'grip', 'magazine', 'sticker']) assert.ok(model.mounts?.[mount], `${id}: ${mount} mount`);
    const { parts } = createUpgradeVisuals(model);
    for (const a of Object.keys(upgrades.attachments)) if (attachmentFits(weapons[id], a)) assert.ok(parts[a], `${id}: ${a} part`);
  }
});

test('parts show only when fitted; the Extended Nozzle carries the muzzle (and flash) forward and back; no sticker at Standard', () => {
  for (const id of ['stapleGun', 'priceGun', 'foamDartBlaster', 'confettiCannon']) {
    const model = buildWeaponModel(weapons[id]);
    const visuals = createUpgradeVisuals(model);
    const home = model.muzzle.position.z;
    visuals.show({ tier: 'standard', attachments: {} });
    assert.ok(Object.values(visuals.parts).every((p) => !p.visible), `${id}: nothing fitted, nothing shown`);
    visuals.show({ tier: 'premium', attachments: { barrel: 'extendedNozzle', sight: 'laserPointer' } });
    assert.ok(visuals.parts.extendedNozzle.visible && visuals.parts.laserPointer.visible && !visuals.parts.zoomLens.visible);
    assert.ok(model.muzzle.position.z < home - 0.02, `${id}: muzzle moved to the nozzle tip`);
    visuals.show({ tier: 'premium', attachments: { barrel: 'sawnOff' } });
    assert.equal(model.muzzle.position.z, home, `${id}: back when the nozzle comes off`);
    const sticker = model.root.children.find((c) => c.children[0]?.children?.length === 2 && c.visible);
    assert.ok(sticker, `${id}: the tier sticker shows at Premium`);
    visuals.show({ tier: 'standard', attachments: {} });
    assert.ok(!model.root.children.some((c) => c === sticker && c.visible), `${id}: and hides at Standard`);
  }
});

test('no upgrade part floats: each one touches its gun (or the hands) within 1 cm', () => {
  for (const id of GUN_IDS) {
    const model = buildWeaponModel(weapons[id]);
    const bodyMeshes = [];
    model.root.traverse((o) => { if (o.isMesh) bodyMeshes.push(o); });
    const visuals = createUpgradeVisuals(model);
    model.root.updateMatrixWorld(true);
    for (const [a, holder] of Object.entries(visuals.parts)) {
      const box = new THREE.Box3();
      holder.traverse((o) => { if (o.isMesh && o.name !== 'laserBeam') box.expandByObject(o); });
      box.expandByScalar(0.01);
      assert.ok(bodyMeshes.some((m) => box.intersectsBox(bounds(m))), `${id}: ${a} floats`);
    }
  }
});
