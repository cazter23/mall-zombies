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
import { featuresOf } from '../src/game/features/index.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';

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
  const nav = createNavigation(colliders, { radius: shopper.radius, height: shopper.height }, map.navigation);
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

test('Service Corridor walls do not overlap the Food Court west wall and flicker through its face', () => {
  const { map } = setup();
  map.group.updateMatrixWorld(true);
  const sharedPieces = map.group.children.filter((o) => o.name.startsWith('foodcourt_wall_west_'))
    .map((o) => new THREE.Box3().setFromObject(o));
  assert.ok(sharedPieces.length > 0);
  map.group.traverse((o) => {
    if (!o.name.startsWith('service_wall')) return;
    const b = new THREE.Box3().setFromObject(o);
    for (const shared of sharedPieces) {
      const overlapsZ = Math.min(b.max.z, shared.max.z) - Math.max(b.min.z, shared.min.z) > 1e-6;
      if (overlapsZ) assert.ok(b.max.x <= shared.min.x + 1e-6, `${o.name} overlaps the shared wall`);
    }
  });
  map.dispose();
});

test('Mega Mart shortcut sign clears the brand stripes instead of flickering against them', () => {
  const { map } = setup();
  map.group.updateMatrixWorld(true);
  const sign = map.group.getObjectByName('sign_foodCourtMegaMart_mart');
  assert.ok(sign);
  const stripes = map.group.children.filter((o) => o.geometry?.type === 'BoxGeometry')
    .map((o) => new THREE.Box3().setFromObject(o))
    .filter((b) => Math.abs(b.min.x - 20.3) < 1e-5 && b.max.x < 20.4 && b.min.y >= 3.29 && b.max.y <= 3.67);
  assert.equal(stripes.length, 2);
  for (const stripe of stripes) assert.ok(sign.position.x > stripe.max.x + 0.001, 'sign lies in front of stripe face');
  map.dispose();
});

test('the door ladder: four entrances, two independently priced two-zone shortcuts, and the escalator repair', () => {
  const { map, door } = setup();
  const ladder = [
    ['startShutter', 'hallway', economy.doors.startShutter],
    ['megaMart', 'megaMart', economy.doors.megaMart],
    ['foodCourt', 'foodCourt', economy.doors.foodCourt],
    ['serviceCorridor', 'serviceCorridor', economy.doors.serviceCorridor],
  ];
  for (const [id, zone, price] of ladder) {
    assert.equal(door(id).price, price, `${id} price`);
    assert.equal(door(id).opensZone, zone, `${id} opens ${zone}`);
    assert.equal(map.zones[zone].open, false, `${zone} starts closed`);
  }
  assert.deepEqual([economy.doors.startShutter, economy.doors.megaMart, economy.doors.foodCourt, economy.doors.serviceCorridor], [500, 750, 1000, 1250]);
  assert.equal(map.doors.length, 14);
  assert.equal(door('departmentStoreStartRoom').price, 1250); // HOFFMAN'S side door from the start room
  assert.deepEqual(door('departmentStoreStartRoom').opensZones, ['departmentStore']);
  assert.equal(door('departmentStore').price, 1250); // HOFFMAN'S (tests/departmentStore.test.js)
  assert.deepEqual(door('departmentStore').opensZones, ['departmentStore']);
  assert.equal(door('atriumMegaMart').price, 1000);
  assert.deepEqual(door('atriumMegaMart').opensZones, ['atrium', 'megaMart']);
  assert.equal(door('atrium').price, 1500);
  assert.deepEqual(door('atrium').opensZones, ['atrium']);
  assert.equal(door('atriumPromenade').price, 1000);
  assert.deepEqual(door('atriumPromenade').opensZones, ['atrium', 'upstairs']);
  assert.equal(door('escalatorRepair').price, economy.doors.escalatorRepair);
  assert.equal(economy.doors.escalatorRepair, 2000);
  assert.deepEqual(door('escalatorRepair').opensZones, ['upstairs']);
  assert.equal(door('escalatorRepair').verb, 'repair');
  assert.equal(door('foodCourtMegaMart').price, economy.doors.foodCourtMegaMart);
  assert.equal(door('serviceCorridorFoodCourt').price, economy.doors.serviceCorridorFoodCourt);
  assert.deepEqual([economy.doors.foodCourtMegaMart, economy.doors.serviceCorridorFoodCourt], [1000, 1250]);
  for (const d of map.doors) for (const zone of d.opensZones) assert.ok(map.zones[zone], `door ${d.id} opens a real zone`);
});

