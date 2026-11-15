// =============================================================================
// WEAR-O-MATIC: the clothes vending machine (the map feature kind 'wardrobeMachine', game/features/wardrobeFixtures.js; arena survival
// only: config/arenas.js wardrobeMachine). A hot-pink cousin of the RESTOCK-O-MATIC (mall/restockMachine.js) against a wall: a lit
// name, and behind the glass four shelves, one per Wardrobe slot (head at the top, accessories at the bottom), each holding that
// slot's items in their own colours. Decoration plus ONE solid collider; everything lights itself (unlit glow, no real lights).
//
//   buildWardrobeMachine({ kit, center, wallAt, facing, floorY = 0 }) -> { position, normal }
//     on a wall that runs along X: center = its x, wallAt = the wall's z, facing = +1 / -1 (the way its front faces, along Z)
//     position / normal   the buy spot on its front and the outward direction (the interaction point)
// =============================================================================

import * as THREE from 'three';
import { wardrobeItems, wardrobeSlots, wardrobeMachine } from '../../config/wardrobe.js';

export const WEAR_O_MATIC = {
  width: 1.3,
  depth: 0.8,
  height: 2.25,
  colors: {
    body: 0xe83f8c, // hot pink (the RESTOCK-O-MATIC is orange)
    bodyDark: 0xa82763,
    trim: 0x1d1626,
    glow: 0xfff0f6,
    metal: 0x5d636b,
    slot: 0x1b1b20,
    led: 0x7dffd8,
    hanger: 0xc9ced4,
  },
  // A garment's rough size (width, height) on its shelf, by slot: hats wide and flat, tops tall, shoes in pairs, accessories small.
  garment: { head: [0.2, 0.09], torso: [0.2, 0.24], feet: [0.09, 0.08], accessory: [0.15, 0.12] },
};

const SLOTS = Object.keys(wardrobeSlots);
const itemsIn = (slot) => Object.values(wardrobeItems).filter((item) => item.slot === slot);

