import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { kiosk } from '../src/config/kiosk.js';
import { economy } from '../src/config/economy.js';
import { bossVouchers } from '../src/config/bosses.js';
import { hasStatNumber } from '../src/config/effectWords.js';
import { overlapsSolid } from '../src/world/collision.js';
import { createNavigation } from '../src/zombies/navigation.js';
import { zombieTypes } from '../src/config/zombies.js';

function fixture() {
  const t = headlessGame();
  t.tick();
  t.g.rounds.update = () => {};
  t.g.zombies.update = () => {};
  return t;
}

test('Bubble Wrap keeps partial layers, caps purchases, and absorbs before health', () => {
  const { g, sounds } = headlessGame();
  const { health, stats, events } = g;
  const hit = (damage, zombie) => events.emit('playerHit', { damage, zombie });
  assert.equal(health.addArmour(4), 3);
  assert.equal(health.addArmour(), 0);
  stats.damageTakenMultiplier = 0.5;
  hit(40);
  assert.deepEqual(health.armour, [40, 40, 20]);
  assert.equal(stats.health, 100);
  assert.ok(!sounds.includes('bubbleWrapPop'));
  g.player.onFall({ drop: 6, damage: 5 });
  assert.equal(stats.health, 95);
  const regen = health.regenWaitFraction;
  health.invulnerable = true;
  hit(200);
  assert.deepEqual(health.armour, [40, 40, 20]);
  assert.equal(health.regenWaitFraction, regen);
  health.invulnerable = false;
  hit(140, { type: { id: 'guard', boss: true } });
  assert.deepEqual(health.armour, [30]);
  assert.equal(stats.health, 95);
  assert.ok(sounds.includes('bubbleWrapPop'));
  hit(80);
  assert.deepEqual(health.armour, []);
  assert.equal(stats.health, 85);
  assert.match(g.debug.run('armour'), /3 layers/);
  g.resetRun();
  assert.deepEqual(health.armour, []);
});

