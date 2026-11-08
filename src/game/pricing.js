// =============================================================================
// PRICING: the one place a price is decided (createGame makes one: g.pricing).
// Base prices live in config/economy.js; this applies any active discount on top (Flash Sales:
// "25-50% off one category"), so every buyable shows and charges the same, current price.
//
//   priceOf('door', areaId)        economy.doors[areaId] (destination, independent of entrance)
//   priceOf('weapon', gunId)       economy.wallBuys[gunId].weapon
//   priceOf('ammo', gunId)         economy.wallBuys[gunId].ammo
//   priceOf('ammoCache')           economy.ammoCache.price
//   priceOf('tier', tierId)        economy.upgrades.tiers[tierId] (Extended Warranty: deluxe / premium / platinum)
//   priceOf('attachment', id)      economy.upgrades.attachments[id]
//   basePriceOf(category, id)      original shelf price before a discount (same validation/source)
//   setDiscount(category, 0.25)    25% off everything in that category (0 = none); rounded to the nearest
//                                  economy.discountRoundTo (10)
//   reset()                        no discounts (a new run)
// An unknown category or id is an error (a typo shouldn't make something free).
// =============================================================================

import { economy } from '../config/economy.js';

const BASE = {
  door: (id) => economy.doors[id],
  weapon: (id) => economy.wallBuys[id]?.weapon,
  ammo: (id) => economy.wallBuys[id]?.ammo,
  ammoCache: () => economy.ammoCache.price,
  tier: (id) => (Object.hasOwn(economy.upgrades.tiers, id) ? economy.upgrades.tiers[id] : undefined),
  workshop: (id) => (Object.hasOwn(economy.upgrades.workshop, id) ? economy.upgrades.workshop[id] : undefined),
  attachment: (id) => (Object.hasOwn(economy.upgrades.attachments, id) ? economy.upgrades.attachments[id] : undefined),
};

export const PRICE_CATEGORIES = Object.keys(BASE);

export function createPricing() {
  const discounts = new Map(); // category -> fraction off (0..1)
  let voucher = null;
  let voucherOptions = {};
  let coupon = null; // One employee coupon, applied after category sales.

  function check(category) {
    if (!Object.hasOwn(BASE, category)) throw new Error(`pricing: unknown category "${category}" (${PRICE_CATEGORIES.join(', ')})`);
  }

  function basePriceOf(category, id) {
    check(category);
    const base = BASE[category](id);
    if (typeof base !== 'number') throw new Error(`pricing: no ${category} price for "${id}"`);
    return base;
  }

  function applies(category, id) {
    return voucher && !voucher.excludedCategories?.includes(category)
      && (!voucher.category || voucher.category === category)
      && (!voucher.ids || voucher.ids.includes(id));
  }
  function update() {
    if (!voucher || !voucherOptions.eligible || voucherOptions.eligible(voucher)) return;
    const value = voucher;
    voucher = null;
    voucherOptions.onPoints?.(value.pointsInstead);
  }

  return {
    get voucher() { return voucher; },
    clearVoucher() { voucher = null; },
    configureVouchers(options) { voucherOptions = options; },
    setVoucher(value) {
      if (voucher) return false;
      voucher = value;
      update();
      return true;
    },
    spendVoucher(category, id) { if (applies(category, id)) voucher = null; update(); },
    update,
    basePriceOf, // crossed-out shelf price; uses the same source and validation as the charged price
    priceOf(category, id) {
      const base = basePriceOf(category, id);
      const off = discounts.get(category) ?? 0;
      const step = economy.discountRoundTo;
      const salePrice = off > 0 ? Math.round((base * (1 - off)) / step) * step : base;
      const couponPrice = coupon ? salePrice - Math.min(coupon.maxSaving, Math.floor(salePrice * coupon.fraction / step) * step) : salePrice;
      return applies(category, id) ? couponPrice - Math.min(voucher.maxSaving ?? Infinity,
        Math.floor(couponPrice * voucher.fraction / step) * step) : couponPrice;
    },

    setCoupon(value) { coupon = value; },
    clearCoupon() { coupon = null; },

    setDiscount(category, fraction) {
      check(category);
      if (!(fraction >= 0 && fraction <= 1)) throw new Error(`pricing: discount must be 0..1, got ${fraction}`);
      if (fraction === 0) discounts.delete(category);
      else discounts.set(category, fraction);
    },

    discountOf(category) {
      check(category);
      return discounts.get(category) ?? 0;
    },

    reset() {
      voucher = null;
      discounts.clear();
      coupon = null;
    },
  };
}
