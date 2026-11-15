// =============================================================================
// STORES: the four Food Court shops as real walk-in rooms, each selling one gun attachment slot at a counter
// with a zombie clerk (config/upgrades.js attachments). A store is DATA (LAYOUT.stores in mall.js); this module
// turns each entry into geometry, a themed interior, the counter's buy spots and a zombie spawn inside it.
//
//   store: { id, name, slot, side 'south'|'north', from, to (x range), depth, doorWidth, theme,
//            color (facade/brand), signColor, wall (interior wall), floor (tile texture options), apron, title, titleColor }
//   side 'south': RECESSED into the Food Court's south wall (the room is behind it; the wall gets a front opening
//                 from storeOpenings() and the room is built beyond it).
//   side 'north': a POD standing against the hallway's south wall and projecting into the Food Court (the
//                 pod builds its own front wall).
// Move or resize a store by changing its entry (from/to/depth/doorWidth); everything follows.
//
// Every store has: a front of colored piers + sign + striped awning, two display windows (glass you can see
// through, solid to walking and bullets) either side of a doorway; an interior with its own floor, ceiling lights
// and walls; a full-width counter at the back (ONE solid collider: nobody reaches the clerk strip behind it)
// showing the slot's attachments; the clerk; side shelves that leave the middle walkable; and theme dressing.
//
//   storeOpenings(stores, side)        the wall openings a side's existing wall needs (south: pass to kit.wall)
//   buildStores({ kit, props, court, thickness, stores }) -> { spots, spawns, pillarsToSkip }
//     spots   [{ id (attachment), slot, zone, position, normal }]   one buy spot per attachment
//     spawns  [{ name, zone, position }]                            a zombie spawn inside each store
// =============================================================================

import * as THREE from 'three';
import { makeTileTexture } from '../../world/textures.js';
import { makeTileRoughness, makeTileBump } from '../../world/atmosphereTextures.js';
import { atmosphere } from '../../config/environment.js';
import { upgrades } from '../../config/upgrades.js';
import { storeFacades } from './storeFacades.js';

const WALL_H = 4.5; // store walls
const CEIL_Y = 4.2; // interior ceiling
const MARGIN = 0.7; // piers either side of the front opening
const OPENING_TOP = 3.3; // top of the doorway + windows (the lintel and sign band sit above it)
const SILL = 0.9; // windows start this high
const COUNTER_GAP = 1.0; // the clerk's strip between the back wall and the counter
const STRIPES = [0xf1faee]; // awning stripe color besides the store color

/** Where everything of a store is, in z (both sides): see the header. `zAt(d)` = z at distance d in from the back wall. */
export function storeRoom(store, court, T) {
  const south = store.side === 'south';
  const facingOut = south ? 1 : -1; // direction from the back wall toward the front (= out to the Food Court)
  let zOut; // outer face of the front wall
  let zIn; // inner face of the front wall
  let zBack; // inner face of the back wall
  if (south) {
    zOut = court.minZ;
    zIn = court.minZ - T;
    zBack = zIn - store.depth;
  } else {
    zBack = court.maxZ;
    zIn = court.maxZ - store.depth;
    zOut = zIn - T;
  }
  return {
    south, facingOut, zOut, zIn, zBack, cx: (store.from + store.to) / 2,
    zAt: (d) => zBack + facingOut * d,
    out: (d) => zOut + facingOut * d,
  };
}

export function storeOpening(store) {
  return { from: store.from + MARGIN, to: store.to - MARGIN, top: OPENING_TOP };
}

/** The front-wall openings of one side's stores (for the Food Court's existing south wall). */
export function storeOpenings(stores, side) {
  return stores.filter((s) => s.side === side).map(storeOpening);
}

