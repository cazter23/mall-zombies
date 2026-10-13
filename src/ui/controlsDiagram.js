// =============================================================================
// CONTROLS DIAGRAM
// Draws a keyboard + mouse, or a controller, as an SVG with a labelled line from
// each action to the key/button it uses. No image files: it is all shapes.
//
// What gets labelled comes from `controlsHelp` (config/controls.js): each entry's
// `anchors` are ids of parts drawn here (key names like 'W', 'Space', or 'mouse',
// 'lmb', 'ls', 'rt'...). To label another part, give it an id in the drawing below
// and list that id in the entry's anchors. Keys that are used are tinted in the
// color of their label.
// =============================================================================

const NS = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const HEIGHT = 380;
const LEFT_X = 250; // labels on the left end here...
const RIGHT_X = 800; // ...and on the right start here
const LABEL_SPACING = 30;

function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// --- Parts: each drawing function adds shapes and returns anchors { id: { x, y, side, node? } } ---

const KEY = 36; // key pitch
const KEYBOARD_ROWS = [
  { x: 0, keys: [['Esc', 1.5], ['1'], ['2'], ['3'], ['4'], ['5'], ['6'], ['7'], ['8']] },
  { x: 0, keys: [['Tab', 1.5], ['Q'], ['W'], ['E'], ['R'], ['T'], ['Y'], ['U']] },
  { x: 0, keys: [['Caps', 1.8], ['A'], ['S'], ['D'], ['F'], ['G'], ['H']] },
  { x: 0, keys: [['Shift', 2.3], ['Z'], ['X'], ['C'], ['V'], ['B'], ['N']] },
  { x: 0, keys: [['Ctrl', 1.4], ['Alt', 1.4], ['Space', 5]] },
];

function drawKeyboard(parent, anchors) {
  const ox = 250;
  const oy = 80;
  KEYBOARD_ROWS.forEach((row, r) => {
    let x = ox + row.x;
    for (const [label, units = 1] of row.keys) {
      const w = units * KEY - 4;
      const g = svg('g', { class: 'dg-keycap' });
      g.append(svg('rect', { class: 'dg-key', x, y: oy + r * KEY, width: w, height: KEY - 4, rx: 6 }));
      g.append(svg('text', { class: 'dg-key-text', x: x + w / 2, y: oy + r * KEY + (KEY - 4) / 2 }, label));
      parent.append(g);
      anchors[label] = { x: x + w / 2, y: oy + r * KEY + (KEY - 4) / 2, side: 'left', rect: g.firstChild, group: g };
      x += units * KEY;
    }
  });

  // Mouse: body, two buttons, wheel.
  const mx = 700;
  const my = 90;
  parent.append(svg('rect', { class: 'dg-body', x: mx, y: my, width: 76, height: 128, rx: 36 }));
  parent.append(svg('line', { class: 'dg-key', x1: mx + 38, y1: my, x2: mx + 38, y2: my + 58 }));
  parent.append(svg('line', { class: 'dg-key', x1: mx, y1: my + 58, x2: mx + 76, y2: my + 58 }));
  parent.append(svg('rect', { class: 'dg-key', x: mx + 33, y: my + 14, width: 10, height: 26, rx: 5 }));
  anchors.lmb = { x: mx + 20, y: my + 28, side: 'right' };
  anchors.rmb = { x: mx + 56, y: my + 28, side: 'right' };
  anchors.wheel = { x: mx + 38, y: my + 40, side: 'right' };
  anchors.mouse = { x: mx + 38, y: my + 96, side: 'right' };
}

