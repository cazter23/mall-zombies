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

/**
 * The Service Corridor (back of house): green-and-cream two-tone, a dying sick-green tube, a red EXIT, staff notices.
 * corridor = the corridor builder's layout (mall.js `service`), for the west wall and the dead end.
 */
export function buildServiceCorridorLook({ looks, kit, layout, corridor, keepClear = [] }) {
  const L = look.serviceCorridor;
  const SC = layout.serviceCorridor;
  const SF = layout.serviceCorridorFoodCourtDoorway;
  const eastX = layout.hallway.minX - layout.wallThickness; // the hallway's and Food Court's west walls (their outer face)
  const westX = corridor.pointAt(1, 0, 'left').x;
  const zAt = (at) => corridor.pointAt(1, at).z;
  const northZ = corridor.points[1].z + SC.width / 2;
  const endZ = zAt(SC.length);
  const colors = { wainscot: L.wainscot, rail: L.rail, band: L.band };
  const heights = { wainscot: L.wainscotHeight, band: [1.35, 1.45] };

  // The east side is the hallway's and Food Court's walls (mint / peach on both faces): paint the corridor's face, round the
  // shortcut to the Food Court. (The corridor's own north end is the shutter's doorway.)
  paintPanel(kit, {
    along: 'z', from: endZ, to: layout.serviceCorridor.doorway.minZ, wallAt: eastX, facing: -1, height: SC.height, color: L.wall,
    holes: [{ from: SF.minZ, to: SF.maxZ, top: SF.height }], name: 'service_paint',
  });

  // Two-tone bands: the west wall round its vents, electrical panel, lockers and the cannon; the east face round the shortcut.
  looks.bands({
    along: 'z', from: endZ, to: northZ, wallAt: westX, facing: 1, colors, heights, name: 'service_wainscot',
    gaps: [[zAt(4) - 0.8, zAt(4) + 0.8], [zAt(6.5) - 0.5, zAt(6.5) + 0.5], [zAt(9) - 0.8, zAt(9) + 0.8], [zAt(13) - 0.1, zAt(11) + 0.1], [zAt(15.4), zAt(13)]],
  });
  looks.bands({
    along: 'z', from: endZ, to: layout.serviceCorridor.doorway.minZ, wallAt: eastX - 0.01, facing: -1, colors, heights,
    gaps: [[SF.minZ - 0.2, SF.maxZ + 0.2]], name: 'service_wainscot',
  });

  // Neon, what little there is back here: a dying green tube along the east face, a red EXIT pointing back to the mall.
  const neon = looks.neon('serviceCorridor');
  const S = L.signs;
  const tY = L.trimY;
  const east = eastX - 0.05;
  neon.tube([[east, tY, endZ + 0.4], [east, tY, SF.minZ - 0.4]], { color: S.tube, flicker: 'dying' });
  neon.tube([[east, tY, SF.maxZ + 0.4], [east, tY, layout.serviceCorridor.doorway.minZ - 0.3]], { color: S.tube, dead: true });
  neon.sign({ text: 'EXIT', x: westX + 0.05, y: 2.75, z: zAt(0.3), facing: 'x+', height: 0.22, color: S.exit, backing: look.hallway.backing, flickerLetters: [1] });

  // Painted light: a sick green wash under the tube, red round the EXIT and a red glow at the dead end.
  const P = look.hallway.pools;
  const midZ = (endZ + layout.serviceCorridor.doorway.minZ) / 2;
  const span = layout.serviceCorridor.doorway.minZ - endZ - 0.8;
  looks.pool(eastX - 0.012, tY - 0.45, midZ, span, 0.9, 'x-', S.tube, P.trimOpacity * 1.5, { wash: true });
  looks.pool(westX + 0.022, 2.75, zAt(0.3), 1.6, 0.9, 'x+', S.exit, P.wallOpacity * 1.4);
  looks.pool(corridor.points[2].x, 0.012, endZ + 1.4, SC.width - 0.2, 2.6, 'floor', S.exit, P.floorOpacity * 0.8);

  // Staff notices on the painted east face, 3 cm proud.
  const onEast = eastX - 0.03;
  looks.poster('notice', { title: L.satire.clockIn[0], body: L.satire.clockIn[1], header: '#9c3b33' }, onEast, 1.9, zAt(1.6) - 1.2, 1.0, 0.75, 'x-');
  looks.poster('notice', { title: L.satire.mandatoryFun[0], body: L.satire.mandatoryFun[1], header: '#ffd23f' }, onEast, 1.9, zAt(5.5), 1.1, 0.82, 'x-');
  looks.poster('notice', { title: L.satire.seeSomething[0], body: L.satire.seeSomething[1], header: '#6f8c6a' }, onEast, 1.9, zAt(9.5), 1.1, 0.82, 'x-');
  looks.poster('notice', { title: L.satire.breakRoom[0], body: L.satire.breakRoom[1], header: '#55595c' }, onEast, 1.9, zAt(12), 1.0, 0.75, 'x-');

  // Clutter: it's worse back here.
  looks.clutter({
    name: 'serviceCorridor', area: { minX: westX + 0.25, maxX: eastX - 0.25, minZ: endZ + 0.25, maxZ: northZ - 0.25, y: 0 },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter, keepClear,
  });
}

