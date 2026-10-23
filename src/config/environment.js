// Cosmetic-only atmosphere. Never read by combat, navigation or purchase logic.
export const atmosphere = {
  hemisphere: { sky: 0x9bb8d4, ground: 0x524658, intensity: 0.52 },
  sun: { color: 0xdceeff, intensity: 0.28 },
  roomLights: {
    hallway: { color: 0xcce6ff, intensity: 22, distance: 22 },
    foodCourt: { color: 0xffc988, intensity: 24, distance: 20 },
    serviceCorridor: { color: 0x8fd8e8, intensity: 10, distance: 11 },
    storeAccent: { intensity: 10, distance: 9 },
  },
  surfaces: {
    metal: { roughness: 0.28, metalness: 0.68 },
    plastic: { roughness: 0.32, metalness: 0.04 },
    wood: { roughness: 0.46, metalness: 0.02 },
    glass: { roughness: 0.08, metalness: 0.35 },
    cardboard: { roughness: 0.95, metalness: 0 },
    tile: { roughness: 0.36, metalness: 0.08, bumpScale: 0.016 },
  },
  ceiling: { spacing: 2, seamWidth: 0.018, ventSpacing: 8 },
  motion: { signRadians: 0.012, signPeriod: 9, tubePeriod: 7, tubeMin: 0.72 },
  contact: { maxZombies: 64, opacity: 0.28, radius: 0.48, depthRatio: 0.825, lift: 0.007, fadeHeight: 1.3,
    floorTolerance: 0.08,
    fixtureOpacity: 0.22, fixturePadding: 0.16 },
  ambience: {
    maxVoices: 3, occludedGain: 0.2, fadeSeconds: 0.16,
    listenerHeightFraction: 0.8, occlusionMargin: 0.1,
    rattleMinSeconds: 24, rattleMaxSeconds: 46, rattleRange: 20,
    musicNotes: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 392], noteSeconds: 0.65,
    voices: {
      ventilation: { noise: true, frequency: 180, gain: 0.045 },
      refrigerator: { noise: false, frequency: 60, gain: 0.035 },
      music: { noise: false, frequency: 261.63, gain: 0.018 },
    },
  },
};

export const startRoomLighting = [
  { name: 'checkout_warm', color: 0xffbe73, intensity: 15, distance: 10, x: -2.9, y: 2.5, z: 7.2 },
  { name: 'shutter_cool', color: 0x99ccff, intensity: 12, distance: 9, x: 1, y: 2.7, z: 1.8 },
];

// Replaces the Mart's two existing lamps; no additional lights, shadows or flashing.
export const megaMartLighting = [
  { name: 'mart_checkout_light', color: 0xffe4b8, intensity: 16, distance: 18, x: 27.5, y: 3, z: 0 },
  { name: 'mart_aisle_light', color: 0xc8e4ff, intensity: 16, distance: 20, x: 27.5, y: 3, z: -15 },
];
