// =============================================================================
// THE BUILD-A-BLASTER ORDER FORM (owned by game/features/workshopRitual.js).
// Hold interact at the bench and this opens: every Stuffing in one column, every Heart in the other, already filled in
// (your last order, else today's first stuffing and its usual Heart), so pressing confirm again orders straight away.
// The world does NOT stop: while it is open the player stands still (createGame skips movement, the gun and buying
// while state.menu is set) and the zombies keep coming. Cancel, death or Play again close it.
//
// DOM-free. ui/orderForm.js draws `view`; input arrives as ACTIONS (config/controls.js menuUp/menuDown/menuLeft/menuRight/
// menuConfirm/menuBack) plus the left stick, read through core/menuNav.js (the one menu model: a held direction repeats),
// so keyboard, mouse wheel and controller all work.
//
//   const form = createOrderForm({ input, state, wallet, events, sound, price, options, defaults, onOrder })
//     price()      what this order costs now (g.pricing)
//     options()    { stuffings: [{ id, available, note }], hearts: [id] } in display order
//     defaults()   { stuffing, heart } to fill the form with
//     onOrder(stuffing, heart)  the order went through (points already spent)
//   form.open() / form.close() / form.update(dt) / form.isOpen / form.view
// =============================================================================

import { workshopStuffings, workshopHearts, stuffingBlurb, orderForm as cfg } from '../../config/workshop.js';
import { gunStyle } from '../../config/gunStyle.js';
import { createMenuNav, GAME_MENU_ACTIONS } from '../../core/menuNav.js';

export function createOrderForm({ input, state, wallet, events, sound, price, options, defaults, onOrder, label }) {
  let open = false;
  let column = 0; // 0 = Stuffing, 1 = Heart
  let stuffing = null, heart = null;
  let denied = 0;
  const nav = createMenuNav({ actions: GAME_MENU_ACTIONS }); // (D-pad, keys, wheel and left stick; held, they repeat)

  function setOpen(value) {
    open = value;
    state.menu = value ? 'orderForm' : null;
  }

  function move(column_, step) {
    const { stuffings, hearts } = options();
    if (column_ === 0) {
      const ids = stuffings.filter((s) => s.available).map((s) => s.id);
      if (!ids.length) return;
      const i = ids.indexOf(stuffing);
      stuffing = ids[(Math.max(0, i) + step + ids.length) % ids.length];
    } else {
      const i = hearts.indexOf(heart);
      heart = hearts[(Math.max(0, i) + step + hearts.length) % hearts.length];
    }
  }

  function confirm() {
    const cost = price();
    if (!wallet.spend(cost)) {
      denied = cfg.deniedSeconds;
      sound?.play('denied');
      return;
    }
    sound?.play('purchase');
    events.emit('purchase', { label: label(), cost, kind: 'workshop', id: 'orderForm' });
    const order = { stuffing, heart };
    setOpen(false);
    onOrder(order.stuffing, order.heart);
  }

  return {
    get isOpen() { return open; },

    open() {
      const fill = defaults();
      stuffing = fill.stuffing;
      heart = fill.heart;
      column = 0;
      denied = 0;
      nav.prime(input); // (a stick or key already held doesn't count)
      setOpen(true);
    },

    close() {
      if (open) setOpen(false);
    },

    /** Press handling while open. Runs on the fixed tick (features.update). */
    update(dt) {
      if (!open) return;
      denied = Math.max(0, denied - dt);
      const step = nav.read(input, dt);
      if (step.back) {
        setOpen(false);
        return;
      }
      if (step.x) column = step.x > 0 ? 1 : 0;
      if (step.y) move(column, step.y); // (+1 = down the list)
      if (step.confirm && stuffing && heart) confirm();
    },

    /** What ui/orderForm.js draws. Null while closed. */
    get view() {
      if (!open) return null;
      const { stuffings, hearts } = options();
      const cost = price();
      return {
        title: label(),
        buildBlurb: cfg.buildBlurb,
        column,
        cost,
        canAfford: wallet.canAfford(cost),
        shortfall: Math.max(0, cost - wallet.points),
        denied: denied > 0,
        stuffings: stuffings.map((s) => ({
          id: s.id, name: workshopStuffings[s.id].name, blurb: stuffingBlurb(s.id), color: workshopStuffings[s.id].color,
          available: s.available, note: s.note, selected: s.id === stuffing,
        })),
        hearts: hearts.map((id) => ({ id, name: workshopHearts[id].name, blurb: workshopHearts[id].blurb, color: gunStyle.heart.colors[id], selected: id === heart })), // (color: its badge on the gun)
      };
    },

    reset() {
      setOpen(false);
      denied = 0;
    },
  };
}
