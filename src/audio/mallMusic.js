import { mallMusic as score } from '../config/music.js';

/** Pure deterministic PCM composition; used by the worker and the preview/export tests. */
export function renderMallMusic() {
  const rate = score.sampleRate, beat = 60 / score.bpm;
  const frames = Math.round(score.bars * score.beatsPerBar * beat * rate);
  const left = new Float32Array(frames), right = new Float32Array(frames);
  let seed = score.seed;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  // Circular accumulation carries releases and echoes across the loop boundary without a hard cut.
  function add(start, seconds, pan, synth) {
    const first = Math.round(start * rate), length = Math.ceil(seconds * rate);
    const l = Math.sqrt((1 - pan) / 2), r = Math.sqrt((1 + pan) / 2);
    for (let i = 0; i < length; i++) {
      const at = (first + i) % frames, sample = synth(i / rate, i);
      left[at] += sample * l; right[at] += sample * r;
    }
  }
  function note(kind, start, midi, duration, volume, pan = 0) {
    const cfg = score[kind], hz = frequency(midi), total = duration + cfg.release;
    const synth = t => {
      const envelope = Math.min(1, t / cfg.attack) * Math.min(1, (total - t) / cfg.release);
      const phase = 2 * Math.PI * hz * t;
      if (kind === 'pad') {
        const wobble = Math.sin(2 * Math.PI * score.pad.flutterCycles * (start + t) / (frames / rate));
        return envelope * volume * cfg.gain * (Math.sin(phase) + Math.sin(phase * (1 + cfg.detune)) * cfg.detunedGain)
          * (1 + wobble * cfg.detune);
      }
      const body = Math.sin(phase) + cfg.overtone * Math.sin(phase * 2) * Math.exp(-t * cfg.overtoneDecay);
      const bell = kind === 'piano' ? cfg.bell * Math.sin(phase * 3.01) * Math.exp(-t / cfg.bellDecay) : 0;
      return envelope * volume * cfg.gain * (body * Math.exp(-t / cfg.decay) + bell);
    };
    add(start, total, pan, synth);
    if (kind === 'piano') for (const echo of score.delay) add(start + echo.beats * beat, total, echo.pan, t => synth(t) * echo.gain);
  }
  for (let bar = 0; bar < score.bars; bar++) {
    const start = bar * score.beatsPerBar * beat;
    const chord = bar === score.borrowedBar ? score.borrowedChord : score.chords[bar % score.chords.length];
    for (const pitch of chord.notes) {
      note('pad', start, pitch - 12, score.beatsPerBar * beat, 1);
      for (const at of score.chordBeats) note('piano', start + at * beat, pitch,
        score.chordDuration * beat, score.chordGain, -score.piano.pan);
    }
    for (const at of score.bassBeats) note('bass', start + at * beat, chord.bass, score.bassDuration * beat, 1);
    for (const [at, pitch, duration] of score.melody[bar]) note('piano', start + at * beat,
      pitch, duration * beat, 1, score.piano.pan);
    const drums = score.percussion;
    for (let eighth = 0; eighth < score.beatsPerBar * 2; eighth++) {
      let previous = 0;
      add(start + eighth * beat / 2, drums.hatSeconds, drums.hatPan, t => {
        const noise = random() * 2 - 1, high = noise - previous; previous = noise;
        return high * Math.exp(-t * drums.hatDecay) * drums.hatGain;
      });
    }
    for (const at of [1, 3]) add(start + at * beat, drums.brushSeconds, drums.brushPan,
      t => (random() * 2 - 1) * Math.exp(-t * drums.brushDecay) * drums.brushGain);
    for (const at of [0, 2]) add(start + at * beat, drums.kickSeconds, 0,
      t => Math.sin(2 * Math.PI * drums.kickHz * t) * Math.exp(-t * drums.kickDecay) * drums.kickGain);
  }
  // Match both edges over a tiny window, so wrapped percussion/noise never clicks at the seam.
  const seam = Math.round(score.seamSeconds * rate);
  for (const channel of [left, right]) {
    const join = (channel[0] + channel[frames - 1]) / 2;
    for (let i = 0; i < seam; i++) {
      const weight = (1 + Math.cos(Math.PI * i / (seam - 1))) / 2;
      channel[i] += (join - channel[i]) * weight;
      channel[frames - 1 - i] += (join - channel[frames - 1 - i]) * weight;
    }
  }
  // Gentle mastering; one shared peak preserves the stereo image and avoids clipping.
  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  const scale = score.peak / Math.max(peak, score.peak);
  for (let i = 0; i < frames; i++) { left[i] *= scale; right[i] *= scale; }
  return { left, right, sampleRate: rate };
}
