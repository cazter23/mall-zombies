// =============================================================================
// CONTROLS DIAGRAM
// Draws a keyboard + mouse, or a controller, as an SVG with each action's label
// placed AROUND the drawing and an elbow line (drawn on top) to its key/button.
// No image files: it is all shapes.
//
// What gets labelled comes from `controlsHelp` (config/controls.js): each entry's
// `anchors` are ids of parts drawn here (key names like 'W', 'Space', or 'mouse',
// 'lmb', 'ls', 'rt'...). The FIRST anchor is the one the label's line goes to; all
// of them are tinted in the label's color.
//
// Where a label sits is set by hand in `slots` inside drawKeyboard / drawController:
//   slots[anchorId] = { x, y, align }
//   align 'end'    = label to the LEFT of the part (text ends at x), line leaves sideways
//   align 'start'  = label to the RIGHT of the part (text starts at x)
//   align 'middle' = label ABOVE or BELOW the part (text centered on x), line leaves up/down
// New part = give it an id + a slot here, then list the id in controlsHelp.
// =============================================================================

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1040;
const HEIGHT = 460;

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// An anchor = a part's bounds (l, t, r, b), its center, and its shape (tinted when used).
function boundsOf(l, t, r, b, extra = {}) {
  return { l, t, r, b, cx: (l + r) / 2, cy: (t + b) / 2, ...extra };
}

// --- Keyboard + mouse ---------------------------------------------------------

