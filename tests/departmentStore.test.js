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
import { feel } from '../src/config/feel.js';

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
  // (The north-west corner is the fitting rooms and the north-east one the shoe wall: their fronts instead)
  for (const [x, z] of [[r.minX + 1, r.minZ + 1], [r.maxX - 1, r.minZ + 1], [r.minX + 1, r.maxZ - DS.fittingRooms.depth - 0.8], [r.maxX - 1.2, r.maxZ - 1]]) {
    assert.ok(Number.isFinite(nav.distanceToTarget(x, z, 0)), `corner (${x}, ${z}) reachable`);
  }
});

test('a player walks in through the gate, up the west aisle to the fitting rooms; the walls hold', () => {
  const t = hallwayOpen();
  const { g } = t;
  door(g, 'departmentStore').open();
  t.tick(120);
  g.player.teleport({ position: new THREE.Vector3(-18.8, 0, 3.5), yaw: Math.PI }); // facing +Z (north), in line with the west aisle
  t.tick(2);
  hold(t, ['KeyW'], 5);
  const p = g.player.position;
  const fittingFront = r.maxZ - DS.fittingRooms.depth;
  assert.ok(p.z > fittingFront - 1 && p.z < fittingFront, `reached the fitting rooms (z ${p.z.toFixed(2)})`);
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

// --- Step 2: the fixtures ---------------------------------------------------------------------------------------------

function storeOpen() {
  const t = hallwayOpen();
  door(t.g, 'departmentStore').open();
  t.tick(120);
  t.g.zombies.clear();
  return t;
}
const inStore = (b) => b.min.x >= r.minX - 0.01 && b.max.x <= r.maxX + 0.01 && b.min.z >= r.minZ - 0.01 && b.max.z <= r.maxZ + 0.01;

test('lanes: a lap round the room, between the racks and down both sides stays open floor with clear straight runs', () => {
  const t = storeOpen();
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(-12.6, 0, 7.5), yaw: 0 });
  t.tick(30);
  const nav = g.zombies.nav;
  // The west aisle, the back (past the fitting rooms and the layaway counter), the east lane, the front (past the counters)
  const lap = [[-18.6, 8], [-18.6, 13.5], [-18.6, 20.4], [-14.6, 20.4], [-9.5, 20.4], [-6.6, 20.4], [-6.6, 16.9], [-6.6, 12], [-6.6, 8], [-12.6, 8]];
  for (let i = 0; i < lap.length; i++) {
    const [x, z] = lap[i];
    const [nx, nz] = lap[(i + 1) % lap.length];
    assert.ok(nav.isWalkableAt(x, z, 0), `lap point (${x}, ${z})`);
    assert.ok(nav.clearLine(x, z, nx, nz, 0), `straight run (${x}, ${z}) -> (${nx}, ${nz})`);
  }
  // Crossings between the racks (north-south and east-west)
  for (const [[x, z], [nx, nz]] of [[[-14.6, 13], [-14.6, 20.4]], [[-10.6, 13], [-10.6, 20.4]], [[-18.6, 16.9], [-6.6, 16.9]]]) {
    assert.ok(nav.clearLine(x, z, nx, nz, 0), `crossing (${x}, ${z}) -> (${nx}, ${nz})`);
  }
  // Behind the layaway counter, in front of the stockroom door, is reachable
  assert.ok(Number.isFinite(nav.distanceToTarget(-11.9, 24, 0)));
});

test('the cosmetics, fragrance and layaway counters are real vaults from both sides', () => {
  const t = storeOpen();
  const { g } = t;
  for (const c of [...DS.counters, DS.layaway]) {
    const x = (c.x0 + c.x1) / 2;
    for (const dir of [1, -1]) {
      t.standAt(x, c.z - dir * 1.3, dir > 0 ? 180 : 0);
      g.player.velocity.set(0, 0, dir * 5);
      assert.equal(g.player.vault.tryStart(), true, `vault the counter at z ${c.z} going ${dir > 0 ? 'north' : 'south'} (${g.player.vault.lastResult})`);
      let ticks = 0;
      while (g.player.vault.active && ticks++ < 90) t.tick();
      assert.ok(ticks < 90 && dir * (g.player.position.z - c.z) > 0.4, 'landed on the other side');
      assert.ok(Math.abs(g.player.position.y) < 0.01);
    }
  }
});

