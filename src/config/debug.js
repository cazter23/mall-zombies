// =============================================================================
// DEBUG CONFIG
// Developer conveniences. Turn these off before sharing the game.
// =============================================================================

export const debug = {
  // Show the invisible marker objects (zombie spawns = red pillars, wall buys = green boxes).
  showMarkers: false,

  // Press O to open/close the start-room shutter. Temporary until buying doors exists.
  allowShutterToggle: true,

  // Build the open movement test range (src/maps/testRange/). Press T to teleport there and back.
  testArena: true,

  // Press Z to spawn an extra Shopper zombie, X to remove all zombies.
  zombieKeys: true,

  // Press N to end the current round and start the next one, P for +5000 points.
  cheatKeys: true, // N next round, P +5000 points, ' points to 0

  // Practice dummies in the test range (only exist when testArena is on).
  dummies: {
    respawnSeconds: 2.5, // how long a "killed" dummy stays down before popping back up
    fallSeconds: 0.3, // how long it takes to tip over / stand back up
    // Health uses the round-1 zombie health from economy.js, so kills feel like the real thing.
  },

  // Expose game objects as window.__mall for poking at in the browser console.
  exposeToWindow: true,
};
