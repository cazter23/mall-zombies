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
import { PlayerController } from '../src/player/controller.js';
import { createPlayerStats } from '../src/player/stats.js';
import { LAYOUT } from '../src/maps/mall/mall.js';

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
  for (const [x, z] of [[-19, -13.5], [19, -13.5], [0, -12.2], [-19, -3], [19, -3]]) assert.ok(reachable({ x, z }), `Food Court (${x}, ${z}) reachable`);
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

// A real player (the game's own movement code) driven by a scripted input.
function playerIn(colliders, position, yaw) {
  const held = new Set();
  const pressed = new Set();
  const input = {
    held, pressed, axis: { x: 0, y: 0 }, device: 'keyboard',
    moveAxis() { return this.axis; },
    consumeAction(action) { const v = pressed.has(action); pressed.delete(action); return v; },
    actionDown(action) { return held.has(action); },
    actionPressed(action) { return pressed.has(action); },
  };
  const player = new PlayerController({
    camera: new THREE.PerspectiveCamera(), input, stats: createPlayerStats(), colliders,
    spawn: { position: position.clone(), yaw },
  });
  return { player, input };
}

const containsPoint = (colliders, x, y, z) => colliders.some((b) => b.containsPoint(new THREE.Vector3(x, y, z)));

test('the escalator is sealed: sprinting and jumping at it never gets you on it', () => {
  const { colliders } = setup();
  const E = LAYOUT.escalator;
  // Anything on the escalator you could reach from the floor is taller than a jump.
  const jumpPeak = (feel.movement.jumpVelocity ** 2) / (2 * feel.movement.gravity);
  const onEscalator = colliders.filter((b) => b.min.z >= E.minZ - 1e-6 && b.max.z <= E.maxZ + 1e-6 && b.min.x >= -18 && b.max.x <= -3);
  assert.ok(onEscalator.length >= 12, 'barrier + slope steps + top landing');
  for (const b of onEscalator.filter((c) => c.min.y < feel.player.height)) {
    assert.ok(b.max.y > jumpPeak + 0.1, `collider at x ${b.min.x.toFixed(1)}..${b.max.x.toFixed(1)} too tall to jump onto`);
  }
  // And for real: run at the bottom end from the hub side, jumping the whole way.
  const { player, input } = playerIn(colliders, new THREE.Vector3(1, 0, 2), Math.PI / 2); // facing -X
  input.axis = { x: 0, y: 1 };
  input.held.add('sprint');
  let maxY = 0;
  let minX = Infinity;
  for (let i = 0; i < 60 * 4; i++) {
    if (i % 20 === 0) input.pressed.add('jump');
    player.update(dt);
    maxY = Math.max(maxY, player.position.y);
    minX = Math.min(minX, player.position.x);
  }
  assert.ok(minX > E.bottomX + 0.6, `stopped at the barrier (got to x ${minX.toFixed(2)})`);
  assert.ok(maxY < jumpPeak + 0.05, 'never stood on anything');
});

test('you can walk (and zombies can path) under the high end of the escalator, and round it', () => {
  const { colliders, nav, open, reach } = setup();
  open('startShutter');
  // Under the high end: walkable floor, reachable, and a standing player fits.
  for (const x of [-12, -14, -16.5]) {
    assert.ok(Number.isFinite(reach({ x, z: 2 })), `(${x}, 2) reachable`); // (also builds the nav grid)
    assert.ok(nav.isWalkableAt(x, 2), `(${x}, 2) under the escalator is walkable`);
    assert.equal(overlapsSolid(new THREE.Vector3(x, 0, 2), feel.player.radius, feel.player.height, colliders, feel.movement.stepTolerance), false, `a player fits under at x ${x}`);
  }
  // The low end blocks the floor.
  assert.equal(nav.isWalkableAt(-6, 2), false, 'the low end is solid');
  // A real player walking east under it gets all the way to where it becomes solid.
  const { player, input } = playerIn(colliders, new THREE.Vector3(-19, 0, 2), -Math.PI / 2); // facing +X
  input.axis = { x: 0, y: 1 };
  for (let i = 0; i < 60 * 3; i++) player.update(dt);
  assert.ok(player.position.x > -11.2, `walked under the high end (reached x ${player.position.x.toFixed(2)})`);
  assert.ok(player.position.x < -9.5, 'and stopped at the solid low end');
  assert.equal(player.position.y, 0);
});

