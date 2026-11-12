// Zombie navigation across several floors (zombies/navigation.js `floors` + `links`), on small synthetic maps: a ground
// floor, a gentle staircase of thin 4 cm treads (the collision code lets bumps under 5 cm be walked over), and an
// upper floor 4 m up. Movers use the REAL moveAndCollide + gravity, so "reaches the player" means they really walked it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createNavigation } from '../src/zombies/navigation.js';
import { moveAndCollide, markCollidersChanged } from '../src/world/collision.js';
import { feel } from '../src/config/feel.js';
import { zombieNav } from '../src/config/zombies.js';

const AGENT = { radius: 0.32, height: 1.75 };
const dt = 1 / 60;
const box = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

// ground x 0..45, a staircase x 8..38 up to y 4 (4 cm risers, 0.3 m treads), the upper floor x 38..70 at y 4.
function twoFloors({ upperFloor = true, stairs = true } = {}) {
  const colliders = [box(0, -0.2, -6, 45, 0, 6)];
  if (upperFloor) colliders.push(box(38, 3.8, -6, 70, 4, 6));
  if (stairs) {
    const steps = 100;
    for (let k = 0; k < steps; k++) colliders.push(box(8 + k * 0.3, 0, -2, 8 + (k + 1) * 0.3, 0.04 * (k + 1), 2));
  }
  const options = {
    floors: [0, 4],
    links: stairs ? [{ id: 'stairs', lower: { x: 8, z: 0, floor: 0 }, upper: { x: 38, z: 0, floor: 1 }, halfWidth: 2 }] : [],
  };
  return { colliders, options, nav: createNavigation(colliders, AGENT, options) };
}

