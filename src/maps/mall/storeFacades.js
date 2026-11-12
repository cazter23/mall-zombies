// =============================================================================
// STORE FACADES: the outside of each Food Court store (mall/stores.js) dressed as what it sells, so a store reads as GOOD
// SPORTS, NUTS & BOLTS, PLAY TIME TOYS or BYTE ME ELECTRONICS from across the court, not as a coloured box with a name.
// Decoration only (nothing collides), hung at least 2 cm proud of the facade (the z-fight rule), and the doorway lane stays clear.
// A facade gets c = { kit, F, out, zOut, store, cx, from, to, opening, doorLo, doorHi, facingOut }:
//   F(x0, y0, x1, y1, d0, d1, material)   a box measured OUT from the facade wall (d 0.12 = the facade's face)
//   out(d)                                the z that is d metres out from the wall; facingOut = +1 / -1 (the court side)
//   pier x ranges: [from, from + 0.7] and [to - 0.7, to], 3.3 m tall; the sign sits at y 3.9 (3.5..4.3); awning y 3.02..3.14.
// Each also puts a WINDOW LEDGE (a 0.38 m shelf on the sill) with that store's goods in front of each window.
// =============================================================================
import * as THREE from 'three';

const PIER = 0.7;     // stores.js MARGIN
const LEDGE_D = 0.38; // how far the window ledge sticks out
const LEDGE_Y = 0.9;  // the sill's top

const glow = (color) => new THREE.MeshBasicMaterial({ color });

/** A flat decoration box measured out from the wall. */
function Fb(c, x0, y0, x1, y1, d0, d1, color, material) {
  return c.F(x0, y0, x1, y1, d0, d1, material ?? c.kit.mat(color));
}

/** The frame round the name sign: four bars just outside its rectangle (sign y 3.5..4.3, width as stores.js). */
function signFrame(c, color, { t = 0.06, reach = 0.2 } = {}) {
  const w = Math.min(c.to - c.from - 1.2, 5.2);
  const x0 = c.cx - w / 2 - reach, x1 = c.cx + w / 2 + reach;
  const m = c.kit.mat(color);
  c.F(x0, 3.4, x1, 3.4 + t, 0.12, 0.18, m);
  c.F(x0, 4.4 - t, x1, 4.4, 0.12, 0.18, m);
  c.F(x0, 3.4, x0 + t, 4.4, 0.12, 0.18, m);
  c.F(x1 - t, 3.4, x1, 4.4, 0.12, 0.18, m);
  return { x0, x1 };
}

/** Flags along the awning's front edge (above head height, y 2.84..3.02), cycling the given colours. */
function bunting(c, colors) {
  const mats = colors.map((k) => c.kit.mat(k));
  for (let x = c.opening.from + 0.05, k = 0; x < c.opening.to - 0.2; x += 0.26, k++) c.F(x, 2.84, x + 0.18, 3.02, 0.95, 0.97, mats[k % mats.length]);
}

/** The window ledge on each side of the door: calls goods(group, x, y, z, i, window) for each slot along it. */
function ledges(c, color, pitch, goods) {
  const { kit, zOut, out, facingOut, doorLo, doorHi, opening } = c;
  const zLo = Math.min(zOut, out(LEDGE_D)), zHi = Math.max(zOut, out(LEDGE_D));
  const m = kit.mat(color);
  [[opening.from, doorLo], [doorHi, opening.to]].forEach(([a, b], w) => {
    kit.box(a, LEDGE_Y - 0.06, zLo, b, LEDGE_Y, zHi, m, { collide: false });
    const n = Math.max(1, Math.floor((b - a - 0.3) / pitch));
    const step = (b - a) / n;
    for (let i = 0; i < n; i++) goods(kit.group, a + step * (i + 0.5), LEDGE_Y, zOut + facingOut * LEDGE_D / 2, i + w * 3, w);
  });
}

function put(group, geometry, material, x, y, z, rotation = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.rotation.set(...rotation);
  mesh.scale.set(...scale);
  group.add(mesh);
  return mesh;
}

// ---------------------------------------------------------------------------------------------------------------------

