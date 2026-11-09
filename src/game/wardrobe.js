// Ownership and effects last for one run. The interaction system handles payment.
import { wardrobeItems, wardrobeSlots } from '../config/wardrobe.js';

const emptyOutfit = () => Object.fromEntries(Object.keys(wardrobeSlots).map((slot) => [slot, null]));

export function createWardrobe({ stats, player, events }) {
  const owned = new Set();
  const bag = [];
  let worn = emptyOutfit();

  function equip(id) {
    const { slot, factors } = wardrobeItems[id];
    const removed = worn[slot];
    if (removed) {
      for (const [stat, factor] of Object.entries(wardrobeItems[removed].factors)) stats[stat] /= factor;
      bag.push(removed);
    }
    worn[slot] = id;
    for (const [stat, factor] of Object.entries(factors)) stats[stat] *= factor;
    stats.health = Math.min(stats.health, stats.maxHealth);
    player.sprintMeter = Math.min(player.sprintMeter, stats.sprintDuration);
    events.emit('wardrobeChange', { slot, worn: id, removed });
  }

  return {
    owns: (id) => owned.has(id),
    wearing: (slot) => worn[slot],
    get next() { return bag[0] ?? null; },
    get status() { return { owned: [...owned], worn: { ...worn }, bag: [...bag] }; },

    buy(id) {
      if (!Object.hasOwn(wardrobeItems, id) || owned.has(id)) return false;
      owned.add(id);
      equip(id);
      return true;
    },

    wearNext() {
      if (!bag.length) return false;
      equip(bag.shift());
      return true;
    },

    reset() {
      // Play Again resets the shared stats separately.
      owned.clear();
      bag.length = 0;
      worn = emptyOutfit();
    },
  };
}