test('the Hallway cart sells all five products through hold input: the Lethal and Tactical slots alternate, the Pick moves along', () => {
  const t = fixture();
  const { g } = t;
  const { instance } = g.features.list.find(({ feature }) => feature.kind === 'kiosk');
  const startDoor = g.map.doors.find(({ id }) => id === 'startShutter');
  const SLOT = { sodaBomb: 0, sparklerCake: 0, bubbleWrap: 1, airHorn: 2, glitterBomb: 2 };
  const atSlot = (id) => {
    const { position } = instance.site.cart.slots[SLOT[id]];
    t.standAt(position.x, position.z + .9);
    return g.interactions.prompt;
  };
  const pay = (id, price, key = 'KeyF') => {
    const prompt = atSlot(id);
    assert.equal(prompt.id, id);
    assert.equal(prompt.cost, price);
    assert.ok(!hasStatNumber(prompt.detail));
    const before = g.wallet.points;
    t.press(key, 20);
    assert.equal(before - g.wallet.points, price);
    return prompt;
  };
  const announced = [];
  g.events.on('kioskStock', ({ pick, stock }) => announced.push([pick, ...stock]));
  g.wallet.earn(5000);
  assert.equal(atSlot('sodaBomb'), null);
  g.rounds.jumpTo(2);
  assert.equal(atSlot('sodaBomb'), null, 'locked Hallway');
  startDoor.open();
  g.map.zones.hallway.open = true;
  assert.match(atSlot('sodaBomb').title, /Kevin's Pick/);
  pay('sodaBomb', 300);
  assert.equal(g.equipment.status.lethal.count, 4);
  // Round 3: the other product in each alternating slot. A Sparkler Cake replaces the Soda Bombs (its own pocket only).
  g.rounds.jumpTo(3);
  assert.equal(instance.status.pick, 'bubbleWrap');
  assert.deepEqual(instance.status.stock, ['sparklerCake', 'bubbleWrap', 'glitterBomb']);
  assert.match(atSlot('sparklerCake').detail, /Replaces 4 Soda Bombs\./);
  pay('sparklerCake', 400);
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sparklerCake', count: 2 });
  assert.equal(atSlot('sparklerCake').blocked, 'Pocket is full');
  const before = g.wallet.points;
  t.press('KeyF', 20);
  assert.equal(g.wallet.points, before);
  pay('bubbleWrap', 500);
  assert.equal(g.health.armour.length, 2);
  pay('bubbleWrap', 500);
  assert.equal(g.health.armour.length, 3);
  assert.ok(g.interactions.prompt.blocked);
  pay('glitterBomb', 750, 'PadX');
  assert.deepEqual(g.equipment.pockets.tactical, { id: 'glitterBomb', count: 2 });
  // Round 4: back to the first of each, the Pick on the Tactical slot.
  g.rounds.jumpTo(4);
  assert.match(atSlot('airHorn').detail, /Replaces 2 Glitter Bombs\./);
  pay('airHorn', 500);
  assert.deepEqual(g.equipment.pockets.tactical, { id: 'airHorn', count: 3 });
  g.rounds.jumpTo(5);
  assert.match(atSlot('sparklerCake').title, /^Kevin's Pick · Sparkler Cake$/);
  assert.deepEqual(announced, [
    ['sodaBomb', 'sodaBomb', 'bubbleWrap', 'airHorn'],
    ['bubbleWrap', 'sparklerCake', 'bubbleWrap', 'glitterBomb'],
    ['airHorn', 'sodaBomb', 'bubbleWrap', 'airHorn'],
    ['sparklerCake', 'sparklerCake', 'bubbleWrap', 'glitterBomb'],
  ]);
  g.resetRun();
  assert.equal(snapshot(g).kiosk.open, false);
  assert.equal(snapshot(g).kiosk.pick, null);
  assert.deepEqual(snapshot(g).armour, []);
  assert.equal(g.equipment.status.tactical.count, 0);
});

test('hiding cancels an armed purchase and the kiosk uses the live sale, coupon and voucher price', (t) => {
  const game = fixture();
  const { g, input } = game;
  const { instance } = g.features.list.find(({ feature }) => feature.kind === 'kiosk');
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter(({ id }) => id === 'kiosk');
  t.after(() => { economy.flashSales.groups = groups; });
  assert.equal(g.flashSales.startNow(), false);
  g.rounds.jumpTo(2);
  g.map.doors.find(({ id }) => id === 'startShutter').open();
  g.map.zones.hallway.open = true;
  const spot = instance.site.cart.slots[0].position;
  game.standAt(spot.x, spot.z + .9);
  input.pressed.add('KeyF');
  input.held.add('KeyF');
  game.tick(4);
  assert.ok(g.interactions.prompt.progress > 0);
  const zombie = g.zombies.spawn('shopper', instance.site.cart.stand.clone());
  zombie.position.copy(instance.site.cart.stand);
  game.tick(20);
  assert.ok(instance.status.hiding);
  assert.equal(g.interactions.prompt, null);
  assert.equal(g.flashSales.startNow(), false);
  g.zombies.clear();
  game.tick(20);
  input.held.delete('KeyF');
  assert.equal(g.equipment.status.lethal.count, 0, 'must press again');

  assert.equal(g.flashSales.startNow(), true);
  const salePrice = g.interactions.prompt.cost;
  assert.ok(salePrice < 300);
  g.pricing.setCoupon({ fraction: .2, maxSaving: 500 });
  const couponPrice = g.interactions.prompt.cost;
  assert.ok(couponPrice < salePrice);
  for (const voucher of [bossVouchers.masterKey, bossVouchers.signedApproval]) {
    g.pricing.setVoucher(voucher);
    assert.equal(g.interactions.prompt.cost, couponPrice);
    g.pricing.clearVoucher();
  }
  g.pricing.setVoucher(bossVouchers.discountCode);
  const finalPrice = g.interactions.prompt.cost;
  assert.ok(finalPrice < couponPrice);
  const before = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, before - finalPrice);
  assert.equal(g.pricing.voucher, null);
});

test('the Air Horn immediately interrupts charges, respects solid cover and has no payout', () => {
  const t = fixture();
  const { g, sounds } = t;
  t.standAt(0, 8.4);
  const place = (id, x, y, z) => {
    const pos = new THREE.Vector3(x, y, z);
    const zombie = g.zombies.spawn(id, pos);
    zombie.position.copy(pos);
    zombie.state = 'chasing';
    return zombie;
  };
  const cart = place('cartPusher', 0, 0, 10);
  cart.chargeLeft = 2;
  const mascot = place('mascot', 1.5, 0, 10);
  const boss = place('guard', -1, 0, 10);
  const hidden = place('shopper', 0, 0, 5);
  const far = place('shopper', 0, 0, 15);
  const upstairs = place('shopper', 0, 3, 9);
  const targets = [cart, mascot, boss, hidden, far, upstairs];
  const health = targets.map((zombie) => zombie.health);
  const before = g.wallet.points;
  g.equipment.give('airHorn', 2);
  g.equipment.give('sodaBomb', 1);
  t.press('Mouse1');
  assert.equal(cart.chargeLeft, 0);
  assert.equal(cart.staggerTimer, 1.2);
  assert.equal(mascot.staggerTimer, 1.2);
  assert.ok(mascot.velocity.length() < cart.velocity.length());
  for (const zombie of [boss, hidden, far, upstairs]) assert.equal(zombie.staggerTimer, 0, zombie.type.id);
  assert.equal(g.equipment.status.tactical.count, 1);
  assert.equal(g.equipment.live.length, 0);
  t.press('KeyG');
  assert.equal(g.equipment.status.lethal.count, 1, 'shared lockout');
  t.tick(Math.ceil(kiosk.throw.blockSeconds / dt));
  t.press('PadRight');
  assert.equal(g.equipment.status.tactical.count, 0);
  assert.equal(sounds.filter((sound) => sound === 'stadiumAirHorn').length, 2);
  assert.deepEqual(targets.map((zombie) => zombie.health), health);
  assert.equal(g.wallet.points, before);
});

// --- Phase 4: Kevin's five sites and the move rule ---

const kevinOf = (g) => g.features.list.find(({ feature }) => feature.kind === 'kiosk').instance;
// Where a shopper stands to buy from a cart: in front of its middle slot, facing it.
const buyerSpot = (site) => {
  const { position, normal } = site.cart;
  return new THREE.Vector3(position.x + normal.x * .9, site.floorY, position.z + normal.z * .9);
};
function standAtCart(t, g, site) {
  const { normal } = site.cart;
  g.player.teleport({ position: buyerSpot(site), yaw: Math.atan2(normal.x, normal.z) });
  g.player.pitch = 0;
  t.tick();
}
// The collider Kevin stands in (his cart's body).
const cartBox = (g, site) => g.colliders.filter((b) => b.containsPoint(site.cart.stand.clone().setY(site.floorY + .5)));
function openAll(t, g) {
  for (const id of Object.keys(g.map.zones)) g.map.areaUnlocks.unlock(id);
  t.tick(120); // (the shutters roll up)
}

test('every Kevin site: one collider (a vaultable counter or too tall to stand on), a clear stand point zombies reach, no spawn near, a real prompt', () => {
  const t = fixture(), { g } = t;
  const kevin = kevinOf(g);
  assert.deepEqual(kevin.sites.map((s) => s.id), kiosk.sites.map((s) => s.id));
  assert.equal(kevin.site.id, 'hallway', 'every run starts in the Hallway');
  openAll(t, g);
  g.rounds.jumpTo(kiosk.openingRound);
  t.tick();
  const nav = createNavigation(g.colliders, zombieTypes.shopper, g.map.navigation);
  nav.update(dt, new THREE.Vector3(0, 0, 2)); // (the hub)
  for (const site of kevin.sites) {
    const solids = cartBox(g, site);
    assert.equal(solids.length, 1, `${site.id}: one collider`);
    const height = solids[0].max.y - solids[0].min.y;
    assert.ok((height <= 1.1 && solids[0].vaultable) || height >= 2.1, `${site.id}: ${height.toFixed(2)} m is a counter or too tall`);
    const spot = buyerSpot(site);
    assert.equal(overlapsSolid(spot, .35, 1.8, g.colliders, .3), false, `${site.id}: clear stand point`);
    assert.ok(Number.isFinite(nav.distanceToTarget(spot.x, spot.z, spot.y)), `${site.id}: zombies reach the front`);
    for (const p of g.map.spawnPoints) {
      if (Math.abs(p.position.y - site.floorY) > 2) continue;
      const d = Math.hypot(p.position.x - spot.x, p.position.z - spot.z);
      assert.ok(d >= kiosk.spawnClearance, `${site.id}: ${p.name} is only ${d.toFixed(1)} m away`);
    }
    assert.ok(kevin.moveNow(site.id), `${site.id}: he can move there`);
    standAtCart(t, g, site);
    const prompt = g.interactions.prompt;
    assert.equal(prompt?.kind, 'kiosk', `${site.id}: the cart has focus from its stand point`);
    assert.equal(prompt.id, 'bubbleWrap', `${site.id}: the middle product`);
    assert.equal(kevin.status.area, site.where);
    // He ducks here too (the radius is measured from THIS cart).
    const zombie = g.zombies.spawn('shopper', site.cart.stand.clone());
    zombie.position.copy(site.cart.stand);
    t.tick();
    assert.ok(kevin.status.hiding, `${site.id}: hiding`);
    assert.equal(g.interactions.prompt, null);
    g.zombies.clear();
    t.tick();
  }
});

test('the carts leave zombie routes alone: every spawn and stand point still reaches the hub, none more than 3 m longer', () => {
  const t = headlessGame(), { g } = t;
  openAll(t, g);
  const kevin = kevinOf(g);
  const boxes = kevin.sites.map((s) => cartBox(g, s)[0]);
  assert.equal(new Set(boxes).size, kiosk.sites.length, 'one collider each');
  const without = Object.assign(g.colliders.filter((b) => !boxes.includes(b)), { ramps: g.colliders.ramps });
  const hub = new THREE.Vector3(0, 0, 2);
  const points = [...g.map.spawnPoints.map((p) => p.position), ...kevin.sites.map(buyerSpot)];
  const routes = (colliders) => {
    const nav = createNavigation(colliders, zombieTypes.shopper, g.map.navigation);
    nav.update(dt, hub);
    return points.map((p) => nav.distanceToTarget(p.x, p.z, p.y));
  };
  const before = routes(without), after = routes(g.colliders);
  after.forEach((d, i) => {
    assert.ok(Number.isFinite(d), `route ${i} reaches the hub`);
    assert.ok(d - before[i] <= 3, `route ${i}: ${before[i].toFixed(1)} -> ${d.toFixed(1)} m`);
  });
});

test('Kevin opens first in the Hallway at round 2, moves from round 3 with the PA naming the place, and Play again puts him back', () => {
  const t = fixture(), { g } = t;
  const fresh = snapshot(headlessGame().g).kiosk;
  const kevin = kevinOf(g);
  const lines = [], moves = [];
  g.events.on('kioskStock', ({ siteId, pa }) => lines.push([siteId, pa.text]));
  g.events.on('kioskMoved', (e) => moves.push(e));
  openAll(t, g);
  g.rounds.jumpTo(2);
  t.tick();
  assert.equal(kevin.site.id, 'hallway', 'no move at the opening round, even with the whole mall open');
  assert.deepEqual(moves, []);
  assert.deepEqual(lines, [['hallway', "Kevin's cart is open in the Main Hallway. Today on Kevin's cart: Soda Bomb, Bubble Wrap "
    + "and Stadium Air Horn. Kevin's Pick is Soda Bomb."]]);
  g.rounds.jumpTo(3);
  t.tick();
  assert.notEqual(kevin.site.id, 'hallway');
  assert.deepEqual(moves, [{ siteId: kevin.site.id, area: kevin.site.where, moved: true }]);
  assert.deepEqual(lines[1], [kevin.site.id,
    `Kevin's cart is now in ${kevin.site.where}. He's asked us to say it's a limited time only. `
    + "Today on Kevin's cart: Sparkler Cake, Bubble Wrap and Glitter Bomb. Kevin's Pick is Bubble Wrap."]);
  assert.ok(!hasStatNumber(lines[1][1]));
  t.tick(30);
  assert.equal(lines.length, 2, 'one PA line a round');
  g.health.takeDamage(10_000);
  g.resetRun();
  assert.equal(kevin.site.id, 'hallway');
  assert.deepEqual(snapshot(g).kiosk, fresh);
});

test('Kevin only ever opens in an open zone: 40 round starts with part of the mall locked, and he stays put with nowhere to go', () => {
  const t = fixture(), { g } = t;
  const kevin = kevinOf(g);
  g.map.areaUnlocks.unlock('hallway');
  t.tick();
  const moves = [];
  g.events.on('kioskMoved', (e) => moves.push(e));
  g.rounds.jumpTo(3);
  assert.equal(kevin.site.id, 'hallway', 'only the Hallway open: he restocks where he stands');
  assert.deepEqual(moves, [{ siteId: 'hallway', area: 'the Main Hallway', moved: false }]);
  g.map.areaUnlocks.unlock('foodCourt');
  g.map.areaUnlocks.unlock('upstairs');
  t.tick();
  const seen = new Set();
  for (let i = 0; i < 40; i++) {
    const before = kevin.site;
    g.rounds.jumpTo(4 + i);
    t.tick();
    assert.ok(g.map.zones[kevin.site.zone].open, `${kevin.site.id} is open`);
    assert.notEqual(kevin.site, before, 'always a different site when one is open');
    assert.ok(kevin.status.open);
    seen.add(kevin.site.id);
  }
  assert.deepEqual([...seen].sort(), ['foodCourt', 'hallway', 'upstairs']);
  assert.equal(kevin.moveNow('parkingLot'), null, 'never into a locked zone');
});

test('Kevin never moves mid-purchase: a round that starts during a held buy waits for it, then he goes', () => {
  const t = fixture(), { g, input } = t;
  const kevin = kevinOf(g);
  g.map.areaUnlocks.unlock('hallway');
  g.map.areaUnlocks.unlock('foodCourt');
  g.wallet.earn(5000);
  g.rounds.jumpTo(2);
  standAtCart(t, g, kevin.site);
  input.pressed.add('KeyF');
  input.held.add('KeyF');
  t.tick(4);
  assert.ok(g.interactions.prompt.progress > 0, 'the hold has started');
  assert.equal(kevin.moveNow('foodCourt'), null, 'the debug move is refused too');
  g.rounds.jumpTo(3);
  t.tick();
  assert.equal(kevin.site.id, 'hallway', 'still here while the hold lasts');
  assert.equal(kevin.status.pending, 'foodCourt', 'the site is already picked');
  const before = g.wallet.points;
  t.tick(20); // the hold completes: the purchase goes through at the Hallway cart, then he moves
  input.held.delete('KeyF');
  assert.ok(g.wallet.points < before, 'the purchase went through');
  assert.equal(kevin.site.id, 'foodCourt');
  assert.equal(kevin.status.pending, null);
});
