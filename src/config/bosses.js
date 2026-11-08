import { zombieTypes } from './zombies.js';

const { shopper } = zombieTypes;

export const bossTiming = {
  waveFraction: 1 / 3, // after this share of regular spawns, without spending any of their quota
  retrySeconds: 0.3,
  introPriority: 3,
};

export const bossTypes = {
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
