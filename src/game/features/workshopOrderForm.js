// =============================================================================
// THE BUILD-A-BLASTER ORDER FORM (owned by game/features/workshopRitual.js).
// Hold interact at the bench and this opens: every Stuffing in one column, every Heart in the other, already filled in
// (your last order, else today's first stuffing and its usual Heart), so pressing confirm again orders straight away.
// The world does NOT stop: while it is open the player stands still (createGame skips movement, the gun and buying
// while state.menu is set) and the zombies keep coming. Cancel, death or Play again close it.
//
// DOM-free. ui/orderForm.js draws `view`; input arrives as ACTIONS (config/controls.js menuUp/menuDown/menuLeft/menuRight/
// menuConfirm/menuBack) plus the left stick, so keyboard, mouse wheel and controller all work.
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

const STICK_ON = .6, STICK_OFF = .3; // stick deflection that counts as a press, and that re-arms it

export function createOrderForm({ input, state, wallet, events, sound, price, options, defaults, onOrder, label }) {
  let open = false;
  let column = 0; // 0 = Stuffing, 1 = Heart
  let stuffing = null, heart = null;
  let denied = 0;
  let stick = { x: 0, y: 0 }; // last stick direction pressed (-1, 0, 1), so holding it moves once

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

  // Keys and the mouse wheel give a press per step; the stick gives one per push.
  function stickStep(axis, value) {
    const dir = value > STICK_ON ? 1 : value < -STICK_ON ? -1 : Math.abs(value) < STICK_OFF ? 0 : stick[axis];
    const fresh = dir !== 0 && dir !== stick[axis];
    stick[axis] = dir;
    return fresh ? dir : 0;
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
      stick = { x: Math.sign(Math.round(input.padMove.x)), y: Math.sign(Math.round(input.padMove.y)) }; // (a stick already held doesn't count)
      setOpen(true);
    },

    close() {
      if (open) setOpen(false);
    },

    /** Press handling while open. Runs on the fixed tick (features.update). */
    update(dt) {
      if (!open) return;
      denied = Math.max(0, denied - dt);
      if (input.consumeAction('menuBack')) {
        setOpen(false);
        return;
      }
      const sideways = (input.consumeAction('menuRight') ? 1 : 0) - (input.consumeAction('menuLeft') ? 1 : 0) + stickStep('x', input.padMove.x);
      if (sideways) column = sideways > 0 ? 1 : 0;
      // (padMove.y is forward-positive: pushing up moves up the list)
      const down = (input.consumeAction('menuDown') ? 1 : 0) - (input.consumeAction('menuUp') ? 1 : 0) - stickStep('y', input.padMove.y);
      if (down) move(column, down);
      if (input.consumeAction('menuConfirm') && stuffing && heart) confirm();
    },

    /** What ui/orderForm.js draws. Null while closed. */
    get view() {
      if (!open) return null;
      const { stuffings, hearts } = options();
      const cost = price();
      return {
        title: label(),
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
