// Decoration kit + clutter scatter (world/decor.js, world/scatter.js). Cosmetic only: nothing here
// collides, pays, spawns or blocks. Distances in metres. Colours are hex (sRGB), written as vertex colours.
export const decor = {
  // Most triangles one model variant may have (tests check every variant against it).
  triangleBudget: 240,
  // Per-triangle brightness variation on solid parts (+-), for a hand-made low-poly look.
  shadeVariation: 0.08,

  // The kit's shared materials. Every model part names one of these; a scatter merges by material.
  materials: {
    solid: { roughness: 0.85, metalness: 0 },
    shiny: { roughness: 0.35, metalness: 0.55 },
    decal: { roughness: 0.15, metalness: 0, opacity: 0.72, polygonOffset: -2 },
    glass: { roughness: 0.05, metalness: 0.1, opacity: 0.45 },
  },

  // weight = how often a scatter picks it (when `kinds` gives no weights); scale = random uniform scale range.
  kinds: {
    receipts: { weight: 4, scale: [0.85, 1.25] },
    shoppingBag: { weight: 2, scale: [0.85, 1.15] },
    popcorn: { weight: 1.5, scale: [0.9, 1.1] },
    sodaCup: { weight: 2, scale: [0.9, 1.15] },
    cardboardBox: { weight: 2, scale: [0.8, 1.2] },
    cautionTape: { weight: 1, scale: [0.9, 1.1] },
    fallenSign: { weight: 0.5, scale: [0.85, 1.1] },
    overturnedChair: { weight: 1, scale: [0.95, 1.05] },
    ceilingTile: { weight: 1.5, scale: [0.9, 1.1] },
    puddle: { weight: 2, scale: [0.7, 1.3] },
    trashPile: { weight: 1, scale: [0.85, 1.15] },
    mannequinParts: { weight: 0.75, scale: [0.95, 1.05] },
    coins: { weight: 1.5, scale: [0.9, 1.2] },
    cassettes: { weight: 1.25, scale: [0.9, 1.15] },
    brokenGlass: { weight: 1.5, scale: [0.8, 1.2] },
  },

  scatter: {
    defaultDensity: 'full', // 'none' | 'some' | 'full'
    perSquareMeter: 0.12, // items per m2 of area at 'full'
    someFraction: 0.4, // share of the 'full' items that 'some' keeps (always the same ones)
    margin: 0.05, // extra gap kept from colliders and keepClear rects
    spacing: 1, // two items stay (radius + radius) x spacing apart; 0 lets them overlap
    attemptsPerItem: 14, // random tries per wanted item before giving up
    floorTolerance: 0.06, // a collider whose top is this close to the floor height is floor, not an obstacle
    headroom: 0.05, // an overhead collider must clear the item's height by this much
    lift: 0.001, // every item sits this far above the floor
    decalLift: 0.004, // flat stains/puddles: base lift ...
    decalLiftStep: 0.0012, // ... plus this x (index % decalLiftSteps), so overlapping decals never z-fight
    decalLiftSteps: 5,
    chunkSize: 8, // with maxDistance, items batch per chunkSize x chunkSize cell so far cells can be hidden
  },

  palette: {
    paper: [0xf2ead8, 0xe9dfc8, 0xf6d6e2, 0xdfe9ef],
    kraft: [0xb88a55, 0xa77b48, 0xc39a66],
    tape: 0xd8c08a,
    bags: [0xff4fa3, 0x2ec4c6, 0x8a5cf6, 0xf2c14e, 0x24233a],
    bagTrim: 0xfdf6ec,
    popcornRed: 0xd8343f,
    popcornWhite: 0xf6efe3,
    kernel: [0xf7e3a1, 0xf3d27a, 0xfff4cf],
    cups: [[0xff4fa3, 0x2ec4c6], [0x8a5cf6, 0xf2c14e], [0x2ec4c6, 0xfdf6ec]],
    lid: 0xf4f1ea,
    straw: 0xff6b9a,
    caution: 0xf4d23c,
    cautionBlack: 0x1d1c1a,
    cone: [0xff7a1a, 0xf6efe3],
    signPanel: [0x2a1446, 0x0f3b48],
    neon: [0xff3fb4, 0x3ff2ff, 0xffe45c],
    signMetal: 0x5f6470,
    chairSeat: [0xff7a3d, 0x2ec4c6, 0xd94fd0],
    chrome: 0xb9c2c9,
    ceilingTile: 0xe7e1d2,
    waterStain: 0xb8a172,
    puddles: { water: 0x2d3a48, soda: 0x4a2412, goo: 0x5fd35a, gooRim: 0x7b3fa0 },
    trashBags: [0x1c1d22, 0x23302a, 0x2a2238],
    tie: 0xf2c14e,
    cans: [0xd8343f, 0x2ec4c6, 0x8a5cf6],
    plastic: 0xe9dccb,
    joint: 0x8f8579,
    paint: 0x2a1b1b,
    coins: [0xd9b44a, 0xc7ccd1],
    bill: 0x7fa86b,
    cassette: [0x1b1b22, 0xff8fc7, 0x3a3f8f],
    label: [0xf6efe3, 0xffe45c, 0x3ff2ff],
    ribbon: 0x3b2618,
    glass: 0xbfe8ff,
    frame: 0x7a828a,
  },
};
