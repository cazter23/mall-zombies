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

    // Recoil. The camera part moves your crosshair (shots go where you look) and springs back to
    // where you were aiming by itself; everything else is visual only.
    recoil: {
      pitchDegrees: 1.0, // the view kicks up this much per shot (peak, ~35ms after the shot), then settles
      rollDegrees: 0.3, // visual only: the view tilts a hair left or right (rolling never moves the crosshair)
      adsMultiplier: 0.7, // camera kick while aiming down sights
      model: {
        // The gun in your hands (visual only)
        back: 0.045, // meters it jolts back toward you
        up: 0.008, // meters it hops up
        pitchDegrees: 7, // the muzzle flips up
        yawDegrees: 1.5, // random little twist left or right
        rollDegrees: 3, // random little roll
        adsMultiplier: 0.4, // much smaller while aiming, so the sight stays readable
        frequency: 6.5, // Hz: how fast it springs back (higher = snappier)
        damping: 0.55, // < 1 settles with a slight forward bounce, which reads as weight
      },
    },

    // Muzzle flash: a cartoon burst + a flicker of light on the gun and the room.
    muzzleFlash: {
      seconds: 0.05, // how long it lasts (about 3 frames)
      size: 0.22, // meters across (outer burst), at the gun
      coreSize: 0.11, // bright glowing center
      outerOpacity: 0.9,
      sizeJitter: 0.2, // each flash is up to 20% bigger or smaller
      forwardOffset: 0.09, // meters in front of the muzzle (clear of the nose and the left hand)
      outerColor: 0xffa733,
      coreColor: 0xfff6dc,
      // Down the sights the nose is hidden behind the gun, so the burst goes wide and flat: it pokes
      // out both sides of the gun and stays below the crosshair. (The gun and hands always hide the
      // parts of the burst behind them.)
      adsWidth: 1.7, // x normal width while aiming
      adsHeight: 0.6, // x normal height while aiming
      adsTwistFraction: 0.06, // how much of the random twist it keeps while aiming (stays level)
      lightColor: 0xffc878,
      handLightIntensity: 0.6, // lights up the gun and hands...
      handLightRange: 0.8, // meters
      worldLightIntensity: 10, // ...and the walls/zombies around you
      worldLightRange: 9, // meters
    },

    // Sound names (config/audio.js). Reload sounds are events in viewmodel.reload below.
    sounds: { fire: 'stapleShot', dryFire: 'dryClick' },

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
      model: 'stapleGun', // first-person model builder (src/weapons/models/)
      hipOffset: { x: 0.175, y: -0.14, z: -0.43 }, // meters from the camera: right, down, forward
      // Hip angles (all straighten out in ADS): turned in toward the crosshair so you see the gun's
      // side, muzzle tipped up a touch, canted slightly inward.
      aimYawDegrees: 9,
      hipPitchDegrees: 2,
      hipRollDegrees: 4,
      bodyColor: 0xd62839, // classic red staple gun
      metalColor: 0x9aa0a8,
      gripColor: 0x2b2b2b,
      sightColor: 0xffd23f,
      // Squeeze lever on each shot: snaps in, springs back out.
      fire: { leverDegrees: 30, pressSeconds: 0.03, releaseSeconds: 0.09 },
      // Reload, on a 0..1 clock (the real duration is reloadTime / stats.reloadSpeed).
      // Poses: pos in meters (right, up, back), rot in degrees (muzzle up, turn left, roll left).
      reload: {
        // The whole gun: tips up and rolls toward the left hand, holds while the strip goes in, returns.
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.16, pos: [-0.015, -0.04, 0.02], rot: [10, 10, 28] },
          { t: 0.6, pos: [-0.02, -0.045, 0.02], rot: [12, 10, 30] },
          { t: 0.72, pos: [-0.015, -0.05, 0.02], rot: [6, 8, 24] },
          { t: 0.9, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // The left hand (relative to where it braces the gun): drops out of view, comes back with a strip.
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.12, pos: [0, 0, 0] },
          { t: 0.3, pos: [-0.07, -0.24, 0.12], rot: [-20, 0, 0] },
          { t: 0.42, pos: [-0.07, -0.24, 0.12], rot: [-20, 0, 0] },
          { t: 0.58, pos: [-0.01, -0.03, 0.01], rot: [5, 0, 0] },
          { t: 0.64, pos: [0, 0.006, 0] },
          { t: 0.8, pos: [0, 0, 0] },
        ],
        stripVisible: [0.36, 0.64], // the new staple strip is in the hand between these times
        // Sounds and bumps, in time with the animation (keep them before ~0.95).
        events: [
          { at: 0.14, sound: 'stapleReloadOut' }, // pusher rod pulled back
          { at: 0.63, sound: 'stapleReloadIn', jolt: { up: -0.012, pitchDegrees: -4, rollDegrees: 2 } }, // strip slapped in
          { at: 0.86, sound: 'stapleReloadReady', jolt: { back: 0.006, pitchDegrees: 2.5 } }, // rod snaps shut
        ],
      },
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
