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
// Weapons refer to sounds by name (config/weapons.js -> sounds, reload events).
// =============================================================================

export const audio = {
  masterVolume: 0.55,
  pitchVariation: 0.05, // each play is randomly up to this fraction higher/lower, so repeats don't sound robotic
  compressor: { thresholdDb: -14, ratio: 4 }, // on the master bus, so rapid fire doesn't clip

  sounds: {
    // Staple gun shot: a sharp metal snap, a chunky low thump and a tiny spring click.
    stapleShot: {
      volume: 0.9,
      layers: [
        { type: 'noise', filter: 'bandpass', freq: 3400, q: 1.1, gain: 0.8, attack: 0.001, decay: 0.045 },
        { type: 'tone', wave: 'sine', freq: 190, freqEnd: 55, gain: 1.0, attack: 0.001, decay: 0.1 },
        { type: 'noise', filter: 'lowpass', freq: 1100, q: 0.7, gain: 0.55, attack: 0.001, decay: 0.08 },
        { type: 'tone', wave: 'square', freq: 2300, freqEnd: 1500, gain: 0.12, attack: 0.0005, decay: 0.02, delay: 0.004 },
      ],
    },

    // Trigger squeezed on an empty gun: a thin little click.
    dryClick: {
      volume: 0.6,
      layers: [
        { type: 'noise', filter: 'highpass', freq: 4000, q: 0.7, gain: 0.6, attack: 0.0005, decay: 0.018 },
        { type: 'tone', wave: 'square', freq: 1600, freqEnd: 1200, gain: 0.08, attack: 0.0005, decay: 0.015 },
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

    // Reload: pusher rod pulled back (metal slide)...
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