test('all 120 purchase orders: any bought entrance holds its zones open; reset seals every route (the escalator repair, the atrium doors and HOFFMAN\'S have their own tests)', () => {
  const { map, open, reach } = setup();
  const permutations = (ids) => ids.length ? ids.flatMap((id) => permutations(ids.filter((other) => other !== id)).map((rest) => [id, ...rest])) : [[]];
  const orders = permutations(map.doors.filter((d) => !['startShutter', 'escalatorRepair', 'atrium', 'atriumPromenade', 'atriumMegaMart', 'cinema', 'cinemaStairs', 'departmentStore', 'departmentStoreStartRoom'].includes(d.id)).map((d) => d.id));
  assert.equal(orders.length, 120);
  for (const order of orders) {
    map.reset();
    open('startShutter');
    for (const id of order) {
      open(id);
      for (const [zoneId, zone] of Object.entries(map.zones)) {
        const expected = zoneId === 'startRoom' || map.doors.some((d) => d.isOpen && d.opensZones.includes(zoneId));
        assert.equal(zone.open, expected, `${order}: ${zoneId} after ${id}`);
      }
      // Some permutations buy an isolated shortcut first (debug-only). Compare physical nav
      // with the purchased doorway graph, independently of the logical spawn-zone flags.
      const edges = [
        ['startShutter', 'startRoom', 'hallway'], ['megaMart', 'hallway', 'megaMart'],
        ['foodCourt', 'hallway', 'foodCourt'], ['serviceCorridor', 'hallway', 'serviceCorridor'],
        ['foodCourtMegaMart', 'foodCourt', 'megaMart'], ['serviceCorridorFoodCourt', 'serviceCorridor', 'foodCourt'],
      ];
      const connected = new Set(['startRoom']);
      for (let pass = 0; pass < Object.keys(map.zones).length; pass++) {
        for (const [doorId, a, b] of edges) {
          if (map.doors.find((d) => d.id === doorId).isOpen && (connected.has(a) || connected.has(b))) {
            connected.add(a); connected.add(b);
          }
        }
      }
      for (const s of map.spawnPoints.filter((s) => !['upstairs', 'atrium', 'cinema', 'departmentStore'].includes(s.zone))) { // upper areas have their own tests
        assert.equal(Number.isFinite(reach(s.position)), connected.has(s.zone), `${order} after ${id}: ${s.name}`);
      }
    }
    for (const s of map.spawnPoints.filter((s) => !['upstairs', 'atrium', 'cinema', 'departmentStore'].includes(s.zone))) assert.ok(Number.isFinite(reach(s.position)), `${s.name} reachable with every door open`);
    map.reset();
    for (const s of map.spawnPoints.filter((s) => s.zone !== 'startRoom')) {
      assert.equal(reach(s.position), Infinity, `${s.name} sealed on reset`);
      assert.equal(map.zones[s.zone].open, false);
    }
  }
  map.dispose();
});

test('each shortcut supplies a short nav route and a standing player can cross in either direction', () => {
  for (const [id, x, z] of [['foodCourtMegaMart', 20.15, -8.3], ['serviceCorridorFoodCourt', -20.15, -12.2]]) {
    const { map, colliders, player: target, open, reach } = setup();
    for (const entrance of ['startShutter', 'foodCourt', 'megaMart', 'serviceCorridor']) open(entrance);
    target.set(x - 1.7, 0, z);
    assert.ok(reach({ x: x + 1.7, z }) > 20, `${id}: a closed shortcut forces the hallway detour`);
    open(id);
    assert.ok(reach({ x: x + 1.7, z }) < 8, `${id}: rebuilt nav crosses the new opening`);
    for (const dir of [-1, 1]) {
      const { player, input } = playerIn(colliders, new THREE.Vector3(x - dir * 1.7, 0, z), -dir * Math.PI / 2);
      input.axis = { x: 0, y: 1 };
      for (let i = 0; i < 50; i++) player.update(dt);
      assert.ok((player.position.x - x) * dir > 1, `${id}: walked through toward ${dir}`);
      assert.equal(player.position.y, 0, 'continuous floor under the shared wall');
    }
    map.dispose();
  }
});

