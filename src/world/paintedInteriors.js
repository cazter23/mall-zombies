// =============================================================================
// PAINTED INTERIORS (and the other flat art of the concourse pass): drawn on canvas, no image files.
//   paintInterior(ctx, w, h, { kind, light, lit })   a shop seen through its window: a room in one-point perspective
//                                                     (back wall, floor, side walls, ceiling glow) and what the shop sells
//   paintShopSign(ctx, w, h, { name, sub, ground, ink })   a header or blade sign
//   paintCampaign(ctx, w, h, campaign)               the FALL INTO SAVINGS '86 art (pennants, posters, pole banners)
//   paintMedallion(ctx, size)                        a terrazzo sunburst inlay for the floor
//   paintAccessible(ctx, size)                       a parking bay's painted accessible symbol
// Kinds: music, photo, jewelry, keys, electronics, toys, vacant. Painted flat and simple, like the rest of the mall.
// =============================================================================

const hex = (c) => (typeof c === 'number' ? `#${c.toString(16).padStart(6, '0')}` : c);
const FONT = '"Bungee", "Arial Black", system-ui, sans-serif';
const BODY = 'Arial, "Helvetica Neue", sans-serif';

const ROOMS = {
  music: { wall: '#2c3550', floor: '#3b3048', side: '#262c44' },
  photo: { wall: '#4a2c4c', floor: '#5a4252', side: '#3c2440' },
  jewelry: { wall: '#3d3528', floor: '#4a3f30', side: '#332b20' },
  keys: { wall: '#2f4434', floor: '#3c4a3c', side: '#28382c' },
  electronics: { wall: '#1f2a40', floor: '#2a3346', side: '#1a2234' },
  toys: { wall: '#5a3a52', floor: '#6a4a40', side: '#4a2e44' },
  vacant: { wall: '#4a4246', floor: '#3e3a3c', side: '#383236' },
};

// A tiny fixed random (the same art every load).
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

/** One-point perspective room filling w x h; returns the back wall rect { x, y, w, h } to paint the stock on. */
function room(ctx, w, h, palette, light) {
  const bx = w * 0.18, by = h * 0.16, bw = w * 0.64, bh = h * 0.56;
  ctx.fillStyle = palette.side; // side walls fill everything first
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = palette.floor; // floor trapezoid
  ctx.beginPath(); ctx.moveTo(0, h); ctx.lineTo(w, h); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx, by + bh); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)'; // ceiling trapezoid, lit by the shop's light
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w, 0); ctx.lineTo(bx + bw, by); ctx.lineTo(bx, by); ctx.closePath(); ctx.fill();
  ctx.fillStyle = palette.wall;
  ctx.fillRect(bx, by, bw, bh);
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; // floor tiles running back
  ctx.lineWidth = 2;
  for (let i = -4; i <= 4; i++) {
    ctx.beginPath(); ctx.moveTo(w / 2 + i * w * 0.18, h); ctx.lineTo(bx + bw / 2 + i * bw * 0.12, by + bh); ctx.stroke();
  }
  const glow = ctx.createLinearGradient(0, 0, 0, h * 0.5); // the shop's own light from above
  glow.addColorStop(0, hex(light));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, h * 0.5);
  ctx.globalAlpha = 1;
  return { x: bx, y: by, w: bw, h: bh };
}

