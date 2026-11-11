// game/pricing.js: every price the player pays, base (config/economy.js) + discounts (future Flash Sales).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPricing, PRICE_CATEGORIES } from '../src/game/pricing.js';
import { economy } from '../src/config/economy.js';
import { headlessGame } from './helpers/headlessGame.js';

test('no discount: every price is exactly the config price', () => {
  const p = createPricing();
  for (const [id, price] of Object.entries(economy.doors)) assert.equal(p.priceOf('door', id), price, id);
  for (const [id, { weapon, ammo }] of Object.entries(economy.wallBuys)) {
    assert.equal(p.priceOf('weapon', id), weapon, id);
    assert.equal(p.priceOf('ammo', id), ammo, id);
  }
  assert.equal(p.priceOf('ammoCache'), economy.ammoCache.price);
  for (const [id, price] of Object.entries(economy.upgrades.tiers)) assert.equal(p.priceOf('tier', id), price, id);
  for (const [id, price] of Object.entries(economy.upgrades.attachments)) assert.equal(p.priceOf('attachment', id), price, id);
  assert.equal(p.priceOf('claw', 'grab'), economy.claw.grab);
  for (const [id, price] of Object.entries(economy.hazards)) assert.equal(p.priceOf('hazard', id), price, id);
  assert.equal(p.priceOf('secondChance'), economy.secondChance.price);
  assert.deepEqual(PRICE_CATEGORIES, ['door', 'weapon', 'ammo', 'ammoCache', 'tier', 'melee', 'workshop', 'attachment', 'wardrobe', 'claw', 'kiosk', 'hazard', 'secondChance']);
});

test('a discount hits only its category, rounds to the nearest 10, and can be removed', () => {
  const p = createPricing();
  p.setDiscount('weapon', 0.25);
  assert.equal(p.priceOf('weapon', 'nailGun'), 750); // 1000 -> 750
  assert.equal(p.priceOf('weapon', 'foamDartBlaster'), 900); // 1200 -> 900
  assert.equal(p.priceOf('door', 'megaMart'), economy.doors.megaMart, 'doors untouched');
  assert.equal(p.priceOf('ammo', 'nailGun'), economy.wallBuys.nailGun.ammo, 'ammo untouched');
  p.setDiscount('ammoCache', 0.33);
  assert.equal(p.priceOf('ammoCache'), 270); // 400 * 0.67 = 268 -> 270
  p.setDiscount('weapon', 0);
  assert.equal(p.priceOf('weapon', 'nailGun'), 1000);
  p.reset();
  assert.equal(p.discountOf('ammoCache'), 0);
});

test('mistakes are errors, not free items', () => {
  const p = createPricing();
  assert.throws(() => p.priceOf('perk', 'x'), /unknown category/);
  assert.throws(() => p.priceOf('door', 'secretRoom'), /no door price/);
  assert.throws(() => p.priceOf('weapon', 'rayGun'), /no weapon price/);
  assert.throws(() => p.setDiscount('door', 1.5), /0..1/);
  assert.throws(() => p.setDiscount('door', -0.1), /0..1/);
});

test('the real game charges (and shows) the discounted price, and a new run has no discounts', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.pricing.setDiscount('door', 0.5);
  t.standAt(0, 8.5, 0);
  t.tick(2);
  assert.equal(g.interactions.prompt.cost, economy.doors.hallway / 2, 'the prompt shows the sale price');
  t.press('KeyF', 30);
  assert.equal(g.map.doors.find((d) => d.id === 'startShutter').isOpen, true);
  assert.equal(g.wallet.points, economy.startingPoints - economy.doors.hallway / 2, 'charged the sale price');
  g.resetRun();
  assert.equal(g.pricing.discountOf('door'), 0);
});

test('inherited names are not categories (no "free" toString / constructor prices)', () => {
  const p = createPricing();
  for (const name of ['toString', 'constructor', '__proto__', 'hasOwnProperty']) {
    assert.throws(() => p.priceOf(name, 'x'), /unknown category/, name);
    assert.throws(() => p.setDiscount(name, 0.5), /unknown category/, name);
  }
});

test('the real game charges sale prices for a gun, its ammo and the RESTOCK-O-MATIC', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.wallet.earn(10_000);
  for (const c of ['weapon', 'ammo', 'ammoCache']) g.pricing.setDiscount(c, 0.5);
  const half = (n) => Math.round(n / 2 / economy.discountRoundTo) * economy.discountRoundTo;
  const buy = (x, z, yaw) => { const before = g.wallet.points; t.standAt(x, z, yaw); t.press('KeyF', 30); t.tick(40); return before - g.wallet.points; };
  assert.equal(buy(3.5, 10, -90), half(economy.wallBuys.priceGun.weapon), 'Price Gun on sale');
  g.gun.weapon.magazine = 1;
  assert.equal(buy(3.5, 10, -90), half(economy.wallBuys.priceGun.ammo), 'its ammo on sale');
  for (const d of g.map.doors) d.open();
  t.tick(120);
  g.gun.weapon.magazine = 1;
  const cache = g.map.features.find((f) => f.kind === 'ammoCache');
  assert.equal(buy(cache.position.x + 1.5, cache.position.z, 90), half(economy.ammoCache.price), 'the cache on sale');
});

test('a sale that starts mid-hold: you pay the price when the hold completes', () => {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  t.standAt(0, 8.5, 0);
  t.input.pressed.add('KeyF'); t.input.held.add('KeyF');
  t.tick(5); // holding, not done yet (0.25 s = 15 ticks)
  assert.equal(g.map.doors.find((d) => d.id === 'startShutter').isOpen, false);
  g.pricing.setDiscount('door', 0.5);
  t.tick(30);
  t.input.held.delete('KeyF');
  assert.equal(g.map.doors.find((d) => d.id === 'startShutter').isOpen, true);
  assert.equal(g.wallet.points, economy.startingPoints - economy.doors.hallway / 2);
});
