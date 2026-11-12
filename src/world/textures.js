// =============================================================================
// PROCEDURAL TEXTURES
// Drawn on a <canvas> at startup, so the project needs no image files.
// =============================================================================

import * as THREE from 'three';
import { shutters } from '../config/shutters.js';
import { drawType } from './typeKit.js';
import { signStyles } from './signStyles.js';

function finish(canvas, { repeat = false } = {}) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
  }
  return texture;
}

// Tiny deterministic random so tiles (and prop layouts) look the same every time. `seed` >= 1.
export function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Polished mall floor tile. The canvas holds 2x2 tiles; set `repeat` on the
 * returned texture to (width / 2, depth / 2) for 1m tiles.
 */
// Built once per look and handed out as clones: a clone shares its image (and its one GPU upload) and has its own repeat.
// (99 floors used to paint 99 canvases, most of them the same.)
const tileCache = new Map();
export function makeTileTexture({ base = '#efe5d3', grout = '#c9bba4', variation = 10, seed = 7 } = {}) {
  const key = `${base}|${grout}|${variation}|${seed}`;
  if (!tileCache.has(key)) tileCache.set(key, buildTileTexture({ base, grout, variation, seed }));
  return tileCache.get(key).clone();
}

function buildTileTexture({ base, grout, variation, seed }) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);

  const tile = size / 2;
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x0 = tx * tile;
      const y0 = ty * tile;
      ctx.fillStyle = base;
      ctx.fillRect(x0, y0, tile, tile);

      // Slight per-tile brightness variation reads as "polished stone"
      const shade = Math.round((rand() - 0.5) * variation);
      ctx.fillStyle = shade >= 0 ? `rgba(255,255,255,${shade / 100})` : `rgba(0,0,0,${-shade / 100})`;
      ctx.fillRect(x0, y0, tile, tile);

      // Subtle terrazzo mineral flecks inside each tile
      for (let f = 0; f < 28; f++) {
        const fx = x0 + 10 + rand() * (tile - 20);
        const fy = y0 + 10 + rand() * (tile - 20);
        const fw = 2 + rand() * 5;
        const fh = 2 + rand() * 4;
        ctx.fillStyle = rand() > 0.45 ? 'rgba(255,255,255,0.09)' : 'rgba(40,32,24,0.06)';
        ctx.fillRect(fx, fy, fw, fh);
      }

      // Multi-stop diagonal wax sheen across the tile face
      const g = ctx.createLinearGradient(x0, y0, x0 + tile, y0 + tile);
      g.addColorStop(0, 'rgba(255,255,255,0.14)');
      g.addColorStop(0.38, 'rgba(255,255,255,0.03)');
      g.addColorStop(0.62, 'rgba(0,0,0,0.01)');
      g.addColorStop(1, 'rgba(0,0,0,0.07)');
      ctx.fillStyle = g;
      ctx.fillRect(x0, y0, tile, tile);

      // Crisp inner tile bevel highlight (top/left catch light, bottom/right recede)
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x0 + 4, y0 + 4, tile - 8, 2);
      ctx.fillRect(x0 + 4, y0 + 4, 2, tile - 8);
      ctx.fillStyle = 'rgba(0,0,0,0.09)';
      ctx.fillRect(x0 + 4, y0 + tile - 6, tile - 8, 2);
      ctx.fillRect(x0 + tile - 6, y0 + 4, 2, tile - 8);
    }
  }

  // Recessed grout lines with subtle edge shadow and center mortar seam
  const line = 6;
  for (let i = 0; i <= 2; i++) {
    const p = i * tile - line / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(p - 2, 0, line + 4, size);
    ctx.fillRect(0, p - 2, size, line + 4);
    ctx.fillStyle = grout;
    ctx.fillRect(p, 0, line, size);
    ctx.fillRect(0, p, size, line);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.fillRect(i * tile - 1, 0, 2, size);
    ctx.fillRect(0, i * tile - 1, size, 2);
  }

  return finish(canvas, { repeat: true });
}

