// =============================================================================
// ZOMBIES CONFIG
// Per-type zombie stats and looks, plus crowd and pathfinding settings.
// Health is NOT here: it comes from economy.js (zombieHealthForRound) so it
// scales with the round. Logic in src/zombies/ reads these; never hardcode.
// =============================================================================

export const zombieTypes = {
  // Round-1 zombie: a slow, shambling shopper.
  shopper: {
    id: 'shopper',
    speed: 2.0, // m/s, a shamble: 40% of the player's walking speed (5)
    speedVariation: 0.15, // each zombie gets +/- this fraction so a crowd doesn't move in lockstep
    acceleration: 8, // m/s^2
    turnSpeed: 7, // radians per second it can turn to face where it's going
    radius: 0.32, // collision radius
    height: 1.75, // top of the head

    // Hitboxes (meters, from the feet). The head box is generous on purpose: headshots should feel fair.
    hitbox: {
      bodyHalfWidth: 0.26,
      bodyTop: 1.4,
      headHalfSize: 0.18,
      headBottom: 1.4,
      headTop: 1.78,
    },

    // Timings
    spawnSeconds: 1.0, // rising up out of the floor
    flinchSeconds: 0.15, // recoil when shot
    fallSeconds: 0.45, // tipping over when killed
    corpseSeconds: 3, // lying on the floor before sinking away
    sinkSeconds: 1.2,

    // Looks: each zombie picks random colors from these lists.
    skinColors: [0x9bb08a, 0x8fa37d, 0xa8b894, 0x86a08f], // grey-green
    shirtColors: [0xff6fae, 0x46c2e0, 0xffc93d, 0x9b6bff, 0x58c46b, 0xff8a3d, 0xf2f2f2],
    pantsColors: [0x3b5b8c, 0x2b2b33, 0xb59a6a, 0x5c4a3d], // jeans, black, khaki, brown
    hairColors: [0x3d2b1f, 0x1f1a17, 0xb88a4a, 0x7a7a7a, 0xd94f4f],
    bagColors: [0xc79a5b, 0xff4f9a, 0x2ec4b6], // paper bag, pink boutique, teal boutique
    bagChance: 0.4, // chance to be carrying a shopping bag
    eyeColor: 0x1d1626,
    shoeColor: 0x2b2b2b,
    bagBandColor: 0xf2f2f2,

    // Cartoon splatter (Halo CE style): bright green and purple.
    splatColors: [0x6bdc3c, 0xc4f542, 0x9b4dff],
    deathSplatCount: 30, // extra burst when a zombie dies
  },
};

// Pushing apart so a crowd doesn't stack into one blob.
export const zombieCrowd = {
  separationRadius: 0.8, // meters: zombies closer than this push apart
  separationStrength: 1.2, // how hard they push (relative to walking)
  contactGap: 0.12, // zombies stop this far from the player's body instead of overlapping it
  arriveDistance: 0.5, // they start slowing down this far before reaching the player
  spawnDustColors: [0xb8b0a4, 0xd8cdb8, 0x8a7f72], // floor-tile dust when one rises out of the floor
  spawnDustCount: 18,
  minSpawnDistance: 4, // prefer spawn points at least this far from the player
};

// Flow-field pathfinding on a flat grid (ground floor only, until the navmesh in step 7).
export const zombieNav = {
  cellSize: 0.5, // meters per grid cell
  refreshSeconds: 0.2, // how often the "arrows toward the player" are recalculated
  lookAheadCells: 6, // zombies aim at the furthest visible cell along the path (smoother corners)
  playerSearchRadius: 1.5, // if the player stands somewhere zombies can't (a bench), path to cells this close
  floorTolerance: 0.05, // a box whose top is within this of y=0 counts as floor
};
