// =============================================================================
// UPGRADE DESK (map feature kind 'upgradeDesk'): Customer Service. Hold the interact button at the counter
// to buy what game/warranty.js offers for the gun in your hand: normally the NEXT Extended Warranty tier (config/upgrades.js)
// Standard -> Deluxe -> Premium -> Platinum, then Warranty Renewals; or, when a replaced gun left a warranty on file, moving it onto this
// gun for a share of its price. Prices come from g.pricing ('tier'). No prompt while switching guns, on the loaner, before its area is open,
// or once nothing is left to sell. Buying does NOT refill ammo: the bigger magazine fills on the next reload or ammo buy.
// The desk's body is map geometry (mall/props.js serviceDesk).
//
// feature: { kind: 'upgradeDesk', name, zone, position (the buy spot), normal }
// =============================================================================

import { renewalLines, tierById, tierLines, tierOf } from '../../weapons/upgrades.js';
import { describeEffects } from '../../config/effectWords.js';
import { upgrades } from '../../config/upgrades.js';
import { meleeTierConfig } from '../meleeUpgrades.js';

export function buildUpgradeDesk(desk, { map, gun, pricing, interactions, warranty, meleeUpgrades }) {
  interactions.add(upgradeDeskItem({ desk, zones: map.zones, gun, pricing, warranty }));
  if (desk.meleePosition) interactions.add(meleeDeskItem({ desk, zones: map.zones, gun, pricing, meleeUpgrades })); // the second window
  return null; // nothing to tick or reset (gun upgrades live on the carried guns, box cutter tiers in the stats)
}

/** What the offer is called: 'Deluxe', 'Renewal 2', 'Premium (on file)'. */
const nameOf = (offer) => (offer.kind === 'renewal' ? `Renewal ${offer.count}` : offer.kind === 'transfer' ? `${tierById(offer.tier).name} (on file)` : tierById(offer.tier).name);

/** What the offer does, in words (config/upgrades.js `lines`): a tier, a renewal, or the tier on file being moved. */
const linesOf = (offer) => (offer.kind === 'renewal' ? renewalLines() : tierLines(offer.tier));

export function upgradeDeskItem({ desk, zones, gun, pricing, warranty }) {
  const offer = () => warranty.offer(gun.def.id);
  const shown = () => offer() ?? { kind: 'tier', tier: 'platinum' }; // (the label while nothing is for sale)
  return {
    get label() {
      return `${gun.def.name} → ${nameOf(shown())}`;
    },
    verb: 'upgrade',
    get title() {
      const now = tierById(tierOf(gun.modsFor(gun.def.id))).name;
      return shown().kind === 'transfer' ? `Move your ${nameOf(shown())} warranty here` : `${now} → ${nameOf(shown())}`;
    },
    get detail() {
      const o = shown();
      const words = linesOf(o).map((line) => line.text);
      return `${tierById(tierOf(gun.modsFor(gun.def.id))).name} → ${nameOf(o)} warranty · ${words.length ? words.join(' · ') : 'Keeps your warranty'} · Ammo not included`;
    },
    get detailLines() { return linesOf(shown()); }, // (the HUD colours each line)
    kind: 'tier',
    get id() {
      return offer()?.pricingId ?? null; // what is being bought, for pricing
    },
    get cost() {
      return pricing.priceOf('tier', offer()?.pricingId);
    },
    position: desk.position,
    available: () => zones[desk.zone].open && !gun.isSwitching && !gun.isLoaner && offer() !== null,
    use: () => warranty.accept(gun.def.id, offer()),
  };
}

/**
 * The desk's second window: the box cutter tiers (config/upgrades.js melee; game/meleeUpgrades.js). Priced through g.pricing ('melee').
 * Not tied to the gun in your hand: it upgrades the box cutter, so it is there while a tier remains (and no prompt mid gun switch).
 */
export function meleeDeskItem({ desk, zones, gun, pricing, meleeUpgrades }) {
  const offer = () => meleeUpgrades.offer();
  const shown = () => meleeTierConfig(offer()?.tier ?? upgrades.melee.length); // (the last tier's label while nothing is for sale)
  const nowName = () => (meleeUpgrades.tier === 0 ? 'Box Cutter' : meleeTierConfig(meleeUpgrades.tier).name);
  return {
    get label() {
      return `Box Cutter → ${shown().name}`;
    },
    verb: 'upgrade',
    get title() {
      return `${nowName()} → ${shown().name}`;
    },
    get detail() {
      return describeEffects(shown().lines, { damage: shown().damage }).map((line) => line.text).join(' · ');
    },
    get detailLines() { return describeEffects(shown().lines, { damage: shown().damage }); }, // (the HUD colours each line)
    kind: 'melee',
    get id() {
      return offer()?.pricingId ?? null;
    },
    get cost() {
      return pricing.priceOf('melee', offer()?.pricingId);
    },
    position: desk.meleePosition,
    available: () => zones[desk.zone].open && !gun.isSwitching && offer() !== null, // (no prompt mid gun switch, like the gun window)
    use: () => meleeUpgrades.accept(offer()),
  };
}
