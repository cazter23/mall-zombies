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
    { id: 'workshop', minX: -3.65, maxX: 3.65, minZ: 6, maxZ: 11.7 },
    { id: 'workshopHall', minX: -9.8, maxX: 5.2, minZ: 11.7, maxZ: 26.8 },
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
    from: -3.35, to: 3.35, depth: 5.7, // the storefront, up to the hall's front wall
    entrances: [{ from: -3.18, to: -.95, top: 2.7 }, { from: .95, to: 3.18, top: 2.7 }],
    window: { from: -.95, to: .95, top: 2.7, sill: .62 },
    bench: { halfWidth: 1.05, height: 1.02, offsetZ: 3.4, depth: .88, promptHeight: 1.43, promptInset: .15 },
    floor: { light: '#f4dfb3', dark: '#b3a483', grout: '#b4a78c', tileSize: .55 },
    colors: { wall: 0xf6dfb4, cream: 0xffedca, cabinet: 0xf2c569, plum: 0x253c87, metal: 0x354668,
      wood: 0x99724f, paper: 0xf5ebd6, red: 0xc64140, lamp: 0xffcb8a, glass: 0xe2f7ef },
    lamp: { x: 0, height: 2.55, offsetZ: 2.2, color: 0xffce99, intensity: 1.05, distance: 7 },
    rideHeight: .22, // the gun rides this far above the belt
    // The back hall (Build-A-Blaster ritual room). It sits above HOFFMAN'S and the start room; the Atrium's exterior wall
    // starts at x 5.27, so the east wall stops short of it. Lanes round the island stay >= 3 m (tests/workshopRoom.test.js).
    hall: {
      minX: -9.5, maxX: 4.9, minZ: 12, maxZ: 26.5, height: 4.8,
      mouthTop: 3.2, // the opening from the storefront, as wide as the storefront
      island: { minX: -6.1, maxX: .5, minZ: 15.7, maxZ: 22.3, solidHeight: 2.2 }, // glass guard round tank + conveyor; nothing inside is reachable
      tank: { x: -2.8, z: 19, radius: 1.5, height: 4.1 },
      conveyor: { inset: .15, width: .8, height: .95 }, // a U open to the east, ending by the Naming Booth
      booth: { minX: 3.7, maxX: 4.9, minZ: 20, maxZ: 23.2, height: 2.6, promptHeight: 1.45 },
      lever: { z: 16.8, height: 1.35, depth: .14 }, // on the east wall, south of the booth
      chute: { x: -7, width: 2.2, sill: .45, top: 2.25, spawnInset: .9 }, // the Returns Chute hatch in the north wall; zombies land spawnInset out from it
      panels: [[-7.6, 14], [2.6, 14], [-7.6, 24.2], [2.6, 24.2]],
      lamps: [{ x: -2.3, z: 14 }, { x: -2.3, z: 24.4 }],
      lampLight: { color: 0xffe2bd, intensity: 15, distance: 16, height: 3.1 },
    },
  },
  expansionConnections: [
    { id: 'westWing', wall: 'west', from: -4.1, to: -1.7, top: 2.7, door: 'cinema', label: 'SUNSET CINEMA' },
    { id: 'eastWing', wall: 'east', from: -4.1, to: -1.7, top: 2.7, label: 'EAST WING · FUTURE EXPANSION' },
  ],
};
