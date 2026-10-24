// =============================================================================
// THE OTHER AREAS' LOOKS (visual overhaul, "Grand Opening, Forever", after the approved hallway): each area dressed with
// the shared look kit (lookKit.js) from its entry in config/look.js: pastel wall bands, paint panels over walls it borrows
// from a neighbour, neon signs / slogans / trim, painted light, the corporate-cheer posters, clutter. Decoration only.
// Front of house is bright and cheerful; back of house (the Service Corridor, stockrooms) is where it gets dark.
// =============================================================================

import { look } from '../../config/look.js';

// A 1 cm paint panel over the face of a wall the area shares with a neighbour (whose paint is on both faces), with holes for
// its openings. along 'x': a wall at z = wallAt; 'z': a wall at x = wallAt. holes: [{ from, to, top }] (top = the opening's height).
function paintPanel(kit, { along, from, to, wallAt, facing, height, holes = [], color, name }) {
  const material = kit.mat(color);
  const d0 = wallAt;
  const d1 = wallAt + facing * 0.01;
  const piece = (u0, u1, y0, y1) => {
    if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
    if (along === 'x') kit.box(u0, y0, Math.min(d0, d1), u1, y1, Math.max(d0, d1), material, { collide: false, name });
    else kit.box(Math.min(d0, d1), y0, u0, Math.max(d0, d1), y1, u1, material, { collide: false, name });
  };
  let cursor = from;
  for (const h of [...holes].sort((a, b) => a.from - b.from)) {
    piece(cursor, h.from, 0, height);
    piece(h.from, h.to, h.top ?? height, height); // (over the opening, up to the ceiling)
    cursor = h.to;
  }
  piece(cursor, to, 0, height);
}

