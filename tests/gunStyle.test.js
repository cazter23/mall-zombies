// How upgrades change a gun's SHAPE (config/gunStyle.js): the Extended Warranty's barrel collar and tag (weapons/models/warrantyTrim.js), the Build-A-Blaster
// puffs (buildVisual.js) and the bigger attachments (upgradeParts.js), on every gun, all at once, without hiding each other.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { gunStyle } from '../src/config/gunStyle.js';
import { workshopRitual } from '../src/config/workshop.js';
import { buildWeaponModel } from '../src/weapons/models/index.js';
import { createUpgradeVisuals } from '../src/weapons/models/upgradeParts.js';

const TIERS = ['deluxe', 'premium', 'platinum'];
const ATTACHMENTS = { barrel: 'extendedNozzle', sight: 'zoomLens', magazine: 'jumboPack', grip: 'gripTape' };
const sizeOf = (object) => new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
const volume = (object) => { const s = sizeOf(object); return s.x * s.y * s.z; };

function dressed(def) {
  const model = buildWeaponModel(def);
  const visuals = createUpgradeVisuals(model);
  return { model, visuals, collar: model.root.getObjectByName('warrantyCollar'), tag: model.root.getObjectByName('warrantyTag') };
}

test('every gun gets a warranty collar that is chunkier tier by tier, and a tag from Deluxe up', () => {
  for (const def of Object.values(weapons)) {
    const { visuals, collar, tag } = dressed(def);
    assert.ok(collar && tag, `${def.id} has a collar and a tag`);
    visuals.show({ tier: 'standard' });
    assert.ok(collar.children.every((c) => !c.visible), `${def.id}: nothing on a Standard gun`);
    assert.equal(tag.visible, false);
    const volumes = TIERS.map((tier) => {
      visuals.show({ tier });
      const shown = collar.children.filter((c) => c.visible && c.children.length);
      assert.equal(shown.length, 1, `${def.id} ${tier}: exactly one collar`);
      assert.equal(tag.visible, true, `${def.id} ${tier}: the tag hangs`);
      return volume(shown[0]);
    });
    assert.ok(volumes[0] < volumes[1] && volumes[1] < volumes[2], `${def.id}: chunkier each tier (${volumes.map((v) => (v * 1e6).toFixed(1))})`);
  }
});

test('Warranty Renewals add one gold stud each on a Platinum collar, and only there', () => {
  const { visuals, collar } = dressed(weapons.nailGun);
  const studs = () => collar.children.filter((c) => c.isMesh && c.visible).length;
  visuals.show({ tier: 'premium', renewals: 3 });
  assert.equal(studs(), 0, 'not before Platinum');
  for (let n = 0; n <= upgrades.renewals.max; n++) {
    visuals.show({ tier: 'platinum', renewals: n });
    assert.equal(studs(), n, `${n} renewals`);
  }
});

test('the tag swings, and a Platinum tag is bigger', () => {
  const { visuals, tag } = dressed(weapons.priceGun);
  visuals.show({ tier: 'deluxe', time: 0 });
  const small = tag.scale.x;
  const at = (time) => { visuals.show({ tier: 'deluxe', time }); return tag.rotation.z; };
  assert.notEqual(at(0.2), at(0.9), 'it sways');
  visuals.show({ tier: 'platinum' });
  assert.ok(tag.scale.x > small);
});

test('a build puffs the body: a pillow each side, bigger with every quality, and the seam glows', () => {
  for (const def of Object.values(weapons)) {
    const { model, visuals } = dressed(def);
    const pillows = [];
    model.root.traverse((o) => { if (o.name === 'buildPuff') pillows.push(o); });
    assert.equal(pillows.length, 2, `${def.id}: a pillow on each side`);
    const sizes = workshopRitual.qualities.map((q) => {
      visuals.show({ build: { stuffing: 'neonTube', quality: q.id } });
      return pillows[0].scale.x * pillows[0].scale.y * pillows[0].scale.z;
    });
    assert.deepEqual([...sizes].sort((a, b) => a - b), sizes, `${def.id}: never smaller with a better quality`);
    assert.equal(new Set(sizes).size, sizes.length, `${def.id}: each quality its own size`);
    const sides = pillows.map((p) => Math.sign(p.getWorldPosition(new THREE.Vector3()).x - model.root.getWorldPosition(new THREE.Vector3()).x));
    assert.notEqual(sides[0], sides[1], `${def.id}: on opposite sides`);
    const seam = model.root.getObjectByName('buildThread');
    assert.ok(seam.material.isMeshBasicMaterial, 'the seam is unlit, so it glows');
  }
});

test('warranty, build and attachments all show on one gun at once, and a gun carrying all three stays cheap to draw', () => {
  for (const def of Object.values(weapons)) {
    const { model, visuals, collar, tag } = dressed(def);
    visuals.show({ tier: 'platinum', renewals: upgrades.renewals.max, build: { stuffing: 'glitter', quality: 'overstuffed' }, attachments: ATTACHMENTS });
    assert.equal(tag.visible, true, `${def.id}: the tag`);
    assert.ok(collar.children.some((c) => c.visible), `${def.id}: the collar`);
    assert.equal(model.root.getObjectByName('buildVisual').visible, true, `${def.id}: the build`);
    let draws = 0;
    model.root.traverse((o) => { if (o.isMesh && o.visible) { let on = true; for (let p = o.parent; p; p = p.parent) if (!p.visible) on = false; if (on) draws++; } });
    assert.ok(draws < 260, `${def.id}: ${draws} visible meshes on a fully upgraded gun`);
  }
});

test('attachments are drawn chunkier than the shop designs', () => {
  assert.ok(gunStyle.attachmentScale > 1);
  const model = buildWeaponModel(weapons.stapleGun);
  const visuals = createUpgradeVisuals(model);
  visuals.show({ attachments: { sight: 'zoomLens' } });
  const lens = visuals.parts.zoomLens;
  assert.ok(lens.scale.x >= gunStyle.attachmentScale, `the lens holder is x${lens.scale.x.toFixed(2)}`);
});
