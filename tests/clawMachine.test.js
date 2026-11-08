// GRAB-A-GUN, the claw machine (game/features/clawMachine.js, its cabinet maps/mall/clawCabinet.js, config/clawMachine.js),
// played through REAL input in the headless game: the odds, the timed press (keyboard and controller), payment, and that a
// grab can never hang or leave anything behind (walking away, death, Play again).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { rollCapsules, sweepPosition, laneAt, sweepSeconds, prizePool, describeCarried } from '../src/game/features/clawMachine.js';
import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { bossVouchers } from '../src/config/bosses.js';
import { createWallet } from '../src/game/wallet.js';
import { overlapsSolid } from '../src/world/collision.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';

// A small seeded random (tests pass it to the pure functions; Math.random is never seeded).
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The real game, rounds stopped and no zombies, with points to spend and the Hallway open (the machine's first site).
function setup() {
  const t = headlessGame(), { g } = t;
  t.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(50_000);
  g.map.areaUnlocks.unlock('hallway');
  t.tick(60);
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine').instance;
  return { t, g, claw };
}

// Stand in front of the live machine, facing it.
function standAtMachine({ t, g, claw }, distance = 1.3) {
  const { position, normal } = claw.site.cabinet;
  const floorY = cfg.sites.find((s) => s.id === claw.site.id).floorY;
  g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * distance, floorY, position.z + normal.z * distance), yaw: Math.atan2(normal.x, normal.z) });
  g.player.pitch = 0;
  t.tick();
}

const pay = (t, code = 'KeyF') => t.press(code, 20); // a hold (feel.interact.holdSeconds is 0.25 s)

test('the odds: capsules follow the weights, never repeat in a grab, and never offer the Staple Gun, a carried gun or one at Build-A-Blaster', () => {
  const fresh = { owns: (id) => id === 'stapleGun', away: null };
  const pool = prizePool(fresh);
  assert.deepEqual(pool.map((p) => p.id).sort(), Object.keys(cfg.prizes).sort());
  assert.ok(!pool.some((p) => p.id === 'stapleGun'));
  const random = seeded(7);
  const firsts = {};
  const rolls = 60_000;
  for (let i = 0; i < rolls; i++) {
    const capsules = rollCapsules(pool, 0, random);
    assert.equal(capsules.length, cfg.lanes);
    assert.equal(new Set(capsules.map((c) => c.id)).size, cfg.lanes, 'no repeats in one grab');
    firsts[capsules[0].id] = (firsts[capsules[0].id] ?? 0) + 1;
  }
  const total = pool.reduce((s, p) => s + p.weight, 0);
  for (const p of pool) assert.ok(Math.abs(firsts[p.id] / rolls - p.weight / total) < 0.01, `${p.id}: ${firsts[p.id] / rolls} vs ${p.weight / total}`);

  // Carried guns and the gun on the conveyor are left out; with two carried and one away, at least four remain.
  const busy = { owns: (id) => ['stapleGun', 'coilNailer', 'rivetRifle'].includes(id), away: { def: weapons.barcodeScanner } };
  const left = prizePool(busy).map((p) => p.id);
  assert.ok(!left.includes('coilNailer') && !left.includes('rivetRifle') && !left.includes('barcodeScanner'));
  assert.ok(left.length >= 4);
  // A pool smaller than the lanes leaves the rest empty instead of repeating.
  assert.deepEqual(rollCapsules([{ id: 'nailGun', weight: 1 }], 0, seeded(1)).map((c) => c?.id ?? null), ['nailGun', null, null]);
});

test('the sweep: 2.4 s there and back on the first grab, 0.2 s quicker each grab down to 1.4 s; the middle lane is the short one', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 9].map(sweepSeconds).map((s) => +s.toFixed(3)), [2.4, 2.2, 2, 1.8, 1.6, 1.4, 1.4]);
  const period = sweepSeconds(1);
  const time = [0, 0, 0];
  for (let s = 0; s < period; s += 0.001) time[laneAt(sweepPosition(s, period))] += 0.001;
  assert.ok(Math.abs(time[1] - 0.8) < 0.01, 'middle lane: 0.4 s per pass, two passes');
  assert.ok(Math.abs(time[0] - 0.8) < 0.01 && Math.abs(time[2] - 0.8) < 0.01, 'an end lane: 0.8 s in one go (it turns round there)');
  assert.equal(laneAt(sweepPosition(0, period)), 0);
  assert.equal(laneAt(sweepPosition(period / 2, period)), 2);
});

