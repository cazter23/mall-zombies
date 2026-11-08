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
    { id: 'spawn', key: 'KeyZ', group: 'Enemies', label: 'Spawn selected enemy' },
    { id: 'summonBoss', key: 'KeyJ', group: 'Enemies', label: 'Summon selected boss (once per round)' },
    { id: 'cycleBoss', key: 'KeyJ', shift: true, group: 'Enemies', label: 'Select next boss' },
    { id: 'spawnMascot', key: 'KeyM', group: 'Enemies', label: 'Spawn next Mascot costume, nearest spot' },
    { id: 'spawnGoldMascot', key: 'KeyM', shift: true, group: 'Enemies', label: 'Spawn next costume as Employee of the Month' },
    { id: 'cycleZombie', key: 'KeyZ', shift: true, group: 'Enemies', label: 'Select next enemy type' },
    { id: 'clearZombies', key: 'KeyX', group: 'Enemies', label: 'Clear enemies (no points)' },
    { id: 'killZombies', key: 'KeyK', group: 'Enemies', label: 'Kill enemies (pays points)' },

    { id: 'nextRound', key: 'KeyN', group: 'Round', label: 'Skip to the next round' },
    { id: 'jumpRounds', key: 'KeyN', shift: true, group: 'Round', label: 'Jump ahead 5 rounds' },
    { id: 'flashSale', key: 'KeyL', group: 'Round', label: 'Start a Flash Sale now' },

    { id: 'addPoints', key: 'KeyP', group: 'Economy', label: '+5000 points' },
    { id: 'zeroPoints', key: 'Quote', group: 'Economy', label: 'Points to 0' },

    { id: 'god', key: 'KeyG', group: 'Player', label: 'God mode on / off' },
    { id: 'giveGun', key: 'KeyH', group: 'Player', label: 'Give next gun / refill if owned' },
    { id: 'upgradeGun', key: 'KeyU', group: 'Player', label: 'Upgrade held gun one tier (free)' },

    { id: 'doors', key: 'KeyO', group: 'Map', label: 'Toggle all doors open / closed' },
    { id: 'arena', key: 'KeyT', group: 'Map', label: 'Test range / return to mall' },
    { id: 'upstairs', key: 'KeyT', shift: true, group: 'Map', label: 'Level 2 / return downstairs' },
    { id: 'workshop', key: 'KeyY', group: 'Map', label: 'Go to Build-A-Blaster' },

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
