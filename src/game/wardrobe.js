// =============================================================================
// WARDROBE (g.wardrobe): what the player owns and wears this run, and the ONLY code that changes stats for clothes.
// An item is data (config/wardrobe.js): its `factors` are multiplied into the stats object when it goes on and divided
// out when it comes off, the same way incentives do, so the two stack in any order. The interaction system handles payment.
//
//   buy(id)        own it and put it on (a rack: game/features/wardrobeFixtures.js)
//   wear(id)       put on something you own, any slot (the fitting-room picker); false if not owned or already on
//   ownedIn(slot)  owned ids of a slot, in config order
//   statLines(id)  what putting `id` on does, in words: [{ stat, text, good }] (config/wardrobe.js `lines`; no numbers, config/effectWords.js)
//   wornLines(id)  the same words for a WORN item: the pause screen's rail; [] if not worn
//   ticketDetail(id)  the shelf ticket's text: joke line · stat lines · what it replaces
//   grantAll()     own everything (debug command); only empty slots get dressed
//   reset()        a new run: clears the lists and never touches stats (resetPlayerStats does that, right after)
// =============================================================================
import { wardrobeItems, wardrobeSlots, statBetter } from '../config/wardrobe.js';
import { fillSize } from '../config/effectWords.js';

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

  // What an item does, in words: its own `lines` (config/wardrobe.js), upsides first. The size word comes from the factor's size, in the fixed bands of
  // config/effectWords.js; whether a line is an upside follows the factor's direction. No number is ever shown.
  function wordsOf(id) {
    const item = wardrobeItems[id];
    return item.lines
      .map(({ effect, text }) => ({ stat: effect, text: fillSize(text, item.factors[effect]), good: (item.factors[effect] > 1) === (statBetter[effect] === 'higher') }))
      .sort((a, b) => b.good - a.good);
  }

  // What putting `id` on would do (the shelf ticket, the fitting room); [] when it is already on.
  function statLines(id) {
    return worn[wardrobeItems[id].slot] === id ? [] : wordsOf(id);
  }

  // What a worn item is doing (the pause screen's rail); [] when it is not worn.
  function wornLines(id) {
    const item = wardrobeItems[id];
    return item && worn[item.slot] === id ? wordsOf(id) : [];
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
    wornLines,

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
