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
    { fromRound: 7, walk: 0.25, jog: 0.65, run: 0.1 },
    { fromRound: 9, walk: 0.15, jog: 0.55, run: 0.3 },
    { fromRound: 11, jog: 0.4, run: 0.6 },
    { fromRound: 14, jog: 0.15, run: 0.85 },
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

// Round 6+: a shopper welded to a wobbly shopping cart. Walks like a Shopper (and swings like one up close),
// but with a clear, wide lane to you at mid range it TELEGRAPHS (stops, rattles the cart, squeals the wheels,
// head down), then CHARGES in a straight line. The direction locks at the end of the telegraph, so a sidestep
// dodges it. A miss means it overshoots and crashes (into a wall or skids out): stunned over its cart and taking
// extra damage. That's your opening. Tanky (1.8x health: economy.zombieMix). Anything not listed = the Shopper.
const cartPusher = {
  ...shopper,
  id: 'cartPusher',
  speed: 2.0, // walks at a shopper's shamble...
  speedVariation: 0.08,
  gaits: { walk: 2.0, jog: 3.0 }, // ...and at most a brisk trot behind the cart (the charge is the fast part)
  gaitsByRound: [
    { fromRound: 1, walk: 1 },
    { fromRound: 10, walk: 0.5, jog: 0.5 },
  ],
  acceleration: 6, // heavy: slower to get going than a shopper
  turnSpeed: 4, // and slow to turn with a cart in front
  radius: 0.42, // the body plus the cart's back end (the cart's nose is checked separately while charging)
  attack: { ...shopper.attack }, // up close: the normal 40-damage slam (over the cart handle)

  charge: {
    minRange: 5, // meters: only charges from at least this far...
    maxRange: 14, // ...and no further than this
    laneHalfWidth: 0.8, // the lane must be clear this far either side of the line (a 1.6 m wide cart lane)...
    laneCheckHeight: 0.3, // ...at this height (benches, stools and counters block it, not just walls)
    telegraphSeconds: 0.9, // stands still rattling the cart, aiming at you; the direction LOCKS at the end
    telegraphTurnSpeed: 6, // radians/second it can track you during the telegraph
    speed: 9, // m/s, faster than your sprint (8), but dead straight
    acceleration: 30, // m/s^2: gets up to speed in ~0.3 s
    overshootMeters: 3, // keeps going this far past where you stood when it locked on...
    maxMeters: 16, // ...but never further than this in one charge
    noseReach: 1.2, // meters in front of its feet the cart's nose sticks out (hits walls first; matches the model)
    hitPadding: 0.3, // you're hit if your body comes within this of the cart's nose...
    hitHalfWidth: 0.55, // ...and within this of its centre line (the cart is 0.56 wide: +0.27 of forgiveness)
    damage: 60, // two hits from full health
    knockback: 7, // m/s shove along the charge
    checkSeconds: 0.25, // how often a chasing cart pusher looks for a charge lane (rays vs the colliders)
    hitRecoverSeconds: 1.0, // after hitting you: stops, then carries on
    crashSeconds: 2.0, // after a miss: stunned over its cart (no attacks, can't move)...
    crashDamageTakenMultiplier: 1.5, // ...and hits on it do this much more damage
    cooldownSeconds: 4, // after any charge before it may charge again (it can still slam up close)
  },

  // Looks: the cart (visual only). Wire basket + child seat flap + handle + four casters.
  cart: {
    frameColor: 0xc9ccd1, // chrome
    handleColor: 0xe0313a, // red plastic handle grip
    bumperColor: 0x2b2b33,
    wheelColor: 0x1d1d22,
    contents: [0xffc93d, 0x46c2e0, 0xff6fae, 0x58c46b, 0xff8a3d, 0xf2f2f2], // a few boxes rattling around inside
    contentsCount: [1, 3], // min / max
    width: 0.56,
    depth: 0.8,
    basketBottom: 0.45,
    basketTop: 0.95,
    handleY: 1.0,
    handleZ: -0.32, // meters in front of the feet (where the hands grip it)
  },
  // Pose while pushing (visual only): arms out to the handle, leaning in.
  cartAnimation: {
    armAngle: -0.62, // radians (0 = straight forward, -1.57 = straight down)
    hunch: 0.3,
    telegraphShake: 0.05, // radians the cart rattles side to side during the telegraph
    telegraphCrouch: 0.35, // extra lean (head down) at the end of the telegraph
    chargeLean: 0.55,
    crashTilt: 0.45, // radians the cart tips onto two wheels when it crashes
    crashSlump: 0.7, // the body slumps over the handle
  },

  // Hitboxes that follow the pose (zombies/cartPose.js): the head box moves with the lean (headReach = pivot at the hips
  // to the head centre, torsoShare = how far the torso box follows it), and while it is crashed the tipped cart is a
  // target too (a box from cartFrom to cartTo metres ahead, cartHalfWidth either side, cartBottom..cartTop high).
  cartHitbox: { headReach: 0.79, torsoShare: 0.5, cartFrom: 0.2, cartTo: 1.25, cartHalfWidth: 0.34, cartBottom: 0.05, cartTop: 1.05 },

  introBanner: { kicker: 'Attention shoppers', text: 'There is a cart pusher loose. Please step out of the aisle.' },

  // Squealing wheels while it rolls; a rattle + squeal on the telegraph (the warning); a crash on a miss.
  sounds: {
    step: { name: 'cartSqueak', interval: 0.7, chance: 0.5, maxDistance: 14 },
    telegraph: { name: 'cartRattle', maxDistance: 24 },
    crash: { name: 'cartCrash', maxDistance: 24 },
  },
};

