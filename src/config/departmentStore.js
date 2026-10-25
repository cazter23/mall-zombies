// =============================================================================
// HOFFMAN'S · Est. Forever: the department store north of the hallway's west half (maps/mall/departmentStore.js builds
// it). Absolute map coordinates in metres, +Y up. Its gate is in the hallway's north wall; its east wall above the start
// room's is its own (the start room is 4m tall, the store 5m). Door prices are in economy.doors, never here.
// =============================================================================

export const departmentStore = {
  // The sales floor: west of the start room, north of the hallway, under open sky (nothing upstairs here: the Promenade's
  // shoe store and the cinema are both outside this rect).
  rect: { minX: -20, maxX: -5.3, minZ: 6.3, maxZ: 26 },
  height: 5,
  // Its gate in the hallway's north wall (west end, clear of the SUNSET GALLERIA centrepiece at x -11).
  gate: { from: -19.5, to: -15.5, height: 3 },
  // The hallway's north-west boarded vent (a spawn) moves here, between the centrepiece and the start room, for the gate.
  hallwayVentX: -7,

  colors: {
    wall: 0xf1e4d0, // warm cream
    ceiling: 0xfbf3e8,
    floor: { base: '#e8d9c4', grout: '#c3a78a', variation: 9, seed: 61 }, // pale marble-look tile
    serviceDoor: 0x8c2f45, // burgundy
  },

  // Point lights (the light pool and the horror layer handle them like every other lamp): ~60% of the ceiling height.
  lamp: { color: 0xffeccf, intensity: 24, distance: 20 },
  lamps: [{ x: -12.6, z: 11.5 }, { x: -12.6, z: 20.8 }],
  // Ceiling light panels (x, z centres), 2.4 x 1.2 m; dead = a burnt-out one.
  panels: [
    { x: -16.5, z: 10 }, { x: -9, z: 10 },
    { x: -16.5, z: 16.5, dead: true }, { x: -9, z: 16.5 },
    { x: -16.5, z: 23 }, { x: -9, z: 23 },
  ],

  // Where zombies get in: the stockroom door in the back wall, a boarded vent in the west wall, and out of the fitting rooms.
  stockroomDoorX: -9,
  westVentZ: 18,

  // --- Fixtures (the layout you fight in) --------------------------------------------------------------------------------
  // The rule: counters are VAULTABLE (0.95 m, under feel.vault.maxHeight); everything else is solid to at least
  // tallMinHeight, because a jump from a counter top peaks about 2.0 m up (0.95 + the 1.05 m jump): nothing to perch on.
  tallMinHeight: 2.1,
  // Front: cosmetics and fragrance counters (glass cases on cabinets) you can vault. x0..x1 along the room, z the centre.
  counters: [
    { x0: -14.6, x1: -11.6, z: 10, name: 'COSMETICS', glow: 0xffb3c7 },
    { x0: -10.6, x1: -7.6, z: 10, name: 'FRAGRANCE', glow: 0xd8c2ff },
  ],
  counterHeight: 0.95,
  counterDepth: 0.8,
  // Mannequins on low plinths: the plinth is a step (0.3 m), the figure is solid to tallMinHeight.
  mannequins: [
    { x: -17.6, z: 11.6, yaw: 0.5, pose: 'hip' },
    { x: -12.6, z: 12.8, yaw: -0.3, pose: 'wave' },
    { x: -17.6, z: 21.4, yaw: -0.4, pose: 'point' },
  ],
  plinth: { size: 0.8, height: 0.3, body: 0.46 }, // body = the figure's collision square
  // Round clothing racks: the clothes are solid to rackHeight (they stop bullets), the sale topper pole above them is a
  // see-through collider (bullets pass) up to tallMinHeight.
  racks: [
    { x: -16.6, z: 15.2 }, { x: -12.6, z: 15.2 }, { x: -8.6, z: 15.2 },
    { x: -16.6, z: 18.6 }, { x: -12.6, z: 18.6 }, { x: -8.6, z: 18.6 },
  ],
  rackRadius: 0.62,
  rackHeight: 1.35,
  rackColors: [0xc1121f, 0xf4a259, 0x5b8e7d, 0x8c2f45, 0xf1e4d0, 0x3d5a80, 0xe5989b, 0x2b2d42],
  // Back: three fitting rooms (one solid block against the north-west corner; zombies come out of the middle curtain),
  // the shoe wall along the east wall, and the LAYAWAY counter (vaultable).
  fittingRooms: { x0: -20, x1: -14.2, depth: 2.4, height: 2.4, booths: 3, curtain: 0x8c2f45 },
  shoeWall: { z0: 17.6, z1: 25.6, depth: 0.5, height: 2.2 },
  layaway: { x0: -13.4, x1: -10.4, z: 22.4 },
};
