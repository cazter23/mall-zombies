// GRAB-A-GUN, the claw machine (game/features/clawMachine.js, its cabinet maps/mall/clawCabinet.js, config/clawMachine.js),
// played through REAL input in the headless game: the odds, the timed press (keyboard and controller), payment, and that a
// grab can never hang or leave anything behind (walking away, death, Play again).
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { rollCapsules, sweepPosition, laneAt, sweepSeconds, prizePool, describeCarried, plushChanceFor, takeOutcome } from '../src/game/features/clawMachine.js';
import { clawMachine as cfg } from '../src/config/clawMachine.js';
import { economy } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
import { bossVouchers } from '../src/config/bosses.js';
import { createWallet } from '../src/game/wallet.js';
import { createFlashSales } from '../src/game/flashSales.js';
import { overlapsSolid } from '../src/world/collision.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';
import { upgrades } from '../src/config/upgrades.js';
import { attachmentFits, attachmentsOf, withAttachment } from '../src/weapons/upgrades.js';
import { ownsAttachment } from '../src/game/features/attachmentCounter.js';
import { workshopRitual, buildOf } from '../src/config/workshop.js';

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
// A mod list with every attachment slot this gun can use filled (the first attachment that fits each slot).
function fullOfAttachments(id) {
  let mods = [];
  for (const slot of Object.keys(upgrades.attachmentSlots)) {
    const fits = Object.keys(upgrades.attachments).find((a) => upgrades.attachments[a].slot === slot && attachmentFits(weapons[id], a));
    if (fits) mods = withAttachment(weapons[id], mods, fits);
  }
  return mods;
}
// Restock where it stands (the debug move to its own site): the next grab is this site's first, so no plush can come up.
const restock = (claw) => assert.ok(claw.moveNow(claw.site.id));

