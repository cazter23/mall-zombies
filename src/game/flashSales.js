// =============================================================================
// FLASH SALES: now and then the mall PA announces a discount on one group of things you can buy (the
// design's "25-50% off one category"). While it runs, every price in that group is lower EVERYWHERE (the
// prompts, the charge), because it uses the one price function: pricing.setDiscount(category, fraction).
//
// Timing is PLAY time (ticked only while the game runs: not paused, not dead). The first sale comes
// `firstDelaySeconds` into a run; after each sale ends there is a quiet gap, then the next. Which group goes
// on sale is a weighted pick among the groups that make sense right now (no door sale when every door is
// open): economy.flashSales.groups, each { id, label, categories (pricing categories), weight, start, end }.
//
//   createFlashSales({ events, pricing, random, config, eligible }) -> {
//     update(dt)     tick (game time)
//     startNow()     debug: start a sale now (false if one is running or nothing is worth discounting)
//     reset()        new run: end any sale silently, timer back to the first delay
//     active         null, or { id, label, categories, discount, remaining, duration }
//     timeUntilNext  seconds until the next sale starts (0 while one is running)
//   }
//   eligible(group) -> boolean   (createGame passes saleEligibility(...): "is this group of any use to the player right now")
//
// EVENTS (game/events.js): 'flashSaleStart' { id, label, categories, discount, seconds, pa: { kicker, text } } and
// 'flashSaleEnd' { id, label, reason: 'expired' | 'reset', pa }. createGame turns them into the PA banner + chime;
// the HUD tag and the "SALE" mark on prompts read `active` / pricing. Discounts it sets are put back to what
// they were when it ends (so it never clobbers another system's discount).
// =============================================================================

import { economy } from '../config/economy.js';
import { featuresOf } from './features/index.js';
import { ownsAttachment } from './features/attachmentCounter.js';

/**
 * Is a group worth discounting right now? No door sale when every area is bought, no weapon sale when every wall gun
 * is owned, and so on. `kiosk` is Kiosk Kevin's feature instance (or undefined on a map without him).
 */
export function saleEligibility({ map, gun, warranty, wardrobe, kiosk }) {
  return (group) => {
    if (group.id === 'doors') return map.areaUnlocks
      ? Object.keys(economy.doors).some(id => !map.zones[id].open)
      : map.doors.some((d) => !d.isOpen);
    if (group.id === 'weapons') return featuresOf(map, 'wallBuy').some((w) => !gun.owns(w.weapon));
    if (group.id === 'tiers') return gun.slots.some((id) => warranty.offer(id));
    if (group.id === 'attachments') return featuresOf(map, 'attachmentCounter').some(s => !ownsAttachment(gun, s.attachment));
    if (group.id === 'apparel') return featuresOf(map, 'wardrobeRack').some(r => map.zones[r.zone].open && !wardrobe.owns(r.item));
    if (group.id === 'kiosk') {
      const status = kiosk?.status;
      return status?.open && !status.hiding;
    }
    return true;
  };
}

export function createFlashSales({ events, pricing, random = Math.random, config = economy.flashSales, eligible = () => true }) {
  let active = null;
  let untilNext = config.firstDelaySeconds;
  const between = (min, max) => min + (max - min) * random();

  /** A discount from config.discounts: min..max in `step` increments (0.25, 0.30 ... 0.50). */
  function pickDiscount() {
    const { min, max, step } = config.discounts;
    const steps = Math.round((max - min) / step);
    return Math.round((min + step * Math.min(steps, Math.floor(random() * (steps + 1)))) * 1000) / 1000;
  }

  function pickGroup() {
    const options = config.groups.filter((g) => g.weight > 0 && eligible(g));
    const total = options.reduce((sum, g) => sum + g.weight, 0);
    if (!total) return null;
    let roll = random() * total;
    for (const g of options) {
      roll -= g.weight;
      if (roll < 0) return g;
    }
    return options[options.length - 1];
  }

  const say = (template, discount) => ({ kicker: template.kicker, text: template.text.replace('{pct}', String(Math.round(discount * 100))) });

  function start() {
    const group = pickGroup();
    if (!group) {
      untilNext = config.retrySeconds; // nothing worth discounting right now: look again soon
      return;
    }
    const discount = pickDiscount();
    active = {
      id: group.id,
      label: group.label,
      categories: group.categories,
      discount,
      duration: config.durationSeconds,
      remaining: config.durationSeconds,
      previous: group.categories.map((c) => pricing.discountOf(c)),
      group,
    };
    group.categories.forEach((c) => pricing.setDiscount(c, discount));
    events.emit('flashSaleStart', {
      id: group.id, label: group.label, categories: group.categories, discount, seconds: config.durationSeconds, pa: say(group.start, discount),
    });
  }

  function end(reason) {
    const sale = active;
    sale.categories.forEach((c, i) => pricing.setDiscount(c, sale.previous[i]));
    active = null;
    untilNext = between(config.gapSeconds.min, config.gapSeconds.max);
    events.emit('flashSaleEnd', { id: sale.id, label: sale.label, reason, pa: say(sale.group.end, sale.discount) });
  }

  return {
    get active() {
      return active;
    },
    get timeUntilNext() {
      return active ? 0 : Math.max(0, untilNext);
    },

    update(dt) {
      if (!config.enabled) return;
      if (active) {
        active.remaining -= dt;
        if (active.remaining <= 0) end('expired');
        return;
      }
      untilNext -= dt;
      if (untilNext <= 0) start();
    },

    // Debug: start a sale right now (false if one is already running or nothing is worth discounting).
    startNow() {
      if (active) return false;
      start();
      return active !== null;
    },

    // Save & Quit (game/saveGame.js): the sale running at the round's start, and the wait for the next one. The discount itself
    // is in pricing's own save; restore() only takes the sale back on, so it ends (and puts the old prices back) as usual.
    serialize() {
      return {
        untilNext,
        active: active && { id: active.id, discount: active.discount, remaining: active.remaining, previous: active.previous },
      };
    },
    restore(data) {
      untilNext = data.untilNext;
      const group = data.active && config.groups.find((g) => g.id === data.active.id);
      active = group ? {
        id: group.id, label: group.label, categories: group.categories, discount: data.active.discount,
        duration: config.durationSeconds, remaining: data.active.remaining, previous: data.active.previous, group,
      } : null;
    },

    reset() {
      if (active) end('reset');
      untilNext = config.firstDelaySeconds;
    },
  };
}
