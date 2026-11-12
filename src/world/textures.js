// =============================================================================
// PROCEDURAL TEXTURES
// Drawn on a <canvas> at startup, so the project needs no image files.
// =============================================================================

import * as THREE from 'three';
import { shutters } from '../config/shutters.js';
import { signKinds } from '../config/typefaces.js';
import { drawType, fitSize } from './typeKit.js';

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
  const cx = width / 2;
  const cy = height / 2;

  switch (detectedStyle) {
    case 'martBrand':
    case 'hoffmanBrand': {
      const mart = detectedStyle === 'martBrand';
      const ground = background || (mart ? '#182b49' : '#39282b');
      const ink = color || (mart ? '#fff0d2' : '#f2cd8d');
      const accent = accentColor || (mart ? '#f58a39' : '#a67a50');
      ctx.fillStyle = ground;
      ctx.fillRect(0, 0, width, height);
      if (mart) {
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, width, height * .09);
        ctx.fillRect(0, height * .91, width, height * .09);
      } else {
        ctx.strokeStyle = accent;
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 10, width - 20, height - 20);
        ctx.strokeRect(17, 17, width - 34, height - 34);
      }
      const kind = signKinds[detectedStyle];
      drawType(ctx, text, cx, height * (subtext ? .43 : .51),
        { role: font || kind.main, size: Math.round(height * (subtext ? .46 : .57)), maxWidth: width * .88, fill: ink });
      if (subtext) drawType(ctx, subtext, cx, height * .74, { role: kind.sub, size: Math.round(height * .16), maxWidth: width * .85, fill: mart ? accent : ink });
      break;
    }

    case 'tech': {
      // 90s Computer Store / Demo Wall: CRT scanlines, cyan PCB traces, terminal font
      ctx.fillStyle = background || '#060d1a';
      ctx.fillRect(0, 0, width, height);

      // CRT phosphor horizontal scanlines
      ctx.fillStyle = 'rgba(0, 240, 212, 0.05)';
      for (let y = 0; y < height; y += 4) ctx.fillRect(0, y, width, 1);

      // Glowing corner PCB brackets
      ctx.strokeStyle = '#00f0d4';
      ctx.lineWidth = 4;
      const bLen = Math.min(36, height * 0.35);
      // Top-left
      ctx.beginPath(); ctx.moveTo(12 + bLen, 12); ctx.lineTo(12, 12); ctx.lineTo(12, 12 + bLen); ctx.stroke();
      // Top-right
      ctx.beginPath(); ctx.moveTo(width - 12 - bLen, 12); ctx.lineTo(width - 12, 12); ctx.lineTo(width - 12, 12 + bLen); ctx.stroke();
      // Bottom-left
      ctx.beginPath(); ctx.moveTo(12 + bLen, height - 12); ctx.lineTo(12, height - 12); ctx.lineTo(12, height - 12 - bLen); ctx.stroke();
      // Bottom-right
      ctx.beginPath(); ctx.moveTo(width - 12 - bLen, height - 12); ctx.lineTo(width - 12, height - 12); ctx.lineTo(width - 12, height - 12 - bLen); ctx.stroke();

      // Solder point dots
      ctx.fillStyle = '#00f0d4';
      for (const [px, py] of [[12, 12], [width - 12, 12], [12, height - 12], [width - 12, height - 12]]) {
        ctx.beginPath(); ctx.arc(px, py, 3, 0, Math.PI * 2); ctx.fill();
      }

      // Font & glowing text
      drawType(ctx, text, cx, cy, { role: font || signKinds.tech.main, size: Math.round(height * 0.62), maxWidth: width * 0.82, fill: color || '#00f0d4' });
      break;
    }

    case 'varsity': {
      // 90s Sports Gear: Varsity block lettering, racing stripes, speed chevrons
      ctx.fillStyle = background || '#0c1a2e';
      ctx.fillRect(0, 0, width, height);

      // Top and bottom athletic racing stripes
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 8, width, 4);
      ctx.fillRect(0, height - 12, width, 4);
      ctx.fillStyle = accentColor || '#ff8a3d';
      ctx.fillRect(0, 15, width, 6);
      ctx.fillRect(0, height - 21, width, 6);

      // Speed chevrons on sides
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      for (let i = 0; i < 2; i++) {
        const xOff = 24 + i * 16;
        ctx.beginPath();
        ctx.moveTo(xOff, cy - 14); ctx.lineTo(xOff + 12, cy); ctx.lineTo(xOff, cy + 14);
        ctx.lineTo(xOff + 5, cy + 14); ctx.lineTo(xOff + 17, cy); ctx.lineTo(xOff + 5, cy - 14);
        ctx.fill();

        const rxOff = width - xOff - 12;
        ctx.beginPath();
        ctx.moveTo(rxOff + 12, cy - 14); ctx.lineTo(rxOff, cy); ctx.lineTo(rxOff + 12, cy + 14);
        ctx.lineTo(rxOff + 7, cy + 14); ctx.lineTo(rxOff - 5, cy); ctx.lineTo(rxOff + 7, cy - 14);
        ctx.fill();
      }

      // Slanted athletic block font
      // (the role carries the lean and the thick dark jersey outline)
      drawType(ctx, text, cx + 8, cy, { role: font || signKinds.varsity.main, size: Math.round(height * 0.65), maxWidth: width * 0.78, fill: color || '#ff8a3d' });
      break;
    }

    case 'toy': {
      // 90s Toy Store: Bubbly cartoon letters, candy polka-dot border, starbursts
      ctx.fillStyle = background || '#8338ec';
      ctx.fillRect(0, 0, width, height);

      // Lightbox gradient
      const glow = ctx.createLinearGradient(0, 0, 0, height);
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.18)');
      glow.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Candy polka-dot frame
      const dotColors = ['#ffd60a', '#00f5d4', '#ff70a6', '#70e000', '#ffffff'];
      let dIdx = 0;
      const step = 28;
      for (let x = 16; x < width - 16; x += step) {
        ctx.fillStyle = dotColors[dIdx++ % dotColors.length];
        ctx.beginPath(); ctx.arc(x, 10, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = dotColors[dIdx++ % dotColors.length];
        ctx.beginPath(); ctx.arc(x, height - 10, 4, 0, Math.PI * 2); ctx.fill();
      }

      // Sparkle stars in corners
      const drawStar = (sx, sy, r) => {
        ctx.fillStyle = '#ffd60a';
        ctx.beginPath();
        ctx.moveTo(sx, sy - r);
        ctx.quadraticCurveTo(sx, sy, sx + r, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy + r);
        ctx.quadraticCurveTo(sx, sy, sx - r, sy);
        ctx.quadraticCurveTo(sx, sy, sx, sy - r);
        ctx.fill();
      };
      drawStar(26, 26, 12);
      drawStar(width - 26, 26, 12);
      drawStar(26, height - 26, 12);
      drawStar(width - 26, height - 26, 12);

      // Bubbly text
      drawType(ctx, text, cx, cy, { role: font || signKinds.toy.main, size: Math.round(height * 0.58), maxWidth: width * 0.82, fill: color || '#ffd60a' });
      break;
    }

    case 'industrial': {
      // 90s Hardware & Workshop: Stenciled slab, heavy steel bezel, hex bolts
      ctx.fillStyle = background || '#202328';
      ctx.fillRect(0, 0, width, height);

      // Outer beveled frame
      ctx.strokeStyle = '#121417';
      ctx.lineWidth = 10;
      ctx.strokeRect(5, 5, width - 10, height - 10);
      ctx.strokeStyle = '#4a4f58';
      ctx.lineWidth = 4;
      ctx.strokeRect(12, 12, width - 24, height - 24);

      // 4 Metallic hex bolts
      for (const [bx, by] of [[24, 24], [width - 24, 24], [24, height - 24], [width - 24, height - 24]]) {
        ctx.fillStyle = '#7a828e';
        ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e2126';
        ctx.beginPath(); ctx.arc(bx, by, 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#adb5bd';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(bx - 4, by); ctx.lineTo(bx + 4, by); ctx.stroke();
      }

      // Yellow/black warning diagonal tabs on left and right edges
      for (const side of [0, width - 42]) {
        for (let y = 14; y < height - 14; y += 14) {
          ctx.fillStyle = (Math.floor(y / 14) % 2 === 0) ? '#ffd23f' : '#1e2126';
          ctx.fillRect(side + 14, y, 14, 14);
        }
      }

      drawType(ctx, text, cx, cy, { role: font || signKinds.industrial.main, size: Math.round(height * 0.68), maxWidth: width * 0.78, fill: color || '#ffd23f' });
      break;
    }

    case 'diner': {
      // 80s/90s Diner / Burger Joint: Cooper/Righteous display, gold pinstripes
      ctx.fillStyle = background || '#28080c';
      ctx.fillRect(0, 0, width, height);

      // Warm center glow
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, width * 0.55);
      glow.addColorStop(0, 'rgba(255, 180, 50, 0.15)');
      glow.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      // Dual horizontal gold pinstripes
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(30, 14); ctx.lineTo(width - 30, 14); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, height - 14); ctx.lineTo(width - 30, height - 14); ctx.stroke();

      // Corner diamond flourishes
      const diamond = (dx, dy) => {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.moveTo(dx, dy - 6); ctx.lineTo(dx + 6, dy); ctx.lineTo(dx, dy + 6); ctx.lineTo(dx - 6, dy); ctx.fill();
      };
      diamond(30, 14); diamond(width - 30, 14); diamond(30, height - 14); diamond(width - 30, height - 14);

      drawType(ctx, text, cx, cy, { role: font || signKinds.diner.main, size: Math.round(height * 0.66), maxWidth: width * 0.82, fill: color || '#ffd166' });
      break;
    }

    case 'wok': {
      // Asian Express: Imperial crimson, pagoda stepped frame, golden steam curls
      ctx.fillStyle = background || '#4a0810';
      ctx.fillRect(0, 0, width, height);

      // Gold framing lines with stepped corners
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 3;
      ctx.strokeRect(14, 14, width - 28, height - 28);
      ctx.strokeRect(20, 20, width - 40, height - 40);

      // Golden steam spiral flourishes on flanks
      const curl = (sx, dir) => {
        ctx.strokeStyle = 'rgba(255, 210, 63, 0.45)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(sx, cy - 8, 12, 0, Math.PI, false);
        ctx.arc(sx + dir * 12, cy - 8, 6, Math.PI, 0, true);
        ctx.stroke();
      };
      curl(50, 1);
      curl(width - 50, -1);

      // Radiant gold brush lettering with a fiery backlight glow (the role's glow)
      drawType(ctx, text, cx, cy, { role: font || signKinds.wok.main, size: Math.round(height * 0.66), maxWidth: width * 0.78, fill: color || '#ffd23f' });
      break;
    }

    case 'carnival': {
      // Corn Dog Corral / Carnival: Scalloped ticket stub notches, marquee bulb dots
      ctx.fillStyle = background || '#122c5e';
      ctx.fillRect(0, 0, width, height);

      // Scalloped corner notches
      ctx.fillStyle = '#081226';
      for (const [nx, ny] of [[0, 0], [width, 0], [0, height], [width, height]]) {
        ctx.beginPath(); ctx.arc(nx, ny, 20, 0, Math.PI * 2); ctx.fill();
      }

      // Marquee incandescent bulb dots around border
      ctx.fillStyle = '#ffd166';
      const bStep = 32;
      for (let x = 32; x < width - 32; x += bStep) {
        ctx.beginPath(); ctx.arc(x, 12, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, height - 12, 4, 0, Math.PI * 2); ctx.fill();
      }

      drawType(ctx, text, cx, cy, { role: font || signKinds.carnival.main, size: Math.round(height * 0.6), maxWidth: width * 0.8, fill: color || '#ffd166' });
      break;
    }

    case 'supermarket': {
      // Mega Mart & Aisles: Corporate blue, yellow brand bar, modern italic geometric sans
      ctx.fillStyle = background || '#0f3c75';
      ctx.fillRect(0, 0, width, height);

      // Crisp white top border & bright yellow bottom brand bar
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, 4);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(0, height - 14, width, 14);

      // Starburst or aisle badge
      if (text.startsWith('AISLE')) {
        const match = text.match(/AISLE\s+(\d+)/);
        const aisleNum = match ? match[1] : '1';
        // White circular roundel badge on left
        const rX = 54;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(rX, cy - 4, Math.min(28, height * 0.36), 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0f3c75';
        drawType(ctx, aisleNum, rX, cy - 4, { role: 'martBrand', size: Math.round(height * 0.42), fill: '#0f3c75' });
      } else if (text.includes('MEGA MART')) {
        // Multi-point yellow starburst spark on left
        const sX = 52;
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const r = i % 2 === 0 ? 22 : 9;
          const px = sX + Math.cos(a) * r;
          const py = cy - 4 + Math.sin(a) * r;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }

      // Modern geometric italic sans
      drawType(ctx, text, cx, cy - 4, { role: font || signKinds.supermarket.main, size: Math.round(height * 0.58), maxWidth: width * 0.78, fill: color || '#ffd23f',
        slant: 0.08, shadow: { color: 'rgba(0, 0, 0, 0.45)', dx: 0.05, dy: 0.04 } });
      break;
    }

    case 'clearance': {
      // Going Out of Business / Everything Must Go: Caution yellow/red, hazard diagonal ends, grommets
      ctx.fillStyle = background || '#ffe500';
      ctx.fillRect(0, 0, width, height);

      // Left & right 12% diagonal black caution stripes
      const stripeW = Math.round(width * 0.12);
      const drawStripes = (x0) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, 0, stripeW, height); ctx.clip();
        ctx.fillStyle = '#111114';
        for (let p = -height; p < stripeW + height; p += 24) {
          ctx.beginPath();
          ctx.moveTo(x0 + p, 0); ctx.lineTo(x0 + p + 12, 0);
          ctx.lineTo(x0 + p + 12 - height, height); ctx.lineTo(x0 + p - height, height);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      };
      drawStripes(0);
      drawStripes(width - stripeW);

      // Brass grommets in 4 corners
      for (const [gx, gy] of [[stripeW + 16, 16], [width - stripeW - 16, 16], [stripeW + 16, height - 16], [width - stripeW - 16, height - 16]]) {
        ctx.fillStyle = '#b38a38';
        ctx.beginPath(); ctx.arc(gx, gy, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222222';
        ctx.beginPath(); ctx.arc(gx, gy, 4, 0, Math.PI * 2); ctx.fill();
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.02);
      drawType(ctx, text, 0, 0, { role: font || signKinds.clearance.main, size: Math.round(height * 0.65), maxWidth: width * 0.68,
        fill: color || (background === '#d62839' ? '#ffffff' : '#111114'), shadow: { color: 'rgba(0, 0, 0, 0.85)', dx: 0.04, dy: 0.04 } });
      ctx.restore();
      break;
    }

    case 'pricetag': {
      // Day-Glo Price Sticker (Monarch 1136 price label gun style): fluorescent neon, scalloped edge, stamped ink
      ctx.fillStyle = background || '#ffee00';
      ctx.fillRect(0, 0, width, height);

      // Label border outline
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(3, 3, width - 6, height - 6);

      // Rubber-stamp text with mechanical stamp feel
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.015);
      // Stamped ink look: dark purple/black with slight stamp punch
      drawType(ctx, text, 0, 0, { role: font || signKinds.pricetag.main, size: Math.round(height * 0.72), maxWidth: width * 0.85, fill: color || '#141419' });
      ctx.restore();
      break;
    }

    case 'hazard': {
      // OSHA / High Voltage: Yellow caution background, black pill header with DANGER
      ctx.fillStyle = background || '#ffd23f';
      ctx.fillRect(0, 0, width, height);

      // Black perimeter border
      ctx.strokeStyle = '#18191c';
      ctx.lineWidth = 8;
      ctx.strokeRect(6, 6, width - 12, height - 12);

      // Black header bar on top
      const barH = Math.round(height * 0.42);
      ctx.fillStyle = '#18191c';
      ctx.fillRect(10, 10, width - 20, barH);

      // Red pill in header with white DANGER
      ctx.fillStyle = '#d90429';
      const pillW = Math.min(220, width * 0.35);
      const pillH = barH - 8;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cx - pillW / 2, 14, pillW, pillH, 8) : ctx.rect(cx - pillW / 2, 14, pillW, pillH);
      ctx.fill();

      drawType(ctx, 'DANGER', cx, 14 + pillH / 2, { role: signKinds.hazard.sub, size: Math.round(pillH * 0.7), fill: '#ffffff' });

      // Warning text below
      const lowerH = height - barH - 20;
      drawType(ctx, text, cx, barH + 10 + lowerH / 2, { role: font || signKinds.hazard.main, size: Math.round(lowerH * 0.58), maxWidth: width * 0.85, fill: color || '#18191c' });
      break;
    }

    case 'digital': {
      // 7-Segment LED / VFD Display: Smoked dark acrylic, scanlines, glowing segments
      ctx.fillStyle = background || '#080c10';
      ctx.fillRect(0, 0, width, height);

      // Smoked acrylic frame
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 4;
      ctx.strokeRect(4, 4, width - 8, height - 8);

      const role = font || signKinds.digital.main;
      const size = fitSize(ctx, text, role, Math.round(height * 0.62), width * 0.88);
      // Ghost segments background
      drawType(ctx, '888888888888'.slice(0, text.length || 6), cx, cy, { role, size, fill: 'rgba(255, 42, 75, 0.06)' });
      // Glowing LED digits
      drawType(ctx, text, cx, cy, { role, size, fill: color || '#ff2a55', glow: { color: color || '#ff2a55', blur: 0.26 } });
      break;
    }

    case 'handwritten': {
      // Hand-scrawled sharpie note on paper with silver tape corners
      ctx.fillStyle = background || '#f5f0df';
      ctx.fillRect(0, 0, width, height);

      // Faint blue ruled lines
      ctx.strokeStyle = 'rgba(60, 110, 180, 0.12)';
      ctx.lineWidth = 2;
      for (let y = 18; y < height; y += 18) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
      }

      // Silver duct-tape patches on top corners
      const drawTape = (tx, ty, rot) => {
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(rot);
        ctx.fillStyle = 'rgba(180, 190, 200, 0.78)';
        ctx.fillRect(-35, -12, 70, 24);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(-35, -12, 70, 24);
        ctx.restore();
      };
      drawTape(32, 12, -0.35);
      drawTape(width - 32, 12, 0.35);

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(-0.025);
      drawType(ctx, text, 0, 0, { role: font || signKinds.handwritten.main, size: Math.round(height * 0.58), maxWidth: width * 0.82, fill: color || '#18141d' });
      ctx.restore();
      break;
    }

    case 'wayfinding': {
      // 90s Concourse Wayfinding: Clean rounded white border, transit sans, clean arrows
      ctx.fillStyle = background || '#12482e';
      ctx.fillRect(0, 0, width, height);

      // Rounded white hairline border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      if (ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(10, 10, width - 20, height - 20, 14); ctx.stroke();
      } else {
        ctx.strokeRect(10, 10, width - 20, height - 20);
      }

      drawType(ctx, text, cx, cy, { role: font || signKinds.wayfinding.main, size: Math.round(height * 0.6), maxWidth: width * 0.84, fill: color || '#ffffff' });
      break;
    }

    case 'service': {
      // Customer Service: Elegant dark plum, polished brass dual-line frame
      ctx.fillStyle = background || '#1a1424';
      ctx.fillRect(0, 0, width, height);

      // Dual-line gold border
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.strokeRect(10, 10, width - 20, height - 20);
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.4)';
      ctx.lineWidth = 1;
      ctx.strokeRect(16, 16, width - 32, height - 32);

      drawType(ctx, text, cx, cy, { role: font || signKinds.service.main, size: Math.round(height * 0.54), maxWidth: width * 0.84, fill: color || '#ffd166' });
      break;
    }

    case 'ammo': {
      // RESTOCK-O-MATIC: Mil-spec stencil, hot orange hazard bands
      ctx.fillStyle = background || '#16141a';
      ctx.fillRect(0, 0, width, height);

      // Orange hazard side bars
      ctx.fillStyle = '#ff6a13';
      ctx.fillRect(0, 0, 18, height);
      ctx.fillRect(width - 18, 0, 18, height);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(18, 0, 6, height);
      ctx.fillRect(width - 24, 0, 6, height);

      drawType(ctx, text, cx, cy, { role: font || signKinds.ammo.main, size: Math.round(height * 0.6), maxWidth: width * 0.82, fill: color || '#ffe14d', glow: { color: '#ff6a13', blur: 0.2 } });
      break;
    }

    default: {
      // Standard shop sign: backlit colored band with metallic bezel
      ctx.fillStyle = background || '#222';
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createLinearGradient(0, 0, 0, height);
      glow.addColorStop(0, 'rgba(0,0,0,0.22)');
      glow.addColorStop(0.25, 'rgba(255,255,255,0.08)');
      glow.addColorStop(0.5, 'rgba(255,255,255,0.14)');
      glow.addColorStop(0.75, 'rgba(255,255,255,0.06)');
      glow.addColorStop(1, 'rgba(0,0,0,0.28)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 8;
      ctx.strokeRect(4, 4, width - 8, height - 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.42)';
      ctx.lineWidth = 5;
      ctx.strokeRect(12, 12, width - 24, height - 24);

      drawType(ctx, text, cx, cy, { role: font || signKinds.standard.main, size: Math.round(height * 0.6), maxWidth: width * 0.88, fill: color || '#fff',
        shadow: { color: 'rgba(0,0,0,0.42)', dx: 0.05, dy: 0.06 } });
      break;
    }
  }

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
