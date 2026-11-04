// =============================================================================
// LOOK: art direction for the visual overhaul, "GRAND OPENING, FOREVER": a 1986 mall that never got the memo it's over.
// Lights on, pastels bright, neon buzzing, the PA still upbeat, and zombies shambling through it. The horror is how
// cheerful everything still is (corporate satire), not darkness. Darkness lives in the BACK of house and arrives with
// later rounds (step 7), not at the front. Zone palettes, neon, painted light, satire signage and clutter, as data. The
// HALLWAY is the reference room (maps/mall/hallwayLook.js builds it).
//
// Rules of the palette:
//   neon      hot pink / cyan / electric purple / sunset orange: signs, slogans, trim (lots of it)
//   base      bright 80s pastels: mint, peach, lavender walls, cream terrazzo, white ceiling, chrome trim
//   horror    in the details: a dead tube, goo on the shiny floor, a red emergency light by the staff door
//
// `runtime` is what the Graphics settings write (config/settings.js) and the map reads every tick (like
// atmosphere.ambient.enabled), so a change applies at once without rebuilding anything.
// =============================================================================

import { NEON_COLORS } from './neon.js';

export const look = {
  runtime: {
    neonGlow: true, // neon halos + painted light pools (Graphics > Neon glow)
    clutter: 'full', // decoration density: 'none' | 'some' | 'full' (Graphics > Clutter)
    zoneGrading: true, // per-area colour grading (Graphics > Zone lighting)
    vhs: 'off', // the VHS tape look: 'off' | 'subtle' | 'full' (Graphics > VHS filter; a style choice, off by default)
    horror: true, // the horror layer: lights dying, power cuts (Comfort > Horror lighting)
  },

  // THE HORROR LAYER (game/features/horror.js): the mall falls apart as the rounds climb. Visual only.
  horror: {
    fromRound: 5, // nothing before this round
    darkness: { perRound: 0.025, max: 0.2 }, // the whole mall's exposure falls this much per round past fromRound
    neonFailure: { perRound: 0.08, max: 0.6 }, // share of flickering neon (letters, tubes) that dies for good, per round
    lampDeaths: { everyRounds: 2, maxShare: 0.4, flickerSeconds: 2.5 }, // one more lamp dies every N rounds (it flickers first)
    powerCuts: {
      fromRound: 6,
      chance: 0.35, // per round
      delay: [10, 40], // seconds into the round
      seconds: [4, 6.5], // how long the area stays dark
      stutterSeconds: 0.8, // the power stutters back on at the end
    },
  },

  // THE VHS FILTER (fx/postProcessing.js VhsShader): a worn rental tape. Each number is at 'full'; 'subtle' scales them all.
  vhs: {
    strength: { off: 0, subtle: 0.5, full: 1 },
    scanlines: 0.14, // darkening between scanlines (one dark line every 2 screen pixels)
    bleed: 0.0028, // colour fringing: red and blue smeared sideways (fraction of the screen width)
    wobble: 0.0007, // the whole picture's gentle sideways waver
    grain: 0.05, // tape noise
    desaturate: 0.18, // tapes lose colour
    trackingBand: { height: 0.06, speed: 0.07, shift: 0.006, streaks: 0.25 }, // the bright rolling band of bad tracking
  },

  // ZONE LIGHTING (fx/zoneGrading.js): each area's grade; the view eases to the grade of the area the camera is in
  // (map.gradeZones says where they are). exposure scales the light (1 = as lit), tint multiplies the colour,
  // saturation 0 = grey / 1 = as is, contrast > 1 = deeper shadows, vignette = extra darkening at the screen edges (High only). Front of house stays bright; back of house goes dark.
  grading: {
    blendSeconds: 0.8, // how long a change of area takes to settle
    fallback: 'front', // anywhere outside every zone (the hallway)
    grades: {
      parkingLot: { exposure: 1.05, tint: [1.06, .98, .96], saturation: .94, contrast: 1.04 },
      front: { exposure: 1, tint: [1, 1, 1], saturation: 1.04, contrast: 1 },
      startRoom: { exposure: 0.97, tint: [1.03, 1, 0.94], saturation: 0.92, contrast: 1 }, // faded clearance store
      foodCourt: { exposure: 1.02, tint: [1.04, 1, 0.95], saturation: 1.06, contrast: 1 }, // warm and hungry
      megaMart: { exposure: 1, tint: [0.97, 1, 1.04], saturation: 0.98, contrast: 1.02 }, // cool fluorescent
      martBack: { exposure: 0.55, tint: [1.1, 0.88, 0.85], saturation: 0.8, contrast: 1.15, vignette: 0.2 }, // the stockroom walkway: dim, red
      serviceCorridor: { exposure: 0.42, tint: [0.88, 1.05, 0.8], saturation: 0.6, contrast: 1.2, vignette: 0.3 }, // back of house: dark, sick green
      level2: { exposure: 1, tint: [1.05, 0.98, 0.92], saturation: 1.03, contrast: 1 }, // the Sunset Promenade
      cinemaLobby: { exposure: 1.02, tint: [1.06, 1, .98], saturation: 1.02, contrast: 1.02 },
      cinemaScreen: { exposure: .82, tint: [.99, .96, 1.08], saturation: .94, contrast: 1.04 },
      cinemaService: { exposure: .70, tint: [.98, 1.03, 1.03], saturation: .85, contrast: 1.06 },
      atrium: { exposure: 1.03, tint: [1.05, 0.99, 0.92], saturation: 1.06, contrast: 1 }, // under the sunset skylight
      departmentStore: { exposure: 1.01, tint: [1.04, 1, 0.95], saturation: 1, contrast: 1.02 }, // HOFFMAN'S: warm, a little upscale
      powerCut: { exposure: 0.3, tint: [1.3, 0.5, 0.45], saturation: 0.55, contrast: 1.2, vignette: 0.35 }, // the horror layer: emergency red
    },
  },

  // The start room: a clearance store in its final week (for about forty years). Faded butter and raspberry, a neon
  // CLEARANCE that still buzzes, and a goodbye over the shutter you're about to buy. Its own dressing (startRoomDetails.js)
  // already has the litter, so no clutter here.
  startRoom: {
    wall: 0xf2e2bd, // faded butter
    wainscot: 0xd9768a, // faded raspberry
    rail: 0xd8dce4,
    band: 0x8ad0c8, // faded aqua
    signs: { thanks: NEON_COLORS.hotPink, clearance: NEON_COLORS.electricPurple },
    satire: {
      thanks: 'THANK YOU FOR SHOPPING!',
      clearance: 'CLEARANCE',
      closing: ['STORE CLOSING', 'Thank you for 40 wonderful years. And counting. And counting.'],
    },
  },

  hallway: {
    wall: 0xcfeae0, // pale mint (upper wall)
    wainscot: 0xb9a6dc, // lavender, 0 .. wainscotHeight
    wainscotHeight: 1.1,
    rail: 0xd8dce4, // chrome rail on top of the wainscot
    stripe: { color: 0xf7b39b, y0: 1.32, y1: 1.5 }, // a peach band above the rail
    ceiling: 0xf7f3ee,
    floor: { base: '#f1e7da', grout: '#ec9fc4', variation: 16, seed: 5 }, // cream terrazzo, pink grout lines
    lamp: { color: 0xfff0dc, intensity: 22, distance: 22 }, // warm white: the mall is OPEN
    panel: 0xfff8ee, // ceiling light panels: warm white (one is dead)
    panelGlow: 1.3,
    backing: '#2a1838', // dark panels behind neon on pastel walls (neon alone washes out on light colours)

    trimY: 3.4, // the neon trim tubes along the long walls
    trim: { north: NEON_COLORS.cyan, south: NEON_COLORS.hotPink },
    signs: {
      foodCourt: NEON_COLORS.hotPink,
      megaMart: NEON_COLORS.cyan,
      atrium: NEON_COLORS.sunsetOrange,
      staffOnly: NEON_COLORS.emergencyRed,
      storefront: NEON_COLORS.electricPurple,
      logo: NEON_COLORS.electricPurple,
      sun: NEON_COLORS.sunsetOrange,
      star: NEON_COLORS.hotPink,
      open: NEON_COLORS.hotPink,
      smile: NEON_COLORS.cyan,
    },

    // Painted light: soft additive glows under neon (no real lights). opacity = strength (subtle on bright walls).
    pools: { wallOpacity: 0.22, floorOpacity: 0.2, trimOpacity: 0.12 },

    // The corporate cheer (world/posterTextures.js + neon): every line is a little wrong.
    satire: {
      open: 'OPEN 24/7/365/FOREVER',
      smile: "SMILE! IT'S IN YOUR CONTRACT",
      customerBanner: ['THE CUSTOMER IS ALWAYS RIGHT', '(BEHIND YOU)'],
      familyBanner: ["WE'RE A FAMILY HERE", "(YOU CAN'T LEAVE)"],
      sunny: ['HAVE A SUNNY DAY!', 'Exits are for customers who have finished shopping.'],
      rewards: ['Galleria Rewards', 'Earn points for every shopper you serve!'],
      lostChildren: ['Lost Children', 'will be kept at Customer Service. Forever.'],
      wetFloor: ['Caution: Wet Floor', "Please don't ask what it is."],
    },

    // Clutter along the walls (world/scatter.js): kinds + weights, density per m2 at 'full'.
    clutter: {
      seed: 1986,
      perSquareMeter: 0.1,
      kinds: { receipts: 4, sodaCup: 2, shoppingBag: 2, popcorn: 1.5, puddle: 2, brokenGlass: 1, trashPile: 1, coins: 1.2, cassettes: 1, cautionTape: 0.6 },
    },
  },

  // The Food Court: the cheeriest room in the mall (peach, teal, coral), and the hungriest.
  foodCourt: {
    wall: 0xffd9c4, // peach
    wainscot: 0x74c7bd, // teal
    rail: 0xd8dce4,
    band: 0xff9f8b, // coral
    floor: { base: '#fbebd9', grout: '#6cc8bc', variation: 14, seed: 3 }, // cream terrazzo, teal grout
    trimY: 5.4,
    trim: NEON_COLORS.sunsetOrange,
    signs: { meat: NEON_COLORS.hotPink, eat: NEON_COLORS.cyan, refills: NEON_COLORS.electricPurple },
    satire: {
      meat: 'FRESH MEAT DAILY',
      eat: 'EAT · SHOP · REPEAT',
      refills: 'FREE REFILLS*',
      refillsSmall: ['*Of what?', 'Management reserves the right not to say.'],
      inspection: ['Health Inspection: A+', 'Inspector not seen since March.'],
      combo: ['TRY OUR NEW BRAINS COMBO!', '(CONTAINS BRAINS)'],
      seat: ['SEAT YOURSELF!', 'Tables are for paying customers. Mostly.'],
    },
    clutter: {
      seed: 1987,
      perSquareMeter: 0.07,
      kinds: { sodaCup: 4, popcorn: 3, receipts: 2, puddle: 2, trashPile: 1.5, shoppingBag: 1, overturnedChair: 0.8, coins: 0.8 },
    },
  },

  // The Mega Mart: a fluorescent big box, cool white and brand blue, still promising savings. Its back walkway (stockroom,
  // receiving) is back of house: a dying red emergency tube, and that's where the light goes.
  megaMart: {
    wall: 0xe8edf1, // cool white
    wainscot: 0x263d5c, // Mega Mart navy
    rail: 0xd8dce4,
    band: 0xf58a39, // Mega Mart orange
    floor: { base: '#eef1f3', grout: '#9cc3e6', variation: 8, seed: 21 }, // white vinyl, pale blue grout
    trimY: 3.9,
    trim: NEON_COLORS.cyan,
    signs: { slogan: NEON_COLORS.cyan, live: NEON_COLORS.hotPink, emergency: NEON_COLORS.emergencyRed },
    satire: {
      slogan: 'LOW PRICES. LOWER STANDARDS.',
      live: 'SAVE MONEY. LIVE LESS.',
      mustGo: ['EVERYTHING MUST GO!', '(INCLUDING YOU)'],
      priceMatch: ['Price Match Guarantee', "We match any price. We just don't pay it."],
      shopTillYouDrop: ['SHOP TILL YOU DROP!', "We'll take it from there."],
      bulk: ['Bulk Savings', 'Buy 2, get 1 eaten free.'],
      stockroom: ['Stockroom Rules', '1. Do not open the stockroom. 2. See rule 1.'],
    },
    clutter: {
      seed: 1988,
      perSquareMeter: 0.05,
      kinds: { receipts: 3, shoppingBag: 3, sodaCup: 1.5, puddle: 1.5, brokenGlass: 1, coins: 1, trashPile: 1, cautionTape: 0.6 },
    },
  },

  // The Service Corridor: BACK OF HOUSE, where the cheer runs out. Institutional two-tone (sick green under nicotine cream),
  // a dying green tube, a red EXIT, and staff notices that say the quiet part out loud.
  serviceCorridor: {
    wall: 0xcfc6ad, // nicotine cream (upper wall)
    wainscot: 0x6f8c6a, // institutional green
    wainscotHeight: 1.2,
    rail: 0x55595c, // dull steel
    band: 0x9c3b33, // a dull red stripe
    trimY: 2.95,
    signs: { tube: NEON_COLORS.sickGreen, exit: NEON_COLORS.emergencyRed },
    satire: {
      clockIn: ['Have you clocked in?', 'There is no clocking out.'],
      mandatoryFun: ['Mandatory fun', 'Thursdays. Attendance is mandatory. So is fun.'],
      seeSomething: ['If you see something', 'say nothing. Management is aware.'],
      breakRoom: ['Break room closed', 'Breaks are a privilege. Privileges are suspended.'],
    },
    clutter: {
      seed: 1989,
      perSquareMeter: 0.14,
      kinds: { puddle: 3, trashPile: 2, cardboardBox: 1.5, receipts: 1.5, cautionTape: 1.2, brokenGlass: 1.2, ceilingTile: 1, sodaCup: 0.8 },
    },
  },

  // Level 2, the Sunset Promenade (its peach / coral / dusk-purple surfaces are in levelTwo.js): pink trim, a sunset slogan,
  // an empty upper floor still pitching itself to tenants and to shoppers looking down from the balconies.
  level2: {
    trimY: 3.2, // above the floor
    trim: NEON_COLORS.hotPink,
    signs: { sunset: NEON_COLORS.sunsetOrange, leasing: NEON_COLORS.cyan },
    satire: {
      sunset: 'THE SUN NEVER SETS ON SAVINGS',
      leasing: 'YOUR STORE HERE!',
      leasingNote: ['Now leasing', 'Ask about our lifetime lease. Our very literal lifetime lease.'],
      top: ['WELCOME TO THE TOP!', '(PLEASE ENJOY IT. YOU ARE NOT LEAVING.)'],
      view: ['ENJOY THE VIEW!', 'Please do not feed the shoppers below.'],
    },
    clutter: {
      seed: 1990,
      perSquareMeter: 0.05,
      kinds: { receipts: 2, sodaCup: 2, shoppingBag: 1.5, puddle: 1, coins: 1, popcorn: 1, cassettes: 1 },
    },
  },

  // The Grand Atrium: the showpiece. Two neon suns flank the SUNSET GALLERIA sign under the skylight, trim rings both floors
  // (orange round the arcade, pink and cyan round the upper ring), and the mall's promise across the court.
  atrium: {
    arcadeTrimY: 5.4, // round the arcade, under the ring
    ringTrimY: 3.2, // above the ring's floor
    trim: { arcade: NEON_COLORS.sunsetOrange, ringLong: NEON_COLORS.cyan, ringEnds: NEON_COLORS.hotPink },
    signs: { sun: NEON_COLORS.sunsetOrange, promise: NEON_COLORS.hotPink },
    satire: {
      promise: 'COME FOR THE SALES. STAY FOREVER.',
      grandOpening: ['GRAND OPENING!', '(SINCE 1986)'],
      lostFound: ['Lost & Found', 'Found: 1,204 left shoes. Lost: everyone.'],
      wish: ['MAKE A WISH!', 'Coins are non-refundable. So are wishes.'],
      rules: ['Atrium Rules', 'No running. No screaming. No leaving.'],
    },
    clutter: {
      seed: 1991,
      perSquareMeter: 0.06,
      kinds: { receipts: 2, coins: 2.5, sodaCup: 2, shoppingBag: 1.5, popcorn: 1, puddle: 1, brokenGlass: 0.8, fallenSign: 0.5 },
    },
  },

  // HOFFMAN'S · Est. Forever (maps/mall/departmentStore*.js; the room's own colours are config/departmentStore.js): the
  // department store that thinks it's still 1986's classiest address. Cream and gold, burgundy wainscot, a hot-pink script
  // logo, and copy that reads like a store policy written by the undead.
  departmentStore: {
    wainscot: 0x8c2f45, // burgundy
    rail: 0xc9a14a, // brass
    band: 0xe8b4bc, // dusty rose
    trimY: 4.35,
    trim: NEON_COLORS.hotPink,
    signs: { logo: NEON_COLORS.hotPink, border: NEON_COLORS.white, slogan: NEON_COLORS.cyan, size: NEON_COLORS.electricPurple },
    satire: {
      logo: "HOFFMAN'S",
      tagline: 'EST. FOREVER',
      final: 'ALL SALES FINAL. SO ARE YOU.',
      size: 'YOUR SIZE IS IN THE BACK.',
      hiring: ['Now hiring', 'Full time. All the time. Forever.'],
      layaway: ['Layaway plan', 'Pay forever. Take it home never.'],
      fitting: ['FITTING ROOMS', 'Limit 3 items. 0 exits.'],
      handwritten: ['No try-ons after closing', 'We close at death. Management.'],
      opening: ['GRAND OPENING', 'EVERYTHING MUST STAY'],
    },
    clutter: {
      seed: 1988,
      perSquareMeter: 0.05,
      kinds: { receipts: 3, shoppingBag: 3, coins: 1, brokenGlass: 0.8, puddle: 0.8, cautionTape: 0.4 },
    },
  },
};
