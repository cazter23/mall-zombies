// =============================================================================
// MINIMAP: the mall directory board (config/minimap.js; the floor plan and live state: game/minimapPlan.js).
// TAP the minimap button: a small map in the corner, turning with you, shows or hides (remembered as a setting).
// HOLD it: the whole directory, both floors side by side (yours larger, under a lit LEVEL tab), north-up, with a numbered
// store index, while held. Both are canvas drawings made each frame from the plan and the state; nothing here reads the
// game directly. The look is the mall's own directory sign: plum case, brass, teal header, each area in its shutter colour.
// =============================================================================

import { minimap as config } from '../config/minimap.js';

const C = config.colors;
const W = config.words;
const font = (kind, px) => config.fonts[kind].replace('{px}', Math.round(px));

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// '#rrggbb' mixed toward another by t (0..1).
function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (shift) => Math.round(((pa >> shift) & 255) * (1 - t) + ((pb >> shift) & 255) * t);
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}
const areaLook = (zone) => config.areas[zone] ?? config.defaultArea;
const floorColor = (zone, open) => (open ? areaLook(zone).fill : mix(areaLook(zone).fill, C.locked, C.lockedMix));

// Screen-space stripe patterns, made once per canvas context: the hatch over areas not bought, and the barrier tape.
const patterns = new WeakMap();
function pattern(ctx, kind) {
  let made = patterns.get(ctx);
  if (!made) patterns.set(ctx, made = {});
  if (made[kind]) return made[kind];
  const tile = document.createElement('canvas');
  const size = kind === 'tape' ? 10 : 8;
  tile.width = tile.height = size;
  const t = tile.getContext('2d');
  if (kind === 'tape') { t.fillStyle = C.tapeLight; t.fillRect(0, 0, size, size); }
  t.strokeStyle = kind === 'tape' ? C.tape : C.hatch;
  t.lineWidth = kind === 'tape' ? 3.6 : 2;
  t.beginPath();
  for (const o of [-size, 0, size]) { t.moveTo(o - 1, size + 1); t.lineTo(o + size + 1, -1); }
  t.stroke();
  made[kind] = ctx.createPattern(tile, 'repeat');
  return made[kind];
}

// Fit a canvas's backing store to its CSS size (sharp on high-DPI screens). Returns its CSS size.
function fit(canvas) {
  const box = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(box.width * ratio)), h = Math.max(1, Math.round(box.height * ratio));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, box.width, box.height);
  return { ctx, width: box.width, height: box.height };
}

