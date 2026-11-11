// =============================================================================
// THE RETURN: how you get Return to Sender (game/returnQuest.js). A hidden quest, COD-Easter-egg style: the mall's
// returns procedure, followed literally. NOT on the closing checklist and never pointed at in either run mode; the
// only trail is what the Returns Desk's own prompt says at each stage, one in-world PA line per step, and the order
// pager in Lost and Found ("Order 47").
//   1. policy   shoot every NO REFUNDS floor sign (`signs`)                     -> the desk accepts damaged goods
//   2. damaged  make a charging zombie crash near the desk (`crash`)            -> a dented parcel on the tray
//   3. ticket   take a number at the desk, then get that many kills near it     -> your number is called
//   4. collect  the gun, free (and free again if you lose it)
// One run only: nothing here is permanent. The duties of the closing checklist stay required to win and no longer gate
// the gun; each of the three working duties awards a RETURN LABEL (`labels`), a variant of the gun's behaviour, fitted
// one at a time at the desk's label slot. The claw machine still pays the gun out as its rarest prize.
// Sign spots are `at` [x, y, z] on the floor; tests/returnQuest.test.js checks each is clear of solid things.
// =============================================================================

export const returnQuest = {
  weaponId: 'returnToSender',
  levelTolerance: 3, // metres of height: "near the desk" means on its floor

  signs: [
    { id: 'startRoom', zone: 'startRoom', at: [-4.5, 0, 13.25], facing: 1.2 },
    { id: 'hallway', zone: 'hallway', at: [19.25, 0, -1.5], facing: -0.8 },
    { id: 'foodCourt', zone: 'foodCourt', at: [8.75, 0, -13.8], facing: 0.3 },
    { id: 'megaMart', zone: 'megaMart', at: [20.75, 0, -23.5], facing: 0.6 },
  ],
  // A yellow A-frame floor sign. `hitbox`: the box a shot must hit (half-width, height). It falls flat when shot.
  sign: {
    text: 'NO REFUNDS', subtext: 'ALL SALES FINAL',
    board: { width: 0.5, height: 0.78, thickness: 0.03, lean: 0.24, color: 0xf2c230, edge: 0x2c272c },
    print: { width: 0.42, height: 0.3, y: 0.5, lift: 0.004, background: '#f2c230', color: '#2c272c', aspect: 1.4 },
    hitbox: { halfWidth: 0.3, height: 0.85 },
    fallSeconds: 0.35, fallAngle: 1.5, splat: [0xf2c230, 0x2c272c, 0xf4f1e8],
    sound: 'refundSignDown',
  },
  crash: { radius: 4.5 },
  ticket: { number: 47, queueRadius: 14 },
  // The dented parcel on the desk's tray, from step 2 on (metres from the desk's prompt point; the desk faces -Z).
  parcel: {
    parts: [
      { size: [0.3, 0.18, 0.22], at: [0.12, -0.29, 0.2], color: 0xb98a54, tilt: 0.08 },
      { size: [0.31, 0.03, 0.06], at: [0.12, -0.29, 0.2], color: 0xe2d2a8, tilt: 0.08 },
      { size: [0.1, 0.07, 0.004], at: [0.05, -0.26, 0.085], color: 0xb3262b },
    ],
  },

  // What the Returns Desk's prompt says at each stage (the faint trail). `blocked` lines cannot be used.
  desk: {
    policy: 'Policy: no refunds',
    damaged: 'Report damaged goods here',
    // `title` is what the HUD's prompt shows in bold ("Hold <title> · Free").
    ticket: { title: 'Take a number', label: 'Now serving', verb: 'take a number', priceLabel: 'Free' },
    queue: (served, number) => `Now serving ${served} · you hold ${number}`,
    collect: { title: (gun) => `Collect ${gun}`, verb: 'collect', priceLabel: 'Free' },
    holdSeconds: 0.5,
  },
  pa: {
    policy: { kicker: 'Customer Service', text: 'Attention associates. The refund policy is under review. Damaged goods may now be reported at the Returns Desk.' },
    damaged: { kicker: 'Customer Service', text: 'Damaged goods have been reported at the Returns Desk. Customers with a return, please take a number.' },
    ticket: (number) => ({ kicker: 'Returns Desk', text: `You hold number ${number}. Please wait near the desk. Your custom is important to us.` }),
    called: (number) => ({ kicker: 'Returns Desk', keep: true, text: `Now serving number ${number}. Number ${number} to the Returns Desk, please.` }),
    collect: { kicker: 'Returns Desk', text: 'Return accepted. One returns scanner has been issued in exchange. All returns are final.' },
  },

  // RETURN LABELS: one per working duty of the closing checklist (`duty` = its line id in config/closingTime.js).
  // A fitted label acts on every zombie the gun RETURNS (never a boss or a Mascot, which cannot be returned).
  //   chain   also returns the nearest `count` returnable zombies within `radius`, whatever they are
  //   refund  pays `points` per return, and `ammoChance` of the time hands a round back to the reserve
  //   recall  also returns up to `count` zombies of the same kind as the target within `radius`
  labels: {
    chain: { duty: 'janitor', name: 'Chain Return', blurb: 'Also returns the two nearest', count: 2, radius: 6 },
    refund: { duty: 'guard', name: 'Full Refund', blurb: 'Pays extra, sometimes a round back', points: 75, ammoChance: 0.25 },
    recall: { duty: 'manager', name: 'Product Recall', blurb: 'Also returns more of the same kind', count: 4, radius: 7 },
  },
  plainName: 'No label',
  labelPa: (name) => ({ kicker: 'Returns Desk', keep: true, text: `A return label has been issued: ${name}. Labels are fitted at the Returns Desk.` }),
  // The second prompt on the desk: cycles through the labels held (the gun must be in hand).
  slot: {
    title: 'Label slot', verb: 'fit', priceLabel: 'Free', holdSeconds: 0.3,
    label: (name) => `Fit: ${name}`,
    offset: [0.85, -0.32, 0], // from the desk's prompt point: along the wall, down to the tray
    sound: 'returnStamp',
    // A small label printer on the wall beside the desk (from the desk's prompt point; its back stays 2 cm off the wall).
    parts: [
      { size: [0.26, 0.3, 0.14], at: [0.85, -0.3, 0.33], color: 0x253e4d },
      { size: [0.2, 0.05, 0.02], at: [0.85, -0.36, 0.25], color: 0x151f2c },
      { size: [0.16, 0.1, 0.006], at: [0.85, -0.42, 0.245], color: 0xffe66e },
    ],
  },
};

export const returnLabel = (id) => (Object.hasOwn(returnQuest.labels, id) ? returnQuest.labels[id] : null);
