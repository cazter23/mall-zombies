// Web fonts that canvas signs, posters and print use, and how long the game waits for them at startup.
// Keep in step with the Google Fonts link in index.html.
export const fonts = {
  maxWaitMs: 2500, // slow or no network: start anyway on the CSS fallback fonts
  sampleText: 'Aa',
  canvas: [
    '400 40px "Anton"', '400 40px "Bebas Neue"', '600 40px "Caveat"', '700 40px "Caveat"',
    '600 40px "Fraunces"', '700 40px "Fraunces"', '600 40px "Fredoka"', '700 40px "Fredoka"',
    '400 40px "Permanent Marker"', '600 40px "Playfair Display"', '700 40px "Playfair Display"',
    'italic 400 40px "Playfair Display"', '400 40px "Righteous"', '400 40px "Silkscreen"', '700 40px "Silkscreen"',
    '400 40px "Space Grotesk"', '500 40px "Space Grotesk"', '700 40px "Space Grotesk"',
    '500 40px "Teko"', '600 40px "Teko"', '700 40px "Teko"', '400 40px "VT323"',
  ],
};