// ---- Wayfinding pictograms: drawn in a box from -1 to 1, cream on a dark rounded square ----
const PICTOS = {
  gun(c) {
    c.fillRect(-0.85, -0.42, 1.55, 0.42);
    c.fillRect(0.55, -0.32, 0.3, 0.18);
    c.beginPath(); c.moveTo(-0.6, 0); c.lineTo(-0.2, 0); c.lineTo(-0.05, 0.75); c.lineTo(-0.45, 0.75); c.closePath(); c.fill();
  },
  ammo(c) {
    c.fillRect(-0.75, -0.05, 1.5, 0.8);
    for (const x of [-0.42, 0, 0.42]) {
      c.beginPath(); c.moveTo(x - 0.13, -0.15); c.lineTo(x - 0.13, -0.55); c.quadraticCurveTo(x, -0.9, x + 0.13, -0.55); c.lineTo(x + 0.13, -0.15); c.fill();
    }
  },
  badge(c, back) {
    c.beginPath(); c.moveTo(0, -0.85); c.lineTo(0.72, -0.55); c.lineTo(0.6, 0.25); c.lineTo(0, 0.85); c.lineTo(-0.6, 0.25); c.lineTo(-0.72, -0.55); c.closePath(); c.fill();
    c.strokeStyle = back; c.lineWidth = 0.22;
    c.beginPath(); c.moveTo(-0.32, 0); c.lineTo(-0.06, 0.28); c.lineTo(0.36, -0.3); c.stroke();
  },
  scope(c) {
    c.lineWidth = 0.2;
    c.beginPath(); c.arc(0, 0, 0.62, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(0, -0.95); c.lineTo(0, 0.95); c.moveTo(-0.95, 0); c.lineTo(0.95, 0); c.stroke();
  },
  hammer(c) {
    c.fillRect(-0.75, -0.8, 1.2, 0.42);
    c.fillRect(-0.12, -0.4, 0.26, 1.25);
  },
  hanger(c) {
    c.lineWidth = 0.18; c.lineJoin = 'round';
    c.beginPath(); c.arc(0, -0.58, 0.22, Math.PI, Math.PI * 2.4); c.stroke();
    c.beginPath(); c.moveTo(0, -0.32); c.lineTo(0.85, 0.42); c.lineTo(-0.85, 0.42); c.closePath(); c.stroke();
  },
  claw(c) {
    c.lineWidth = 0.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -0.95); c.lineTo(0, -0.25); c.stroke();
    c.beginPath(); c.moveTo(-0.45, 0.75); c.quadraticCurveTo(-0.7, -0.2, 0, -0.25); c.quadraticCurveTo(0.7, -0.2, 0.45, 0.75); c.stroke();
  },
  ticket(c, back) {
    c.fillRect(-0.85, -0.45, 1.7, 0.9);
    c.fillStyle = back;
    c.beginPath(); c.arc(-0.85, 0, 0.2, 0, Math.PI * 2); c.arc(0.85, 0, 0.2, 0, Math.PI * 2); c.fill();
    c.fillRect(-0.04, -0.35, 0.08, 0.7);
  },
  cart(c) {
    c.beginPath(); c.moveTo(-0.65, -0.45); c.lineTo(0.85, -0.45); c.lineTo(0.62, 0.22); c.lineTo(-0.48, 0.22); c.closePath(); c.fill();
    c.lineWidth = 0.15; c.beginPath(); c.moveTo(-0.65, -0.45); c.lineTo(-0.92, -0.75); c.stroke();
    for (const x of [-0.32, 0.45]) { c.beginPath(); c.arc(x, 0.55, 0.15, 0, Math.PI * 2); c.fill(); }
  },
  bolt(c) {
    c.beginPath(); c.moveTo(0.2, -0.9); c.lineTo(-0.55, 0.12); c.lineTo(-0.05, 0.12); c.lineTo(-0.22, 0.9); c.lineTo(0.55, -0.18); c.lineTo(0.05, -0.18); c.closePath(); c.fill();
  },
  safe(c) {
    c.lineWidth = 0.18;
    c.strokeRect(-0.72, -0.72, 1.44, 1.44);
    c.beginPath(); c.arc(0, 0, 0.3, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(0, -0.3); c.lineTo(0, -0.05); c.stroke();
  },
  return(c) {
    c.lineWidth = 0.2; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(0.65, 0.65); c.lineTo(0.65, 0.05); c.quadraticCurveTo(0.65, -0.42, 0.15, -0.42); c.lineTo(-0.45, -0.42); c.stroke();
    c.beginPath(); c.moveTo(-0.88, -0.42); c.lineTo(-0.38, -0.8); c.lineTo(-0.38, -0.04); c.closePath(); c.fill();
  },
  van(c, back) {
    c.beginPath(); c.moveTo(-0.9, -0.5); c.lineTo(0.3, -0.5); c.lineTo(0.9, 0); c.lineTo(0.9, 0.4); c.lineTo(-0.9, 0.4); c.closePath(); c.fill();
    c.fillStyle = back;
    c.fillRect(0.3, -0.38, 0.28, 0.3);
    for (const x of [-0.48, 0.52]) { c.beginPath(); c.arc(x, 0.45, 0.22, 0, Math.PI * 2); c.fill(); }
  },
  key(c) {
    c.lineWidth = 0.2;
    c.beginPath(); c.arc(-0.48, 0, 0.32, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-0.16, 0); c.lineTo(0.9, 0); c.moveTo(0.55, 0); c.lineTo(0.55, 0.35); c.moveTo(0.82, 0); c.lineTo(0.82, 0.3); c.stroke();
  },
};
export const pictogramNames = Object.keys(PICTOS);

function drawPicto(ctx, look, sx, sy, size, { dim = false, number = null } = {}) {
  const back = look.back ?? C.pictoBack;
  ctx.save();
  ctx.globalAlpha = dim ? 0.5 : 1;
  const h = size / 2;
  ctx.beginPath();
  ctx.roundRect(sx - h, sy - h, size, size, size * 0.22);
  ctx.fillStyle = back;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.pictoInk;
  ctx.stroke();
  ctx.translate(sx, sy);
  ctx.scale(size * 0.34, size * 0.34);
  ctx.fillStyle = C.pictoInk;
  ctx.strokeStyle = C.pictoInk;
  PICTOS[look.picto]?.(ctx, back);
  ctx.restore();
  if (number !== null) {
    ctx.save();
    ctx.globalAlpha = dim ? 0.6 : 1;
    ctx.font = font('number', 9);
    const text = String(number);
    const w = Math.max(11, ctx.measureText(text).width + 5);
    const x = sx + h - 3, y = sy - h - 6;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 11, 5.5);
    ctx.fillStyle = C.number;
    ctx.fill();
    ctx.fillStyle = C.case;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + w / 2, y + 6);
    ctx.restore();
  }
}

