// =============================================================================
// WALL BUY (map feature kind 'wallBuy'): a gun on the wall (chalk outline + the gun on pegs).
// Hold interact to buy the gun, or (once you own it) to refill its ammo. Prices come from
// g.pricing ('weapon' / 'ammo'). Only in an opened area, and hidden when you own it with full ammo.
// A marker for a gun that doesn't exist yet in config/weapons.js (or has no price) is inert.
//
// feature: { kind: 'wallBuy', name, zone, weapon (config/weapons.js id), position, normal (out of the wall) }
// =============================================================================

import { feel } from '../../config/feel.js';
import { weapons } from '../../config/weapons.js';
import { economy } from '../../config/economy.js';
import { ui } from '../../config/ui.js';
import { buildWeaponDisplay } from '../../weapons/models/index.js';
import { createWallBuyDisplay } from '../../world/wallBuy.js';

export function buildWallBuy(wb, { scene, map, gun, pricing, interactions }) {
  const def = weapons[wb.weapon];
  if (!def || !economy.wallBuys[wb.weapon]) return null; // reserved spot for a future gun
  scene.add(
    createWallBuyDisplay({
      position: wb.position,
      normal: wb.normal,
      name: def.name,
      gunModel: buildWeaponDisplay(def),
      cfg: feel.world.wallBuyDisplay,
    }),
  );
  const owned = () => gun.owns(def.id);
  interactions.add({
    get label() {
      return owned() ? `${def.name} ammo` : def.name;
    },
    verb: 'buy',
    get detail() {
      return owned() ? 'Refills this weapon’s magazine and reserve' : ui.weaponRoles[def.id] ?? 'Weapon requisition';
    },
    get kind() {
      return owned() ? 'ammo' : 'weapon';
    },
    id: def.id,
    get cost() {
      return owned() ? pricing.priceOf('ammo', def.id) : pricing.priceOf('weapon', def.id);
    },
    position: wb.position,
    // Only in an opened area, and not when you already have it with full ammo.
    available: () => map.zones[wb.zone].open && !(owned() && gun.weaponFor(def.id).isFull),
    use: () => gun.give(def),
  });
  return null; // nothing to tick or reset (the gun and buyables reset themselves)
}
