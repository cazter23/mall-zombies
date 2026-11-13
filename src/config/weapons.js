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
//   clawOnly: true  never sold on a wall (the wall-buy feature refuses it); it only comes out of GRAB-A-GUN (game/features/clawMachine.js)
//   fuel:  { regenDelay, regenPerSecond, restartAt }  a tank instead of a reload: `magazineSize` is the tank (weapons/fuel.js)
//   cone:  { range, halfAngleDegrees, ... }  a wide push instead of a ray (weapons/coneBlast.js; playerGun.js fires it)
//   instantKill: { bigFraction, box }  kills any zombie outright; bosses and Mascots take bigFraction of their max health instead (weapons/gunStats.js hitDamage)
//   refillFraction: 0.5  a refill (RESTOCK-O-MATIC, Refurbished) fills only this share of the reserve (weapon.js)
//   projectile: { speed, gravity, restitution, maxBounces, ... }  a lobbed, bouncing ball instead of a ray (weapons/ballistics.js; each zombie it touches is a hit)
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
    damage: 30, // round-1 Shopper (150 HP): 5 body shots or 3 headshots
    headshotMultiplier: 2,
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
      darkColor: 0xa31b28, // stamped ribs
      metalColor: 0x9aa0a8,
      accentColor: 0xd8dde4, // bright chrome and staples
      brandLabel: { paper: '#f1faee', stripe: '#d62839', title: '#ffffff', ink: '#1d1626', fallbackColor: 0xd8dde4 },
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
  // ROLE: the cheap early-game close-range sprayer. Quick reloads and affordable ammo,
  // but premium guns offer more firepower and the stickers lose punch with range,
  // so the Nail Gun / Foam Dart Blaster own the long sightlines. (tests/balance.test.js checks this.)
  priceGun: {
    id: 'priceGun',
    name: 'Price Gun',
    fireMode: 'auto',
    damage: 58, // round-1 Shopper (150 HP): 3 body shots or 2 headshots (was 70: within 11% of the Rivet Rifle for a sixth of its route; docs/economy-report.md, A)
    headshotMultiplier: 1.5,
    magazineSize: 24,
    startingReserve: 144, // six magazines; also the reserve cap for ammo buys
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
  // ROLE: precise long-range penetration. No falloff, so each nail keeps its damage at 30 m.
  nailGun: {
    id: 'nailGun',
    name: 'Nail Gun',
    fireMode: 'semi',
    damage: 135, // round-1 zombie (150 HP): 2 body / 1 head; round 8 (675): 5 body / 3 head
    headshotMultiplier: 2,
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
  // ROLE: accurate mid-range bursts with a quick aim and better reach than the Price Gun.
  // Premium automatics sustain more damage, while the Nail Gun rewards lined-up targets.
  foamDartBlaster: {
    id: 'foamDartBlaster', name: 'Foam Dart Blaster', fireMode: 'burst',
    burst: { count: 3, interval: 0.07 },
    damage: 90, headshotMultiplier: 1.75, // 270 body damage per full burst
    magazineSize: 30, startingReserve: 144, // ten full bursts; reserve unchanged
    fireInterval: 0.16, // pause after the LAST dart; three darts every 0.3 s
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
      bodyColor: 0x1d4e89, accentColor: 0xffb800, muzzleColor: 0xff7a1a,
      darkColor: 0x28303b, dartColor: 0x63baff, sightColor: 0xffb800,
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
    // ROLE: the room-clearer. A close body blast can kill a round-8 Shopper; spread still limits reach.
    // Full pellet damage through 4m, then a gradual fade; the cone still limits single-target range.
    // Aiming down sights extends useful damage to ~5m. (tests/balance.test.js checks this;
    // `npm run balance` shows it.)
    pellets: { count: 12, spreadDegrees: 6.0, adsMultiplier: 0.45, tracerColors: [0xff6abc, 0xffd23f] },
    falloff: { start: 4, end: 12, minMultiplier: 0.1 },
    // A pellet that goes through a zombie hits the one behind it at half damage (clears clumps).
    pierce: { maxTargets: 2, damageFalloff: [1, 0.5] },
    damage: 70, headshotMultiplier: 1.2, // a point-blank body blast is 12 x 70 = 840
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

  // WALL BUY: Grand Atrium (economy.wallBuys). Debug H still cycles it.
  // ROLE: steady medium-range body damage, paid for with slower ADS/strafe.
  // Stronger per-hit damage than Price, with a full 30-round magazine; no penetration.
  rivetRifle: {
    id: 'rivetRifle', name: 'Rivet Rifle', fireMode: 'auto',
    damage: 95, headshotMultiplier: 1.75,
    magazineSize: 30, startingReserve: 144,
    fireInterval: 0.1, fireBuffer: 0.1, reloadTime: 2, range: 100,
    falloff: { start: 12, end: 28, minMultiplier: 0.6 },
    recoil: {
      pitchDegrees: 0.9, yawDegrees: 0.16, rollDegrees: 0.25, adsMultiplier: 0.7,
      model: { back: 0.043, up: 0.008, pitchDegrees: 5.5, yawDegrees: 0.7, rollDegrees: 1.6,
        adsMultiplier: 0.38, frequency: 7.5, damping: 0.6 },
    },
    impact: { flinch: 1.1, knockback: 0.95, hitstopSeconds: 0, deathImpulse: 1.3 },
    spread: {
      base: 1.15, moving: 2.7, maxMovingFactor: 1.6, airborne: 4,
      perShot: 0.7, maxBloom: 4, bloomRecoveryDelay: 0.18, bloomRecovery: 5,
      smoothing: 10, adsMultiplier: 0.055,
    },
    ads: { seconds: 0.26, fovMultiplier: 0.78, moveSpeedMultiplier: 0.78,
      offset: { x: 0, y: -0.094, z: -0.46 } },
    muzzleFlash: {
      seconds: 0.035, size: 0.13, coreSize: 0.05, outerOpacity: 0.7, sizeJitter: 0.18,
      forwardOffset: 0.06, outerColor: 0xffbf70, coreColor: 0xfff3d2,
      adsWidth: 1.7, adsHeight: 0.55, adsTwistFraction: 0.05,
      lightColor: 0xffd5a0, handLightIntensity: 0.25, handLightRange: 0.8,
      worldLightIntensity: 3, worldLightRange: 6,
    },
    sounds: { fire: 'rivetShot', dryFire: 'dryClick' }, tracerColor: 0xffd5a0,
    viewmodel: {
      model: 'rivetRifle', hipOffset: { x: 0.18, y: -0.145, z: -0.43 },
      aimYawDegrees: 8, hipPitchDegrees: 2, hipRollDegrees: 3,
      bodyColor: 0x217f84, accentColor: 0xf49d36, darkColor: 0x252e35,
      metalColor: 0xa9b9bd, sightColor: 0xffcf52,
      fire: { triggerDegrees: 24, boltTravel: 0.018, pressSeconds: 0.022, releaseSeconds: 0.075 },
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.16, pos: [0.015, 0.015, 0.04], rot: [8, 6, 24] },
          { t: 0.65, pos: [0.015, 0.015, 0.04], rot: [10, 6, 26] },
          { t: 0.78, pos: [0.01, 0, 0.02], rot: [5, 3, 16] },
          { t: 0.94, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.15, pos: [0.03, -0.035, 0.105], rot: [0, 0, 0] },
          { t: 0.34, pos: [-0.1, -0.3, 0.14], rot: [-15, 0, -10] },
          { t: 0.46, pos: [-0.1, -0.3, 0.14], rot: [-15, 0, -10] },
          { t: 0.67, pos: [0.03, -0.035, 0.105], rot: [0, 0, 0] },
          { t: 0.81, pos: [0.015, 0.08, 0.08], rot: [12, 0, 0] },
          { t: 0.95, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        magazineGone: [0.22, 0.68], oldMagazineVisible: [0.22, 0.34], newMagazineVisible: [0.46, 0.68],
        events: [
          { at: 0.22, sound: 'rivetReloadOut' },
          { at: 0.68, sound: 'rivetReloadIn', jolt: { up: -0.008, pitchDegrees: -2 } },
          { at: 0.83, sound: 'rivetReloadReady', jolt: { back: 0.005, pitchDegrees: 2 } },
        ],
      },
    },
  },

  // WALL BUY: Cinema projection passage (economy.wallBuys).
  // ROLE: heavy industrial LMG. Huge 64-nail wire-collated drum and 2-target pierce chew through
  // corridor hordes for over 6 seconds straight, paid for with heavy ADS handling and a long 3.1s drum swap.
  coilNailer: {
    id: 'coilNailer', name: 'Heavy Coil Nailer', fireMode: 'auto',
    damage: 95, headshotMultiplier: 1.5,
    pierce: { maxTargets: 2, damageFalloff: [1, 0.5] },
    magazineSize: 64, startingReserve: 256,
    fireInterval: 0.1, fireBuffer: 0.1, reloadTime: 3.1, range: 90,
    falloff: { start: 15, end: 30, minMultiplier: 0.65 },
    recoil: {
      pitchDegrees: 0.68, yawDegrees: 0.28, rollDegrees: 0.38, adsMultiplier: 0.68,
      model: {
        back: 0.048, up: 0.009, pitchDegrees: 6.2, yawDegrees: 1.5, rollDegrees: 2.8,
        adsMultiplier: 0.4, frequency: 7.2, damping: 0.54,
      },
    },
    impact: { flinch: 1.25, knockback: 1.35, hitstopSeconds: 0.012, deathImpulse: 1.35 },
    spread: {
      base: 1.35, moving: 2.9, maxMovingFactor: 1.6, airborne: 4.2,
      perShot: 0.28, maxBloom: 3.8, bloomRecoveryDelay: 0.18, bloomRecovery: 4.8,
      smoothing: 9, adsMultiplier: 0.08,
    },
    ads: {
      seconds: 0.3, fovMultiplier: 0.82, moveSpeedMultiplier: 0.72,
      offset: { x: 0, y: -0.082, z: -0.42 },
    },
    muzzleFlash: {
      seconds: 0.045, size: 0.2, coreSize: 0.08, outerOpacity: 0.82, sizeJitter: 0.22,
      forwardOffset: 0.06, outerColor: 0xe6a145, coreColor: 0xfff4c2,
      adsWidth: 1.7, adsHeight: 0.6, adsTwistFraction: 0.06,
      lightColor: 0xffd28a, handLightIntensity: 0.45, handLightRange: 0.9,
      worldLightIntensity: 7, worldLightRange: 8,
    },
    sounds: { fire: 'coilShot', dryFire: 'dryClick' },
    tracerColor: 0xd8a24a,
    viewmodel: {
      model: 'coilNailer', hipOffset: { x: 0.185, y: -0.155, z: -0.43 },
      aimYawDegrees: 9, hipPitchDegrees: 2, hipRollDegrees: 4,
      bodyColor: 0xd96b27, drumColor: 0x3a3f47, coilColor: 0xd8a24a,
      darkColor: 0x22262b, metalColor: 0x9ea6b0, sightColor: 0xffd23f,
      fire: { triggerDegrees: 24, nosePunch: 0.015, capHop: 0.006, pressSeconds: 0.02, releaseSeconds: 0.065 },
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.14, pos: [0.018, -0.02, 0.03], rot: [12, 8, 28] },
          { t: 0.66, pos: [0.02, -0.025, 0.03], rot: [14, 8, 30] },
          { t: 0.78, pos: [0.01, -0.015, 0.015], rot: [6, 4, 16] },
          { t: 0.94, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.16, pos: [0.02, -0.03, 0.06], rot: [0, 0, 0] },
          { t: 0.34, pos: [-0.11, -0.28, 0.14], rot: [-18, 0, -8] },
          { t: 0.48, pos: [-0.11, -0.28, 0.14], rot: [-18, 0, -8] },
          { t: 0.68, pos: [0.02, -0.03, 0.06], rot: [0, 0, 0] },
          { t: 0.82, pos: [0.01, 0.05, 0.04], rot: [10, 0, 0] },
          { t: 0.95, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        drumGone: [0.2, 0.68], oldDrumVisible: [0.2, 0.34], newDrumVisible: [0.46, 0.68],
        events: [
          { at: 0.2, sound: 'coilReloadOut' },
          { at: 0.68, sound: 'coilReloadIn', jolt: { up: -0.012, pitchDegrees: -3.5, rollDegrees: 2.5 } },
          { at: 0.84, sound: 'coilReloadReady', jolt: { back: 0.008, pitchDegrees: 2.5 } },
        ],
      },
    },
  },

  // WALL BUY: Byte Me Electronics, east face of its pod (economy.wallBuys).
  // ROLE: SCAN AND RING UP (13 November 2026 rework). HOLD the trigger to scan: a red scan line sweeps the target, the window and LEDs fill, a
  // ring fills round the crosshair and the capacitor whines up. The moment the scan completes (charge.seconds) the beam fires BY ITSELF with a
  // checkout BEEP: every shot is a full shot, piercing up to 4 in a line. Let go before it completes and nothing fires (no ammo spent); keep
  // holding and it scans again. Everything the beam hits and doesn't kill is RUNG UP for rungUp.seconds (a red price tag over it, game/rungUp.js):
  // it takes rungUp.damageTaken x damage from EVERYTHING (your other gun, the box cutter, hazards, the next beam) and a kill while it is marked
  // pays rungUp.killBonus extra. Tuned to sit with the Rivet Rifle overall (it out-damages it once its own follow-up beams land on marked zombies),
  // the best gun of the wall against one tough target (2x headshots on a marked target) and against a line (tests/balance.test.js).
  // (It was tap-or-hold-and-release: the tap was a weak 35% snap, the full shot needed a release, and played like a normal gun it was weaker than
  // the 500-point Price Gun.)
  barcodeScanner: {
    id: 'barcodeScanner', name: 'Barcode Scanner', fireMode: 'charge',
    charge: { seconds: 0.45, sound: 'scannerCharge' }, // the scan; it fires itself when complete (weapons/weapon.js)
    damage: 420, headshotMultiplier: 2,
    pierce: { maxTargets: 4, damageFalloff: [1, 0.85, 0.7, 0.55] },
    // The mark (game/rungUp.js; fx/rungUpView.js draws the tag). seconds: how long it lasts (a new beam restarts it); damageTaken: x damage from
    // everything while marked; killBonus: points on top of the kill's own pay. tag: the price tag over its head (m, colours).
    rungUp: {
      seconds: 4, damageTaken: 1.35, killBonus: 40,
      tag: { width: 0.26, height: 0.16, depth: 0.02, hole: 0.025, above: 0.32, spin: 2.2, bob: 0.04, color: 0xe8202c, holeColor: 0xfff4e8 },
    },
    // The scan line on the target while charging (fx/scanLine.js): a red laser from the gun to what you aim at, and a bar sweeping it.
    scanLine: { color: 0xff2a38, laserWidth: 0.006, barWidth: 0.7, barHeight: 0.02, sweep: 0.9, sweepHz: 3, opacity: 0.9, maxRange: 60 },
    magazineSize: 8, startingReserve: 40,
    fireInterval: 0.2, fireBuffer: 0.12, reloadTime: 1.8, range: 100,
    falloff: { start: 12, end: 30, minMultiplier: 0.6 }, // a store-aisle gun, not a sniper: the Stargazer keeps the long hits
    recoil: {
      pitchDegrees: 2.1, yawDegrees: 0.2, rollDegrees: 0.55, adsMultiplier: 0.6,
      model: {
        back: 0.068, up: 0.014, pitchDegrees: 10.5, yawDegrees: 1.2, rollDegrees: 3.2,
        adsMultiplier: 0.38, frequency: 6.4, damping: 0.52,
      },
    },
    impact: { flinch: 1.85, knockback: 2.5, hitstopSeconds: 0.03, deathImpulse: 1.65 },
    spread: {
      base: 0.45, moving: 1.8, maxMovingFactor: 1.6, airborne: 2.8,
      perShot: 0.9, maxBloom: 2.4, bloomRecoveryDelay: 0.15, bloomRecovery: 5,
      smoothing: 10, adsMultiplier: 0.025,
    },
    ads: {
      seconds: 0.2, fovMultiplier: 0.7,
      offset: { x: 0, y: -0.072, z: -0.4 },
    },
    muzzleFlash: {
      seconds: 0.06, size: 0.24, coreSize: 0.1, outerOpacity: 0.92, sizeJitter: 0.15,
      forwardOffset: 0.06, outerColor: 0xff2a38, coreColor: 0xffd6dc,
      adsWidth: 1.6, adsHeight: 0.55, adsTwistFraction: 0.05,
      lightColor: 0xff4d5a, handLightIntensity: 0.75, handLightRange: 1.0,
      worldLightIntensity: 12, worldLightRange: 10,
    },
    sounds: { fire: 'scannerShot', beep: 'scannerBeep', dryFire: 'dryClick' }, // (beep: the checkout BEEP on top of the shot)
    tracerColor: 0xff2a38,
    viewmodel: {
      model: 'barcodeScanner', hipOffset: { x: 0.175, y: -0.145, z: -0.42 },
      aimYawDegrees: 9, hipPitchDegrees: 2, hipRollDegrees: 4,
      bodyColor: 0xd8dadf, darkColor: 0x262930, metalColor: 0x8f98a3,
      coilColor: 0xe07a2e, windowColor: 0xff1e2e, sightColor: 0x5fd068,
      fire: { triggerDegrees: 26, coilKick: 0.012, pressSeconds: 0.025, releaseSeconds: 0.09 },
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.15, pos: [-0.01, -0.03, 0.02], rot: [14, 10, 26] },
          { t: 0.64, pos: [-0.015, -0.035, 0.02], rot: [16, 10, 28] },
          { t: 0.76, pos: [-0.008, -0.02, 0.01], rot: [8, 6, 18] },
          { t: 0.92, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.15, pos: [0.01, -0.02, 0.02], rot: [0, 0, 0] },
          { t: 0.32, pos: [-0.08, -0.25, 0.12], rot: [-18, 0, 0] },
          { t: 0.45, pos: [-0.08, -0.25, 0.12], rot: [-18, 0, 0] },
          { t: 0.65, pos: [0.01, -0.02, 0.02], rot: [0, 0, 0] },
          { t: 0.84, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        batteryGone: [0.18, 0.65], oldBatteryVisible: [0.18, 0.32], newBatteryVisible: [0.44, 0.65],
        events: [
          { at: 0.18, sound: 'scannerReloadOut' },
          { at: 0.65, sound: 'scannerReloadIn', jolt: { up: -0.01, pitchDegrees: -3, rollDegrees: 2 } },
          { at: 0.84, sound: 'scannerReloadReady', jolt: { back: 0.006, pitchDegrees: 2 } },
        ],
      },
    },
  },
  // CLAW-ONLY (GRAB-A-GUN, phase 8): no wall sells it (clawOnly), it only comes out of the machine. Purple capsule.
  // ROLE: crowd control, not damage. A wide cone of wind that shoves everything in it back and lays the close ones flat, for a corridor or a
  // doorway. Next to nothing in damage (the weakest gun at every range, tests/balance.test.js), and it only reaches a few metres.
  // It runs on a FUEL TANK, not a magazine: hold the trigger and it pulses (each pulse costs a unit of fuel); let go and the tank refills by
  // itself; run it dry and the trigger stays locked until it holds a little again. No reload. (weapons/fuel.js, weapons/coneBlast.js)
  // `magazineSize` = the tank (the HUD, refills and Build-A-Blaster read it as the magazine); `startingReserve` is 0 (nothing to reload from).
  leafBlower: {
    id: 'leafBlower', name: 'Leaf Blower', fireMode: 'auto', clawOnly: true,
    damage: 2, headshotMultiplier: 1.2, // a pulse tickles: a Shopper takes ~20 s of it, and a Mascot much longer
    falloff: { start: 3, end: 7, minMultiplier: 0.5 }, // (the damage; the push has its own fade, cone.farFraction)
    magazineSize: 40, startingReserve: 0, // 40 pulses of fuel: about 6 s of blowing
    fuel: { regenDelay: 0.8, regenPerSecond: 7, restartAt: 10 }, // refills 0.8 s after you stop, at 7 units a second; a dry tank waits for 10
    fireInterval: 0.15, fireBuffer: 0.1, reloadTime: 1, range: 8, // (reloadTime is unused with a tank)
    // The gust: everything within `range` and the angle, with no wall between, is shoved away from you. A zombie within knockdownRange also goes
    // down for knockdownSeconds (the zombies' own slip). Bosses are unmoved. A Mascot is shoved at mascotScale. It pays the +10 hit points for a
    // zombie once every payEverySeconds, not every pulse.
    cone: {
      range: 7, halfAngleDegrees: 28, targetRadius: 0.35,
      knockback: 7.5, farFraction: 0.45, staggerSeconds: 0.3, drag: 2.4, mascotScale: 0.5,
      knockdownRange: 3.2, knockdownSeconds: 1.1, knockdownDrag: 1.6,
      payEverySeconds: 1.2,
      gust: { count: 6, speed: 6, size: 0.05, colors: [0x7bc96f, 0xc9d94a, 0xe8a23b, 0xb9783a] }, // the leaves it kicks up, per pulse
    },
    recoil: {
      pitchDegrees: 0.25, yawDegrees: 0.15, rollDegrees: 0.2, adsMultiplier: 0.7,
      model: { back: 0.012, up: 0.003, pitchDegrees: 1.6, yawDegrees: 0.8, rollDegrees: 1.2,
        adsMultiplier: 0.5, frequency: 9, damping: 0.6 },
    },
    impact: { flinch: 0.3, knockback: 0, hitstopSeconds: 0, deathImpulse: 1 }, // (the cone shoves; the pulse's own hit doesn't)
    spread: {
      base: 0.2, moving: 0.4, maxMovingFactor: 1.4, airborne: 0.8,
      perShot: 0.1, maxBloom: 0.4, bloomRecoveryDelay: 0.15, bloomRecovery: 3,
      smoothing: 10, adsMultiplier: 0.6,
    },
    ads: { seconds: 0.25, fovMultiplier: 0.92, offset: { x: 0, y: -0.07, z: -0.4 } },
    muzzleFlash: {
      seconds: 0.05, size: 0.16, coreSize: 0.07, outerOpacity: 0.5, sizeJitter: 0.3,
      forwardOffset: 0.05, outerColor: 0xbfe8c8, coreColor: 0xffffff,
      adsWidth: 1.4, adsHeight: 0.6, adsTwistFraction: 0.1,
      lightColor: 0xcfeedd, handLightIntensity: 0.15, handLightRange: 0.6,
      worldLightIntensity: 2, worldLightRange: 4,
    },
    sounds: { fire: 'leafBlowerPuff', dryFire: 'dryClick' },
    tracerColor: 0xbfe8c8,
    viewmodel: {
      model: 'leafBlower', hipOffset: { x: 0.17, y: -0.165, z: -0.43 },
      aimYawDegrees: 6, hipPitchDegrees: 1, hipRollDegrees: 3,
      bodyColor: 0xf0a31c, accentColor: 0x2f6f3a, metalColor: 0xbfc5cc, // a garden-centre orange, with green trim
      darkColor: 0x2b2f33, sightColor: 0xfff0b0, tankColor: 0xe8531f,
      fire: { triggerDegrees: 22, pressSeconds: 0.04, releaseSeconds: 0.1 },
      // (no reload: the tank refills itself. A gun with a tank never plays these; the keys keep the model's reload sampling valid.)
      reload: {
        gunKeys: [{ t: 0, pos: [0, 0, 0], rot: [0, 0, 0] }, { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] }],
        events: [],
      },
    },
  },
  // CLAW-ONLY (GRAB-A-GUN, phase 9): no wall sells it (clawOnly), it only comes out of the machine. Purple capsule.
  // ROLE: the corridor gun. It THROWS a ball (weapons/ballistics.js) instead of firing a ray: the ball bounces off walls, the floor and every zombie it
  // hits, and each zombie it touches is a hit; after a zombie it is sent on at the nearest other zombie in view. In the open it is one hit a shot:
  // decent, a little under the Price Gun in the early rounds. In a tight space, the Service Corridor or the cinema stairs, one ball hits two or three
  // zombies, and that is where it beats the guns of the wall.
  // It KEEPS UP WITH THE ROUNDS (13 November 2026 rework; it was a flat 50 a hit, ~23 hits a round-15 Shopper): each hit is multiplied by the round's
  // Shopper health ^ roundScaling.exponent (weapons/gunStats.js roundDamageScale, by the round the zombie spawned in), so a Shopper takes ~3 hits in
  // the early rounds and ~4 from the mid rounds to round 30, like the other claw guns that hold their value late.
  // The damage is per HIT, with a falloff over the distance the BALL has flown (bounces included), so a long chain fades out.
  tennisBallLauncher: {
    id: 'tennisBallLauncher', name: 'Tennis Ball Launcher', fireMode: 'semi', clawOnly: true,
    damage: 60, headshotMultiplier: 1.5, // round 1: 60 a hit (3 hits a 150 Shopper); round 15 ~340, round 25 ~630 (roundScaling)
    roundScaling: { exponent: 0.85 }, // x (Shopper health that round / 150) ^ 0.85
    falloff: { start: 14, end: 36, minMultiplier: 0.5 }, // by metres the ball has FLOWN
    magazineSize: 6, startingReserve: 30,
    fireInterval: 0.45, fireBuffer: 0.12, reloadTime: 2.3, range: 40, // (range: for the balance tools; the ball ends by bounces and lifeSeconds)
    // The ball. speed m/s at the muzzle, gravity m/s^2 (the lob), restitution = speed kept by a bounce, maxBounces = every bounce counts (wall, floor, zombie),
    // lifeSeconds in the air, radius m, minSpeed = slower than this and it has stopped, rehitSeconds = the same zombie can't be hit twice in a row inside
    // this, seekRange m = after a zombie it is thrown on at the nearest OTHER zombie this close and in view (0 = it only reflects), startOffset / startDrop =
    // where it leaves, in front of and below the eye. zeroDistance m = the throw is angled so the ball crosses the crosshair this far out (it leaves
    // below the eye and gravity pulls it down: unzeroed, the old 21 m/s ball was ~0.8 m under the crosshair at 10 m). look: the colours (fx/ballView.js).
    // (Faster and flatter since the rework: 28 m/s and 4 m/s^2, so it lands near where you aim from a few metres to ~20 m.)
    projectile: {
      speed: 28, gravity: 4, restitution: 0.84, maxBounces: 5, lifeSeconds: 3.2, radius: 0.07, minSpeed: 2.2, rehitSeconds: 0.35, seekRange: 4.5,
      startOffset: 0.55, startDrop: -0.08, zeroDistance: 10, bounceSound: 'tennisBounce',
      look: { color: 0xcfe23a, seamColor: 0xf6f6e6 },
    },
    recoil: {
      pitchDegrees: 2.2, yawDegrees: 0.3, rollDegrees: 0.6, adsMultiplier: 0.7,
      model: { back: 0.07, up: 0.015, pitchDegrees: 11, yawDegrees: 1.6, rollDegrees: 3.5,
        adsMultiplier: 0.5, frequency: 5.2, damping: 0.5 },
    },
    impact: { flinch: 1.5, knockback: 1.6, hitstopSeconds: 0.02, deathImpulse: 1.4 },
    spread: {
      base: 0.5, moving: 1.2, maxMovingFactor: 1.5, airborne: 2,
      perShot: 0.6, maxBloom: 1.5, bloomRecoveryDelay: 0.2, bloomRecovery: 3,
      smoothing: 10, adsMultiplier: 0.25,
    },
    ads: { seconds: 0.24, fovMultiplier: 0.86, offset: { x: 0, y: -0.075, z: -0.42 } },
    muzzleFlash: {
      seconds: 0.06, size: 0.22, coreSize: 0.09, outerOpacity: 0.7, sizeJitter: 0.2,
      forwardOffset: 0.06, outerColor: 0xe9f27a, coreColor: 0xffffff,
      adsWidth: 1.4, adsHeight: 0.6, adsTwistFraction: 0.08,
      lightColor: 0xf4f7b8, handLightIntensity: 0.4, handLightRange: 0.8,
      worldLightIntensity: 6, worldLightRange: 6,
    },
    sounds: { fire: 'tennisLaunch', dryFire: 'dryClick' },
    tracerColor: 0xe9f27a,
    viewmodel: {
      model: 'tennisBallLauncher', hipOffset: { x: 0.17, y: -0.16, z: -0.44 },
      aimYawDegrees: 7, hipPitchDegrees: 1.5, hipRollDegrees: 3,
      bodyColor: 0x2d6fd6, accentColor: 0xf6f6e6, metalColor: 0xbfc5cc, // sporting-goods blue, with white trim
      darkColor: 0x24282d, sightColor: 0xffd23f, ballColor: 0xcfe23a,
      fire: { triggerDegrees: 24, pressSeconds: 0.03, releaseSeconds: 0.12 },
      // Reload: the gun tips back, the support hand fetches a ball from the hopper's top and drops it in the port, then it comes level.
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.2, pos: [0.01, -0.02, 0.03], rot: [12, 6, 10] },
          { t: 0.8, pos: [0.01, -0.02, 0.03], rot: [12, 6, 10] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.18, pos: [-0.04, -0.12, 0.08], rot: [-15, 0, 0] }, // down, to the ball bin
          { t: 0.4, pos: [-0.05, -0.12, 0.08], rot: [-15, 0, 0] }, // grabs a ball
          { t: 0.62, pos: [0.022, 0.1, 0.02] }, // up over the loading port on top
          { t: 0.74, pos: [0.022, 0.09, 0.02] }, // drops it in
          { t: 0.9, pos: [0, 0, 0] },
        ],
        ballVisible: [[0.4, 0.72]], // the ball in the hand, from the grab to the drop
        events: [
          { at: 0.2, sound: 'tennisReloadOut' },
          { at: 0.72, sound: 'tennisReloadIn', jolt: { up: -0.006, pitchDegrees: -2 } },
          { at: 0.9, sound: 'tennisReloadReady', jolt: { back: 0.012, pitchDegrees: 3 } },
        ],
      },
    },
  },
  // THE WONDER WEAPON (GRAB-A-GUN, phase 10): clawOnly, a RAINBOW capsule, the rarest prize in the machine, a mall joke you cannot buy anywhere.
  // RETURN TO SENDER: a returns-desk pneumatic tube cannon. One pull fires a RETURN BLAST, a wide cone of packing wind (`cone`, weapons/coneBlast.js, the
  // same cone the Leaf Blower uses): every zombie inside cone.killRange is BOXED and sent back to the manufacturer, an INSTANT KILL whatever the round (a
  // round-30 Shopper has 3,400 HP), and the boxes are flung away; the ones further out, to cone.range, are blown off their feet. The instant kill
  // (weapons/gunStats.js hitDamage, `instantKill`) skips bosses and Mascots: they can't be returned, so they take a big fixed hit instead (`bigFraction`
  // of their health, scaled by the gun's tiers), never a one-shot. A wall between you and a zombie shields it.
  // ROLE: the crowd answer. A pull into a crush clears it, at any round. It is kept from trivialising the late rounds by its two-shot magazine, a slow
  // reload and a slow refill: a RESTOCK-O-MATIC or a Refurbished grab fills the magazine but only HALF the reserve (`refillFraction`). The Leaf Blower
  // is the other cone gun: a steady shove that never kills.
  returnToSender: {
    id: 'returnToSender', name: 'Return to Sender', fireMode: 'semi', clawOnly: true,
    // (damage: a nominal 'what a hit is worth' for Build-A-Blaster's stuffings (weapons/gunStats.js gunPower) and the tiers; the instant kill ignores it on a zombie.)
    damage: 150, headshotMultiplier: 1.5,
    instantKill: {
      bigFraction: 0.12, // bosses and Mascots (they can't be returned): each beam takes this share of their MAX health (x the gun's tier damage)
      box: { colors: [0xc9954f, 0xe2b676, 0xf2e1b8, 0xa9772e], count: 36, speed: 4.2, size: 0.07 }, // the zombie is boxed: cardboard and packing tape fly
    },
    magazineSize: 2, startingReserve: 10, // two blasts in the tube, twelve in all
    refillFraction: 0.5, // a refill (RESTOCK-O-MATIC, a Refurbished grab) fills the magazine and only HALF the reserve: it stays special
    fireInterval: 0.9, fireBuffer: 0.12, reloadTime: 3.0, range: 12,
    // The blast (weapons/coneBlast.js findInCone / blowAway; playerGun.js fireCone). Everything in `range` and inside the angle, with no wall between, is
    // caught: a returnable zombie within killRange is returned; past it, it is shoved and laid down. A boss or Mascot within killRange takes the big hit
    // (and a Mascot is shoved at mascotScale; bosses are never moved). knockback is m/s at the muzzle, falling to farFraction of it at `range`.
    // payEverySeconds 0: every zombie caught pays its +10, every blast. gust: the cardboard and packing peanuts it throws.
    cone: {
      killRange: 9, range: 12, halfAngleDegrees: 30, targetRadius: 0.4,
      knockback: 10, farFraction: 0.5, staggerSeconds: 0.4, drag: 2.2, mascotScale: 0.5,
      knockdownRange: 12, knockdownSeconds: 1.4, knockdownDrag: 1.4,
      payEverySeconds: 0,
      gust: { count: 42, speed: 11, size: 0.07, colors: [0xc9954f, 0xe2b676, 0xf2e1b8, 0xf6f6e6, 0xff59a9] },
    },
    recoil: {
      pitchDegrees: 1.6, yawDegrees: 0.3, rollDegrees: 0.5, adsMultiplier: 0.6,
      model: { back: 0.05, up: 0.01, pitchDegrees: 7, yawDegrees: 1.2, rollDegrees: 2.5,
        adsMultiplier: 0.45, frequency: 5.6, damping: 0.5 },
    },
    impact: { flinch: 1, knockback: 0, hitstopSeconds: 0.03, deathImpulse: 3.2 }, // (a boxed zombie is flung away by the blast)
    spread: {
      base: 0.15, moving: 1.4, maxMovingFactor: 1.5, airborne: 2.5,
      perShot: 0.4, maxBloom: 1, bloomRecoveryDelay: 0.3, bloomRecovery: 3,
      smoothing: 10, adsMultiplier: 0.05,
    },
    ads: { seconds: 0.22, fovMultiplier: 0.7, offset: { x: 0, y: -0.07, z: -0.38 } },
    muzzleFlash: {
      seconds: 0.07, size: 0.26, coreSize: 0.1, outerOpacity: 0.85, sizeJitter: 0.15,
      forwardOffset: 0.06, outerColor: 0xff59a9, coreColor: 0xffffff,
      adsWidth: 1.5, adsHeight: 0.5, adsTwistFraction: 0.05,
      lightColor: 0xffb3dc, handLightIntensity: 0.6, handLightRange: 1,
      worldLightIntensity: 10, worldLightRange: 9,
    },
    sounds: { fire: 'returnBeam', dryFire: 'dryClick' },
    tracerColor: 0xff59a9,
    viewmodel: {
      model: 'returnToSender', hipOffset: { x: 0.17, y: -0.16, z: -0.43 },
      aimYawDegrees: 6, hipPitchDegrees: 1.5, hipRollDegrees: 3,
      bodyColor: 0x4a5bd8, accentColor: 0xf6f6e6, metalColor: 0xbfc5cc, // returns-desk blue and white
      darkColor: 0x20242b, sightColor: 0xff59a9, screenColor: 0x7bffb0, batteryColor: 0xffd23f, // (batteryColor: the parcel tape)
      glassColor: 0xcfe9f5, canisterColor: 0xc9954f, // the chamber's glass lid; the kraft-paper parcel canister
      fire: { triggerDegrees: 26, pressSeconds: 0.03, releaseSeconds: 0.14 },
      // Reload (models/returnToSender.js). Poses: pos in metres (right, up, back), rot in degrees (muzzle up, turn left, roll left). The gun rolls its
      // glass chamber toward you; the support hand flips the lid open, lifts out the spent canister (Out) and tosses it, brings a fresh parcel
      // canister from below and drops it in (In), shuts the lid and thumps the RETURNED stamp (Ready).
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.1, pos: [-0.03, 0.02, 0.01], rot: [8, 6, 20] }, // the chamber rolled toward you
          { t: 0.3, pos: [-0.03, 0.026, 0.014], rot: [7, 6, 22] }, // tugged as the canister comes out
          { t: 0.5, pos: [-0.025, 0.014, 0.01], rot: [5, 5, 17] }, // waits while a fresh one is fetched
          { t: 0.64, pos: [-0.03, 0.014, 0.01], rot: [9, 6, 22] }, // dipped as it drops in
          { t: 0.76, pos: [-0.028, 0.018, 0.01], rot: [7, 6, 19] }, // the lid slapped shut
          { t: 0.86, pos: [-0.02, 0.006, 0.005], rot: [3, 4, 12] }, // the stamp thumped
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // The support hand (offsets from where it holds the body's left side); canisterInHand: where a canister sits in it (the hand group's coordinates).
        canisterInHand: [-0.04, -0.01, -0.025],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.1, pos: [0.1, 0.159, 0.045] }, // on the lid's latch
          { t: 0.17, pos: [0.01, 0.179, 0.045] }, // flips it open
          { t: 0.24, pos: [0.04, 0.08, 0.045] }, // takes hold of the spent canister
          { t: 0.3, pos: [0.04, 0.16, 0.045] }, // lifts it out
          { t: 0.37, pos: [-0.12, 0.05, 0.0], rot: [0, 0, 40] }, // tosses it
          { t: 0.45, pos: [-0.06, -0.16, 0.08], rot: [-20, 0, 0] }, // down to the canister rack
          { t: 0.5, pos: [-0.06, -0.16, 0.08], rot: [-20, 0, 0] },
          { t: 0.58, pos: [0.04, 0.16, 0.045] }, // over the open chamber
          { t: 0.64, pos: [0.04, 0.08, 0.045] }, // drops it in
          { t: 0.7, pos: [0.01, 0.179, 0.045] }, // to the open lid
          { t: 0.76, pos: [0.1, 0.159, 0.045] }, // slaps it shut
          { t: 0.82, pos: [0.098, 0.135, -0.04] }, // over the stamp
          { t: 0.86, pos: [0.098, 0.122, -0.04] }, // thumps it
          { t: 0.95, pos: [0, 0, 0] },
        ],
        lidOpenDegrees: 125,
        lidKeys: [ // pos[0]: 0 shut .. 1 open
          { t: 0, pos: [0, 0, 0] }, { t: 0.1, pos: [0, 0, 0] }, { t: 0.17, pos: [1, 0, 0] },
          { t: 0.7, pos: [1, 0, 0] }, { t: 0.76, pos: [0, 0, 0] }, { t: 1, pos: [0, 0, 0] },
        ],
        stampTravel: 0.01, // how far the stamp goes down when thumped (m)
        stampKeys: [ // pos[0]: 0 up .. 1 pressed
          { t: 0, pos: [0, 0, 0] }, { t: 0.84, pos: [0, 0, 0] }, { t: 0.86, pos: [1, 0, 0] }, { t: 0.92, pos: [0, 0, 0] }, { t: 1, pos: [0, 0, 0] },
        ],
        canisterOut: [0.24, 0.64], // the chamber is empty: the seated canister is hidden
        spentVisible: [[0.24, 0.36]], // the spent canister in the hand, from the chamber until it is tossed
        freshVisible: [[0.48, 0.64]], // the fresh one, from the rack until it drops in
        events: [
          { at: 0.17, jolt: { up: 0.004, rollDegrees: -1.5 } }, // the lid flips open
          { at: 0.27, sound: 'returnReloadOut', jolt: { up: 0.006, pitchDegrees: 1.5 } },
          { at: 0.64, sound: 'returnReloadIn', jolt: { up: -0.008, pitchDegrees: -2 } },
          { at: 0.76, jolt: { up: -0.005, rollDegrees: 2 } }, // the lid slapped shut
          { at: 0.86, sound: 'returnReloadReady', jolt: { up: -0.01, pitchDegrees: -3 } }, // the stamp
        ],
      },
    },
  },
  // CLAW-ONLY (GRAB-A-GUN): the STARGAZER 3000, a hobby-shop telescope someone fitted with a bolt and a trigger. It fires steel ball bearings. Purple capsule.
  // ROLE: the sniper, the gun that is BETTER THE FURTHER AWAY the target is. Its falloff RISES (minMultiplier above 1: weapons/gunStats.js damageFalloff
  // runs the same straight line up instead of down), so a bearing does twice the damage at 30 m that it does across a room, and it goes through a line
  // of zombies. Down the long Hallway one aimed headshot kills a Shopper up to about round 20; close up it is clumsy: a slow bolt, a wide hip cone
  // and below the Price Gun at 2 and 5 m (tests/balance.test.js). A REAL SCOPE (weapons/scope.js): aiming in fills the view with the eyepiece, the
  // view sways in a slow figure eight (less crouched or prone), and you stay in the scope while the bolt is worked between shots.
  stargazer: {
    id: 'stargazer', name: 'Stargazer 3000', fireMode: 'semi', clawOnly: true,
    damage: 300, headshotMultiplier: 3, // the headshot gun: the biggest multiplier there is
    // RISING falloff: full (1x) up to `start`, then up in a straight line to minMultiplier (2x) at `end` and beyond.
    falloff: { start: 8, end: 30, minMultiplier: 2 },
    pierce: { maxTargets: 4, damageFalloff: [1, 0.85, 0.7, 0.55] }, // a bearing goes through a queue of shoppers
    magazineSize: 5, startingReserve: 30,
    fireInterval: 1.2, fireBuffer: 0.15, reloadTime: 3.0, range: 120,
    recoil: {
      pitchDegrees: 3.2, yawDegrees: 0.5, rollDegrees: 0.8, adsMultiplier: 0.55,
      model: { back: 0.07, up: 0.012, pitchDegrees: 9, yawDegrees: 1.2, rollDegrees: 2.5,
        adsMultiplier: 0.4, frequency: 5, damping: 0.5 },
    },
    impact: { flinch: 1.6, knockback: 1.6, hitstopSeconds: 0.02, deathImpulse: 2.2 },
    spread: { // clumsy from the hip (a telescope is not a pistol); dead on through the scope
      base: 4.5, moving: 3, maxMovingFactor: 1.6, airborne: 6,
      perShot: 2, maxBloom: 3, bloomRecoveryDelay: 0.3, bloomRecovery: 4,
      smoothing: 10, adsMultiplier: 0.01,
    },
    ads: { seconds: 0.38, fovMultiplier: 0.28, moveSpeedMultiplier: 0.6, offset: { x: 0, y: -0.1, z: -0.4 } },
    // The scope (weapons/scope.js). overlayFrom: the ADS amount where the eyepiece starts filling the view (all of it when fully aimed: the gun model
    // is then not drawn). Firing keeps you scoped: the bolt is worked without taking the eye off the eyepiece (tests/stargazer.test.js).
    // sway: the view drifts `degrees` each way in a figure eight every periodSeconds (pitchShare of it up and down), crouchMultiplier of it crouched or
    // prone. It moves the crosshair for real (shots go where you look): steady it by correcting, or get low.
    scope: {
      overlayFrom: 0.75,
      sway: { degrees: 0.22, periodSeconds: 3.4, pitchShare: 0.55, crouchMultiplier: 0.35 },
      look: { ring: '#0b1230', glass: 'rgba(40, 70, 140, 0.10)', reticle: '#ffd76a', stars: '#fff6c8' }, // the eyepiece overlay (ui/hud.js setScope)
    },
    muzzleFlash: {
      seconds: 0.05, size: 0.24, coreSize: 0.08, outerOpacity: 0.8, sizeJitter: 0.15,
      forwardOffset: 0.08, outerColor: 0xffe08a, coreColor: 0xffffff,
      adsWidth: 1.6, adsHeight: 0.5, adsTwistFraction: 0.05,
      lightColor: 0xfff0c0, handLightIntensity: 0.5, handLightRange: 1,
      worldLightIntensity: 6, worldLightRange: 8,
    },
    sounds: { fire: 'stargazerShot', dryFire: 'dryClick' }, // (the shot's last layer is the bolt being worked)
    tracerColor: 0xfff0b0,
    viewmodel: {
      model: 'stargazer', hipOffset: { x: 0.17, y: -0.15, z: -0.42 },
      aimYawDegrees: 7, hipPitchDegrees: 2, hipRollDegrees: 3,
      bodyColor: 0x1d2a6b, accentColor: 0xd8a740, metalColor: 0xc4c9d2, // planetarium navy and brass
      darkColor: 0x14161e, gripColor: 0x5a3a22, sightColor: 0xffe58a, lensColor: 0x6fb6ff, starColor: 0xfff1b0,
      // The bolt: after each shot the handle lifts, slides back and forward again, and drops (sinceFire, over boltSeconds after boltDelay).
      fire: { triggerDegrees: 22, pressSeconds: 0.03, releaseSeconds: 0.12, boltDelay: 0.3, boltSeconds: 0.55, boltTravel: 0.06, boltLiftDegrees: 70 },
      // Reload, a bolt-action strip load (models/stargazer.js). Poses: pos in metres (right, up, back), rot in degrees (muzzle up, turn left,
      // roll left). The TRIGGER hand leaves the grip (the gun rolls its bolt up toward it), lifts the bolt and pulls it back (Out) and returns
      // to the grip; the gun rolls the other way to show its left side, where the support hand brings a strip from below and presses the
      // bearings sideways into the port (In), then flicks the empty clip away; the gun rolls back, the trigger hand pushes the bolt forward
      // and drops it (Ready); everything settles home.
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.12, pos: [-0.01, 0.015, 0.02], rot: [6, -3, 12] }, // bolt side up, toward the trigger hand
          { t: 0.26, pos: [-0.008, 0.02, 0.028], rot: [5, -3, 10] }, // drawn back a touch as the bolt comes back
          { t: 0.4, pos: [-0.03, 0.01, 0.02], rot: [6, 8, -24] }, // rolls over: the left side and its port face you
          { t: 0.57, pos: [-0.034, 0.012, 0.02], rot: [9, 9, -28] }, // tips to meet the strip
          { t: 0.65, pos: [-0.026, 0.008, 0.02], rot: [7, 7, -24] }, // shoved by the push
          { t: 0.73, pos: [-0.01, 0.015, 0.022], rot: [5, -2, 8] }, // rolls back for the bolt
          { t: 0.82, pos: [-0.008, 0.012, 0.018], rot: [4, -2, 8] },
          { t: 0.95, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // The support hand (offsets from where it holds the fore-end); stripInPalm: where the strip sits in it (the hand group's coordinates).
        stripInPalm: [-0.04, -0.026, -0.275], // pinched on the palm's top edge, in sight above the hand
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.26, pos: [0, 0, 0] }, // holds the gun while the bolt is opened
          { t: 0.36, pos: [-0.07, -0.18, 0.12], rot: [-25, 0, 0] }, // down to the pouch
          { t: 0.44, pos: [-0.07, -0.18, 0.12], rot: [-25, 0, 0] }, // a strip of bearings
          { t: 0.54, pos: [-0.04, 0.05, 0.215], rot: [0, 0, 0] }, // up beside the open port
          { t: 0.58, pos: [-0.002, 0.036, 0.215] }, // the strip against the port
          { t: 0.65, pos: [0.01, 0.036, 0.215] }, // pushes the bearings in
          { t: 0.71, pos: [-0.08, 0.1, 0.19], rot: [0, 30, 20] }, // flicks the empty clip away
          { t: 0.86, pos: [0, 0, 0] },
        ],
        // The trigger hand: the palm's resting point on the grip (the pivot it turns about), and its offsets from there to the bolt knob.
        boltHandPivot: [0.004, -0.1, 0.026],
        boltHandKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.04, pos: [0, 0, 0] },
          { t: 0.13, pos: [0.088, 0.07, 0.014], rot: [0, 0, -25] }, // fingers on the knob
          { t: 0.19, pos: [0.07, 0.12, 0.01], rot: [0, 0, -45] }, // lifts it
          { t: 0.26, pos: [0.07, 0.12, 0.07], rot: [-6, 0, -45] }, // pulls it back
          { t: 0.36, pos: [0, 0, 0] }, // back on the grip
          { t: 0.66, pos: [0, 0, 0] },
          { t: 0.71, pos: [0.07, 0.12, 0.07], rot: [-6, 0, -45] }, // on the open bolt
          { t: 0.76, pos: [0.07, 0.12, 0.01], rot: [0, 0, -45] }, // pushes it forward
          { t: 0.81, pos: [0.088, 0.07, 0.014], rot: [0, 0, -25] }, // drops it
          { t: 0.9, pos: [0, 0, 0] },
        ],
        // The bolt: pos[0] = lift (0..1 of fire.boltLiftDegrees), pos[1] = back (0..1 of fire.boltTravel), riding on the trigger hand.
        boltKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.13, pos: [0, 0, 0] },
          { t: 0.19, pos: [1, 0, 0] },
          { t: 0.26, pos: [1, 1, 0] },
          { t: 0.71, pos: [1, 1, 0] },
          { t: 0.76, pos: [1, 0, 0] },
          { t: 0.81, pos: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0] },
        ],
        stripVisible: [[0.4, 0.71]], // the strip in the hand, from the pouch until it is flicked away
        stripPress: [0.58, 0.65], stripPressDepth: 0.02, // the bearings slide this far off the clip into the port, then are gone
        portFilledFrom: 0.62, // the port shows the new bearings from here until the bolt closes over them
        events: [
          { at: 0.22, sound: 'stargazerReloadOut', jolt: { back: 0.008, pitchDegrees: 1.5 } },
          { at: 0.63, sound: 'stargazerReloadIn', jolt: { up: -0.008, pitchDegrees: -2.5, rollDegrees: 1.5 } },
          { at: 0.71, jolt: { up: 0.004, rollDegrees: -2 } }, // the clip flicked away
          { at: 0.81, sound: 'stargazerReloadReady', jolt: { back: 0.012, pitchDegrees: 3 } },
        ],
      },
    },
  },
  // CLAW-ONLY (GRAB-A-GUN): the BOTTLE ROCKET BAZOOKA, from the fireworks stand. A striped cardboard launch tube that fires one oversized bottle rocket.
  // Gold capsule. ROLE: the only gun that hurts everything around a POINT. The rocket flies (weapons/ballistics.js: fast, a slight drop, it ends on the
  // first thing it touches, wall, floor or zombie, or at the end of its life) and BURSTS there (weapons/blast.js): every zombie within blast.radius and in
  // sight of it takes `damage` x the blast falloff (weapons/gunStats.js hitDamage with blastDistance). One rocket in the tube and a slow reload, so it is a
  // poor duellist (below the Price Gun on one zombie, tests/balance.test.js) and the best clump-breaker there is.
  // IT HURTS YOU TOO: inside the radius your own blast takes blast.self.share of your max health (with the falloff), never more than maxShare, so it can't
  // kill you from full health; behind a wall it can't reach you. The Hi-Vis Vest (config/wardrobe.js, stats.ownBlastDamage 0.01) cancels it.
  bottleRocket: {
    id: 'bottleRocket', name: 'Bottle Rocket Bazooka', fireMode: 'semi', clawOnly: true,
    damage: 900, headshotMultiplier: 1, // (at the blast's centre; a blast has no headshots)
    blast: {
      radius: 3.5, edgeFraction: 0.25, // m; the damage at the very edge is edgeFraction of the centre's
      // your own blast: up to 45% of your max health at its centre, never more than 75%; the view jolts down. ignoreBelow (health points): less than this
      // is no hit at all (the Hi-Vis Vest's 0.01 leaves at most 0.45: harmless, no hurt flash, no regen reset).
      self: { share: 0.45, maxShare: 0.75, joltDegrees: 3, ignoreBelow: 1 },
      look: { colors: [0xff3b3b, 0xffd23f, 0x3ad1ff, 0xff5ec8, 0xffffff], count: 46, speed: 6, size: 0.07 }, // the firework burst (effects.confetti)
      flash: { color: 0xffe08a, size: 2.2, seconds: 0.18 },
    },
    magazineSize: 1, startingReserve: 12,
    fireInterval: 1, fireBuffer: 0.15, reloadTime: 2.4, range: 60, // (fireInterval: Build-A-Blaster scales its stuffings from damage / fireInterval, so it is not shorter than a real cycle needs)
    // The rocket in the air (weapons/ballistics.js, a `zombies: 'bounce'` instance: it bursts on the first thing it touches). speed m/s, gravity m/s^2 (a slight
    // drop), lifeSeconds (it bursts in the air at the end), radius m, startOffset / startDrop: where it leaves, in front of and below the eye. trailSeconds: a puff of
    // sparks behind it this often. look: fx/rocketView.js.
    flight: {
      speed: 30, gravity: 2.5, lifeSeconds: 1.6, radius: 0.08, startOffset: 0.7, startDrop: -0.06, trailSeconds: 0.05,
      trail: { colors: [0xffd23f, 0xff8a1f, 0xfff6c8], count: 3, speed: 1.2, size: 0.03 },
      look: { body: 0xd8323a, stripe: 0xffffff, nose: 0xffd23f, stick: 0xc89a5a },
    },
    recoil: {
      pitchDegrees: 3.6, yawDegrees: 0.6, rollDegrees: 1.2, adsMultiplier: 0.6,
      model: { back: 0.08, up: 0.02, pitchDegrees: 10, yawDegrees: 1.5, rollDegrees: 3,
        adsMultiplier: 0.5, frequency: 4.5, damping: 0.5 },
    },
    impact: { flinch: 2, knockback: 4, hitstopSeconds: 0.03, deathImpulse: 2.6 },
    spread: {
      base: 1.6, moving: 2.5, maxMovingFactor: 1.5, airborne: 4,
      perShot: 1, maxBloom: 2, bloomRecoveryDelay: 0.3, bloomRecovery: 4,
      smoothing: 10, adsMultiplier: 0.1,
    },
    ads: { seconds: 0.3, fovMultiplier: 0.82, moveSpeedMultiplier: 0.75, offset: { x: 0, y: -0.11, z: -0.36 } },
    muzzleFlash: {
      seconds: 0.08, size: 0.32, coreSize: 0.12, outerOpacity: 0.85, sizeJitter: 0.2,
      forwardOffset: 0.08, outerColor: 0xffb02e, coreColor: 0xfff6c8,
      adsWidth: 1.6, adsHeight: 0.6, adsTwistFraction: 0.05,
      lightColor: 0xffc06a, handLightIntensity: 0.7, handLightRange: 1.2,
      worldLightIntensity: 8, worldLightRange: 8,
    },
    sounds: { fire: 'bottleRocketLaunch', dryFire: 'dryClick', burst: 'bottleRocketBurst' },
    tracerColor: 0xffd23f,
    viewmodel: {
      model: 'bottleRocket', hipOffset: { x: 0.16, y: -0.16, z: -0.4 },
      aimYawDegrees: 6, hipPitchDegrees: 1.5, hipRollDegrees: 2.5,
      bodyColor: 0xd8323a, accentColor: 0xf4f1e8, metalColor: 0xc4c9d2, // fireworks-stand red and white
      darkColor: 0x1e1a24, gripColor: 0x2c2a33, sightColor: 0xffd23f, rocketColor: 0x2f6bff, noseColor: 0xffd23f, wickColor: 0xc89a5a,
      fire: { triggerDegrees: 24, pressSeconds: 0.03, releaseSeconds: 0.14, fuseFlicker: 0.25 }, // fuseFlicker: how much the lit fuse tip pulses (share of its size)
      // Reload, through the breech at the back (models/bottleRocket.js). Poses: pos in metres (right, up, back), rot in degrees (muzzle up, turn
      // left, roll left). The tube swings its back end round in front of you; the support hand flips the breech cap open (Out), pulls the
      // burnt-out casing and tosses it, brings a fresh rocket from below and slides it in nose first (In: its nose shows in the mouth), swings
      // the cap shut (Ready) and pats the tube.
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.12, pos: [-0.06, 0.05, -0.24], rot: [-6, -65, -4] }, // turned side-on: the back end in front of you
          { t: 0.36, pos: [-0.06, 0.054, -0.23], rot: [-5, -64, -3] }, // tugged as the casing comes out
          { t: 0.52, pos: [-0.055, 0.044, -0.23], rot: [-4, -60, -3] }, // waits while a rocket is fetched
          { t: 0.66, pos: [-0.06, 0.05, -0.24], rot: [-6, -65, -4] },
          { t: 0.73, pos: [-0.052, 0.046, -0.25], rot: [-7, -66, -4] }, // shoved as the rocket goes in
          { t: 0.84, pos: [-0.05, 0.046, -0.22], rot: [-5, -58, -4] },
          { t: 0.885, pos: [-0.05, 0.03, -0.22], rot: [-7, -58, -4] }, // patted
          { t: 0.95, pos: [-0.02, -0.04, -0.1], rot: [4, -22, -2] }, // swings home low, under your view
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // The support hand (offsets from where it holds the fore grip); rocketInHand: where the rocket (or the spent casing) sits in it (the hand
        // group's coordinates).
        rocketInHand: [-0.018, -0.052, -0.265],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.11, pos: [0.108, 0.102, 0.565] }, // on the cap's pull tab
          { t: 0.18, pos: [0.018, 0.132, 0.645] }, // flips it open
          { t: 0.28, pos: [0.018, 0.052, 0.485] }, // grabs the burnt-out casing
          { t: 0.36, pos: [0.018, 0.052, 0.665] }, // pulls it out
          { t: 0.43, pos: [-0.15, -0.05, 0.55], rot: [0, 0, 60] }, // tosses it
          { t: 0.5, pos: [-0.08, -0.2, 0.3], rot: [-20, 0, 0] }, // down to the box of rockets
          { t: 0.56, pos: [-0.08, -0.2, 0.3], rot: [-20, 0, 0] },
          { t: 0.65, pos: [0.018, 0.052, 0.665] }, // the rocket behind the breech, nose in
          { t: 0.72, pos: [0.018, 0.052, 0.515] }, // slides it in
          { t: 0.78, pos: [-0.072, 0.102, 0.685] }, // to the open cap's tab
          { t: 0.83, pos: [0.108, 0.102, 0.565] }, // swings it shut
          { t: 0.86, pos: [0.028, 0.13, 0.3] }, // over the tube
          { t: 0.885, pos: [0.028, 0.112, 0.3] }, // pats it
          { t: 0.95, pos: [0.0, -0.02, 0.1] }, // and back to the fore grip
          { t: 1, pos: [0, 0, 0] },
        ],
        capOpenDegrees: 110,
        capKeys: [ // pos[0]: 0 shut .. 1 open
          { t: 0, pos: [0, 0, 0] }, { t: 0.11, pos: [0, 0, 0] }, { t: 0.18, pos: [1, 0, 0] },
          { t: 0.78, pos: [1, 0, 0] }, { t: 0.83, pos: [0, 0, 0] }, { t: 1, pos: [0, 0, 0] },
        ],
        spentPulledAt: 0.28, // the burnt-out casing leaves the breech (into the hand) here
        spentVisible: [[0.28, 0.42]], // the casing in the hand, until it is tossed
        rocketVisible: [[0.53, 0.72]], // the fresh rocket in the hand, from the box until it is in
        rocketInAt: 0.72, // a reload starts with the tube empty (one rocket, fired); the new rocket's nose shows in the mouth from here
        events: [
          { at: 0.18, sound: 'bottleRocketReloadOut', jolt: { back: 0.006, rollDegrees: -1.5 } }, // the cap pops open
          { at: 0.36, jolt: { back: 0.008, pitchDegrees: 1.5 } }, // the casing comes out
          { at: 0.72, sound: 'bottleRocketReloadIn', jolt: { back: -0.012, pitchDegrees: -2 } },
          { at: 0.83, sound: 'bottleRocketReloadReady', jolt: { back: 0.008, rollDegrees: 2 } }, // the cap shut
          { at: 0.885, jolt: { up: -0.01, pitchDegrees: -2.5 } }, // the pat
        ],
      },
    },
  },
  // CLAW-ONLY (GRAB-A-GUN): the BALLOON LAUNCHER, from the party store. A helium-tank blaster that inflates a balloon on its nozzle and lets it go.
  // Purple capsule. ROLE: the gun that hits what you DON'T aim at. A balloon drifts out slowly and HOMES (weapons/ballistics.js `homing`): it turns
  // toward the nearest zombie ahead of it and in sight, and pops on what it touches with a small confetti blast (weapons/blast.js, no harm to you).
  // So you can keep firing while you back away from a crowd, or at its edge, without lining anything up (it finds what is within 55 degrees of where
  // it is flying, never behind). Weak on one zombie you are aiming at (below the Price Gun:
  // tests/balance.test.js), slow enough that a balloon fired at a sprinting Mall Walker takes a moment to catch up.
  // It uses the same flying-and-bursting path as the Bottle Rocket Bazooka (playerGun.js fires anything with `blast` + `flight` on g.rockets).
  balloonLauncher: {
    id: 'balloonLauncher', name: 'Balloon Launcher', fireMode: 'semi', clawOnly: true,
    damage: 200, headshotMultiplier: 1, // (at the pop's centre; a pop has no headshots)
    blast: {
      radius: 1.3, edgeFraction: 0.5, // a small pop: the zombie it touched, and maybe one beside it
      // (no `self`: a balloon pop never hurts you)
      look: { colors: [0xff5ec8, 0x3ad1ff, 0xffd23f, 0x8a5cff, 0x5ce07a], count: 18, speed: 3.2, size: 0.05 }, // the pop: confetti and balloon scraps
      flash: { color: 0xffd6f0, size: 0.8, seconds: 0.1 },
    },
    magazineSize: 8, startingReserve: 64,
    fireInterval: 0.3, fireBuffer: 0.12, reloadTime: 2.6, range: 40,
    // The balloon in the air (on g.rockets, like a rocket: it pops on the first thing it touches, or at the end of its life). Slow, and it rises a
    // little (gravity below 0: helium). homing: it steers for the nearest zombie within `range`, inside coneDegrees of its flight and in sight, turning
    // at most turnDegreesPerSecond (weapons/ballistics.js). look: fx/rocketView.js (model 'balloon', one of `colors` each, with a string).
    flight: {
      speed: 9, gravity: -0.4, lifeSeconds: 3.5, radius: 0.15, startOffset: 0.6, startDrop: -0.05, trailSeconds: 0,
      homing: { range: 16, coneDegrees: 55, turnDegreesPerSecond: 140, retargetSeconds: 0.25 },
      look: { model: 'balloon', colors: [0xff5ec8, 0x3ad1ff, 0xffd23f, 0x8a5cff, 0x5ce07a], string: 0xf4f1e8 },
    },
    recoil: {
      pitchDegrees: 0.8, yawDegrees: 0.2, rollDegrees: 0.4, adsMultiplier: 0.6,
      model: { back: 0.025, up: 0.006, pitchDegrees: 3, yawDegrees: 0.6, rollDegrees: 1.2,
        adsMultiplier: 0.5, frequency: 6, damping: 0.55 },
    },
    impact: { flinch: 0.9, knockback: 1.2, hitstopSeconds: 0, deathImpulse: 1.2 },
    spread: {
      base: 1.2, moving: 2, maxMovingFactor: 1.5, airborne: 3,
      perShot: 0.6, maxBloom: 2, bloomRecoveryDelay: 0.2, bloomRecovery: 5,
      smoothing: 10, adsMultiplier: 0.3,
    },
    ads: { seconds: 0.22, fovMultiplier: 0.88, offset: { x: 0, y: -0.1, z: -0.38 } },
    muzzleFlash: {
      seconds: 0.04, size: 0.14, coreSize: 0.05, outerOpacity: 0.6, sizeJitter: 0.2,
      forwardOffset: 0.05, outerColor: 0xffd6f0, coreColor: 0xffffff,
      adsWidth: 1.4, adsHeight: 0.5, adsTwistFraction: 0.05,
      lightColor: 0xffe6f4, handLightIntensity: 0.15, handLightRange: 0.6,
      worldLightIntensity: 1, worldLightRange: 3,
    },
    sounds: { fire: 'balloonLaunch', dryFire: 'dryClick', burst: 'balloonPop' },
    tracerColor: 0xff5ec8,
    viewmodel: {
      model: 'balloonLauncher', hipOffset: { x: 0.17, y: -0.15, z: -0.42 },
      aimYawDegrees: 6, hipPitchDegrees: 1.5, hipRollDegrees: 3,
      bodyColor: 0x2fc4c0, accentColor: 0xff5ec8, metalColor: 0xd6dbe2, // party-store teal and pink
      darkColor: 0x1e2430, gripColor: 0x2a2f3a, sightColor: 0xffd23f, tankColor: 0xe9edf2, balloonColor: 0xff5ec8, ribbonColor: 0xffd23f,
      // The balloon on the nozzle: it inflates over `inflateSeconds` after each shot, and shows only while loaded. The gauge's needle (degrees
      // from straight up): at needleRestDegrees when loaded, dipping needleDipDegrees with each shot and climbing back as the balloon fills,
      // at -needleEmptyDegrees when empty.
      fire: { triggerDegrees: 22, pressSeconds: 0.025, releaseSeconds: 0.1, inflateSeconds: 0.25, needleRestDegrees: 35, needleDipDegrees: 25, needleEmptyDegrees: 70 },
      // Reload (models/balloonLauncher.js). Poses: pos in metres (right, up, back), rot in degrees (muzzle up, turn left, roll left). The
      // balloon lets go; the gun swings its tail toward the support hand, which unscrews the spent cartridge from the tank's back (Out),
      // tosses it, fetches a new one from below, pushes it in and screws it home (In, the needle climbs), then taps the gauge (Ready) and
      // the balloon blows back up as the gun settles.
      reload: {
        gunKeys: [
          { t: 0, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 0.12, pos: [-0.02, 0.02, 0.01], rot: [10, -12, 10] }, // tail toward the support hand
          { t: 0.26, pos: [-0.02, 0.024, 0.018], rot: [9, -12, 11] }, // tugged as the cartridge comes out
          { t: 0.42, pos: [-0.014, 0.012, 0.01], rot: [6, -8, 7] }, // waits while a new one is fetched
          { t: 0.6, pos: [-0.02, 0.02, 0.0], rot: [10, -12, 10] },
          { t: 0.64, pos: [-0.02, 0.016, -0.008], rot: [11, -12, 10] }, // shoved as it goes in
          { t: 0.74, pos: [-0.012, 0.016, 0.0], rot: [6, -6, 20] }, // rolls the gauge toward you
          { t: 0.8, pos: [-0.012, 0.008, 0.0], rot: [4, -6, 22] }, // tapped
          { t: 0.95, pos: [0, 0, 0], rot: [0, 0, 0] },
          { t: 1, pos: [0, 0, 0], rot: [0, 0, 0] },
        ],
        // The support hand (offsets from where it holds the body); cartridgeInHand: where the cartridge sits in it (the hand group's coordinates).
        cartridgeInHand: [-0.04, -0.03, -0.19],
        handKeys: [
          { t: 0, pos: [0, 0, 0] },
          { t: 0.12, pos: [0.04, 0.092, 0.26] }, // on the cartridge
          { t: 0.16, pos: [0.04, 0.092, 0.262], rot: [0, 0, -18] }, // unscrews it, a turn at a time
          { t: 0.2, pos: [0.04, 0.092, 0.266], rot: [0, 0, 10] },
          { t: 0.24, pos: [0.04, 0.092, 0.27], rot: [0, 0, -10] },
          { t: 0.3, pos: [0.03, 0.1, 0.31] }, // pulls it out
          { t: 0.36, pos: [-0.1, 0.0, 0.25], rot: [0, 40, 30] }, // tosses it
          { t: 0.44, pos: [-0.06, -0.17, 0.12], rot: [-20, 0, 0] }, // down to the box of cartridges
          { t: 0.48, pos: [-0.06, -0.17, 0.12], rot: [-20, 0, 0] },
          { t: 0.57, pos: [0.04, 0.1, 0.31] }, // up behind the tank
          { t: 0.62, pos: [0.04, 0.092, 0.26] }, // pushes it in
          { t: 0.65, pos: [0.04, 0.092, 0.258], rot: [0, 0, -15] }, // screws it home
          { t: 0.68, pos: [0.04, 0.092, 0.257], rot: [0, 0, 10] },
          { t: 0.71, pos: [0.04, 0.092, 0.256], rot: [0, 0, -8] },
          { t: 0.76, pos: [0.05, 0.18, 0.2] }, // over the gauge
          { t: 0.79, pos: [0.055, 0.164, 0.2] }, // taps it
          { t: 0.9, pos: [0, 0, 0] },
        ],
        // The cartridges: the seated one is out over cartridgeOut; the one in the hand shows over cartridgeVisible (the old one, tossed; then
        // the new one). twistKeys rot[2]: their spin about their own axis (degrees), unscrewing and screwing in.
        cartridgeOut: [0.24, 0.62],
        cartridgeVisible: [[0.24, 0.34], [0.44, 0.62]],
        twistKeys: [
          { t: 0, rot: [0, 0, 0] }, { t: 0.12, rot: [0, 0, 0] }, { t: 0.24, rot: [0, 0, -360] },
          { t: 0.36, rot: [0, 0, -360] }, { t: 0.4, rot: [0, 0, 0] }, // (reset while nothing is in sight)
          { t: 0.62, rot: [0, 0, 0] }, { t: 0.72, rot: [0, 0, 360] }, { t: 1, rot: [0, 0, 360] },
        ],
        // The gauge's needle (rot[2], degrees from straight up; the ends match fire.needleRestDegrees): drops as the cartridge comes out,
        // climbs with the hiss as the new one goes in, jumps past full when tapped and settles.
        needleKeys: [
          { t: 0, rot: [0, 0, 35] }, { t: 0.22, rot: [0, 0, 35] }, { t: 0.3, rot: [0, 0, -70] }, { t: 0.62, rot: [0, 0, -70] },
          { t: 0.72, rot: [0, 0, -5] }, { t: 0.77, rot: [0, 0, -5] }, { t: 0.81, rot: [0, 0, 55] }, { t: 0.9, rot: [0, 0, 35] },
          { t: 1, rot: [0, 0, 35] },
        ],
        deflateBy: 0.1, // the balloon on the nozzle lets go over the start of the reload...
        inflateFrom: 0.82, // ...and blows back up from here to the end
        events: [
          { at: 0.24, sound: 'balloonReloadOut', jolt: { back: 0.006, pitchDegrees: 1.5 } },
          { at: 0.36, jolt: { up: 0.003, rollDegrees: -1.5 } }, // the spent cartridge tossed
          { at: 0.64, sound: 'balloonReloadIn', jolt: { back: -0.006, pitchDegrees: -2 } },
          { at: 0.79, sound: 'balloonReloadReady', jolt: { up: -0.005, rollDegrees: 2, pitchDegrees: 1.5 } },
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
  // The Customer Service box cutter tiers (config/upgrades.js melee; game/meleeUpgrades.js) write these. Separate from the multiplier above so
  // power-ups and the wardrobe still stack on top.
  meleeTier: 0, // 0 = plain box cutter, then one per tier bought
  meleeUpgradeDamage: 1, // box cutter damage is multiplied by this too
  meleeHalfAngleDegrees: melee.boxCutter.hitHalfAngleDegrees, // how far off-centre a target can be hit
  meleeMaxTargets: 1, // zombies one swing can hit
  reloadSpeed: 1, // reload time is divided by this (2 = twice as fast)
};