/** The start room (a clearance store): faded butter / raspberry bands, CLEARANCE and THANK YOU FOR SHOPPING! in neon. */
export function buildStartRoomLook({ looks, kit, layout }) {
  const L = look.startRoom;
  const R = layout.startRoom;
  const D = layout.doorway;
  const front = layout.hallway.maxZ + layout.wallThickness; // the storefront wall's inside face
  const colors = { wainscot: L.wainscot, rail: L.rail, band: L.band };

  // The storefront wall is the hallway's (its storefront colour on both faces): paint the inside, round the shutter's doorway.
  paintPanel(kit, {
    along: 'x', from: R.minX, to: R.maxX, wallAt: front, facing: 1, height: R.height, color: L.wall, name: 'startroom_paint',
    holes: [{ from: D.minX, to: D.maxX, top: D.height }],
  });

  // Bands round the shelf (west), the Price Gun station (east), the boarded vents (back) and the shutter (front).
  looks.bands({ along: 'z', from: front, to: R.maxZ, wallAt: R.minX, facing: 1, colors, gaps: [[7.9, 11.6], [layout.departmentStore.startRoomLink.from, layout.departmentStore.startRoomLink.to]], name: 'startroom_wainscot' }); // (the shelf; HOFFMAN'S side door)
  looks.bands({ along: 'z', from: front, to: R.maxZ, wallAt: R.maxX, facing: -1, colors, gaps: [[9.1, 10.9]], name: 'startroom_wainscot' });
  looks.bands({ along: 'x', from: R.minX, to: R.maxX, wallAt: R.maxZ, facing: -1, colors, gaps: [[-4.4, -2.6], [2.6, 4.4]], name: 'startroom_wainscot' });
  looks.bands({ along: 'x', from: R.minX, to: R.maxX, wallAt: front + 0.01, facing: 1, colors, gaps: [[D.minX, D.maxX]], name: 'startroom_wainscot' });

  // Neon: CLEARANCE over the west wall (past the shelf), and the goodbye over the shutter: the first thing you see.
  const neon = looks.neon('startRoom');
  const S = L.signs;
  const backing = look.hallway.backing;
  neon.sign({ text: L.satire.thanks, x: 0, y: 3.5, z: front + 0.05, facing: 1, height: 0.24, color: S.thanks, backing, flickerLetters: [9] });
  neon.sign({ text: L.satire.clearance, x: R.minX + 0.05, y: 3.25, z: 13.4, facing: 'x+', height: 0.36, color: S.clearance, backing, border: S.thanks, flickerLetters: [4] });

  const P = look.hallway.pools;
  looks.pool(0, 3.5, front + 0.026, 6.5, 1.0, 1, S.thanks, P.wallOpacity);
  looks.pool(R.minX + 0.026, 3.25, 13.4, 4.2, 1.3, 'x+', S.clearance, P.wallOpacity);
  looks.pool(R.minX + 1.4, 0.012, 13.4, 2.6, 3.6, 'floor', S.clearance, P.floorOpacity * 0.7);

  // The store's farewell notice beside the shutter (3 cm proud).
  looks.poster('notice', { title: L.satire.closing[0], body: L.satire.closing[1], header: '#d9768a' }, 3.4, 2.0, front + 0.03, 1.2, 0.9, 1);
}

