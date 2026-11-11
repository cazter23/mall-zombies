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
//     colliders, effects, sound, input, tickets, shootables, aimAssist, secondChance, equipment, closing }
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
import { buildFountainHazard } from './fountainHazard.js';
import { buildFryerHazard } from './fryerHazard.js';
import { buildSprinklerHazard } from './sprinklerHazard.js';

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
  fountainHazard: buildFountainHazard, // Grand Atrium fountain breaker switch (docs/hazards-plan.md)
  fryerHazard: buildFryerHazard, // Food Court Corn Dog Corral fryer valve switch (docs/hazards-plan.md)
  sprinklerHazard: buildSprinklerHazard, // Main Hallway south fire alarm pull switch (docs/hazards-plan.md)
  nightSafe: buildNightSafe,
  escapeVan: buildEscapeVan,
};

export const FEATURE_KINDS = Object.keys(builders);

/**
 * Build every feature of a map. Returns { list, update(dt), reset() }: list = the built features
 * ({ feature, instance }), update/reset run each feature's own hooks (if it has any).
 * An unknown or missing kind is an error (a typo in map data shouldn't silently vanish).
 * `kinds` defaults to the registry above (tests pass their own).
 */
export function buildFeatures(map, ctx, kinds = builders) {
  const list = [];
  for (const feature of map.features ?? []) {
    const build = Object.hasOwn(kinds, feature.kind) ? kinds[feature.kind] : null; // (not inherited names like 'toString')
    if (!build) {
      throw new Error(`map "${map.id}": feature "${feature.name ?? '?'}" has unknown kind "${feature.kind}" (${Object.keys(kinds).join(', ')})`);
    }
    list.push({ feature, instance: build(feature, ctx) ?? {} });
  }
  return {
    list,
    context: ctx, // what every feature was given (for tests / debugging)
    update(dt) {
      for (const { instance } of list) instance.update?.(dt);
    },
    reset() {
      for (const { instance } of list) instance.reset?.();
    },
    // Save & Quit (game/saveGame.js): each feature with run state worth keeping has serialize() / restore(data); the data
    // is keyed by the feature's place in map.features (a save from another map version is dropped by its version number).
    serialize() {
      const out = {};
      list.forEach(({ instance }, i) => { if (instance.serialize) out[i] = instance.serialize(); });
      return out;
    },
    restore(data) {
      list.forEach(({ instance }, i) => { if (instance.restore && data[i] !== undefined) instance.restore(data[i]); });
    },
  };
}

/** A map's features of one kind (handy for tests and debug tools). */
export function featuresOf(map, kind) {
  return (map.features ?? []).filter((f) => f.kind === kind);
}