export function detectSignStyle(text, background = '') {
  const upper = String(text).toUpperCase();
  if (upper.includes('BYTE ME') || upper.includes('LOADING') || upper.includes('NO SIGNAL')) return 'tech';
  if (upper.includes('GOOD SPORTS') || /^\b\d{1,3}\b$/.test(upper.trim())) return 'varsity';
  if (upper.includes('PLAY TIME')) return 'toy';
  if (upper.includes('NUTS & BOLTS') || upper.includes('MEASURE TWICE') || upper.includes('CURSE ONCE')) return 'industrial';
  if (upper.includes('BURGER BARN')) return 'diner';
  if (upper.includes('WOK THIS WAY')) return 'wok';
  if (upper.includes('CORN DOG')) return 'carnival';
  if (upper.includes('MEGA MART') || upper.startsWith('AISLE') || upper.includes('EXPRESS') || upper.includes('HOLIDAY') || upper.includes('HOUSEWARES') || upper.includes('SNACKS') || upper.includes('OUTDOOR') || upper.includes('THANK YOU FOR SHOPPING')) return 'supermarket';
  if (upper === '99C' || upper === 'SOLD' || upper === '99¢' || (upper.startsWith('$') && upper.length <= 6)) return 'pricetag';
  if (upper.includes('BUSINESS') || upper.includes('MUST GO') || upper.includes('ALL SALES FINAL') || upper.includes('MARKDOWN') || upper.includes('70% OFF') || upper.includes('NO REFUNDS') || upper.includes('SALE!')) return 'clearance';
  if (upper.includes('DANGER') || upper.includes('HIGH VOLTAGE')) return 'hazard';
  if (upper.includes('NOW SERVING') || upper === '0.00' || upper.includes('REGISTER_SCREEN')) return 'digital';
  if (upper.includes('OUT OF ORDER') || upper.includes('BACK IN 5') || upper.includes('STILL WAITING') || upper.includes('NO LOITERING') || upper.includes('HANDS') || upper.includes('TABLES ARE FOR CUSTOMERS')) return 'handwritten';
  if (upper.includes('CUSTOMER SERVICE') || upper.includes('WARRANTY')) return 'service';
  if (upper.includes('RESTOCK') || upper.startsWith('AMMO')) return 'ammo';
  if (upper.startsWith('EXIT') || upper.includes('FOOD COURT') || upper.includes('MAIN HALL') || upper.includes('STAFF ONLY') || upper.includes('GALLERIA') || upper.includes('PARKING') || upper.includes('ESCALATOR') || upper.includes('ELEVATOR') || upper.includes('DIRECTORY')) return 'wayfinding';
  return 'standard';
}

/**
 * A themed shop/mall sign with unique typography, graphics, and era-appropriate styling.
 * Always DRAWN on a 1024-wide page (every border, font and offset below is in those units), but the canvas itself is
 * `pixelsWide` across (default 1024) and the page is scaled onto it: a small sign gets a small canvas and looks the
 * same (world/mapKit.js sign sizes it by the sign's width in metres; a fixed 1024 cost ~770 MB across the mall).
 */
