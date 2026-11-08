// =============================================================================
// GUN STYLE: how upgrades change the SHAPE of a gun in your hands. Very stylized: chunky, toy-like, readable from behind the gun.
// Three systems, three zones, so all three show on one gun at once:
//   Extended Warranty   the BARREL COLLAR (rings that get chunkier with the tier) and a hanging TAG at the grip   (weapons/models/warrantyTrim.js)
//   Build-A-Blaster     the BODY: stuffed pillows on both sides of the gun, a glowing seam on top               (weapons/models/buildVisual.js)
//   Attachments         the muzzle, top, grip and magazine: the same parts, drawn bigger (attachmentScale)       (weapons/models/upgradeParts.js)
// COLOUR LANGUAGES, kept apart so a gun carrying all three still reads: the WARRANTY is METAL (steel, gold, pearl-platinum: tier colours in
// config/upgrades.js, a metallic finish and a sheen below), the BUILD is CANDY (the stuffing's saturated colour in config/workshop.js; the quality sets how vivid
// and glowing it is, and the Heart is an accent badge on the patch), and ATTACHMENTS keep their store brand colours. tests/upgradeColors.test.js keeps the
// warranty metals away from every stuffing colour.
// All sizes are in metres in gun-local space (a pistol is about 0.3 m long). Looks only: nothing here changes play.
// =============================================================================

export const gunStyle = {
  // Attachments are drawn this much bigger than the shop designs (their muzzle shift grows with them).
  attachmentScale: 1.2,

  // WARRANTY COLLAR: rings round the barrel, set back from the muzzle by `back` and `margin` bigger than the barrel on every side.
  // rings x ringDepth makes it chunkier tier by tier; Platinum is one wide gold block with two dark stripes and a gem.
  collar: {
    back: 0.02, margin: 0.007, bar: 0.007,
    tiers: {
      deluxe: { rings: 1, ringDepth: 0.008 },
      premium: { rings: 2, ringDepth: 0.011, gap: 0.006 },
      platinum: { rings: 1, ringDepth: 0.034, stripes: 2, gem: true },
    },
    stud: { size: 0.0065, spacing: 0.011 }, // a Warranty Renewal is a small gold stud on top of the collar
    gem: 0.011,
    dark: 0x2a2231,
    stripe: 0x2a2231,
  },

  // WARRANTY FINISH: the collar and tag are metal. metal/rough = the material; sheen = how much of the colour the metal gives off by itself (there are no
  // reflections in a gun's lighting, so a plain metal would go dark). Platinum shimmers: its colour drifts slowly between pearl tints.
  finish: {
    deluxe: { metal: 0.55, rough: 0.34, sheen: 0.14 },
    premium: { metal: 0.7, rough: 0.28, sheen: 0.2 },
    platinum: { metal: 0.75, rough: 0.2, sheen: 0.3, shimmer: { speed: 0.7, hue: [0.52, 0.86], saturation: 0.22, lightness: 0.9 } },
    renewal: { metal: 0.7, rough: 0.3, sheen: 0.2 },
  },

  // WARRANTY TAG: a card on a string hanging off the grip, swinging a little as you move.
  tag: { size: [0.032, 0.044], thickness: 0.003, string: 0.034, drop: 0.064, back: 0.02, sway: 0.2, speed: 2.4, platinumScale: 1.25, stringColor: 0xf1faee },

  // BUILD PUFF: stuffed pillows on both sides of the body, by quality. out = how far each bulges from the face, h = height, len = length.
  // The left pillow carries the patch and stitches. The right one sits further back (the laser pointer's rail is forward on that side).
  puff: {
    understuffed: { out: 0.012, h: 0.032, len: 0.062, rise: 0.005 },
    regular: { out: 0.02, h: 0.04, len: 0.078, rise: 0.007 },
    extraStuffed: { out: 0.034, h: 0.052, len: 0.1, rise: 0.009 },
    overstuffed: { out: 0.046, h: 0.064, len: 0.118, rise: 0.011 },
    tint: 0.12, // how far the pillow colour is mixed toward white, so it reads as plush cloth, not paint
    rightBack: 0.038, // the right pillow sits this far behind the left one
    rightScale: 0.85,
  },

  // BUILD COLOUR BY QUALITY: the pillow's colour is the stuffing's, made more or less vivid (saturation x) and lit from within (glow = how much of its colour it
  // gives off). The seam goes hot (toward white) on the best builds. The patch and thread stay the stuffing's plain colour.
  quality: {
    understuffed: { saturation: 0.55, glow: 0, seamHot: 0 },
    regular: { saturation: 1, glow: 0, seamHot: 0 },
    extraStuffed: { saturation: 1.15, glow: 0.14, seamHot: 0.15 },
    overstuffed: { saturation: 1.3, glow: 0.3, seamHot: 0.4 },
  },

  // HEART BADGE: a small plate on the patch, one colour and shape per Heart, so the "when" shows on the gun too (the stuffing is the "what").
  // shape: 'crosshair' (Headshot), 'bullet' (Last Round), 'ring' (Reload), 'star' (Every 5th). The shape is drawn in cream on the coloured plate.
  heart: {
    plate: 0.022, thickness: 0.0022, ink: 0xfff3d4,
    colors: { headshot: 0xff3b5c, lastRound: 0x2f6bff, reload: 0x21c277, everyTenth: 0xf2a900 },
    shapes: { headshot: 'crosshair', lastRound: 'bullet', reload: 'ring', everyTenth: 'star' },
  },

  // BUILD GLOW: the seam along the top glows in the stuffing's colour (drawn unlit, so it holds in dark rooms).
  glow: { width: 0.0045, height: 0.0035 },
};
