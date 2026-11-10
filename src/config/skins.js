// Each skin belongs to one gun. Phase 1 previews the Mastery recolours through debug.
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
