// =============================================================================
// ATTACHMENT COUNTER (map feature kind 'attachmentCounter'): one attachment on a store's counter
// (config/upgrades.js). Hold the interact button in front of it to fit it to the gun in your hand, price from
// g.pricing ('attachment'). First purchase unlocks free refits across compatible guns for the run.
// Replaces the gun's current slot. No prompt while its area is
// closed, while switching/reloading/bursting/charging, if already fitted, or if ineffective (the Extended
// Nozzle on the Nail Gun). The counter itself is map geometry (mall/props.js attachmentDisplay).
//
// feature: { kind: 'attachmentCounter', name, zone, attachment (id), position (the buy spot), normal }
// =============================================================================

import { upgrades } from '../../config/upgrades.js';
import { attachmentById, attachmentFits, attachmentsOf, withAttachment } from '../../weapons/upgrades.js';
import { attachmentComparison } from '../../weapons/attachmentComparison.js';

const inventories = new WeakMap();
function inventoryFor(gun) {
  if (!inventories.has(gun)) inventories.set(gun, new Set());
  return inventories.get(gun);
}
export const ownsAttachment = (gun, id) => inventoryFor(gun).has(id);

export function buildAttachmentCounter(spot, { map, gun, pricing, interactions }) {
  interactions.add(attachmentCounterItem({ spot, zones: map.zones, gun, pricing }));
  return { reset() { inventoryFor(gun).clear(); } };
}

export function attachmentCounterItem({ spot, zones, gun, pricing }) {
  const id = spot.attachment;
  const attachment = attachmentById(id);
  const owned = inventoryFor(gun);
  const fitted = () => attachmentsOf(gun.modsFor(gun.def.id))[attachment.slot] === id;
  return {
    get label() {
      return `${attachment.name} on the ${gun.def.name} · ${attachment.blurb}`;
    },
    get verb() { return owned.has(id) ? 'refit' : 'fit'; },
    get owned() { return owned.has(id); },
    title: attachment.name,
    get detail() {
      const current = attachmentsOf(gun.modsFor(gun.def.id))[attachment.slot];
      return `${owned.has(id) ? 'Owned this run · Free refit' : 'Unlocks for this run'} · ${current ? `Replaces ${attachmentById(current).name}` : `${upgrades.attachmentSlots[attachment.slot].name} slot`} · ${attachmentComparison(gun.def, gun.modsFor(gun.def.id), id)}`;
    },
    kind: 'attachment',
    id,
    get cost() {
      return owned.has(id) ? 0 : pricing.priceOf('attachment', id);
    },
    position: spot.position,
    available: () => zones[spot.zone].open && !gun.isSwitching && !gun.weapon?.isReloading && !gun.weapon?.isBursting && !gun.weapon?.isCharging && attachmentFits(gun.def.base, id) && !fitted(),
    use: () => {
      const gunId = gun.def.id;
      gun.setMods(gunId, withAttachment(gun.def.base, gun.modsFor(gunId), id));
      owned.add(id);
    },
  };
}

export const ATTACHMENT_SLOTS = Object.keys(upgrades.attachmentSlots);
