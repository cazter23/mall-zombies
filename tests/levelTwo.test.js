// Level 2 (the Sunset Promenade, maps/mall/levelTwo.js) in the real game: closed in, fenced round the escalator well, every vent
// a working zombie spawn that is sealed until the escalator is repaired, a walkway you can cross, and zombies that come down.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { LAYOUT } from '../src/maps/mall/mall.js';

const H = LAYOUT.hallway;
const L2 = LAYOUT.level2;
const UPPER_Y = H.height + 0.3;
const zMid = (LAYOUT.escalator.minZ + LAYOUT.escalator.maxZ) / 2;

// A started game, no waves, hurt-proof, every door open; the escalator repaired or not.
function fixture({ repaired }) {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.g.debug.run('doors');
  t.g.debug.run('god');
  if (!repaired) t.g.map.doors.find((d) => d.id === 'escalatorRepair').reset();
  t.tick(120);
  return t;
}
function hold(t, keys, seconds) {
  for (const k of keys) t.g.player.input.held.add(k);
  t.tick(Math.round(seconds * 60));
  for (const k of keys) t.g.player.input.held.delete(k);
}
const contains = (colliders, x, y, z) => colliders.some((b) => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z);

test('level 2 is closed in: four walls, a roof, and a floor you can stand on', () => {
  const { g } = fixture({ repaired: true });
  const walls = [[0, H.maxZ + 0.15], [0, H.minZ - 0.15], [H.minX - 0.15, 2], [H.maxX + 0.15, 2]];
  for (const [x, z] of walls) for (const y of [UPPER_Y + 0.5, UPPER_Y + 3]) assert.ok(contains(g.colliders, x, y, z), `wall at (${x}, ${y.toFixed(1)}, ${z})`);
  assert.ok(contains(g.colliders, 0, UPPER_Y + L2.height + 0.15, 2), 'roof');
  assert.ok(contains(g.colliders, 0, UPPER_Y - 0.1, 2), 'the slab is the floor');
});

test('railings fence the escalator well on three sides: they are too tall to jump, shots go through them', () => {
  const { g } = fixture({ repaired: true });
  const hole = { minX: -16.5, maxX: -11.95 };
  const rails = g.colliders.filter((b) => b.ignoreShots && Math.abs(b.min.y - UPPER_Y) < 1e-6);
  assert.equal(rails.length, 3, 'south, north and east');
  for (const b of rails) assert.ok(b.max.y - UPPER_Y >= 1.4, 'taller than a jump (about 1.05 m)');
  assert.ok(rails.every((b) => b.min.x > hole.minX - 0.5 && b.max.x < hole.maxX + 0.5), 'round the well');
});

test('nobody falls into the well: walking at its east end and its two sides stops at the rail', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  // From the east, heading west along the well's line
  g.player.teleport({ position: new THREE.Vector3(-8, UPPER_Y, zMid), yaw: Math.PI / 2 });
  hold(t, ['KeyW', 'ShiftLeft'], 3);
  assert.equal(g.player.position.y, UPPER_Y, 'still on level 2');
  assert.ok(g.player.position.x > -11.5, `stopped at the east rail (x ${g.player.position.x.toFixed(2)})`);
  // From the north passage, heading south (yaw 0 faces -Z) at the north rail
  g.player.teleport({ position: new THREE.Vector3(-14, UPPER_Y, 5), yaw: 0 });
  hold(t, ['KeyW', 'ShiftLeft'], 3);
  assert.equal(g.player.position.y, UPPER_Y);
  assert.ok(g.player.position.z > 3.3, `stopped at the north rail (z ${g.player.position.z.toFixed(2)})`);
  // From the south passage, heading north (yaw PI faces +Z)
  g.player.teleport({ position: new THREE.Vector3(-14, UPPER_Y, -1), yaw: Math.PI });
  hold(t, ['KeyW', 'ShiftLeft'], 3);
  assert.equal(g.player.position.y, UPPER_Y);
  assert.ok(g.player.position.z < 0.7, `stopped at the south rail (z ${g.player.position.z.toFixed(2)})`);
});

test('the walkway is open end to end, and the planter is solid', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(-19, UPPER_Y, 4.5), yaw: 0 });
  t.tick(30);
  const nav = g.zombies.nav;
  for (const [x, z] of [[-19, 2], [-19, 5], [-14, 5], [-14, -1], [-8, 1], [0, 1], [8, 4.5], [13, 3.9], [13, -1], [19, 2]]) {
    assert.ok(Number.isFinite(nav.distanceToTarget(x, z, UPPER_Y)), `(${x}, ${z}) reachable on level 2`);
  }
  const { planterX, planterZ } = L2.seating;
  assert.equal(nav.isWalkableAt(planterX, planterZ, UPPER_Y), false, 'the planter is not floor');
  assert.equal(nav.isWalkableAt(-14, 2, UPPER_Y), false, 'neither is the well');
});