test('either shortcut can be the only entrance into its outer zone', () => {
  for (const [id, zone] of [['foodCourtMegaMart', 'megaMart'], ['serviceCorridorFoodCourt', 'serviceCorridor']]) {
    const { map, open, reach } = setup();
    open('startShutter');
    open('foodCourt');
    for (const s of map.spawnPoints.filter((s) => s.zone === zone)) assert.equal(reach(s.position), Infinity);
    open(id);
    for (const s of map.spawnPoints.filter((s) => s.zone === zone)) assert.ok(Number.isFinite(reach(s.position)), s.name);
    assert.equal(map.doors.find((d) => d.id === zone).isOpen, false);
    map.dispose();
  }
});

test('shortcuts still connect with the real debug range changing the navigation grid bounds', () => {
  const scene = new THREE.Scene();
  const colliders = [];
  const map = buildMall(scene, colliders);
  buildTestRange(scene, colliders); // main.js includes this: its bounds shift the cell centres.
  for (const d of map.doors) d.open();
  for (let i = 0; i < 90; i++) map.update(dt);
  const nav = createNavigation(colliders, zombieTypes.shopper);
  for (const [x, z] of [[-20.15, -12.2], [20.15, -8.3]]) {
    nav.update(1, new THREE.Vector3(x + 1.7, 0, z));
    assert.ok(nav.isWalkableAt(x, z), `floor under the doorway at ${x}`);
    assert.ok(nav.distanceToTarget(x - 1.7, z) < 8, `short crossing at ${x}, with debug range present`);
    assert.ok(colliders.some((b) => b.max.y === 0 && b.min.x <= x && b.max.x >= x && b.min.z <= z && b.max.z >= z), 'physical floor beneath the shared wall');
  }
  map.dispose();
});

test('Food Court shortcut opens the Mega Mart without its hallway door, with clear approaches', () => {
  const { map, door, open, reach, colliders } = setup();
  assert.equal(door('foodCourtMegaMart').price, 1000);
  assert.deepEqual(door('foodCourtMegaMart').opensZones, ['foodCourt', 'megaMart']);
  open('startShutter');
  open('foodCourt');
  assert.equal(reach({ x: 21.8, z: -8.3 }), Infinity, 'closed shutter seals the Mart');
  open('foodCourtMegaMart');
  assert.equal(door('megaMart').isOpen, false, 'hallway entrance remains separately buyable');
  assert.equal(map.zones.megaMart.open, true);
  for (const s of map.spawnPoints.filter((s) => s.zone === 'megaMart')) assert.ok(Number.isFinite(reach(s.position)), s.name);
  for (const x of [18.5, 19.5, 20.15, 21, 21.8]) {
    for (const z of [-9.3, -8.3, -7.3]) {
      assert.equal(overlapsSolid(new THREE.Vector3(x, 0, z), feel.player.radius, feel.player.height, colliders, feel.movement.stepTolerance), false, `clear approach (${x}, ${z})`);
    }
  }
  map.reset();
  assert.equal(map.zones.megaMart.open, false);
  assert.equal(map.zones.foodCourt.open, false);
  map.dispose();
});

test('every spawn point and the player spawn stand on open floor, not inside anything', () => {
  const { map, colliders, nav } = setup();
  nav.update(dt, new THREE.Vector3(0, 0, 0));
  const body = { radius: zombieTypes.shopper.radius, height: zombieTypes.shopper.height };
  for (const s of map.spawnPoints) {
    assert.ok(map.zones[s.zone], `${s.name} has a real zone`);
    assert.ok(nav.isWalkableAt(s.position.x, s.position.z, s.position.y), `${s.name} is on walkable floor`);
    assert.equal(overlapsSolid(s.position, body.radius, body.height, colliders, feel.movement.stepTolerance), false, `${s.name} is clear`);
  }
  assert.equal(overlapsSolid(map.playerSpawn.position, feel.player.radius, feel.player.height, colliders, feel.movement.stepTolerance), false);
});

