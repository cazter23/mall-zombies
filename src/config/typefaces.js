// =============================================================================
// TYPEFACES: every font that 3D-world text (signs, posters, labels, neon, price cards, print) may use, and the ROLES that
// ask for them. Modules never write a font string: they ask for a role ('hoffmanBrand', 'marker', 'wayfinding'...) through
// world/typeKit.js (fontFor / drawType), so the mall's typography is decided here, in one place.
//   families : the web fonts, bundled locally (src/fonts/fonts.css + src/fonts/files/*.woff2, so the single-file build
//              shows them offline). `weights` / `italic` list exactly the faces that are bundled and preloaded.
//   roles    : family + weight + the TREATMENT that goes with it (case, tracking, outline, shadow, gradient, wear).
//   signKinds: a sign's `style` (world/textures.js makeSignTexture) -> its role(s).
// The HUD and menus (style.css) are outside this system, but share some of the same families.
// =============================================================================

// licence: OFL = SIL Open Font License 1.1, Apache = Apache License 2.0 (both allow bundling and redistribution).
export const families = {
  Anton:               { weights: [400], license: 'OFL', fallback: 'Impact, "Arial Narrow", sans-serif' },
  'Archivo Black':     { weights: [400], license: 'OFL', fallback: '"Arial Black", Arial, sans-serif' },
  'Barlow Condensed':  { weights: [600, 700], license: 'OFL', fallback: '"Arial Narrow", Arial, sans-serif' },
  'Big Shoulders Display': { weights: [800], license: 'OFL', fallback: 'Impact, "Arial Narrow", sans-serif' },
  Bungee:              { weights: [400], license: 'OFL', fallback: '"Arial Black", system-ui, sans-serif' },
  Caveat:              { weights: [600, 700], license: 'OFL', fallback: '"Segoe Print", cursive' },
  Chewy:               { weights: [400], license: 'Apache', fallback: '"Comic Sans MS", cursive' },
  Cinzel:              { weights: [400, 700], license: 'OFL', fallback: 'Georgia, "Times New Roman", serif' },
  Fredoka:             { weights: [600, 700], license: 'OFL', fallback: '"Trebuchet MS", sans-serif' },
  Graduate:            { weights: [400], license: 'OFL', fallback: 'Impact, "Arial Black", sans-serif' },
  'Kaushan Script':    { weights: [400], license: 'OFL', fallback: '"Brush Script MT", cursive' },
  Limelight:           { weights: [400], license: 'OFL', fallback: 'Georgia, serif' },
  Lobster:             { weights: [400], license: 'OFL', fallback: '"Brush Script MT", cursive' },
  Orbitron:            { weights: [700], license: 'OFL', fallback: '"Courier New", monospace' },
  'Permanent Marker':  { weights: [400], license: 'Apache', fallback: '"Comic Sans MS", "Chalkboard SE", cursive' },
  'Playfair Display':  { weights: [600, 700], italic: [400], license: 'OFL', fallback: 'Georgia, "Times New Roman", serif' },
  Righteous:           { weights: [400], license: 'OFL', fallback: '"Arial Black", sans-serif' },
  'Rock Salt':         { weights: [400], license: 'Apache', fallback: '"Segoe Print", cursive' },
  Rye:                 { weights: [400], license: 'OFL', fallback: 'Georgia, serif' },
  'Saira Stencil One': { weights: [400], license: 'OFL', fallback: 'Impact, "Arial Black", sans-serif' },
  'Space Grotesk':     { weights: [400, 500, 700], license: 'OFL', fallback: '"Helvetica Neue", Arial, sans-serif' },
  'Special Elite':     { weights: [400], license: 'Apache', fallback: '"Courier New", monospace' },
  Teko:                { weights: [500, 600, 700], license: 'OFL', fallback: '"Arial Narrow", sans-serif' },
  VT323:               { weights: [400], license: 'OFL', fallback: '"Courier New", monospace' },
  Yellowtail:          { weights: [400], license: 'Apache', fallback: '"Brush Script MT", cursive' },
};