// A retail price tag on a string, hung from (sx, sy): the price to open a shutter.
function drawTag(ctx, sx, sy, price) {
  const text = price.toLocaleString('en-US');
  ctx.save();
  ctx.font = font('tag', 10);
  const w = ctx.measureText(text).width + 14, h = 15;
  const tx = sx + 7, ty = sy - 22;
  ctx.strokeStyle = C.tagString;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(tx + 3, ty + h / 2); ctx.stroke();
  ctx.translate(tx, ty);
  ctx.rotate(-0.06);
  ctx.beginPath();
  ctx.moveTo(0, h / 2); ctx.lineTo(6, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(6, h); ctx.closePath();
  ctx.fillStyle = C.tag;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = C.tagInk;
  ctx.stroke();
  ctx.fillStyle = C.tagInk;
  ctx.beginPath(); ctx.arc(4.5, h / 2, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 9, h / 2 + 0.5);
  ctx.restore();
}

/**
 * Draw one floor. `view.project(x, z)` = screen [x, y]; `view.scale` = px per metre; `view.full` = the whole directory
 * (names, numbers) rather than the corner map; `view.turned` = the corner map (you always face up); `view.time` for the pulse.
 */
function drawFloor(ctx, floor, plan, state, view) {
  const { project, scale, full } = view;
  const wall = full ? config.walls.full : config.walls.corner;
  const path = (r) => {
    ctx.beginPath();
    const corners = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]].map(([x, z]) => project(x, z));
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };
  // A doorway's rect, grown through the wall's drawn thickness so it breaks the line cleanly.
  const through = (o, extra = 0) => {
    const grow = (wall + 2) / scale + extra;
    return o.across === 'x'
      ? { minX: o.minX - grow, maxX: o.maxX + grow, minZ: o.minZ, maxZ: o.maxZ }
      : { minX: o.minX, maxX: o.maxX, minZ: o.minZ - grow, maxZ: o.maxZ + grow };
  };

  // 1. Floors: each area in its colour; areas not bought darker and hatched.
  for (const room of floor.rooms) {
    path(room);
    const open = state.open.has(room.zone);
    ctx.fillStyle = floorColor(room.zone, open);
    ctx.fill();
    if (!open) { ctx.fillStyle = pattern(ctx, 'hatch'); ctx.fill(); }
  }
  // 2. Walls: every room's outline, thick, then broken at each doorway (filled with the floor of a side you own, if any).
  ctx.strokeStyle = C.wall;
  ctx.lineWidth = wall;
  ctx.lineJoin = 'miter';
  for (const room of floor.rooms) { path(room); ctx.stroke(); }
  const shut = new Set(state.shutters.map((s) => s.id));
  for (const opening of plan.openings) {
    if (opening.floor !== floor.index || (opening.door && shut.has(opening.door))) continue;
    const zone = opening.zones.find((z) => state.open.has(z)) ?? opening.zones[0];
    path(through(opening));
    ctx.fillStyle = floorColor(zone, state.open.has(zone));
    ctx.fill();
  }

  // 3. Open to the floor below (balcony voids, the atrium court): dark, with a brass rail.
  for (const hole of floor.voids) {
    path(hole);
    ctx.fillStyle = C.void;
    ctx.fill();
    ctx.setLineDash([3, 2]);
    ctx.strokeStyle = C.voidRail;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 4. Escalators and stairs: treads, and chevrons pointing up the slope.
  for (const ramp of floor.ramps) {
    path(ramp);
    ctx.fillStyle = C.ramp;
    ctx.fill();
    ctx.strokeStyle = C.rampEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    const xAxis = ramp.axis === 'x';
    const [lo, hi] = xAxis ? [ramp.minX, ramp.maxX] : [ramp.minZ, ramp.maxZ];
    ctx.beginPath();
    for (let s = lo + 0.7; s < hi; s += 0.7) {
      const [a, b] = xAxis ? [project(s, ramp.minZ), project(s, ramp.maxZ)] : [project(ramp.minX, s), project(ramp.maxX, s)];
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.globalAlpha = 0.45;
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Uphill = along the axis in `dir` from `origin` when the points rise along it.
    const pts = ramp.ramp.points;
    const rising = pts[pts.length - 1][1] > pts[0][1] ? ramp.dir : -ramp.dir;
    const mid = xAxis ? [(lo + hi) / 2, (ramp.minZ + ramp.maxZ) / 2] : [(ramp.minX + ramp.maxX) / 2, (lo + hi) / 2];
    const step = Math.min(1.6, (hi - lo) / 6);
    const width = xAxis ? (ramp.maxZ - ramp.minZ) : (ramp.maxX - ramp.minX);
    const at = (along, side) => project(xAxis ? mid[0] + along * rising : mid[0] + side, xAxis ? mid[1] + side : mid[1] + along * rising);
    ctx.strokeStyle = C.rampArrow;
    ctx.lineWidth = Math.max(1.6, scale * 0.25);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const k of [-1, 0, 1]) {
      const tip = at(k * step + step * 0.4, 0), l = at(k * step - step * 0.2, -width * 0.32), r = at(k * step - step * 0.2, width * 0.32);
      ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(tip[0], tip[1]); ctx.lineTo(r[0], r[1]); ctx.stroke();
    }
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }

  // 5. Shutters still shut: barrier tape across the doorway (the directory hangs a price tag on it: drawFull).
  for (const shutter of state.shutters) {
    if (shutter.floor !== floor.index) continue;
    const opening = plan.openings.find((o) => o.door === shutter.id);
    path(opening ? through(opening, 0.15) : shutter);
    ctx.fillStyle = pattern(ctx, 'tape');
    ctx.fill();
    ctx.strokeStyle = C.tape;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 6. Area names (the directory only), sized to fit their room, in the area's ink.
  if (full) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of floor.labels) {
      const [x, y] = project(label.x, label.z);
      const px = Math.min(22, Math.max(10, label.width * scale / Math.max(6, label.text.length) * 1.5));
      ctx.font = font('area', px);
      const overHole = floor.voids.some((v) => label.x > v.minX && label.x < v.maxX && label.z > v.minZ && label.z < v.maxZ);
      ctx.fillStyle = state.open.has(label.zone) && !overHole ? areaLook(label.zone).ink : C.labelLocked;
      ctx.fillText(label.text.toUpperCase(), x, y);
    }
  }

  // 7. Places, Kevin, keys: pictograms (numbered on the directory). A place in an area not bought yet is dimmed.
  const size = full ? Math.max(12, Math.min(config.pictoSize.full, scale * 1.9)) : config.pictoSize.corner;
  for (const place of plan.places) {
    if (place.floor !== floor.index) continue;
    const [sx, sy] = project(place.x, place.z);
    drawPicto(ctx, config.places[place.kind], sx, sy, size, { dim: !state.open.has(place.zone), number: full ? place.n : null });
  }
  if (state.kevin?.floor === floor.index) {
    const [sx, sy] = project(state.kevin.x, state.kevin.z);
    drawPicto(ctx, config.places.kiosk, sx, sy, size * 1.1);
  }
  for (const key of state.keys) {
    if (key.floor !== floor.index) continue;
    const [sx, sy] = project(key.x, key.z);
    drawPicto(ctx, config.key, sx, sy, size * 1.1);
  }

  // 8. You are here: a view cone, a pulsing ring and a red dot (yaw 0 looks along -z).
  if (state.you.floor === floor.index) {
    const [sx, sy] = project(state.you.x, state.you.z);
    const Y = config.you;
    const r = full ? Y.full : Y.corner;
    const forward = view.turned ? -Math.PI / 2 : Math.atan2(-Math.cos(state.you.yaw), -Math.sin(state.you.yaw));
    const half = (Y.coneDegrees / 2) * Math.PI / 180;
    const reach = Y.coneMetres * scale;
    const cone = ctx.createRadialGradient(sx, sy, r, sx, sy, reach);
    cone.addColorStop(0, C.cone);
    cone.addColorStop(1, 'rgba(230, 57, 70, 0)');
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.arc(sx, sy, reach, forward - half, forward + half);
    ctx.closePath();
    ctx.fillStyle = cone;
    ctx.fill();
    const phase = ((view.time ?? 0) % Y.pulseSeconds) / Y.pulseSeconds;
    ctx.beginPath();
    ctx.arc(sx, sy, r * (1 + phase * (Y.pulseGrow - 1)), 0, Math.PI * 2);
    ctx.strokeStyle = C.you;
    ctx.globalAlpha = 1 - phase;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fillStyle = C.you;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.youRing;
    ctx.stroke();
  }
}

