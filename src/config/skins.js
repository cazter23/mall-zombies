// Each skin belongs to one gun. Slot 1 = Mastery recolours, slot 2 = Role (a recolour plus one printed pattern):
// the base coat under every build and warranty.
// A challenge is data: `kind` picks its counter in game/challenges.js (one entry each there), `count` is what unlocks
// the skin, the other fields are that kind's numbers, and `text` is the locker's sentence ({gun} = the gun's name,
// {anyField} = that field). `needs` names a system the challenge depends on that could be cut (swap the challenge if it is).
//   kills            kills with the gun
//   headshotKills    headshot kills (minDistance: only from this many metres, by the kill's `distance`)
//   rangedKills      kills from minDistance metres or more
//   quickKills       kills where this gun drew first blood and the zombie died within `seconds` (the kill's firstWound)
//   typeKills        kills on zombies whose type id is in `types`
//   bossKills        bosses whose lethal hit was this gun's
//   bankShotKills    kills by a ball that had bounced minBounces times or more (the kill's `bounces`)
//   multiKillShots   shots (a blast, a beam) that each killed minKills or more zombies
//   cleanMagazines   magazines of at least minShots emptied with every shot hitting (a per-run count, saved with the run)
//   stoppedAttacks   zombies shoved out of an attack by a cone gun (the shot's hits[].interrupted)
const mastery = count => ({ kind: 'kills', count, text: 'Clear {count} zombies with the {gun} across all shifts.' });

export const skins = {
  stapleGun: [{
    id: 'night-shift', name: 'Night Shift', slot: 1,
    palette: { body: 0x303e74, dark: 0x202846, metal: 0x8294aa, grip: 0x292b36, accent: 0xbfcce1, sight: 0xf8e1a3 },
    challenge: mastery(400),
  }, {
    id: 'interoffice', name: 'Interoffice', slot: 2,
    challenge: { kind: 'headshotKills', count: 100, text: 'Land {count} headshot kills with the {gun}.' },
  }],
  rivetRifle: [{
    id: 'carbon-copy', name: 'Carbon Copy', slot: 1,
    palette: { body: 0x353f42, dark: 0x242a30, metal: 0x8797a5, grip: 0x20242a, accent: 0x7086a0, sight: 0xe9eb9b },
    challenge: mastery(400),
  }, {
    id: 'hard-hat-area', name: 'Hard Hat Area', slot: 2,
    challenge: { kind: 'headshotKills', count: 150, minDistance: 10, text: 'Land {count} headshot kills from {minDistance} m or more with the {gun}.' },
  }],
  priceGun: [{ id: 'red-tag', name: 'Red Tag', slot: 1,
    palette: { body: 0x612635, dark: 0x311922, metal: 0xb0a3aa, grip: 0x241c24, accent: 0xf6adbd, sight: 0xffe3a1, ammo: 0xf8ecd9 }, challenge: mastery(400) }, {
    id: 'doorbuster', name: 'Doorbuster', slot: 2,
    challenge: { kind: 'quickKills', count: 150, seconds: 1,
      text: 'Mark down {count} zombies from full price to nothing in {seconds} second or less with the {gun}.' },
  }],
  nailGun: [{ id: 'aftermarket', name: 'Aftermarket', slot: 1,
    palette: { body: 0x393e35, dark: 0x20271f, metal: 0xaab4a0, grip: 0x24241d, accent: 0xe7b36b, sight: 0xf7e1a0 }, challenge: mastery(400) }, {
    id: 'measure-twice', name: 'Measure Twice', slot: 2,
    challenge: { kind: 'cleanMagazines', count: 25, minShots: 10,
      text: 'Empty {count} magazines of the {gun} ({minShots} nails or more) without a single nail missing.' },
  }],
  foamDartBlaster: [{ id: 'blue-ribbon', name: 'Blue Ribbon', slot: 1,
    palette: { body: 0x243c68, dark: 0x19243e, metal: 0x9bb7d8, grip: 0x202736, accent: 0xc7dcff, sight: 0xffe6a4, ammo: 0x9dd4f5 }, challenge: mastery(400) }, {
    id: 'aisle-fifteen', name: 'Aisle Fifteen', slot: 2,
    challenge: { kind: 'rangedKills', count: 150, minDistance: 15, text: 'Clear {count} zombies from {minDistance} m or more with the {gun}.' },
  }],
  confettiCannon: [{ id: 'encore', name: 'Encore', slot: 1,
    palette: { body: 0x512753, dark: 0x2c1a30, metal: 0xb1a0be, grip: 0x241b2b, accent: 0xe9b5f2, sight: 0xffe7ad, ammo: 0xf2ddaf }, challenge: mastery(400) }, {
    id: 'party-size', name: 'Party Size', slot: 2,
    challenge: { kind: 'multiKillShots', count: 40, minKills: 3, text: 'Fire {count} blasts of the {gun} that each clear {minKills} or more zombies.' },
  }],
  coilNailer: [{ id: 'factory-finish', name: 'Factory Finish', slot: 1,
    palette: { body: 0x38454a, dark: 0x202c32, metal: 0xb1c1ca, grip: 0x202428, accent: 0xddb480, sight: 0xf8e0a0 }, challenge: mastery(400) }, {
    id: 'loading-dock', name: 'Loading Dock', slot: 2,
    challenge: { kind: 'typeKills', count: 100, types: ['mascot', 'cartPusher'], text: 'Clear {count} Mascots or Cart Pushers with the {gun}.' },
  }],
  barcodeScanner: [{ id: 'black-label', name: 'Black Label', slot: 1,
    palette: { body: 0x292636, dark: 0x171723, metal: 0xa8a2bb, grip: 0x201e29, accent: 0xd9b5de, sight: 0xc8f3b0, emitter: 0xf391b3 }, challenge: mastery(400) }, {
    id: 'express-lane', name: 'Express Lane', slot: 2,
    challenge: { kind: 'multiKillShots', count: 40, minKills: 2, text: 'Fire {count} beams of the {gun} that each clear {minKills} or more zombies.' },
  }],
  leafBlower: [{ id: 'autumn-gold', name: 'Autumn Gold', slot: 1,
    palette: { body: 0x51402b, dark: 0x2d281e, metal: 0xbeb099, grip: 0x27231d, accent: 0xedc77f, sight: 0xffefb0 }, challenge: mastery(400) }, {
    id: 'lawn-and-garden', name: 'Lawn & Garden', slot: 2,
    challenge: { kind: 'stoppedAttacks', count: 100, needs: ['claw'], text: 'Blow {count} zombies out of an attack with the {gun}.' },
  }],
  tennisBallLauncher: [{ id: 'centre-court', name: 'Centre Court', slot: 1,
    palette: { body: 0x244838, dark: 0x192e26, metal: 0xa4bdb4, grip: 0x1c2723, accent: 0xe0e5c4, sight: 0xffe6a3, ammo: 0xe2ed91, glass: 0xc7e6d7 }, challenge: mastery(400) }, {
    id: 'country-club', name: 'Country Club', slot: 2,
    challenge: { kind: 'bankShotKills', count: 60, minBounces: 1, needs: ['claw'],
      text: 'Clear {count} zombies with a {gun} ball that had already bounced.' },
  }],
  returnToSender: [{ id: 'final-notice', name: 'Final Notice', slot: 1,
    palette: { body: 0x492c3c, dark: 0x291d29, metal: 0xbba9ba, grip: 0x241c26, accent: 0xefb0c4, sight: 0xffe7a7, emitter: 0xf8c3d2, screen: 0xcdebc0 }, challenge: mastery(150) }, {
    id: 'handle-with-care', name: 'Handle With Care', slot: 2,
    challenge: { kind: 'bossKills', count: 5, needs: ['claw'], text: 'Finish {count} bosses with a beam from the {gun}.' },
  }],
};

