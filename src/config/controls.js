// =============================================================================
// CONTROLS CONFIG
// What every button does (keyboard/mouse AND controller), how the controller
// sticks feel, and aim assist. Gameplay code asks for ACTIONS ("jump", "fire"),
// never raw keys, so rebinding is a matter of editing this file.
//
// Controller buttons use the browser's standard gamepad layout (Xbox names):
//   PadA PadB PadX PadY  PadLB PadRB  PadLT PadRT  PadBack PadStart  PadL3 PadR3
//   PadUp PadDown PadLeft PadRight
// PlayStation equivalents: A=Cross, B=Circle, X=Square, Y=Triangle, LB/RB=L1/R1, LT/RT=L2/R2.
// =============================================================================

export const bindings = {
  forward: ['KeyW'], // (the left stick also moves; see gamepad below)
  back: ['KeyS'],
  left: ['KeyA'],
  right: ['KeyD'],
  jump: ['Space', 'PadA'],
  crouch: ['KeyC', 'PadB'], // hold to crouch; tap while sprinting to slide
  sprint: ['ShiftLeft', 'ShiftRight', 'PadSprint'], // PadSprint = left stick click, latched (COD-style)
  fire: ['Mouse0', 'PadRT'],
  aim: ['Mouse2', 'PadLT'],
  reload: ['KeyR', 'PadX'],
  interact: ['KeyF', 'PadX'], // hold to buy (doors, wall buys). On X: tap = reload, hold = buy (COD)
  switchWeapon: ['WheelUp', 'WheelDown', 'PadY'], // swap to the other weapon slot
  weapon1: ['Digit1'], // straight to slot 1 / slot 2
  weapon2: ['Digit2'],
  melee: ['KeyV', 'PadRB', 'PadR3'],
  pause: ['PadStart'],
  confirm: ['PadA', 'PadStart'], // controller menus: start, resume, play again
};

// Button names shown in on-screen prompts, per device.
export const buttonLabels = {
  keyboard: { reload: 'R', melee: 'V', confirm: 'Click', interact: 'F' },
  xbox: { reload: 'X', melee: 'RB', confirm: 'A', interact: 'X' },
  playstation: { reload: '□', melee: 'R1', confirm: '✕', interact: '□' },
};

export const gamepad = {
  // Deadzones (0..1 of stick travel). Inside the inner one the stick counts as centered;
  // past the outer one it counts as fully pushed (worn sticks rarely reach 1.0).
  moveDeadzone: 0.15,
  lookDeadzone: 0.12,
  outerDeadzone: 0.95,

  // Look speed at full stick deflection (before ADS zoom scaling).
  yawDegreesPerSecond: 200,
  pitchDegreesPerSecond: 140,
  // Response curve: 1 = linear; higher = finer control near the center, fast at the edge.
  lookCurve: 2,
  invertY: false,

  // Turn ramp (COD-style): holding the stick fully sideways speeds turning up after a moment,
  // so you can whip around without making small aim adjustments twitchy.
  ramp: {
    threshold: 0.9, // stick deflection that counts as "fully pushed"
    delaySeconds: 0.15, // how long before the ramp kicks in
    rampSeconds: 0.3, // time to reach full extra speed
    extra: 0.8, // up to 80% faster turning
  },

  triggerThreshold: 0.3, // how far a trigger must be pulled to count as pressed
  // Click-to-sprint: left stick click latches sprint; it ends when the stick drops below this
  // much forward, or you aim or crouch.
  sprintReleaseForward: 0.3,
};

// Aim assist. Controller only: never applies to mouse aiming.
// Compared to modern COD (Cold War / BO6): similar slowdown, roughly half the rotational
// assist, and a milder ADS snap with a cooldown so it can't be spammed.
export const aimAssist = {
  strength: 1, // master dial: 0 = off, 1 = default, 1.5 = strong

  // Which zombies count: within range, visible (no walls), and near the crosshair.
  maxRange: 25, // meters: no assist beyond this
  fullRange: 12, // meters: full strength up to here, fading out to maxRange
  assistRadius: 0.9, // meters around a zombie's chest where assist starts...
  coreRadius: 0.35, // ...and where it's at full strength (roughly the body)
  minConeDegrees: 2, // the assist zone never gets smaller than this (far away)...
  maxConeDegrees: 14, // ...or bigger than this (up close)
  chestHeightFraction: 0.75, // aim point: 75% up the body (chest), so headshots stay a skill

  // 1) Slowdown: look speed multiplier when right on a zombie (eases back to 1 off it).
  slowdownHip: 0.6,
  slowdownAds: 0.5,

  // 2) Rotational assist: how much of a zombie's movement across your view your aim follows.
  //    Only while you're using a stick (never moves a still aim).
  rotationalHip: 0.15,
  rotationalAds: 0.25,
  rotationalPitchScale: 0.5, // weaker vertically
  stickActiveThreshold: 0.1, // stick input (after the deadzone) needed for rotational assist to act
  rotationalEdgeFade: 0.3, // full strength except the outer 30% of the assist zone, where it fades out

  // 3) ADS snap: pressing aim near a zombie nudges you part of the way to its chest.
  snapDegrees: 5, // only if the zombie is within this angle of the crosshair
  snapFraction: 0.4, // move 40% of the way (not a full lock)
  snapCooldownSeconds: 0.6, // stops aim-tap spam
};
