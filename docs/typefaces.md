# Typefaces (the 3D world's type system)

Every sign, poster, label, neon, notice, price tag and printed text in the 3D world has a typeface chosen for what it is and
who made it. HUD and menus (DOM, `style.css`, the minimap canvas) are out of scope and keep their own fonts.

- **The roles, fonts and licences, and the full sign-by-sign table:** [typefaces-ledger.md](typefaces-ledger.md) (generated).
- **The code:** `src/config/typefaces.js` (families, roles, sign kinds, neon styles), `src/world/typeKit.js` (`fontFor`, `fitSize`,
  `drawType`), `src/fonts/` (bundled fonts, `fonts.css` written by `node tools/buildFontCss.mjs`). `tests/typefaces.test.js` guards it.

## Rules
1. A module asks for a ROLE (`'hoffmanBrand'`, `'marker'`, `'wayfinding'`), never a font string. The test fails on any raw font
   in `src/` (HUD/minimap excepted).
2. Treatments (case, tracking, slant, outline, hard shadow, glow, gradient fill) are options of `drawType`, defaulting to the role.
3. Text shrinks to fit and is never clipped (`maxWidth`).
4. A sign layout (`makeSignTexture` style) has a default role per kind (`signKinds`); a landmark overrides with `font: '<role>'`.
5. New family: its `.woff2` in `src/fonts/files/` (Fontsource Latin subset), an entry in `families`, then `node tools/buildFontCss.mjs`.
   Only SIL OFL or Apache 2.0 fonts. They are inlined into the single-file build as `data:` URLs (no network, ever).

## How the log is made (how the ledger was checked against the code)
A scratch hook wrapped `CanvasRenderingContext2D.fillText/strokeText` in the real game running in the browser pane, recording every
draw's text, font string, canvas size and call stack, once BEFORE the pass (871 draws came through `world/textures.js` alone) and
once after. `tools/typefaceLedger.mjs before.json after.json` joins them by text and writes the ledger. The code search (every
`fillText` call line in `src/`) was reconciled against the log: after the pass every draw site the log reached is in a bundled
role font (0 fallbacks of 1333 unique draws), and the call sites the boot run did NOT reach are listed below.

Draw sites not reached by the boot run (runtime-only), checked by reading the code and by the headless tests, not by eye:
`game/features/clearanceSticker.js` (the dropped sticker), `game/features/retailUnease.js` (CCTV `CAM 01`), `weapons/models/skinPattern.js`
(the Doorbuster and Handle With Care skins), `zombies/mascotHeads.js` (price-tag and gold-badge mascot prints). The old text is also
listed as "not in the after-log" for poster copy that the new, narrower fonts wrap differently (same posters, different line breaks).
Not text drawn by canvas: the neon tubes (below). Out of scope: `src/ui/minimap.js` (HUD).

## Decisions made without asking
- **24 families, not 10-16.** The brief said roughly 10-16; the mall has ~12 store identities (department store, discount mart, toy
  store, cinema, three food stalls, varsity sports, hardware, computers...) and each wanted its own face, so the palette is larger, ~800 KB of
  woff2. HUD families (Righteous, Teko, Space Grotesk, VT323) are kept because `style.css` uses them. Dropped: Bebas Neue, Silkscreen, Fraunces.
- **Fonts moved from the Google Fonts link to local files** (the old setup needed the network and the single-file build fell back to system
  fonts offline). `index.html` no longer links a font host; `boot.js` imports `fonts/fonts.css`; `config/fonts.js` is derived from `families`.
- **Neon tubes keep one stroke font.** Neon text is bent from single strokes (`world/neon.js`); a filled/serif letter is not a tube. Instead of
  new typefaces, neon got LETTERING STYLES (`neonStyles`: block, italic, script, wide, deco: slant + letter spacing) assigned per sign.
- `wayfinding` forces upper case (condensed Barlow caps), so mixed-case directory lines that were "Food Court · South" now read as capitals.
- Cinema posters each get their own title treatment (gold marquee gradient, glowing readout, shadowed clearance face).
- Wall-buy chalk names stay `marker` (they are chalk on a board). The Build-A-Blaster room, parking-lot shops, Customer Service booth and
  concourse shops were not in the agents' file lists: they were given roles by hand.
- Shutter curtains use `stencil`; the shutter fine print uses `typewriter`.
- Test fixture `tests/fixtures/weapon-materials-phase-1.json` (`canvas` entries of five gun label textures) was regenerated: the recorded
  canvas calls changed on purpose.

## Known limits
- `★` `▸` `→` `♥` and similar glyphs are not in the Latin subsets of most fonts and fall back to the system font (they are symbols, not letters).
- Runtime-only draws (above) were not looked at in the browser.
- Neon text cannot be outlined, serif or script; only leaned and spaced.
