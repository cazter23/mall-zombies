// Wall-buy guns (world/wallBuy.js mergeByMaterial): a still model is merged into one mesh per material, in the same place,
// so seven guns on the walls are a handful of draw calls instead of ~260. Every real gun's display merges and keeps its size.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (first: it stubs the browser globals the gun models' canvases need)
import { mergeByMaterial } from '../src/world/wallBuy.js';
import { buildWeaponDisplay } from '../src/weapons/models/index.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';

const meshes = (root) => { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
const bounds = (root) => { root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root, true); }; // (precise: rotated parts measured by their vertices)

test('one mesh per material, same bounds, root transform kept', () => {
  const red = new THREE.MeshStandardMaterial({ color: 0xff0000 });
  const blue = new THREE.MeshStandardMaterial({ color: 0x0000ff });
  const model = new THREE.Group();
  model.rotation.x = 0.3;
  const part = (m, x) => { const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.1), m); mesh.position.x = x; model.add(mesh); };
  part(red, 0); part(red, 0.3); part(blue, -0.3);
  const merged = mergeByMaterial(model);
  assert.equal(meshes(merged).length, 2);
  assert.equal(merged.rotation.x, 0.3);
  const a = bounds(model), b = bounds(merged);
  assert.ok(a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6);
});

test('every wall gun merges to far fewer meshes and keeps its size', () => {
  const onWalls = Object.values(weapons).filter((def) => economy.wallBuys[def.id] && !def.clawOnly);
  assert.ok(onWalls.length >= 5);
  for (const def of onWalls) {
    const display = buildWeaponDisplay(def);
    const before = meshes(display).length;
    const size = bounds(display).getSize(new THREE.Vector3());
    const merged = mergeByMaterial(display);
    const after = meshes(merged).length;
    assert.ok(after <= before, def.id);
    if (before > 10) assert.ok(after < before / 2, `${def.id}: ${before} -> ${after}`);
    assert.ok(bounds(merged).getSize(new THREE.Vector3()).distanceTo(size) < 1e-4, `${def.id} keeps its size`);
  }
});