export function buildWardrobeMachine({ kit, center, wallAt, facing, floorY = 0, spec = WEAR_O_MATIC }) {
  const { width, depth, height, colors } = spec;
  const solid = (hex, options = {}) => new THREE.MeshStandardMaterial({ color: hex, roughness: 0.55, ...options });
  const glow = (hex) => new THREE.MeshBasicMaterial({ color: hex });
  const d = (offset) => wallAt + facing * offset;
  // u = x along the wall, a..b = z away from it
  const place = (u0, y0, u1, y1, a, b, material, options = { collide: false }) =>
    kit.box(u0, floorY + y0, Math.min(a, b), u1, floorY + y1, Math.max(a, b), material, options);
  const sign = (text, options) => kit.sign(text, { ...options, y: floorY + options.y });
  const u0 = center - width / 2;
  const u1 = center + width / 2;

  // --- The solid body (the only collider), a dark kick plate, a cap that overhangs with a glowing edge under it ---
  place(u0, 0, u1, height - 0.02, d(-0.01), d(depth), solid(colors.body), { collide: true, name: 'wearomatic_body' });
  place(u0 - 0.03, 0, u1 + 0.03, 0.16, d(0), d(depth + 0.03), solid(colors.trim)); // kick plate
  place(u0 - 0.05, height - 0.32, u1 + 0.05, height, d(0), d(depth + 0.06), solid(colors.trim)); // the cap
  place(u0 - 0.06, height - 0.34, u1 + 0.06, height - 0.32, d(0), d(depth + 0.07), glow(colors.led)); // glowing edge under it
  for (const side of [u0 - 0.012, u1]) place(side, 0.16, side + 0.012, height - 0.32, d(0.04), d(depth - 0.04), solid(colors.bodyDark));

  // --- Header: the lit name, then the tagline strip ---
  sign(wardrobeMachine.name, { x: center, y: height - 0.16, z: d(depth + 0.075), facing, width: width - 0.12, height: 0.24,
    background: '#1d1626', color: '#7dffd8', font: 'neonBlock' });
  sign(wardrobeMachine.tagline, { x: center, y: height - 0.41, z: d(depth + 0.03), facing, width: width - 0.12, height: 0.12,
    background: '#a82763', color: '#fff0f6', font: 'wayfinding' });

  // --- The window: lit, one shelf per slot (head at the top), the slot's items standing on it in their own colours ---
  const winU0 = u0 + 0.08;
  const winU1 = u1 - 0.3;
  const winY0 = 0.42;
  const winY1 = 1.86;
  place(winU0 - 0.04, winY0 - 0.04, winU1 + 0.04, winY1 + 0.04, d(depth), d(depth + 0.012), solid(colors.trim)); // frame
  place(winU0, winY0, winU1, winY1, d(depth + 0.012), d(depth + 0.025), glow(colors.glow)); // the lit back wall
  const shelf = solid(colors.metal);
  const rowHeight = (winY1 - winY0) / SLOTS.length;
  SLOTS.forEach((slot, row) => {
    const y = winY1 - (row + 1) * rowHeight; // the shelf's top
    place(winU0, y, winU1, y + 0.025, d(depth + 0.025), d(depth + 0.2), shelf);
    const items = itemsIn(slot);
    const each = (winU1 - winU0) / items.length;
    const [w, h] = spec.garment[slot];
    items.forEach((item, i) => {
      const mid = winU0 + (i + 0.5) * each;
      const material = solid(item.color, { roughness: 0.7 });
      if (slot === 'feet') { // a pair
        for (const side of [-1, 1]) place(mid + side * 0.055 - w / 2, y + 0.025, mid + side * 0.055 + w / 2, y + 0.025 + h, d(depth + 0.05), d(depth + 0.17), material);
        return;
      }
      if (slot === 'torso') place(mid - 0.07, y + 0.295, mid + 0.07, y + 0.31, d(depth + 0.09), d(depth + 0.11), solid(colors.hanger)); // its hanger, above it
      place(mid - w / 2, y + 0.025 + (slot === 'torso' ? 0.02 : 0), mid + w / 2, y + 0.025 + (slot === 'torso' ? 0.02 : 0) + h,
        d(depth + 0.07), d(depth + 0.13), material);
    });
  });

  // --- Control column: a keypad, a card reader with its LED, a coin slot; the delivery drawer at the bottom ---
  const colU0 = u1 - 0.24;
  const colU1 = u1 - 0.06;
  const colMid = (colU0 + colU1) / 2;
  place(colU0, 1.1, colU1, 1.6, d(depth), d(depth + 0.02), solid(colors.trim)); // keypad panel
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 2; c++) {
      const w = (colU1 - colU0 - 0.06) / 2;
      const ku = colU0 + 0.03 + c * w + 0.01;
      place(ku, 1.14 + r * 0.11, ku + w - 0.02, 1.14 + r * 0.11 + 0.08, d(depth + 0.02), d(depth + 0.04), solid(colors.metal));
    }
  }
  place(colU0, 0.9, colU1, 1.0, d(depth), d(depth + 0.025), solid(colors.trim)); // card reader
  place(colU0 + 0.03, 0.94, colU0 + 0.07, 0.96, d(depth + 0.025), d(depth + 0.03), glow(colors.led)); // its LED
  place(colU0 + 0.03, 0.72, colU1 - 0.03, 0.8, d(depth), d(depth + 0.02), solid(colors.slot)); // coin slot
  place(u0 + 0.12, 0.2, u1 - 0.12, 0.36, d(depth), d(depth + 0.05), solid(colors.slot)); // the delivery drawer...
  place(u0 + 0.12, 0.36, u1 - 0.12, 0.38, d(depth + 0.05), d(depth + 0.06), glow(colors.led)); // ...with a lit lip

  // --- Side signs, so it reads when you walk past along the wall ---
  for (const [u, side] of [[u0 - 0.025, 'x-'], [u1 + 0.025, 'x+']]) {
    sign('CLOTHES', { x: u, y: 1.45, z: d(depth / 2), facing: side, width: depth - 0.12, height: 0.36, background: '#a82763', color: '#fff0f6', font: 'wayfinding' });
  }

  // --- Where the player buys: on the keypad column, just in front of the machine ---
  const position = new THREE.Vector3(colMid, floorY + 1.3, d(depth + 0.04));
  const normal = new THREE.Vector3(0, 0, facing);
  return { position, normal };
}
