// =============================================================================
// WARRANTY: the rules around Extended Warranties that are not a stat change (config/upgrades.js: tiers, renewals, transfer, claimPa).
//
//   offer(gunId)   what the Customer Service desk can sell for that carried gun right now, or null:
//                    { kind: 'transfer', tier, pricingId }   a warranty on file (left by a replaced gun) moves onto this gun, for a share of its price
//                    { kind: 'tier', tier, pricingId }       the next tier
//                    { kind: 'renewal', count, pricingId }   a Warranty Renewal past Platinum (up to upgrades.renewals.max)
//   accept(gunId, offer)   put it on the gun (the desk has already charged for it)
//   onFile         the tier of a warranty left behind by a replaced gun (the best one), or null
//
// CLAIM: a Platinum gun that runs completely dry (magazine and reserve both empty) gets its ammo replaced for free, once per round.
// Announces 'warrantyClaim' { weaponId, round, pa } (game/events.js).
// A warranty stays with the gun, and a gun that goes away to Build-A-Blaster still has its own, so only a REPLACED gun leaves one on file.
// =============================================================================

import { upgrades } from '../config/upgrades.js';
import { paRandom, pickPaLine } from './announcer.js';
import { TIER_IDS, nextTier, renewalsOf, tierById, tierOf, withRenewals, withTier } from '../weapons/upgrades.js';

const rank = (tier) => TIER_IDS.indexOf(tier);

export function createWarranty({ gun, events, rounds, lineRandom = paRandom }) {
  let onFile = null;
  let carried = new Map(); // gun id -> its tier last tick
  const claimed = new Map(); // gun id -> the round of its last claim

  function offer(gunId) {
    const mods = gun.modsFor(gunId);
    const tier = tierOf(mods);
    if (onFile && rank(onFile) > rank(tier)) return { kind: 'transfer', tier: onFile, pricingId: `transfer:${onFile}` };
    const next = nextTier(mods);
    if (next) return { kind: 'tier', tier: next, pricingId: next };
    const count = renewalsOf(mods);
    if (count < upgrades.renewals.max) return { kind: 'renewal', count: count + 1, pricingId: `renewal${count + 1}` };
    return null;
  }

  function accept(gunId, bought) {
    const base = gun.def.id === gunId ? gun.def.base : gun.defOf(gunId).base;
    const mods = gun.modsFor(gunId);
    if (bought.kind === 'renewal') gun.setMods(gunId, withRenewals(base, mods, bought.count));
    else gun.setMods(gunId, withTier(base, mods, bought.tier));
    if (bought.kind === 'transfer') onFile = null;
  }

  return {
    offer,
    accept,
    get onFile() { return onFile; },

    /** Once a tick: file the warranty of a replaced gun, and honour a Platinum claim. */
    update() {
      const now = new Map(gun.slots.map((id) => [id, tierOf(gun.modsFor(id))]));
      const awayId = gun.away?.def.id;
      for (const [id, tier] of carried) {
        if (now.has(id) || id === awayId || tier === 'standard') continue;
        if (!onFile || rank(tier) > rank(onFile)) onFile = tier; // (the best one stays on file)
      }
      carried = now;
      for (const [id, tier] of now) {
        if (!tierById(tier).claim) continue;
        const weapon = gun.weaponFor(id);
        if (!weapon || weapon.magazine > 0 || weapon.reserve > 0 || claimed.get(id) === rounds.round) continue;
        claimed.set(id, rounds.round);
        weapon.refill();
        const line = pickPaLine(upgrades.claimPa.lines, lineRandom);
        const pa = { kicker: upgrades.claimPa.kicker, text: line.replace('{gun}', gun.defOf(id).name) };
        events.emit('warrantyClaim', { weaponId: id, round: rounds.round, pa });
      }
    },

    // Save & Quit (game/saveGame.js): the warranty on file and the Platinum claims made (by round).
    serialize() {
      return { onFile, claimed: [...claimed] };
    },
    restore(data) {
      onFile = data.onFile;
      claimed.clear();
      for (const [id, round] of data.claimed) claimed.set(id, round);
      carried = new Map(gun.slots.map((id) => [id, tierOf(gun.modsFor(id))])); // (the restored guns are not "replaced")
    },

    reset() {
      onFile = null;
      carried = new Map();
      claimed.clear();
    },
  };
}
