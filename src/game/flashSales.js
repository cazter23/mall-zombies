// =============================================================================
// FLASH SALES & DOORBUSTERS (config/economy.js):
//   - Category Flash Sales discount one group of prices ("25-50% off"), teased `teaserSeconds` ahead on the PA.
//   - Doorbusters discount ONE specific unowned / reachable item steeply ("65-75% off") for a short burst and trigger
//     a small rush of extra zombies from nearby open-zone spawn markers through the zombie manager.
// Timing is PLAY time (only ticked while running, not paused or dead). Prices go through pricing (`setDiscount` /
// `setItemDiscount`), so HUD tickets, prompts, coupons, and purchases all agree and restore cleanly on end/reset.
//
// EVENTS (game/events.js):
//   'flashSaleSoon'  { kind, id, label, categories, target, seconds, pa }
//   'flashSaleStart' { kind, id, label, categories, target, discount, seconds, pa }
//   'flashSaleEnd'   { kind, id, label, reason: 'expired' | 'reset' | 'cancelled', pa }
// =============================================================================

import { economy } from '../config/economy.js';
import { weapons } from '../config/weapons.js';
import { upgrades } from '../config/upgrades.js';
import { wardrobeItems } from '../config/wardrobe.js';
import { kiosk as kioskConfig } from '../config/kiosk.js';
import { featuresOf } from './features/index.js';
import { ownsAttachment } from './features/attachmentCounter.js';
import { attachmentFits } from '../weapons/upgrades.js';

const NO_THE_ZONES = new Set(['megaMart', 'cinema', 'departmentStore', 'parkingLot']);
const HAZARD_PRICING_ID = {
  fountainHazard: 'fountain',
  fryerHazard: 'fryer',
  sprinklerHazard: 'sprinklers',
  paLureHazard: 'paLure',
};
const HAZARD_KINDS = Object.keys(HAZARD_PRICING_ID);
const NUMBER_WORDS = new Map([[1, 'one second'], [5, 'five seconds'], [10, 'ten seconds'], [15, 'fifteen seconds'], [20, 'twenty seconds']]);

const leadWords = (seconds) => NUMBER_WORDS.get(Math.round(seconds)) ?? `${Math.ceil(seconds)} seconds`;
const zoneLabelOf = (map, zoneId) => map.zones?.[zoneId]?.label ?? zoneId;
const areaPhrase = (map, zoneId) => {
  const label = zoneLabelOf(map, zoneId);
  return NO_THE_ZONES.has(zoneId) ? label : `the ${label}`;
};
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
// An attachment is only of use if it fits a gun you carry (the counter refuses one that fits the gun in hand).
const fitsCarriedGun = (gun, id) => [gun?.def, gun?.inactiveSlot?.def].some((def) => def?.base && attachmentFits(def.base, id));

/**
 * Is a normal Flash Sale group worth discounting right now?
 */
export function saleEligibility({ map, gun, warranty, wardrobe, kiosk }) {
  return (group) => {
    if (group.id === 'doors') return map.areaUnlocks
      ? Object.keys(economy.doors).some((id) => !map.zones[id].open)
      : map.doors.some((d) => !d.isOpen);
    if (group.id === 'weapons') return featuresOf(map, 'wallBuy').some((w) => !gun.owns(w.weapon));
    if (group.id === 'tiers') return gun.slots.some((id) => warranty.offer(id));
    if (group.id === 'attachments') return featuresOf(map, 'attachmentCounter').some((s) => !ownsAttachment(gun, s.attachment));
    if (group.id === 'apparel') return featuresOf(map, 'wardrobeRack').some((r) => map.zones[r.zone].open && !wardrobe.owns(r.item));
    if (group.id === 'kiosk') {
      const status = kiosk?.status;
      return status?.open && !status.hiding;
    }
    return true;
  };
}

