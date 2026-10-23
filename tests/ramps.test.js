// Walkable ramps (world/collision.js addRamp / rampHeightAt): a surface the feet follow, never a wall or a ceiling. A real
// 30-degree slope, walked up, walked down, jumped off, walked under, and switched off.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { moveAndCollide, addRamp, removeRamp, rampHeightAt, colliderSignature } from '../src/world/collision.js';
import { feel } from '../src/config/feel.js';

const dt = 1 / 60;
const RADIUS = 0.35;
const HEIGHT = 1.75;
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

// ground x -5..40; a ramp from x 5 (y 0.1) climbing at 30 degrees to y 5.77 at x ~14.8, then flat to x 20; the upper floor
// (top y 5.77) x 20..40. The ramp is 2 m wide (z -1..1).
const RISE = Math.tan((30 * Math.PI) / 180);
function world() {
  const top = 0.1 + RISE * 9.8;
  const colliders = [box(-5, -0.2, -5, 40, 0, 5), box(20, top - 0.2, -5, 40, top, 5)];
  const ramp = addRamp(colliders, {
    id: 'test', axis: 'x', origin: 5, dir: 1, minX: 5, maxX: 20, minZ: -1, maxZ: 1,
    points: [[0, 0.1], [9.8, top], [15, top]],
  });
  return { colliders, ramp, top };
}

function mover(colliders, x, y, z) {
  const pos = new THREE.Vector3(x, y, z);
  const vel = new THREE.Vector3();
  const step = (vx, vz, jump = false) => {
    vel.x = vx;
    vel.z = vz;
    if (jump) vel.y = feel.movement.jumpVelocity;
    vel.y = Math.max(vel.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
    return moveAndCollide(pos, vel, dt, RADIUS, HEIGHT, colliders, feel.movement.stepTolerance);
  };
  return { pos, vel, step };
}

test('the surface height: flat plate, straight slope, flat top; nothing off the footprint or when switched off', () => {
  const { ramp, top } = world();
  assert.equal(rampHeightAt(ramp, 5, 0), 0.1);
  assert.ok(Math.abs(rampHeightAt(ramp, 9.9, 0) - (0.1 + RISE * 4.9)) < 1e-9, 'halfway: 30 degrees');
  assert.equal(rampHeightAt(ramp, 15, 0), top);
  assert.equal(rampHeightAt(ramp, 19, 0), top, 'flat beyond the slope');
  assert.equal(rampHeightAt(ramp, 4.9, 0), null, 'before it');
  assert.equal(rampHeightAt(ramp, 10, 1.2), null, 'beside it');
  ramp.enabled = false;
  assert.equal(rampHeightAt(ramp, 10, 0), null, 'switched off');
});

test('walking up: the feet follow the surface all the way and onto the upper floor, never blocked, never floating', () => {
  const { colliders, top } = world();
  const m = mover(colliders, 3, 0, 0);
  let maxGap = 0;
  for (let i = 0; i < 60 * 6; i++) {
    const { grounded } = m.step(5, 0);
    const h = rampHeightAt(colliders.ramps[0], m.pos.x, m.pos.z);
    if (h !== null) {
      assert.equal(grounded, true, `grounded on the ramp at x ${m.pos.x.toFixed(2)}`);
      maxGap = Math.max(maxGap, Math.abs(m.pos.y - h));
    }
  }
  assert.ok(maxGap < 1e-6, 'feet exactly on the surface');
  assert.ok(m.pos.x > 21, `got off the top (x ${m.pos.x.toFixed(2)})`);
  assert.ok(Math.abs(m.pos.y - top) < 1e-6, `on the upper floor (y ${m.pos.y.toFixed(2)})`);
});

test('walking down: stays on the surface (no little falls) all the way to the ground', () => {
  const { colliders, top } = world();
  const m = mover(colliders, 25, top, 0);
  let ungrounded = 0;
  for (let i = 0; i < 60 * 8 && m.pos.x > 2; i++) {
    const { grounded } = m.step(-5, 0);
    if (!grounded && m.pos.x > 5.3 && m.pos.x < 21) ungrounded++; // (the last 10 cm off the foot of the ramp is a tiny drop)
  }
  assert.equal(ungrounded, 0, 'grounded on every tick of the way down');
  assert.ok(m.pos.x < 4 && Math.abs(m.pos.y) < 1e-6, `down on the ground (x ${m.pos.x.toFixed(1)}, y ${m.pos.y.toFixed(2)})`);
});

test('a jump leaves the surface; landing on it again holds', () => {
  const { colliders } = world();
  const m = mover(colliders, 9, 0.1 + RISE * 4, 0);
  m.step(0, 0);
  const h0 = rampHeightAt(colliders.ramps[0], m.pos.x, m.pos.z);
  assert.ok(Math.abs(m.pos.y - h0) < 1e-6);
  m.step(0, 0, true);
  m.step(0, 0);
  assert.ok(m.pos.y > h0 + 0.05, 'rising off the surface');
  for (let i = 0; i < 90; i++) m.step(0, 0);
  assert.ok(Math.abs(m.pos.y - rampHeightAt(colliders.ramps[0], m.pos.x, m.pos.z)) < 1e-6, 'landed back on it');
});

test('under a ramp is not on it: walking beneath the high part keeps the feet on the ground', () => {
  const { colliders } = world();
  const m = mover(colliders, 3, 0, 0);
  m.pos.z = 0.5;
  for (let i = 0; i < 60 * 3; i++) {
    m.step(0, 0); // (nothing solid is under this synthetic ramp, so walking beside it)
    m.pos.x = 12;
  }
  assert.equal(m.pos.y, 0, 'at x 12 the surface is ~4.1 m up: not reachable from the ground');
});

test('a ramp is never a wall: walking at its low end or across its side does not stop you', () => {
  const { colliders } = world();
  const m = mover(colliders, 2, 0, 0);
  for (let i = 0; i < 40; i++) m.step(5, 0);
  assert.ok(m.pos.x > 4.5 && m.pos.y > 0.1, `walks straight onto it from the ground (x ${m.pos.x.toFixed(2)}, y ${m.pos.y.toFixed(2)})`);
  const side = mover(colliders, 9, 0, 3);
  for (let i = 0; i < 60; i++) side.step(0, -5); // along z through the side of the footprint at ground level
  assert.equal(side.pos.y, 0, 'the sloping surface above (more than a step up) does not lift someone passing beneath it');
  assert.ok(side.pos.z < 0, 'and is not a wall either');
});

test('adding and removing a ramp marks the collider list as changed (so the zombie grid rebuilds)', () => {
  const colliders = [box(-5, -0.2, -5, 40, 0, 5)];
  const before = colliderSignature(colliders);
  const ramp = addRamp(colliders, { axis: 'x', origin: 0, dir: 1, minX: 0, maxX: 5, minZ: -1, maxZ: 1, points: [[0, 0], [5, 2]] });
  assert.notEqual(colliderSignature(colliders), before);
  const mid = colliderSignature(colliders);
  removeRamp(colliders, ramp);
  assert.notEqual(colliderSignature(colliders), mid);
  assert.equal(colliders.ramps.length, 0);
});
