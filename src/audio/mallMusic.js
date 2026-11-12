// =============================================================================
// MALL MUSIC: the song engine behind Galleria FM (config/music.js: the station; config/radioTracks.js: the songs).
// A song is DATA: sections of chord symbols, rhythm patterns that play each bar's chord, written melodies, drum patterns
// and a form. `songEvents` turns it into notes and drum hits (testable without sound); `renderTrack` synthesises those
// into stereo PCM, deterministically (seeded), off the main thread (audio/musicWorker.js). No audio files.
// Every song opens with the station chime, so the chime plays between songs when one crossfades into the next.
// =============================================================================

import { radio } from '../config/music.js';
import { radioTracks } from '../config/radioTracks.js';

export const trackById = (id) => radioTracks.find((track) => track.id === id) ?? null;

/** 0..1: how worn the radio's tape sounds at a round (config/music.js tapeWear); 0 with the horror layer turned off. */
export function tapeWear(round, horrorOn = true) {
  const { fromRound, fullRound } = radio.tapeWear;
  if (!horrorOn) return 0;
  return Math.max(0, Math.min(1, (round - fromRound) / (fullRound - fromRound)));
}

// ---- Notes and chords ----
const LETTERS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const mod12 = (n) => ((n % 12) + 12) % 12;

/** 'C4' = 60, 'Bb3', 'F#5'; a number passes through. */
export function noteNumber(name) {
  if (typeof name === 'number') return name;
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`music: "${name}" is not a note`);
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// Chord qualities as intervals above the root.
const QUALITIES = {
  '': [0, 4, 7], m: [0, 3, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10],
  9: [0, 4, 10, 14], maj9: [0, 4, 11, 14], m9: [0, 3, 10, 14], 13: [0, 4, 10, 21], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
  sus4: [0, 5, 7], '7sus4': [0, 5, 7, 10], add9: [0, 4, 7, 14], '7b9': [0, 4, 10, 13], '7#9': [0, 4, 10, 15], 69: [0, 4, 9, 14],
};

/** 'Ebmaj9', 'F#m7', 'Bb/F' -> { root, intervals, bass } (pitch classes); an explicit { bass, notes } chord passes through. */
export function parseChord(symbol) {
  if (typeof symbol === 'object') return { explicit: symbol };
  const m = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/.exec(symbol);
  const intervals = m && QUALITIES[m[3]];
  if (!intervals) throw new Error(`music: "${symbol}" is not a chord this engine knows`);
  const pc = (letter, accidental) => mod12(LETTERS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0));
  const root = pc(m[1], m[2]);
  return { root, intervals, bass: m[4] ? pc(m[4], m[5]) : root };
}

const transposed = (chord, by) => (by && !chord.explicit
  ? { ...chord, root: mod12(chord.root + by), bass: mod12(chord.bass + by) }
  : chord);

// Close voicing: every chord tone placed in the octave from `base` up.
function voicing(chord, base) {
  if (chord.explicit) return chord.explicit.notes.slice();
  return [...new Set(chord.intervals.map((i) => base + mod12(chord.root + i - base)))].sort((a, b) => a - b);
}
const bassOf = (chord, low) => (chord.explicit ? chord.explicit.bass : low + mod12(chord.bass - low));

// What one pattern hit plays on a chord: 'chord' (every voiced tone), 'root' / 'third' / 'fifth' / 'seventh' / 'octave'
// (from the bass on a bass part, else from the voicing), 'approach' (a semitone under the next chord's bass), 'tone:n'
// (the n-th voiced tone, climbing octaves), or a note.
function hitPitches(what, part, chord, next) {
  const tones = voicing(chord, part.voicing ?? radio.voicing.base);
  const bassPart = part.role === 'bass';
  const low = bassOf(chord, radio.voicing.bassLow);
  const interval = (n) => {
    if (chord.explicit) return [0, 4, 7, 10][n] ?? 0;
    return chord.intervals[n] ?? chord.intervals[chord.intervals.length - 1];
  };
  const fromBass = (semitones) => { const p = low + semitones; return p > radio.voicing.bassLow + 14 ? p - 12 : p; };
  switch (what) {
    case 'chord': return tones;
    case 'root': return [bassPart ? low : tones[0]];
    case 'third': return [bassPart ? fromBass(mod12(interval(1))) : tones[1 % tones.length]];
    case 'fifth': return [bassPart ? fromBass(mod12(interval(2))) : tones[2 % tones.length]];
    case 'seventh': return [bassPart ? fromBass(mod12(interval(3))) : tones[3 % tones.length]];
    case 'octave': return [bassPart ? low + 12 : tones[0] + 12];
    case 'approach': return [bassOf(next ?? chord, radio.voicing.bassLow) - 1];
    default: {
      const m = /^tone:(\d+)$/.exec(what);
      if (m) { const n = Number(m[1]); return [tones[n % tones.length] + 12 * Math.floor(n / tones.length)]; }
      return [noteNumber(what)];
    }
  }
}