test('the odds: capsules follow the weights, never repeat in a grab, and never offer the Staple Gun, a full carried gun or one at Build-A-Blaster', () => {
  const fresh = { owns: (id) => id === 'stapleGun', modsFor: () => [], away: null };
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

  // Two carried guns full of attachments and a third on the conveyor are left out, and at least four remain.
  const mods = { coilNailer: fullOfAttachments('coilNailer'), rivetRifle: fullOfAttachments('rivetRifle') };
  const busy = { owns: (id) => ['stapleGun', 'coilNailer', 'rivetRifle'].includes(id), modsFor: (id) => mods[id] ?? [], away: { def: weapons.barcodeScanner } };
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
    restock(claw);
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
    if (g.gun.slots.length === 2 && takeOutcome(g.gun, claw.grab.prize).kind === 'new') assert.match(g.interactions.prompt.detail, /^Replaces your /);
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

test('the GRAB-A-GUN Flash Sale: the PA announces it, the grab charges the sale price, a plush refunds exactly that, and the Discount Code still stays out', () => {
  const s = setup(), { t, g, claw } = s;
  const group = economy.flashSales.groups.find((x) => x.id === 'claw');
  assert.deepEqual(group.categories, ['claw']);
  const sales = createFlashSales({ events: g.events, pricing: g.pricing, random: () => 0.99, config: { ...economy.flashSales, groups: [group] } });
  const started = [];
  g.events.on('flashSaleStart', (e) => started.push(e));
  assert.equal(sales.startNow(), true);
  assert.equal(started[0].id, 'claw');
  assert.match(started[0].pa.text, /^GRAB-A-GUN is 50% off!/);
  g.pricing.setVoucher(bossVouchers.discountCode);
  assert.equal(g.pricing.priceOf('claw', 'grab'), economy.claw.grab / 2, 'the sale only: the Discount Code adds nothing');
  standAtMachine(s);
  const before = { points: g.wallet.points, spent: g.wallet.totalSpent };
  g.debug.run('clawPlush');
  pay(t);
  assert.equal(before.points - g.wallet.points, economy.claw.grab / 2);
  assert.ok(g.pricing.voucher, 'the voucher was not spent on the claw');
  dropOn(t, claw, isPlush);
  t.tick(ticks(cfg.liftSeconds));
  assert.equal(g.wallet.points, before.points, 'refunded the sale price, not the shelf price');
  assert.equal(g.wallet.totalSpent, before.spent);
});

test('payment: a sale and the Employee Discount lower the charge; the Discount Code neither applies nor gets spent; free steps cost nothing', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  g.pricing.setDiscount('claw', 0.5);
  restock(claw);
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
  restock(claw);
  before = g.wallet.points;
  pay(t);
  assert.equal(before - g.wallet.points, economy.claw.grab);
  assert.ok(g.pricing.voucher, 'and is still there afterwards');
  g.pricing.clearVoucher();
  t.tick(Math.ceil((cfg.autoDropSeconds + cfg.liftSeconds + cfg.takeSeconds) / dt) + 4);

  g.pricing.setCoupon({ fraction: 0.2, maxSaving: 500 });
  restock(claw);
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
  rig(g, claw, 'nailGun'); // (a gun you don't carry: a carried one would come up Refurbished, which replaces nothing)
  t.tick(Math.ceil((cfg.autoDropSeconds + cfg.liftSeconds) / dt) + 2);
  const won = claw.grab.prize.id;
  assert.equal(won, 'nailGun');
  assert.equal(g.interactions.prompt?.detail, 'Replaces your Price Gun');
  t.press('KeyF', 20);
  assert.deepEqual(g.gun.slots, ['stapleGun', won]);
  assert.equal(describeCarried(weapons.rivetRifle, [{ id: 'tier', tier: 'platinum' }, { attachment: 'extendedNozzle' }]),
    'Platinum Rivet Rifle with 1 attachment');
});

test('every cabinet: one collider at least 2.1 m tall, a clear stand point zombies can reach, a real prompt there; the start waits for the Hallway', () => {
  const t = headlessGame(), { g } = t;
  t.tick();
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine').instance;
  assert.equal(claw.status.open, false, 'waits until you own the Hallway');
  assert.deepEqual(claw.sites.map((x) => x.cabinet.rig.live), claw.sites.map((_, i) => i === 0), 'only the live one is uncovered');
  openAll(t, g);
  const nav = createNavigation(g.colliders, zombieTypes.shopper, g.map.navigation);
  nav.update(dt, new THREE.Vector3(0, 0, 2)); // (the hub)
  for (const site of cfg.sites) {
    const { position, normal } = claw.sites.find((x) => x.id === site.id).cabinet;
    const inside = new THREE.Vector3(position.x - normal.x * 0.5, site.floorY + 1, position.z - normal.z * 0.5);
    const solids = g.colliders.filter((b) => b.containsPoint(inside));
    assert.equal(solids.length, 1, `${site.id}: one collider`);
    assert.ok(solids[0].max.y - solids[0].min.y >= 2.1, `${site.id}: too tall to stand on`);
    const stand = new THREE.Vector3(position.x + normal.x * 1.2, site.floorY, position.z + normal.z * 1.2);
    assert.equal(overlapsSolid(stand, 0.35, 1.8, g.colliders, 0.3), false, `${site.id}: clear stand point`);
    assert.ok(Number.isFinite(nav.distanceToTarget(stand.x, stand.z, stand.y)), `${site.id}: zombies reach the front`);
    if (claw.site.id !== site.id) assert.ok(claw.moveNow(site.id));
    standAtMachine({ t, g, claw });
    assert.equal(g.interactions.prompt?.kind, 'claw', `${site.id}: the machine has focus from its stand point`);
    assert.equal(claw.status.area, g.map.zones[site.zone].label);
  }
});

// --- Phase 2: plush, stock and relocation ---

const ticks = (seconds) => Math.ceil(seconds / dt) + 1;
// Wait (at most two sweeps) until the claw is over a capsule that passes `wanted`, then press.
function dropOn(t, claw, wanted) {
  for (let i = 0; i < ticks(cfg.sweep.firstSeconds * 2) && !wanted(claw.grab.capsules[claw.lane]); i++) t.tick();
  assert.ok(wanted(claw.grab.capsules[claw.lane]), 'the claw came over the wanted lane');
  t.press('KeyF', 1);
}
const isGun = (c) => !!c && !c.plush;
const isPlush = (c) => !!c?.plush;
function openAll(t, g) {
  for (const id of Object.keys(g.map.zones)) g.map.areaUnlocks.unlock(id);
  t.tick(120);
}
const roundStart = (g) => g.events.emit('roundStart', { round: g.rounds.round + 1 });

test('the plush odds rise with the grabs at a site, and a plush takes exactly one lane', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => plushChanceFor(n)), cfg.plushChance);
  assert.deepEqual(cfg.plushChance, [0, 0, 0.2, 0.4, 0.6, 0.8]);
  const pool = prizePool({ owns: (id) => id === 'stapleGun', away: null });
  const random = seeded(3);
  const lanes = [0, 0, 0];
  for (let i = 0; i < 3000; i++) {
    const always = rollCapsules(pool, 1, random);
    assert.equal(always.filter(isPlush).length, 1);
    assert.equal(new Set(always.filter(isGun).map((c) => c.id)).size, 2);
    lanes[always.findIndex(isPlush)] += 1;
    assert.equal(rollCapsules(pool, 0, random).filter(isPlush).length, 0);
  }
  assert.ok(lanes.every((n) => n > 800), `the plush lands in any lane: ${lanes}`);
});

