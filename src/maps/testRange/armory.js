// =============================================================================
// THE ARMORY BENCH (debug mode: part of the test range, maps/testRange/testRange.js). Hold F at the bench and a form opens: pages of
// columns, everything free and applied the moment you confirm, through the same code the game uses:
//   Gun          the gun (gun.give: any gun, claw-only ones too) · Extended Warranty tier · Warranty Renewals   (weapons/upgrades.js)
//   Attachments  one column per slot (barrel, sight, magazine, grip): None, or an attachment that fits the gun in hand
//   Build        Stuffing (None = no build) · Heart · quality: a finished Build-A-Blaster build, made as the ritual makes it
//                (game/features/workshopRitual.js collect: the quality's gun boost and the stuffing's tracer colour are real)
//   Wardrobe     one column per slot: buy and wear (game/wardrobe.js)
//   Equipment    the Lethal and Tactical pockets, full (game/equipment.js refill) · Bubble Wrap layers (player/health.js)
// Like the fitting-room picker, the world does not stop: while it is open the player stands still (state.menu) and the gun does not
// fire. Left / right move between columns (and pages), up / down pick, confirm applies, back closes. Closes on a hit, death, moving away.
// Using it is a debug command for the records: it marks the run assisted (createGame state.assisted), like any other.
//
// DOM-free (the tests drive it); ui/armoryForm.js draws `view`.
//   const armory = createArmory({ position })                     the bench's buy spot
//   armory.connect({ input, state, events, sound, gun, wardrobe, equipment, health, player, interactions })
//   armory.open() / close() / update(dt) / isOpen / view / columns (for tests: [{ page, id, name }])
// =============================================================================

import { weapons } from '../../config/weapons.js';
import { upgrades } from '../../config/upgrades.js';
import { economy } from '../../config/economy.js';
import { workshopStuffings, workshopHearts, workshopRitual, qualityById, buildOf } from '../../config/workshop.js';
import { wardrobeItems, wardrobeSlots } from '../../config/wardrobe.js';
import { kiosk, productOf } from '../../config/kiosk.js';
import { feel } from '../../config/feel.js';
import { withTier, withRenewals, withAttachment, tierOf, renewalsOf, attachmentsOf, attachmentFits, buildModifiers } from '../../weapons/upgrades.js';
import { createMenuNav, GAME_MENU_ACTIONS } from '../../core/menuNav.js';

const TICK = 1 / feel.simulation.tickRate;
const CLOSE_DISTANCE = 3; // metres from the bench: walking (or being pushed) further closes the form
const hex = (color) => color ?? null;