/**
 * The song as events, in beats from the start of the song (after the chime):
 * { notes: [{ part, midi, start, beats, velocity }], drums: [{ kind, start, velocity }], bars, beats, sections: [{ id, startBar, bars }] }.
 */
export function songEvents(track) {
  const notes = [], drums = [], sections = [];
  const bpb = track.beatsPerBar;
  const swing = (beat) => {
    const eighths = beat * 2;
    const offbeat = Math.abs(eighths - Math.round(eighths)) < 1e-6 && Math.round(eighths) % 2 === 1;
    return offbeat ? beat + (track.swing ?? 0) * 0.5 : beat;
  };
  let bar = 0;
  for (const id of track.form) {
    const section = track.sections[id];
    if (!section) throw new Error(`music: ${track.id} has no section "${id}"`);
    const shift = section.transpose ?? 0;
    // Each bar holds one chord, or a list of chords that split the bar evenly.
    const barChords = section.chords.map((c) => (Array.isArray(c) ? c : [c]).map((s) => transposed(parseChord(s), shift)));
    const chordAt = (b, beat) => { const list = barChords[b % barChords.length]; return list[Math.min(list.length - 1, Math.floor(beat / (bpb / list.length)))]; };
    const bars = section.bars ?? barChords.length;
    sections.push({ id, startBar: bar, bars });
    for (let b = 0; b < bars; b++) {
      const at = (bar + b) * bpb;
      const last = b === bars - 1;
      // Accompaniment: each pattern plays its hits on the chord sounding at that beat.
      for (const name of section.play ?? []) {
        const pattern = track.patterns[name];
        if (!pattern) throw new Error(`music: ${track.id} has no pattern "${name}"`);
        const part = track.parts[pattern.part];
        for (const [beat, what, beats, velocity = 1] of pattern.hits) {
          const chord = chordAt(b, beat);
          const nextList = barChords[(b + 1) % barChords.length];
          for (const midi of hitPitches(what, part, chord, nextList[0])) {
            notes.push({ part: pattern.part, midi: midi + (part.octave ?? 0), start: at + swing(beat), beats, velocity });
          }
        }
      }
      // The written melody, if this section has one.
      if (section.melody) {
        const written = track.melodies[section.melody.notes];
        if (!written) throw new Error(`music: ${track.id} has no melody "${section.melody.notes}"`);
        for (const [beat, note, beats, velocity = 1] of written[b % written.length] ?? []) {
          const part = track.parts[section.melody.part];
          notes.push({ part: section.melody.part, midi: noteNumber(note) + shift + (section.melody.transpose ?? 0) + (part.octave ?? 0),
            start: at + swing(beat), beats, velocity });
        }
      }
      // Drums (a fill on a section's last bar if it names one).
      const groove = section.drums && track.drums[last && section.fill ? section.fill : section.drums];
      for (const line of groove ?? []) {
        const beats = line.every ? Array.from({ length: Math.round(bpb / line.every) }, (_, i) => i * line.every) : line.beats;
        beats.forEach((beat, i) => {
          const accent = line.accent ? line.accent[i % line.accent.length] : 1;
          drums.push({ kind: line.kind, start: at + swing(beat), velocity: (line.gain ?? 1) * accent });
        });
      }
    }
    bar += bars;
  }
  return { notes, drums, bars: bar, beats: bar * bpb, sections };
}

// ---- Synthesis ----
const TAU = Math.PI * 2;
const hzOf = (midi) => 440 * 2 ** ((midi - 69) / 12);

function envelope(t, beats, attack, release) {
  const rise = Math.min(1, t / Math.max(attack, 1e-4));
  return t <= beats ? rise : rise * Math.max(0, 1 - (t - beats) / release);
}

