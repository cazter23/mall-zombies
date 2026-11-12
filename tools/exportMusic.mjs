// Full-volume WAV previews of Galleria FM's songs (config/radioTracks.js), before the in-game speakers' EQ and volume.
// Usage: node tools/exportMusic.mjs <folder> [trackId ...]   (no ids = every song)
import fs from 'node:fs';
import path from 'node:path';
import { renderTrack, trackById } from '../src/audio/mallMusic.js';
import { radioTracks } from '../src/config/radioTracks.js';

const [folder, ...ids] = process.argv.slice(2);
if (!folder) throw new Error('Supply a destination folder (and optionally track ids).');
fs.mkdirSync(folder, { recursive: true });
for (const id of ids.length ? ids : radioTracks.map((t) => t.id)) {
  const track = trackById(id);
  if (!track) throw new Error(`No track "${id}". Tracks: ${radioTracks.map((t) => t.id).join(', ')}`);
  const { left, right, sampleRate } = renderTrack(track);
  const bytes = left.length * 4, out = Buffer.alloc(44 + bytes);
  out.write('RIFF', 0); out.writeUInt32LE(36 + bytes, 4); out.write('WAVEfmt ', 8);
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22);
  out.writeUInt32LE(sampleRate, 24); out.writeUInt32LE(sampleRate * 4, 28);
  out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(bytes, 40);
  for (let i = 0; i < left.length; i++) {
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, left[i])) * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, right[i])) * 32767), 46 + i * 4);
  }
  const file = path.join(folder, `${String(radioTracks.indexOf(track) + 1).padStart(2, '0')}-${id}.wav`);
  fs.writeFileSync(file, out);
  console.log(`${track.title}: ${(left.length / sampleRate).toFixed(1)} s -> ${file}`);
}
