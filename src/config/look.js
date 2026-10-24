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
};
