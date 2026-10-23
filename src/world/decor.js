// THE DECORATION KIT: low-poly, cartoony clutter for an 80s mall gone bad (receipts, bags, boxes, tape,
// fallen signs, puddles, mannequin parts...). Procedural, no image files: every part is a plain geometry with
// flat normals and VERTEX COLOURS, grouped by one of a few shared materials (config/decor.js `materials`),
// so world/scatter.js can merge a whole room of clutter into one mesh per material.
//
// createDecorKit() -> { kinds, materials, model(kind, variant), variantsOf(kind), dispose() }
// model() = { kind, variant, parts: [{ material, geometry }], radius, height, triangles }: built once and
// cached; local origin = centre of its footprint on the floor (y = 0), radius = footprint radius in XZ.
// Decoration only: nothing here ever adds a collider.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './textures.js';
import { decor } from '../config/decor.js';

const P = decor.palette;
const TAU = Math.PI * 2;
const HALF_PI = Math.PI / 2;
const pick = (rand, list) => list[Math.floor(rand() * list.length) % list.length];

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();

// at / rot (radians; yaw is applied last, so rot[0] tilts the part about its own X) / scale (number or [x, y, z]).
function transformOf({ at = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}) {
  _euler.set(rot[0], rot[1], rot[2], 'YXZ');
  _quat.setFromEuler(_euler);
  if (typeof scale === 'number') _scale.setScalar(scale); else _scale.set(scale[0], scale[1], scale[2]);
  return new THREE.Matrix4().compose(_pos.set(at[0], at[1], at[2]), _quat, _scale);
}

// Moves every vertex that shares a position by the same random offset (no cracks between faces).
function jitterShared(geometry, amount, rand) {
  const position = geometry.attributes.position;
  const offsets = new Map();
  for (let i = 0; i < position.count; i++) {
    const key = `${Math.round(position.getX(i) * 1e4)},${Math.round(position.getY(i) * 1e4)},${Math.round(position.getZ(i) * 1e4)}`;
    let offset = offsets.get(key);
    if (!offset) offsets.set(key, offset = [(rand() - 0.5) * 2 * amount, (rand() - 0.5) * 2 * amount, (rand() - 0.5) * 2 * amount]);
    position.setXYZ(i, position.getX(i) + offset[0], position.getY(i) + offset[1], position.getZ(i) + offset[2]);
  }
}

