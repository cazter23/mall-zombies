// =============================================================================
// DEBUG CONFIG
// Developer conveniences. Turn these off before sharing the game.
// =============================================================================

export const debug = {
  // Show the invisible marker objects (zombie spawns = red pillars, wall buys = green boxes).
  showMarkers: false,

  // Press O to open/close the start-room shutter. Temporary until buying doors exists.
  allowShutterToggle: true,

  // Build the open movement test range (src/world/testArena.js). Press T to teleport there and back.
  testArena: true,

  // Expose game objects as window.__mall for poking at in the browser console.
  exposeToWindow: true,
};
