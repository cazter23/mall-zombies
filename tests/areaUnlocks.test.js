import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { createAreaUnlocks } from '../src/world/areaUnlocks.js';
import { shutters } from '../src/config/shutters.js';

function started() {
  const t = headlessGame();
  t.tick();
  t.g.rounds.update = () => {};
  t.g.zombies.clear();
  t.g.health.invulnerable = true;
  return t;
}

function buy(t, id, x, z, yaw = 0, y = 0) {
  t.g.player.teleport({ position: new THREE.Vector3(x, y, z), yaw: yaw * Math.PI / 180 });
  t.tick();
  assert.equal(t.g.interactions.prompt?.id, id, `prompt for ${id}`);
  const cost = t.g.interactions.prompt.cost;
  const prompt = t.g.interactions.prompt;
  assert.equal(prompt.title, `Unlock ${prompt.label}`);
  assert.equal(t.g.pricing.basePriceOf(prompt.kind, prompt.pricingId), cost, 'HUD original price uses the destination');
  const before = t.g.wallet.points;
  t.press('KeyF', 30);
  assert.equal(before - t.g.wallet.points, cost, `one charge for ${id}`);
  t.tick(120);
}

test('nine real purchases fully connect the mall for 9,500; free shutters animate, sound and clear collision', () => {
  const t = started(), { g } = t;
  const paid = [];
  g.events.on('purchase', e => paid.push(e));
  g.wallet.earn(9000);
  buy(t, 'startShutter', 0, 8.5);
  buy(t, 'megaMart', 18.6, 2, -90);
  assert.equal(g.map.zones.foodCourt.open, false, 'Mega Mart does not grant Food Court');
  const motorCount = t.sounds.filter(s => s === 'shutterMotor').length;
  const stopCount = t.sounds.filter(s => s === 'shutterStop').length;
  buy(t, 'foodCourt', 0, -.8);
  // (both are 'roll' shutters: the bought entrance runs its motor, the free shortcut only clunks home, quietly)
  assert.equal(t.sounds.filter(s => s === 'shutterMotor').length - motorCount, 1, 'only the bought entrance runs its motor');
  assert.equal(t.sounds.filter(s => s === 'shutterStop').length - stopCount, 2, 'entrance and shortcut both clunk home');
  const shortcut = g.map.doors.find(d => d.id === 'foodCourtMegaMart');
  assert.equal(shortcut.barrier.state, 'open');
  assert.equal(g.colliders.includes(shortcut.barrier.collider), false);
  assert.ok(Number.isFinite(g.zombies.nav.distanceToTarget(21.9, -8.3, 0)), 'new connection is navigable');
  buy(t, 'serviceCorridor', -18.6, 2, 90);
  const hoffman = g.map.doors.find(d => d.id === 'departmentStore');
  buy(t, 'departmentStore', hoffman.position.x, 4.6, 180);
  assert.ok(g.map.doors.find(d => d.id === 'departmentStoreStartRoom').isOpen);
  buy(t, 'atrium', 15.5, 4.6, 180);
  assert.equal(g.map.zones.upstairs.open, false, 'Atrium does not grant Promenade');
  const repair = g.map.levelTwo.repair;
  buy(t, 'escalatorRepair', repair.position.x + 1.5, repair.position.z, 90);
  buy(t, 'cinema', -18.6, -2.9, 90, 6.3);
  buy(t, 'parkingLot', 32.6, 2.5, -90);
  assert.equal(g.wallet.points, 0);
  assert.equal(g.wallet.totalSpent, 9500);
  assert.equal(paid.length, 9);
  assert.equal(new Set(paid.map(e => e.areaId)).size, 9);
  assert.equal(paid.reduce((n, e) => n + e.openedDoorIds.length, 0), 15);
  assert.ok(g.map.doors.every(d => d.isOpen));
  assert.ok(Object.values(g.map.zones).every(z => z.open));
  // One PA welcome per area (its first opening this run: game/doorOpenings.js), none for the six free connections.
  const welcomes = t.hud.calls.filter(([name, message]) => name === 'showAnnouncement' && message.kicker === shutters.opening.welcome.kicker);
  assert.equal(welcomes.length, 9, 'one welcome per area bought');
  for (const [, message] of welcomes) assert.equal(message.ifQuiet, true, 'a welcome never stacks on another PA line');
  g.resetRun(); t.tick(120);
  assert.ok(g.map.doors.every(d => !d.isOpen));
  assert.deepEqual(Object.keys(g.map.zones).filter(id => g.map.zones[id].open), ['startRoom']);
  assert.ok(g.colliders.includes(shortcut.barrier.collider));
  g.map.dispose();
});