// A pod's outside side wall, facing the court: a printed ad board, and giant alphabet blocks stacked at its foot (solid,
// vaultable: knee and waist height). store.exterior = { side 'east' | 'west', sign, blocks: [[letter, colour, z, level]] }.
const BLOCK = 0.45;
function dressExterior(kit, store, { x, sideMin, sideMax }) {
  const E = store.exterior, out = E.side === 'east' ? 1 : -1, facing = out > 0 ? 'x+' : 'x-';
  const zc = (sideMin + sideMax) / 2, span = sideMax - sideMin;
  kit.sign(E.sign, { x: x + out * 0.025, y: 2.75, z: zc, width: Math.min(3.8, span - 0.8), height: 1.25, facing, style: 'toy' })
    .name = `store_${store.id}_side_ad`;
  const stacks = new Map();
  for (const [letter, color, z, level] of E.blocks) {
    const x0 = out > 0 ? x + 0.01 : x - 0.01 - BLOCK, y0 = level * BLOCK;
    kit.box(x0, y0, z - BLOCK / 2, x0 + BLOCK, y0 + BLOCK, z + BLOCK / 2, kit.mat(color, { roughness: 0.6 }), { collide: false, name: 'toy_block' });
    kit.sign(letter, { x: out > 0 ? x0 + BLOCK + 0.006 : x0 - 0.006, y: y0 + BLOCK / 2, z, width: BLOCK * 0.8, height: BLOCK * 0.8, facing,
      background: '#fff6e6', color: '#' + color.toString(16).padStart(6, '0'), font: 'toyBody' }).name = 'toy_block_letter';
    stacks.set(z, Math.max(stacks.get(z) ?? 0, y0 + BLOCK));
  }
  for (const [z, top] of stacks) { // one collider per stack, vaultable (they're at most waist high)
    const x0 = out > 0 ? x + 0.01 : x - 0.01 - BLOCK;
    kit.addCollider(x0, 0, z - BLOCK / 2, x0 + BLOCK, top, z + BLOCK / 2).vaultable = true;
  }
}

