// Flash Sales (game/flashSales.js): the mall PA discounts one group of prices for a while. The system's own rules
// (timing, what is picked, restoring prices, reset) with a fake clock and dice, then the REAL game: the PA banner and
// chime, the lower price in the prompt and in the real purchase, nothing runs while paused or dead, Play again clears it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlashSales } from '../src/game/flashSales.js';
import { createEvents } from '../src/game/events.js';
import { createPricing } from '../src/game/pricing.js';
import { economy } from '../src/config/economy.js';
import { headlessGame } from './helpers/headlessGame.js';

// A tiny config so the numbers are easy to follow.
const cfg = (over = {}) => ({
  enabled: true,
  firstDelaySeconds: 10,
  gapSeconds: { min: 20, max: 30 },
  durationSeconds: 5,
  retrySeconds: 3,
  discounts: { min: 0.25, max: 0.5, step: 0.05 },
  groups: [
    { id: 'doors', label: 'Doors', categories: ['door'], weight: 1, start: { kicker: 'K', text: 'Doors {pct}% off' }, end: { kicker: 'E', text: 'over' } },
    { id: 'ammo', label: 'Ammo', categories: ['ammo', 'ammoCache'], weight: 1, start: { kicker: 'K', text: 'Ammo {pct}% off' }, end: { kicker: 'E', text: 'over' } },
  ],
  ...over,
});

// A scripted dice: returns the given numbers in order (then 0.5s).
const dice = (...values) => { let i = 0; return () => (i < values.length ? values[i++] : 0.5); };

function setup(over = {}, random = dice(), eligible) {
  const events = createEvents();
  const pricing = createPricing();
  const log = [];
  events.on('flashSaleStart', (p) => log.push(['start', p]));
  events.on('flashSaleEnd', (p) => log.push(['end', p]));
  const sales = createFlashSales({ events, pricing, random, config: cfg(over), eligible });
  const run = (seconds, dt = 0.5) => { for (let t = 0; t < seconds; t += dt) sales.update(dt); };
  return { sales, pricing, log, run };
}

test('timing: the first sale starts after the first delay, lasts its duration, then a quiet gap, then another', () => {
  const { sales, log, run } = setup({}, dice(0.1, 0.0, 0.0, 0.0, 0.9, 0.0));
  run(9.5);
  assert.equal(sales.active, null, 'nothing before the first delay');
  run(0.5);
  assert.ok(sales.active, 'started at 10 s');
  assert.equal(log.filter(([k]) => k === 'start').length, 1);
  run(4.5);
  assert.ok(sales.active, 'still running at 14.5 s');
  run(0.5);
  assert.equal(sales.active, null, 'over at 15 s');
  assert.deepEqual(log.map(([k, p]) => [k, p.reason ?? null]), [['start', null], ['end', 'expired']]);
  // The gap is min + (max - min) * random: the dice gave 0.0 for it, so 20 s from the end.
  assert.equal(sales.timeUntilNext, 20);
  run(19.5);
  assert.equal(sales.active, null);
  run(0.5);
  assert.ok(sales.active, 'the second sale starts after the gap');
  assert.equal(log.filter(([k]) => k === 'start').length, 2, 'sales never overlap: one at a time');
});

test('a sale discounts every category in its group, in steps of 5% between 25 and 50%, and prices follow', () => {
  for (const [roll, expected] of [[0, 0.25], [0.2, 0.3], [0.5, 0.4], [0.99, 0.5]]) {
    // dice: which group (1 -> last = ammo), then the discount roll
    const { sales, pricing, run } = setup({}, dice(0.99, roll));
    run(10);
    assert.equal(sales.active.id, 'ammo');
    assert.equal(sales.active.discount, expected, `roll ${roll}`);
    assert.equal(pricing.discountOf('ammo'), expected);
    assert.equal(pricing.discountOf('ammoCache'), expected, 'the RESTOCK-O-MATIC is part of the ammo sale');
    assert.equal(pricing.discountOf('door'), 0, 'other groups are untouched');
    assert.equal(pricing.priceOf('ammoCache'), Math.round((economy.ammoCache.price * (1 - expected)) / 10) * 10);
  }
});

test('the PA lines say the real percentage, and the end line comes with reason "expired"', () => {
  const { log, run } = setup({}, dice(0.0, 0.2));
  run(15);
  assert.equal(log[0][1].pa.text, 'Doors 30% off');
  assert.equal(log[0][1].pa.kicker, 'K');
  assert.equal(log[0][1].seconds, 5);
  assert.deepEqual(log[1][1].pa, { kicker: 'E', text: 'over' });
});

test('when a sale ends the prices go back, to what they were (it never clobbers another discount)', () => {
  const { sales, pricing, run } = setup({}, dice(0.0, 0.0));
  pricing.setDiscount('door', 0.1); // something else had a discount on already
  run(10);
  assert.equal(pricing.discountOf('door'), 0.25);
  run(5);
  assert.equal(sales.active, null);
  assert.equal(pricing.discountOf('door'), 0.1, 'back to the earlier 10%');
});

test('only groups that are of use right now can be picked; none = look again soon', () => {
  const only = (id) => (group) => group.id === id;
  const a = setup({}, dice(0.0, 0.0), only('ammo'));
  a.run(10);
  assert.equal(a.sales.active.id, 'ammo', 'doors were skipped (every door is open, say)');
  const none = setup({}, dice(), () => false);
  none.run(10);
  assert.equal(none.sales.active, null);
  assert.equal(none.sales.timeUntilNext, 3, 'retry in retrySeconds');
  none.run(2.5);
  assert.equal(none.sales.active, null);
});

