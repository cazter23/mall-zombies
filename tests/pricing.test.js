// game/pricing.js: every price the player pays, base (config/economy.js) + discounts (future Flash Sales).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createPricing, PRICE_CATEGORIES } from '../src/game/pricing.js';
import { economy } from '../src/config/economy.js';
import { powerUps as incentives } from '../src/config/powerUps.js';
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
  for (const [id, price] of Object.entries(economy.wardrobe)) {
    assert.equal(p.priceOf('wardrobe', id), price, id);
    assert.equal(p.priceOf('wearOMatic', id), Math.round((price * economy.wearOMatic.markup) / economy.discountRoundTo) * economy.discountRoundTo, `${id} at the WEAR-O-MATIC`);
  }
  assert.deepEqual(PRICE_CATEGORIES, ['door', 'weapon', 'ammo', 'ammoCache', 'tier', 'melee', 'workshop', 'attachment', 'wardrobe', 'wearOMatic', 'claw', 'kiosk', 'closing', 'hazard', 'secondChance']);
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

test('per-item discounts affect only that one item, validate cleanly, and restore on serialize/reset', () => {
  const p = createPricing();
  p.setItemDiscount('weapon', 'rivetRifle', 0.7);
  assert.equal(p.itemDiscountOf('weapon', 'rivetRifle'), 0.7);
  assert.equal(p.discountOf('weapon', 'rivetRifle'), 0.7);
  assert.equal(p.discountOf('weapon', 'nailGun'), 0);
  assert.equal(p.discountOf('weapon'), 0);
  assert.equal(p.priceOf('weapon', 'rivetRifle'), Math.round((economy.wallBuys.rivetRifle.weapon * 0.3) / economy.discountRoundTo) * economy.discountRoundTo);
  assert.equal(p.priceOf('weapon', 'nailGun'), economy.wallBuys.nailGun.weapon, 'other guns stay full price');
  assert.equal(p.priceOf('ammo', 'rivetRifle'), economy.wallBuys.rivetRifle.ammo, 'ammo category untouched');
  assert.throws(() => p.setItemDiscount('weapon', 'rayGun', 0.5), /no weapon price/);
  assert.throws(() => p.setItemDiscount('weapon', '', 0.5), /non-empty string/);
  assert.throws(() => p.setItemDiscount('weapon', 'rivetRifle', 1.2), /0..1/);

  const saved = p.serialize();
  const clone = createPricing();
  clone.restore(saved);
  assert.equal(clone.priceOf('weapon', 'rivetRifle'), p.priceOf('weapon', 'rivetRifle'));

  p.setItemDiscount('weapon', 'rivetRifle', 0);
  assert.equal(p.priceOf('weapon', 'rivetRifle'), economy.wallBuys.rivetRifle.weapon);
  p.setItemDiscount('weapon', 'nailGun', 0.7);
  p.reset();
  assert.equal(p.priceOf('weapon', 'nailGun'), economy.wallBuys.nailGun.weapon);
});

test('Flash Sale + employee incentive coupon still stack identically (and work with Doorbuster per-item discounts)', () => {
  const p = createPricing();
  const base = economy.wallBuys.rivetRifle.weapon;
  const step = economy.discountRoundTo;
  const coupon = { fraction: 0.25, maxSaving: 300 };
  p.setDiscount('weapon', 0.4); // 40% category Flash Sale -> 900
  p.setCoupon(coupon);
  const expectedSale = Math.round((base * 0.6) / step) * step;
  const expectedCoupon = expectedSale - Math.min(coupon.maxSaving, Math.floor((expectedSale * coupon.fraction) / step) * step);
  assert.equal(p.priceOf('weapon', 'rivetRifle'), expectedCoupon);

  // Per-item Doorbuster discount + coupon uses the exact same pipeline.
  p.reset();
  p.setItemDiscount('weapon', 'rivetRifle', 0.7);
  p.setCoupon(coupon);
  const expectedDb = Math.round((base * 0.3) / step) * step;
  const expectedDbCoupon = expectedDb - Math.min(coupon.maxSaving, Math.floor((expectedDb * coupon.fraction) / step) * step);
  assert.equal(p.priceOf('weapon', 'rivetRifle'), expectedDbCoupon);

  // Pinned numbers (what main's pricing charged before per-item discounts existed): 1500 at 40% off = 900, minus the
  // coupon's 25% rounded down to 10 (220) = 680; at 70% off = 450, minus 110 = 340. A change in the stacking moves these.
  assert.equal(expectedCoupon, 680);
  assert.equal(expectedDbCoupon, 340);

  // Real game: a real Flash Sale on wall guns plus the real Employee Discount incentive (dropped at your feet and picked
  // up), on the Price Gun's prompt and its charge. The incentive files are untouched; this only reads their result.
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.wallet.earn(5000);
  const groups = economy.flashSales.groups;
  economy.flashSales.groups = groups.filter((grp) => grp.id === 'weapons');
  try {
    assert.equal(g.flashSales.startNow(), true);
  } finally {
    economy.flashSales.groups = groups;
  }
  const off = g.pricing.discountOf('weapon');
  assert.ok(off >= economy.flashSales.discounts.min && off <= economy.flashSales.discounts.max);
  t.standAt(3.5, 10, -90);
  assert.ok(g.powerUps.debugDrop('employeeDiscount'));
  t.tick(2);
  const { fraction, maxSaving } = incentives.types.employeeDiscount;
  const pgBase = economy.wallBuys.priceGun.weapon;
  const pgSale = Math.round((pgBase * (1 - off)) / step) * step;
  const pgCombined = pgSale - Math.min(maxSaving, Math.floor((pgSale * fraction) / step) * step);
  assert.ok(pgCombined < pgSale, 'the coupon took something off the sale price');
  assert.equal(g.interactions.prompt.cost, pgCombined);
  const before = g.wallet.points;
  t.press('KeyF', 30);
  assert.equal(before - g.wallet.points, pgCombined);
  g.map.dispose();
});
