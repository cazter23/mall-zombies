// =============================================================================
// THE ARMORY BENCH (debug mode: part of the test range, maps/testRange/testRange.js). Hold F at the bench and a form opens (benchForm.js:
// pages of columns, everything free and applied the moment you confirm), through the same code the game uses:
//   Gun          the gun (gun.give: any gun, claw-only ones too) · Extended Warranty tier · Warranty Renewals   (weapons/upgrades.js)
//   Attachments  one column per slot (barrel, sight, magazine, grip): None, or an attachment that fits the gun in hand
//   Build        Stuffing (None = no build) · Heart · quality: a finished Build-A-Blaster build, made as the ritual makes it
//                (game/features/workshopRitual.js collect: the quality's gun boost and the stuffing's tracer colour are real)
//   Wardrobe     one column per slot: buy and wear (game/wardrobe.js)
//   Equipment    the Lethal and Tactical pockets, full (game/equipment.js refill) · Bubble Wrap layers (player/health.js)
// The gun in your hands changes when the form closes (the gun holds still while a menu is open).
//
//   const armory = createArmory({ position })   the bench's buy spot (its buy side faces north, toward the range)
//   armory.connect({ input, state, events, sound, gun, wardrobe, equipment, health, player, interactions }); the rest: benchForm.js
// =============================================================================

import * as THREE from 'three';
import { weapons } from '../../config/weapons.js';
import { upgrades } from '../../config/upgrades.js';
import { economy } from '../../config/economy.js';
import { workshopStuffings, workshopHearts, workshopRitual, qualityById, buildOf } from '../../config/workshop.js';
import { wardrobeItems, wardrobeSlots } from '../../config/wardrobe.js';
import { kiosk, productOf } from '../../config/kiosk.js';
import { withTier, withRenewals, withAttachment, tierOf, renewalsOf, attachmentsOf, attachmentFits, buildModifiers } from '../../weapons/upgrades.js';
import { createBenchForm } from './benchForm.js';

function armoryColumns(ctx) {
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

  const attachmentsIn = (slot) => Object.entries(upgrades.attachments).filter(([, a]) => a.slot === slot).map(([id]) => id);
  const products = (pocket) => Object.keys(kiosk.products).filter((id) => productOf(id).pocket === pocket);
  const needsBuild = () => (build() ? {} : { available: false, note: 'Pick a stuffing' });

  return [
    { page: 'Gun', id: 'gun', name: 'Gun', resetsCursors: true,
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
    ...Object.keys(upgrades.attachmentSlots).map((slot) => ({ page: 'Attachments', id: `attachment:${slot}`, name: upgrades.attachmentSlots[slot].name,
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
      options: () => Object.entries(workshopHearts).map(([id, h]) => ({ id, name: h.name, ...needsBuild() })),
      current: () => build()?.heart ?? null,
      apply: (id) => applyBuild({ heart: id }) },
    { page: 'Build', id: 'quality', name: 'Quality',
      options: () => workshopRitual.qualities.map((q) => ({ id: q.id, name: q.name, ...needsBuild() })),
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
}

export function createArmory({ position }) {
  return createBenchForm({
    position,
    normal: new THREE.Vector3(0, 0, -1),
    menu: 'armory',
    kicker: 'Test range · Armory bench · Free',
    prompt: {
      kind: 'armory', id: 'bench', label: 'Armory bench',
      detail: 'Any gun, warranty, attachments, build, wardrobe and equipment, free. Marks the run as a debug run.',
      title: (ctx) => `In hand: ${ctx.gun.def.name}`,
    },
    columns: armoryColumns,
  });
}
