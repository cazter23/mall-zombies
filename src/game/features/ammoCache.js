// =============================================================================
// AMMO CACHE (map feature kind 'ammoCache'): the STAPLE-O-MAT vending machine (its body is map geometry,
// mall/props.js vendingMachine). Hold the interact button next to it to refill the gun in your hand
// (magazine + reserve, any gun, including the staple gun that has no wall buy) for one flat price
// (g.pricing 'ammoCache'). Only works once its area is open, and not when the gun in hand is already full.
//
// feature: { kind: 'ammoCache', name, zone, position (the buy spot), normal }
//
//   buildAmmoCache(feature, ctx)   registers the buyable (game/features/index.js calls this)
//   ammoCacheItem({ cache, zones, gun, price }) -> an item for interactions.add()
//     cache  { zone, position }       the feature
//     zones  the map's zone table     { [zoneId]: { open } }
//     gun    the player's loadout     (gun.def.name, gun.weapon.isFull / refill())
//     price  points (a number, or a function returning one)
// =============================================================================

export function buildAmmoCache(cache, { map, gun, pricing, interactions }) {
  interactions.add(ammoCacheItem({ cache, zones: map.zones, gun, price: () => pricing.priceOf('ammoCache') }));
  return null; // nothing to tick or reset
}

export function ammoCacheItem({ cache, zones, gun, price }) {
  return {
    get label() {
      return `Ammo · ${gun.def.name}`; // shows which gun it's for
    },
    verb: 'buy',
    get cost() {
      return typeof price === 'function' ? price() : price;
    },
    position: cache.position,
    available: () => zones[cache.zone].open && !gun.weapon.isFull,
    use: () => gun.weapon.refill(),
  };
}
