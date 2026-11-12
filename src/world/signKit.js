// =============================================================================
// SIGN KIT: small canvas helpers the sign styles (world/signStyles.js) share, so every sign can have depth (bevels,
// domed rivets, bulbs with halos, brushed metal) and wear (grain, scuffs, glare) without copy-pasting the drawing.
// All units are the sign page's own: it is always drawn 1024 wide (world/textures.js makeSignTexture).
// Everything here is deterministic (seeded), so a sign looks the same every run and tests can compare canvases.
// =============================================================================

/** A tiny seeded random generator (mulberry32). `seed` may be any string or number. */
export function rng(seed = 1) {
  let s = 0;
  for (const ch of String(seed)) s = (Math.imul(s, 31) + ch.charCodeAt(0)) | 0;
  s = (s ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fill the whole page with a vertical (or diagonal, `angle` in turns of the page height) colour ramp. */
export function ramp(ctx, w, h, stops, { diagonal = false } = {}) {
  const g = diagonal ? ctx.createLinearGradient(0, 0, w, h) : ctx.createLinearGradient(0, 0, 0, h);
  stops.forEach((c, i) => g.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A raised or sunk frame: light on the top-left edges, dark on the bottom-right (swap `sunk`). */
export function bevel(ctx, w, h, inset = 6, { width = 5, light = 'rgba(255,255,255,0.5)', dark = 'rgba(0,0,0,0.5)', sunk = false } = {}) {
  const [a, b] = sunk ? [dark, light] : [light, dark];
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  ctx.lineWidth = width;
  ctx.lineCap = 'butt';
  ctx.strokeStyle = a;
  ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
  ctx.strokeStyle = b;
  ctx.beginPath(); ctx.moveTo(x1, y0); ctx.lineTo(x1, y1); ctx.lineTo(x0, y1); ctx.stroke();
}

/** A domed rivet / bolt head: a dark seat, a lit dome and a small glint. */
export function rivet(ctx, x, y, r = 7, { base = '#8a93a0', seat = 'rgba(0,0,0,0.45)', slot = false } = {}) {
  ctx.fillStyle = seat;
  ctx.beginPath(); ctx.arc(x + r * 0.15, y + r * 0.25, r * 1.05, 0, Math.PI * 2); ctx.fill();
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, base);
  g.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (slot) {
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = Math.max(1.5, r * 0.22);
    ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + r * 0.1); ctx.lineTo(x + r * 0.55, y - r * 0.1); ctx.stroke();
  }
}

/** A row of lit bulbs (marquee style): a halo, a hot bulb and a glint. Alternate colours with `alt`. */
export function bulbs(ctx, x0, x1, y, step, { color = '#ffd166', alt = null, r = 5, halo = 0.45 } = {}) {
  const count = Math.max(1, Math.round((x1 - x0) / step));
  const pitch = count > 1 ? (x1 - x0) / count : 0;
  for (let i = 0; i <= count; i++) {
    const x = x0 + i * pitch;
    const c = alt && i % 2 ? alt : color;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
    g.addColorStop(0, c);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = halo;
    ctx.fillStyle = g;
    ctx.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    ctx.globalAlpha = 1;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.38, 0, Math.PI * 2); ctx.fill();
  }
}

/** Diagonal stripes (caution tape, awnings) inside the rectangle. `gap` is the stripe width; `lean` slants them. */
export function stripes(ctx, x, y, w, h, { a = '#ffd23f', b = '#17181b', gap = 14, lean = 1 } = {}) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = a;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = b;
  const slant = h * lean;
  for (let p = -slant; p < w + gap * 2; p += gap * 2) {
    ctx.beginPath();
    ctx.moveTo(x + p, y); ctx.lineTo(x + p + gap, y);
    ctx.lineTo(x + p + gap - slant, y + h); ctx.lineTo(x + p - slant, y + h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Vertical stripes (awnings). Each stripe may end in a round scallop when `scallop` is set. */
export function awning(ctx, x, y, w, h, { a = '#d62839', b = '#fff3da', stripe = 40, scallop = true } = {}) {
  ctx.save();
  const n = Math.ceil(w / stripe);
  for (let i = 0; i < n; i++) {
    const sx = x + i * stripe;
    ctx.fillStyle = i % 2 ? b : a;
    ctx.fillRect(sx, y, stripe + 1, h - (scallop ? stripe / 2 : 0));
    if (scallop) {
      ctx.beginPath(); ctx.arc(sx + stripe / 2, y + h - stripe / 2, stripe / 2, 0, Math.PI); ctx.fill();
    }
  }
  ctx.restore();
}

/** A checkerboard strip (diner trim). */
export function checker(ctx, x, y, w, h, { a = '#f4f0e6', b = '#14141a', size = 14 } = {}) {
  const cols = Math.ceil(w / size), rows = Math.max(1, Math.round(h / size));
  const cell = h / rows;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? a : b;
      ctx.fillRect(x + c * size, y + r * cell, size, cell);
    }
  }
  ctx.restore();
}

/** Small ornaments: 'diamond', 'star' (n-point), 'sparkle' (4-point curved), 'dot'. */
export function ornament(ctx, kind, x, y, r, fill = '#ffd166') {
  ctx.fillStyle = fill;
  ctx.beginPath();
  if (kind === 'diamond') {
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y);
  } else if (kind === 'sparkle') {
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  } else if (kind === 'dot') {
    ctx.arc(x, y, r, 0, Math.PI * 2);
  } else {
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 ? r * 0.42 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  }
  ctx.closePath();
  ctx.fill();
}

