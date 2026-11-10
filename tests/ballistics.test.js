// The bouncing projectile (weapons/ballistics.js, used by the Tennis Ball Launcher): a ball that flies under gravity and bounces off walls, floors and
// zombies, each zombie it touches a hit, spent after a few bounces. Bare walls and fake targets first; then the real mall's floor.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBalls } from '../src/weapons/ballistics.js';
import { headlessGame } from './helpers/headlessGame.js';

const dt = 1 / 60;
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const projectile = { speed: 20, gravity: 7, restitution: 0.8, maxBounces: 4, lifeSeconds: 3, radius: 0.07, minSpeed: 1, rehitSeconds: 0.3, seekRange: 6 };
const flat = (extra = {}) => ({ ...projectile, ...extra });

const wall = (x0, y0, z0, x1, y1, z1) => new THREE.Box3(v(x0, y0, z0), v(x1, y1, z1));
// A target: a body box and a head box, hit for whatever damageOf says.
function target(x, z, { alive = true } = {}) {
  const t = {
    isAlive: alive, damageTaken: [],
    hitboxes: [{ part: 'body', box: new THREE.Box3(v(x - 0.3, 0, z - 0.3), v(x + 0.3, 1.4, z + 0.3)) }, { part: 'head', box: new THREE.Box3(v(x - 0.2, 1.4, z - 0.2), v(x + 0.2, 1.8, z + 0.2)) }],
    takeHit({ damage }) { this.damageTaken.push(damage); return { killed: false }; },
  };
  return t;
}
const run = (balls, seconds) => { for (let t = 0; t < seconds; t += dt) balls.update(dt); };
const record = () => { const log = { hits: [], bounces: [], ends: [] }; return { log, onHit: (h) => log.hits.push(h), onBounce: (b) => log.bounces.push(b), onEnd: (e) => log.ends.push(e) }; };

test('a ball flies in an arc under gravity and is spent when its time is up (onEnd once, nothing hit)', () => {
  const balls = createBalls({ colliders: [], shootables: [] });
  const { log, ...cb } = record();
  const ball = balls.launch({ position: v(0, 2, 0), direction: v(1, 0, 0), projectile: flat({ lifeSeconds: 1 }), damageOf: () => 10, ...cb });
  run(balls, 0.5);
  assert.ok(ball.position.x > 8 && ball.position.x < 10.5, `about 20 m/s for half a second (${ball.position.x.toFixed(2)})`);
  const drop = 2 - ball.position.y;
  assert.ok(Math.abs(drop - 0.5 * 7 * 0.25) < 0.1, `it fell about half g t squared (${drop.toFixed(2)} m)`);
  assert.equal(balls.list.length, 1);
  run(balls, 1);
  assert.equal(balls.list.length, 0);
  assert.equal(log.ends.length, 1);
  assert.deepEqual(log.ends[0].hits, []);
});

test('a ball bounces off a wall: it comes back, slower by the restitution, and each bounce is reported', () => {
  const balls = createBalls({ colliders: [wall(10, -5, -5, 11, 10, 5)], shootables: [] });
  const { log, ...cb } = record();
  const ball = balls.launch({ position: v(0, 3, 0), direction: v(1, 0, 0), projectile: flat({ gravity: 0, restitution: 0.8 }), damageOf: () => 10, ...cb });
  run(balls, 0.6);
  assert.equal(log.bounces.length, 1);
  assert.deepEqual(log.bounces[0].normal.toArray(), [-1, 0, 0], 'off the wall face');
  assert.ok(Math.abs(ball.velocity.x - -16) < 0.2, `kept 80% of 20 m/s, going back (${ball.velocity.x.toFixed(2)})`);
  assert.equal(log.bounces[0].target, null, 'a surface, not a zombie');
});

test('a ball bounces off the floor, lower each time, and is spent after maxBounces (every bounce counts)', () => {
  const balls = createBalls({ colliders: [wall(-50, -1, -50, 50, 0, 50)], shootables: [] });
  const { log, ...cb } = record();
  balls.launch({ position: v(0, 2, 0), direction: v(1, 0, 0), projectile: flat({ speed: 6, maxBounces: 3, lifeSeconds: 10 }), damageOf: () => 10, ...cb });
  const peaks = [];
  let high = 0, falling = true;
  for (let t = 0; t < 8 && balls.list.length; t += dt) {
    balls.update(dt);
    const b = balls.list[0];
    if (!b) break;
    if (b.velocity.y < 0 && !falling) { peaks.push(high); high = 0; falling = true; }
    if (b.velocity.y > 0) falling = false;
    high = Math.max(high, b.position.y);
  }
  assert.equal(log.bounces.length, 3);
  assert.equal(log.ends.length, 1, 'spent on the third bounce');
  assert.ok(log.bounces.every((b) => b.normal.y === 1));
  assert.ok(peaks.length >= 2 && peaks[1] < peaks[0], `lower each time (${peaks.map((p) => p.toFixed(2))})`);
});

