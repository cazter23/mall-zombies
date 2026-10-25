// =============================================================================
// ATTACHMENT COUNTER (map feature kind 'attachmentCounter'): one attachment on a store's counter
// (config/upgrades.js). Hold the interact button in front of it to fit it to the gun in your hand, price from
// g.pricing ('attachment'). It replaces whatever that gun had in the same slot. No prompt while its area is
// closed, while switching guns, if the gun already has it, or if it would do nothing on that gun (the Extended
// Nozzle on the Nail Gun). The counter itself is map geometry (mall/props.js attachmentDisplay).
//
// feature: { kind: 'attachmentCounter', name, zone, attachment (id), position (the buy spot), normal }
// =============================================================================

import { upgrades } from '../../config/upgrades.js';
import { attachmentById, attachmentFits, attachmentsOf, withAttachment } from '../../weapons/upgrades.js';

export function buildAttachmentCounter(spot, { map, gun, pricing, interactions }) {
  interactions.add(attachmentCounterItem({ spot, zones: map.zones, gun, pricing }));
  return null; // nothing to tick or reset (attachments live on the carried guns)
}

export function attachmentCounterItem({ spot, zones, gun, pricing }) {
  const id = spot.attachment;
  const attachment = attachmentById(id);
  const fitted = () => attachmentsOf(gun.modsFor(gun.def.id))[attachment.slot] === id;
  return {
    get label() {
      return `${attachment.name} on the ${gun.def.name} · ${attachment.blurb}`;
    },
    verb: 'fit',
    title: attachment.name,
    get detail() {
      const current = attachmentsOf(gun.modsFor(gun.def.id))[attachment.slot];
      return `${attachment.blurb} · ${current ? `Replaces ${attachmentById(current).name}` : `${upgrades.attachmentSlots[attachment.slot].name} slot`}`;
    },
    kind: 'attachment',
    id,
    get cost() {
      return pricing.priceOf('attachment', id);
    },
    position: spot.position,
    available: () => zones[spot.zone].open && !gun.isSwitching && attachmentFits(gun.def.base, id) && !fitted(),
    use: () => {
      const gunId = gun.def.id;
      gun.setMods(gunId, withAttachment(gun.def.base, gun.modsFor(gunId), id));
    },
  };
}

export const ATTACHMENT_SLOTS = Object.keys(upgrades.attachmentSlots);
