// =============================================================================
// THE HALLWAY LOOK (visual overhaul, the approved REFERENCE ROOM, "Grand Opening, Forever"): neon signs, slogans and trim,
// painted light pools, pastel wall bands (lavender wainscot, chrome rail, peach band), the corporate-cheer posters and
// notices, and clutter, on top of the hallway mall.js builds. Built with the shared look kit (lookKit.js); colours, copy
// and amounts live in config/look.js. The base surfaces (wall / floor / ceiling colours, lamps, panels) are set by mall.js.
//
// buildHallwayLook({ looks, kit, layout, keepClear })   keepClear = rects clutter stays out of
// =============================================================================

import { look } from '../../config/look.js';

export function buildHallwayLook({ looks, kit, layout, keepClear = [] }) {
  const L = look.hallway;
  const H = layout.hallway;
  const FD = layout.foodCourtDoorway;
  const MD = layout.megaMartDoorway;
  const SCD = layout.serviceCorridor.doorway;
  const gate = layout.atrium.gate;
  const desk = layout.serviceDesk;
  const elevatorX = layout.elevator.centerX;

  // --- Pastel wall bands round every opening ---------------------------------------------------------------------------
  const colors = { wainscot: L.wainscot, rail: L.rail, band: L.stripe.color };
  const heights = { wainscot: L.wainscotHeight, band: [L.stripe.y0, L.stripe.y1] };
  // North wall: the start room's storefront, the Customer Service booth, the elevator, the atrium gate.
  looks.bands({
    along: 'x', from: H.minX, to: H.maxX, wallAt: H.maxZ, facing: -1, colors, heights, name: 'hallway_wainscot',
    gaps: [[layout.departmentStore.gate.from, layout.departmentStore.gate.to], [layout.startRoom.minX, layout.startRoom.maxX],
      [desk.center - 1.9, desk.center + 1.9], [elevatorX - 1.45, elevatorX + 1.45], [gate.from, gate.to]],
  });
  // South wall: the Food Court gate, the Nail Gun wall buy (x 11). West: the Service Corridor door. East: the Mega Mart gate.
  looks.bands({ along: 'x', from: H.minX, to: H.maxX, wallAt: H.minZ, facing: 1, colors, heights, gaps: [[FD.minX, FD.maxX], [10, 12]], name: 'hallway_wainscot' });
  looks.bands({ along: 'z', from: H.minZ, to: H.maxZ, wallAt: H.minX, facing: 1, colors, heights, gaps: [[SCD.minZ, SCD.maxZ]], name: 'hallway_wainscot' });
  looks.bands({ along: 'z', from: H.minZ, to: H.maxZ, wallAt: H.maxX, facing: -1, colors, heights, gaps: [[MD.minZ, MD.maxZ]], name: 'hallway_wainscot' });
  // The east end wall is the Mega Mart's (white on both faces): a 1 cm panel in the hallway's colour over its hallway side,
  // round the Mega Mart gate (behind the wainscot, which stands 2 cm proud).
  const paint = kit.mat(L.wall);
  const eastPanel = (z0, z1, y0, y1) => kit.box(H.maxX - 0.01, y0, z0, H.maxX, y1, z1, paint, { collide: false, name: 'hallway_east_paint' });
  eastPanel(H.minZ, MD.minZ, 0, H.height);
  eastPanel(MD.maxZ, H.maxZ, 0, H.height);
  eastPanel(MD.minZ, MD.maxZ, MD.height, H.height);

  // --- Neon: signs, the SUNSET GALLERIA centrepiece, slogans, trim tubes along the long walls ---------------------------
  const neon = looks.neon('hallway');
  const S = L.signs;
  const sat = L.satire;
  const north = H.maxZ - 0.04;
  const south = H.minZ + 0.04;
  const backing = L.backing; // dark sign panels: neon needs them to pop on the bright pastel walls
  // (y 3.9, not higher: seen from the back of the start room, the start door's 3 m lintel hid a sign at 4.3)
  neon.sign({ text: 'FOOD COURT', style: 'italic', x: (FD.minX + FD.maxX) / 2, y: 3.9, z: south, facing: 1, height: 0.55, color: S.foodCourt, border: S.foodCourt, flickerLetters: [7] });
  // A big-box fascia with printed price cards, separate from the landlord's neon.
  const martZ = (MD.minZ + MD.maxZ) / 2;
  kit.box(H.maxX - .24, 3.72, MD.minZ - .68, H.maxX - .023, 4.93, MD.maxZ + .68,
    kit.mat(look.megaMart.wainscot), { collide: false, name: 'mart_fascia' });
  kit.sign('MEGA MART', { x: H.maxX - .265, y: 4.325, z: martZ, width: 7.1, height: 1.06,
    facing: 'x-', style: 'martBrand', subtext: 'DISCOUNT SUPERMARKET' }).name = 'mart_fascia_wordmark';
  for (const [z, text, subtext] of [[MD.minZ - .53, '99¢', 'WEEKLY DEAL'], [MD.maxZ + .53, '2 FOR 1', 'CLUB PRICE']]) {
    kit.sign(text, { x: H.maxX - .065, y: 2.25, z, width: .72, height: 1.02, facing: 'x-',
      style: 'martBrand', background: '#f58a39', color: '#182b49', accentColor: '#fff0d2', subtext }).name = 'mart_window_offer';
  }
  neon.sign({ text: 'GRAND ATRIUM', style: 'wide', x: (gate.from + gate.to) / 2, y: 4.3, z: north, facing: -1, height: 0.42, color: S.atrium, border: S.atrium });
  neon.sign({
    text: 'STAFF ONLY', x: H.minX + 0.04, y: 3.6, z: (SCD.minZ + SCD.maxZ) / 2, facing: 'x+', height: 0.22, color: S.staffOnly,
    flickerLetters: [0, 1, 2, 3, 4, 6, 7, 8, 9], flickerStyle: 'dying',
  });
  // The start room's storefront: "GO NG OUT OF BUS NESS" (two letters dead, one stuttering)
  neon.sign({ text: 'GOING OUT OF BUSINESS', style: 'italic', x: 0, y: 3.95, z: north, facing: -1, height: 0.32, color: S.storefront, deadLetters: [2, 16], flickerLetters: [13] });
  // The centrepiece over the west half of the north wall: a big neon sun over the backed logo.
  // (No side shapes: palms read as stick figures and stars as squiggles from most angles.)
  const logoX = -11;
  neon.shape('sun', { x: logoX, y: 5.0, z: north, facing: -1, size: 1.9, color: S.sun });
  neon.sign({ text: 'SUNSET GALLERIA', style: 'script', x: logoX, y: 3.8, z: north, facing: -1, height: 0.42, color: S.logo, backing, border: S.star, flickerLetters: [3] });
  // The corporate cheer in neon: the opening hours over the west half of the south wall, a reminder over the east half.
  const openX = -11.5;
  const smileX = 16.4;
  neon.sign({ text: sat.open, style: 'block', x: openX, y: 4.35, z: south, facing: 1, height: 0.4, color: S.open, backing, border: L.trim.north, flickerLetters: [16] });
  neon.sign({ text: sat.smile, style: 'script', x: smileX, y: 4.35, z: south, facing: 1, height: 0.26, color: S.smile, backing });
  // Trim: one tube a little under the ceiling line on each long wall, in pieces (one dead, two stuttering).
  const trimY = L.trimY;
  const trim = (x0, x1, z, color, opts = {}) => neon.tube([[x0, trimY, z], [x1, trimY, z]], { color, ...opts });
  // (No tube at the west end of the north wall any more: HOFFMAN'S gate and its sign are there.)
  trim(-6.8, layout.startRoom.minX - 0.3, north, L.trim.north, { dead: true });
  trim(layout.startRoom.maxX + 0.3, desk.center - 2.1, north, L.trim.north);
  trim(gate.to + 0.3, H.maxX - 0.4, north, L.trim.north, { flicker: true });
  trim(H.minX + 0.4, FD.minX - 0.4, south, L.trim.south);
  trim(FD.maxX + 0.4, 9.6, south, L.trim.south, { flicker: true });
  trim(12.4, H.maxX - 0.4, south, L.trim.south);

  // --- Painted light: soft glows behind the signs and on the floor in front (sign glows 6 mm in front of the trim wash) -
  const P = L.pools;
  const wallIn = 0.015;
  looks.pool(0, 3.9, H.minZ + wallIn + 0.006, 7.5, 2.6, 1, S.foodCourt, P.wallOpacity);
  looks.pool(0, 0.012, H.minZ + 2.2, 7, 4, 'floor', S.foodCourt, P.floorOpacity);
  looks.pool(H.maxX - 2.2, 0.012, martZ, 4, 6.5, 'floor', '#e9f2ff', P.floorOpacity);
  looks.pool((gate.from + gate.to) / 2, 4.3, H.maxZ - wallIn - 0.006, 6, 2.2, -1, S.atrium, P.wallOpacity);
  looks.pool(H.minX + wallIn, 3.6, (SCD.minZ + SCD.maxZ) / 2, 3, 1.2, 'x+', S.staffOnly, P.wallOpacity);
  looks.pool(openX, 4.35, H.minZ + wallIn + 0.006, 9.5, 1.8, 1, S.open, P.wallOpacity);
  looks.pool(smileX, 4.35, H.minZ + wallIn + 0.006, 7.5, 1.2, 1, S.smile, P.wallOpacity);
  looks.pool(0, 3.95, H.maxZ - wallIn - 0.006, 9, 1.6, -1, S.storefront, P.wallOpacity);
  looks.pool(logoX, 4.4, H.maxZ - wallIn - 0.006, 11, 3.4, -1, S.sun, P.wallOpacity);
  looks.pool(logoX, 0.012, H.maxZ - 2.4, 11, 4.4, 'floor', S.star, P.floorOpacity * 0.8);
  looks.pool(0, trimY - 0.45, H.maxZ - wallIn, (H.maxX - H.minX) - 1, 0.9, -1, L.trim.north, P.trimOpacity, { wash: true });
  looks.pool(0, trimY - 0.45, H.minZ + wallIn, (H.maxX - H.minX) - 1, 0.9, 1, L.trim.south, P.trimOpacity, { wash: true });

  // --- The corporate cheer on paper: posters, banners and notices, 3 cm proud of the wall --------------------------------
  const onNorth = H.maxZ - 0.03;
  const onSouth = H.minZ + 0.03;
  looks.poster('sunny', { text: sat.sunny[0], sub: sat.sunny[1] }, -13.2, 2.25, onNorth, 1.0, 1.5, -1);
  looks.poster('employee', {}, -9.5, 2.25, onNorth, 2.0, 1.33, -1);
  looks.poster('notice', { title: sat.lostChildren[0], body: sat.lostChildren[1], header: '#ff9ec7', typeface: 'utility' }, 3.6, 2.15, onNorth, 1.0, 0.75, -1);
  looks.poster('mallMap', { typeface: 'utility', caption: 'You are here. You will stay here.' }, -9, 2.15, onSouth, 1.8, 1.2, 1);
  looks.poster('banner', { text: sat.familyBanner[0], sub: sat.familyBanner[1], colors: ['#a8e6dd', '#c9b6e4'] }, -15.6, 2.6, onSouth, 4.0, 1.0, 1);
  looks.poster('banner', { text: sat.customerBanner[0], sub: sat.customerBanner[1], colors: ['#ff9ec7', '#ffd1a1'] }, smileX, 2.6, onSouth, 4.0, 1.0, 1);
  looks.poster('notice', { title: sat.rewards[0], body: sat.rewards[1], header: '#2bb5a6', typeface: 'utility' }, 7.5, 2.0, onSouth, 1.2, 0.9, 1);
  looks.poster('notice', { title: sat.wetFloor[0], body: sat.wetFloor[1], typeface: 'utility' }, -6.6, 2.0, onSouth, 1.1, 0.82, 1);

  // --- Clutter along the walls (never in doorways, spawns, buy spots or the centre lane) ----------------------------------
  looks.clutter({
    name: 'hallway', area: { minX: H.minX + 0.3, maxX: H.maxX - 0.3, minZ: H.minZ + 0.3, maxZ: H.maxZ - 0.3, y: 0 },
    kinds: L.clutter.kinds, seed: L.clutter.seed, perSquareMeter: L.clutter.perSquareMeter, keepClear,
  });
}