const mannequin = {
  ...shopper, id: 'mannequin', speed: 5.8, speedVariation: 0,
  gaits: null, gaitsByRound: null, acceleration: 16,
  observation: { releaseSeconds: .3, edgePadding: 2, edgeReleasePadding: 5, sampleHeights: [1.6, 1.1] },
  attack: { ...shopper.attack, windupSeconds: .45, minWindupSeconds: .45,
    windupShrinkPerRound: 0, recoverSeconds: 1, missRecoverSeconds: 1 },
  plastic: { color: 0xe9dfc8, jointColor: 0x6b6464, tagColor: 0xc45177, roughness: .32 },
  splatColors: [0xe9dfc8, 0xcfc3aa],
  sounds: { step: { name: 'mannequinStep', interval: .4, chance: 1, maxDistance: 16 },
    release: { name: 'mannequinClick', maxDistance: 20 } },
  introBanner: { kicker: 'Display advisory', text: 'Mannequins move when you look away. Keep them in sight.' },
};
// Round 10+: the MASCOT. One zombie slot (economy.zombieMix.mascot: share, maxAlive, intro) wearing one of several
// costumes (mascotVariants below). Every costume shares this foam body, its rig and the three beats: an armoured
// approach -> the helmet pops off at half health -> it shakes, then rushes. A costume brings its own looks and lines,
// and changes ONE beat (its tuning block: reclaim, popBlast, melt, saltPatch). Shared numbers live here; a costume's own in its entry.
export const mascotFoamColors = [0xfff1cd, 0xfff9eb, 0xe6d9b9];
const mascotHipY = 0.72;
const mascotTorso = { size: [0.72, 0.68, 0.52], at: [0, 0.34, 0] };
const mascotBase = {
  ...shopper,
  id: 'mascot',
  speed: 1.35,
  speedVariation: 0.04,
  gaits: null,
  gaitsByRound: null,
  acceleration: 4,
  turnSpeed: 3.5,
  radius: cartPusher.radius, // keep the shared navigation clearance; the foam extends beyond the collider
  hitbox: { bodyTop: mascotHipY + mascotTorso.at[1] + mascotTorso.size[1] / 2 }, // death burst origin
  attack: { ...shopper.attack, damage: 50, windupSeconds: 0.55, minWindupSeconds: 0.45 },
  plastic: { roughness: 0.95 }, // EVA foam, uses the existing non-flesh death effects (each head brings its foam colour)
  splatColors: mascotFoamColors,
  deathSplatCount: 42,
  sounds: {
    step: { name: 'mascotThump', interval: 0.58, chance: 1, maxDistance: 18 },
    headPop: { name: 'mascotHeadPop', maxDistance: 26 },
    howl: { name: 'mascotHowl', maxDistance: 26 },
  },
  mascot: {
    healthFraction: 0.5,
    exposedSpeed: 5.6,
    exposedAcceleration: 15,
    exposedTurnSpeed: 8,
    hitKnockbackScale: 0.35,
    // The warning: when the helmet comes off it stands and shakes with its arms up, then rushes.
    rage: { seconds: 0.6, shake: 0.14, shakeRate: 42 },
    // The fallen helmet sits on the floor until the round ends, turning to face you. Only so many stay: each is a couple of dozen draw calls.
    leftHelmets: { max: 3, turnSpeed: 1.2, settleSeconds: 0.35, wallMargin: 0.55, rayHeight: 0.5 },
    // Model dimensions in meters. Each solid piece supplies its own hitbox. (The helmet is the costume's `head`.)
    spawnDepth: 2.36,
    hipY: mascotHipY,
    legX: 0.19,
    shoulder: [0.43, 0.55, 0],
    exposedHead: { size: [0.32, 0.37, 0.32], at: [0, 0.865, 0] },
    torso: mascotTorso,
    thigh: { size: [0.30, 0.62, 0.32], at: [0, -0.31, 0] },
    boot: { size: [0.35, 0.21, 0.53], at: [0, -0.615, -0.08] },
    sleeve: { size: [0.23, 0.38, 0.28], at: [0, -0.16, 0] },
    mitt: { size: [0.28, 0.25, 0.32], at: [0, -0.42, -0.02] },
    // The smaller, green head under every costume's helmet (a costume's `colors` add the suit's).
    colors: { eyes: 0xfff7dc, dark: 0x34202a, skin: 0x91a869, hair: 0x40312d },
    zombieFace: [
      { color: 'hair', size: [0.32, 0.075, 0.32], at: [0, 0.148, 0.004] },
      { color: 'dark', size: [0.067, 0.047, 0.022], at: [-0.076, 0.035, -0.169], tilt: -0.12 },
      { color: 'dark', size: [0.059, 0.036, 0.022], at: [0.074, 0.022, -0.169], tilt: 0.14 },
      { color: 'eyes', size: [0.028, 0.02, 0.012], at: [-0.079, 0.034, -0.183] },
      { color: 'dark', size: [0.14, 0.04, 0.023], at: [-0.013, -0.096, -0.169], tilt: 0.12 },
      { color: 'eyes', size: [0.036, 0.024, 0.012], at: [-0.045, -0.089, -0.183] },
    ],
    pose: {
      radiansPerMeter: 4.4, shambleStride: 0.46, rushStride: 0.74, shambleArm: 0.24, rushArm: 0.55,
      sway: 0.065, rushLean: 0.21, recoil: 0.15, attackLean: 0.17, deathTip: 1.48, sinkDepth: 0.75, dropTumble: 1.2,
    },
    drop: {
      velocity: [1.55, 2.55, 0.95], gravity: 11, spin: [7, 3.6, 6.3],
      tumbleSeconds: 0.86, floorClearance: 0.44,
      stuffingCount: 22, stuffingSeconds: 0.65, stuffingSize: 0.095, stuffingSpeed: 3.2,
      stuffingUp: 1.6,
    },
  },
};

