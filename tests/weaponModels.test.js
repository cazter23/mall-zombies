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

const GUN_IDS = Object.keys(weapons);

test('every attachment build survives firing/reload poses and short barrels restore their original geometry', () => {
  for (const id of GUN_IDS) {
    const model = buildWeaponModel(weapons[id]);
    const original = new Map(); model.root.traverse(m => { if (m.isMesh) original.set(m, m.geometry); });
    const visuals = createUpgradeVisuals(model);
    for (const attachments of [
      { barrel: 'extendedNozzle', sight: 'zoomLens', grip: 'gripTape', magazine: 'jumboPack' },
      { barrel: 'sawnOff', sight: 'laserPointer', grip: 'wristband', magazine: 'speedLoader' },
    ]) {
      visuals.show({ attachments });
      for (const reloadProgress of [0, .2, .5, .8, 1]) {
        model.animate({ sinceFire: .03, reloadProgress, reloadWeight: reloadProgress > 0 && reloadProgress < 1 ? 1 : 0 });
        model.root.updateMatrixWorld(true);
        for (const holder of Object.values(visuals.parts)) {
          assert.ok(holder.getWorldPosition(new THREE.Vector3()).toArray().every(Number.isFinite), `${id}: finite attachment pose`);
        }
      }
    }
    visuals.show({ attachments: {} });
    for (const [mesh, geometry] of original) assert.equal(mesh.geometry, geometry, `${id}: stock geometry restored`);
  }
});

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
    assert.ok(model.muzzle.position.z > home, `${id}: Sawn-Off shortens the muzzle`);
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

test('every weapon model uses the refreshed faceted hands and sleeved cuffs without floating fingers', () => {
  for (const id of GUN_IDS) {
    const model = buildWeaponModel(weapons[id]);
    model.root.updateMatrixWorld(true);
    for (const part of ['rightPalm', 'rightGripFingers', 'rightIndexFinger', 'gripThumb', 'supportPalm', 'supportFingers', 'supportThumb', 'rightCuff', 'leftCuff']) {
      assert.ok(model.root.getObjectByName(part), `${id}: missing ${part}`);
    }
    const rightPalm = bounds(model.root.getObjectByName('rightPalm')).expandByScalar(0.012);
    for (const finger of ['rightGripFingers', 'rightIndexFinger', 'gripThumb']) {
      assert.ok(rightPalm.intersectsBox(bounds(model.root.getObjectByName(finger))), `${id}: ${finger} floats from rightPalm`);
    }
    const supportPalm = bounds(model.root.getObjectByName('supportPalm')).expandByScalar(0.012);
    for (const finger of ['supportFingers', 'supportThumb']) {
      assert.ok(supportPalm.intersectsBox(bounds(model.root.getObjectByName(finger))), `${id}: ${finger} floats from supportPalm`);
    }
    model.leftHandVisible = false;
    assert.equal(model.root.getObjectByName('supportPalm').parent.visible, false, `${id}: leftHandVisible hides support arm`);
    model.leftHandVisible = true;
    assert.equal(model.root.getObjectByName('supportPalm').parent.visible, true, `${id}: leftHandVisible restores support arm`);
  }
});

test('refreshed Price Gun, Staple Gun, Nail Gun, and Foam Dart Blaster expose their distinct tool parts and animate cleanly', () => {
  const expectedParts = {
    priceGun: ['priceHousing', 'priceRoll', 'emergingPriceLabel', 'heldPriceRoll'],
    stapleGun: ['stapleHousing', 'stapleUpperLever', 'stapleChannel', 'visibleStapleStrip', 'heldStapleStrip'],
    nailGun: ['nailHousing', 'nailPistonCap', 'nailDriverNose', 'nailMagazine', 'airConnector', 'heldNailStrip'],
    foamDartBlaster: ['foamHousing', 'dartDrum', 'foamForegrip', 'foamStock', 'heldDartDrum'],
  };
  for (const [id, names] of Object.entries(expectedParts)) {
    const model = buildWeaponModel(weapons[id]);
    const display = buildWeaponDisplay(weapons[id]);
    for (const name of names) {
      assert.ok(model.root.getObjectByName(name), `${id} model missing ${name}`);
      if (!name.startsWith('held')) assert.ok(display.getObjectByName(name), `${id} display missing ${name}`);
    }
    for (const sinceFire of [0.02, 0.1, Infinity]) {
      for (const reloadProgress of [0, 0.25, 0.5, 0.75, 1]) {
        model.animate({ sinceFire, reloadProgress, reloadWeight: reloadProgress > 0 && reloadProgress < 1 ? 1 : 0 });
      }
    }
  }
});
