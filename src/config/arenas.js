// =============================================================================
// ARENA SURVIVAL (Extra Modes on the run-mode screen; the plan: docs/arena-modes-plan.md). Survive as long as you can locked
// in ONE part of the mall. Each arena: its zones (only these are open; every exit is sealed), where you start, the spawn
// markers it adds, and the fixtures it adds (map data, built by maps/mall/arenas.js, game/features/ by kind). Nothing here
// exists in a normal run.
//   list order = the menu's order. Prices come from g.pricing like everything else (economy.js), never from here.
//   playerSpawn  { at: [x, y, z], yaw } (yaw 0 faces -Z, Math.PI faces +Z)
//   spawns       extra zombie markers, ONLY in this arena: [{ id, at: [x, y, z] }] (named spawn_arena_<arena>_<id>)
//   restock      an arena-only RESTOCK-O-MATIC on a wall that runs along X: { x (its centre), wallZ, facing (+1/-1 along Z), floorY }
//   desk         an arena-only Customer Service booth (maps/mall/props.js serviceDesk): { along, center, wallAt, facing, floorY }
//   boxOffice    Customer Service at an existing counter (no new booth): the three windows' buy spots and its signs
//   wallBuys     arena-only wall guns: [{ id, weapon, at: [x, y, z], normal: [x, 0, z], board? }]
//                board: a plywood backing (on a fence): { half: [along, up], depth } around `at`, standing off the fence
// =============================================================================

export const arenas = {
  menu: {
    label: 'Extra Modes',
    description: 'Arena survival: one part of the mall, the exits sealed, as long as you last.',
    kicker: 'Extra Modes',
    title: 'Arena survival',
    back: 'Back',
    best: (round) => `Best round ${round}`,
    noBest: 'No shifts filed yet',
  },
  // The HUD line under the round box for the whole run, and the receipt's line.
  sealed: 'Exits sealed',
  receiptLabel: 'Arena',
  statsTitle: 'Arena survival',
  newRecord: (name) => `Best round · ${name}`,
  list: [
    {
      id: 'startRoom',
      name: 'Everything Must Go',
      description: 'The closed-down store. A Price Gun, a refill machine and no exits.',
      zones: ['startRoom'],
      pa: { kicker: 'Attention shoppers', text: 'This store is closing down. Everything must go. The doors will not be going anywhere.' },
      playerSpawn: { at: [0, 0, 12], yaw: Math.PI },
      // Two more markers for a 10 m room: under the start shutter, and in front of HOFFMAN'S side door.
      spawns: [
        { id: 'shutter', at: [0, 0, 6.9] },
        { id: 'sideDoor', at: [-4.3, 0, 12.55] },
      ],
      // West of the shutter on the south wall (the room's inside face is z 6.3): body x -4.45..-2.75.
      restock: { x: -3.6, wallZ: 6.3, facing: 1, floorY: 0 },
    },
    {
      id: 'cinema',
      name: 'Last Showing',
      description: 'Sealed in the Sunset Cinema. The feature runs until you stop.',
      zones: ['cinema'],
      pa: { kicker: 'Attention patrons', text: 'Tonight is the last showing. Please remain seated. The exits have been told to do the same.' },
      playerSpawn: { at: [-29, 6.3, -4.5], yaw: 0 },
      spawns: [],
      // The ticket booth (config/cinema.js ticketBooth, x -26.3..-22, front z -9.4) takes the desk's three windows.
      boxOffice: {
        floorY: 6.3,
        front: -9.4, // the booth's front face (z), facing +Z
        center: -24.15, windowOffset: 1.25, // Sharpening east of the middle, Second Chance west
        promptOut: 0.4, promptHeight: 1.1,
        board: { y: 3.62, height: 0.46, width: 3.7, proud: 0.05 }, // the CUSTOMER SERVICE board above the Box Office header
        labels: { y: 2.18, height: 0.2, proud: 0.02 }, // window labels on the glass
      },
      // The Nail Gun over the east wall's waiting seats (their backs stop at 1.1 m).
      wallBuys: [{ id: 'nailGun', weapon: 'nailGun', at: [-20.32, 8.05, -7.0], normal: [-1, 0, 0] }],
    },
    {
      id: 'parkingLot',
      name: 'Lot Full',
      description: 'Locked out in Customer Parking. Every space is taken.',
      zones: ['parkingLot'],
      pa: { kicker: 'Attention customers', text: 'Customer Parking is now full. Please do not leave your vehicle. Your vehicle is not leaving either.' },
      playerSpawn: { at: [45, 0, 0], yaw: Math.PI },
      // Out of the mall's own doors: inside the entrance vestibule (x 34.45..36.25, z 0.3..4.7).
      spawns: [{ id: 'mallExit', at: [35.4, 0, 2.5] }],
      // Against the north fence (its inside face is z 6), 2 cm off it.
      desk: { along: 'x', center: 40.6, wallAt: 5.98, facing: -1, floorY: 0 },
      restock: { x: 54.5, wallZ: 5.98, facing: -1, floorY: 0 },
      wallBuys: [
        { id: 'foamDartBlaster', weapon: 'foamDartBlaster', at: [45.2, 1.5, 5.92], normal: [0, 0, -1],
          board: { half: [0.7, 0.6], depth: 0.04, gap: 0.02 } },
        { id: 'rivetRifle', weapon: 'rivetRifle', at: [62.24, 1.5, 0.5], normal: [-1, 0, 0],
          board: { half: [0.7, 0.6], depth: 0.04, gap: 0.02 } },
      ],
    },
  ],
};

/** An arena's config by id (undefined for null / an unknown id). */
export const arenaById = (id) => arenas.list.find((a) => a.id === id);
export const ARENA_IDS = arenas.list.map((a) => a.id);