export function createArmory({ position }) {
  let ctx = null;
  let open = false;
  let column = 0;
  let cursor = {}; // column id -> highlighted option id
  let message = '';
  const nav = createMenuNav({ actions: GAME_MENU_ACTIONS });

  // --- What each column offers, what is fitted now, and how a choice is applied -------------------------------------------
  const base = () => weapons[ctx.gun.def.id] ?? ctx.gun.def.base ?? ctx.gun.def; // (the gun in hand's config entry: mods are built on it)
  const mods = () => ctx.gun.modsFor(ctx.gun.def.id);
  const setMods = (next) => ctx.gun.setMods(ctx.gun.def.id, next);
  const build = () => buildOf(mods());

  function applyBuild(change) {
    const was = build() ?? { name: 'Range Gun', stuffing: null, heart: Object.keys(workshopHearts)[0], quality: 'regular', kills: 0, confirmed: 0 };
    const next = { ...was, ...change };
    const rest = mods().filter((m) => m.id !== 'build');
    if (!next.stuffing) { setMods(rest); return 'No build'; }
    const quality = qualityById(next.quality) ?? workshopRitual.qualities[0];
    const modifiers = buildModifiers(base(), workshopStuffings[next.stuffing].color, quality.gun);
    setMods([...rest, { id: 'build', build: { ...next, quality: quality.id }, modifiers }]);
    return `${quality.name} ${workshopStuffings[next.stuffing].name} · ${workshopHearts[next.heart].name}`;
  }

  const attachmentSlots = Object.keys(upgrades.attachmentSlots);
  const attachmentsIn = (slot) => Object.entries(upgrades.attachments).filter(([, a]) => a.slot === slot).map(([id]) => id);
  const products = (pocket) => Object.keys(kiosk.products).filter((id) => productOf(id).pocket === pocket);

  const COLUMNS = [
    { page: 'Gun', id: 'gun', name: 'Gun',
      options: () => Object.values(weapons).map((w) => ({ id: w.id, name: w.name })),
      current: () => ctx.gun.def.id,
      apply: (id) => { ctx.gun.give(weapons[id]); return `In hand: ${weapons[id].name}`; } },
    { page: 'Gun', id: 'tier', name: 'Warranty',
      options: () => upgrades.tiers.map((t) => ({ id: t.id, name: t.name, color: t.color })),
      current: () => tierOf(mods()),
      apply: (id) => { setMods(withTier(base(), mods(), id)); return `Warranty: ${upgrades.tiers.find((t) => t.id === id).name}`; } },
    { page: 'Gun', id: 'renewals', name: 'Renewals',
      options: () => Array.from({ length: economy.upgrades.renewals.length + 1 }, (_, n) => ({ id: String(n), name: n ? `${n} renewal${n === 1 ? '' : 's'}` : 'None' })),
      current: () => String(renewalsOf(mods())),
      apply: (id) => { setMods(withRenewals(base(), mods(), Number(id))); return `Renewals: ${id}`; } },
    ...attachmentSlots.map((slot) => ({ page: 'Attachments', id: `attachment:${slot}`, name: upgrades.attachmentSlots[slot].name,
      options: () => [{ id: 'none', name: 'None' }, ...attachmentsIn(slot).map((id) => ({
        id, name: upgrades.attachments[id].name, available: attachmentFits(base(), id), note: attachmentFits(base(), id) ? '' : 'Does not fit',
      }))],
      current: () => attachmentsOf(mods())[slot] ?? 'none',
      apply: (id) => {
        if (id === 'none') { setMods(mods().filter((m) => m.id !== `attachment:${slot}`)); return `${upgrades.attachmentSlots[slot].name}: none`; }
        setMods(withAttachment(base(), mods(), id));
        return `Fitted: ${upgrades.attachments[id].name}`;
      } })),
    { page: 'Build', id: 'stuffing', name: 'Stuffing',
      options: () => [{ id: 'none', name: 'No build' }, ...Object.entries(workshopStuffings).map(([id, s]) => ({ id, name: s.name, color: s.color }))],
      current: () => build()?.stuffing ?? 'none',
      apply: (id) => applyBuild({ stuffing: id === 'none' ? null : id }) },
    { page: 'Build', id: 'heart', name: 'Heart',
      options: () => Object.entries(workshopHearts).map(([id, h]) => ({ id, name: h.name, available: !!build(), note: build() ? '' : 'Pick a stuffing' })),
      current: () => build()?.heart ?? null,
      apply: (id) => applyBuild({ heart: id }) },
    { page: 'Build', id: 'quality', name: 'Quality',
      options: () => workshopRitual.qualities.map((q) => ({ id: q.id, name: q.name, available: !!build(), note: build() ? '' : 'Pick a stuffing' })),
      current: () => build()?.quality ?? null,
      apply: (id) => applyBuild({ quality: id }) },
    ...Object.keys(wardrobeSlots).map((slot) => ({ page: 'Wardrobe', id: `wardrobe:${slot}`, name: wardrobeSlots[slot],
      options: () => Object.entries(wardrobeItems).filter(([, item]) => item.slot === slot).map(([id, item]) => ({ id, name: item.shortName, color: item.color })),
      current: () => ctx.wardrobe.wearing(slot),
      apply: (id) => { if (!ctx.wardrobe.buy(id)) ctx.wardrobe.wear(id); return `Wearing: ${wardrobeItems[id].name}`; } })),
    ...['lethal', 'tactical'].map((pocket) => ({ page: 'Equipment', id: `pocket:${pocket}`, name: pocket === 'lethal' ? 'Lethal' : 'Tactical',
      options: () => products(pocket).map((id) => ({ id, name: productOf(id).name })),
      current: () => ctx.equipment.pockets[pocket].id,
      apply: (id) => { ctx.equipment.refill(id, productOf(id).charges); return `${productOf(id).name} x${productOf(id).charges}`; } })),
    { page: 'Equipment', id: 'armour', name: 'Bubble Wrap',
      options: () => Array.from({ length: ctx.health.maxArmourLayers + 1 }, (_, n) => ({ id: String(n), name: n ? `${n} layer${n === 1 ? '' : 's'}` : 'None' })),
      current: () => String(ctx.health.armour.length),
      apply: (id) => { ctx.health.restoreArmour([]); ctx.health.addArmour(Number(id)); return `Bubble Wrap: ${id}`; } },
  ];
  const PAGES = [...new Set(COLUMNS.map((c) => c.page))];

  function setOpen(value) {
    if (open === value) return;
    open = value;
    ctx.state.menu = value ? 'armory' : null;
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
      message = col.apply(option.id);
    } catch (error) { // (a combination the gun refuses, e.g. a warranty effect it has nothing for: say so, change nothing more)
      ctx.sound?.play('denied');
      message = error.message;
      return;
    }
    ctx.state.assisted = true; // (a debug tool: the run is no longer one for the records)
    ctx.sound?.play('purchase');
    // A new gun changes what every other column offers: point them at what it has now.
    if (col.id === 'gun') resetCursors();
  }

  function resetCursors() {
    cursor = Object.fromEntries(COLUMNS.map((c) => [c.id, c.current() ?? c.options()[0]?.id ?? null]));
  }

  return {
    get isOpen() { return open; },
    /** The columns, for tests: [{ page, id, name }]. */
    get columns() { return COLUMNS.map(({ page, id, name }) => ({ page, id, name })); },

    connect(gameContext) {
      ctx = gameContext;
      ctx.events.on('playerHit', () => setOpen(false));
      ctx.events.on('playerDeath', () => setOpen(false));
      ctx.interactions?.add({
        kind: 'armory', id: 'bench', label: 'Armory bench', title: 'Armory bench',
        detail: 'Any gun, warranty, attachments, build, wardrobe and equipment, free. Marks the run as a debug run.',
        verb: 'open', priceLabel: 'Free', cost: 0, quiet: true,
        position, normal: gameContext.normal,
        available: () => true,
        use: () => this.open(),
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

    /** What ui/armoryForm.js draws. Null while closed. */
    get view() {
      if (!open) return null;
      const page = COLUMNS[column].page;
      return {
        page,
        pages: PAGES.map((name) => ({ name, active: name === page })),
        gun: ctx.gun.def.name,
        message,
        columns: COLUMNS.filter((c) => c.page === page).map((c) => {
          const current = c.current();
          return {
            id: c.id, name: c.name, active: c === COLUMNS[column],
            items: c.options().map((o) => ({
              id: o.id, name: o.name, color: hex(o.color), available: o.available !== false, note: o.note ?? '',
              current: o.id === current, selected: o.id === cursor[c.id],
            })),
          };
        }),
      };
    },
  };
}