/** GOOD SPORTS: a jersey and a stadium. Racing stripes and jersey-number plaques on the piers, a navy-and-white sign frame,
 *  pennant bunting, and a window ledge of balls. */
function goodSports(c) {
  const { kit, from, to, cx, out, facingOut } = c;
  const navy = 0x14284b, white = 0xf4f1e8;
  for (const px of [from, to - PIER]) {
    Fb(c, px + 0.08, 0.05, px + 0.18, 1.9, 0.12, 0.14, white);
    Fb(c, px + 0.18, 0.05, px + 0.5, 1.9, 0.12, 0.14, navy);
    Fb(c, px + 0.5, 0.05, px + 0.6, 1.9, 0.12, 0.14, white);
  }
  [['07', from, '#d62839'], ['23', to - PIER, '#3a86ff']].forEach(([n, px, bg]) => {
    kit.sign(n, { x: px + PIER / 2, y: 2.5, z: out(0.15), width: 0.52, height: 0.7, facing: facingOut, background: bg, color: '#ffffff', style: 'varsity' });
  });
  signFrame(c, white);
  Fb(c, cx - 0.9, 4.42, cx + 0.9, 4.48, 0.12, 0.17, navy);
  bunting(c, [0xff8a3d, white, navy]);
  const colors = [0xff8a3d, white, 0x8a4b25, 0xffd23f, 0x2d6a4f];
  const ball = new THREE.SphereGeometry(0.13, 10, 8);
  ledges(c, navy, 0.34, (g, x, y, z, i) => put(g, ball, kit.mat(colors[i % colors.length], { roughness: 0.6 }), x, y + 0.13, z + (i % 2 ? 0.05 : -0.05)));
}

/** NUTS & BOLTS: a workshop. Hazard bands on the piers, a riveted steel sign plate with a hazard strip, a giant hex nut and an
 *  open-end wrench on the roof, and a window ledge of paint cans and toolboxes. */
function nutsAndBolts(c) {
  const { kit, from, to, cx, out, facingOut } = c;
  const yellow = 0xffd23f, black = 0x1b1d21, steel = 0x9aa3ad;
  for (const px of [from, to - PIER]) {
    for (let k = 0; k < 6; k++) Fb(c, px + 0.08, 0.05 + k * 0.2, px + PIER - 0.08, 0.25 + k * 0.2, 0.12, 0.145, k % 2 ? black : yellow);
    Fb(c, px + 0.02, 1.3, px + 0.08, 3.25, 0.12, 0.15, steel);
    Fb(c, px + PIER - 0.08, 1.3, px + PIER - 0.02, 3.25, 0.12, 0.15, steel);
  }
  const { x0, x1 } = signFrame(c, steel, { t: 0.08, reach: 0.22 });
  for (let x = x0 + 0.15; x < x1 - 0.1; x += 0.45) {
    for (const y of [3.435, 4.365]) Fb(c, x - 0.03, y - 0.03, x + 0.03, y + 0.03, 0.18, 0.2, 0xc8d0d8);
  }
  const strip = (x) => Fb(c, x, 3.3, x + 0.2, 3.38, 0.12, 0.14, Math.round((x - c.opening.from) / 0.2) % 2 ? black : yellow);
  for (let x = c.opening.from; x < c.opening.to - 0.19; x += 0.2) strip(x);
  // roof: a giant hex nut (a hexagonal drum with a dark bore) and an open-end wrench
  const nutX = from + 1.4, nutY = 4.5 + 0.48;
  put(kit.group, new THREE.CylinderGeometry(0.48, 0.48, 0.28, 6), kit.mat(0xc2c8d0, { metalness: 0.5, roughness: 0.4 }), nutX, nutY, out(0.4), [Math.PI / 2, 0, 0]);
  put(kit.group, new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14), kit.mat(0x2a2d33), nutX, nutY, out(0.4), [Math.PI / 2, 0, 0]);
  const wr = kit.mat(0xb8c0c9, { metalness: 0.5, roughness: 0.4 });
  const wx = to - 1.1;
  Fb(c, wx - 2.0, 4.62, wx, 4.78, 0.12, 0.3, 0, wr);        // handle
  Fb(c, wx, 4.5, wx + 0.14, 4.9, 0.12, 0.3, 0, wr);          // jaw back
  Fb(c, wx, 4.78, wx + 0.6, 4.9, 0.12, 0.3, 0, wr);          // upper jaw
  Fb(c, wx, 4.5, wx + 0.6, 4.62, 0.12, 0.3, 0, wr);          // lower jaw
  const cans = [0xd62839, 0xffd23f, 0x3a86ff, 0x2d6a4f];
  const can = new THREE.CylinderGeometry(0.09, 0.09, 0.2, 10);
  ledges(c, 0x5b636d, 0.3, (g, x, y, z, i) => {
    if (i % 3 === 2) { // a red toolbox with a grey handle
      put(g, new THREE.BoxGeometry(0.3, 0.17, 0.2), kit.mat(0xd62839), x, y + 0.085, z);
      put(g, new THREE.BoxGeometry(0.16, 0.03, 0.04), kit.mat(0x6c7480), x, y + 0.19, z);
    } else {
      put(g, can, kit.mat(cans[i % cans.length]), x, y + 0.1, z + 0.04);
      put(g, can, kit.mat(cans[(i + 1) % cans.length]), x, y + 0.3, z + 0.04);
    }
  });
}