test('a plush refunds exactly what that grab charged (sale + coupon), not income, closes the machine and picks the next open site then', () => {
  const s = setup(), { t, g, claw } = s;
  openAll(t, g);
  g.map.zones.parkingLot.open = false; // (a locked area is never picked)
  standAtMachine(s);
  const pa = [];
  g.events.on('clawClosed', (e) => pa.push(['closed', e]));
  g.events.on('clawMoved', (e) => pa.push(['moved', e]));
  g.pricing.setDiscount('claw', 0.5);
  g.pricing.setCoupon({ fraction: 0.2, maxSaving: 500 });
  const before = { points: g.wallet.points, spent: g.wallet.totalSpent, earned: g.wallet.totalEarned };
  g.debug.run('clawPlush');
  pay(t);
  const charged = before.points - g.wallet.points;
  assert.equal(charged, economy.claw.grab * 0.5 * 0.8, 'the grab price, half off, then 20% off');
  assert.equal(claw.grab.capsules.filter(isPlush).length, 1);
  dropOn(t, claw, isPlush);
  t.tick(ticks(cfg.liftSeconds));
  assert.equal(claw.phase, 'closed');
  assert.equal(g.wallet.points, before.points, 'exactly the 400 back, not the 1000 shelf price');
  assert.equal(g.wallet.totalSpent, before.spent, 'the payment no longer counts as spent');
  assert.equal(g.wallet.totalEarned, before.earned, 'and the refund is not income');
  assert.equal(g.interactions.prompt?.blocked, 'Out of service · Back next round');
  const next = claw.nextSite;
  assert.ok(next && next !== claw.site && g.map.zones[next.zone].open, 'the next site is known the moment Sunny lands');
  assert.equal(pa[0][0], 'closed');
  assert.equal(pa[0][1].reason, 'plush');
  assert.equal(pa[0][1].nextSiteId, next.id);
  assert.ok(cfg.pa.plush.some((line) => line.text === pa[0][1].pa.text), 'one of the plush PA lines');
  roundStart(g);
  assert.equal(claw.site, next);
  assert.equal(claw.phase, 'idle');
  assert.equal(claw.stock, cfg.stock);
  assert.equal(pa[1][0], 'moved');
  const area = g.map.zones[next.zone].label;
  assert.ok(cfg.pa.moved.some((line) => line.text.replace('{area}', area) === pa[1][1].pa.text), 'one of the moved PA lines, naming the area');
  assert.ok(pa[1][1].pa.text.includes(area));
  assert.ok(next.cabinet.rig.live && !claw.sites[0].cabinet.rig.live, 'the dust sheet moved too');
});

test('six grabs sell a site out: it closes only once the last prize is gone, then reopens elsewhere at the next round', () => {
  const s = setup(), { t, g, claw } = s;
  openAll(t, g);
  standAtMachine(s);
  for (let n = 1; n <= cfg.stock; n++) {
    assert.equal(claw.phase, 'idle', `grab ${n}`);
    assert.equal(claw.stock, cfg.stock - n + 1);
    pay(t);
    assert.ok(Math.abs(claw.grab.period - sweepSeconds(n)) < 1e-9, 'quicker each grab');
    dropOn(t, claw, isGun);
    t.tick(ticks(cfg.liftSeconds));
    assert.equal(claw.phase, 'ready', 'the last prize waits like any other');
    t.press('KeyF', 20);
  }
  assert.equal(claw.phase, 'closed');
  assert.equal(claw.nextSite, null, 'a sell-out picks its site at the round');
  const from = claw.site;
  t.tick(600);
  assert.equal(claw.site, from, 'closed until the round starts');
  roundStart(g);
  assert.notEqual(claw.site, from);
  assert.equal(claw.phase, 'idle');
  assert.equal(claw.stock, cfg.stock);
});

test('a sold-out machine whose last prize times out still closes; with no other open site it restocks where it stands', () => {
  const s = setup(), { t, g, claw } = s; // (only the start room and the Hallway are open)
  standAtMachine(s);
  for (let n = 1; n <= cfg.stock; n++) {
    pay(t);
    dropOn(t, claw, isGun);
    t.tick(ticks(cfg.liftSeconds));
    if (n < cfg.stock) t.press('KeyF', 20);
  }
  assert.equal(claw.phase, 'ready');
  t.tick(ticks(cfg.takeSeconds));
  assert.equal(claw.phase, 'closed');
  const moved = [];
  g.events.on('clawMoved', (e) => moved.push(e));
  roundStart(g);
  assert.equal(claw.site.id, 'hallway');
  assert.equal(claw.phase, 'idle');
  assert.equal(claw.stock, cfg.stock);
  assert.equal(moved[0].moved, false);
  assert.ok(cfg.pa.restocked.some((line) => line.text.replace('{area}', 'Main Hallway') === moved[0].pa.text));
});