test('service shortcut opens Food Court from the corridor, keeping both approaches and locker lane clear', () => {
  const { map, open, door, reach, colliders } = setup();
  assert.equal(door('serviceCorridorFoodCourt').price, 1250);
  open('startShutter');
  open('serviceCorridor');
  assert.equal(reach({ x: -18.4, z: -12.2 }), Infinity);
  open('serviceCorridorFoodCourt');
  assert.equal(door('foodCourt').isOpen, false);
  assert.equal(map.zones.foodCourt.open, true);
  for (const s of map.spawnPoints.filter((s) => s.zone === 'foodCourt')) assert.ok(Number.isFinite(reach(s.position)), s.name);
  for (const x of [-21.8, -20.8, -20.15, -19.5, -18.5]) {
    for (const z of [-12.8, -12.2, -11.6]) {
      assert.equal(overlapsSolid(new THREE.Vector3(x, 0, z), feel.player.radius, feel.player.height, colliders, feel.movement.stepTolerance), false, `clear approach (${x}, ${z})`);
    }
  }
  const lockers = colliders.find((b) => b.min.x < -23 && b.max.x > -23 && b.min.z === -11 && b.max.z === -9 && b.max.y === 1.9);
  assert.ok(lockers);
  assert.ok(LAYOUT.foodCourt.minX - LAYOUT.wallThickness - lockers.max.x >= 2, 'at least 2m of clear corridor beside/past the bank');
  for (const z of [-11.3, -12.3, -13.5]) {
    assert.equal(overlapsSolid(new THREE.Vector3(-21.8, 0, z), feel.player.radius, feel.player.height, colliders, feel.movement.stepTolerance), false, 'more than 2m of walkable lane beyond the locker bank');
  }
  map.dispose();
});

