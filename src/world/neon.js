// =============================================================================
// NEON TUBES
// Glowing neon decoration for maps: tubes along polylines, text in a built-in stroke font, shapes (palm tree,
// lightning bolt, arrow, star, heart, sun, outline rectangle) and backed signs with dead or flickering letters.
//
//   const neon = createNeon(kit)          kit = createMapKit(...) (only kit.group is used)
//   neon.tube(points, { color, radius, y, flicker, dead, closed })
//   neon.text('OPEN', { x, y, z, facing, height, color, align, slant, deadLetters, flickerLetters, flicker })
//   neon.shape('palm' | 'bolt' | 'arrow' | 'star' | 'heart' | 'sun' | 'rect', { x, y, z, facing, size, color, ... })
//   neon.sign({ text, x, y, z, facing, height, color, backing, border, deadLetters, flickerLetters })
//   neon.update(dt)                       animates the flickering parts (call each tick)
//   neon.setQuality({ halo, flicker })    the graphics quality system: hide halos / freeze flicker (steady on)
//   neon.stats()                          { meshes, triangles } (draw calls it adds)
//   neon.dispose()                        removes and frees EVERYTHING it created
//
// How it looks: the lit glass is an unlit MeshBasicMaterial whose colour is pushed past 1.0 (pure emission, the
// cheapest "emissive" there is, and the bloom pass catches it), wrapped in a fatter, transparent, additive HALO tube.
// NO real lights, NO colliders: decoration only.
// Batching: within one builder call, every lit tube of one colour is merged into ONE mesh (+ one halo mesh), and dead
// tubes of one colour into one more, so a sign is a handful of draw calls. Flickering parts are separate small meshes
// with their own material so they can animate. Flicker is a seeded on/off state machine per part (deterministic).
// Placement: `facing` works like kit.sign: 1 = faces +Z (default), -1 = faces -Z, 'x+' / 'x-' = faces +X / -X.
// Text and shapes are centred on (x, y, z). Numbers live in config/neon.js.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { neon as cfg, NEON_COLORS } from '../config/neon.js';
import { seededRandom } from './textures.js';

export { NEON_COLORS };

// -----------------------------------------------------------------------------
// The stroke font. Each glyph is drawn on a grid 6 units tall (baseline y = 0, cap height y = 6) and `w` units wide;
// `s` is a list of strokes, each a flat [x0, y0, x1, y1, ...] polyline. Chamfered corners keep it tube-like.
// -----------------------------------------------------------------------------

const O_SHAPE = [1, 0, 0, 1, 0, 5, 1, 6, 3, 6, 4, 5, 4, 1, 3, 0, 1, 0];
const P_SHAPE = [0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3];
const S_SHAPE = [4, 5, 3, 6, 1, 6, 0, 5, 0, 4, 1, 3, 3, 3, 4, 2, 4, 1, 3, 0, 1, 0, 0, 1];

/** A closed polyline of a five-pointed star centred at (cx, cy), flattened. */
function starStroke(cx, cy, outer, inner, points = 5) {
  const out = [];
  for (let i = 0; i <= points * 2; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / points;
    const r = i % 2 === 0 ? outer : inner;
    out.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return out;
}

/** A closed heart outline centred at (cx, cy) with the given width, flattened (the classic parametric heart). */
function heartStroke(cx, cy, width, segments = 28) {
  const out = [];
  const scale = width / 34;
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    out.push(cx + x * scale, cy + (y + 2) * scale);
  }
  return out;
}

