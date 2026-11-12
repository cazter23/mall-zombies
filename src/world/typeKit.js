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

/** Largest size (stepping down 2 px from `size`) at which `text` set in `role` fits `maxWidth`; never smaller than `min`. */
export function fitSize(ctx, text, role, size, maxWidth, { min = 6, tracking, caps, weight, italic } = {}) {
  const def = roleOf(role);
  const shown = applyCase(text, caps ?? def.caps);
  const em = tracking ?? def.tracking ?? 0;
  let s = size;
  for (;;) {
    ctx.font = fontFor(role, s, { weight, italic });
    setTracking(ctx, em, s);
    const w = widthOf(ctx, shown);
    clearTracking(ctx);
    if (w <= maxWidth || s <= min) return s;
    s = Math.max(min, s - 2);
  }
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
