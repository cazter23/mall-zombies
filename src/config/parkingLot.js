// East of Mega Mart. Ground stays at y=0, including the threshold and sidewalk.
// Tall boxy family vans give solid cover without creating unreachable roof refuges.
const bays = { fromX: 39.5, toX: 60.5, spacing: 3.5, minZ: -15.1, maxZ: -7 };
export const parkingLot = {
  rect: { minX: 34.3, maxX: 62.3, minZ: -24, maxZ: 6 },
  gate: { from: 1, to: 4, height: 3 },
  boundary: { height: 3.4, thickness: .3 },
  sidewalkWidth: 3,
  palette: { asphalt: '#484652', concrete: 0xb8a4a2, wall: 0xd2b7a3,
    stripe: 0xe8bb65, fence: 0x686774, rubber: 0x24232c, glass: 0x344a60, chrome: 0xa5afb4 },
  vehicles: [
    { id: 'family', bay: 0, width: 2.4, length: 5.6, height: 2.2, color: 0x8cb6af, stripe: 0xd7bc8f },
    { id: 'delivery', bay: 2, width: 2.5, length: 5.8, height: 2.45, color: 0xdcc7a1, stripe: 0xb86476 },
    { id: 'abandoned', bay: 4, width: 2.4, length: 5.4, height: 2.2, color: 0x9e677c, stripe: 0xcba6aa },
  ].map(v => ({ ...v, x: bays.fromX + (v.bay + .5) * bays.spacing, z: (bays.minZ + bays.maxZ) / 2 })),
  bays,
  lamps: [
    { x: 38.8, z: -19.8, y: 5.4, color: 0xffd79a, intensity: 24, distance: 20 },
    { x: 59.5, z: 1.5, y: 5.4, color: 0xbfdcff, intensity: 22, distance: 20 },
  ],
  spawns: [
    { id: 'northFence', x: 48, z: 4.9 },
    { id: 'eastFence', x: 61.1, z: -6 },
    { id: 'southFence', x: 53.5, z: -22.8 },
    { id: 'deliveryGate', x: 39.3, z: -22.8 },
  ],
  sky: { radius: 135, center: [25, 0, 0], horizon: 0xe8aa85, zenith: 0x353657 },
  exterior: { clearance: .22, thickness: .16, wall: 0xc5ad9e, trim: 0x628c8c, panelSpacing: 4.5 },
  scenery: {
    ground: { minX: 30, maxX: 125, minZ: -70, maxZ: 65 },
    road: { minX: 70, maxX: 80, minZ: -62, maxZ: 57 },
    crossStreet: { minX: 34.3, maxX: 114, minZ: -36, maxZ: -28 },
    sidewalkWidth: 2, curbHeight: .16,
    trees: [[65, -21], [65, -7], [65, 5], [68, 20], [68, 33], [84, -23], [84, 11],
      [84, 29], [91, 39], [104, -13], [108, 19], [49, -41], [36, -45]],
    shops: [
      { id: 'video', x: 95, z: -15, width: 12, depth: 9, height: 5.2, color: 0xbda4b7, accent: 0x80658e,
        sign: 'REWIND VIDEO', sub: 'BE KIND. REMAIN HERE.', ink: '#ead4f0' },
      { id: 'diner', x: 95, z: 5, width: 13, depth: 10, height: 4.7, color: 0xc8b9a0, accent: 0x629b95,
        sign: 'LAST STOP DINER', sub: 'BREAKFAST SERVED FOREVER', ink: '#f2d6a3' },
      { id: 'auto', x: 97, z: 25, width: 12, depth: 13, height: 5.8, color: 0xaaa6a6, accent: 0xb17b71,
        sign: 'ETERNAL AUTO', sub: 'WE KEEP YOU RUNNING', ink: '#edd3b4' },
    ],
    distantBuildings: [[110, -46, 24, 10, 12], [108, 48, 26, 9, 11], [53, -51, 22, 6, 10]],
    parkedCars: [[86, -12.5, 0x9b7c86], [85, 1, 0x819d9c], [85, 7, 0xc6ad83], [87, 27.5, 0x778b9a]],
    poles: [[82.5, -45], [82.5, -20], [82.5, 8], [82.5, 36]],
    pylon: { x: 65.8, z: -25.2, height: 8.5 },
  },
  benchmark: { name: 'parking lot', from: [38, 1.7, 2.5], to: [59, 1.7, 2.5],
    lookFrom: [49, 2, -12], lookTo: [49, 2, -12] },
  ambience: [
    { id: 'parking_wind', kind: 'wind', zone: 'parkingLot', position: [51, 3, -9], range: 35 },
    { id: 'parking_electrics', kind: 'fluorescentBuzz', zone: 'parkingLot', position: [38.8, 4, -19.8], range: 12 },
  ],
};
