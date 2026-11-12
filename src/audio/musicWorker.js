import { renderTrack, trackById } from './mallMusic.js';

// Renders one Galleria FM song ({ id }) off the main thread and hands its PCM back (audio/sound.js).
self.onmessage = ({ data }) => {
  const song = renderTrack(trackById(data.id));
  self.postMessage(song, [song.left.buffer, song.right.buffer]);
};