/** PLAY TIME TOYS: a toy box. Rainbow stripes on the piers, a pink sign frame, giant T-O-Y blocks and balloon clusters on the roof,
 *  a garland of coloured beads under the awning, and plush bears on the window ledge. */
function playTimeToys(c) {
  const { kit, from, to, cx, out, facingOut } = c;
  const rainbow = [0xe63946, 0xff8a3d, 0xffd23f, 0x63e6be, 0x3a86ff, 0xb36bff];
  for (const px of [from, to - PIER]) rainbow.forEach((k, i) => Fb(c, px + 0.06 + i * 0.1, 0.1, px + 0.16 + i * 0.1, 3.2, 0.12, 0.14, k));
  signFrame(c, 0xff7bd5, { t: 0.08, reach: 0.22 });
  bunting(c, rainbow);
  // roof: three alphabet blocks
  [['T', 0xe63946, -0.7], ['O', 0x3a86ff, 0], ['Y', 0x63e6be, 0.7]].forEach(([letter, color, d0]) => {
    const dx = d0 * facingOut; // (read left to right from the court, whichever wall the store stands on)
    Fb(c, cx + dx - 0.3, 4.5, cx + dx + 0.3, 5.1, 0.12, 0.72, color);
    kit.sign(letter, { x: cx + dx, y: 4.8, z: out(0.72) + facingOut * 0.006, width: 0.46, height: 0.46, facing: facingOut,
      background: '#fff6e6', color: '#' + color.toString(16).padStart(6, '0'), font: 'toyBody' });
  });
  // roof: two balloon clusters with strings
  const balloon = new THREE.SphereGeometry(0.2, 12, 10);
  [[from + 0.2, 1], [to - 0.2, -1]].forEach(([bx, dir]) => {
    rainbow.slice(0, 5).forEach((k, i) => {
      const x = bx + dir * (i % 2 ? 0.14 : -0.12) * (1 + (i >> 1) * 0.3), y = 5.2 + (i % 3) * 0.2;
      put(kit.group, balloon, kit.mat(k, { roughness: 0.3 }), x, y, out(0.4 + (i % 2) * 0.1), [0, 0, 0], [1, 1.25, 1]);
      Fb(c, x - 0.005, 4.5, x + 0.005, y - 0.22, 0.38 + (i % 2) * 0.1, 0.39 + (i % 2) * 0.1, 0xffffff);
    });
  });
  const fur = [0xc79a62, 0xff9ec7, 0xffd23f, 0x9fe3ff, 0xb36bff];
  ledges(c, 0xfff1a8, 0.36, (g, x, y, z, i) => {
    const m = kit.mat(fur[i % fur.length]);
    put(g, new THREE.BoxGeometry(0.22, 0.24, 0.16), m, x, y + 0.12, z);
    put(g, new THREE.BoxGeometry(0.17, 0.16, 0.14), m, x, y + 0.32, z);
    for (const s of [-1, 1]) put(g, new THREE.BoxGeometry(0.06, 0.06, 0.05), m, x + s * 0.08, y + 0.43, z);
  });
}