export function buildStores({ kit, props, court, thickness: T, stores }) {
  const { box, mat, sign, addCollider, group } = kit;
  const spots = [];
  const spawns = [];
  const glass = mat(0xbfe6ef, { transparent: true, opacity: 0.3, ...atmosphere.surfaces.glass });

  for (const store of stores) {
    const room = storeRoom(store, court, T);
    const { south, facingOut, zOut, zIn, zBack, cx, zAt, out } = room;
    const { from, to, depth } = store;
    const width = to - from;
    const opening = storeOpening(store);
    const wallMat = mat(store.wall);
    const zLo = (a, b) => Math.min(a, b);
    const zHi = (a, b) => Math.max(a, b);
    // A box measured from the back wall: x0..x1, y0..y1, d0..d1 in from the back wall.
    const B = (x0, y0, d0, x1, y1, d1, material, options) => box(x0, y0, zLo(zAt(d0), zAt(d1)), x1, y1, zHi(zAt(d0), zAt(d1)), material, options);
    const S = (text, x, y, d, w, h, background, color) => sign(text, { x, y, z: zAt(d), width: w, height: h, facing: facingOut, background, color });

    // --- Floor, ceiling, walls ---------------------------------------------------
    if (south) {
      kit.tiledFloor(from - T, zBack - T, to + T, zOut, store.floor);
    } else {
      // A pod stands on the Food Court's floor: lay a colored carpet over it (visual only; offset so it never z-fights).
      const texture = makeTileTexture(store.floor);
      const roughnessMap = makeTileRoughness();
      const bumpMap = makeTileBump();
      texture.repeat.set(width / 2, depth / 2);
      roughnessMap.repeat.set(width / 2, depth / 2);
      bumpMap.repeat.set(width / 2, depth / 2);
      const tileSurf = atmosphere.surfaces.tile;
      const carpet = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.004, depth),
        new THREE.MeshStandardMaterial({
          map: texture,
          roughnessMap,
          bumpMap,
          bumpScale: tileSurf.bumpScale ?? 0.015,
          roughness: tileSurf.roughness,
          metalness: tileSurf.metalness ?? 0.06,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      carpet.position.set(cx, 0.002, (zBack + zIn) / 2);
      group.add(carpet);
    }
    // The ceiling/roof fits between the walls (sharing no face with their edges, or with the Food Court wall).
    box(from, CEIL_Y, zLo(zBack, zIn), to, WALL_H, zHi(zBack, zIn), mat(store.wall), { name: `store_${store.id}_ceiling` });
    // Side walls (and the back wall of a recessed store; a pod's back is the hallway wall).
    const sideMin = south ? zBack - T : zOut;
    const sideMax = south ? zIn : zBack;
    box(from - T, 0, sideMin, from, WALL_H, sideMax, wallMat, { name: `store_${store.id}_wall` });
    box(to, 0, sideMin, to + T, WALL_H, sideMax, wallMat, { name: `store_${store.id}_wall` });
    if (store.exterior) dressExterior(kit, store, { x: store.exterior.side === 'east' ? to + T : from - T, sideMin, sideMax });
    if (south) box(from - T, 0, zBack - T, to + T, WALL_H, zBack, wallMat, { name: `store_${store.id}_wall` });
    else B(from, 0, 0, to, CEIL_Y, 0.01, wallMat, { collide: false }); // paint the hallway wall in the store's color (1cm: things hung on it sit proud)
    // The front wall: a pod builds its own (a recessed store's is the Food Court wall, opened by storeOpenings).
    if (!south) {
      kit.wall({ along: 'x', from: from - T, to: to + T, at0: zOut, at1: zIn, height: WALL_H, openings: [opening] }, wallMat, { name: `store_${store.id}_front` });
    }
    // Display windows either side of the doorway: a solid sill, then glass (solid to walking and bullets, but see-through).
    const doorLo = cx - store.doorWidth / 2;
    const doorHi = cx + store.doorWidth / 2;
    for (const [a, b] of [[opening.from, doorLo], [doorHi, opening.to]]) {
      box(a, 0, zLo(zIn, zOut), b, SILL, zHi(zIn, zOut), mat(store.color), { name: `store_${store.id}_sill` });
      box(a, SILL, zLo(zIn, zOut) + 0.1, b, OPENING_TOP, zHi(zIn, zOut) - 0.1, glass, { name: `store_${store.id}_window` });
    }
    for (const x of [doorLo - 0.05, doorHi + 0.05]) box(x - 0.06, 0, zLo(zIn, zOut) - 0.02, x + 0.06, OPENING_TOP - 0.02, zHi(zIn, zOut) + 0.02, mat(0x3a3f47), NC); // door frame (2cm proud)

    // --- Facade (the outside of the front wall) ----------------------------------
    const F = (x0, y0, x1, y1, d0, d1, material) => box(x0, y0, zLo(out(d0), out(d1)), x1, y1, zHi(out(d0), out(d1)), material, NC);
    F(from, 0, from + MARGIN, OPENING_TOP, 0, 0.12, mat(store.color));
    F(to - MARGIN, 0, to, OPENING_TOP, 0, 0.12, mat(store.color));
    F(from, OPENING_TOP, to, WALL_H, 0, 0.12, mat(store.color));
    sign(store.name, {
      x: cx, y: 3.9, z: out(0.14), width: Math.min(width - 1.2, 5.2), height: 0.8, facing: facingOut,
      background: '#1f1a24', color: store.signColor, style: store.signStyle,
    });
    // Striped awning over the doorway and windows (no collider: you walk under it).
    const stripes = Math.round((opening.to - opening.from) / 0.5);
    const stripeW = (opening.to - opening.from) / stripes;
    for (let i = 0; i < stripes; i++) {
      const x0 = opening.from + i * stripeW;
      F(x0, 3.02, x0 + stripeW, 3.14, 0.05, 0.95, mat(i % 2 ? STRIPES[0] : store.color));
    }

    // The facade dressed as what the store sells (mall/storeFacades.js): pier decor, sign frame, roof props, a window ledge of goods.
    storeFacades[store.theme]?.({ kit, F, out, zOut, zIn, store, cx, from, to, opening, doorLo, doorHi, facingOut });

    // --- Inside: lights, counter, clerk, theme -------------------------------------
    for (const frac of [0.35, 0.75]) {
      const d = depth * frac;
      props.lightPanel(cx - 1.2, zLo(zAt(d - 0.35), zAt(d + 0.35)), cx + 1.2, zHi(zAt(d - 0.35), zAt(d + 0.35)), CEIL_Y);
    }
    if (atmosphere.roomLights.storeAccent) {
      const { intensity, distance } = atmosphere.roomLights.storeAccent;
      const storeLamp = new THREE.PointLight(store.color, intensity, distance, 2);
      storeLamp.position.set(cx, 3.2, zAt(depth * 0.65));
      group.add(storeLamp);
    }
    const items = Object.entries(upgrades.attachments)
      .filter(([, a]) => a.slot === store.slot)
      .map(([id, a]) => ({ id, name: a.name }));
    const displayed = props.attachmentDisplay({
      along: 'x', center: cx, wallAt: zBack, facing: facingOut, style: 'case', items,
      title: store.title, titleColor: store.titleColor, gap: COUNTER_GAP, width,
      capTo: CEIL_Y, // (nobody hops over the counter from a display prop: the clerk's strip has no way out, and no zombie can follow)
    });
    for (const s of displayed) spots.push({ ...s, slot: store.slot, zone: 'foodCourt' });
    props.clerk({ along: 'x', center: cx, wallAt: zBack, facing: facingOut, depth: 0.5, apron: store.apron });

    const room2 = { x0: from, x1: to, width, depth, cx, B, S, M: mat, box, addCollider, group, zAt };
    THEMES[store.theme](room2);

    // A zombie spawn just inside the door, in front of the counter (zombies burst out of the store).
    spawns.push({
      name: `spawn_foodCourt_${store.id}`, zone: 'foodCourt',
      position: new THREE.Vector3(cx, 0, zAt(depth - 1.0)),
    });
  }
  return { spots, spawns };
}

// ----- Theme dressing: each gets { x0, x1, width, depth, cx, B, S, M, box, addCollider, group, zAt } -----
// Side shelves run along both side walls from d 1.9 (past the counter) to depth - 1.2 (a clear door end), solid.

function sideShelves(r, color, height = 1.7) {
  for (const x of [r.x0, r.x1 - 0.5]) r.B(x, 0, 1.9, x + 0.5, height, r.depth - 1.2, r.M(color));
}

const glowing = (color) => new THREE.MeshBasicMaterial({ color });

function mesh(group, geometry, material, x, y, z, rotation = [0, 0, 0]) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.rotation.set(...rotation);
  group.add(m);
  return m;
}

