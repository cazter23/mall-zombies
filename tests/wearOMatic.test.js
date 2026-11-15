// The WEAR-O-MATIC (arena survival only: config/arenas.js wardrobeMachine, game/features/wardrobeFixtures.js buildWardrobeMachine,
// the fitting-room picker in shop mode): every Wardrobe item in one machine in Last Showing and Lot Full, at the rack price plus a
// convenience fee; buy one and it goes on, change into one you own for free, short of points nothing happens. An Apparel sale marks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { economy } from '../src/config/economy.js';
import { feel } from '../src/config/feel.js';
import { arenas } from '../src/config/arenas.js';
import { wardrobeItems, wardrobeSlots } from '../src/config/wardrobe.js';
import { featuresOf } from '../src/game/features/index.js';
import { collectSaleSpots } from '../src/game/flashSales.js';

const holdTicks = Math.ceil(feel.interact.holdSeconds / dt) + 1;
const APPAREL = economy.flashSales.groups.find((group) => group.id === 'apparel');

function arenaGame(t, arena) {
  const run = headlessGame();
  t.after(() => run.g.map.dispose());
  run.g.setArena(arena);
  run.tick(1);
  run.g.rounds.update = () => {};
  run.g.zombies.clear();
  return run;
}

const machineOf = (g) => featuresOf(g.map, 'wardrobeMachine')[0];
const instanceOf = (g, feature) => g.features.list.find((built) => built.feature === feature).instance;

// Hold interact in front of the machine: the picker opens in shop mode. Returns the machine's instance ({ picker, view }).
function openMachine(run) {
  const { g } = run;
  const feature = machineOf(g);
  const { position, normal } = feature;
  g.player.teleport({ position: new THREE.Vector3(position.x + normal.x * 0.9, position.y > 4 ? 6.3 : 0, position.z + normal.z * 0.9), yaw: Math.atan2(normal.x, normal.z) });
  g.player.pitch = 0;
  run.tick(2);
  assert.equal(g.interactions.prompt?.kind, 'wardrobeMachine');
  run.press('KeyF', holdTicks);
  assert.equal(g.state.menu, 'fittingRoom');
  return instanceOf(g, feature);
}

// Move the open picker onto `id` with real key presses, and press confirm.
function choose(run, machine, id) {
  const { slot } = wardrobeItems[id];
  for (let i = 0; machine.view.slot !== slot; i++) {
    assert.ok(i < 4, `slot ${slot} reachable`);
    run.press('KeyD');
  }
  for (let i = 0; machine.view.slots.find((s) => s.id === slot).items.find((item) => item.selected)?.id !== id; i++) {
    assert.ok(i < 3, `${id} reachable`);
    run.press('KeyS');
  }
  run.press('KeyF');
}

test('its prices: every item at the rack price plus the convenience fee, and an Apparel sale takes its share off both', (t) => {
  const { g } = arenaGame(t, 'cinema');
  for (const [id, price] of Object.entries(economy.wardrobe)) {
    const fee = g.pricing.priceOf('wearOMatic', id);
    assert.equal(fee, Math.round((price * economy.wearOMatic.markup) / economy.discountRoundTo) * economy.discountRoundTo, id);
    assert.ok(fee > price && fee <= price * 1.25, `${id}: a small fee (${price} -> ${fee})`);
  }
  assert.ok(APPAREL.categories.includes('wearOMatic'), 'the Apparel sale covers the machine');
  APPAREL.categories.forEach((category) => g.pricing.setDiscount(category, 0.5));
  assert.equal(g.pricing.priceOf('wearOMatic', 'goldCard'), g.pricing.basePriceOf('wearOMatic', 'goldCard') / 2);
  assert.throws(() => g.pricing.priceOf('wearOMatic', 'notAnItem'));
});

