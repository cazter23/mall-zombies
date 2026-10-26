import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { LAYOUT } from '../src/maps/mall/mall.js';
import { economy } from '../src/config/economy.js';
import { overlapsSolid } from '../src/world/collision.js';
import { feel } from '../src/config/feel.js';
import { markCollidersChanged } from '../src/world/collision.js';
import { atmosphere } from '../src/config/environment.js';

const Y = LAYOUT.hallway.height + .3, C = LAYOUT.cinema;
function fixture(open = false) {
  const t = headlessGame(), { g } = t;
  t.tick(); g.rounds.update = () => {}; g.zombies.clear(); g.health.invulnerable = true;
  g.map.doors.find(d => d.id === 'escalatorRepair').open();
  if (open) g.map.doors.find(d => d.id === 'cinema').open();
  t.tick(120); return t;
}
function stand(t, x, z, yaw = 0) { t.g.player.teleport({ position: new THREE.Vector3(x, Y, z), yaw }); t.tick(1); }
const route = [[-22, -2.9], [-38.8, -5], [-39, 4], [-39, 7.5], [-40.8, 15], [-40.8, 23],
  [-33, 24], [-25.5, 24], [-22, 24], [-22, 14], [-22, 7], [-22, 3]];

test('cinema entrance is a real F purchase through pricing, buyable both sides, and Play Again reseals the wing', () => {
  for (const inside of [false, true]) {
    const t = fixture(), { g } = t;
    g.wallet.earn(5000); g.pricing.setDiscount('door', .5);
    stand(t, inside ? -21.7 : -18.6, -2.9, inside ? -Math.PI / 2 : Math.PI / 2);
    assert.equal(g.interactions.prompt?.id, 'cinema'); assert.equal(g.interactions.prompt.cost, 750);
    const before = g.wallet.points; t.press('KeyF', 30); t.tick(100);
    assert.equal(g.wallet.points, before - 750); assert.equal(g.map.zones.cinema.open, true);
    assert.equal(g.map.doors.find(d => d.id === 'cinema').price, economy.doors.cinema);
    g.resetRun(); t.tick(120); assert.equal(g.map.zones.cinema.open, false);
    assert.equal(g.map.doors.find(d => d.id === 'cinema').barrier.state, 'closed');
    g.map.dispose();
  }
});

test('the cinema purchase stays out of reach along adjacent walls and on the floor underneath', () => {
  const t = fixture(), { g } = t; g.wallet.earn(5000);
  for (const [x, h, z] of [[-18.6, Y, .6], [-18.6, 0, -2.9], [-21.8, Y, -7]]) {
    g.player.teleport({ position: new THREE.Vector3(x, h, z), yaw: x > -20 ? Math.PI / 2 : -Math.PI / 2 }); t.tick();
    assert.notEqual(g.interactions.prompt?.id, 'cinema'); t.press('KeyF', 30);
    assert.equal(g.map.zones.cinema.open, false);
  }
  g.map.dispose();
});

test('the cinema is sealed until bought, with clear upper-floor spawn markers and short routes throughout its loop', () => {
  const t = fixture(), { g } = t; stand(t, -18.5, -2.9);
  const nav = g.zombies.nav;
  for (const s of g.map.spawnPoints.filter(s => s.zone === 'cinema')) {
    assert.equal(nav.distanceToTarget(s.position.x, s.position.z, Y), Infinity, `${s.name}: no back entrance`);
    assert.equal(s.position.y, Y);
    assert.equal(overlapsSolid(s.position, .4, 1.8, g.colliders, .05), false, `${s.name}: clear`);
  }
  g.map.doors.find(d => d.id === 'cinema').open(); t.tick(120);
  for (const [x, z] of route) assert.ok(Number.isFinite(nav.distanceToTarget(x, z, Y)), `route at ${x},${z}`);
  for (const s of g.map.spawnPoints.filter(s => s.zone === 'cinema')) assert.ok(Number.isFinite(nav.distanceToTarget(s.position.x, s.position.z, Y)), s.name);
  g.map.dispose();
});

