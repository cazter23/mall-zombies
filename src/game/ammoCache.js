// =============================================================================
// AMMO CACHE (a buyable for interactions.js)
// A vending machine in the map (map.ammoCaches): hold the interact button next to it to refill the
// gun in your hand (magazine + reserve, any gun, including the staple gun that has no wall buy) for
// one flat price (economy.ammoCache.price). Only works once its area is open, and not when the gun
// in hand is already full.
//
//   ammoCacheItem({ cache, zones, gun, price }) -> an item for interactions.add()
//     cache  { zone, position }       from map.ammoCaches
//     zones  the map's zone table     { [zoneId]: { open } }
//     gun    the player's loadout     (gun.def.name, gun.weapon.isFull / refill())
//     price  points (a number, or a function returning one)
// =============================================================================

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