// Accumulates parts for one model. `within(opts, fn)` nests a local transform; `settle(mark)` drops everything
// added since `mark` onto the floor (for things built upright, then tipped over).
function createBuilder(rand) {
  const parts = [];
  const stack = [new THREE.Matrix4()];

  function add(material, geometry, color, opts = {}) {
    let g = geometry;
    if (opts.jitter) jitterShared(g, opts.jitter, rand);
    if (g.index) { const flat = g.toNonIndexed(); g.dispose(); g = flat; }
    for (const name of Object.keys(g.attributes)) if (name !== 'position') g.deleteAttribute(name);
    g.clearGroups();
    if (opts.pre) g.applyMatrix4(opts.pre);
    g.applyMatrix4(transformOf(opts));
    g.applyMatrix4(stack[stack.length - 1]);
    paint(g, color, material, opts);
    parts.push({ material, geometry: g });
    return g;
  }

  // color: one hex, or [a, b] stripes alternating every 2 triangles for the first `stripeLimit` triangles.
  function paint(g, color, material, { stripeLimit = Infinity } = {}) {
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const shade = material === 'solid' || material === 'shiny' ? decor.shadeVariation : 0;
    for (let tri = 0; tri < count / 3; tri++) {
      const hex = Array.isArray(color) ? (tri < stripeLimit ? color[Math.floor(tri / 2) % color.length] : color[0]) : color;
      _color.setHex(hex).multiplyScalar(1 + (rand() - 0.5) * 2 * shade);
      for (let k = 0; k < 3; k++) _color.toArray(colors, (tri * 3 + k) * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  const b = {
    rand,
    mark: () => parts.length,
    within(opts, fn) {
      stack.push(stack[stack.length - 1].clone().multiply(transformOf(opts)));
      try { fn(); } finally { stack.pop(); }
    },
    settle(mark = 0) {
      let minY = Infinity;
      for (const part of parts.slice(mark)) {
        part.geometry.computeBoundingBox();
        minY = Math.min(minY, part.geometry.boundingBox.min.y);
      }
      if (Number.isFinite(minY)) for (const part of parts.slice(mark)) part.geometry.translate(0, -minY, 0);
    },
    box: (material, [w, h, d], color, opts = {}) => {
      const [sx, sy, sz] = opts.segments ?? [1, 1, 1];
      return add(material, new THREE.BoxGeometry(w, h, d, sx, sy, sz), color, opts);
    },
    // Cylinder along Y, centred on `at`. stripes = [a, b] colours the sides only.
    cyl: (material, top, bottom, height, segments, color, opts = {}) =>
      add(material, new THREE.CylinderGeometry(top, bottom, height, segments, opts.heightSegments ?? 1, opts.open ?? false),
        color, { stripeLimit: segments * 2 * (opts.heightSegments ?? 1), ...opts }),
    // Crumpled lump (20 triangles) or a smoother head (detail 1, 80).
    blob: (material, radius, color, opts = {}) =>
      add(material, new THREE.IcosahedronGeometry(radius, opts.detail ?? 0), color, opts),
    pebble: (material, radius, color, opts = {}) => add(material, new THREE.OctahedronGeometry(radius, 0), color, opts),
    // Irregular flat splat on the floor (fan of `segments` triangles), facing up.
    blotch(material, radius, segments, wobble, color, opts = {}) {
      const radii = Array.from({ length: segments }, () => radius * (1 + (rand() - 0.5) * 2 * wobble));
      const positions = [];
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * TAU, a1 = ((i + 1) / segments) * TAU;
        const r0 = radii[i], r1 = radii[(i + 1) % segments];
        positions.push(0, 0, 0, Math.cos(a1) * r1, 0, -Math.sin(a1) * r1, Math.cos(a0) * r0, 0, -Math.sin(a0) * r0);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      return add(material, g, color, opts);
    },
    // Thin triangular slab (a glass shard): corners in XZ, `thickness` tall.
    shard(material, corners, thickness, color, opts = {}) {
      const [a, c1, c2] = corners;
      const [p, q] = (c1[0] - a[0]) * (c2[1] - a[1]) - (c1[1] - a[1]) * (c2[0] - a[0]) < 0 ? [c1, c2] : [c2, c1];
      const top = [a, p, q].map(([x, z]) => [x, thickness, z]);
      const bottom = [a, p, q].map(([x, z]) => [x, 0, z]);
      const tris = [[top[0], top[1], top[2]], [bottom[0], bottom[2], bottom[1]]];
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3;
        tris.push([bottom[i], bottom[j], top[j]], [bottom[i], top[j], top[i]]);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(2), 3));
      return add(material, g, color, opts);
    },
    finish() {
      // Solid parts never poke through the floor (lumps squash flat on it).
      for (const { material, geometry } of parts) {
        if (material === 'decal') continue;
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) if (position.getY(i) < 0) position.setY(i, 0);
      }
      // Centre the footprint on the origin so `radius` is as tight as it can be.
      const bounds = new THREE.Box3();
      for (const part of parts) { part.geometry.computeBoundingBox(); bounds.union(part.geometry.boundingBox); }
      const cx = (bounds.min.x + bounds.max.x) / 2, cz = (bounds.min.z + bounds.max.z) / 2;
      for (const part of parts) part.geometry.translate(-cx, 0, -cz);
      const byMaterial = new Map();
      for (const part of parts) {
        part.geometry.computeVertexNormals();
        if (!byMaterial.has(part.material)) byMaterial.set(part.material, []);
        byMaterial.get(part.material).push(part.geometry);
      }
      let radius = 0, height = 0, triangles = 0;
      const merged = [...byMaterial].map(([material, list]) => {
        const geometry = list.length === 1 ? list[0] : mergeGeometries(list);
        if (list.length > 1) list.forEach((g) => g.dispose());
        const position = geometry.attributes.position;
        for (let i = 0; i < position.count; i++) {
          radius = Math.max(radius, Math.hypot(position.getX(i), position.getZ(i)));
          height = Math.max(height, position.getY(i));
        }
        triangles += position.count / 3;
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return { material, geometry };
      });
      return { parts: merged, radius, height, triangles };
    },
  };
  return b;
}

