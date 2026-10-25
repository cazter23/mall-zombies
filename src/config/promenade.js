// Upstairs owns its footprint independently of the hallway below. Add adjoining
// sections/rooms and declare their shared wall openings when extending the wing.
export const promenade = {
  rect: { minX: -20, maxX: 20, minZ: -4.5, maxZ: 6 },
  slabThickness: .3,
  wallThickness: .3,
  sections: [
    { id: 'promenade', minX: -20, maxX: 20, minZ: -4.5, maxZ: 6 },
    { id: 'shoePer', minX: -10.3, maxX: -3.7, minZ: 6, maxZ: 11.6 },
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
  expansionConnections: [
    { id: 'westWing', wall: 'west', from: -4.1, to: -1.7, top: 2.7, label: 'WEST WING · FUTURE EXPANSION' },
    { id: 'eastWing', wall: 'east', from: -4.1, to: -1.7, top: 2.7, label: 'EAST WING · FUTURE EXPANSION' },
    { id: 'workshop', wall: 'north', from: -1.3, to: 1.3, top: 2.7, label: 'COMING SOON' },
  ],
};
