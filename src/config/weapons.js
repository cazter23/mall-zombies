// =============================================================================
// WEAPONS CONFIG
// Stats for every weapon. Logic in src/weapons/ reads these; never hardcode
// weapon numbers anywhere else. Player-side multipliers (perks, wardrobe) live
// in the stats object (src/player/stats.js), not here.
//
// Damage per hit = damage x headshotMultiplier (head) x falloff (distance) x pierce falloff
// (2nd/3rd zombie) x player stats; ONE function computes it: weapons/gunStats.js hitDamage().
// Optional per gun:
//   falloff: { start, end, minMultiplier }  full damage up to `start` meters, then down in a
//            straight line to `minMultiplier` at `end` and beyond. No falloff = full damage at any range.
//   pierce:  { maxTargets, damageFalloff: [1, 0.8, ...] }  a shot/pellet goes through zombies
//   pellets: { count, spreadDegrees, adsMultiplier }      several rays per trigger pull (shotgun)
// Upgrades (Build-A-Blaster...) never edit these entries: they are applied on top as data
// (gunStats.js resolveGun). Check the effect of any change with `npm run balance`.
// =============================================================================

export const weapons = {
  // Starting pistol. Hitscan: the shot lands instantly where the crosshair points.
  // ROLE: the free starter, a close-to-mid range pistol. The weakest gun at every range (staples lose
  // punch down a long hallway), so buying anything is an upgrade.
  stapleGun: {
    id: 'stapleGun',
    name: 'Staple Gun',
    fireMode: 'semi', // 'semi' = one shot per click, 'auto' = keeps firing while held
    damage: 30, // per body hit. Round-1 zombie (150 HP): 5 body shots or 2 headshots (30 x 3 = 90)
    headshotMultiplier: 3,
    magazineSize: 12,
    startingReserve: 60, // spare staples you start with
    fireInterval: 0.12, // seconds between shots; semi-auto, one shot per click
    fireBuffer: 0.1, // seconds a click is remembered if it comes slightly too early
    reloadTime: 1.5, // seconds
    falloff: { start: 10, end: 25, minMultiplier: 0.7 }, // full across a room; 70% down a long hallway
    range: 100, // meters

    // Recoil. The camera part moves your crosshair (shots go where you look) and springs back to
    // where you were aiming by itself; everything else is visual only.
    recoil: {
      pitchDegrees: 1.0, // the view kicks up this much per shot (peak, ~35ms after the shot), then settles
      yawDegrees: 0, // random left/right kick per shot (moves the crosshair too; springs back)
      rollDegrees: 0.45, // visual only: the view tilts a hair left or right (rolling never moves the crosshair)
      adsMultiplier: 0.7, // camera kick while aiming down sights
      model: {
        // The gun in your hands (visual only)
        back: 0.052, // meters it jolts back toward you
        up: 0.01, // meters it hops up
        pitchDegrees: 8.5, // the muzzle flips up
        yawDegrees: 1.8, // random little twist left or right
        rollDegrees: 3.5, // random little roll
        adsMultiplier: 0.4, // much smaller while aiming, so the sight stays readable
        frequency: 6.8, // Hz: how fast it springs back (higher = snappier)
        damping: 0.52, // < 1 settles with a slight forward bounce, which reads as weight
      },
    },

    // Target impact & combat feel (read by playerGun, zombie.takeHit, zombieModel, and effects)
    impact: {
      flinch: 1.0, // upper-body/head stagger multiplier
      knockback: 0.9, // m/s horizontal shove on chasing zombies
      hitstopSeconds: 0, // micro-hitstop freeze on the hit target
      deathImpulse: 1.1, // corpse knockdown speed & splatter burst velocity multiplier
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
      bloomRecoveryDelay: 0.15, // seconds after the last shot before bloom starts closing
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

  // Cheap full-auto wall buy (start room, 500): a supermarket price-label gun shooting price stickers.
  // ROLE: the cheap close-range sprayer. Competitive with the dearer Foam Dart Blaster up close
  // (big magazine, quick reload), but the stickers lose punch with range,
  // so the Nail Gun / Foam Dart Blaster own the long sightlines. (tests/balance.test.js checks this.)
  priceGun: {
    id: 'priceGun',
    name: 'Price Gun',
    fireMode: 'auto',
    damage: 28, // round-1 zombie (150 HP): 6 body shots or 2 headshots (28 x 3 = 84); round 5 (450): 17 body
    headshotMultiplier: 3,
    magazineSize: 32, // ~2.7s of fire per magazine
    startingReserve: 192, // six magazines; also the most it can hold in reserve (ammo buys refill to this)
    fireInterval: 0.083, // ~12 shots per second while held
    fireBuffer: 0.1,
    reloadTime: 1.3,
    range: 80,
    falloff: { start: 12, end: 30, minMultiplier: 0.6 }, // full damage across a room; 60% down a long hallway

    recoil: {
      pitchDegrees: 0.45, // smaller kicks, but at 12 a second they stack into a small climb
      yawDegrees: 0.25, // random sideways kick: sprays wander a little
      rollDegrees: 0.25,
      adsMultiplier: 0.65,
      model: {
        back: 0.025,
        up: 0.005,
        pitchDegrees: 3.8,
        yawDegrees: 1.2,
        rollDegrees: 2.0,
        adsMultiplier: 0.4,
        frequency: 9.2, // snappier spring so rapid shots stay readable
        damping: 0.56,
      },
    },

    impact: {
      flinch: 0.78,
      knockback: 0.55,
      hitstopSeconds: 0,
      deathImpulse: 1.0,
    },

    spread: {
      base: 1.2,
      moving: 2.2,
      maxMovingFactor: 1.6,
      airborne: 3.0,
      perShot: 0.35, // the cone opens up the longer you hold the trigger...
      maxBloom: 3.5,
      bloomRecoveryDelay: 0.15, // sustained fire builds bloom; short pauses let it close
      bloomRecovery: 6, // ...and closes again quickly when you let go
      smoothing: 10,
      adsMultiplier: 0.15, // looser than the staple gun when aiming
    },

    ads: {
      seconds: 0.16,
      fovMultiplier: 0.85, // a little less zoom than the staple gun
      offset: { x: 0, y: -0.122, z: -0.4 }, // sight post tip just below the crosshair, over the label roll
    },

    muzzleFlash: {
      seconds: 0.04,
      size: 0.15,
      coreSize: 0.075,
      outerOpacity: 0.85,
      sizeJitter: 0.25,
      forwardOffset: 0.09,
      outerColor: 0xff8fc8, // pink-ish: a puff of sticker glitter rather than fire
      coreColor: 0xffffff,
      adsWidth: 1.7,
      adsHeight: 0.6,
      adsTwistFraction: 0.06,
      lightColor: 0xffd6ea,
      handLightIntensity: 0.4,
      handLightRange: 0.8,
      worldLightIntensity: 6,
      worldLightRange: 8,
    },

    sounds: { fire: 'priceShot', dryFire: 'dryClick' },

    tracerColor: 0xfff3c4, // a little price sticker streak
    viewmodel: {
      model: 'priceGun',
      hipOffset: { x: 0.175, y: -0.15, z: -0.43 },
      aimYawDegrees: 9,
      hipPitchDegrees: 2,
      hipRollDegrees: 4,
      bodyColor: 0xff7a1a, // pricing-gun orange
      metalColor: 0x8d939c,
      gripColor: 0x2b2b2b,
      sightColor: 0xffe14a,
      labelColor: 0xf6f2e6, // the roll of white stickers
      fire: { leverDegrees: 22, pressSeconds: 0.02, releaseSeconds: 0.05 },
      reload: {
        // The gun tips up and rolls toward the left hand, holds while the roll is swapped, returns.
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.15, pos: [-0.015, -0.035, 0.02], rot: [14, 8, 26] },
          { t: 0.62, pos: [-0.02, -0.04, 0.02], rot: [16, 8, 28] },
          { t: 0.72, pos: [-0.015, -0.045, 0.02], rot: [8, 6, 22] },
          { t: 0.9, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // The left hand: plucks the empty roll off the top, drops out of view, comes back with a fresh one.
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.12, pos: [0.01, 0.1, 0.02], rot: [10, 0, 0] }, // up to the roll on top
          { t: 0.32, pos: [-0.07, -0.24, 0.12], rot: [-20, 0, 0] }, // away and down
          { t: 0.44, pos: [-0.07, -0.24, 0.12], rot: [-20, 0, 0] },
          { t: 0.58, pos: [0.01, 0.12, 0.02], rot: [10, 0, 0] }, // fresh roll up onto the deck
          { t: 0.64, pos: [0.01, 0.105, 0.02] }, // pressed on
          { t: 0.8, pos: [0, 0, 0] },
        ],
        rollGone: [0.14, 0.63], // the roll on top is off the gun between these times...
        newRollVisible: [0.38, 0.63], // ...and the fresh one is in the hand between these
        events: [
          { at: 0.13, sound: 'priceReloadOut' }, // empty roll popped off
          { at: 0.63, sound: 'priceReloadIn', jolt: { up: -0.01, pitchDegrees: -3, rollDegrees: 2 } }, // fresh roll pressed on
          { at: 0.86, sound: 'priceReloadReady', jolt: { back: 0.005, pitchDegrees: 2 } }, // feed snapped shut
        ],
      },
    },
  },

  // The first real upgrade (main hallway wall, 1000): a framing nailer. Slow, hard-hitting
  // semi-auto whose nails go through zombies: line up a horde while you train it.
  // ROLE: the long-range gun. No falloff: the only gun still at full damage at 30 m, clearly the best there.
  nailGun: {
    id: 'nailGun',
    name: 'Nail Gun',
    fireMode: 'semi',
    damage: 90, // round-1 zombie (150 HP): 2 body / 1 head; round 2 (225): 3 body; round 5 (450): 5 body / 2 head
    headshotMultiplier: 3,
    // Each nail goes through up to maxTargets zombies in a line (walls still stop it), doing a bit less
    // damage to each one it has already passed through.
    pierce: { maxTargets: 3, damageFalloff: [1, 0.8, 0.6] },
    magazineSize: 10,
    startingReserve: 60,
    fireInterval: 0.25, // ~4 shots per second at most
    fireBuffer: 0.1,
    reloadTime: 1.8,
    range: 100,

    recoil: {
      pitchDegrees: 1.8, // a big thump per shot...
      yawDegrees: 0.35,
      rollDegrees: 0.7,
      adsMultiplier: 0.65,
      model: {
        back: 0.075,
        up: 0.015,
        pitchDegrees: 12,
        yawDegrees: 1.8,
        rollDegrees: 4.5,
        adsMultiplier: 0.4,
        frequency: 5.8, // ...and a heavier, slower settle
        damping: 0.48,
      },
    },

    impact: {
      flinch: 1.65,
      knockback: 2.2,
      hitstopSeconds: 0.025,
      deathImpulse: 1.5,
    },

    spread: {
      base: 0.6, // accurate when you take your time
      moving: 2.4,
      maxMovingFactor: 1.6,
      airborne: 3.5,
      perShot: 1.2, // but rushing shots opens it up
      maxBloom: 3.0,
      bloomRecoveryDelay: 0.15,
      bloomRecovery: 4,
      smoothing: 10,
      adsMultiplier: 0.04,
    },

    ads: {
      seconds: 0.2,
      fovMultiplier: 0.72, // more zoom than the pistols
      offset: { x: 0, y: -0.09, z: -0.4 }, // front sight just below the crosshair
    },

    muzzleFlash: {
      seconds: 0.05,
      size: 0.18,
      coreSize: 0.07,
      outerOpacity: 0.8,
      sizeJitter: 0.2,
      forwardOffset: 0.06,
      outerColor: 0xd8d2c4, // a puff of dust and air from the nose...
      coreColor: 0xfff1a8, // ...with a little spark
      adsWidth: 1.7,
      adsHeight: 0.6,
      adsTwistFraction: 0.06,
      lightColor: 0xfff0c0,
      handLightIntensity: 0.4,
      handLightRange: 0.8,
      worldLightIntensity: 6,
      worldLightRange: 8,
    },

    sounds: { fire: 'nailShot', dryFire: 'dryClick' },

    tracerColor: 0xb8bec6, // steel nail streak
    viewmodel: {
      model: 'nailGun',
      hipOffset: { x: 0.18, y: -0.15, z: -0.44 },
      aimYawDegrees: 9,
      hipPitchDegrees: 2,
      hipRollDegrees: 4,
      bodyColor: 0xf2c12e, // power-tool yellow
      darkColor: 0x232323,
      metalColor: 0xa7adb5,
      sightColor: 0xff5a2e,
      // Trigger pull + the nose punching forward on each shot.
      fire: { triggerDegrees: 25, nosePunch: 0.016, pressSeconds: 0.025, releaseSeconds: 0.1 },
      reload: {
        // The gun tips up and rolls so the magazine faces the left hand, holds, returns.
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.15, pos: [-0.01, -0.03, 0.02], rot: [12, 10, 30] },
          { t: 0.64, pos: [-0.015, -0.035, 0.02], rot: [14, 10, 32] },
          { t: 0.72, pos: [-0.01, -0.045, 0.02], rot: [8, 8, 26] },
          { t: 0.9, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // Left hand: drops out of view, comes back to the back of the magazine with a strip, slides it in.
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.1, pos: [0, 0, 0] },
          { t: 0.28, pos: [-0.07, -0.25, 0.12], rot: [-20, 0, 0] },
          { t: 0.42, pos: [-0.07, -0.25, 0.12], rot: [-20, 0, 0] },
          { t: 0.56, pos: [0.025, -0.02, 0.02], rot: [6, 0, 0] }, // strip lined up behind the magazine
          { t: 0.67, pos: [0.025, -0.015, -0.06], rot: [6, 0, 0] }, // slid in
          { t: 0.82, pos: [0, 0, 0] },
        ],
        stripVisible: [0.36, 0.67], // the fresh strip is in the hand between these times
        magEmpty: [0.2, 0.67], // the magazine shows no nails between these
        events: [
          { at: 0.12, sound: 'nailReloadOut' }, // magazine latch flipped open
          { at: 0.66, sound: 'nailReloadIn', jolt: { up: -0.01, back: -0.008, pitchDegrees: -3, rollDegrees: 2 } }, // strip in
          { at: 0.86, sound: 'nailReloadReady', jolt: { back: 0.006, pitchDegrees: 2.5 } }, // follower snaps shut
        ],
      },
    },
  },
  // Mega Mart burst rifle: three foam darts per fresh trigger press, strong headshots.
  // ROLE: the mid-range gun. Best sustained damage around 15 m (past the Price Gun's falloff, ahead of the
  // Nail Gun), with a small sustained-damage lead over the cheaper Price Gun up close. Foam drifts,
  // so it falls behind the Nail Gun at 30 m.
  foamDartBlaster: {
    id: 'foamDartBlaster', name: 'Foam Dart Blaster', fireMode: 'burst',
    burst: { count: 3, interval: 0.07 },
    damage: 52, headshotMultiplier: 3, // (was 50) round 3: two body bursts; round 5: one head burst
    magazineSize: 30, startingReserve: 144, // ten full bursts; reserve unchanged
    fireInterval: 0.35, // pause after the LAST dart
    fireBuffer: 0.12, reloadTime: 1.9, range: 100,
    falloff: { start: 15, end: 30, minMultiplier: 0.75 }, // foam darts drift: full to 15 m, 75% at 30 m
    recoil: {
      pitchDegrees: 0.55, yawDegrees: 0.18, rollDegrees: 0.25, adsMultiplier: 0.7,
      model: { back: 0.028, up: 0.005, pitchDegrees: 4.2, yawDegrees: 1.0, rollDegrees: 1.5,
        adsMultiplier: 0.4, frequency: 8.5, damping: 0.56 },
    },
    impact: {
      flinch: 0.95,
      knockback: 0.85,
      hitstopSeconds: 0,
      deathImpulse: 1.2,
    },
    spread: {
      base: 0.8, moving: 2.2, maxMovingFactor: 1.6, airborne: 3,
      perShot: 0.45, maxBloom: 2.2, bloomRecoveryDelay: 0.15, bloomRecovery: 5,
      smoothing: 10, adsMultiplier: 0.05,
    },
    ads: { seconds: 0.2, fovMultiplier: 0.8, offset: { x: 0, y: -0.095, z: -0.43 } },
    muzzleFlash: {
      seconds: 0.035, size: 0.13, coreSize: 0.06, outerOpacity: 0.8, sizeJitter: 0.2,
      forwardOffset: 0.06, outerColor: 0xffb457, coreColor: 0xffffff,
      adsWidth: 1.7, adsHeight: 0.6, adsTwistFraction: 0.06,
      lightColor: 0xffddad, handLightIntensity: 0.3, handLightRange: 0.8,
      worldLightIntensity: 4, worldLightRange: 7,
    },
    sounds: { fire: 'foamShot', dryFire: 'dryClick' },
    tracerColor: 0xff8a28,
    viewmodel: {
      model: 'foamDartBlaster', hipOffset: { x: 0.18, y: -0.16, z: -0.45 },
      aimYawDegrees: 9, hipPitchDegrees: 2, hipRollDegrees: 4,
      bodyColor: 0x1d4e89, accentColor: 0xffd23f, muzzleColor: 0xff7a1a,
      darkColor: 0x28303b, dartColor: 0x63baff, sightColor: 0xffd23f,
      fire: { triggerDegrees: 24, pressSeconds: 0.02, releaseSeconds: 0.05 },
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.15, pos: [0.01, -0.035, 0.02], rot: [10, 8, 25] },
          { t: 0.65, pos: [0.01, -0.04, 0.02], rot: [12, 8, 28] },
          { t: 0.75, pos: [0, -0.04, 0.02], rot: [6, 6, 20] },
          { t: 0.9, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.14, pos: [-0.02, 0.065, -0.045], rot: [0, 0, 0] },
          { t: 0.32, pos: [-0.13, -0.25, 0.1], rot: [-20, 0, 0] },
          { t: 0.43, pos: [-0.13, -0.25, 0.1], rot: [-20, 0, 0] },
          { t: 0.6, pos: [-0.03, 0.065, -0.045], rot: [0, 0, 0] },
          { t: 0.65, pos: [-0.02, 0.065, -0.045] },
          { t: 0.84, pos: [0, 0, 0] },
        ],
        drumGone: [0.2, 0.65], oldDrumVisible: [0.2, 0.32], newDrumVisible: [0.4, 0.65],
        events: [
          { at: 0.2, sound: 'foamReloadOut' },
          { at: 0.65, sound: 'foamReloadIn', jolt: { up: -0.01, pitchDegrees: -3, rollDegrees: 2 } },
          { at: 0.86, sound: 'foamReloadReady', jolt: { back: 0.006, pitchDegrees: 2 } },
        ],
      },
    },
  },

  // Service Corridor shotgun: one shell, twelve pellets; rewards close-range positioning.
  confettiCannon: {
    id: 'confettiCannon', name: 'Confetti Cannon', fireMode: 'semi',
    // ROLE: the room-clearer. Reliable round-3 chest kills within ~3m, useful hip fire through ~4m.
    // Full pellet damage through 4m, then a gradual fade; the cone still limits single-target range.
    // Aiming down sights extends reliable damage to ~5m. No single BODY blast can kill round 5,
    // leaving room for upgrades (a point-blank head blast can: a deliberate, risky reward). (tests/balance.test.js checks all of this; `npm run balance` shows it.)
    pellets: { count: 12, spreadDegrees: 6.0, adsMultiplier: 0.45, tracerColors: [0xff6abc, 0xffd23f] },
    falloff: { start: 4, end: 12, minMultiplier: 0.1 },
    // A pellet that goes through a zombie hits the one behind it at half damage (clears clumps).
    pierce: { maxTargets: 2, damageFalloff: [1, 0.5] },
    damage: 36, headshotMultiplier: 2, // a point-blank blast is 12 x 36 = 432: one-shots rounds 1-3 (and round 4 point blank)
    magazineSize: 6, startingReserve: 24, // a six-shell tube; 30 shells in all
    // Shell-by-shell reload: open up, one shell per cycle, close up. Firing interrupts it once a shell is in.
    // `progress` = which window of the reload animation each phase plays (the shell window repeats per shell).
    shellReload: { startSeconds: 0.4, shellSeconds: 0.4, endSeconds: 0.35,
      progress: { start: [0, 0.3], shell: [0.3, 0.7], end: [0.7, 1] } },
    fireInterval: 0.55, fireBuffer: 0.12, reloadTime: 2.4, range: 60, // (reloadTime is unused with shellReload)
    recoil: {
      pitchDegrees: 3.5, yawDegrees: 0.4, rollDegrees: 0.95, adsMultiplier: 0.75,
      model: { back: 0.095, up: 0.02, pitchDegrees: 15, yawDegrees: 2.4, rollDegrees: 5,
        adsMultiplier: 0.55, frequency: 4.5, damping: 0.54 },
    },
    impact: {
      flinch: 2.2,
      knockback: 3.6,
      hitstopSeconds: 0.035,
      deathImpulse: 1.85,
    },
    spread: {
      base: 0.35, moving: 0.8, maxMovingFactor: 1.6, airborne: 1.5,
      perShot: 0.65, maxBloom: 1.5, bloomRecoveryDelay: 0.15, bloomRecovery: 4,
      smoothing: 10, adsMultiplier: 0.1,
    },
    ads: { seconds: 0.22, fovMultiplier: 0.85, offset: { x: 0, y: -0.077, z: -0.43 } },
    muzzleFlash: {
      seconds: 0.075, size: 0.4, coreSize: 0.16, outerOpacity: 0.9, sizeJitter: 0.2,
      forwardOffset: 0.07, outerColor: 0xff62bb, coreColor: 0xffef8a,
      adsWidth: 1.5, adsHeight: 0.65, adsTwistFraction: 0.06,
      lightColor: 0xffb4da, handLightIntensity: 0.8, handLightRange: 1,
      worldLightIntensity: 14, worldLightRange: 10,
    },
    sounds: { fire: 'confettiShot', dryFire: 'dryClick' },
    tracerColor: 0xff6abc,
    viewmodel: {
      model: 'confettiCannon', hipOffset: { x: 0.18, y: -0.155, z: -0.44 },
      aimYawDegrees: 9, hipPitchDegrees: 2, hipRollDegrees: 4,
      bodyColor: 0xff62bb, accentColor: 0x8544c8, metalColor: 0xffd23f,
      darkColor: 0x312438, sightColor: 0xffef8a, shellColor: 0xfff1d9,
      fire: { triggerDegrees: 28, pressSeconds: 0.03, releaseSeconds: 0.12 },
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.15, pos: [0.015, -0.03, 0.02], rot: [10, 10, 18] },
          { t: 0.74, pos: [0.015, -0.03, 0.02], rot: [10, 10, 18] },
          { t: 0.88, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // Shell-by-shell timeline (see shellReload.progress): 0-0.3 break open, 0.3-0.7 ONE shell (hand grabs it,
        // pushes it in; this window repeats for every shell), 0.7-1 snap shut.
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.12, pos: [0, -0.02, 0.02] },
          { t: 0.3, pos: [-0.1, -0.24, 0.12], rot: [-20, 0, 0] }, // low, grabbing a shell
          { t: 0.42, pos: [-0.08, 0.11, 0.045] }, // lift outside the wider receiver first
          { t: 0.48, pos: [0.026, 0.11, 0.03] }, // over the open breech, fingers behind it
          { t: 0.6, pos: [0.026, 0.11, 0.03] }, // shell slides in without pushing the palm into the gun
          { t: 0.64, pos: [-0.08, 0.11, 0.045] }, // withdraw sideways before lowering past the receiver
          { t: 0.7, pos: [-0.1, -0.24, 0.12], rot: [-20, 0, 0] }, // back down: the same pose the next shell starts from
          { t: 0.86, pos: [0, 0, 0] },
        ],
        barrelKeys: [
          { t: 0, rot: [0, 0, 0] }, { t: 0.18, rot: [-32, 0, 0] },
          { t: 0.74, rot: [-32, 0, 0] }, { t: 0.84, rot: [0, 0, 0] },
          { t: 1, rot: [0, 0, 0] },
        ],
        shellKeys: [
          { t: 0, pos: [-0.07, -0.055, -0.08], rot: [-32, 0, 0] },
          { t: 0.48, pos: [-0.07, -0.055, -0.08], rot: [-32, 0, 0] },
          { t: 0.6, pos: [-0.07, -0.089, -0.134], rot: [-32, 0, 0] },
          { t: 0.7, pos: [-0.07, -0.055, -0.08], rot: [-32, 0, 0] },
        ],
        shellVisible: [[0.31, 0.6]], // the shell in the hand, until it's pushed in
        events: [
          { at: 0.18, sound: 'confettiReloadOut' },
          { at: 0.6, sound: 'confettiReloadIn', jolt: { up: -0.006, pitchDegrees: -2 } }, // each shell
          { at: 0.84, sound: 'confettiReloadReady', jolt: { back: 0.015, pitchDegrees: 4 } },
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
    hitAtSeconds: 0.15, // when in the swing the hit lands
    hitRecoverySeconds: 0.22, // gun and another slash ready 0.37s after a connected swing
    missRecoverySeconds: 0.5, // whiffing commits the gun for 0.65s in total
    impactProgress: 0.3, // animation reaches its hit pose at the fixed impact time
    commitTurnDegrees: 12, // small aim correction before impact; attack direction stays fixed
    lungeRange: 3.0, // a target this close (but out of reach) makes you lurch at it
    lungeSpeed: 9, // m/s during the lunge
    lungeMaxSeconds: 0.2,
    lungeStopFraction: 0.6, // the lunge stops when the target is this fraction of `range` away
    impactJoltDegrees: 1.8, // view jolt when the slash connects
    splatCount: 30, // big splatter on a hit
    impact: {
      flinch: 1.5,
      knockback: 2.0,
      hitstopSeconds: 0.025,
      deathImpulse: 1.4,
    },
    colors: { handle: 0xffd23f, blade: 0xdfe6ee, grip: 0x2b2b2b },
  },
};

// Defaults for the player-side weapon multipliers in the stats object.
export const weaponStatDefaults = {
  damageMultiplier: 1, // all gun damage is multiplied by this
  meleeDamageMultiplier: 1, // box cutter damage is multiplied by this
  reloadSpeed: 1, // reload time is divided by this (2 = twice as fast)
};
