// =============================================================================
// CONCOURSE: the things that make the Sunset Galleria read as a real 1986 mall rather than pastel corridors
// (maps/mall/concourse.js builds all of it; decoration only, except the few floor fixtures with colliders noted below).
// Every position is in metres (x, z on the plan; y above the floor the thing stands on). Walls: 'north' faces -Z,
// 'south' faces +Z (the side of the room the wall is on).
// =============================================================================

// One sign style for every new wayfinding sign (the stairwell's level marks use it too), so the mall's directions
// look like one system.
export const wayfinding = { background: '#2b2233', color: '#ffd6ec', font: 'Arial, "Helvetica Neue", sans-serif' };

export const concourse = {
  // --- SHOPFRONTS: sealed shops in a run (Level 2), each: pilasters, a header with its name, glass, a painted interior
  // behind it, a blade sign hanging out over the door, and light spilling onto the floor in its own colour (cool for
  // electronics, warm for a boutique). kind = what the painted interior shows (world/paintedInteriors.js).
  // gate = how far the roller gate is down (0 = up, 1 = shut); lit = lights on inside.
  shopfronts: {
    depth: 0.26, // how far the front stands off the wall (under the player's 0.35 m radius: no collider needed)
    top: 2.9, // header top, above the floor
    header: 0.42, // header band height
    sill: 0.32, // the kick plate under the glass
    pilaster: 0.22,
    blade: { width: 0.95, height: 0.36, out: 0.35, y: 2.22 }, // hangs out of the wall over the door end (its bracket clear of the header's underside)
    spill: { depth: 2.4, strength: 0.5 }, // the light on the floor in front of a lit shop
    level2: [
      { id: 'cassetteCity', wall: 'south', from: -4.1, to: 1.0, name: 'CASSETTE CITY', sub: 'RECORDS · TAPES · REWIND FEES', kind: 'music',
        color: 0x2b3f6b, ink: '#9fe3ff', light: 0x8fd8ff, lit: true, gate: 0 },
      { id: 'glamour', wall: 'south', from: 1.4, to: 7.2, name: 'GLAMOUR PORTRAITS', sub: 'SMILE. FOREVER.', kind: 'photo',
        color: 0x7a3f6b, ink: '#ffd1ec', light: 0xffb8d8, lit: true, gate: 0.35 },
      { id: 'earResistible', wall: 'south', from: 17.0, to: 19.8, name: 'EAR-RESISTIBLE', sub: 'PIERCING · NO REFUNDS', kind: 'jewelry',
        color: 0xb08a3a, ink: '#fff0c0', light: 0xfff0c0, lit: false, gate: 1 },
      { id: 'keysCut', wall: 'north', from: -12.5, to: -10.25, name: 'KEYS CUT', sub: 'NONE RETURNED', kind: 'keys',
        color: 0x3a5a40, ink: '#d8ffd0', light: 0xd8ffd0, lit: true, gate: 0, note: 'BACK IN 5 MINUTES' },
    ],
  },

  // --- DISPLAY WINDOWS: the hallway faces of the two Food Court pod stores get a lit window onto the concourse.
  vitrines: [
    { id: 'byteMeWindow', wall: 'south', from: 11.9, to: 15.3, sill: 0.55, top: 2.0, kind: 'electronics', light: 0x9fdcff,
      name: 'BYTE ME ELECTRONICS', frame: 0x1f2a44 },
    { id: 'toysWindow', wall: 'south', from: -13.35, to: -10.9, sill: 0.55, top: 2.0, kind: 'toys', light: 0xffd9a0,
      name: 'PLAY TIME TOYS', frame: 0x8a3b5c },
  ],

  // --- THE MALL SECTION: soffits (lowered bulkheads) along Level 2's long walls make the middle read raised, with the
  // pink trim tube moved to their front edge and a cove of light washing the ceiling past it; a cornice tops the hallway.
  soffits: {
    level2: { bottom: 3.0, depth: 1.0, color: 0xf7e6da, trimInset: 0.05,
      // (spans along each wall; gaps where a storefront's own header is taller: the Build-A-Blaster front)
      north: [[-20, -3.7], [3.7, 20]], south: [[-20, 20]],
      cove: { width: 1.4, strength: 0.18, color: 0xffc8a0 } },
    hallway: { bottom: 5.6, depth: 0.5, color: 0xf7f3ee, north: [[-20, 20]], south: [[-20, 20]] },
  },

  // --- FLOORS: a border band of contrasting terrazzo along the long walls, sunset medallions at the junctions, and a
  // worn walking lane (a faint dark smudge where forty years of feet went).
  floor: {
    bands: [
      { area: 'hallway', y: 0, wall: 'north', z: 6, from: -20, to: 20, width: 0.55, tile: { base: '#cdbde3', grout: '#ec9fc4', variation: 10, seed: 71 } },
      { area: 'hallway', y: 0, wall: 'south', z: -2, from: -20, to: 20, width: 0.55, tile: { base: '#cdbde3', grout: '#ec9fc4', variation: 10, seed: 72 } },
      { area: 'level2', y: 6.3, wall: 'south', z: -4.5, from: -20, to: 20, width: 0.55, tile: { base: '#efd8c6', grout: '#8a5f86', variation: 8, seed: 73 } },
    ],
    bandLift: 0.006, // band top above the floor surface it sits on (pools sit at 0.012: never the same plane)
    medallions: [
      { area: 'hallway', x: 0, y: 0, z: 2, radius: 1.35 },
      { area: 'foodCourt', x: 0, y: 0, z: -5.3, radius: 1.2 },
      { area: 'level2', x: 0, y: 6.3, z: 4.75, radius: 1.0 },
    ],
    medallionLift: 0.016, // (above the painted pools at 0.012 and the lanes: never sharing a plane)
    lanes: [ // worn walking lanes: x0, z0, x1, z1 on floor y
      { y: 0, x0: -3.5, z0: 0.7, x1: 19.5, z1: 3.3 },
      { y: 0, x0: -1.4, z0: -13.5, x1: 1.4, z1: -2.4 },
      { y: 6.3, x0: -19.5, z0: -3.6, x1: 19.5, z1: -1.4 },
    ],
    laneLift: 0.003, laneOpacity: 0.07,
  },

  // --- PAINTED LIGHT: a soft pool on the floor under every lit ceiling panel, and a reflection streak under every neon
  // sign on a shiny floor (roughness <= glossy). Each is one merged mesh, following Graphics > Neon glow.
  glow: {
    panels: { scale: 2.4, strength: 0.13, color: 0xfff0dc, lift: 0.009 },
    reflections: { depth: 2.3, strength: 0.3, glossy: 0.6, lift: 0.010, widthScale: 1.05 },
  },

  // --- FIXTURES at a steady rhythm: the 1986 basics. Wall pieces stand under 0.3 m off the wall (no collider needed);
  // floor pieces get small colliders like the trash cans (<= 1.1 m, vaultable or solid).
  fixtures: {
    ceilingRows: [ // speakers (the PA), smoke detectors and sprinkler heads down a ceiling: x from..to every `every` m at z, ceiling y
      { y: 6, z: 4.6, from: -15, to: 15, every: 6 },
      { y: 6, z: -0.6, from: -15, to: 15, every: 6 },
      { y: 9.9, z: 0.75, from: -18, to: 12, every: 6 },
      { y: 6, z: -8.3, from: -16, to: 16, every: 8 },
    ],
    fountain: { wall: 'west', x: -20, z: 4.6, name: 'RESTROOMS →', signZ: 4.6 }, // beside the Service Corridor door (z 0.5..3.5)
    atm: { wall: 'south', x: 6.4, z: -2, width: 0.7 },
    pullStations: [ // red fire alarm pulls by the exits: wall, x, z (on the wall plane), y 1.2
      { wall: 'west', x: -20, z: 0.1 }, { wall: 'east', x: 20, z: -1.4 }, { wall: 'south', x: -3.9, z: -2 },
    ],
    pillarWraps: { from: 0.9, to: 2.5, color: 0xd6dde4 }, // mirrored wraps on the Food Court pillars
    ashtrays: [ // sand-topped urns at the Level 2 bench ends: x, y, z
      [-9.3, 6.3, -4.15], [-6.7, 6.3, -4.15], [14.9, 6.3, -4.15],
    ],
    kiddieRide: { x: 9.3, z: 18.6, yaw: Math.PI / 2 }, // Atrium west arcade, between the west vent (z 16) and the wall buy: a coin-op rocket (solid, 1.1 m)
    gumball: { x: 9.3, z: 19.75 }, // beside it (solid to 1.1 m, the globe above is see-through glass)
  },

  // --- SIGNS OF AN AFTERNOON THAT NEVER ENDED: little hand-placed stories.
  stories: {
    trays: [[-9, -6.5], [5.5, -7.5], [9, -9.5]], // Food Court table tops (x, z): half-eaten meals on red trays
    stroller: { x: -16.1, z: -0.9, yaw: 0.4 },
    mopBucket: { x: -19.2, y: 6.3, z: 5.2 },
    balloons: [[13.5, 13.5, 0xff6fae], [21.5, 11.5, 0x9fe3ff], [26.5, 22.5, 0xffd23f], [17, 25, 0xc9b6e4]], // stuck to the skylight
    registerDrawer: true, // one Mega Mart till left open
  },

  // --- THE CAMPAIGN: one mall-wide promotion, so the cheer looks like management, not random signs. Vertical pennants
  // hang down the concourses (one texture, one merged mesh per area), the same art on two posters and the parking
  // poles, and a Christmas garland nobody took down.
  campaign: {
    title: 'FALL INTO', title2: 'SAVINGS', year: "'86", tag: 'SUNSET GALLERIA',
    colors: { top: '#ffb38a', bottom: '#c9b6e4', sun: '#ff6f91', ink: '#3a2140' },
    pennant: { width: 0.7 },
    pennants: [ // x, top y, z (they hang 0.1 m below the ceiling)
      { area: 'hallway', y: 5.96, z: 4.75, xs: [-12, -6, 6, 12], height: 1.5 },
      { area: 'hallway', y: 5.96, z: -0.75, xs: [-12, -6, 6, 12], height: 1.5 },
      { area: 'level2', y: 9.86, z: 0.75, xs: [-13.5, 3.5], height: 1.15 },
    ],
    posters: [
      { x: -19.97, y: 2.2, z: -9.5, facing: 'x+', width: 1.1, height: 1.5 }, // Food Court west wall
    ],
    garlands: [ // swags draped on the Level 2 balcony rails (walkway side): x0..x1 at z, from the rail top y, sag per swag
      { x0: -9.5, x1: -1.5, z: 0.27, y: 7.32, sag: 0.26, swag: 2 },
      { x0: 2.5, x1: 10, z: 0.27, y: 7.32, sag: 0.26, swag: 2.5 },
    ],
  },

  // --- WAYFINDING: a directory totem (YOU ARE HERE on both faces) and level marks at the Atrium escalator.
  totems: [
    { x: 10.6, z: 8.4, yaw: 0 }, // Atrium, just inside the hallway gate (west side of the gate lane)
  ],
};