/** The Food Court: peach / teal / coral, FRESH MEAT DAILY over the stalls, the health inspection and the BRAINS COMBO. */
export function buildFoodCourtLook({ looks, kit, layout, keepClear = [] }) {
  const L = look.foodCourt;
  const F = layout.foodCourt;
  const FD = layout.foodCourtDoorway;
  const FM = layout.foodCourtMegaMartDoorway;
  const SF = layout.serviceCorridorFoodCourtDoorway;
  const pods = layout.stores.filter((s) => s.side === 'north').map((s) => [s.from - 0.2, s.to + 0.2]);
  const restock = [layout.restockMachine.x - 1.35, layout.restockMachine.x + 1.35];
  const colors = { wainscot: L.wainscot, rail: L.rail, band: L.band };

  // Borrowed walls: the north one is the hallway's (mint), the east one the Mega Mart's (white). Paint the Food Court's faces.
  paintPanel(kit, {
    along: 'x', from: F.minX, to: F.maxX, wallAt: F.maxZ, facing: -1, height: F.height, color: L.wall, name: 'foodcourt_paint',
    holes: [{ from: FD.minX, to: FD.maxX, top: FD.height }, ...pods.map(([a, b]) => ({ from: a, to: b, top: F.height }))],
  });
  paintPanel(kit, {
    along: 'z', from: F.minZ, to: F.maxZ, wallAt: F.maxX, facing: -1, height: F.height, color: L.wall, name: 'foodcourt_paint',
    holes: [{ from: FM.minZ, to: FM.maxZ, top: FM.height }],
  });

  // Wall bands: north (round the door, the RESTOCK-O-MATIC and the pods), west (the corridor shortcut), east (the Mart
  // shortcut) and the two short ends of the south wall (the rest is stores and stalls).
  looks.bands({ along: 'x', from: F.minX, to: F.maxX, wallAt: F.maxZ - 0.01, facing: -1, colors, gaps: [[FD.minX, FD.maxX], restock, ...pods], name: 'foodcourt_wainscot' });
  looks.bands({ along: 'z', from: F.minZ, to: F.maxZ, wallAt: F.minX, facing: 1, colors, gaps: [[SF.minZ, SF.maxZ]], name: 'foodcourt_wainscot' });
  looks.bands({ along: 'z', from: F.minZ, to: F.maxZ, wallAt: F.maxX - 0.01, facing: -1, colors, gaps: [[FM.minZ, FM.maxZ]], name: 'foodcourt_wainscot' });
  looks.bands({ along: 'x', from: F.minX, to: F.maxX, wallAt: F.minZ, facing: 1, colors, gaps: [[-17.2, 17.2]], name: 'foodcourt_wainscot' });

  // Neon: FRESH MEAT DAILY over the stalls; the slogans over the north wall; orange trim round three walls.
  const neon = looks.neon('foodCourt');
  const S = L.signs;
  const sat = L.satire;
  const backing = look.hallway.backing;
  const north = F.maxZ - 0.05;
  const south = F.minZ + 0.04;
  neon.sign({ text: sat.meat, x: 0, y: 5.15, z: south, facing: 1, height: 0.5, color: S.meat, backing, border: L.trim, flickerLetters: [6, 7, 8, 9] });
  neon.sign({ text: sat.eat, x: -7, y: 4.4, z: north, facing: -1, height: 0.36, color: S.eat, backing });
  neon.sign({ text: sat.refills, x: 8.4, y: 4.4, z: north, facing: -1, height: 0.36, color: S.refills, backing, flickerLetters: [12] });
  const tY = L.trimY;
  neon.tube([[F.minX + 0.4, tY, north], [-0.6, tY, north]], { color: L.trim });
  neon.tube([[0.6, tY, north], [F.maxX - 0.4, tY, north]], { color: L.trim, flicker: true });
  neon.tube([[F.minX + 0.04, tY, F.maxZ - 0.4], [F.minX + 0.04, tY, F.minZ + 0.4]], { color: L.trim });
  neon.tube([[F.maxX - 0.05, tY, F.maxZ - 0.4], [F.maxX - 0.05, tY, F.minZ + 0.4]], { color: L.trim, dead: true }); // (one wall's tube is dead)

  // Painted light behind the signs and on the floor.
  const P = look.hallway.pools;
  looks.pool(0, 5.15, F.minZ + 0.021, 9, 2.0, 1, S.meat, P.wallOpacity);
  looks.pool(0, 0.012, F.minZ + 3.2, 10, 2.5, 'floor', S.meat, P.floorOpacity * 0.8);
  looks.pool(-7, 4.4, F.maxZ - 0.021, 7, 1.6, -1, S.eat, P.wallOpacity);
  looks.pool(8.4, 4.4, F.maxZ - 0.021, 5, 1.6, -1, S.refills, P.wallOpacity);
  looks.pool(0, tY - 0.45, F.maxZ - 0.016, F.maxX - F.minX - 1, 0.9, -1, L.trim, P.trimOpacity, { wash: true });

  // The corporate cheer on paper.
  const onNorth = F.maxZ - 0.04;
  looks.poster('notice', { title: sat.inspection[0], body: sat.inspection[1], header: '#7fd3a8' }, -6.6, 2.15, onNorth, 1.2, 0.9, -1);
  looks.poster('notice', { title: sat.refillsSmall[0], body: sat.refillsSmall[1], header: '#c9b6e4' }, 8.4, 2.1, onNorth, 1.0, 0.75, -1);
  looks.poster('banner', { text: sat.combo[0], sub: sat.combo[1], colors: ['#ffd1a1', '#ff9ec7'] }, F.maxX - 0.04, 2.6, -4.1, 3.0, 0.8, 'x-');
  looks.poster('sunny', { text: sat.seat[0], sub: sat.seat[1] }, F.minX + 0.03, 2.2, -3.4, 1.0, 1.5, 'x+');

  // Clutter: cups, popcorn, soda spills... (never the door lane, the queues at the stalls, spawns or buy spots).
  looks.clutter({
    name: 'foodCourt', area: { minX: F.minX + 0.3, maxX: F.maxX - 0.3, minZ: F.minZ + 0.3, maxZ: F.maxZ - 0.3, y: 0 },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter,
    keepClear: [
      ...keepClear,
      { minX: FD.minX - 0.5, maxX: FD.maxX + 0.5, minZ: F.maxZ - 6, maxZ: F.maxZ }, // the door lane
      { minX: -8.6, maxX: 8.6, minZ: F.minZ, maxZ: -11.4 }, // the stall counters and their queues
    ],
  });
}

