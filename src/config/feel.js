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
    maxHealth: 100, // not used until zombies can hit you
  },

  movement: {
    walkSpeed: 5, // m/s
    sprintSpeed: 8, // m/s
    groundAcceleration: 60, // m/s^2: how quickly you reach full speed on the ground
    airAcceleration: 15, // m/s^2: less control while airborne
    jumpVelocity: 6.5, // m/s upward; with gravity 20 the jump peaks at ~1.05m (clears benches)
    gravity: 20, // m/s^2 (a bit stronger than real life so jumps feel snappy)
    maxFallSpeed: 30, // m/s
    coyoteTime: 0.1, // seconds after walking off a ledge where you can still jump
    jumpBufferTime: 0.1, // seconds a jump press is remembered before you land
    stepTolerance: 0.05, // bumps shorter than this never block you
  },

  sprint: {
    duration: 4, // seconds of sprint in a full meter
    refillDelay: 1, // seconds after you stop sprinting before the meter refills
    refillRate: 1.25, // seconds of sprint regained per second (empty -> full in ~3.2s)
    minToStart: 0.5, // after fully draining, the meter must refill this much before you can sprint again
    requiresForward: true, // like COD: you can only sprint while holding forward
  },

  crouch: {
    height: 1.1, // collision height while crouched or sliding (standing is player.height)
    eyeHeight: 0.95, // camera height above the feet while crouched
    speed: 2.5, // m/s walking while crouched
    eyeTransitionSpeed: 6, // m/s the camera moves up/down when changing stance
    headroomMargin: 0.01, // shrinks the standing-up check so a wall beside you never blocks it
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
  },

  look: {
    mouseSensitivity: 0.0022, // radians per pixel of mouse movement
    maxPitchDegrees: 89, // how far you can look up/down
    invertY: false,
    kickRecovery: 10, // how fast weapon view kick settles back (higher = faster, per second)
  },

  ads: {
    key: 'Mouse2', // hold to aim. Any input code works, e.g. 'Mouse2' (right mouse) or 'KeyQ'
    moveSpeedMultiplier: 0.75, // walking speed while fully aimed (goes into the stats object)
    sensitivityFollowsZoom: true, // mouse turns slower when zoomed in, so aim feels the same
  },

  camera: {
    fov: 75,
    near: 0.05,
    far: 200,
  },

  world: {
    shutterOpenSeconds: 1.2, // how long a security shutter takes to roll up
  },

  // First-person weapon model (drawn on top of the world so it never clips into walls)
  viewmodel: {
    offset: { x: 0.19, y: -0.15, z: -0.46 }, // meters from the camera: right, down, forward
    aimYawDegrees: 6, // gun angles slightly in toward the crosshair (straightens out in ADS)
    fov: 75, // the gun is drawn with its own fixed FOV so ADS zoom doesn't enlarge it
    kickBack: 0.06, // meters the gun jolts back when firing
    kickRotateDegrees: 9, // degrees the muzzle flips up when firing
    kickReturnSeconds: 0.12, // how long the gun takes to settle after a shot
    reloadDipDegrees: 40, // how far the gun tilts down during a reload
    reloadDrop: 0.12, // meters the gun drops during a reload
    reloadRollDegrees: 20, // how far the gun rolls sideways during a reload
    reloadHandDrop: 0.2, // meters the left hand drops away to grab a new staple strip
  },

  // The player's own body: arms on the gun, legs/torso visible when looking down.
  // Look: last mall employee standing. Red polo, khakis, white sneakers.
  body: {
    colors: {
      skin: 0xe0ac7e,
      shirt: 0xc8102e, // red polo
      pants: 0xc3a57a, // khaki
      shoes: 0xf2f2f2, // white sneakers
      soles: 0x8a8a8a,
      belt: 0x4a3426, // brown belt
    },
    // Hip height for each stance. In between, it follows the camera height smoothly.
    hipHeight: { stand: 0.92, crouch: 0.5, slide: 0.3 },
    hipWidth: 0.1, // each leg's distance from the center line
    thighLength: 0.46,
    shinLength: 0.44,
    ankleHeight: 0.08,
    torsoHeight: 0.12, // only the lower torso (belly + shirt hem) is drawn; a full chest would fill the screen
    waistWidth: 0.3, // slim, flat waist: a wide deep box reads as a big gut from above
    waistDepth: 0.15,
    backOffset: 0.36, // torso and hips sit this far behind the camera, so looking down you see past the belly
    feetForward: 0.16, // feet rest this far in front of the hips
    strideLength: 1.4, // meters traveled per full walk cycle (both steps)
    stepSwing: 0.28, // how far each foot swings forward/back at walking speed
    stepLift: 0.12, // how high feet lift while walking
    slideFrontFoot: 0.75, // how far the leading foot reaches forward in a slide
    slideBackFoot: 0.62, // the other foot: less far forward, splayed out to the side
    slideSplay: 0.25, // how far the second foot splays sideways
    airTuck: 0.25, // how far feet pull up while airborne
    blendSpeed: 10, // how fast the legs switch between walk/slide/air poses (per second)
  },

  // Hit effects (cartoon splatter, tracers, hit markers)
  effects: {
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
    hitMarkerSeconds: 0.18, // how long the crosshair hit marker shows
    crosshairMinGap: 4, // pixels: the crosshair lines never get closer to the center than this
    lowAmmoThreshold: 3, // magazine count at which the ammo counter turns red
  },
};
