// Model colour keys use shared skin roles. Defaults here were literals in the models.
export const gunPaletteKeys = {
  coilNailer: { drumColor: 'dark', coilColor: 'accent' },
  confettiCannon: { shellColor: 'ammo' },
  foamDartBlaster: { muzzleColor: 'accent', dartColor: 'ammo' },
  nailGun: { bodyShadeColor: 'dark', brassColor: 'accent' },
  priceGun: { bodyShadeColor: 'dark', saleColor: 'accent', labelColor: 'ammo' },
};

export const gunPaletteDefaults = {
  confettiCannon: { shellColor: 0xffd166 },
  nailGun: { bodyShadeColor: 0xc89918, brassColor: 0xd4a437 },
  priceGun: { bodyShadeColor: 0xd95f0e, saleColor: 0xd62839 },
};
