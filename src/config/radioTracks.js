// =============================================================================
// GALLERIA FM'S SONGS (config/music.js: the station; audio/mallMusic.js: the engine). All original, written for the game.
// A song: tempo, `parts` (instruments: a synth from config/music.js plus overrides; role 'bass' takes bass notes),
// `patterns` (rhythms that play each bar's chord: [beat, what, beats, velocity?]; what = 'chord' | 'root' | 'third' |
// 'fifth' | 'seventh' | 'octave' | 'approach' | 'tone:n' | a note), `melodies` (per bar: [beat, note, beats, velocity?]),
// `drums` (named grooves: { kind, beats | every, accent?, gain? }), `sections` (chords per bar, a list in a bar splits it,
// which patterns play, the drum groove and fill, the melody and its part, transpose) and the `form`.
// =============================================================================

// "After Closing", the mall's original lounge loop, kept as written (explicit voicings) and given a bridge and an ending.
const lounge = [
  { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj9
  { bass: 38, notes: [53, 57, 60, 64] }, // Dm9
  { bass: 43, notes: [57, 58, 62, 65] }, // Gm9
  { bass: 36, notes: [52, 58, 62, 69] }, // C13
  { bass: 45, notes: [55, 60, 64, 67] }, // Am7
  { bass: 38, notes: [54, 60, 64, 69] }, // D9
  { bass: 43, notes: [57, 58, 62, 65] }, // Gm9
  { bass: 36, notes: [52, 58, 62, 67] }, // C9
];
const borrowed = { bass: 46, notes: [56, 61, 65, 67] }; // a slightly warped smile

const afterClosing = {
  id: 'afterClosing', title: 'After Closing', bpm: 88, beatsPerBar: 4, swing: 0.2, seed: 7301,
  gain: 0.2, lowpassHz: 1700, highpassHz: 70,
  delay: [{ beats: 0.75, gain: 0.16, pan: -0.6 }, { beats: 1.25, gain: 0.11, pan: 0.6 }],
  parts: {
    lead: { synth: 'piano', gain: 0.26, pan: 0.18, echo: true },
    comp: { synth: 'piano', gain: 0.068, pan: -0.18, echo: true },
    bass: { synth: 'bass', role: 'bass', gain: 0.23 },
    pad: { synth: 'pad', gain: 0.018, octave: -12 },
  },
  patterns: {
    comp: { part: 'comp', hits: [[0, 'chord', 1.2], [2.5, 'chord', 1.2]] },
    bass: { part: 'bass', hits: [[0, 'root', 1.3], [2, 'root', 1.3]] },
    pad: { part: 'pad', hits: [[0, 'chord', 4]] },
    last: { part: 'comp', hits: [[0, 'chord', 4]] },
    lastBass: { part: 'bass', hits: [[0, 'root', 4]] },
  },
  melodies: {
    A: [
      [[0.5, 69, 0.6], [1.5, 72, 0.5], [2.5, 76, 1]], [[0.5, 74, 0.7], [2, 72, 1.3]], [[1, 70, 0.6], [2, 69, 0.5], [3, 67, 0.6]],
      [[0.5, 64, 1], [2.5, 67, 0.8]], [[0.5, 72, 0.5], [1.5, 76, 0.7], [3, 74, 0.5]], [[1, 69, 1.4]],
      [[0.5, 70, 0.6], [1.5, 69, 0.6], [2.5, 67, 1]], [[1, 64, 0.6], [2.5, 67, 1]], [[0.5, 69, 0.5], [1.5, 72, 0.5], [2.5, 79, 0.9]],
      [[0.5, 76, 0.7], [2, 74, 1.2]], [[1, 77, 0.6], [2, 74, 0.5], [3, 70, 0.6]], [[0.5, 69, 0.8], [2, 67, 1.2]],
      [[0.5, 72, 0.6], [2, 71, 0.6], [3, 69, 0.5]], [[1, 68, 1.4]], [[0.5, 70, 0.6], [1.5, 69, 0.5], [2.5, 67, 0.7]],
      [[0.5, 64, 0.7], [2, 67, 1.2]],
    ],
    B: [
      [[0.5, 'D5', 0.6], [1.5, 'F5', 0.5], [2.5, 'A5', 1.2]], [[0.5, 'G5', 0.6], [1.5, 'E5', 0.5], [2.5, 'C5', 1.2]],
      [[0.5, 'Bb4', 0.6], [1.5, 'D5', 0.5], [2.5, 'F5', 0.8], [3.5, 'E5', 0.4]], [[0, 'E5', 0.5], [1, 'G5', 0.5], [2, 'Bb5', 1.5]],
      [[0.5, 'A5', 0.6], [1.5, 'F5', 0.5], [2.5, 'D5', 1.2]], [[0.5, 'C#5', 0.6], [1.5, 'E5', 0.5], [2.5, 'G5', 1.2]],
      [[0.5, 'F5', 0.6], [1.5, 'A5', 0.5], [2.5, 'C6', 0.6], [3.5, 'A5', 0.4]], [[0, 'B4', 0.8], [1, 'A4', 0.8], [2, 'G4', 0.6], [3, 'E4', 0.8]],
    ],
    end: [[], [], [], [[0, 'A5', 3.5]]],
  },
  drums: {
    brush: [{ kind: 'hat', every: 0.5 }, { kind: 'brush', beats: [1, 3] }, { kind: 'kick', beats: [0, 2] }],
    soft: [{ kind: 'hat', every: 1 }, { kind: 'brush', beats: [1, 3], gain: 0.7 }],
  },
  sections: {
    intro: { chords: [lounge[0], lounge[1], lounge[2], lounge[3]], play: ['pad', 'comp', 'bass'], drums: 'soft' },
    A: { chords: [...lounge, ...lounge.slice(0, 5), borrowed, lounge[6], lounge[7]], play: ['pad', 'comp', 'bass'], drums: 'brush', melody: { notes: 'A', part: 'lead' } },
    B: { chords: ['Bbmaj7', 'Am7', 'Gm7', 'C7', 'Bbmaj7', 'A7', 'Dm7', ['G9', 'C13']], play: ['pad', 'comp', 'bass'], drums: 'brush', melody: { notes: 'B', part: 'lead' } },
    outro: { chords: [lounge[2], lounge[3], lounge[1], 'Fmaj9'], play: ['pad', 'comp', 'bass'], drums: 'soft', melody: { notes: 'end', part: 'lead' } },
  },
  form: ['intro', 'A', 'B', 'A', 'outro'],
};

// "Escalator Bossa": bossa nova in C. Nylon-string plucks, a flute, a marimba chorus, rim and shaker.
const escalatorBossa = {
  id: 'escalatorBossa', title: 'Escalator Bossa', bpm: 132, beatsPerBar: 4, swing: 0, seed: 2207,
  gain: 0.2, lowpassHz: 2600, highpassHz: 80,
  delay: [{ beats: 0.5, gain: 0.14, pan: -0.5 }],
  parts: {
    flute: { synth: 'wind', gain: 0.2, pan: 0.15, echo: true, harmonics: 3, brightness: 0.18, breath: 0.1 },
    marimba: { synth: 'marimba', gain: 0.24, pan: 0.1, echo: true },
    guitar: { synth: 'pluck', gain: 0.11, pan: -0.25, brightness: 0.45, damping: 0.995 },
    bass: { synth: 'bass', role: 'bass', gain: 0.24, decay: 0.9 },
    pad: { synth: 'pad', gain: 0.012, octave: -12 },
  },
  patterns: {
    guitar: { part: 'guitar', hits: [[0, 'chord', 0.45], [1.5, 'chord', 0.4, 0.8], [2.5, 'chord', 0.4, 0.7], [3, 'chord', 0.45, 0.85]] },
    bass: { part: 'bass', hits: [[0, 'root', 1.4], [1.5, 'fifth', 0.45, 0.8], [2, 'fifth', 1.4], [3.5, 'root', 0.45, 0.8]] },
    pad: { part: 'pad', hits: [[0, 'chord', 4]] },
    end: { part: 'guitar', hits: [[0, 'chord', 4]] },
  },
  melodies: {
    A: [
      [[0, 'E5', 1.5], [1.5, 'G5', 0.5], [2, 'B5', 1.5], [3.5, 'A5', 0.5]], [[0, 'G5', 1], [1, 'E5', 1], [2, 'C5', 2]],
      [[0.5, 'D5', 0.5], [1, 'F5', 1], [2, 'A5', 1], [3, 'C6', 1]], [[0, 'B5', 1.5], [1.5, 'A5', 0.5], [2, 'G5', 2]],
      [[0, 'G5', 1], [1, 'B5', 1], [2, 'D6', 1.5], [3.5, 'C6', 0.5]], [[0, 'C#6', 1.5], [1.5, 'B5', 0.5], [2, 'A5', 1], [3, 'G5', 1]],
      [[0, 'F5', 1], [1, 'E5', 0.5], [1.5, 'D5', 0.5], [2, 'C5', 1], [3, 'A4', 1]], [[0, 'C5', 1.5], [2, 'B4', 2]],
    ],
    A2: [
      [[0, 'E5', 1], [1, 'D5', 0.5], [1.5, 'E5', 0.5], [2, 'G5', 2]], [[0, 'A5', 1], [1.5, 'G5', 0.5], [2, 'E5', 2]],
      [[0, 'F5', 1.5], [1.5, 'E5', 0.5], [2, 'D5', 1], [3, 'F5', 1]], [[0, 'D5', 1], [1, 'B4', 1], [2, 'G4', 2]],
      [[0.5, 'B4', 0.5], [1, 'D5', 1], [2, 'G5', 1], [3, 'B5', 1]], [[0, 'A5', 2], [2, 'G5', 1], [3, 'E5', 1]],
      [[0, 'F5', 1], [1, 'A5', 1], [2, 'G5', 1], [3, 'F5', 1]], [[0, 'D5', 1], [1, 'B4', 1], [2, 'C5', 2]],
    ],
    B: [
      [[0, 'A5', 1.5], [1.5, 'G5', 0.5], [2, 'F5', 1], [3, 'E5', 1]], [[0, 'Ab5', 2], [2, 'F5', 1], [3, 'D5', 1]],
      [[0, 'G5', 1.5], [1.5, 'F#5', 0.5], [2, 'E5', 2]], [[0, 'C#5', 1], [1, 'E5', 1], [2, 'G5', 1], [3, 'Bb5', 1]],
      [[0, 'A5', 1.5], [1.5, 'F5', 0.5], [2, 'D5', 2]], [[0, 'F5', 1], [1, 'D5', 1], [2, 'B4', 1], [3, 'G4', 1]],
      [[0, 'E5', 3]], [[2, 'D5', 1], [3, 'F5', 1]],
    ],
    end: [[], [], [[0, 'F5', 1], [1, 'E5', 1], [2, 'D5', 2]], [[0, 'C5', 3.5]]],
  },
  drums: {
    bossa: [
      { kind: 'rim', beats: [0, 1.5, 2.5] }, { kind: 'shaker', every: 0.5, accent: [1, 0.55, 0.8, 0.55] },
      { kind: 'kick', beats: [0, 1.5, 2, 3.5], gain: 0.6 },
    ],
    light: [{ kind: 'shaker', every: 0.5, accent: [1, 0.5] }],
  },
  sections: {
    intro: { chords: ['Cmaj7', 'Am7', 'Dm7', 'G7'], play: ['guitar', 'bass'], drums: 'light' },
    A: { chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', ['G7sus4', 'G7']], play: ['guitar', 'bass', 'pad'], drums: 'bossa', melody: { notes: 'A', part: 'flute' } },
    A2: { chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', ['G7', 'Cmaj7']], play: ['guitar', 'bass', 'pad'], drums: 'bossa', melody: { notes: 'A2', part: 'flute' } },
    B: { chords: ['Fmaj7', 'Fm6', 'Em7', 'A7', 'Dm7', 'G7', 'Cmaj7', ['Dm7', 'G7']], play: ['guitar', 'bass', 'pad'], drums: 'bossa', melody: { notes: 'B', part: 'flute' } },
    Am: { chords: ['Cmaj7', 'Am7', 'Dm7', 'G7', 'Em7', 'A7', 'Dm7', ['G7sus4', 'G7']], play: ['guitar', 'bass'], drums: 'bossa', melody: { notes: 'A', part: 'marimba' } },
    Bm: { chords: ['Fmaj7', 'Fm6', 'Em7', 'A7', 'Dm7', 'G7', 'Cmaj7', ['Dm7', 'G7']], play: ['guitar', 'bass'], drums: 'bossa', melody: { notes: 'B', part: 'marimba', transpose: -12 } },
    outro: { chords: ['Dm7', 'G7', ['Dm7', 'G7'], 'Cmaj7'], play: ['guitar', 'bass', 'pad'], drums: 'light', melody: { notes: 'end', part: 'flute' } },
  },
  form: ['intro', 'A', 'A2', 'B', 'A2', 'Am', 'Bm', 'A2', 'outro'],
};

// "Food Court Funk": E dorian. Slap bass, clavinet, a brassy synth riff, a tight kit with claps.
const foodCourtFunk = {
  id: 'foodCourtFunk', title: 'Food Court Funk', bpm: 104, beatsPerBar: 4, swing: 0.08, seed: 4411,
  gain: 0.19, lowpassHz: 3200, highpassHz: 75,
  delay: [{ beats: 0.75, gain: 0.1, pan: 0.5 }],
  parts: {
    brass: { synth: 'wind', gain: 0.17, pan: 0.12, echo: true, harmonics: 8, brightness: 0.75, breath: 0.03, attack: 0.025, vibrato: 0.004 },
    clav: { synth: 'clav', gain: 0.07, pan: -0.3, voicing: 60 },
    bass: { synth: 'bass', role: 'bass', gain: 0.25, decay: 0.45, overtone: 0.5, overtoneDecay: 9, bite: 0.35 },
    pad: { synth: 'pad', gain: 0.01, octave: -12, shimmer: 0.2 },
  },
  patterns: {
    clav: { part: 'clav', hits: [[0, 'chord', 0.2], [0.75, 'chord', 0.15, 0.7], [1.5, 'chord', 0.2, 0.85], [2.25, 'chord', 0.15, 0.7], [2.75, 'chord', 0.2, 0.8], [3.5, 'chord', 0.15, 0.7]] },
    slap: { part: 'bass', hits: [[0, 'root', 0.4], [0.75, 'octave', 0.15, 0.8], [1, 'root', 0.25, 0.9], [1.75, 'seventh', 0.2, 0.75], [2.5, 'root', 0.3], [3, 'fifth', 0.2, 0.8], [3.5, 'octave', 0.2, 0.85], [3.75, 'seventh', 0.15, 0.7]] },
    pad: { part: 'pad', hits: [[0, 'chord', 4]] },
    hit: { part: 'clav', hits: [[0, 'chord', 1.5]] },
    hitBass: { part: 'bass', hits: [[0, 'root', 2]] },
  },
  melodies: {
    riff: [
      [[0, 'E5', 0.25], [0.5, 'G5', 0.25], [0.75, 'A5', 0.5], [1.5, 'B5', 0.25], [2, 'A5', 0.25], [2.25, 'G5', 0.25], [2.5, 'E5', 0.5]],
      [[1, 'D5', 0.25], [1.25, 'E5', 0.5], [2.5, 'G5', 0.25], [2.75, 'E5', 0.75]],
      [[0, 'C#6', 0.25], [0.5, 'B5', 0.25], [0.75, 'A5', 0.5], [1.5, 'F#5', 0.25], [2, 'G5', 0.25], [2.25, 'F#5', 0.25], [2.5, 'E5', 0.5]],
      [[1, 'C#5', 0.25], [1.25, 'D5', 0.5], [2, 'E5', 0.5], [3, 'B4', 0.5]],
      [[0, 'E5', 0.25], [0.5, 'G5', 0.25], [0.75, 'A5', 0.5], [1.5, 'B5', 0.25], [2, 'A5', 0.25], [2.25, 'G5', 0.25], [2.5, 'E5', 0.5]],
      [[1, 'D5', 0.25], [1.25, 'E5', 0.5], [2.5, 'G5', 0.25], [2.75, 'E5', 0.75]],
      [[0, 'C#6', 0.25], [0.5, 'B5', 0.25], [0.75, 'A5', 0.5], [1.5, 'F#5', 0.25], [2, 'G5', 0.25], [2.25, 'F#5', 0.25], [2.5, 'E5', 0.5]],
      [[0, 'E5', 0.25], [0.5, 'D5', 0.25], [0.75, 'B4', 0.5], [1.5, 'E5', 2]],
    ],
    chorus: [
      [[0, 'G5', 1], [1, 'B5', 1], [2, 'A5', 1.5]], [[0, 'F#5', 1], [1, 'A5', 1], [2, 'D5', 1.5]],
      [[0, 'E5', 0.5], [0.5, 'G5', 0.5], [1, 'C6', 1.5], [2.5, 'B5', 0.5], [3, 'A5', 1]], [[0, 'B5', 2], [2, 'D#5', 1], [3, 'F#5', 1]],
      [[0, 'G5', 1], [1, 'E5', 1], [2, 'B5', 1.5]], [[0, 'A5', 1], [1, 'F#5', 1], [2, 'D5', 1.5]],
      [[0, 'C5', 0.5], [0.5, 'E5', 0.5], [1, 'A5', 1], [2, 'G5', 1], [3, 'E5', 1]], [[0, 'D#5', 1], [1, 'F#5', 1], [2, 'B5', 2]],
    ],
    end: [[], [], [], [[0, 'E5', 0.25], [0.5, 'G5', 0.25], [0.75, 'B5', 2.5]]],
  },
  drums: {
    funk: [
      { kind: 'kick', beats: [0, 0.75, 2.5] }, { kind: 'snare', beats: [1, 3] }, { kind: 'clap', beats: [1, 3], gain: 0.7 },
      { kind: 'hat', every: 0.25, accent: [1, 0.45, 0.75, 0.45] }, { kind: 'openhat', beats: [3.5] },
    ],
    fill: [
      { kind: 'kick', beats: [0, 0.75] }, { kind: 'snare', beats: [1, 2, 2.5, 3, 3.25, 3.5, 3.75], gain: 0.8 },
      { kind: 'tom', beats: [2.25, 2.75] }, { kind: 'hat', every: 0.5 },
    ],
    beat: [{ kind: 'kick', beats: [0, 0.75, 2.5] }, { kind: 'hat', every: 0.25, accent: [1, 0.45, 0.75, 0.45] }],
  },
  sections: {
    intro: { chords: ['Em9', 'Em9', 'A13', 'A13'], play: ['slap'], drums: 'beat', fill: 'fill' },
    A: { chords: ['Em9', 'Em9', 'A13', 'A13'], bars: 8, play: ['slap', 'clav'], drums: 'funk', fill: 'fill', melody: { notes: 'riff', part: 'brass' } },
    groove: { chords: ['Em9', 'Em9', 'A13', 'A13'], bars: 8, play: ['slap', 'clav', 'pad'], drums: 'funk' },
    B: { chords: ['Cmaj7', 'Bm7', 'Am7', 'B7', 'Cmaj7', 'Bm7', 'Am7', 'B7'], play: ['slap', 'clav', 'pad'], drums: 'funk', fill: 'fill', melody: { notes: 'chorus', part: 'brass' } },
    bridge: { chords: ['Gmaj7', 'F#m7', ['Em7', 'A7'], 'B7#9'], play: ['slap', 'clav', 'pad'], drums: 'funk', fill: 'fill' },
    outro: { chords: ['Em9', 'A13', 'Em9', 'Em9'], play: ['slap', 'clav'], drums: 'funk', melody: { notes: 'end', part: 'brass' } },
  },
  form: ['intro', 'A', 'groove', 'B', 'A', 'bridge', 'B', 'outro'],
};

// "Synth Promenade": 80s mall pop in D. Arpeggios, string pad, octave synth bass, gated snare, and a key change.
const synthPromenade = {
  id: 'synthPromenade', title: 'Synth Promenade', bpm: 116, beatsPerBar: 4, swing: 0, seed: 1986,
  gain: 0.18, lowpassHz: 3600, highpassHz: 85,
  delay: [{ beats: 0.75, gain: 0.18, pan: -0.55 }, { beats: 1.5, gain: 0.1, pan: 0.55 }],
  drumKit: { snareGate: 0.16, snareDecay: 6, gain: { kick: 0.08, snare: 0.06, clap: 0.03, hat: 0.012, openhat: 0.012, shaker: 0.012, rim: 0.03, brush: 0.024, tom: 0.06 } },
  parts: {
    lead: { synth: 'wind', gain: 0.15, pan: 0.1, echo: true, harmonics: 7, brightness: 0.6, breath: 0, vibrato: 0.005, attack: 0.02 },
    arp: { synth: 'pluck', gain: 0.09, pan: -0.35, brightness: 0.8, damping: 0.99, voicing: 62, echo: true },
    strings: { synth: 'pad', gain: 0.016, shimmer: 0.35, detune: 0.004, detunedGain: 0.6 },
    bass: { synth: 'bass', role: 'bass', gain: 0.22, decay: 0.35, overtone: 0.6, overtoneDecay: 6, bite: 0.3 },
  },
  patterns: {
    arp: { part: 'arp', hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((beat, i) => [beat, `tone:${[0, 1, 2, 3, 2, 1, 2, 3][i]}`, 0.4]) },
    strings: { part: 'strings', hits: [[0, 'chord', 4]] },
    bass: { part: 'bass', hits: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((beat, i) => [beat, i % 2 ? 'octave' : 'root', 0.4, i % 2 ? 0.75 : 1]) },
    end: { part: 'arp', hits: [[0, 'chord', 4]] },
  },
  melodies: {
    verse: [
      [[0, 'F#5', 0.5], [0.5, 'F#5', 0.5], [1, 'E5', 0.5], [1.5, 'D5', 1], [3, 'A4', 1]],
      [[0, 'B4', 0.5], [0.5, 'D5', 0.5], [1, 'F#5', 1.5], [3, 'E5', 1]],
      [[0, 'D5', 0.5], [0.5, 'B4', 0.5], [1, 'G4', 1], [2, 'B4', 0.5], [2.5, 'D5', 0.5], [3, 'G5', 1]],
      [[0, 'F#5', 1], [1, 'E5', 2.5]],
      [[0, 'F#5', 0.5], [0.5, 'A5', 0.5], [1, 'F#5', 0.5], [1.5, 'D5', 1], [3, 'E5', 1]],
      [[0, 'F#5', 1], [1, 'D5', 0.5], [1.5, 'B4', 1.5], [3, 'D5', 1]],
      [[0, 'B5', 1], [1, 'A5', 0.5], [1.5, 'G5', 1], [2.5, 'E5', 1.5]],
      [[0, 'C#5', 1], [1, 'E5', 1], [2, 'A5', 2]],
    ],
    chorus: [
      [[0, 'B5', 1.5], [1.5, 'A5', 0.5], [2, 'G5', 1], [3, 'D5', 1]], [[0, 'C#6', 1.5], [1.5, 'B5', 0.5], [2, 'A5', 2]],
      [[0, 'A5', 1], [1, 'F#5', 1], [2, 'C#5', 1], [3, 'F#5', 1]], [[0, 'D6', 2], [2, 'B5', 2]],
      [[0, 'B5', 1], [1, 'D6', 1], [2, 'B5', 1], [3, 'G5', 1]], [[0, 'A5', 1.5], [1.5, 'C#6', 0.5], [2, 'E6', 2]],
      [[0, 'D6', 3]], [[2, 'A5', 0.5], [2.5, 'B5', 0.5], [3, 'C#6', 1]],
    ],
    end: [[], [], [], [[0, 'D6', 3.5]]],
  },
  drums: {
    pop: [
      { kind: 'kick', beats: [0, 1.5, 2, 3.5] }, { kind: 'snare', beats: [1, 3] }, { kind: 'clap', beats: [3], gain: 0.8 },
      { kind: 'hat', every: 0.5, accent: [1, 0.6] },
    ],
    fill: [{ kind: 'kick', beats: [0] }, { kind: 'tom', beats: [2, 2.5, 3, 3.5] }, { kind: 'snare', beats: [1, 1.5] }],
    intro: [{ kind: 'hat', every: 0.5, accent: [1, 0.6] }, { kind: 'kick', beats: [0, 2] }],
  },
  sections: {
    intro: { chords: ['D', 'Bm', 'G', 'A'], play: ['arp', 'strings'], drums: 'intro', fill: 'fill' },
    verse: { chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'A'], play: ['arp', 'bass'], drums: 'pop', melody: { notes: 'verse', part: 'lead' } },
    chorus: { chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'], play: ['arp', 'strings', 'bass'], drums: 'pop', fill: 'fill', melody: { notes: 'chorus', part: 'lead' } },
    bridge: { chords: ['Em', 'G', 'A', 'A'], play: ['arp', 'strings', 'bass'], drums: 'pop', fill: 'fill' },
    lift: { chords: ['G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'], transpose: 1, play: ['arp', 'strings', 'bass'], drums: 'pop', melody: { notes: 'chorus', part: 'lead' } },
    outro: { chords: ['G', 'A', 'G', 'D'], transpose: 1, play: ['arp', 'strings', 'bass'], drums: 'intro', melody: { notes: 'end', part: 'lead' } },
  },
  form: ['intro', 'verse', 'chorus', 'verse', 'chorus', 'bridge', 'lift', 'outro'],
};

// "Waiting On Hold": an elevator-music waltz in B-flat. Marimba and flute trade the tune over electric piano.
const waitingOnHold = {
  id: 'waitingOnHold', title: 'Waiting On Hold', bpm: 132, beatsPerBar: 3, swing: 0, seed: 3300,
  gain: 0.21, lowpassHz: 2400, highpassHz: 80,
  delay: [{ beats: 1, gain: 0.12, pan: 0.5 }],
  parts: {
    marimba: { synth: 'marimba', gain: 0.24, pan: -0.1, echo: true },
    flute: { synth: 'wind', gain: 0.18, pan: 0.2, echo: true, harmonics: 3, brightness: 0.15, breath: 0.12 },
    keys: { synth: 'epiano', gain: 0.06, pan: 0.25 },
    bass: { synth: 'bass', role: 'bass', gain: 0.24, decay: 1 },
  },
  patterns: {
    waltz: { part: 'keys', hits: [[1, 'chord', 0.6, 0.85], [2, 'chord', 0.6, 0.75]] },
    bass: { part: 'bass', hits: [[0, 'root', 0.9]] },
    walk: { part: 'bass', hits: [[0, 'root', 0.9], [2, 'fifth', 0.9, 0.7]] },
    end: { part: 'keys', hits: [[0, 'chord', 3]] },
  },
  melodies: {
    A: [
      [[0, 'D5', 1], [1, 'F5', 1], [2, 'A5', 1]], [[0, 'Bb5', 2], [2, 'G5', 1]], [[0, 'Eb5', 1], [1, 'G5', 1], [2, 'C6', 1]],
      [[0, 'A5', 2], [2, 'F5', 1]], [[0, 'F5', 1], [1, 'A5', 1], [2, 'D6', 1]], [[0, 'B5', 2], [2, 'G5', 1]],
      [[0, 'Eb6', 1], [1, 'D6', 1], [2, 'C6', 1]], [[0, 'A5', 2.5]],
    ],
    A2: [
      [[0, 'D5', 1], [1, 'F5', 1], [2, 'A5', 1]], [[0, 'Bb5', 2], [2, 'G5', 1]], [[0, 'Eb5', 1], [1, 'G5', 1], [2, 'C6', 1]],
      [[0, 'A5', 2], [2, 'F5', 1]], [[0, 'F5', 1], [1, 'A5', 1], [2, 'D6', 1]], [[0, 'B5', 2], [2, 'G5', 1]],
      [[0, 'Eb6', 1], [1, 'D6', 1], [2, 'C6', 1]], [[0, 'C6', 1], [1, 'A5', 1], [2, 'F5', 1]],
    ],
    B: [
      [[0, 'G5', 2], [2, 'Bb5', 1]], [[0, 'Db6', 2], [2, 'Bb5', 1]], [[0, 'F5', 1], [1, 'D5', 1], [2, 'Bb4', 1]],
      [[0, 'B4', 2], [2, 'D5', 1]], [[0, 'Eb5', 1], [1, 'G5', 1], [2, 'Bb5', 1]], [[0, 'A5', 2], [2, 'C6', 1]],
      [[0, 'Bb5', 2.5]], [[1, 'C5', 1], [2, 'Eb5', 1]],
    ],
    end: [[], [[0, 'F5', 1], [1, 'D5', 1], [2, 'C5', 1]], [], [[0, 'Bb4', 2.5]]],
  },
  drums: {
    waltz: [{ kind: 'kick', beats: [0], gain: 0.7 }, { kind: 'brush', beats: [1, 2], gain: 0.8 }, { kind: 'hat', beats: [0, 1, 2], gain: 0.7 }],
    soft: [{ kind: 'brush', beats: [1, 2], gain: 0.6 }],
  },
  sections: {
    intro: { chords: ['Bbmaj7', 'Gm7', 'Cm7', 'F7'], play: ['waltz', 'bass'], drums: 'soft' },
    A: { chords: ['Bbmaj7', 'Gm7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7'], play: ['waltz', 'bass'], drums: 'waltz', melody: { notes: 'A', part: 'marimba' } },
    Af: { chords: ['Bbmaj7', 'Gm7', 'Cm7', 'F7', 'Dm7', 'G7', 'Cm7', 'F7'], play: ['waltz', 'walk'], drums: 'waltz', melody: { notes: 'A2', part: 'flute' } },
    B: { chords: ['Ebmaj7', 'Edim7', 'Bb/F', 'G7', 'Cm7', 'F7', 'Bb6', 'F7'], play: ['waltz', 'walk'], drums: 'waltz', melody: { notes: 'B', part: 'flute' } },
    Bm: { chords: ['Ebmaj7', 'Edim7', 'Bb/F', 'G7', 'Cm7', 'F7', 'Bb6', 'F7'], play: ['waltz', 'bass'], drums: 'waltz', melody: { notes: 'B', part: 'marimba' } },
    outro: { chords: ['Cm7', 'F7', 'F7', 'Bb6'], play: ['waltz', 'bass'], drums: 'soft', melody: { notes: 'end', part: 'marimba' } },
  },
  form: ['intro', 'A', 'Af', 'B', 'A', 'Bm', 'Af', 'B', 'A', 'outro'],
};

// "Clearance Event": smooth jazz in E-flat. A breathy synth sax over electric piano, fretless-ish bass and soft drums.
const clearanceEvent = {
  id: 'clearanceEvent', title: 'Clearance Event', bpm: 92, beatsPerBar: 4, swing: 0.12, seed: 5150,
  gain: 0.2, lowpassHz: 2800, highpassHz: 70,
  delay: [{ beats: 0.75, gain: 0.15, pan: -0.5 }, { beats: 1.5, gain: 0.09, pan: 0.5 }],
  parts: {
    sax: { synth: 'wind', gain: 0.17, pan: 0.1, echo: true, harmonics: 6, brightness: 0.45, breath: 0.16, vibrato: 0.009, vibratoHz: 4.6, vibratoDelay: 0.3, attack: 0.04 },
    keys: { synth: 'epiano', gain: 0.07, pan: -0.25, echo: true },
    keysLead: { synth: 'epiano', gain: 0.2, pan: 0.15, echo: true },
    bass: { synth: 'bass', role: 'bass', gain: 0.25, decay: 1.2, overtone: 0.3, attack: 0.03 },
    pad: { synth: 'pad', gain: 0.014, octave: -12, shimmer: 0.15 },
  },
  patterns: {
    keys: { part: 'keys', hits: [[0, 'chord', 1.4], [1.5, 'chord', 0.4, 0.7], [2.5, 'chord', 1.2, 0.85]] },
    bass: { part: 'bass', hits: [[0, 'root', 1.4], [1.5, 'fifth', 0.45, 0.7], [2.5, 'octave', 0.5, 0.8], [3, 'seventh', 0.8, 0.75], [3.75, 'approach', 0.25, 0.6]] },
    pad: { part: 'pad', hits: [[0, 'chord', 4]] },
    end: { part: 'keys', hits: [[0, 'chord', 4]] },
  },
  melodies: {
    A: [
      [[0.5, 'G5', 0.5], [1, 'Bb5', 1], [2, 'F5', 0.5], [2.5, 'G5', 1.5]], [[0, 'Eb5', 1], [1.5, 'D5', 0.5], [2, 'Bb4', 1], [3, 'C5', 1]],
      [[0, 'Eb5', 0.5], [0.5, 'G5', 0.5], [1, 'C6', 1.5], [2.5, 'Bb5', 0.5], [3, 'G5', 1]], [[0, 'F5', 3]],
      [[0.5, 'Bb5', 0.5], [1, 'C6', 0.5], [1.5, 'Bb5', 0.5], [2, 'G5', 1], [3, 'F5', 1]], [[0, 'G5', 1.5], [1.5, 'Eb5', 0.5], [2, 'D5', 2]],
      [[0, 'C5', 0.5], [0.5, 'Eb5', 0.5], [1, 'G5', 1], [2, 'F5', 0.5], [2.5, 'Eb5', 0.5], [3, 'C5', 1]], [[0, 'Eb5', 1.5], [2, 'D5', 2]],
    ],
    B: [
      [[0, 'Ab5', 1], [1, 'G5', 0.5], [1.5, 'F5', 0.5], [2, 'C5', 2]], [[0, 'Bb5', 1], [1, 'A5', 0.5], [1.5, 'G5', 0.5], [2, 'D5', 2]],
      [[0, 'C6', 1], [1, 'Bb5', 0.5], [1.5, 'G5', 0.5], [2, 'Eb5', 1], [3, 'G5', 1]], [[0, 'F5', 2], [2, 'Ab5', 2]],
      [[0, 'Bb5', 1.5], [1.5, 'A5', 0.5], [2, 'F5', 2]], [[0, 'E5', 1], [1, 'G5', 1], [2, 'Bb5', 1], [3, 'Db6', 1]],
      [[0, 'C6', 2], [2, 'Ab5', 2]], [[0, 'G5', 1], [1, 'F5', 1], [2, 'D5', 2]],
    ],
    end: [[], [], [[0, 'Bb5', 1], [1, 'G5', 1], [2, 'F5', 2]], [[0, 'G5', 3.5]]],
  },
  drums: {
    smooth: [
      { kind: 'kick', beats: [0, 2.5], gain: 0.8 }, { kind: 'rim', beats: [1, 3] },
      { kind: 'hat', every: 0.5, accent: [1, 0.5] }, { kind: 'shaker', every: 0.25, accent: [0.6, 0.3, 0.45, 0.3] },
    ],
    light: [{ kind: 'shaker', every: 0.5, accent: [0.8, 0.4] }, { kind: 'rim', beats: [3], gain: 0.6 }],
  },
  sections: {
    intro: { chords: ['Ebmaj9', 'Cm9', 'Abmaj7', 'Bb13'], play: ['keys', 'bass', 'pad'], drums: 'light' },
    A: { chords: ['Ebmaj9', 'Cm9', 'Abmaj7', 'Bb13', 'Ebmaj9', 'Cm9', 'Abmaj7', ['Bb7sus4', 'Bb7']], play: ['keys', 'bass', 'pad'], drums: 'smooth', melody: { notes: 'A', part: 'sax' } },
    B: { chords: ['Fm9', 'Gm7', 'Abmaj7', ['Bb7sus4', 'Bb7'], 'Gm7', 'C7', 'Fm9', 'Bb13'], play: ['keys', 'bass', 'pad'], drums: 'smooth', melody: { notes: 'B', part: 'sax' } },
    solo: { chords: ['Ebmaj9', 'Cm9', 'Abmaj7', 'Bb13', 'Ebmaj9', 'Cm9', 'Abmaj7', ['Bb7sus4', 'Bb7']], play: ['bass', 'pad'], drums: 'smooth', melody: { notes: 'A', part: 'keysLead' } },
    outro: { chords: ['Abmaj7', 'Bb13', 'Abmaj7', 'Ebmaj9'], play: ['keys', 'bass', 'pad'], drums: 'light', melody: { notes: 'end', part: 'sax' } },
  },
  form: ['intro', 'A', 'B', 'A', 'solo', 'B', 'A', 'outro'],
};

export const radioTracks = [afterClosing, escalatorBossa, foodCourtFunk, synthPromenade, waitingOnHold, clearanceEvent];
