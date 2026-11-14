// Static batching (world/staticBatch.js) on the REAL mall: far fewer meshes, the same triangles in the same places,
// nothing that moves / hides / is see-through merged, the escalator barrier still hides on repair, and dispose still
// frees everything.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (it also stubs the browser globals the mall reads)
import { buildMall } from '../src/maps/mall/mall.js';
import { batchStatic, shadeAt, freezeStatic, movedWhileFrozen } from '../src/world/staticBatch.js';
import { weapons } from '../src/config/weapons.js';

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

// Freezing (world/staticBatch.js freezeStatic): after batching, main.js stops every map object that never moves from
// rebuilding its matrix each frame. A frozen object that IS moved later would silently stay put in the browser, so a
// run is played here and nothing frozen may have been moved; what does move (a shutter, the swaying sign) still does.
test('freezing: most of the batched map stops updating its matrix, nothing frozen is ever moved, what moves still moves', () => {
  const scene = new THREE.Scene();
  const t = headlessGame({ scene }), { g } = t;
  t.tick();
  batchStatic(g.map.group);
  const countAuto = () => { let n = 0, all = 0; g.map.group.traverse((o) => { all++; if (o.matrixAutoUpdate) n++; }); return { n, all }; };
  const before = countAuto();
  const updating = new Set(); g.map.group.traverse((o) => { if (o.matrixAutoUpdate) updating.add(o); });
  const { frozen, live } = freezeStatic(g.map.group);
  const after = countAuto();
  assert.equal(before.n - after.n, frozen);
  assert.ok(frozen > before.all * 0.4, `${frozen} of ${before.all} map objects frozen (${after.n} still update themselves)`);
  const underMover = (o) => { for (let p = o; p; p = p.parent) if (p.userData.dynamic || p.userData.kind === 'shutter') return true; return false; };
  g.map.group.traverse((o) => {
    if (underMover(o)) assert.equal(o.matrixAutoUpdate, updating.has(o), `${o.name || o.type}: under a moving parent, left alone`);
    else assert.equal(o.matrixAutoUpdate, false, `${o.name || o.type}: still, frozen`);
  });
  assert.ok(live > 0);
  assert.deepEqual(movedWhileFrozen(g.map.group), []);
  // (the check itself works: a frozen wall pushed aside is reported, and nothing else)
  const wall = g.map.group.children.find((o) => o.userData.staticBatch);
  wall.position.x += 1;
  assert.deepEqual(movedWhileFrozen(g.map.group), [wall]);
  wall.position.x -= 1;

  // What moves: world matrices before and after a stretch of play with every door opening.
  const world = (o) => { scene.updateMatrixWorld(); return o.matrixWorld.clone(); };
  const sign = g.map.group.getObjectByName('hallway_hanging_sign').children[0];
  let shutter = null;
  g.map.group.traverse((o) => { if (!shutter && o.isMesh && o.userData.kind === 'shutter') shutter = o; });
  const signBefore = world(sign), shutterBefore = world(shutter);

  // A run: every door, rounds with bosses, Mascots and a Flash Sale, GRAB-A-GUN moving, every interaction held, every gun
  // fired, the doors shut again, Play again.
  g.debug.run('god');
  for (let i = 0; i < 20; i++) g.debug.run('addPoints');
  g.debug.run('doors'); t.tick(400);
  assert.ok(!world(shutter).equals(shutterBefore), 'a shutter still rolls');
  assert.ok(!world(sign).equals(signBefore), 'the hanging sign still sways');
  g.debug.run('wardrobe'); g.debug.run('pockets');
  for (let round = 0; round < 8; round++) {
    t.tick(120);
    if (round % 3 === 0) g.debug.run('clawMove');
    if (round % 4 === 1) g.debug.run('flashSale');
    if (round % 3 === 2) g.debug.run('summonBoss');
    if (round % 2 === 0) g.debug.run('spawnMascot');
    t.tick(240);
    g.debug.run('killZombies'); t.tick(60);
    g.debug.run('nextRound'); t.tick(30);
  }
  for (const feature of g.map.features) {
    if (!feature.position || !feature.normal) continue;
    const position = feature.position.clone().addScaledVector(feature.normal, 0.9);
    position.y = feature.position.y > 4 ? 6.3 : 0;
    g.player.teleport({ position, yaw: Math.atan2(feature.normal.x, feature.normal.z) });
    g.debug.run('addPoints');
    t.tick(2); t.press('KeyF', 90); t.tick(60);
  }
  for (const def of Object.values(weapons)) { g.gun.give(def); t.tick(50); t.press('Mouse0', 20); }
  g.debug.run('doors'); t.tick(400);
  g.resetRun(); t.tick(60);
  const moved = movedWhileFrozen(g.map.group).map((o) => {
    const names = []; for (let p = o; p && p !== scene; p = p.parent) names.unshift(p.name || p.type);
    return names.join('/');
  });
  assert.deepEqual(moved, [], 'moved at runtime without a userData.dynamic parent (it would stand still in the browser)');
  g.map.dispose();
});