test('a grab through real keyboard input: hold to pay, a fresh press drops, the lane under the claw at the press is the prize, hold to take', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  assert.equal(g.interactions.prompt?.kind, 'claw');
  assert.equal(g.interactions.prompt.cost, economy.claw.grab);
  for (const wait of [5, 30, 55, 80, 100]) {
    const before = g.wallet.points;
    pay(t);
    assert.equal(claw.phase, 'sweeping');
    assert.equal(before - g.wallet.points, g.pricing.priceOf('claw', 'grab'));
    assert.equal(g.interactions.prompt?.id, 'drop');
    assert.equal(g.interactions.prompt.instant, true);
    t.tick(wait);
    const lane = claw.lane; // what the player saw: the claw over this lane
    const capsule = claw.grab.capsules[lane];
    t.press('KeyF', 1);
    assert.equal(claw.phase, 'lifting');
    assert.equal(claw.grab.lane, lane, `pressed after ${wait} ticks`);
    assert.equal(claw.grab.prize, capsule);
    t.tick(Math.ceil(cfg.liftSeconds / dt) + 1);
    assert.equal(claw.phase, 'ready');
    assert.equal(g.interactions.prompt?.id, 'take');
    if (g.gun.slots.length === 2) assert.match(g.interactions.prompt.detail, /^Replaces your /);
    const won = capsule.id;
    t.press('KeyF', 20);
    assert.equal(claw.phase, 'idle');
    assert.ok(g.gun.owns(won), `took the ${won}`);
    assert.equal(claw.display, null);
    t.tick(5);
  }
});

test('holding interact after paying never drops the claw: only a fresh press does, or the clock', () => {
  const s = setup(), { t, claw } = s;
  standAtMachine(s);
  t.press('KeyF', 20 + 120); // pay, then keep holding for 2 s
  assert.equal(claw.phase, 'sweeping');
  assert.ok(claw.grab.t > 1.5, 'held for a while after paying');
  t.tick(Math.floor((cfg.autoDropSeconds - claw.grab.t) / dt) - 2);
  assert.equal(claw.phase, 'sweeping');
  t.tick(4);
  assert.equal(claw.phase, 'lifting', 'it dropped by itself after autoDropSeconds');
});

test('controller X: holding it pays, a tap drops the claw, and neither starts a reload', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  g.gun.weapon.magazine = 1; // a reload would start if X reached the gun
  pay(t, 'PadX');
  t.tick(3);
  assert.equal(claw.phase, 'sweeping');
  assert.equal(g.gun.weapon.isReloading, false);
  t.tick(20);
  t.press('PadX', 3);
  assert.equal(claw.phase, 'lifting');
  t.tick(5);
  assert.equal(g.gun.weapon.isReloading, false, 'the drop press was not a reload tap');
  // ...while a tap with nothing to buy still reloads.
  t.tick(Math.ceil(cfg.liftSeconds / dt) + 1);
  t.tick(Math.ceil(cfg.takeSeconds / dt) + 1); // the prize times out
  g.player.teleport({ position: new THREE.Vector3(0, 0, 3), yaw: 0 });
  t.tick();
  t.press('PadX', 2);
  t.tick(2);
  assert.equal(g.gun.weapon.isReloading, true);
});

test('walking away mid-grab never hangs it: the claw drops itself, the prize waits, then it is gone with nothing left behind', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  const guns = g.gun.slots.join();
  pay(t);
  g.player.teleport({ position: new THREE.Vector3(-15, 0, 3), yaw: 0 });
  t.tick(Math.ceil(cfg.autoDropSeconds / dt) + 2);
  assert.equal(claw.phase, 'lifting');
  t.tick(Math.ceil(cfg.liftSeconds / dt) + 1);
  assert.equal(claw.phase, 'ready');
  assert.ok(claw.display?.parent, 'the gun in the chute');
  t.tick(Math.ceil(cfg.takeSeconds / dt) + 1);
  assert.equal(claw.phase, 'idle');
  assert.equal(claw.display, null);
  assert.equal(g.map.group.parent.getObjectByName('clawPrize'), undefined);
  assert.ok(claw.site.cabinet.rig.group.userData.capsules.every((m) => !m.visible));
  assert.equal(g.gun.slots.join(), guns, 'no gun given');
});

test('death freezes a grab (nothing paid or given), and Play again leaves no machine state, capsule or display behind', () => {
  const fresh = snapshot(headlessGame().g);
  for (const at of ['sweeping', 'ready']) {
    const s = setup(), { t, g, claw } = s;
    standAtMachine(s);
    pay(t);
    if (at === 'ready') t.tick(Math.ceil((cfg.autoDropSeconds + cfg.liftSeconds) / dt) + 2);
    assert.equal(claw.phase, at);
    g.health.takeDamage(10_000);
    const points = g.wallet.points, guns = g.gun.slots.join();
    t.tick(Math.ceil((cfg.takeSeconds + cfg.autoDropSeconds) / dt));
    assert.equal(claw.phase, at, 'frozen with the game');
    assert.equal(g.wallet.points, points);
    assert.equal(g.gun.slots.join(), guns);
    g.resetRun();
    assert.equal(claw.phase, 'idle');
    assert.equal(claw.grab, null);
    assert.equal(claw.display, null);
    assert.equal(g.map.group.parent.getObjectByName('clawPrize'), undefined);
    assert.ok(claw.site.cabinet.rig.group.userData.capsules.every((m) => !m.visible));
    assert.equal(claw.site.id, cfg.sites[0].id);
    assert.deepEqual(snapshot(g), fresh);
  }
});

