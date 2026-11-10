// GRAB-A-GUN's prize tickets (game/tickets.js) and the Prize Counter (game/features/prizeCounter.js, its booth maps/mall/prizeCounter.js),
// in the real game through real input: tickets are their own currency (never points, pricing or income; lost on death, gone on Play
// again), each prize works, costs its tickets and is refused without enough, and the booth's site passes the cabinets' checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { createTickets } from '../src/game/tickets.js';
import { voucherChoices } from '../src/game/features/prizeCounter.js';
import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { weapons } from '../src/config/weapons.js';
import { economy } from '../src/config/economy.js';
import { attachmentsOf } from '../src/weapons/upgrades.js';
import { ownsAttachment } from '../src/game/features/attachmentCounter.js';
import { overlapsSolid } from '../src/world/collision.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';

const PRIZES = Object.fromEntries(cfg.prizeCounter.prizes.map((p) => [p.id, p]));

function setup() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(20_000);
  g.map.areaUnlocks.unlock('hallway');
  t.tick(60);
  const counter = g.map.features.find((f) => f.kind === 'prizeCounter');
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine').instance;
  return { t, g, counter, claw };
}
// Stand in front of one prize's card, facing the counter.
function atPrize({ t, g, counter }, id) {
  const { position } = counter.slots.find((s) => s.id === id);
  const n = counter.normal;
  g.player.teleport({ position: new THREE.Vector3(position.x + n.x * 0.9, 0, position.z + n.z * 0.9), yaw: Math.atan2(n.x, n.z) });
  g.player.pitch = 0;
  t.tick();
  assert.equal(g.interactions.prompt?.id, id, `the ${id} card has focus from in front of it`);
}
const redeem = (t) => t.press('KeyF', 20);

test('tickets: their own count; paid only while alive; spent only when there are enough; tokens; reset', () => {
  const heard = [];
  const state = { over: false };
  const tickets = createTickets({ events: { emit: (name, e) => heard.push([name, e]) }, state });
  assert.equal(tickets.add(40, 'prize'), 40);
  assert.deepEqual(heard, [['ticketsWon', { amount: 40, total: 40, reason: 'prize' }]]);
  assert.equal(tickets.spend(50), false);
  assert.equal(tickets.count, 40);
  assert.equal(tickets.spend(30), true);
  assert.deepEqual([tickets.count, tickets.won], [10, 40]);
  tickets.hold('freeGrab');
  assert.equal(tickets.has('freeGrab'), true);
  assert.equal(tickets.use('freeGrab'), true);
  assert.equal(tickets.use('freeGrab'), false);
  assert.throws(() => tickets.hold('rayGun'), /unknown token/);
  state.over = true;
  assert.equal(tickets.add(25, 'sunny'), 0, 'nothing is paid once you are dead');
  tickets.hold('keychain');
  tickets.reset();
  assert.deepEqual([tickets.count, tickets.won, tickets.tokens], [0, 0, { slowClaw: 0, freeGrab: 0, keychain: 0 }]);
});

test('every prize refuses without enough tickets (nothing spent) and costs exactly its tickets', () => {
  const s = setup(), { t, g } = s;
  for (const prize of cfg.prizeCounter.prizes) {
    g.gun.weapon.magazine = 1; // (so the ammo refill has a use)
    g.tickets.spend(g.tickets.count);
    g.tickets.add(prize.tickets - 1, 'test');
    atPrize(s, prize.id);
    assert.equal(g.interactions.prompt.priceLabel, `${prize.tickets} tickets`);
    assert.equal(g.interactions.prompt.blocked, 'Need 1 more ticket');
    redeem(t);
    assert.equal(g.tickets.count, prize.tickets - 1, `${prize.id}: refused`);
    assert.ok(t.sounds.includes('denied'));
    g.tickets.add(1, 'test');
    t.tick(2);
    const points = g.wallet.points;
    const redeemed = [];
    const off = g.events.on('prizeRedeemed', (e) => redeemed.push(e));
    redeem(t);
    off();
    assert.equal(g.tickets.count, 0, `${prize.id}: cost exactly ${prize.tickets}`);
    assert.equal(g.wallet.points, points, 'no points move');
    assert.equal(redeemed[0]?.id, prize.id);
    t.tick(40);
  }
});