// --- the models -------------------------------------------------------------------------------------------
// Each: { variants, build(b, variant) }. Built upright around the origin; b.rand is seeded per kind/variant.

function crumpledPaper(b, at, radius) {
  b.blob('solid', radius, pick(b.rand, P.paper), { at: [at[0], radius * 0.75, at[1]], jitter: radius * 0.35 });
}

function chair(b, seatColor) {
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    b.box('shiny', [0.03, 0.45, 0.03], P.chrome, { at: [x, 0.225, z] });
  }
  b.box('solid', [0.44, 0.045, 0.44], seatColor, { at: [0, 0.47, 0] });
  b.box('solid', [0.44, 0.42, 0.04], seatColor, { at: [0, 0.7025, -0.2] });
}

// A limb along local +X from the origin, lying on the floor (thickest end first).
function limb(b, length, r0, r1, color) {
  b.cyl('solid', r1, r0, length, 6, color, { at: [length / 2, Math.max(r0, r1), 0], rot: [0, 0, -HALF_PI] });
}

function arm(b, at, yaw, bend) {
  b.within({ at, rot: [0, yaw, 0] }, () => {
    limb(b, 0.3, 0.042, 0.036, P.plastic);
    b.within({ at: [0.3, 0, 0], rot: [0, bend, 0] }, () => {
      limb(b, 0.27, 0.036, 0.03, P.plastic);
      b.box('solid', [0.1, 0.03, 0.07], P.plastic, { at: [0.32, 0.015, 0] });
    });
  });
}

function cassette(b, at, yaw, color, label) {
  b.within({ at, rot: [0, yaw, 0] }, () => {
    b.box('solid', [0.1, 0.016, 0.064], color, { at: [0, 0.008, 0] });
    b.box('solid', [0.07, 0.0175, 0.03], label, { at: [0, 0.00875, 0] });
    for (const x of [-0.022, 0.022]) b.box('solid', [0.016, 0.0185, 0.016], P.cassette[0], { at: [x, 0.00925, 0] });
  });
}

// A chain of flat strips on the floor from `start`, turning a little each step. Returns where it ends.
function strand(b, start, yaw, pieces, wiggle) {
  let [x, z] = start;
  for (const { length, width, thickness, color } of pieces) {
    yaw += (b.rand() - 0.5) * wiggle;
    const dx = Math.sin(yaw), dz = Math.cos(yaw);
    b.box('solid', [width, thickness, length], color, { at: [x + dx * length / 2, thickness / 2, z + dz * length / 2], rot: [0, yaw, 0] });
    x += dx * length; z += dz * length;
  }
  return { end: [x, z], yaw };
}

