// Each skin belongs to one gun. The two Phase 1 palettes are retained for the later merge.
export const skins = {
  stapleGun: [{
    id: 'night-shift', name: 'Night Shift', slot: 1,
    palette: { body: 0x303e74, dark: 0x202846, metal: 0x8294aa, grip: 0x292b36, accent: 0xbfcce1, sight: 0xf8e1a3 },
    challenge: { kind: 'kills', count: 400 },
  }],
  rivetRifle: [{
    id: 'carbon-copy', name: 'Carbon Copy', slot: 1,
    palette: { body: 0x404a4d, dark: 0x242a30, metal: 0x8797a5, grip: 0x20242a, accent: 0x7086a0, sight: 0xe9eb9b },
    challenge: { kind: 'kills', count: 400 },
  }],
  priceGun: [{ id: 'red-tag', name: 'Red Tag', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  nailGun: [{ id: 'aftermarket', name: 'Aftermarket', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  foamDartBlaster: [{ id: 'blue-ribbon', name: 'Blue Ribbon', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  confettiCannon: [{ id: 'encore', name: 'Encore', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  coilNailer: [{ id: 'factory-finish', name: 'Factory Finish', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  barcodeScanner: [{ id: 'black-label', name: 'Black Label', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  leafBlower: [{ id: 'autumn-gold', name: 'Autumn Gold', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  tennisBallLauncher: [{ id: 'centre-court', name: 'Centre Court', slot: 1, challenge: { kind: 'kills', count: 400 } }],
  returnToSender: [{ id: 'final-notice', name: 'Final Notice', slot: 1, challenge: { kind: 'kills', count: 150 } }],
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