test('the machine only ever opens in an open zone: 40 relocations with part of the mall locked', () => {
  const s = setup(), { t, g, claw } = s;
  g.map.areaUnlocks.unlock('foodCourt');
  g.map.areaUnlocks.unlock('megaMart');
  t.tick(120);
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const before = claw.site;
    if (i % 2) { // half by plush (the site picked when he lands, opened at the round), half by the debug move
      g.debug.run('clawPlush');
      standAtMachine(s);
      pay(t);
      dropOn(t, claw, isPlush);
      t.tick(ticks(cfg.liftSeconds));
      assert.equal(claw.phase, 'closed');
      roundStart(g);
    } else {
      g.debug.run('clawMove');
    }
    assert.ok(g.map.zones[claw.site.zone].open, `${claw.site.id} is open`);
    assert.notEqual(claw.site, before, 'always a different site when one is open');
    seen.add(claw.site.id);
  }
  assert.deepEqual([...seen].sort(), ['foodCourt', 'hallway', 'megaMart']);
});

test('it never moves during a grab: the debug move is refused until the grab is over', () => {
  const s = setup(), { t, g, claw } = s;
  openAll(t, g);
  standAtMachine(s);
  pay(t);
  assert.match(g.debug.run('clawMove'), /^Not moved/);
  assert.equal(claw.site.id, 'hallway');
  t.tick(ticks(cfg.autoDropSeconds + cfg.liftSeconds));
  assert.match(g.debug.run('clawMove'), /^Not moved/);
  t.tick(ticks(cfg.takeSeconds));
  assert.match(g.debug.run('clawMove'), /^GRAB-A-GUN moved to /);
});

test('Play again after the machine moved: back at the Hallway, every other cabinet sheeted, full stock, same as a fresh game', () => {
  const fresh = snapshot(headlessGame().g);
  const s = setup(), { t, g, claw } = s;
  openAll(t, g);
  g.debug.run('clawMove');
  standAtMachine(s);
  pay(t);
  t.tick(ticks(cfg.autoDropSeconds + cfg.liftSeconds));
  g.health.takeDamage(10_000);
  g.resetRun();
  assert.equal(claw.site.id, 'hallway');
  assert.equal(claw.stock, cfg.stock);
  assert.deepEqual(claw.sites.map((x) => x.cabinet.rig.live), claw.sites.map((_, i) => i === 0));
  assert.equal(g.map.group.parent.getObjectByName('clawPrize'), undefined);
  assert.deepEqual(snapshot(g), fresh);
});

test('the six cabinets leave zombie routes alone: every spawn and stand point still reaches the hub, none more than 3 m longer', () => {
  const t = headlessGame(), { g } = t;
  openAll(t, g);
  const claw = g.features.list.find((f) => f.feature.kind === 'clawMachine');
  const cabinets = claw.feature.sites.map((site) => {
    const { position, normal } = site.cabinet;
    const floorY = cfg.sites.find((x) => x.id === site.id).floorY;
    const inside = new THREE.Vector3(position.x - normal.x * 0.5, floorY + 1, position.z - normal.z * 0.5);
    return { box: g.colliders.find((b) => b.containsPoint(inside)), stand: new THREE.Vector3(position.x + normal.x * 1.2, floorY, position.z + normal.z * 1.2) };
  });
  assert.equal(new Set(cabinets.map((c) => c.box)).size, cfg.sites.length, 'one collider each');
  const without = Object.assign(g.colliders.filter((b) => !cabinets.some((c) => c.box === b)), { ramps: g.colliders.ramps });
  const hub = new THREE.Vector3(0, 0, 2);
  const routes = (colliders) => {
    const nav = createNavigation(colliders, zombieTypes.shopper, g.map.navigation);
    nav.update(dt, hub);
    return [...g.map.spawnPoints.map((p) => p.position), ...cabinets.map((c) => c.stand)].map((p) => nav.distanceToTarget(p.x, p.z, p.y));
  };
  const before = routes(without), after = routes(g.colliders);
  after.forEach((d, i) => {
    assert.ok(Number.isFinite(d), `route ${i} reaches the hub`);
    assert.ok(d - before[i] <= 3, `route ${i}: ${before[i].toFixed(1)} -> ${d.toFixed(1)} m`);
  });
});

// --- Phase 3: Refurbished prizes, late changes, Build-A-Blaster ---