export function createMinimap({ onCornerChange = null } = {}) {
  const element = el('div', 'minimap');
  element.setAttribute('aria-hidden', 'true');
  // (Read by the CSS: the corner's size, which the right-hand HUD stack moves down under, and the backlight flicker.)
  document.documentElement.style.setProperty('--minimap-size', String(config.corner.size));
  document.documentElement.style.setProperty('--minimap-flicker', `${config.flickerSeconds}s`);

  // The corner map: the map, a teal strip with the area you are in, and the floor's tab.
  const corner = el('div', 'minimap-corner');
  const cornerArea = el('span', 'minimap-area');
  const cornerCanvas = el('canvas');
  const cornerFloor = el('span', 'minimap-floor');
  corner.append(cornerCanvas, cornerArea, cornerFloor);

  // The directory: the header strip, the floors, and the store index under them.
  const full = el('div', 'minimap-full');
  const header = el('div', 'minimap-header');
  header.append(el('span', 'minimap-title', W.title), el('span', 'minimap-subtitle', W.subtitle));
  const body = el('div', 'minimap-body');
  const fullCanvas = el('canvas');
  const index = el('div', 'minimap-index');
  body.append(fullCanvas, index);
  full.append(header, body);
  element.append(corner, full);
  corner.hidden = full.hidden = true;

  let cornerOn = false;
  let heldFor = 0, wasHeld = false, swallow = false;
  let time = 0;
  let indexFor = null;

  // The store index: the numbered places by group, Kevin's cart this round, keys, and the two marks to know.
  function buildIndex(plan, state, guidance) {
    const signature = `${[...state.open].sort()}|${state.kevin?.area ?? ''}|${guidance ? state.keys.length : '-'}`;
    if (signature === indexFor) return;
    indexFor = signature;
    const sections = plan.index.map((group) => {
      const section = el('section');
      section.append(el('h3', null, group.title));
      const list = el('ol');
      for (const entry of group.entries) {
        const item = el('li', state.open.has(entry.zone) ? null : 'locked');
        item.append(el('b', null, String(entry.n)), el('span', 'name', entry.count > 1 ? `${entry.name} ×${entry.count}` : entry.name),
          el('span', 'where', entry.area));
        list.append(item);
      }
      section.append(list);
      return section;
    });
    const live = el('section', 'live');
    live.append(el('h3', null, config.places.kiosk.legend),
      el('p', state.kevin ? null : 'locked', state.kevin ? W.kevinOpen(state.kevin.area) : W.kevinClosed));
    if (guidance && state.keys.length) live.append(el('h3', null, W.keys), el('p', null, String(state.keys.length)));
    const marks = el('div', 'minimap-marks');
    marks.append(el('span', 'mark-tape', W.shutter), el('span', 'mark-you', W.youAreHere));
    live.append(marks);
    index.replaceChildren(...sections, live);
  }

  function drawCorner(plan, state) {
    const { ctx, width, height } = fit(cornerCanvas);
    const floor = plan.floors[state.you.floor];
    const scale = width / config.corner.metresAcross;
    const cos = Math.cos(state.you.yaw), sin = Math.sin(state.you.yaw);
    const cx = width / 2, cy = height * 0.56;
    // World -> screen, turned so where you look is up: rotate (x, z) about you by the yaw.
    const project = (x, z) => {
      const dx = (x - state.you.x) * scale, dz = (z - state.you.z) * scale;
      return [cx + dx * cos - dz * sin, cy + dx * sin + dz * cos];
    };
    ctx.fillStyle = C.case;
    ctx.fillRect(0, 0, width, height);
    drawFloor(ctx, floor, plan, state, { project, scale, full: false, turned: true, time });
    cornerFloor.textContent = floor.label;
    cornerArea.textContent = state.you.area ?? '';
  }

  function drawFull(plan, state) {
    const floors = plan.floors;
    const F = config.full;
    const here = state.you.floor;
    const factor = floors.map((_, i) => (i === here ? 1 : F.otherFloor));
    const widths = floors.map((f, i) => (f.bounds.maxX - f.bounds.minX) * factor[i]);
    const tall = Math.max(...floors.map((f, i) => (f.bounds.maxZ - f.bounds.minZ) * factor[i]));
    // The board is as tall as the drawing needs: as wide as the board allows, unless that (with the index under it) would be too tall.
    const across = fullCanvas.getBoundingClientRect().width;
    const roomLeft = window.innerHeight * F.heightShare - header.offsetHeight - index.offsetHeight - 8;
    const scale = Math.min(
      (across - F.padding * 2 - F.gap * (floors.length - 1)) / widths.reduce((a, b) => a + b, 0),
      (roomLeft - F.padding * 2 - F.tabHeight) / tall,
    );
    fullCanvas.style.height = `${Math.round(tall * scale + F.padding * 2 + F.tabHeight)}px`;
    const { ctx, width } = fit(fullCanvas);
    let left = (width - (widths.reduce((a, b) => a + b, 0) * scale + F.gap * (floors.length - 1))) / 2;
    floors.forEach((floor, i) => {
      const b = floor.bounds;
      const s = scale * factor[i];
      const top = F.padding + F.tabHeight;
      const ox = left;
      const project = (x, z) => [ox + (x - b.minX) * s, top + (z - b.minZ) * s];
      // The floor's tab: lit on the floor you are on.
      const lit = i === here;
      const text = lit ? `${floor.label.toUpperCase()}  ·  ${W.youAreHere.toUpperCase()}` : floor.label.toUpperCase();
      ctx.font = font('tab', lit ? 19 : 16);
      const tw = ctx.measureText(text).width + 22;
      ctx.beginPath();
      ctx.roundRect(ox, F.padding, tw, F.tabHeight - 6, [6, 6, 0, 0]);
      ctx.fillStyle = lit ? C.tabLit : C.tab;
      ctx.fill();
      ctx.fillStyle = lit ? C.tabInkLit : C.tabInk;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, ox + 11, F.padding + (F.tabHeight - 6) / 2 + 1);
      drawFloor(ctx, floor, plan, state, { project, scale: s, full: true, time });
      // Price tags hang over everything on the floor.
      for (const shutter of state.shutters) {
        if (shutter.floor !== i || shutter.price === null) continue;
        const [sx, sy] = project(shutter.x, shutter.z);
        drawTag(ctx, sx, sy, shutter.price);
      }
      left += widths[i] * scale + F.gap;
    });
  }

  function setCornerClass(on) { element.parentElement?.classList.toggle('minimap-on', on); }

  return {
    element,
    get cornerOn() { return cornerOn; },
    /** The remembered corner choice (the 'minimap' setting). */
    setCornerOn(on) { cornerOn = !!on; },
    /**
     * Each frame. `held` = the minimap button is down; `active` = a run is being played (not paused, dead or in a menu);
     * `dt` = real seconds since the last frame. A tap toggles the corner map, a hold shows the directory while held.
     */
    update({ plan, state, held, active, dt, guidance = false }) {
      if (!plan || !active) {
        corner.hidden = full.hidden = true;
        setCornerClass(false);
        heldFor = 0;
        wasHeld = false;
        swallow = held; // (a press carried in from a menu or the pause screen does nothing until it is let go)
        return;
      }
      time += dt;
      if (swallow) {
        swallow = held;
        corner.hidden = !cornerOn;
        full.hidden = true;
        setCornerClass(cornerOn);
        if (cornerOn) drawCorner(plan, state);
        return;
      }
      if (held) heldFor += dt;
      else if (wasHeld) {
        if (heldFor < config.holdSeconds) {
          cornerOn = !cornerOn;
          onCornerChange?.(cornerOn);
        }
        heldFor = 0;
      }
      wasHeld = held;
      const showFull = held && heldFor >= config.holdSeconds;
      full.hidden = !showFull;
      corner.hidden = !cornerOn || showFull;
      setCornerClass(!corner.hidden);
      if (showFull) {
        buildIndex(plan, state, guidance);
        drawFull(plan, state);
      } else if (cornerOn) drawCorner(plan, state);
    },
  };
}
