import { zombieTypes } from './zombies.js';

const { shopper } = zombieTypes;
export const bossComfort = { dimPhoneFlash: false };

export const bossTiming = {
  waveFraction: 1 / 3, // after this share of regular spawns, without spending any of their quota
  retrySeconds: 0.3,
  introPriority: 3,
};

export const bossVouchers = {
  discountCode: {
    name: 'Discount Code', fraction: 0.5, maxSaving: 2000, excludedCategories: ['clawMachine', 'claw'], pointsInstead: 1500,
    color: 0xe7a3ed, icon: 'ticket', sound: 'incentiveRestock',
    pa: { kicker: 'Sponsored content', text: 'Half off your next purchase, saving up to 2,000. The claw machine has declined to participate.' },
  },
  masterKey: {
    name: 'Master Key', category: 'door', fraction: 1, pointsInstead: 1250,
    color: 0x9adbd7, icon: 'door', sound: 'incentiveRestock',
    pa: { kicker: 'Access granted', text: 'One free area unlock. Please return the key to a member of staff who is still alive.' },
  },
  signedApproval: {
    name: 'Signed Approval', category: 'tier', ids: ['deluxe', 'premium'], fraction: 1,
    pointsInstead: 1500, color: 0xe4c779, icon: 'ticket', sound: 'incentiveRestock',
    pa: { kicker: 'Approval received', text: 'One warranty tier, through Premium. Management accepts no responsibility for your aim.' },
  },
};

