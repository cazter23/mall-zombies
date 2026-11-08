// =============================================================================
// GRAB-A-GUN, the claw machine (game/features/clawMachine.js; the cabinet: maps/mall/clawCabinet.js; the plan:
// docs/claw-machine-plan.md). Every number the machine uses. Its price is economy.claw (read through g.pricing).
//
// A grab: pay (hold), three capsules fall into the pit, one per lane, and the claw sweeps over them. Press interact once
// to drop it (or it drops by itself after autoDropSeconds); the capsule under it is the prize. It lifts, the gun sits in
// the chute for takeSeconds (hold to take), then the machine is ready again.
// =============================================================================

export const clawMachine = {
  name: 'GRAB-A-GUN',
  lanes: 3,

  // The prize pool: weight (how likely, drawn without repeats in one grab) and capsule (its rarity colour).
  // The Staple Gun is never a prize (the Courtesy Loaner relies on it never being bought again).
  prizes: {
    priceGun: { weight: 26, capsule: 'green' },
    nailGun: { weight: 22, capsule: 'green' },
    foamDartBlaster: { weight: 18, capsule: 'blue' },
    confettiCannon: { weight: 12, capsule: 'blue' },
    rivetRifle: { weight: 12, capsule: 'blue' },
    barcodeScanner: { weight: 7, capsule: 'purple' },
    coilNailer: { weight: 3, capsule: 'gold' },
  },
  capsules: {
    green: { color: 0x58c46b, label: 'GREEN' },
    blue: { color: 0x3a86ff, label: 'BLUE' },
    purple: { color: 0x9b6bff, label: 'PURPLE' },
    gold: { color: 0xffc83d, label: 'GOLD' },
  },

  // The sweep: the claw travels across the lanes and back. One trip there and back takes firstSeconds on a site's first
  // grab, stepSeconds less on each grab after, never under minSeconds. Each lane is a third of the travel, so on the first
  // grab the claw is over the middle lane about 0.4 s per pass and over an end lane 0.8 s (it turns round there).
  sweep: { firstSeconds: 2.4, stepSeconds: 0.2, minSeconds: 1.4 },
  autoDropSeconds: 6, // nothing pressed: it drops wherever it is (a grab can never hang)
  liftSeconds: 1.5, // down, grab, up and over to the chute (the prize was settled at the press)
  takeSeconds: 15, // the prize waits in the chute this long; then it's gone (no refund)

  // THE RELOCATION RULE. Each site has `stock` grabs (the screen counts down). From a site's third grab a plush (Sunny) may take
  // one lane: plushChance[n - 1] on its n-th grab. Land on him and the machine refunds what that grab charged and closes; sell
  // out and it closes once the last prize is taken or gone. It reopens at the next 'roundStart' at a random OTHER site whose
  // zone is open (after a plush the site is picked the moment he lands), or restocks where it stands if there is none.
  stock: 6,
  plushChance: [0, 0, 0.2, 0.4, 0.6, 0.8],
  plush: { name: 'Sunny', color: 0xffc21a, label: 'SUNNY' },

  // PRIZE TICKETS (game/tickets.js): what a grab prints. A bad grab prints more; a prize left in the chute until it's gone prints
  // nothing. By the prize's capsule (a Refurbished prize counts by its colour too).
  tickets: {
    capsules: { green: 40, blue: 25, purple: 15, gold: 5, rainbow: 5 },
    plush: 10, // (the money comes back as well)
    popSunny: 25, // shooting Sunny as he runs off (phase 7)
  },
  slowClawFactor: 2, // a Slow Claw token: the next grab's sweep takes this many times as long

  // THE PRIZE COUNTER (game/features/prizeCounter.js; its booth: maps/mall/prizeCounter.js). One fixed booth, five prizes, paid in
  // tickets (never points, never g.pricing). `site` passed the same headless checks as the cabinets (tests/prizeCounter.test.js).
  prizeCounter: {
    name: 'REDEMPTION',
    site: { zone: 'hallway', back: { x: 3.65, z: 6 }, faces: '-z', floorY: 0 }, // the Hallway's north wall, between the start shutter and Customer Service
    size: { width: 2.6, depth: 0.9, height: 2.3 },
    prizes: [ // left to right as you face it
      { id: 'ammo', name: 'Ammo refill', tickets: 60, blurb: 'Refills the gun in your hand, like a RESTOCK-O-MATIC' },
      { id: 'slowClaw', name: 'Slow Claw', tickets: 100, blurb: 'Your next grab sweeps at half speed' },
      { id: 'attachment', name: 'Attachment voucher', tickets: 150, blurb: 'A random attachment for an empty slot on the gun in your hand' },
      { id: 'freeGrab', name: 'Free grab token', tickets: 200, blurb: 'Your next grab costs nothing' },
      { id: 'keychain', name: 'Sunny plush keychain', tickets: 300, blurb: 'Purely decorative. Sunny disagrees' },
    ],
  },

  // THE SHOW: how the lift looks and sounds. None of it changes the prize, which was settled at the press.
  show: {
    lift: { down: 0.28, grip: 0.4, up: 0.68 }, // fractions of liftSeconds: down (prongs open), grip (they close), up, then over to the chute
    wobble: { amplitude: 0.035, hz: 5.5, scare: 0.6 }, // the carried capsule swings, worst just after `scare` (it nearly slips: it never does)
    flapSeconds: 0.5, // the chute flap swings open and shut as the prize lands
    soundRange: 14, // m: the machine's own sounds (jingle, lane ticks, motor) fade to nothing this far away
    hum: { range: 9, gain: 1 }, // the live machine's hum: an ambience voice (config/environment.js clawHum) that follows the machine
    attractSeconds: 3.5, // the idle screen's lines take turns
  },

  // The cabinet (maps/mall/clawCabinet.js): one solid collider, at least 2.1 m tall so it can't be stood on.
  cabinet: {
    width: 1.3, depth: 1.0, height: 2.2,
    prizeScale: 0.85, // the won gun's display in the chute
  },

  // The machine's sites: where its cabinets stand (`back` = the middle of the cabinet's back, on the wall; `faces` = the way
  // its front looks; floorY = the floor it stands on). The machine starts at the first one every run.
  // Each passed the headless checks (tests/clawMachine.test.js): one collider touching only its wall, a clear stand point zombies
  // can reach, zombie routes unchanged, no coplanar faces. Dust-sheeted ("BACK SOON") while the machine is elsewhere.
  sites: [
    { id: 'hallway', zone: 'hallway', back: { x: 8, z: -2 }, faces: '+z', floorY: 0 }, // between the Food Court gate and the Nail Gun
    { id: 'foodCourt', zone: 'foodCourt', back: { x: 8.5, z: -2.3 }, faces: '-z', floorY: 0 }, // between the RESTOCK-O-MATIC and Byte Me
    { id: 'megaMart', zone: 'megaMart', back: { x: 28, z: 6 }, faces: '-z', floorY: 0 }, // past the checkouts, where a real store keeps one
    { id: 'atrium', zone: 'atrium', back: { x: 27, z: 6.6 }, faces: '+z', floorY: 0 }, // the south arcade
    { id: 'cinema', zone: 'cinema', back: { x: -34.1, z: -10.5 }, faces: '+z', floorY: 6.3 }, // every cinema lobby has one (clear of the screen door's jamb)
    { id: 'parkingLot', zone: 'parkingLot', back: { x: 34.43, z: -8 }, faces: '+x', floorY: 0 }, // against the Mart's outside wall (its facade), in the sunset
  ],

  // The mall PA ({area} = the new site's area): one line of each list, at random. (game/features/clawMachine.js emits them as
  // 'clawClosed' / 'clawMoved'; createGame plays them with the chime.)
  pa: {
    plush: [
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN is temporarily out of service. Sunny has been informed.' },
      { kicker: 'Attention shoppers', text: 'A shopper has won Sunny. Sunny did not agree to this. GRAB-A-GUN is closed while we talk it through.' },
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN is out of order. Please do not make eye contact with the plush.' },
    ],
    soldOut: [
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN is sold out. A restock is on its way. Nobody knows where.' },
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN has run out of prizes. It still has plenty of claw.' },
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN is empty. Management thanks you for your enthusiasm, and for your points.' },
    ],
    moved: [
      { kicker: 'Attention shoppers', text: "GRAB-A-GUN is now in {area}. We don't know how either." },
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN has relocated to {area}. It did not take the escalator. It does not have legs.' },
      { kicker: 'Attention shoppers', text: 'Shoppers who enjoyed losing to GRAB-A-GUN can now do so in {area}.' },
    ],
    restocked: [
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN has been restocked in {area}. Same machine. Same odds.' },
      { kicker: 'Attention shoppers', text: 'GRAB-A-GUN in {area} has been restocked and the claw tightened. (The claw has not been tightened.)' },
    ],
  },

  // The machine's screen (three lines). The idle lines take turns ({price} = the grab's price right now).
  screen: {
    idle: 'HOLD TO PLAY',
    attract: [
      ["EVERYONE'S", 'A WINNER*', '{price} PTS'],
      ["TODAY'S", 'LUCKY', 'SHOPPER?'],
      ['NO REFUNDS', '(EXCEPT', 'SUNNY)'],
      ['THE CLAW', 'BELIEVES', 'IN YOU'],
    ],
    sweeping: 'DROP NOW!',
    lifting: 'HOLD ON...',
    prize: 'WINNER!*',
    closed: 'OUT OF ORDER',
    closedNote: 'SUNNY HAS BEEN INFORMED',
    soldOut: 'SOLD OUT',
    soldOutNote: 'RESTOCKING ELSEWHERE',
    away: 'BACK SOON',
    empty: 'BETTER LUCK',
  },
};