function isKioskProductFull(id, kiosk, equipment, health) {
  const product = kioskConfig.products[id];
  if (!product) return health && health.armour.length >= health.maxArmourLayers;
  if (!equipment) return false;
  const pocket = equipment.pockets?.[product.pocket];
  const target = (product.charges ?? 1) + Number(kiosk?.status?.pick === id);
  return pocket?.id === id && pocket?.count >= target;
}

/**
 * Enumerate specific unowned / reachable items eligible for a Doorbuster right now.
 * Each candidate: { category, id, itemLabel, itemPhrase, zone, area, zoneLabel, position, positions }.
 */
export function doorbusterCandidates({ map, gun, wardrobe, kiosk, equipment = null, health = null }) {
  const out = [];
  const zones = map.zones ?? {};

  // 1. Unowned wall guns in open areas.
  const weaponsById = new Map();
  for (const w of featuresOf(map, 'wallBuy')) {
    if (!zones[w.zone]?.open) continue;
    const def = weapons[w.weapon];
    if (!def || def.clawOnly || typeof economy.wallBuys[w.weapon]?.weapon !== 'number') continue;
    if (gun.owns(w.weapon) || gun.away?.def.id === w.weapon) continue;
    let entry = weaponsById.get(w.weapon);
    if (!entry) {
      entry = {
        category: 'weapon', id: w.weapon, itemLabel: def.name, itemPhrase: `the ${def.name}`,
        zone: w.zone, zoneLabel: zoneLabelOf(map, w.zone), area: areaPhrase(map, w.zone),
        position: w.position, positions: [],
      };
      weaponsById.set(w.weapon, entry);
      out.push(entry);
    }
    entry.positions.push({ position: w.position, normal: w.normal ?? null });
  }

  // 2. Closed doors / area unlocks adjacent to an owned area.
  if (map.areaUnlocks) {
    const byDest = new Map();
    for (const d of map.doors) {
      const dest = map.areaUnlocks.destination(d);
      if (!dest || typeof economy.doors[dest] !== 'number') continue;
      let group = byDest.get(dest);
      if (!group) byDest.set(dest, group = []);
      group.push(d);
    }
    for (const [dest, doors] of byDest) {
      const primary = doors[0];
      const openZone = primary.connectsZones?.find((z) => zones[z]?.open) ?? map.areaAt?.(primary.position) ?? 'startRoom';
      const destLabel = zoneLabelOf(map, dest);
      const isEscalator = doors.every((d) => d.id === 'escalatorRepair');
      const itemLabel = isEscalator ? 'Promenade Escalator' : `${destLabel} shutter`;
      out.push({
        category: 'door', id: dest, itemLabel, itemPhrase: `the ${itemLabel}`,
        zone: openZone, zoneLabel: zoneLabelOf(map, openZone), area: areaPhrase(map, openZone),
        position: primary.position, positions: doors.map((d) => ({ position: d.position, normal: null })),
      });
    }
  } else {
    for (const d of map.doors ?? []) {
      if (d.isOpen || typeof economy.doors[d.id] !== 'number') continue;
      const openZone = d.connectsZones?.find((z) => zones[z]?.open) ?? 'startRoom';
      const label = d.label ?? d.id;
      out.push({
        category: 'door', id: d.id, itemLabel: label, itemPhrase: `the ${label}`,
        zone: openZone, zoneLabel: zoneLabelOf(map, openZone), area: areaPhrase(map, openZone),
        position: d.position, positions: [{ position: d.position, normal: null }],
      });
    }
  }

  // 3. Unowned attachments in open stores.
  for (const s of featuresOf(map, 'attachmentCounter')) {
    if (!zones[s.zone]?.open) continue;
    const def = upgrades.attachments[s.attachment];
    if (!def || typeof economy.upgrades.attachments[s.attachment] !== 'number') continue;
    if (ownsAttachment(gun, s.attachment) || !fitsCarriedGun(gun, s.attachment)) continue;
    out.push({
      category: 'attachment', id: s.attachment, itemLabel: def.name, itemPhrase: `the ${def.name}`,
      zone: s.zone, zoneLabel: zoneLabelOf(map, s.zone), area: areaPhrase(map, s.zone),
      position: s.position, positions: [{ position: s.position, normal: s.normal ?? null }],
    });
  }

  // 4. Unowned apparel in open areas.
  if (wardrobe) {
    for (const r of featuresOf(map, 'wardrobeRack')) {
      if (!zones[r.zone]?.open) continue;
      const def = wardrobeItems[r.item];
      if (!def || typeof economy.wardrobe[r.item] !== 'number') continue;
      if (wardrobe.owns(r.item)) continue;
      out.push({
        category: 'wardrobe', id: r.item, itemLabel: def.name, itemPhrase: `the ${def.name}`,
        zone: r.zone, zoneLabel: zoneLabelOf(map, r.zone), area: areaPhrase(map, r.zone),
        position: r.position, positions: [{ position: r.position, normal: r.normal ?? null }],
      });
    }
  }

  // 5. Kiosk Kevin's stocked items while his cart is open and not hiding.
  const kStatus = kiosk?.status;
  if (kStatus?.open && !kStatus.hiding && kiosk.site && zones[kiosk.site.zone]?.open) {
    kStatus.stock.forEach((productId, slotIndex) => {
      if (typeof economy.kiosk[productId] !== 'number') return;
      if (isKioskProductFull(productId, kiosk, equipment, health)) return;
      const name = kioskConfig.products[productId]?.name ?? kioskConfig.bubbleWrap.name;
      const slotPos = kiosk.site.cart?.slots?.[slotIndex]?.position ?? kiosk.site.cart?.position;
      if (!slotPos) return;
      out.push({
        category: 'kiosk', id: productId, itemLabel: name, itemPhrase: `Kevin's ${name}`,
        zone: kiosk.site.zone, zoneLabel: zoneLabelOf(map, kiosk.site.zone), area: kiosk.site.where,
        position: slotPos, positions: [{ position: slotPos, normal: kiosk.site.cart?.normal ?? null }],
      });
    });
  }

  return out;
}

