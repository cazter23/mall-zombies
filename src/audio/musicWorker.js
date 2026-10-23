import { renderMallMusic } from './mallMusic.js';

self.onmessage = () => {
  const track = renderMallMusic();
  self.postMessage(track, [track.left.buffer, track.right.buffer]);
};
