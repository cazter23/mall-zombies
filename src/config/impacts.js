// Cosmetic world impacts. Distances in metres; models use local XY along the surface, +Z out.
export const impacts = {
  maxMarks: 200,
  maxPelletMarks: 2,
  offset: 0.002,
  layerStep: 0.00001, // a further 0..2mm separates overlapping marks without visible floating
  projectionSlack: 0.5, // visible surface may sit inside a simplified prop collider
  edgeProbe: 0.04,
  normalMatch: 0.98,
  signatures: {
    stapleGun: { kind: 'staple', radius: 0.028, variants: 2 },
    priceGun: { kind: 'sticker', radius: 0.072, variants: 3, rotationDegrees: 22 },
    nailGun: { kind: 'nail', radius: 0.028, variants: 2 },
    foamDartBlaster: { kind: 'dart', radius: 0.025, variants: 3 },
    confettiCannon: { kind: 'confetti', radius: 0.075, variants: 3 },
  },
};