/** The locker's sentence for a challenge, from its own data ({gun} and {field} filled in). */
export function challengeText(challenge, gunName) {
  return challenge.text.replace(/\{(\w+)\}/g, (_, key) => (key === 'gun' ? gunName : String(challenge[key])));
}

export function gunSkin(gunId, skinId) {
  return Object.hasOwn(skins, gunId) ? skins[gunId].find((skin) => skin.id === skinId) : undefined;
}

export const skinDebug = {
  usage: "Use g.debug.run('skin', gunId, skinId) or pass 'default' to clear it",
  unknownGun: 'No skins for that gun',
  unknownSkin: 'No such skin for that gun',
  equipped: (gun, skin) => `${gun}: wearing ${skin}`,
  cleared: (gun) => `${gun}: default colours`,
};

export const skinStorage = { key: 'sunsetGalleria.skins', version: 1 };

export const skinNotices = {
  toastSeconds: 6,
  toastTitle: 'Skin unlocked',
  toastText: (gunName, skinName) => `${skinName} · ${gunName}`,
  // slot 1 = a mastery skin, slot 2 = a role skin
  pa: (gunName, skinName, slot = 1) => (slot === 2 ? {
    kicker: 'Performance review passed',
    text: `Attention associates. ${gunName} performance review passed. ${skinName} is now yours.`,
  } : {
    kicker: 'Mastery certified',
    text: `Attention associates. ${gunName} mastery certified. ${skinName} is now yours.`,
  }),
};

export const challengeDebug = {
  usage: "Use g.debug.run('challenge', gunId, skinId, 'add', amount), 'complete', or 'clear'",
  unknownChallenge: 'No such challenge for that gun',
  invalidAmount: 'Progress must be a positive whole number',
  unavailable: 'This game has no challenges',
  changed: (skin, count, needed) => `${skin}: ${count} / ${needed}`,
  cleared: (skin) => `${skin}: progress cleared and skin locked`,
};

// Minimum WCAG relative-luminance ratio for body paint against stuffings and warranty tiers.
export const skinContrast = { minimum: 2 };

export const locker = {
  title: 'Associate locker', menu: 'Weapon locker', kicker: 'Personnel · Approved self-expression',
  form: 'SG / PROPERTY · FORM 11-C', guns: 'Issued equipment', skins: 'Approved finishes',
  defaultName: 'Default', defaultDescription: 'Factory issue. No paperwork required.',
  back: 'Back', locked: 'Locked', equipped: 'Equipped', available: 'Equip',
  hint: 'Arrow keys / D-pad to browse · Enter / A to equip · Escape / B to return',
  previewLabel: 'Gun finish preview',
  theme: { ink: '#302b30', paper: '#f4ead7', edge: '#b8a98e', stamp: '#9a3f53', selected: '#e8d9c1', highlight: '#93556a', lockedPaper: '#dedbd4', lockedInk: '#625e59' },
  progress: (count, needed) => count + ' / ' + needed,
  receiptLabel: 'Skins unlocked',
  receiptNames: names => names.join(' · '),
  preview: {
    width: 520, height: 320, pixelRatio: 1.5, background: 0x211c2b,
    fov: 35, near: 0.01, far: 20, framing: 1.45, rotationSpeed: 0.22,
    pitch: -0.12, initialYaw: -0.6, camera: [1, 0.65, 1.6],
    sky: 0xfff0d8, ground: 0x655474, ambientIntensity: 2,
    key: 0xffffff, keyIntensity: 3, keyPosition: [2, 3, 2],
  },
};
