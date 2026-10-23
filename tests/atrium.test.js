// The Grand Atrium (maps/mall/atrium.js) in the real game: its 1500 gate off the hallway, sealed until bought, the open court
// round the fountain, the upper ring with its railings, the second escalator, and the shutter link to the level 2 Promenade.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { LAYOUT } from '../src/maps/mall/mall.js';

const AT = LAYOUT.atrium;
const A = AT.rect;
const UPPER_Y = LAYOUT.hallway.height + 0.3;
const d = AT.ringDepth;
const court = { minX: A.minX + d, maxX: A.maxX - d, minZ: A.minZ + d, maxZ: A.maxZ - d };
const cx = (court.minX + court.maxX) / 2;
const cz = (court.minZ + court.maxZ) / 2;
const contains = (colliders, x, y, z) => colliders.some((b) => x > b.min.x && x < b.max.x && y > b.min.y && y < b.max.y && z > b.min.z && z < b.max.z);

function started() {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.g.debug.run('god');
  return t;
}
function everythingOpen() {
  const t = started();
  t.g.debug.run('doors');
  t.tick(120);
  return t;
}
function hold(t, keys, seconds) {
  for (const k of keys) t.g.player.input.held.add(k);
  t.tick(Math.round(seconds * 60));
  for (const k of keys) t.g.player.input.held.delete(k);
}
const door = (g, id) => g.map.doors.find((dd) => dd.id === id);
const spawns = (g) => g.map.spawnPoints.filter((s) => s.zone === 'atrium');

test('the gate is a normal 1500 purchase from the hallway: a real F hold opens the atrium; Play again seals it', () => {
  const t = started();
  const { g } = t;
  door(g, 'startShutter').open();
  t.tick(120);
  g.wallet.earn(2000);
  const gate = door(g, 'atrium');
  t.standAt((AT.gate.from + AT.gate.to) / 2, LAYOUT.hallway.maxZ - 1.4, 180); // in the hallway, facing north (+Z)
  t.tick(5);
  assert.equal(g.interactions.prompt?.label, 'Grand Atrium');
  assert.equal(g.interactions.prompt?.cost, 1500);
  const before = g.wallet.points;
  t.press('KeyF', 40);
  assert.equal(before - g.wallet.points, 1500);
  assert.equal(g.map.zones.atrium.open, true);
  assert.equal(gate.isOpen, true);
  g.resetRun();
  assert.equal(g.map.zones.atrium.open, false);
  assert.equal(gate.isOpen, false);
});

test('sealed until its gate is bought: no route in, no spawns; after: every vent is reachable, the ring one by the escalator', () => {
  const t = started();
  const { g } = t;
  door(g, 'startShutter').open();
  g.player.teleport({ position: new THREE.Vector3(15, 0, 3), yaw: 0 });
  t.tick(120);
  const nav = g.zombies.nav;
  for (const s of spawns(g)) assert.equal(nav.distanceToTarget(s.position.x, s.position.z, s.position.y), Infinity, `${s.name} sealed`);
  for (let i = 0; i < 40; i++) {
    g.zombies.clear();
    const z = g.zombies.spawn('shopper');
    assert.ok(!z || !(z.position.x > A.minX && z.position.z > A.minZ), 'nothing spawns in the atrium while it is closed');
  }
  door(g, 'atrium').open();
  t.tick(120);
  assert.equal(spawns(g).length, AT.vents.length);
  for (const s of spawns(g)) {
    assert.ok(Number.isFinite(nav.distanceToTarget(s.position.x, s.position.z, s.position.y)), `${s.name} reachable`);
    assert.ok(contains(g.colliders, s.position.x, s.position.y - 0.1, s.position.z), `${s.name} has floor under it`);
    const body = new THREE.Box3(new THREE.Vector3(s.position.x - 0.4, s.position.y + 0.1, s.position.z - 0.4), new THREE.Vector3(s.position.x + 0.4, s.position.y + 1.8, s.position.z + 0.4));
    assert.ok(!g.colliders.some((b) => b.intersectsBox(body)), `${s.name} is not inside anything`);
  }
  assert.ok(spawns(g).some((s) => s.position.y === UPPER_Y), 'one vent is up on the ring');
});

