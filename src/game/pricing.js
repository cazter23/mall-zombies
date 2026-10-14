// =============================================================================
// PRICING: the one place a price is decided (createGame makes one: g.pricing).
// Base prices live in config/economy.js; this applies any active discount on top (Flash Sales:
// "25-50% off one category"), so every buyable shows and charges the same, current price.
//
//   priceOf('door', doorId)        economy.doors[doorId]
//   priceOf('weapon', gunId)       economy.wallBuys[gunId].weapon
//   priceOf('ammo', gunId)         economy.wallBuys[gunId].ammo
//   priceOf('ammoCache')           economy.ammoCache.price
//   setDiscount(category, 0.25)    25% off everything in that category (0 = none); rounded to the nearest 10
//   reset()                        no discounts (a new run)
// An unknown category or id is an error (a typo shouldn't make something free).
// =============================================================================

import { economy } from '../config/economy.js';

const BASE = {
  door: (id) => economy.doors[id],
  weapon: (id) => economy.wallBuys[id]?.weapon,
  ammo: (id) => economy.wallBuys[id]?.ammo,
  ammoCache: () => economy.ammoCache.price,
};

export const PRICE_CATEGORIES = Object.keys(BASE);

export function createPricing() {
  const discounts = new Map(); // category -> fraction off (0..1)

  function check(category) {
    if (!(category in BASE)) throw new Error(`pricing: unknown category "${category}" (${PRICE_CATEGORIES.join(', ')})`);
  }

  return {
    priceOf(category, id) {
      check(category);
      const base = BASE[category](id);
      if (typeof base !== 'number') throw new Error(`pricing: no ${category} price for "${id}"`);
      const off = discounts.get(category) ?? 0;
      return off > 0 ? Math.round((base * (1 - off)) / 10) * 10 : base;
    },

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
      discounts.clear();
    },
  };
}
