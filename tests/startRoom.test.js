// The clearance-store dressing must not change the small room's survival routes or buying.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createMapKit } from '../src/world/mapKit.js';
import { buildStartRoomDetails } from '../src/maps/mall/startRoomDetails.js';
import { LAYOUT } from '../src/maps/mall/mall.js';

test('start-room decoration adds no collision and leaves the centre, spawn bodies and vault lane visually clear', () => {
  const group = new THREE.Group();
  const colliders = [];
  const kit = createMapKit(group, colliders);
  const details = buildStartRoomDetails(kit, LAYOUT.startRoom);
  assert.equal(colliders.length, 0, 'details cannot change movement, shooting, navigation or interaction visibility');
  group.updateMatrixWorld(true);
  const box = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));
  const protectedSpaces = [
    box([-1.05, 0.04, 6.4], [1.05, 2.3, 15.6]),
    box([-2.8, 1.09, 13.5], [-1.45, 2.8, 14.5]),
    ...[-3.5, 3.5].map((x) => box([x - 0.35, 0.04, 15.05], [x + 0.35, 1.8, 15.75])),
  ];
  const triangle = new THREE.Triangle();
  details.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position;
    const indices = mesh.geometry.index;
    const count = indices?.count ?? positions.count;
    for (let i = 0; i < count; i += 3) {
      for (const [vertex, offset] of [[triangle.a, 0], [triangle.b, 1], [triangle.c, 2]]) {
        vertex.fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(mesh.matrixWorld);
        assert.ok(vertex.toArray().every(Number.isFinite), `${mesh.name} has valid geometry`);
      }
      for (const [index, space] of protectedSpaces.entries()) assert.ok(!space.intersectsTriangle(triangle),
        `${mesh.name} crosses protected space ${index} near ${triangle.a.toArray()}`);
    }
  });
  kit.dispose();
});

test('the dressed starting room still supports a real vault and Price Gun purchase at the original price', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(); g.zombies.clear(); g.rounds.update = () => {};
  t.standAt(-2.2, 12.9, 180);
  g.player.velocity.set(0, 0, 5);
  assert.equal(g.player.vault.tryStart(), true, 'original counter still vaultable');
  let ticks = 0;
  while (g.player.vault.active && ticks++ < 90) t.tick();
  assert.ok(ticks < 90 && g.player.position.z > 14.4, 'landed on the other side');

  t.standAt(3.6, 10, -90);
  assert.equal(g.interactions.prompt?.label, 'Price Gun');
  assert.equal(g.interactions.prompt.cost, 500);
  const before = g.wallet.points;
  t.press('KeyF', 30);
  assert.ok(g.gun.owns('priceGun'));
  assert.equal(before - g.wallet.points, 500);
  assert.equal(g.map.zones.hallway.open, false, 'no doors opened by decoration');
});