// The prize the claw will land on: every lane holds this capsule (built by the REAL pool and roll from the loadout as it is).
// Rigging all three lanes keeps the test about the take, not about timing the drop.
function rig(g, claw, id, { refurbished, spare } = {}) {
  const entry = prizePool(g.gun).find((p) => p.id === id);
  assert.ok(entry, `${id} is in the pool`);
  const capsule = { ...rollCapsules([entry], 0, seeded(5))[0] };
  if (refurbished !== undefined) capsule.refurbished = refurbished;
  if (spare !== undefined) capsule.spare = spare;
  claw.grab.capsules = [capsule, capsule, capsule];
  return capsule;
}
// Pay at the machine, rig the prize, and let it drop and come to the chute.
function grabUntilReady(s, id, options) {
  const { t, g, claw } = s;
  restock(claw);
  standAtMachine(s);
  pay(t);
  const capsule = rig(g, claw, id, options);
  t.tick(ticks(cfg.autoDropSeconds + cfg.liftSeconds));
  assert.equal(claw.phase, 'ready');
  return capsule;
}
const takePrize = (t) => t.press('KeyF', 20);
const switchTo = (t, g, id) => { if (g.gun.def.id !== id) { t.press(g.gun.slots.indexOf(id) === 0 ? 'Digit1' : 'Digit2', 1); t.tick(60); } };

test('the pool: a carried gun comes up Refurbished with an attachment for one of its empty slots; full, or at Build-A-Blaster, it does not come up', () => {
  const s = setup(), { t, g } = s;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  let entry = prizePool(g.gun).find((p) => p.id === 'nailGun');
  const fits = Object.keys(upgrades.attachments).filter((a) => attachmentFits(weapons.nailGun, a));
  assert.deepEqual(entry.attachments, fits, 'a bare carried gun: any attachment that fits');
  g.gun.setMods('nailGun', withAttachment(weapons.nailGun, [], 'gripTape'));
  entry = prizePool(g.gun).find((p) => p.id === 'nailGun');
  assert.ok(!entry.attachments.some((a) => upgrades.attachments[a].slot === 'grip'), 'never for a slot that is already fitted');
  const random = seeded(11);
  for (let i = 0; i < 500; i++) {
    for (const c of rollCapsules(prizePool(g.gun), 0, random)) {
      if (c.id === 'nailGun') assert.ok(entry.attachments.includes(c.refurbished), 'its attachment is rolled with it');
      else assert.equal(c.refurbished, null, `${c.id} is not carried: a plain prize`);
      assert.ok(attachmentFits(weapons[c.id], c.spare), 'a spare that fits, in case you buy it before you take it');
    }
  }
  g.gun.setMods('nailGun', fullOfAttachments('nailGun'));
  assert.ok(!prizePool(g.gun).some((p) => p.id === 'nailGun'), 'carried with nothing that fits: not offered');
});

test('taking a Refurbished prize refills that gun and fits its attachment, in hand or not; the attachment then refits free', () => {
  const s = setup(), { t, g, claw } = s;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  switchTo(t, g, 'stapleGun');
  const nail = g.gun.weaponFor('nailGun');
  nail.magazine = 1; nail.reserve = 0;
  grabUntilReady(s, 'nailGun', { refurbished: 'gripTape' });
  assert.equal(g.interactions.prompt?.title, 'Take the Nail Gun + Grip Tape');
  assert.match(g.interactions.prompt.detail, /^Refurbished · Refills your Nail Gun · Fits Grip Tape free/);
  const prizes = [];
  g.events.on('clawPrize', (e) => prizes.push(e));
  takePrize(t);
  assert.deepEqual(prizes, [{ gunId: 'nailGun', refurbished: 'gripTape', outcome: 'refurbish' }]);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun'], 'no gun replaced');
  assert.equal(g.gun.def.id, 'stapleGun', 'still the gun in your hand');
  assert.equal(attachmentsOf(g.gun.modsFor('nailGun')).grip, 'gripTape');
  assert.ok(g.gun.weaponFor('nailGun').isFull);
  assert.ok(ownsAttachment(g.gun, 'gripTape'), 'owned for the run: refits are free');
});

test('a Refurbished take never replaces a fitted attachment, and waits while the gun in hand is reloading', () => {
  const s = setup(), { t, g, claw } = s;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  grabUntilReady(s, 'nailGun', { refurbished: 'gripTape' });
  g.gun.weapon.magazine = 1;
  t.press('KeyR', 1); // reloading the Nail Gun in hand
  assert.ok(g.gun.weapon.isReloading);
  assert.equal(g.interactions.prompt?.blocked, 'Busy · Finish reloading first');
  takePrize(t);
  assert.equal(claw.phase, 'ready', 'refused while reloading');
  t.tick(ticks(weapons.nailGun.reloadSeconds ?? 3));
  assert.equal(g.gun.weapon.isReloading, false);
  g.gun.setMods('nailGun', withAttachment(weapons.nailGun, g.gun.modsFor('nailGun'), 'wristband')); // the grip slot filled meanwhile
  assert.equal(g.interactions.prompt?.blocked, null);
  assert.equal(g.interactions.prompt.title, 'Take the Nail Gun', 'now just a refill');
  takePrize(t);
  assert.equal(claw.phase, 'idle');
  assert.equal(attachmentsOf(g.gun.modsFor('nailGun')).grip, 'wristband', 'the fitted attachment stays');
  assert.equal(ownsAttachment(g.gun, 'gripTape'), false);
});

