// Builds the REAL mall map in Node and checks its layout: doors, zones, spawn points and
// pathfinding through the doors. The map draws its textures on <canvas>, so a do-nothing
// canvas stands in for the browser's (only the geometry matters here).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildMall } from '../src/maps/mall/mall.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';
import { economy } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { overlapsSolid } from '../src/world/collision.js';

// A 2D context where every method is a no-op returning the context (gradients, measureText...).
const ctx = new Proxy({}, {
  get: (target, key) => (key in target ? target[key] : (target[key] = () => ctx)),
  set: (target, key, value) => { target[key] = value; return true; },
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };

const dt = 1 / feel.simulation.tickRate;

function setup() {
  const colliders = [];
  const map = buildMall(new THREE.Scene(), colliders);
  const shopper = zombieTypes.shopper;
  const nav = createNavigation(colliders, { radius: shopper.radius, height: shopper.height });
  const player = new THREE.Vector3(0, 0, 0); // middle of the concourse
  const door = (id) => map.doors.find((d) => d.id === id);
  // Open a door for real: buy it, then let the shutter roll up until its collider is gone.
  const open = (id) => {
    door(id).open();
    for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);
  };
  const reach = (p) => {
    nav.update(dt, player);
    return nav.distanceToTarget(p.x, p.z);
  };
  return { map, colliders, nav, player, door, open, reach };
}

test('the door ladder: start shutter 500 -> concourse, Mega Mart 750 -> megaMart', () => {
  const { map, door } = setup();
  assert.equal(door('startShutter').price, economy.doors.startShutter);
  assert.equal(door('startShutter').opensZone, 'concourse');
  assert.equal(door('megaMart').price, economy.doors.megaMart);
  assert.equal(door('megaMart').opensZone, 'megaMart');
  assert.equal(map.zones.megaMart.open, false);
  for (const d of map.doors) assert.ok(map.zones[d.opensZone], `door ${d.id} opens a real zone`);
});

test('every spawn point and the player spawn stand on open floor, not inside anything', () => {
  const { map, colliders, nav } = setup();
  nav.update(dt, new THREE.Vector3(0, 0, 0));
  const body = { radius: zombieTypes.shopper.radius, height: zombieTypes.shopper.height };
  for (const s of map.spawnPoints) {
    assert.ok(map.zones[s.zone], `${s.name} has a real zone`);
    assert.ok(nav.isWalkableAt(s.position.x, s.position.z), `${s.name} is on walkable floor`);
    assert.equal(overlapsSolid(s.position, body.radius, body.height, colliders, feel.movement.stepTolerance), false, `${s.name} is clear`);
  }
  assert.equal(overlapsSolid(map.playerSpawn.position, feel.player.radius, feel.player.height, colliders, feel.movement.stepTolerance), false);
});

test('the Mega Mart is sealed until its door is bought, then every corner of it is reachable', () => {
  const { map, open, reach } = setup();
  open('startShutter');
  const martSpawns = map.spawnPoints.filter((s) => s.zone === 'megaMart');
  assert.equal(martSpawns.length, 4);
  for (const s of martSpawns) assert.equal(reach(s.position), Infinity, `${s.name} sealed off`);
  for (const s of map.spawnPoints.filter((p) => p.zone !== 'megaMart')) {
    assert.ok(Number.isFinite(reach(s.position)), `${s.name} reachable once the shutter is open`);
  }
  open('megaMart');
  assert.equal(map.zones.megaMart.open, true);
  for (const s of martSpawns) assert.ok(Number.isFinite(reach(s.position)), `${s.name} reachable once the Mega Mart is open`);
  // Every aisle, both lane ends of the checkout row, and the back walkway.
  for (const [x, z] of [[21.9, -14], [25.75, -14], [29.25, -14], [32.75, -14], [22, 5.5], [26, -5.5], [30, -22], [33, 5]]) {
    assert.ok(Number.isFinite(reach({ x, z })), `(${x}, ${z}) reachable inside the Mega Mart`);
  }
  // Resetting closes it again.
  map.reset();
  for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);
  assert.equal(map.zones.megaMart.open, false);
  assert.equal(reach(martSpawns[0].position), Infinity);
});

test('the Mega Mart checkout counters are vaultable; the shelves are not', () => {
  const { colliders } = setup();
  const inMart = (b) => b.min.x >= 20.3 && b.max.x <= 34 && b.min.z >= -24 && b.max.z <= 6;
  const counters = colliders.filter((b) => inMart(b) && b.vaultable);
  assert.equal(counters.length, 4);
  for (const b of counters) {
    assert.ok(b.max.y <= feel.vault.maxHeight && b.max.y >= feel.vault.minHeight, 'counter height is vaultable');
    assert.ok(b.max.z - b.min.z <= feel.vault.maxDepth, 'short side fits the vault depth');
  }
  const shelves = colliders.filter((b) => inMart(b) && b.max.y >= 1.9 && b.max.y < 3 && !b.vaultable);
  assert.equal(shelves.length, 3, 'three solid gondolas');
});