export const NEON_FONT = {
  A: { w: 4, s: [[0, 0, 0, 4, 2, 6, 4, 4, 4, 0], [0, 3, 4, 3]] },
  B: { w: 4, s: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3], [3, 3, 4, 2, 4, 1, 3, 0, 0, 0]] },
  C: { w: 4, s: [[4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0, 3, 0, 4, 1]] },
  D: { w: 4, s: [[0, 0, 0, 6, 2, 6, 4, 4, 4, 2, 2, 0, 0, 0]] },
  E: { w: 4, s: [[4, 6, 0, 6, 0, 0, 4, 0], [0, 3, 3, 3]] },
  F: { w: 4, s: [[4, 6, 0, 6, 0, 0], [0, 3, 3, 3]] },
  G: { w: 4, s: [[4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0, 3, 0, 4, 1, 4, 3, 2, 3]] },
  H: { w: 4, s: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]] },
  I: { w: 2, s: [[0, 6, 2, 6], [1, 6, 1, 0], [0, 0, 2, 0]] },
  J: { w: 4, s: [[4, 6, 4, 1, 3, 0, 1, 0, 0, 1]] },
  K: { w: 4, s: [[0, 0, 0, 6], [4, 6, 0, 2], [1.5, 3.5, 4, 0]] },
  L: { w: 4, s: [[0, 6, 0, 0, 4, 0]] },
  M: { w: 4, s: [[0, 0, 0, 6, 2, 3, 4, 6, 4, 0]] },
  N: { w: 4, s: [[0, 0, 0, 6, 4, 0, 4, 6]] },
  O: { w: 4, s: [O_SHAPE] },
  P: { w: 4, s: [P_SHAPE] },
  Q: { w: 4, s: [O_SHAPE, [2.5, 1.5, 4.2, -0.2]] },
  R: { w: 4, s: [P_SHAPE, [2, 3, 4, 0]] },
  S: { w: 4, s: [S_SHAPE] },
  T: { w: 4, s: [[0, 6, 4, 6], [2, 6, 2, 0]] },
  U: { w: 4, s: [[0, 6, 0, 1, 1, 0, 3, 0, 4, 1, 4, 6]] },
  V: { w: 4, s: [[0, 6, 2, 0, 4, 6]] },
  W: { w: 4, s: [[0, 6, 1, 0, 2, 3, 3, 0, 4, 6]] },
  X: { w: 4, s: [[0, 6, 4, 0], [0, 0, 4, 6]] },
  Y: { w: 4, s: [[0, 6, 2, 3, 4, 6], [2, 3, 2, 0]] },
  Z: { w: 4, s: [[0, 6, 4, 6, 0, 0, 4, 0]] },

  0: { w: 4, s: [O_SHAPE, [0.6, 1, 3.4, 5]] },
  1: { w: 3, s: [[0.5, 5, 1.5, 6, 1.5, 0], [0, 0, 3, 0]] },
  2: { w: 4, s: [[0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 0, 0, 4, 0]] },
  3: { w: 4, s: [[0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3, 4, 2, 4, 1, 3, 0, 1, 0, 0, 1], [1.5, 3, 3, 3]] },
  4: { w: 4, s: [[3, 0, 3, 6, 0, 2, 4, 2]] },
  5: { w: 4, s: [[4, 6, 0, 6, 0, 3.5, 3, 3.5, 4, 2.5, 4, 1, 3, 0, 1, 0, 0, 1]] },
  6: { w: 4, s: [[4, 5, 3, 6, 1, 6, 0, 5, 0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 3, 3, 0, 3]] },
  7: { w: 4, s: [[0, 6, 4, 6, 1.5, 0]] },
  8: { w: 4, s: [[1, 3, 0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 3, 3, 1, 3, 0, 2, 0, 1, 1, 0, 3, 0, 4, 1, 4, 2, 3, 3]] },
  9: { w: 4, s: [[4, 3, 1, 3, 0, 4, 0, 5, 1, 6, 3, 6, 4, 5, 4, 1, 3, 0, 1, 0, 0, 1]] },

  ' ': { w: 2.5, s: [] },
  '-': { w: 4, s: [[0.5, 3, 3.5, 3]] },
  '.': { w: 1, s: [[0.5, 0, 0.5, 0.4]] },
  '·': { w: 1, s: [[0.5, 2.8, 0.5, 3.2]] }, // (the middle dot: "EAT · SHOP · REPEAT")
  ',': { w: 1, s: [[0.7, 0.6, 0.3, -0.6]] },
  '!': { w: 1, s: [[0.5, 6, 0.5, 2], [0.5, 0.4, 0.5, 0]] },
  '?': { w: 4, s: [[0, 5, 1, 6, 3, 6, 4, 5, 4, 4, 2, 2.5, 2, 1.6], [2, 0.4, 2, 0]] },
  ':': { w: 1, s: [[0.5, 4.4, 0.5, 4], [0.5, 1.4, 0.5, 1]] },
  "'": { w: 1, s: [[0.5, 6, 0.5, 4.5]] },
  '+': { w: 4, s: [[2, 1, 2, 5], [0, 3, 4, 3]] },
  '*': { w: 3, s: [[1.5, 6, 1.5, 3.6], [0.4, 5.4, 2.6, 4.2], [0.4, 4.2, 2.6, 5.4]] }, // ("FREE REFILLS*")
  '/': { w: 4, s: [[0, 0, 4, 6]] },
  '&': { w: 4, s: [[4, 0, 1, 4, 1, 5, 1.8, 6, 2.6, 6, 3.2, 5, 3.2, 4.4, 0, 2, 0, 1, 1, 0, 2, 0, 4, 2.5]] },
  $: { w: 4, s: [S_SHAPE, [2, 6.8, 2, -0.8]] },
  '%': { w: 4, s: [[0, 0, 4, 6], [0.5, 5.5, 0.5, 4.5], [3.5, 1.5, 3.5, 0.5]] },
  '→': { w: 5, s: [[0, 3, 5, 3], [3, 5, 5, 3, 3, 1]] },
  '←': { w: 5, s: [[5, 3, 0, 3], [2, 5, 0, 3, 2, 1]] },
  '↑': { w: 4, s: [[2, 0, 2, 6], [0, 4, 2, 6, 4, 4]] },
  '↓': { w: 4, s: [[2, 6, 2, 0], [0, 2, 2, 0, 4, 2]] },
  '♥': { w: 5, s: [heartStroke(2.5, 2.6, 5)] },
  '★': { w: 6, s: [starStroke(3, 2.9, 3.2, 1.3)] },
};

