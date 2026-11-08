// =============================================================================
// MASCOT HEADS: the helmet each Mascot costume wears (config/zombies.js mascotVariants[id].head.kind).
// zombies/mascotModel.js makes the (empty) helmet group at head.helmet.at and calls HEADS[kind](head, group, kit)
// to fill it. Every mesh added to `group` is part of the head hitbox (the model unions their boxes), so keep the
// pieces close to the main block. Pieces stand >= 1 cm proud of the surface they sit on (no z-fighting).
//   kit.block(parent, color, size, at, tilt)          a coloured box (shared geometry, one material per colour)
//   kit.shape(parent, geometry, material, at, rotation, scale)   any other mesh (material: a colour or kit.material)
//   kit.decorate(parent, parts)                       blocks from a [{ color: name, size, at, tilt }] list
//   kit.material(params)                              a material of this model's own (freed with the model)
//   kit.colors                                        the costume's resolved colours, by name
// Geometry and canvas prints shared by every head of a kind are made once (sharedOnce) and never freed.
// A new head = one function here + its kind in a costume's `head`.
// =============================================================================

import * as THREE from 'three';

const shared = new Map();
function sharedOnce(key, make) {
  if (!shared.has(key)) shared.set(key, make());
  return shared.get(key);
}

// A rounded rectangle (centered), optionally with round holes ({ at: [x, y], radius }).
function roundedRect(width, height, radius, holes = []) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.absarc(x + width - radius, y + radius, radius, -Math.PI / 2, 0, false);
  shape.lineTo(x + width, y + height - radius);
  shape.absarc(x + width - radius, y + height - radius, radius, 0, Math.PI / 2, false);
  shape.lineTo(x + radius, y + height);
  shape.absarc(x + radius, y + height - radius, radius, Math.PI / 2, Math.PI, false);
  shape.lineTo(x, y + radius);
  shape.absarc(x + radius, y + radius, radius, Math.PI, Math.PI * 1.5, false);
  for (const hole of holes) {
    const path = new THREE.Path();
    path.absarc(hole.at[0], hole.at[1], hole.radius, 0, Math.PI * 2, true);
    shape.holes.push(path);
  }
  return shape;
}

// A print on a transparent canvas, drawn once (null without a DOM: headless tests that never stub one).
function canvasPrint(key, width, height, draw) {
  return sharedOnce(key, () => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  });
}

export const HEADS = {
  // Sir Waffles: a square waffle with a grid of toasted dents and a buttery cartoon face.
  waffle(head, group, { block, decorate, colors }) {
    block(group, head.color, head.helmet.size, [0, 0, 0]);
    const { grid } = head;
    for (const x of grid.centers) {
      for (const y of grid.rows) block(group, colors[grid.color], grid.size, [x, y, grid.z]);
    }
    decorate(group, head.face);
  },

  // Captain Coupon: a giant, tilted foam price tag (rounded card, punched hole, string loop) with SALE and a big "%"
  // printed on the front, and cartoon eyes over the print.
  priceTag(head, group, { shape, decorate, material, colors }) {
    const tag = new THREE.Group();
    tag.rotation.z = head.tilt;
    group.add(tag);
    const [width, height, depth] = head.helmet.size;
    const { bevel, cornerRadius, hole } = head;
    const card = sharedOnce('priceTag.card', () => {
      const outline = roundedRect(width - bevel * 2, height - bevel * 2, cornerRadius, [{ at: hole.at, radius: hole.radius + bevel }]);
      const geometry = new THREE.ExtrudeGeometry(outline, {
        depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10,
      });
      geometry.center();
      return geometry;
    });
    shape(tag, card, head.color);

    // The string loop through the hole, stretched front to back round the card's thickness.
    const { string } = head;
    const loop = sharedOnce('priceTag.loop', () => new THREE.TorusGeometry(string.radius, string.tube, 6, 20));
    shape(tag, loop, colors[string.color], [hole.at[0], hole.at[1] + string.radius - string.sink, 0], [0, Math.PI / 2, 0], [string.stretch, 1, 1]);

    // The print, just in front of the card's face (alpha-tested: the hole and the margins stay see-through).
    const { print } = head;
    const map = canvasPrint('priceTag.print', print.pixels[0], print.pixels[1], (ctx, w, h) => drawPriceTagPrint(ctx, w, h, head));
    if (map) {
      const plane = sharedOnce('priceTag.plane', () => new THREE.PlaneGeometry(print.size[0], print.size[1]));
      shape(tag, plane, material({ map, alphaTest: 0.5 }), [0, 0, -depth / 2 - print.lift], [0, Math.PI, 0]);
    }
    decorate(tag, head.face);
  },
};

// SALE across the top (clear of the hole), a dashed coupon border, and a big "%" for a mouth.
function drawPriceTagPrint(ctx, w, h, head) {
  const { print } = head;
  // Card metres -> canvas pixels. The plane is turned to face forward, so the card's +x is the canvas's left.
  const toX = (x) => (0.5 - x / print.size[0]) * w;
  const toY = (y) => (0.5 - y / print.size[1]) * h;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = print.ink;
  ctx.lineWidth = 9;
  ctx.setLineDash([26, 16]);
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.setLineDash([]);
  ctx.fillStyle = print.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `400 ${Math.round(h * 0.25)}px "Anton", Impact, sans-serif`;
  ctx.fillText(print.text, toX(print.textAt[0]), toY(print.textAt[1]), w * 0.55);
  ctx.font = `400 ${Math.round(h * 0.42)}px "Anton", Impact, sans-serif`;
  ctx.fillText(print.symbol, toX(print.symbolAt[0]), toY(print.symbolAt[1]));
}

/** Fill the (empty) helmet group with the costume's head. */
export function buildMascotHead(head, group, kit) {
  const build = HEADS[head.kind];
  if (!build) throw new Error(`mascot: no head of kind "${head.kind}"`);
  build(head, group, kit);
}
