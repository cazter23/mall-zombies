// =============================================================================
// CROWD BED (pure: no Web Audio). The murmur of a horde, as one seamless loop of PCM: overlapping low groans (a few
// harmonics with a wobble and a vowel-ish formant, each fading in and out) over a soft shuffle of low noise. Everything
// wraps round the loop's end, so it repeats without a seam. audio/sound.js plays it through one panner as the stand-in
// for every zombie that has no voice of its own (config/spatialAudio.js crowd).
//   crowdBedPcm(sampleRate, { seconds, voices, seed }) -> Float32Array (mono, peak 0.9)
// =============================================================================

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crowdBedPcm(sampleRate, { seconds = 6, voices = 9, seed = 1957 } = {}) {
  const random = mulberry(seed);
  const n = Math.max(1, Math.round(seconds * sampleRate));
  const out = new Float32Array(n);
  // The groans: `voices` people, each groaning twice per loop at a random time.
  for (let g = 0; g < voices * 2; g++) {
    const f0 = 80 + random() * 95; // Hz: low, tired voices
    const length = Math.round((0.8 + random() * 1.4) * sampleRate);
    const start = Math.floor(random() * n);
    const vibratoHz = 3.5 + random() * 3, vibrato = 0.02 + random() * 0.025, droop = 0.12 + random() * 0.12;
    const formant = 450 + random() * 350, level = 0.5 + random() * 0.5;
    const harmonics = [];
    for (let h = 1; h <= 6; h++) {
      const f = f0 * h;
      harmonics.push((1 / h) * Math.exp(-(((f - formant) / 260) ** 2)) + 0.15 / h);
    }
    let phase = random() * Math.PI * 2;
    const attack = 0.3 * length;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate, u = i / length;
      const env = (i < attack ? i / attack : 1) * (1 - u) ** 1.6 * level;
      const f = f0 * (1 - droop * u) * (1 + vibrato * Math.sin(2 * Math.PI * vibratoHz * t));
      phase += (2 * Math.PI * f) / sampleRate;
      let s = 0;
      for (let h = 0; h < harmonics.length; h++) s += harmonics[h] * Math.sin(phase * (h + 1));
      out[(start + i) % n] += s * env;
    }
  }
  // Under them: feet and fabric, low-passed noise that swells and falls.
  let lp = 0;
  const cycles = Math.max(1, Math.round((0.5 + random() * 0.4) * seconds)); // (a whole number of swells per loop: no seam)
  for (let i = 0; i < n; i++) {
    lp += 0.04 * ((random() * 2 - 1) - lp);
    out[i] += lp * 1.6 * (0.6 + 0.4 * Math.sin((2 * Math.PI * cycles * i) / n));
  }
  // A gentle low-pass over the whole bed (it is a background, never a voice), run twice round so the seam matches.
  let y = 0;
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < n; i++) { y += 0.35 * (out[i] - y); if (pass === 1) out[i] = y; }
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0) for (let i = 0; i < n; i++) out[i] *= 0.9 / peak;
  return out;
}