const STOCK = {
  music(ctx, b, w, h, rand) { // record bins along the floor, album covers on the back wall, a neon squiggle
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = ['#ff6fae', '#9fe3ff', '#ffd23f', '#c9b6e4', '#7fe0c4'][i % 5];
      ctx.fillRect(b.x + 8 + i * (b.w - 16) / 7, b.y + 10, (b.w - 16) / 7 - 8, b.h * 0.3);
    }
    ctx.fillStyle = '#1b1b24';
    ctx.fillRect(w * 0.08, h * 0.74, w * 0.84, h * 0.12);
    for (let i = 0; i < 24; i++) {
      ctx.fillStyle = `hsl(${rand() * 360}, 60%, ${45 + rand() * 25}%)`;
      ctx.fillRect(w * 0.1 + i * w * 0.033, h * 0.7 - rand() * 6, w * 0.026, h * 0.07);
    }
    ctx.strokeStyle = '#ff6fae'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(b.x + b.w * 0.5, b.y + b.h * 0.72, b.h * 0.18, Math.PI, 0); ctx.stroke();
  },
  photo(ctx, b) { // a laser backdrop, a stool and a camera on a tripod
    const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
    g.addColorStop(0, '#2b1a5c'); g.addColorStop(0.5, '#7a3fa0'); g.addColorStop(1, '#ff6fae');
    ctx.fillStyle = g; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = 'rgba(159,227,255,0.8)'; ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(b.x, b.y + i * b.h / 6); ctx.lineTo(b.x + b.w, b.y + b.h - i * b.h / 6); ctx.stroke(); }
    ctx.fillStyle = '#d8c9b0'; ctx.fillRect(b.x + b.w * 0.45, b.y + b.h * 0.7, b.w * 0.1, b.h * 0.3);
    ctx.fillStyle = '#16141c';
    ctx.fillRect(b.x + b.w * 0.15, b.y + b.h * 0.42, b.w * 0.09, b.h * 0.1);
    ctx.fillRect(b.x + b.w * 0.19, b.y + b.h * 0.5, 3, b.h * 0.5);
    for (const f of [0.08, 0.84]) { ctx.fillStyle = '#e8d6b0'; ctx.fillRect(b.x + b.w * f, b.y + b.h * 0.15, b.w * 0.08, b.h * 0.22); }
  },
  jewelry(ctx, b, w, h) { // glass counters and a mirror
    ctx.fillStyle = '#c9d6dc'; ctx.fillRect(b.x + b.w * 0.35, b.y + b.h * 0.1, b.w * 0.3, b.h * 0.55);
    for (const x of [0.06, 0.55]) {
      ctx.fillStyle = 'rgba(200,230,240,0.55)'; ctx.fillRect(w * x, h * 0.68, w * 0.39, h * 0.16);
      ctx.fillStyle = '#ffd23f'; for (let i = 0; i < 8; i++) ctx.fillRect(w * x + 8 + i * w * 0.045, h * 0.74, 5, 5);
    }
  },
  keys(ctx, b, w, h) { // a wall of key blanks and the cutting machine
    ctx.fillStyle = '#b8a070';
    for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) ctx.fillRect(b.x + 10 + c * (b.w - 20) / 9, b.y + 10 + r * b.h * 0.18, 6, b.h * 0.12);
    ctx.fillStyle = '#5a6a60'; ctx.fillRect(w * 0.3, h * 0.66, w * 0.4, h * 0.2);
    ctx.fillStyle = '#d8dce4'; ctx.fillRect(w * 0.42, h * 0.6, w * 0.16, h * 0.08);
  },
  electronics(ctx, b, w, h, rand) { // a wall of TVs (mostly static), a boombox on the counter
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
      const x = b.x + 6 + c * (b.w - 12) / 4, y = b.y + 6 + r * (b.h - 12) / 3, cw = (b.w - 12) / 4 - 8, ch = (b.h - 12) / 3 - 8;
      ctx.fillStyle = '#121218'; ctx.fillRect(x, y, cw, ch);
      ctx.fillStyle = (r + c) % 3 ? `rgb(${150 + rand() * 60}, ${150 + rand() * 60}, ${170 + rand() * 60})` : '#7fe0c4';
      ctx.fillRect(x + 4, y + 4, cw - 8, ch - 8);
    }
    ctx.fillStyle = '#2a2a34'; ctx.fillRect(w * 0.1, h * 0.76, w * 0.8, h * 0.1);
    ctx.fillStyle = '#c0c4cc'; ctx.fillRect(w * 0.38, h * 0.66, w * 0.24, h * 0.1);
    ctx.fillStyle = '#1b1b24'; for (const x of [0.41, 0.55]) { ctx.beginPath(); ctx.arc(w * x, h * 0.71, h * 0.035, 0, Math.PI * 2); ctx.fill(); }
  },
  toys(ctx, b, w, h, rand) { // shelves of bright boxes and a very large teddy
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
      ctx.fillStyle = ['#ff6f91', '#ffd23f', '#9fe3ff', '#7fe0c4', '#c9b6e4', '#ff9f4a'][(r * 2 + c) % 6];
      ctx.fillRect(b.x + 6 + c * (b.w - 12) / 6, b.y + 8 + r * b.h * 0.3, (b.w - 12) / 6 - 6, b.h * 0.22 - rand() * 6);
    }
    ctx.fillStyle = '#a0683c';
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.6, h * 0.16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.82, h * 0.38, h * 0.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(w * 0.76, h * 0.3, h * 0.04, 0, Math.PI * 2); ctx.arc(w * 0.88, h * 0.3, h * 0.04, 0, Math.PI * 2); ctx.fill();
  },
  vacant(ctx, b, w, h) { // bare: a ladder and a paint tin
    ctx.strokeStyle = '#8a7a60'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(w * 0.6, h * 0.85); ctx.lineTo(w * 0.66, h * 0.35); ctx.moveTo(w * 0.7, h * 0.85); ctx.lineTo(w * 0.72, h * 0.35); ctx.stroke();
    ctx.fillStyle = '#d8d0c0'; ctx.fillRect(w * 0.3, h * 0.78, w * 0.06, h * 0.08);
  },
};

