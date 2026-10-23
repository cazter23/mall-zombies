// Original 16-bar lounge loop: "After Closing". MIDI pitches, beats and synth timbres are data.
// Rendered once off the main thread; playback uses one looping buffer, not live note timers.
export const mallMusic = {
  title: 'After Closing', bpm: 88, beatsPerBar: 4, bars: 16, sampleRate: 22050,
  seed: 7301, peak: 0.78, gain: 0.2, lowpassHz: 1700, highpassHz: 70, seamSeconds: 0.012,
  piano: { attack: 0.008, release: 0.18, decay: 1.65, gain: 0.26, overtone: 0.23,
    bell: 0.07, bellDecay: 0.35, overtoneDecay: 4, pan: 0.18 },
  bass: { attack: 0.018, release: 0.12, decay: 1.5, gain: 0.23, overtone: 0.18, overtoneDecay: 4 },
  pad: { attack: 0.55, release: 0.65, gain: 0.018, detune: 0.0015, detunedGain: 0.3, flutterCycles: 5 },
  percussion: { hatGain: 0.014, hatSeconds: 0.065, brushGain: 0.024, brushSeconds: 0.18,
    kickGain: 0.07, kickHz: 70, kickSeconds: 0.16, hatDecay: 70, brushDecay: 25, kickDecay: 28,
    hatPan: -0.25, brushPan: 0.2 },
  delay: [{ beats: 0.75, gain: 0.16, pan: -0.6 }, { beats: 1.25, gain: 0.11, pan: 0.6 }],
  chords: [
    { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj9
    { bass: 38, notes: [53, 57, 60, 64] }, // Dm9
    { bass: 43, notes: [57, 58, 62, 65] }, // Gm9
    { bass: 36, notes: [52, 58, 62, 69] }, // C13
    { bass: 45, notes: [55, 60, 64, 67] }, // Am7
    { bass: 38, notes: [54, 60, 64, 69] }, // D9, gently turns back toward Gm
    { bass: 43, notes: [57, 58, 62, 65] },
    { bass: 36, notes: [52, 58, 62, 67] },
  ],
  // [beat within bar, MIDI pitch, duration in beats]. Space is part of the melody.
  melody: [
    [[0.5, 69, 0.6], [1.5, 72, 0.5], [2.5, 76, 1]],
    [[0.5, 74, 0.7], [2, 72, 1.3]],
    [[1, 70, 0.6], [2, 69, 0.5], [3, 67, 0.6]],
    [[0.5, 64, 1], [2.5, 67, 0.8]],
    [[0.5, 72, 0.5], [1.5, 76, 0.7], [3, 74, 0.5]],
    [[1, 69, 1.4]],
    [[0.5, 70, 0.6], [1.5, 69, 0.6], [2.5, 67, 1]],
    [[1, 64, 0.6], [2.5, 67, 1]],
    [[0.5, 69, 0.5], [1.5, 72, 0.5], [2.5, 79, 0.9]],
    [[0.5, 76, 0.7], [2, 74, 1.2]],
    [[1, 77, 0.6], [2, 74, 0.5], [3, 70, 0.6]],
    [[0.5, 69, 0.8], [2, 67, 1.2]],
    [[0.5, 72, 0.6], [2, 71, 0.6], [3, 69, 0.5]],
    [[1, 68, 1.4]], // borrowed minor colour, a slightly warped smile
    [[0.5, 70, 0.6], [1.5, 69, 0.5], [2.5, 67, 0.7]],
    [[0.5, 64, 0.7], [2, 67, 1.2]],
  ],
  borrowedBar: 13, borrowedChord: { bass: 46, notes: [56, 61, 65, 67] },
  chordBeats: [0, 2.5], chordDuration: 1.2, chordGain: 0.26,
  bassBeats: [0, 2], bassDuration: 1.3,
};