test('late change: the rolled gun bought off the wall before the take becomes a refill plus its spare attachment (if that slot is free)', () => {
  for (const [spare, expect] of [['gripTape', 'refurbish'], ['speedLoader', 'refill']]) {
    const s = setup(), { t, g, claw } = s;
    const capsule = grabUntilReady(s, 'priceGun', { spare });
    assert.equal(capsule.refurbished, null, 'rolled as a plain prize');
    g.gun.give(weapons.priceGun); // (the wall buy's own call)
    t.tick(40);
    if (expect === 'refill') g.gun.setMods('priceGun', withAttachment(weapons.priceGun, [], 'jumboPack')); // its magazine slot is taken
    g.gun.weaponFor('priceGun').reserve = 0;
    assert.equal(takeOutcome(g.gun, claw.grab.prize).kind, expect);
    takePrize(t);
    assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun'], 'no second copy');
    assert.ok(g.gun.weaponFor('priceGun').isFull);
    if (expect === 'refurbish') assert.equal(attachmentsOf(g.gun.modsFor('priceGun')).grip, 'gripTape');
    else assert.equal(attachmentsOf(g.gun.modsFor('priceGun')).magazine, 'jumboPack');
  }
});

test('late change: a Refurbished gun you no longer carry comes as a plain copy', () => {
  const s = setup(), { t, g, claw } = s;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  g.gun.setMods('nailGun', withAttachment(weapons.nailGun, [], 'wristband'));
  grabUntilReady(s, 'nailGun', { refurbished: 'jumboPack' });
  switchTo(t, g, 'nailGun');
  g.gun.give(weapons.priceGun); // replaces the Nail Gun in hand
  t.tick(40);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'priceGun']);
  assert.equal(g.interactions.prompt?.title, 'Take the Nail Gun');
  assert.equal(g.interactions.prompt.detail, 'Replaces your Price Gun');
  takePrize(t);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun']);
  assert.deepEqual(g.gun.modsFor('nailGun'), [], 'plain: neither its old attachment nor the rolled one');
});

// Build-A-Blaster, for real: the bench upstairs, the order form, the conveyor, collection.
function workshop(s) {
  const { t, g } = s;
  g.map.areaUnlocks.openAll();
  t.tick(120);
  const bench = g.map.features.find((f) => f.kind === 'workshop');
  const ritual = g.features.list.find((f) => f.feature.kind === 'workshop').instance.ritual;
  const upper = g.map.navigation.floors[1];
  const face = (spot, x, z, yaw) => { g.player.teleport({ position: new THREE.Vector3(x, upper, z), yaw }); g.player.pitch = 0; t.tick(); };
  return {
    ritual,
    start() {
      ritual.choose('smoothie', 'headshot');
      face(bench.position, bench.position.x, bench.position.z - 1, Math.PI);
      t.press('KeyF', 20); t.tick();
      t.press('KeyF'); t.tick();
      assert.equal(ritual.phase, 'running');
    },
    finish() {
      ritual.finishNow();
      t.tick(ticks(workshopRitual.catchUpSeconds) + 2);
      if (ritual.phase === 'ready') { // (it waits at the booth when taking it would cost you a gun)
        const b = bench.stations.booth;
        face(b, b.x - 1, b.z, -Math.PI / 2);
        t.press('KeyF', 20); t.tick();
      }
      assert.equal(ritual.phase, 'idle');
    },
  };
}

test('late change: a rolled gun handed to Build-A-Blaster comes as a plain copy, and the finished gun replaces that copy at collection', () => {
  const s = setup(), { t, g, claw } = s;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  const bab = workshop(s);
  grabUntilReady(s, 'nailGun', { refurbished: 'gripTape' });
  switchTo(t, g, 'nailGun');
  bab.start(); // the Nail Gun rides the conveyor
  assert.equal(g.gun.away.def.id, 'nailGun');
  standAtMachine(s);
  assert.equal(g.interactions.prompt?.title, 'Take the Nail Gun');
  takePrize(t);
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun'], 'a plain copy in the free slot');
  assert.deepEqual(g.gun.modsFor('nailGun'), []);
  bab.finish();
  assert.deepEqual(g.gun.slots, ['stapleGun', 'nailGun'], 'the finished gun took the copy\'s place');
  assert.ok(buildOf(g.gun.modsFor('nailGun')), 'with its build');
});