/** Level 2 (the Sunset Promenade): pink trim, THE SUN NEVER SETS ON SAVINGS, YOUR STORE HERE!, posters, light clutter. */
export function buildLevelTwoLook({ looks, layout, floorY, hole, keepClear = [] }) {
  const L = look.level2;
  const H = layout.level2.rect;
  const L2 = layout.level2;
  const y = (h) => floorY + h;
  const S = L.signs;
  const sat = L.satire;
  const backing = look.hallway.backing;
  const north = H.maxZ - 0.05;
  const south = H.minZ + 0.05;

  // Neon: the sunset slogan over the south-west vent, YOUR STORE HERE! over the escalator lobby, pink trim along both long walls.
  const neon = looks.neon('level2');
  neon.sign({ text: sat.sunset, x: -12, y: y(2.75), z: south, facing: 1, height: 0.24, color: S.sunset, backing, border: L.trim, flickerLetters: [8] });
  neon.sign({ text: sat.leasing, x: -15, y: y(2.75), z: north, facing: -1, height: 0.26, color: S.leasing, backing, flickerLetters: [11] });
  const tY = y(L.trimY);
  neon.tube([[H.minX + 0.4, tY, north], [H.maxX - 0.4, tY, north]], { color: L.trim });
  neon.tube([[H.minX + 0.4, tY, south], [-1, tY, south]], { color: L.trim, flicker: true });
  neon.tube([[1, tY, south], [H.maxX - 0.4, tY, south]], { color: L.trim });

  // Painted light: washes under the trim (behind the shop facades), glows behind the two signs.
  const P = look.hallway.pools;
  looks.pool(0, tY - 0.45, H.maxZ - 0.01, H.maxX - H.minX - 1, 0.9, -1, L.trim, P.trimOpacity, { wash: true });
  looks.pool(0, tY - 0.45, H.minZ + 0.01, H.maxX - H.minX - 1, 0.9, 1, L.trim, P.trimOpacity, { wash: true });
  looks.pool(-12, y(2.75), H.minZ + 0.026, 7.5, 1.1, 1, S.sunset, P.wallOpacity);
  looks.pool(-15, y(2.75), H.maxZ - 0.026, 4.6, 1.1, -1, S.leasing, P.wallOpacity);

  // Posters, 3 cm proud: the leasing notice under its neon, a banner over the south benches, Sunny on the east wall.
  looks.poster('notice', { title: sat.leasingNote[0], body: sat.leasingNote[1], header: '#22c3d6' }, -15, y(1.8), H.maxZ - 0.03, 1.2, 0.9, -1);
  looks.poster('banner', { text: sat.top[0], sub: sat.top[1], colors: ['#ffb38a', '#c9b6e4'] }, -6.7, y(1.9), H.minZ + 0.03, 3.4, 0.9, 1);
  looks.poster('sunny', { text: sat.view[0], sub: sat.view[1] }, H.maxX - 0.03, y(1.9), 0, 1.0, 1.5, 'x-');

  // Clutter (never over the escalator well or the balcony voids, spawns, doors).
  const pad = (r) => ({ minX: r.minX - 0.3, maxX: r.maxX + 0.3, minZ: r.minZ - 0.3, maxZ: r.maxZ + 0.3 });
  looks.clutter({
    name: 'level2', area: { minX: H.minX + 0.3, maxX: H.maxX - 0.3, minZ: H.minZ + 0.3, maxZ: H.maxZ - 0.3, y: floorY },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter,
    keepClear: [...keepClear, pad(hole), ...L2.voids.map(pad),
      ...L2.shoeStore.entrances.map(e => ({ minX: e.from - .4, maxX: e.to + .4, minZ: H.maxZ - 1.4, maxZ: H.maxZ + .4 })),
      ...L2.expansionConnections.map(c => c.wall === 'north'
        ? { minX: c.from - .4, maxX: c.to + .4, minZ: H.maxZ - 1.5, maxZ: H.maxZ }
        : { minX: c.wall === 'west' ? H.minX : H.maxX - 1.5, maxX: c.wall === 'west' ? H.minX + 1.5 : H.maxX,
          minZ: c.from - .4, maxZ: c.to + .4 }),
      { minX: H.minX, maxX: hole.minX, minZ: H.minZ, maxZ: H.maxZ }],
  });
}