/**
 * Nearest open-zone spawn markers to a world position (`targetPos`), preferring the same floor level.
 */
export function nearOpenSpawnPoints(map, targetPos, limit = economy.flashSales.doorbuster.rush.nearestMarkers) {
  if (!map?.spawnPoints?.length || !targetPos) return [];
  const zones = map.zones ?? {};
  const open = map.spawnPoints.filter((p) => zones[p.zone]?.open);
  if (!open.length) return [];
  const sorted = [...open].sort((a, b) => {
    const da = (a.position.x - targetPos.x) ** 2 + (a.position.z - targetPos.z) ** 2 + ((a.position.y - targetPos.y) * 4) ** 2;
    const db = (b.position.x - targetPos.x) ** 2 + (b.position.z - targetPos.z) ** 2 + ((b.position.y - targetPos.y) * 4) ** 2;
    return da - db;
  });
  return sorted.slice(0, Math.max(1, limit));
}

/**
 * All currently usable buy spots that match an active sale OR pending teaser. DOM-free so both minimap and 3D tags
 * mark the exact same items and drop items immediately once bought or shut.
 */
export function collectSaleSpots({ map, features, gun, warranty, wardrobe, equipment = null, health = null }, sale) {
  if (!map || !sale) return [];
  const zones = map.zones ?? {};
  const soon = !!sale.soon;
  const spots = [];
  const push = (pos, normal, category, id, zone, doorbuster = false) => {
    if (!pos) return;
    spots.push({ x: pos.x, y: pos.y, z: pos.z, normal: normal ?? null, category, id, zone, doorbuster, soon });
  };

  if (sale.kind === 'doorbuster' && sale.target) {
    const candidates = doorbusterCandidates({ map, gun, wardrobe, kiosk: features?.instanceOf?.('kiosk'), equipment, health });
    const match = candidates.find((c) => c.category === sale.target.category && c.id === sale.target.id);
    if (!match) return [];
    for (const p of match.positions) push(p.position, p.normal, match.category, match.id, match.zone, true);
    return spots;
  }

  const cats = new Set(sale.categories ?? []);
  if (!cats.size) return [];

  if (cats.has('door')) {
    for (const d of map.doors ?? []) {
      const dest = map.areaUnlocks ? map.areaUnlocks.destination(d) : (d.isOpen ? null : d.id);
      if (!dest) continue;
      const openZone = d.connectsZones?.find((z) => zones[z]?.open) ?? map.areaAt?.(d.position) ?? 'startRoom';
      push(d.position, null, 'door', dest, openZone);
    }
  }
  if (cats.has('weapon') || cats.has('ammo')) {
    for (const f of featuresOf(map, 'wallBuy')) {
      if (!zones[f.zone]?.open || !weapons[f.weapon] || weapons[f.weapon].clawOnly) continue;
      const owned = gun?.owns?.(f.weapon) || gun?.away?.def.id === f.weapon;
      if (cats.has('weapon') && !owned) push(f.position, f.normal, 'weapon', f.weapon, f.zone);
      if (cats.has('ammo') && gun?.owns?.(f.weapon)) push(f.position, f.normal, 'ammo', f.weapon, f.zone);
    }
  }
  if (cats.has('ammoCache')) {
    for (const f of featuresOf(map, 'ammoCache')) {
      if (zones[f.zone]?.open) push(f.position, f.normal, 'ammoCache', 'ammoCache', f.zone);
    }
  }
  if (cats.has('tier') && warranty && gun?.slots?.some((id) => warranty.offer(id))) {
    for (const f of featuresOf(map, 'upgradeDesk')) {
      if (zones[f.zone]?.open) push(f.position, f.normal, 'tier', 'tier', f.zone);
    }
  }
  if (cats.has('attachment')) {
    for (const f of featuresOf(map, 'attachmentCounter')) {
      if (zones[f.zone]?.open && !ownsAttachment(gun, f.attachment) && fitsCarriedGun(gun, f.attachment)) push(f.position, f.normal, 'attachment', f.attachment, f.zone);
    }
  }
  if (cats.has('wardrobe') && wardrobe) {
    for (const f of featuresOf(map, 'wardrobeRack')) {
      if (zones[f.zone]?.open && !wardrobe.owns(f.item)) push(f.position, f.normal, 'wardrobe', f.item, f.zone);
    }
  }
  if (cats.has('claw')) {
    const claw = features?.instanceOf?.('clawMachine');
    if (claw?.status?.open && claw.site && zones[claw.site.zone]?.open) {
      push(claw.site.cabinet.position, claw.site.cabinet.normal, 'claw', 'grab', claw.site.zone);
    }
  }
  if (cats.has('kiosk')) {
    const kiosk = features?.instanceOf?.('kiosk');
    if (kiosk?.status?.open && !kiosk.status.hiding && kiosk.site && zones[kiosk.site.zone]?.open) {
      push(kiosk.site.cart.position, kiosk.site.cart.normal, 'kiosk', 'kiosk', kiosk.site.zone);
    }
  }
  if (cats.has('hazard')) {
    for (const kind of HAZARD_KINDS) {
      for (const f of featuresOf(map, kind)) {
        if (zones[f.zone]?.open) push(f.position, f.normal, 'hazard', HAZARD_PRICING_ID[kind], f.zone);
      }
    }
  }
  return spots;
}

