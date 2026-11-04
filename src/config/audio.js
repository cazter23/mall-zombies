// =============================================================================
// AUDIO CONFIG
// Volumes and sound recipes. Every sound is synthesized in code from a few
// layers (no audio files), the same way textures are drawn on a canvas. A layer is
// either a burst of filtered noise (snaps, clacks, hiss) or a tone (thumps, clicks)
// with a quick attack and an exponential fade:
//
//   noise: { type: 'noise', filter: 'bandpass' | 'lowpass' | 'highpass', freq, q, gain, attack, decay, delay }
//   tone:  { type: 'tone', wave: 'sine' | 'square' | 'triangle' | 'sawtooth', freq, freqEnd, gain, attack, decay, delay }
//
// freq/freqEnd in Hz (a tone sweeps from freq to freqEnd), times in seconds, gain 0..1.
// Weapons refer to sounds by name (config/weapons.js -> sounds, reload events); so do zombie types
// (config/zombies.js -> sounds) and the PA chime.
// =============================================================================

export const audio = {
  masterVolume: 0.55,
  ambienceVolume: 0.65,
  musicVolume: 0.45,
  pitchVariation: 0.05, // each play is randomly up to this fraction higher/lower, so repeats don't sound robotic
  // Fast peak control leaves the body of each shot intact while catching the initial transient at full volume.
  compressor: { thresholdDb: -10, ratio: 8, attack: 0, release: 0.08, kneeDb: 6 },

  sounds: {
    // Sparse back-room sounds, spatially mixed and occluded by their closed storefronts.
    backroomPhone: { volume: .25, layers: [
      { type: 'tone', wave: 'triangle', freq: 980, freqEnd: 960, gain: .22, attack: .01, decay: .22 },
      { type: 'tone', wave: 'sine', freq: 1240, freqEnd: 1200, gain: .12, attack: .01, decay: .2, delay: .09 },
      { type: 'tone', wave: 'triangle', freq: 980, freqEnd: 960, gain: .22, attack: .01, decay: .22, delay: .5 },
    ] },
    distantSteps: { volume: .35, layers: [0, .64, 1.39].map(delay =>
      ({ type: 'noise', filter: 'lowpass', freq: 650, q: .8, gain: .45, attack: .008, decay: .14, delay })) },
    unseenCart: { volume: .25, layers: [
      { type: 'noise', filter: 'bandpass', freq: 570, q: 1.8, gain: .22, attack: .25, decay: 1.2 },
      { type: 'tone', wave: 'sine', freq: 730, freqEnd: 560, gain: .06, attack: .2, decay: .7, delay: .3 },
    ] },
    looseSignRattle: { volume: .18, layers: [
      { type: 'tone', wave: 'triangle', freq: 460, freqEnd: 330, gain: .22, attack: .002, decay: .18 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 2, gain: .24, attack: .002, decay: .11, delay: .13 },
      { type: 'tone', wave: 'sine', freq: 620, freqEnd: 430, gain: .12, attack: .003, decay: .28, delay: .3 },
    ] },
    // Speech-shaped, low-passed PA chatter; deliberately indistinct through the exit.
    distantPa: { volume: .16, layers: [
      { type: 'tone', wave: 'sine', freq: 490, freqEnd: 410, gain: .18, attack: .03, decay: .22 },
      { type: 'tone', wave: 'sine', freq: 650, freqEnd: 500, gain: .13, attack: .03, decay: .28, delay: .18 },
      ...[.65, .9, 1.14, 1.54, 1.83, 2.14, 2.65, 2.88].map((delay, i) => ({
        type: 'noise', filter: 'bandpass', freq: 430 + i % 3 * 130, q: 2.5,
        gain: .13, attack: .035, decay: .16 + i % 2 * .08, delay,
      })),
    ] },
    distantTrafficPass: { volume: .14, layers: [
      { type: 'noise', filter: 'lowpass', freq: 500, gain: .3, attack: 1.5, decay: 3.5 },
      { type: 'tone', wave: 'sine', freq: 96, freqEnd: 66, gain: .12, attack: 1, decay: 3, delay: .4 },
    ] },
    rivetShot: { volume: 0.72, layers: [
      { type: 'tone', wave: 'sine', freq: 150, freqEnd: 58, gain: 0.85, attack: 0.001, decay: 0.105 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 0.9, gain: 0.7, attack: 0.001, decay: 0.035 },
      { type: 'noise', filter: 'lowpass', freq: 800, q: 0.7, gain: 0.55, attack: 0.002, decay: 0.07 },
      { type: 'tone', wave: 'triangle', freq: 740, freqEnd: 430, gain: 0.18, attack: 0.001, decay: 0.045, delay: 0.025 },
    ] },
    rivetReloadOut: { volume: 0.5, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1500, q: 1.2, gain: 0.65, attack: 0.001, decay: 0.065 },
      { type: 'tone', wave: 'triangle', freq: 280, freqEnd: 160, gain: 0.3, attack: 0.001, decay: 0.07 },
    ] },
    rivetReloadIn: { volume: 0.65, layers: [
      { type: 'noise', filter: 'lowpass', freq: 1000, q: 0.8, gain: 0.8, attack: 0.001, decay: 0.095 },
      { type: 'tone', wave: 'sine', freq: 180, freqEnd: 70, gain: 0.6, attack: 0.001, decay: 0.09 },
    ] },
    rivetReloadReady: { volume: 0.5, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2300, q: 1, gain: 0.55, attack: 0.001, decay: 0.05 },
      { type: 'tone', wave: 'triangle', freq: 520, freqEnd: 250, gain: 0.25, attack: 0.001, decay: 0.06, delay: 0.025 },
    ] },
    // Heavy Coil Nailer: rapid industrial piston thump + wire-collated steel clack + pneumatic hiss.
    coilShot: { volume: 0.78, layers: [
      { type: 'tone', wave: 'sine', freq: 135, freqEnd: 52, gain: 0.88, attack: 0.001, decay: 0.085 },
      { type: 'tone', wave: 'triangle', freq: 245, freqEnd: 95, gain: 0.65, attack: 0.001, decay: 0.07 },
      { type: 'noise', filter: 'bandpass', freq: 1650, q: 0.85, gain: 0.72, attack: 0.0008, decay: 0.032 },
      { type: 'noise', filter: 'lowpass', freq: 720, q: 0.7, gain: 0.55, attack: 0.001, decay: 0.06 },
      { type: 'tone', wave: 'triangle', freq: 860, freqEnd: 580, gain: 0.16, attack: 0.001, decay: 0.03, delay: 0.012 },
    ] },
    coilReloadOut: { volume: 0.58, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1450, q: 1.3, gain: 0.65, attack: 0.001, decay: 0.075 },
      { type: 'tone', wave: 'triangle', freq: 310, freqEnd: 130, gain: 0.4, attack: 0.001, decay: 0.085 },
    ] },
    coilReloadIn: { volume: 0.72, layers: [
      { type: 'noise', filter: 'lowpass', freq: 950, q: 0.8, gain: 0.85, attack: 0.001, decay: 0.11 },
      { type: 'tone', wave: 'sine', freq: 165, freqEnd: 58, gain: 0.68, attack: 0.001, decay: 0.1 },
      { type: 'noise', filter: 'bandpass', freq: 2600, q: 1.5, gain: 0.38, attack: 0.001, decay: 0.035, delay: 0.02 },
    ] },
    coilReloadReady: { volume: 0.62, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2950, q: 1.3, gain: 0.65, attack: 0.001, decay: 0.04 },
      { type: 'tone', wave: 'sine', freq: 240, freqEnd: 95, gain: 0.35, attack: 0.001, decay: 0.055, delay: 0.018 },
    ] },
    // Barcode Scanner: rising capacitor whine, retail checkout laser beep + high-voltage crackle discharge.
    scannerCharge: { volume: 0.48, layers: [
      { type: 'tone', wave: 'sine', freq: 520, freqEnd: 1760, gain: 0.42, attack: 0.015, decay: 0.38 },
      { type: 'tone', wave: 'triangle', freq: 1040, freqEnd: 2640, gain: 0.18, attack: 0.02, decay: 0.36 },
    ] },
    scannerShot: { volume: 0.86, layers: [
      { type: 'tone', wave: 'square', freq: 2150, freqEnd: 2150, gain: 0.34, attack: 0.0005, decay: 0.042 },
      { type: 'tone', wave: 'sine', freq: 185, freqEnd: 46, gain: 0.92, attack: 0.001, decay: 0.14 },
      { type: 'tone', wave: 'sawtooth', freq: 980, freqEnd: 220, gain: 0.48, attack: 0.001, decay: 0.09 },
      { type: 'noise', filter: 'bandpass', freq: 2800, q: 1.1, gain: 0.68, attack: 0.0006, decay: 0.04 },
      { type: 'noise', filter: 'highpass', freq: 3800, q: 0.8, gain: 0.25, attack: 0.002, decay: 0.075, delay: 0.015 },
    ] },
    scannerReloadOut: { volume: 0.52, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2200, q: 1.5, gain: 0.52, attack: 0.001, decay: 0.045 },
      { type: 'tone', wave: 'sine', freq: 780, freqEnd: 320, gain: 0.32, attack: 0.001, decay: 0.06 },
    ] },
    scannerReloadIn: { volume: 0.62, layers: [
      { type: 'noise', filter: 'lowpass', freq: 1150, q: 0.85, gain: 0.68, attack: 0.001, decay: 0.065 },
      { type: 'tone', wave: 'triangle', freq: 440, freqEnd: 880, gain: 0.3, attack: 0.002, decay: 0.07, delay: 0.015 },
    ] },
    scannerReloadReady: { volume: 0.58, layers: [
      { type: 'tone', wave: 'sine', freq: 1320, freqEnd: 1760, gain: 0.36, attack: 0.001, decay: 0.055 },
      { type: 'tone', wave: 'triangle', freq: 2150, freqEnd: 2150, gain: 0.24, attack: 0.001, decay: 0.045, delay: 0.045 },
    ] },
    // Three distinct employee incentives, all routed through the existing master-volume bus.
    incentiveRestock: { volume: 0.55, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1200, q: 1, gain: 0.35, attack: 0.002, decay: 0.08 },
      { type: 'tone', wave: 'triangle', freq: 440, freqEnd: 440, gain: 0.3, attack: 0.005, decay: 0.13 },
      { type: 'tone', wave: 'triangle', freq: 660, freqEnd: 660, gain: 0.3, attack: 0.005, decay: 0.2, delay: 0.12 },
    ] },
    incentiveBlueLight: { volume: 0.5, layers: [
      { type: 'tone', wave: 'sine', freq: 660, freqEnd: 880, gain: 0.4, attack: 0.008, decay: 0.18 },
      { type: 'tone', wave: 'sine', freq: 880, freqEnd: 1320, gain: 0.3, attack: 0.008, decay: 0.3, delay: 0.14 },
    ] },
    incentiveSecurity: { volume: 0.6, layers: [
      { type: 'tone', wave: 'triangle', freq: 620, freqEnd: 380, gain: 0.4, attack: 0.01, decay: 0.23 },
      { type: 'tone', wave: 'triangle', freq: 620, freqEnd: 380, gain: 0.35, attack: 0.01, decay: 0.23, delay: 0.25 },
      { type: 'tone', wave: 'sine', freq: 100, freqEnd: 45, gain: 0.4, attack: 0.005, decay: 0.2 },
    ] },
    shutterRattle: { volume: 0.12, layers: [
      { type: 'noise', filter: 'bandpass', freq: 650, q: 2, gain: 0.3, attack: 0.04, decay: 0.45 },
      { type: 'tone', wave: 'triangle', freq: 170, freqEnd: 95, gain: 0.12, attack: 0.03, decay: 0.35, delay: 0.12 },
    ] },
    shutterMotor: { volume: 0.32, layers: [
      { type: 'tone', wave: 'triangle', freq: 105, freqEnd: 145, gain: 0.28, attack: 0.018, decay: 0.15 },
      { type: 'noise', filter: 'lowpass', freq: 850, gain: 0.16, attack: 0.006, decay: 0.09 },
    ] },
    shutterRoll: { volume: 0.2, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1100, q: 1.2, gain: 0.3, attack: 0.004, decay: 0.075 },
      { type: 'tone', wave: 'triangle', freq: 205, freqEnd: 170, gain: 0.1, attack: 0.003, decay: 0.06 },
    ] },
    shutterStop: { volume: 0.34, layers: [
      { type: 'tone', wave: 'sine', freq: 95, freqEnd: 43, gain: 0.48, attack: 0.002, decay: 0.13 },
      { type: 'noise', filter: 'lowpass', freq: 1200, gain: 0.34, attack: 0.001, decay: 0.06 },
      { type: 'tone', wave: 'triangle', freq: 360, freqEnd: 190, gain: 0.1, attack: 0.002, decay: 0.07 },
    ] },
    // Chunky compressed-air darts: mid-bass body + sub-bass tube thump stays punchy on headphones and speakers.
    foamShot: { volume: 0.56, layers: [
      { type: 'tone', wave: 'sine', freq: 115, freqEnd: 54, gain: 0.55, attack: 0.001, decay: 0.065 },
      { type: 'noise', filter: 'bandpass', freq: 1000, q: 0.8, gain: 0.72, attack: 0.001, decay: 0.035 },
      { type: 'tone', wave: 'triangle', freq: 235, freqEnd: 130, gain: 0.6, attack: 0.001, decay: 0.05 },
      { type: 'tone', wave: 'sine', freq: 140, freqEnd: 90, gain: 0.48, attack: 0.002, decay: 0.06 },
      { type: 'noise', filter: 'bandpass', freq: 2700, q: 1, gain: 0.22, attack: 0.0008, decay: 0.011 },
      { type: 'tone', wave: 'triangle', freq: 620, freqEnd: 390, gain: 0.11, attack: 0.001, decay: 0.018, delay: 0.02 },
    ] },
    foamReloadOut: { volume: 0.45, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2100, q: 1.4, gain: 0.5, attack: 0.001, decay: 0.04 },
      { type: 'tone', wave: 'triangle', freq: 650, freqEnd: 260, gain: 0.3, attack: 0.001, decay: 0.05 },
    ] },
    foamReloadIn: { volume: 0.6, layers: [
      { type: 'noise', filter: 'lowpass', freq: 1200, q: 0.8, gain: 0.7, attack: 0.001, decay: 0.07 },
      { type: 'noise', filter: 'bandpass', freq: 2800, q: 1.5, gain: 0.4, attack: 0.001, decay: 0.025, delay: 0.015 },
    ] },
    foamReloadReady: { volume: 0.5, layers: [
      { type: 'noise', filter: 'bandpass', freq: 3400, q: 1.5, gain: 0.6, attack: 0.001, decay: 0.035 },
      { type: 'tone', wave: 'triangle', freq: 400, freqEnd: 170, gain: 0.25, attack: 0.001, decay: 0.04, delay: 0.02 },
    ] },

    // Deep chest-thumping pressure boom + opening crack, then a crisp paper flutter.
    confettiShot: { volume: 0.98, layers: [
      { type: 'tone', wave: 'sine', freq: 110, freqEnd: 38, gain: 1.15, attack: 0.001, decay: 0.25 },
      { type: 'tone', wave: 'sine', freq: 175, freqEnd: 55, gain: 1.15, attack: 0.002, decay: 0.22 },
      { type: 'noise', filter: 'lowpass', freq: 1200, q: 0.75, gain: 1.05, attack: 0.001, decay: 0.11 },
      { type: 'noise', filter: 'bandpass', freq: 2800, q: 0.8, gain: 0.56, attack: 0.0008, decay: 0.032 },
      { type: 'tone', wave: 'triangle', freq: 320, freqEnd: 115, gain: 0.38, attack: 0.002, decay: 0.085 },
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 0.8, gain: 0.2, attack: 0.008, decay: 0.16, delay: 0.055 },
      { type: 'noise', filter: 'highpass', freq: 3500, q: 0.7, gain: 0.15, attack: 0.012, decay: 0.18, delay: 0.065 },
    ] },
    confettiReloadOut: { volume: 0.6, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1900, q: 1.5, gain: 0.7, attack: 0.001, decay: 0.06 },
      { type: 'tone', wave: 'triangle', freq: 300, freqEnd: 140, gain: 0.4, attack: 0.001, decay: 0.08 },
    ] },
    // One shell; the reload timeline plays it twice, at each insertion.
    confettiReloadIn: { volume: 0.55, layers: [
      { type: 'noise', filter: 'bandpass', freq: 2500, q: 1.8, gain: 0.6, attack: 0.002, decay: 0.055 },
      { type: 'tone', wave: 'sine', freq: 350, freqEnd: 170, gain: 0.3, attack: 0.001, decay: 0.06 },
    ] },
    confettiReloadReady: { volume: 0.8, layers: [
      { type: 'noise', filter: 'bandpass', freq: 3200, q: 1.3, gain: 0.8, attack: 0.001, decay: 0.045 },
      { type: 'tone', wave: 'sine', freq: 200, freqEnd: 65, gain: 0.5, attack: 0.001, decay: 0.1 },
    ] },

    // Metal snap + heavy sub-bass tool-body clunk, with a tiny spring ring after the strike.
    stapleShot: {
      volume: 0.92,
      layers: [
        { type: 'tone', wave: 'sine', freq: 135, freqEnd: 56, gain: 0.75, attack: 0.001, decay: 0.095 },
        { type: 'noise', filter: 'bandpass', freq: 2500, q: 0.8, gain: 0.72, attack: 0.0008, decay: 0.025 },
        { type: 'tone', wave: 'sine', freq: 230, freqEnd: 105, gain: 1.25, attack: 0.001, decay: 0.12 },
        { type: 'noise', filter: 'lowpass', freq: 1100, q: 0.7, gain: 0.64, attack: 0.001, decay: 0.07 },
        { type: 'tone', wave: 'triangle', freq: 320, freqEnd: 175, gain: 0.44, attack: 0.001, decay: 0.055 },
        { type: 'tone', wave: 'triangle', freq: 1800, freqEnd: 1500, gain: 0.08, attack: 0.001, decay: 0.038, delay: 0.013 },
      ],
    },

    // Fast label punch: tight low-end body beneath the click, short enough to stay crisp at 12 shots/second.
    priceShot: {
      volume: 0.58,
      layers: [
        { type: 'tone', wave: 'sine', freq: 130, freqEnd: 62, gain: 0.5, attack: 0.0008, decay: 0.048 },
        { type: 'noise', filter: 'bandpass', freq: 1700, q: 0.9, gain: 0.64, attack: 0.0008, decay: 0.022 },
        { type: 'tone', wave: 'sine', freq: 200, freqEnd: 115, gain: 0.68, attack: 0.001, decay: 0.055 },
        { type: 'noise', filter: 'lowpass', freq: 900, q: 0.7, gain: 0.5, attack: 0.001, decay: 0.036 },
        { type: 'tone', wave: 'triangle', freq: 580, freqEnd: 320, gain: 0.14, attack: 0.001, decay: 0.016, delay: 0.012 },
        { type: 'noise', filter: 'highpass', freq: 4500, q: 0.7, gain: 0.08, attack: 0.0005, decay: 0.008, delay: 0.004 },
      ],
    },

    // Heavy pneumatic driver: deep sub-bass piston slam, broad crack, and a short steel ring/air release.
    nailShot: {
      volume: 0.94,
      layers: [
        { type: 'tone', wave: 'sine', freq: 115, freqEnd: 46, gain: 0.95, attack: 0.001, decay: 0.15 },
        { type: 'tone', wave: 'sine', freq: 210, freqEnd: 80, gain: 1.08, attack: 0.001, decay: 0.14 },
        { type: 'noise', filter: 'bandpass', freq: 1500, q: 0.8, gain: 0.92, attack: 0.0008, decay: 0.045 },
        { type: 'noise', filter: 'lowpass', freq: 650, q: 0.7, gain: 0.66, attack: 0.001, decay: 0.095 },
        { type: 'tone', wave: 'triangle', freq: 740, freqEnd: 680, gain: 0.2, attack: 0.001, decay: 0.065, delay: 0.01 },
        { type: 'noise', filter: 'bandpass', freq: 3100, q: 0.9, gain: 0.18, attack: 0.006, decay: 0.08, delay: 0.035 },
      ],
    },

    // Meaty body impact: wet low-mid thud + slap when a shot connects with a zombie.
    hitBody: {
      volume: 0.52,
      layers: [
        { type: 'tone', wave: 'sine', freq: 155, freqEnd: 62, gain: 0.65, attack: 0.001, decay: 0.065 },
        { type: 'noise', filter: 'lowpass', freq: 780, q: 0.9, gain: 0.55, attack: 0.001, decay: 0.045 },
        { type: 'noise', filter: 'bandpass', freq: 1650, q: 1.2, gain: 0.35, attack: 0.0008, decay: 0.025 },
      ],
    },

    // Crunchy headshot impact: wet skull-crack + bright arcade confirmation ping.
    hitHead: {
      volume: 0.7,
      layers: [
        { type: 'tone', wave: 'sine', freq: 175, freqEnd: 68, gain: 0.7, attack: 0.001, decay: 0.07 },
        { type: 'noise', filter: 'bandpass', freq: 2850, q: 1.4, gain: 0.68, attack: 0.0006, decay: 0.032 },
        { type: 'noise', filter: 'lowpass', freq: 950, q: 0.85, gain: 0.55, attack: 0.001, decay: 0.05 },
        { type: 'tone', wave: 'triangle', freq: 1380, freqEnd: 1960, gain: 0.24, attack: 0.001, decay: 0.065, delay: 0.008 },
      ],
    },

    // Lethal blow confirmation: deep splatter pop + punchy low drop when a target goes down.
    killConfirm: {
      volume: 0.68,
      layers: [
        { type: 'tone', wave: 'sine', freq: 190, freqEnd: 48, gain: 0.78, attack: 0.001, decay: 0.11 },
        { type: 'noise', filter: 'bandpass', freq: 2150, q: 1.1, gain: 0.52, attack: 0.001, decay: 0.048, delay: 0.006 },
        { type: 'tone', wave: 'triangle', freq: 920, freqEnd: 560, gain: 0.2, attack: 0.001, decay: 0.075, delay: 0.012 },
      ],
    },

    // Box cutter slash: metallic blade snick + sharp air whoosh.
    meleeSwing: {
      volume: 0.55,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3800, q: 2.2, gain: 0.38, attack: 0.001, decay: 0.03 },
        { type: 'noise', filter: 'bandpass', freq: 1250, q: 1.1, gain: 0.52, attack: 0.018, decay: 0.095, delay: 0.02 },
        { type: 'tone', wave: 'triangle', freq: 520, freqEnd: 210, gain: 0.22, attack: 0.01, decay: 0.08, delay: 0.025 },
      ],
    },

    // Mall Walker: a sneaker squeak on the shiny mall floor (quiet; volume also drops with distance)...
    walkerSqueak: {
      volume: 0.4,
      layers: [
        { type: 'tone', wave: 'sine', freq: 1700, freqEnd: 2600, gain: 0.5, attack: 0.006, decay: 0.07 },
        { type: 'tone', wave: 'triangle', freq: 3300, freqEnd: 4300, gain: 0.12, attack: 0.006, decay: 0.05 },
        { type: 'noise', filter: 'highpass', freq: 5000, q: 0.7, gain: 0.08, attack: 0.002, decay: 0.03 },
      ],
    },
    // ...a breathy "hff" every couple of steps...
    walkerHuff: {
      volume: 0.5,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 950, q: 0.8, gain: 0.55, attack: 0.025, decay: 0.16 },
        { type: 'noise', filter: 'lowpass', freq: 500, q: 0.7, gain: 0.3, attack: 0.025, decay: 0.12 },
      ],
    },
    // ...and three quick pants when it's winded after a swing.
    walkerPant: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 1050, q: 0.8, gain: 0.55, attack: 0.015, decay: 0.12 },
        { type: 'noise', filter: 'bandpass', freq: 950, q: 0.8, gain: 0.5, attack: 0.015, decay: 0.12, delay: 0.24 },
        { type: 'noise', filter: 'bandpass', freq: 850, q: 0.8, gain: 0.45, attack: 0.015, decay: 0.14, delay: 0.48 },
      ],
    },

    // Cart Pusher: a squealing wheel while it rolls...
    mannequinClick: { volume: .45, layers: [
      { type: 'noise', filter: 'bandpass', freq: 1800, q: 3, gain: .4, attack: .002, decay: .045 },
      { type: 'tone', wave: 'sine', freq: 650, freqEnd: 310, gain: .25, attack: .002, decay: .07 },
    ] },
    mannequinStep: { volume: .3, layers: [
      { type: 'noise', filter: 'highpass', freq: 1200, gain: .25, attack: .002, decay: .035 },
      { type: 'tone', wave: 'sine', freq: 260, freqEnd: 150, gain: .35, attack: .002, decay: .055 },
    ] },
    cartSqueak: {
      volume: 0.35,
      layers: [
        { type: 'tone', wave: 'sawtooth', freq: 2300, freqEnd: 1900, gain: 0.18, attack: 0.01, decay: 0.12 },
        { type: 'tone', wave: 'sine', freq: 3100, freqEnd: 2700, gain: 0.25, attack: 0.01, decay: 0.1 },
      ],
    },
    // ...the WARNING before a charge: the wire basket rattling hard and a long rising wheel squeal...
    cartRattle: {
      volume: 0.7,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3200, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05 },
        { type: 'noise', filter: 'bandpass', freq: 2800, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05, delay: 0.09 },
        { type: 'noise', filter: 'bandpass', freq: 3400, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05, delay: 0.18 },
        { type: 'noise', filter: 'bandpass', freq: 3000, q: 2.5, gain: 0.4, attack: 0.005, decay: 0.05, delay: 0.27 },
        { type: 'noise', filter: 'bandpass', freq: 3300, q: 2.5, gain: 0.45, attack: 0.005, decay: 0.05, delay: 0.36 },
        { type: 'noise', filter: 'bandpass', freq: 2900, q: 2.5, gain: 0.45, attack: 0.005, decay: 0.05, delay: 0.45 },
        { type: 'tone', wave: 'sawtooth', freq: 1500, freqEnd: 2900, gain: 0.16, attack: 0.15, decay: 0.75 },
      ],
    },
    // ...and a metal CRASH when it misses and hits something.
    cartCrash: {
      volume: 0.8,
      layers: [
        { type: 'noise', filter: 'lowpass', freq: 900, q: 0.7, gain: 0.7, attack: 0.002, decay: 0.18 },
        { type: 'noise', filter: 'bandpass', freq: 2600, q: 1.5, gain: 0.5, attack: 0.002, decay: 0.35 },
        { type: 'tone', wave: 'square', freq: 420, freqEnd: 300, gain: 0.12, attack: 0.002, decay: 0.3 },
        { type: 'noise', filter: 'bandpass', freq: 3800, q: 3, gain: 0.25, attack: 0.002, decay: 0.08, delay: 0.14 },
      ],
    },

    // Mall PA "ding-dong" before an announcement (a new zombie type showing up).
    paChime: {
      volume: 0.55,
      layers: [
        { type: 'tone', wave: 'sine', freq: 880, gain: 0.55, attack: 0.005, decay: 0.8 },
        { type: 'tone', wave: 'triangle', freq: 1760, gain: 0.08, attack: 0.005, decay: 0.35 },
        { type: 'tone', wave: 'sine', freq: 698, gain: 0.55, attack: 0.005, decay: 1.0, delay: 0.42 },
        { type: 'tone', wave: 'triangle', freq: 1396, gain: 0.08, attack: 0.005, decay: 0.4, delay: 0.42 },
      ],
    },

    // Trigger squeezed on an empty gun: crisp metallic striker snap, hammer release, and hollow chamber ring.
    dryClick: {
      volume: 0.85,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3800, q: 2.2, gain: 0.8, attack: 0.0005, decay: 0.026 },
        { type: 'tone', wave: 'triangle', freq: 2400, freqEnd: 1500, gain: 0.35, attack: 0.0005, decay: 0.022 },
        { type: 'tone', wave: 'sine', freq: 880, freqEnd: 520, gain: 0.22, attack: 0.001, decay: 0.065, delay: 0.006 },
        { type: 'noise', filter: 'lowpass', freq: 1200, q: 1.2, gain: 0.28, attack: 0.001, decay: 0.038, delay: 0.004 },
      ],
    },

    // Bought something: a cash-register "ka-ching" (drawer clunk + two bell tones).
    purchase: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'lowpass', freq: 900, q: 0.8, gain: 0.5, attack: 0.002, decay: 0.07 },
        { type: 'tone', wave: 'triangle', freq: 1320, gain: 0.45, attack: 0.002, decay: 0.35, delay: 0.05 },
        { type: 'tone', wave: 'triangle', freq: 1760, gain: 0.4, attack: 0.002, decay: 0.45, delay: 0.11 },
        { type: 'tone', wave: 'sine', freq: 3520, gain: 0.12, attack: 0.002, decay: 0.3, delay: 0.11 },
      ],
    },
    // Not enough points: a short, flat register buzz.
    denied: {
      volume: 0.45,
      layers: [
        { type: 'tone', wave: 'square', freq: 150, freqEnd: 140, gain: 0.35, attack: 0.004, decay: 0.22 },
        { type: 'tone', wave: 'square', freq: 151, freqEnd: 141, gain: 0.25, attack: 0.004, decay: 0.22, delay: 0.005 },
      ],
    },

    // Price Gun reload: empty roll popped off...
    priceReloadOut: {
      volume: 0.5,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 1800, q: 1.5, gain: 0.5, attack: 0.002, decay: 0.05 },
        { type: 'tone', wave: 'triangle', freq: 600, freqEnd: 300, gain: 0.25, attack: 0.001, decay: 0.05 },
      ],
    },
    // ...fresh roll pressed on...
    priceReloadIn: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'lowpass', freq: 1200, q: 0.8, gain: 0.6, attack: 0.001, decay: 0.05 },
        { type: 'noise', filter: 'bandpass', freq: 2600, q: 1.5, gain: 0.35, attack: 0.0005, decay: 0.02, delay: 0.012 },
      ],
    },
    // ...and the feed snapped shut.
    priceReloadReady: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3200, q: 1.4, gain: 0.55, attack: 0.0005, decay: 0.025 },
        { type: 'tone', wave: 'sine', freq: 300, freqEnd: 150, gain: 0.25, attack: 0.001, decay: 0.04, delay: 0.03 },
      ],
    },

    // Nail Gun reload: magazine latch flipped open...
    nailReloadOut: {
      volume: 0.55,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 2200, q: 1.6, gain: 0.55, attack: 0.001, decay: 0.04 },
        { type: 'tone', wave: 'triangle', freq: 500, freqEnd: 260, gain: 0.25, attack: 0.001, decay: 0.05 },
      ],
    },
    // ...fresh nail strip slid in (a metal scrape)...
    nailReloadIn: {
      volume: 0.65,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3400, q: 3, gain: 0.45, attack: 0.02, decay: 0.08 },
        { type: 'noise', filter: 'lowpass', freq: 1000, q: 0.8, gain: 0.5, attack: 0.001, decay: 0.05, delay: 0.09 },
      ],
    },
    // ...and the spring follower snapping shut.
    nailReloadReady: {
      volume: 0.65,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3600, q: 1.4, gain: 0.6, attack: 0.0005, decay: 0.025 },
        { type: 'tone', wave: 'sine', freq: 260, freqEnd: 120, gain: 0.3, attack: 0.001, decay: 0.05, delay: 0.02 },
      ],
    },

    // Staple Gun reload: pusher rod pulled back (metal slide)...
    stapleReloadOut: {
      volume: 0.55,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 2600, q: 2, gain: 0.5, attack: 0.004, decay: 0.07 },
        { type: 'noise', filter: 'highpass', freq: 3500, q: 0.7, gain: 0.35, attack: 0.0005, decay: 0.02, delay: 0.06 },
      ],
    },
    // ...a fresh strip slapped into the channel...
    stapleReloadIn: {
      volume: 0.7,
      layers: [
        { type: 'noise', filter: 'lowpass', freq: 1400, q: 0.8, gain: 0.7, attack: 0.001, decay: 0.06 },
        { type: 'tone', wave: 'triangle', freq: 320, freqEnd: 160, gain: 0.35, attack: 0.001, decay: 0.05 },
        { type: 'noise', filter: 'bandpass', freq: 3000, q: 1.5, gain: 0.35, attack: 0.0005, decay: 0.025, delay: 0.01 },
      ],
    },
    // ...and the rod snapping shut: ready to fire.
    stapleReloadReady: {
      volume: 0.65,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3800, q: 1.4, gain: 0.6, attack: 0.0005, decay: 0.025 },
        { type: 'noise', filter: 'bandpass', freq: 2400, q: 1.4, gain: 0.55, attack: 0.0005, decay: 0.035, delay: 0.05 },
        { type: 'tone', wave: 'sine', freq: 240, freqEnd: 120, gain: 0.3, attack: 0.001, decay: 0.04, delay: 0.05 },
      ],
    },
  },
};
