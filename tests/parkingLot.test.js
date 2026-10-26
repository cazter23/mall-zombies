import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { parkingLot } from '../src/config/parkingLot.js';
import { economy } from '../src/config/economy.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';
import { createRoomCulling } from '../src/fx/roomCulling.js';
import { batchStatic } from '../src/world/staticBatch.js';
import { atmosphere } from '../src/config/environment.js';

function setup(withRange = false) {
  const t = headlessGame(withRange ? { buildTestRange } : {});
  t.g.rounds.update = () => {}; t.g.health.invulnerable = true;
  t.g.map.areaUnlocks.unlock('hallway'); t.g.map.areaUnlocks.unlock('megaMart'); t.tick(120);
  return t;
}

test('parking is bought through the real exit, discounted, traversable in both directions and sealed on restart', () => {
  const t = setup(), { g } = t;
  const door = g.map.doors.find(d => d.id === 'parkingLot');
  const paid = []; g.events.on('purchase', e => paid.push(e));
  assert.equal(g.map.zones.parkingLot.open, false);
  assert.ok(g.colliders.includes(door.barrier.collider));
  t.standAt(32.6, 2.5, -90);
  assert.equal(g.interactions.prompt.id, door.id);
  assert.equal(g.interactions.prompt.cost, economy.doors.parkingLot);
  g.wallet.earn(3000); g.pricing.setDiscount('door', .5);
  const cost = g.pricing.priceOf('door', 'parkingLot'), before = g.wallet.points;
  t.press('KeyF', 30); t.tick(120);
  assert.equal(before - g.wallet.points, cost);
  assert.equal(paid.at(-1).areaId, 'parkingLot');
  assert.equal(g.map.zones.parkingLot.open, true);
  assert.equal(g.colliders.includes(door.barrier.collider), false);
  assert.equal(g.map.zones.atrium.open, false, 'parking does not grant adjoining mall areas');
  for (const direction of [1, -1]) {
    t.standAt(direction > 0 ? 32.6 : 36, 2.5, direction > 0 ? -90 : 90);
    t.input.held.add('KeyW'); t.tick(45); t.input.held.delete('KeyW');
    assert.ok(direction > 0 ? g.player.position.x > 35 : g.player.position.x < 33, 'walked across threshold');
    assert.equal(g.player.position.y, 0, 'flush floor through the doorway');
  }
  g.resetRun(); t.tick(120);
  assert.equal(g.map.zones.parkingLot.open, false);
  assert.ok(g.colliders.includes(door.barrier.collider));
  g.map.dispose(); assert.equal(g.colliders.length, 0);
});

for (const withRange of [false, true]) test(`parking spawns and the lanes around vehicles stay connected (debug range ${withRange})`, () => {
  const t = setup(withRange), { g } = t;
  const spawns = g.map.spawnPoints.filter(s => s.zone === 'parkingLot');
  assert.equal(spawns.length, parkingLot.spawns.length);
  t.standAt(31.8, 2.5);
  assert.ok(spawns.every(s => !Number.isFinite(g.zombies.nav.distanceToTarget(s.position.x, s.position.z, 0))));
  g.map.areaUnlocks.unlock('parkingLot'); t.tick(120);
  const points = [...spawns.map(s => s.position),
    ...[[38, 2.5], [59, 2.5], [59, -20], [38, -20], [46.5, -11], [53.5, -11]].map(([x, z]) => ({ x, z }))];
  for (const target of [[31.8, 2.5], [46.5, -11], [55, -20]]) {
    t.standAt(...target); t.tick(30);
    for (const p of points) assert.ok(Number.isFinite(g.zombies.nav.distanceToTarget(p.x, p.z, 0)),
      `${p.x},${p.z} reaches ${target}`);
  }
  // Matching vehicle collision blocks shooting through the body and walking into it.
  for (const v of parkingLot.vehicles) assert.ok(g.colliders.some(b => !b.ignoreShots
    && b.containsPoint(new THREE.Vector3(v.x, v.height - .05, v.z))));
  // The fence's entire height blocks a walking player, even between the drawn bars.
  t.standAt(parkingLot.rect.maxX - .7, -3, -90);
  t.input.held.add('KeyW'); t.tick(90); t.input.held.delete('KeyW');
  assert.ok(g.player.position.x < parkingLot.rect.maxX);
  g.map.dispose();
});

