// Flash Sales (game/flashSales.js): the mall PA discounts one group of prices for a while. The system's own rules
// (timing, what is picked, restoring prices, reset) with a fake clock and dice, then the REAL game: the PA banner and
// chime, the lower price in the prompt and in the real purchase, nothing runs while paused or dead, Play again clears it.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createFlashSales, doorbusterCandidates, nearOpenSpawnPoints, collectSaleSpots, reachableInTime } from '../src/game/flashSales.js';
import { attachmentFits } from '../src/weapons/upgrades.js';
import { createEvents } from '../src/game/events.js';
import { createPricing } from '../src/game/pricing.js';
import { createSaleTagView } from '../src/fx/saleTagView.js';
import { economy, maxAliveForRound } from '../src/config/economy.js';
import { weapons } from '../src/config/weapons.js';
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

function setup(over = {}, random = dice(), eligible, extra = {}) {
  const events = createEvents();
  const pricing = createPricing();
  const log = [];
  events.on('flashSaleSoon', (p) => log.push(['soon', p]));
  events.on('flashSaleStart', (p) => log.push(['start', p]));
  events.on('flashSaleEnd', (p) => log.push(['end', p]));
  const sales = createFlashSales({ events, pricing, random, config: cfg(over), eligible, ...extra });
  const run = (seconds, dt = 0.5) => { for (let t = 0; t < seconds; t += dt) sales.update(dt); };
  return { sales, events, pricing, log, run };
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
function withFastDoorSales(fn, { teaserSeconds = 0 } = {}) {
  const saved = {
    first: economy.flashSales.firstDelaySeconds,
    teaser: economy.flashSales.teaserSeconds,
    groups: economy.flashSales.groups,
    duration: economy.flashSales.durationSeconds,
  };
  economy.flashSales.firstDelaySeconds = 2;
  economy.flashSales.teaserSeconds = teaserSeconds;
  economy.flashSales.durationSeconds = 6;
  economy.flashSales.groups = saved.groups.filter((g) => g.id === 'doors');
  try {
    return fn();
  } finally {
    economy.flashSales.firstDelaySeconds = saved.first;
    economy.flashSales.teaserSeconds = saved.teaser;
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
    // (Only the sale's own banners: other PA lines, like the closing checklist's briefing, come in the same seconds.)
    const saleBanners = () => t.hud.calls.filter(([name, notice]) => name === 'showAnnouncement' && /sale/i.test(notice.kicker ?? ''));
    const bannersBefore = saleBanners().length;
    t.tick(60 * 7);
    assert.equal(g.flashSales.active, null, 'the sale ended');
    assert.equal(g.pricing.priceOf('door', 'megaMart'), economy.doors.megaMart, 'prices are back to normal');
    assert.equal(saleBanners().length, bannersBefore + 1, 'with an end announcement');
    assert.equal(saleBanners().at(-1)[1].kicker, 'Sale over');
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

// --- Part 1: Teasers (lead time, PA warning, re-checking eligibility, quiet cancel, reset) ---

test('teaser: fires flashSaleSoon ahead of start, honours lead time, and does not discount prices until go-live', () => {
  const { sales, pricing, log, run } = setup({ teaserSeconds: 10 }, dice(0.1, 0, 0.2));
  run(10);
  assert.equal(sales.active, null, 'still not live at teaser start');
  assert.ok(sales.pending && sales.pending.id === 'doors', 'pending teaser is doors');
  assert.equal(sales.pending.remaining, 10);
  assert.equal(pricing.discountOf('door'), 0, 'no discount yet during the warning');
  const soon = log.find(([k]) => k === 'soon')?.[1];
  assert.ok(soon && soon.seconds === 10);
  assert.match(soon.pa.text, /ten seconds/i);
  assert.match(soon.pa.text, /Doors/);

  run(9.5);
  assert.equal(sales.active, null, 'still waiting with 0.5 s left');
  assert.equal(pricing.discountOf('door'), 0);
  run(0.5);
  assert.equal(sales.pending, null);
  assert.ok(sales.active && sales.active.id === 'doors', 'goes live after lead time');
  assert.equal(pricing.discountOf('door'), 0.3);
});

test('teaser: re-checks eligibility at go-live (switches to another group or cancels quietly)', () => {
  // Case A: doors stopped making sense during the teaser, ammo is still eligible -> switches at go-live.
  let doorsOk = true;
  let ammoOk = true;
  const a = setup({ teaserSeconds: 10 }, dice(0.1, 0, 0.0, 0.5, 0.2), (g) => (g.id === 'doors' ? doorsOk : ammoOk));
  a.run(10);
  assert.equal(a.sales.pending.id, 'doors');
  doorsOk = false;
  a.run(10);
  assert.equal(a.sales.active.id, 'ammo', 'picked another eligible group at go-live');

  // Case B: everything stopped making sense during the teaser -> cancels quietly and retries soon.
  doorsOk = true;
  ammoOk = true;
  const b = setup({ teaserSeconds: 10 }, dice(0.1), (g) => (g.id === 'doors' ? doorsOk : ammoOk));
  b.run(10);
  assert.equal(b.sales.pending.id, 'doors');
  doorsOk = false;
  ammoOk = false;
  b.run(10);
  assert.equal(b.sales.active, null);
  assert.equal(b.sales.pending, null);
  assert.equal(b.sales.timeUntilNext, 3, 'scheduled retrySeconds');
  const end = b.log.find(([k]) => k === 'end')?.[1];
  assert.equal(end.reason, 'cancelled');
  assert.equal(end.pa, null, 'cancelled quietly with no PA end line');
});

test('teaser: reset clears a pending teaser and keeps prices untouched', () => {
  const { sales, pricing, run } = setup({ teaserSeconds: 10 }, dice(0.1));
  run(12);
  assert.ok(sales.pending);
  sales.reset();
  assert.equal(sales.pending, null);
  assert.equal(sales.active, null);
  assert.equal(pricing.discountOf('door'), 0);
  assert.equal(sales.timeUntilNext, 10);
});

test('teaser: picks a line from economy.flashSales.teaser.lines using injectable random', () => {
  const { lines } = economy.flashSales.teaser;
  assert.ok(lines.length >= 8);
  assert.equal(new Set(lines).size, lines.length, 'every teaser line is unique');

  const first = setup({ teaserSeconds: 10 }, dice(0.1, 0));
  first.run(10);
  const firstPa = first.log.find(([k]) => k === 'soon')?.[1]?.pa;
  assert.equal(firstPa.text, lines[0].replace('{lead}', 'ten seconds').replace('{label}', 'Doors'));

  const last = setup({ teaserSeconds: 10 }, dice(0.1, 0.99));
  last.run(10);
  const lastPa = last.log.find(([k]) => k === 'soon')?.[1]?.pa;
  assert.equal(lastPa.text, lines[lines.length - 1].replace('{lead}', 'ten seconds').replace('{label}', 'Doors'));
  assert.notEqual(firstPa.text, lastPa.text);
});

test('the real game: teaser PA banner and HUD clock precede go-live, and re-checking skips cleanly if all doors open', () => {
  withFastDoorSales(() => {
    const t = headlessGame();
    const { g } = t;
    g.health.invulnerable = true; // survive round 1 while waiting out the 10 s warning
    t.tick(1);
    t.tick(60 * 2); // 2 s delay -> 10 s teaser starts
    assert.ok(g.flashSales.pending && !g.flashSales.active);
    assert.equal(g.pricing.priceOf('door', 'hallway'), economy.doors.hallway, 'shelf price during teaser');
    const teaserBanner = t.hud.calls.find(([n, p]) => n === 'showAnnouncement' && /ten seconds/i.test(p?.text ?? ''));
    assert.ok(teaserBanner, 'PA announced the 10-second warning');
    t.tick(60 * 10 + 2);
    assert.ok(g.flashSales.active && !g.flashSales.pending, 'goes live after 10 s teaser');
    assert.ok(g.pricing.priceOf('door', 'hallway') < economy.doors.hallway);

    // Cancel quietly if every door is opened during the teaser.
    g.resetRun();
    t.tick(60 * 2 + 1);
    assert.ok(g.flashSales.pending);
    for (const d of g.map.doors) d.open();
    const bannersBefore = t.hud.calls.filter(([n, p]) => n === 'showAnnouncement' && /sale/i.test(p?.kicker ?? '')).length;
    t.tick(60 * 10 + 2);
    assert.equal(g.flashSales.active, null);
    assert.equal(
      t.hud.calls.filter(([n, p]) => n === 'showAnnouncement' && /sale/i.test(p?.kicker ?? '')).length,
      bannersBefore,
      'no PA start or end banner when a teased sale cancels quietly',
    );
  }, { teaserSeconds: 10 });
});

// --- Part 3: Doorbusters (weights, fromRound, per-item discount, PA line, rush queue) ---

const dbCfg = (over = {}) => ({
  ...cfg(),
  doorbuster: {
    ...economy.flashSales.doorbuster,
    weight: 1, // total group weights = 2, Doorbuster = 1 -> 0..2/3 groups, >= 2/3 Doorbuster
    fromRound: 3,
    durationSeconds: 20,
    discounts: { min: 0.65, max: 0.75, step: 0.05 },
    rush: { baseCount: 3, perRound: 0.5, maxCount: 6, nearestMarkers: 3, spawnIntervalSeconds: 0.5, retrySeconds: 0.25 },
    ...over,
  },
});

const sampleDbTarget = {
  category: 'weapon',
  id: 'rivetRifle',
  itemLabel: 'Rivet Rifle',
  itemPhrase: 'the Rivet Rifle',
  zone: 'atrium',
  zoneLabel: 'Grand Atrium',
  area: 'the Grand Atrium',
  position: { x: 10, y: 1.5, z: 21 },
  positions: [{ position: { x: 10, y: 1.5, z: 21 }, normal: null }],
};

test('doorbuster: respects fromRound and relative weight using injected random', () => {
  // Below fromRound (round 2): even roll = 0.999 still picks a normal group, never Doorbuster.
  let round = 2;
  const early = createFlashSales({
    events: createEvents(), pricing: createPricing(), random: dice(0.999, 0),
    config: dbCfg(), eligible: () => true, doorbusters: () => [sampleDbTarget], getRound: () => round,
  });
  early.update(10);
  assert.equal(early.active.kind, 'category', 'never picks Doorbuster before fromRound');

  // At round >= fromRound: low roll picks normal category (total = 3: 0..2/3 category, >= 2/3 Doorbuster).
  round = 3;
  const normalRoll = createFlashSales({
    events: createEvents(), pricing: createPricing(), random: dice(0.5, 0),
    config: dbCfg(), eligible: () => true, doorbusters: () => [sampleDbTarget], getRound: () => round,
  });
  normalRoll.update(10);
  assert.equal(normalRoll.active.kind, 'category');

  // Roll >= 2/3 picks Doorbuster, discounts ONLY rivetRifle at 70%, names item and area in PA.
  const dbEvents = createEvents();
  const dbPricing = createPricing();
  const dbLog = [];
  dbEvents.on('flashSaleStart', (e) => dbLog.push(['start', e]));
  dbEvents.on('flashSaleEnd', (e) => dbLog.push(['end', e]));
  const dbRoll = createFlashSales({
    events: dbEvents, pricing: dbPricing, random: dice(0.8, 0.0, 0.5, 0), // roll >= 2/3 picks Doorbuster, 0.0 target, 0.5 -> 70%
    config: dbCfg(), eligible: () => true, doorbusters: () => [sampleDbTarget], getRound: () => 5,
  });
  dbRoll.update(10);
  assert.equal(dbRoll.active.kind, 'doorbuster');
  assert.equal(dbRoll.active.discount, 0.7);
  assert.equal(dbPricing.discountOf('weapon', 'rivetRifle'), 0.7);
  assert.equal(dbPricing.discountOf('weapon', 'nailGun'), 0, 'other guns stay full price');
  assert.equal(dbPricing.priceOf('weapon', 'nailGun'), economy.wallBuys.nailGun.weapon);
  assert.match(dbLog[0][1].pa.text, /Doorbuster! The Rivet Rifle in the Grand Atrium, 70% off/i);

  // Ends after 20 s and puts item discount back.
  dbRoll.update(19.5);
  assert.ok(dbRoll.active);
  dbRoll.update(0.5);
  assert.equal(dbRoll.active, null);
  assert.equal(dbPricing.discountOf('weapon', 'rivetRifle'), 0);
  assert.equal(dbPricing.priceOf('weapon', 'rivetRifle'), economy.wallBuys.rivetRifle.weapon);
  assert.equal(dbLog[1][1].reason, 'expired');
});

test('doorbuster rush: nothing at go-live; buying the item sells it out and brings the capped, round-scaled rush', () => {
  let alive = 0;
  const maxAlive = 4;
  const round = 15; // base 3 + floor((15-3)*0.5)=9 -> capped at maxCount=6
  const spawns = [];
  const events = createEvents();
  const pricing = createPricing();
  const log = [];
  events.on('flashSaleEnd', (e) => log.push(e));
  const sales = createFlashSales({
    events,
    pricing,
    random: dice(0.8, 0.5),
    config: dbCfg({ teaserSeconds: 0, sold: { kicker: 'Sold', text: 'Sold! {Item}, {pct}% off.' } }),
    eligible: () => false,
    doorbusters: () => [sampleDbTarget],
    getRound: () => round,
    canSpawnRush: () => alive < maxAlive,
    nearSpawnPoints: () => [{ id: 'p1', zone: 'atrium', position: sampleDbTarget.position }],
    onRushSpawn: (pts) => { alive += 1; spawns.push(pts); return { id: spawns.length }; },
  });
  assert.equal(sales.startNow('doorbuster'), true);
  sales.update(5);
  assert.equal(spawns.length, 0, 'a Doorbuster you have not bought brings no one');

  // Buying something else (another gun, the same gun's ammo) is not buying the Doorbuster.
  events.emit('purchase', { kind: 'weapon', id: 'nailGun' });
  events.emit('purchase', { kind: 'ammo', id: 'rivetRifle' });
  assert.equal(spawns.length, 0);
  assert.ok(sales.active);

  // Buying it: sold out (price back, PA "Sold!"), the first shopper at once.
  events.emit('purchase', { kind: 'weapon', id: 'rivetRifle' });
  assert.equal(sales.active, null, 'sold out');
  assert.equal(pricing.discountOf('weapon', 'rivetRifle'), 0, 'the price is back to normal');
  assert.equal(log.at(-1).reason, 'sold');
  assert.match(log.at(-1).pa.text, /Sold! The Rivet Rifle, 70% off/);
  assert.equal(spawns.length, 1);

  // The rush outlives the sale: up to the alive cap, then it waits; as slots free it carries on, to exactly maxCount.
  for (let i = 0; i < 12; i++) sales.update(0.5);
  assert.equal(spawns.length, 4, 'held at the alive cap (4/6)');
  alive = 0;
  for (let i = 0; i < 12; i++) sales.update(0.5);
  assert.equal(spawns.length, 6, 'the whole capped rush, after the sale ended');
  for (let i = 0; i < 12; i++) sales.update(0.5);
  assert.equal(spawns.length, 6, 'and no more');

  // A second purchase of the item (no sale running) brings nothing.
  events.emit('purchase', { kind: 'weapon', id: 'rivetRifle' });
  sales.update(5);
  assert.equal(spawns.length, 6);
});

test('doorbuster: a door is bought by its destination; a Doorbuster that expires unbought never brings a rush', () => {
  const doorTarget = { ...sampleDbTarget, category: 'door', id: 'atrium', itemLabel: 'Grand Atrium shutter', itemPhrase: 'the Grand Atrium shutter' };
  const spawns = [];
  const events = createEvents();
  const make = () => createFlashSales({
    events, pricing: createPricing(), random: dice(0.8, 0.5), config: dbCfg({ teaserSeconds: 0 }), eligible: () => false,
    doorbusters: () => [doorTarget], getRound: () => 5, nearSpawnPoints: () => [], onRushSpawn: () => { spawns.push(1); return {}; },
  });
  const sales = make();
  assert.equal(sales.startNow('doorbuster'), true);
  events.emit('purchase', { kind: 'door', id: 'atriumMegaMart', areaId: 'atrium' }); // any entrance to the Atrium
  assert.equal(sales.active, null);
  assert.equal(spawns.length, 1);

  const events2 = createEvents();
  const spawns2 = [];
  const unbought = createFlashSales({
    events: events2, pricing: createPricing(), random: dice(0.8, 0.5), config: dbCfg({ teaserSeconds: 0 }), eligible: () => false,
    doorbusters: () => [doorTarget], getRound: () => 5, nearSpawnPoints: () => [], onRushSpawn: () => { spawns2.push(1); return {}; },
  });
  assert.equal(unbought.startNow('doorbuster'), true);
  unbought.update(25);
  assert.equal(unbought.active, null, 'expired');
  events2.emit('purchase', { kind: 'door', id: 'atrium', areaId: 'atrium' }); // bought at full price afterwards
  unbought.update(5);
  assert.equal(spawns2.length, 0, 'let it pass: no shoppers');
});

test('doorbuster: only an item you can get to in time is offered (reachableInTime)', () => {
  const far = { ...sampleDbTarget, id: 'rivetRifle' };
  const near = { ...sampleDbTarget, id: 'nailGun', itemLabel: 'Nail Gun', position: { x: 0, y: 1.5, z: 0 }, positions: [{ position: { x: 0, y: 1.5, z: 0 } }] };
  const route = (p) => Math.hypot(p.x, p.z); // the player stands at the origin
  assert.equal(reachableInTime(near, route, 10), true);
  assert.equal(reachableInTime(far, route, 10), false, 'about 23 m away');
  assert.equal(reachableInTime({ ...far, positions: [...far.positions, { position: { x: 3, y: 0, z: 4 } }] }, route, 10), true,
    'any one of its buy spots in reach will do');
  assert.equal(reachableInTime(far, () => Infinity, 1e9), false, 'no route at all');

  const reachable = (t) => reachableInTime(t, route, 10);
  const onlyFar = createFlashSales({
    events: createEvents(), pricing: createPricing(), random: dice(0.8, 0), config: dbCfg(), eligible: () => true,
    doorbusters: () => [far], reachable, getRound: () => 5,
  });
  assert.equal(onlyFar.startNow('doorbuster'), false, 'nothing in reach: no Doorbuster');
  onlyFar.update(10); // the scheduled pick (roll 0.8 would have been a Doorbuster)
  assert.equal(onlyFar.pending?.kind ?? onlyFar.active?.kind, 'category', 'a normal sale instead');
  const both = createFlashSales({
    events: createEvents(), pricing: createPricing(), random: dice(0.99, 0.99), config: dbCfg(), eligible: () => false,
    doorbusters: () => [far, near], reachable, getRound: () => 5,
  });
  assert.equal(both.startNow('doorbuster'), true);
  assert.equal(both.active.target.id, 'nailGun', 'the one in reach');
});

test('the real game: Doorbuster picks only eligible items, discounts one spot, spawns open-zone rush, and completes round', () => {
  const t = headlessGame();
  const { g } = t;
  g.health.invulnerable = true; // (the long kill loops below must not end in a death)
  t.tick(1);
  // Seed AFTER headlessGame() built the map (CLAUDE.md rule).
  const realRandom = Math.random;
  let seed = 42;
  Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  try {
    // Only Start Room open at round 1: no closed-zone wall guns (e.g. Rivet Rifle in Atrium) are eligible.
    const initialCandidates = doorbusterCandidates({ map: g.map, gun: g.gun, wardrobe: g.wardrobe, kiosk: g.features.instanceOf('kiosk'), equipment: g.equipment, health: g.health });
    assert.ok(!initialCandidates.some((c) => c.zone === 'atrium'), 'locked Atrium items are not eligible');
    assert.ok(!initialCandidates.some((c) => c.category === 'door' && c.id === 'atrium'), 'non-adjacent Atrium door is not eligible yet');

    // Unlock Hallway + Atrium so Grand Atrium's Rivet Rifle is reachable, jump to round 4 (mid-wave).
    g.map.areaUnlocks.unlock('hallway');
    g.map.areaUnlocks.unlock('atrium');
    g.rounds.jumpTo(4);
    t.tick(2); // enter active wave of round 4
    const remainingBefore = g.rounds.remainingToSpawn;

    const openCandidates = doorbusterCandidates({ map: g.map, gun: g.gun, wardrobe: g.wardrobe, kiosk: g.features.instanceOf('kiosk'), equipment: g.equipment, health: g.health });
    assert.ok(openCandidates.some((c) => c.category === 'weapon' && c.id === 'rivetRifle'), 'Rivet Rifle becomes eligible once Atrium opens');

    // Give Nail Gun + Price Gun and keep Rivet Rifle unowned, trigger Doorbuster on an eligible item via startNow('doorbuster').
    // A spy on the zombie manager: the rush is the spawns asked for with a spawnPoints list (the wave never passes one).
    g.gun.give(weapons.nailGun);
    const rushSpawns = [];
    const realSpawn = g.zombies.spawn;
    g.zombies.spawn = function (typeId, at, opts = {}) {
      const zombie = realSpawn.call(this, typeId, at, opts);
      if (opts.spawnPoints && zombie) rushSpawns.push({ zombie, at: zombie.position.clone(), points: opts.spawnPoints });
      return zombie;
    };
    assert.equal(g.flashSales.startNow('doorbuster'), true);
    const db = g.flashSales.active;
    assert.equal(db.kind, 'doorbuster');
    assert.equal(g.rounds.remainingToSpawn, remainingBefore, 'Doorbuster rush is extra zombies, never shrinks round remainingToSpawn');
    t.tick(60);
    assert.equal(rushSpawns.length, 0, 'no rush while the item is only on sale');
    // Bought (the purchase the interaction would announce; a door by its destination): sold out, the rush comes.
    g.events.emit('purchase', { kind: db.target.category, id: db.target.id, areaId: db.target.id });
    assert.equal(g.flashSales.active, null, 'sold out');

    // Tick 4 seconds so the rush finishes queuing within maxAliveForRound(4).
    t.tick(60 * 4);
    const rushCfg = economy.flashSales.doorbuster;
    const expectedRush = Math.min(rushCfg.rush.maxCount, rushCfg.rush.baseCount + Math.floor((4 - rushCfg.fromRound) * rushCfg.rush.perRound));
    assert.equal(rushSpawns.length, expectedRush, 'exactly the round-scaled rush spawned, through the zombie manager');
    for (const { zombie, at, points } of rushSpawns) {
      assert.ok(points.length <= rushCfg.rush.nearestMarkers && points.every((p) => g.map.zones[p.zone].open), 'near, open-zone markers only');
      assert.ok(points.some((p) => p.position.x === at.x && p.position.z === at.z), 'rose at one of those markers');
      assert.ok(g.zombies.zombies.includes(zombie), 'a normal managed zombie (failsafe, caps and round count see it)');
    }
    g.zombies.spawn = realSpawn;
    assert.ok(g.zombies.aliveCount <= maxAliveForRound(4), 'alive count stayed within round maxAlive cap');
    for (const z of g.zombies.zombies) {
      assert.equal(z.noRewards, false, 'rush zombies count as normal zombies for points');
      assert.equal(z.fanOwner ?? null, null);
    }
    // Every spawn point selected by nearOpenSpawnPoints is in an open zone.
    const near = nearOpenSpawnPoints(g.map, g.map.features.find((f) => f.kind === 'wallBuy' && f.weapon === 'rivetRifle').position);
    assert.ok(near.length > 0 && near.every((p) => g.map.zones[p.zone]?.open), 'rush markers only come from open zones');

    // Clear the rest of round 4 (remaining spawns + alive rush/wave zombies) -> round advances to 5!
    const pointsBeforeKill = g.wallet.points;
    let safety = 0;
    while (g.rounds.round === 4 && safety++ < 100) {
      for (const z of g.zombies.zombies) if (z.isAlive) z.takeHit({ damage: Infinity, part: 'body' });
      t.tick(60);
    }
    assert.equal(g.rounds.round, 5, 'round completed cleanly after clearing wave and rush zombies');
    assert.ok(g.wallet.points > pointsBeforeKill, 'killing rush/wave zombies paid normal points');

    // Starting a Doorbuster during a round break also enters and finishes that round cleanly.
    g.flashSales.reset();
    assert.equal(g.rounds.inBreak, true);
    assert.equal(g.flashSales.startNow('doorbuster'), true);
    const breakTarget = g.flashSales.active.target;
    g.events.emit('purchase', { kind: breakTarget.category, id: breakTarget.id, areaId: breakTarget.id });
    t.tick(60 * 3);
    assert.equal(g.rounds.inBreak, true, 'still the break');
    assert.ok(g.zombies.aliveCount > 0, 'the rush came during the break');
    assert.ok(g.zombies.aliveCount <= maxAliveForRound(5));
    // ...and round 5 (its full wave plus the break's rush) still ends when everything is dead: nothing stalls.
    safety = 0;
    while (g.rounds.round === 5 && safety++ < 200) {
      for (const z of g.zombies.zombies) if (z.isAlive) z.takeHit({ damage: Infinity, part: 'body' });
      t.tick(60);
    }
    assert.equal(g.rounds.round, 6, 'round 5 completed cleanly after a break-time rush');
  } finally {
    Math.random = realRandom;
    g.map.dispose();
  }
});

test('in-world 3D sale tags: pool counts track teaser, live sale, purchase removal, Doorbuster beacon, and reset', () => {
  const t = headlessGame();
  const { g } = t;
  const scene = new THREE.Scene();
  const view = createSaleTagView(scene, g);
  t.tick(1);

  assert.equal(view.root.userData.dynamic, true, 'excluded from static batching cleanly');
  view.update(0.1);
  assert.deepEqual(view.counts(), { soon: 0, sale: 0, doorbuster: 0, beacon: false });

  // Teaser shows SALE SOON tags.
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter((grp) => grp.id === 'doors');
  try {
    assert.equal(g.flashSales.teaseNow('category'), true);
    view.update(0.1);
    assert.ok(view.counts().soon > 0, 'teaser spawns world SALE SOON tags');
    assert.equal(view.counts().sale, 0);

    // Go live -> swaps cleanly to SALE tags; unlocking doors removes those tags.
    g.flashSales.update(economy.flashSales.teaserSeconds);
    view.update(0.1);
    const liveDoors = view.counts().sale;
    assert.ok(liveDoors > 0);
    assert.equal(view.counts().soon, 0);
    for (const d of g.map.doors) d.open();
    view.refresh();
    view.update(0.1);
    assert.equal(view.counts().sale, 0, 'opening discounted doors clears their tags immediately');
  } finally {
    economy.flashSales.groups = groups;
    g.flashSales.reset();
  }

  // Doorbuster shows distinct Doorbuster tag + light beacon, then clears on reset.
  assert.equal(g.flashSales.startNow('doorbuster'), true);
  view.update(0.1);
  assert.ok(view.counts().doorbuster >= 1);
  assert.equal(view.counts().beacon, true);
  g.resetRun();
  view.update(0.1);
  assert.deepEqual(view.counts(), { soon: 0, sale: 0, doorbuster: 0, beacon: false });
  g.map.dispose();
});

test('the tag view lets go: dispose() stops listening, frees its pools and leaves the scene', () => {
  const t = headlessGame();
  const { g } = t;
  const scene = new THREE.Scene();
  const before = g.events.count('flashSaleStart');
  const view = createSaleTagView(scene, g);
  assert.equal(g.events.count('flashSaleStart'), before + 1);
  view.dispose();
  assert.equal(g.events.count('flashSaleStart'), before, 'listener removed');
  assert.equal(view.root.parent, null, 'out of the scene');
  g.map.dispose();
});

test('the real game: an Extended Warranty sale marks the Customer Service desk; attachment Doorbusters only fit a carried gun', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.map.areaUnlocks.unlock('hallway');
  g.map.areaUnlocks.unlock('foodCourt');
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter((grp) => grp.id === 'tiers');
  try {
    assert.equal(g.flashSales.startNow(), true);
    const desks = g.map.features.filter((f) => f.kind === 'upgradeDesk' && g.map.zones[f.zone].open);
    assert.ok(desks.length > 0, 'the desk is in a bought area');
    const spots = collectSaleSpots(g, g.flashSales.active);
    assert.equal(spots.filter((s) => s.category === 'tier').length, desks.length, 'the desk carries the sale marker');
  } finally {
    economy.flashSales.groups = groups;
    g.flashSales.reset();
  }
  const kiosk = g.features.instanceOf('kiosk');
  const candidates = doorbusterCandidates({ map: g.map, gun: g.gun, wardrobe: g.wardrobe, kiosk, equipment: g.equipment, health: g.health });
  const attachments = candidates.filter((c) => c.category === 'attachment');
  assert.ok(attachments.length > 0, 'the Food Court counters are open');
  for (const c of attachments) assert.ok(attachmentFits(g.gun.def.base, c.id), `${c.id} fits the gun in hand`);
  const unarmed = { ...g.gun, owns: (id) => g.gun.owns(id), modsFor: (id) => g.gun.modsFor(id), def: null, inactiveSlot: null };
  assert.equal(doorbusterCandidates({ map: g.map, gun: unarmed, wardrobe: g.wardrobe, kiosk }).filter((c) => c.category === 'attachment').length, 0,
    'no carried gun: no attachment is worth a Doorbuster');
  g.map.dispose();
});

test('the tag view re-reads while a sale is on, so a spot that becomes usable without an event still gets its tag', () => {
  const t = headlessGame();
  const { g } = t;
  const scene = new THREE.Scene();
  const view = createSaleTagView(scene, g);
  t.tick(1);
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter((grp) => grp.id === 'tiers');
  try {
    assert.equal(g.flashSales.teaseNow('category'), true, 'a warranty teaser while the desk is still behind a shutter');
    view.update(0.1);
    assert.equal(view.counts().soon, 0, 'the Customer Service desk is not usable yet');
    g.map.areaUnlocks.unlock('hallway'); // (no 'purchase' event on this path)
    view.update(economy.flashSales.worldTag.syncIntervalSeconds + 0.01);
    assert.equal(view.counts().soon, 1, 'the desk gets its SALE SOON tag on the next timed re-read');
  } finally {
    economy.flashSales.groups = groups;
    view.dispose();
    g.map.dispose();
  }
});

test('a shutter on sale points its tag at the bought side (out of the shutter), never into the closed area', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  const sale = { kind: 'category', categories: ['door'] };
  const start = collectSaleSpots(g, sale).find((s) => s.category === 'door' && s.id === 'hallway' && s.z < 7);
  assert.ok(start, 'the start shutter is on sale');
  assert.deepEqual(start.normal, { x: 0, y: 0, z: 1 }, 'the start room (z 6..16) is the bought side');
  g.map.areaUnlocks.unlock('hallway');
  const fromHallway = collectSaleSpots(g, sale).filter((s) => s.category === 'door');
  assert.ok(fromHallway.length > 3);
  for (const s of fromHallway) {
    assert.ok(s.normal, `${s.id} has a side`);
    const probe = { x: s.x + s.normal.x * 1.5, y: s.y, z: s.z + s.normal.z * 1.5 };
    assert.ok(g.map.zones[g.map.areaAt(probe)]?.open, `${s.id}: the tag side is a bought area`);
  }
  g.map.dispose();
});

test('rush markers stay near the item even when only a few markers are open (none from across the mall)', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.map.areaUnlocks.unlock('hallway'); // start room + hallway: only a handful of open markers, spread 40 m apart
  const shutter = g.map.doors.find((d) => d.id === 'serviceCorridor').position; // the hallway's west end
  const { nearestMarkers, maxMarkerDistance } = economy.flashSales.doorbuster.rush;
  const near = nearOpenSpawnPoints(g.map, shutter);
  assert.ok(near.length >= 1 && near.length <= nearestMarkers);
  for (const p of near) assert.ok(Math.hypot(p.position.x - shutter.x, p.position.z - shutter.z) <= maxMarkerDistance, `${p.name} is near`);
  const openCount = g.map.spawnPoints.filter((p) => g.map.zones[p.zone].open).length;
  assert.ok(near.length < Math.min(openCount, nearestMarkers), 'the far ones are left out');
  // Nothing within reach at all: the single nearest marker, never an empty list (the rush must have somewhere to come from).
  assert.equal(nearOpenSpawnPoints(g.map, shutter, 5, 0.1).length, 1);
  g.map.dispose();
});