test('every vent is a spawn on level 2: on the floor, on open ground, away from the walls', () => {
  const { g } = fixture({ repaired: true });
  const spawns = g.map.spawnPoints.filter((s) => s.zone === 'upstairs');
  assert.equal(spawns.length, L2.vents.length);
  for (const s of spawns) {
    assert.equal(s.position.y, UPPER_Y, `${s.name} stands on level 2`);
    assert.ok(contains(g.colliders, s.position.x, UPPER_Y - 0.1, s.position.z), `${s.name} has floor under it`);
    const body = new THREE.Box3(
      new THREE.Vector3(s.position.x - 0.4, UPPER_Y + 0.1, s.position.z - 0.4),
      new THREE.Vector3(s.position.x + 0.4, UPPER_Y + 1.8, s.position.z + 0.4),
    );
    assert.ok(!g.colliders.some((b) => b.intersectsBox(body)), `${s.name} is not inside anything`);
  }
});

test('sealed until repaired: with everything else open, no zombie ever spawns upstairs', () => {
  const t = fixture({ repaired: false });
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(0, 0, 2), yaw: 0 });
  t.tick(30);
  assert.equal(g.map.zones.upstairs.open, false);
  for (let i = 0; i < 60; i++) {
    g.zombies.clear();
    const z = g.zombies.spawn('shopper');
    assert.ok(z && z.position.y < 0.5, 'spawned on the ground floor');
  }
});

test('repaired: zombies spawn from the vents upstairs and come down the escalator to a player below', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  const spot = new THREE.Vector3(2, 0, zMid);
  g.player.teleport({ position: spot, yaw: Math.PI / 2 });
  t.tick(30);
  let upstairs = 0;
  for (let i = 0; i < 200; i++) {
    g.zombies.clear();
    const z = g.zombies.spawn('shopper');
    if (z && Math.abs(z.position.y - UPPER_Y) < 0.01) upstairs++;
  }
  assert.ok(upstairs < 40, `spawns stay local to a player on the ground floor (${upstairs} of 200 upstairs)`);

  // A player upstairs gets the upstairs vents (local spawning picks the cheapest routes).
  const player = new THREE.Vector3(0, UPPER_Y, 1);
  g.player.teleport({ position: player, yaw: 0 });
  t.tick(30);
  let near = 0;
  for (let i = 0; i < 100; i++) {
    g.zombies.clear();
    const z = g.zombies.spawn('shopper');
    if (z && Math.abs(z.position.y - UPPER_Y) < 0.01) near++;
  }
  assert.ok(near > 80, `a player on level 2 is spawned on by its vents (${near} of 100)`);
  g.player.teleport({ position: spot, yaw: Math.PI / 2 });
  t.tick(30);

  // One from each vent walks down to the player.
  for (const vent of g.map.spawnPoints.filter((s) => s.zone === 'upstairs')) {
    g.zombies.clear();
    const z = g.zombies.spawn('shopper', vent.position.clone());
    z.position.y = UPPER_Y; // (an explicit spawn puts it on the ground; it rose upstairs)
    z.prevPosition.copy(z.position);
    let reached = null;
    for (let i = 0; i < 60 * 45 && reached === null; i++) {
      g.player.teleport({ position: spot, yaw: Math.PI / 2 });
      t.tick(1);
      if (z.position.y < 0.3 && Math.hypot(z.position.x - spot.x, z.position.z - spot.z) < 2) reached = i / 60;
    }
    assert.notEqual(reached, null, `${vent.name} -> the ground floor (ended at ${z.position.toArray().map((v) => v.toFixed(1))})`);
  }
});

test('repaired: a player upstairs is reached by a zombie spawned there', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  const player = new THREE.Vector3(-19, UPPER_Y, 2);
  g.player.teleport({ position: player, yaw: -Math.PI / 2 });
  t.tick(30);
  const vent = g.map.spawnPoints.find((s) => s.name === 'spawn_upstairs_northEast');
  const z = g.zombies.spawn('shopper', vent.position.clone());
  z.position.y = UPPER_Y;
  z.prevPosition.copy(z.position);
  let reached = null;
  for (let i = 0; i < 60 * 30 && reached === null; i++) {
    g.player.teleport({ position: player, yaw: -Math.PI / 2 });
    t.tick(1);
    if (Math.hypot(z.position.x - player.x, z.position.z - player.z) < 2) reached = i / 60;
  }
  assert.notEqual(reached, null, `walked across level 2 (ended at ${z.position.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(Math.abs(z.position.y - UPPER_Y) < 0.05, 'and stayed on it');
});

test('Play again seals level 2 and its spawns again', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  assert.equal(g.map.zones.upstairs.open, true);
  g.resetRun();
  assert.equal(g.map.zones.upstairs.open, false);
});

test('a zombie coming along either passage gets onto the escalator whatever its lane (no pinning on the side wall)', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  const spot = new THREE.Vector3(2, 0, zMid);
  g.player.teleport({ position: spot, yaw: Math.PI / 2 });
  t.tick(30);
  for (const [sx, sz] of [[-14, 5], [-14, -1], [-10, 4.4]]) {
    for (const lane of [-1, 0.5, 1]) {
      g.zombies.clear();
      const z = g.zombies.spawn('shopper', new THREE.Vector3(sx, 0, sz));
      z.position.y = UPPER_Y;
      z.prevPosition.copy(z.position);
      z.laneOffset = lane;
      let down = false;
      for (let i = 0; i < 60 * 14 && !down; i++) {
        g.player.teleport({ position: spot, yaw: Math.PI / 2 });
        t.tick(1);
        down = z.position.y < 5;
      }
      assert.ok(down, `from (${sx}, ${sz}) with lane ${lane}: still upstairs at ${z.position.toArray().map((v) => v.toFixed(1))}`);
    }
  }
});