/** The Grand Atrium: neon suns, the mall's promise across the court, trim round both floors, posters, clutter in the court. */
export function buildAtriumLook({ looks, layout, upperY, keepClear = [] }) {
  const L = look.atrium;
  const AT = layout.atrium;
  const A = AT.rect;
  const d = AT.ringDepth;
  const V = { minX: A.minX + d, maxX: A.maxX - d, minZ: A.minZ + d, maxZ: A.maxZ - d }; // the open court
  const cx = (V.minX + V.maxX) / 2;
  const S = L.signs;
  const sat = L.satire;
  const backing = look.hallway.backing;
  const inset = 0.05;

  // Neon: two suns either side of the SUNSET GALLERIA sign (north upper wall), the promise on the south upper wall.
  const neon = looks.neon('atrium');
  for (const dx of [-6.6, 6.6]) neon.shape('sun', { x: cx + dx, y: upperY + 1.9, z: A.maxZ - inset, facing: -1, size: 2.6, color: S.sun });
  const promiseX = 23.4;
  neon.sign({ text: sat.promise, x: promiseX, y: upperY + 2.3, z: A.minZ + inset, facing: 1, height: 0.46, color: S.promise, backing, border: L.trim.ringLong, flickerLetters: [27] });

  // Trim: orange round the arcade (under the ring), cyan on the ring's long walls, pink on its ends (one tube dying).
  const tube = (points, opts) => neon.tube(points, opts);
  const aY = L.arcadeTrimY;
  const rY = upperY + L.ringTrimY;
  const edges = (y) => ({
    north: [[A.minX + 0.4, y, A.maxZ - inset], [A.maxX - 0.4, y, A.maxZ - inset]],
    south: [[A.minX + 0.4, y, A.minZ + inset], [A.maxX - 0.4, y, A.minZ + inset]],
    west: [[A.minX + inset, y, A.minZ + 0.4], [A.minX + inset, y, A.maxZ - 0.4]],
    east: [[A.maxX - inset, y, A.minZ + 0.4], [A.maxX - inset, y, A.maxZ - 0.4]],
  });
  const arcade = edges(aY);
  for (const side of ['north', 'south', 'west', 'east']) tube(arcade[side], { color: L.trim.arcade, flicker: side === 'east' });
  const ring = edges(rY);
  tube(ring.north, { color: L.trim.ringLong });
  const southRing = A.minZ + inset; // (split round the PROMENADE · LEVEL 2 sign over the link)
  tube([[A.minX + 0.4, rY, southRing], [AT.link.from - 0.3, rY, southRing]], { color: L.trim.ringLong });
  tube([[AT.link.to + 0.3, rY, southRing], [A.maxX - 0.4, rY, southRing]], { color: L.trim.ringLong });
  tube(ring.west, { color: L.trim.ringEnds });
  tube(ring.east, { color: L.trim.ringEnds, flicker: 'dying' });

  // Painted light: washes under every trim (1 cm off the walls), glows behind the suns and the promise.
  const P = look.hallway.pools;
  const w = A.maxX - A.minX - 1;
  const dz = A.maxZ - A.minZ - 1;
  const midZ = (A.minZ + A.maxZ) / 2;
  const midX = (A.minX + A.maxX) / 2;
  for (const [y, longColor, endColor] of [[aY, L.trim.arcade, L.trim.arcade], [rY, L.trim.ringLong, L.trim.ringEnds]]) {
    looks.pool(midX, y - 0.45, A.maxZ - 0.01, w, 0.9, -1, longColor, P.trimOpacity, { wash: true });
    looks.pool(midX, y - 0.45, A.minZ + 0.01, w, 0.9, 1, longColor, P.trimOpacity, { wash: true });
    looks.pool(A.minX + 0.01, y - 0.45, midZ, dz, 0.9, 'x+', endColor, P.trimOpacity, { wash: true });
    looks.pool(A.maxX - 0.01, y - 0.45, midZ, dz, 0.9, 'x-', endColor, P.trimOpacity, { wash: true });
  }
  for (const dx of [-6.6, 6.6]) looks.pool(cx + dx, upperY + 1.9, A.maxZ - 0.026, 5, 3.4, -1, S.sun, P.wallOpacity);
  looks.pool(promiseX, upperY + 2.3, A.minZ + 0.026, 12, 1.6, 1, S.promise, P.wallOpacity);

  // Posters, 3 cm proud (arcade walls and the ring's east wall).
  looks.poster('banner', { text: sat.grandOpening[0], sub: sat.grandOpening[1], colors: ['#ffd1a1', '#ff9ec7'] }, A.minX + 0.03, 2.6, 22, 4.0, 1.0, 'x+');
  looks.poster('notice', { title: sat.lostFound[0], body: sat.lostFound[1], header: '#2ec4b6' }, A.maxX - 0.03, 2.0, 18, 1.2, 0.9, 'x-');
  looks.poster('sunny', { text: sat.wish[0], sub: sat.wish[1] }, 20, 2.1, A.maxZ - 0.03, 1.0, 1.5, -1);
  looks.poster('notice', { title: sat.rules[0], body: sat.rules[1], header: '#ff6b6b' }, A.maxX - 0.03, upperY + 1.8, 15, 1.2, 0.9, 'x-');

  // Clutter on the ground floor (scatter keeps it out of the fountain, kiosks and planters; never the escalator or doorways).
  const E = AT.escalator;
  looks.clutter({
    name: 'atrium', area: { minX: A.minX + 0.3, maxX: A.maxX - 0.3, minZ: A.minZ + 0.3, maxZ: A.maxZ - 0.3, y: 0 },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter,
    keepClear: [
      ...keepClear,
      { minX: E.bottomX - 2.5, maxX: V.maxX + 0.5, minZ: E.minZ - 0.4, maxZ: E.maxZ + 0.4 }, // the escalator (and its foot)
      { minX: AT.gate.from - 0.5, maxX: AT.gate.to + 0.5, minZ: A.minZ, maxZ: A.minZ + 3 }, // the hallway gate
      { minX: AT.martLink.from - 0.5, maxX: AT.martLink.to + 0.5, minZ: A.minZ, maxZ: A.minZ + 3 }, // the Mega Mart shortcut
    ],
  });
}

