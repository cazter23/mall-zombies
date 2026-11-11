// =============================================================================
// SAVE & QUIT (game/saveGame.js): one save slot, Black Ops 6 style.
//   version     bump it whenever what a system saves changes shape (or map.features changes order): an older save
//               is then dropped with a notice instead of being half-loaded.
//   storageKey  the localStorage key of the one slot.
//   reasons     why the pause menu's Save & Quit is greyed out (the button shows the text).
// =============================================================================
export const save = {
  version: 5, // 2: Kiosk Kevin and Closing Time (map.features gained entries, so a version 1 save's feature data no longer lines up)
  //             3: Kevin's five carts (the kiosk feature saves where he is), and, separately on main, run skin choices and the
  //                challenge unlock receipt; 4: on main, the per-run challenge counters (and here, carts + skins together);
  //             5: all of those together
  storageKey: 'sunsetGalleria.save',
  reasons: {
    noRound: 'Not clocked in yet',
    dead: 'No longer employed',
    hurt: 'Full health needed',
    shiftComplete: 'Shift complete',
  },
  loadedPa: { kicker: 'Attention shoppers', text: 'Welcome back. Your shift resumes at round {round}.' },
  droppedNotice: 'Your saved shift was from an older version of the mall and has been discarded.',
};
