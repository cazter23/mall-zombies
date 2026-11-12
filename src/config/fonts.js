// Web fonts that canvas signs, posters and print use, and how long the game waits for them at startup.
// The families are listed ONCE, in config/typefaces.js, and bundled locally (src/fonts/fonts.css, written by
// tools/buildFontCss.mjs): this list is derived from them, so a new font cannot be forgotten here.
import { families } from './typefaces.js';

export const fontFaces = (name, def = families[name]) => [
  ...def.weights.map((weight) => `${weight} 40px "${name}"`),
  ...(def.italic ?? []).map((weight) => `italic ${weight} 40px "${name}"`),
];

export const fonts = {
  maxWaitMs: 4000, // the fonts are local files: this is only a safety net
  sampleText: 'Aa',
  canvas: Object.keys(families).flatMap((name) => fontFaces(name)),
};
