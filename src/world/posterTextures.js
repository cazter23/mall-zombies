// =============================================================================
// POSTER TEXTURES: the mall's corporate cheer, drawn on canvas (no image files). "Grand Opening, Forever": bright 80s
// pastels, upbeat slogans, and something wrong in every one.
//   makePosterTexture(kind, options) -> THREE.CanvasTexture
//     'sunny'      Sunny the Sunset Galleria sun mascot, smiling, pointing, with a speech line
//     'employee'   EMPLOYEE OF THE MONTH: six months of the same zombie, gold stars
//     'mallMap'    the mall directory: pastel floor plan, a red YOU ARE HERE dot and a caption
//     'banner'     a pastel fabric banner with a slogan (and an optional small second line)
//     'notice'     a printed notice: a coloured header bar + body text
// =============================================================================

import * as THREE from 'three';

const FONT = '"Bungee", "Arial Black", system-ui, sans-serif';
const BODY = '"Arial Black", "Helvetica Neue", Arial, sans-serif';
const TYPOGRAPHY = Object.freeze({
  brand: { display: FONT, body: BODY, weight: '400' },
  utility: { display: 'Arial, "Helvetica Neue", sans-serif', body: 'Arial, "Helvetica Neue", sans-serif', weight: '600' },
  heritage: { display: 'Georgia, "Times New Roman", serif', body: 'Georgia, "Times New Roman", serif', weight: '400', bodyStyle: 'italic' },
  handwritten: { display: '"Permanent Marker", "Comic Sans MS", cursive', body: '"Comic Sans MS", cursive', weight: '400' },
  cinema: { display: 'Georgia, "Times New Roman", serif', body: 'Arial, "Helvetica Neue", sans-serif', weight: '700' },
});

function typographyFor(name) { return TYPOGRAPHY[name] || TYPOGRAPHY.brand; }

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