// Each synth fills `out` (length = note + release) for one note. p = the part's settings over the synth's defaults.
const SYNTHS = {
  piano(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, ph = TAU * hz * t;
      const body = Math.sin(ph) + p.overtone * Math.sin(ph * 2) * Math.exp(-t * p.overtoneDecay);
      const bell = p.bell * Math.sin(ph * 3.01) * Math.exp(-t / p.bellDecay);
      out[i] = envelope(t, held, p.attack, p.release) * (body * Math.exp(-t / p.decay) + bell);
    }
  },
  epiano(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate;
      const index = p.index * Math.exp(-t * p.indexDecay);
      const tone = Math.sin(TAU * hz * t + index * Math.sin(TAU * hz * p.ratio * t));
      const tine = p.tine * Math.sin(TAU * hz * 7.1 * t) * Math.exp(-t * 40);
      out[i] = envelope(t, held, p.attack, p.release) * (tone * Math.exp(-t / p.decay) + tine);
    }
  },
  marimba(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, ph = TAU * hz * t;
      out[i] = Math.min(1, t / p.attack) * (Math.sin(ph) * Math.exp(-t * p.decay)
        + 0.35 * Math.sin(ph * 3.93) * Math.exp(-t * p.decay * 4) + 0.12 * Math.sin(ph * 9.8) * Math.exp(-t * 40));
    }
  },
  bell(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, ph = TAU * hz * t;
      out[i] = Math.min(1, t / p.attack) * (Math.sin(ph) * Math.exp(-t * p.decay)
        + 0.5 * Math.sin(ph * 2.76) * Math.exp(-t * p.decay * 2) + 0.25 * Math.sin(ph * 5.4) * Math.exp(-t * p.decay * 4));
    }
  },
  // Flute, the synth lead and the "sax": additive harmonics with delayed vibrato, and a little breath noise.
  wind(out, hz, held, p, rate, random) {
    let phase = 0, breath = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / rate;
      const vib = 1 + p.vibrato * Math.min(1, Math.max(0, (t - p.vibratoDelay) / 0.3)) * Math.sin(TAU * p.vibratoHz * t);
      phase += TAU * hz * vib / rate;
      let tone = 0;
      for (let k = 1; k <= p.harmonics; k++) tone += Math.sin(phase * k) * (k === 1 ? 1 : p.brightness / k);
      breath += ((random() * 2 - 1) - breath) * 0.25;
      out[i] = envelope(t, held, p.attack, p.release) * (tone + breath * p.breath) * (1 - p.droop * Math.min(1, t / 3));
    }
  },
  clav(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, ph = TAU * hz * t;
      let tone = 0;
      for (let k = 1; k <= 9; k++) tone += Math.sin(ph * k) * (k % 2 ? 1 : 0.55) / k * Math.exp(-t * (p.decay + k * 1.4));
      out[i] = envelope(t, held, p.attack, p.release) * tone;
    }
  },
  bass(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, ph = TAU * hz * t;
      const body = Math.sin(ph) + p.overtone * Math.sin(ph * 2) * Math.exp(-t * p.overtoneDecay)
        + p.bite * Math.sin(ph * 3) * Math.exp(-t * p.overtoneDecay * 2);
      out[i] = envelope(t, held, p.attack, p.release) * body * Math.exp(-t / p.decay);
    }
  },
  // A plucked string (Karplus-Strong): a burst of noise in a delay line, averaged down each pass.
  pluck(out, hz, held, p, rate, random) {
    const n = Math.max(2, Math.round(rate / hz));
    const line = new Float32Array(n);
    let smooth = 0;
    for (let i = 0; i < n; i++) { smooth += ((random() * 2 - 1) - smooth) * p.brightness; line[i] = smooth; }
    let at = 0;
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, a = line[at], b = line[(at + 1) % n];
      line[at] = p.damping * 0.5 * (a + b);
      at = (at + 1) % n;
      out[i] = envelope(t, held, 0.002, p.release) * a;
    }
  },
  pad(out, hz, held, p, rate) {
    for (let i = 0; i < out.length; i++) {
      const t = i / rate, ph = TAU * hz * t;
      const tone = Math.sin(ph) + p.detunedGain * Math.sin(ph * (1 + p.detune)) + p.shimmer * Math.sin(ph * 2.003);
      out[i] = envelope(t, held, p.attack, p.release) * tone;
    }
  },
};

const DRUMS = {
  kick(out, p, rate) { let ph = 0; for (let i = 0; i < out.length; i++) { const t = i / rate; ph += TAU * (p.kickLow + (p.kickHigh - p.kickLow) * Math.exp(-t * 30)) / rate; out[i] = Math.sin(ph) * Math.exp(-t * p.kickDecay); } },
  snare(out, p, rate, random) { let prev = 0; for (let i = 0; i < out.length; i++) { const t = i / rate, n = random() * 2 - 1, hi = n - prev; prev = n; const gate = t < p.snareGate ? 1 : Math.exp(-(t - p.snareGate) * 120); out[i] = (hi * 0.7 * Math.exp(-t * p.snareDecay) + 0.5 * Math.sin(TAU * 185 * t) * Math.exp(-t * 30)) * gate; } },
  clap(out, p, rate, random) { for (let i = 0; i < out.length; i++) { const t = i / rate, burst = [0, 0.011, 0.022].some((s) => t >= s && t < s + 0.008) ? 1 : 0; out[i] = (random() * 2 - 1) * (burst + Math.exp(-t * 22) * 0.6) * (t > 0.022 ? Math.exp(-(t - 0.022) * 18) : 1); } },
  hat(out, p, rate, random) { let prev = 0; for (let i = 0; i < out.length; i++) { const t = i / rate, n = random() * 2 - 1; out[i] = (n - prev) * Math.exp(-t * p.hatDecay); prev = n; } },
  openhat(out, p, rate, random) { let prev = 0; for (let i = 0; i < out.length; i++) { const t = i / rate, n = random() * 2 - 1; out[i] = (n - prev) * Math.exp(-t * 11); prev = n; } },
  shaker(out, p, rate, random) { let prev = 0; for (let i = 0; i < out.length; i++) { const t = i / rate, n = random() * 2 - 1; out[i] = (n - prev) * Math.min(1, t / 0.012) * Math.exp(-t * 34); prev = n; } },
  rim(out, p, rate, random) { for (let i = 0; i < out.length; i++) { const t = i / rate; out[i] = (Math.sin(TAU * 1650 * t) * 0.6 + Math.sin(TAU * 830 * t) * 0.5 + (random() * 2 - 1) * 0.3 * Math.exp(-t * 300)) * Math.exp(-t * 55); } },
  brush(out, p, rate, random) { for (let i = 0; i < out.length; i++) { const t = i / rate; out[i] = (random() * 2 - 1) * Math.exp(-t * 25); } },
  tom(out, p, rate) { let ph = 0; for (let i = 0; i < out.length; i++) { const t = i / rate; ph += TAU * (110 + 70 * Math.exp(-t * 18)) / rate; out[i] = Math.sin(ph) * Math.exp(-t * 9); } },
};