export function makeSignTexture(text, { background, color, aspect = 6, style, subtext, font, accentColor, pixelsWide = 1024 } = {}) {
  const width = 1024;
  const height = Math.round(width / aspect);
  const scale = Math.min(1, Math.max(64, Math.round(pixelsWide)) / width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (scale < 1) ctx.scale(scale, scale);

  const detectedStyle = style || detectSignStyle(text, background);
  // each style paints its own layout, ornaments, material and wear (world/signStyles.js, helpers in world/signKit.js)
  const paint = signStyles[detectedStyle] || signStyles.standard;
  paint({ ctx, text, subtext, width, height, cx: width / 2, cy: height / 2, background, color, accent: accentColor, font, seed: `${detectedStyle}:${text}` });

    return finish(canvas);
}

/** Painted shutter curtain. Aspect and slat pitch follow metres; tracks/housing are real stationary geometry. */
export function makeShutterTexture(message = 'CLOSED', { width = 3, height = 3, finish: look = shutters.finishes.public } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(128, Math.round(width * shutters.pixelsPerMetre));
  canvas.height = Math.max(128, Math.round(height * shutters.pixelsPerMetre));
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height, random = seededRandom(look.seed);
  ctx.fillStyle = look.base; ctx.fillRect(0, 0, w, h);
  // Faded company livery: paint on the curtain, not a floating sign that stays behind when it rolls up.
  ctx.globalAlpha = .3; ctx.fillStyle = look.accent; ctx.fillRect(0, h * .31, w, h * .12);
  ctx.globalAlpha = .58;
  const radius = Math.min(w * .12, h * .125), sunY = h * .34;
  ctx.beginPath(); ctx.arc(w / 2, sunY, radius, Math.PI, 0); ctx.closePath(); ctx.fill();
  for (let i = 0; i < 3; i++) ctx.fillRect(w / 2 - radius + i * radius * .15, sunY + 4 + i * radius * .19,
    radius * 2 - i * radius * .3, radius * .11);
  ctx.globalAlpha = 1;
  function words(text, y, size, color = look.ink, role = 'stencil') {
    drawType(ctx, text, w / 2, y, { role, size, maxWidth: w * .88, fill: color });
  }
  words('SUNSET GALLERIA', h * .52, Math.round(h * .035));
  words(message === 'CLOSED' ? look.heading : message, h * .62, Math.round(h * .052));
  words(look.notice, h * .69, Math.round(h * .026));
  // Broad, nearly flat enamel slats. Recessed seams are deliberately much softer than the old silver gradients.
  const slat = h / height * shutters.slatHeight;
  for (let y = 0; y < h; y += slat) {
    ctx.fillStyle = '#392f4329'; ctx.fillRect(0, y, w, 1.6);
    ctx.fillStyle = '#fff9e91f'; ctx.fillRect(0, y + 2, w, 1);
  }
  // Deterministic rubbed paint and old adhesive marks; dense wear stays down by the bottom rail.
  for (let i = 0; i < 46; i++) {
    const x = random() * w, y = i < 30 ? h * (.83 + random() * .16) : random() * h;
    ctx.fillStyle = i % 3 ? '#60544926' : '#fff5d933'; ctx.fillRect(x, y, 2 + random() * 13, 1 + random() * 2);
  }
  ctx.save();
  ctx.translate(w * .78, h * .83); ctx.rotate(-.07);
  if (look.sticker) {
    ctx.fillStyle = '#e9d5a8'; ctx.fillRect(-w * .115, -h * .045, w * .23, h * .09);
    drawType(ctx, look.sticker, 0, 0, { role: 'typewriter', size: Math.round(h * .024), fill: look.ink });
  }
  ctx.restore();
  drawType(ctx, `SG / ${look.seed} · SECURITY SYSTEMS`, w * .05, h * .94, { role: 'typewriter', size: Math.round(h * .022), fill: look.ink, align: 'left', alpha: .6 });
  return finish(canvas);
}

/**
 * Cartoon muzzle-flash burst: a soft glowing center with pointed rays, white on
 * transparent (tint it with the material color). `rays` = number of spikes.
 */
export function makeFlashTexture({ rays = 7, seed = 3 } = {}) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);
  const c = size / 2;

  // Pointed rays of uneven length, so it reads as a burst rather than a flower.
  ctx.fillStyle = '#fff';
  for (let i = 0; i < rays; i++) {
    const angle = (i / rays) * Math.PI * 2 + rand() * 0.4;
    const length = c * (0.65 + rand() * 0.35);
    const width = 0.22 + rand() * 0.12; // half-width at the base, in radians
    ctx.beginPath();
    ctx.moveTo(c + Math.cos(angle - width) * c * 0.25, c + Math.sin(angle - width) * c * 0.25);
    ctx.lineTo(c + Math.cos(angle) * length, c + Math.sin(angle) * length);
    ctx.lineTo(c + Math.cos(angle + width) * c * 0.25, c + Math.sin(angle + width) * c * 0.25);
    ctx.closePath();
    ctx.fill();
  }

  // Bright soft core on top.
  const glow = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.45, 'rgba(255,255,255,0.85)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  return finish(canvas);
}

/**
 * A pool of blood seen from above, on transparent: a smooth, slightly lopsided puddle (low-frequency wobble, no
 * spikes) that is dark red at the rim and lighter and wetter in the middle, with a soft feathered edge, a glossy
 * highlight and a few small drops beside it. Different seeds give different shapes.
 */
