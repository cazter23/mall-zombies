// =============================================================================
// GALLERIA FM: the mall's radio station, heard through the mall's speakers (map.ambience entries of kind 'music').
// The songs are in config/radioTracks.js (original compositions, written as data); audio/mallMusic.js renders them;
// audio/sound.js plays them in a shuffled rotation (every song once before any repeats), crossfading from one to the
// next, and only ever holds the song playing and the one after it. Every song opens with the station chime.
// =============================================================================

export const radio = {
  station: 'Galleria FM',
  sampleRate: 16000, // (the speakers' low-pass sits under 4 kHz, so this loses nothing you can hear and halves the memory)
  peak: 0.78, // every song is mastered to this peak
  tailSeconds: 3, // the last chord rings this long after the final bar
  endFadeSeconds: 1.2,
  crossfadeSeconds: 4, // the next song (its chime first) fades in this long before the current one ends
  humanize: { seconds: 0.006, velocity: 0.08 }, // a little looseness in timing and touch, from the song's seed

  // The station ident at the top of every song: three bell notes, [seconds, note, held seconds].
  chime: {
    seconds: 2.4,
    notes: [[0, 'G5', 0.4], [0.28, 'E5', 0.4], [0.56, 'C6', 1.2]],
    voice: { synth: 'bell', gain: 0.32, pan: 0, decay: 1.6 },
  },

  // Chords are voiced close, from `base` up; bass parts take the bass note from `bassLow` up.
  voicing: { base: 55, bassLow: 36 },

  // Each synth's defaults (a song's part overrides any of them). Times in seconds.
  synths: {
    piano: { attack: 0.008, release: 0.18, decay: 1.65, overtone: 0.23, overtoneDecay: 4, bell: 0.07, bellDecay: 0.35 },
    epiano: { attack: 0.004, release: 0.25, decay: 1.4, index: 1.6, indexDecay: 3.5, ratio: 1, tine: 0.12 },
    marimba: { attack: 0.002, release: 0.05, decay: 4.5, ring: 0.6 },
    bell: { attack: 0.002, release: 0.05, decay: 2.2, ring: 1.2 },
    wind: { attack: 0.05, release: 0.12, harmonics: 3, brightness: 0.25, vibrato: 0.006, vibratoHz: 5, vibratoDelay: 0.18, breath: 0.08, droop: 0 },
    clav: { attack: 0.003, release: 0.04, decay: 7 },
    bass: { attack: 0.018, release: 0.12, decay: 1.5, overtone: 0.18, overtoneDecay: 4, bite: 0 },
    pluck: { release: 0.15, damping: 0.996, brightness: 0.55, ring: 0.5 },
    pad: { attack: 0.55, release: 0.65, detune: 0.0015, detunedGain: 0.3, shimmer: 0 },
  },

  // The drum kit (a song's `drumKit` overrides). Gains are per hit, seconds is how long each hit is drawn.
  drumKit: {
    gain: { kick: 0.07, snare: 0.05, clap: 0.035, hat: 0.014, openhat: 0.012, shaker: 0.012, rim: 0.03, brush: 0.024, tom: 0.05 },
    pan: { hat: -0.25, openhat: -0.25, shaker: 0.3, rim: 0.15, brush: 0.2, clap: 0.05 },
    seconds: { kick: 0.25, snare: 0.3, clap: 0.25, hat: 0.07, openhat: 0.35, shaker: 0.12, rim: 0.08, brush: 0.18, tom: 0.4 },
    kickHigh: 110, kickLow: 48, kickDecay: 22, snareDecay: 18, snareGate: 1, hatDecay: 70,
  },

  // Later rounds: the radio sounds like a worn tape (pitch sags, a slow wobble), with the horror layer and its setting.
  tapeWear: { fromRound: 14, fullRound: 30, detuneCents: -45, wobbleCents: 14, wobbleHz: 0.45 },

  // The "now playing" card (ui/radioTicker.js) when a song starts where you can hear it.
  ticker: { seconds: 5.5, label: 'Now playing' },
};
