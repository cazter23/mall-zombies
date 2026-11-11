export const closingTime = {
  title: 'Closing checklist',
  // RUN MODES, chosen on the title (ui/screens.js): listed in this order. `default` is focused the first time (after
  // that, the mode last chosen: the 'closingMode' setting) and is the engine's own default (game/createGame.js).
  // Directed is the game as decision 10 describes it. Classic is the opt-in: no checklist, key pointers or quest PA.
  modes: {
    default: 'directed',
    kicker: 'Closing Time',
    title: 'Choose a run mode',
    back: 'Back',
    list: [
      { id: 'directed', label: 'Directed', description: 'Follow the checklist, key markers, and mall PA instructions.' },
      { id: 'classic', label: 'Classic', description: 'Discover the quest through the mall and its local clues.' },
    ],
  },
  // Classic's prompts stay short but say what is true: "Needs <key>" at the safe and the van; with every key held the
  // van names an unfinished duty by its place ("Unfinished: Fountain").
  classic: { needs: 'Needs ', unfinished: 'Unfinished: ' },
  van: {
    name: "Skylar's van", verb: 'start the van', priceLabel: 'Free',
    blockedPrefix: 'Still needed: ',
    promptHeight: 1.2, clearance: 0.12,
  },
  finale: { bossId: 'lastCustomer', roundOffset: 1, banner: 'CLOSING TIME', missing: 'The Last Customer' },
  validation: {
    name: 'Parking Validation', verb: 'validate parking', missing: 'Parking validation',
    done: 'Validated', complete: 'Validated · Defeat the Last Customer', cleared: 'Validated · Start the van',
    // Mounted on the mauve van's west flank, inside its painted bay. No new collider or obstruction in the combat lanes.
    promptOffset: 0.38, promptHeight: 1.4,
    parts: [
      { name: 'validation_housing', min: [-0.18, 0.80, -0.32], max: [0.02, 1.86, 0.32], color: 0x343c50 },
      { name: 'validation_face', min: [-0.22, 0.88, -0.28], max: [-0.17, 1.80, 0.28], color: 0x698b86 },
      { name: 'validation_screen', min: [-0.24, 1.36, -0.23], max: [-0.21, 1.63, 0.23], color: 0x162b32 },
      { name: 'validation_slot', min: [-0.24, 1.12, -0.18], max: [-0.21, 1.18, 0.18], color: 0x161622 },
      { name: 'validation_button', min: [-0.25, 0.96, 0.12], max: [-0.21, 1.05, 0.21], color: 0xf7bd62 },
    ],
    sign: { text: 'VALIDATE', offset: 0.25, y: 1.72, width: 0.48, height: 0.12, background: '#243042', color: '#ffe4a0' },
  },
  returnsDesk: {
    name: 'Returns Desk', weaponId: 'returnToSender', ammoName: 'Return to Sender ammo',
    buy: 'buy', refill: 'refill', gate: 'Unfinished: ', equip: 'Equip Return to Sender for ammo',
    busy: 'Finish switching weapons first', full: 'Ammo full',
    redirect: 'Return to Sender ammo is sold at the Returns Desk · Customer Service',
    screen: { line: 'RETURNS DESK', note: 'Customer Service', tone: '#ff9f43' },
    offsetFromBooth: 4.8, promptOffset: 0.42, promptHeight: 1.42,
    parts: [
      { name: 'returns_desk_housing', min: [-0.24, 1.04, -0.42], max: [0.02, 1.84, 0.42], color: 0x253e4d },
      { name: 'returns_desk_screen', min: [-0.28, 1.20, -0.34], max: [-0.23, 1.56, 0.34], color: 0x151f2c },
      { name: 'returns_desk_tray', min: [-0.46, 0.98, -0.42], max: [0.02, 1.04, 0.42], color: 0x698b86 },
    ],
    sign: { text: 'RETURNS DESK', offset: 0.30, y: 1.70, width: 0.70, height: 0.18, background: '#243042', color: '#ffe4a0' },
  },
  nightSafe: {
    name: 'Night Safe',
    verb: 'deposit',
    done: 'Done',
    complete: 'Takings banked',
    requires: 'Requires ', // + the key's name, while the Safe Key is not held
    mountOffset: 1.8, // east wall of Customer Service, measured from the booth center
    insetFromHallWall: 0.88,
    promptOffset: 0.32,
    promptHeight: 1.42,
    // Bounds are local to the booth's east wall, centered on the safe along Z.
    parts: [
      { name: 'night_safe_housing', min: [0.02, 1.00, -0.36], max: [0.23, 1.82, 0.36], color: 0x343c50 },
      { name: 'night_safe_door', min: [0.22, 1.07, -0.30], max: [0.27, 1.75, 0.30], color: 0x69788c },
      { name: 'night_safe_slot', min: [0.26, 1.34, -0.21], max: [0.30, 1.43, 0.21], color: 0x161622 },
      { name: 'night_safe_lock', min: [0.26, 1.15, 0.16], max: [0.30, 1.23, 0.24], color: 0xf7bd62 },
    ],
    sign: { text: 'NIGHT SAFE', offset: 0.29, y: 1.59, width: 0.52, height: 0.19, background: '#243042', color: '#ffe4a0' },
  },
  lines: {
    // place: where the duty is done (Classic's van prompt names it). promptCount: the count on the fountain switch's own
    // prompt while the Key Ring is held and the line is open, in both run modes.
    janitor: { duty: 'Water features off', key: "Murray's Key Ring", needed: 12, place: 'Fountain', promptCount: (progress) => 'Shocked ' + progress },
    guard: { duty: 'Takings banked', key: "Kettle's Safe Key", needed: 4, place: 'Night Safe' },
    manager: { duty: 'Last orders signed off', key: "Fairweather's Signature", needed: 1, place: 'Build-A-Blaster' },
    influencer: { duty: 'Car park cleared', key: "Skylar's Van Keys" },
  },
  // The PA introduces the checklist once per run, this long after round 1 is announced: after the run's opening line
  // (game/runIntro.js, feel.runIntro), whose longest line stays up about 7 s.
  briefing: { delaySeconds: 8 },
  pa: {
    briefing: {
      kicker: 'Closing time',
      text: 'Attention associates. The mall cannot close until the closing checklist is done. The key for each line is carried by a member of staff.',
    },
    drop: (key) => ({ kicker: 'Closing time', text: key + ' is on the floor. Associates, please collect it for the closing checklist.' }),
    // The Van Keys tick nothing by themselves: line 4 is ticked by the win (game/createGame.js onRunWon).
    // keep: these line-opening and line-complete messages are never dropped from the PA queue (ui/announcements.js).
    vanKeys: (key) => ({ kicker: 'Closing time', keep: true, text: key + ' collected. Finish the duties, then validate parking at the ticket machine by the van.' }),
    openFountain: (key, needed) => ({ kicker: 'Closing time', keep: true, text: `${key} collected. Use the Electrified Fountain in the Grand Atrium to take out ${needed} zombies.` }),
    openNightSafe: (key, needed) => ({ kicker: 'Closing time', keep: true, text: `${key} collected. Make ${needed} deposits at the Night Safe beside Customer Service.` }),
    completeNightSafe: { kicker: 'Closing time', keep: true, text: 'Takings banked is checked off. Thank you, associates.' },
    completeFountain: { kicker: 'Closing time', keep: true, text: 'Water features off is checked off. Thank you, associates.' },
    openLastOrders: (key) => ({ kicker: 'Closing time', keep: true, text: `${key} collected. Collect a build or Restuff from Build-A-Blaster’s Naming Booth.` }),
    validated: { kicker: 'Closing time', keep: true, text: 'Parking validated. Attention associates: closing time is the next round.' },
    completeLastOrders: { kicker: 'Closing time', keep: true, text: 'Last orders signed off. Thank you, associates.' },
  },
  // The win receipt, and the two lines a later death receipt gains after a win (ui/screens.js).
  receipt: {
    shiftComplete: 'SHIFT COMPLETE',
    cashier: 'Cashier: YOU',
    stampComplete: 'Complete',
    woreOnShift: 'WORE ON SHIFT',
    thanks: 'Thank you for closing Sunset Galleria.',
    clockedOut: 'CLOCKED OUT',
    overtimeRounds: 'Overtime rounds survived',
  },
  overtimeTag: 'OVERTIME', // beside the round counter while overtime is played (ui/hud.js)
  // The Statistics screen (ui/screens.js): career wins, the fastest win, and the mark on a won shift in the recent list.
  stats: { wins: 'Shifts completed', fastestWin: 'Fastest close', noWin: '—', wonMark: 'CLOSED', wonTitle: 'Shift completed: the mall was closed' },
  lineProgress: (count, needed) => `${count}/${needed}`,
  receiptProgress: (done, total) => done + ' of ' + total,
  marker: { floorGap: 2, up: 'upstairs', down: 'downstairs' },
  visual: {
    hover: 0.47,
    spinSpeed: 1.5,
    color: 0xffcb5b,
    emissiveIntensity: 0.8,
    ring: { radius: 0.12, tube: 0.035, radialSegments: 6, tubularSegments: 12 },
    shaft: { size: [0.07, 0.30, 0.065], at: [0, -0.26, 0] },
    teeth: [
      { size: [0.11, 0.06, 0.065], at: [0.07, -0.30, 0] },
      { size: [0.15, 0.06, 0.065], at: [0.075, -0.38, 0] },
    ],
    signature: {
      paper: { size: [0.26, 0.36, 0.035], at: [0, -0.12, 0] },
      ink: { size: [0.16, 0.035, 0.045], at: [0, -0.19, 0] },
      inkColor: 0x392940,
    },
  },
};
