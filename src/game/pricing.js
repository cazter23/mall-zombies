// =============================================================================
// PRICING: the one place a price is decided (createGame makes one: g.pricing).
// Base prices live in config/economy.js; this applies any active discount on top (Flash Sales:
// "25-50% off one category"), so every buyable shows and charges the same, current price.
//
//   priceOf('door', areaId)        economy.doors[areaId] (destination, independent of entrance)
//   priceOf('weapon', gunId)       economy.wallBuys[gunId].weapon
//   priceOf('ammo', gunId)         economy.wallBuys[gunId].ammo
//   priceOf('ammoCache')           economy.ammoCache.price
//   priceOf('secondChance')        economy.secondChance.price
//   priceOf('tier', tierId)        economy.upgrades.tiers[tierId] (Extended Warranty: deluxe / premium / platinum)
//   priceOf('melee', tierId)       economy.upgrades.melee[tierId] (box cutter tiers: sharpened / pro)
//   priceOf('attachment', id)     economy.upgrades.attachments[id]
//   priceOf('wardrobe', id)      economy.wardrobe[id]
//   priceOf('claw', 'grab')        economy.claw.grab (GRAB-A-GUN; the Discount Code excludes this category: config/bosses.js)
//   priceOf('closing', id)       economy.closing[id] (closing duties)
//   basePriceOf(category, id)      original shelf price before a discount (same validation/source)
//   setDiscount(category, 0.25)    25% off everything in that category (0 = none); rounded to the nearest
//                                  economy.discountRoundTo (10)
//   reset()                        no discounts (a new run)
// An unknown category or id is an error (a typo shouldn't make something free).
// =============================================================================

import { economy } from '../config/economy.js';
import { upgrades } from '../config/upgrades.js';

const BASE = {
  door: (id) => economy.doors[id],
  weapon: (id) => economy.wallBuys[id]?.weapon,
  ammo: (id) => economy.wallBuys[id]?.ammo,
  ammoCache: () => economy.ammoCache.price,
  // A tier ('deluxe'), a Warranty Renewal ('renewal1'..), or moving a warranty on file onto the gun in hand ('transfer:premium': a share of that tier's price).
  tier: (id) => {
    if (Object.hasOwn(economy.upgrades.tiers, id)) return economy.upgrades.tiers[id];
    const renewal = /^renewal(\d+)$/.exec(id);
    if (renewal) return economy.upgrades.renewals[Number(renewal[1]) - 1];
    const transfer = /^transfer:(\w+)$/.exec(id);
    if (transfer && Object.hasOwn(economy.upgrades.tiers, transfer[1])) return Math.round(economy.upgrades.tiers[transfer[1]] * upgrades.transfer.feeFraction);
    return undefined;
  },
  melee: (id) => (Object.hasOwn(economy.upgrades.melee, id) ? economy.upgrades.melee[id] : undefined), // box cutter tiers: sharpened / pro
  workshop: (id) => (Object.hasOwn(economy.upgrades.workshop, id) ? economy.upgrades.workshop[id] : undefined),
  attachment: (id) => (Object.hasOwn(economy.upgrades.attachments, id) ? economy.upgrades.attachments[id] : undefined),
  wardrobe: (id) => (Object.hasOwn(economy.wardrobe, id) ? economy.wardrobe[id] : undefined),
  claw: (id) => (Object.hasOwn(economy.claw, id) ? economy.claw[id] : undefined), // GRAB-A-GUN ('grab': the pay step only)
  kiosk: (id) => (Object.hasOwn(economy.kiosk, id) ? economy.kiosk[id] : undefined),
  closing: (id) => (Object.hasOwn(economy.closing, id) ? economy.closing[id] : undefined),
  hazard: (id) => (Object.hasOwn(economy.hazards, id) ? economy.hazards[id] : undefined), // Environmental hazards (config/hazards.js)
  secondChance: () => economy.secondChance.price,
};

export const PRICE_CATEGORIES = Object.keys(BASE);

export function createPricing() {
  const discounts = new Map(); // category -> fraction off (0..1)
  const itemDiscounts = new Map(); // category -> Map(id -> fraction off (0..1))
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
    // `paid`: what the purchase cost. A free refit (paid 0) is not a discounted payment, so a part-price voucher (Discount Code)
    // survives it; a full-price-off voucher (fraction 1: Master Key, Signed Approval) is the one that makes things free.
    spendVoucher(category, id, paid = Infinity) {
      if (applies(category, id) && (paid > 0 || voucher.fraction >= 1)) voucher = null;
      update();
    },
    update,
    basePriceOf, // crossed-out shelf price; uses the same source and validation as the charged price
    priceOf(category, id) {
      const base = basePriceOf(category, id);
      const off = Math.max(discounts.get(category) ?? 0, id != null ? (itemDiscounts.get(category)?.get(id) ?? 0) : 0);
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

    setItemDiscount(category, id, fraction) {
      check(category);
      if (typeof id !== 'string' || !id) throw new Error(`pricing: item id must be a non-empty string, got ${id}`);
      if (!(fraction >= 0 && fraction <= 1)) throw new Error(`pricing: discount must be 0..1, got ${fraction}`);
      if (fraction === 0) {
        const byId = itemDiscounts.get(category);
        if (byId) {
          byId.delete(id);
          if (byId.size === 0) itemDiscounts.delete(category);
        }
        return;
      }
      basePriceOf(category, id);
      let byId = itemDiscounts.get(category);
      if (!byId) itemDiscounts.set(category, byId = new Map());
      byId.set(id, fraction);
    },

    itemDiscountOf(category, id) {
      check(category);
      return id != null ? (itemDiscounts.get(category)?.get(id) ?? 0) : 0;
    },

    discountOf(category, id = null) {
      check(category);
      const categoryOff = discounts.get(category) ?? 0;
      const itemOff = id != null ? (itemDiscounts.get(category)?.get(id) ?? 0) : 0;
      return Math.max(categoryOff, itemOff);
    },

    // Save & Quit (game/saveGame.js): the discounts in force (a Flash Sale's included), the boss voucher and the coupon.
    serialize() {
      return {
        discounts: [...discounts],
        itemDiscounts: [...itemDiscounts].map(([category, byId]) => [category, [...byId]]),
        voucher,
        coupon,
      };
    },
    restore(data) {
      discounts.clear();
      for (const [category, fraction] of data.discounts) discounts.set(category, fraction);
      itemDiscounts.clear();
      for (const [category, entries] of data.itemDiscounts ?? []) {
        if (!entries?.length) continue;
        itemDiscounts.set(category, new Map(entries));
      }
      voucher = data.voucher;
      coupon = data.coupon;
    },

    reset() {
      voucher = null;
      discounts.clear();
      itemDiscounts.clear();
      coupon = null;
    },
  };
}