test('a ball hits a zombie for the gun\'s damage (head or body), once, and bounces on; it cannot hit the same one again straight away', () => {
  const zombie = target(5, 0);
  const balls = createBalls({ colliders: [], shootables: [zombie] });
  const { log, ...cb } = record();
  balls.launch({ position: v(0, 1, 0), direction: v(1, 0, 0), projectile: flat({ gravity: 0, seekRange: 0 }), damageOf: ({ part }) => (part === 'head' ? 60 : 40), ...cb });
  run(balls, 0.3);
  assert.equal(log.hits.length, 1);
  assert.deepEqual(zombie.damageTaken, [40], 'a body hit');
  assert.equal(log.hits[0].part, 'body');
  assert.equal(log.hits[0].killed, false);
  assert.equal(log.bounces.length, 1);
  assert.equal(log.bounces[0].target, zombie);
  const head = target(5, 0);
  const aimed = createBalls({ colliders: [], shootables: [head] });
  aimed.launch({ position: v(0, 1.6, 0), direction: v(1, 0, 0), projectile: flat({ gravity: 0, seekRange: 0 }), damageOf: ({ part }) => (part === 'head' ? 60 : 40) });
  run(aimed, 0.3);
  assert.deepEqual(head.damageTaken, [60], 'a head hit');
});

test('after a zombie the ball is sent on at the nearest OTHER zombie in view (each bounce a hit), and past the one it already hit', () => {
  const first = target(4, 0), second = target(4, 3), third = target(0, 5);
  const balls = createBalls({ colliders: [], shootables: [first, second, third] });
  const { log, ...cb } = record();
  balls.launch({ position: v(0, 1, 0), direction: v(1, 0, 0), projectile: flat({ gravity: 7, seekRange: 6, maxBounces: 5 }), damageOf: () => 40, ...cb });
  run(balls, 1.5);
  const order = log.hits.map((h) => [first, second, third].indexOf(h.target));
  assert.deepEqual(order.slice(0, 2), [0, 1], 'first, then the nearest other one');
  assert.ok(log.hits.length >= 2);
  assert.ok(second.damageTaken.length >= 1);
});

test('a wall between two zombies stops the ball being sent through it (it only reflects off the first)', () => {
  const first = target(4, 0), second = target(4, 3);
  const barrier = wall(3, 0, 1.2, 5, 3, 1.5); // between them
  const balls = createBalls({ colliders: [barrier], shootables: [first, second] });
  const { log, ...cb } = record();
  balls.launch({ position: v(0, 1, 0), direction: v(1, 0, 0), projectile: flat({ gravity: 0, seekRange: 6, maxBounces: 2 }), damageOf: () => 40, ...cb });
  run(balls, 1);
  assert.equal(second.damageTaken.length, 0, 'the far side of the wall was not seeked');
  assert.ok(first.damageTaken.length >= 1);
});

test('dead targets are passed through; a ball bouncing around a closed box is spent by maxBounces or its life, never forever', () => {
  const dead = target(5, 0, { alive: false });
  const balls = createBalls({ colliders: [wall(8, -5, -5, 9, 5, 5), wall(-9, -5, -5, -8, 5, 5)], shootables: [dead] });
  const { log, ...cb } = record();
  balls.launch({ position: v(0, 1, 0), direction: v(1, 0, 0), projectile: flat({ gravity: 0, restitution: 1, maxBounces: 6, lifeSeconds: 5 }), damageOf: () => 40, ...cb });
  run(balls, 6);
  assert.deepEqual(dead.damageTaken, [], 'a corpse is not hit');
  assert.equal(log.bounces.length, 6, 'spent on the sixth bounce');
  assert.equal(log.ends.length, 1);
  assert.equal(balls.list.length, 0);
});

test('a ball that has slowed to nothing is spent, and clear() takes every ball out without calling anything', () => {
  const balls = createBalls({ colliders: [wall(-50, -1, -50, 50, 0, 50)], shootables: [] });
  const { log, ...cb } = record();
  balls.launch({ position: v(0, 0.2, 0), direction: v(1, -0.1, 0), projectile: flat({ speed: 1.2, lifeSeconds: 10, maxBounces: 50 }), damageOf: () => 1, ...cb });
  run(balls, 4);
  assert.equal(log.ends.length, 1, 'ended by minSpeed');
  balls.launch({ position: v(0, 2, 0), direction: v(1, 0, 0), projectile: flat(), damageOf: () => 1, ...cb });
  balls.clear();
  assert.equal(balls.list.length, 0);
  run(balls, 1);
  assert.equal(log.ends.length, 1, 'a cleared ball never reports');
});

test('in the real mall the floor is solid to a ball: dropped in the hallway it bounces back up', (t) => {
  const game = headlessGame(), { g } = game;
  t.after(() => g.map.dispose());
  const balls = createBalls({ colliders: g.colliders, shootables: [] });
  const { log, ...cb } = record();
  balls.launch({ position: v(-2, 1.5, 0.5), direction: v(0, -1, 0), projectile: flat({ speed: 3, gravity: 9, maxBounces: 3 }), damageOf: () => 1, ...cb });
  run(balls, 1);
  assert.ok(log.bounces.length >= 1, 'it bounced');
  assert.ok(Math.abs(log.bounces[0].point.y) < 0.3, `on the floor (y ${log.bounces[0].point.y.toFixed(2)})`);
  assert.equal(log.bounces[0].normal.y, 1);
});