const NC = { collide: false };

const THEMES = {
  // Blue demo-wall electronics: a wall of screens, CRT TV stacks, vintage beige PC towers, shelves of glowing laptops, neon.
  byteMe(r) {
    const { B, S, M, cx } = r;
    [['BYTE ME', '#0b1d3a', '#63b3ff'], ['LOADING...', '#102a1a', '#63ff9b'], ['NO SIGNAL', '#2a0b2a', '#ff7bd5']]
      .forEach(([text, bg, fg], i) => S(text, cx + (i - 1) * 1.9, 2.4, 0.03, 1.5, 0.95, bg, fg));
    B(r.x0, 3.92, 0.02, r.x1, 3.99, 0.07, glowing(0x63e6ff), NC); // neon strip
    sideShelves(r, 0x2c3a5c);
    const screens = [glowing(0x63b3ff), glowing(0x63ff9b), glowing(0xff7bd5)];
    const crtCase = M(0x232834);
    const beigePc = M(0xd8d2c2);
    const darkSlot = M(0x1d1626);
    [r.x0, r.x1 - 0.5].forEach((sx, side) => {
      for (let i = 0, d = 2.2; d < r.depth - 1.5; i++, d += 0.7) {
        B(sx + 0.1, 1.7, d, sx + 0.4, 1.75, d + 0.3, darkSlot, NC); // laptop base
        B(sx + 0.12, 1.75, d + 0.1, sx + 0.38, 2.05, d + 0.13, screens[(i + side) % 3], NC); // lit screen
      }
      // Vintage beige PC tower at the front end of each shelf
      const td = r.depth - 1.52;
      B(sx + 0.08, 1.7, td, sx + 0.42, 2.18, td + 0.24, beigePc, NC);
      B(sx + 0.12, 2.04, td + 0.24, sx + 0.38, 2.08, td + 0.252, darkSlot, NC); // floppy bay
      B(sx + 0.12, 1.96, td + 0.24, sx + 0.38, 2.0, td + 0.252, darkSlot, NC); // CD-ROM bay
      B(sx + 0.34, 1.86, td + 0.24, sx + 0.37, 1.89, td + 0.255, screens[1], NC); // power LED
    });
    // Bulky CRT TV stacks flanking the clerk behind the counter
    [r.x0 + 0.28, r.x1 - 0.82].forEach((tx, side) => {
      B(tx, 0, 0.12, tx + 0.54, 0.72, 0.48, M(0x1b2234), NC); // TV stand plinth
      for (const [tier, y0] of [0.72, 1.22].entries()) {
        const inset = tier * 0.03;
        B(tx + 0.03 + inset, y0, 0.15 + inset, tx + 0.51 - inset, y0 + 0.48, 0.45 - inset, crtCase, NC); // CRT shell
        B(tx + 0.07 + inset, y0 + 0.06, 0.45 - inset, tx + 0.43 - inset, y0 + 0.42, 0.465 - inset, screens[(side + tier) % 3], NC); // glowing CRT tube
      }
    });
  },

  // Wood floor, a bat rack, a bin of balls, sneaker & shoebox rack, jerseys and a trophy shelf.
  goodSports(r) {
    const { B, S, M, cx, group, zAt } = r;
    B(r.x0, 0, 0.02, r.x1, 0.9, 0.06, M(0xff8a3d), NC); // orange wainscot
    for (const x of [r.x0, r.x1 - 0.03]) B(x, 0, 0, x + 0.03, 0.9, r.depth, M(0xff8a3d), NC);
    [['07', '#d62839'], ['23', '#3a86ff'], ['99', '#2d6a4f']].forEach(([n, bg], i) => S(n, cx + (i - 1) * 1.6, 2.4, 0.03, 0.95, 1.15, bg, '#ffffff'));
    B(cx - 1.4, 3.1, 0.03, cx + 1.4, 3.16, 0.4, M(0x6e4a26), NC); // trophy shelf
    for (let i = 0; i < 5; i++) B(cx - 1.2 + i * 0.6, 3.16, 0.1, cx - 1.04 + i * 0.6, 3.34 + (i % 2) * 0.1, 0.26, M(0xffd23f), NC); // trophies
    // Bat rack on the west side: a base and tilted bats.
    B(r.x0, 0, 2.0, r.x0 + 0.45, 0.95, 3.8, M(0x6e4a26));
    const bat = new THREE.CylinderGeometry(0.035, 0.055, 1.3, 8);
    for (let i = 0; i < 6; i++) mesh(group, bat, M(i % 2 ? 0xc79a62 : 0x8a5a2b), r.x0 + 0.22, 1.5, zAt(2.2 + i * 0.27), [0, 0, 0.16]);
    // East wall sneaker & shoebox display shelf behind the ball bin
    B(r.x1 - 0.45, 0, 1.95, r.x1 - 0.04, 1.45, 2.55, M(0x6e4a26), NC);
    for (const [i, boxColor] of [0xd62839, 0x3a86ff, 0xff8a3d].entries()) {
      const d0 = 2.0 + i * 0.17;
      B(r.x1 - 0.39, 1.45, d0, r.x1 - 0.1, 1.58, d0 + 0.14, M(boxColor), NC); // shoebox
      B(r.x1 - 0.37, 1.58, d0 + 0.01, r.x1 - 0.12, 1.61, d0 + 0.13, M(0xf1faee), NC); // shoebox lid
    }
    // Ball bin on the east side: a drum with balls heaped on top.
    const bx = r.x1 - 0.6;
    const bz = zAt(3.2);
    mesh(group, new THREE.CylinderGeometry(0.5, 0.5, 0.8, 12), M(0x3a86ff), bx, 0.4, bz);
    r.addCollider(bx - 0.5, 0, Math.min(bz - 0.5, bz + 0.5), bx + 0.5, 0.8, Math.max(bz - 0.5, bz + 0.5));
    const ball = new THREE.SphereGeometry(0.13, 8, 6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      mesh(group, ball, M(i % 3 === 0 ? 0xf1faee : i % 3 === 1 ? 0xff8a3d : 0xd62839), bx + Math.cos(a) * 0.3, 0.9, bz + Math.sin(a) * 0.3);
    }
    mesh(group, ball, M(0xff8a3d), bx, 1.0, bz);
  },

  // Pastel floor, a rainbow, shelves of plush toys, retro toy robots behind the counter, and scattered letter blocks.
  playTimeToys(r) {
    const { B, S, M, cx } = r;
    S('PLAY TIME!', cx, 2.5, 0.03, 3.2, 0.75, '#ff7bd5', '#ffffff');
    [0xe63946, 0xff8a3d, 0xffd23f, 0x63e6be, 0x3a86ff, 0xb36bff].forEach((c, i) => B(r.x0 + 0.2, 3.1 + i * 0.12, 0.02, r.x1 - 0.2, 3.22 + i * 0.12, 0.06, M(c), NC));
    sideShelves(r, 0xffffff, 1.6);
    const fur = [0xc79a62, 0xff9ec7, 0xffd23f, 0x9fe3ff, 0xb36bff];
    let k = 0;
    for (const sx of [r.x0, r.x1 - 0.5]) {
      for (let d = 2.1; d < r.depth - 1.5; d += 0.55, k++) {
        const c = fur[k % fur.length];
        B(sx + 0.1, 1.6, d, sx + 0.4, 1.9, d + 0.35, M(c), NC); // teddy body
        B(sx + 0.14, 1.9, d + 0.03, sx + 0.36, 2.12, d + 0.32, M(c), NC); // head
        B(sx + 0.12, 2.12, d + 0.03, sx + 0.2, 2.2, d + 0.11, M(c), NC); // ears
        B(sx + 0.3, 2.12, d + 0.24, sx + 0.38, 2.2, d + 0.32, M(c), NC);
      }
    }
    // Giant retro blocky toy robots flanking the clerk behind the counter
    [r.x0 + 0.35, r.x1 - 0.75].forEach((rx, side) => {
      const bodyCol = M(side === 0 ? 0x3a86ff : 0xe63946);
      const accentCol = M(0xffd23f);
      B(rx, 0, 0.14, rx + 0.4, 0.65, 0.44, accentCol, NC); // display box pedestal
      B(rx + 0.06, 0.65, 0.18, rx + 0.17, 1.02, 0.38, bodyCol, NC); // left leg
      B(rx + 0.23, 0.65, 0.18, rx + 0.34, 1.02, 0.38, bodyCol, NC); // right leg
      B(rx + 0.03, 1.02, 0.16, rx + 0.37, 1.48, 0.4, bodyCol, NC); // robot torso
      B(rx + 0.08, 1.14, 0.4, rx + 0.32, 1.38, 0.42, accentCol, NC); // chest plate
      B(rx + 0.09, 1.48, 0.2, rx + 0.31, 1.72, 0.38, bodyCol, NC); // robot head
      B(rx + 0.12, 1.56, 0.38, rx + 0.28, 1.64, 0.395, glowing(0x63e6be), NC); // glowing visor eyes
    });
    // Letter blocks near the door end (low enough to step over: no collider).
    [[r.x0 + 0.9, r.depth - 1.0, 0xe63946], [r.x0 + 1.25, r.depth - 0.8, 0x3a86ff], [r.x1 - 1.0, r.depth - 1.0, 0xffd23f], [r.x1 - 1.4, r.depth - 1.25, 0x63e6be]]
      .forEach(([x, d, c]) => B(x, 0, d, x + 0.28, 0.28, d + 0.28, M(c), NC));
  },

  // Pegboard wall of tools, paint-can shelves, a workbench with a vise, toolboxes, and stacked hardware cartons.
  nutsAndBolts(r) {
    const { B, S, M, cx } = r;
    const wood = M(0x6e4a26);
    const steel = M(0x9aa3ad);
    const redTool = M(0xd62839);
    const cordOrange = M(0xff8a3d);
    B(r.x0 + 0.3, 1.75, 0.02, r.x1 - 0.3, 3.6, 0.07, M(0xc79a62), NC); // pegboard
    const n = Math.floor((r.width - 1.2) / 1.0);
    for (let i = 0; i < n; i++) {
      const x = r.x0 + 0.9 + i * 1.0;
      if (i % 3 === 2) { // a wrench
        B(x, 1.95, 0.07, x + 0.05, 2.7, 0.1, steel, NC);
        B(x - 0.05, 2.7, 0.07, x + 0.1, 2.82, 0.1, steel, NC);
      } else { // a hammer
        B(x, 1.95, 0.07, x + 0.05, 2.6, 0.1, wood, NC);
        B(x - 0.08, 2.55, 0.07, x + 0.13, 2.67, 0.13, steel, NC);
      }
      // Coiled orange extension cord / circular saw blade hung high on the pegboard
      B(x + 0.36, 2.95, 0.07, x + 0.62, 3.35, 0.11, i % 2 ? cordOrange : steel, NC);
    }
    S('MEASURE TWICE · CURSE ONCE', cx, 3.85, 0.03, 4.2, 0.35, '#1f1a24', '#ffd23f');
    // West: shelves of paint cans.
    r.B(r.x0, 0, 1.9, r.x0 + 0.5, 1.8, r.depth - 1.2, M(0x5b636d));
    const cans = [0xd62839, 0xffd23f, 0x3a86ff, 0x2d6a4f];
    for (let i = 0, d = 2.0; d < r.depth - 1.5; i++, d += 0.45) B(r.x0 + 0.12, 1.8, d, r.x0 + 0.38, 2.05, d + 0.26, M(cans[i % cans.length]), NC);
    // East: a workbench with a vise and a mechanic's red tool chest.
    B(r.x1 - 0.9, 0, 2.2, r.x1, 0.95, r.depth - 2.0, wood);
    B(r.x1 - 0.55, 0.95, 2.6, r.x1 - 0.25, 1.15, 2.9, M(0x3a3f47), NC); // vise
    B(r.x1 - 0.68, 0.95, 3.2, r.x1 - 0.14, 1.32, 3.82, redTool, NC); // red mechanics tool chest
    for (const dy of [1.02, 1.12, 1.22]) B(r.x1 - 0.7, dy, 3.26, r.x1 - 0.68, dy + 0.05, 3.76, steel, NC); // chrome drawer pulls
  },
};