test('with shortcuts shut, each area is sealed until its hallway entrance is bought and fully reachable after', () => {
  const { map, open, reach } = setup();
  const spawnsIn = (zone) => map.spawnPoints.filter((s) => s.zone === zone);
  const reachable = (p) => Number.isFinite(reach(p));
  assert.deepEqual(['hallway', 'foodCourt', 'megaMart', 'serviceCorridor'].map((z) => spawnsIn(z).length), [3, 4, 4, 3]);

  // Nothing bought: only the start room.
  for (const s of spawnsIn('hallway')) assert.equal(reach(s.position), Infinity, `${s.name} sealed`);

  // Start shutter: the hallway (and its Nail Gun wall buy) opens; the Mega Mart and Food Court stay sealed.
  open('startShutter');
  for (const s of [...spawnsIn('startRoom'), ...spawnsIn('hallway')]) assert.ok(reachable(s.position), `${s.name} reachable`);
  const nailGun = featuresOf(map, 'wallBuy').find((w) => w.weapon === 'nailGun');
  assert.equal(nailGun.zone, 'hallway');
  assert.ok(reachable({ x: nailGun.position.x, z: nailGun.position.z + 0.8 }), 'you can stand at the Nail Gun wall buy');
  for (const s of [...spawnsIn('megaMart'), ...spawnsIn('foodCourt'), ...spawnsIn('serviceCorridor')]) assert.equal(reach(s.position), Infinity, `${s.name} sealed`);

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
  for (const z of ['hallway', 'megaMart', 'foodCourt', 'serviceCorridor']) assert.equal(map.zones[z].open, false, `${z} closed after reset`);
  for (const s of [...spawnsIn('hallway'), ...spawnsIn('megaMart'), ...spawnsIn('foodCourt'), ...spawnsIn('serviceCorridor')]) {
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
  // (The blocks under the walkable lane sit between the side walls and the barrier: enclosed, out of reach until the barrier is gone.)
  const inLane = (b) => b.min.z >= E.minZ + 0.3 - 1e-6 && b.max.z <= E.maxZ - 0.3 + 1e-6;
  const onEscalator = colliders.filter((b) => b.min.z >= E.minZ - 1e-6 && b.max.z <= E.maxZ + 1e-6 && b.min.x >= -18 && b.max.x <= -3 && !inLane(b));
  assert.ok(onEscalator.length >= 12, 'barrier + side walls along the slope + top landing');
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
  // The low end blocks the floor (under the walkable lane; its first metre is the ramp's foot).
  assert.equal(nav.isWalkableAt(-8, 2), false, 'the low end is solid');
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
  for (const [x, z] of [[0, 2], [-14, -1], [-14, 5], [-19, 2], [-8, -1], [-8, 5], [6, -1], [6, 5], [-10.5, 2], [14, 2]]) assert.ok(containsPoint(colliders, x, y, z), `ceiling at (${x}, ${z})`);
  // The balcony voids (level 2 looks down into the hallway through them) are open.
  for (const v of LAYOUT.level2.voids) assert.equal(containsPoint(colliders, (v.minX + v.maxX) / 2, y, (v.minZ + v.maxZ) / 2), false, 'balcony void open');
  // Level 2 above it is closed in: walls on all four sides and a roof (levelTwo.test.js has the rest).
  const upper = H.height + 0.3 + 1.8;
  const U = LAYOUT.level2.rect;
  for (const [x, z] of [[0, U.maxZ + 0.15], [0, U.minZ - 0.15], [U.minX - 0.15, 2], [U.maxX + 0.15, 2]]) {
    assert.ok(containsPoint(colliders, x, upper, z), `level 2 wall at (${x}, ${z})`);
  }
  assert.ok(containsPoint(colliders, 0, H.height + 0.3 + LAYOUT.level2.height + 0.15, 2), 'level 2 roof');
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

test('Service Corridor: hallway door opens the corridor; its unbought shortcut keeps Food Court sealed', () => {
  const { map, nav, open, reach } = setup();
  const reachable = (x, z) => Number.isFinite(reach({ x, z }));
  const corridorSpawns = map.spawnPoints.filter((p) => p.zone === 'serviceCorridor');
  open('startShutter');
  for (const s of corridorSpawns) assert.equal(reach(s.position), Infinity, `${s.name} sealed`);
  open('serviceCorridor');
  for (const s of corridorSpawns) assert.ok(reachable(s.position.x, s.position.z), `${s.name} reachable`);
  // The doorway, the corner, past the lockers, the dead end.
  for (const [x, z] of [[-20.5, 2], [-22, 3], [-21.5, -10], [-21.8, -13.5]]) assert.ok(reachable(x, z), `(${x}, ${z}) reachable`);
  assert.equal(nav.isWalkableAt(-23.1, -10), false, 'the lockers are solid');
  // Its shortcut is still shut: the shared wall/shutter keep the Food Court sealed.
  for (const s of map.spawnPoints.filter((p) => p.zone === 'foodCourt')) assert.equal(reach(s.position), Infinity, `${s.name} still sealed`);
});

test('Service Corridor: a real player walks in through the doorway, down to the dead end', () => {
  const { colliders, map, door } = setup();
  door('startShutter').open();
  door('serviceCorridor').open();
  for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);
  const { player, input } = playerIn(colliders, new THREE.Vector3(-18, 0, 2), Math.PI / 2); // facing -X (west)
  input.axis = { x: 0, y: 1 };
  for (let i = 0; i < 60 * 1.2; i++) player.update(dt); // west through the doorway to the corridor's west wall
  assert.ok(player.position.x < -21, `through the doorway (x ${player.position.x.toFixed(2)})`);
  // Step back to the middle (walking down the west wall you'd walk into the lockers) and face south.
  player.position.x = -21.8;
  player.yaw = 0; // facing -Z (south) down the corridor
  for (let i = 0; i < 60 * 4; i++) player.update(dt);
  assert.ok(player.position.z < -12.5, `walked down to the dead end (z ${player.position.z.toFixed(2)})`);
  assert.equal(player.position.y, 0);
});

test('dispose unloads the map: its colliders leave the shared list, GPU memory is freed, a reload is clean', () => {
  const someoneElses = new THREE.Box3(new THREE.Vector3(0, -101, 0), new THREE.Vector3(1, -100, 1)); // e.g. the test range
  const colliders = [someoneElses];
  const scene = new THREE.Scene();
  const map = buildMall(scene, colliders);
  const built = colliders.length;
  assert.ok(built > 100);
  map.doors.find((d) => d.id === 'startShutter').open(); // one shutter's collider already gone, one still there
  for (let t = 0; t < feel.world.shutterOpenSeconds + 0.5; t += dt) map.update(dt);

  // Count what gets freed.
  const things = new Set();
  map.group.traverse((o) => {
    if (o.geometry) things.add(o.geometry);
    for (const m of [o.material].flat()) if (m) { things.add(m); if (m.map) things.add(m.map); }
  });
  let freed = 0;
  for (const t of things) t.addEventListener('dispose', () => freed++);

  map.dispose();
  assert.deepEqual([...colliders], [someoneElses], 'only the other colliders are left');
  assert.equal(freed, things.size, 'every geometry, material and texture freed');
  assert.ok(!scene.children.includes(map.group), 'out of the scene');

  const again = buildMall(scene, colliders);
  assert.equal(colliders.length, built, 'reloading gives the same colliders, no invisible duplicates');
  again.dispose();
  assert.deepEqual([...colliders], [someoneElses]);
});
