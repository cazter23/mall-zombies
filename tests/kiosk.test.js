import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { kiosk } from '../src/config/kiosk.js';
import { economy } from '../src/config/economy.js';
import { createEvents } from '../src/game/events.js';
import { buildKiosk } from '../src/game/features/kiosk.js';
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
  const { layerStrength: S, maxLayers } = kiosk.bubbleWrap; // (three layers; each more than the 20 the first hit takes)
  assert.equal(maxLayers, 3);
  assert.equal(health.addArmour(4), 3);
  assert.equal(health.addArmour(), 0);
  stats.damageTakenMultiplier = 0.5;
  hit(40);
  assert.deepEqual(health.armour, [S, S, S - 20]);
  assert.equal(stats.health, 100);
  assert.ok(!sounds.includes('bubbleWrapPop'));
  g.player.onFall({ drop: 6, damage: 5 });
  assert.equal(stats.health, 95);
  const regen = health.regenWaitFraction;
  health.invulnerable = true;
  hit(200);
  assert.deepEqual(health.armour, [S, S, S - 20]);
  assert.equal(health.regenWaitFraction, regen);
  health.invulnerable = false;
  hit(2 * (2 * S - 10), { type: { id: 'guard', boss: true } }); // halved: the partial layer, the next whole one, 10 of the last
  assert.deepEqual(health.armour, [S - 10]);
  assert.equal(stats.health, 95);
  assert.ok(sounds.includes('bubbleWrapPop'));
  hit(80); // halved to 40: the rest of the wrap, then health
  assert.deepEqual(health.armour, []);
  assert.equal(stats.health, 95 - (40 - (S - 10)));
  assert.match(g.debug.run('armour'), /3 layers/);
  g.resetRun();
  assert.deepEqual(health.armour, []);
});