export const bossTypes = {
  influencer: {
    ...shopper, id: 'influencer', boss: true, name: 'Skylar Sparkle', title: 'Content Creator',
    barNotice: 'Followers', firstRounds: [15, 17], healthMultiplier: 8, slowStrength: 0.5,
    speed: 3.2, speedVariation: 0, gaits: null, gaitsByRound: null, bagChance: 0,
    shirtColors: [0xc65eaf], pantsColors: [0x403452], shoeColor: 0xf1e5dc,
    modelScale: { width: 1.04, height: 1.08 },
    filming: { minRange: 10, maxRange: 16, preferredRange: 13, relocateSeconds: 5,
      minRelocate: 3, arriveMeters: 0.35, floorTolerance: 0.3, lookAhead: 8, sightHeight: 1.4 },
    followers: { perSecond: 5, hit: 7, headshot: 18, thresholds: [25, 50, 75], viral: 100, resetTo: 50 },
    fans: { type: 'mallWalker', healthFraction: 0.5, perThreshold: 3, viralCount: 8, maxPending: 17, leaveSeconds: 2 },
    flash: { range: 5, windupSeconds: 0.75, cooldownSeconds: 7, seconds: 0.3, opacity: 0.24, dimOpacity: 0.35 },
    introBanner: { kicker: 'Live from the Galleria', text: 'Skylar Sparkle is filming. Dislike and unsubscribe with your weapon.' },
    introSound: 'paChime', reward: 'discountCode',
    phases: {
      followers: { kicker: 'Fan meet-up', text: 'Three valued followers have arrived. Their engagement has no cash value.' },
      viral: { kicker: 'Going viral', text: 'Eight more followers. No refunds on popularity.' },
      flashWindup: { kicker: 'Phone flash charging', text: 'Look away. This content is about to be overexposed.' },
    },
    costume: {
      torso: [
        { color: 0xf3cf55, size: [0.07, 0.34, 0.035], at: [0, 0.36, -0.17] },
        { color: 0xf3cf55, size: [0.26, 0.035, 0.035], at: [0, 0.43, -0.17] },
      ],
      head: [{ color: 0xb057b6, size: [0.43, 0.07, 0.34], at: [0, 0.31, 0] }],
      hand: [
        { color: 0x73778b, size: [0.035, 0.035, 0.9], at: [0, 0, -0.55] },
        { color: 0x30293f, size: [0.16, 0.27, 0.04], at: [0, 0, -1] },
        { color: 0xb2edf0, size: [0.13, 0.22, 0.015], at: [0, 0, -1.03] },
      ],
      ring: { color: 0xfff2d5, radius: 0.25, tube: 0.035, radialSegments: 6, segments: 24, at: [0, 0, -1] },
    },
  },
  guard: {
    ...shopper, id: 'guard', boss: true, name: 'Officer Doug Kettle', title: 'Loss Prevention',
    barNotice: 'Headshots void this lockdown', firstRounds: [9, 11], healthMultiplier: 10,
    slowStrength: 0.5, speed: 3, speedVariation: 0, gaits: null, gaitsByRound: null, bagChance: 0,
    shirtColors: [0x496782], pantsColors: [0x24334b], shoeColor: 0x1b1c26,
    modelScale: { width: 1.3, height: 1.06 },
    attack: { ...shopper.attack, damage: 40, windupSeconds: 0.7, minWindupSeconds: 0.7, windupShrinkPerRound: 0 },
    charge: { ...zombieTypes.cartPusher.charge, minRange: 3, maxRange: 9, laneHalfWidth: 0.4,
      telegraphSeconds: 0.8, speed: 10, maxMeters: 8, overshootMeters: 1.5, noseReach: 0.45,
      hitHalfWidth: 0.35, damage: 40, knockback: 0, crashSeconds: 2, crashDamageTakenMultiplier: 1.5, cooldownSeconds: 5 },
    taserSlow: { seconds: 1, speed: 0.65 },
    sounds: { telegraph: { name: 'paChime', maxDistance: 24 } },
    lockdown: { thresholds: [0.75, 0.35], alarmSeconds: 3, seconds: 25, headshots: 3, backup: 2, backupType: 'mallWalker' },
    introBanner: { kicker: 'Loss Prevention advisory', text: 'Officer Kettle has mistaken survival for suspicious behaviour.' },
    introSound: 'paChime', reward: 'masterKey',
    phases: {
      alarm: { kicker: 'Lockdown in three seconds', text: 'For your safety, your exits are being removed. Three headshots cancel this service.' },
      lockdown: { kicker: 'Area secured', text: 'Please remain calm and available for questioning.' },
      radioBroken: { kicker: 'Radio disconnected', text: 'Loss Prevention is experiencing a loss of reception.' },
      released: { kicker: 'Lockdown lifted', text: 'Thank you for your patience during this avoidable inconvenience.' },
    },
    costume: {
      torso: [
        { color: 0x212433, size: [0.5, 0.09, 0.32], at: [0, 0.12, 0] },
        { color: 0xe8c86a, size: [0.12, 0.14, 0.035], at: [-0.12, 0.43, -0.15] },
        { color: 0x1d202e, size: [0.12, 0.2, 0.08], at: [0.16, 0.36, -0.16] },
        { color: 0x1d202e, size: [0.025, 0.16, 0.025], at: [0.19, 0.53, -0.16] },
      ],
      head: [
        { color: 0x26364b, size: [0.38, 0.13, 0.34], at: [0, 0.34, 0] },
        { color: 0x26364b, size: [0.36, 0.035, 0.19], at: [0, 0.28, -0.2] },
        { color: 0xe8c86a, size: [0.08, 0.09, 0.02], at: [0, 0.34, -0.18] },
      ],
      hand: [
        { color: 0x292e3d, size: [0.09, 0.09, 0.4], at: [0, 0, -0.25] },
        { color: 0xd5f8e8, size: [0.13, 0.13, 0.08], at: [0, 0, -0.48] },
      ],
    },
  },
  manager: {
    ...shopper, id: 'manager', boss: true, name: 'Dennis Fairweather', title: 'General Manager',
    barNotice: 'Mandatory all-staff attendance', firstRounds: [12, 13, 14], healthMultiplier: 10,
    slowStrength: 0.5, speed: 2.4, speedVariation: 0, gaits: null, gaitsByRound: null, bagChance: 0,
    shirtColors: [0x45425d], pantsColors: [0x292638], shoeColor: 0x171821,
    modelScale: { width: 1.16, height: 1.1 },
    attack: { ...shopper.attack, damage: 60, windupSeconds: 0.9, minWindupSeconds: 0.9, windupShrinkPerRound: 0, moveSpeedFraction: 0.45 },
    introBanner: { kicker: 'Management is on the floor', text: 'Dennis Fairweather would like a quick word. Please budget the rest of your life.' },
    introSound: 'paChime', reward: 'signedApproval',
    report: { interval: 8, radius: 14, maxTargets: 6, seconds: 5, speed: 1.3 },
    meeting: { thresholds: [0.66, 0.33], seconds: 8, radius: 12, damageTaken: 1.5, cancelFraction: 0.15,
      stunSeconds: 3, buffSeconds: 20, speed: 1.25, damage: 1.25 },
    phases: {
      report: { kicker: 'Direct Report', text: 'Management has identified six employees with spare capacity.' },
      meeting: { kicker: 'Staff Meeting', text: 'Attendance is mandatory. Shoot the presenter to submit feedback.' },
      cancelled: { kicker: 'Meeting cancelled', text: 'Your feedback has been received at considerable velocity.' },
      failed: { kicker: 'Action items assigned', text: 'Productivity is up twenty-five percent. Morale remains unmeasured.' },
    },
    costume: {
      torso: [
        { color: 0xf8e9cb, size: [0.16, 0.4, 0.025], at: [0, 0.36, -0.135] },
        { color: 0xae4e59, size: [0.06, 0.3, 0.03], at: [0, 0.34, -0.16] },
        { color: 0xeac66b, size: [0.15, 0.07, 0.035], at: [-0.13, 0.45, -0.155] },
      ],
      hand: [
        { color: 0x947043, size: [0.3, 0.4, 0.045], at: [0, -0.1, -0.25] },
        { color: 0xffefcd, size: [0.25, 0.31, 0.015], at: [0, -0.1, -0.28] },
        { color: 0xaaaeb7, size: [0.13, 0.05, 0.04], at: [0, 0.08, -0.28] },
      ],
    },
    whiteboard: { offset: [0.7, 0, 0.4], pieces: [
      { color: 0xf4eedc, size: [1.4, 0.9, 0.08], at: [0, 1.35, 0] },
      { color: 0x485663, size: [1.48, 0.06, 0.12], at: [0, 1.82, 0] },
      { color: 0x485663, size: [0.06, 1.6, 0.08], at: [-0.63, 0.85, 0] },
      { color: 0x485663, size: [0.06, 1.6, 0.08], at: [0.63, 0.85, 0] },
      { color: 0x292633, size: [0.18, 0.18, 0.28], at: [-0.63, 0.09, 0] },
      { color: 0x292633, size: [0.18, 0.18, 0.28], at: [0.63, 0.09, 0] },
      { color: 0xc75364, size: [0.9, 0.035, 0.015], at: [0, 1.55, -0.055], tilt: 0.1 },
      { color: 0x42697a, size: [0.7, 0.035, 0.015], at: [0, 1.3, -0.055] },
    ] },
  },
  janitor: {
    ...shopper,
    id: 'janitor',
    boss: true,
    name: 'Mopwater Murray',
    title: 'Night Janitor',
    barNotice: 'Cleaning in progress',
    firstRounds: [5, 7],
    healthMultiplier: 6,
    slowStrength: 0.5,
    speed: 2.2,
    speedVariation: 0,
    gaits: null,
    gaitsByRound: null,
    attack: {
      ...shopper.attack, damage: 60, windupSeconds: 0.85, minWindupSeconds: 0.85,
      windupShrinkPerRound: 0, moveSpeedFraction: 0.65,
    },
    modelScale: { width: 1.18, height: 1.14 },
    hitbox: { bodyHalfWidth: 0.32, bodyTop: 1.58, headHalfSize: 0.22, headBottom: 1.58, headTop: 2.07 },
    shirtColors: [0x318582],
    pantsColors: [0x235652],
    shoeColor: 0x27232d,
    introBanner: { kicker: 'Maintenance advisory', text: 'Mopwater Murray is on duty. Please walk, do not run. Murray will run.' },
    introSound: 'janitorSting',
    reward: 'spillCleanup',
    wetFloor: {
      maxPatches: 6, seconds: 12, speedFraction: 0.7, radius: 1.12, spacing: 2.05,
      floorTolerance: 0.12, clearanceHeight: 0.2, surfaceOffset: 0.016,
      color: 0x73dbef, rim: 0xc5f9ff, opacity: 0.48, rimOpacity: 0.8, rimWidth: 0.085, segments: 24,
    },
    // The stock skeleton faces -Z. The mop follows the arm through its wind-up and swing.
    uniform: [
      { color: 0x194648, size: [0.42, 0.075, 0.30], at: [0, 0.15, 0] },
      { color: 0xe1b757, size: [0.11, 0.067, 0.025], at: [-0.112, 0.455, -0.13] },
      { color: 0xe6d9ab, size: [0.042, 0.33, 0.035], at: [0.07, 0.38, -0.135], tilt: -0.32 },
      { color: 0x6d727b, size: [0.34, 0.33, 0.23], at: [0, 0.265, 0.23] },
      { color: 0xffcf31, size: [0.30, 0.43, 0.045], at: [0, 0.37, 0.366], tilt: 0.13 },
      { color: 0x312c25, size: [0.205, 0.045, 0.022], at: [0, 0.44, 0.393], tilt: 0.13 },
      { color: 0x312c25, size: [0.15, 0.038, 0.022], at: [0.016, 0.33, 0.393], tilt: 0.13 },
      { color: 0xe49d38, size: [0.3, 0.21, 0.27], at: [0.26, 0.06, 0.16] },
      { color: 0x81737d, size: [0.31, 0.035, 0.28], at: [0.26, 0.18, 0.16] },
    ],
    cap: [
      { color: 0x235652, size: [0.34, 0.09, 0.32], at: [0, 0.333, 0] },
      { color: 0x235652, size: [0.3, 0.035, 0.155], at: [0, 0.298, -0.18] },
    ],
    mop: [
      { color: 0xb87847, size: [0.047, 0.047, 0.93], at: [0, 0, -0.45] },
      { color: 0x78878c, size: [0.12, 0.105, 0.1], at: [0, 0, -0.92] },
      { color: 0xb8c7bb, size: [0.29, 0.105, 0.21], at: [0, 0, -1.015] },
      { color: 0xe0dbbc, size: [0.068, 0.084, 0.26], at: [-0.095, -0.025, -1.045], tilt: -0.15 },
      { color: 0xd3d2b7, size: [0.068, 0.091, 0.27], at: [0.02, -0.021, -1.07], tilt: 0.1 },
      { color: 0xe0dbbc, size: [0.075, 0.076, 0.235], at: [0.11, -0.022, -1.032], tilt: 0.17 },
    ],
  },
};
