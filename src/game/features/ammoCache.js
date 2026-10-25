// =============================================================================
// AMMO CACHE (map feature kind 'ammoCache'): the RESTOCK-O-MATIC vending machine (its body is map geometry,
// mall/restockMachine.js). Hold the interact button next to it to refill the gun in your hand
// (magazine + reserve, any gun, including the staple gun that has no wall buy) for one flat price
// (g.pricing 'ammoCache'). Only works once its area is open, and not when the gun in hand is already full.
//
// feature: { kind: 'ammoCache', name, zone, position (the buy spot), normal, screen? }
//   screen (optional): the machine's live display ({ show({ title, line, note, tone }) }): this feature keeps it
//   showing the gun in your hand, its ammo and the price (only redrawn when the words change).
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
  if (!cache.screen) return null;
  const refresh = () => cache.screen.show(ammoScreenText({ gun, price: pricing.priceOf('ammoCache'), sale: pricing.discountOf('ammoCache') > 0 }));
  refresh();
  return { update: refresh, reset: refresh }; // (features tick only while playing: the screen is cheap, it only redraws on a change)
}

// What the machine's screen says: the gun in hand, its ammo, and either FULL or the price.
export function ammoScreenText({ gun, price, sale = false }) {
  const w = gun.weapon;
  const name = gun.def.name.toUpperCase();
  if (w.isFull) return { title: name, line: 'FULL', note: `${w.magazine} / ${w.reserve}`, tone: '#7dffb0' };
  return { title: name, line: `${price} PTS`, note: `${w.magazine} / ${w.reserve}${sale ? '  SALE' : ''}`, tone: sale ? '#ffd23f' : '#ff9f43' };
}

export function ammoCacheItem({ cache, zones, gun, price }) {
  return {
    get label() {
      return `Ammo · ${gun.def.name}`; // shows which gun it's for
    },
    verb: 'buy',
    detail: 'Refills the held weapon’s magazine and reserve',
    kind: 'ammoCache',
    get id() {
      return gun.def.id; // the gun being refilled
    },
    get cost() {
      return typeof price === 'function' ? price() : price;
    },
    position: cache.position,
    available: () => zones[cache.zone].open && !gun.weapon.isFull,
    use: () => gun.weapon.refill(),
  };
}
