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

  // Where zombies get in: the stockroom door in the back wall and a boarded vent in the west wall.
  stockroomDoorX: -9,
  westVentZ: 18,
};