// A role: family + weight (+ italic), then how it is DRAWN (all optional; drawType in world/typeKit.js applies them):
//   caps: 'upper' | 'lower'     tracking: letter spacing in em      slant: skew (0.08 = 8% lean)
//   outline: { color, width }   width in em of the font size        shadow: { color, dx, dy } offset in em, hard (no blur)
//   glow: { color, blur }       blur in em                          gradient: [top, bottom] fill colours (override the sign's ink)
//   wear: 0..1 chance-like amount of speckle knocked out of the letters (painted, worn signs)
export const roles = {
  // --- neon and mall brand ---
  neonScript:    { family: 'Yellowtail', weight: 400, glow: { color: 'currentColor', blur: 0.18 } },
  neonBlock:     { family: 'Bungee', weight: 400, tracking: 0.04, glow: { color: 'currentColor', blur: 0.14 } },
  chrome:        { family: 'Bungee', weight: 400, tracking: 0.02, outline: { color: '#1b1031', width: 0.07 }, shadow: { color: '#1b1031', dx: 0.04, dy: 0.06 } },
  mallBrand:     { family: 'Bungee', weight: 400, tracking: 0.03 },
  // --- store identities ---
  hoffmanBrand:  { family: 'Cinzel', weight: 700, tracking: 0.07 },
  hoffmanSub:    { family: 'Playfair Display', weight: 400, italic: true, tracking: 0.02 },
  hoffmanSerif:  { family: 'Playfair Display', weight: 700 },
  martBrand:     { family: 'Archivo Black', weight: 400, tracking: 0.01 },
  martSub:       { family: 'Barlow Condensed', weight: 700, caps: 'upper', tracking: 0.06 },
  toyBrand:      { family: 'Chewy', weight: 400, tracking: 0.02, outline: { color: '#240046', width: 0.11 } },
  toyBody:       { family: 'Fredoka', weight: 700 },
  varsity:       { family: 'Graduate', weight: 400, tracking: 0.04, slant: 0.09, outline: { color: '#050a14', width: 0.1 } },
  industrial:    { family: 'Big Shoulders Display', weight: 800, caps: 'upper', tracking: 0.04, shadow: { color: 'rgba(0,0,0,.75)', dx: 0.04, dy: 0.04 } },
  terminal:      { family: 'VT323', weight: 400, glow: { color: 'currentColor', blur: 0.22 } },
  readout:       { family: 'Orbitron', weight: 700, tracking: 0.06 },
  // --- food court stalls ---
  dinerScript:   { family: 'Lobster', weight: 400, shadow: { color: '#8a1c26', dx: 0.04, dy: 0.06 } },
  wokBrush:      { family: 'Kaushan Script', weight: 400, glow: { color: '#ff2a4b', blur: 0.3 } },
  carnival:      { family: 'Rye', weight: 400, tracking: 0.02, shadow: { color: '#d62839', dx: 0.05, dy: 0.05 } },
  // --- cinema ---
  marquee:       { family: 'Limelight', weight: 400, tracking: 0.03 },
  cinemaBody:    { family: 'Barlow Condensed', weight: 600, tracking: 0.05 },
  ticket:        { family: 'Special Elite', weight: 400 },
  // --- retail and notices ---
  clearance:     { family: 'Anton', weight: 400, caps: 'upper', tracking: 0.02 },
  priceTag:      { family: 'Teko', weight: 700 },
  wayfinding:    { family: 'Barlow Condensed', weight: 700, caps: 'upper', tracking: 0.05 },
  official:      { family: 'Space Grotesk', weight: 700 },
  officialBody:  { family: 'Space Grotesk', weight: 500 },
  stencil:       { family: 'Saira Stencil One', weight: 400, caps: 'upper', tracking: 0.04 },
  hazard:        { family: 'Saira Stencil One', weight: 400, caps: 'upper', tracking: 0.03 },
  arcade:        { family: 'Righteous', weight: 400, tracking: 0.02 },
  // --- hand-made and typed ---
  marker:        { family: 'Permanent Marker', weight: 400 },
  note:          { family: 'Caveat', weight: 700 },
  scrawl:        { family: 'Rock Salt', weight: 400 },
  kevin:         { family: 'Rock Salt', weight: 400 },
  typewriter:    { family: 'Special Elite', weight: 400 },
  // --- electronic ---
  led:           { family: 'VT323', weight: 400 },
  hud3d:         { family: 'Teko', weight: 600 },
};

// A sign's `style` -> the roles it draws with: `main` for the name, `sub` for the line under it.
export const signKinds = {
  martBrand: { main: 'martBrand', sub: 'martSub' },
  hoffmanBrand: { main: 'hoffmanBrand', sub: 'hoffmanSub' },
  tech: { main: 'terminal' },
  varsity: { main: 'varsity' },
  toy: { main: 'toyBrand' },
  industrial: { main: 'industrial' },
  diner: { main: 'dinerScript' },
  wok: { main: 'wokBrush' },
  carnival: { main: 'carnival' },
  supermarket: { main: 'martBrand' },
  clearance: { main: 'clearance' },
  pricetag: { main: 'priceTag' },
  hazard: { main: 'hazard', sub: 'clearance' },
  digital: { main: 'readout' },
  handwritten: { main: 'marker' },
  wayfinding: { main: 'wayfinding' },
  service: { main: 'official' },
  ammo: { main: 'stencil' },
  standard: { main: 'official' },
};

// Poster families (world/posterTextures.js): the old TYPOGRAPHY table, now by role.
export const posterTypography = {
  brand: { display: 'chrome', body: 'martBrand' },
  utility: { display: 'wayfinding', body: 'officialBody' },
  heritage: { display: 'hoffmanBrand', body: 'hoffmanSub' },
  handwritten: { display: 'marker', body: 'note' },
  cinema: { display: 'marquee', body: 'cinemaBody' },
};

// NEON: tube text is bent from ONE stroke font (world/neon.js: a neon tube cannot have a filled, serif or outlined letter), so
// neon "typefaces" are lettering STYLES: how far the letters lean and how far apart they stand. A neon sign asks for one
// with `style`; slant is font units per unit of height, spacing is the gap between letters in font units (default block 1.2).
export const neonStyles = {
  block:  { slant: 0, spacing: 1.2 },    // plain tube capitals: shop names, EXIT
  italic: { slant: 0.22, spacing: 1.2 }, // sale and promo signs: leaning forward
  script: { slant: 0.45, spacing: 0.5 }, // diner-script feel: heavy lean, letters run together
  wide:   { slant: 0, spacing: 3.0 },    // art-deco: tall, airy spacing (cinema, atrium, directories)
  deco:   { slant: 0.12, spacing: 2.2 }, // gentle lean with air: lounge and promise signs
};
