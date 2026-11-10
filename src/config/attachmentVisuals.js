// Each weapon has its own front-segment length and attachment sizes, in tool-local units.
export const attachmentVisuals = {
  shortFactor: .55,
  profiles: {
    stapleGun: { laserX: -0.036, span: .035, optic: 1.25, laser: 1.3, pack: 1.35 },
    priceGun: { laserX: -0.034, span: .045, optic: 1.25, laser: 1.3, pack: 1.4 },
    nailGun: { opticX: -.055, laserX: -0.039, span: .035, optic: 1.3, laser: 1.3, pack: 1.35 },
    foamDartBlaster: { laserX: -0.05, span: .07, optic: 1.45, laser: 1.4, pack: 1.4 },
    returnToSender: { laserX: -0.05, span: .12, optic: 1.3, laser: 1.3, pack: 1.4 },
    tennisBallLauncher: { laserX: -0.05, span: .2, optic: 1.3, laser: 1.3, pack: 1.4 },
    leafBlower: { laserX: -0.05, span: .2, optic: 1.3, laser: 1.3, pack: 1.4 },
    confettiCannon: { laserX: -0.094, span: .13, optic: 1.4, laser: 1.45, pack: 1.45 },
    rivetRifle: { laserX: -0.045, span: .16, optic: 1.45, laser: 1.4, pack: 1.45, held: 'heldRivetMagazine' },
    coilNailer: { opticX: -.065, laserX: -0.048, span: .04, optic: 1.35, laser: 1.35, pack: 1.4, held: 'heldCoilDrum' },
    barcodeScanner: { laserX: -0.043, span: .035, optic: 1.3, laser: 1.3, pack: 1.4, held: 'heldScannerBattery' },
  },
};
