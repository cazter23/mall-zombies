// =============================================================================
// MINIMAP: the mall directory board (config/minimap.js; the floor plan and live state: game/minimapPlan.js).
// TAP the minimap button: a small map in the corner, turning with you, shows or hides (remembered as a setting).
// HOLD it: the whole directory, both floors side by side, north-up, while held. Both are canvas drawings made each frame
// from the plan and the state (a few hundred shapes); nothing here reads the game directly.
// =============================================================================

import { minimap as config } from '../config/minimap.js';

const C = config.colors;
const font = (kind, px) => config.fonts[kind].replace('{px}', Math.round(px));

const words = (text) => { const span = el('span'); span.textContent = text; return span; };

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

// Diagonal stripes for an area not bought yet (made once, in screen space).
let hatch = null;
function hatchPattern(ctx) {
  if (hatch) return hatch;
  const tile = document.createElement('canvas');
  tile.width = tile.height = 8;
  const t = tile.getContext('2d');
  t.strokeStyle = C.hatch;
  t.lineWidth = 2;
  t.beginPath();
  t.moveTo(-2, 10); t.lineTo(10, -2);
  t.moveTo(-2, 2); t.lineTo(2, -2);
  t.moveTo(6, 10); t.lineTo(10, 6);
  t.stroke();
  hatch = ctx.createPattern(tile, 'repeat');
  return hatch;
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

/**
 * Draw one floor. `view.project(x, z)` = screen [x, y]; `view.scale` = px per metre; `view.full` = the whole directory
 * (names, prices, gun labels) rather than the corner map.
 */
function drawFloor(ctx, floor, plan, state, view) {
  const { project, scale, full } = view;
  const path = (r) => {
    ctx.beginPath();
    const corners = [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]].map(([x, z]) => project(x, z));
    corners.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
  };

  // Rooms: bought ones filled, the rest hatched; then every outline on top, so shared walls read as one line.
  for (const room of floor.rooms) {
    path(room);
    const open = state.open.has(room.zone);
    ctx.fillStyle = open ? C.room : C.locked;
    ctx.fill();
    if (!open) { ctx.fillStyle = hatchPattern(ctx); ctx.fill(); }
  }
  ctx.strokeStyle = C.roomEdge;
  ctx.lineWidth = full ? 1.5 : 1.2;
  for (const room of floor.rooms) { path(room); ctx.stroke(); }

  // Open to the floor below (balcony voids, the atrium court).
  for (const hole of floor.voids) {
    path(hole);
    ctx.fillStyle = C.void;
    ctx.fill();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = C.voidEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Escalators and stairs: a strip with treads across it.
  for (const ramp of floor.ramps) {
    path(ramp);
    ctx.fillStyle = C.ramp;
    ctx.fill();
    ctx.strokeStyle = C.roomEdge;
    ctx.lineWidth = 1;
    ctx.stroke();
    const along = ramp.axis === 'x' ? [ramp.minX, ramp.maxX] : [ramp.minZ, ramp.maxZ];
    ctx.beginPath();
    for (let s = along[0] + 0.7; s < along[1]; s += 0.7) {
      const [a, b] = ramp.axis === 'x' ? [project(s, ramp.minZ), project(s, ramp.maxZ)] : [project(ramp.minX, s), project(ramp.maxX, s)];
      ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
    }
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }

  // Shutters still shut, with the price to open them where you can buy one (the full directory only).
  for (const shutter of state.shutters) {
    if (shutter.floor !== floor.index) continue;
    const [cx, cy] = project(shutter.x, shutter.z);
    const pad = Math.max(0, 2.5 / scale); // (at least a few px thick)
    path({ minX: shutter.minX - pad, maxX: shutter.maxX + pad, minZ: shutter.minZ - pad, maxZ: shutter.maxZ + pad });
    ctx.fillStyle = C.shutter;
    ctx.fill();
    if (full && shutter.price !== null) {
      const text = shutter.price.toLocaleString('en-US');
      ctx.font = font('price', 11);
      const w = ctx.measureText(text).width + 8;
      ctx.fillStyle = C.board;
      ctx.fillRect(cx - w / 2, cy - 17, w, 14);
      ctx.fillStyle = C.price;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, cx, cy - 10);
    }
  }

  // Area names (the full directory only), sized to fit their room.
  if (full) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const label of floor.labels) {
      const [x, y] = project(label.x, label.z);
      const px = Math.min(20, Math.max(10, label.width * scale / Math.max(6, label.text.length) * 1.5));
      ctx.font = font('area', px);
      const overHole = floor.voids.some((v) => label.x > v.minX && label.x < v.maxX && label.z > v.minZ && label.z < v.maxZ);
      ctx.fillStyle = state.open.has(label.zone) && !overHole ? C.label : C.labelLocked; // (light on dark: a locked area, or the atrium's open court)
      ctx.fillText(label.text.toUpperCase(), x, y);
    }
  }

  // Places, Kevin, keys: a disc with a letter. A place in an area you have not bought is dimmed.
  const radius = full ? config.iconRadius.full : config.iconRadius.corner;
  const disc = (x, z, look, dim, label) => {
    const [sx, sy] = project(x, z);
    ctx.globalAlpha = dim ? 0.45 : 1;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fillStyle = look.color;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = C.board;
    ctx.stroke();
    ctx.fillStyle = C.board;
    ctx.font = font('icon', radius * 1.35);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(look.glyph, sx, sy + 0.5);
    if (label) {
      ctx.font = font('price', 10);
      ctx.textAlign = 'left';
      const w = ctx.measureText(label).width + 6;
      ctx.fillStyle = C.board;
      ctx.fillRect(sx + radius + 2, sy - 7, w, 14);
      ctx.fillStyle = look.color;
      ctx.fillText(label, sx + radius + 5, sy + 0.5);
    }
    ctx.globalAlpha = 1;
  };
  for (const place of plan.places) {
    if (place.floor === floor.index) disc(place.x, place.z, config.places[place.kind], !state.open.has(place.zone), full ? place.label : null);
  }
  if (state.kevin?.floor === floor.index) disc(state.kevin.x, state.kevin.z, config.places.kiosk, false, null);
  for (const key of state.keys) if (key.floor === floor.index) disc(key.x, key.z, config.key, false, null);

  // You: an arrow pointing where you look (yaw 0 looks along -z).
  if (state.you.floor === floor.index) {
    const [sx, sy] = project(state.you.x, state.you.z);
    const size = full ? config.youSize.full : config.youSize.corner;
    const angle = view.youAngle ?? -state.you.yaw; // (screen angle of "forward"; the corner map is turned so it points up)
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.72, size * 0.8);
    ctx.lineTo(0, size * 0.38);
    ctx.lineTo(-size * 0.72, size * 0.8);
    ctx.closePath();
    ctx.fillStyle = C.you;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C.youEdge;
    ctx.stroke();
    ctx.restore();
  }
}

