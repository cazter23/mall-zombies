// Cosmetic-only atmosphere. Never read by combat, navigation or purchase logic.
export const atmosphere = {
  hemisphere: { sky: 0xe8eff7, ground: 0xb6a996, intensity: 1.25 },
  sun: { color: 0xfff5e7, intensity: 0.75 },
  roomLights: {
    hallway: { color: 0xd5e6ff, intensity: 12, distance: 18 },
    foodCourt: { color: 0xffd5a0, intensity: 14, distance: 16 },
    serviceCorridor: { color: 0xc6e4ec, intensity: 5, distance: 9 },
  },
  surfaces: {
    metal: { roughness: 0.43, metalness: 0.45 },
    plastic: { roughness: 0.6, metalness: 0 },
    cardboard: { roughness: 0.98, metalness: 0 },
    tile: { roughness: 0.72, metalness: 0.03 },
  },
  ceiling: { spacing: 2, seamWidth: 0.018, ventSpacing: 8 },
  motion: { signRadians: 0.012, signPeriod: 9, tubePeriod: 7, tubeMin: 0.72 },
  contact: { maxZombies: 64, opacity: 0.25, radius: 0.48, depthRatio: 0.825, lift: 0.007, fadeHeight: 1.3,
    floorTolerance: 0.08,
    fixtureOpacity: 0.18, fixturePadding: 0.16 },
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
  { name: 'checkout_warm', color: 0xffce8c, intensity: 9, distance: 8, x: -2.9, y: 2.5, z: 7.2 },
  { name: 'shutter_cool', color: 0xbddcff, intensity: 7, distance: 7, x: 1, y: 2.7, z: 1.8 },
];

// Replaces the Mart's two existing lamps; no additional lights, shadows or flashing.
export const megaMartLighting = [
  { name: 'mart_checkout_light', color: 0xffead0, intensity: 8, distance: 15, x: 27.5, y: 3, z: 0 },
  { name: 'mart_aisle_light', color: 0xdcecff, intensity: 8, distance: 18, x: 27.5, y: 3, z: -15 },
];