test('the real game: buying a Doorbuster at the wall charges the Doorbuster price, sells it out, and brings the rush', () => {
  const t = headlessGame();
  const { g } = t;
  g.health.invulnerable = true;
  t.tick(1);
  g.rounds.jumpTo(4);
  t.tick(30);
  g.debug.run('clearZombies');
  // (Debug start, so the item is whichever the dice give: try until it is the Price Gun on the start room's wall.)
  let tries = 0;
  while (tries++ < 200 && !(g.flashSales.startNow('doorbuster') && g.flashSales.active.target.id === 'priceGun')) g.flashSales.reset();
  assert.equal(g.flashSales.active?.target.id, 'priceGun', 'the Price Gun is a Doorbuster');
  const price = g.pricing.priceOf('weapon', 'priceGun');
  assert.ok(price < economy.wallBuys.priceGun.weapon);
  const ends = [];
  g.events.on('flashSaleEnd', (e) => ends.push(e.reason));
  const rush = [];
  const realSpawn = g.zombies.spawn;
  g.zombies.spawn = function (typeId, at, opts = {}) {
    const zombie = realSpawn.call(this, typeId, at, opts);
    if (opts.spawnPoints && zombie) rush.push(zombie);
    return zombie;
  };
  try {
    t.tick(60);
    assert.equal(rush.length, 0, 'on sale, not bought: no one comes');
    g.wallet.earn(5000);
    t.standAt(3.5, 10, -90);
    t.tick(2);
    assert.equal(g.interactions.prompt.cost, price);
    const before = g.wallet.points;
    t.press('KeyF', 30);
    assert.equal(before - g.wallet.points, price, 'paid the Doorbuster price');
    assert.ok(g.gun.owns('priceGun'));
    assert.deepEqual(ends, ['sold']);
    assert.equal(g.flashSales.active, null);
    t.tick(60 * 3);
    assert.ok(rush.length > 0, 'the rush came');
    for (const z of rush) assert.ok(g.zombies.zombies.includes(z));
  } finally {
    g.zombies.spawn = realSpawn;
    g.map.dispose();
  }
});
