// =============================================================================
// SIGN STYLES: one painter per sign style (the `style` of world/textures.js makeSignTexture). Each paints a whole sign
// page (always 1024 wide) with its own LAYOUT, ORNAMENTS, MATERIAL and WEAR, then draws the lettering through
// drawType with the style's role (config/typefaces.js signKinds). Shared pieces live in world/signKit.js.
// A painter gets { ctx, text, subtext, width, height, cx, cy, background, color, accent, font, seed }:
// background/color/accent are the caller's overrides (a landmark sign passes its own palette); every painter has
// its own defaults when they are missing.
// =============================================================================
import { signKinds } from '../config/typefaces.js';
import { drawType, fitSize } from './typeKit.js';
import {
  ramp, bevel, rivet, bulbs, stripes, awning, checker, ornament, burst, roundedRect,
  brushed, grain, scuffs, vignette, glare, lightbox, rng,
} from './signKit.js';

const role = (p, kind, which = 'main') => p.font || signKinds[kind][which];

/** Department store: dark lacquer with a gold double rule, corner fleurons and an engraved gold name. */
function hoffmanBrand(p) {
  const { ctx, width: w, height: h, cx } = p;
  const ink = p.color || '#f2cd8d', gold = p.accent || '#c9a15f';
  ramp(ctx, w, h, [p.background || '#43302f', '#2c1d1e', p.background || '#3b2929']);
  brushed(ctx, 0, 0, w, h, { seed: p.seed, alpha: 0.05 });
  ctx.strokeStyle = gold; ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, w - 20, h - 20);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(19, 19, w - 38, h - 38);
  // corner fleurons: a diamond and two beads on each corner of the inner rule
  for (const [x, y, dx, dy] of [[19, 19, 1, 1], [w - 19, 19, -1, 1], [19, h - 19, 1, -1], [w - 19, h - 19, -1, -1]]) {
    ornament(ctx, 'diamond', x, y, 9, gold);
    ornament(ctx, 'dot', x + dx * 19, y, 2.6, gold);
    ornament(ctx, 'dot', x, y + dy * 19, 2.6, gold);
  }
  const nameY = h * (p.subtext ? 0.42 : 0.51);
  const size = Math.round(h * (p.subtext ? 0.46 : 0.57));
  drawType(ctx, p.text, cx, nameY, { role: role(p, 'hoffmanBrand'), size, maxWidth: w * 0.84, fill: ['#fff2c8', ink, '#b98a4a'],
    shadow: { color: 'rgba(0,0,0,0.6)', dx: 0.025, dy: 0.04 } });
  if (p.subtext) {
    // a hairline rule with a centre diamond either side of the tagline
    const ty = h * 0.76;
    ctx.strokeStyle = gold; ctx.lineWidth = 1.5;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + side * 40, ty); ctx.lineTo(cx + side * w * 0.36, ty); ctx.stroke(); }
    ornament(ctx, 'diamond', cx, ty, 6, gold);
    drawType(ctx, p.subtext, cx, h * 0.69, { role: signKinds.hoffmanBrand.sub, size: Math.round(h * 0.15), maxWidth: w * 0.7, fill: ink });
  }
  vignette(ctx, w, h, 0.3);
}

