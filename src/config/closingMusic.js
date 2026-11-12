// =============================================================================
// "LAST CALL": the Closing Time round's music (an original composition, written as data like Galleria FM's songs in
// config/radioTracks.js and rendered by the same engine, audio/mallMusic.js). Not on the radio: it plays straight to
// you, not through the mall's speakers, from the moment the Last Customer arrives until she is returned (then `resolve`
// rings out) or the run ends. It loops seamlessly (no station chime, no tail). audio/sound.js playScore / stopScore;
// main.js decides when. While it plays the radio is turned down to `radioDuck` of its volume.
// D minor, 144 bpm: octave-pumping bass, clav stabs, a marimba arpeggio and an organ-ish wind lead, mall muzak gone
// to war. The last A section steps up a semitone, because of course it does.
// =============================================================================

const A = ['Dm', 'Dm', 'Bb', 'Bb', 'Gm', 'A7', 'Dm', 'A7'];
const B = ['Bb', 'C', 'Am7', 'Dm', 'Gm7', 'C7', 'Fmaj7', 'A7#9'];

const lastCall = {
  id: 'lastCall', title: 'Last Call', bpm: 144, beatsPerBar: 4, swing: 0, seed: 1730,
  chime: false, loop: true, // (audio/mallMusic.js renderTrack: no station chime; the ringing end folds into the start)
  gain: 1,
  parts: {
    lead: { synth: 'wind', gain: 0.2, pan: 0.12, harmonics: 5, brightness: 0.45, vibrato: 0.01 },
    stab: { synth: 'clav', gain: 0.07, pan: -0.25 },
    arp: { synth: 'marimba', gain: 0.07, pan: 0.3, voicing: 62 },
    bass: { synth: 'bass', role: 'bass', gain: 0.26, bite: 0.35 },
    pad: { synth: 'pad', gain: 0.02, octave: -12 },
  },
  patterns: {
    bass: { part: 'bass', hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((beat, i) => [beat, i % 2 ? 'octave' : 'root', 0.4]) },
    stab: { part: 'stab', hits: [[0.5, 'chord', 0.25], [1.5, 'chord', 0.25], [2.5, 'chord', 0.25], [3.5, 'chord', 0.25, 1.2]] },
    arp: { part: 'arp', hits: ['tone:0', 'tone:1', 'tone:2', 'tone:3', 'tone:2', 'tone:1', 'tone:0', 'tone:1'].map((what, i) => [i / 2, what, 0.4, i % 2 ? 0.7 : 1]) },
    pad: { part: 'pad', hits: [[0, 'chord', 4]] },
  },
  melodies: {
    A: [
      [[0, 'D5', 0.5], [0.5, 'F5', 0.5], [1, 'A5', 1], [2.5, 'G5', 0.5], [3, 'F5', 1]],
      [[0, 'E5', 0.5], [0.5, 'F5', 0.5], [1, 'D5', 2.5]],
      [[0, 'D5', 0.5], [0.5, 'F5', 0.5], [1, 'Bb5', 1], [2.5, 'A5', 0.5], [3, 'G5', 1]],
      [[0, 'F5', 0.5], [0.5, 'G5', 0.5], [1, 'D5', 2.5]],
      [[0, 'G5', 0.75], [0.75, 'Bb5', 0.75], [1.5, 'D6', 1], [3, 'C6', 1]],
      [[0, 'Bb5', 0.5], [0.5, 'A5', 0.5], [1, 'G5', 0.5], [1.5, 'F5', 0.5], [2, 'E5', 1], [3, 'C#5', 1]],
      [[0, 'D5', 1], [1.5, 'A4', 0.5], [2, 'D5', 0.5], [2.5, 'E5', 0.5], [3, 'F5', 1]],
      [[0, 'E5', 1.5], [2, 'C#5', 0.5], [2.5, 'E5', 0.5], [3, 'A5', 1]],
    ],
    B: [
      [[0, 'F5', 1.5], [1.5, 'D5', 0.5], [2, 'F5', 1], [3, 'G5', 1]],
      [[0, 'G5', 1.5], [1.5, 'E5', 0.5], [2, 'G5', 1], [3, 'A5', 1]],
      [[0, 'A5', 0.5], [0.5, 'C6', 0.5], [1, 'E6', 1.5], [3, 'D6', 1]],
      [[0, 'A5', 3.5]],
      [[0, 'Bb5', 0.5], [0.5, 'A5', 0.5], [1, 'G5', 1], [2, 'D5', 1], [3, 'F5', 1]],
      [[0, 'E5', 0.5], [0.5, 'G5', 0.5], [1, 'Bb5', 1.5], [3, 'A5', 1]],
      [[0, 'A5', 1], [1, 'G5', 0.5], [1.5, 'F5', 0.5], [2, 'E5', 1], [3, 'C5', 1]],
      [[0, 'C#5', 0.5], [0.5, 'E5', 0.5], [1, 'G5', 0.5], [1.5, 'Bb5', 0.5], [2, 'A5', 2]],
    ],
  },
  drums: {
    drive: [{ kind: 'kick', beats: [0, 1, 2, 3] }, { kind: 'snare', beats: [1, 3] }, { kind: 'hat', every: 0.5, accent: [1, 0.6] },
      { kind: 'openhat', beats: [3.5], gain: 0.8 }],
    fill: [{ kind: 'kick', beats: [0, 1] }, { kind: 'snare', beats: [1] }, { kind: 'tom', beats: [2, 2.5, 3, 3.25, 3.5, 3.75] }],
  },
  drumKit: { gain: { kick: 0.085, snare: 0.055, hat: 0.016, openhat: 0.014, tom: 0.06 } },
  sections: {
    A: { chords: A, play: ['pad', 'bass', 'stab', 'arp'], drums: 'drive', fill: 'fill', melody: { notes: 'A', part: 'lead' } },
    B: { chords: B, play: ['pad', 'bass', 'stab', 'arp'], drums: 'drive', fill: 'fill', melody: { notes: 'B', part: 'lead' } },
    break: { chords: A, play: ['pad', 'bass', 'arp'], drums: 'drive', fill: 'fill' },
    up: { chords: A, transpose: 1, play: ['pad', 'bass', 'stab', 'arp'], drums: 'drive', fill: 'fill', melody: { notes: 'A', part: 'lead' } },
  },
  form: ['A', 'B', 'break', 'up'],
};

export const closingMusic = {
  track: lastCall,
  volume: 0.9, // x the music volume setting
  fadeInSeconds: 1.2,
  fadeOutSeconds: 1.5, // when the run ends or resets with her still there
  radioDuck: 0.25, // the radio's share of its volume while this plays
  // Returned: the loop fades fast and a bright D major chord (the minor key, resolved) rings out on the same bus.
  resolveFadeSeconds: 0.35,
  resolve: [62, 66, 69, 74, 78].map((midi, i) => ({
    type: 'tone', wave: 'triangle', freq: 440 * 2 ** ((midi - 69) / 12), gain: 0.09, attack: 0.01, decay: 2.6, delay: 0.25 + i * 0.05,
  })).concat([
    { type: 'tone', wave: 'sine', freq: 73.4, gain: 0.25, attack: 0.01, decay: 2.2, delay: 0.25 },
    { type: 'noise', filter: 'highpass', freq: 6000, q: 0.7, gain: 0.05, attack: 0.005, decay: 1.4, delay: 0.25 },
  ]),
};
