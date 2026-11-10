export const closingTime = {
  title: 'Closing checklist',
  van: {
    name: "Skylar's van", verb: 'start the van', priceLabel: 'Free',
    blockedPrefix: 'Still needed: ',
    promptHeight: 1.2, clearance: 0.12,
  },
  lines: {
    janitor: { duty: 'Water features off', key: "Murray's Key Ring", needed: 12 },
    guard: { duty: 'Takings banked', key: "Kettle's Safe Key" },
    manager: { duty: 'Last orders signed off', key: "Fairweather's Signature" },
    influencer: { duty: 'Car park cleared', key: "Skylar's Van Keys" },
  },
  pa: {
    drop: (key) => ({ kicker: 'Closing time', text: key + ' is on the floor. Associates, please collect it for the closing checklist.' }),
    collect: (key, duty) => ({ kicker: 'Closing time', text: key + ' collected. ' + duty + ' is checked off.' }),
    openFountain: (key, needed) => ({ kicker: 'Closing time', text: `${key} collected. Use the Electrified Fountain in the Grand Atrium to take out ${needed} zombies.` }),
    completeFountain: { kicker: 'Closing time', text: 'Water features off is checked off. Thank you, associates.' },
  },
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
