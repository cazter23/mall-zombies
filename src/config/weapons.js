// =============================================================================
// WEAPONS CONFIG
// Stats for every weapon. Logic in src/weapons/ reads these; never hardcode
// weapon numbers anywhere else. Player-side multipliers (perks, wardrobe) live
// in the stats object (src/player/stats.js), not here.
// =============================================================================

export const weapons = {
  // Starting pistol. Hitscan: the shot lands instantly where the crosshair points.
  stapleGun: {
    id: 'stapleGun',
    name: 'Staple Gun',
    damage: 30, // per body hit. Round-1 zombie (150 HP): 5 body shots or 2 headshots (30 x 3 = 90)
    headshotMultiplier: 3,
    magazineSize: 12,
    startingReserve: 60, // spare staples you start with
    fireInterval: 0.12, // seconds between shots; semi-auto, one shot per click
    fireBuffer: 0.1, // seconds a click is remembered if it comes slightly too early
    reloadTime: 1.5, // seconds
    range: 100, // meters
    viewKickDegrees: 1.2, // camera kicks up this much per shot, then recovers

    // Hip-fire spread: shots land at a random spot inside a cone around the crosshair.
    // All values are the cone's half-angle in degrees. The crosshair gap shows the real cone.
    spread: {
      base: 0.8, // standing still, not firing
      moving: 2.0, // added at full walking speed (scales with speed; sprint/slide speeds add more)
      maxMovingFactor: 1.6, // cap on the speed scaling (so a fast slide doesn't go wild)
      airborne: 3.0, // added while in the air
      perShot: 0.8, // "bloom" added by each shot
      maxBloom: 3.0, // cap on bloom from rapid firing
      bloomRecovery: 5, // degrees of bloom lost per second
      smoothing: 10, // how quickly movement/air spread grows and shrinks (higher = snappier)
      adsMultiplier: 0.08, // aiming down sights multiplies all spread by this
    },

    // Aim down sights
    ads: {
      seconds: 0.18, // time to go fully in or out of ADS
      fovMultiplier: 0.8, // camera FOV while fully aimed (0.8 = 20% zoom)
      offset: { x: 0, y: -0.08, z: -0.38 }, // gun position while aiming: centered, sight tip just below the crosshair
    },

    // Visuals
    tracerColor: 0xe8eef5, // silver staple streak
    viewmodel: {
      bodyColor: 0xd62839, // classic red staple gun
      metalColor: 0x9aa0a8,
      gripColor: 0x2b2b2b,
      sightColor: 0xffd23f,
    },
  },
};

// The melee weapon: a box cutter from the employee's pocket (COD knife equivalent).
export const melee = {
  boxCutter: {
    id: 'boxCutter',
    name: 'Box Cutter',
    damage: 150, // one-hits a round-1 zombie, 2 hits rounds 2-3, then falls off (like COD)
    range: 1.8, // meters from the eye to the target's nearest point
    hitHalfAngleDegrees: 40, // how far off-center a target can be (wider than the crosshair: forgiving)
    swingSeconds: 0.5, // whole swing; the gun can't fire during it
    hitAtSeconds: 0.15, // when in the swing the hit lands
    lungeRange: 3.0, // a target this close (but out of reach) makes you lurch at it
    lungeSpeed: 9, // m/s during the lunge
    lungeMaxSeconds: 0.2,
    lungeStopFraction: 0.6, // the lunge stops when the target is this fraction of `range` away
    impactJoltDegrees: 1.5, // view jolt when the slash connects
    splatCount: 30, // big splatter on a hit
    colors: { handle: 0xffd23f, blade: 0xdfe6ee, grip: 0x2b2b2b },
  },
};

// Defaults for the player-side weapon multipliers in the stats object.
export const weaponStatDefaults = {
  damageMultiplier: 1, // all gun damage is multiplied by this
  meleeDamageMultiplier: 1, // box cutter damage is multiplied by this
  reloadSpeed: 1, // reload time is divided by this (2 = twice as fast)
};