const FONT_HEIGHT = 6;

/** The glyph for one character (lower case reads as upper case). Unknown characters throw (a typo in map data). */
function glyphFor(ch) {
  const g = Object.hasOwn(NEON_FONT, ch) ? NEON_FONT[ch] : Object.hasOwn(NEON_FONT, ch.toUpperCase()) ? NEON_FONT[ch.toUpperCase()] : null;
  if (!g) throw new Error(`neon font has no glyph for "${ch}"`);
  return g;
}

/**
 * Lays out a (possibly multi-line, '\n') string at a cap height (pure math, no three.js). Returns { width, height,
 * letters: [{ index, char, strokes: [[[x, y], ...]] }] } in metres, centred on (0, 0) with x right / y up.
 * `index` is the character's position in the ORIGINAL string (newlines and spaces count), for dead/flicker letters.
 */
export function layoutText(string, { height = cfg.text.height, align = 'center', slant = 0, spacing = cfg.text.spacing } = {}) {
  const unit = height / FONT_HEIGHT;
  const pitch = FONT_HEIGHT + cfg.text.lineGap;
  const lines = [[]];
  [...string].forEach((char, index) => (char === '\n' ? lines.push([]) : lines.at(-1).push({ char, index, glyph: glyphFor(char) })));
  const lineWidth = (line) => (line.length ? line.reduce((sum, l) => sum + l.glyph.w, 0) + spacing * (line.length - 1) : 0);
  const widest = Math.max(...lines.map(lineWidth));
  const blockHeight = FONT_HEIGHT + (lines.length - 1) * pitch;
  const letters = [];
  lines.forEach((line, row) => {
    const w = lineWidth(line);
    let cursor = align === 'left' ? -widest / 2 : align === 'right' ? widest / 2 - w : -w / 2;
    const baseline = blockHeight / 2 - FONT_HEIGHT - row * pitch;
    for (const { char, index, glyph } of line) {
      const strokes = glyph.s.map((flat) => {
        const pts = [];
        for (let i = 0; i < flat.length; i += 2) {
          const y = flat[i + 1] + baseline;
          pts.push([(cursor + flat[i] + (flat[i + 1] - 3) * slant) * unit, y * unit]);
        }
        return pts;
      });
      letters.push({ index, char, strokes });
      cursor += glyph.w + spacing;
    }
  });
  return { width: widest * unit, height: blockHeight * unit, letters };
}

/** Width and height (m) of a string at a cap height, without building anything. */
export function measureText(string, height = cfg.text.height, options = {}) {
  const { width, height: h } = layoutText(string, { ...options, height });
  return { width, height: h };
}

// -----------------------------------------------------------------------------
// Shapes: each returns layers [{ strokes, role }] in metres, centred on (0, 0); `role` picks the colour
// ('main' = opts.color, 'accent' = opts.accentColor).
// -----------------------------------------------------------------------------

/** Points along a quadratic Bezier from a to b with control c (2D arrays). */
function bezier(a, c, b, segments) {
  const out = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}

const pairs = (flat, scale = 1) => {
  const out = [];
  for (let i = 0; i < flat.length; i += 2) out.push([flat[i] * scale, flat[i + 1] * scale]);
  return out;
};

