import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { cinemaStairs as S } from '../src/config/cinemaStairs.js';
import { seededRandom } from '../src/world/textures.js';
import { areaAt, visibleAreas } from '../src/fx/roomCulling.js';

const Y = 6.3;
function fixture(open = false) {
  const t = headlessGame(), { g } = t; t.tick(); g.rounds.update = () => {}; g.zombies.clear(); g.health.invulnerable = true;
  g.map.doors.find(d => d.id === 'serviceCorridor').open();
  if (open) g.map.cinema.stairs.door.open(); t.tick(120); return t;
}
function stand(t, x, y, z, yaw = 0) { t.g.player.teleport({ position: new THREE.Vector3(x, y, z), yaw }); t.tick(20); }
const route = [[-21.8, 0, 2], [-21.8, 0, 8.6], [-44.15, 0, 8.6], [-44.15, 0, 7.1],
  [-44.15, Y, -5.6], [-44.15, Y, -7.2], [-40.5, Y, -7.2]];

test('the stair shutter is bought with F from either side, uses pricing, unlocks both adjoining zones and resets', () => {
  for (const inside of [false, true]) {
    const t = fixture(), { g } = t; g.wallet.earn(5000); g.pricing.setDiscount('door', .5);
    stand(t, -21.8, 0, inside ? 5.2 : 2, inside ? 0 : Math.PI);
    assert.equal(g.interactions.prompt?.id, 'cinemaStairs'); assert.equal(g.interactions.prompt.cost, 750);
    const before = g.wallet.points; t.press('KeyF', 30); t.tick(120);
    assert.equal(before - g.wallet.points, 750); assert.ok(g.map.zones.cinema.open && g.map.zones.serviceCorridor.open);
    assert.equal(g.map.zones.upstairs.open, false, 'cinema access does not bypass its separate Promenade shutter');
    assert.equal(g.map.doors.find(d => d.id === 'cinema').isOpen, false);
    g.resetRun(); t.tick(120); assert.equal(g.map.zones.cinema.open, false); assert.equal(g.map.zones.serviceCorridor.open, false);
    assert.equal(g.map.cinema.stairs.door.barrier.state, 'closed'); g.map.dispose();
  }
});

test('an unbought staircase cannot bypass the cinema unlock; either entrance independently holds the cinema open', () => {
  const t = fixture(), { g } = t; stand(t, -21.8, 0, 2);
  const marker = g.map.spawnPoints.find(s => s.zone === 'cinema');
  assert.equal(g.zombies.nav.distanceToTarget(marker.position.x, marker.position.z, Y), Infinity);
  const front = g.map.doors.find(d => d.id === 'cinema'), back = g.map.cinema.stairs.door;
  for (const first of [front, back]) {
    const second = first === front ? back : front; first.open(); second.open(); first.reset(); t.tick(120);
    assert.ok(g.map.zones.cinema.open); second.reset(); t.tick(120); assert.equal(g.map.zones.cinema.open, false);
  }
  back.open(); t.tick(120); assert.ok(Number.isFinite(g.zombies.nav.distanceToTarget(marker.position.x, marker.position.z, Y)));
  assert.equal(g.map.doors.find(d => d.id === 'escalatorRepair').isOpen, false);
  g.map.dispose();
});

test('a real standing player walks the Service Corridor–cinema route up and down without falling or clipping', () => {
  const t = fixture(true), { g } = t;
  for (const points of [route, [...route].reverse()]) {
    stand(t, ...points[0]);
    for (const [x, y, z] of points.slice(1)) {
      t.input.held.add('KeyW'); let ticks = 0;
      while (Math.hypot(g.player.position.x - x, g.player.position.z - z) > .2 && ticks++ < 60 * 8) {
        g.player.yaw = Math.atan2(g.player.position.x - x, g.player.position.z - z); t.tick();
        assert.ok(g.player.position.y >= -.01 && g.player.position.y <= Y + .05);
      }
      t.input.clear(); assert.ok(ticks < 60 * 8, `blocked toward ${x},${y},${z}: ${g.player.position.toArray()}`);
      assert.ok(Math.abs(g.player.position.y - y) < .15, `floor at ${x},${z}: ${g.player.position.y}`);
    }
  }
  // Running/sliding down the flight still follows the supporting surface.
  stand(t, -44.15, Y, -6.4, Math.PI); t.input.held.add('KeyW'); t.input.held.add('ShiftLeft');
  for (let i = 0; i < 125; i++) { if (i === 25) t.input.pressed.add('KeyC'); t.tick(); assert.ok(g.player.position.y >= -.01); }
  t.input.clear(); assert.ok(g.player.position.z > 7); assert.equal(g.player.position.y, 0); g.map.dispose();
});

