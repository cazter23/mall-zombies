// Canvas text never swaps fonts later: a sign drawn before its font arrives keeps the fallback for good.
// So the game waits for the fonts before it builds anything, up to a limit, and a failure never stops it.
// (The fonts are bundled local files, src/fonts/fonts.css, so this is quick; the limit is only a safety net.)
export function waitForFonts(doc, { canvas, sampleText, maxWaitMs }) {
  const loaded = Promise.all(canvas.map((font) => doc.fonts.load(font, sampleText))).catch(() => {});
  const limit = new Promise((resolve) => setTimeout(resolve, maxWaitMs));
  return Promise.race([loaded, limit]);
}
