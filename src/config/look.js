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
      rewards: ['GALLERIA REWARDS', 'Earn points for every shopper you serve!'],
      lostChildren: ['LOST CHILDREN', 'will be kept at Customer Service. Forever.'],
      wetFloor: ['CAUTION: WET FLOOR', "Please don't ask what it is."],
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
      refillsSmall: ['*OF WHAT?', 'Management reserves the right not to say.'],
      inspection: ['HEALTH INSPECTION: A+', 'Inspector not seen since March.'],
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
    wainscot: 0x2f6fb5, // brand blue
    rail: 0xd8dce4,
    band: 0xffd23f, // brand yellow
    floor: { base: '#eef1f3', grout: '#9cc3e6', variation: 8, seed: 21 }, // white vinyl, pale blue grout
    trimY: 3.9,
    trim: NEON_COLORS.cyan,
    signs: { slogan: NEON_COLORS.cyan, live: NEON_COLORS.hotPink, emergency: NEON_COLORS.emergencyRed },
    satire: {
      slogan: 'LOW PRICES. LOWER STANDARDS.',
      live: 'SAVE MONEY. LIVE LESS.',
      mustGo: ['EVERYTHING MUST GO!', '(INCLUDING YOU)'],
      priceMatch: ['PRICE MATCH GUARANTEE', "We match any price. We just don't pay it."],
      shopTillYouDrop: ['SHOP TILL YOU DROP!', "We'll take it from there."],
      bulk: ['BULK SAVINGS', 'Buy 2, get 1 eaten free.'],
      stockroom: ['STOCKROOM RULES', '1. Do not open the stockroom. 2. See rule 1.'],
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
      clockIn: ['HAVE YOU CLOCKED IN?', 'There is no clocking out.'],
      mandatoryFun: ['MANDATORY FUN', 'Thursdays. Attendance is mandatory. So is fun.'],
      seeSomething: ['IF YOU SEE SOMETHING', 'say nothing. Management is aware.'],
      breakRoom: ['BREAK ROOM CLOSED', 'Breaks are a privilege. Privileges are suspended.'],
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
      leasingNote: ['NOW LEASING', 'Ask about our lifetime lease. Our very literal lifetime lease.'],
      top: ['WELCOME TO THE TOP!', '(PLEASE ENJOY IT. YOU ARE NOT LEAVING.)'],
      view: ['ENJOY THE VIEW!', 'Please do not feed the shoppers below.'],
    },
    clutter: {
      seed: 1990,
      perSquareMeter: 0.05,
      kinds: { receipts: 2, sodaCup: 2, shoppingBag: 1.5, puddle: 1, coins: 1, popcorn: 1, cassettes: 1 },
    },
  },
};
