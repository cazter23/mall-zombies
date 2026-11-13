// Controller feedback only. Durations in milliseconds; motor strengths 0..1.
export const haptics = {
  strength: 1,
  shots: {
    rivetRifle: { duration: 65, strongMagnitude: 0.38, weakMagnitude: 0.45, priority: 1 },
    coilNailer: { duration: 75, strongMagnitude: 0.48, weakMagnitude: 0.52, priority: 1 },
    barcodeScanner: { duration: 115, strongMagnitude: 0.68, weakMagnitude: 0.6, priority: 1 },
    stapleGun: { duration: 55, strongMagnitude: 0.22, weakMagnitude: 0.55, priority: 1 },
    priceGun: { duration: 35, strongMagnitude: 0.08, weakMagnitude: 0.45, priority: 1 },
    nailGun: { duration: 90, strongMagnitude: 0.5, weakMagnitude: 0.35, priority: 1 },
    foamDartBlaster: { duration: 28, strongMagnitude: 0.14, weakMagnitude: 0.3, priority: 1 },
    returnToSender: { duration: 140, strongMagnitude: 0.6, weakMagnitude: 0.5, priority: 1 },
    tennisBallLauncher: { duration: 110, strongMagnitude: 0.45, weakMagnitude: 0.3, priority: 1 },
    stargazer: { duration: 150, strongMagnitude: 0.7, weakMagnitude: 0.4, priority: 1 },
    bottleRocket: { duration: 200, strongMagnitude: 0.85, weakMagnitude: 0.5, priority: 1 },
    balloonLauncher: { duration: 45, strongMagnitude: 0.12, weakMagnitude: 0.3, priority: 1 },
    bogo: { duration: 24, strongMagnitude: 0.08, weakMagnitude: 0.4, priority: 1 }, // (18 shots a second: a short buzz each)
    leafBlower: { duration: 40, strongMagnitude: 0.1, weakMagnitude: 0.35, priority: 1 }, // (a stream: a light rumble per pulse)
    confettiCannon: { duration: 170, strongMagnitude: 0.85, weakMagnitude: 0.55, priority: 1 },
  },
  damage: { duration: 180, strongMagnitude: 0.8, weakMagnitude: 0.7, priority: 3 },
  pickup: { duration: 140, strongMagnitude: 0.25, weakMagnitude: 0.5, priority: 2 },
  // A bought door (game/doorOpenings.js): a light tick as it unlocks, a thump when it clunks home (only within
  // config/shutters.js opening.nudge.range). Free connections that open on their own stay still.
  doorUnlock: { duration: 60, strongMagnitude: 0.1, weakMagnitude: 0.4, priority: 2 },
  doorClunk: { duration: 160, strongMagnitude: 0.6, weakMagnitude: 0.35, priority: 2 },
};