/**
 * Render a track to stereo PCM: the chime, the song, and a ringing tail. `sampleRate` can be lowered (tests).
 * Returns { id, title, left, right, sampleRate, seconds, songStart }.
 */
export function renderTrack(track, { sampleRate = radio.sampleRate } = {}) {
  const rate = sampleRate;
  const beat = 60 / track.bpm;
  const events = songEvents(track);
  const songStart = radio.chime.seconds;
  const seconds = songStart + events.beats * beat + radio.tailSeconds;
  const frames = Math.round(seconds * rate);
  const left = new Float32Array(frames), right = new Float32Array(frames);
  let seed = track.seed;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const H = radio.humanize;

  function place(wave, startSeconds, pan, gain) {
    const first = Math.round(startSeconds * rate);
    const l = Math.sqrt((1 - pan) / 2) * gain, r = Math.sqrt((1 + pan) / 2) * gain;
    const end = Math.min(wave.length, frames - first);
    for (let i = Math.max(0, -first); i < end; i++) { left[first + i] += wave[i] * l; right[first + i] += wave[i] * r; }
  }
  function playNote(settings, midi, startSeconds, heldSeconds, velocity) {
    const synth = SYNTHS[settings.synth];
    if (!synth) throw new Error(`music: no synth "${settings.synth}"`);
    const p = { ...radio.synths[settings.synth], ...settings };
    const wave = new Float32Array(Math.ceil((heldSeconds + p.release + (p.ring ?? 0)) * rate));
    synth(wave, hzOf(midi), heldSeconds, p, rate, random);
    place(wave, startSeconds, p.pan ?? 0, p.gain * velocity);
    for (const echo of p.echo ? track.delay ?? [] : []) place(wave, startSeconds + echo.beats * beat, echo.pan, p.gain * velocity * echo.gain);
  }

  // The station chime, then the song.
  for (const [at, note, held] of radio.chime.notes) playNote(radio.chime.voice, noteNumber(note), at, held, 1);
  for (const note of events.notes) {
    const part = track.parts[note.part];
    const jitter = (random() * 2 - 1) * H.seconds, loud = 1 + (random() * 2 - 1) * H.velocity;
    playNote(part, note.midi, songStart + Math.max(0, note.start * beat + jitter), note.beats * beat, note.velocity * loud);
  }
  const kit = { ...radio.drumKit, ...track.drumKit };
  for (const hit of events.drums) {
    const make = DRUMS[hit.kind];
    if (!make) throw new Error(`music: no drum "${hit.kind}"`);
    const wave = new Float32Array(Math.ceil(kit.seconds[hit.kind] * rate));
    make(wave, kit, rate, random);
    const loud = 1 + (random() * 2 - 1) * H.velocity;
    place(wave, songStart + hit.start * beat + (random() * 2 - 1) * H.seconds * 0.5, kit.pan[hit.kind] ?? 0, kit.gain[hit.kind] * hit.velocity * loud);
  }

  // Mastering: one shared peak (keeps the stereo image), and a short fade at the very end.
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const scale = radio.peak / Math.max(peak, 1e-6);
  const fade = Math.round(radio.endFadeSeconds * rate);
  for (let i = 0; i < frames; i++) {
    const out = i > frames - fade ? (frames - i) / fade : 1;
    left[i] *= scale * out; right[i] *= scale * out;
  }
  return { id: track.id, title: track.title, left, right, sampleRate: rate, seconds: frames / rate, songStart };
}
