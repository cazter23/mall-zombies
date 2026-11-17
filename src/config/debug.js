// =============================================================================
// DEBUG CONFIG
// Developer conveniences, all behind DEBUG MODE, which is off for players. It is on when any of these is true (game/debugMode.js):
//   - the dev server (npm run dev) ............. mode.inDev
//   - the address ends in ?debug ............... mode.urlFlag (the built game, the single file, a browser check: `npm run preview`, open /?debug)
//   - Settings > Debug > Debug mode ............ the saved 'debugMode' setting (it takes effect when the game is next opened)
// What debug mode turns on: the debug keys and window (`keys`), the test range (`testArena`) and window.__mall (`exposeToWindow`);
// each can be left out here. Using a debug command marks the run assisted: it is not filed in the career record, skin challenges,
// the Survival Guide or Lost and Found, and its receipt says DEBUG RUN (game/createGame.js state.assisted).
// The commands themselves live in game/debugCommands.js (headless, tested: tests use them whatever the mode); main.js only turns
// key presses into command ids; ui/debugPanel.js is the small window that lists them.
// =============================================================================

export const debug = {
  // How debug mode is switched on (see above).
  mode: { inDev: true, urlFlag: 'debug' },

  // Within debug mode: the debug keys and the debug window.
  keys: true,

  // Show the invisible marker objects (zombie spawns = red pillars, wall buys = green boxes).
  showMarkers: false,

  // Within debug mode: build the test range (src/maps/testRange/). The `arena` command (T) teleports there and back.
  testArena: true,

  // THE DEBUG KEYS: one entry per command. { id, key (KeyboardEvent.code), shift (needs Shift held; default false),
  // group, label }. A new command = an entry here + a function with the same id in game/debugCommands.js.
  // Keys must not clash with a gameplay binding (config/controls.js) or each other: tests/debugCommands.test.js checks.
  // Some commands have no key (game/debugCommands.js `keyless`): g.debug.run('pockets') fills the equipment pockets.
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

    { id: 'god', key: 'KeyB', group: 'Player', label: 'God mode on / off' }, // (G throws a Lethal now; Shift+B is the benchmark)
    { id: 'giveGun', key: 'KeyH', group: 'Player', label: 'Give next gun / refill if owned' },
    { id: 'upgradeGun', key: 'KeyU', group: 'Player', label: 'Upgrade held gun one tier (free)' },
    { id: 'wardrobe', key: 'KeyH', shift: true, group: 'Player', label: 'Give every Wardrobe item' },

    { id: 'doors', key: 'KeyO', group: 'Map', label: 'Toggle all doors open / closed' },
    { id: 'arena', key: 'KeyT', group: 'Map', label: 'Test range / return to mall' },
    { id: 'upstairs', key: 'KeyT', shift: true, group: 'Map', label: 'Level 2 / return downstairs' },
    { id: 'workshop', key: 'KeyY', group: 'Map', label: 'Go to Build-A-Blaster' },
    { id: 'clawPlush', key: 'KeyE', group: 'Map', label: 'GRAB-A-GUN: Sunny in the next grab' },
    { id: 'clawMove', key: 'KeyE', shift: true, group: 'Map', label: 'GRAB-A-GUN: move it to another open area now' },

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

  // THE SHOOTING GALLERY (maps/testRange/gallery.js): a hall through the test range's north wall. Targets at these distances (metres from
  // the firing line), each with a sign; F at the counter sets the round their health (and the guns' round scaling) is taken from.
  // A shot counts toward the target you aimed nearest (within aimCone degrees of the crosshair); a target hit in a tick = one hit shot.
  gallery: {
    distances: [5, 10, 15, 20, 30, 40],
    lanes: [-5, 5, -3, 3, -1, 1], // each target's sideways offset (metres), so no target hides another from the firing line
    rounds: [1, 5, 10, 15, 20, 25, 30, 35, 40], // the counter steps through these
    aimCone: 6,
    readoutHits: 6, // the readout lists this many latest hits
  },

  // The debug window: starts open or closed, and how often its numbers refresh (seconds).
  panel: { startOpen: false, refreshSeconds: 0.25 },

  // Within debug mode: expose game objects as window.__mall (the browser console, and every agent's browser check).
  exposeToWindow: true,
};

// Human name of a key code for the window: KeyZ -> Z, Backquote -> `, Quote -> '
export function keyLabel(code) {
  if (code === 'Backquote') return '`';
  if (code === 'Quote') return "'";
  return code.replace(/^Key/, '').replace(/^Digit/, '');
}
