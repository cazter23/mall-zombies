// =============================================================================
// DEBUG CONFIG
// Developer conveniences. They work in a normal game (no debug mode to switch on): press the keys while playing.
// Turn `enabled` off before sharing the game. The commands themselves live in game/debugCommands.js (headless,
// tested); main.js only turns key presses into command ids; ui/debugPanel.js is the small window that lists them.
// =============================================================================

export const debug = {
  // Master switch: false = no debug keys and no debug window at all.
  enabled: true,

  // Show the invisible marker objects (zombie spawns = red pillars, wall buys = green boxes).
  showMarkers: false,

  // Build the open movement test range (src/maps/testRange/). The `arena` command (T) teleports there and back.
  testArena: true,

  // THE DEBUG KEYS: one entry per command. { id, key (KeyboardEvent.code), shift (needs Shift held; default false),
  // group, label }. A new command = an entry here + a function with the same id in game/debugCommands.js.
  // Keys must not clash with a gameplay binding (config/controls.js) or each other: tests/debugCommands.test.js checks.
  commands: [
    { id: 'spawn', key: 'KeyZ', group: 'Zombies', label: 'Spawn the selected zombie' },
    { id: 'cycleZombie', key: 'KeyZ', shift: true, group: 'Zombies', label: 'Select the next zombie type' },
    { id: 'clearZombies', key: 'KeyX', group: 'Zombies', label: 'Remove every zombie' },
    { id: 'killZombies', key: 'KeyK', group: 'Zombies', label: 'Kill every zombie (pays points)' },

    { id: 'nextRound', key: 'KeyN', group: 'Round', label: 'Skip to the next round' },
    { id: 'jumpRounds', key: 'KeyN', shift: true, group: 'Round', label: 'Jump ahead 5 rounds' },
    { id: 'flashSale', key: 'KeyL', group: 'Round', label: 'Start a Flash Sale now' },

    { id: 'addPoints', key: 'KeyP', group: 'Economy', label: '+5000 points' },
    { id: 'zeroPoints', key: 'Quote', group: 'Economy', label: 'Points to 0' },

    { id: 'god', key: 'KeyG', group: 'Player', label: 'God mode on / off' },
    { id: 'giveGun', key: 'KeyH', group: 'Player', label: 'Give the next wall gun (or refill it)' },
    { id: 'upgradeGun', key: 'KeyU', group: 'Player', label: 'Upgrade the gun in hand one tier (free)' },

    { id: 'doors', key: 'KeyO', group: 'Map', label: 'Open every door (press again to close them)' },
    { id: 'arena', key: 'KeyT', group: 'Map', label: 'Teleport to the test range and back' },
    { id: 'upstairs', key: 'KeyT', shift: true, group: 'Map', label: 'Teleport to Level 2 and back (repairs the escalator)' },
    { id: 'workshop', key: 'KeyY', group: 'Map', label: 'Teleport to the Build-A-Blaster bench (opens the Promenade)' },

    { id: 'panel', key: 'Backquote', group: 'Debug', label: 'Show / hide this window' },
    { id: 'benchmark', key: 'KeyB', shift: true, group: 'Debug', label: 'Benchmark: time a camera route (title or pause screen)' },
  ],

  // The benchmark (Shift+B, fx/benchmark.js): seconds per shot of map.benchmarkShots, and a warm-up not counted.
  benchmark: { shotSeconds: 4, warmupSeconds: 0.5 },

  // How much +points gives, and how far the "jump ahead" command goes.
  addPointsAmount: 5000,
  jumpRounds: 5,

  // Practice dummies in the test range (only exist when testArena is on).
  dummies: {
    respawnSeconds: 2.5, // how long a "killed" dummy stays down before popping back up
    fallSeconds: 0.3, // how long it takes to tip over / stand back up
    // Health uses the round-1 zombie health from economy.js, so kills feel like the real thing.
  },

  // The debug window: starts open or closed, and how often its numbers refresh (seconds).
  panel: { startOpen: false, refreshSeconds: 0.25 },

  // Expose game objects as window.__mall for poking at in the browser console.
  exposeToWindow: true,
};

// Human name of a key code for the window: KeyZ -> Z, Backquote -> `, Quote -> '
export function keyLabel(code) {
  if (code === 'Backquote') return '`';
  if (code === 'Quote') return "'";
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}
