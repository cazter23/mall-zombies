// =============================================================================
// EFFECT WORDS: the words-only rule for upgrades. Players never see what an upgrade does as a number: no percentages, multipliers,
// "100 → 125", seconds or damage values anywhere in the UI (prices, points, ammo counts, round, the health and sprint bars and
// countdown timers are still numbers: those are things you play with). An upgrade says what it does in a short plain line written in
// ITS OWN config entry (config/upgrades.js tiers / attachments, config/wardrobe.js items, config/workshop.js blurbs, config/powerUps.js
// hints), and where the SIZE of the change matters the line carries a token that this file fills in from one fixed set of bands:
//
//   {size}  -> "a little" | "noticeably" | "much"     "Reloads {size} faster"          -> "Reloads noticeably faster"
//   {Size}  -> the same, capitalised                  "{Size} more health"             -> "Much more health"
//
// The band comes from how big the change really is (a multiplier, 1 = unchanged; 0.8 and 1.25 are the same size), so retuning a number
// moves the word with it. The bands are defined ONCE, here. tests/effectWords.test.js fails if player-facing text carries a digit followed by
// %, x, s, m, ° or an arrow (the check is `hasStatNumber` below).
// =============================================================================

/** Fixed size bands: a change up to `upTo` (as a fraction: 0.12 = 12% bigger or smaller) is called `word`. */
export const sizeBands = [
  { upTo: 0.12, word: 'a little' },
  { upTo: 0.35, word: 'noticeably' },
  { upTo: Infinity, word: 'much' },
];

/** How big a multiplier's change is, as a fraction, the same either way round (0.8 and 1.25 are both 0.25). */
export const changeOf = (ratio) => (ratio >= 1 ? ratio - 1 : 1 / Math.max(ratio, 1e-6) - 1);

/** The size word for a multiplier: sizeWord(1.25) = 'noticeably', sizeWord(1.5) = 'much'. */
export const sizeWord = (ratio) => sizeBands.find((band) => changeOf(ratio) <= band.upTo + 1e-9).word;

const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Fill a line's {size} / {Size} from a multiplier. A line with no token comes back as it is. */
export function fillSize(text, ratio) {
  const word = sizeWord(ratio ?? 1);
  return text.replace('{size}', word).replace('{Size}', capital(word));
}

/**
 * Turn an upgrade's wording into the lines the UI prints.
 *   lines:    [{ effect, text, good }]   one short line per upside / downside; `effect` names the key in `effects` whose size fills the token
 *   effects:  { effect: multiplier }     the gameplay numbers (never shown)
 * Returns [{ text, good }], upsides first.
 */
export function describeEffects(lines = [], effects = {}) {
  return lines
    .map(({ effect, text, good = true }) => ({ text: fillSize(text, effects[effect]), good }))
    .sort((a, b) => Number(b.good) - Number(a.good));
}

/** Would a player-facing string show a stat number? A digit followed by %, x, s, m, ° or an arrow ("25%", "1.2x", "3.4 s", "10m", "100 →"). */
export const hasStatNumber = (text) => /\d(?:\.\d+)?\s?(?:%|×|x\b|s\b|m\b|°|→)/i.test(String(text));