test('weights decide the pick (heavier groups win more of the roll)', () => {
  const heavy = { groups: cfg().groups.map((g) => ({ ...g, weight: g.id === 'ammo' ? 3 : 1 })) };
  // total weight 4: rolls under 0.25 pick doors, the rest pick ammo
  for (const [roll, expected] of [[0.1, 'doors'], [0.3, 'ammo'], [0.9, 'ammo']]) {
    const { sales, run } = setup(heavy, dice(roll, 0));
    run(10);
    assert.equal(sales.active.id, expected, `roll ${roll}`);
  }
});

test('reset ends a running sale silently (reason "reset"), restores prices, and re-arms the first delay', () => {
  const { sales, pricing, log, run } = setup({}, dice(0.0, 0.0));
  run(11);
  assert.ok(sales.active);
  sales.reset();
  assert.equal(sales.active, null);
  assert.equal(pricing.discountOf('door'), 0);
  assert.equal(log.at(-1)[1].reason, 'reset');
  assert.equal(sales.timeUntilNext, 10, 'the first delay again');
});

test('disabled: nothing ever starts', () => {
  const { sales, run } = setup({ enabled: false });
  run(100);
  assert.equal(sales.active, null);
});

// --- The real game ---

// Build a real game whose only possible sale is the door sale, coming up fast (the config is restored after).
function withFastDoorSales(fn) {
  const saved = { first: economy.flashSales.firstDelaySeconds, groups: economy.flashSales.groups, duration: economy.flashSales.durationSeconds };
  economy.flashSales.firstDelaySeconds = 2;
  economy.flashSales.durationSeconds = 6;
  economy.flashSales.groups = saved.groups.filter((g) => g.id === 'doors');
  try {
    return fn();
  } finally {
    economy.flashSales.firstDelaySeconds = saved.first;
    economy.flashSales.durationSeconds = saved.duration;
    economy.flashSales.groups = saved.groups;
  }
}

test('the real game: the PA banner + chime, the sale price in the prompt and in a real purchase, then it ends', () => {
  withFastDoorSales(() => {
    const t = headlessGame();
    const { g } = t;
    t.tick(1);
    assert.equal(g.flashSales.active, null);
    t.tick(60 * 2);
    const sale = g.flashSales.active;
    assert.ok(sale && sale.id === 'doors', 'the door sale started after the first delay');
    const banner = t.hud.calls.find(([name]) => name === 'showAnnouncement');
    assert.ok(banner && banner[1].kicker === 'Flash sale' && banner[1].text.includes(`${Math.round(sale.discount * 100)}%`), 'the PA banner says the real discount');
    assert.ok(t.sounds.includes('paChime'));
    const price = g.pricing.priceOf('door', 'hallway');
    assert.ok(price < economy.doors.hallway, `sale price ${price}`);
    // The prompt carries the sale price and its kind (the HUD marks it SALE), and the real purchase charges it.
    t.standAt(0, 8.5, 0);
    t.tick(2);
    assert.equal(g.interactions.prompt.cost, price);
    assert.equal(g.interactions.prompt.kind, 'door');
    const before = g.wallet.points;
    t.press('KeyF', 30);
    assert.equal(before - g.wallet.points, price, 'charged the sale price');
    // It runs out.
    const bannersBefore = t.hud.calls.filter(([name]) => name === 'showAnnouncement').length;
    t.tick(60 * 7);
    assert.equal(g.flashSales.active, null, 'the sale ended');
    assert.equal(g.pricing.priceOf('door', 'megaMart'), economy.doors.megaMart, 'prices are back to normal');
    assert.equal(t.hud.calls.filter(([name]) => name === 'showAnnouncement').length, bannersBefore + 1, 'with an end announcement');
  });
});

test('the real game: no sale of a useless group (every door already open = no door sale)', () => {
  withFastDoorSales(() => {
    const t = headlessGame();
    const { g } = t;
    t.tick(1);
    for (const d of g.map.doors) d.open();
    t.tick(60 * 10);
    assert.equal(g.flashSales.active, null);
    assert.ok(g.flashSales.timeUntilNext <= economy.flashSales.retrySeconds, 'it keeps looking');
  });
});

test('the real game: the clock only runs while playing (frozen when paused and when dead)', () => {
  withFastDoorSales(() => {
    const t = headlessGame();
    const { g } = t;
    t.tick(60 * 3);
    assert.ok(g.flashSales.active);
    const remaining = g.flashSales.active.remaining;
    g.state.forceRun = false; // paused
    t.tick(60 * 4);
    assert.equal(g.flashSales.active.remaining, remaining, 'paused: frozen');
    g.state.forceRun = true;
    g.health.takeDamage(10_000);
    t.tick(1);
    const afterDeath = g.flashSales.active.remaining;
    t.tick(60 * 4);
    assert.equal(g.flashSales.active.remaining, afterDeath, 'dead: frozen');
  });
});

test('the real game: Play again ends the sale silently, restores prices, and starts the first-delay clock over', () => {
  withFastDoorSales(() => {
    const t = headlessGame();
    const { g } = t;
    t.tick(60 * 3);
    assert.ok(g.flashSales.active);
    const banners = t.hud.calls.filter(([name]) => name === 'showAnnouncement').length;
    g.resetRun();
    assert.equal(g.flashSales.active, null);
    assert.equal(g.pricing.priceOf('door', 'hallway'), economy.doors.hallway);
    assert.equal(t.hud.calls.filter(([name]) => name === 'showAnnouncement').length, banners, 'no end banner on a reset');
    assert.equal(g.flashSales.timeUntilNext, economy.flashSales.firstDelaySeconds);
    assert.ok(g.resetSteps.includes('flashSales'));
  });
});
