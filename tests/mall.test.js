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
  // Paths are measured from the start room (where the player begins), so every route has to go
  // through the doors.
  const player = new THREE.Vector3(0, 0, 12);
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

test('the door ladder: start shutter 500 -> hallway hub; Mega Mart 750 and Food Court 1000 off the hallway', () => {
  const { map, door } = setup();
  const ladder = [
    ['startShutter', 'hallway', economy.doors.startShutter],
    ['megaMart', 'megaMart', economy.doors.megaMart],
    ['foodCourt', 'foodCourt', economy.doors.foodCourt],
  ];
  for (const [id, zone, price] of ladder) {
    assert.equal(door(id).price, price, `${id} price`);
    assert.equal(door(id).opensZone, zone, `${id} opens ${zone}`);
    assert.equal(map.zones[zone].open, false, `${zone} starts closed`);
  }
  assert.deepEqual([economy.doors.startShutter, economy.doors.megaMart, economy.doors.foodCourt], [500, 750, 1000]);
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

test('each area is sealed until its own door is bought, in any order, and fully reachable after', () => {
  const { map, open, reach } = setup();
  const spawnsIn = (zone) => map.spawnPoints.filter((s) => s.zone === zone);
  const reachable = (p) => Number.isFinite(reach(p));
  assert.deepEqual(['hallway', 'foodCourt', 'megaMart'].map((z) => spawnsIn(z).length), [3, 4, 4]);

  // Nothing bought: only the start room.
  for (const s of spawnsIn('hallway')) assert.equal(reach(s.position), Infinity, `${s.name} sealed`);

  // Start shutter: the hallway (and its Nail Gun wall buy) opens; the Mega Mart and Food Court stay sealed.
  open('startShutter');
  for (const s of [...spawnsIn('startRoom'), ...spawnsIn('hallway')]) assert.ok(reachable(s.position), `${s.name} reachable`);
  const nailGun = map.wallBuys.find((w) => w.weapon === 'nailGun');
  assert.equal(nailGun.zone, 'hallway');
  assert.ok(reachable({ x: nailGun.position.x, z: nailGun.position.z + 0.8 }), 'you can stand at the Nail Gun wall buy');
  for (const s of [...spawnsIn('megaMart'), ...spawnsIn('foodCourt')]) assert.equal(reach(s.position), Infinity, `${s.name} sealed`);

  // Food Court first (any order works): it opens, the Mega Mart stays sealed.
  open('foodCourt');
  for (const s of spawnsIn('foodCourt')) assert.ok(reachable(s.position), `${s.name} reachable`);
  for (const [x, z] of [[-19, -13.5], [19, -13.5], [0, -13], [-19, -3], [19, -3]]) assert.ok(reachable({ x, z }), `Food Court (${x}, ${z}) reachable`);
  for (const s of spawnsIn('megaMart')) assert.equal(reach(s.position), Infinity, `${s.name} still sealed`);

  // Then the Mega Mart: every aisle, both ends of the checkout row, the back walkway.
  open('megaMart');
  for (const s of spawnsIn('megaMart')) assert.ok(reachable(s.position), `${s.name} reachable`);
  for (const [x, z] of [[21.9, -14], [25.75, -14], [29.25, -14], [32.75, -14], [22, 5.5], [26, -5.5], [30, -22], [33, 5]]) {
    assert.ok(reachable({ x, z }), `Mega Mart (${x}, ${z}) reachable`);
  }

  // A new run closes everything again.
  map.reset();
  for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);
  for (const z of ['hallway', 'megaMart', 'foodCourt']) assert.equal(map.zones[z].open, false, `${z} closed after reset`);
  for (const s of [...spawnsIn('hallway'), ...spawnsIn('megaMart'), ...spawnsIn('foodCourt')]) {
    assert.equal(reach(s.position), Infinity, `${s.name} sealed after reset`);
  }
});

test('the Mega Mart is reachable from the hallway without the Food Court (and vice versa)', () => {
  const { map, open, reach } = setup();
  open('startShutter');
  open('megaMart');
  for (const s of map.spawnPoints.filter((p) => p.zone === 'megaMart')) assert.ok(Number.isFinite(reach(s.position)), `${s.name} reachable`);
  for (const s of map.spawnPoints.filter((p) => p.zone === 'foodCourt')) assert.equal(reach(s.position), Infinity, `${s.name} sealed`);
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
