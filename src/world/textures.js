// =============================================================================
// PROCEDURAL TEXTURES
// Drawn on a <canvas> at startup, so the project needs no image files.
// =============================================================================

import * as THREE from 'three';

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
export function makeTileTexture({ base = '#efe5d3', grout = '#c9bba4', variation = 10, seed = 7 } = {}) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);

  const tile = size / 2;
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      ctx.fillStyle = base;
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
      // Slight per-tile brightness variation reads as "polished stone"
      const shade = Math.round((rand() - 0.5) * variation);
      ctx.fillStyle = shade >= 0 ? `rgba(255,255,255,${shade / 100})` : `rgba(0,0,0,${-shade / 100})`;
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
      // Soft diagonal sheen
      const g = ctx.createLinearGradient(tx * tile, ty * tile, (tx + 1) * tile, (ty + 1) * tile);
      g.addColorStop(0, 'rgba(255,255,255,0.10)');
      g.addColorStop(0.5, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.04)');
      ctx.fillStyle = g;
      ctx.fillRect(tx * tile, ty * tile, tile, tile);
    }
  }

  // Grout lines
  ctx.fillStyle = grout;
  const line = 3;
  for (let i = 0; i <= 2; i++) {
    const p = i * tile - line / 2;
    ctx.fillRect(p, 0, line, size);
    ctx.fillRect(0, p, size, line);
  }

  return finish(canvas, { repeat: true });
}

/** A shop sign: bold text on a colored band. */
export function makeSignTexture(text, { background = '#222', color = '#fff', aspect = 6 } = {}) {
  const width = 1024;
  const height = Math.round(width / aspect);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  // Inner border
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(10, 10, width - 20, height - 20);

  // Fit text to the sign
  let fontSize = Math.round(height * 0.62);
  const family = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  ctx.font = `${fontSize}px ${family}`;
  while (ctx.measureText(text).width > width * 0.88 && fontSize > 10) {
    fontSize -= 2;
    ctx.font = `${fontSize}px ${family}`;
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillText(text, width / 2 + 4, height / 2 + 5);
  ctx.fillStyle = color;
  ctx.fillText(text, width / 2, height / 2);

  return finish(canvas);
}

/** Roll-up security shutter: horizontal metal slats with a stenciled message. */
export function makeShutterTexture(message = 'CLOSED') {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const slat = 24;
  for (let y = 0; y < size; y += slat) {
    const g = ctx.createLinearGradient(0, y, 0, y + slat);
    g.addColorStop(0, '#b9bec4');
    g.addColorStop(0.55, '#9aa0a8');
    g.addColorStop(1, '#6f757d');
    ctx.fillStyle = g;
    ctx.fillRect(0, y, size, slat);
  }

  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.rotate(-0.06);
  ctx.font = 'bold 92px Impact, "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(214, 40, 57, 0.88)';
  ctx.fillText(message, 0, 0);
  ctx.font = 'bold 34px Impact, "Arial Black", sans-serif';
  ctx.fillStyle = 'rgba(30, 30, 30, 0.7)';
  ctx.fillText('NO REFUNDS. NO RETURNS.', 0, 80);
  ctx.restore();

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
 * A blood splat drawn flat on transparent, lying on the floor: a ragged central blob, thin streaks flung outward
 * (some ending in a bead), and satellite droplets. Different seeds give different splats. `puddle: true` = a
 * rounder, wavy-edged pool with a lighter wet highlight and only a few droplets (a corpse's puddle).
 */
export function makeSplatTexture({ seed = 1, puddle = false, color = '#8d0801', highlight = '#c1121f' } = {}) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(seed);
  const c = size / 2;

  // A smooth closed blob: radius wobbles around `radius` at `points` angles, joined with curves.
  function blob(radius, wobble, points, fill) {
    const pts = [];
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const r = radius * (1 - wobble + rand() * wobble * 2);
      pts.push([c + Math.cos(a) * r, c + Math.sin(a) * r]);
    }
    ctx.fillStyle = fill;
    ctx.beginPath();
    for (let i = 0; i < points; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % points];
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      if (i === 0) ctx.moveTo(mx, my);
      ctx.quadraticCurveTo(x1, y1, (x1 + pts[(i + 2) % points][0]) / 2, (y1 + pts[(i + 2) % points][1]) / 2);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (puddle) {
    blob(size * 0.38, 0.14, 11, color);
    blob(size * 0.26, 0.12, 9, highlight); // the wet middle
    for (let i = 0; i < 4; i++) {
      const a = rand() * Math.PI * 2;
      const d = size * (0.34 + rand() * 0.1);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 3 + rand() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    blob(size * 0.17, 0.28, 9, color); // the main splat
    blob(size * 0.1, 0.25, 7, highlight);
    // Streaks flung outward: tapered spikes, many ending in a bead.
    const streaks = 9 + Math.floor(rand() * 5);
    for (let i = 0; i < streaks; i++) {
      const a = rand() * Math.PI * 2;
      const length = size * (0.18 + rand() * 0.28);
      const width = 4 + rand() * 7;
      const nx = -Math.sin(a);
      const ny = Math.cos(a);
      const x0 = c + Math.cos(a) * size * 0.1;
      const y0 = c + Math.sin(a) * size * 0.1;
      const x1 = c + Math.cos(a) * (size * 0.1 + length);
      const y1 = c + Math.sin(a) * (size * 0.1 + length);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x0 + nx * width, y0 + ny * width);
      ctx.lineTo(x1, y1);
      ctx.lineTo(x0 - nx * width, y0 - ny * width);
      ctx.closePath();
      ctx.fill();
      if (rand() < 0.6) {
        ctx.beginPath();
        ctx.arc(x1 + Math.cos(a) * 3, y1 + Math.sin(a) * 3, 2.5 + rand() * 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Satellite droplets of all sizes, thrown further out.
    for (let i = 0; i < 16; i++) {
      const a = rand() * Math.PI * 2;
      const d = size * (0.2 + rand() * 0.27);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * d, c + Math.sin(a) * d, 1.5 + rand() * rand() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
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
  ctx.font = 'bold 40px "Comic Sans MS", "Chalkboard SE", "Segoe Print", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(245, 245, 240, 0.7)';
  ctx.fillText(name.toUpperCase(), w / 2, h - 44);
  ctx.fillStyle = 'rgba(245, 245, 240, 0.35)';
  ctx.fillText(name.toUpperCase(), w / 2 + 2, h - 42);

  return finish(canvas);
}
