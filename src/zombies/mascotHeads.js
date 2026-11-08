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

  // Poppy Corn: a tapered red-and-white striped popcorn bucket with a red rim, lumpy puffs heaped on top and a face
  // that follows the bucket's curve.
  popcornBucket(head, group, { block, shape, colors }) {
    const { radiusTop, radiusBottom, segments, stripes, rim, puffs } = head;
    const height = head.helmet.size[1];
    const radiusAt = (y) => radiusBottom + (radiusTop - radiusBottom) * (y / height + 0.5);
    const lean = Math.atan((radiusTop - radiusBottom) / height); // the side faces this far down

    const bucket = sharedOnce('popcornBucket.bucket', () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments));
    shape(group, bucket, head.color);
    // Each red band is a thin open slice of a slightly bigger bucket; the front middle is white (the mouth sits there).
    const band = Math.PI / stripes.count; // (count red + count white bands round the bucket)
    const stripe = sharedOnce('popcornBucket.stripe', () => new THREE.CylinderGeometry(
      radiusTop + stripes.proud, radiusBottom + stripes.proud, height, 2, 1, true, band / 2, band));
    for (let i = 0; i < stripes.count; i++) shape(group, stripe, colors[stripes.color], [0, 0, 0], [0, i * band * 2, 0]);
    const rimGeometry = sharedOnce('popcornBucket.rim', () => {
      const top = radiusTop + rim.proud;
      return new THREE.CylinderGeometry(top, top - (radiusTop - radiusBottom) * (rim.height / height), rim.height, segments, 1, true);
    });
    shape(group, rimGeometry, colors[rim.color], [0, height / 2 - rim.height / 2, 0]);

    const puff = sharedOnce('popcornBucket.puff', () => new THREE.IcosahedronGeometry(1, 0));
    puffs.pieces.forEach(([x, y, z, size, buttered], i) => {
      shape(group, puff, colors[buttered ? puffs.buttered : puffs.color], [x, y, z], [i * 1.3, i * 0.7, i * 2.1], [size, size * 0.85, size]);
    });

    // Flat face pieces turned to sit tangent to the curve (and tipped down with the bucket's taper).
    for (const { color, size, at: [x, y], proud = 0.01, tilt = 0 } of head.face) {
      const distance = radiusAt(y) + stripes.proud + proud + size[2] / 2;
      const around = Math.asin(x / distance);
      const piece = block(group, colors[color], size, [Math.sin(around) * distance, y, -Math.cos(around) * distance], tilt);
      faceAlong(piece, Math.sin(around), Math.sin(-lean), -Math.cos(around));
    }
  },

  // Scoops: a strawberry scoop in a short, wide waffle cone (faceted, two darker bands), drips running over the rim,
  // sprinkles, a cherry, and a face on the scoop.
  iceCreamCone(head, group, { block, shape, colors }) {
    const { cone, scoop, drips, sprinkles, cherry } = head;
    const coneGeometry = sharedOnce('iceCreamCone.cone', () => {
      const geometry = new THREE.CylinderGeometry(cone.radiusTop, cone.radiusBottom, cone.height, cone.segments).toNonIndexed();
      geometry.computeVertexNormals(); // (flat facets: it reads as waffle)
      return geometry;
    });
    shape(group, coneGeometry, colors[cone.color], [0, cone.y, 0]);
    const { bands } = cone;
    const slope = (cone.radiusTop - cone.radiusBottom) / cone.height;
    for (let i = 0; i < bands.count; i++) {
      const y = cone.height * ((i + 1) / (bands.count + 1) - 0.5); // (in the cone's own space)
      const radius = cone.radiusBottom + slope * (y + cone.height / 2) + bands.proud;
      const band = sharedOnce(`iceCreamCone.band${i}`, () => new THREE.CylinderGeometry(
        radius + (slope * bands.height) / 2, radius - (slope * bands.height) / 2, bands.height, cone.segments, 1, true));
      shape(group, band, colors[bands.color], [0, cone.y + y, 0]);
    }

    const ball = sharedOnce('iceCreamCone.scoop', () => new THREE.IcosahedronGeometry(scoop.radius, 2));
    shape(group, ball, head.color, [0, scoop.y, 0]);
    const rim = cone.y + cone.height / 2;
    const drip = sharedOnce('iceCreamCone.drip', () => new THREE.IcosahedronGeometry(1, 1));
    for (const [angle, length] of drips.pieces) {
      const r = cone.radiusTop + 0.01; // (angle 0 = the front, -z)
      shape(group, drip, colors[drips.color], [Math.sin(angle) * r, rim - length * 0.4, -Math.cos(angle) * r], [0, -angle, 0], [drips.width, length, drips.width]);
    }
    // Sprinkles and the face: placed on the scoop's surface, along the line out from its centre.
    const onScoop = (x, y, z, out) => {
      const length = Math.hypot(x, y - scoop.y, z) || 1;
      const k = (scoop.radius + out) / length;
      return [x * k, scoop.y + (y - scoop.y) * k, z * k];
    };
    sprinkles.pieces.forEach(([x, y, z, color], i) => {
      const piece = block(group, colors[color], sprinkles.size, onScoop(x, y, z, sprinkles.size[1] / 2), i * 0.7);
      piece.rotation.y = i * 1.1;
    });
    const cherryGeometry = sharedOnce('iceCreamCone.cherry', () => new THREE.IcosahedronGeometry(cherry.radius, 1));
    shape(group, cherryGeometry, colors[cherry.color], [0, cherry.y, 0]);
    for (const { color, size, at: [x, y], proud = 0.01, tilt = 0 } of head.face) {
      const up = y - scoop.y;
      const z = -Math.sqrt(Math.max(0, scoop.radius ** 2 - x * x - up * up));
      const [px, py, pz] = onScoop(x, y, z, proud + size[2] / 2);
      const piece = block(group, colors[color], size, [px, py, pz], tilt);
      faceAlong(piece, x / scoop.radius, up / scoop.radius, z / scoop.radius);
    }
  },
};

