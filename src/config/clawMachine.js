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

  // The mall PA ({area} = the new site's area). (game/features/clawMachine.js emits them as 'clawClosed' / 'clawMoved'.)
  pa: {
    plush: { kicker: 'Attention shoppers', text: 'GRAB-A-GUN is temporarily out of service. Sunny has been informed.' },
    soldOut: { kicker: 'Attention shoppers', text: 'GRAB-A-GUN is sold out. A restock is on its way. Nobody knows where.' },
    moved: { kicker: 'Attention shoppers', text: "GRAB-A-GUN is now in {area}. We don't know how either." },
    restocked: { kicker: 'Attention shoppers', text: 'GRAB-A-GUN has been restocked in {area}. Same machine. Same odds.' },
  },

  screen: {
    idle: 'HOLD TO PLAY',
    closed: 'OUT OF SERVICE',
    soldOut: 'SOLD OUT',
    away: 'BACK SOON',
    lifting: 'GOOD LUCK',
    prize: 'TAKE IT',
    empty: 'BETTER LUCK',
  },
};
