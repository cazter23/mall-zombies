// Each skin belongs to one gun. Mastery recolours: the base coat under every build and warranty.
export const skins = {
  stapleGun: [{
    id: 'night-shift', name: 'Night Shift', slot: 1,
    palette: { body: 0x303e74, dark: 0x202846, metal: 0x8294aa, grip: 0x292b36, accent: 0xbfcce1, sight: 0xf8e1a3 },
    challenge: { kind: 'kills', count: 400 },
  }],
  rivetRifle: [{
    id: 'carbon-copy', name: 'Carbon Copy', slot: 1,
    palette: { body: 0x353f42, dark: 0x242a30, metal: 0x8797a5, grip: 0x20242a, accent: 0x7086a0, sight: 0xe9eb9b },
    challenge: { kind: 'kills', count: 400 },
  }],
  priceGun: [{ id: 'red-tag', name: 'Red Tag', slot: 1,
    palette: { body: 0x612635, dark: 0x311922, metal: 0xb0a3aa, grip: 0x241c24, accent: 0xf6adbd, sight: 0xffe3a1, ammo: 0xf8ecd9 }, challenge: { kind: 'kills', count: 400 } }],
  nailGun: [{ id: 'aftermarket', name: 'Aftermarket', slot: 1,
    palette: { body: 0x393e35, dark: 0x20271f, metal: 0xaab4a0, grip: 0x24241d, accent: 0xe7b36b, sight: 0xf7e1a0 }, challenge: { kind: 'kills', count: 400 } }],
  foamDartBlaster: [{ id: 'blue-ribbon', name: 'Blue Ribbon', slot: 1,
    palette: { body: 0x243c68, dark: 0x19243e, metal: 0x9bb7d8, grip: 0x202736, accent: 0xc7dcff, sight: 0xffe6a4, ammo: 0x9dd4f5 }, challenge: { kind: 'kills', count: 400 } }],
  confettiCannon: [{ id: 'encore', name: 'Encore', slot: 1,
    palette: { body: 0x512753, dark: 0x2c1a30, metal: 0xb1a0be, grip: 0x241b2b, accent: 0xe9b5f2, sight: 0xffe7ad, ammo: 0xf2ddaf }, challenge: { kind: 'kills', count: 400 } }],
  coilNailer: [{ id: 'factory-finish', name: 'Factory Finish', slot: 1,
    palette: { body: 0x38454a, dark: 0x202c32, metal: 0xb1c1ca, grip: 0x202428, accent: 0xddb480, sight: 0xf8e0a0 }, challenge: { kind: 'kills', count: 400 } }],
  barcodeScanner: [{ id: 'black-label', name: 'Black Label', slot: 1,
    palette: { body: 0x292636, dark: 0x171723, metal: 0xa8a2bb, grip: 0x201e29, accent: 0xd9b5de, sight: 0xc8f3b0, emitter: 0xf391b3 }, challenge: { kind: 'kills', count: 400 } }],
  leafBlower: [{ id: 'autumn-gold', name: 'Autumn Gold', slot: 1,
    palette: { body: 0x51402b, dark: 0x2d281e, metal: 0xbeb099, grip: 0x27231d, accent: 0xedc77f, sight: 0xffefb0 }, challenge: { kind: 'kills', count: 400 } }],
  tennisBallLauncher: [{ id: 'centre-court', name: 'Centre Court', slot: 1,
    palette: { body: 0x244838, dark: 0x192e26, metal: 0xa4bdb4, grip: 0x1c2723, accent: 0xe0e5c4, sight: 0xffe6a3, ammo: 0xe2ed91, glass: 0xc7e6d7 }, challenge: { kind: 'kills', count: 400 } }],
  returnToSender: [{ id: 'final-notice', name: 'Final Notice', slot: 1,
    palette: { body: 0x492c3c, dark: 0x291d29, metal: 0xbba9ba, grip: 0x241c26, accent: 0xefb0c4, sight: 0xffe7a7, emitter: 0xf8c3d2, screen: 0xcdebc0 }, challenge: { kind: 'kills', count: 150 } }],
};

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
  pa: (gunName, skinName) => ({
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
  challenge: (gun, count) => 'Clear ' + count + ' zombies with the ' + gun + ' across all shifts.',
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