test('Build-A-Blaster: the machine works during a ritual and with the Courtesy Loaner (no Refurbished prize for it); the loaner still goes back', () => {
  const s = setup(), { t, g, claw } = s;
  const bab = workshop(s);
  bab.start(); // only the Staple Gun: it goes, and the loaner comes up
  assert.ok(g.gun.isLoaner);
  assert.ok(prizePool(g.gun).every((p) => !p.attachments), 'nothing you carry can come up Refurbished');
  const capsule = grabUntilReady(s, 'rivetRifle');
  assert.equal(g.interactions.prompt?.detail, 'Fills your free slot');
  takePrize(t);
  assert.equal(g.gun.slots.length, 2);
  assert.ok(g.gun.hasLoaner);
  assert.ok(g.gun.owns(capsule.id));
  bab.finish(); // the Staple Gun comes back over the loaner
  assert.equal(g.gun.hasLoaner, false);
  assert.deepEqual([...g.gun.slots].sort(), ['rivetRifle', 'stapleGun']);
  assert.ok(buildOf(g.gun.modsFor('stapleGun')));
});

test('Build-A-Blaster: a Refurbished attachment stacks with a finished build, and a grab works while the gun waits at the booth', () => {
  const s = setup(), { t, g, claw } = s;
  g.gun.give(weapons.nailGun);
  t.tick(40);
  const bab = workshop(s);
  switchTo(t, g, 'nailGun');
  bab.start();
  bab.finish();
  const build = buildOf(g.gun.modsFor('nailGun'));
  assert.ok(build);
  grabUntilReady(s, 'nailGun', { refurbished: 'laserPointer' });
  takePrize(t);
  assert.deepEqual(buildOf(g.gun.modsFor('nailGun')), build, 'the build stays');
  assert.equal(attachmentsOf(g.gun.modsFor('nailGun')).sight, 'laserPointer');

  // Another ritual, then a second gun bought meanwhile: the finished gun waits at the booth. The machine still works.
  bab.start();
  g.gun.give(weapons.priceGun);
  t.tick(40);
  bab.ritual.finishNow();
  t.tick(ticks(workshopRitual.catchUpSeconds) + 2);
  assert.equal(bab.ritual.phase, 'ready');
  const won = grabUntilReady(s, 'confettiCannon');
  takePrize(t);
  assert.ok(g.gun.owns(won.id));
  assert.equal(bab.ritual.phase, 'ready', 'still waiting for you at the booth');
});

// --- Phase 5: the show (looks and sounds only) ---

test('the lift is only a show: prongs open on the way down and shut on the capsule, it swings, and the prize is still the one pressed', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  const { rig } = claw.site.cabinet;
  for (let i = 0; i < 4; i++) {
    restock(claw);
    pay(t);
    t.tick(17 * (i + 1));
    const pressed = claw.grab.capsules[claw.lane];
    t.press('KeyF', 1);
    let opened = 0, carried = false, swung = false;
    const capsules = rig.group.userData.capsules;
    const rest = capsules.map((m) => m.position.clone());
    for (let k = 0; k < ticks(cfg.liftSeconds) - 2; k++) {
      t.tick();
      opened = Math.max(opened, rig.clawOpen);
      const lane = claw.grab.lane;
      if (capsules[lane].position.distanceTo(rest[lane]) > 0.2) carried = true;
      if (Math.abs(capsules[lane].rotation.z) > 0.01) swung = true;
    }
    assert.ok(opened > 0.8, 'the prongs opened wide');
    assert.ok(carried, 'the capsule left the pit with the claw');
    assert.ok(swung, 'and swung on the way');
    t.tick(4);
    assert.equal(claw.grab.prize, pressed, 'the prize is the capsule under the claw at the press');
    takePrize(t);
  }
});

test('the chute flap swings out as the prize lands and comes back to rest exactly where it was built', () => {
  const s = setup(), { t, claw } = s;
  standAtMachine(s);
  const { flap } = claw.site.cabinet.rig;
  const rest = flap.position.clone();
  pay(t);
  t.tick(ticks(cfg.autoDropSeconds + cfg.liftSeconds) - 1);
  let widest = 0;
  for (let k = 0; k < ticks(cfg.show.flapSeconds) + 2; k++) {
    t.tick();
    widest = Math.max(widest, Math.abs(flap.rotation.x) + Math.abs(flap.rotation.z));
  }
  assert.equal(claw.phase, 'ready');
  assert.ok(widest > 0.5, 'it swung');
  t.tick(30);
  assert.equal(flap.rotation.x + flap.rotation.z, 0);
  assert.ok(flap.position.distanceTo(rest) < 1e-9);
});

