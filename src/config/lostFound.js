// =============================================================================
// LOST AND FOUND: one piece of lost property hidden in each area (game/features/lostProperty.js), picked up with a hold
// of the use key and logged for good in the Survival Guide's record (game/guideSave.js `found`; game/lostFound.js).
// Each has one line on its tag; together they tell what happened on the day the mall did not close, and finding all of
// them opens the last page of the guide (`report`). Nothing here pays points or changes a run.
// FIXED spots, on purpose (the user's decision): a place you have looked stays looked at. No hints either.
// A spot is `at` [x, y, z] in metres (y = the floor it lies on, or the height it hangs at). tests/lostFound.test.js checks
// every spot is clear of solid things, within reach of somewhere you can stand, and far enough from every other prompt
// (a wardrobe rack, a counter, a door) that standing there offers THIS item.
// A model is a few boxes: { size [w, h, d], at [x, y, z] from the spot, color, tilt? (radians about x), glow? } or
// { ball: radius, at, color }. The yellow property tag is added to every item by the builder.
// =============================================================================

const paper = 0xf4f1e8, steel = 0x9aa0a8, dark = 0x2c272c;

export const lostFound = {
  items: [
    {
      id: 'badge', name: 'Trainee name badge', zone: 'startRoom', area: 'Start Room', at: [4.25, 0, 6.75], facing: 2.4, cue: 'lostGlint',
      tag: 'Reads TRAINEE. First day. Was told it would be quiet.',
      parts: [
        { size: [0.22, 0.3, 0.02], at: [0, 0.16, 0], color: paper, tilt: -0.45 },
        { size: [0.2, 0.08, 0.024], at: [0, 0.25, 0.045], color: 0xc0392b, tilt: -0.45 },
        { size: [0.07, 0.05, 0.03], at: [0, 0.31, 0.075], color: steel, tilt: -0.45 },
      ],
    },
    {
      id: 'balloon', name: "Child's balloon", zone: 'hallway', area: 'Main Hallway', at: [19.25, 1.9, 5.25], facing: 0, cue: 'lostCreak',
      tag: 'Tied to nothing. Nobody came back for it.',
      parts: [
        { ball: 0.24, at: [0, 0.1, 0], color: 0xe2473f },
        { size: [0.05, 0.06, 0.05], at: [0, -0.16, 0], color: 0xb5322c },
        { size: [0.01, 1.07, 0.01], at: [0, -0.71, 0], color: paper },
        { size: [0.1, 0.03, 0.1], at: [0, -1.25, 0], color: steel }, // (on the floor: the spot is 1.9 m up and the model is drawn 1.5x)
      ],
    },
    {
      id: 'pager', name: 'Order pager', zone: 'foodCourt', area: 'Food Court', at: [-11.75, 0, -7.55], facing: 0.7, cue: 'lostBeep',
      tag: 'Order 47 is ready. Order 47 has been ready for some time.',
      parts: [
        { size: [0.16, 0.05, 0.24], at: [0, 0.025, 0], color: dark },
        { size: [0.13, 0.012, 0.05], at: [0, 0.056, -0.07], color: 0xff3b30, glow: true },
        { size: [0.1, 0.012, 0.07], at: [0, 0.056, 0.04], color: 0x6b6f76 },
      ],
    },
    {
      id: 'list', name: 'Shopping list', zone: 'megaMart', area: 'Mega Mart', at: [33.25, 0, -23.5], facing: -0.5, cue: 'lostFlutter',
      tag: 'Everything crossed off but the last line: "be out by six".',
      parts: [
        { size: [0.2, 0.006, 0.32], at: [0, 0.004, 0], color: paper },
        { size: [0.14, 0.004, 0.014], at: [0, 0.01, -0.1], color: dark },
        { size: [0.12, 0.004, 0.014], at: [-0.01, 0.01, -0.05], color: dark },
        { size: [0.15, 0.004, 0.014], at: [0, 0.01, 0], color: dark },
        { size: [0.11, 0.004, 0.02], at: [-0.02, 0.01, 0.09], color: 0xb3262b },
      ],
    },
    {
      id: 'flask', name: "Murray's flask", zone: 'serviceCorridor', area: 'Service Corridor', at: [-22.75, 0, -13.25], facing: 0, cue: 'lostGlint',
      tag: 'Thirty-one years of tea. Still warm.',
      parts: [
        { size: [0.11, 0.26, 0.11], at: [0, 0.13, 0], color: 0x2f7f7a },
        { size: [0.115, 0.03, 0.115], at: [0, 0.2, 0], color: steel },
        { size: [0.08, 0.07, 0.08], at: [0, 0.295, 0], color: steel },
      ],
    },
    {
      id: 'coin', name: 'Wishing coin', zone: 'atrium', area: 'Grand Atrium', at: [23.25, 0, 17.35], facing: 0, cue: 'lostGlint',
      tag: 'Fell short of the fountain. Somebody made a wish. See the rest of this binder.',
      parts: [
        { size: [0.13, 0.016, 0.13], at: [0, 0.008, 0], color: 0xe0aa22, glow: true },
        { size: [0.07, 0.006, 0.07], at: [0, 0.019, 0], color: 0xffd65a, glow: true },
      ],
    },
    {
      id: 'shoe', name: 'One unpaid shoe', zone: 'upstairs', area: 'Sunset Promenade', at: [16.75, 6.3, 5.25], facing: 1.1, cue: 'lostFlutter',
      tag: 'Left foot, size nine, security tag attached. The right one was seen leaving at speed.',
      parts: [
        { size: [0.12, 0.03, 0.3], at: [0, 0.015, 0], color: paper },
        { size: [0.115, 0.1, 0.19], at: [0, 0.08, 0.05], color: 0xd62839 },
        { size: [0.115, 0.06, 0.11], at: [0, 0.06, -0.095], color: 0xd62839 },
        { size: [0.03, 0.012, 0.1], at: [0, 0.135, 0.02], color: paper },
      ],
    },
    {
      id: 'hand', name: "Mannequin's hand", zone: 'departmentStore', area: "Hoffman's", at: [-14.25, 0, 22.8], facing: -0.9, cue: 'lostCreak',
      tag: 'Holding a price tag. It was not holding that yesterday.',
      parts: [
        { size: [0.07, 0.16, 0.06], at: [0, 0.08, 0], color: 0xe9dfc8 },
        { size: [0.1, 0.11, 0.04], at: [0, 0.215, 0], color: 0xe9dfc8 },
        { size: [0.02, 0.09, 0.03], at: [-0.038, 0.31, 0], color: 0xe9dfc8 },
        { size: [0.02, 0.1, 0.03], at: [-0.013, 0.315, 0], color: 0xe9dfc8 },
        { size: [0.02, 0.095, 0.03], at: [0.013, 0.312, 0], color: 0xe9dfc8 },
        { size: [0.02, 0.08, 0.03], at: [0.038, 0.305, 0], color: 0xe9dfc8 },
        { size: [0.08, 0.05, 0.006], at: [0.02, 0.24, -0.03], color: 0xc45177 },
      ],
    },
    {
      id: 'stub', name: 'Cinema ticket stub', zone: 'cinema', area: 'Sunset Cinema', at: [-35.75, 6.3, -10], facing: 0.4, cue: 'lostFlutter',
      tag: 'Screen 2, one adult. The film is still running.',
      parts: [
        { size: [0.09, 0.006, 0.2], at: [0, 0.004, 0], color: 0xf2a33a },
        { size: [0.09, 0.007, 0.03], at: [0, 0.005, 0.07], color: 0xb3262b },
        { size: [0.05, 0.007, 0.07], at: [0, 0.005, -0.03], color: dark },
      ],
    },
    {
      id: 'plush', name: 'Half-stuffed bear', zone: 'upstairs', area: 'Build-A-Blaster', at: [-9, 6.3, 24.75], facing: 2.2, cue: 'lostCreak',
      tag: 'With a card: "For Danny, age 7". Collection was never arranged.',
      parts: [
        { size: [0.22, 0.2, 0.15], at: [0, 0.1, 0], color: 0xa9713d, tilt: 0.25 },
        { size: [0.13, 0.11, 0.02], at: [0, 0.11, -0.085], color: 0xd9b382, tilt: 0.25 },
        { size: [0.18, 0.16, 0.15], at: [0, 0.27, -0.045], color: 0xa9713d },
        { size: [0.06, 0.06, 0.04], at: [-0.08, 0.37, -0.045], color: 0x8a5a2e },
        { size: [0.06, 0.06, 0.04], at: [0.08, 0.37, -0.045], color: 0x8a5a2e },
        { size: [0.07, 0.05, 0.03], at: [0, 0.25, -0.13], color: 0xd9b382 },
        { size: [0.16, 0.006, 0.11], at: [0.2, 0.004, 0.02], color: paper },
      ],
    },
    {
      id: 'keys', name: 'Car keys', zone: 'parkingLot', area: 'Customer Parking', at: [61.8, 0, -23.5], facing: 0.3, cue: 'lostGlint',
      tag: 'Loyalty fob: L. PRUITT. Reward if found. She has been looking for some time.',
      parts: [
        { size: [0.07, 0.012, 0.07], at: [0, 0.006, 0], color: steel },
        { size: [0.025, 0.01, 0.11], at: [0.03, 0.006, 0.08], color: steel },
        { size: [0.025, 0.01, 0.1], at: [-0.04, 0.006, 0.07], color: steel, glow: true },
        { size: [0.06, 0.016, 0.1], at: [0.01, 0.008, -0.085], color: 0xc45177 },
      ],
    },
  ],

  // The yellow property tag every item wears: it pulses, so an item can be told from litter. `logged` = how an item you
  // already have looks (it stays where it was, faded, with a still tag).
  look: {
    scale: 1.5, // (a little larger than life: these are found in the first person, mid-fight)
    tag: { size: [0.11, 0.075, 0.008], lift: 0.14, color: 0xffe66e, glow: 0xffc928, pulseRate: 2.4, pulseMin: 0.35, pulseMax: 1.6, string: 0xf4f1e8 },
    logged: { opacity: 0.32, tagGlow: 0.12 },
    roughness: 0.75,
  },
  // A quiet sound when you are near one you have not logged (each item names its own `cue`): louder as you close in.
  cue: { radius: 9, levelTolerance: 2.5, everySeconds: 2.6, minVolume: 0.25, maxVolume: 1 },
  pickup: {
    holdSeconds: 0.6, promptHeight: 0.4, verb: 'log', priceLabel: 'Lost property', sound: 'lostPickup',
    assisted: 'Not logged on an assisted shift',
  },
  pa: (name, found, total) => ({
    kicker: 'Lost property',
    text: found >= total
      ? `${name} logged. That is all ${total}. The Survival Guide has one more page for you.`
      : `${name} logged. ${found} of ${total} items recovered. Thank you for your honesty.`,
  }),
  // The last page of the guide, once everything is logged: the day, pieced together from what was dropped.
  report: {
    title: 'Incident summary', subtitle: 'Day of closure · compiled from lost property',
    lines: [
      'A trainee started their first shift that morning and was told it would be quiet.',
      'The Food Court took orders until the afternoon. Number 47 was never collected.',
      'A film started in Screen 2. Nobody stopped it. A bear was stuffed for a boy called Danny, and nobody came for it.',
      'Somebody made a wish at the fountain and missed. A balloon was let go and nobody reached for it.',
      'One shopper in Mega Mart had a single thing left on the list: be out by six.',
      'At six the shutters came down with everyone still inside. The night janitor had just made his tea.',
      'One customer was outside, looking for her car keys. She had a receipt. She has been waiting to come back in ever since.',
    ],
    conclusion: 'Conclusion: the mall did not close that day. On review, the mall has never closed.',
    signed: 'Signed on behalf of management:',
  },
};

const byId = new Map(lostFound.items.map((item) => [item.id, item]));
export const lostItem = (id) => byId.get(id) ?? null;
