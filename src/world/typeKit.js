// =============================================================================
// TYPE KIT: how every sign, poster and label in the 3D world sets its text.
//   fontFor(role, px, { weight, italic })  -> a canvas font string ('700 40px "Cinzel", Georgia, serif')
//   fitSize(ctx, text, role, size, maxWidth, { min }) -> the largest size <= `size` whose text fits (never below `min`)
//   drawType(ctx, text, x, y, { role, size, fill, maxWidth, ... }) -> the size it drew at
// Roles, families and their default treatments live in config/typefaces.js; a module asks for a ROLE, never a raw font.
// Treatments (case, tracking, slant, outline, hard shadow, glow, gradient) are options here, defaulting to the role's own,
// so a sign never copy-pastes its own stroke/shadow code. Text always shrinks to fit; it is never clipped.
// =============================================================================
import { families, roles } from '../config/typefaces.js';

/** The role's definition; an unknown role is a typo, so it throws (tests/typefaces.test.js also scans for them). */
export function roleOf(role) {
  const def = roles[role];
  if (!def) throw new Error(`typeKit: unknown type role "${role}"`);
  return def;
}

/** The CSS font-family list for a role: the family, then its fallbacks. */
export function familyOf(role) {
  const def = roleOf(role);
  return `"${def.family}", ${families[def.family].fallback}`;
}

/** A canvas font string for a role at `px`. `weight` / `italic` override the role for one-off emphasis. */
export function fontFor(role, px, { weight, italic } = {}) {
  const def = roleOf(role);
  const w = weight ?? def.weight;
  const it = italic ?? def.italic;
  return `${it ? 'italic ' : ''}${w} ${Math.round(px * 10) / 10}px ${familyOf(role)}`;
}

const applyCase = (text, caps) => (caps === 'upper' ? String(text).toUpperCase() : caps === 'lower' ? String(text).toLowerCase() : String(text));

function setTracking(ctx, em, size) {
  if (em && 'letterSpacing' in ctx) ctx.letterSpacing = `${(em * size).toFixed(2)}px`;
}
const clearTracking = (ctx) => { if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; };

function widthOf(ctx, text) {
  const m = ctx.measureText(text);
  return typeof m?.width === 'number' && !Number.isNaN(m.width) ? m.width : 0;
}

/**
 * Largest size on the ladder `size`, `size - 2`, `size - 4`, ... (never below `min`, which is the last rung) at which `text` set
 * in `role` fits `maxWidth`; `min` if none does.
 * It measures a few rungs, not every one: text width grows in proportion to its size, so one measurement at `size` predicts
 * the rung, which is then confirmed (it fits, and the rung above it doesn't). Stepping down every rung measured ~12,500 times
 * at startup, and the browser's first measurement at a font size it has not used yet costs ~2 ms: ~7 s of the mall's build
 * (docs/history.md, 17 November 2026). Same answer as the step-by-step walk (tests/typefaces.test.js compares them); the
 * context is left with the returned size's font, as that walk left it.
 */
export function fitSize(ctx, text, role, size, maxWidth, { min = 6, tracking, caps, weight, italic } = {}) {
  const def = roleOf(role);
  const shown = applyCase(text, caps ?? def.caps);
  const em = tracking ?? def.tracking ?? 0;
  const widthAt = (s) => {
    ctx.font = fontFor(role, s, { weight, italic });
    setTracking(ctx, em, s);
    const w = widthOf(ctx, shown);
    clearTracking(ctx);
    return w;
  };
  const fullWidth = widthAt(size);
  if (fullWidth <= maxWidth || size <= min) return size;
  // The rungs, made the way the walk makes them (repeated "- 2", floored at min), so each is the very same number.
  const rungs = [size];
  while (rungs.at(-1) > min) rungs.push(Math.max(min, rungs.at(-1) - 2));
  const last = rungs.length - 1;
  // Predicted: the highest rung at or below the size that would just fit.
  const target = (size * maxWidth) / fullWidth;
  let i = rungs.findIndex((s) => s <= target);
  if (i < 1) i = i === 0 ? 1 : last; // (rung 0 is known not to fit)
  const fits = (k) => k === last || widthAt(rungs[k]) <= maxWidth; // (the last rung is returned whether it fits or not)
  while (!fits(i)) i++; // too wide: down a rung
  while (i > 1 && fits(i - 1)) i--; // the rung above fits too: up a rung
  ctx.font = fontFor(role, rungs[i], { weight, italic }); // (a size already measured: cheap)
  return rungs[i];
}

/**
 * Draw `text` at (x, y). Options (all but `role` optional; the role's own treatment fills in the rest):
 *   size, maxWidth (shrink to fit), min, fill ('#fff' or a [top, bottom] gradient), align ('center'), baseline ('middle'),
 *   caps, tracking (em), slant, outline { color, width (em) } | false, shadow { color, dx, dy (em) } | false,
 *   glow { color, blur (em) } | false (color 'currentColor' = the fill), weight, italic, alpha.
 * The context is saved and restored, so drawing never leaks a font, shadow or transform to the next call.
 */
export function drawType(ctx, text, x, y, o) {
  const def = roleOf(o.role);
  const caps = o.caps ?? def.caps;
  const shown = applyCase(text, caps);
  const tracking = o.tracking ?? def.tracking ?? 0;
  const slant = o.slant ?? def.slant ?? 0;
  const outline = o.outline === undefined ? def.outline : o.outline;
  const shadow = o.shadow === undefined ? def.shadow : o.shadow;
  const glow = o.glow === undefined ? def.glow : o.glow;
  const align = o.align ?? 'center';
  const size = o.maxWidth
    ? fitSize(ctx, text, o.role, o.size, o.maxWidth, { min: o.min, tracking, caps, weight: o.weight, italic: o.italic })
    : o.size;

  ctx.save();
  ctx.font = fontFor(o.role, size, { weight: o.weight, italic: o.italic });
  ctx.textAlign = align;
  ctx.textBaseline = o.baseline ?? 'middle';
  setTracking(ctx, tracking, size);
  // letterSpacing adds a gap after the last letter too: shift a centred line back by half of it
  const dx = align === 'center' ? (tracking * size) / 2 : 0;
  ctx.translate(x + dx, y);
  if (slant) ctx.transform(1, 0, -slant, 1, 0, 0);
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;

  const fillStyle = Array.isArray(o.fill)
    ? (() => { const g = ctx.createLinearGradient(0, -size * 0.5, 0, size * 0.5); g.addColorStop(0, o.fill[0]); g.addColorStop(1, o.fill[1]); return g; })()
    : (o.fill ?? '#ffffff');

  ctx.lineJoin = 'round';
  if (shadow) {
    ctx.fillStyle = shadow.color;
    ctx.strokeStyle = shadow.color;
    if (outline) { ctx.lineWidth = outline.width * size; ctx.strokeText(shown, shadow.dx * size, shadow.dy * size); }
    ctx.fillText(shown, shadow.dx * size, shadow.dy * size);
  }
  if (outline) {
    ctx.strokeStyle = outline.color;
    ctx.lineWidth = outline.width * size;
    ctx.strokeText(shown, 0, 0);
  }
  if (glow) {
    ctx.shadowColor = glow.color === 'currentColor' ? (Array.isArray(o.fill) ? o.fill[0] : fillStyle) : glow.color;
    ctx.shadowBlur = glow.blur * size;
  }
  ctx.fillStyle = fillStyle;
  ctx.fillText(shown, 0, 0);
  ctx.restore();
  return size;
}
