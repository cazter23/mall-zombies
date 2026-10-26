// =============================================================================
// HOFFMAN'S DETAIL PASS (data for maps/mall/departmentStoreDetails.js): what is on the shelves and counters, the ceiling, the
// fitting-room scene, the interrupted-shopping litter and the store's ambience. Absolute map coordinates in metres.
// Decoration only: the two shelving runs are the pass's only colliders (solid to 2.2 m, so nothing can be perched on).
// =============================================================================

export const departmentStoreDetails = {
  seed: 1987,
  palette: {
    kraft: 0xc8a97e, paper: 0xf4ecda, ink: 0x2b2d42, brass: 0xc9a14a, burgundy: 0x8c2f45, rose: 0xe8b4bc,
    chrome: 0xc9ccd1, glass: 0xbfe3ee, plum: 0x3a2236, hazard: 0xffd23f,
    knits: [0x8c2f45, 0x5b8e7d, 0xe8b4bc, 0x3d5a80, 0xf4a259, 0xf1e4d0, 0x6d4c3d],
  },

  // West wall shelving (folded knits and sweaters), z along the wall, between the gate corner (left clear to turn in) and the Employee of the Month board.
  westShelving: { z0: 7.7, z1: 12.9, depth: 0.38, height: 2.2, shelves: [0.3, 0.8, 1.3, 1.8], uprightEvery: 1.3 },
  // North wall shelving behind the LAYAWAY counter: paper bags with tags (x along the wall, between the fitting rooms and the stockroom door).
  layawayShelving: { x0: -13.9, x1: -10.2, depth: 0.4, height: 2.2, shelves: [0.35, 0.95, 1.55], uprightEvery: 1.85 },

  // Ceiling: two cross beams with a brass edge, a hung banner between them, sprinklers and air diffusers.
  ceiling: {
    beams: { zs: [13.25, 19.75], drop: 0.18, depth: 0.34 },
    banner: { z: 13.25, x0: -14.6, x1: -8.2, y0: 3.55, y1: 4.1, text: 'EVERYTHING MUST STAY', sub: 'SALE ENDS NEVER' },
    sprinklers: [[-18, 8.6], [-12.6, 8.6], [-7.2, 8.6], [-18, 14.4], [-7.2, 14.4], [-18, 21], [-12.6, 21], [-7.2, 21]],
    diffusers: [[-18, 12], [-7.2, 12], [-18, 18.6], [-7.2, 18.6]],
  },

  // Counter-top scenes (positions from LAYOUT.departmentStore.counters / layaway); only small, low things, away from the vault line.
  counters: {
    easel: { x: -14.3, text: 'MAKEOVER · WALK-INS WELCOME' }, // on the cosmetics counter
    tester: { x: -8.4 }, // the fragrance mister
    ties: { x: -7.95 }, // the tie carousel (fragrance counter's east end)
    ledger: { x: -12.4 }, // the layaway counter's ledger and bell
  },

  // The middle fitting room's curtain is pulled aside (the zombie spawn); the east booth is taped off; the west curtain is scratched.
  fitting: {
    closedBooth: 2, scratchedBooth: 0, // (the open booth is LAYOUT.departmentStore.fittingRooms.openBooth)
    pile: { x0: -17.95, x1: -16.35, z0: 22.7, z1: 23.35 }, // try-on clothes dropped in front of the open booth
    closedSign: 'CLOSED · SEE ATTENDANT',
  },
  mirror: { z0: 20.2, z1: 22.2, y0: 0.35, y1: 2.35, text: 'SEE YOURSELF AS WE DO' }, // full-length mirror on the west wall
  wallDisplay: { x0: -13.6, x1: -9.4, text: 'SPRING COLLECTION · 1987' }, // wall busts on the south wall, east of the gate

  // Interrupted shopping: small things on the floor (kept off the walking lanes and every spawn / buy spot).
  litter: {
    tippedMannequin: { x: -6.9, z: 25.4 },
    droppedBag: { x: -9.3, z: 11.35 },
    shoe: { x: -10.6, z: 16.9 },
    flatBox: { x: -9.4, z: 23.2 },
  },

  // The seam where HOFFMAN'S meets the cinema (maps/mall/seamDetails.js): a receiving door on the stair connector's east wall (which is the
  // store's west wall), and the Promenade side of the cinema's front door: now-showing one-sheets and a trail of ticket stubs.
  seam: {
    receiving: { z: 8.2, wallX: -20.3, label: "HOFFMAN'S · RECEIVING", note: 'DOCK 2 · DELIVERIES ONLY' },
    posters: {
      x: -20, y: 0.95, h: 0.72, w: 0.56, // (y above the upper floor: between the wall's low trim and its banners)
      zs: [0.1, 1.2, 2.3, 3.4, 4.5],
      films: [
        ['NOW SHOWING', 'THE SALE OF THE CENTURY (G)'],
        ['NOW SHOWING', 'ATTACK OF THE 50-FOOT SHOPPER'],
        ['NOW SHOWING', 'GRAND OPENING II: STILL OPENING'],
        ['NOW SHOWING', 'RETURN OF THE RETURNS'],
        ['COMING SOON', 'FOREVER AFTER (PG-13)'],
      ],
    },
    stubs: { from: [-17.9, 2.8], to: [-19.4, -1.5], count: 11 }, // x, z of the trail from the lobby toward the shutter
  },

  exitSigns: { gate: { x: -17.5, text: 'EXIT · MAIN HALL' }, stockroom: { text: 'EXIT' } },

  // Spatial ambience (the existing capped / occluded voices): muffled mall music and the air handling.
  ambience: [
    { id: 'hoffmans_music', kind: 'music', x: -12.6, h: 4, z: 16, range: 22 },
    { id: 'hoffmans_hvac', kind: 'ventilation', x: -12.6, h: 4.8, z: 20, range: 12 },
  ],
};
