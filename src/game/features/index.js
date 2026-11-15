// =============================================================================
// MAP FEATURES: the things in a map the player interacts with, other than doors.
// A map lists them as data in `map.features` ([{ kind, name, zone, position, normal, ...kind's own fields }]);
// this registry turns each into its game objects (displays, buy prompts, anything that ticks).
// A NEW KIND (claw machine, fitting room, vendor kiosk, hazard switch, power switch...) =
//   1. a module here exporting build(feature, ctx) -> optional { update(dt), reset() }
//   2. one line in `builders` below
//   3. entries with that `kind` in the map's features list
// createGame never changes for a new kind.
//
// ctx (from createGame, built after its core event wiring, so a feature's listeners run after payouts/stats):
//   { scene, map, events, pricing, interactions, gun, player, stats, wallet, health, zombies, rounds, state, warranty, meleeUpgrades, wardrobe,
//     colliders, effects, sound, input, tickets, shootables, aimAssist, secondChance, equipment, closing, skins, lostFound, returnQuest, surfaces }
//     (surfaces: game/surfaceSlows.js, where a feature reports a floor slow on the player)
// =============================================================================

import { buildWallBuy } from './wallBuy.js';
import { buildAmmoCache } from './ammoCache.js';
import { buildUpgradeDesk } from './upgradeDesk.js';
import { buildAttachmentCounter } from './attachmentCounter.js';
import { buildWorkshop } from './workshop.js';
import { buildHorror } from './horror.js';
import { buildWardrobeRack, buildFittingRoom } from './wardrobeFixtures.js';
import { buildClawMachine } from './clawMachine.js';
import { buildPrizeCounter } from './prizeCounter.js';
import { buildKiosk } from './kiosk.js';
import { buildNightSafe } from './nightSafe.js';
import { buildEscapeVan } from './escapeVan.js';
import { buildReturnsDesk } from './returnsDesk.js';
import { buildFountainHazard } from './fountainHazard.js';
import { buildFryerHazard } from './fryerHazard.js';
import { buildSprinklerHazard } from './sprinklerHazard.js';
import { buildPaLureHazard } from './paLureHazard.js';
import { buildLostProperty } from './lostProperty.js';
import { buildRefundSign } from './refundSign.js';

const builders = {
  wallBuy: buildWallBuy, // buy a gun off the wall, or its ammo once you own it
  ammoCache: buildAmmoCache, // RESTOCK-O-MATIC: refill the gun in your hand
  upgradeDesk: buildUpgradeDesk, // Customer Service: the next Extended Warranty tier for the gun in your hand
  attachmentCounter: buildAttachmentCounter, // a store's attachment: fit it to the gun in your hand
  workshop: buildWorkshop,
  wardrobeRack: buildWardrobeRack,
  fittingRoom: buildFittingRoom,
  horror: buildHorror, // the horror layer: lights die and the power cuts out as the rounds climb (visual only)
  clawMachine: buildClawMachine, // GRAB-A-GUN: pay, time the drop, take the gun from the chute
  prizeCounter: buildPrizeCounter, // REDEMPTION: GRAB-A-GUN's prize tickets for small things
  kiosk: buildKiosk,
  fountainHazard: buildFountainHazard, // Grand Atrium fountain breaker switch (docs/archive/hazards-plan.md)
  fryerHazard: buildFryerHazard, // Food Court Corn Dog Corral fryer valve switch (docs/archive/hazards-plan.md)
  sprinklerHazard: buildSprinklerHazard, // Main Hallway south fire alarm pull switch (docs/archive/hazards-plan.md)
  paLureHazard: buildPaLureHazard, // Service Corridor west wall paging panel switch (docs/archive/hazards-plan.md)
  nightSafe: buildNightSafe,
  escapeVan: buildEscapeVan,
  returnsDesk: buildReturnsDesk,
  lostProperty: buildLostProperty, // one piece of lost property to find and log (config/lostFound.js)
  refundSign: buildRefundSign, // a NO REFUNDS floor sign to shoot: step 1 of the Return to Sender quest (config/returnQuest.js)
};

export const FEATURE_KINDS = Object.keys(builders);