const MODELS = {
  receipts: { variants: 3, build(b, v) {
    const r = b.rand;
    for (let i = 0; i < 2 + v; i++) crumpledPaper(b, [(r() - 0.5) * 0.45, (r() - 0.5) * 0.45], 0.035 + r() * 0.03);
    b.box('solid', [0.075, 0.002, 0.24], P.paper[0], { at: [0.12, 0.001, -0.05], rot: [0, r() * Math.PI, 0] });
    if (v !== 1) {
      // A receipt curling up off the floor at one end.
      b.within({ at: [-0.14, 0, 0.1], rot: [0, r() * TAU, 0] }, () => {
        b.box('solid', [0.075, 0.002, 0.14], P.paper[1], { at: [0, 0.001, 0] });
        b.box('solid', [0.075, 0.002, 0.1], P.paper[1], { at: [0, Math.sin(0.6) * 0.05 + 0.001, 0.07 + Math.cos(0.6) * 0.05], rot: [-0.6, 0, 0] });
      });
    }
  } },

  shoppingBag: { variants: 3, build(b, v) {
    const r = b.rand, color = P.bags[(v * 2 + Math.floor(r() * 2)) % P.bags.length];
    const bag = () => {
      b.box('solid', [0.32, 0.38, 0.14], color, { at: [0, 0.19, 0], segments: v === 2 ? [2, 2, 1] : [1, 1, 1], jitter: v === 2 ? 0.02 : 0 });
      b.box('solid', [0.326, 0.06, 0.146], P.bagTrim, { at: [0, 0.29, 0] });
      for (const x of [-0.07, 0.07]) b.box('solid', [0.012, 0.1, 0.012], P.bagTrim, { at: [x, 0.43, 0] });
      b.box('solid', [0.152, 0.012, 0.012], P.bagTrim, { at: [0, 0.474, 0] });
    };
    if (v === 0) { bag(); return; }
    const mark = b.mark();
    // Tipped over on its face (v1) or trodden flat (v2), its shopping spilled out of the open top (+Z).
    b.within({ rot: [HALF_PI, 0, 0], scale: v === 2 ? [1, 1, 0.45] : 1 }, bag);
    b.settle(mark);
    b.box('solid', [0.22, 0.09, 0.14], pick(r, P.bags), { at: [0.06, 0.045, 0.62], rot: [0, 0.5, 0] });
    crumpledPaper(b, [-0.15, 0.56], 0.05);
  } },

  popcorn: { variants: 2, build(b, v) {
    const r = b.rand, mark = b.mark();
    b.within({ rot: [0, 0, -HALF_PI + 0.08] }, () => {
      b.cyl('solid', 0.095, 0.068, 0.2, 8, [P.popcornRed, P.popcornWhite], { at: [0, 0.1, 0], open: true });
      b.cyl('solid', 0.068, 0.068, 0.004, 8, P.popcornWhite, { at: [0, 0.002, 0] });
    });
    b.settle(mark);
    for (let i = 0; i < 9 + v * 3; i++) {
      const x = 0.16 + r() * 0.36, z = (r() - 0.5) * (0.12 + x * 0.7), size = 0.016 + r() * 0.008;
      b.pebble('solid', size, pick(r, P.kernel), { at: [x, size * 0.8, z], rot: [r() * TAU, r() * TAU, 0], jitter: size * 0.3 });
    }
  } },

  sodaCup: { variants: 2, build(b, v) {
    const r = b.rand, colors = P.cups[v % P.cups.length];
    if (v === 0) {
      const mark = b.mark();
      b.within({ rot: [0, 0, HALF_PI - 0.05] }, () => {
        b.cyl('solid', 0.046, 0.034, 0.15, 8, colors, { at: [0, 0.075, 0] });
        b.cyl('solid', 0.049, 0.049, 0.012, 8, P.lid, { at: [0, 0.156, 0] });
        b.box('solid', [0.008, 0.12, 0.008], P.straw, { at: [0.012, 0.21, 0], rot: [0, 0, 0.25] });
      });
      b.settle(mark);
      b.blotch('decal', 0.16, 10, 0.3, P.puddles.soda, { at: [-0.3, 0, 0], scale: [1.5, 1, 1] });
    } else {
      // Stamped flat: squashed cup, lid and straw beside it.
      b.cyl('solid', 0.046, 0.034, 0.15, 8, colors, { at: [0, 0.04, 0], scale: [1.15, 0.5, 0.8], heightSegments: 2, jitter: 0.012 });
      b.cyl('solid', 0.049, 0.049, 0.012, 8, P.lid, { at: [0.13, 0.006, 0.05] });
      b.box('solid', [0.008, 0.008, 0.2], P.straw, { at: [-0.05, 0.004, 0.12], rot: [0, 0.4 + r(), 0] });
    }
  } },

  cardboardBox: { variants: 3, build(b, v) {
    const r = b.rand, kraft = pick(r, P.kraft), W = 0.46, H = 0.32, D = 0.36;
    if (v === 0) { // closed and taped
      b.box('solid', [W, H, D], kraft, { at: [0, H / 2, 0] });
      b.box('solid', [W + 0.004, 0.004, 0.07], P.tape, { at: [0, H + 0.002, 0] });
      b.box('solid', [0.14, 0.1, 0.004], P.paper[0], { at: [0.08, H * 0.55, D / 2 + 0.002] });
    } else if (v === 1) { // open, flaps splayed, rubbish inside
      const T = 0.015, L = 0.17;
      b.box('solid', [W - 2 * T, T, D - 2 * T], kraft, { at: [0, T / 2, 0] });
      for (const s of [-1, 1]) {
        b.box('solid', [W, H, T], kraft, { at: [0, H / 2, s * (D / 2 - T / 2)] });
        b.box('solid', [T, H, D - 2 * T], kraft, { at: [s * (W / 2 - T / 2), H / 2, 0] });
      }
      const flaps = [
        { size: [W, 0.006, L], at: (t) => [0, H - Math.sin(t) * L / 2, D / 2 + Math.cos(t) * L / 2], rot: (t) => [t, 0, 0] },
        { size: [W, 0.006, L], at: (t) => [0, H - Math.sin(t) * L / 2, -D / 2 - Math.cos(t) * L / 2], rot: (t) => [-t, 0, 0] },
        { size: [L, 0.006, D - 0.02], at: (t) => [W / 2 + Math.cos(t) * L / 2, H - Math.sin(t) * L / 2, 0], rot: (t) => [0, 0, -t] },
        { size: [L, 0.006, D - 0.02], at: (t) => [-W / 2 - Math.cos(t) * L / 2, H - Math.sin(t) * L / 2, 0], rot: (t) => [0, 0, t] },
      ];
      const torn = Math.floor(r() * 4);
      flaps.forEach((flap, i) => {
        if (i === torn) return;
        const t = 0.35 + r() * 0.5;
        b.box('solid', flap.size, kraft, { at: flap.at(t), rot: flap.rot(t) });
      });
      crumpledPaper(b, [0.05, 0], 0.07);
    } else { // stamped on
      b.box('solid', [W, H, D], kraft, { at: [0, H * 0.25, 0], scale: [1.05, 0.5, 1], segments: [2, 2, 2], jitter: 0.035,
        pre: new THREE.Matrix4().makeShear(0, 0, 0.25, 0, 0, 0.15) });
    }
  } },

  cautionTape: { variants: 2, build(b, v) {
    const r = b.rand;
    for (let s = 0; s < 1 + v; s++) {
      // Yellow and black alternate, each a different thickness, so joints never share a top face.
      const pieces = Array.from({ length: 9 }, (_, i) => ({ length: i % 2 ? 0.07 : 0.24, width: 0.07,
        thickness: (i % 2 ? 0.0045 : 0.003) + s * 0.003, color: i % 2 ? P.cautionBlack : P.caution }));
      const { end, yaw } = strand(b, [-0.5 + r() * 0.2, (s - 0.5 * v) * 0.45], HALF_PI + (r() - 0.5) * 0.6, pieces, 0.5);
      if (s === 0 && v === 0) { // the post it was tied to, knocked flat
        b.within({ at: [end[0], 0, end[1]], rot: [0, yaw + HALF_PI, 0] }, () => {
          b.cyl('solid', 0.03, 0.03, 0.8, 6, P.cone, { at: [0.4, 0.03, 0], rot: [0, 0, -HALF_PI], heightSegments: 1 });
          b.box('solid', [0.08, 0.2, 0.2], P.cautionBlack, { at: [0.84, 0.1, 0] });
        });
      }
    }
  } },

  fallenSign: { variants: 2, build(b, v) {
    const r = b.rand, panel = P.signPanel[v % P.signPanel.length], W = 1.3, D = 0.5, T = 0.05;
    const plate = (width, x, yaw) => b.within({ at: [x, 0, 0], rot: [0, yaw, 0] }, () => {
      b.box('solid', [width, T, D], panel, { at: [0, T / 2, 0] });
      for (const s of [-1, 1]) b.box('shiny', [width, T + 0.01, 0.036], P.signMetal, { at: [0, (T + 0.01) / 2, s * (D / 2 - 0.015)] });
      for (let i = 0; i < Math.round(width * 4); i++) { // dead neon tube letters
        b.box('solid', [0.16 + r() * 0.1, 0.022, 0.022], P.neon[(i + v) % P.neon.length],
          { at: [-width / 2 + 0.16 + i * 0.24, T + 0.011, (r() - 0.5) * 0.18], rot: [0, (r() - 0.5) * 1.6, 0] });
      }
    });
    const mark = b.mark();
    b.within({ rot: [0.12, 0, 0.03] }, () => {
      if (v === 0) {
        plate(W, 0, 0);
        for (const s of [-1, 1]) b.box('shiny', [0.04, 0.04, 0.16], P.signMetal, { at: [s * 0.45, T / 2, -D / 2 - 0.08] });
      } else { // snapped in two
        plate(W * 0.52, -0.36, 0.1);
        plate(W * 0.44, 0.42, -0.16);
      }
    });
    b.settle(mark);
  } },

  overturnedChair: { variants: 2, build(b, v) {
    const seat = P.chairSeat[(v + Math.floor(b.rand() * 3)) % P.chairSeat.length], mark = b.mark();
    b.within({ rot: v === 0 ? [0, 0, HALF_PI] : [-HALF_PI, 0, 0] }, () => chair(b, seat));
    b.settle(mark);
  } },

  ceilingTile: { variants: 2, build(b, v) {
    const r = b.rand, color = v === 1 ? new THREE.Color(P.ceilingTile).lerp(new THREE.Color(P.waterStain), 0.35).getHex() : P.ceilingTile;
    b.box('solid', [0.6, 0.016, 0.34], color, { at: [0, 0.008, -0.12], rot: [0, (r() - 0.5) * 0.4, 0] });
    b.box('solid', [0.32, 0.016, 0.24], color, { at: [0.28, 0.008, 0.27], rot: [0, 0.6 + r() * 0.6, 0] });
    if (v === 1) b.box('solid', [0.2, 0.016, 0.16], color, { at: [-0.3, 0.008, 0.25], rot: [0, r() * TAU, 0] });
    for (let i = 0; i < 6; i++) {
      const s = 0.025 + r() * 0.03;
      b.box('solid', [s, 0.014, s * (0.6 + r() * 0.6)], color, { at: [(r() - 0.5) * 0.9, 0.007, 0.2 + r() * 0.35 - (i % 2) * 0.75], rot: [0, r() * TAU, 0] });
    }
  } },

  puddle: { variants: 3, build(b, v) {
    if (v === 0) { // dirty water + splashes
      b.blotch('decal', 0.42, 14, 0.25, P.puddles.water, { scale: [1.4, 1, 1] });
      b.blotch('decal', 0.08, 7, 0.3, P.puddles.water, { at: [0.95, 0, 0.1] });
      b.blotch('decal', 0.06, 7, 0.3, P.puddles.water, { at: [-0.85, 0, -0.25] });
    } else if (v === 1) { // spilled soda
      b.blotch('decal', 0.3, 12, 0.3, P.puddles.soda, { scale: [1.2, 1, 0.9] });
    } else { // something that came out of a zombie (cartoon goo, not gore)
      b.blotch('decal', 0.38, 14, 0.28, P.puddles.goo, { scale: [1.1, 1, 1] });
      b.blotch('decal', 0.17, 10, 0.25, P.puddles.gooRim, { at: [0.05, 0.0015, -0.03] });
    }
  } },

  trashPile: { variants: 2, build(b, v) {
    const r = b.rand;
    for (let i = 0; i < 3 + v; i++) {
      const rad = 0.2 + r() * 0.08, x = (r() - 0.5) * 0.6, z = (r() - 0.5) * 0.5;
      b.blob('solid', rad, pick(r, P.trashBags), { at: [x, rad * 0.65, z], scale: [1, 0.75, 1], jitter: rad * 0.25 });
      b.pebble('solid', 0.035, P.tie, { at: [x, rad * 0.65 + rad * 0.72, z] });
    }
    crumpledPaper(b, [0.45, 0.25], 0.05);
    crumpledPaper(b, [-0.42, -0.3], 0.045);
    b.cyl('shiny', 0.033, 0.033, 0.12, 6, pick(r, P.cans), { at: [0.38, 0.033, -0.3], rot: [0, r() * TAU, HALF_PI] });
    if (v === 1) b.box('solid', [0.36, 0.04, 0.36], pick(r, P.kraft), { at: [-0.35, 0.02, 0.38], rot: [0, r(), 0] });
  } },

  mannequinParts: { variants: 3, build(b, v) {
    const r = b.rand;
    if (v === 0) { // a head staring at the ceiling, and an arm
      b.blob('solid', 0.11, P.plastic, { at: [0, 0.105, 0], scale: [0.85, 1, 0.95], detail: 1 });
      for (const x of [-0.035, 0.035]) b.box('solid', [0.03, 0.006, 0.012], P.paint, { at: [x, 0.207, 0.03] });
      b.cyl('solid', 0.04, 0.04, 0.08, 6, P.joint, { at: [0, 0.04, -0.13], rot: [HALF_PI, 0, 0] });
      arm(b, [0.15, 0, 0.12], -0.3 - r() * 0.4, 0.5);
    } else if (v === 1) { // a leg and a hand
      b.within({ at: [-0.4, 0, 0], rot: [0, r() * 0.5, 0] }, () => {
        limb(b, 0.42, 0.07, 0.055, P.plastic);
        b.within({ at: [0.42, 0, 0], rot: [0, -0.25, 0] }, () => {
          limb(b, 0.4, 0.055, 0.04, P.plastic);
          b.box('solid', [0.08, 0.24, 0.09], P.plastic, { at: [0.43, 0.04, 0], rot: [0, 0, HALF_PI] });
        });
      });
      b.box('solid', [0.1, 0.03, 0.07], P.plastic, { at: [0.1, 0.015, 0.3], rot: [0, r() * TAU, 0] });
    } else { // a torso and an arm
      b.cyl('solid', 0.15, 0.12, 0.45, 4, P.plastic, { at: [0, 0.11, 0], rot: [0, 0, HALF_PI], pre: new THREE.Matrix4().makeRotationY(Math.PI / 4) });
      b.cyl('solid', 0.05, 0.05, 0.03, 6, P.joint, { at: [0.24, 0.11, 0], rot: [0, 0, HALF_PI] });
      arm(b, [-0.1, 0, 0.28], 0.2 + r() * 0.3, -0.6);
    }
  } },

  coins: { variants: 2, build(b, v) {
    const r = b.rand, H = 0.0024;
    let last = null;
    for (let i = 0; i < 7 + v * 2; i++) {
      let at;
      if (last && i % 4 === 3) at = [last[0] + (r() - 0.5) * 0.01, last[1] + H, last[2] + (r() - 0.5) * 0.01]; // stacked
      else { const a = r() * TAU, d = Math.sqrt(r()) * 0.28; at = [Math.cos(a) * d, H / 2, Math.sin(a) * d]; }
      b.cyl('shiny', 0.02, 0.02, H, 5, pick(r, P.coins), { at, rot: [0, r() * TAU, 0] });
      last = at;
    }
    if (v === 1) b.box('solid', [0.156, 0.001, 0.066], P.bill, { at: [-0.42, 0.0005, 0.05], rot: [0, 0.3 + r(), 0] });
  } },

  cassettes: { variants: 2, build(b, v) {
    const r = b.rand, n = 2 + v;
    for (let i = 0; i < n; i++) {
      cassette(b, [(i - (n - 1) / 2) * 0.16, 0, (r() - 0.5) * 0.12], r() * TAU, P.cassette[(i + v) % P.cassette.length], P.label[i % P.label.length]);
    }
    // Tape pulled out of the first one, snaking across the floor.
    const pieces = Array.from({ length: 5 }, () => ({ length: 0.12, width: 0.006, thickness: 0.001, color: P.ribbon }));
    strand(b, [-(n - 1) / 2 * 0.16 + 0.05, 0.05], r() * TAU, pieces, 1.2);
  } },

  brokenGlass: { variants: 2, build(b, v) {
    const r = b.rand;
    for (let i = 0; i < 8 + v * 4; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.32, cx = Math.cos(a) * d, cz = Math.sin(a) * d, size = 0.03 + r() * 0.06;
      const corners = [0, 1, 2].map((k) => {
        const ang = r() * 0.6 + k * TAU / 3, rr = size * (0.5 + r() * 0.7);
        return [cx + Math.cos(ang) * rr, cz + Math.sin(ang) * rr];
      });
      b.shard('glass', corners, 0.004, P.glass, { at: [0, i * 0.0004, 0] });
    }
    if (v === 1) b.box('shiny', [0.5, 0.02, 0.03], P.frame, { at: [0.05, 0.01, -0.36], rot: [0, 0.2, 0] });
  } },
};

