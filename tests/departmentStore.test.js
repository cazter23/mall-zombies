// HOFFMAN'S department store (maps/mall/departmentStore.js, config/departmentStore.js) in the real game: its 1250 gate off the
// hallway's north wall, sealed until bought, spawns on clear floor inside, routes both ways, walking in for real, the moved
// hallway vent, and its wiring (room culling, zone lighting, horror area). Nothing of it reaches the floors above.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { LAYOUT } from '../src/maps/mall/mall.js';
import { economy } from '../src/config/economy.js';
import { createRoomCulling } from '../src/fx/roomCulling.js';
import { gradeZoneAt } from '../src/fx/zoneGrading.js';

const DS = LAYOUT.departmentStore;
const r = DS.rect;
const H = LAYOUT.hallway;
const gateX = (DS.gate.from + DS.gate.to) / 2;
const contains = (colliders, x, y, z) => colliders.some((b) => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z);

function started() {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.g.debug.run('god');
  return t;
}
function hallwayOpen() {
  const t = started();
  door(t.g, 'startShutter').open();
  t.tick(120);
  return t;
}
function hold(t, keys, seconds) {
  for (const k of keys) t.g.player.input.held.add(k);
  t.tick(Math.round(seconds * 60));
  for (const k of keys) t.g.player.input.held.delete(k);
}
const door = (g, id) => g.map.doors.find((d) => d.id === id);
const spawns = (g) => g.map.spawnPoints.filter((s) => s.zone === 'departmentStore');

test("the gate is a normal 1250 purchase from the hallway: a real F hold opens HOFFMAN'S; Play again seals it", () => {
  const t = hallwayOpen();
  const { g } = t;
  assert.equal(economy.doors.departmentStore, 1250);
  g.wallet.earn(2000);
  t.standAt(gateX, H.maxZ - 1.4, 180); // in the hallway, facing north (+Z)
  t.tick(5);
  assert.equal(g.interactions.prompt?.label, "Hoffman's");
  assert.equal(g.interactions.prompt?.cost, 1250);
  const before = g.wallet.points;
  t.press('KeyF', 40);
  assert.equal(before - g.wallet.points, 1250);
  assert.equal(g.map.zones.departmentStore.open, true);
  g.resetRun();
  assert.equal(g.map.zones.departmentStore.open, false);
  assert.equal(door(g, 'departmentStore').isOpen, false);
});

test('sealed until bought: no route in, nothing spawns inside; after: every spawn is reachable, on floor and clear', () => {
  const t = hallwayOpen();
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(gateX, 0, 3.5), yaw: 0 });
  t.tick(120);
  const nav = g.zombies.nav;
  const inside = (p) => p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;
  for (const s of spawns(g)) assert.equal(nav.distanceToTarget(s.position.x, s.position.z, 0), Infinity, `${s.name} sealed`);
  for (let i = 0; i < 40; i++) {
    g.zombies.clear();
    const z = g.zombies.spawn('shopper');
    assert.ok(!z || !inside(z.position), 'nothing spawns in the store while it is closed');
  }
  door(g, 'departmentStore').open();
  t.tick(120);
  assert.ok(spawns(g).length >= 2);
  for (const s of spawns(g)) {
    assert.ok(inside(s.position), `${s.name} is inside the store`);
    assert.ok(Number.isFinite(nav.distanceToTarget(s.position.x, s.position.z, 0)), `${s.name} reachable`);
    assert.ok(contains(g.colliders, s.position.x, -0.1, s.position.z), `${s.name} has floor under it`);
    const body = new THREE.Box3(new THREE.Vector3(s.position.x - 0.4, 0.1, s.position.z - 0.4), new THREE.Vector3(s.position.x + 0.4, 1.8, s.position.z + 0.4));
    assert.ok(!g.colliders.some((b) => b.intersectsBox(body)), `${s.name} is not inside anything`);
  }
  for (const [x, z] of [[r.minX + 1, r.minZ + 1], [r.maxX - 1, r.minZ + 1], [r.minX + 1, r.maxZ - 1], [r.maxX - 1, r.maxZ - 1]]) {
    assert.ok(Number.isFinite(nav.distanceToTarget(x, z, 0)), `corner (${x}, ${z}) reachable`);
  }
});

