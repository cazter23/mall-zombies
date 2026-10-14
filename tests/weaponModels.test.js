import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';

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
