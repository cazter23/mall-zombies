// =============================================================================
// THE PRIZE COUNTER (map feature kind 'prizeCounter'; its booth: maps/mall/prizeCounter.js; prizes and prices in config/clawMachine.js
// prizeCounter). GRAB-A-GUN's prize tickets (game/tickets.js) buy small things here: hold interact at a prize, like any buy, with
// its own price label ("100 tickets"). It is NOT a points purchase: the item costs 0 points, never goes through g.pricing (no
// Flash Sale, no voucher touches it) and isn't a 'purchase' (quiet); not enough tickets = a refusal, like too few points.
//   ammo        a full refill of the gun in your hand (refused while it's full)
//   slowClaw    a token: your next grab's sweep runs at half speed
//   attachment  a random attachment that fits an EMPTY slot of the gun in your hand, free and owned for the run (the attachment
//               counter's checks apply: not the Courtesy Loaner, not while switching, reloading, bursting or charging)
//   freeGrab    a token: your next grab costs nothing
//   keychain    a Sunny plush keychain (a Wardrobe accessory once the Wardrobe exists; for now a line on the results receipt)
// Announces 'prizeRedeemed' { id, tickets }.
//
// feature: { kind: 'prizeCounter', name, zone, position, normal, slots: [{ id, position }] }
// =============================================================================

import { clawMachine } from '../../config/clawMachine.js';
import { upgrades } from '../../config/upgrades.js';
import { attachmentById, attachmentFits, attachmentsOf, withAttachment } from '../../weapons/upgrades.js';
import { unlockAttachment } from './attachmentCounter.js';

const ATTACHMENT_IDS = Object.keys(upgrades.attachments);

/** The attachments the voucher could give the gun in hand: they fit it, and their slot is empty. */
export function voucherChoices(gun) {
  const mods = gun.modsFor(gun.def.id) ?? [];
  const fitted = attachmentsOf(mods);
  return ATTACHMENT_IDS.filter((id) => attachmentFits(gun.def.base, id) && !fitted[attachmentById(id).slot]);
}

export function buildPrizeCounter(spot, { map, gun, interactions, events, tickets, sound }) {
  const busy = () => gun.isSwitching || gun.weapon.isReloading || gun.weapon.isBursting || gun.weapon.isCharging;

  // Why this prize can't be had right now (null: it can). Tickets first, then the prize's own rule.
  function refusal(prize) {
    const need = prize.tickets - tickets.count;
    if (need > 0) return `Need ${need} more ticket${need === 1 ? '' : 's'}`;
    if (prize.id === 'ammo' && gun.weapon.isFull) return 'The gun in your hand is full';
    if (prize.id === 'attachment') {
      if (gun.isLoaner) return 'Not for the Courtesy Loaner';
      if (busy()) return 'Busy · Finish reloading first';
      if (!voucherChoices(gun).length) return `No empty slot on the ${gun.def.name} it fits`;
    }
    return null;
  }

  function give(prize) {
    if (prize.id === 'ammo') { gun.weapon.refill(); return null; }
    if (prize.id === 'attachment') {
      const choices = voucherChoices(gun);
      const id = choices[Math.floor(Math.random() * choices.length)];
      gun.setMods(gun.def.id, withAttachment(gun.def.base, gun.modsFor(gun.def.id), id));
      unlockAttachment(gun, id); // owned for the run, like a bought one: refits are free
      return id;
    }
    tickets.hold(prize.id); // slowClaw / freeGrab / keychain
    return null;
  }

  for (const slot of spot.slots) {
    const prize = clawMachine.prizeCounter.prizes.find((p) => p.id === slot.id);
    interactions.add({
      get label() { return prize.id === 'ammo' ? `${prize.name} · ${gun.def.name}` : prize.name; },
      title: prize.name,
      get detail() {
        const owned = ['slowClaw', 'freeGrab', 'keychain'].includes(prize.id) && tickets.has(prize.id) ? ` · You have ${tickets.tokens[prize.id]}` : '';
        return `${prize.blurb} · You have ${tickets.count} ticket${tickets.count === 1 ? '' : 's'}${owned}`;
      },
      verb: 'redeem',
      kind: 'prize', // (not a pricing category: tickets aren't points)
      id: prize.id,
      cost: 0,
      priceLabel: `${prize.tickets} tickets`,
      quiet: true, // (not a points purchase: no 'purchase' event, so no voucher or Employee Discount reacts)
      get blocked() { return refusal(prize); },
      position: slot.position,
      available: () => map.zones[spot.zone].open,
      use: () => {
        if (refusal(prize) || !tickets.spend(prize.tickets)) return;
        const attachment = give(prize);
        sound?.play('purchase');
        events.emit('prizeRedeemed', { id: prize.id, tickets: prize.tickets, attachment });
      },
    });
  }
  return null; // (its state lives in g.tickets, which resets itself)
}
