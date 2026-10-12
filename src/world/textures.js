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

// Tiny deterministic random so tiles look the same every time.
function seededRandom(seed) {
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
