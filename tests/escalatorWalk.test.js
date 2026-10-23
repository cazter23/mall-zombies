// The escalator is a real way up (once its barrier is gone): a real player walks up and down it, zombies path up and down it
// through the real navigation, and nobody can climb it while the barrier is up. Built on the real mall in the real game.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { LAYOUT } from '../src/maps/mall/mall.js';

const E = LAYOUT.escalator;
const UPPER_Y = LAYOUT.hallway.height + 0.3; // level 2's floor: the top of the hallway ceiling slab
const zMid = (E.minZ + E.maxZ) / 2;

// A started game with every door open, no waves, the player hurt-proof; optionally with the escalator "repaired" (barrier gone).
function fixture({ repaired }) {
  const t = headlessGame();
  t.tick(1);
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.g.debug.run('doors'); // (opens every door, the escalator repair too: put that one back to what this test wants)
  t.g.debug.run('god');
  const repair = t.g.map.doors.find((d) => d.id === 'escalatorRepair');
  if (!repaired) repair.reset();
  t.tick(120);
  assert.equal(t.g.colliders.includes(t.g.map.escalator.barrier), !repaired, 'the barrier stands exactly while it is not repaired');
  return t;
}
// Hold a movement key for `seconds` (the real Input), then release.
function hold(t, keys, seconds) {
  for (const k of keys) t.g.player.input.held.add(k);
  t.tick(Math.round(seconds * 60));
  for (const k of keys) t.g.player.input.held.delete(k);
}

test('barrier up: a sprinting, jumping player gets nowhere near the top', () => {
  const t = fixture({ repaired: false });
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(E.bottomX + 3, 0, zMid), yaw: Math.PI / 2 }); // facing -X, at the foot
  for (const k of ['KeyW', 'ShiftLeft']) g.player.input.held.add(k);
  let maxY = 0;
  for (let i = 0; i < 60 * 5; i++) {
    if (i % 20 === 0) g.player.input.pressed.add('Space');
    t.tick(1);
    maxY = Math.max(maxY, g.player.position.y);
  }
  assert.ok(maxY < 1.3, `never got higher than a jump (${maxY.toFixed(2)} m)`);
  assert.ok(g.player.position.x > E.bottomX - 0.2, `stopped at the barrier (x ${g.player.position.x.toFixed(2)})`);
});

test('repaired: a player walks up to level 2 and back down', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(E.bottomX + 2.5, 0, zMid), yaw: Math.PI / 2 });
  hold(t, ['KeyW', 'ShiftLeft'], 4);
  assert.ok(Math.abs(g.player.position.y - UPPER_Y) < 0.02, `on level 2 (y ${g.player.position.y.toFixed(2)})`);
  assert.ok(g.player.position.x < -15, `at the top end (x ${g.player.position.x.toFixed(1)})`);
  assert.equal(g.player.grounded, true);

  hold(t, ['KeyS'], 0.5); // (turn round: walk back, still facing west)
  g.player.teleport({ position: g.player.position.clone(), yaw: Math.PI / 2 });
  hold(t, ['KeyS'], 9);
  assert.ok(g.player.position.y < 0.01, `back on the ground (y ${g.player.position.y.toFixed(2)})`);
  assert.ok(g.player.position.x > E.bottomX - 0.3, `at the foot (x ${g.player.position.x.toFixed(1)})`);
});

test('repaired: walking east under the high end still keeps you on the ground', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  g.player.teleport({ position: new THREE.Vector3(-19, 0, zMid), yaw: -Math.PI / 2 });
  hold(t, ['KeyW'], 3);
  assert.ok(g.player.position.x > -12 && g.player.position.x < -8, `walked under it (x ${g.player.position.x.toFixed(1)})`);
  assert.equal(g.player.position.y, 0, 'on the ground, not lifted onto the ramp above');
});

