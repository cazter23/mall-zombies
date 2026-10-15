// =============================================================================
// UPGRADE DESK (map feature kind 'upgradeDesk'): Customer Service. Hold the interact button at the counter
// to buy the NEXT Extended Warranty tier (config/upgrades.js) for the gun in your hand: Standard -> Deluxe
// -> Premium -> Platinum, one at a time, price from g.pricing ('tier'). No prompt once the gun is Platinum,
// while switching guns, or before its area is open. Buying a tier does NOT refill ammo: the bigger
// magazine fills on the next reload or ammo buy. The desk's body is map geometry (mall/props.js serviceDesk).
//
// feature: { kind: 'upgradeDesk', name, zone, position (the buy spot), normal }
// =============================================================================

import { nextTier, tierById, withTier } from '../../weapons/upgrades.js';

export function buildUpgradeDesk(desk, { map, gun, pricing, interactions }) {
  interactions.add(upgradeDeskItem({ desk, zones: map.zones, gun, pricing }));
  return null; // nothing to tick or reset (upgrades live on the carried guns)
}

export function upgradeDeskItem({ desk, zones, gun, pricing }) {
  const next = () => nextTier(gun.modsFor(gun.def.id));
  return {
    get label() {
      return `${gun.def.name} → ${tierById(next() ?? 'platinum').name}`;
    },
    verb: 'upgrade',
    kind: 'tier',
    get id() {
      return next(); // the tier being bought
    },
    get cost() {
      return pricing.priceOf('tier', next());
    },
    position: desk.position,
    available: () => zones[desk.zone].open && !gun.isSwitching && next() !== null,
    use: () => {
      const id = gun.def.id;
      gun.setMods(id, withTier(gun.def.base, gun.modsFor(id), next()));
    },
  };
}