test('the prizes: a refill, a Slow Claw (half-speed sweep), an attachment for an empty slot, a free grab, and a keychain on the receipt', () => {
  const s = setup(), { t, g, claw } = s;
  g.tickets.add(5000, 'test');

  // Ammo: the gun in hand, full again; refused once it's full.
  g.gun.weapon.magazine = 2; g.gun.weapon.reserve = 0;
  atPrize(s, 'ammo');
  redeem(t);
  assert.ok(g.gun.weapon.isFull);
  t.tick(2);
  assert.equal(g.interactions.prompt.blocked, 'The gun in your hand is full');

  // Attachment voucher: one that fits an empty slot, owned for the run.
  g.gun.give(weapons.nailGun);
  t.tick(60);
  const choices = voucherChoices(g.gun);
  assert.ok(choices.length > 0);
  atPrize(s, 'attachment');
  redeem(t);
  const fitted = Object.values(attachmentsOf(g.gun.modsFor('nailGun')));
  assert.equal(fitted.length, 1);
  assert.ok(choices.includes(fitted[0]) && ownsAttachment(g.gun, fitted[0]));

  // Slow Claw + free grab: the next grab sweeps half as fast and costs nothing; both tokens are used up by it.
  atPrize(s, 'slowClaw'); redeem(t);
  atPrize(s, 'freeGrab'); redeem(t);
  assert.deepEqual(g.tickets.tokens, { slowClaw: 1, freeGrab: 1, keychain: 0 });
  const { position, normal } = claw.site.cabinet;
  g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * 1.3, 0, position.z + normal.z * 1.3), yaw: Math.atan2(normal.x, normal.z) });
  t.tick();
  assert.equal(g.interactions.prompt?.cost, 0);
  assert.equal(g.interactions.prompt.priceLabel, 'Free grab');
  const before = g.wallet.points;
  t.press('KeyF', 20);
  assert.equal(g.wallet.points, before, 'the free grab');
  assert.equal(claw.grab.period, 2 * cfg.sweep.firstSeconds, 'the Slow Claw');
  assert.deepEqual(g.tickets.tokens, { slowClaw: 0, freeGrab: 0, keychain: 0 });
  t.tick(Math.ceil((cfg.autoDropSeconds + cfg.liftSeconds + cfg.takeSeconds) / dt) + 4);
  t.press('KeyF', 20);
  assert.equal(before - g.wallet.points, economy.claw.grab, 'the grab after costs the usual');
  assert.ok(Math.abs(claw.grab.period - (cfg.sweep.firstSeconds - cfg.sweep.stepSeconds)) < 1e-9, 'and sweeps at the usual speed');

  // Keychain: on the results receipt (until the Wardrobe exists).
  atPrize(s, 'keychain'); redeem(t);
  g.health.takeDamage(10_000);
  assert.equal(g.death.summary.keychains, 1);
  assert.ok(g.death.summary.ticketsWon >= 5000);
  // (the receipt's lines for them: tests/receiptReview.test.js)
});

test('the attachment voucher keeps the attachment counter\'s rules: not for the loaner, not mid-reload, never over a fitted slot', () => {
  const s = setup(), { t, g } = s;
  g.tickets.add(1000, 'test');
  g.gun.give(weapons.nailGun);
  t.tick(60);
  atPrize(s, 'attachment');
  g.gun.weapon.magazine = 1;
  t.press('KeyR', 1);
  assert.equal(g.interactions.prompt.blocked, 'Busy · Finish reloading first');
  t.tick(200);
  // Redeem until every slot it fits is full: each one fills an empty slot, never replacing a fitted attachment.
  for (let i = 0; i < 4 && voucherChoices(g.gun).length; i++) {
    const before = attachmentsOf(g.gun.modsFor('nailGun'));
    atPrize(s, 'attachment');
    redeem(t);
    const after = attachmentsOf(g.gun.modsFor('nailGun'));
    for (const [slot, id] of Object.entries(before)) assert.equal(after[slot], id, `${slot} kept its ${id}`);
    assert.equal(Object.keys(after).length, Object.keys(before).length + 1);
    t.tick(2);
  }
  atPrize(s, 'attachment');
  assert.match(g.interactions.prompt.blocked, /^No empty slot/);
  // The Courtesy Loaner gets nothing: a one-gun loadout hands its only gun over (as Build-A-Blaster does) and gets the loaner.
  const s2 = setup();
  s2.g.tickets.add(1000, 'test');
  s2.g.gun.handOver({ ...weapons.stapleGun, name: 'Courtesy Loaner', loaner: true });
  s2.t.tick(60);
  assert.ok(s2.g.gun.isLoaner);
  atPrize(s2, 'attachment');
  assert.equal(s2.g.interactions.prompt.blocked, 'Not for the Courtesy Loaner');
  redeem(s2.t);
  assert.equal(s2.g.tickets.count, 1000);
});

