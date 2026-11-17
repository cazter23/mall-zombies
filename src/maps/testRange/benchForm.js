// =============================================================================
// A TEST RANGE BENCH FORM (debug mode): the menu behind the armory bench (armory.js) and the zombie pen's console (pen.js).
// Hold F at the bench and a form opens: pages of columns; left / right move between columns (and pages), up / down pick, confirm applies
// the highlighted choice at once, back closes. Like the fitting-room picker the world does not stop: while it is open the player stands
// still (state.menu) and the gun holds. It closes on a hit, death, or moving away. A choice that goes through marks the run assisted
// (createGame state.assisted): a debug tool's run is not one for the records.
//
// DOM-free (the tests drive it); ui/benchForm.js draws `view`.
//   const form = createBenchForm({ position, normal, menu, kicker, prompt: { kind, id, label, detail }, columns: (ctx) => [...] })
//     a column: { page, id, name, options() -> [{ id, name, color?, available?, note? }], current() -> id | null,
//                 apply(id) -> the message to show (throw to refuse: the error's message is shown), resetsCursors? }
//   form.connect(ctx)   ctx: { input, state, events, sound, player, interactions, ...whatever the columns use }
//   form.open() / close() / update(dt) / isOpen / view / columns / choose(columnId, optionId) (tests: as the keys would)
// =============================================================================

import { feel } from '../../config/feel.js';
import { createMenuNav, GAME_MENU_ACTIONS } from '../../core/menuNav.js';

const TICK = 1 / feel.simulation.tickRate;
const CLOSE_DISTANCE = 3; // metres from the bench: walking (or being pushed) further closes the form

export function createBenchForm({ position, normal, menu, kicker, prompt, columns: buildColumns }) {
  let ctx = null;
  let COLUMNS = [];
  let PAGES = [];
  let open = false;
  let column = 0;
  let cursor = {}; // column id -> highlighted option id
  let message = '';
  const nav = createMenuNav({ actions: GAME_MENU_ACTIONS });

  function setOpen(value) {
    if (open === value) return;
    open = value;
    ctx.state.menu = value ? menu : null;
  }

  function resetCursors() {
    cursor = Object.fromEntries(COLUMNS.map((c) => [c.id, c.current() ?? c.options()[0]?.id ?? null]));
  }

  function moveItem(step) {
    const col = COLUMNS[column];
    const ids = col.options().map((o) => o.id);
    const at = Math.max(0, ids.indexOf(cursor[col.id]));
    cursor[col.id] = ids[(at + step + ids.length) % ids.length];
  }

  function confirm() {
    const col = COLUMNS[column];
    const option = col.options().find((o) => o.id === cursor[col.id]);
    if (!option || option.available === false) {
      ctx.sound?.play('denied');
      message = option?.note || '';
      return;
    }
    try {
      message = col.apply(option.id) ?? '';
    } catch (error) { // (a combination the game refuses, e.g. a warranty effect a gun has nothing for: say so, change nothing more)
      ctx.sound?.play('denied');
      message = error.message;
      return;
    }
    ctx.state.assisted = true;
    ctx.sound?.play('purchase');
    if (col.resetsCursors) resetCursors(); // (e.g. a new gun: every other column now offers what it has)
  }

  return {
    get isOpen() { return open; },
    /** The columns, for tests: [{ page, id, name }]. */
    get columns() { return COLUMNS.map(({ page, id, name }) => ({ page, id, name })); },

    connect(gameContext) {
      ctx = gameContext;
      COLUMNS = buildColumns(ctx);
      PAGES = [...new Set(COLUMNS.map((c) => c.page))];
      ctx.events.on('playerHit', () => setOpen(false));
      ctx.events.on('playerDeath', () => setOpen(false));
      const form = this;
      ctx.interactions?.add({
        kind: prompt.kind, id: prompt.id, label: prompt.label, title: prompt.label, detail: prompt.detail,
        verb: 'open', priceLabel: 'Free', cost: 0, quiet: true,
        position, normal,
        available: () => true,
        use: () => form.open(),
      });
    },

    open() {
      resetCursors();
      message = '';
      nav.prime(ctx.input);
      setOpen(true);
    },
    close() { setOpen(false); },

    /** Press handling while open (the fixed tick: the range's update). */
    update(dt = TICK) {
      if (!open) return;
      const p = ctx.player.position;
      if (Math.hypot(p.x - position.x, p.z - position.z) > CLOSE_DISTANCE) { setOpen(false); return; }
      const step = nav.read(ctx.input, dt);
      if (step.back) { setOpen(false); return; }
      if (step.x) column = (column + step.x + COLUMNS.length) % COLUMNS.length;
      if (step.y) moveItem(step.y);
      if (step.confirm) confirm();
    },

    /** Test hook: pick an option in a column and confirm it, as the keys would. Returns the message. */
    choose(columnId, optionId) {
      column = COLUMNS.findIndex((c) => c.id === columnId);
      cursor[columnId] = optionId;
      confirm();
      return message;
    },

    /** What ui/benchForm.js draws. Null while closed. */
    get view() {
      if (!open) return null;
      const page = COLUMNS[column].page;
      return {
        kicker,
        title: prompt.title?.(ctx) ?? prompt.label,
        page,
        pages: PAGES.map((name) => ({ name, active: name === page })),
        message,
        columns: COLUMNS.filter((c) => c.page === page).map((c) => {
          const current = c.current();
          return {
            id: c.id, name: c.name, active: c === COLUMNS[column],
            items: c.options().map((o) => ({
              id: o.id, name: o.name, color: o.color ?? null, available: o.available !== false, note: o.note ?? '',
              current: o.id === current, selected: o.id === cursor[c.id],
            })),
          };
        }),
      };
    },
  };
}
