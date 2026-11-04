// Upstairs owns its footprint independently of the hallway below. Add adjoining
// sections/rooms and declare their shared wall openings when extending the wing.
export const promenade = {
  rect: { minX: -20, maxX: 20, minZ: -4.5, maxZ: 6 },
  slabThickness: .3,
  wallThickness: .3,
  seating: {
    planterX: 14.2, planterZ: 1.6,
    landmark: { halfWidth: .55, halfDepth: .4, height: .65 },
    // Rectangles hug the perimeter, leaving the Atrium approach and east-wing
    // reservation open. The older western benches remain movement obstacles.
    loungeBenches: [[11.6, -4.4, 14.6, -3.9], [19.4, .4, 19.9, 2.3], [17.3, 5.4, 18.8, 5.9]],
    wallBenches: [[-9, -7.2], [-6.2, -4.4]],
  },
  details: {
    colors: { brass: 0xbba16f, plum: 0x56415d, cream: 0xe6d7bd, dark: 0x302d3c,
      peach: 0xcc947b, teal: 0x638e90, paper: 0xf2e6ce, glass: 0xbdd6d4, ink: 0x44404a },
    directory: { x: 10.3, height: 1.7, width: 1.35 },
    phones: { z: [2.55, 3.05], y: 1.55 },
    magazineRack: { x: 16.25, width: 1.05 },
    skylight: { minX: 16.5, maxX: 19, minZ: -.8, maxZ: 2.2 },
    hangingSigns: [
      { x: -10.6, z: -2.25, width: 2.6, text: 'SHOPS  ·  EAST LOUNGE →', color: '#d9bddf' },
      { x: 11.2, z: 3.85, width: 2.4, text: 'GRAND ATRIUM →', color: '#e7c99a' },
    ],
    pretzel: { notice: 'BACK AFTER ONE LAST BREAK', menu: 'ORIGINAL  2.50    /    CINNAMON  SOLD OUT',
      colors: [0xb37841, 0xd29a57, 0xa36737] },
    shoe: { tickets: ['PAIRING IS CARING', 'LAST PAIR. BOTH LEFT.', 'SOLES FOR EVERY SOUL'],
      boxColors: [0xab7e80, 0x82718b, 0xb49b71] },
  },
  sections: [
    { id: 'promenade', minX: -20, maxX: 20, minZ: -4.5, maxZ: 6 },
    { id: 'shoePer', minX: -10.3, maxX: -3.7, minZ: 6, maxZ: 11.6 },
    { id: 'workshop', minX: -3.3, maxX: 3.3, minZ: 6, maxZ: 11.5 },
  ],
  shoeStore: {
    from: -10, to: -4, depth: 5.3,
    entrances: [{ from: -9.8, to: -7.7, top: 2.65 }, { from: -6.3, to: -4.2, top: 2.65 }],
    island: { width: 2.2, depth: .6, height: .65, offsetZ: 2.3 },
    shelfHeights: [.55, 1.05, 1.55], pairs: 6,
    floor: { base: '#94798d', grout: '#7c6577', variation: 5, seed: 151 },
    colors: { wall: 0xd8c4ce, ceiling: 0xdad1ca, cabinet: 0x493e53, trim: 0xc5ad82,
      display: 0x8c667f, bench: 0x6c536f, sole: 0xe9dfc8, mirror: 0x9bafb7, lamp: 0xf9cf9c,
      shoes: [0xbe7892, 0x4d789b, 0xb99757, 0x695487], boxes: [0x98816a, 0x635372, 0xae7b80] },
  },
  workshop: {
    from: -3, to: 3, depth: 5.2,
    entrances: [{ from: -2.85, to: -.85, top: 2.7 }, { from: .85, to: 2.85, top: 2.7 }],
    window: { from: -.85, to: .85, top: 2.7, sill: .62 },
    bench: { halfWidth: 1.55, height: 1.02, offsetZ: 4.05, depth: .88, promptHeight: 1.43, promptInset: .15 },
    floor: { light: '#dec9aa', dark: '#877582', grout: '#a09086', tileSize: .55 },
    colors: { wall: 0xe6d4b0, cream: 0xf2dfaa, cabinet: 0xe1b76d, plum: 0x523a54, metal: 0x39333e,
      wood: 0x99724f, paper: 0xf5ebd6, red: 0xc64140, lamp: 0xffcb8a, glass: 0xe2f7ef },
    lamp: { x: 0, height: 2.55, offsetZ: 3.25, color: 0xffce99, intensity: 1.05, distance: 7 },
  },
  expansionConnections: [
    { id: 'westWing', wall: 'west', from: -4.1, to: -1.7, top: 2.7, door: 'cinema', label: 'SUNSET CINEMA' },
    { id: 'eastWing', wall: 'east', from: -4.1, to: -1.7, top: 2.7, label: 'EAST WING · FUTURE EXPANSION' },
  ],
};