export function createMinimap({ onCornerChange = null } = {}) {
  const element = el('div', 'minimap');
  element.setAttribute('aria-hidden', 'true');
  const corner = el('div', 'minimap-corner');
  document.documentElement.style.setProperty('--minimap-size', String(config.corner.size)); // (also read by the right-hand HUD stack, which moves down under it)
  const cornerCanvas = el('canvas');
  const cornerFloor = el('span', 'minimap-floor');
  corner.append(cornerCanvas, cornerFloor);
  const full = el('div', 'minimap-full');
  const fullTitle = el('div', 'minimap-title');
  fullTitle.textContent = 'Mall directory';
  const fullCanvas = el('canvas');
  const legend = el('div', 'minimap-legend');
  full.append(fullTitle, fullCanvas, legend);
  element.append(corner, full);
  corner.hidden = full.hidden = true;

  let cornerOn = false;
  let heldFor = 0, wasHeld = false, swallow = false;
  let legendFor = null;

  function buildLegend(plan, guidance) {
    const seen = new Map();
    for (const place of plan.places) {
      const look = config.places[place.kind];
      seen.set(look.legend, look);
    }
    seen.set(config.places.kiosk.legend, config.places.kiosk);
    if (guidance) seen.set(config.key.legend, config.key);
    legend.replaceChildren(...[...seen.values()].map((look) => {
      const item = el('span', 'minimap-legend-item');
      const dot = el('i');
      dot.textContent = look.glyph;
      dot.style.background = look.color;
      item.append(dot, words(look.legend));
      return item;
    }), (() => {
      const item = el('span', 'minimap-legend-item');
      const bar = el('b');
      bar.style.background = C.shutter;
      item.append(bar, words('Shutter (price to open)'));
      return item;
    })());
    legendFor = `${guidance}`;
  }

  function drawCorner(plan, state) {
    const { ctx, width, height } = fit(cornerCanvas);
    const floor = plan.floors[state.you.floor];
    const scale = width / config.corner.metresAcross;
    const cos = Math.cos(state.you.yaw), sin = Math.sin(state.you.yaw);
    const cx = width / 2, cy = height / 2;
    // World -> screen, turned so where you look is up: rotate (x, z) about you by the yaw.
    const project = (x, z) => {
      const dx = (x - state.you.x) * scale, dz = (z - state.you.z) * scale;
      return [cx + dx * cos - dz * sin, cy + dx * sin + dz * cos];
    };
    ctx.fillStyle = C.board;
    ctx.fillRect(0, 0, width, height);
    drawFloor(ctx, floor, plan, state, { project, scale, full: false, youAngle: 0 });
    cornerFloor.textContent = floor.label;
  }

  function drawFull(plan, state) {
    const floors = plan.floors;
    const gap = config.full.gap, pad = config.full.padding, titleRoom = 26;
    const widths = floors.map((f) => f.bounds.maxX - f.bounds.minX);
    const tallest = Math.max(...floors.map((f) => f.bounds.maxZ - f.bounds.minZ));
    // The board is as tall as the drawing needs: as wide as the screen allows, unless that would be too tall.
    const across = fullCanvas.getBoundingClientRect().width;
    const roomLeft = window.innerHeight * config.full.heightShare - fullTitle.offsetHeight - legend.offsetHeight;
    const scale = Math.min((across - pad * 2 - gap * (floors.length - 1)) / widths.reduce((a, b) => a + b, 0), (roomLeft - pad * 2 - titleRoom) / tallest);
    fullCanvas.style.height = `${Math.round(tallest * scale + pad * 2 + titleRoom)}px`;
    const { ctx, width } = fit(fullCanvas);
    let left = (width - (widths.reduce((a, b) => a + b, 0) * scale + gap * (floors.length - 1))) / 2;
    floors.forEach((floor, i) => {
      const b = floor.bounds;
      const top = pad + titleRoom;
      const ox = left;
      const project = (x, z) => [ox + (x - b.minX) * scale, top + (z - b.minZ) * scale];
      const here = state.you.floor === i;
      ctx.font = font('title', 22);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = here ? C.floorTitle : C.floorTitleDim;
      ctx.fillText(here ? `${floor.label.toUpperCase()}  ·  YOU ARE HERE` : floor.label.toUpperCase(), ox, pad + 18);
      drawFloor(ctx, floor, plan, state, { project, scale, full: true });
      left += widths[i] * scale + gap;
    });
  }

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
        element.parentElement?.classList.remove('minimap-on');
        heldFor = 0;
        wasHeld = false;
        swallow = held; // (a press carried in from a menu or the pause screen does nothing until it is let go)
        return;
      }
      if (swallow) {
        swallow = held;
        corner.hidden = !cornerOn;
        full.hidden = true;
        element.parentElement?.classList.toggle('minimap-on', cornerOn);
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
      element.parentElement?.classList.toggle('minimap-on', !corner.hidden);
      if (showFull) {
        if (legendFor !== `${guidance}`) buildLegend(plan, guidance);
        drawFull(plan, state);
      } else if (cornerOn) drawCorner(plan, state);
    },
  };
}
