// The cone attack (weapons/coneBlast.js, used by the Leaf Blower): who is inside the cone, what the blast does to one zombie, and the hit-point ledger.
// The first part uses bare targets and walls; the last blows real zombies from the headless game across the hallway.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { findInCone, blowAway, createBlastPay } from '../src/weapons/coneBlast.js';
import { headlessGame } from './helpers/headlessGame.js';

const cone = { range: 7, halfAngleDegrees: 28, targetRadius: 0.35, knockback: 8, farFraction: 0.4, staggerSeconds: 0.35, drag: 2.2, mascotScale: 0.5,
  knockdownRange: 3.5, knockdownSeconds: 1, knockdownDrag: 1.6 };
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const origin = v(0, 1.5, 0);
const ahead = v(0, 0, -1); // yaw 0 faces -Z
// A bare target: a body box 0.6 x 1.2 x 0.6 standing at (x, z).
const target = (x, z, extra = {}) => ({ isAlive: true, hitboxes: [{ part: 'body', box: new THREE.Box3(v(x - 0.3, 0.2, z - 0.3), v(x + 0.3, 1.4, z + 0.3)) }], ...extra });

test('findInCone: in range and inside the angle only, nearest first', () => {
  const near = target(0, -3), far = target(0, -6), tooFar = target(0, -8), side = target(5, -3), behind = target(0, 3);
  const found = findInCone(origin, ahead, cone, [], [far, behind, side, tooFar, near]);
  assert.deepEqual(found.map((f) => f.target), [near, far]);
  assert.ok(found[0].distance < found[1].distance);
});

test('findInCone: the cone has an angle (28 degrees each side), and a wide body at the very edge still counts', () => {
  const at = (degrees) => target(Math.tan(degrees * Math.PI / 180) * 4, -4);
  assert.equal(findInCone(origin, ahead, cone, [], [at(20)]).length, 1);
  assert.equal(findInCone(origin, ahead, cone, [], [at(45)]).length, 0);
  assert.equal(findInCone(origin, ahead, cone, [], [at(31)]).length, 1, 'just outside the angle, but its body overlaps the edge');
  assert.equal(findInCone(origin, ahead, { ...cone, targetRadius: 0 }, [], [at(31)]).length, 0);
});

test('findInCone: dead targets are skipped, and a wall between blocks the blast (an ignoreShots box does not)', () => {
  const dead = target(0, -3, { isAlive: false }), alive = target(0, -5), behindWall = target(0.5, -6);
  const wall = new THREE.Box3(v(-2, 0, -5.5), v(2, 3, -5.4));
  assert.deepEqual(findInCone(origin, ahead, cone, [wall], [dead, alive, behindWall]).map((f) => f.target), [alive]);
  wall.ignoreShots = true; // (a walk-blocker that bullets pass: so does the wind)
  assert.equal(findInCone(origin, ahead, cone, [wall], [alive, behindWall]).length, 2);
});

// A zombie double: records what it was asked to do.
function fakeZombie({ mascot = false, slipping = false, refuses = false } = {}) {
  const calls = [];
  return {
    calls, type: { mascot }, slipTimer: slipping ? 1 : 0,
    staggerAway(from, tuning) { calls.push(['stagger', tuning]); return !refuses; },
    applySlip(seconds, drag) { calls.push(['slip', seconds, drag]); return true; },
  };
}

test('blowAway: shoves back harder up close, lays a close zombie down, and only shoves a far one', () => {
  const close = fakeZombie(), far = fakeZombie();
  assert.deepEqual(blowAway(close, origin, cone, 0.5), { pushed: true, knockedDown: true });
  assert.deepEqual(blowAway(far, origin, cone, 6), { pushed: true, knockedDown: false });
  const kb = (z) => z.calls.find((c) => c[0] === 'stagger')[1].knockback;
  assert.ok(kb(close) > kb(far), 'stronger up close');
  assert.ok(kb(far) >= cone.knockback * cone.farFraction - 1e-9, 'never weaker than the far fraction');
  assert.deepEqual(close.calls.find((c) => c[0] === 'slip').slice(1), [cone.knockdownSeconds, cone.knockdownDrag]);
  assert.equal(far.calls.some((c) => c[0] === 'slip'), false);
});

test('blowAway: a Mascot is shoved gently, a zombie already sliding is left alone, a refusing target (a boss) and a non-zombie do nothing', () => {
  const plain = fakeZombie(), mascot = fakeZombie({ mascot: true });
  blowAway(plain, origin, cone, 2);
  blowAway(mascot, origin, cone, 2);
  const kb = (z) => z.calls[0][1].knockback;
  assert.ok(Math.abs(kb(mascot) - kb(plain) * cone.mascotScale) < 1e-9);
  const down = fakeZombie({ slipping: true });
  assert.deepEqual(blowAway(down, origin, cone, 1), { pushed: false, knockedDown: false });
  assert.equal(down.calls.length, 0, 'a fresh stagger would cut its fall short');
  const boss = fakeZombie({ refuses: true });
  assert.deepEqual(blowAway(boss, origin, cone, 1), { pushed: false, knockedDown: false });
  assert.equal(boss.calls.some((c) => c[0] === 'slip'), false, 'no knockdown when the push was refused');
  assert.deepEqual(blowAway({ isAlive: true, hitboxes: [] }, origin, cone, 1), { pushed: false, knockedDown: false });
});

test('createBlastPay: the first pulse on a zombie pays, then only every N pulses; each zombie has its own clock; reset forgets', () => {
  const pay = createBlastPay(4), a = {}, b = {};
  const paid = [];
  for (let i = 0; i < 9; i++) {
    pay.pulse();
    paid.push(pay.take(a));
    if (i === 2) paid.push(pay.take(b));
  }
  assert.deepEqual(paid, [true, false, false, true, false, true, false, false, false, true]);
  pay.reset();
  pay.pulse();
  assert.equal(pay.take(a), true);
});

test('real zombies: a blast pushes a close and a far Shopper back down the hallway', (t) => {
  const game = headlessGame(), { g } = game;
  t.after(() => g.map.dispose());
  game.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.player.teleport({ position: v(-2, 0, 0.5), yaw: -Math.PI / 2 }); // the hallway, facing east down its clear middle
  game.tick();
  const eye = new THREE.Vector3();
  const aim = new THREE.Vector3();
  g.player.getAim(eye, aim);
  aim.y = 0;
  aim.normalize();
  const spawn = (metres) => g.zombies.spawn('shopper', new THREE.Vector3(eye.x + aim.x * metres, 0, eye.z + aim.z * metres));
  const first = spawn(2), second = spawn(5.5);
  assert.ok(first && second, 'both spawned');
  game.tick(200); // (let them finish rising, and walk a little)
  const eyeNow = new THREE.Vector3();
  const aimNow = new THREE.Vector3();
  g.player.getAim(eyeNow, aimNow);
  const hits = findInCone(eyeNow, aimNow, { ...cone, range: 20 }, g.colliders, g.shootables).filter((h) => h.target === first || h.target === second);
  assert.equal(hits.length, 2, 'both Shoppers are in the cone');
  const before = hits.map((h) => h.target.position.clone());
  const results = hits.map((h) => blowAway(h.target, eyeNow, cone, h.distance));
  assert.ok(results.every((r) => r.pushed), 'both were pushed');
  game.tick(20);
  hits.forEach((h, i) => {
    const away = h.target.position.clone().sub(before[i]).dot(aimNow);
    assert.ok(away > 0.3, `${i} was blown away from the player (${away.toFixed(2)} m)`);
  });
});
