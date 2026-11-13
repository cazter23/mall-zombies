// =============================================================================
// SAVE & QUIT (game/saveGame.js): one save slot, Black Ops 6 style.
//   version     bump it whenever what a system saves changes shape (or a feature that saves is renamed): an older save
//               is then dropped with a notice instead of being half-loaded. Map features are saved by name, so adding,
//               removing or reordering map.features needs no bump.
//   storageKey  the localStorage key of the one slot.
//   reasons     why the pause menu's Save & Quit is greyed out (the button shows the text).
// =============================================================================
export const save = {
  version: 9, // 9: Flash Sales save pending teasers and Doorbuster targets, pricing saves per-item discounts;
  //             8: hazards phases 2-4 merged into main (map.features gained the Fryer Blast, Fire Sprinklers and PA System Lure
  //             switches); 7: Kiosk Kevin's five carts (the kiosk feature saves where he is), Lost and Found and the Return
  //             quest (map.features gained lost property and NO REFUNDS signs, and a 'returnQuest' save step);
  //          6: the challenges step saves the weapon skin feats' run state; 5: Returns Desk appended to map.features
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