test('the sounds: a jingle on paying, a tick into each lane, the motor, a fanfare; nothing from across the mall', () => {
  const s = setup(), { t, g, claw } = s;
  standAtMachine(s);
  const from = t.sounds.length;
  pay(t);
  t.tick(ticks(cfg.sweep.firstSeconds));
  const sweep = t.sounds.slice(from);
  assert.ok(sweep.includes('clawJingle'));
  assert.ok(sweep.filter((n) => n === 'clawTick').length >= 4, 'a tick at each lane change (four in one sweep there and back)');
  t.press('KeyF', 1);
  t.tick(ticks(cfg.liftSeconds));
  for (const name of ['clawMotorDown', 'clawGrab', 'clawMotorUp', 'clawWin']) assert.ok(t.sounds.slice(from).includes(name), name);
  takePrize(t);
  // Far away, the machine is silent (its sounds fade out by cfg.show.soundRange).
  restock(claw);
  standAtMachine(s);
  pay(t);
  g.player.teleport({ position: new THREE.Vector3(-17, 0, 3), yaw: 0 });
  const quiet = t.sounds.length;
  t.tick(ticks(cfg.autoDropSeconds + cfg.liftSeconds));
  assert.deepEqual(t.sounds.slice(quiet).filter((n) => n.startsWith('claw')), []);
});

test('the hum follows the live machine and goes quiet while it is closed; a dust-sheeted cabinet hides its claw', () => {
  const s = setup(), { t, g, claw } = s;
  const hum = g.map.ambience.find((e) => e.id === 'claw_hum');
  assert.equal(hum.kind, 'clawHum');
  assert.equal(hum.zone, 'hallway');
  assert.deepEqual(hum.position, claw.site.cabinet.position.toArray());
  for (const site of claw.sites.slice(1)) {
    assert.equal(site.cabinet.rig.live, false);
    assert.ok(site.cabinet.rig.group.children.filter((m) => m.name === 'claw_part' || m.name === 'claw_capsule').every((m) => !m.visible), `${site.id}: nothing to draw under the sheet`);
    assert.ok(site.cabinet.rig.group.children.filter((m) => m.name === 'claw_sheet').every((m) => m.visible));
  }
  openAll(t, g);
  claw.moveNow('megaMart');
  assert.equal(hum.zone, 'megaMart');
  assert.deepEqual(hum.position, claw.site.cabinet.position.toArray());
  assert.ok(claw.site.cabinet.rig.group.children.filter((m) => m.name === 'claw_part').every((m) => m.visible));
  standAtMachine(s);
  g.debug.run('clawPlush');
  pay(t);
  dropOn(t, claw, isPlush);
  t.tick(ticks(cfg.liftSeconds));
  assert.equal(claw.phase, 'closed');
  assert.equal(hum.zone, null, 'silent while out of order');
  assert.ok(t.sounds.includes('clawPlush'));
});

test('the idle screen takes turns with its attract lines; every PA list has a few lines and names the area where it should', () => {
  const s = setup(), { t, claw } = s;
  const shown = [];
  const screen = claw.site.cabinet.screen;
  const original = screen.show;
  screen.show = (text) => { shown.push(text.lines.join(' ')); original(text); };
  t.tick(ticks(cfg.show.attractSeconds * cfg.screen.attract.length));
  screen.show = original;
  assert.equal(new Set(shown).size, cfg.screen.attract.length);
  assert.ok(shown.some((l) => l.includes(`${economy.claw.grab} PTS`)), 'the price is one of them');
  for (const [reason, lines] of Object.entries(cfg.pa)) {
    assert.ok(lines.length >= 2, reason);
    for (const line of lines) {
      assert.ok(line.kicker && line.text.includes('GRAB-A-GUN'), `${reason}: ${line.text}`);
      if (reason === 'moved' || reason === 'restocked') assert.ok(line.text.includes('{area}'), line.text);
    }
  }
});

// --- Phase 6: prize tickets from every grab ---

test('every outcome prints its tickets: by the prize capsule, 10 for the plush, nothing for a prize left to time out; never points', () => {
  const s = setup(), { t, g, claw } = s;
  for (const [id, colour] of [['priceGun', 'green'], ['foamDartBlaster', 'blue'], ['barcodeScanner', 'purple'], ['coilNailer', 'gold']]) {
    const before = g.tickets.count, earned = g.wallet.totalEarned;
    const capsule = grabUntilReady(s, id);
    assert.equal(capsule.capsule, colour);
    takePrize(t);
    assert.equal(g.tickets.count - before, cfg.tickets.capsules[colour], `${id}: ${colour}`);
    assert.equal(g.wallet.totalEarned, earned, 'tickets are not income');
    t.tick(40);
  }
  let before = g.tickets.count;
  grabUntilReady(s, 'nailGun');
  t.tick(ticks(cfg.takeSeconds));
  assert.equal(claw.phase, 'idle');
  assert.equal(g.tickets.count, before, 'a prize left in the chute prints nothing');
  restock(claw);
  before = g.tickets.count;
  const won = [];
  g.events.on('ticketsWon', (e) => won.push(e));
  g.debug.run('clawPlush');
  pay(t);
  dropOn(t, claw, isPlush);
  t.tick(ticks(cfg.liftSeconds));
  assert.equal(g.tickets.count - before, cfg.tickets.plush);
  assert.deepEqual(won.at(-1), { amount: cfg.tickets.plush, total: g.tickets.count, reason: 'plush' });
});
