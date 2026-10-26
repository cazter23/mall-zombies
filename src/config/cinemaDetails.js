// Authored cinema dressing. These never change collision, spawn or weapon tuning.
export const cinemaDetails = {
  budgets: { triangles: 26000, meshes: 110 },
  palette: { cream: 0xead8bb, plum: 0x623d55, rose: 0xb77a8b, mint: 0x88aaa0, ink: 0x302b3b,
    gold: 0xc7a56b, paper: 0xf0dfb7, metal: 0x8f9c9c, red: 0x943d54, blue: 0x638899, faded: 0x956b7d },
  lobby: {
    cofferX: [-37.5, -31, -25.5], cofferZ: [-6.2, 2.8],
    pilasters: [-41.6, -37.05, -25.2, -23.95],
    menu: ['FRESH / FOREVER', 'SWEET / REPEAT'],
    showtimes: ['THE LAST SALE       7:10', 'NIGHT SHIFT 2       9:30', 'CLOSING TIME       11:59', 'OPENING NIGHT · OCT 1986'],
  },
  auditorium: {
    speakerZ: [8.4, 15.5, 21.1, 26.6], ribZ: [8.5, 14.8, 20.9, 27.1],
    ceilingZ: [10.8, 18.4, 25],
    // [column group, block, row, seat, kind] — intentional scenes, not uniform scatter.
    seatStories: [[0, 0, 0, 1, 'drink'], [0, 0, 2, 5, 'coat'], [1, 0, 1, 4, 'repair'],
      [1, 1, 0, 1, 'carton'], [0, 1, 2, 3, 'drink'], [1, 1, 2, 6, 'coat']],
  },
  service: {
    passagePanels: [10.5, 18.2], passageFrames: [8.8, 15.8, 26.2],
    returnPanels: [-35.4, -27.6], pipeX: [-40, -34, -28],
    stairStencils: [{ z: -7.2, h: 7.7, text: '02 / CINEMA' }, { z: 8.6, h: .9, text: '01 / SERVICE' }],
  },
  story: {
    premiere: 'GRAND PREMIERE\nOCTOBER 1986\nSTILL SHOWING',
    maintenance: 'PROJECTOR 01\nDO NOT SWITCH OFF\nMANAGEMENT REQUEST',
    delivery: 'SUNSET PICTURES\nRETURN PRINT / OVERDUE\nKEEP UPRIGHT',
    cleaner: 'NIGHT CLEANING\nAISLES FIRST\nDO NOT DISTURB THE SHOW',
  },
  motion: { screenFrameSeconds: .2, posterPeriod: 13, posterRadians: .008, screenWashOpacity: .055 },
  // Floor clusters are near walls/furniture. Small pieces stay below ankle height.
  litter: [
    { x: -40.25, z: -1.6, kind: 'popcorn', count: 13, spread: .36 },
    { x: -25, z: -8.95, kind: 'tickets', count: 5, spread: .34 },
    { x: -40.55, z: 11.4, kind: 'popcorn', count: 7, spread: .22 },
    { x: -25.8, z: 20.8, kind: 'paper', count: 3, spread: .20 },
    { x: -23.15, z: 18.1, kind: 'paper', count: 3, spread: .16 },
    { x: -27.8, z: 9.72, floorY: 0, kind: 'paper', count: 3, spread: .13 },
  ],
};