/** HOFFMAN'S (the department store): cream walls, burgundy wainscot and brass rail, the hot-pink logo, store policy in neon. */
export function buildDepartmentStoreLook({ looks, kit, layout, keepClear = [] }) {
  const L = look.departmentStore;
  const DS = layout.departmentStore;
  const r = DS.rect;
  const gate = DS.gate;
  const side = DS.startRoomLink;
  const F = DS.fittingRooms;
  const W = DS.shoeWall;
  const T = layout.wallThickness;
  const startRoomBack = layout.startRoom.maxZ + T; // north of this the east wall is the store's own
  const colors = { wainscot: L.wainscot, rail: L.rail, band: L.band };

  // Paint over the walls it borrows: the hallway's north wall (round the gate) and the start room's west wall (round the
  // side door, up past the start room's ceiling slab to where the store's own wall starts).
  paintPanel(kit, {
    along: 'x', from: r.minX, to: r.maxX, wallAt: r.minZ, facing: 1, height: DS.height, color: DS.colors.wall, name: 'deptstore_paint',
    holes: [{ from: gate.from, to: gate.to, top: gate.height }],
  });
  paintPanel(kit, {
    along: 'z', from: r.minZ, to: startRoomBack, wallAt: r.maxX, facing: -1, height: 4.3, color: DS.colors.wall, name: 'deptstore_paint',
    holes: [{ from: side.from, to: side.to, top: side.height }],
  });

  // Bands round the gate, the side door, the vent, the stockroom door, and the fitting rooms and shoe wall (flush to the walls).
  const stockroom = [DS.stockroomDoorX - 1.1, DS.stockroomDoorX + 1.1];
  looks.bands({ along: 'x', from: r.minX, to: r.maxX, wallAt: r.minZ + 0.01, facing: 1, colors, gaps: [[gate.from, gate.to]], name: 'deptstore_wainscot' });
  looks.bands({ along: 'x', from: r.minX, to: r.maxX, wallAt: r.maxZ, facing: -1, colors, gaps: [[F.x0, F.x1 + 0.1], stockroom, [r.maxX - W.depth - 0.1, r.maxX]], name: 'deptstore_wainscot' });
  looks.bands({ along: 'z', from: r.minZ, to: r.maxZ, wallAt: r.minX, facing: 1, colors, gaps: [[DS.westVentZ - 0.8, DS.westVentZ + 0.8], [r.maxZ - F.depth - 0.1, r.maxZ]], name: 'deptstore_wainscot' });
  looks.bands({ along: 'z', from: r.minZ, to: startRoomBack, wallAt: r.maxX - 0.01, facing: -1, colors, gaps: [[side.from, side.to], [DS.scannerZ - 0.9, DS.scannerZ + 0.9]], name: 'deptstore_wainscot' }); // (the side door; the Barcode Scanner)
  looks.bands({ along: 'z', from: startRoomBack, to: r.maxZ, wallAt: r.maxX, facing: -1, colors, gaps: [[W.z0 - 0.1, W.z1 + 0.1]], name: 'deptstore_wainscot' });

  // Neon: the logo on the back wall, store policy over the way out and over the shoes, a pink trim tube down the west wall.
  // Over the gate on the hallway side: the name, so you know what 1250 buys.
  const neon = looks.neon('departmentStore');
  const S = L.signs;
  const sat = L.satire;
  const backing = look.hallway.backing;
  const logoX = (F.x1 + DS.stockroomDoorX - 1.1) / 2 - 0.4;
  neon.sign({ text: sat.logo, x: logoX, y: 3.95, z: r.maxZ - 0.05, facing: -1, height: 0.62, color: S.logo, backing, border: S.border, flickerLetters: [6] });
  neon.sign({ text: sat.tagline, x: logoX, y: 3.2, z: r.maxZ - 0.05, facing: -1, height: 0.2, color: S.slogan, backing });
  const finalX = (gate.to + r.maxX) / 2;
  neon.sign({ text: sat.final, x: finalX, y: 3.75, z: r.minZ + 0.06, facing: 1, height: 0.28, color: S.slogan, backing, flickerLetters: [20] });
  const sizeZ = (W.z0 + W.z1) / 2;
  neon.sign({ text: sat.size, x: r.maxX - 0.05, y: 3.25, z: sizeZ, facing: 'x-', height: 0.24, color: S.size, backing, deadLetters: [9] });
  const hallNorth = layout.hallway.maxZ - 0.04;
  neon.sign({ text: sat.logo, x: (gate.from + gate.to) / 2, y: 3.95, z: hallNorth, facing: -1, height: 0.42, color: S.logo, backing, border: S.border });
  neon.tube([[r.minX + 0.05, L.trimY, r.minZ + 0.4], [r.minX + 0.05, L.trimY, r.maxZ - 0.4]], { color: L.trim, flicker: true });

  // Painted light behind the signs and under the trim (sign glows 6 mm in front of the wash, 1 cm off the wall).
  const P = look.hallway.pools;
  looks.pool(logoX, 3.7, r.maxZ - 0.026, 6, 2.2, -1, S.logo, P.wallOpacity);
  looks.pool(logoX, 0.012, r.maxZ - 2.6, 5, 3, 'floor', S.logo, P.floorOpacity * 0.7);
  looks.pool(finalX, 3.75, r.minZ + 0.036, 8.5, 1.2, 1, S.slogan, P.wallOpacity);
  looks.pool(r.maxX - 0.026, 3.25, sizeZ, 6.5, 1.1, 'x-', S.size, P.wallOpacity);
  looks.pool((gate.from + gate.to) / 2, 3.95, layout.hallway.maxZ - 0.021, 5, 1.5, -1, S.logo, P.wallOpacity);
  looks.pool(r.minX + 0.01, L.trimY - 0.45, (r.minZ + r.maxZ) / 2, r.maxZ - r.minZ - 1, 0.9, 'x+', L.trim, P.trimOpacity, { wash: true });

  // The policies on paper, 3 cm proud: hiring by the gate, layaway on the back wall, Dale (employee of the month, every month)
  // on the west wall, the grand opening over the side door, the fitting-room rules on the fitting rooms' open end.
  looks.poster('notice', { title: sat.hiring[0], body: sat.hiring[1], header: '#8c2f45' }, gate.to + 1.3, 2.0, r.minZ + 0.04, 1.0, 0.75, 1);
  looks.poster('notice', { title: sat.layaway[0], body: sat.layaway[1], header: '#c9a14a' }, (F.x1 + DS.stockroomDoorX - 1.1) / 2, 1.9, r.maxZ - 0.03, 1.2, 0.9, -1);
  looks.poster('employee', {}, r.minX + 0.03, 2.25, 14.4, 2.0, 1.33, 'x+');
  looks.poster('banner', { text: sat.opening[0], sub: sat.opening[1], colors: ['#f6e7c8', '#e8b4bc'] }, r.maxX - 0.04, 3.55, (side.from + side.to) / 2, 3.6, 0.9, 'x-');
  looks.poster('sunny', { text: sat.fitting[0], sub: sat.fitting[1] }, F.x1 + 0.03, 1.5, r.maxZ - F.depth / 2, 0.8, 1.2, 'x+');

  // Clutter (scatter keeps it off the fixtures; never in the gate, the side door or the counters' vault lanes).
  looks.clutter({
    name: 'departmentStore', area: { minX: r.minX + 0.3, maxX: r.maxX - 0.3, minZ: r.minZ + 0.3, maxZ: r.maxZ - 0.3, y: 0 },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter,
    keepClear: [
      ...keepClear,
      { minX: gate.from - 0.5, maxX: gate.to + 0.5, minZ: r.minZ, maxZ: r.minZ + 3 },
      { minX: r.maxX - 3, maxX: r.maxX, minZ: side.from - 0.5, maxZ: side.to + 0.5 },
      ...[...DS.counters, DS.layaway].map((c) => ({ minX: c.x0, maxX: c.x1, minZ: c.z - 2, maxZ: c.z + 2 })),
    ],
  });
}