test('a player walks in through the gate and to the back wall; the walls hold', () => {
  const t = hallwayOpen();
  const { g } = t;
  door(g, 'departmentStore').open();
  t.tick(120);
  g.player.teleport({ position: new THREE.Vector3(gateX, 0, 3.5), yaw: Math.PI }); // facing +Z (north)
  t.tick(2);
  hold(t, ['KeyW'], 5);
  const p = g.player.position;
  assert.ok(p.z > r.maxZ - 1.5 && p.z < r.maxZ, `reached the back wall (z ${p.z.toFixed(2)})`);
  assert.ok(Math.abs(p.y) < 0.01, 'on the floor');
  // Into each wall: you stop at it
  for (const [yaw, check] of [[Math.PI / 2, () => g.player.position.x > r.minX], [-Math.PI / 2, () => g.player.position.x < r.maxX]]) {
    g.player.teleport({ position: new THREE.Vector3(-12.6, 0, 21), yaw });
    t.tick(2);
    hold(t, ['KeyW'], 3);
    assert.ok(check(), `stopped by the wall (x ${g.player.position.x.toFixed(2)})`);
  }
});

test('zombies come out of the store to a player in the hallway, and in to a player at the back', () => {
  const t = hallwayOpen();
  const { g } = t;
  door(g, 'departmentStore').open();
  t.tick(120);
  const chase = (from, target, seconds) => {
    g.player.teleport({ position: target, yaw: 0 });
    t.tick(30);
    g.zombies.clear();
    const z = g.zombies.spawn('shopper', from.clone());
    for (let i = 0; i < 60 * seconds; i++) {
      g.player.teleport({ position: target, yaw: 0 });
      t.tick(1);
      if (Math.hypot(z.position.x - target.x, z.position.z - target.z) < 2) return i / 60;
    }
    assert.fail(`never got there (ended at ${z.position.toArray().map((v) => v.toFixed(1))})`);
  };
  const back = spawns(g).find((s) => s.name.includes('stockroom')).position;
  assert.ok(chase(back, new THREE.Vector3(0, 0, 2), 40) < 40);
  assert.ok(chase(new THREE.Vector3(0, 0, 2), new THREE.Vector3(-8, 0, 24), 40) < 40);
});

test("the hallway's north-west vent moved east of the gate and is still a clean spawn", () => {
  const { g } = started();
  const vent = g.map.spawnPoints.find((s) => s.name === 'spawn_hallway_ventNorthWest');
  assert.equal(vent.position.x, DS.hallwayVentX);
  assert.ok(vent.position.x > DS.gate.to + 2, 'clear of the gate');
  const body = new THREE.Box3(new THREE.Vector3(vent.position.x - 0.4, 0.1, vent.position.z - 0.4), new THREE.Vector3(vent.position.x + 0.4, 1.8, vent.position.z + 0.4));
  assert.ok(!g.colliders.some((b) => b.intersectsBox(body)));
});

test('wiring: a culling room seen only through its open gate, its own grade, a horror area; it stays below the floors above', () => {
  const { g } = started();
  const map = g.map;
  const area = map.cullAreas.find((a) => a.id === 'departmentStore');
  assert.ok(area);
  assert.ok(area.maxY < H.height, 'below level 2 (and the cinema) entirely');
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 200);
  let open = false;
  const culling = createRoomCulling({ areas: map.cullAreas, portals: map.cullPortals, camera, isOpen: (id) => id !== 'departmentStore' || open });
  camera.position.set(gateX, 1.7, 1);
  camera.lookAt(gateX, 1.7, 20);
  assert.equal(culling.update().has('departmentStore'), false, 'shutter closed: not drawn');
  open = true;
  assert.equal(culling.update().has('departmentStore'), true, 'shutter open: drawn');
  camera.lookAt(gateX, 1.7, -20); // facing away
  assert.equal(culling.update().has('departmentStore'), false);
  assert.equal(gradeZoneAt(map.gradeZones, new THREE.Vector3(-12, 1.7, 15)), 'departmentStore');
  assert.ok(map.horror.areas.some((a) => a.id === 'departmentStore'));
  // Nothing standing on the store's floor pokes above its roof (level 2's floor is at 6.0-6.3, the shoe store's walls stand
  // on it; the cinema is upstairs west of x -20.3)
  for (const b of g.colliders) {
    if (b.min.y < DS.height && b.min.x >= r.minX - 0.31 && b.max.x <= r.maxX + 0.31 && b.min.z >= r.minZ - 0.01 && b.max.z <= r.maxZ + 0.31) {
      assert.ok(b.max.y <= DS.height + 0.3 + 1e-6, `collider up to y ${b.max.y}`);
    }
  }
});