// Text that shrinks until it fits `maxWidth`.
function fitText(ctx, text, x, y, maxWidth, size, font = FONT, weight = '400') {
  let s = size;
  do {
    ctx.font = `${weight} ${s}px ${font}`;
    s -= 2;
  } while (ctx.measureText(text).width > maxWidth && s > 8);
  ctx.fillText(text, x, y);
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function drawSun(ctx, cx, cy, r, { mood = 'smile' } = {}) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#ffb347';
  for (let i = 0; i < 12; i++) { // rays
    ctx.rotate(Math.PI / 6);
    ctx.beginPath();
    ctx.moveTo(-r * 0.18, -r * 1.05);
    ctx.lineTo(0, -r * 1.55);
    ctx.lineTo(r * 0.18, -r * 1.05);
    ctx.fill();
  }
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#fff2a8');
  g.addColorStop(1, '#ff9a3c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3a1f2f'; // eyes: too wide open
  for (const ex of [-0.35, 0.35]) {
    ctx.beginPath();
    ctx.ellipse(ex * r, -0.2 * r, r * 0.12, r * 0.17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex * r + r * 0.04, -0.25 * r, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a1f2f';
  }
  ctx.strokeStyle = '#3a1f2f'; // the smile: a little too big
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.arc(0, 0.05 * r, r * 0.55, 0.12 * Math.PI, 0.88 * Math.PI);
  ctx.stroke();
  if (mood === 'smile') {
    ctx.fillStyle = '#ff7aa8'; // cheeks
    for (const cxk of [-0.62, 0.62]) {
      ctx.beginPath();
      ctx.arc(cxk * r, 0.18 * r, r * 0.11, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

function drawZombieFace(ctx, x, y, s) {
  ctx.fillStyle = '#8fbf7a';
  ctx.fillRect(x, y, s, s * 1.1);
  ctx.fillStyle = '#5a3d2b'; // hair
  ctx.fillRect(x, y, s, s * 0.22);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + s * 0.18, y + s * 0.38, s * 0.22, s * 0.18);
  ctx.fillRect(x + s * 0.6, y + s * 0.38, s * 0.22, s * 0.18);
  ctx.fillStyle = '#2b1a1a';
  ctx.fillRect(x + s * 0.26, y + s * 0.43, s * 0.08, s * 0.08);
  ctx.fillRect(x + s * 0.64, y + s * 0.45, s * 0.08, s * 0.08);
  ctx.fillRect(x + s * 0.25, y + s * 0.78, s * 0.5, s * 0.08); // the work smile
  ctx.fillStyle = '#d62839'; // the red polo collar
  ctx.fillRect(x, y + s * 0.98, s, s * 0.12);
}

const draw = {
  sunny({ text = 'HAVE A SUNNY DAY!', sub = 'Exits are for customers who have finished shopping.' }) {
    const { canvas, ctx } = canvasOf(512, 768);
    const g = ctx.createLinearGradient(0, 0, 0, 768);
    g.addColorStop(0, '#ff9ec7');
    g.addColorStop(0.55, '#ffd1a1');
    g.addColorStop(1, '#a8e6dd');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 768);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 14;
    ctx.strokeRect(14, 14, 484, 740);
    drawSun(ctx, 256, 300, 120);
    ctx.fillStyle = '#ffffff'; // speech bubble
    ctx.beginPath();
    ctx.roundRect(40, 500, 432, 130, 28);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(220, 500);
    ctx.lineTo(256, 450);
    ctx.lineTo(290, 500);
    ctx.fill();
    ctx.fillStyle = '#e8336f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, text, 256, 565, 400, 44);
    ctx.fillStyle = '#3a1f4f';
    ctx.font = `20px ${BODY}`;
    wrap(ctx, sub, 420).forEach((line, i) => ctx.fillText(line, 256, 670 + i * 26));
    ctx.font = `18px ${FONT}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('SUNNY · SUNSET GALLERIA', 256, 742);
    return canvas;
  },

  employee({ months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN'], name = 'DALE' }) {
    const { canvas, ctx } = canvasOf(768, 512);
    ctx.fillStyle = '#6b3f2a'; // cork board frame
    ctx.fillRect(0, 0, 768, 512);
    ctx.fillStyle = '#c99a62';
    ctx.fillRect(18, 18, 732, 476);
    ctx.fillStyle = '#2d6a8a';
    ctx.fillRect(18, 18, 732, 70);
    ctx.fillStyle = '#ffd23f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, 'EMPLOYEE OF THE MONTH', 384, 54, 700, 46);
    months.forEach((m, i) => {
      const x = 48 + i * 116;
      const y = 120;
      ctx.fillStyle = '#ffffff'; // the photo, slightly crooked pin-up
      ctx.save();
      ctx.translate(x + 50, y + 110);
      ctx.rotate(((i * 37) % 7 - 3) * 0.02);
      ctx.fillRect(-50, -110, 100, 200);
      drawZombieFace(ctx, -38, -96, 76);
      ctx.fillStyle = '#2b2b2b';
      ctx.font = `20px ${FONT}`;
      ctx.fillText(m, 0, 30);
      ctx.font = `16px ${BODY}`;
      ctx.fillText(name, 0, 56);
      ctx.fillStyle = '#ffd23f';
      ctx.fillText('★★★★★', 0, 78);
      ctx.restore();
      ctx.fillStyle = '#d62839'; // the pin
      ctx.beginPath();
      ctx.arc(x + 50, y + 6, 7, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#3a1f1f';
    ctx.font = `22px ${BODY}`;
    ctx.fillText('"Dale never takes a break." - Management', 384, 470);
    return canvas;
  },

  mallMap({ caption = 'YOU ARE HERE. YOU WILL STAY HERE.', typeface = 'brand' }) {
    const { canvas, ctx } = canvasOf(768, 512);
    ctx.fillStyle = '#fff8ef';
    ctx.fillRect(0, 0, 768, 512);
    ctx.fillStyle = '#2bb5a6';
    ctx.fillRect(0, 0, 768, 64);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const type = typographyFor(typeface);
    const utility = typeface === 'utility';
    fitText(ctx, utility ? 'Sunset Galleria · Directory' : 'SUNSET GALLERIA · DIRECTORY', 384, 33, 720, 34, type.display, utility ? type.weight : '400');
    const rooms = [ // a cheerful, roughly right floor plan
      ['FOOD COURT', 120, 300, 380, 120, '#ffb3c7'], ['MEGA MART', 520, 200, 200, 230, '#a7d8f0'],
      ['HALLWAY', 120, 220, 380, 70, '#f5e6a8'], ['ATRIUM', 380, 90, 200, 120, '#ffd1a1'],
      ['START', 240, 130, 110, 80, '#c9b6e4'], ['STAFF', 40, 220, 70, 200, '#cfcfcf'],
    ];
    for (const [label, x, y, w, h, c] of rooms) {
      const roomLabel = utility
        ? label.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
        : label;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#5a4a66';
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = '#3a2f4f';
      ctx.font = `${utility ? type.weight : '400'} 18px ${type.display}`;
      ctx.fillText(roomLabel, x + w / 2, y + h / 2);
    }
    ctx.fillStyle = '#e8263a'; // YOU ARE HERE
    ctx.beginPath();
    ctx.arc(310, 255, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e8263a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(310, 255, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#e8263a';
    fitText(ctx, caption, 384, 470, 720, 32, type.body, '400');
    ctx.fillStyle = '#7a6a86';
    ctx.font = `16px ${type.body}`;
    ctx.fillText(utility ? 'Exits: see Customer Service (closed).' : 'EXITS: SEE CUSTOMER SERVICE (CLOSED)', 384, 500);
    return canvas;
  },

  banner({ text, sub = '', colors = ['#ff9ec7', '#ffd1a1'], ink = '#5b2a86' }) {
    const { canvas, ctx } = canvasOf(1024, 256);
    const g = ctx.createLinearGradient(0, 0, 1024, 0);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; // fabric stripes
    for (let x = -256; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 280, 256);
      ctx.lineTo(x + 256, 256);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 1024, 14);
    ctx.fillRect(0, 242, 1024, 14);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitText(ctx, text, 512, sub ? 108 : 128, 960, 84);
    if (sub) {
      ctx.font = `34px ${BODY}`;
      ctx.fillText(sub, 512, 190);
    }
    return canvas;
  },

  notice({ title, body = '', header = '#ffd23f', ink = '#1d1626', typeface = 'brand' }) {
    const isClosing = title.toUpperCase().includes('STORE CLOSING');
    const { canvas, ctx } = canvasOf(512, 384);

    if (isClosing) {
      // Elegant 1970s Department Store Farewell Letter (Fraunces / Playfair Display)
      ctx.fillStyle = '#faf5ea'; // warm aged parchment
      ctx.fillRect(0, 0, 512, 384);

      // Deep burgundy header bar
      ctx.fillStyle = '#5c1b27';
      ctx.fillRect(0, 0, 512, 92);

      // Delicate gold framing borders
      ctx.strokeStyle = '#c9a050';
      ctx.lineWidth = 2;
      ctx.strokeRect(10, 10, 492, 364);
      ctx.strokeRect(14, 14, 484, 356);

      // Decorative corner flourishes
      ctx.fillStyle = '#c9a050';
      for (const [cx, cy] of [[18, 18], [494, 18], [18, 366], [494, 366]]) {
        ctx.beginPath();
        ctx.arc(cx, cy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Title in heritage serif
      ctx.fillStyle = '#f8ecd2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const serifTitle = '"Playfair Display", "Fraunces", "Georgia", serif';
      fitText(ctx, title, 256, 48, 460, 42, serifTitle);

      // Small gold sub-rule
      ctx.strokeStyle = '#c9a050';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(180, 78);
      ctx.lineTo(332, 78);
      ctx.stroke();

      // Body text in elegant book serif
      ctx.fillStyle = '#2e1c20';
      ctx.font = 'italic 23px "Playfair Display", "Fraunces", "Georgia", serif';
      wrap(ctx, body, 440).forEach((line, i) => ctx.fillText(line, 256, 160 + i * 44));
      return canvas;
    }

    ctx.fillStyle = '#fbfaf5';
    ctx.fillRect(0, 0, 512, 384);
    ctx.fillStyle = header;
    ctx.fillRect(0, 0, 512, 96);
    ctx.fillStyle = ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const type = typographyFor(typeface);
    fitText(ctx, title, 256, 50, 470, 46, type.display, type.weight);
    ctx.font = `${type.bodyStyle ? `${type.bodyStyle} ` : ''}30px ${type.body}`;
    wrap(ctx, body, 450).forEach((line, i) => ctx.fillText(line, 256, 160 + i * 40));
    return canvas;
  },
};

export const POSTER_KINDS = Object.freeze(Object.keys(draw));

export function makePosterTexture(kind, options = {}) {
  if (!Object.hasOwn(draw, kind)) throw new Error(`Unknown poster kind "${kind}"`);
  const texture = new THREE.CanvasTexture(draw[kind](options));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
