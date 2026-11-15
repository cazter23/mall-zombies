// =============================================================================
// RUN START: confirming a run mode on the title's chooser (ui/screens.js 'runMode'), or an arena on its Extra Modes list
// ('arenaMode'), starts the run.
// Browser-side wiring with no DOM of its own: main.js hands it the game state, the screens, the settings store and
// its play() function, so it can be tested with stand-ins (tests/menus.test.js).
//
//   - The title has ALREADY reset the game (main.js goToTitle), so starting from the chooser resets nothing more:
//     one reset per run, not two. (An arena is the exception: setArena resets once more, into the arena.)
//   - It stores the mode and asks to play, nothing else. With a controller play starts at once. With the mouse it
//     starts when the browser grants the pointer lock; until then the chooser stays up (never a "Fresh shift" pause
//     screen), and the player can click a mode again or go Back.
//   - The mode is remembered between sessions (the 'closingMode' setting, game/settings.js) and focused next time; so is the
//     arena (the 'arenaChoice' setting: 'none' after a Directed / Classic run).
//
//   const runStart = createRunStart({ game, screens, settings, play, setArena })
//     setArena(id | null)    game/createGame.js g.setArena: locks the run in an arena (or the whole mall)
//   runStart.acceptsLock()   may a pointer lock that just arrived start play? (main.js's lock handler asks)
// =============================================================================

export function createRunStart({ game, screens, settings, play, setArena = (id) => { game.arena = id; } }) {
  screens.setRunMode(settings.get('closingMode'));
  const savedArena = settings.get('arenaChoice');
  screens.setArenaChoice?.(savedArena === 'none' ? null : savedArena);

  screens.on('startRun', ({ mode, arena = null, pad }) => {
    if (arena) {
      settings.set('arenaChoice', arena);
      screens.setArenaChoice?.(arena);
    } else {
      game.closingMode = mode;
      settings.set('closingMode', mode);
      settings.set('arenaChoice', 'none');
      screens.setRunMode(mode);
      screens.setArenaChoice?.(null);
    }
    setArena(arena);
    play({ pad });
  });

  return {
    // Over the title nothing asked for the mouse. Over the chooser (or the arena list) only a lock that follows a confirmed
    // choice counts: a late grant after Back (or after returning to the chooser without choosing) is given back.
    acceptsLock() {
      if (screens.current === 'title') return false;
      return (screens.current !== 'runMode' && screens.current !== 'arenaMode') || screens.startRequested;
    },
  };
}