test('nothing to perch on: every exposed top is a step, a vaultable counter, or out of reach even from a counter', () => {
  const { g } = storeOpen();
  const standing = g.colliders.filter((b) => inStore(b) && b.min.y < 0.05 && b.max.y > 0.05 && b.max.y < DS.height);
  assert.ok(DS.tallMinHeight > DS.counterHeight + 1.05, 'a jump from a counter top (about 2.0 m) cannot reach a tall top');
  for (const b of standing) {
    for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) {
      const x = b.min.x + 0.05 + ((b.max.x - b.min.x - 0.1) * i) / 4;
      const z = b.min.z + 0.05 + ((b.max.z - b.min.z - 0.1) * j) / 4;
      // The top here: climb up through every collider stacked on this point
      let top = b.max.y;
      for (let pass = 0; pass < 4; pass++) {
        for (const c of g.colliders) {
          if (x > c.min.x && x < c.max.x && z > c.min.z && z < c.max.z && c.min.y <= top + 0.01 && c.max.y > top) top = c.max.y;
        }
      }
      const ok = top <= 0.35 || (top <= feel.vault.maxHeight && b.vaultable) || top >= DS.tallMinHeight;
      assert.ok(ok, `a perch at (${x.toFixed(2)}, ${z.toFixed(2)}) ${top.toFixed(2)} m up`);
    }
  }
});

test('sprint-jumping from the counter tops at the racks and mannequins never lands you on them', () => {
  const t = storeOpen();
  const { g } = t;
  // From each counter's top, run and jump toward the nearest rack / mannequin
  const tries = [
    [-13.1, DS.counters[0].z, Math.PI], [-9.1, DS.counters[1].z, Math.PI], [-11.9, DS.layaway.z, 0],
    [-12.0, DS.counters[0].z, Math.PI * 0.75], [-14.2, DS.counters[0].z, -Math.PI * 0.85],
  ];
  for (const [x, z, yaw] of tries) {
    g.player.teleport({ position: new THREE.Vector3(x, DS.counterHeight, z), yaw });
    t.tick(2);
    for (let i = 0; i < 3; i++) { g.player.input.pressed.add('Space'); hold(t, ['KeyW', 'ShiftLeft'], 0.45); }
    t.tick(60);
    assert.ok(g.player.position.y < DS.counterHeight + 0.01, `ended ${g.player.position.y.toFixed(2)} m up at (${g.player.position.x.toFixed(1)}, ${g.player.position.z.toFixed(1)})`);
  }
  // And from the floor at the fitting rooms, the shoe wall and a mannequin plinth
  for (const [x, z, yaw] of [[-17.1, 21.2, Math.PI], [-7.6, 21.6, -Math.PI / 2], [-15.6, 11.6, Math.PI / 2]]) {
    g.player.teleport({ position: new THREE.Vector3(x, 0, z), yaw });
    for (let i = 0; i < 4; i++) { g.player.input.pressed.add('Space'); hold(t, ['KeyW', 'ShiftLeft'], 0.4); }
    t.tick(60);
    assert.ok(g.player.position.y < 0.31, `still on the floor (or a plinth) at (${g.player.position.x.toFixed(1)}, ${g.player.position.z.toFixed(1)})`);
  }
});

test('a 12-zombie horde from the back of the store reaches a player in the hallway', (ctx) => {
  const t = storeOpen();
  const { g } = t;
  const target = new THREE.Vector3(gateX, 0, 2.2);
  g.player.teleport({ position: target, yaw: 0 });
  t.tick(20);
  const horde = [];
  for (let i = 0; i < 12; i++) {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(-16.5 + (i % 6) * 1.9, 0, i < 6 ? 20.6 : 23.2));
    z.position.y = 0; z.prevPosition.copy(z.position); z.setState('chasing'); z.updateHitboxes();
    horde.push(z);
  }
  const arrived = new Map();
  for (let i = 0; i < 60 * 45 && arrived.size < horde.length; i++) {
    g.player.teleport({ position: target, yaw: 0 });
    t.tick();
    for (const z of horde) if (!arrived.has(z) && Math.hypot(z.position.x - target.x, z.position.z - target.z) < 3) arrived.set(z, i / 60);
    for (const z of horde) assert.ok(z.position.y < 0.5, 'nobody climbs anything');
  }
  assert.equal(arrived.size, 12, `stuck: ${horde.filter((z) => !arrived.has(z)).map((z) => z.position.toArray().map((v) => v.toFixed(1)))}`);
  ctx.diagnostic(`12-zombie horde: all arrive in ${Math.min(...arrived.values()).toFixed(1)}-${Math.max(...arrived.values()).toFixed(1)} s`);
});