// THE COSTUMES. Each Mascot that spawns wears one the player has unlocked (unlockRound <= the round), picked by
// zombies/mascotVariants.js once the spawn point is known: weight 1 each, x mascotPicking.homeWeight when the point's
// zone is one of its homeZones. A costume's first appearance gets its own PA banner ('mascotVariantIntro'); in its
// unlock round the first Mascot is forced to wear it (game/rounds.js). Entry fields:
//   name, unlockRound, homeZones, introBanner, helmetPopLine (the PA line when the helmet comes off)
//   colors   the suit: suit, trim, boot, plus any named in `uniform` and the head's decorations
//   uniform  extra blocks on the torso ({ color, size, at, tilt }, colors by name)
//   head     the helmet: kind (zombies/mascotHeads.js builds it), helmet { size, at } (the main block; its meshes are the
//            head hitbox), color (its foam) and that kind's own pieces
//   + the costume's own tuning block (the one beat it changes), read as zombie.type.mascot.<block>
export const mascotPicking = { homeWeight: 3 };
export const mascotVariants = {
  // The Food Court's foam breakfast knight: the baseline, no twist.
  sirWaffles: {
    name: 'Sir Waffles',
    unlockRound: 10,
    homeZones: ['foodCourt'],
    introBanner: { kicker: 'Attention shoppers', text: 'Sir Waffles is loose in the mall. Please keep syrup at a safe distance.' },
    helmetPopLine: { kicker: 'Lost property', text: 'A customer has lost their head. It may be claimed at Customer Service.' },
    colors: { suit: 0x6a3393, trim: 0xffd365, boot: 0xad5f2b, cape: 0xb83946, crust: 0xad5f2b, toast: 0xc87b32, butter: 0xffe278 },
    uniform: [
      { color: 'cape', size: [0.5, 0.48, 0.035], at: [0, -0.07, 0.272] },
      { color: 'cape', size: [0.45, 0.37, 0.025], at: [0, -0.04, -0.264] },
      { color: 'trim', size: [0.20, 0.20, 0.027], at: [0, 0.07, -0.285], tilt: Math.PI / 4 },
      { color: 'crust', size: [0.097, 0.097, 0.02], at: [0, 0.07, -0.305], tilt: Math.PI / 4 },
    ],
    head: {
      kind: 'waffle',
      helmet: { size: [0.95, 0.88, 0.79], at: [0, 1.09, 0] },
      color: 0xe8a037,
      // The square dents (toast colour) and the face on the front.
      grid: { centers: [-0.33, -0.11, 0.11, 0.33], rows: [-0.31, -0.105, 0.10, 0.305],
        size: [0.17, 0.157, 0.018], z: -0.399, color: 'toast' },
      face: [
        { color: 'butter', size: [0.24, 0.14, 0.06], at: [-0.25, 0.29, -0.41], tilt: 0.22 },
        { color: 'eyes', size: [0.15, 0.20, 0.044], at: [-0.20, 0.10, -0.422], tilt: 0.13 },
        { color: 'eyes', size: [0.15, 0.20, 0.044], at: [0.20, 0.10, -0.422], tilt: -0.13 },
        { color: 'dark', size: [0.062, 0.092, 0.024], at: [-0.184, 0.075, -0.449] },
        { color: 'dark', size: [0.062, 0.092, 0.024], at: [0.184, 0.075, -0.449] },
        { color: 'dark', size: [0.32, 0.081, 0.032], at: [0, -0.20, -0.421] },
        { color: 'dark', size: [0.076, 0.079, 0.032], at: [-0.17, -0.17, -0.421], tilt: 0.45 },
        { color: 'dark', size: [0.076, 0.079, 0.032], at: [0.17, -0.17, -0.421], tilt: -0.45 },
        { color: 'eyes', size: [0.23, 0.03, 0.016], at: [0, -0.18, -0.442] },
      ],
    },
  },

  // Mega Mart's discount superhero. THE TWIST, after the pop and the shake: instead of rushing he hurries back to HIS
  // fallen helmet and puts it back on (zombie.js updateReclaim). Shoot him while he's bent over it: the head is bare.
  captainCoupon: {
    name: 'Captain Coupon',
    unlockRound: 13,
    homeZones: ['megaMart'],
    introBanner: { kicker: 'Attention shoppers', text: 'Captain Coupon is patrolling Mega Mart. His coupons are expired. So is he.' },
    helmetPopLine: { kicker: 'Price drop', text: 'Captain Coupon has been reduced to clear. He will be back for it.' },
    colors: { suit: 0xd8262e, trim: 0xffd23f, boot: 0x2b2b33, cape: 0xffc21a, ink: 0xd8262e, string: 0xf4efe6 },
    uniform: [
      { color: 'cape', size: [0.5, 0.5, 0.035], at: [0, -0.06, 0.272] }, // the cape
      { color: 'trim', size: [0.22, 0.22, 0.027], at: [0, 0.07, -0.275], tilt: Math.PI / 4 }, // a yellow chest badge...
      { color: 'ink', size: [0.11, 0.11, 0.02], at: [0, 0.07, -0.295], tilt: Math.PI / 4 }, // ...with a red heart to it
      { color: 'trim', size: [0.74, 0.07, 0.56], at: [0, -0.24, 0] }, // a utility belt
    ],
    head: {
      kind: 'priceTag',
      helmet: { size: [0.96, 0.84, 0.38], at: [0, 1.07, 0] }, // a thick foam card: it hides the green head
      color: 0xfff1b8,
      tilt: 0.2, // radians: the hole corner up, as if hung from the string
      bevel: 0.03,
      cornerRadius: 0.16,
      // Positions on the card are in its own metres: +x is the hole's side (his right: your left as you face him).
      hole: { at: [0.3, 0.24], radius: 0.065 },
      string: { color: 'string', radius: 0.12, tube: 0.02, stretch: 1.9, sink: 0.03 },
      // The canvas print in front of the card: SALE clear of the hole, a big "%" for a mouth.
      // (text sizes are fractions of the canvas height)
      print: { size: [0.86, 0.74], pixels: [512, 440], lift: 0.012, ink: '#d8262e',
        text: 'SALE', textAt: [-0.07, 0.262], textSize: 0.19, symbol: '%', symbolAt: [0, -0.215], symbolSize: 0.34 },
      face: [ // (front faces at least 1 cm apart: card -0.19, print -0.202, rims -0.212, whites -0.23, pupils and brows -0.245)
        { color: 'dark', size: [0.19, 0.22, 0.012], at: [0.17, 0.02, -0.206] }, // dark rims so the eyes read on the cream card
        { color: 'dark', size: [0.19, 0.22, 0.012], at: [-0.17, 0.02, -0.206] },
        { color: 'eyes', size: [0.16, 0.19, 0.03], at: [0.17, 0.02, -0.215] },
        { color: 'eyes', size: [0.16, 0.19, 0.03], at: [-0.17, 0.02, -0.215] },
        { color: 'dark', size: [0.065, 0.095, 0.02], at: [0.15, 0.0, -0.235] },
        { color: 'dark', size: [0.065, 0.095, 0.02], at: [-0.15, 0.0, -0.235] },
        { color: 'dark', size: [0.17, 0.035, 0.02], at: [0.17, 0.155, -0.235], tilt: -0.3 }, // stern brows
        { color: 'dark', size: [0.17, 0.035, 0.02], at: [-0.17, 0.155, -0.235], tilt: 0.3 },
      ],
    },
    reclaim: {
      walkSpeed: 2.4, // m/s back to his helmet: hurrying, not rushing
      reachRadius: 0.8, // within this of it he stops and picks it up...
      reclaimSeconds: 1.2, // ...standing still this long (bent over, then lifting it over his head)...
      reclaimHealthFraction: 0.75, // ...and it's on: health back to this much of max, suited speed again
      maxReclaims: 1, // per Coupon. The second pop pays no helmet bonus.
      guardRadius: 1.5, // he gives up (and rushes you) if you stand this close to his helmet...
      giveUpSeconds: 6, // ...or he hasn't got it by now, or it's gone (round over, swept up)
      line: { kicker: 'Customer service', text: 'Captain Coupon has found his head. Offer still valid.' },
      // The lift (visual only): bent over it for the first reachShare, then up over his head and down onto his shoulders.
      lift: { reachShare: 0.35, bend: 0.75, armsReach: 1.2, armsHold: 2.75, rise: 0.45 },
    },
  },

  // The Sunset Cinema's usher in a popcorn bucket. THE TWIST: the pop is a blast (game/mascotCostumes.js). Zombies
  // close by are flung and stunned (no damage, so no points), and if you're close you're shoved away and buttered.
  poppyCorn: {
    name: 'Poppy Corn',
    unlockRound: 16,
    homeZones: ['cinema'],
    introBanner: { kicker: 'Now showing', text: 'Poppy Corn has left the Sunset Cinema. Please silence your screaming.' },
    helmetPopLine: { kicker: 'Concessions', text: 'Poppy Corn has popped. Butter is complimentary. And everywhere.' },
    colors: { suit: 0xa3172b, trim: 0xf2c14e, boot: 0x2a1b14, bow: 0x1d1626, stripe: 0xd62839, kernel: 0xfff1c9, butter: 0xffcf3f },
    uniform: [ // an usher's jacket: gold buttons, a bow tie, gold epaulettes
      { color: 'trim', size: [0.06, 0.06, 0.03], at: [0, 0.12, -0.27] },
      { color: 'trim', size: [0.06, 0.06, 0.03], at: [0, -0.02, -0.27] },
      { color: 'trim', size: [0.06, 0.06, 0.03], at: [0, -0.16, -0.27] },
      { color: 'bow', size: [0.1, 0.09, 0.035], at: [-0.06, 0.27, -0.272], tilt: 0.35 },
      { color: 'bow', size: [0.1, 0.09, 0.035], at: [0.06, 0.27, -0.272], tilt: -0.35 },
      { color: 'trim', size: [0.2, 0.05, 0.36], at: [-0.27, 0.355, 0] },
      { color: 'trim', size: [0.2, 0.05, 0.36], at: [0.27, 0.355, 0] },
    ],
    head: {
      kind: 'popcornBucket',
      helmet: { size: [0.9, 0.74, 0.9], at: [0, 1.04, 0] }, // the bucket: top width, height (it hides the green head)
      color: 0xfff6e6, // the bucket's white
      radiusTop: 0.45,
      radiusBottom: 0.33,
      segments: 16,
      stripes: { count: 8, color: 'stripe', proud: 0.012 }, // red bands, equal to the white ones
      rim: { color: 'stripe', height: 0.07, proud: 0.024 },
      // Lumpy puffs heaped on top: [x, y, z, size, buttered?] in the bucket's metres (y = 0 is its middle).
      puffs: { color: 'kernel', buttered: 'butter', pieces: [
        [0, 0.48, 0, 0.17], [0.2, 0.43, 0.1, 0.14], [-0.2, 0.43, 0.12, 0.15, true], [0.05, 0.42, -0.25, 0.14],
        [-0.18, 0.44, -0.16, 0.13, true], [0.26, 0.41, -0.13, 0.13], [0.12, 0.44, 0.27, 0.13, true], [-0.3, 0.41, -0.02, 0.12],
        [0.3, 0.4, 0.2, 0.11], [-0.05, 0.54, 0.12, 0.12, true], [0.1, 0.56, -0.08, 0.11], [-0.14, 0.42, 0.3, 0.11],
      ] },
      // The face sits on the bucket's curve: at [x, y] on its front, `proud` metres off the stripes (back face).
      // (front faces at least 1.5 cm apart: rims 0.024, whites and mouth 0.04, pupils, teeth and tongue 0.055)
      face: [
        { color: 'dark', size: [0.18, 0.22, 0.02], at: [0.15, 0.07], proud: 0.004 }, // dark rims: the stripes behind are white too
        { color: 'dark', size: [0.18, 0.22, 0.02], at: [-0.15, 0.07], proud: 0.004 },
        { color: 'eyes', size: [0.15, 0.19, 0.03], at: [0.15, 0.07], proud: 0.01 },
        { color: 'eyes', size: [0.15, 0.19, 0.03], at: [-0.15, 0.07], proud: 0.01 },
        { color: 'dark', size: [0.06, 0.09, 0.02], at: [0.13, 0.05], proud: 0.035 },
        { color: 'dark', size: [0.06, 0.09, 0.02], at: [-0.13, 0.05], proud: 0.035 },
        { color: 'dark', size: [0.26, 0.07, 0.03], at: [0, -0.14], proud: 0.01 }, // a big open grin...
        { color: 'dark', size: [0.16, 0.06, 0.03], at: [0, -0.19], proud: 0.01 },
        { color: 'eyes', size: [0.2, 0.03, 0.02], at: [0, -0.12], proud: 0.035 }, // ...with teeth...
        { color: 'butter', size: [0.1, 0.035, 0.02], at: [0, -0.2], proud: 0.035 }, // ...and butter on its tongue
      ],
    },
    popBlast: {
      zombieRadius: 4, // zombies within this (metres, flat) are knocked away...
      stunSeconds: 1.2, // ...and stunned this long (the same stagger as the Loss Prevention shove)...
      knockback: 7, // ...starting at this many m/s (a Cart Pusher's shove)...
      drag: 5, // ...slowing with this drag (about knockback / drag metres)
      playerRadius: 3, // you, within this: shoved away at playerShove m/s (horizontal), no damage...
      playerShove: 7,
      butterSeconds: 1, // ...and buttered (the HUD's splat fades over this)
      floorTolerance: 1.2, // only bodies on its own floor (metres of height difference)...
      chestHeight: 1.1, // ...with nothing solid between the bucket and their chest
      burst: { colors: [0xfff1c9, 0xfff9ee, 0xffe28a, 0xffcf3f], count: 36 }, // popcorn everywhere
    },
  },

  // The Atrium's soda-fountain mascot, melting. THE TWIST, on the approach: he leaves a trail of melt puddles that
  // slow you down (game/meltTrail.js, through game/surfaceSlows.js), and drips twice as fast once his cone is off.
  scoops: {
    name: 'Scoops',
    unlockRound: 19,
    homeZones: ['atrium', 'foodCourt'],
    introBanner: { kicker: 'Attention shoppers', text: 'Scoops is melting through the mall. Mind the floor. It is mostly strawberry.' },
    helmetPopLine: { kicker: 'Clean-up on every aisle', text: 'Scoops has lost his cone. Please do not lick the floor.' },
    colors: { suit: 0x9fe3c9, trim: 0xfff8f0, boot: 0xd29a55, apron: 0xfff8f0, stripe: 0xff9fc0, bow: 0xff7fae,
      cone: 0xd8a05a, coneDark: 0xa86f32, scoop: 0xffb3cf, cherry: 0xe0283c, sprinkleA: 0xffe14a, sprinkleB: 0x7fd2ff, sprinkleC: 0xb58cff },
    uniform: [ // a soda jerk: white apron with a pink stripe, a pink bow tie
      { color: 'apron', size: [0.5, 0.5, 0.03], at: [0, -0.08, -0.272] },
      { color: 'stripe', size: [0.5, 0.06, 0.02], at: [0, 0.13, -0.29] },
      { color: 'bow', size: [0.1, 0.09, 0.035], at: [-0.06, 0.28, -0.272], tilt: 0.35 },
      { color: 'bow', size: [0.1, 0.09, 0.035], at: [0.06, 0.28, -0.272], tilt: -0.35 },
    ],
    head: {
      kind: 'iceCreamCone',
      helmet: { size: [0.9, 1.04, 0.9], at: [0, 1.06, 0] }, // the whole cone and scoop (it hides the green head)
      color: 0xffb3cf, // the scoop's strawberry
      // A short, wide waffle cone (point cut off: it sits on his shoulders), in the head's metres (y = 0 is its middle).
      cone: { color: 'cone', radiusTop: 0.42, radiusBottom: 0.25, height: 0.46, y: -0.24, segments: 10,
        bands: { color: 'coneDark', count: 2, height: 0.035, proud: 0.012 } },
      scoop: { radius: 0.43, y: 0.14 },
      // Drips over the rim: [angle around (0 = front), length], kept off the face and the sides (they read as ears there);
      // sprinkles on top: [x, y, z, colour name]
      drips: { color: 'scoop', width: 0.05, pieces: [[0.75, 0.11], [2.5, 0.09], [3.8, 0.12], [5.5, 0.1]] },
      sprinkles: { size: [0.07, 0.022, 0.022], pieces: [
        [0.1, 0.5, 0.12, 'sprinkleA'], [-0.14, 0.48, 0.05, 'sprinkleB'], [0.02, 0.52, -0.12, 'sprinkleC'], [-0.06, 0.47, 0.22, 'sprinkleA'],
        [0.2, 0.44, -0.08, 'sprinkleB'], [-0.22, 0.42, -0.14, 'sprinkleC'], [0.24, 0.42, 0.18, 'sprinkleC'], [-0.25, 0.4, 0.2, 'sprinkleB'],
      ] },
      cherry: { color: 'cherry', radius: 0.07, y: 0.6 },
      // The face sits on the scoop: [x, y] on its front (head metres), `proud` off the surface (back face).
      face: [
        { color: 'eyes', size: [0.14, 0.17, 0.03], at: [0.14, 0.2], proud: 0.008 },
        { color: 'eyes', size: [0.14, 0.17, 0.03], at: [-0.14, 0.2], proud: 0.008 },
        { color: 'dark', size: [0.06, 0.085, 0.02], at: [0.12, 0.18], proud: 0.03 },
        { color: 'dark', size: [0.06, 0.085, 0.02], at: [-0.12, 0.18], proud: 0.03 },
        { color: 'dark', size: [0.12, 0.045, 0.03], at: [0, 0.025], proud: 0.008 }, // a little U of a smile
        { color: 'dark', size: [0.045, 0.06, 0.03], at: [0.075, 0.05], proud: 0.008 },
        { color: 'dark', size: [0.045, 0.06, 0.03], at: [-0.075, 0.05], proud: 0.008 },
        { color: 'bow', size: [0.07, 0.05, 0.02], at: [0.2, 0.07], proud: 0.008 }, // rosy cheeks
        { color: 'bow', size: [0.07, 0.05, 0.02], at: [-0.2, 0.07], proud: 0.008 },
      ],
    },
    melt: {
      dropEvery: 0.5, // seconds between puddles while suited...
      exposedDropEvery: 0.25, // ...and once his cone is off (twice as often)
      minSpacing: 0.35, // metres: no new puddle within this of his last one (standing still doesn't pile them up)
      radius: 0.8,
      lifeSeconds: 6,
      fadeSeconds: 1.5, // (the last part of its life: it fades out)
      maxPuddles: 14, // ONE pool for every Scoops in the mall: the oldest puddle gives way
      slowFactor: 0.6, // your speed standing in one (zombies don't care). With the Janitor's wet floor: the lowest wins.
      floorTolerance: 0.12, // (a puddle needs flat floor under it: none on a ramp or an escalator)
      lift: 0.022, opacity: 0.78, segments: 20,
      colors: [0xffb3cf, 0xaef0d4], // strawberry and mint, in turn
    },
  },
  twisty: {
    name: 'Twisty the Pretzel',
    unlockRound: 22,
    homeZones: ['foodCourt'],
    introBanner: { kicker: 'Food Court notice', text: 'Twisty the Pretzel is out of the warmer. Watch your step around loose salt.' },
    helmetPopLine: { kicker: 'Sweep needed', text: 'Twisty has shed his crust. Housekeeping advises listening where you walk.' },
    colors: { suit: 0x6b2f45, trim: 0xfff2dc, boot: 0x422010, apron: 0xfff8ee, stripe: 0xe3a832, bow: 0xd99a24,
      crust: 0xc27b3a, salt: 0xfff8eb },
    uniform: [ // a pretzel-stand baker: cream apron, mustard waistband and neck bow
      { color: 'apron', size: [0.5, 0.5, 0.03], at: [0, -0.08, -0.272] },
      { color: 'stripe', size: [0.5, 0.06, 0.02], at: [0, 0.13, -0.29] },
      { color: 'bow', size: [0.1, 0.085, 0.035], at: [-0.06, 0.28, -0.272], tilt: 0.35 },
      { color: 'bow', size: [0.1, 0.085, 0.035], at: [0.06, 0.28, -0.272], tilt: -0.35 },
    ],
    head: {
      kind: 'pretzel',
      helmet: { size: [0.94, 0.88, 0.58], at: [0, 1.02, 0] },
      color: 0xc27b3a, // golden-baked pretzel dough (turns gold for Employee of the Month)
      // Outer heart-shaped dough loop + crossed arms in head metres, built from one shared low-poly TubeGeometry each.
      ring: {
        radius: 0.105,
        tubularSegments: 28,
        radialSegments: 7,
        scaleZ: 1.35,
        points: [
          [0, -0.28, 0], [0.24, -0.21, 0], [0.35, 0.04, 0], [0.24, 0.32, 0],
          [0, 0.20, 0], [-0.24, 0.32, 0], [-0.35, 0.04, 0], [-0.24, -0.21, 0],
        ],
      },
      arms: {
        radius: 0.082,
        tubularSegments: 10,
        radialSegments: 7,
        scaleZ: 1.25,
        pairs: [
          [[-0.21, 0.27, 0.015], [0, 0.0, -0.045], [0.20, -0.23, 0.01]],
          [[0.21, 0.27, 0.015], [0, 0.0, -0.045], [-0.20, -0.23, 0.01]],
        ],
      },
      // Plump center twist cushion where the two cross-arms meet: holds the cartoon eyes and grin cleanly off the holes.
      knot: { radius: 0.20, widthSegments: 8, heightSegments: 6, scale: [1.05, 0.96, 0.85], at: [0, -0.02, -0.03] },
      // Coarse salt crystal flecks proud on the front (and two on the back) of the dough ring.
      salt: {
        color: 'salt',
        proud: 0.004,
        pieces: [
          { size: [0.055, 0.045, 0.045], at: [-0.24, 0.32], side: -1, tilt: 0.35 },
          { size: [0.05, 0.05, 0.045], at: [0.24, 0.32], side: -1, tilt: -0.4 },
          { size: [0.055, 0.045, 0.045], at: [-0.35, 0.04], side: -1, tilt: 0.2 },
          { size: [0.05, 0.045, 0.045], at: [0.35, 0.04], side: -1, tilt: -0.25 },
          { size: [0.045, 0.055, 0.045], at: [-0.24, -0.21], side: -1, tilt: 0.5 },
          { size: [0.055, 0.045, 0.045], at: [0.24, -0.21], side: -1, tilt: -0.3 },
          { size: [0.05, 0.045, 0.045], at: [0, 0.20], side: -1, tilt: 0.15 },
          { size: [0.045, 0.05, 0.045], at: [0, -0.28], side: -1, tilt: -0.2 },
          { size: [0.055, 0.045, 0.045], at: [-0.24, 0.32], side: 1, tilt: -0.3 },
          { size: [0.05, 0.05, 0.045], at: [0.24, -0.21], side: 1, tilt: 0.4 },
        ],
      },
      // Face projected onto the front of the knot cushion ([x, y] in head metres, `proud` off its surface).
      face: [
        { color: 'eyes', size: [0.11, 0.13, 0.026], at: [0.085, 0.05], proud: 0.012 },
        { color: 'eyes', size: [0.11, 0.13, 0.026], at: [-0.085, 0.05], proud: 0.012 },
        { color: 'dark', size: [0.048, 0.068, 0.02], at: [0.075, 0.035], proud: 0.028 },
        { color: 'dark', size: [0.048, 0.068, 0.02], at: [-0.075, 0.035], proud: 0.028 },
        { color: 'dark', size: [0.12, 0.04, 0.026], at: [0, -0.075], proud: 0.012 },
        { color: 'dark', size: [0.04, 0.05, 0.026], at: [0.068, -0.052], proud: 0.012 },
        { color: 'dark', size: [0.04, 0.05, 0.026], at: [-0.068, -0.052], proud: 0.012 },
      ],
    },
    saltPatch: {
      radius: 1.05, // metres: stepping within this radius while walking crunches underfoot (sound cue only: no damage, no slow)
      lifeSeconds: 10, // seconds each patch lingers after Twisty's helmet pops
      fadeSeconds: 2, // final fade window before vanishing
      maxPatches: 8, // ONE pool for every Twisty in the mall: oldest gives way
      floorTolerance: 0.12, // metres: needs flat floor under it (none on a ramp or escalator)
      lift: 0.012, // metres above flat floor
      opacity: 0.92,
      dustOpacity: 0.22,
      dustColor: 0xf7f1e3,
      dustSegments: 14,
      crystalCount: 16,
      crystalSpread: 0.88,
      crystalSizeMin: 0.045,
      crystalSizeMax: 0.085,
      crystalHeightMin: 0.018,
      crystalHeightMax: 0.036,
      crystalColors: [0xfffcf5, 0xf3ead8, 0xe8dec8],
      sound: 'saltCrunch',
      volume: 0.9,
      stepMeters: 0.72, // horizontal distance walked inside a patch per crunch sound
      entryStepMeters: 0.08, // first crunch fires promptly on walking into a patch (standing still stays silent)
      minSpeed: 0.4, // m/s: stationary jitter stays silent; crouch-walk and sprinting crunch
      maxStepSpeed: 20, // m/s: ignores single-frame teleports so warping onto a patch without walking stays silent
    },
  },
};