const KEY = 36; // key pitch
const KEYBOARD_ROWS = [
  [['Esc', 1.5], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8']],
  [['Tab', 1.5], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U']],
  [['Caps', 1.8], ['A'], ['S'], ['D'], ['F'], ['G'], ['H']],
  [['Shift', 2.3], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N']],
  [['Ctrl', 1.4], ['Alt', 1.4], ['Space', 5]],
];

function drawKeyboard(parent, anchors, slots) {
  const ox = 250;
  const oy = 140;
  KEYBOARD_ROWS.forEach((row, r) => {
    let x = ox;
    for (const [label, units = 1] of row) {
      const w = units * KEY - 4;
      const y = oy + r * KEY;
      const g = svg('g', { class: 'dg-keycap' });
      const rect = svg('rect', { class: 'dg-key', x, y, width: w, height: KEY - 4, rx: 6 });
      g.append(rect, svg('text', { class: 'dg-key-text', x: x + w / 2, y: y + (KEY - 4) / 2 }, label));
      parent.append(g);
      anchors[label] = boundsOf(x, y, x + w, y + KEY - 4, { rect, group: g });
      x += units * KEY;
    }
  });

  // Mouse: body, two buttons, wheel.
  const mx = 800;
  const my = 190;
  parent.append(svg('rect', { class: 'dg-body', x: mx, y: my, width: 76, height: 128, rx: 36 }));
  parent.append(svg('line', { class: 'dg-key', x1: mx + 38, y1: my, x2: mx + 38, y2: my + 58 }));
  parent.append(svg('line', { class: 'dg-key', x1: mx, y1: my + 58, x2: mx + 76, y2: my + 58 }));
  parent.append(svg('rect', { class: 'dg-key', x: mx + 33, y: my + 14, width: 10, height: 26, rx: 5 }));
  const point = (x, y) => boundsOf(x, y, x, y);
  anchors.lmb = point(mx + 20, my + 30);
  anchors.rmb = point(mx + 56, my + 30);
  anchors.wheel = point(mx + 38, my + 27);
  anchors.mmb = point(mx + 38, my + 40); // middle click = pressing the wheel (its line meets the wheel's lower end)
  anchors.mouse = point(mx + 38, my + 96);

  Object.assign(slots, {
    Esc: { x: 232, y: 156, align: 'end' }, // Pause
    1: { x: 320, y: 96, align: 'middle' }, // Switch weapon
    A: { x: 232, y: 228, align: 'end' }, // Move (A is the left end of WASD)
    Shift: { x: 232, y: 264, align: 'end' }, // Sprint
    R: { x: 620, y: 192, align: 'start' }, // Reload
    F: { x: 620, y: 228, align: 'start' }, // Buy
    G: { x: 620, y: 246, align: 'start' }, // Throw Lethal (its line runs in the gap under the H key)
    C: { x: 360, y: 420, align: 'middle' }, // Crouch / slide
    Ctrl: { x: 232, y: 330, align: 'end' }, // Prone
    Space: { x: 440, y: 360, align: 'middle' }, // Jump
    V: { x: 520, y: 420, align: 'middle' }, // Box cutter
    lmb: { x: 805, y: 140, align: 'middle' }, // Shoot
    rmb: { x: 885, y: 140, align: 'middle' }, // Aim
    wheel: { x: 895, y: 227, align: 'start' }, // Switch weapon (wheel)
    mmb: { x: 895, y: 262, align: 'start' }, // Throw Tactical (middle click)
    mouse: { x: 838, y: 380, align: 'middle' }, // Look
  });
}

// --- Controller ---------------------------------------------------------------

function drawController(parent, anchors, slots) {
  const OX = 20; // the drawing was laid out around (500, 215); these shift it into place
  const OY = 80;
  parent.append(svg('path', {
    class: 'dg-body',
    transform: `translate(${OX} ${OY})`,
    d: 'M360 150 C360 120 400 115 440 120 L560 120 C600 115 640 120 640 150 C660 230 665 300 625 310 '
      + 'C595 315 575 285 560 262 L440 262 C425 285 405 315 375 310 C335 300 340 230 360 150 Z',
  }));
  const add = (id, shapeTag, attrs, bounds, label) => {
    const g = svg('g', { class: 'dg-keycap' });
    const node = svg(shapeTag, { class: 'dg-key', ...attrs });
    g.append(node);
    const b = boundsOf(...bounds, { rect: node, group: g });
    if (label) g.append(svg('text', { class: 'dg-key-text', x: b.cx, y: b.cy }, label));
    parent.append(g);
    anchors[id] = b;
  };
  const box = (id, x, y, w, h, label) => add(id, 'rect', { x: x + OX, y: y + OY, width: w, height: h, rx: Math.min(8, h / 2) },
    [x + OX, y + OY, x + OX + w, y + OY + h], label);
  const dot = (id, cx, cy, r, label) => add(id, 'circle', { cx: cx + OX, cy: cy + OY, r },
    [cx + OX - r, cy + OY - r, cx + OX + r, cy + OY + r], label);

  box('lt', 372, 74, 56, 24, 'LT');
  box('rt', 572, 74, 56, 24, 'RT');
  box('lb', 365, 100, 70, 14, 'LB');
  box('rb', 565, 100, 70, 14, 'RB');
  dot('ls', 410, 170, 24, 'LS');
  dot('rs', 555, 245, 24, 'RS');
  dot('y', 590, 146, 12, 'Y');
  dot('x', 566, 170, 12, 'X');
  dot('b', 614, 170, 12, 'B');
  dot('a', 590, 194, 12, 'A');
  box('start', 512, 168, 16, 9);
  box('back', 472, 168, 16, 9);
  const dpad = svg('path', {
    class: 'dg-key', transform: `translate(${OX} ${OY})`, d: 'M447 232 h12 v-12 h14 v12 h12 v14 h-12 v12 h-14 v-12 h-12 z',
  });
  const dpadGroup = svg('g', { class: 'dg-keycap' });
  dpadGroup.append(dpad);
  parent.append(dpadGroup);
  // D-pad right (Throw Tactical): its arm's bounds; tinting it tints the whole pad. R3 = clicking the right stick: the same
  // circle as 'rs' with a label slot of its own (Look keeps 'rs').
  anchors.dright = boundsOf(473 + OX, 232 + OY, 485 + OX, 246 + OY, { rect: dpad, group: dpadGroup });
  anchors.r3 = { ...anchors.rs };

  Object.assign(slots, {
    lt: { x: 330, y: 166, align: 'end' }, // Aim
    lb: { x: 330, y: 190, align: 'end' }, // Prone
    rt: { x: 710, y: 166, align: 'start' }, // Shoot
    rb: { x: 710, y: 190, align: 'start' }, // Throw Lethal
    r3: { x: 710, y: 298, align: 'start' }, // Box cutter (R3)
    dright: { x: 499, y: 400, align: 'middle' }, // Throw Tactical (label below the pad, straight line up)
    ls: { x: 330, y: 250, align: 'end' }, // Move / sprint
    x: { x: 330, y: 290, align: 'end' }, // Reload / buy
    start: { x: 540, y: 100, align: 'middle' }, // Pause
    y: { x: 710, y: 226, align: 'start' }, // Switch weapon
    b: { x: 710, y: 250, align: 'start' }, // Crouch / slide
    a: { x: 710, y: 274, align: 'start' }, // Jump
    rs: { x: 575, y: 420, align: 'middle' }, // Look
  });
}

// --- Lines + labels -------------------------------------------------------------

const HUES = [345, 28, 48, 95, 160, 190, 215, 255, 285, 315];
const colorFor = (i) => `hsl(${HUES[i % HUES.length]} 75% 62%)`;
const TEXT_GAP = 8; // space between label text and the start of its line

// Elbow path from a label slot to the edge of the part it describes.
function route(slot, a) {
  const tol = 6; // a label within this of the part's row counts as level with it
  if (slot.align !== 'middle') {
    const sx = slot.align === 'end' ? slot.x + TEXT_GAP : slot.x - TEXT_GAP;
    const sy = slot.y;
    const edgeX = slot.align === 'end' ? a.l : a.r;
    if (sy >= a.t - tol && sy <= a.b + tol) return { d: `M${sx} ${sy} H${edgeX}`, ex: edgeX, ey: Math.min(a.b, Math.max(a.t, sy)) };
    const edgeY = sy < a.t ? a.t : a.b;
    return { d: `M${sx} ${sy} H${a.cx} V${edgeY}`, ex: a.cx, ey: edgeY };
  }
  const above = slot.y < a.t;
  const sy = above ? slot.y + 12 : slot.y - 12;
  const edgeY = above ? a.t : a.b;
  if (slot.x >= a.l + 2 && slot.x <= a.r - 2) return { d: `M${slot.x} ${sy} V${edgeY}`, ex: slot.x, ey: edgeY };
  const midY = (sy + edgeY) / 2;
  return { d: `M${slot.x} ${sy} V${midY} H${a.cx} V${edgeY}`, ex: a.cx, ey: edgeY };
}

// `device`: 'keyboard' | 'gamepad'; `entries`: controlsHelp[device]. Returns the <svg> element.
export function buildControlsDiagram(device, entries) {
  const root = svg('svg', { class: 'controls-diagram', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img' });
  const shapes = svg('g');
  const lines = svg('g');
  const labels = svg('g');
  root.append(shapes, lines, labels); // lines are drawn ON TOP of the keys so they stay visible
  const anchors = {};
  const slots = {};
  if (device === 'keyboard') drawKeyboard(shapes, anchors, slots);
  else drawController(shapes, anchors, slots);

  entries.forEach((entry, i) => {
    const target = anchors[entry.anchors[0]];
    const slot = slots[entry.anchors[0]];
    if (!target || !slot) return;
    const color = colorFor(i);
    for (const id of entry.anchors) { // tint every key/button this action uses
      const a = anchors[id];
      if (a?.rect) {
        a.rect.style.fill = color;
        a.group.classList.add('dg-used');
      }
    }
    const text = svg('text', {
      class: 'dg-label', x: slot.x, y: slot.y, 'dominant-baseline': 'central',
      'text-anchor': slot.align === 'end' ? 'end' : slot.align === 'start' ? 'start' : 'middle',
    }, entry.short);
    // Printed handbook labels use dark ink; the matching keys/leader lines retain their colors.
    labels.append(text);
    const path = route(slot, target);
    lines.append(svg('path', { class: 'dg-line', stroke: color, d: path.d }));
    lines.append(svg('circle', { cx: path.ex, cy: path.ey, r: 3.5, fill: color }));
  });
  return root;
}
