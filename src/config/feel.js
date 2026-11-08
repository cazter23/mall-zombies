// =============================================================================
// FEEL CONFIG
// Every number that affects how the game *feels* lives here.
// Tweak freely while playtesting; no other file should hardcode these values.
// =============================================================================

export const feel = {
  simulation: {
    tickRate: 60, // fixed game-logic updates per second (same on 60Hz and 144Hz screens)
    maxFrameTime: 0.25, // seconds; caps huge frame gaps (e.g. after switching tabs)
  },

  player: {
    height: 1.8, // meters, feet to top of head (used for collision)
    eyeHeight: 1.6, // camera height above the feet
    radius: 0.35, // collision radius
    maxHealth: 100, // a Shopper hits for 40, so 3 hits from full
  },

  // Health regen and the red "you're hurt" screen edges
  health: {
    regenDelay: 2.5, // seconds without being hit before health starts coming back
    regenRate: 50, // health per second while regenerating (empty -> full in ~2.0s)
    hitFlashSeconds: 0.4, // red flash on the screen edges when hit
    hitFlashOpacity: 0.65,
    hitJoltDegrees: 2.5, // the view jolts down this much when hit
    hurtMaxOpacity: 0.45, // how red the edges get from ordinary damage (above the low-health line)
    lowHealthFraction: 0.4, // below this: "one more hit and you're down" mode
    lowHealthOpacity: 0.95, // in that mode the edges glow this strongly at the peak of each pulse...
    pulseAmount: 0.55, // ...and dim by this fraction at the low point, so it clearly throbs
    pulseSpeed: 7, // radians per second (about a heartbeat)
  },

  movement: {
    walkSpeed: 5, // m/s (forwards)
    sprintSpeed: 8, // m/s
    backpedalMultiplier: 0.78, // walking backwards is slower (COD-style): retreating while shooting costs you
    strafeMultiplier: 0.85, // so is walking sideways; diagonals blend between
    groundAcceleration: 60, // m/s^2: how quickly you reach full speed on the ground
    airAcceleration: 15, // m/s^2: less control while airborne
    jumpVelocity: 6.5, // m/s upward; with gravity 20 the jump peaks at ~1.05m (clears benches)
    gravity: 20, // m/s^2 (a bit stronger than real life so jumps feel snappy)
    maxFallSpeed: 30, // m/s
    coyoteTime: 0.1, // seconds after walking off a ledge where you can still jump
    jumpBufferTime: 0.1, // seconds a jump press is remembered before you land
    stepTolerance: 0.05, // bumps shorter than this never block you
    fallOutHeight: -20, // safety net: falling below this height (meters) puts you back at the spawn
  },

  // Landing from a height hurts. The drop is measured from the highest point of one unbroken fall (a jump's peak counts)
  // to where you land, so stairs, benches, counters and a jump off a 2 m platform are free. A vault over a balcony rail
  // counts from the floor you stood on, not from the climb. Health regenerates, so even the big drops are survivable.
  fall: {
    safeDrop: 3, // meters you can fall for free
    damagePerMeter: 12, // per meter beyond that: the 6.3 m drop off an upper floor costs ~40, a Shopper's hit
    viewJoltDegrees: 5, // the view slams down on a damaging landing
  },

  sprint: {
    duration: 4, // seconds of sprint in a full meter
    refillDelay: 1, // seconds after you stop sprinting before the meter refills
    refillRate: 1.25, // seconds of sprint regained per second (empty -> full in ~3.2s)
    minToStart: 0.5, // after fully draining, the meter must refill this much before you can sprint again
    requiresForward: true, // like COD: you can only sprint while holding forward...
    minForwardInput: 0.5, // ...at least this much (matters for a controller stick; keys are 1)
    // Shooting while sprinting drops you to a walk: the gun comes up out of the running pose first
    // (sprint-out), then the shot goes off. Sprint resumes shortly after you stop shooting.
    sprintOutSeconds: 0.08, // delay before the first shot when you fire from a full sprint
    fireBlocksSprintSeconds: 0.3, // no sprinting until this long after the last trigger pull / shot
  },

  crouch: {
    height: 1.1, // collision height while crouched or sliding (standing is player.height)
    eyeHeight: 0.95, // camera height above the feet while crouched
    speed: 2.5, // m/s walking while crouched
    eyeTransitionSpeed: 6, // m/s the camera moves up/down when changing stance
    headroomMargin: 0.01, // shrinks the standing-up check so a wall beside you never blocks it
  },

  prone: {
    height: 0.55, // low collision cylinder; same radius as the other stances
    eyeHeight: 0.38,
    speed: 1.25, // m/s crawling, before ADS/direction penalties
    eyeTransitionSpeed: 3.5,
  },

  slide: {
    startSpeed: 10.5, // m/s at the start of a slide (sprint is 8)
    endSpeed: 3, // m/s at the end; stays fast early, then drops off
    duration: 0.9, // seconds; the slide ends on its own
    cooldown: 1, // seconds after a slide ends before you can slide again
    eyeHeight: 0.7, // camera height above the feet while sliding (lower than a crouch)
    // Landing slides (jump while sprinting or sliding, press C, slide on landing). Timing windows:
    chainPressBefore: 0.15, // seconds: C pressed this long before jumping out of a slide still counts
    chainPressAfterLanding: 0.2, // seconds: C pressed this long after landing still counts
    // Each CHAINED slide in a row (landing slides, incl. after a vault) starts slower than the last,
    // so one or two chains are great but you can't chain-slide forever (a normal sprint slide is 100%).
    // 10.5 -> 9.2 -> 8.0 -> 6.8 -> 5.8 -> 5.0 (walking speed) -> 4.5 m/s floor: past ~5 chains it's slower than walking.
    chainSpeed: [0.88, 0.76, 0.65, 0.55, 0.48, 0.43], // start-speed multiplier per chained slide (last one repeats)
    chainResetSeconds: 1.0, // on your feet (not sliding, not in the air) this long = back to full speed
  },

  // Jump near a marked low obstacle while moving into it. Carry entry speed out of the vault.
  vault: {
    minHeight: 0.25,
    maxHeight: 1.1,
    maxDepth: 1.4, // crossed along the approach direction; long sides of benches aren't vaults
    reach: 1.7, // jump this close to the obstacle (gap from your body to it) and you vault it
    minSpeed: 1.5, // m/s; a slow walk is enough
    maxApproachDegrees: 75, // how far off straight-on your path can cross it (steeper runs along a long side)
    maxLookDegrees: 100, // where you look barely matters: only don't be looking backwards
    magnetRange: 3.0, // a vaultable obstacle this close on your path: a jump press waits to vault it...
    magnetSeconds: 0.4, // ...for up to this long (then it's a normal jump)
    airGraceSeconds: 0.2, // a jump that started this recently can still turn into a vault
    directionSearchDegrees: [0, 12, -12, 24, -24], // blocked landing? try these slightly angled paths too
    clearance: 0.08, // feet clear the top (and the counter's decorative lip)
    landingDistance: 0.45, // clear the far edge, then drop to the floor over this much ground (at full speed)
    // Speed is constant through a vault. The rise takes at least this long (only matters if you start it
    // right against the obstacle: then you briefly cover less ground).
    minLiftSeconds: 1 / 60, // one tick
    maxSeconds: 1.2,
    momentumRetention: 1, // never adds speed
    sweepStep: 0.04, // check the entire cylinder along the path, including overhead
    landingHeightTolerance: 0.05,
    displacementTolerance: 0.03, // a crowd shove interrupts the planned path
    gunDrop: 0.12,
    gunTiltDegrees: 18,
    // The view during a vault (visual only: the gun is tucked away, so aim doesn't matter):
    // it dips to look over the obstacle and tilts toward the side your legs swing out to.
    cameraDipDegrees: 16,
    cameraRollDegrees: 7,
    // Balcony rails (glass barriers on an upper floor, props.railing): jump at one and you climb over and drop to the floor below.
    // Only offered when there is open floor to land on, so you can't climb into a fountain, a kiosk or the escalator well.
    ledge: {
      maxHeight: 1.6, // the rails are 1.5 m (taller than a jump peaks), so this is what stops you climbing anything taller
      dropSpeed: 2, // m/s outward when you let go: nearly straight down, not a leap
      airSpeedCap: 2.5, // m/s: sideways speed is capped for the whole drop, so a sprint can't carry you far (and the vault works the same walking or sprinting)
      railMargin: 0.2, // another rail this close to where you let go (or the way out) could catch your feet: the vault refuses, or stops looking further
      sideCheck: 0.6, // the way out is checked this far to each side too (you steer toward where you look)
      checkSpacing: 0.75, // meters between the spots checked along the way out
      landingMaxY: 1.1, // the highest thing under where you'd land: a bench or a counter is fine; a fountain, kiosk or escalator is not
    },
  },

  look: {
    mouseSensitivity: 0.0022, // radians per pixel of mouse movement
    maxPitchDegrees: 89, // how far you can look up/down
    invertY: false,
    // Weapon recoil and hit jolts move the view, then spring back (core/spring.js). The amounts
    // per shot are in config/weapons.js -> recoil.
    recoilFrequency: 4.5, // Hz: how fast the view settles back (higher = faster)
    recoilDamping: 1, // 1 = settles without dipping past where you were aiming (keeps aim honest)
    recoilRollFrequency: 3.5, // the visual-only roll settles at this rate...
    recoilRollDamping: 0.55, // ...with a tiny wobble
  },

  ads: {
    // (the aim button itself is in config/controls.js -> bindings.aim)
    moveSpeedMultiplier: 0.75, // walking speed while fully aimed (goes into the stats object)
    sensitivityFollowsZoom: true, // mouse turns slower when zoomed in, so aim feels the same
  },

  // Making sprinting obvious: head bob, the gun's running pose, and cartoon speed lines.
  sprintFx: {
    blendSpeed: 8, // how fast the effects fade in/out when you start/stop sprinting (per second)
    fireBlendOutSpeed: 25, // ...and how fast the running pose drops when you shoot out of a sprint
    bobStride: 5.2, // meters per full bob cycle (two footsteps): ~3 steps/s at sprint speed
    walkBobHeight: 0.006, // a barely-there bob when walking...
    sprintBobHeight: 0.022, // restrained vertical movement when sprinting
    sprintBobRollDegrees: 0.35, // slight side-to-side tilt with each step while sprinting
    gunDrop: 0.06, // the gun lowers this much (meters) in the running pose...
    gunRight: 0.035, // ...shifts right...
    gunBack: 0.03, // ...and pulls back toward you
    gunPitchDegrees: 17, // muzzle tips down
    gunYawDegrees: 18, // and turns inward across the body
    gunRollDegrees: 10,
    gunBobSide: 0.008, // the gun sways left-right once per two steps...
    gunBobUp: 0.005, // ...and dips slightly on each step
    speedLinesOpacity: 0.16, // faint streaks at the very edges of the screen at full sprint
  },

  // Dying: the view tips over onto the floor, then the results screen appears.
  death: {
    cameraSeconds: 1.2, // how long the fall-over takes
    cameraHeight: 0.35, // camera height above the feet when lying on the floor
    rollRadians: 1.25, // how far the view rolls onto its side
    endPitch: 0.2, // looking slightly up from the floor at the end
    resultsDelay: 1.6, // seconds after death before the results screen shows
  },

  // Switching weapons (two slots, COD-style): the gun in hand drops out of view, the other comes up.
  // No shooting or aiming until it's up. Switching cancels a reload.
  weaponSwitch: {
    lowerSeconds: 0.18, // old gun drops away...
    raiseSeconds: 0.32, // ...new one comes up (ready to fire at the end)
    dropMeters: 0.22, // how far it drops out of view
    tiltDegrees: 35, // muzzle tips down as it drops
  },

  // Buying things (doors, wall buys): hold the interact button (config/controls.js -> bindings.interact).
  interact: {
    holdSeconds: 0.25, // hold this long to buy
    range: 2.5, // meters from the thing's interaction point
    maxAngleDegrees: 60, // must be roughly facing it...
    facingFreeDistance: 1.0, // ...unless this close
    deniedSeconds: 0.6, // how long the prompt stays red after trying to buy without enough points
  },

  melee: {
    // (the melee button is in config/controls.js -> bindings.melee)
    lungeEndSpeedKeep: 0.3, // fraction of lunge speed kept when it ends (so you don't skate past)
    entryMomentumKeep: 0.85, // moving into melee carries some speed out of the lunge
  },

  camera: {
    fov: 75,
    near: 0.05,
    far: 200,
  },

  // The PA announcement when a run's first round begins (game/runIntro.js): one of these, at random.
  runIntro: {
    kicker: 'Attention shoppers',
    lines: [
        'Attention shoppers. Attention shoppers. Please disregard the previous announcement. Shopping will continue as normal.',
      'The mall is now closed. Please remain calm and proceed to the nearest exit. There are no exits.',
      'Due to unforeseen circumstances, today\'s sale has been extended. Indefinitely.',
      'Would the owners of several hundred zombies please collect them from the food court.',
      'Thank you for shopping with us. You will never leave.',
      'A reminder that store employees are not allowed to clock out. Ever.',
    ],
  },

  // The main menu's flyover through the mall (ui/titleCamera.js; the shots are map data: map.titleShots).
  titleScreen: {
    shotSeconds: 9, // each camera glide
    fadeSeconds: 0.8, // fade through black at each cut
    fov: 58, // a calmer, more cinematic lens than the gameplay camera
  },

  world: {
    shutterOpenSeconds: 1.2, // how long a security shutter takes to roll up
    // Wall buy: chalk outline on the wall + the gun hanging on pegs (world/wallBuy.js)
    wallBuyDisplay: { width: 1.1, height: 0.55, gunScale: 1.8, standOff: 0.07 },
  },

  // First-person weapon model (drawn on top of the world so it never clips into walls)
  viewmodel: {
    // (Per-gun placement, recoil and reload animation are in config/weapons.js -> viewmodel / recoil.)
    fov: 75, // the gun is drawn with its own fixed FOV so ADS zoom doesn't enlarge it
    reloadBlendOutSeconds: 0.15, // a cancelled reload (box cutter) eases back instead of snapping
    dryFireKick: 0.12, // squeezing an empty gun: this fraction of a real shot's muzzle flip
    // Sway: the gun lags behind when you turn and catches up when you stop.
    sway: {
      degreesPerTurnSpeed: 0.9, // degrees of lag per radian/second of turning...
      metersPerTurnSpeed: 0.0035, // ...and this much sideways/vertical shift
      rollDegreesPerTurnSpeed: 0.7, // rolls a little into the turn
      maxDegrees: 3.5,
      maxMeters: 0.012,
      maxTurnSpeed: 8, // radians/second; faster flicks don't sway any further
      smoothing: 12, // how quickly it follows changes in turn speed (per second)
      adsMultiplier: 0.12, // barely any while aiming, so the sight stays on the crosshair
    },
    // Walking: a gentle side-to-side "smile" with each step (sprinting has its own pose in sprintFx).
    walkBob: {
      side: 0.007, // meters left/right per step cycle
      up: 0.004, // meters it rises at the ends of the swing
      rollDegrees: 0.8,
      blendSpeed: 8, // how fast it fades in/out when you start/stop walking
      adsMultiplier: 0.15,
    },
    // Standing still: a slow breath.
    breathing: {
      speed: 1.7, // radians/second (~one breath every 3.7s)
      up: 0.0015, // meters
      pitchDegrees: 0.25,
      adsMultiplier: 0.2,
    },
    // Landing from a jump or fall: the gun dips and springs back.
    landing: {
      minFallSpeed: 2, // m/s; softer landings (small steps) don't dip
      dipPerSpeed: 0.004, // meters of dip per m/s of fall speed
      maxDip: 0.03,
      pitchPerSpeed: 0.7, // degrees the muzzle drops per m/s of fall speed
      maxPitchDegrees: 5,
      frequency: 4, // Hz
      damping: 0.5,
      adsMultiplier: 0.35,
    },
    // Box cutter slash (left hand: backhand from upper left to lower right). Camera-space meters.
    melee: {
      enterFrom: { x: -0.3, y: -0.4, z: -0.34 }, // hand comes up from the bottom left...
      slashFrom: { x: -0.17, y: 0.05, z: -0.45 }, // ...to the top left...
      slashTo: { x: 0.2, y: -0.15, z: -0.43 }, // ...slashes across to the bottom right...
      exitTo: { x: 0.26, y: -0.5, z: -0.34 }, // ...and drops out of view.
      slashStart: 0.22, // fraction of the swing when the slash begins
      slashEnd: 0.42, // fraction when it ends (the hit lands in between)
      gunDrop: 0.14, // meters the staple gun drops out of the way
      gunTiltDegrees: 25,
    },
  },

  // The player's own body: arms on the gun, legs/torso visible when looking down.
  // Look: last mall employee standing. Red polo, khakis, white sneakers.
  body: {
    colors: {
      skin: 0xe0ac7e,
      skinShade: 0xc99366, // knuckle / inner-palm warm shadow tone
      shirt: 0xc8102e, // red polo
      shirtTrim: 0x990b22, // ribbed cuff / hem trim
      shirtStripe: 0xf4e8d1, // cream uniform cuff tipping stripe
      uniformGold: 0xe9ae50,
      pants: 0xc3a57a, // khaki
      pantsShade: 0xa88b60, // khaki cuff / seam shade
      shoes: 0xf2f2f2, // white sneakers
      shoeAccent: 0x842344, // burgundy sneaker panels
      soles: 0xf0dfbc,
      belt: 0x4a3426, // brown belt
      buckle: 0xd4af37, // brass employee belt buckle
    },
    // Hip height for each stance. In between, it follows the camera height smoothly.
    hipHeight: { stand: 0.92, crouch: 0.5, slide: 0.3, prone: 0.16 },
    proneLegBack: 0.8, // legs trail behind the low camera, clear of the gun/forward view
    proneAnkleHeight: 0.1, // shoe soles clear the floor in the prone pose
    hipWidth: 0.1, // each leg's distance from the center line
    thighLength: 0.46,
    shinLength: 0.44,
    ankleHeight: 0.08,
    torsoHeight: 0.12, // lower polo section, below the ribcage
    crouchTorsoLean: .65, // radians; keeps the complete upper body under low cover
    waistWidth: 0.3, // slim, flat waist: a wide deep box reads as a big gut from above
    waistDepth: 0.15,
    backOffset: 0.36, // torso and hips sit this far behind the camera, so looking down you see past the belly
    feetForward: 0.16, // feet rest this far in front of the hips
    strideLength: 1.4, // meters traveled per full walk cycle (both steps)
    stepSwing: 0.28, // how far each foot swings forward/back at walking speed
    stepLift: 0.12, // how high feet lift while walking
    run: { strideLength: 3.6, plantFraction: .20, landingReach: .12, pushBack: .60, lift: .24,
      lean: .17, twist: .09, hipRise: .027, toeOff: .34 },
    slideFrontFoot: 0.75, // how far the leading foot reaches forward in a slide
    slideBackFoot: 0.62, // the other foot: less far forward, splayed out to the side
    slideSplay: 0.25, // how far the second foot splays sideways
    airTuck: 0.25, // how far feet pull up while airborne
    // Vault (speed vault): both legs swing up together and out to one side over the obstacle.
    vaultSide: -1, // -1 = legs go out to the left (hand on the obstacle on the right), 1 = right
    vaultFootOut: 0.45, // meters out to the side at the top of the swing
    vaultFootForward: 0.85, // meters in front of you
    vaultFootRaise: 0.22, // meters above the hips (legs out nearly level)
    vaultFeetGap: 0.15, // the two feet, one a little ahead of the other
    blendSpeed: 10, // how fast the legs switch between walk/slide/air poses (per second)
  },

  // Hit effects (cartoon splatter, tracers, hit markers)
  effects: {
    tracerPool: 16, // enough for two eight-pellet blasts before a rendered frame
    maxPelletWallPuffs: 4, // limit decoration per shotgun shot
    tracerSeconds: 0.07, // how long the staple streak stays visible
    tracerWidth: 0.012, // meters
    maxParticles: 600,
    particleGravity: 9, // m/s^2
    particleLife: 0.55, // seconds
    particleSize: 0.06, // meters
    splatCount: 14, // particles per body hit
    headshotSplatCount: 26, // particles per headshot
    splatSpeed: 3.5, // m/s
    puffCount: 6, // particles when a shot hits a wall
    puffSpeed: 1.5, // m/s
    puffColor: 0xb8b0a4, // dusty grey
    // SPLATTER setting (Settings > Comfort): what a zombie's body does when hit. 'confetti' = the zombie's own bright
    // colors (the shipped default), 'red' = cartoon blood droplets (same chunky cubes) and a pool of blood that spreads
    // under each corpse, 'off' = nothing.
    blood: {
      mode: 'confetti', // set from the setting
      colors: [0xc1121f, 0xa4161a, 0xe5383b, 0x8d0801], // red mode: droplet colors
      countScale: 1.3, // red mode: more droplets than confetti
      poolVariants: 3, // different pool shapes (so corpses do not all leave the same puddle)
      poolRadius: 0.62, // meters (varies +-15% per corpse)
      poolShare: 0.72, // how much of the pool's square plane the pool takes (the rest is its soft edge and drops)
      poolSeconds: 45, // how long a pool lasts (it shrinks away over the last `fadeSeconds`)
      fadeSeconds: 6,
      poolGrowSeconds: 5, // it spreads out under the body, fast at first and then slowing
      maxPools: 24, // the oldest are replaced beyond this
    },
    hitMarkerSeconds: 0.18, // how long the crosshair hit marker shows
    crosshairMinGap: 4, // pixels: the crosshair lines never get closer to the center than this
    lowAmmoThreshold: 3, // magazine count at which the ammo counter turns red
  },
};
