// Sparse mechanical ticks in a looping ambience buffer. Reuse the existing
// noise grain, so cosmetic playback consumes no new gameplay random draws.
export function makeAmbientPulse(context, noise, definition) {
  const length = Math.ceil(context.sampleRate * definition.clickEverySeconds);
  const buffer = context.createBuffer(1, length, context.sampleRate), out = buffer.getChannelData(0), grain = noise.getChannelData(0);
  const count = Math.min(out.length, Math.max(2, Math.ceil(context.sampleRate * definition.clickSeconds)));
  for (let i = 0; i < count; i++) {
    const u = i / (count - 1), envelope = Math.sin(u * Math.PI) ** 2 * Math.exp(-u * 4);
    out[i] = grain[i % grain.length] * envelope;
  }
  return buffer;
}