// Turn a block so its front (-z) points along the outward normal (nx, ny, nz) of the surface it sits on.
function faceAlong(piece, nx, ny, nz) {
  piece.rotation.order = 'YXZ';
  piece.rotation.y = Math.atan2(-nx, -nz);
  piece.rotation.x = Math.asin(Math.max(-1, Math.min(1, ny)));
}

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
  ctx.font = `400 ${Math.round(h * print.textSize)}px "Anton", Impact, sans-serif`;
  ctx.fillText(print.text, toX(print.textAt[0]), toY(print.textAt[1]), w * 0.55);
  ctx.font = `400 ${Math.round(h * print.symbolSize)}px "Anton", Impact, sans-serif`;
  ctx.fillText(print.symbol, toX(print.symbolAt[0]), toY(print.symbolAt[1]));
}

// Employee of the Month's name badge (config/zombies.js mascotGold.badge): a card on the chest with its print in front.
export function buildMascotBadge(badge, parent, { block, shape, material, colors }) {
  const group = new THREE.Group();
  group.name = 'mascotBadge';
  group.position.set(...badge.at);
  parent.add(group);
  block(group, colors[badge.color], badge.size, [0, 0, 0]);
  const { print } = badge;
  const map = canvasPrint('badge.print', print.pixels[0], print.pixels[1], (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = print.star;
    ctx.fillRect(0, 0, w, h * 0.16); // a gold band across the top
    ctx.fillStyle = print.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(h * 0.3)}px "Space Grotesk", Arial, sans-serif`;
    ctx.fillText(print.lines[0], w / 2, h * 0.42, w * 0.9);
    ctx.font = `700 ${Math.round(h * 0.2)}px "Space Grotesk", Arial, sans-serif`;
    ctx.fillText(print.lines[1], w / 2, h * 0.74, w * 0.9);
  });
  if (!map) return;
  const plane = sharedOnce('badge.plane', () => new THREE.PlaneGeometry(badge.size[0], badge.size[1]));
  shape(group, plane, material({ map, alphaTest: 0.5 }), [0, 0, -badge.size[2] / 2 - print.lift], [0, Math.PI, 0]);
}

/** Fill the (empty) helmet group with the costume's head. */
export function buildMascotHead(head, group, kit) {
  const build = HEADS[head.kind];
  if (!build) throw new Error(`mascot: no head of kind "${head.kind}"`);
  build(head, group, kit);
}