/**
 * Build every feature of a map. Returns { list, instanceOf(kind), instancesOf(kind), update(dt), reset() }: list = the built features
 * ({ feature, instance }), update/reset run each feature's own hooks (if it has any).
 * An unknown or missing kind is an error (a typo in map data shouldn't silently vanish).
 * `kinds` defaults to the registry above (tests pass their own).
 */
export function buildFeatures(map, ctx, kinds = builders) {
  const list = [];
  // ARENA SURVIVAL: an arena's own features (map.arenaFeatures, each with `arena`) are built here once, like the rest, with
  // arenaContext: their prompts only while that arena is on, their scene objects in its (hidden otherwise) group.
  const all = [...new Set([...(map.features ?? []), ...(map.arenaFeatures ?? [])])];
  for (const feature of all) {
    const build = Object.hasOwn(kinds, feature.kind) ? kinds[feature.kind] : null; // (not inherited names like 'toString')
    if (!build) {
      throw new Error(`map "${map.id}": feature "${feature.name ?? '?'}" has unknown kind "${feature.kind}" (${Object.keys(kinds).join(', ')})`);
    }
    list.push({ feature, instance: build(feature, feature.arena ? arenaContext(map, feature, ctx) : ctx) ?? {} });
  }
  // A feature that saves run state is saved under its NAME, so its name must be there and be its own.
  const savingNames = new Set();
  for (const { feature, instance } of list) {
    if (!instance.serialize) continue;
    if (!feature.name) throw new Error(`map "${map.id}": a "${feature.kind}" feature saves run state, so it needs a name`);
    if (savingNames.has(feature.name)) throw new Error(`map "${map.id}": two features named "${feature.name}" (one saves run state: names must differ)`);
    savingNames.add(feature.name);
  }
  return {
    list,
    context: ctx, // what every feature was given (for tests / debugging)
    /** The first built instance of a kind (Kiosk Kevin, the claw machine...), or undefined if the map has none. */
    instanceOf(kind) {
      return list.find(({ feature }) => feature.kind === kind)?.instance;
    },
    /** Every built instance of a kind, in map order. */
    instancesOf(kind) {
      return list.filter(({ feature }) => feature.kind === kind).map(({ instance }) => instance);
    },
    update(dt) {
      for (const { instance } of list) instance.update?.(dt);
    },
    reset() {
      for (const { instance } of list) instance.reset?.();
    },
    // Save & Quit (game/saveGame.js): each feature with run state worth keeping has serialize() / restore(data); the data
    // is keyed by the feature's NAME, so adding, removing or reordering other features does not disturb a save (renaming
    // a saving feature does: bump config/save.js). A feature missing from the save keeps its fresh state.
    // (Saves written before November 2026 were keyed by place in map.features: restore still reads a numeric key as
    // that place. That fallback can go with the next save version bump.)
    serialize() {
      const out = {};
      for (const { feature, instance } of list) if (instance.serialize) out[feature.name] = instance.serialize();
      return out;
    },
    restore(data) {
      list.forEach(({ feature, instance }, i) => {
        if (!instance.restore) return;
        const saved = Object.hasOwn(data, feature.name) ? data[feature.name] : data[i];
        if (saved !== undefined) instance.restore(saved);
      });
    },
  };
}

/**
 * What an arena-only feature is built with: the same context, but every item it adds to `interactions` is available only while
 * its arena is on (map.arena), and what it adds to `scene` goes into the arena's own group (shown only while it is on). The items
 * are wrapped, so such a feature must not `interactions.remove()` its own items (none of the kinds an arena uses does).
 */
export function arenaContext(map, feature, ctx) {
  const arena = map.arenas?.[feature.arena];
  if (!arena) throw new Error(`map "${map.id}": feature "${feature.name ?? '?'}" is for unknown arena "${feature.arena}"`);
  const live = () => map.arena === feature.arena;
  const gate = (item) => new Proxy(item, {
    get(target, prop, receiver) {
      if (prop === 'available') return () => live() && target.available();
      return Reflect.get(target, prop, receiver);
    },
  });
  const interactions = Object.create(ctx.interactions, { add: { value: (item) => ctx.interactions.add(gate(item)) } });
  return { ...ctx, interactions, scene: arena.group };
}

/** A map's features of one kind (handy for tests and debug tools). */
export function featuresOf(map, kind) {
  return (map.features ?? []).filter((f) => f.kind === kind);
}