test('a standing player walks the cinema loop in both directions and vaults the lobby display', () => {
  const t = fixture(true), { g } = t;
  for (const points of [route, [...route].reverse()]) {
    stand(t, ...points[0]);
    for (const [x, z] of points.slice(1)) {
      t.input.held.add('KeyW');
      let i = 0; while (Math.hypot(g.player.position.x - x, g.player.position.z - z) > .25 && i++ < 60 * 8) {
        g.player.yaw = Math.atan2(g.player.position.x - x, g.player.position.z - z); t.tick();
      }
      t.input.clear(); assert.ok(i < 60 * 8, `blocked approaching ${x},${z}: ${g.player.position.toArray()}`);
      assert.equal(g.player.position.y, Y);
    }
  }
  stand(t, -34, -4.2, Math.PI); g.player.velocity.z = 8; t.input.held.add('KeyW'); t.input.held.add('ShiftLeft'); t.input.pressed.add('Space');
  let vaulted = false; for (let i = 0; i < 30; i++) { t.tick(); vaulted ||= g.player.vault.active; }
  t.input.clear(); assert.ok(vaulted); assert.ok(g.player.position.z > -2.0);
  // The future screens remain sealed; the west exit is now the service stairs.
  for (const p of [[-37, -10.65], [-31.5, -10.65]]) assert.ok(g.colliders.some(b => b.containsPoint(new THREE.Vector3(p[0], Y + 1, p[1]))));
  g.map.dispose();
});

function spawn(t, x, z) {
  const a = t.g.zombies.spawn('shopper', new THREE.Vector3(x, Y, z));
  a.position.y = Y; a.prevPosition.copy(a.position); a.setState('chasing'); a.updateHitboxes();
  a.speed = 3.4; // the production jog gait, held constant for comparable route timings
  return a;
}

test('live zombies follow both auditorium routes, and the local horde reaches the lobby without relocation', ctx => {
  const t = fixture(true), { g } = t; g.rounds.jumpTo(6);
  const target = new THREE.Vector3(-30, Y, 1), horde = [];
  stand(t, target.x, target.z); t.tick(20);
  for (let i = 0; i < 6; i++) horde.push(spawn(t, -39.1 + (i % 2) * .7, 7.6 + Math.floor(i / 2) * .9));
  for (let i = 0; i < 6; i++) horde.push(spawn(t, -22.5 + (i % 2) * .8, 10.5 + Math.floor(i / 2) * .9));
  const arrived = new Map(), entries = new Set();
  for (let i = 0; i < 60 * 35 && arrived.size < horde.length; i++) {
    g.player.teleport({ position: target, yaw: 0 });
    const old = horde.map(z => z.position.clone()); t.tick();
    horde.forEach((z, j) => {
      assert.ok(z.position.distanceTo(old[j]) < .5, 'no stuck-zombie rescue teleport');
      if (old[j].z >= 5.8 && z.position.z < 5.8) entries.add(z.position.x < -30 ? 'auditorium' : 'passage');
      if (!arrived.has(z) && Math.hypot(z.position.x - target.x, z.position.z - target.z) < 2.8) arrived.set(z, i / 60);
    });
  }
  assert.equal(arrived.size, 12); assert.equal(entries.size, 2);
  ctx.diagnostic(`12 round-6 Shoppers, fixed 3.4 m/s jog: ${Math.min(...arrived.values()).toFixed(2)}–${Math.max(...arrived.values()).toFixed(2)} s; both lobby entries used`);
  g.zombies.clear();
  // Block the normal lobby doorway: a zombie at the screen's rear must go
  // around the seats and through the front crossover into the service passage.
  const e = C.auditoriumEntry, blocker = new THREE.Box3(new THREE.Vector3(e.from, Y, 5.45), new THREE.Vector3(e.to, Y + 3, 5.85));
  g.colliders.push(blocker); markCollidersChanged(g.colliders);
  stand(t, -22, 15); const zombie = spawn(t, -39, 8), crossed = new Set(); let arrivedAt = null;
  for (let i = 0; i < 60 * 45 && arrivedAt === null; i++) {
    g.player.teleport({ position: new THREE.Vector3(-22, Y, 15), yaw: 0 });
    const old = zombie.position.clone(); t.tick(); assert.ok(zombie.position.distanceTo(old) < .5);
    if (zombie.position.z > 22 && zombie.position.x > -25) crossed.add('front crossover');
    if (zombie.position.x > -23.7) crossed.add('passage');
    if (Math.hypot(zombie.position.x + 22, zombie.position.z - 15) < 2.5) arrivedAt = i / 60;
  }
  assert.notEqual(arrivedAt, null, zombie.position.toArray().join(',')); assert.equal(crossed.size, 2);
  ctx.diagnostic(`Screen rear → front crossover → passage: ${arrivedAt.toFixed(2)} s`);
  g.colliders.splice(g.colliders.indexOf(blocker), 1); markCollidersChanged(g.colliders); g.map.dispose();
});