const SHAPES = {
  // A leaning trunk (accent) and five drooping fronds (main).
  palm({ size }) {
    const s = size;
    const crown = [0.12 * s, 0.28 * s];
    const trunk = bezier([-0.08 * s, -0.5 * s], [0.12 * s, -0.15 * s], crown, 10);
    const fronds = [[-0.42, 0.06], [-0.28, 0.42], [0.08, 0.5], [0.48, 0.38], [0.5, 0.0]].map(([tx, ty]) => {
      const tip = [crown[0] + tx * s, crown[1] + (ty - 0.24) * s];
      const ctrl = [crown[0] + tx * 0.5 * s, crown[1] + (ty * 0.5 + 0.22) * s];
      return bezier(crown, ctrl, tip, 8);
    });
    const coconuts = [[0.06, 0.22], [0.17, 0.21]].map(([x, y]) => pairs(starStroke(x, y, 0.025, 0.025, 4), s));
    return [{ strokes: [trunk], role: 'accent' }, { strokes: fronds, role: 'main' }, { strokes: coconuts, role: 'accent' }];
  },
  bolt({ size }) {
    return [{ strokes: [pairs([0.1, 0.5, -0.25, -0.02, 0, -0.02, -0.15, -0.5, 0.25, 0.08, 0, 0.08, 0.18, 0.5, 0.1, 0.5], size)], role: 'main' }];
  },
  // An outline arrow pointing `dir` ('right' default, 'left', 'up', 'down').
  arrow({ size, dir = 'right' }) {
    const angle = { right: 0, up: Math.PI / 2, left: Math.PI, down: -Math.PI / 2 }[dir];
    if (angle === undefined) throw new Error(`neon arrow: unknown dir "${dir}"`);
    const c = Math.cos(angle), sn = Math.sin(angle);
    const pts = pairs([-0.5, -0.1, 0.1, -0.1, 0.1, -0.25, 0.5, 0, 0.1, 0.25, 0.1, 0.1, -0.5, 0.1, -0.5, -0.1], size)
      .map(([x, y]) => [x * c - y * sn, x * sn + y * c]);
    return [{ strokes: [pts], role: 'main' }];
  },
  star({ size }) {
    return [{ strokes: [pairs(starStroke(0, -0.03, 0.5, 0.2), size)], role: 'main' }];
  },
  heart({ size }) {
    return [{ strokes: [pairs(heartStroke(0, -0.05, 1), size)], role: 'main' }];
  },
  // The vaporwave sunset: a half disc outline with horizontal bands (main) over a horizon line (accent).
  sun({ size }) {
    const r = size / 2;
    const arc = [];
    for (let i = 0; i <= 16; i++) { const a = (i / 16) * Math.PI; arc.push([Math.cos(a) * r, Math.sin(a) * r - r / 2]); }
    const bands = [0.18, 0.4, 0.62].map((f) => {
      const y = f * r, half = Math.sqrt(r * r - y * y) * 0.92;
      return [[-half, y - r / 2], [half, y - r / 2]];
    });
    return [{ strokes: [arc, ...bands], role: 'main' }, { strokes: [[[-r * 1.3, -r / 2], [r * 1.3, -r / 2]]], role: 'accent' }];
  },
  // An outline rectangle (width x height) with rounded corners of radius `corner`.
  rect({ width = 1, height = 0.5, corner = 0.06 }) {
    const hw = width / 2, hh = height / 2, r = Math.min(corner, hw, hh);
    const pts = [];
    const corners = [[hw - r, hh - r, 0], [-hw + r, hh - r, 1], [-hw + r, -hh + r, 2], [hw - r, -hh + r, 3]];
    for (const [cx, cy, q] of corners) {
      for (let i = 0; i <= 3; i++) { const a = (q + i / 3) * (Math.PI / 2); pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    }
    pts.push(pts[0]);
    return [{ strokes: [pts], role: 'main' }];
  },
};

export const NEON_SHAPES = Object.keys(SHAPES);

const SHAPE_COLORS = {
  palm: [NEON_COLORS.cyan, NEON_COLORS.hotPink],
  bolt: [NEON_COLORS.sunsetOrange],
  arrow: [NEON_COLORS.cyan],
  star: [NEON_COLORS.electricPurple],
  heart: [NEON_COLORS.hotPink],
  sun: [NEON_COLORS.sunsetOrange, NEON_COLORS.hotPink],
  rect: [NEON_COLORS.hotPink],
};

// -----------------------------------------------------------------------------
// Placement helpers
// -----------------------------------------------------------------------------

const FACING_YAW = { 1: 0, '-1': Math.PI, 'z+': 0, 'z-': Math.PI, 'x+': Math.PI / 2, 'x-': -Math.PI / 2 };

function yawOf(facing = 1) {
  const yaw = FACING_YAW[String(facing)];
  if (yaw === undefined) throw new Error(`neon: unknown facing "${facing}" (use 1, -1, 'x+' or 'x-')`);
  return yaw;
}

function placed(name, { x = 0, y = 0, z = 0, facing = 1 } = {}) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(x, y, z);
  g.rotation.y = yawOf(facing);
  return g;
}