test('the Hallway cart sells all six products through hold input: each slot rotates, the Pick goes to whatever waited longest', () => {
  const t = fixture();
  const { g } = t;
  const { instance } = g.features.list.find(({ feature }) => feature.kind === 'kiosk');
  const startDoor = g.map.doors.find(({ id }) => id === 'startShutter');
  const SLOT = { sodaBomb: 0, sparklerCake: 0, sentry: 0, bubbleWrap: 1, airHorn: 2, glitterBomb: 2 };
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
  g.wallet.earn(8000);
  assert.equal(atSlot('sodaBomb'), null);
  g.rounds.jumpTo(2);
  assert.equal(atSlot('sodaBomb'), null, 'locked Hallway');
  startDoor.open();
  g.map.zones.hallway.open = true;
  assert.match(atSlot('sodaBomb').title, /Kevin's Pick/);
  pay('sodaBomb', economy.kiosk.sodaBomb);
  assert.equal(g.equipment.status.lethal.count, 4);
  // Round 3: the next product in each slot. A Sparkler Cake (the Pick: it has never been it) replaces the Soda Bombs.
  g.rounds.jumpTo(3);
  assert.equal(instance.status.pick, 'sparklerCake');
  assert.deepEqual(instance.status.stock, ['sparklerCake', 'bubbleWrap', 'glitterBomb']);
  assert.match(atSlot('sparklerCake').detail, /Replaces 4 Soda Bombs\./);
  pay('sparklerCake', economy.kiosk.sparklerCake);
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sparklerCake', count: 3 }, 'two and the Pick');
  assert.equal(atSlot('sparklerCake').blocked, 'Pocket is full');
  const before = g.wallet.points;
  t.press('KeyF', 20);
  assert.equal(g.wallet.points, before);
  for (let layers = 1; layers <= 3; layers++) {
    pay('bubbleWrap', economy.kiosk.bubbleWrap);
    assert.equal(g.health.armour.length, layers);
  }
  assert.ok(atSlot('bubbleWrap').blocked);
  pay('glitterBomb', economy.kiosk.glitterBomb, 'PadX');
  assert.deepEqual(g.equipment.pockets.tactical, { id: 'glitterBomb', count: 2 });
  // Round 4: the Sentry's round (never the Pick: Bubble Wrap is, the one that has waited longest).
  g.rounds.jumpTo(4);
  assert.equal(instance.status.pick, 'bubbleWrap');
  assert.match(atSlot('sentry').detail, /Replaces 3 Sparkler Cakes\./);
  pay('sentry', economy.kiosk.sentry);
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sentry', count: 1 });
  assert.match(atSlot('airHorn').detail, /Replaces 2 Glitter Bombs\./);
  pay('airHorn', economy.kiosk.airHorn);
  assert.deepEqual(g.equipment.pockets.tactical, { id: 'airHorn', count: 2 });
  g.rounds.jumpTo(5);
  assert.match(atSlot('glitterBomb').title, /^Kevin's Pick · Glitter Bomb$/);
  assert.deepEqual(announced, [
    ['sodaBomb', 'sodaBomb', 'bubbleWrap', 'airHorn'],
    ['sparklerCake', 'sparklerCake', 'bubbleWrap', 'glitterBomb'],
    ['bubbleWrap', 'sentry', 'bubbleWrap', 'airHorn'],
    ['glitterBomb', 'sodaBomb', 'bubbleWrap', 'glitterBomb'],
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
  assert.ok(salePrice < economy.kiosk.sodaBomb);
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

test('Kevin\'s Flash Sale waits until his cart is open and puts prices back; the Discount Code halves the Sentry once, door and tier vouchers never apply', (t) => {
  const game = fixture();
  const { g } = game;
  const { instance } = g.features.list.find(({ feature }) => feature.kind === 'kiosk');
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter(({ id }) => id === 'kiosk');
  t.after(() => { economy.flashSales.groups = groups; });
  const shelf = economy.kiosk.sentry;
  // Shut (round 1), then open for the round but behind the locked start shutter (his first site is the Hallway): no Kevin sale.
  assert.equal(g.flashSales.startNow(), false);
  g.rounds.jumpTo(4); // the Lethal slot's third product: the Sentry
  assert.equal(instance.status.stock[0], 'sentry');
  assert.equal(instance.status.open, false);
  assert.equal(g.flashSales.startNow(), false, 'nothing to discount behind a locked zone');
  g.map.doors.find(({ id }) => id === 'startShutter').open();
  g.map.zones.hallway.open = true;
  assert.equal(g.flashSales.startNow(), true);
  const { discount } = g.flashSales.active;
  assert.equal(g.pricing.priceOf('kiosk', 'sentry'), Math.round((shelf * (1 - discount)) / economy.discountRoundTo) * economy.discountRoundTo);
  g.flashSales.update(economy.flashSales.durationSeconds + 1);
  assert.equal(g.flashSales.active, null);
  for (const id of Object.keys(economy.kiosk)) assert.equal(g.pricing.priceOf('kiosk', id), economy.kiosk[id], `${id} is back to its shelf price`);

  g.wallet.earn(10000);
  const spot = instance.site.cart.slots[0].position;
  game.standAt(spot.x, spot.z + .9);
  game.tick(2);
  assert.equal(g.interactions.prompt.id, 'sentry');
  for (const voucher of [bossVouchers.masterKey, bossVouchers.signedApproval]) {
    g.pricing.setVoucher(voucher);
    assert.equal(g.interactions.prompt.cost, shelf, `${voucher.name} is for doors and tiers`);
    g.pricing.clearVoucher();
  }
  g.pricing.setVoucher(bossVouchers.discountCode);
  const half = shelf - Math.min(bossVouchers.discountCode.maxSaving, Math.floor((shelf * bossVouchers.discountCode.fraction) / economy.discountRoundTo) * economy.discountRoundTo);
  assert.equal(g.interactions.prompt.cost, half);
  const before = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, before - half);
  assert.equal(g.pricing.voucher, null, 'one purchase spends it');
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sentry', count: 1 }, 'never the Pick: one Sentry');
  assert.equal(g.pricing.priceOf('kiosk', 'sentry'), shelf);
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
  const blasts = [];
  g.events.on('airHornBlast', (e) => blasts.push(e));
  t.press('Mouse1');
  assert.equal(blasts.length, 1, 'the blast is announced (its ring: fx/kioskSpectacle.js)');
  assert.equal(blasts[0].radius, kiosk.products.airHorn.horn.radius);
  assert.equal(blasts[0].pushed, 2, 'the Cart Pusher and the Mascot');
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
  const fillPa = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
  openAll(t, g);
  g.rounds.jumpTo(2);
  t.tick();
  assert.equal(kevin.site.id, 'hallway', 'no move at the opening round, even with the whole mall open');
  assert.deepEqual(moves, []);
  const round2Expected = kiosk.pa.opened.flatMap((open) =>
    kiosk.pa.stock.map((stock) => `${fillPa(open, { where: 'the Main Hallway' })} ${fillPa(stock, {
      stock: 'Soda Bomb, Bubble Wrap and Stadium Air Horn',
      pick: 'Soda Bomb',
    })}`),
  );
  assert.equal(lines.length, 1);
  assert.equal(lines[0][0], 'hallway');
  assert.ok(round2Expected.includes(lines[0][1]), `round 2 PA came from opened + stock pools: ${lines[0][1]}`);
  g.rounds.jumpTo(3);
  t.tick();
  assert.notEqual(kevin.site.id, 'hallway');
  assert.deepEqual(moves, [{ siteId: kevin.site.id, area: kevin.site.where, moved: true }]);
  const round3Expected = kiosk.pa.stock.map((stock) => `${fillPa(kiosk.pa.moved[0], { where: kevin.site.where })} ${fillPa(stock, {
    stock: 'Sparkler Cake, Bubble Wrap and Glitter Bomb',
    pick: 'Sparkler Cake',
  })}`);
  assert.equal(lines[1][0], kevin.site.id);
  assert.ok(round3Expected.includes(lines[1][1]), `round 3 PA came from moved[0] + stock pool: ${lines[1][1]}`);
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

test('Kevin shouts: a hawk as you walk up to his open cart and again only after its wait, a yelp as he ducks and a word when he is back, each list in turn', () => {
  const t = fixture(), { g } = t;
  const kevin = kevinOf(g);
  const said = [];
  g.events.on('kioskHawk', ({ siteId, kind, line }) => said.push([siteId, kind, line]));
  const kinds = (kind) => said.filter(([, k]) => k === kind).map(([, , line]) => line);
  standAtCart(t, g, kevin.site);
  t.tick(30);
  assert.deepEqual(said, [], 'not before he opens');
  g.map.doors.find(({ id }) => id === 'startShutter').open();
  g.map.zones.hallway.open = true;
  g.rounds.jumpTo(2);
  t.standAt(0, 12); // (the start room: out of earshot)
  t.tick(30);
  assert.deepEqual(said, [], 'nothing while you are far away');
  standAtCart(t, g, kevin.site);
  assert.deepEqual(said, [['hallway', 'lines', kiosk.hawk.lines[0]]]);
  t.tick(Math.round(kiosk.hawk.seconds * 60) - 10);
  assert.equal(said.length, 1, 'once every few seconds at most');
  t.tick(20);
  const product = kiosk.products[kevin.status.stock[0]].name;
  assert.deepEqual(kinds('lines'), [kiosk.hawk.lines[0], kiosk.hawk.lines[1].replace('{product}', product)], 'the next line, naming a product on sale');
  // A zombie at his stand: he ducks (a yelp, and no hawking while he's down); gone again: he's back up and says so.
  g.zombies.spawn('shopper', kevin.site.cart.stand.clone()).position.copy(kevin.site.cart.stand);
  t.tick(2);
  assert.deepEqual(kinds('duck'), [kiosk.hawk.duck[0]]);
  t.tick(Math.round(kiosk.hawk.seconds * 60) + 30);
  assert.equal(kinds('lines').length, 2, 'no hawking while he hides');
  g.zombies.clear();
  t.tick(2);
  assert.deepEqual(kinds('back'), [kiosk.hawk.back[0]]);
  assert.ok(said.every(([, , line]) => !line.includes('{')), 'every placeholder filled');
  // Dead: not a word. Play again starts every list from the top.
  const count = said.length;
  g.health.takeDamage(10_000);
  t.tick(Math.round(kiosk.hawk.seconds * 60) * 2);
  assert.equal(said.length, count);
  g.resetRun();
  g.rounds.update = () => {};
  g.map.doors.find(({ id }) => id === 'startShutter').open();
  g.map.zones.hallway.open = true;
  g.rounds.jumpTo(2);
  standAtCart(t, g, kevin.site);
  assert.deepEqual(said.at(-1), ['hallway', 'lines', kiosk.hawk.lines[0]]);
});

test('Kevin\'s products are baked: one mesh per material kind, each piece where it was, turning parts kept apart', async () => {
  const { bakeParts } = await import('../src/world/bakeParts.js');
  const { buildProductDisplay, buildProductModel } = await import('../src/world/kioskProducts.js');
  const mats = new Map();
  const mat = (color, options = {}) => {
    const key = `${color}|${JSON.stringify(options)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, ...options }));
    return mats.get(key);
  };
  // bakeParts by itself: two boxes of one kind in two colours become one mesh with the same bounds; a kept pivot stays.
  const root = new THREE.Group();
  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0xff0000));
  a.position.set(2, 0, 0);
  const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0x00ff00));
  b.position.set(-2, 1, 0);
  b.rotation.z = 0.5;
  const pivot = new THREE.Group();
  pivot.userData.keep = true;
  pivot.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat(0xff0000)));
  root.add(a, b, pivot);
  const before = new THREE.Box3().setFromObject(root);
  bakeParts(root);
  const meshes = root.children.filter((o) => o.isMesh);
  assert.equal(meshes.length, 1, 'the two loose boxes are one mesh');
  assert.ok(meshes[0].material.vertexColors, 'their colours moved into the vertices');
  assert.ok(root.children.includes(pivot) && pivot.children.length === 1, 'the kept pivot is left alone');
  const after = new THREE.Box3().setFromObject(root);
  assert.ok(before.min.distanceTo(after.min) < 1e-6 && before.max.distanceTo(after.max) < 1e-6, 'every piece stays where it was');
  // Every product, on the counter and in the air: a few draws each, something to see, and the Sentry's head and spinner apart.
  for (const id of [...kiosk.slots.flat(), ...Object.keys(kiosk.products)]) {
    for (const model of [buildProductDisplay(id, mat), buildProductModel(id, mat)]) {
      let draws = 0;
      model.traverse((o) => { if (o.isMesh) draws++; });
      assert.ok(draws >= 1 && draws <= 8, `${id}: ${draws} draws`);
      assert.ok(!new THREE.Box3().setFromObject(model).isEmpty(), `${id} has a shape`);
    }
  }
  const sentry = buildProductModel('sentry', mat);
  assert.ok(sentry.userData.head?.userData.keep && sentry.userData.spinner?.userData.keep, 'the Sentry\'s head and spinner can turn');
  assert.ok(buildProductDisplay('sentry', mat).userData.spinner, 'the demo unit on the counter spins');
});

test('Kevin pitches: 3-4 short loud lines per real stocked id, words-only, no extra ids', () => {
  const realIds = [...new Set(kiosk.slots.flat())];
  assert.deepEqual(Object.keys(kiosk.hawk.pitches).sort(), [...realIds].sort());
  assert.equal(kiosk.hawk.pitchChance, 0.35);

  const longestExpandedHawk = Math.max(
    ...kiosk.hawk.lines.map((line) => line.replace('{product}', kiosk.products.sentry.name).length),
  );
  for (const id of realIds) {
    const lines = kiosk.hawk.pitches[id];
    assert.ok(lines.length >= 3 && lines.length <= 4, `${id}: expected 3-4 pitches, got ${lines.length}`);
    assert.equal(new Set(lines).size, lines.length, `${id}: unique pitches`);
    const label = (kiosk.products[id] ?? kiosk.bubbleWrap).name;
    for (const line of lines) {
      assert.ok(line.includes('!'), `${id}: missing exclamation mark in "${line}"`);
      assert.ok(line.includes(label), `${id}: pitch "${line}" should name "${label}"`);
      assert.ok(!line.includes('{'), `${id}: unresolved placeholder in "${line}"`);
      assert.equal(hasStatNumber(line), false, `${id}: stat number in "${line}"`);
      assert.ok(line.length <= longestExpandedHawk, `${id}: too long (${line.length} > ${longestExpandedHawk}): "${line}"`);
    }
  }
});

test('Kevin pitches: respects stock and Pick preference, obeys chance 0 and 1, ignores unstocked ids, and never repeats back to back', () => {
  const savedChance = kiosk.hawk.pitchChance;
  const savedPitches = kiosk.hawk.pitches;
  const t = fixture(), { g } = t;
  try {
    const stepSeconds = Math.round(kiosk.hawk.seconds * 60);
    const kevin = kevinOf(g);
    let lines = [];
    g.events.on('kioskHawk', ({ kind, line }) => { if (kind === 'lines') lines.push(line); });
    const collectShouts = (round, count) => {
      g.resetRun();
      g.rounds.update = () => {};
      g.zombies.update = () => {};
      lines = [];
      g.map.doors.find(({ id }) => id === 'startShutter').open();
      g.map.zones.hallway.open = true;
      g.rounds.jumpTo(round);
      standAtCart(t, g, kevin.site);
      for (let i = 1; i < count; i++) t.tick(stepSeconds + 1);
      return { status: kevin.status, lines: [...lines] };
    };

    // chance = 0: general hawk lines only, zero pitches.
    kiosk.hawk.pitchChance = 0;
    const pitchAll = new Set(Object.values(savedPitches).flat());
    const atZero = collectShouts(2, 6);
    assert.equal(atZero.lines.length, 6);
    assert.equal(atZero.lines[0], kiosk.hawk.lines[0]);
    for (const line of atZero.lines) assert.ok(!pitchAll.has(line), `unexpected pitch at chance 0: "${line}"`);

    // chance = 1 with an extra id Kevin never sells: pitches only stocked items, prefers Pick, cycles cleanly.
    kiosk.hawk.pitchChance = 1;
    kiosk.hawk.pitches = { ...savedPitches, fakeItem: ['Fake Item! Not stocked anywhere!'] };

    // Round 2: stock = [sodaBomb, bubbleWrap, airHorn], Pick = sodaBomb.
    const r2 = collectShouts(2, 8);
    assert.deepEqual(r2.status.stock, ['sodaBomb', 'bubbleWrap', 'airHorn']);
    assert.equal(r2.status.pick, 'sodaBomb');
    assert.deepEqual(r2.lines, [
      savedPitches.sodaBomb[0],
      savedPitches.bubbleWrap[0],
      savedPitches.sodaBomb[1],
      savedPitches.airHorn[0],
      savedPitches.sodaBomb[2],
      savedPitches.bubbleWrap[1],
      savedPitches.sodaBomb[3],
      savedPitches.airHorn[1],
    ]);

    // Round 3: stock = [sparklerCake, bubbleWrap, glitterBomb] -> never mentions round-2-only or fake ids.
    const r3 = collectShouts(3, 6);
    assert.deepEqual(r3.status.stock, ['sparklerCake', 'bubbleWrap', 'glitterBomb']);
    const allowedR3 = new Set(r3.status.stock.flatMap((id) => savedPitches[id]));
    for (const line of r3.lines) {
      assert.ok(allowedR3.has(line), `round 3 pitched unstocked line: "${line}"`);
      assert.ok(!line.includes('Fake Item'), 'never pitches an id not in stock');
    }

    // Round 4: stock = [sentry, bubbleWrap, airHorn], Pick = bubbleWrap (sentry is noPick, still pitched).
    const r4 = collectShouts(4, 6);
    assert.deepEqual(r4.status.stock, ['sentry', 'bubbleWrap', 'airHorn']);
    assert.equal(r4.status.pick, 'bubbleWrap');
    assert.ok(r4.lines.some((line) => savedPitches.sentry.includes(line)), 'sentry pitched when stocked');
    const allowedR4 = new Set(r4.status.stock.flatMap((id) => savedPitches[id]));
    for (const line of r4.lines) assert.ok(allowedR4.has(line), `round 4 pitched unstocked line: "${line}"`);

    // Default chance (0.35): mixes pitches with general lines, keeps no back-to-back repeats.
    kiosk.hawk.pitchChance = savedChance;
    kiosk.hawk.pitches = savedPitches;
    const mixed = collectShouts(2, 20);
    const mixedPitches = mixed.lines.filter((line) => pitchAll.has(line));
    assert.equal(mixedPitches.length, 7);
    assert.equal(mixed.lines.length - mixedPitches.length, 13);
    for (let i = 1; i < mixed.lines.length; i++) {
      assert.notEqual(mixed.lines[i], mixed.lines[i - 1], 'never repeats the same shout back to back');
    }
    const r2Allowed = new Set(['sodaBomb', 'bubbleWrap', 'airHorn'].flatMap((id) => savedPitches[id]));
    for (const line of mixedPitches) assert.ok(r2Allowed.has(line));
  } finally {
    kiosk.hawk.pitchChance = savedChance;
    kiosk.hawk.pitches = savedPitches;
    g.map.dispose();
  }
});

test('Kevin PA pools (opened, stock): invariants, injected lineRandom picks every line, and Math.random untouched', (t) => {
  assert.ok(kiosk.pa.opened.length >= 8);
  assert.equal(new Set(kiosk.pa.opened).size, kiosk.pa.opened.length);
  assert.equal(kiosk.pa.opened[0], "Kevin's cart is open in {where}.");
  for (const line of kiosk.pa.opened) {
    assert.ok(line.includes('open in {where}'), `opened line keeps open in {where}: ${line}`);
    assert.ok(!line.includes('!'), `opened PA line has exclamation mark: ${line}`);
    assert.ok(!hasStatNumber(line), `opened PA line has stat number: ${line}`);
  }

  assert.ok(kiosk.pa.stock.length >= 8);
  assert.equal(new Set(kiosk.pa.stock).size, kiosk.pa.stock.length);
  assert.equal(kiosk.pa.stock[0], "Today on Kevin's cart: {stock}. Kevin's Pick is {pick}.");
  for (const line of kiosk.pa.stock) {
    assert.ok(line.includes('{stock}') && line.includes('{pick}'), `stock line keeps placeholders: ${line}`);
    assert.ok(!line.includes('!'), `stock PA line has exclamation mark: ${line}`);
    assert.ok(!hasStatNumber(line), `stock PA line has stat number: ${line}`);
  }

  const base = headlessGame();
  t.after(() => base.g.map.dispose());
  openAll(base, base.g);
  const feature = base.g.map.features.find((f) => f.kind === 'kiosk');
  const fillPa = (text, values) => text.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');

  const announceFor = (roll, useDefaultRandom = false) => {
    const events = createEvents();
    const emitted = [];
    events.on('kioskStock', (e) => emitted.push(e));
    const rounds = { round: 2 };
    const instance = buildKiosk(feature, {
      map: base.g.map,
      rounds,
      zombies: { zombies: [] },
      pricing: base.g.pricing,
      interactions: { add() {}, prompt: null },
      equipment: base.g.equipment,
      health: base.g.health,
      events,
      state: { over: false },
      player: base.g.player,
      ...(useDefaultRandom ? {} : { lineRandom: () => roll }),
    });
    instance.update(dt);
    const first = emitted[0].pa.text;
    rounds.round = 3;
    events.emit('roundStart', { round: 3 });
    instance.update(dt);
    const moved = emitted[1].pa.text;
    return { first, moved, siteWhere: instance.site.where };
  };

  const count = Math.max(kiosk.pa.opened.length, kiosk.pa.stock.length);
  const seenOpened = new Set();
  const seenStock = new Set();
  for (let i = 0; i < count; i++) {
    const openIdx = Math.min(i, kiosk.pa.opened.length - 1);
    const stockIdx = Math.min(i, kiosk.pa.stock.length - 1);
    const { first, moved, siteWhere } = announceFor(i / count + 1e-6);
    const expectedOpen = fillPa(kiosk.pa.opened[openIdx], { where: 'the Main Hallway' });
    const expectedR2Stock = fillPa(kiosk.pa.stock[stockIdx], {
      stock: 'Soda Bomb, Bubble Wrap and Stadium Air Horn',
      pick: 'Soda Bomb',
    });
    assert.equal(first, `${expectedOpen} ${expectedR2Stock}`);
    seenOpened.add(kiosk.pa.opened[openIdx]);
    seenStock.add(kiosk.pa.stock[stockIdx]);

    const expectedMoved = fillPa(kiosk.pa.moved[0], { where: siteWhere });
    const expectedR3Stock = fillPa(kiosk.pa.stock[stockIdx], {
      stock: 'Sparkler Cake, Bubble Wrap and Glitter Bomb',
      pick: 'Sparkler Cake',
    });
    assert.equal(moved, `${expectedMoved} ${expectedR3Stock}`);
  }
  assert.equal(seenOpened.size, kiosk.pa.opened.length);
  assert.equal(seenStock.size, kiosk.pa.stock.length);

  // Edge rolls: 0 picks first entry, 0.999 picks last entry.
  assert.equal(
    announceFor(0).first,
    `${fillPa(kiosk.pa.opened[0], { where: 'the Main Hallway' })} ${fillPa(kiosk.pa.stock[0], {
      stock: 'Soda Bomb, Bubble Wrap and Stadium Air Horn',
      pick: 'Soda Bomb',
    })}`,
  );
  assert.equal(
    announceFor(0.999).first,
    `${fillPa(kiosk.pa.opened.at(-1), { where: 'the Main Hallway' })} ${fillPa(kiosk.pa.stock.at(-1), {
      stock: 'Soda Bomb, Bubble Wrap and Stadium Air Horn',
      pick: 'Soda Bomb',
    })}`,
  );

  // Default cosmetic random never consumes Math.random during PA announcements when crypto is available.
  if (globalThis.crypto?.getRandomValues) {
    const events = createEvents();
    const emitted = [];
    events.on('kioskStock', (e) => emitted.push(e));
    const rounds = { round: 2 };
    const instance = buildKiosk(feature, {
      map: base.g.map,
      rounds,
      zombies: { zombies: [] },
      pricing: base.g.pricing,
      interactions: { add() {}, prompt: null },
      equipment: base.g.equipment,
      health: base.g.health,
      events,
      state: { over: false },
      player: base.g.player,
    });
    const savedRandom = Math.random;
    const blockRandom = () => { throw new Error('Math.random should not be called by kiosk PA'); };
    try {
      Math.random = blockRandom;
      instance.update(dt);
      assert.ok(emitted[0].pa.text.includes('the Main Hallway'));
      Math.random = savedRandom;
      rounds.round = 3;
      events.emit('roundStart', { round: 3 });
      Math.random = blockRandom;
      instance.update(dt);
      assert.ok(emitted[1].pa.text.includes(instance.site.where));
    } finally {
      Math.random = savedRandom;
    }
  }
});
