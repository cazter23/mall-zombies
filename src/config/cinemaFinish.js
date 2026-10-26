// Second cinema art pass: metres relative to the cinema floor except service
// return/stair data (absolute). All pieces are decorative and map-owned.
export const cinemaFinish = {
  service: {
    passageRuns: [[5.95, 21.92], [25.48, 27.65]],
    junctionZ: [7.2, 12.2, 20.5, 26.6],
    bulkheadZ: [7.3, 14.3, 21.3, 26.4],
    handling: { z: 14.3, x: -20.57, width: 2.1 },
    access: { z: 18.5, x: -23.64 },
    returnBays: [-40.3, -36.8, -33.3, -29.8, -26.3],
    returnJoists: [-40.6, -35, -29.4, -24.1],
    meter: { x: -39.5, z: 7.24 },
    shipping: { x: -35.4, z: 9.94 },
    forms: [
      ['PRINT MOVEMENT / 01', 'ARRIVED   OCT 03 1986', 'RETURN    OPENING NIGHT', 'COLLECTOR HAS NOT CALLED'],
      ['NIGHT CLEANING', 'LOBBY       COMPLETE', 'SCREEN 1    OCCUPIED', 'DATE        SAME AS ABOVE'],
    ],
    stairJointZ: [-6.1, -2.9, .3, 3.5, 6.7, 9.3],
  },
  lobby: {
    carpet: { x: -31.1, z: -2.5, w: 19.1, d: 13.7 },
    usher: { x: -41.74, z: 4.35 },
    portals: [{ x: -39.1, w: 3.4, text: '01', sub: 'FEATURE PRESENTATION' },
      { x: -22, w: 3, text: 'STAFF', sub: 'PROJECTION & EXIT' }],
    candy: ['MOON BITES', 'STAR POPS', 'NIGHT MINTS', 'SUNSET CHEWS'],
  },
  auditorium: {
    fabricZ: [[9.15, 13.9], [15.45, 20.45], [25.6, 27.3]],
    repair: { col: 1, block: 0, row: 1, seat: 4 },
  },
};