test('only in Last Showing and Lot Full: never in Everything Must Go or a whole-mall run', (t) => {
  const run = headlessGame();
  t.after(() => run.g.map.dispose());
  const { g } = run;
  assert.equal(featuresOf(g.map, 'wardrobeMachine').length, 0, 'a whole-mall run');
  const having = arenas.list.filter((arena) => arena.wardrobeMachine).map((arena) => arena.id);
  assert.deepEqual(having, ['cinema', 'parkingLot']);
  for (const arena of arenas.list) {
    g.setArena(arena.id);
    assert.equal(featuresOf(g.map, 'wardrobeMachine').length, having.includes(arena.id) ? 1 : 0, arena.id);
  }
  g.setArena(null);
  assert.equal(featuresOf(g.map, 'wardrobeMachine').length, 0, 'gone again after an arena run');
});

for (const arena of ['cinema', 'parkingLot']) {
  test(`${arena}: buy anything (it goes on, at the machine's price), change back for free, nothing when short of points`, (t) => {
    const run = arenaGame(t, arena);
    const { g } = run;
    const purchases = [];
    g.events.on('purchase', (p) => purchases.push(p));
    g.wallet.earn(10000);
    const machine = openMachine(run);
    const view = machine.view;
    assert.equal(view.shop, true);
    assert.match(view.kicker, /WEAR-O-MATIC/);
    for (const slot of view.slots) {
      assert.deepEqual(slot.items.map((item) => item.id), Object.keys(wardrobeItems).filter((id) => wardrobeItems[id].slot === slot.id), `${slot.id}: every item`);
      for (const item of slot.items) assert.equal(item.price, g.pricing.priceOf('wearOMatic', item.id));
    }
    assert.equal(purchases.length, 0, 'opening it is not a purchase');

    // Buy the Gold Card: paid at the machine's price, owned, worn, announced as a purchase.
    let before = g.wallet.points;
    choose(run, machine, 'goldCard');
    assert.equal(before - g.wallet.points, g.pricing.priceOf('wearOMatic', 'goldCard'));
    assert.ok(g.wardrobe.owns('goldCard'));
    assert.equal(g.wardrobe.wearing('accessory'), 'goldCard');
    assert.deepEqual(purchases.at(-1), { label: wardrobeItems.goldCard.name, cost: g.pricing.priceOf('wearOMatic', 'goldCard'), kind: 'wearOMatic', id: 'goldCard' });
    assert.equal(machine.view.slots.find((s) => s.id === 'accessory').items.find((i) => i.id === 'goldCard').price, null, 'owned: no price');

    // A second accessory replaces it; changing back to the Gold Card is free.
    choose(run, machine, 'foamFinger');
    assert.equal(g.wardrobe.wearing('accessory'), 'foamFinger');
    before = g.wallet.points;
    choose(run, machine, 'goldCard');
    assert.equal(g.wallet.points, before, 'changing is free');
    assert.equal(g.wardrobe.wearing('accessory'), 'goldCard');
    assert.equal(purchases.at(-1).kind, 'fittingRoom');

    // Short of points: nothing bought, nothing paid, the form says no.
    g.wallet.spend(g.wallet.points);
    choose(run, machine, 'paperHat');
    assert.equal(g.wardrobe.owns('paperHat'), false);
    assert.equal(g.wallet.points, 0);
    assert.equal(machine.view.denied, true);
    assert.equal(machine.view.canAfford, false);
    assert.equal(g.state.menu, 'fittingRoom', 'still open');
    run.press('KeyQ');
    assert.equal(g.state.menu, null, 'back closes it');
  });
}

test('an Apparel sale marks the machine while anything is left to buy', (t) => {
  const { g } = arenaGame(t, 'parkingLot');
  const spots = () => collectSaleSpots({ map: g.map, features: g.features, gun: g.gun, warranty: g.warranty, wardrobe: g.wardrobe }, { categories: APPAREL.categories });
  assert.deepEqual(spots().map((s) => s.category), ['wearOMatic'], 'Lot Full has no racks: only the machine');
  g.wardrobe.grantAll();
  assert.deepEqual(spots(), [], 'everything owned: nothing to mark');
  assert.equal(Object.keys(wardrobeSlots).every((slot) => g.wardrobe.wearing(slot)), true);
});