test('payment: a sale and the Employee Discount lower the charge; the Discount Code neither applies nor gets spent; free steps cost nothing', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  g.pricing.setDiscount('claw', 0.5);
  let before = g.wallet.points;
  pay(t);
  assert.equal(before - g.wallet.points, economy.claw.grab / 2);
  assert.equal(claw.grab.paid, economy.claw.grab / 2, 'the grab remembers what it actually charged');
  before = g.wallet.points;
  t.press('KeyF', 1); // the drop: free
  t.tick(Math.ceil(cfg.liftSeconds / dt) + 1);
  t.press('KeyF', 20); // the take: free
  assert.equal(g.wallet.points, before);
  g.pricing.setDiscount('claw', 0);

  g.pricing.setVoucher(bossVouchers.discountCode ?? Object.values(bossVouchers).find((v) => v.excludedCategories?.includes('claw')));
  assert.ok(g.pricing.voucher?.excludedCategories?.includes('claw'));
  assert.equal(g.pricing.priceOf('claw', 'grab'), economy.claw.grab, 'the Discount Code does not apply to the claw');
  t.tick(5);
  before = g.wallet.points;
  pay(t);
  assert.equal(before - g.wallet.points, economy.claw.grab);
  assert.ok(g.pricing.voucher, 'and is still there afterwards');
  g.pricing.clearVoucher();
  t.tick(Math.ceil((cfg.autoDropSeconds + cfg.liftSeconds + cfg.takeSeconds) / dt) + 4);

  g.pricing.setCoupon({ fraction: 0.2, maxSaving: 500 });
  before = g.wallet.points;
  pay(t);
  assert.equal(before - g.wallet.points, economy.claw.grab * 0.8);
  assert.equal(claw.grab.paid, economy.claw.grab * 0.8);
});

test('wallet.refund gives points back without counting as income, never more than was spent', () => {
  const changes = [];
  const w = createWallet({ onChange: (amount) => changes.push(amount) });
  w.earn(1000);
  assert.equal(w.spend(800), true);
  w.refund(800);
  assert.equal(w.points, economy.startingPoints + 1000);
  assert.equal(w.totalEarned, 1000, 'not income');
  assert.equal(w.totalSpent, 0);
  w.refund(500);
  assert.equal(w.points, economy.startingPoints + 1000, 'nothing spent: nothing to refund');
  assert.deepEqual(changes, [1000, -800, 800]);
});

test('a full loadout: the take ticket names what it replaces (tier, attachments, name), and taking it swaps the gun in hand', () => {
  const s = setup(), { t, g, claw } = s;
  g.gun.give(weapons.priceGun);
  t.tick(40);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun']);
  assert.equal(g.gun.def.id, 'priceGun');
  standAtMachine(s);
  pay(t);
  t.tick(Math.ceil((cfg.autoDropSeconds + cfg.liftSeconds) / dt) + 2);
  const won = claw.grab.prize.id;
  assert.notEqual(won, 'priceGun');
  assert.equal(g.interactions.prompt?.detail, 'Replaces your Price Gun');
  t.press('KeyF', 20);
  assert.deepEqual(g.gun.slots, ['stapleGun', won]);
  assert.equal(describeCarried(weapons.rivetRifle, [{ id: 'tier', tier: 'platinum' }, { attachment: 'extendedNozzle' }]),
    'Platinum Rivet Rifle with 1 attachment');
});

test('the Hallway cabinet: one collider at least 2.1 m tall, a clear stand point zombies can reach, and nothing before the Hallway is owned', () => {
  const t = headlessGame(), { g } = t;
  t.tick();
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine').instance;
  assert.equal(claw.status.open, false, 'waits until you own the Hallway');
  for (const site of cfg.sites) {
    const { position, normal } = g.features.list.find((f) => f.feature.kind === 'clawMachine').feature.sites.find((x) => x.id === site.id).cabinet;
    const inside = new THREE.Vector3(position.x - normal.x * 0.5, site.floorY + 1, position.z - normal.z * 0.5);
    const solids = g.colliders.filter((b) => b.containsPoint(inside));
    assert.equal(solids.length, 1, `${site.id}: one collider`);
    assert.ok(solids[0].max.y - solids[0].min.y >= 2.1, `${site.id}: too tall to stand on`);
    const stand = new THREE.Vector3(position.x + normal.x * 1.2, site.floorY, position.z + normal.z * 1.2);
    assert.equal(overlapsSolid(stand, 0.35, 1.8, g.colliders, 0.3), false, `${site.id}: clear stand point`);
    for (const id of Object.keys(g.map.zones)) g.map.areaUnlocks.unlock(id);
    t.tick(120);
    const nav = createNavigation(g.colliders, zombieTypes.shopper, g.map.navigation);
    nav.update(dt, stand);
    assert.ok(Number.isFinite(nav.distanceToTarget(-15, 3, 0)), `${site.id}: zombies reach the front`);
  }
});