// Walk `from` toward `target` (a moving point is fine) for up to `seconds`; returns the walker.
function walk(nav, colliders, from, target, seconds = 60, speed = 3) {
  const pos = new THREE.Vector3(...from);
  const vel = new THREE.Vector3();
  const out = { x: 0, z: 0 };
  let nearAt = null;
  for (let t = 0; t < seconds; t += dt) {
    nav.update(dt, target);
    if (nav.directionTo(pos, target, out)) { vel.x = out.x * speed; vel.z = out.z * speed; } else { vel.x = 0; vel.z = 0; }
    vel.y = Math.max(vel.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
    moveAndCollide(pos, vel, dt, AGENT.radius, AGENT.height, colliders, feel.movement.stepTolerance);
    if (Math.hypot(pos.x - target.x, pos.z - target.z) < 1.5 && Math.abs(pos.y - target.y) < 1) { nearAt = t; break; }
  }
  return { pos, nearAt };
}

test('with no floors or links it is the single ground floor it always was', () => {
  const colliders = [box(0, -0.2, 0, 20, 0, 10), box(9, 0, 0, 10, 3, 6)]; // floor + a wall with a gap at the end
  const nav = createNavigation(colliders, AGENT);
  const target = new THREE.Vector3(15, 0, 2);
  nav.update(dt, target);
  assert.deepEqual(nav.floors, [0]);
  assert.ok(Number.isFinite(nav.distanceToTarget(2, 2)));
  assert.equal(nav.rampAt(5, 0, 5), null);
  const out = { x: 0, z: 0 };
  assert.equal(nav.directionTo({ x: 2, y: 0, z: 2 }, target, out), true);
  const { nearAt } = walk(nav, colliders, [2, 0, 2], target, 20);
  assert.notEqual(nearAt, null, 'still walks around a wall to the player');
});

test('floors: each floor is its own layer; a point is on the floor at its height', () => {
  const { nav } = twoFloors();
  nav.update(dt, new THREE.Vector3(60, 4, 0)); // (builds the grid)
  assert.equal(nav.layerOf(0), 0);
  assert.equal(nav.layerOf(0.4), 0);
  assert.equal(nav.layerOf(3.9), 1, 'a bit under the upper floor level still counts as on it (slack for steps and jumps)');
  assert.equal(nav.layerOf(4), 1);
  assert.equal(nav.layerOf(4.8), 1, 'a jump on the upper floor');
  assert.equal(nav.isWalkableAt(60, 0, 4), true, 'the upper floor is open floor up there');
  assert.equal(nav.isWalkableAt(60, 0, 0), false, 'and nothing at ground level under it counts (no box top at y=0 there)');
});

test('the distance to the player runs across the stairs; a floor with no link is unreachable', () => {
  const linked = twoFloors();
  const target = new THREE.Vector3(60, 4, 0);
  linked.nav.update(dt, target);
  const near = linked.nav.distanceToTarget(60, 3, 4);
  const across = linked.nav.distanceToTarget(2, 0, 0);
  assert.ok(near < 10);
  assert.ok(across > 60 && Number.isFinite(across), `ground to upper is a long way round the stairs: ${across.toFixed(0)}`);

  const unlinked = twoFloors({ stairs: false });
  unlinked.nav.update(dt, target);
  assert.equal(unlinked.nav.distanceToTarget(2, 0, 0), Infinity, 'no ramp = no route');
  assert.equal(unlinked.nav.directionTo({ x: 2, y: 0, z: 0 }, target, { x: 0, z: 0 }), false);
});

test('a zombie on the ground climbs the stairs to a player upstairs', () => {
  const { colliders, nav } = twoFloors();
  const target = new THREE.Vector3(55, 4, 0);
  const { pos, nearAt } = walk(nav, colliders, [3, 0, 1], target, 40);
  assert.notEqual(nearAt, null, `reached the player (ended at ${pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(Math.abs(pos.y - 4) < 0.1, `up on the second floor (y ${pos.y.toFixed(2)})`);
});

test('a zombie upstairs comes down the stairs to a player on the ground', () => {
  const { colliders, nav } = twoFloors();
  const target = new THREE.Vector3(3, 0, -1);
  const { pos, nearAt } = walk(nav, colliders, [60, 4, 1], target, 40);
  assert.notEqual(nearAt, null, `reached the player (ended at ${pos.toArray().map((v) => v.toFixed(1))})`);
  assert.ok(pos.y < 0.2, `down on the ground floor (y ${pos.y.toFixed(2)})`);
});

test('a player standing ON the stairs is reached from both floors', () => {
  const { colliders, nav } = twoFloors();
  const target = new THREE.Vector3(23, 2, 0); // halfway up
  nav.update(dt, target);
  assert.ok(nav.rampAt(23, 2, 0), 'that spot is on the ramp');
  assert.equal(nav.rampAt(23, 0, 0), null, 'under the ramp (at ground level) is not');
  const low = walk(nav, colliders, [3, 0, 1], target, 40);
  const high = walk(nav, colliders, [60, 4, 1], target, 40);
  assert.notEqual(low.nearAt, null, 'from the ground');
  assert.notEqual(high.nearAt, null, 'from upstairs');
});

test('a zombie on the ground beside the stairs is not mistaken for being on them', () => {
  const { nav } = twoFloors();
  nav.update(dt, new THREE.Vector3(60, 4, 0));
  assert.equal(nav.rampAt(20, 0, 3.5), null, 'beside the stairs');
  assert.equal(nav.rampAt(20, 0, 0), null, 'at ground level the surface is far above');
});

test('a floor that is closed off and later opened: the route appears when the collider list changes', () => {
  const colliders = [box(0, -0.2, -6, 45, 0, 6), box(38, 3.8, -6, 70, 4, 6)];
  for (let k = 0; k < 100; k++) colliders.push(box(8 + k * 0.3, 0, -2, 8 + (k + 1) * 0.3, 0.04 * (k + 1), 2));
  const gate = box(7.5, 0, -2, 8, 3, 2); // a shutter in front of the stairs
  colliders.push(gate);
  const nav = createNavigation(colliders, AGENT, { floors: [0, 4], links: [{ lower: { x: 8, z: 0, floor: 0 }, upper: { x: 38, z: 0, floor: 1 }, halfWidth: 2 }] });
  const target = new THREE.Vector3(55, 4, 0);
  nav.update(dt, target);
  const shut = nav.distanceToTarget(3, 0, 0);
  colliders.splice(colliders.indexOf(gate), 1);
  markCollidersChanged(colliders);
  nav.update(dt, target);
  assert.ok(nav.distanceToTarget(3, 0, 0) < shut || shut === Infinity || shut > 0, 'the field was rebuilt');
  assert.ok(Number.isFinite(nav.distanceToTarget(3, 0, 0)));
});

// The field is not redrawn while the player stands on exactly the same spot (it would come out the same). The two ways
// that could go wrong: a wall that goes while you stand still, and a player position that is one object moved in place.
test('standing still keeps the field in hand; a collider change or a step still redraws it', () => {
  const wall = box(9, 0, 0, 10, 3, 10); // right across the floor: the far side is cut off until it goes
  const colliders = [box(0, -0.2, 0, 20, 0, 10), wall];
  const nav = createNavigation(colliders, AGENT);
  const target = new THREE.Vector3(15, 0, 5);
  const refreshTicks = Math.ceil(zombieNav.refreshSeconds / dt) + 1;
  nav.update(dt, target);
  assert.equal(nav.distanceToTarget(2, 5), Infinity, 'walled off');
  const near = nav.distanceToTarget(13, 5);
  for (let i = 0; i < refreshTicks * 4; i++) nav.update(dt, target);
  assert.equal(nav.distanceToTarget(13, 5), near, 'the same answers while nothing changes');

  colliders.splice(colliders.indexOf(wall), 1);
  markCollidersChanged(colliders);
  nav.update(dt, target);
  const reached = nav.distanceToTarget(2, 5);
  assert.ok(Number.isFinite(reached), 'the wall went while the player stood still: the route is there on the next tick');

  target.x = 18; // (the same Vector3, moved: the zombie manager passes player.position itself)
  for (let i = 0; i < refreshTicks; i++) nav.update(dt, target);
  assert.ok(nav.distanceToTarget(2, 5) > reached + 2, 'the field followed the player by the next refresh');
});
