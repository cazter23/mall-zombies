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
  assert.deepEqual(PRICE_CATEGORIES, ['door', 'weapon', 'ammo', 'ammoCache']);
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
  assert.equal(g.interactions.prompt.cost, economy.doors.startShutter / 2, 'the prompt shows the sale price');
  t.press('KeyF', 30);
  assert.equal(g.map.doors.find((d) => d.id === 'startShutter').isOpen, true);
  assert.equal(g.wallet.points, economy.startingPoints - economy.doors.startShutter / 2, 'charged the sale price');
  g.resetRun();
  assert.equal(g.pricing.discountOf('door'), 0);
});