export const DECOR_KINDS = Object.freeze(Object.keys(MODELS));
export const DECOR_MATERIALS = Object.freeze(Object.keys(decor.materials));

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function buildMaterial(name) {
  const cfg = decor.materials[name];
  const transparent = cfg.opacity !== undefined && cfg.opacity < 1;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: cfg.roughness, metalness: cfg.metalness,
    side: THREE.DoubleSide, // open buckets/boxes show their insides; tiny cost for clutter
    transparent, opacity: cfg.opacity ?? 1, depthWrite: !transparent,
  });
  if (cfg.polygonOffset) Object.assign(material, { polygonOffset: true, polygonOffsetFactor: cfg.polygonOffset, polygonOffsetUnits: cfg.polygonOffset });
  material.name = `decor_${name}`;
  return material;
}

export function createDecorKit() {
  const materials = Object.fromEntries(DECOR_MATERIALS.map((name) => [name, buildMaterial(name)]));
  const cache = new Map();

  function definition(kind) {
    if (typeof kind !== 'string' || !Object.hasOwn(MODELS, kind)) throw new Error(`Unknown decor kind "${kind}"`);
    return MODELS[kind];
  }

  function model(kind, variant = 0) {
    const def = definition(kind);
    if (!Number.isInteger(variant) || variant < 0 || variant >= def.variants) throw new Error(`${kind} has no variant ${variant}`);
    const key = `${kind}:${variant}`;
    if (!cache.has(key)) {
      const b = createBuilder(seededRandom((hashString(key) % 2147483645) + 1));
      def.build(b, variant);
      cache.set(key, { kind, variant, ...b.finish() });
    }
    return cache.get(key);
  }

  return {
    kinds: DECOR_KINDS,
    materials,
    model,
    variantsOf: (kind) => definition(kind).variants,
    dispose() {
      for (const m of cache.values()) m.parts.forEach((part) => part.geometry.dispose());
      cache.clear();
      Object.values(materials).forEach((material) => material.dispose());
    },
  };
}