export function createFlashSales({
  events,
  pricing,
  random = Math.random,
  config = economy.flashSales,
  eligible = () => true,
  doorbusters = () => [],
  getRound = () => 1,
  onRushSpawn = null,
  canSpawnRush = () => true,
  nearSpawnPoints = null,
}) {
  let active = null;
  let pending = null;
  let untilNext = config.firstDelaySeconds;
  let rush = null; // { remaining, timer, points, target }
  const between = (min, max) => min + (max - min) * random();

  function pickDiscount(range = config.discounts) {
    const { min, max, step } = range;
    const steps = Math.round((max - min) / step);
    return Math.round((min + step * Math.min(steps, Math.floor(random() * (steps + 1)))) * 1000) / 1000;
  }

  function doorbusterAllowed(ignoreRound = false) {
    const db = config.doorbuster;
    if (!db?.enabled || !(db.weight > 0)) return false;
    return ignoreRound || getRound() >= (db.fromRound ?? 1);
  }

  function pickDoorbusterTarget() {
    const pool = doorbusters();
    if (!pool.length) return null;
    return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  }

  function eligibleGroups() {
    return (config.groups ?? []).filter((g) => g.weight > 0 && eligible(g));
  }

  function pickOffer({ mode = 'any', ignoreRound = false } = {}) {
    if (mode === 'category') {
      const options = eligibleGroups();
      const total = options.reduce((sum, g) => sum + g.weight, 0);
      if (!total) return null;
      let roll = random() * total;
      for (const g of options) {
        roll -= g.weight;
        if (roll < 0) return { kind: 'category', group: g };
      }
      return { kind: 'category', group: options[options.length - 1] };
    }
    if (mode === 'doorbuster') {
      if (!doorbusterAllowed(ignoreRound)) return null;
      const target = pickDoorbusterTarget();
      return target ? { kind: 'doorbuster', target } : null;
    }

    const groups = eligibleGroups();
    const dbTargets = doorbusterAllowed(ignoreRound) ? doorbusters() : [];
    const dbWeight = dbTargets.length ? config.doorbuster.weight : 0;
    const total = groups.reduce((sum, g) => sum + g.weight, 0) + dbWeight;
    if (!total) return null;

    let roll = random() * total;
    for (const g of groups) {
      roll -= g.weight;
      if (roll < 0) return { kind: 'category', group: g };
    }
    if (dbWeight > 0) {
      const target = dbTargets[Math.min(dbTargets.length - 1, Math.floor(random() * dbTargets.length))];
      return { kind: 'doorbuster', target };
    }
    return groups.length ? { kind: 'category', group: groups[groups.length - 1] } : null;
  }

  const sayCategory = (template, discount) => ({
    kicker: template.kicker,
    text: template.text.replace('{pct}', String(Math.round(discount * 100))),
  });

  const sayDoorbuster = (template, target, discount = 0, lead = '') => ({
    kicker: template.kicker,
    text: template.text
      .replace('{Item}', capitalize(target.itemPhrase ?? `the ${target.itemLabel}`))
      .replace('{item}', target.itemPhrase ?? `the ${target.itemLabel}`)
      .replace('{area}', target.area)
      .replace('{pct}', String(Math.round(discount * 100)))
      .replace('{lead}', lead),
  });

  const sayTeaser = (offer, leadSec) => {
    const lead = leadWords(leadSec);
    if (offer.kind === 'doorbuster') return sayDoorbuster(config.doorbuster.teaser, offer.target, 0, lead);
    const t = config.teaser ?? economy.flashSales.teaser; // (a test's small config may leave the words out)
    return { kicker: t.kicker, text: t.text.replace('{lead}', lead).replace('{label}', offer.group.label) };
  };

  function beginTeaser(offer) {
    const lead = config.teaserSeconds ?? 0;
    if (lead <= 0) return goLive(offer);
    if (offer.kind === 'doorbuster') {
      const { target } = offer;
      pending = {
        kind: 'doorbuster',
        id: 'doorbuster',
        label: `${target.itemLabel} (${target.zoneLabel})`,
        categories: [target.category],
        target: {
          category: target.category, id: target.id, itemLabel: target.itemLabel,
          itemPhrase: target.itemPhrase, zone: target.zone, area: target.area, zoneLabel: target.zoneLabel,
        },
        remaining: lead,
        duration: lead,
      };
    } else {
      const { group } = offer;
      pending = {
        kind: 'category',
        id: group.id,
        label: group.label,
        categories: group.categories,
        target: null,
        remaining: lead,
        duration: lead,
        group,
      };
    }
    events.emit('flashSaleSoon', {
      kind: pending.kind, id: pending.id, label: pending.label, categories: pending.categories,
      target: pending.target, seconds: lead, pa: sayTeaser(offer, lead),
    });
    return true;
  }

  function startRush(target) {
    const db = config.doorbuster;
    if (!db?.rush || !onRushSpawn) return;
    const round = Math.max(1, getRound());
    const fromRound = db.fromRound ?? 1;
    const count = Math.min(db.rush.maxCount, db.rush.baseCount + Math.floor(Math.max(0, round - fromRound) * db.rush.perRound));
    if (count <= 0) return;
    const points = nearSpawnPoints ? nearSpawnPoints(target) : null;
    rush = { remaining: count, timer: 0, points, target };
    stepRush(0);
  }

  function stepRush(dt) {
    if (!rush || rush.remaining <= 0) return;
    rush.timer -= dt;
    if (rush.timer > 0) return;
    const db = config.doorbuster.rush;
    if (canSpawnRush()) {
      const spawned = onRushSpawn(rush.points, rush.target);
      if (spawned) {
        rush.remaining -= 1;
        rush.timer = db.spawnIntervalSeconds;
        if (rush.remaining <= 0) rush = null;
        return;
      }
    }
    rush.timer = db.retrySeconds;
  }

  function goLive(offer) {
    if (offer.kind === 'doorbuster') {
      const db = config.doorbuster;
      const discount = pickDiscount(db.discounts);
      const { target } = offer;
      const previous = pricing.itemDiscountOf ? pricing.itemDiscountOf(target.category, target.id) : 0;
      const serializedTarget = {
        category: target.category, id: target.id, itemLabel: target.itemLabel,
        itemPhrase: target.itemPhrase, zone: target.zone, area: target.area, zoneLabel: target.zoneLabel,
      };
      active = {
        kind: 'doorbuster',
        id: 'doorbuster',
        label: `${target.itemLabel} (${target.zoneLabel})`,
        categories: [target.category],
        target: serializedTarget,
        discount,
        duration: db.durationSeconds,
        remaining: db.durationSeconds,
        previous,
      };
      pricing.setItemDiscount(target.category, target.id, discount);
      events.emit('flashSaleStart', {
        kind: 'doorbuster', id: active.id, label: active.label, categories: active.categories,
        target: active.target, discount, seconds: db.durationSeconds, pa: sayDoorbuster(db.start, serializedTarget, discount),
      });
      startRush(target);
      return true;
    }

    const { group } = offer;
    const discount = pickDiscount(config.discounts);
    active = {
      kind: 'category',
      id: group.id,
      label: group.label,
      categories: group.categories,
      target: null,
      discount,
      duration: config.durationSeconds,
      remaining: config.durationSeconds,
      previous: group.categories.map((c) => pricing.discountOf(c)),
      group,
    };
    group.categories.forEach((c) => pricing.setDiscount(c, discount));
    events.emit('flashSaleStart', {
      kind: 'category', id: group.id, label: group.label, categories: group.categories,
      target: null, discount, seconds: config.durationSeconds, pa: sayCategory(group.start, discount),
    });
    return true;
  }

  function confirmAndGoLive(wasPending) {
    if (wasPending.kind === 'doorbuster') {
      const exact = doorbusterAllowed(true) && doorbusters().find(
        (c) => c.category === wasPending.target.category && c.id === wasPending.target.id,
      );
      if (exact) return goLive({ kind: 'doorbuster', target: exact });
    } else if (wasPending.group && eligible(wasPending.group)) {
      return goLive({ kind: 'category', group: wasPending.group });
    }
    const fallback = pickOffer({ mode: 'any' });
    if (fallback) return goLive(fallback);
    untilNext = config.retrySeconds;
    events.emit('flashSaleEnd', {
      kind: wasPending.kind, id: wasPending.id, label: wasPending.label, reason: 'cancelled', pa: null,
    });
    return false;
  }

  function end(reason) {
    const sale = active;
    if (sale.kind === 'doorbuster') {
      pricing.setItemDiscount(sale.target.category, sale.target.id, sale.previous ?? 0);
    } else {
      sale.categories.forEach((c, i) => pricing.setDiscount(c, sale.previous[i]));
    }
    active = null;
    rush = null;
    untilNext = between(config.gapSeconds.min, config.gapSeconds.max);
    const pa = sale.kind === 'doorbuster'
      ? sayDoorbuster(config.doorbuster.end, sale.target, sale.discount)
      : sayCategory(sale.group.end, sale.discount);
    events.emit('flashSaleEnd', { kind: sale.kind, id: sale.id, label: sale.label, reason, pa });
  }

  return {
    get active() {
      return active;
    },
    get pending() {
      return pending;
    },
    get timeUntilNext() {
      if (active) return 0;
      if (pending) return Math.max(0, pending.remaining);
      return Math.max(0, untilNext);
    },

    update(dt) {
      if (!config.enabled) return;
      if (active) {
        stepRush(dt);
        active.remaining -= dt;
        if (active.remaining <= 0) end('expired');
        return;
      }
      if (pending) {
        pending.remaining -= dt;
        if (pending.remaining <= 0) {
          const was = pending;
          pending = null;
          confirmAndGoLive(was);
        }
        return;
      }
      untilNext -= dt;
      if (untilNext <= 0) {
        const offer = pickOffer({ mode: 'any' });
        if (!offer) {
          untilNext = config.retrySeconds;
          return;
        }
        beginTeaser(offer);
      }
    },

    /** Debug: start a sale immediately. `mode`: 'category' (default, existing tests/key), 'doorbuster', or 'any'. */
    startNow(mode = 'category') {
      if (active) return false;
      const offer = pickOffer({ mode, ignoreRound: mode === 'doorbuster' });
      if (!offer) return false;
      pending = null;
      return goLive(offer);
    },

    /** Debug: start the PA teaser warning immediately for 'category' (default), 'doorbuster', or 'any'. */
    teaseNow(mode = 'category') {
      if (active || pending) return false;
      const offer = pickOffer({ mode, ignoreRound: mode === 'doorbuster' });
      if (!offer) return false;
      return beginTeaser(offer);
    },

    clearRush() {
      rush = null;
    },

    serialize() {
      return {
        untilNext,
        pending: pending && {
          kind: pending.kind, id: pending.id, label: pending.label, categories: pending.categories,
          target: pending.target, remaining: pending.remaining, duration: pending.duration,
        },
        active: active && {
          kind: active.kind, id: active.id, label: active.label, categories: active.categories,
          target: active.target, discount: active.discount, remaining: active.remaining,
          duration: active.duration, previous: active.previous,
        },
      };
    },

    restore(data) {
      rush = null;
      untilNext = data.untilNext;
      pending = null;
      if (data.pending) {
        if (data.pending.kind === 'doorbuster') {
          pending = { ...data.pending };
        } else {
          const group = config.groups.find((g) => g.id === data.pending.id);
          if (group) pending = { ...data.pending, kind: 'category', label: group.label, categories: group.categories, group };
        }
      }
      active = null;
      if (data.active) {
        if (data.active.kind === 'doorbuster') {
          active = { ...data.active };
        } else {
          const group = config.groups.find((g) => g.id === data.active.id);
          if (group) {
            active = {
              kind: 'category', id: group.id, label: group.label, categories: group.categories, target: null,
              discount: data.active.discount, duration: data.active.duration ?? config.durationSeconds,
              remaining: data.active.remaining, previous: data.active.previous, group,
            };
          }
        }
      }
    },

    reset() {
      rush = null;
      pending = null;
      if (active) end('reset');
      untilNext = config.firstDelaySeconds;
    },
  };
}
