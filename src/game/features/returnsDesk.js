import { closingTime } from '../../config/closingTime.js';
import { weapons } from '../../config/weapons.js';

export function buildReturnsDesk(feature, { map, gun, closing, pricing, interactions, state }) {
  const cfg = closingTime.returnsDesk;
  const def = weapons[cfg.weaponId];
  const ammo = () => gun.def.id === def.id;
  interactions.add({
    get id() { return ammo() ? 'returnsAmmo' : 'returnsDesk'; },
    kind: 'closing',
    get label() { return ammo() ? cfg.ammoName : def.name; },
    title: cfg.name,
    get verb() { return ammo() ? cfg.refill : cfg.buy; },
    get cost() { return pricing.priceOf('closing', this.id); },
    get blocked() {
      if (gun.isSwitching) return cfg.busy;
      if (ammo()) return gun.weapon.isFull ? cfg.full : null;
      if (gun.owns(def.id)) return cfg.equip;
      const missing = closing.missingDuties;
      return missing.length ? cfg.gate + missing.map(line => state.showClosingGuidance ? line.duty : line.place).join(', ') : null;
    },
    position: feature.position,
    available: () => map.zones[feature.zone].open && !state.over,
    use() { if (ammo()) gun.weapon.refill(); else gun.give(def); },
  });
}