export function paintInterior(ctx, w, h, { kind = 'vacant', light = 0xffffff, lit = true, seed = 7 } = {}) {
  const palette = ROOMS[kind] ?? ROOMS.vacant;
  const back = room(ctx, w, h, palette, light);
  (STOCK[kind] ?? STOCK.vacant)(ctx, back, w, h, seeded(seed));
  if (!lit) { // lights off: everything sinks into the dark
    ctx.fillStyle = 'rgba(8,6,12,0.68)';
    ctx.fillRect(0, 0, w, h);
  }
}

export function paintShopSign(ctx, w, h, { name, sub = '', ground = '#2b2233', ink = '#ffd6ec' }) {
  ctx.fillStyle = hex(ground);
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = hex(ink);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let size = Math.round(h * (sub ? 0.5 : 0.62));
  do { ctx.font = `${size}px ${FONT}`; size -= 2; } while (ctx.measureText(name).width > w * 0.92 && size > 8);
  ctx.fillText(name, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) {
    ctx.globalAlpha = 0.8;
    let s = Math.round(h * 0.2);
    do { ctx.font = `600 ${s}px ${BODY}`; s -= 1; } while (ctx.measureText(sub).width > w * 0.92 && s > 6);
    ctx.fillText(sub, w / 2, h * 0.78);
    ctx.globalAlpha = 1;
  }
}

export function paintCampaign(ctx, w, h, c) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, c.colors.top);
  g.addColorStop(1, c.colors.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = c.colors.sun; // the sunset sun, striped
  ctx.beginPath(); ctx.arc(w / 2, h * 0.36, w * 0.3, Math.PI, 0); ctx.fill();
  ctx.fillStyle = c.colors.top;
  for (let i = 1; i < 4; i++) ctx.fillRect(w * 0.18, h * 0.36 - i * w * 0.07, w * 0.64, w * 0.025);
  ctx.fillStyle = c.colors.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const line = (text, y, size) => {
    let s = size;
    do { ctx.font = `${s}px ${FONT}`; s -= 2; } while (ctx.measureText(text).width > w * 0.86 && s > 8);
    ctx.fillText(text, w / 2, y);
  };
  line(c.title, h * 0.52, w * 0.2);
  line(c.title2, h * 0.64, w * 0.24);
  line(c.year, h * 0.78, w * 0.3);
  ctx.font = `600 ${Math.round(w * 0.075)}px ${BODY}`;
  ctx.fillText(c.tag, w / 2, h * 0.92);
}

export function paintMedallion(ctx, size) {
  const c = size / 2;
  ctx.fillStyle = '#efe3d4';
  ctx.fillRect(0, 0, size, size);
  const rays = 16;
  for (let i = 0; i < rays; i++) { // sunburst rays in two inlay colours
    ctx.fillStyle = i % 2 ? '#ff9f8b' : '#c9b6e4';
    const a0 = (i / rays) * Math.PI * 2, a1 = ((i + 1) / rays) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, c * 0.96, a0, a1); ctx.closePath(); ctx.fill();
  }
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(c, c, c * 0.32, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b3f5e'; ctx.lineWidth = size * 0.02;
  for (const r of [0.32, 0.96]) { ctx.beginPath(); ctx.arc(c, c, c * r, 0, Math.PI * 2); ctx.stroke(); }
}

export function paintAccessible(ctx, size) {
  ctx.fillStyle = '#2f62b0';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#f2f2f2'; ctx.fillStyle = '#f2f2f2';
  ctx.lineWidth = size * 0.06;
  ctx.beginPath(); ctx.arc(size * 0.52, size * 0.62, size * 0.2, 0.3, Math.PI * 1.75); ctx.stroke();
  ctx.beginPath(); ctx.arc(size * 0.47, size * 0.22, size * 0.07, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(size * 0.46, size * 0.3); ctx.lineTo(size * 0.48, size * 0.55); ctx.lineTo(size * 0.68, size * 0.55); ctx.lineTo(size * 0.76, size * 0.76); ctx.stroke();
}
