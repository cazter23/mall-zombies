// =============================================================================
// GUN STYLE: how upgrades change the SHAPE of a gun in your hands. Very stylized: chunky, toy-like, readable from behind the gun.
// Three systems, three zones, so all three show on one gun at once:
//   Extended Warranty   the BARREL COLLAR (rings that get chunkier with the tier) and a hanging TAG at the grip   (weapons/models/warrantyTrim.js)
//   Build-A-Blaster     the BODY: stuffed pillows on both sides of the gun, a glowing seam on top               (weapons/models/buildVisual.js)
//   Attachments         the muzzle, top, grip and magazine: the same parts, drawn bigger (attachmentScale)       (weapons/models/upgradeParts.js)
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

  // BUILD GLOW: the seam along the top glows in the stuffing's colour (drawn unlit, so it holds in dark rooms).
  glow: { width: 0.0045, height: 0.0035 },
};