test('repaired: a zombie climbs the escalator to a player upstairs', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  const parked = new THREE.Vector3(-17.3, UPPER_Y, zMid);
  g.player.teleport({ position: parked, yaw: -Math.PI / 2 });
  t.tick(30);
  const z = g.zombies.spawn('shopper', new THREE.Vector3(2, 0, zMid));
  assert.ok(z, 'spawned');
  let reached = null;
  for (let i = 0; i < 60 * 40 && reached === null; i++) {
    g.player.teleport({ position: parked, yaw: -Math.PI / 2 }); // (keep the player there)
    t.tick(1);
    if (z.position.y > UPPER_Y - 0.3 && Math.hypot(z.position.x - parked.x, z.position.z - parked.z) < 2) reached = i / 60;
  }
  assert.notEqual(reached, null, `reached level 2 (ended at ${z.position.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(reached < 25, `in a reasonable time (${reached?.toFixed(1)} s)`);
});

test('repaired: a zombie upstairs comes down the escalator to a player on the ground', () => {
  const t = fixture({ repaired: true });
  const { g } = t;
  const spot = new THREE.Vector3(2, 0, zMid);
  g.player.teleport({ position: spot, yaw: Math.PI / 2 });
  t.tick(30);
  const z = g.zombies.spawn('shopper', new THREE.Vector3(2, 0, zMid + 3));
  z.position.set(-17.3, UPPER_Y, zMid); // it rose upstairs
  z.prevPosition.copy(z.position);
  let reached = null;
  for (let i = 0; i < 60 * 40 && reached === null; i++) {
    g.player.teleport({ position: spot, yaw: Math.PI / 2 });
    t.tick(1);
    if (z.position.y < 0.3 && Math.hypot(z.position.x - spot.x, z.position.z - spot.z) < 2) reached = i / 60;
  }
  assert.notEqual(reached, null, `reached the ground (ended at ${z.position.toArray().map((v) => v.toFixed(1))})`);
});

test('barrier up: a zombie does not path to a player upstairs (no route yet) and stays on the ground', () => {
  const t = fixture({ repaired: false });
  const { g } = t;
  const parked = new THREE.Vector3(-17.3, UPPER_Y, zMid);
  g.player.teleport({ position: parked, yaw: -Math.PI / 2 });
  t.tick(30);
  const z = g.zombies.spawn('shopper', new THREE.Vector3(2, 0, zMid));
  for (let i = 0; i < 60 * 15; i++) {
    g.player.teleport({ position: parked, yaw: -Math.PI / 2 });
    t.tick(1);
  }
  assert.ok(z.position.y < 0.3, `still on the ground floor (y ${z.position.y.toFixed(2)})`);
});

test('the repair is a normal purchase: a real F hold at the foot costs 2000, opens level 2 and the way up; Play again seals it again', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.doors.find((d) => d.id === 'startShutter').open(); // (the hallway is open; everything else is not)
  const foot = g.map.escalator.barrier;
  const stand = new THREE.Vector3(E.bottomX + 1.4, 0, zMid);
  g.player.teleport({ position: stand, yaw: Math.PI / 2 }); // facing the foot of the escalator (west)
  t.tick(5);
  assert.equal(g.map.zones.upstairs.open, false);
  assert.equal(g.interactions.prompt?.label, 'Escalator');
  assert.equal(g.interactions.prompt?.verb, 'repair');
  assert.equal(g.interactions.prompt?.cost, 2000);

  const hiddenBefore = new Set(g.map.group.children.filter((c) => c.visible === false)); // (debug markers and such)
  g.wallet.earn(1000); // 1500 in total: not enough
  t.press('KeyF', 40);
  assert.equal(g.map.zones.upstairs.open, false, 'too poor: still broken');
  assert.ok(g.colliders.includes(foot));

  g.wallet.earn(1000);
  const before = g.wallet.points;
  t.press('KeyF', 40);
  assert.equal(before - g.wallet.points, 2000);
  assert.equal(g.map.zones.upstairs.open, true, 'level 2 is open');
  assert.ok(!g.colliders.includes(foot), 'the barrier is gone');
  assert.equal(g.interactions.prompt, null, 'nothing left to repair');
  const bits = g.map.group.children.filter((c) => c.visible === false && !hiddenBefore.has(c));
  assert.ok(bits.length >= 4, 'the rope, posts and OUT OF ORDER board are hidden');

  g.resetRun();
  assert.equal(g.map.zones.upstairs.open, false);
  assert.ok(g.colliders.includes(foot), 'the barrier is back after Play again');
  assert.ok(bits.every((c) => c.visible), 'and the rope, posts and board are back');
});