test('all zombie types traverse the stairs in both directions, with the original escalator and cinema front still shut', ctx => {
  ctx.mock.method(Math, 'random', seededRandom(1986)); const t = fixture(true), { g } = t; g.rounds.jumpTo(6);
  for (const type of ['shopper', 'mallWalker', 'cartPusher']) for (const down of [false, true]) {
    g.zombies.clear();
    const target = new THREE.Vector3(...(down ? route[0] : route.at(-1)));
    const source = new THREE.Vector3(...(down ? route.at(-1) : route[0]));
    stand(t, ...target.toArray());
    const z = g.zombies.spawn(type, source); z.position.y = source.y; z.prevPosition.copy(z.position); z.setState('chasing'); z.updateHitboxes();
    if (type === 'shopper') z.speed = 3.4;
    let arrived = null, crossedFlight = false;
    for (let i = 0; i < 60 * 70 && arrived === null; i++) {
      g.player.teleport({ position: target, yaw: 0 }); const before = z.position.clone(); t.tick();
      assert.ok(z.position.distanceTo(before) < .7, 'no rescue teleport');
      crossedFlight ||= z.position.y > 1 && z.position.y < Y - 1 && z.position.x < S.shaft.maxX;
      if (Math.abs(z.position.y - target.y) < .1 && z.position.distanceTo(target) < 2.4) arrived = i / 60;
    }
    assert.notEqual(arrived, null, `${type} ${down ? 'down' : 'up'}: ${z.position.toArray()}`); assert.ok(crossedFlight);
    ctx.diagnostic(`${type} ${down ? 'down' : 'up'}: ${arrived.toFixed(2)} s`);
  }
  g.map.dispose();
});

test('culling connects both landings through the stairwell, and a closed lower shutter blocks its portal', () => {
  const t = fixture(), { g } = t, camera = new THREE.PerspectiveCamera(75, 16 / 9, .05, 200);
  const params = { areas: g.map.cullAreas, portals: g.map.cullPortals, camera };
  for (const [point, id] of [[[-44.15, 5, 0], 'cinemaStairwell'], [[-32, 1.6, 8.6], 'cinemaReturn']])
    assert.equal(areaAt(params.areas, new THREE.Vector3(...point)).id, id);
  camera.position.set(-21.8, 1.6, 5.3); camera.lookAt(-21.8, 1.6, 2); camera.updateMatrixWorld();
  assert.ok(!visibleAreas({ ...params, isOpen: () => false }).has('serviceCorridor'));
  assert.ok(visibleAreas({ ...params, isOpen: () => true }).has('serviceCorridor')); g.map.dispose();
});

test('a mixed horde clears the lower turn and upper exit without anyone becoming stuck in the staircase', ctx => {
  ctx.mock.method(Math, 'random', seededRandom(4851)); const t = fixture(true), { g } = t; g.rounds.jumpTo(7);
  const target = new THREE.Vector3(-39, Y, -7.2); stand(t, ...target.toArray());
  const horde = [], arrived = new Map();
  for (let i = 0; i < 12; i++) {
    const type = i % 6 === 0 ? 'cartPusher' : i % 3 === 0 ? 'mallWalker' : 'shopper';
    const z = g.zombies.spawn(type, new THREE.Vector3(-26 - Math.floor(i / 2) * 1.0, 0, 8.2 + (i % 2) * .8));
    z.setState('chasing'); z.updateHitboxes(); if (type === 'shopper') z.speed = 3.4; horde.push(z);
  }
  for (let i = 0; i < 60 * 60 && arrived.size < horde.length; i++) {
    g.player.teleport({ position: target, yaw: 0 }); const before = horde.map(z => z.position.clone()); t.tick();
    horde.forEach((z, n) => {
      assert.ok(z.position.distanceTo(before[n]) < .9, 'no rescue teleport');
      if (!arrived.has(z) && Math.abs(z.position.y - Y) < .1 && z.position.distanceTo(target) < 3) arrived.set(z, i / 60);
    });
  }
  assert.equal(arrived.size, 12, `remaining: ${horde.filter(z => !arrived.has(z)).map(z => `${z.type.id}:${z.position.toArray()}`)}`);
  ctx.diagnostic(`Mixed 12-zombie stair horde: ${Math.min(...arrived.values()).toFixed(2)}–${Math.max(...arrived.values()).toFixed(2)} s`);
  g.map.dispose();
});
