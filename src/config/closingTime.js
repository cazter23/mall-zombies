export const closingTime = {
  title: 'Closing checklist',
  van: {
    name: "Skylar's van", verb: 'start the van', priceLabel: 'Free',
    blockedPrefix: 'Still needed: ',
    promptHeight: 1.2, clearance: 0.12,
  },
  nightSafe: {
    name: 'Night Safe',
    verb: 'deposit',
    done: 'Done',
    complete: 'Takings banked',
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
    janitor: { duty: 'Water features off', key: "Murray's Key Ring", needed: 12 },
    guard: { duty: 'Takings banked', key: "Kettle's Safe Key", needed: 4 },
    manager: { duty: 'Last orders signed off', key: "Fairweather's Signature", needed: 1 },
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
    vanKeys: (key) => ({ kicker: 'Closing time', text: key + ' collected. Start the van to finish closing.' }),
    openFountain: (key, needed) => ({ kicker: 'Closing time', text: `${key} collected. Use the Electrified Fountain in the Grand Atrium to take out ${needed} zombies.` }),
    openNightSafe: (key, needed) => ({ kicker: 'Closing time', text: `${key} collected. Make ${needed} deposits at the Night Safe beside Customer Service.` }),
    completeNightSafe: { kicker: 'Closing time', text: 'Takings banked is checked off. Thank you, associates.' },
    completeFountain: { kicker: 'Closing time', text: 'Water features off is checked off. Thank you, associates.' },
    openLastOrders: (key) => ({ kicker: 'Closing time', text: `${key} collected. Collect a build or Restuff from Build-A-Blaster’s Naming Booth.` }),
    completeLastOrders: { kicker: 'Closing time', text: 'Last orders signed off. Thank you, associates.' },
  },
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