/** Any point form -> Vector3: [x, z] (at height y), [x, y, z], or { x, y, z }. */
function toVector(p, y) {
  if (Array.isArray(p)) return p.length === 2 ? new THREE.Vector3(p[0], y, p[1]) : new THREE.Vector3(p[0], p[1] + y, p[2]);
  return new THREE.Vector3(p.x, (p.y ?? 0) + y, p.z);
}

/** One polyline or a list of them -> list of polylines. */
function asStrokes(points) {
  const first = points[0];
  const isStrokeList = Array.isArray(first) && first.length > 0 && typeof first[0] !== 'number';
  return isStrokeList ? points : [points];
}

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * Geometry pieces for strokes (lists of Vector3): an open cylinder per segment and, unless `joints` is false, a small
 * ball at both ends and at each sharp bend (a closed loop's seam counts as a bend). Caller merges and disposes them.
 */
function strokePieces(strokes, radius, radialSegments, joints) {
  const pieces = [];
  const ball = (p) => {
    const g = new THREE.SphereGeometry(radius, cfg.tube.jointSegments.width, cfg.tube.jointSegments.height);
    g.translate(p.x, p.y, p.z);
    pieces.push(g);
  };
  const cosLimit = Math.cos(THREE.MathUtils.degToRad(cfg.tube.jointMinDegrees));
  const dir = new THREE.Vector3(), prevDir = new THREE.Vector3(), matrix = new THREE.Matrix4(), quat = new THREE.Quaternion();
  for (const stroke of strokes) {
    const pts = stroke.filter((p, i) => i === 0 || p.distanceTo(stroke[i - 1]) > 1e-6);
    if (pts.length < 2) continue;
    const closed = pts.length > 2 && pts[0].distanceTo(pts.at(-1)) < 1e-6;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      dir.subVectors(b, a);
      const length = dir.length();
      dir.divideScalar(length);
      const g = new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1, true);
      quat.setFromUnitVectors(Y_AXIS, dir);
      matrix.compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), quat, new THREE.Vector3(1, 1, 1));
      g.applyMatrix4(matrix);
      pieces.push(g);
      if (joints && i > 1 && prevDir.dot(dir) < cosLimit) ball(a);
      prevDir.copy(dir);
    }
    if (!joints) continue;
    if (closed) {
      const first = new THREE.Vector3().subVectors(pts[1], pts[0]).normalize();
      if (prevDir.dot(first) < cosLimit) ball(pts[0]);
    } else {
      ball(pts[0]);
      ball(pts.at(-1));
    }
  }
  return pieces;
}

function merged(pieces) {
  const geometry = mergeGeometries(pieces);
  pieces.forEach((g) => g.dispose());
  return geometry;
}

// -----------------------------------------------------------------------------
// The builder
// -----------------------------------------------------------------------------

/**
 * createNeon(kit, { seed }) -> the neon builders (see the header). Everything goes into one 'neon' group inside
 * kit.group. `seed` changes every flicker pattern (default config/neon.js flicker.seed).
 */
