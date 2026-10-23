// =============================================================================
// LOOK: art direction for the visual overhaul ("Mall After Midnight": a 1986 neon mall that never closed, leaning hard
// into horror). Zone palettes, neon placements' colours, painted light pools and clutter, as data. The HALLWAY is the
// reference room the rest of the mall will follow once it's approved (maps/mall/hallwayLook.js builds it).
//
// Rules of the palette:
//   neon accents  hot pink / cyan / electric purple / sunset orange: LIGHT SOURCES only (signs, tubes, trim)
//   base          desaturated dusty pastels + near-black: surfaces never bright themselves, they pick up the neon
//   horror        sick fluorescent green, emergency red, deep shadow
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
    wall: 0x5e5068, // dusky mauve (upper wall)
    wainscot: 0x24152c, // near-black plum, 0 .. wainscotHeight
    wainscotHeight: 1.1,
    rail: 0xb8bcc8, // the chrome rail on top of the wainscot
    ceiling: 0x3b3346,
    floor: { base: '#211a2b', grout: '#7a2d6e', variation: 10, seed: 5 }, // black terrazzo, magenta grout (the 80s grid)
    lamp: { color: 0x9b8cff, intensity: 16, distance: 22 }, // cool violet room lamps (were near-white)
    panel: 0xb9a9ff, // ceiling light panels: dim violet (were stark white)
    panelGlow: 0.75,

    trimY: 3.4, // the neon trim tubes along the long walls
    trim: { north: NEON_COLORS.cyan, south: NEON_COLORS.hotPink },
    signs: {
      foodCourt: NEON_COLORS.hotPink,
      megaMart: NEON_COLORS.cyan,
      atrium: NEON_COLORS.sunsetOrange,
      staffOnly: NEON_COLORS.emergencyRed,
      storefront: NEON_COLORS.electricPurple,
      logo: NEON_COLORS.cyan,
      sun: NEON_COLORS.sunsetOrange,
      palm: NEON_COLORS.hotPink,
    },

    // Painted light: soft additive glows under neon (no real lights). opacity = strength.
    pools: { wallOpacity: 0.32, floorOpacity: 0.28, trimOpacity: 0.18 },

    // Clutter along the walls (world/scatter.js): kinds + weights, density per m2 at 'full'.
    clutter: {
      seed: 1986,
      perSquareMeter: 0.11,
      kinds: { receipts: 4, sodaCup: 2, shoppingBag: 1.5, popcorn: 1, puddle: 2.5, brokenGlass: 1.5, trashPile: 1, coins: 1, cassettes: 1, cautionTape: 0.6 },
    },
  },
};