test('the court is open for running loops: round the fountain, the arcade, under and round the escalator', () => {
  const t = everythingOpen();
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(cx, 0, A.minZ + 1.5), yaw: 0 });
  t.tick(30);
  const nav = g.zombies.nav;
  // A lap round the fountain (and the benches): every point on the loop is open floor with no wall in the way of the next
  const lap = [[14.6, 15.0], [20, 15.0], [25.4, 15.0], [25.4, 18.6], [25.4, 22.4], [20, 22.4], [14.6, 22.4], [14.6, 18.6]];
  for (let i = 0; i < lap.length; i++) {
    const [x, z] = lap[i];
    const [nx, nz] = lap[(i + 1) % lap.length];
    assert.ok(nav.isWalkableAt(x, z, 0), `lap point (${x}, ${z})`);
    assert.ok(nav.clearLine(x, z, nx, nz, 0), `straight run (${x}, ${z}) -> (${nx}, ${nz})`);
  }
  for (const [x, z] of [[A.minX + 1, A.minZ + 1], [A.maxX - 1, A.minZ + 1], [A.minX + 1, A.maxZ - 1], [A.maxX - 1, A.maxZ - 1], [26, 24.6], [cx, A.maxZ - 1.5]]) {
    assert.ok(Number.isFinite(nav.distanceToTarget(x, z, 0)), `(${x}, ${z}) reachable on the ground floor`);
  }
  assert.equal(nav.isWalkableAt(cx, cz, 0), false, 'the fountain is solid');
});

test('fountain and kiosks are cover, not platforms: sprint-jumping at them leaves you on the floor', () => {
  const t = everythingOpen();
  const { g } = t;
  for (const [x, z, yaw] of [[cx, AT.rect.minZ + 4.5, Math.PI], [cx + 6, cz, Math.PI / 2], [AT.kiosks[0].x, AT.kiosks[0].z - 2.5, Math.PI]]) { // (the middle one jumps off a bench)
    g.player.teleport({ position: new THREE.Vector3(x, 0, z), yaw });
    for (let i = 0; i < 4; i++) { g.player.input.pressed.add('Space'); hold(t, ['KeyW', 'ShiftLeft'], 0.4); }
    t.tick(60);
    assert.equal(g.player.position.y, 0, `still on the floor at (${g.player.position.x.toFixed(1)}, ${g.player.position.z.toFixed(1)})`);
  }
});

test('the ring: railed all round the court, nobody falls in from any side', () => {
  const t = everythingOpen();
  const { g } = t;
  const rails = g.colliders.filter((b) => b.ignoreShots && Math.abs(b.min.y - UPPER_Y) < 1e-6 && b.min.z > LAYOUT.hallway.maxZ);
  assert.ok(rails.length >= 6);
  for (const b of rails) assert.ok(b.max.y - UPPER_Y >= 1.4, 'taller than a jump');
  for (const [x, z, yaw] of [[cx, A.minZ + 1.5, Math.PI], [cx, A.maxZ - 1.5, 0], [A.minX + 1.5, cz, -Math.PI / 2], [A.maxX - 1.5, cz - 4, Math.PI / 2]]) {
    g.player.teleport({ position: new THREE.Vector3(x, UPPER_Y, z), yaw });
    for (let i = 0; i < 3; i++) { g.player.input.pressed.add('Space'); hold(t, ['KeyW', 'ShiftLeft'], 0.5); }
    t.tick(60);
    assert.equal(g.player.position.y, UPPER_Y, `still on the ring after running at the court from (${x}, ${z})`);
  }
});