export function createNeon(kit, { seed = cfg.flicker.seed } = {}) {
  const root = new THREE.Group();
  root.name = 'neon';
  kit.group.add(root);

  const geometries = new Set();
  const materials = new Set();
  const shared = { lit: new Map(), halo: new Map(), dead: new Map(), backing: new Map() };
  const halos = []; // every halo mesh (setQuality hides them)
  const flickers = []; // flickering parts: { style, level, on, timer, rand, litMat, haloMat, baseColor }
  const quality = { halo: true, flicker: true };
  let power = 1; // the area's power (setPower: 0 = a power cut)
  let failure = 0; // the share of flickering parts that have died for good (setFailures)
  let partCount = 0;
  let disposed = false;

  const own = (thing, set) => { set.add(thing); return thing; };

  function litMaterial(color) {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(cfg.glow.intensity) });
    m.userData.neon = 'lit';
    m.userData.baseColor = m.color.clone(); // (setPower scales from it)
    return own(m, materials);
  }
  function haloMaterial(color) {
    const m = new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: cfg.halo.opacity, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    m.userData.neon = 'halo';
    return own(m, materials);
  }
  function cached(map, key, make) {
    if (!map.has(key)) map.set(key, make(key));
    return map.get(key);
  }
  const deadMaterial = (color) => cached(shared.dead, color, () => {
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color).multiplyScalar(cfg.dead.tint), roughness: cfg.dead.roughness, metalness: cfg.dead.metalness,
    });
    m.userData.neon = 'dead';
    return own(m, materials);
  });

  function addMesh(parent, geometry, material, role) {
    own(geometry, geometries);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `neon-${role}`;
    mesh.userData.neon = role;
    mesh.matrixAutoUpdate = true;
    if (role === 'halo' || role === 'flickerHalo') {
      mesh.renderOrder = 1; // after the opaque glass
      mesh.visible = quality.halo;
      halos.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  const haloPieces = (strokes, radius) => strokePieces(strokes, radius * cfg.halo.radiusScale, cfg.halo.radialSegments, false);
  const glassPieces = (strokes, radius) => strokePieces(strokes, radius, cfg.tube.radialSegments, true);

  /** A flickering part: its own glass + halo meshes and materials, and its own seeded state machine. */
  function addFlicker(parent, strokes, color, radius, style) {
    const styleCfg = cfg.flicker.styles[style];
    if (!styleCfg) throw new Error(`neon: unknown flicker style "${style}"`);
    const glass = glassPieces(strokes, radius);
    if (!glass.length) return null;
    const litMat = litMaterial(color);
    const haloMat = haloMaterial(color);
    addMesh(parent, merged(glass), litMat, 'flicker');
    addMesh(parent, merged(haloPieces(strokes, radius)), haloMat, 'flickerHalo');
    const rand = seededRandom(((seed * 7919 + ++partCount * 104729) % 2147483646) + 1);
    // failRank: where this part sits in the order parts die for good (setFailures), fixed when it's built
    const part = { style, styleCfg, rand, litMat, haloMat, baseColor: litMat.color.clone(), on: style !== 'dying', timer: 0, level: 1, failRank: rand(), failed: false };
    part.timer = pick(rand, part.on ? styleCfg.on : styleCfg.off) * rand(); // random phase so parts don't sync
    applyLevel(part, part.on || !quality.flicker ? 1 : cfg.flicker.offLevel);
    flickers.push(part);
    return part;
  }

  /**
   * One builder call's batch: lit tubes are bucketed by colour and merged in finish(); dead tubes too (by colour);
   * flickering ones become their own parts immediately.
   */
  function batch(parent) {
    const lit = new Map(), dead = new Map();
    const bucket = (map, color, radius) => cached(map, `${color}|${radius}`, () => ({ color, radius, strokes: [] }));
    return {
      add(strokes, { color, radius, dead: isDead = false, flicker = null }) {
        if (!strokes.length) return;
        if (isDead) bucket(dead, color, radius).strokes.push(...strokes);
        else if (flicker) addFlicker(parent, strokes, color, radius, flicker === true ? 'buzz' : flicker);
        else bucket(lit, color, radius).strokes.push(...strokes);
      },
      finish() {
        for (const { color, radius, strokes } of lit.values()) {
          const glass = glassPieces(strokes, radius);
          if (!glass.length) continue;
          addMesh(parent, merged(glass), cached(shared.lit, color, litMaterial), 'lit');
          addMesh(parent, merged(haloPieces(strokes, radius)), cached(shared.halo, color, haloMaterial), 'halo');
        }
        for (const { color, radius, strokes } of dead.values()) {
          const glass = glassPieces(strokes, radius);
          if (glass.length) addMesh(parent, merged(glass), deadMaterial(color), 'dead');
        }
      },
    };
  }

  const checkAlive = () => { if (disposed) throw new Error('neon: used after dispose()'); };
  const to3 = (strokes2d, z = 0) => strokes2d.map((s) => s.map(([x, y]) => new THREE.Vector3(x, y, z)));

  /**
   * A tube along a polyline (or a list of polylines) in WORLD coordinates. Points: [x, z] (at height `y`), [x, y, z]
   * (y added) or { x, y, z }. Options: color, radius, y, flicker (true | 'buzz' | 'dying' | 'blink'), dead, closed.
   * Returns its group.
   */
  function tube(points, { color = NEON_COLORS.hotPink, radius = cfg.tube.radius, y = 0, flicker = null, dead = false, closed = false } = {}) {
    checkAlive();
    const group = new THREE.Group();
    group.name = 'neon-tube';
    root.add(group);
    const strokes = asStrokes(points).map((s) => {
      const v = s.map((p) => toVector(p, y));
      if (closed && v.length > 2) v.push(v[0].clone());
      return v;
    });
    const b = batch(group);
    b.add(strokes, { color, radius, dead, flicker });
    b.finish();
    return group;
  }

  /** Adds laid-out letters to a batch, routing each letter to lit / dead / flicker. */
  function addLetters(b, layout, { color, radius, depth = 0, deadLetters = [], flickerLetters = [], flicker = null, flickerStyle = 'buzz' }) {
    const deadSet = new Set(deadLetters), flickerSet = new Set(flickerLetters);
    const whole = []; // with `flicker` set, every remaining letter flickers together as ONE part
    for (const letter of layout.letters) {
      const strokes = to3(letter.strokes, depth);
      if (deadSet.has(letter.index)) b.add(strokes, { color, radius, dead: true });
      else if (flickerSet.has(letter.index)) b.add(strokes, { color, radius, flicker: flickerStyle });
      else if (flicker) whole.push(...strokes);
      else b.add(strokes, { color, radius });
    }
    b.add(whole, { color, radius, flicker });
  }

  const textRadius = (height, radius) => radius ?? Math.max(height * cfg.text.radiusPerHeight, cfg.tube.radius * 0.5);

  /**
   * Neon text in the stroke font, centred on (x, y, z), facing `facing`. Options: height (cap height, m), color, radius,
   * align ('center' | 'left' | 'right' for multi-line), slant (italic, font units per unit up), deadLetters /
   * flickerLetters (character indices in the string), flickerStyle (for flickerLetters), flicker (the whole text).
   * Returns { group, width, height }.
   */
  function text(string, opts = {}) {
    checkAlive();
    const { height = cfg.text.height, color = NEON_COLORS.hotPink, radius, align, slant } = opts;
    const layout = layoutText(string, { height, align, slant });
    const group = placed('neon-text', opts);
    root.add(group);
    const b = batch(group);
    addLetters(b, layout, { ...opts, color, radius: textRadius(height, radius) });
    b.finish();
    return { group, width: layout.width, height: layout.height };
  }

  /**
   * A neon shape centred on (x, y, z), facing `facing`: 'palm' | 'bolt' | 'arrow' | 'star' | 'heart' | 'sun' | 'rect'.
   * Options: size (m, overall height), color, accentColor (palm trunk / sun horizon), radius, flicker, dead,
   * dir (arrow), width / height / corner (rect). Returns its group.
   */
  function shape(kind, opts = {}) {
    checkAlive();
    if (!Object.hasOwn(SHAPES, kind)) throw new Error(`neon: unknown shape "${kind}"`);
    const [mainColor, accentColor = mainColor] = SHAPE_COLORS[kind];
    const { size = 1, color = mainColor, radius = cfg.tube.radius, flicker = null, dead = false } = opts;
    const group = placed(`neon-${kind}`, opts);
    root.add(group);
    const b = batch(group);
    for (const layer of SHAPES[kind]({ ...opts, size })) {
      const layerColor = layer.role === 'accent' ? opts.accentColor ?? accentColor : color;
      b.add(to3(layer.strokes), { color: layerColor, radius, flicker, dead });
    }
    b.finish();
    return group;
  }

  /**
   * A backed neon sign: a dark panel with neon text a little in front of it, optionally a border tube.
   * Options: text, x/y/z/facing (the panel's front centre), height (letter height), color, radius, backing
   * (true = config colour, a colour string, or false for bare tubes), border (false | true | colour),
   * deadLetters / flickerLetters (character indices), flickerStyle, slant, align.
   * Returns { group, width, height } (the panel's size).
   */
  function sign(opts = {}) {
    checkAlive();
    const { text: string = '', height = cfg.text.height, color = NEON_COLORS.hotPink, backing = true, border = false, radius } = opts;
    const layout = layoutText(string, { height, align: opts.align, slant: opts.slant });
    const pad = height * cfg.sign.padding + cfg.sign.margin;
    const width = layout.width + pad * 2, panelHeight = layout.height + pad * 2;
    const group = placed('neon-sign', opts);
    root.add(group);
    if (backing) {
      const backingColor = backing === true ? cfg.sign.backingColor : backing;
      const m = cached(shared.backing, backingColor, () => own(new THREE.MeshStandardMaterial({ color: backingColor, roughness: 0.8 }), materials));
      const panel = new THREE.Mesh(own(new THREE.BoxGeometry(width, panelHeight, cfg.sign.depth), geometries), m);
      panel.position.z = -cfg.sign.depth / 2;
      panel.name = 'neon-backing';
      panel.userData.neon = 'backing';
      group.add(panel);
    }
    const b = batch(group);
    const r = textRadius(height, radius);
    addLetters(b, layout, { ...opts, color, radius: r, depth: cfg.sign.standoff });
    if (border) {
      const inset = cfg.sign.borderInset;
      const [outline] = SHAPES.rect({ width: width - inset * 2, height: panelHeight - inset * 2, corner: inset * 1.5 });
      b.add(to3(outline.strokes, cfg.sign.standoff), { color: border === true ? color : border, radius: r * 0.8 });
    }
    b.finish();
    return { group, width, height: panelHeight };
  }

  // ---- flicker ----

  function pick(rand, [min, max]) {
    return min + (max - min) * rand();
  }

  function applyLevel(part, level) {
    part.level = level;
    const shown = part.failed ? 0 : level * power;
    part.litMat.color.copy(part.baseColor).multiplyScalar(Math.max(shown, part.failed ? cfg.flicker.offLevel * 0.25 : 0));
    part.haloMat.opacity = cfg.halo.opacity * shown;
  }

  /** The area's power, 0..1 (the horror layer's power cuts): scales every lit tube and halo, steady and flickering alike. */
  function setPower(level) {
    power = Math.min(1, Math.max(0, level));
    for (const m of shared.lit.values()) m.color.copy(m.userData.baseColor).multiplyScalar(power);
    for (const m of shared.halo.values()) m.opacity = cfg.halo.opacity * power;
    for (const part of flickers) applyLevel(part, part.level);
  }

  /** Lets a share (0..1) of the flickering parts die for good, always the same ones first (slogans lose letters); 0 = all back. */
  function setFailures(fraction) {
    failure = Math.min(1, Math.max(0, fraction));
    for (const part of flickers) {
      part.failed = part.failRank < failure;
      applyLevel(part, part.level);
    }
  }

  /** Advances every flickering part by dt seconds (nothing happens while flicker is off). */
  function update(dt) {
    if (!quality.flicker || disposed) return;
    for (const part of flickers) {
      part.timer -= dt;
      while (part.timer <= 0) {
        const { styleCfg, rand } = part;
        if (part.on) {
          part.on = false;
          part.timer += pick(rand, styleCfg.off);
        } else {
          part.on = true;
          part.timer += rand() < styleCfg.burst ? pick(rand, cfg.flicker.burstOn) : pick(rand, styleCfg.on);
        }
      }
      applyLevel(part, part.on ? 1 : cfg.flicker.offLevel);
    }
  }

  /** Graphics quality: { halo: false } hides every halo, { flicker: false } holds every flickering part steadily lit. */
  function setQuality({ halo = quality.halo, flicker = quality.flicker } = {}) {
    quality.halo = halo;
    quality.flicker = flicker;
    for (const mesh of halos) mesh.visible = halo;
    if (!flicker) for (const part of flickers) applyLevel(part, 1);
  }

  function stats() {
    let meshes = 0, triangles = 0;
    root.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      const g = o.geometry;
      triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
    });
    return { meshes, triangles };
  }

  /** Removes the neon group and frees every geometry and material it created. Safe to call twice. */
  function dispose() {
    if (disposed) return;
    disposed = true;
    root.removeFromParent();
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    geometries.clear();
    materials.clear();
    halos.length = 0;
    flickers.length = 0;
    Object.values(shared).forEach((map) => map.clear());
  }

  return {
    group: root,
    tube, text, shape, sign,
    update, setQuality, setPower, setFailures, stats, dispose,
    get power() { return power; },
    get failure() { return failure; },
    /** Read-only view of the flickering parts ({ style, level, on }), for tests and debugging. */
    get flickers() { return flickers.map(({ style, level, on, failed }) => ({ style, level, on, failed })); },
    get quality() { return { ...quality }; },
    /** Geometries / materials currently owned (counts), for tests. */
    get owned() { return { geometries: geometries.size, materials: materials.size }; },
  };
}
