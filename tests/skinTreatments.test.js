// Weapon skins phase 7: slot 3 (feat) skins' glow and motion treatments. Emissive light on one palette role, animated from the model's own
// animate(): no draw call added, never brighter than skinTreatments.maxGlow (the build seam is unlit full colour), and never on a part
// that already glows (sights, the scanner's window).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { skins, skinTreatments } from '../src/config/skins.js';
import { weapons } from '../src/config/weapons.js';
import { buildWeaponModel, buildWeaponDisplay } from '../src/weapons/models/index.js';
import { peakGlow, roleColors } from '../src/weapons/models/skinTreatments.js';

const feats = Object.entries(skins).map(([gunId, entries]) => ({ gunId, skin: entries.find(skin => skin.slot === 3) }));
const meshes = root => { const list = []; root.traverse(node => { if (node.isMesh) list.push(node); }); return list; };
const isLit = material => !!material?.userData?.skinTreatment;
const animateState = time => ({ sinceFire: 9, reloadProgress: null, reloadWeight: 0, chargeProgress: 0, time });

test('the four treatments are shared: every feat skin uses one, and none glows past maxGlow (always dimmer than a glowing seam)', () => {
  assert.ok(skinTreatments.maxGlow > 0 && skinTreatments.maxGlow < 1);
  const kinds = new Set();
  for (const { gunId, skin } of feats) {
    const t = skin.treatment;
    kinds.add(t.kind);
    assert.ok(['pulse', 'edgeGlow', 'shimmer', 'drift'].includes(t.kind), gunId);
    assert.ok(t.low >= 0 && t.high > t.low && t.period > 0, gunId);
    assert.ok(peakGlow(t) <= skinTreatments.maxGlow, `${gunId}: peak ${peakGlow(t)}`);
  }
  assert.equal(kinds.size, 4, 'all four kinds are in use');
  assert.ok(!feats.some(({ skin }) => skin.pattern), 'a feat skin is not also printed');
});

for (const { gunId, skin } of feats) {
  const def = weapons[gunId];
  test(`${skin.name} (${gunId}): ${skin.treatment.kind} on its ${skin.treatment.role} meshes, no draw call added, animated within its range`, () => {
    const treatment = skin.treatment;
    delete skin.treatment; // (the same skin as a plain recolour)
    let plain;
    try { plain = buildWeaponModel(def, skin.id); } finally { skin.treatment = treatment; }
    const model = buildWeaponModel(def, skin.id);
    const a = meshes(plain.root), b = meshes(model.root);
    assert.deepEqual(b.map(mesh => mesh.name), a.map(mesh => mesh.name), 'same meshes: the same draw calls');
    assert.equal(new Set(b.map(mesh => mesh.material)).size, new Set(a.map(mesh => mesh.material)).size, 'each lit material replaces one');

    const role = roleColors(def, skin.id, treatment.role);
    const lit = b.filter(mesh => isLit(mesh.material));
    assert.ok(lit.length > 0, 'something is lit');
    for (const [i, mesh] of b.entries()) {
      const before = a[i].material;
      if (isLit(mesh.material)) {
        assert.ok(role.has(before.color.getHex()), `${mesh.name}: painted in the ${treatment.role} role`);
        assert.ok(!(before.emissiveIntensity > 0 && before.emissive.getHex() !== 0), `${mesh.name}: was not glowing already`);
        assert.equal(mesh.material.color.getHex(), before.color.getHex(), 'same paint');
        assert.deepEqual([mesh.material.roughness, mesh.material.metalness], [before.roughness, before.metalness], 'same finish');
      } else {
        assert.equal(mesh.material.emissive?.getHex(), before.emissive?.getHex(), `${mesh.name}: untouched`);
        assert.equal(mesh.material.emissiveIntensity, before.emissiveIntensity, `${mesh.name}: untouched`);
      }
    }

    // Over a few periods the glow moves, and never leaves [low, high] (a shimmer: its band slides, at high intensity through a band map).
    const material = lit[0].material;
    const seen = new Set();
    for (let i = 0; i <= 40; i++) {
      model.animate(animateState(i * treatment.period / 13));
      if (treatment.kind === 'shimmer') {
        assert.equal(material.emissiveIntensity, treatment.high);
        assert.ok(material.emissiveMap?.isDataTexture, 'a band texture, no canvas');
        seen.add(material.emissiveMap.offset.x.toFixed(3));
      } else {
        assert.ok(material.emissiveIntensity >= treatment.low - 1e-9 && material.emissiveIntensity <= treatment.high + 1e-9);
        seen.add(material.emissiveIntensity.toFixed(3) + material.emissive.getHexString());
      }
    }
    assert.ok(seen.size > 5, 'it moves');

    // The display (locker preview, conveyor) wears it too, with its own controller.
    const display = buildWeaponDisplay(def, skin.id);
    assert.ok(meshes(display).some(mesh => isLit(mesh.material)));
    assert.equal(typeof display.userData.skinTreatment?.animate, 'function');
  });
}

test('a shimmer lays its lit meshes\' U along the gun (0 at the back, growing toward the muzzle) and its band sweeps back to front', () => {
  const { gunId, skin } = feats.find(({ skin }) => skin.treatment.kind === 'shimmer');
  const model = buildWeaponModel(weapons[gunId], skin.id);
  model.root.updateMatrixWorld(true);
  const toRoot = model.root.matrixWorld.clone().invert();
  const points = [];
  for (const mesh of meshes(model.root).filter(mesh => isLit(mesh.material))) {
    const { position, uv } = mesh.geometry.attributes;
    const m = toRoot.clone().multiply(mesh.matrixWorld);
    for (let i = 0; i < position.count; i++) points.push({ z: new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(m).z, u: uv.getX(i) });
  }
  const back = points.reduce((p, q) => (q.z > p.z ? q : p)), front = points.reduce((p, q) => (q.z < p.z ? q : p));
  assert.ok(Math.abs(back.u) < 1e-6 && front.u > 0.4 && front.u < 1, `back ${back.u}, muzzle ${front.u}`);
  const map = meshes(model.root).find(mesh => isLit(mesh.material)).material.emissiveMap;
  model.animate(animateState(0.1));
  const early = map.offset.x;
  model.animate(animateState(0.3));
  assert.ok(map.offset.x < early, 'sampling u + offset: a falling offset moves the band to higher u, toward the muzzle');
});

test('the model\'s own animation still runs under a treatment (the scanner\'s window still brightens as it charges)', () => {
  const { skin } = feats.find(({ gunId }) => gunId === 'barcodeScanner');
  const model = buildWeaponModel(weapons.barcodeScanner, skin.id);
  const window = meshes(model.root).find(mesh => mesh.material.emissive && mesh.material.color.getHex() === skin.palette.emitter);
  model.animate({ ...animateState(1), chargeProgress: 0 });
  const idle = window.material.emissiveIntensity;
  model.animate({ ...animateState(1), chargeProgress: 1 });
  assert.ok(window.material.emissiveIntensity > idle);
  assert.ok(!isLit(window.material));
});

test('default, wall-display, mastery and pattern builds carry no treatment', () => {
  for (const [gunId, entries] of Object.entries(skins)) {
    const def = weapons[gunId];
    for (const root of [buildWeaponModel(def).root, buildWeaponDisplay(def), buildWeaponModel(def, entries[0].id).root]) {
      assert.ok(meshes(root).every(mesh => !isLit(mesh.material)), gunId);
      assert.equal(root.userData.skinTreatment, undefined);
    }
  }
});
