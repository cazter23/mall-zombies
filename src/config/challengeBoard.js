// =============================================================================
// CHALLENGES: the title screen's Challenges tab (ui/challengeBoard.js) and the in-run challenge tracker (ui/challengeTracker.js).
// Every challenge the game offers is listed by game/challengeCatalog.js, one CATEGORY per kind of reward (today: weapon finishes; later,
// other unlockables add a category there). The player PINS up to maxPins of them on the board; the tracker, when it is turned on in
// Settings (off by default), shows the pinned ones under the round counter for a few seconds whenever one of them moves.
// =============================================================================

export const challengeBoard = {
  maxPins: 3,
  storage: { key: 'sunsetGalleria.challengePins', version: 1 }, // the pins (game/challengePins.js); never progress, which lives with its reward

  // The board
  menu: 'Challenges',
  title: 'Performance objectives', kicker: 'Personnel · Goals you may set yourself',
  form: 'SG / HR · FORM 7-B',
  categories: { skins: 'Weapon finishes' },
  slotTags: { 1: 'Mastery', 2: 'Role', 3: 'Feat · one shift' },
  pin: 'Pin', pinned: 'Pinned', done: 'Done',
  pinCount: (count, max) => `Pinned ${count} / ${max}`,
  full: max => `You can pin ${max}. Unpin one first.`,
  trackerOff: 'The challenge tracker is off: turn it on under Settings › Comfort to see your pins during a shift.',
  back: 'Back',
  hint: 'Arrow keys / D-pad to browse · Enter / A to pin · Escape / B to return',
  theme: { ink: '#302b30', paper: '#f4ead7', edge: '#b8a98e', stamp: '#9a3f53', selected: '#e8d9c1', highlight: '#93556a', lockedPaper: '#dedbd4', lockedInk: '#625e59' },

  // The tracker (in a run)
  tracker: {
    label: 'Pinned challenges',
    showSeconds: 4,     // how long it stays up after a pinned challenge moves
    failedSeconds: 3,   // a lost attempt stays struck through this long, then drops off until its next attempt
    failed: 'Failed',
    title: (skinName, gunName) => `${skinName} · ${gunName}`,
    failSound: { name: 'pageTurn', volume: 0.5 }, // soft: a line crossed out on a form
  },
};
