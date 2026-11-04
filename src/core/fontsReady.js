// Canvas text never swaps fonts later: a sign drawn before its font arrives keeps the fallback for good.
// So the game waits for the fonts before it builds anything, up to a limit, and a failure never stops it.
function stylesheetReady(doc) {
  const link = doc.querySelector('link[href*="fonts.googleapis.com"]');
  if (!link || link.sheet) return Promise.resolve();
  // The single-file build loads this link without blocking, so it can still be on its way.
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

export function waitForFonts(doc, { canvas, sampleText, maxWaitMs }) {
  const loaded = stylesheetReady(doc)
    .then(() => Promise.all(canvas.map((font) => doc.fonts.load(font, sampleText))))
    .catch(() => {});
  const limit = new Promise((resolve) => setTimeout(resolve, maxWaitMs));
  return Promise.race([loaded, limit]);
}