test('buying Hallway through HOFFMAN\'S charges 500 and opens its other entrance without another purchase', () => {
  const t = started(), { g } = t;
  g.wallet.earn(2000);
  const side = g.map.doors.find(d => d.id === 'departmentStoreStartRoom');
  buy(t, side.id, side.position.x + 1.3, side.position.z, 90);
  assert.equal(g.map.zones.hallway.open, false);
  const front = g.map.doors.find(d => d.id === 'departmentStore');
  g.player.teleport({ position: new THREE.Vector3(front.position.x, 0, 7.7), yaw: 0 }); t.tick();
  assert.equal(g.interactions.prompt.label, 'Main Hallway');
  assert.equal(g.interactions.prompt.cost, 500);
  buy(t, front.id, front.position.x, 7.7);
  assert.ok(g.map.doors.find(d => d.id === 'startShutter').isOpen);
  assert.equal(g.wallet.totalSpent, 1750);
  g.map.dispose();
});

test('a shared entrance charges its destination price in either purchase direction, with live discounts', () => {
  const t = started(), { g } = t;
  g.wallet.earn(10000);
  const link = g.map.doors.find(d => d.id === 'atriumMegaMart');
  for (const [owned, destination] of [['megaMart', 'atrium'], ['atrium', 'megaMart']]) {
    g.map.reset(); t.tick(120);
    g.map.areaUnlocks.unlock('hallway');
    g.map.areaUnlocks.unlock(owned); t.tick(120);
    const inMart = owned === 'megaMart';
    g.player.teleport({ position: new THREE.Vector3(link.position.x, 0, link.position.z + (inMart ? -1.3 : 1.3)), yaw: inMart ? Math.PI : 0 });
    t.tick();
    assert.equal(g.interactions.prompt?.id, link.id);
    assert.equal(g.interactions.prompt.cost, economy.doors[destination]);
    t.input.pressed.add('KeyF'); t.input.held.add('KeyF'); t.tick(5);
    g.pricing.setDiscount('door', .5);
    const before = g.wallet.points;
    t.tick(30); t.input.held.delete('KeyF');
    assert.equal(before - g.wallet.points, g.pricing.priceOf('door', destination));
    assert.equal(g.map.zones[destination].open, true);
    assert.equal(g.map.zones.upstairs.open, false);
    g.pricing.reset();
  }
  g.map.dispose();
});

test('unaffordable area purchases leave ownership and every barrier untouched', () => {
  const t = started(), { g } = t;
  g.wallet.spend(g.wallet.points);
  t.standAt(0, 8.5); t.press('KeyF', 30);
  assert.equal(g.wallet.totalSpent, 500);
  assert.equal(g.map.zones.hallway.open, false);
  assert.ok(g.map.doors.every(d => !d.isOpen));
  assert.ok(t.sounds.includes('denied'));
  g.map.dispose();
});

test('area ownership never propagates across locked neighbours; debug reset restores the starting area', () => {
  const zones = Object.fromEntries(['start', 'a', 'b', 'c'].map(id => [id, { open: id === 'start' }]));
  const connections = { sa: ['start', 'a'], ab: ['a', 'b'], bc: ['b', 'c'], ca: ['c', 'a'] };
  const doors = Object.keys(connections).map(id => ({ id, isOpen: false,
    open() { this.isOpen = true; }, reset() { this.isOpen = false; } }));
  const areas = createAreaUnlocks({ zones, doors, connections });
  assert.equal(areas.destination(doors[1]), null, 'both endpoints locked');
  assert.deepEqual(areas.unlock('a'), ['sa']);
  assert.equal(zones.b.open, false); assert.equal(zones.c.open, false);
  assert.equal(areas.destination(doors[1]), 'b');
  assert.deepEqual(areas.unlock('a'), [], 'idempotent');
  assert.deepEqual(areas.unlock('c'), ['ca']);
  assert.deepEqual(areas.unlock('b'), ['ab', 'bc']);
  areas.reset(); areas.reset();
  assert.equal(zones.start.open, true);
  assert.ok(doors.every(d => !d.isOpen));
  areas.openAll(); assert.ok(doors.every(d => d.isOpen));
  doors[1].reset(); areas.openAll();
  assert.ok(doors.every(d => d.isOpen), 'debug open-all also reconciles manually closed barriers');
  assert.throws(() => areas.unlock('unknown'), /Unknown area/);
});
