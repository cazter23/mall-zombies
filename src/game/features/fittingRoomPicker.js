// =============================================================================
// THE FITTING-ROOM PICKER (one per fitting room: game/features/wardrobeFixtures.js).
// Hold interact at the mirror and this opens: your four slots side by side, each listing what you own for it. Pick a slot, pick an
// item, confirm to put it on. It stays open so you can change several slots; every owned item is at most two presses away
// (one move, one confirm). Changing is free and is never a purchase that spends a discount.
// Like Build-A-Blaster's order form (workshopOrderForm.js) the world does NOT stop: while it is open the player stands still
// (createGame skips movement, the gun and buying while state.menu is set) and the zombies keep coming.
// It closes on: back, a zombie's hit, being moved away from the mirror, death, Play again.
//
// DOM-free. ui/fittingRoomPicker.js draws `view`; input arrives as ACTIONS (config/controls.js menuLeft/menuRight pick the slot,
// menuUp/menuDown the item, menuConfirm wears, menuBack closes) plus the left stick, read through core/menuNav.js (the one
// menu model: a held direction repeats).
//
//   const picker = createFittingRoomPicker({ input, state, events, sound, wardrobe, player, position })
//   picker.open() / close() / update(dt) / reset() / isOpen / view
// =============================================================================

import { wardrobeItems, wardrobeSlots, fittingRoomPicker as cfg } from '../../config/wardrobe.js';
import { feel } from '../../config/feel.js';
import { createMenuNav, GAME_MENU_ACTIONS } from '../../core/menuNav.js';

const SLOTS = Object.keys(wardrobeSlots);
const TICK = 1 / feel.simulation.tickRate;

export function createFittingRoomPicker({ input, state, events, sound, wardrobe, player, position }) {
  let open = false;
  let slot = SLOTS[0]; // the slot being browsed
  let cursor = {}; // slot -> highlighted item id
  const nav = createMenuNav({ actions: GAME_MENU_ACTIONS }); // (D-pad, keys, wheel and left stick; held, they repeat)

  function setOpen(value) {
    if (open === value) return;
    open = value;
    state.menu = value ? 'fittingRoom' : null;
  }

  const filled = () => SLOTS.filter((s) => wardrobe.ownedIn(s).length > 0);

  function moveSlot(step) {
    const slots = filled();
    if (!slots.length) return;
    slot = slots[(Math.max(0, slots.indexOf(slot)) + step + slots.length) % slots.length];
  }

  function moveItem(step) {
    const ids = wardrobe.ownedIn(slot);
    if (!ids.length) return;
    cursor[slot] = ids[(Math.max(0, ids.indexOf(cursor[slot])) + step + ids.length) % ids.length];
  }

  function confirm() {
    const id = cursor[slot];
    if (!id || !wardrobe.wear(id)) return; // (already on: nothing to do)
    sound?.play('purchase');
    events.emit('purchase', { label: wardrobeItems[id].name, cost: 0, kind: 'fittingRoom', id });
  }

  events.on('playerHit', () => setOpen(false));
  events.on('playerDeath', () => setOpen(false));

  return {
    get isOpen() { return open; },

    open() {
      // Each slot starts on what you wear; the form starts on the first slot with something to change into.
      cursor = Object.fromEntries(SLOTS.map((s) => [s, wardrobe.wearing(s) ?? wardrobe.ownedIn(s)[0] ?? null]));
      const slots = filled();
      slot = slots.find((s) => wardrobe.ownedIn(s).length > 1) ?? slots[0] ?? SLOTS[0];
      nav.prime(input); // (a stick or key already held doesn't count)
      setOpen(true);
    },

    close() { setOpen(false); },

    /** Press handling while open. Runs on the fixed tick (features.update). */
    update(dt = TICK) {
      if (!open) return;
      if (Math.hypot(player.position.x - position.x, player.position.z - position.z) > cfg.closeDistance) {
        setOpen(false);
        return;
      }
      const step = nav.read(input, dt);
      if (step.back) {
        setOpen(false);
        return;
      }
      if (step.x) moveSlot(step.x);
      if (step.y) moveItem(step.y); // (+1 = down the list)
      if (step.confirm) confirm();
    },

    /** What ui/fittingRoomPicker.js draws. Null while closed. */
    get view() {
      if (!open) return null;
      const id = cursor[slot];
      const item = id ? wardrobeItems[id] : null;
      const wearing = !!id && wardrobe.wearing(slot) === id;
      return {
        slot,
        title: item?.name ?? 'Nothing to wear yet',
        ticket: item?.ticket ?? '',
        wearing,
        replaces: id && !wearing ? wardrobe.replaces(id) : '',
        lines: id ? wardrobe.statLines(id).map(({ text, good }) => ({ text, good })) : [],
        slots: SLOTS.map((s) => ({
          id: s,
          name: wardrobeSlots[s],
          active: s === slot,
          items: wardrobe.ownedIn(s).map((itemId) => ({
            id: itemId, name: wardrobeItems[itemId].shortName, color: wardrobeItems[itemId].color, icon: wardrobeItems[itemId].icon,
            worn: wardrobe.wearing(s) === itemId, selected: cursor[s] === itemId,
          })),
        })),
      };
    },

    reset() {
      setOpen(false);
      cursor = {};
      slot = SLOTS[0];
    },
  };
}