// One resolved zombie type per costume, built ONCE here: the shared type deep-merged with the costume (id stays 'mascot',
// plus `variant: '<id>'` and `name`), so every zombie.type.mascot.* read works whatever the costume. Nothing per spawn.
const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
function mergeDeep(base, over) {
  const out = { ...base };
  for (const [key, value] of Object.entries(over)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeDeep(base[key], value) : value;
  }
  return out;
}
function resolveMascot(id, { name, unlockRound: _unlock, homeZones: _home, introBanner, ...costume }) {
  return mergeDeep(mascotBase, { variant: id, name, introBanner, mascot: { ...costume, helmet: costume.head.helmet } });
}
export const mascotTypes = Object.fromEntries(Object.entries(mascotVariants).map(([id, costume]) => [id, resolveMascot(id, costume)]));

// EMPLOYEE OF THE MONTH: from fromRound each Mascot has `chance` to come as the gold version of its costume (the zombie
// manager rolls it after the costume; never two alive at once). Tougher (healthMultiplier on top of the Mascot's 5x),
// announced on the PA (spawnLine) and it always drops one power-up at its body: `guaranteedDrop`, which game/powerUps.js
// pays through the same queue as a boss's reward, outside the drop meter.
// The gold version of a costume: suit gold, trim and boots black, the helmet's foam gold, every other costume colour bright
// gold if it is light (luminance >= brightAbove) or black, plus the name badge on its chest. The green zombie inside stays.
export const mascotGold = {
  fromRound: 15,
  chance: 0.08,
  healthMultiplier: 1.5,
  palette: { gold: 0xe0aa22, bright: 0xffd65a, black: 0x1d1626 },
  brightAbove: 0.6,
  spawnLine: { kicker: 'Staff announcement', text: 'Our Employee of the Month is on the floor. Please congratulate them. From a distance.' },
  // A card on the left of the chest (torso metres, >= 1 cm proud of everything a costume wears there) with a canvas print.
  badge: { size: [0.2, 0.12, 0.02], at: [-0.24, 0.2, -0.29], color: 'badge', card: 0xfff6dc,
    print: { pixels: [256, 154], lift: 0.006, ink: '#1d1626', star: '#e0aa22', lines: ['EMPLOYEE', 'OF THE MONTH'] } },
};
const zombieColors = new Set(Object.keys(mascotBase.mascot.colors)); // (the face under the helmet)
const luminance = (hex) => (0.2126 * ((hex >> 16) & 255) + 0.7152 * ((hex >> 8) & 255) + 0.0722 * (hex & 255)) / 255;
function gild(type) {
  const { palette, brightAbove, badge } = mascotGold;
  const colors = {};
  for (const [name, hex] of Object.entries(type.mascot.colors)) {
    if (!zombieColors.has(name)) colors[name] = luminance(hex) >= brightAbove ? palette.bright : palette.black;
  }
  Object.assign(colors, { suit: palette.gold, trim: palette.black, boot: palette.black, [badge.color]: badge.card });
  return mergeDeep(type, { gold: true, guaranteedDrop: true, mascot: { colors, head: { color: palette.gold }, badge } });
}
export const mascotGoldTypes = Object.fromEntries(Object.entries(mascotTypes).map(([id, type]) => [id, gild(type)]));

// zombieTypes.mascot is Sir Waffles (the round-10 costume): what an unpicked Mascot wears, and the type's intro banner.
export const zombieTypes = { shopper, mallWalker, cartPusher, mannequin, mascot: mascotTypes.sirWaffles };

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

// Build-A-Blaster's Glitter (zombies/confusion.js). How long and how hard come from the stuffing (config/workshop.js).
export const zombieConfusion = {
  rangeMeters: 6, // how far it looks for another zombie to fight
  retargetSeconds: .4,
  floorTolerance: 1, // zombies further apart in height than this are on different floors
  speedFraction: .8, // of its normal speed
  immuneSeconds: 4, // after it wears off, so a fast gun can't keep a crowd confused for ever
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
  // Several floors (navigation.js `floors` + `links`): a mover within rampTolerance of a ramp's surface is ON the ramp;
  // linkPenalty makes a ramp cost this much extra of its length (1 = twice as far), so routes avoid needless stairs.
  rampTolerance: 0.6,
  linkPenalty: 0.25,
};
