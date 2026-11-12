// Model colour keys use shared skin roles. Defaults here were literals in the models.
// ammo covers paper, darts, shells and balls. emitter separates beam sources from aiming sights.
// screen is the returns display. glass is the transparent hopper tint.
export const gunPaletteKeys = {
  returnToSender: {
    screenColor: 'screen', batteryColor: 'accent', emitterColor: 'emitter',
    stripeRedColor: 'accent', stripeOrangeColor: 'accent', stripeYellowColor: 'accent',
    stripeGreenColor: 'accent', stripeBlueColor: 'accent', stripePurpleColor: 'accent',
  },
  tennisBallLauncher: { ballColor: 'ammo', glassColor: 'glass' },
  stargazer: { lensColor: 'glass', starColor: 'accent' },
  bottleRocket: { rocketColor: 'ammo', noseColor: 'sight', wickColor: 'grip' },
  leafBlower: { tankColor: 'body' },
  barcodeScanner: { coilColor: 'accent', windowColor: 'emitter' },
  coilNailer: { drumColor: 'dark', coilColor: 'accent' },
  confettiCannon: { shellColor: 'ammo' },
  foamDartBlaster: { muzzleColor: 'accent', dartColor: 'ammo' },
  nailGun: { bodyShadeColor: 'dark', brassColor: 'accent' },
  priceGun: { bodyShadeColor: 'dark', saleColor: 'accent', labelColor: 'ammo' },
};

export const gunPaletteDefaults = {
  returnToSender: {
    stripeRedColor: 0xff4d4d, stripeOrangeColor: 0xffa733, stripeYellowColor: 0xffe14a,
    stripeGreenColor: 0x59d36c, stripeBlueColor: 0x4aa8ff, stripePurpleColor: 0xa06bff,
  },
  tennisBallLauncher: { glassColor: 0xcfe9f5 },
  confettiCannon: { shellColor: 0xffd166 },
  nailGun: { bodyShadeColor: 0xc89918, brassColor: 0xd4a437 },
  priceGun: { bodyShadeColor: 0xd95f0e, saleColor: 0xd62839 },
};
