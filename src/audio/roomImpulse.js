// =============================================================================
// ROOM IMPULSE (pure: no Web Audio)
// Generates the impulse response the shared reverb (audio/sound.js) convolves gunshots with, from a room preset in
// config/audio.js `rooms`. No files: a burst of stereo noise that dies away over the room's length, darkening as it
// goes (air and soft furnishings eat the highs first), after a pre-delay and a few sparse early reflections (the
// nearest walls). A `ring` adds a short feedback comb: the metallic flutter of a narrow concrete-and-steel corridor.
// Each channel is scaled to unit energy, so a room's loudness is its `wet`, not its length.
//
//   roomImpulse(room, sampleRate, random = seeded) -> { left: Float32Array, right: Float32Array, seconds }
// =============================================================================

/** Small seeded generator, so a room always sounds the same (and tests are repeatable). */
export function seededRandom(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
}

/**
 * @param room { seconds, preDelay, brightness: [startHz, endHz], lowCut, early: { count, spread, gain }, ring: { freq, feedback }, width }
 *   seconds: time to fall 60 dB. width 0..1: how different the two ears are (1 = fully independent noise).
 */
export function roomImpulse(room, sampleRate, random = seededRandom(room.seed ?? 7)) {
  const seconds = room.seconds;
  const pre = Math.round((room.preDelay ?? 0) * sampleRate);
  const length = pre + Math.ceil(seconds * sampleRate);
  const [startHz, endHz] = room.brightness ?? [8000, 2000];
  const width = room.width ?? 0.8;
  const shared = new Float32Array(length);
  for (let i = pre; i < length; i++) shared[i] = random() * 2 - 1;
  const channel = () => {
    const out = new Float32Array(length);
    // The tail: noise (part shared between the ears, part each ear's own) under an exponential fade to -60 dB.
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / sampleRate;
      const n = shared[i] * (1 - width) + (random() * 2 - 1) * width;
      out[i] = n * Math.exp(-6.9078 * t / seconds);
    }
    // Early reflections: a few clear taps in the first `spread` seconds, each a little quieter.
    const early = room.early;
    if (early?.count) {
      for (let k = 0; k < early.count; k++) {
        const at = pre + Math.round(random() * early.spread * sampleRate);
        if (at < length) out[at] += (random() < 0.5 ? -1 : 1) * early.gain * (1 - k / (early.count + 1)) * 6;
      }
    }
    // Darkening: a one-pole low-pass whose cutoff slides from startHz to endHz over the tail.
    let y = 0;
    for (let i = 0; i < length; i++) {
      const t = Math.max(0, i - pre) / sampleRate;
      const fc = startHz * (endHz / startHz) ** Math.min(1, t / seconds);
      const a = 1 - Math.exp(-2 * Math.PI * fc / sampleRate);
      y += a * (out[i] - y);
      out[i] = y;
    }
    // A metallic flutter: a short feedback comb (a corridor's parallel walls).
    if (room.ring) {
      const d = Math.max(1, Math.round(sampleRate / room.ring.freq));
      for (let i = d; i < length; i++) out[i] += room.ring.feedback * out[i - d];
    }
    // Low cut: tails without mud (a one-pole high-pass).
    if (room.lowCut) {
      const rc = 1 / (2 * Math.PI * room.lowCut), dt = 1 / sampleRate, alpha = rc / (rc + dt);
      let prevIn = 0, prevOut = 0;
      for (let i = 0; i < length; i++) {
        const x = out[i];
        prevOut = alpha * (prevOut + x - prevIn);
        prevIn = x;
        out[i] = prevOut;
      }
    }
    // Unit energy.
    let energy = 0;
    for (let i = 0; i < length; i++) energy += out[i] * out[i];
    const scale = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = 0; i < length; i++) out[i] *= scale;
    return out;
  };
  return { left: channel(), right: channel(), seconds: length / sampleRate };
}
