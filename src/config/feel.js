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
    aimYawDegrees: 6, // gun angles slightly in toward the crosshair
    kickBack: 0.06, // meters the gun jolts back when firing
    kickRotateDegrees: 9, // degrees the muzzle flips up when firing
    kickReturnSeconds: 0.12, // how long the gun takes to settle after a shot
    reloadDipDegrees: 40, // how far the gun tilts down during a reload
    reloadDrop: 0.12, // meters the gun drops during a reload
    reloadRollDegrees: 20, // how far the gun rolls sideways during a reload
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
    lowAmmoThreshold: 3, // magazine count at which the ammo counter turns red
  },
};
