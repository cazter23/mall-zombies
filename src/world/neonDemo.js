// =============================================================================
// NEON SAMPLE WALL (debug only, throwaway)
// buildNeonSampleWall(neon, { x, y, z }) lays out one of everything world/neon.js can make on a wall facing +Z
// centred at (x, y, z): every palette colour, the whole font, each shape, signs with dead and flickering letters.
// Used by tools/neonDemo.html (npm run dev, then open /tools/neonDemo.html). Not part of any map.
// =============================================================================

import { NEON_COLORS, NEON_SHAPES } from './neon.js';

export function buildNeonSampleWall(neon, { x = 0, y = 0, z = 0 } = {}) {
  const at = (dx, dy, extra = {}) => ({ x: x + dx, y: y + dy, z, ...extra });

  // Headline sign with a border, a dead letter and a flickering one.
  neon.sign({ ...at(0, 4.3), text: 'SUNSET ★ GALLERIA', height: 0.55, color: NEON_COLORS.hotPink, border: NEON_COLORS.cyan,
    deadLetters: [3], flickerLetters: [12], slant: 0.18 });

  // The palette: one bar per colour.
  Object.entries(NEON_COLORS).forEach(([, color], i) => {
    neon.tube([[x - 6 + i * 0.6, y + 3.0, z], [x - 6 + i * 0.6, y + 3.5, z]], { color, radius: 0.03 });
  });
  neon.text('OPEN 24 HRS', { ...at(2.8, 3.25), height: 0.3, color: NEON_COLORS.sickGreen, flickerLetters: [5, 6], flickerStyle: 'dying' });

  // The whole font.
  neon.text('ABCDEFGHIJKLM\nNOPQRSTUVWXYZ\n0123456789 -.!?:&+/$%\'\n→ ← ↑ ↓ ♥ ★', { ...at(-2.6, 1.6), height: 0.28, color: NEON_COLORS.cyan });

  // Each shape.
  NEON_SHAPES.forEach((kind, i) => {
    neon.shape(kind, { ...at(1.0 + (i % 4) * 1.3, 2.05 - Math.floor(i / 4) * 1.3), size: 0.9, width: 1.0, height: 0.7 });
  });

  // Horror signage: emergency red dying exit, a sick-green fluorescent strip that buzzes, a fully dead sign.
  neon.sign({ ...at(-4.2, -0.3), text: 'EXIT →', height: 0.35, color: NEON_COLORS.emergencyRed, flickerLetters: [0, 1, 2, 3], flickerStyle: 'dying' });
  neon.tube([[x - 2.2, y - 0.3, z], [x + 0.2, y - 0.3, z]], { color: NEON_COLORS.sickGreen, radius: 0.035, flicker: 'buzz' });
  neon.sign({ ...at(2.6, -0.3), text: 'NO REFUNDS', height: 0.3, color: NEON_COLORS.electricPurple, deadLetters: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  neon.sign({ ...at(5.6, -0.3), text: 'SALE', height: 0.35, color: NEON_COLORS.sunsetOrange, backing: false, flicker: 'blink' });
}