function drawController(parent, anchors) {
  parent.append(svg('path', {
    class: 'dg-body',
    d: 'M360 150 C360 120 400 115 440 120 L560 120 C600 115 640 120 640 150 C660 230 665 300 625 310 '
      + 'C595 315 575 285 560 262 L440 262 C425 285 405 315 375 310 C335 300 340 230 360 150 Z',
  }));
  // Triggers + bumpers
  const shape = (tag, attrs, id, side, tx, ty, label) => {
    const node = svg(tag, { class: 'dg-key', ...attrs });
    const g = svg('g', { class: 'dg-keycap' });
    g.append(node);
    if (label) g.append(svg('text', { class: 'dg-key-text', x: tx, y: ty }, label));
    parent.append(g);
    anchors[id] = { x: tx, y: ty, side, rect: node, group: g };
  };
  shape('rect', { x: 372, y: 74, width: 56, height: 24, rx: 8 }, 'lt', 'left', 400, 86, 'LT');
  shape('rect', { x: 572, y: 74, width: 56, height: 24, rx: 8 }, 'rt', 'right', 600, 86, 'RT');
  shape('rect', { x: 365, y: 100, width: 70, height: 14, rx: 6 }, 'lb', 'left', 400, 107, 'LB');
  shape('rect', { x: 565, y: 100, width: 70, height: 14, rx: 6 }, 'rb', 'right', 600, 107, 'RB');
  // Sticks
  shape('circle', { cx: 410, cy: 170, r: 24 }, 'ls', 'left', 410, 170, 'LS');
  shape('circle', { cx: 555, cy: 245, r: 24 }, 'rs', 'right', 555, 245, 'RS');
  // Face buttons
  shape('circle', { cx: 590, cy: 146, r: 12 }, 'y', 'right', 590, 146, 'Y');
  shape('circle', { cx: 566, cy: 170, r: 12 }, 'x', 'left', 566, 170, 'X');
  shape('circle', { cx: 614, cy: 170, r: 12 }, 'b', 'right', 614, 170, 'B');
  shape('circle', { cx: 590, cy: 194, r: 12 }, 'a', 'right', 590, 194, 'A');
  // Start / back (small), d-pad (decoration)
  shape('rect', { x: 512, y: 168, width: 16, height: 9, rx: 4 }, 'start', 'left', 520, 172, '');
  shape('rect', { x: 472, y: 168, width: 16, height: 9, rx: 4 }, 'back', 'left', 480, 172, '');
  parent.append(svg('path', { class: 'dg-key', d: 'M447 232 h12 v-12 h14 v12 h12 v14 h-12 v12 h-14 v-12 h-12 z' }));
}

const HUES = [345, 28, 48, 95, 160, 190, 215, 255, 285, 315];
const colorFor = (i) => `hsl(${HUES[i % HUES.length]} 75% 62%)`;

// Spread labels down a column so they never overlap, staying near their targets.
function layoutColumn(items) {
  items.sort((a, b) => a.ty - b.ty);
  let prev = 28 - LABEL_SPACING;
  for (const item of items) {
    item.ly = Math.max(item.ty, prev + LABEL_SPACING);
    prev = item.ly;
  }
  const overflow = prev - (HEIGHT - 24);
  if (overflow > 0) {
    // pull the bottom ones back up
    let limit = HEIGHT - 24;
    for (let i = items.length - 1; i >= 0; i--) {
      items[i].ly = Math.min(items[i].ly, limit);
      limit = items[i].ly - LABEL_SPACING;
    }
  }
}

// `device`: 'keyboard' | 'gamepad'; `entries`: controlsHelp[device]. Returns the <svg> element.
export function buildControlsDiagram(device, entries) {
  const root = svg('svg', { class: 'controls-diagram', viewBox: `0 0 ${WIDTH} ${HEIGHT}`, role: 'img' });
  const shapes = svg('g');
  const lines = svg('g');
  const dots = svg('g');
  const labels = svg('g');
  root.append(lines, shapes, dots, labels); // lines go UNDER the keys, so they appear to come out of them
  const anchors = {};
  if (device === 'keyboard') drawKeyboard(shapes, anchors);
  else drawController(shapes, anchors);

  const columns = { left: [], right: [] };
  entries.forEach((entry, i) => {
    const first = anchors[entry.anchors[0]];
    if (!first) return;
    const color = colorFor(i);
    // Tint every key/button this action uses.
    for (const id of entry.anchors) {
      const a = anchors[id];
      if (a?.rect) {
        a.rect.style.fill = color;
        a.group.classList.add('dg-used');
      }
    }
    columns[first.side].push({ entry, color, first, ty: first.y });
  });

  for (const side of ['left', 'right']) {
    const items = columns[side];
    layoutColumn(items);
    for (const item of items) {
      const x = side === 'left' ? LEFT_X : RIGHT_X;
      const label = svg('text', {
        class: 'dg-label', x: side === 'left' ? x - 10 : x + 10, y: item.ly, 'dominant-baseline': 'central',
        'text-anchor': side === 'left' ? 'end' : 'start',
      }, item.entry.short);
      label.style.fill = item.color; // same color as the key(s) it points at
      labels.append(label);
      item.entry.anchors.forEach((id, n) => {
        const a = anchors[id];
        if (!a) return;
        lines.append(svg('line', {
          class: `dg-line${n ? ' dashed' : ''}`, stroke: item.color, x1: x, y1: item.ly, x2: a.x, y2: a.y,
        }));
        if (!a.rect) dots.append(svg('circle', { cx: a.x, cy: a.y, r: 3.5, fill: item.color }));
      });
    }
  }
  return root;
}
