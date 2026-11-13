// Shared visual construction; finishes are cosmetic, keyed by the existing door IDs.
// Prices, zones and opening speed still belong to economy.js / feel.js.
// `opening` is the buy moment (game/doorOpenings.js announces it; world/shutter.js, game/shutterSounds.js,
// fx/doorOpenView.js, core/haptics.js and the PA show it). All cosmetic: the real roll (feel.world.shutterOpenSeconds)
// and the tick the doorway's collider goes are untouched.
export const shutters = {
  pixelsPerMetre: 160,
  slatHeight: .16,
  paint: { roughness: .76, metalness: .12 },
  track: {
    width: .075,
    extraDepth: .08,
    housingHeight: .27,
    housingOverhang: .07,
    // Keep decorative frame faces clear of the wall/floor planes. Exact shared planes
    // shimmer at shallow angles once the static map is batched for rendering.
    frameClearance: .008,
    channelLift: .006,
    signOffset: .1,
  },
  bottomRailHeight: .065,
  handleHeight: .56,
  // Each finish has an opening `profile` (opening.profiles): how it sounds and shakes when it goes up.
  finishes: {
    public: { base: '#e5e1d1', accent: '#7faeaa', ink: '#46505a', heading: 'TEMPORARILY CLOSED',
      notice: 'YOUR PATIENCE IS CONTRACTUALLY REQUIRED.', seed: 13, profile: 'roll' },
    clearance: { base: '#e8dcc0', accent: '#b96c87', ink: '#5e4051', heading: 'OPENING SHORTLY',
      notice: 'PLEASE CONTINUE SPENDING.', sticker: 'BACK IN 5', seed: 27, profile: 'rattly' },
    foodCourt: { base: '#eee1c9', accent: '#6faaa3', ink: '#355a59', heading: 'TEMPORARILY CLOSED',
      notice: 'CUSTOMER SATISFACTION IN PROGRESS.', seed: 43, profile: 'roll' },
    mart: { base: '#dfe3de', accent: '#698faa', ink: '#374b67', heading: 'STOCK CONTROL',
      notice: 'MORE SAVINGS ARE BEING PREPARED.', sticker: 'FINAL CHECK', seed: 61, profile: 'roll' },
    atrium: { base: '#eae1cf', accent: '#ac93b5', ink: '#5a4165', brass: true, heading: 'OPENING SHORTLY',
      notice: 'THANK YOU FOR YOUR INDEFINITE PATIENCE.', seed: 79, profile: 'grand' },
    staff: { base: '#aab6a6', accent: '#667a70', ink: '#344b43', heading: 'ACCESS RESTRICTED',
      notice: 'AUTHORIZED PERSONNEL. AUTHORIZED SMILES.', sticker: 'INSPECTED 1986', seed: 97, profile: 'service' },
    department: { base: '#efe2cd', accent: '#8c2f45', ink: '#4a1d2a', brass: true, heading: 'GRAND OPENING',
      notice: "HOFFMAN'S. EST. FOREVER.", sticker: 'NOW HIRING', seed: 131, profile: 'grand' },
    cinema: { base: '#dfc6ce', accent: '#82516e', ink: '#49364f', brass: true, heading: 'FEATURE PRESENTATION',
      notice: 'YOUR SEAT IS RESERVED. FOREVER.', sticker: 'ADMIT ONE', seed: 113, profile: 'grand' },
  },
  opening: {
    // The curtain is DRAWN at height * (1 - (1 - p)^rollEase) for real progress p: it leaps off the floor and settles
    // into the housing, and is never drawn lower than the real roll (so nobody walks through a painted curtain).
    rollEase: 2.2,
    // A free connection (it opens because you now own both sides) gets the light version: this much shake and dust,
    // only its end clunk at `lightVolume`, and no glow, nudge, rumble or PA.
    lightScale: .4,
    lightVolume: .35,
    // When a BOUGHT barrier clunks fully open within `range` metres of you: a small kick of the view (radians).
    nudge: { range: 10, pitch: .004, roll: .012 },
    // Dust (fx/doorOpenView.js, through effects.splat): puffs along the floor line as it lifts, a fall from the
    // housing when it clunks home. perMetre = puff spots per metre of doorway; count = particles per spot.
    dust: { colors: [0xb8b0a4, 0xd4ccbc, 0x8f877b], perMetre: 1.2, count: 3, speedScale: .32, topCount: 2, maxSpots: 9 },
    // Light from the newly opened area spilling through the doorway: an additive card in the opening and a tongue
    // of light on your side's floor (two pooled meshes per slot; no real lights). It follows the REAL roll: full by
    // `rise` of it (a share), held while it rolls, then fades over `tail` seconds once it is up (or slammed shut).
    glow: { rise: .35, tail: .5, peak: .32, floorPeak: .22, floorDepth: 3.4, slots: 2 },
    // The light's colour by the area that just opened (fallback: `color`).
    glowColor: { color: 0xfff0d8, hallway: 0xfff2d8, foodCourt: 0xffd79a, megaMart: 0xe2f2ff, serviceCorridor: 0xd2ffe2,
      atrium: 0xfff1d2, upstairs: 0xffc7a2, cinema: 0xff9fd8, departmentStore: 0xffe6c0, parkingLot: 0xff9c5e },
    // A barrier that is not a shutter (the escalator's OUT OF ORDER rope) uses this profile.
    otherBarrier: 'repair',
    // How each kind of barrier opens. Sounds are config/audio.js names; unlock + motor play on the purchase, a roll
    // tick every rollInterval seconds while it rises, stop (the heavy end clunk) when it is fully up.
    // shake: the curtain rattles sideways for `seconds` (amplitude metres, hz) as the motor catches.
    profiles: {
      rattly: { unlock: 'shutterLatchTin', motor: 'shutterMotorLight', roll: 'shutterRollTin', rollInterval: .11,
        stop: 'shutterStopTin', shake: { seconds: .45, amplitude: .03, hz: 21 }, dustScale: 1.2 }, // the start room's cheap clearance shutter
      roll: { unlock: 'shutterLatch', motor: 'shutterMotor', roll: 'shutterRoll', rollInterval: .16,
        stop: 'shutterStop', shake: { seconds: .3, amplitude: .018, hz: 16 }, dustScale: 1 }, // a store's roll-down grille
      service: { unlock: 'shutterBolt', motor: 'shutterMotorHeavy', roll: 'shutterRollHeavy', rollInterval: .2,
        stop: 'shutterStopHeavy', shake: { seconds: .38, amplitude: .012, hz: 11 }, dustScale: 1.5 }, // a steel staff door: dusty
      grand: { unlock: 'shutterChime', motor: 'shutterMotor', roll: 'shutterRollSmooth', rollInterval: .14,
        stop: 'shutterStopBrass', shake: { seconds: .2, amplitude: .008, hz: 14 }, dustScale: .6 }, // a brass-trimmed storefront
      repair: { unlock: 'escalatorStartup', motor: null, roll: null, rollInterval: 0,
        stop: null, shake: null, dustScale: .8 }, // the escalator: it spins up (the clunk is in the startup sound)
    },
    // The PA's welcome the FIRST time an area is opened in a run (game/doorOpenings.js; never for a free connection,
    // never on a load). `ifQuiet`: the HUD drops it instead of queueing when another PA line is showing or waiting.
    welcome: {
      kicker: 'Now open',
      priority: 0,
      lines: {
        hallway: ['The Main Hallway is now open. Please keep moving. Everything else in it will.',
          'The Main Hallway is open for business. Business hours are no longer posted.'],
        foodCourt: ['The Food Court is now seating. Please do not feed the other diners.',
          'Welcome to the Food Court. Trays are to be returned. Customers are not.'],
        megaMart: ['Mega Mart is now open. Every aisle is a clearance aisle.',
          'Welcome to Mega Mart. Prices are low. So is staffing.'],
        serviceCorridor: ['The Service Corridor is staff only. You are staff now. Congratulations on the promotion.',
          'You have entered the Service Corridor. Please do not tell management. Management already knows.'],
        atrium: ['The Grand Atrium is now open. Please admire the fountain from a reasonable distance.',
          'Welcome to the Grand Atrium. Coins in the fountain are non-refundable. So are wishes.'],
        upstairs: ['The Sunset Promenade is now open. Please stand on the right. Run on the left.',
          'Level two is now open. Please mind the railing. The railing will not mind you.'],
        cinema: ['Sunset Cinema is now seating. Please silence your phone and your screaming.',
          'The Sunset Cinema welcomes you. Tonight\'s feature has no end credits.'],
        departmentStore: ["Hoffman's is now open. Fitting rooms are one customer only. Make sure it is you.",
          "Welcome to Hoffman's. Quality since forever. Returns since recently."],
        parkingLot: ['Customer Parking is now open. Please lock your vehicle. Please lock yourself in it.',
          'Customer Parking is open. The mall is not responsible for anything out there. Or in here.'],
      },
    },
  },
  doors: { startShutter: 'clearance', foodCourt: 'foodCourt', serviceCorridor: 'staff', megaMart: 'mart',
    parkingLot: 'staff',
    foodCourtMegaMart: 'mart', serviceCorridorFoodCourt: 'staff', atrium: 'atrium', atriumPromenade: 'atrium', atriumMegaMart: 'mart', cinema: 'cinema', cinemaStairs: 'staff',
    departmentStore: 'department', departmentStoreStartRoom: 'department' },
};

export function shutterFinish(id) {
  return shutters.finishes[Object.hasOwn(shutters.doors, id) ? shutters.doors[id] : 'public'];
}
