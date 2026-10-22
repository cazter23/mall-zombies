import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { createMapKit } from '../src/world/mapKit.js';
import { buildMegaMartDetails, MART_FIXTURES } from '../src/maps/mall/megaMartDetails.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { economy } from '../src/config/economy.js';

const bounds = (a, b) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b));

test('Mega Mart details leave aisles, crossings, entrances, spawns and checkout vaults visually clear', () => {
  const kit = createMapKit(new THREE.Group(), []);
  const details = buildMegaMartDetails(kit, LAYOUT.megaMart);
  const spaces = [
    ...[21.9, 25.75, 29.25, 32.75].map((x) => bounds([x - 0.48, 0.05, -19.4], [x + 0.48, 2.4, -8.05])),
    bounds([20.5, 0.05, -22.8], [33.3, 2.4, -20]), // rear cross-aisle
    bounds([20.5, 0.05, -7.5], [33.1, 2.4, -5.2]), // front cross-aisle, clear of parked trolley
    bounds([20.3, 0.05, -9.8], [22.8, 2.7, -6.8]), // Food Court shortcut
    bounds([20.3, 0.05, 0.1], [23.8, 2.7, 3.9]), // hallway entrance
    ...MART_FIXTURES.checkoutZs.map((z) => bounds([24.7, 1.09, z - 0.6], [26.3, 2.98, z + 0.6])),
    ...[[26.5, -23.2], [31.8, -23.2], [21.8, -23.2], [33.2, 2.5]]
      .map(([x, z]) => bounds([x - 0.35, 0.05, z - 0.35], [x + 0.35, 1.8, z + 0.35])),
  ];
  assert.equal(kit.colliders.length, 1, 'only the parked trolley adds collision');
  for (const space of spaces) assert.ok(!space.intersectsBox(kit.colliders[0]), 'trolley stays outside combat routes');
  kit.group.updateMatrixWorld(true);
  const triangle = new THREE.Triangle();
  details.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const positions = mesh.geometry.attributes.position, indices = mesh.geometry.index;
    for (let i = 0; i < (indices?.count ?? positions.count); i += 3) {
      for (const [vertex, offset] of [[triangle.a, 0], [triangle.b, 1], [triangle.c, 2]]) {
        vertex.fromBufferAttribute(positions, indices ? indices.getX(i + offset) : i + offset).applyMatrix4(mesh.matrixWorld);
        assert.ok(vertex.toArray().every(Number.isFinite), `${mesh.name}: finite geometry`);
      }
      for (const [index, space] of spaces.entries()) assert.ok(!space.intersectsTriangle(triangle),
        `${mesh.name} crosses protected route ${index} near ${triangle.a.toArray()}`);
    }
  });
  kit.dispose();
});

test('every dressed checkout still vaults and the Foam Dart wall buy still charges its original price', () => {
  const t = headlessGame(), { g } = t;
  t.tick(); g.zombies.clear(); g.rounds.update = () => {};
  for (const d of g.map.doors) d.open(); t.tick(100);
  for (const z of MART_FIXTURES.checkoutZs) {
    t.standAt(25.3, z + 1.1, 0); g.player.velocity.set(0, 0, -5);
    assert.equal(g.player.vault.tryStart(), true, `lane at ${z}: vault starts`);
    let ticks = 0;
    while (g.player.vault.active && ticks++ < 90) t.tick();
    assert.ok(ticks < 90 && g.player.position.z < z - 0.4, 'landed beyond counter');
  }
  g.wallet.earn(5000); t.standAt(31.5, 4.6, 180);
  assert.equal(g.interactions.prompt?.label, 'Foam Dart Blaster');
  const price = economy.wallBuys.foamDartBlaster.weapon, before = g.wallet.points;
  assert.equal(g.interactions.prompt.cost, price);
  t.press('KeyF', 30);
  assert.ok(g.gun.owns('foamDartBlaster')); assert.equal(before - g.wallet.points, price);
});
