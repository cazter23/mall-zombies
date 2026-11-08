import { bossVouchers } from '../config/bosses.js';
import { nextTier } from '../weapons/upgrades.js';

// Eligibility is checked each live tick and immediately at pickup. Prices and consumption stay in pricing.
export function configureBossVouchers({ pricing, wallet, map, gun, state }) {
  pricing.configureVouchers({
    onPoints: amount => { if (!state.over) wallet.earn(amount); },
    eligible(voucher) {
      if (voucher.category === 'door') return Object.keys(map.zones).some(id => !map.zones[id].open);
      if (voucher.category === 'tier') {
        // (a gun handed over at Build-A-Blaster comes back: the voucher still has a use)
        return gun.slots.some(id => voucher.ids.includes(nextTier(gun.modsFor(id))))
          || (!!gun.away && voucher.ids.includes(nextTier(gun.away.mods)));
      }
      return true;
    },
  });
  return bossVouchers;
}