/** Discount mart: corporate blue with a lit price flag, tick-mark bars and a clearance starburst. */
function martBrand(p) {
  const { ctx, width: w, height: h, cx } = p;
  const ink = p.color || '#fff0d2', accent = p.accent || '#f58a39';
  ramp(ctx, w, h, [p.background || '#1f3a63', p.background || '#182b49', '#101d33']);
  // top and bottom brand bars with a white pin-stripe and a row of price-tick marks
  for (const y of [0, h * 0.91]) {
    ctx.fillStyle = accent; ctx.fillRect(0, y, w, h * 0.09);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(0, y + (y ? 3 : h * 0.09 - 5), w, 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let x = 14; x < w; x += 22) ctx.fillRect(x, h * 0.912, 2, h * 0.03);
  // a little corner price flag (a folded triangle)
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath(); ctx.moveTo(0, h * 0.09); ctx.lineTo(w * 0.07, h * 0.09); ctx.lineTo(0, h * 0.09 + w * 0.07); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.moveTo(w * 0.07, h * 0.09); ctx.lineTo(w * 0.07, h * 0.09 + 12); ctx.lineTo(w * 0.07 - 12, h * 0.09 + 12); ctx.closePath(); ctx.fill();
  const nameY = h * (p.subtext ? 0.43 : 0.51);
  drawType(ctx, p.text, cx, nameY, { role: role(p, 'martBrand'), size: Math.round(h * (p.subtext ? 0.46 : 0.57)), maxWidth: w * 0.84, fill: ink,
    slant: 0.06, shadow: { color: '#0a1424', dx: 0.04, dy: 0.05 } });
  if (p.subtext) drawType(ctx, p.subtext, cx, h * 0.74, { role: signKinds.martBrand.sub, size: Math.round(h * 0.16), maxWidth: w * 0.85, fill: accent });
  lightbox(ctx, w, h, { top: 0.1, bottom: 0.15 });
}

/** Computer store: a CRT screen: phosphor scanlines, a boot prompt, circuit corners and a bar of segments. */
function tech(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  const neon = p.color || '#00f0d4';
  ramp(ctx, w, h, [p.background || '#09162a', '#050b16']);
  // a faint grid under the glass
  ctx.strokeStyle = 'rgba(0,240,212,0.07)'; ctx.lineWidth = 1;
  for (let x = 32; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 32; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  // circuit traces from the corners
  ctx.strokeStyle = neon; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
  const L = Math.min(48, h * 0.4);
  for (const [x, y, sx, sy] of [[12, 12, 1, 1], [w - 12, 12, -1, 1], [12, h - 12, 1, -1], [w - 12, h - 12, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(x + sx * L, y); ctx.lineTo(x, y); ctx.lineTo(x, y + sy * L); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + sx * L * 0.5, y + sy * 8); ctx.lineTo(x + sx * L * 0.5, y + sy * 18); ctx.lineTo(x + sx * L * 0.8, y + sy * 18); ctx.stroke();
    ornament(ctx, 'dot', x, y, 4, neon);
  }
  ctx.globalAlpha = 1;
  // boot prompt and a progress bar of segments
  drawType(ctx, 'C:\\>', 56, h * 0.2, { role: 'led', size: Math.round(h * 0.17), fill: neon, align: 'left', alpha: 0.7 });
  ctx.fillStyle = neon;
  const seg = 12, filled = 9;
  for (let i = 0; i < 14; i++) {
    ctx.globalAlpha = i < filled ? 0.9 : 0.18;
    ctx.fillRect(w - 56 - 14 * seg + i * seg, h - 28, seg - 3, 9);
  }
  ctx.globalAlpha = 1;
  drawType(ctx, p.text, cx, cy, { role: role(p, 'tech'), size: Math.round(h * 0.6), maxWidth: w * 0.74, fill: neon });
  // phosphor scanlines and curved-glass glare over the lettering
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
  glare(ctx, w, h, 0.07);
  vignette(ctx, w, h, 0.5);
}

/** Sports store: a jersey: racing stripes, a pennant at each end, stars and a gradient-filled outlined name. */
function varsity(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#12284a', p.background || '#0c1a2e']);
  const accent = p.accent || '#ff8a3d';
  for (const [y, hh, c] of [[8, 4, '#ffffff'], [15, 7, accent], [h - 12, 4, '#ffffff'], [h - 22, 7, accent]]) {
    ctx.fillStyle = c; ctx.fillRect(0, y, w, hh);
  }
  // pennants: long triangles pointing inward
  for (const side of [-1, 1]) {
    const x = side < 0 ? 22 : w - 22;
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.moveTo(x, cy - 30); ctx.lineTo(x - side * 86, cy); ctx.lineTo(x, cy + 30); ctx.closePath(); ctx.fill();
    ornament(ctx, 'star', x - side * 22, cy, 9, '#fff');
  }
  // a row of tiny stars under the top stripes
  for (let i = 0; i < 9; i++) ornament(ctx, 'star', w * 0.3 + i * (w * 0.4 / 8), 36, 4.5, 'rgba(255,255,255,0.55)');
  drawType(ctx, p.text, cx + 6, cy + 4, { role: role(p, 'varsity'), size: Math.round(h * 0.62), maxWidth: w * 0.62, fill: ['#ffd9a6', p.color || '#ff8a3d', '#e2621c'] });
  grain(ctx, w, h, { seed: p.seed, amount: 0.25 });
}

/** Toy store: a bright lightbox with a wavy candy frame, bubbles and confetti. */
function toy(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#8f45f2', p.background || '#8338ec', '#5b1fb0']);
  const r = rng(p.seed);
  // confetti and bubbles behind the name
  const palette = ['#ffd60a', '#00f5d4', '#ff70a6', '#70e000', '#ffffff'];
  for (let i = 0; i < 26; i++) {
    const x = 70 + r() * (w - 140), y = 12 + r() * (h - 24);
    ctx.globalAlpha = 0.35;
    if (i % 3 === 0) { ctx.strokeStyle = palette[i % 5]; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, 4 + r() * 6, 0, Math.PI * 2); ctx.stroke(); }
    else { ctx.save(); ctx.translate(x, y); ctx.rotate(r() * 3); ctx.fillStyle = palette[i % 5]; ctx.fillRect(-5, -2, 10, 4); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
  // wavy candy frame: scalloped bumps along the top and bottom
  for (const [y, dir] of [[0, 1], [h, -1]]) {
    for (let x = 0, i = 0; x < w; x += 34, i++) {
      ctx.fillStyle = palette[i % 4];
      ctx.beginPath(); ctx.arc(x + 17, y, 17, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.arc(x + 12, y + dir * 6, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
  for (const [x, y] of [[44, cy], [w - 44, cy]]) ornament(ctx, 'sparkle', x, y, 18, '#ffd60a');
  ornament(ctx, 'sparkle', 80, h * 0.25, 9, '#fff'); ornament(ctx, 'sparkle', w - 80, h * 0.75, 9, '#fff');
  drawType(ctx, p.text, cx, cy, { role: role(p, 'toy'), size: Math.round(h * 0.55), maxWidth: w * 0.74, fill: [p.color || '#ffe94a', '#ffb300'] });
  lightbox(ctx, w, h, { top: 0.2, bottom: 0.18 });
}

/** Hardware store: a steel plate: brushed metal, hazard end caps, bolts, a rust bloom and a stencilled name. */
function industrial(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#2b2f36', '#1c1f24', p.background || '#24272d']);
  brushed(ctx, 0, 0, w, h, { seed: p.seed, alpha: 0.09 });
  ctx.strokeStyle = '#0f1114'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, w - 10, h - 10);
  bevel(ctx, w, h, 13, { width: 4, light: 'rgba(160,170,185,0.55)', dark: 'rgba(0,0,0,0.6)' });
  // hazard end caps
  stripes(ctx, 24, 24, 34, h - 48, { a: '#ffd23f', b: '#1b1d21', gap: 12 });
  stripes(ctx, w - 58, 24, 34, h - 48, { a: '#ffd23f', b: '#1b1d21', gap: 12 });
  for (const [x, y] of [[24, 24], [w - 24, 24], [24, h - 24], [w - 24, h - 24]]) rivet(ctx, x, y, 8, { base: '#8f98a6', slot: true });
  // a plate seam and two more bolts mid-panel
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx, 18); ctx.lineTo(cx, h - 18); ctx.stroke();
  drawType(ctx, p.text, cx, cy, { role: role(p, 'industrial'), size: Math.round(h * 0.66), maxWidth: w * 0.7, fill: [p.color || '#ffd23f', '#e0a800'] });
  // rust bloom and scuffs
  const r = rng(p.seed + 'rust');
  for (let i = 0; i < 5; i++) {
    const x = r() * w, y = h * (0.7 + r() * 0.3);
    const g = ctx.createRadialGradient(x, y, 0, x, y, 40 + r() * 40);
    g.addColorStop(0, 'rgba(130,60,20,0.28)'); g.addColorStop(1, 'rgba(130,60,20,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 90, y - 90, 180, 180);
  }
  scuffs(ctx, w, h, { seed: p.seed, count: 22, alpha: 0.3 });
}

/** Burger joint: a chrome-trimmed neon diner: checkerboard strip, pinstripes, a red neon border and a script name. */
function diner(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#35090f', p.background || '#28080c', '#1a0408']);
  const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, w * 0.5);
  glow.addColorStop(0, 'rgba(255,170,60,0.2)'); glow.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  // chrome trim bands with a checkerboard stripe below the top one
  for (const y of [0, h - 16]) {
    ramp2(ctx, 0, y, w, 16, ['#f6f7f9', '#a9afb8', '#e9ecef', '#7b828d']);
  }
  checker(ctx, 0, 18, w, 12, { size: 12 });
  checker(ctx, 0, h - 30, w, 12, { size: 12 });
  // double neon-red tube frame
  ctx.strokeStyle = '#ff3b4e'; ctx.lineWidth = 4; ctx.shadowColor = '#ff3b4e'; ctx.shadowBlur = 12;
  roundedRect(ctx, 22, 40, w - 44, h - 80, 26); ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5;
  roundedRect(ctx, 22, 40, w - 44, h - 80, 26); ctx.stroke();
  for (const x of [44, w - 44]) ornament(ctx, 'diamond', x, cy, 10, '#ffd166');
  drawType(ctx, p.text, cx, cy + 3, { role: role(p, 'diner'), size: Math.round(h * 0.6), maxWidth: w * 0.74, fill: ['#fff1b8', p.color || '#ffd166', '#e8a735'] });
  glare(ctx, w, h, 0.06);
}

/** A horizontal ramp on a sub-rectangle (chrome). */
function ramp2(ctx, x, y, w, h, stops) {
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
}

/** Wok stall: imperial red lacquer: lattice corners, two hanging lanterns, a gold seal and a brush name. */
function wok(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#5c0d17', p.background || '#4a0810', '#2e050a']);
  // wooden lattice in the corners
  ctx.strokeStyle = 'rgba(255,210,63,0.28)'; ctx.lineWidth = 2;
  for (const [x0, sx] of [[0, 1], [w, -1]]) {
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(x0 + sx * i * 12, 0); ctx.lineTo(x0 + sx * i * 12, h); ctx.stroke();
    }
  }
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
  ctx.strokeRect(70, 14, w - 140, h - 28);
  ctx.lineWidth = 1.5; ctx.strokeRect(77, 21, w - 154, h - 42);
  // lanterns
  for (const x of [44, w - 44]) {
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h * 0.22); ctx.stroke();
    const g = ctx.createRadialGradient(x - 4, h * 0.42, 2, x, h * 0.45, 24);
    g.addColorStop(0, '#ff7a6b'); g.addColorStop(1, '#c20f2a');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, h * 0.45, 20, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(x - 9, h * 0.2, 18, 6); ctx.fillRect(x - 9, h * 0.45 + 24, 18, 6);
    ctx.strokeStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x, h * 0.45 + 30); ctx.lineTo(x, h * 0.45 + 48); ctx.stroke();
  }
  // a small square seal, as if stamped, bottom right inside the frame
  ctx.fillStyle = '#d90429'; ctx.fillRect(w - 128, h - 64, 34, 34);
  ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 2; ctx.strokeRect(w - 124, h - 60, 26, 26);
  drawType(ctx, p.text, cx, cy, { role: role(p, 'wok'), size: Math.round(h * 0.62), maxWidth: w * 0.66, fill: ['#fff0a8', p.color || '#ffd23f', '#e3a21a'] });
  vignette(ctx, w, h, 0.3);
}

/** Corn dog stand: a striped fairground awning over a ticket-booth board, with a bulb row and notched corners. */
function carnival(p) {
  const { ctx, width: w, height: h, cx } = p;
  ramp(ctx, w, h, [p.background || '#1a3a78', p.background || '#122c5e', '#0a1a38']);
  const aw = Math.round(h * 0.26);
  awning(ctx, 0, 0, w, aw, { a: '#d62839', b: '#fff3da', stripe: 44 });
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, aw + 2, w, 7);
  bulbs(ctx, 40, w - 40, h - 20, 36, { color: '#ffd166', alt: '#ff8fa3', r: 5.5 });
  for (const [nx, ny] of [[0, h], [w, h]]) { ctx.fillStyle = '#071122'; ctx.beginPath(); ctx.arc(nx, ny, 22, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
  roundedRect(ctx, 22, aw + 16, w - 44, h - aw - 52, 12); ctx.stroke(); ctx.setLineDash([]);
  const cy = (aw + h - 36) / 2 + 4;
  drawType(ctx, p.text, cx, cy, { role: role(p, 'carnival'), size: Math.round(h * 0.46), maxWidth: w * 0.78, fill: ['#fff0b8', p.color || '#ffd166'] });
}

/** Mega Mart aisle and department signs: corporate blue, a lit yellow bar, a roundel or burst on the left. */
function supermarket(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#1450a0', p.background || '#0f3c75', '#0a2a52']);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, 4);
  ramp2(ctx, 0, h - 14, w, 14, ['#ffe56e', '#ffc61a']);
  // a faint grid of shelf-edge tick marks
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  for (let x = 90; x < w - 60; x += 38) ctx.fillRect(x, h - 22, 2, 8);
  if (p.text.startsWith('AISLE')) {
    const num = (p.text.match(/AISLE\s+(\d+)/) || [0, '1'])[1];
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.arc(58, cy - 1, Math.min(32, h * 0.4), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(54, cy - 4, Math.min(30, h * 0.38), 0, Math.PI * 2); ctx.fill();
    drawType(ctx, num, 54, cy - 4, { role: 'martBrand', size: Math.round(h * 0.42), fill: '#0f3c75' });
  } else if (p.text.includes('MEGA MART')) {
    burst(ctx, 54, cy - 4, 26, 11, 8, '#ffd23f', 0.2);
    burst(ctx, 54, cy - 4, 13, 6, 8, '#d62839', 0.2);
  }
  drawType(ctx, p.text, cx, cy - 4, { role: role(p, 'supermarket'), size: Math.round(h * 0.58), maxWidth: w * 0.76, fill: [p.color || '#ffe056', '#ffb300'],
    slant: 0.08, shadow: { color: 'rgba(0,0,0,0.5)', dx: 0.05, dy: 0.05 } });
  glare(ctx, w, h, 0.07);
}

/** Going-out-of-business banner: torn caution tape ends, a red SALE burst, grommets and a taped corner. */
function clearance(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  const red = p.background === '#d62839';
  ramp(ctx, w, h, [p.background || '#fff04a', p.background || '#ffe500']);
  const sw = Math.round(w * 0.12);
  stripes(ctx, 0, 0, sw, h, { a: '#ffe500', b: '#111114', gap: 12 });
  stripes(ctx, w - sw, 0, sw, h, { a: '#ffe500', b: '#111114', gap: 12 });
  // a red starburst peeking behind the name, so it reads as a shouted sale
  burst(ctx, cx, cy, h * 0.9, h * 0.62, 18, red ? 'rgba(255,255,255,0.12)' : 'rgba(214,40,57,0.16)', 0.1);
  for (const [gx, gy] of [[sw + 18, 18], [w - sw - 18, 18], [sw + 18, h - 18], [w - sw - 18, h - 18]]) rivet(ctx, gx, gy, 8, { base: '#c79a45' });
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.025);
  drawType(ctx, p.text, 0, 0, { role: role(p, 'clearance'), size: Math.round(h * 0.65), maxWidth: w * 0.66,
    fill: p.color || (red ? '#ffffff' : '#111114'), shadow: { color: red ? '#7a0f1a' : 'rgba(214,40,57,0.9)', dx: 0.045, dy: 0.045 } });
  ctx.restore();
  // a strip of masking tape across a corner
  ctx.save(); ctx.translate(sw + 46, 8); ctx.rotate(-0.5);
  ctx.fillStyle = 'rgba(235,225,190,0.82)'; ctx.fillRect(-34, -10, 68, 22); ctx.restore();
  grain(ctx, w, h, { seed: p.seed, amount: 0.5 });
  scuffs(ctx, w, h, { seed: p.seed, count: 14, alpha: 0.2 });
}

/** Price sticker: a day-glo label with a scalloped edge, halftone dots, a punch hole and stamped ink. */
function pricetag(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#fff35a', p.background || '#ffee00']);
  // halftone dots toward the right edge
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let y = 10; y < h; y += 14) for (let x = w * 0.72; x < w; x += 14) {
    const t = (x - w * 0.72) / (w * 0.28);
    ctx.beginPath(); ctx.arc(x + (y / 14 % 2) * 7, y, 1 + t * 3.2, 0, Math.PI * 2); ctx.fill();
  }
  // scalloped top/bottom cut
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let x = 0; x < w; x += 26) { ctx.beginPath(); ctx.arc(x + 13, 0, 9, 0, Math.PI); ctx.fill(); ctx.beginPath(); ctx.arc(x + 13, h, 9, Math.PI, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 3; ctx.strokeRect(10, 14, w - 20, h - 28);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(34, cy, 9, 0, Math.PI * 2); ctx.fill();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.02);
  drawType(ctx, p.text, 0, 0, { role: role(p, 'pricetag'), size: Math.round(h * 0.72), maxWidth: w * 0.78, fill: p.color || '#141419' });
  ctx.restore();
  grain(ctx, w, h, { seed: p.seed, amount: 0.4 });
}

/** Warning plate: a black header with a red DANGER pill over caution stripes, bolted at the corners. */
function hazard(p) {
  const { ctx, width: w, height: h, cx } = p;
  ramp(ctx, w, h, [p.background || '#ffdd4d', p.background || '#ffd23f']);
  ctx.strokeStyle = '#18191c'; ctx.lineWidth = 8; ctx.strokeRect(6, 6, w - 12, h - 12);
  const barH = Math.round(h * 0.42);
  ctx.fillStyle = '#18191c'; ctx.fillRect(10, 10, w - 20, barH);
  stripes(ctx, 10, 10 + barH - 8, w - 20, 8, { a: '#ffd23f', b: '#18191c', gap: 10 });
  const pillW = Math.min(240, w * 0.36), pillH = barH - 22;
  ctx.fillStyle = '#d90429'; roundedRect(ctx, cx - pillW / 2, 16, pillW, pillH, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2; roundedRect(ctx, cx - pillW / 2 + 4, 20, pillW - 8, pillH - 8, 7); ctx.stroke();
  drawType(ctx, 'DANGER', cx, 16 + pillH / 2, { role: signKinds.hazard.sub, size: Math.round(pillH * 0.68), fill: '#ffffff' });
  // warning triangles flanking the pill
  for (const x of [cx - pillW / 2 - 50, cx + pillW / 2 + 50]) {
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.moveTo(x, 16); ctx.lineTo(x + 26, 16 + pillH); ctx.lineTo(x - 26, 16 + pillH); ctx.closePath(); ctx.fill();
    drawType(ctx, '!', x, 16 + pillH * 0.68, { role: 'stencil', size: Math.round(pillH * 0.5), fill: '#18191c' });
  }
  const lowerH = h - barH - 20;
  drawType(ctx, p.text, cx, barH + 10 + lowerH / 2, { role: role(p, 'hazard'), size: Math.round(lowerH * 0.58), maxWidth: w * 0.82, fill: p.color || '#18191c' });
  for (const [x, y] of [[26, h - 24], [w - 26, h - 24]]) rivet(ctx, x, y, 7, { base: '#6c6f76', slot: true });
  scuffs(ctx, w, h, { seed: p.seed, count: 16, alpha: 0.28 });
  grain(ctx, w, h, { seed: p.seed, amount: 0.3 });
}

/** Register / now-serving readout: smoked acrylic over a segment display, with a bezel and a reflection. */
function digital(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  const ink = p.color || '#ff2a55';
  ramp(ctx, w, h, [p.background || '#0c1218', '#05080b']);
  const r = role(p, 'digital');
  const size = fitSize(ctx, p.text, r, Math.round(h * 0.62), w * 0.86);
  drawType(ctx, '888888888888'.slice(0, p.text.length || 6), cx, cy, { role: r, size, fill: 'rgba(255,42,75,0.07)' });
  drawType(ctx, p.text, cx, cy, { role: r, size, fill: ink, glow: { color: ink, blur: 0.28 } });
  // slim bezel with screw heads and a smoked-acrylic sheen
  ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 6; ctx.strokeRect(6, 6, w - 12, h - 12);
  bevel(ctx, w, h, 12, { width: 3, light: 'rgba(255,255,255,0.18)', dark: 'rgba(0,0,0,0.7)', sunk: true });
  for (const [x, y] of [[20, 20], [w - 20, 20], [20, h - 20], [w - 20, h - 20]]) rivet(ctx, x, y, 5, { base: '#4b5360', slot: true });
  glare(ctx, w, h, 0.1);
}

/** Staff scrawl: lined paper, a torn edge, a coffee ring, tape, a fold crease, and a marker note. */
function handwritten(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#f8f3e3', p.background || '#f0e9d2']);
  ctx.strokeStyle = 'rgba(60,110,180,0.14)'; ctx.lineWidth = 2;
  for (let y = 22; y < h; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(214,40,57,0.22)'; ctx.beginPath(); ctx.moveTo(78, 0); ctx.lineTo(78, h); ctx.stroke();
  // a coffee ring and a centre fold
  ctx.strokeStyle = 'rgba(110,70,30,0.2)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(w * 0.84, h * 0.7, h * 0.22, 0.4, 5.6); ctx.stroke();
  const fold = ctx.createLinearGradient(cx - 12, 0, cx + 12, 0);
  fold.addColorStop(0, 'rgba(0,0,0,0)'); fold.addColorStop(0.5, 'rgba(0,0,0,0.1)'); fold.addColorStop(1, 'rgba(255,255,255,0.12)');
  ctx.fillStyle = fold; ctx.fillRect(cx - 12, 0, 24, h);
  // torn bottom edge
  const r = rng(p.seed);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 12) ctx.lineTo(x, h - 2 - r() * 7);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  for (const [x, rot] of [[32, -0.35], [w - 32, 0.35]]) {
    ctx.save(); ctx.translate(x, 12); ctx.rotate(rot);
    ctx.fillStyle = 'rgba(190,198,208,0.82)'; ctx.fillRect(-36, -12, 72, 24);
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-36, -12, 72, 6);
    ctx.restore();
  }
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-0.03);
  drawType(ctx, p.text, 0, 0, { role: role(p, 'handwritten'), size: Math.round(h * 0.56), maxWidth: w * 0.8, fill: p.color || '#18141d' });
  ctx.restore();
  grain(ctx, w, h, { seed: p.seed, amount: 0.5 });
}

/** Concourse wayfinding: an enamel transit plate: a pill outline, chevrons at both ends and a coloured foot bar. */
function wayfinding(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#17603c', p.background || '#12482e', '#0b2d1c']);
  ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(0, h - 10, w, 10);
  ctx.fillStyle = p.accent || '#ffd23f'; ctx.fillRect(0, h - 10, w * 0.3, 10);
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4;
  roundedRect(ctx, 10, 10, w - 20, h - 24, 16); ctx.stroke();
  // chevron pairs, pointing outward
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const x = side < 0 ? 52 : w - 52;
    for (const o of [0, 18]) {
      const tip = x + side * (10 - o), tail = tip - side * 12;
      ctx.beginPath(); ctx.moveTo(tail, cy - 16); ctx.lineTo(tip, cy); ctx.lineTo(tail, cy + 16); ctx.stroke();
    }
  }
  drawType(ctx, p.text, cx, cy - 2, { role: role(p, 'wayfinding'), size: Math.round(h * 0.58), maxWidth: w * 0.74, fill: p.color || '#ffffff' });
  glare(ctx, w, h, 0.07);
}

/** Customer Service: a brass nameplate: bevelled gold frame, engraved lettering and flourishes. */
function service(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#2a1f3a', p.background || '#1a1424', '#120d1a']);
  brushed(ctx, 0, 0, w, h, { seed: p.seed, alpha: 0.05 });
  ramp2(ctx, 6, 6, w - 12, 6, ['#fff1b8', '#b8862a']);
  ramp2(ctx, 6, h - 12, w - 12, 6, ['#fff1b8', '#b8862a']);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 3; ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.strokeStyle = 'rgba(255,209,102,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(25, 25, w - 50, h - 50);
  for (const [x, y] of [[18, 18], [w - 18, 18], [18, h - 18], [w - 18, h - 18]]) rivet(ctx, x, y, 7, { base: '#e0b44a' });
  for (const side of [-1, 1]) { ornament(ctx, 'diamond', cx + side * w * 0.43, cy, 8, '#ffd166'); ornament(ctx, 'dot', cx + side * w * 0.39, cy, 3, '#ffd166'); }
  drawType(ctx, p.text, cx, cy, { role: role(p, 'service'), size: Math.round(h * 0.52), maxWidth: w * 0.72, fill: ['#fff3c4', p.color || '#ffd166', '#c8932f'],
    shadow: { color: 'rgba(0,0,0,0.6)', dx: 0.02, dy: 0.04 } });
  glare(ctx, w, h, 0.07);
}

/** RESTOCK-O-MATIC: a mil-spec crate lid: orange hazard bars, chevron strips, rivets, stencilled letters and scuffs. */
function ammo(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  ramp(ctx, w, h, [p.background || '#201d26', '#16141a']);
  brushed(ctx, 0, 0, w, h, { seed: p.seed, alpha: 0.06 });
  for (const x of [0, w - 28]) {
    ctx.fillStyle = '#ff6a13'; ctx.fillRect(x, 0, 28, h);
    stripes(ctx, x + 4, 4, 20, h - 8, { a: '#ff6a13', b: '#1b1d21', gap: 10, lean: 0.6 });
  }
  ctx.fillStyle = '#ffd23f'; ctx.fillRect(28, 0, 5, h); ctx.fillRect(w - 33, 0, 5, h);
  for (const [x, y] of [[54, 18], [w - 54, 18], [54, h - 18], [w - 54, h - 18]]) rivet(ctx, x, y, 6, { base: '#7a7f88', slot: true });
  ctx.strokeStyle = 'rgba(255,225,77,0.3)'; ctx.lineWidth = 2; ctx.setLineDash([14, 8]);
  ctx.beginPath(); ctx.moveTo(70, 12); ctx.lineTo(w - 70, 12); ctx.moveTo(70, h - 12); ctx.lineTo(w - 70, h - 12); ctx.stroke(); ctx.setLineDash([]);
  drawType(ctx, p.text, cx, cy, { role: role(p, 'ammo'), size: Math.round(h * 0.6), maxWidth: w * 0.72, fill: p.color || '#ffe14d', glow: { color: '#ff6a13', blur: 0.18 } });
  scuffs(ctx, w, h, { seed: p.seed, count: 20, alpha: 0.28 });
}

/** The fallback shop sign: a backlit acrylic panel with a metal bezel, corner screws and a soft shadowed name. */
function standard(p) {
  const { ctx, width: w, height: h, cx, cy } = p;
  const base = p.background || '#222';
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(0,0,0,0.22)'); g.addColorStop(0.25, 'rgba(255,255,255,0.08)'); g.addColorStop(0.5, 'rgba(255,255,255,0.16)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, w - 8, h - 8);
  bevel(ctx, w, h, 12, { width: 5, light: 'rgba(255,255,255,0.5)', dark: 'rgba(0,0,0,0.45)' });
  for (const [x, y] of [[26, 26], [w - 26, 26], [26, h - 26], [w - 26, h - 26]]) rivet(ctx, x, y, 6, { base: '#aab1bc' });
  drawType(ctx, p.text, cx, cy, { role: role(p, 'standard'), size: Math.round(h * 0.6), maxWidth: w * 0.84, fill: p.color || '#fff',
    shadow: { color: 'rgba(0,0,0,0.42)', dx: 0.05, dy: 0.06 } });
  glare(ctx, w, h, 0.07);
}

export const signStyles = {
  hoffmanBrand, martBrand, tech, varsity, toy, industrial, diner, wok, carnival, supermarket,
  clearance, pricetag, hazard, digital, handwritten, wayfinding, service, ammo, standard,
};