test('the ceiling is open only above the escalator; the elevator wall stays solid', () => {
  const { colliders } = setup();
  const H = LAYOUT.hallway;
  const y = H.height + 0.15; // inside the ceiling slab
  // In the hole, beside the escalator (its own balustrade colliders rise through the middle of it).
  for (const z of [0.85, 3.15]) assert.equal(containsPoint(colliders, -14, y, z), false, `hole above the escalator at z ${z}`);
  for (const [x, z] of [[0, 2], [-14, -1], [-14, 5], [-19, 2], [-8, 2]]) assert.ok(containsPoint(colliders, x, y, z), `ceiling at (${x}, ${z})`);
  // The boarded-up level-2 landing above the hole is closed in (walls on all sides, a roof).
  for (const [x, yy, z] of [[-14, 8, 0.55], [-14, 8, 3.45], [-11.8, 8, 2], [-19.35, 8, 2], [-14, 9.75, 2]]) {
    assert.ok(containsPoint(colliders, x, yy, z), `upper landing closed at (${x}, ${yy}, ${z})`);
  }
  // Elevator: painted on, the wall behind it is solid.
  assert.ok(containsPoint(colliders, LAYOUT.elevator.centerX, 1.2, H.maxZ + 0.15), 'wall behind the elevator doors');
});

test('Food Court: you can queue at every stall and reach every gap between the tables, but never get behind a counter', () => {
  const { colliders, nav, open, reach } = setup();
  open('startShutter');
  open('foodCourt');
  const F = LAYOUT.foodCourt;
  const reachable = (x, z) => Number.isFinite(reach({ x, z }));
  // In front of each stall (the queue), the lanes between tables, the door-to-planter lane, the far ends.
  for (const [x, z] of [[-5.75, -12.2], [0, -12.2], [5.75, -12.2], [-7.25, -7], [7.25, -8], [-7.25, -10], [0, -5],
    [-3.5, -6], [3.5, -9], [-12, -8.3], [12, -6]]) {
    assert.ok(reachable(x, z), `(${x}, ${z}) reachable`);
  }
  // Behind the counters: solid, not walkable.
  for (const x of [-5.75, 0, 5.75]) assert.equal(nav.isWalkableAt(x, F.minZ + 0.6), false, `behind the counter at x ${x}`);
  // Counters are too tall to get onto (jump peak + the step-up tolerance); tables are low enough to hop on.
  const jumpPeak = (feel.movement.jumpVelocity ** 2) / (2 * feel.movement.gravity);
  const counters = colliders.filter((b) => b.min.z <= F.minZ + 1e-6 && b.max.z > F.minZ + 1 && b.max.z < F.minZ + 1.5 && b.max.y < 2);
  assert.equal(counters.length, 3, 'three stalls');
  for (const b of counters) assert.ok(b.max.y > jumpPeak + feel.movement.stepTolerance + 0.05, 'stall counter out of reach');
  const tables = colliders.filter((b) => Math.abs(b.max.y - 0.75) < 1e-6);
  assert.equal(tables.length, 8, 'eight tables');
  for (const b of tables) assert.ok(b.max.y < jumpPeak, 'tables can be hopped onto');
});

test('Food Court: sprint-jumping at a stall counter never gets you onto it', () => {
  const { colliders } = setup();
  const F = LAYOUT.foodCourt;
  // Down the lane between the table columns, straight at Burger Barn.
  const { player, input } = playerIn(colliders, new THREE.Vector3(-7.25, 0, -4), 0); // facing -Z
  input.axis = { x: 0, y: 1 };
  input.held.add('sprint');
  let minZ = Infinity;
  for (let i = 0; i < 60 * 3; i++) {
    if (i % 15 === 0) input.pressed.add('jump');
    player.update(dt);
    minZ = Math.min(minZ, player.position.z);
  }
  const counterFront = F.minZ + 1.3;
  assert.ok(minZ > counterFront + feel.player.radius - 0.02, `stopped at the counter (got to z ${minZ.toFixed(2)})`);
  for (let i = 0; i < 60; i++) player.update(dt); // settle
  assert.equal(player.position.y, 0, 'still on the floor');
});