test('tickets never touch points, pricing or income; they are lost on death and gone on Play again', () => {
  const fresh = snapshot(headlessGame().g);
  const s = setup(), { t, g } = s;
  const earned = g.wallet.totalEarned;
  g.tickets.add(300, 'prize');
  assert.equal(g.wallet.totalEarned, earned, 'not income');
  g.pricing.setDiscount('claw', 0.5); // a claw Flash Sale: the counter's prices don't move
  atPrize(s, 'freeGrab');
  assert.equal(g.interactions.prompt.priceLabel, `${PRIZES.freeGrab.tickets} tickets`);
  g.pricing.setDiscount('claw', 0);
  g.health.takeDamage(10_000);
  assert.equal(g.tickets.add(40, 'prize'), 0, 'nothing paid after death');
  assert.equal(g.death.summary.pointsEarned, g.wallet.totalEarned);
  g.resetRun();
  assert.equal(g.tickets.count, 0);
  assert.deepEqual(snapshot(g), fresh);
});

test('the booth: one collider at least 2.1 m tall, every prize reachable from a clear spot, no spawn within 5 m, zombie routes unchanged', () => {
  const t = headlessGame(), { g } = t;
  for (const id of Object.keys(g.map.zones)) g.map.areaUnlocks.unlock(id);
  t.tick(150);
  const counter = g.map.features.find((f) => f.kind === 'prizeCounter');
  const { back, faces } = cfg.prizeCounter.site;
  const n = counter.normal;
  const inside = new THREE.Vector3(back.x + n.x * 0.45, 1, back.z + n.z * 0.45);
  const solids = g.colliders.filter((b) => b.containsPoint(inside));
  assert.equal(solids.length, 1, 'one collider');
  assert.ok(solids[0].max.y - solids[0].min.y >= 2.1, 'too tall to stand on');
  assert.equal(faces, '-z');
  const hub = new THREE.Vector3(0, 0, 2);
  const nav = createNavigation(g.colliders, zombieTypes.shopper, g.map.navigation);
  nav.update(dt, hub);
  for (const slot of counter.slots) {
    const stand = new THREE.Vector3(slot.position.x + n.x * 0.9, 0, slot.position.z + n.z * 0.9);
    assert.equal(overlapsSolid(stand, 0.35, 1.8, g.colliders, 0.3), false, `${slot.id}: clear stand point`);
    assert.ok(Number.isFinite(nav.distanceToTarget(stand.x, stand.z, 0)), `${slot.id}: reachable`);
    for (const spawn of g.map.spawnPoints) assert.ok(spawn.position.distanceTo(stand) >= 5, `${slot.id}: ${spawn.name} is ${spawn.position.distanceTo(stand).toFixed(1)} m away`);
  }
  // Routes from every spawn to the hub, with and without the booth: none lost, none more than 3 m longer.
  const without = Object.assign(g.colliders.filter((b) => b !== solids[0]), { ramps: g.colliders.ramps });
  const routes = (colliders) => {
    const n2 = createNavigation(colliders, zombieTypes.shopper, g.map.navigation);
    n2.update(dt, hub);
    return g.map.spawnPoints.map((p) => n2.distanceToTarget(p.position.x, p.position.z, p.position.y));
  };
  const before = routes(without), after = routes(g.colliders);
  after.forEach((d, i) => assert.ok(Number.isFinite(d) && d - before[i] <= 3, `${g.map.spawnPoints[i].name}: ${before[i].toFixed(1)} -> ${d.toFixed(1)}`));
});