export function makePoolTexture({ seed = 1 } = {}) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);
  const c = size / 2;
  const R = size * 0.36; // the pool's average radius; the rest of the square is room for the feathered edge and drops

  // The outline: a circle pushed in and out by a few low-frequency waves, so it is organic but smooth.
  const waves = [
    [2, 0.09 + rand() * 0.05, rand() * 6.28],
    [3, 0.06 + rand() * 0.04, rand() * 6.28],
    [5, 0.035 + rand() * 0.03, rand() * 6.28],
  ];
  const stretch = 0.85 + rand() * 0.3; // a little longer one way than the other
  const rotation = rand() * 3.14;
  const radiusAt = (angle, scale) => {
    let k = 1;
    for (const [n, amp, phase] of waves) k += amp * Math.sin(n * angle + phase);
    return R * k * scale;
  };
  const outline = (scale) => {
    ctx.beginPath();
    const steps = 96;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const r = radiusAt(a, scale);
      const x = c + Math.cos(a + rotation) * r * stretch;
      const y = c + Math.sin(a + rotation) * r / stretch;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };

  // 1. The body of the pool, with a soft feathered edge (a blurred shadow of itself).
  ctx.save();
  ctx.shadowColor = 'rgba(48, 3, 7, 0.85)';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#3d050a';
  outline(1);
  ctx.fill();
  ctx.restore();

  // 2. Darker at the rim, lighter and wetter toward the middle.
  const body = ctx.createRadialGradient(c - R * 0.15, c - R * 0.15, R * 0.05, c, c, R * 1.05);
  body.addColorStop(0, '#8e0f18');
  body.addColorStop(0.45, '#6f0a12');
  body.addColorStop(0.85, '#4a060c');
  body.addColorStop(1, '#350408');
  ctx.fillStyle = body;
  outline(0.93);
  ctx.fill();

  // 3. A glossy highlight, like a window reflecting in a wet surface.
  const shine = ctx.createRadialGradient(c - R * 0.35, c - R * 0.4, 1, c - R * 0.35, c - R * 0.4, R * 0.42);
  shine.addColorStop(0, 'rgba(255, 225, 225, 0.42)');
  shine.addColorStop(0.5, 'rgba(255, 160, 160, 0.14)');
  shine.addColorStop(1, 'rgba(255, 120, 120, 0)');
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.ellipse(c - R * 0.35, c - R * 0.4, R * 0.42, R * 0.24, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // 4. A few small drops just outside the edge.
  ctx.fillStyle = '#4a060c';
  for (let i = 0; i < 5; i++) {
    const a = rand() * Math.PI * 2;
    const d = R * (1.12 + rand() * 0.22);
    ctx.beginPath();
    ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.5 + rand() * 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * COD-style chalk outline for a wall buy: a rough hand-drawn frame and the weapon's name,
 * white chalk on transparent (put it flat on the wall). `aspect` = width / height.
 */
export function makeChalkTexture(name, { aspect = 2, seed = 11 } = {}) {
  const h = 256;
  const w = Math.round(h * aspect);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);
  const jitter = (v, amount) => v + (rand() - 0.5) * amount;

  // A few wobbly passes over the same rectangle reads as chalk.
  ctx.strokeStyle = 'rgba(245, 245, 240, 0.75)';
  ctx.lineCap = 'round';
  const m = 18;
  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = 3 + rand() * 3;
    ctx.beginPath();
    const corners = [[m, m], [w - m, m], [w - m, h - m], [m, h - m], [m, m]];
    ctx.moveTo(jitter(corners[0][0], 8), jitter(corners[0][1], 8));
    for (const [x, y] of corners.slice(1)) ctx.lineTo(jitter(x, 8), jitter(y, 8));
    ctx.stroke();
  }

  // Dusty speckles.
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(245, 245, 240, ${0.08 + rand() * 0.2})`;
    ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 2, 1 + rand() * 2);
  }

  // The name along the bottom, written twice slightly offset (chalk pressure).
  drawType(ctx, name.toUpperCase(), w / 2, h - 44, { role: 'marker', size: 38, maxWidth: w * 0.9, fill: 'rgba(245, 245, 240, 0.7)' });
  drawType(ctx, name.toUpperCase(), w / 2 + 2, h - 42, { role: 'marker', size: 38, maxWidth: w * 0.9, fill: 'rgba(245, 245, 240, 0.35)' });

  return finish(canvas);
}
