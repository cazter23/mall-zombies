// Room culling (fx/roomCulling.js): the mall's rooms and portals are consistent, meshes wholly inside a room go on its layer
// (shared walls stay always drawn), what you can see follows doors and where you look, and batching keeps rooms apart.
// (The browser check that matters: rendering with culling on and off gives identical pixels, with fewer draw calls.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import './helpers/headlessGame.js'; // (stubs <canvas>)
import { createRoomCulling, visibleAreas, areaAt } from '../src/fx/roomCulling.js';
import { batchStatic } from '../src/world/staticBatch.js';

const { buildMall } = await import('../src/maps/mall/mall.js');

function camera(at, lookAt) {
  const c = new THREE.PerspectiveCamera(75, 16 / 9, 0.05, 200);
  c.position.set(...at);
  c.lookAt(new THREE.Vector3(...lookAt));
  c.updateMatrixWorld();
  return c;
}
function mall() {
  const map = buildMall(new THREE.Scene(), []);
  const open = new Set();
  const see = (at, lookAt) => visibleAreas({ areas: map.cullAreas, portals: map.cullPortals, camera: camera(at, lookAt), isOpen: (id) => open.has(id) });
  return { map, open, see };
}

test('rooms and portals: real doors, real rooms, rooms never overlap, every room reachable through some portal', () => {
  const { map } = mall();
  const ids = map.cullAreas.map((a) => a.id);
  const doors = new Set(map.doors.map((d) => d.id));
  for (const p of map.cullPortals) {
    assert.ok(ids.includes(p.a) && ids.includes(p.b) && p.a !== p.b, `${p.a}-${p.b}`);
    if (p.door) assert.ok(doors.has(p.door), `door ${p.door} exists`);
  }
  for (const a of map.cullAreas) for (const b of map.cullAreas) {
    if (a === b) continue;
    const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY && a.minZ < b.maxZ && b.minZ < a.maxZ;
    assert.ok(!overlap, `${a.id} and ${b.id} overlap`);
  }
  for (const id of ids) assert.ok(map.cullPortals.some((p) => p.a === id || p.b === id), `${id} has a way in`);
  assert.equal(areaAt(map.cullAreas, { x: 0, y: 1.6, z: 6.15 }), null, 'inside the start doorway: no room (nothing culled)');
  map.dispose();
});

test('what you can see follows the doors and where you look', () => {
  const { map, open, see } = mall();
  assert.deepEqual([...see([0, 1.6, 12], [0, 1.6, 0])], ['startRoom'], 'the start shutter shut: just the start room');
  open.add('startShutter');
  assert.ok(see([0, 1.6, 12], [0, 1.6, 0]).has('hallway'), 'open and facing it: the hallway too');
  assert.ok(!see([0, 1.6, 12], [0, 1.6, 20]).has('hallway'), 'facing away: not the hallway');
  // Level 2 looking east along the Promenade with every shutter shut: the Mega Mart and the atrium are never drawn.
  const l2 = see([-10, 7.9, 1], [15, 7.9, 1]);
  assert.ok(l2.has('level2') && !l2.has('megaMart') && !l2.has('atrium'));
  // The atrium's ring looking south at the Mega Mart shortcut: hidden while it's shut, drawn once it's open.
  assert.ok(!see([23, 7.9, 26], [23, 2, 6]).has('megaMart'));
  open.add('atriumMegaMart');
  assert.ok(see([23, 7.9, 26], [23, 2, 6]).has('megaMart'));
  assert.equal(see([0, 1.6, 6.15], [0, 1.6, 0]), null, 'in a doorway: draw everything');
  map.dispose();
});

test('tagging: room meshes go on their room\'s layer, shared walls stay on layer 0, the camera only enables what it sees', () => {
  const { map } = mall();
  const cam = camera([0, 1.6, 12], [0, 1.6, 0]);
  const culling = createRoomCulling({ areas: map.cullAreas, portals: map.cullPortals, camera: cam, isOpen: () => false });
  const counts = culling.tag(map.group);
  for (const a of map.cullAreas) assert.ok(counts[a.id] > 0, `${a.id} has meshes`);
  const byName = (name) => { let found = null; map.group.traverse((o) => { if (!found && o.name === name) found = o; }); return found; };
  assert.equal(byName('hallway_wall_south_0').layers.mask, 1, 'the hallway / Food Court wall is always drawn');
  assert.equal(byName('storefront_0').layers.mask, 1, 'the start room / hallway wall is always drawn');
  culling.update();
  assert.deepEqual([...culling.visible], ['startRoom']);
  assert.equal(cam.layers.mask, 1 | (1 << 1), 'layer 0 + the start room');
  culling.update(false);
  assert.equal(culling.visible, null);
  assert.equal(cam.layers.mask, 0xffffffff | 0, 'off: every layer');

  const { batches } = batchStatic(map.group);
  assert.ok(batches > 0);
  map.group.traverse((o) => {
    if (o.userData.staticBatch) assert.ok([1, ...map.cullAreas.map((_, i) => 1 << (i + 1))].includes(o.layers.mask), `${o.name}: one room per batch`);
  });
  map.dispose();
});