test('the escalator: a player rides from the court up to the ring and back down', () => {
  const t = everythingOpen();
  const { g } = t;
  const E = AT.escalator;
  const zMid = (E.minZ + E.maxZ) / 2;
  g.player.teleport({ position: new THREE.Vector3(E.bottomX - 1.5, 0, zMid), yaw: -Math.PI / 2 }); // facing +X
  hold(t, ['KeyW', 'ShiftLeft'], 4);
  assert.ok(Math.abs(g.player.position.y - UPPER_Y) < 0.02, `on the ring (y ${g.player.position.y.toFixed(2)})`);
  assert.ok(g.player.position.x > E.bottomX + 13, `at the top (x ${g.player.position.x.toFixed(1)})`);
  g.player.teleport({ position: g.player.position.clone(), yaw: -Math.PI / 2 });
  hold(t, ['KeyS'], 9);
  assert.ok(g.player.position.y < 0.01, `back in the court (y ${g.player.position.y.toFixed(2)})`);
});

test('zombies use the atrium escalator both ways: from the ring vent down to the court, and up to a player on the ring', () => {
  const t = everythingOpen();
  const { g } = t;
  const chase = (from, target, seconds) => {
    g.player.teleport({ position: target, yaw: 0 });
    t.tick(30);
    g.zombies.clear();
    const z = g.zombies.spawn('shopper', from.clone());
    z.position.y = from.y;
    z.prevPosition.copy(z.position);
    for (let i = 0; i < 60 * seconds; i++) {
      g.player.teleport({ position: target, yaw: 0 });
      t.tick(1);
      if (Math.abs(z.position.y - target.y) < 0.3 && Math.hypot(z.position.x - target.x, z.position.z - target.z) < 2) return i / 60;
    }
    assert.fail(`never got there (ended at ${z.position.toArray().map((v) => v.toFixed(1))})`);
  };
  const ringVent = spawns(g).find((s) => s.position.y === UPPER_Y);
  assert.ok(chase(ringVent.position, new THREE.Vector3(cx - 6, 0, cz), 40) < 40);
  assert.ok(chase(new THREE.Vector3(cx - 6, 0, A.minZ + 1.5), new THREE.Vector3(cx, UPPER_Y, A.maxZ - 1.5), 40) < 40);
});

test('the Promenade link: a 1000 shutter buyable from either side, opening both the atrium and level 2, and walkable through', () => {
  const t = started();
  const { g } = t;
  const link = door(g, 'atriumPromenade');
  assert.equal(link.price, 1000);
  g.wallet.earn(5000);
  const mid = (AT.link.from + AT.link.to) / 2;
  for (const [z, yaw] of [[LAYOUT.hallway.maxZ - 1.2, Math.PI], [A.minZ + 1.2, 0]]) { // level 2 side facing +Z, then the ring side facing -Z
    g.resetRun();
    g.wallet.earn(5000);
    t.tick(2);
    g.player.teleport({ position: new THREE.Vector3(mid, UPPER_Y, z), yaw });
    t.tick(5);
    assert.equal(g.interactions.prompt?.label, 'Promenade', `prompt from z ${z}`);
    t.press('KeyF', 40);
    assert.equal(link.isOpen, true);
    assert.equal(g.map.zones.atrium.open, true);
    assert.equal(g.map.zones.upstairs.open, true);
  }
  t.tick(120); // (the shutter rolls up)
  g.player.teleport({ position: new THREE.Vector3(mid, UPPER_Y, LAYOUT.hallway.maxZ - 1.5), yaw: Math.PI }); // on the Promenade, facing the atrium
  hold(t, ['KeyW'], 1.5);
  assert.ok(g.player.position.z > A.minZ + 0.5, `walked through onto the ring (z ${g.player.position.z.toFixed(2)})`);
  assert.equal(g.player.position.y, UPPER_Y);
});

test('the atrium is out of reach from other floors: no buying the gate from level 2', () => {
  const t = everythingOpen();
  const { g } = t;
  door(g, 'atrium').reset();
  door(g, 'atriumPromenade').reset();
  t.tick(2);
  g.player.teleport({ position: new THREE.Vector3((AT.gate.from + AT.gate.to) / 2, UPPER_Y, LAYOUT.hallway.maxZ - 1.4), yaw: Math.PI });
  t.tick(5);
  assert.notEqual(g.interactions.prompt?.label, 'Grand Atrium');
});