test('every RV fits between its rendered bay markings, with room at both ends', () => {
  const t = setup(), { map } = t.g;
  map.group.updateMatrixWorld(true);
  const lines = map.group.children.filter(o => o.name === 'parking_bay_line').map(o => o.position.x).sort((a, b) => a - b);
  const used = new Set();
  for (const vehicle of parkingLot.vehicles) {
    const body = map.group.getObjectByName(`parking_${vehicle.id}_body`);
    const bounds = new THREE.Box3().setFromObject(body);
    const bay = lines.findIndex((x, i) => i < lines.length - 1 && bounds.min.x > x && bounds.max.x < lines[i + 1]);
    assert.ok(bay >= 0, `${vehicle.id} is wholly inside a painted bay`);
    assert.ok(!used.has(bay), 'one RV per bay'); used.add(bay);
    assert.ok(Math.abs(body.position.x - (lines[bay] + lines[bay + 1]) / 2) < .01, 'centred between the lines');
    assert.ok(bounds.min.z > parkingLot.bays.minZ + .5 && bounds.max.z < parkingLot.bays.maxZ - .5, 'bumper clearance');
  }
  map.dispose();
});

test('the outer mall stays opaque from the north parking corner with the Atrium closed and interiors culled', () => {
  const t = setup(), { map } = t.g;
  const camera = new THREE.PerspectiveCamera(75, 16 / 9, .05, 200);
  camera.position.set(35.2, 1.7, 5.4); camera.lookAt(28, 6, 19); camera.updateMatrixWorld();
  const culling = createRoomCulling({ areas: map.cullAreas, portals: map.cullPortals, camera, isOpen: () => false });
  culling.tag(map.group); culling.update();
  assert.ok(!culling.visible.has('atrium'), 'Atrium contents remain culled');
  const shell = [];
  map.group.traverse(o => { if (o.name.startsWith('mall_exterior_')) shell.push(o); });
  assert.ok(shell.length > 0);
  assert.ok(shell.every(o => o.layers.test(camera.layers)), 'outer walls stay on a visible layer');
  function checkRays() {
    for (const at of [[35.2, 1.7, 5.4], [59, 1.7, 4.9]]) {
      const origin = new THREE.Vector3(...at);
      for (const target of [[34, 1.2, 15], [34, 5.5, 22], [34, 8.5, 28]]) {
        const direction = new THREE.Vector3(...target).sub(origin), distance = direction.length();
        const ray = new THREE.Raycaster(origin, direction.normalize(), 0, distance);
        ray.layers.mask = camera.layers.mask;
        assert.ok(ray.intersectObject(map.group, true).some(hit => hit.object.material?.transparent !== true),
          `opaque building before the shop interiors at ${target}`);
      }
    }
  }
  checkRays(); batchStatic(map.group); checkRays();
  map.dispose();
});

test('parking details leave fighting lanes and every spawn approach clear; the trolley is a solid vaultable prop', () => {
  const t = setup(), { map, colliders } = t.g;
  const bounds = (x0, z0, x1, z1) => new THREE.Box3(new THREE.Vector3(x0, .35, z0), new THREE.Vector3(x1, 2.1, z1));
  const gaps = parkingLot.vehicles.slice(1).map((v, i) => {
    const previous = parkingLot.vehicles[i];
    const centre = (previous.x + previous.width / 2 + v.x - v.width / 2) / 2;
    return bounds(centre - .7, -17, centre + .7, -7);
  });
  const routes = [bounds(35.2, 1, 39, 4), bounds(38, -5.5, 61, 0), bounds(38, -21, 60, -18), ...gaps,
    ...map.spawnPoints.filter(s => s.zone === 'parkingLot').map(s => bounds(s.position.x - .7, s.position.z - .7,
      s.position.x + .7, s.position.z + .7))];
  map.group.updateMatrixWorld(true);
  const parts = []; map.group.traverse(o => { if (o.isMesh && o.name.startsWith('parking_detail_')) parts.push(o); });
  for (const part of parts) {
    const box = new THREE.Box3().setFromObject(part);
    assert.ok(Number.isFinite(box.min.x + box.max.x + box.min.y + box.max.y), `${part.name} finite`);
    assert.ok(routes.every(route => !box.intersectsBox(route)), `${part.name} stays out of combat lanes`);
  }
  assert.ok(colliders.some(b => b.vaultable && b.containsPoint(new THREE.Vector3(42.5, .7, -15.2))), 'trolley has real collision');
  map.dispose(); assert.equal(colliders.length, 0);
});

test('outdoor motion and haze follow the ambient-effects setting, reset cleanly and release their texture', () => {
  const t = setup(), { map } = t.g;
  const sway = map.group.getObjectByName('parking_loose_sign'), haze = map.group.getObjectByName('parking_distant_haze');
  const enabled = atmosphere.ambient.enabled;
  let freed = 0;
  haze.children[0].material.map.addEventListener('dispose', () => freed++);
  try {
    atmosphere.ambient.enabled = true; map.update(1);
    assert.notEqual(sway.rotation.z, 0); assert.equal(haze.visible, true);
    map.reset(); assert.equal(sway.rotation.z, 0);
    atmosphere.ambient.enabled = false; map.update(1);
    assert.equal(sway.rotation.z, 0); assert.equal(haze.visible, false);
  } finally { atmosphere.ambient.enabled = enabled; map.dispose(); }
  assert.equal(freed, 1, 'shared haze texture disposed once');
});
