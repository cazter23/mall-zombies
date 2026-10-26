// Sunset Cinema: upstairs wing. Absolute map coordinates in metres, heights
// relative to the shared upper floor. No gameplay tuning outside the door price.
export const cinema = {
  height: 4.8, wallThickness: .3, slabThickness: .3,
  lobby: { minX: -42, maxX: -20.3, minZ: -10.5, maxZ: 5.5 },
  auditorium: { minX: -42, maxX: -24, minZ: 5.8, maxZ: 27.8 },
  passage: { minX: -23.7, maxX: -20.3, minZ: 5.8, maxZ: 27.8 },
  auditoriumEntry: { from: -40.8, to: -37.4, top: 2.8 },
  passageEntry: { from: -23.5, to: -20.5, top: 2.8 },
  auditoriumExit: { from: 22, to: 25.4, top: 2.8 },
  stairsEntry: { from: -8.8, to: -5.6, top: 2.8 },
  futureScreens: [{ from: -38.8, to: -35.8, label: 'SCREEN 2 · COMING SOON' },
    { from: -33.2, to: -30.2, label: 'SCREEN 3 · MAINTENANCE' }],
  island: { minX: -35.6, maxX: -31.4, minZ: -3, maxZ: -2.1, height: .65 },
  concessions: { minX: -41.85, maxX: -40.9, minZ: -2.4, maxZ: 3.3, height: 2.7 },
  ticketBooth: { minX: -26.3, maxX: -22, minZ: -10.35, maxZ: -9.4, height: 2.6 },
  // Generous row pitch keeps the shared nav grid AND the widest zombie's body
  // moving between rows. Tight gaps made the middle seats safe camping spots.
  seats: { columns: [[-39.5, -34.1], [-31.9, -26.5]], rows: [[9.3, 14.2], [17.1, 22.0]],
    colliderHeight: 1.02, perRow: 7, rowsPerBlock: 3, seatHeight: .43 },
  spawns: [
    { id: 'lobby_west', x: -41.2, z: -8.9, wall: 'west' },
    { id: 'lobby_east', x: -21.1, z: 3.8, wall: 'east' },
    { id: 'lobby_south', x: -28.5, z: -9.7, wall: 'south' },
    { id: 'screen_front', x: -41.2, z: 25.8, wall: 'west' },
    { id: 'screen_rear', x: -33, z: 6.6, wall: 'south' },
    { id: 'projection', x: -22, z: 27, wall: 'north' },
  ],
  colors: { lobbyWall: 0xdac9b6, theaterWall: 0x6b5369, serviceWall: 0x85908e,
    carpet: 0x48334f, aisle: 0x6e4963, ceiling: 0x655368, brass: 0xc5a36c, trim: 0x423044,
    seat: 0x743b59, seatEdge: 0x382b3b, curtain: 0x773858, screen: 0xe8deca,
    cream: 0xf0dfbc, dark: 0x262333, paper: 0xe9d7ac, teal: 0x668f94 },
  posters: [
    { x: -36, title: 'THE LAST SALE', tagline: 'EVERYTHING MUST STAY', base: '#683f55', accent: '#e7be8e' },
    { x: -32, title: 'NIGHT SHIFT 2', tagline: 'YOU CLOCKED IN. IT DID NOT.', base: '#405c64', accent: '#c2d7ce' },
    { x: -28, title: 'CLOSING TIME', tagline: 'THE DOORS DISAGREE', base: '#795d49', accent: '#e8c4b0' },
  ],
  lighting: [
    { x: -31, h: 3.0, z: -1, color: 0xffcfa0, intensity: 32, distance: 22 },
    { x: -33, h: 3.0, z: 21.8, color: 0xc8b0eb, intensity: 24, distance: 24 },
  ],
  ambience: [
    { id: 'cinema_projector', kind: 'projector', x: -33, h: 3.6, z: 7.3, range: 26 },
    { id: 'cinema_concessions', kind: 'refrigerator', x: -41.2, h: 1.5, z: .5, range: 13 },
    { id: 'cinema_projector_relay', kind: 'projectorRelay', x: -33, h: 3.6, z: 7.3, range: 12 },
    { id: 'cinema_projection_air', kind: 'ventilation', x: -22, h: 3.8, z: 18, range: 11 },
  ],
  presentation: {
    slideSeconds: 9, screenWidth: 12.4, screenHeight: 3.3, screenY: 2.5,
    projector: { x: -33, h: 3.8, z: 7.3, beamOpacity: .028 },
    slides: [
      { title: 'SUNSET CINEMA', subtitle: 'THE SHOW GOES ON. AND ON.', footer: 'FEATURE PRESENTATION · SINCE 1986', base: '#332d47', accent: '#e5bb87' },
      { title: 'PLEASE REMAIN SEATED', subtitle: 'YOUR SHIFT HAS NOT ENDED.', footer: 'A SUNSET GALLERIA EMPLOYEE TRAINING FILM', base: '#41445a', accent: '#c5d8cc' },
      { title: 'ENJOY OUR CONCESSIONS', subtitle: 'FRESH POPCORN. ANCIENT PRICES.', footer: 'NO OUTSIDE FOOD. NO OUTSIDE WORLD.', base: '#613647', accent: '#f1cc8b' },
      { title: 'A BRIGHTER TOMORROW', subtitle: 'COMING SOON. STILL COMING SOON.', footer: 'SUNSET GALLERIA · YOUR FOREVER MALL', base: '#4a3652', accent: '#d4b5e3' },
    ],
  },
};
