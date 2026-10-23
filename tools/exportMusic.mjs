// Optional full-volume WAV preview of the original score, before in-game speaker EQ/volume.
// Usage: node tools/exportMusic.mjs path/to/after-closing.wav
import fs from 'node:fs';
import { renderMallMusic } from '../src/audio/mallMusic.js';

const destination = process.argv[2];
if (!destination) throw new Error('Supply a destination .wav path.');
const { left, right, sampleRate } = renderMallMusic();
const bytes = left.length * 4, out = Buffer.alloc(44 + bytes);
out.write('RIFF', 0); out.writeUInt32LE(36 + bytes, 4); out.write('WAVEfmt ', 8);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
out.writeUInt32LE(sampleRate, 24); out.writeUInt32LE(sampleRate * 4, 28);
out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(bytes, 40);
for (let i = 0; i < left.length; i++) {
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
  out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
}
fs.writeFileSync(destination, out);
console.log(`Exported ${(left.length / sampleRate).toFixed(2)} seconds to ${destination}`);