/** A burst (price-starburst): `spikes` points between radius `inner` and `outer`. */
export function burst(ctx, x, y, outer, inner, spikes, fill, rotate = 0) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 + rotate;
    const rr = i % 2 ? inner : outer;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Rounded-rect path helper that works where ctx.roundRect is missing. */
export function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
}

// ---- finishing passes: the last layers of a sign, under or over the lettering -------------------------------------

/** Brushed metal: faint horizontal hairlines across the rectangle. */
export function brushed(ctx, x, y, w, h, { seed = 1, alpha = 0.08, light = '#ffffff', dark = '#000000' } = {}) {
  const r = rng(seed);
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let i = 0; i < h / 1.5; i++) {
    ctx.globalAlpha = alpha * (0.3 + r() * 0.7);
    ctx.fillStyle = r() > 0.5 ? light : dark;
    ctx.fillRect(x, y + r() * h, w, 1);
  }
  ctx.restore();
}

/** Speckled grain (paint, paper, cast metal): `amount` ~ 0.2 light .. 1 heavy. */
export function grain(ctx, w, h, { seed = 1, amount = 0.4, dark = 'rgba(0,0,0,0.5)', light = 'rgba(255,255,255,0.5)' } = {}) {
  const r = rng(seed);
  const n = Math.round(w * h * 0.0014 * amount);
  for (let i = 0; i < n; i++) {
    ctx.globalAlpha = 0.04 + r() * 0.1;
    ctx.fillStyle = r() > 0.5 ? dark : light;
    ctx.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2);
  }
  ctx.globalAlpha = 1;
}

/** Scuffs and scratches: short bright/dark strokes, heavier near the bottom edge and the corners. */
export function scuffs(ctx, w, h, { seed = 1, count = 18, light = '#ffffff', dark = '#000000', alpha = 0.22 } = {}) {
  const r = rng(seed);
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const nearEdge = r() < 0.55;
    const x = nearEdge ? (r() < 0.5 ? r() * w * 0.18 : w - r() * w * 0.18) : r() * w;
    const y = nearEdge ? h * (0.6 + r() * 0.4) : r() * h;
    const len = 6 + r() * 40, ang = (r() - 0.5) * 0.5;
    ctx.globalAlpha = alpha * (0.4 + r() * 0.6);
    ctx.strokeStyle = r() > 0.4 ? dark : light;
    ctx.lineWidth = 1 + r() * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Darkened edges (aged, hand-lit signs). */
export function vignette(ctx, w, h, strength = 0.3) {
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Glass / acrylic glare: a soft diagonal light band across the sign. */
export function glare(ctx, w, h, strength = 0.12) {
  const g = ctx.createLinearGradient(0, 0, w * 0.5, h * 2.2);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.38, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, `rgba(255,255,255,${strength})`);
  g.addColorStop(0.62, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** A soft top-light / bottom-shade across a flat ground, so the sign reads as a lit panel, not a flat fill. */
export function lightbox(ctx, w, h, { top = 0.14, bottom = 0.24 } = {}) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(255,255,255,${top})`);
  g.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.addColorStop(1, `rgba(0,0,0,${bottom})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
