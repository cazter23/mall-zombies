// =============================================================================
// ZOMBIES CONFIG
// Per-type zombie stats and looks (shopper, mallWalker), plus crowd, spawning and pathfinding settings.
// Which types spawn in which rounds (and their health) is in economy.js -> zombieMix.
// Health is NOT here: it comes from economy.js (zombieHealthForRound) so it
// scales with the round. Logic in src/zombies/ reads these; never hardcode.
// =============================================================================

// Round-1 zombie: a slow, shambling shopper.
const shopper = {
  id: 'shopper',
  speed: 2.0, // m/s, a shamble: 40% of the player's walking speed (5). The base ("walk") gait.
  speedVariation: 0.15, // each zombie gets +/- this fraction so a crowd doesn't move in lockstep

  // Later rounds bring faster zombies (COD-style). Each zombie picks a gait when it spawns, using
  // the chances from the last row whose `fromRound` has been reached. Player walks 5, sprints 8.
  gaits: { walk: 2.0, jog: 3.4, run: 4.6 }, // m/s
  gaitsByRound: [
    { fromRound: 1, walk: 1 },
    { fromRound: 3, walk: 0.7, jog: 0.3 },
    { fromRound: 5, walk: 0.35, jog: 0.65 },
    { fromRound: 7, walk: 0.15, jog: 0.55, run: 0.3 },
    { fromRound: 10, jog: 0.4, run: 0.6 },
    { fromRound: 13, jog: 0.15, run: 0.85 },
  ],
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

  // Attack: wind up (telegraph), swing, then a short recovery before the next one.
  // The hit only lands if the player is STILL in reach and in front when the arms come down.
  // Zombies keep shuffling after you during the wind-up, so just walking away doesn't dodge it.
  attack: {
    startRange: 1.5, // they start an attack this close (center to center; they stop at ~0.8), still walking
    //                  in at full speed: COD-style, they swing on the way in instead of stopping first...
    range: 1.7, // ...and the swing connects out to here (a bit past startRange: they lunge into it, so a
    //             quick hop or step back right as the arms go up isn't a free dodge)
    moveSpeedFraction: 1.0, // walking speed (x their gait speed) during the wind-up and swing: they keep
    //                         stepping straight at you (not to their crowd spot) until they're in your face
    closeInBrakeDistance: 0.15, // ...only braking in the last this-many meters before touching you
    missRecoverSeconds: 0.3, // after a swing that MISSED they try again this soon (no free reset by stepping back)
    turnSpeed: 12, // radians/second they can turn to keep facing you mid-attack (normal turning: turnSpeed)
    windupSeconds: 0.35, // arms raised overhead: the warning in round 1. Short (BO2-style): if a zombie
    //                      reaches you, you're getting hit; the escape is not letting it reach you...
    windupShrinkPerRound: 0.00625, // ...getting this much shorter each round after that...
    minWindupSeconds: 0.3, // ...down to this (reached at round 9)
    slamSeconds: 0.1, // the last part of the wind-up is the slam itself: the arms come down and land
    //                  exactly when the damage is checked (end of the wind-up), so the hit matches what you see
    swingSeconds: 0.15, // follow-through after the hit: arms down, body leaning into it
    recoverSeconds: 0.8, // no new attack for this long after a HIT (it keeps following you)
    damage: 40, // 3 hits from full health (Black Ops 3 style)
    hitHalfAngleDegrees: 60, // player must be within this angle of where the zombie faces
    reachHeight: 1.3, // meters above its feet the arms reach from (a wall in the way blocks the attack;
    //                   anything lower, like a bench or counter, doesn't)
    armsRaisedRadians: 2.3, // arm angle at the top of the wind-up (0 = straight forward)
    armsSlammedRadians: -0.7, // arm angle at the bottom of the swing
  },

  // Shamble animation (visual only)
  walkAnimation: {
    strideLength: 1.0, // meters per full walk cycle (joggers/runners stretch it so legs don't blur)
    legSwing: 0.5, // radians each leg swings forward/back
    armBob: 0.12, // radians the outstretched arms bob
    torsoSway: 0.07, // radians the upper body sways side to side
    headLoll: 0.18, // radians the head lolls side to side
    hunch: 0.15, // radians hunched forward when walking...
    runLean: 0.3, // ...plus this much more for a full-speed runner
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
};

// Round 4+: a power-walking retiree in a matching tracksuit. Fast (outpaces your walk and backpedal,
// not your sprint) but fragile (65% health: economy.zombieMix), a bit slimmer to hit, and WINDED
// after every swing: it stops, hands on knees, panting, then follows at half speed for a moment.
// That pause is your opening. Anything not listed here is the same as the Shopper.
const mallWalker = {
  ...shopper,
  id: 'mallWalker',
  speed: 5.4, // m/s: faster than your walk (5) and backpedal (3.5), slower than your sprint (8)
  speedVariation: 0.06,
  gaits: null, // always power-walks (no walk / jog / run mix)
  gaitsByRound: null,
  acceleration: 12, // m/s^2: snappier than a shopper
  turnSpeed: 8,
  radius: 0.3,
  height: 1.72,
  modelScale: { width: 0.88, height: 0.97 }, // slimmer and a touch shorter than a shopper (the model)...
  hitbox: {
    bodyHalfWidth: 0.22, // ...and the hitboxes match it (harder to hit than a shopper's 0.26)
    bodyTop: 1.36,
    headHalfSize: 0.16,
    headBottom: 1.36,
    headTop: 1.75,
  },
  attack: { ...shopper.attack }, // the same 40-damage slam and wind-up as a shopper

  // After every swing (hit or miss): stands still panting for standSeconds (no attacks), then
  // follows at slowSpeedFraction of its speed for slowSeconds, then it's back to full speed.
  winded: { standSeconds: 1.2, slowSeconds: 0.6, slowSpeedFraction: 0.5 },

  // Power walk (visual only): upright, arms bent at the elbow pumping opposite to the legs, hips twisting.
  walkAnimation: {
    style: 'powerWalk',
    strideLength: 1.6,
    legSwing: 0.6,
    armSwing: 0.75, // radians the arms pump forward/back
    armHang: -1.2, // arm angle at rest (0 = straight forward, -1.57 = straight down)
    elbowBend: 1.5, // radians the forearm bends up at the elbow
    torsoTwist: 0.16, // shoulders twist against the hips with each step
    torsoSway: 0.04,
    headLoll: 0.03,
    hunch: 0.04,
    runLean: 0,
  },
  // Winded pose: bent over, hands on knees, shoulders heaving.
  windedAnimation: { hunch: 0.75, armAngle: -0.85, elbowBend: 0.2, breathRate: 10, breathAmount: 0.06 },

  // Looks: a matching tracksuit (jacket + pants the same color) with white stripes, a headband,
  // wristbands, white sneakers, silver hair, sometimes a fanny pack. No shopping bag.
  hairColors: [0xd9d9d9, 0xbdbdbd, 0xf2f2f2, 0x9a9a9a],
  shoeColor: 0xf2f2f2,
  bagChance: 0,
  outfit: {
    tracksuitColors: [0x2ec4b6, 0x9b6bff, 0xff4f9a, 0x3a6ff0, 0xff8a3d],
    stripeColor: 0xf2f2f2,
    headbandColors: [0xf2f2f2, 0xffd23f, 0xff4f9a, 0x46c2e0],
    wristbandColor: 0xf2f2f2,
    fannyPackColors: [0x1d1626, 0xffd23f, 0x46c2e0, 0xff4f9a],
    fannyPackChance: 0.6,
  },

  // Shown (with a PA chime) the first time one spawns in a run.
  introBanner: { kicker: 'Attention shoppers', text: 'Mall Walkers have entered the building' },

  // Sounds (config/audio.js) so you hear one coming: squeaky sneakers and huffing while it chases,
  // panting when winded. Louder the closer it is; silent past maxDistance meters.
  sounds: {
    step: { name: 'walkerSqueak', interval: 0.5, chance: 0.45, maxDistance: 14 },
    huff: { name: 'walkerHuff', interval: 1.3, maxDistance: 12 },
    winded: { name: 'walkerPant', maxDistance: 14 },
  },
};

export const zombieTypes = { shopper, mallWalker };

// How a crowd moves together: spacing, queueing, spreading out, surrounding the player.
export const zombieCrowd = {
  // Sounds from several zombies at once: the same sound never plays twice within this many seconds.
  soundMinGapSeconds: 0.15,

  // Spacing: zombies closer than separationRadius push apart, much harder the closer they get.
  separationRadius: 1.1, // meters, center to center (two zombies touch at 2 x radius = 0.64)
  separationStrength: 1.6, // push strength (x walking speed) when almost touching
  maxCrowdSpeed: 1.35, // a shove can move a zombie up to this x its own speed
  minSpacing: 0.66, // hard rule: centers never closer than this (overlaps are resolved after moving)
  maxSeparationPush: 3, // cap on one neighbour's push (x a normal push), so a pile-up can't fling anyone

  // Lanes: each zombie walks a personal line offset sideways from the shared route, so a horde
  // spreads across a doorway instead of filing through one spot. Offsets fade out near the player.
  laneMaxOffset: 0.9, // meters, each zombie picks a random offset in +-this
  laneFadeDistance: 3, // offsets shrink to nothing over this many meters before the surround radius
  lookAheadMin: 4, // each zombie looks this many..
  lookAheadMax: 8, // ..to this many cells down the route (different corner-cutting per zombie)

  // Queueing: a zombie with another zombie close ahead slows down and steps around it
  // instead of pushing into its back (which is what makes conga lines).
  queueDistance: 1.3, // meters: "close ahead"
  queueConeDegrees: 35, // how directly ahead it must be
  queueSlowdown: 0.65, // up to this much slower when right behind another zombie
  queueSidestep: 0.7, // how hard it steps around (x walking speed)

  // Surround (COD-style): near the player, each zombie claims its own spot on rings around them,
  // so a crowd fans out and boxes you in instead of piling up behind one another.
  surroundRadius: 4.5, // meters: zombies closer than this (with a clear line) take a slot
  surroundRings: 3, // inner ring at arm's length, then rings every ringSpacing further out
  surroundRingSpacing: 0.75,
  surroundSlotSpacing: 0.76, // meters between neighbors on a ring (a bit more than shoulder width)
  circleMargin: 0.2, // a zombie whose slot is on your far side circles around you this far outside arm's reach
  circleLastStretch: 0.85, // ...unless you're only "in the way" in the last 15% of its path to the slot
  circleLastStretchMeters: 0.6, // ...or it's already this close to the slot
  // While you keep moving, a zombie may only take a spot on the side it came from (within this
  // angle of its own direction from you), so a horde chasing you from one side stays a dense horde
  // behind you (BO2-style). Zombies from different directions still surround you.
  surroundSectorDegrees: 50,
  // Stand still (slower than playerStillSpeed m/s) for wrapAfterStillSeconds and they start
  // wrapping around you, reaching the full circle over wrapSeconds.
  playerStillSpeed: 0.6,
  wrapAfterStillSeconds: 1.0,
  wrapSeconds: 1.5,

  contactGap: 0.12, // zombies stop this far from the player's body instead of overlapping it
  arriveDistance: 0.5, // they start slowing down this far before reaching the player (or their slot)
  spawnDustColors: [0xb8b0a4, 0xd8cdb8, 0x8a7f72], // floor-tile dust when one rises out of the floor
  spawnDustCount: 18,
  minSpawnDistance: 4, // require spawn points at least this far horizontally from the player
};

// New spawns follow the player without requiring additional authored map zones.
export const zombieSpawn = {
  neighbourhoodCostAllowance: 30, // eligible routes may cost this much more than the cheapest one
  nearestCount: 4, // nearby branch picks randomly among this many lowest-cost markers
  nearbyChance: 0.5, // otherwise pick randomly across the local neighbourhood
  clearanceGap: 0.25, // extra meters beyond both body radii; rising zombies reserve their full body
  reuseCooldownSeconds: 3, // prefer other local markers; relax only if all safe local ones are cooling
};

// Flow-field pathfinding on a flat grid (ground floor only, until the navmesh in step 7).
// Stuck-zombie failsafe (like BO3's round_spawn_failsafe): a zombie far from the player that has
// barely moved, or can't reach them, rises again at a spawn point with the same health.
export const zombieFailsafe = {
  checkSeconds: 10, // how often each zombie is checked
  minMoveMeters: 1.0, // moved less than this since the last check = stuck
  ignoreWithinMeters: 5, // zombies this close to the player are never rescued (crowding/attacking is fine)
  fallOutHeight: -10, // below this, rescued straight away
};

export const zombieNav = {
  cellSize: 0.5, // meters per grid cell
  refreshSeconds: 0.2, // how often the "arrows toward the player" are recalculated
  extraClearance: 0.3, // routes prefer to stay this much further from walls (soft: still passable)...
  wallPenalty: 0.6, // ...because walking those cells costs this much extra
  playerSearchRadius: 1.5, // if the player stands somewhere zombies can't (a bench), path to cells this close
  floorTolerance: 0.05, // a box whose top is within this of y=0 counts as floor
};