/** The Mega Mart: cool white and brand blue, LOW PRICES. LOWER STANDARDS. over the checkouts, a dying red tube at the back. */
export function buildMegaMartLook({ looks, layout, keepClear = [] }) {
  const L = look.megaMart;
  const M = layout.megaMart;
  const T = layout.wallThickness;
  const MD = layout.megaMartDoorway;
  const FM = layout.foodCourtMegaMartDoorway;
  const ML = layout.atrium.martLink;
  const west = M.minX + T; // the inside face of the shared west wall
  const colors = { wainscot: L.wainscot, rail: L.rail, band: L.band };

  // Wall bands, round the doorways, the Foam Dart wall buy, the emergency exit and the back wall's doors and vent.
  looks.bands({ along: 'x', from: west, to: M.maxX, wallAt: M.maxZ, facing: -1, colors, gaps: [[ML.from, ML.to], [30.2, 32.8]], name: 'megamart_wainscot' });
  looks.bands({ along: 'z', from: M.minZ, to: M.maxZ, wallAt: M.maxX, facing: -1, colors, gaps: [[1.4, 3.6]], name: 'megamart_wainscot' });
  looks.bands({ along: 'x', from: west, to: M.maxX, wallAt: M.minZ, facing: 1, colors, gaps: [[20.85, 22.75], [25.2, 27.8], [30.5, 33.1]], name: 'megamart_wainscot' });
  looks.bands({ along: 'z', from: M.minZ, to: M.maxZ, wallAt: west, facing: 1, colors, gaps: [[MD.minZ, MD.maxZ], [FM.minZ, FM.maxZ]], name: 'megamart_wainscot' });

  // Neon: the slogan over the checkouts, the motto down the east wall, cyan trim; at the back, a dying red emergency tube.
  const neon = looks.neon('megaMart');
  const S = L.signs;
  const sat = L.satire;
  const backing = look.hallway.backing;
  const north = M.maxZ - 0.05;
  const east = M.maxX - 0.05;
  const south = M.minZ + 0.05;
  const tY = L.trimY;
  neon.sign({ text: sat.slogan, x: 29.4, y: 4.4, z: north, facing: -1, height: 0.38, color: S.slogan, backing, border: S.live, flickerLetters: [21] });
  neon.sign({ text: sat.live, x: east, y: 4.4, z: -13.5, facing: 'x-', height: 0.34, color: S.live, backing, flickerLetters: [17] });
  neon.tube([[25.2, tY, north], [M.maxX - 0.4, tY, north]], { color: L.trim });
  neon.tube([[east, tY, M.minZ + 0.4], [east, tY, -1]], { color: L.trim, flicker: true });
  neon.tube([[west + 0.4, tY, south], [M.maxX - 0.4, tY, south]], { color: S.emergency, flicker: 'dying' });

  // Painted light: trim washes 1 cm off the wall (behind the 2 cm brand stripe), sign glows in front of it.
  const P = look.hallway.pools;
  looks.pool(29.4, 4.4, M.maxZ - 0.026, 10.5, 1.6, -1, S.slogan, P.wallOpacity);
  looks.pool(M.maxX - 0.026, 4.4, -13.5, 7, 1.5, 'x-', S.live, P.wallOpacity);
  looks.pool(29.4, tY - 0.45, M.maxZ - 0.01, M.maxX - 25.2, 0.9, -1, L.trim, P.trimOpacity, { wash: true });
  looks.pool(27.2, tY - 0.45, M.minZ + 0.01, M.maxX - west - 0.8, 0.9, 1, S.emergency, P.trimOpacity * 2, { wash: true });
  looks.pool(27.2, 0.012, M.minZ + 1.6, M.maxX - west - 1, 3, 'floor', S.emergency, P.floorOpacity * 0.7);

  // The corporate cheer on paper, 3 cm proud of the walls (clear of the detail pass's signs).
  looks.poster('banner', { text: sat.mustGo[0], sub: sat.mustGo[1], colors: ['#ffd23f', '#9cc3e6'] }, west + 0.03, 2.6, -17, 4.0, 1.0, 'x+');
  looks.poster('notice', { title: sat.priceMatch[0], body: sat.priceMatch[1], header: '#2f6fb5' }, west + 0.03, 2.0, -3.4, 1.2, 0.9, 'x+');
  looks.poster('sunny', { text: sat.shopTillYouDrop[0], sub: sat.shopTillYouDrop[1] }, M.maxX - 0.03, 2.2, -10.5, 1.0, 1.5, 'x-');
  looks.poster('notice', { title: sat.bulk[0], body: sat.bulk[1], header: '#ffd23f' }, M.maxX - 0.03, 2.0, -17.5, 1.2, 0.9, 'x-');
  looks.poster('notice', { title: sat.stockroom[0], body: sat.stockroom[1], header: '#ff6b6b' }, 29.1, 2.55, M.minZ + 0.03, 1.2, 0.9, 1);

  // Clutter (scatter keeps it out of the shelves; never the entrances, the checkout lanes, spawns or buy spots).
  looks.clutter({
    name: 'megaMart', area: { minX: west + 0.3, maxX: M.maxX - 0.3, minZ: M.minZ + 0.3, maxZ: M.maxZ - 0.3, y: 0 },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter,
    keepClear: [
      ...keepClear,
      { minX: west, maxX: 24.2, minZ: MD.minZ, maxZ: MD.maxZ }, // the hallway entrance
      { minX: west, maxX: 23.6, minZ: FM.minZ, maxZ: FM.maxZ }, // the Food Court shortcut
      { minX: 24, maxX: 28, minZ: -5, maxZ: 5 }, // the checkout lanes (vaults)
    ],
  });
}
