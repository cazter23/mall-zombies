// =============================================================================
// WARDROBE (g.wardrobe): what the player owns and wears this run, and the ONLY code that changes stats for clothes.
// An item is data (config/wardrobe.js): its `factors` are multiplied into the stats object when it goes on and divided
// out when it comes off, the same way incentives do, so the two stack in any order. The interaction system handles payment.
//
//   buy(id)        own it and put it on (a rack: game/features/wardrobeFixtures.js)
//   wear(id)       put on something you own, any slot (the fitting-room picker); false if not owned or already on
//   ownedIn(slot)  owned ids of a slot, in config order
//   statLines(id)  what would change if you put `id` on NOW: [{ stat, text, good }], from the current stats
//   ticketDetail(id)  the shelf ticket's text: joke line · stat lines · what it replaces
//   grantAll()     own everything (debug command); only empty slots get dressed
//   reset()        a new run: clears the lists and never touches stats (resetPlayerStats does that, right after)
// =============================================================================
import { wardrobeItems, wardrobeSlots, statLabels } from '../config/wardrobe.js';

const emptyOutfit = () => Object.fromEntries(Object.keys(wardrobeSlots).map((slot) => [slot, null]));
const ITEM_IDS = Object.keys(wardrobeItems);

export function createWardrobe({ stats, player, events }) {
  const owned = new Set();
  let worn = emptyOutfit();

  function equip(id) {
    const { slot, factors } = wardrobeItems[id];
    const removed = worn[slot];
    if (removed) {
      for (const [stat, factor] of Object.entries(wardrobeItems[removed].factors)) stats[stat] /= factor;
    }
    worn[slot] = id;
    for (const [stat, factor] of Object.entries(factors)) stats[stat] *= factor;
    stats.health = Math.min(stats.health, stats.maxHealth);
    player.sprintMeter = Math.min(player.sprintMeter, stats.sprintDuration);
    events.emit('wardrobeChange', { slot, worn: id, removed });
  }

  // One ticket line for a stat going from `before` to `after`.
  function line(stat, before, after) {
    const label = statLabels[stat];
    const good = (after > before) === (label.better === 'higher');
    if (label.kind === 'value') {
      const show = (value) => `${value.toFixed(label.decimals)}${label.unit}`;
      return { stat, good, text: `${label.label} ${show(before)} → ${show(after)}` };
    }
    const pct = Math.round(Math.abs(after / before - 1) * 100);
    return { stat, good, text: (after > before ? label.up : label.down).replace('{pct}', pct) };
  }

  function statLines(id) {
    const item = wardrobeItems[id];
    const current = worn[item.slot];
    if (current === id) return [];
    const off = current ? wardrobeItems[current].factors : {};
    const lines = [];
    for (const stat of new Set([...Object.keys(item.factors), ...Object.keys(off)])) {
      const change = (item.factors[stat] ?? 1) / (off[stat] ?? 1);
      if (Math.abs(change - 1) < 1e-9) continue;
      lines.push(line(stat, stats[stat], stats[stat] * change));
    }
    return lines.sort((a, b) => b.good - a.good); // upsides first
  }

  return {
    owns: (id) => owned.has(id),
    wearing: (slot) => worn[slot],
    ownedIn: (slot) => ITEM_IDS.filter((id) => wardrobeItems[id].slot === slot && owned.has(id)),
    get status() { return { owned: [...owned], worn: { ...worn } }; },
    /** Something owned that isn't on: the fitting room has a job. */
    get canChange() { return [...owned].some((id) => worn[wardrobeItems[id].slot] !== id); },

    buy(id) {
      if (!Object.hasOwn(wardrobeItems, id) || owned.has(id)) return false;
      owned.add(id);
      equip(id);
      return true;
    },

    wear(id) {
      if (!owned.has(id) || worn[wardrobeItems[id].slot] === id) return false;
      equip(id);
      return true;
    },

    grantAll() {
      for (const id of ITEM_IDS) {
        if (owned.has(id)) continue;
        owned.add(id);
        if (!worn[wardrobeItems[id].slot]) equip(id);
      }
    },

    statLines,

    /** What this item replaces if put on now: "Replaces Hi-Vis Vest", or "Torso slot" when the slot is empty. */
    replaces(id) {
      const { slot } = wardrobeItems[id];
      const current = worn[slot];
      return current && current !== id ? `Replaces ${wardrobeItems[current].name}` : `${wardrobeSlots[slot]} slot`;
    },

    ticketDetail(id) {
      return [wardrobeItems[id].ticket, ...statLines(id).map((l) => l.text), this.replaces(id)].join(' · ');
    },

    reset() {
      // Play Again resets the shared stats separately.
      owned.clear();
      worn = emptyOutfit();
    },
  };
}