/** BYTE ME ELECTRONICS: a CRT arcade. Dark pier panels with glowing circuit lines and a pixel space invader each, a neon-cyan
 *  sign frame, a satellite dish and a TV aerial on the roof, and a window ledge of glowing monitors. */
function byteMe(c) {
  const { kit, from, to, cx, out, facingOut } = c;
  const cyan = 0x63e6ff;
  const INVADER = ['..#.....#..', '...#...#...', '..#######..', '.##.###.##.', '###########', '#.#######.#', '#.#.....#.#', '...##.##...'];
  [[from, 0x63ff9b], [to - PIER, 0xff7bd5]].forEach(([px, color]) => {
    Fb(c, px + 0.05, 0.2, px + PIER - 0.05, 3.2, 0.12, 0.135, 0x0f1626);
    for (const x of [px + 0.12, px + PIER - 0.14]) Fb(c, x, 0.3, x + 0.02, 1.9, 0.135, 0.15, 0, glow(cyan));
    for (const y of [0.6, 1.2, 1.7]) Fb(c, px + 0.12, y, px + PIER - 0.12, y + 0.02, 0.135, 0.15, 0, glow(cyan));
    INVADER.forEach((row, ry) => [...row].forEach((ch, rx) => {
      if (ch === '#') Fb(c, px + 0.075 + rx * 0.05, 2.7 - ry * 0.05, px + 0.125 + rx * 0.05, 2.75 - ry * 0.05, 0.135, 0.15, 0, glow(color));
    }));
  });
  // neon frame round the sign
  const w = Math.min(to - from - 1.2, 5.2);
  const x0 = cx - w / 2 - 0.2, x1 = cx + w / 2 + 0.2, t = 0.03;
  const neon = glow(cyan);
  c.F(x0, 3.4, x1, 3.4 + t, 0.12, 0.16, neon);
  c.F(x0, 4.4 - t, x1, 4.4, 0.12, 0.16, neon);
  c.F(x0, 3.4, x0 + t, 4.4, 0.12, 0.16, neon);
  c.F(x1 - t, 3.4, x1, 4.4, 0.12, 0.16, neon);
  bunting(c, [0x63e6ff, 0x1d2a4a]);
  // roof: a satellite dish tilted to the court, and a TV aerial
  const dish = new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  put(kit.group, dish, kit.mat(0xdfe6ee, { side: THREE.DoubleSide, roughness: 0.4 }), to - 1.1, 5.0, out(0.45), [facingOut * Math.PI / 3, 0, 0]);
  Fb(c, to - 1.12, 4.5, to - 1.08, 4.95, 0.4, 0.44, 0x6c7480);
  Fb(c, to - 1.12, 4.9, to - 1.08, 5.1, 0.55, 0.59, 0x6c7480);
  Fb(c, from + 0.9, 4.5, from + 0.93, 5.5, 0.4, 0.43, 0x6c7480);
  for (const [y, half] of [[5.1, 0.3], [5.3, 0.24], [5.45, 0.16]]) Fb(c, from + 0.915 - half, y, from + 0.915 + half, y + 0.025, 0.4, 0.43, 0x6c7480);
  const screens = [glow(0x63b3ff), glow(0x63ff9b), glow(0xff7bd5)];
  ledges(c, 0x232834, 0.4, (g, x, y, z, i) => {
    put(g, new THREE.BoxGeometry(0.32, 0.27, 0.22), kit.mat(0x232834), x, y + 0.135, z);
    put(g, new THREE.BoxGeometry(0.25, 0.2, 0.01), screens[i % 3], x, y + 0.145, z + facingOut * 0.116);
  });
}

export const storeFacades = { goodSports, nutsAndBolts, playTimeToys, byteMe };