test('spawn selection respects the cinema unlock and picks local upper-floor markers inside the wing', () => {
  const t = fixture(), { g } = t; stand(t, -18, -2.9); t.tick(20);
  const random = Math.random; Math.random = () => .001;
  try {
    const before = g.zombies.spawn('shopper');
    assert.ok(!before || !C.spawns.some(s => Math.hypot(s.x - before.position.x, s.z - before.position.z) < .01));
    g.zombies.clear(); g.map.doors.find(d => d.id === 'cinema').open(); t.tick(120);
    for (const [x, z] of [[-32, -5], [-33, 24], [-22, 18]]) {
      stand(t, x, z); t.tick(20); const a = g.zombies.spawn('shopper');
      assert.ok(a, 'a nearby safe marker is available'); assert.equal(a.position.y, Y);
      assert.ok(C.spawns.some(s => Math.hypot(s.x - a.position.x, s.z - a.position.z) < .01));
      g.zombies.clear();
    }
  } finally { Math.random = random; g.map.dispose(); }
});

test('seating is no invulnerable perch and nearby zombies can hit a player standing on a seat block', () => {
  const t = fixture(true), { g } = t; g.health.invulnerable = false;
  const target = new THREE.Vector3(-39.3, Y + C.seats.colliderHeight, C.seats.rows[0][0] + .38);
  g.player.teleport({ position: target, yaw: 0 }); const a = spawn(t, -40.2, target.z);
  const initial = g.stats.health;
  for (let i = 0; i < 150 && g.stats.health === initial; i++) { g.player.teleport({ position: target, yaw: 0 }); t.tick(); }
  assert.ok(g.stats.health < initial, `a seat is still within arm reach: ${a.position.toArray()}`); g.map.dispose();
});

test('interior seats and row gaps remain reachable by Shoppers, Mall Walkers and the widest Cart Pusher', () => {
  const t = fixture(true), { g } = t;
  const row = C.seats.rows[0], mid = row[0] + .38 + (row[1] - row[0] - .7) / 2;
  for (const type of ['shopper', 'mallWalker', 'cartPusher']) for (const perch of [false, true]) {
    g.zombies.clear(); g.health.reset(); g.health.invulnerable = false;
    const target = new THREE.Vector3(-36.8, Y + (perch ? C.seats.colliderHeight : 0), mid + (perch ? 0 : -.9));
    g.player.teleport({ position: target, yaw: 0 }); t.tick(20);
    const a = g.zombies.spawn(type, new THREE.Vector3(-36.8, Y, 8));
    a.position.y = Y; a.prevPosition.copy(a.position); a.setState('chasing'); a.updateHitboxes();
    const initial = g.stats.health;
    for (let i = 0; i < 60 * 25 && g.stats.health === initial; i++) {
      g.player.teleport({ position: target, yaw: 0 }); const before = a.position.clone(); t.tick();
      assert.ok(a.position.distanceTo(before) < .6, 'no rescue teleport');
    }
    assert.ok(g.stats.health < initial, `${type} must threaten the ${perch ? 'middle seat' : 'interior row gap'}: ${a.position.toArray()}`);
  }
  g.map.dispose();
});

test('the visible gaps between seat rows are traversable rather than blocked by an invisible seating block', () => {
  const t = fixture(true), { g } = t;
  stand(t, -40.8, 10.87, -Math.PI / 2); t.press('KeyW', 100); t.input.clear();
  assert.ok(g.player.position.x > -33.3, `row gap: ${g.player.position.toArray()}`); assert.equal(g.player.position.y, Y);
  g.map.dispose();
});

test('cinema slides reuse one texture, freeze with ambient extras off, reset, and release their resources', () => {
  const t = fixture(true), { g } = t, p = g.map.cinema.presentation, texture = p.screen.material.map;
  const enabled = atmosphere.ambient.enabled;
  try {
    p.reset(); assert.equal(p.screen.userData.slideIndex, 0);
    p.update(C.presentation.slideSeconds + .1); assert.equal(p.screen.userData.slideIndex, 1);
    assert.equal(p.screen.material.map, texture);
    atmosphere.ambient.enabled = false; p.update(C.presentation.slideSeconds * 3); assert.equal(p.screen.userData.slideIndex, 1); assert.equal(p.beam.visible, false);
    atmosphere.ambient.enabled = true; p.update(.01); assert.equal(p.beam.visible, true);
    p.reset(); assert.equal(p.screen.userData.slideIndex, 0);
    let disposed = 0; texture.addEventListener('dispose', () => disposed++); g.map.dispose(); assert.equal(disposed, 1);
  } finally { atmosphere.ambient.enabled = enabled; }
});
