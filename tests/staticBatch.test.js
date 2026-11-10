// Static batching (world/staticBatch.js) on the REAL mall: far fewer meshes, the same triangles in the same places,
// nothing that moves / hides / is see-through merged, the escalator barrier still hides on repair, and dispose still
// frees everything.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs the browser globals the mall reads)
import { buildMall } from '../src/maps/mall/mall.js';
import { batchStatic, shadeAt } from '../src/world/staticBatch.js';

const meshes = (root) => { const out = []; root.traverse((o) => { if (o.isMesh) out.push(o); }); return out; };
const triangles = (list) => list.reduce((n, m) => {
  const g = m.geometry;
  const count = g.index ? g.index.count / 3 : g.attributes.position.count / 3;
  return n + count * (m.isInstancedMesh ? m.count : 1);
}, 0);
const worldBox = (list) => list.reduce((box, m) => box.union(new THREE.Box3().setFromObject(m)), new THREE.Box3());

test('the real mall: many fewer meshes, every triangle kept, the same overall extent', () => {
  const scene = new THREE.Scene();
  const map = buildMall(scene, []);
  map.group.updateWorldMatrix(true, true); // (positioned groups, e.g. neon signs: world matrices before measuring)
  const before = meshes(map.group).filter((m) => m.visible);
  const trisBefore = triangles(before);
  const extentBefore = worldBox(before);
  const result = batchStatic(map.group);
  const after = meshes(map.group).filter((m) => m.visible);
  assert.ok(result.merged > 300, `merged ${result.merged} meshes`);
  assert.ok(after.length < before.length * 0.5, `${before.length} -> ${after.length} meshes`);
  assert.equal(triangles(after), trisBefore, 'no triangle lost or added');
  const extentAfter = worldBox(after);
  // (a rotated mesh's box is looser than its real corners, so the merged extent can only be the same or tighter)
  assert.ok(extentBefore.clone().expandByScalar(1e-3).containsBox(extentAfter), 'nothing moved outside the map');
  assert.ok(extentAfter.min.distanceTo(extentBefore.min) < 0.5 && extentAfter.max.distanceTo(extentBefore.max) < 0.5, 'the same map');
  map.dispose();
});

test('nothing dynamic, hidden, transparent, instanced or one-of-a-kind is merged; batches share their material', () => {
  const scene = new THREE.Scene();
  const map = buildMall(scene, []);
  const keep = meshes(map.group).filter((m) => m.userData.dynamic || m.material?.transparent || m.isInstancedMesh || m.userData.kind === 'shutter');
  batchStatic(map.group);
  for (const m of keep) assert.ok(m.parent, `${m.name || m.type} is still there on its own`);
  for (const b of meshes(map.group).filter((m) => m.userData.staticBatch)) {
    assert.equal(b.material.transparent, false);
    assert.ok(b.userData.staticBatch >= 2);
    if (b.material.vertexColors) assert.ok(b.geometry.attributes.color, 'colour per vertex');
  }
  const tube = meshes(map.group).find((m) => m.name === 'service_aging_tube');
  assert.ok(tube.material.userData.animated && !tube.material.vertexColors, 'the flickering tube keeps its own material');
  assert.ok(map.group.getObjectByName('markers').children.every((m) => m.parent), 'debug markers untouched');
  map.dispose();
});

test('after batching the escalator barrier still hides on repair and comes back on reset; dispose frees it all', () => {
  const scene = new THREE.Scene();
  const colliders = [];
  const map = buildMall(scene, colliders);
  batchStatic(map.group);
  const repair = map.doors.find((d) => d.id === 'escalatorRepair');
  const parts = meshes(map.group).filter((m) => m.userData.dynamic && m.name !== 'parking_sunset_sky' && !m.name.startsWith('retail_unease_'));
  assert.ok(parts.length >= 4);
  repair.open();
  assert.ok(parts.every((p) => !p.visible));
  repair.reset();
  assert.ok(parts.every((p) => p.visible));
  map.dispose();
  assert.equal(colliders.length, 0);
});

test('a raycast (bullet marks) still hits a merged wall at the same point', () => {
  const scene = new THREE.Scene();
  const map = buildMall(scene, []);
  map.group.updateWorldMatrix(true, true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-9.5, 1.5, 2), new THREE.Vector3(0, 0, 1), 0, 20); // toward the hallway's north wall
  const hit = (root) => ray.intersectObject(root, true).find((h) => h.object.isMesh && h.object.visible && !h.object.material.transparent);
  const before = hit(map.group).point.clone();
  batchStatic(map.group);
  assert.ok(Math.abs(before.z - 6) < 0.05, 'the wall (before)');
  assert.ok(hit(map.group).point.distanceTo(before) < 1e-4, 'same point after');
  map.dispose();
});

test('baked grounding: darkest at each floor, gone by `fade` up, measured from the floor level below', () => {
  const shade = { strength: 0.2, fade: 1.6, minHeight: 0.35, floors: [0, 6.3] };
  assert.ok(Math.abs(shadeAt(0, shade) - 0.8) < 1e-9);
  assert.ok(Math.abs(shadeAt(0.8, shade) - 0.9) < 1e-9);
  assert.equal(shadeAt(3, shade), 1, 'a door lintel 3 m up is not darkened');
  assert.ok(Math.abs(shadeAt(6.3, shade) - 0.8) < 1e-9, 'the upper floor has its own grounding');
  assert.equal(shadeAt(-1, shade), 1, 'below every floor: untouched');
  const brightness = (options) => { // the sum of every vertex colour in the colour-merged batches
    const map = buildMall(new THREE.Scene(), []);
    batchStatic(map.group, options);
    let sum = 0;
    map.group.traverse((o) => {
      const c = o.isMesh && o.userData.staticBatch && o.geometry.attributes.color;
      if (c) for (let i = 0; i < c.count; i++) sum += c.getX(i) + c.getY(i) + c.getZ(i);
    });
    map.dispose();
    return sum;
  };
  const plain = brightness({}), shaded = brightness({ shade });
  assert.ok(shaded < plain && shaded > plain * 0.8, `darker, but only a little (${(shaded / plain).toFixed(3)})`);
});
