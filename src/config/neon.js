// =============================================================================
// NEON CONFIG
// Tuning for the neon tube builder (world/neon.js): the "neon 80s vaporwave + horror" palette, tube and
// halo sizes, glow strength, dead glass, flicker timing and sign backings. Decoration only: nothing here
// touches collision, gameplay or real lights (neon never adds a point light; the glow is unlit colour +
// a soft additive halo, which the bloom pass picks up when it is on).
// =============================================================================

export const NEON_COLORS = {
  hotPink: '#ff2fa8',
  cyan: '#22e8ff',
  electricPurple: '#9d3bff',
  sunsetOrange: '#ff7a1f',
  sickGreen: '#a6ff3a', // the dying-fluorescent green
  emergencyRed: '#ff1a1a',
  white: '#fff4f8', // a warm "white" tube for borders
};

export const neon = {
  // Tube cross-section. radius in metres; radialSegments keeps it cheap (6 reads round at sign distance).
  tube: {
    radius: 0.022,
    radialSegments: 6,
    // A small ball covers each sharp corner and both ends (open cylinder ends would show holes). Bends
    // gentler than this many degrees get no ball (a smooth curve has a vertex every few cm).
    jointMinDegrees: 20,
    jointSegments: { width: 6, height: 4 },
  },

  // Lit glass: an unlit (MeshBasic) colour multiplied past 1.0 so it reads as emissive and blooms.
  glow: {
    intensity: 1.8,
  },

  // The soft additive halo: a fatter transparent tube around the lit one (same batching).
  halo: {
    radiusScale: 3.2, // halo radius = tube radius x this
    radialSegments: 6,
    opacity: 0.22,
  },

  // Dead (unlit) tubes: dark tinted glass. Lit by the room like any surface.
  dead: {
    tint: 0.3, // the tube's colour x this (dark, but still reads as glass when light falls on it)
    roughness: 0.25,
    metalness: 0.1,
  },

  // Flicker: each flickering part runs its own seeded on/off state machine (deterministic for a given seed).
  // Styles: 'buzz' = mostly on, quick stutters; 'dying' = mostly off, occasional sputters back to life;
  // 'blink' = slow steady on/off. Durations are [min, max] seconds, picked with the part's seeded random.
  flicker: {
    seed: 1985,
    offLevel: 0.06, // brightness while "off" (the glass never goes perfectly black)
    styles: {
      buzz: { on: [0.4, 3.0], off: [0.03, 0.12], burst: 0.45 },
      dying: { on: [0.04, 0.35], off: [0.6, 3.5], burst: 0.6 },
      blink: { on: [0.8, 1.2], off: [0.5, 0.7], burst: 0 },
    },
    // burst = chance that an "off" is followed by a very short on/off chatter instead of a normal "on".
    burstOn: [0.02, 0.07],
  },

  // Text: the built-in stroke font is drawn on a 6-unit-tall grid; height scales it.
  text: {
    height: 0.5, // default cap height (m)
    spacing: 1.2, // gap between letters, in font units
    lineGap: 2.4, // extra gap between lines, in font units
    radiusPerHeight: 0.05, // tube radius = height x this (capped below by tube.radius x 0.5)
  },

  // Backed signs.
  sign: {
    padding: 0.18, // backing margin around the text, as a fraction of the letter height (+ a fixed bit below)
    margin: 0.08, // fixed backing margin (m)
    depth: 0.04, // backing thickness (m)
    standoff: 0.03, // tubes sit this far in front of the backing
    backingColor: '#120a18', // near-black purple panel
    borderInset: 0.06, // the optional border tube, inside the backing edge (m)
  },
};
