// =============================================================================
// CART MODEL (Cart Pusher): a low-poly shopping cart, visual only (no collider, no hitbox: shots go through the
// wire basket to the zombie behind it). Built from type.cart (config/zombies.js) in front of the zombie's feet
// (its -Z), with the handle where the hands grip it. Boxes of one material are merged into one mesh.
//
//   buildCart(cfg, mat, random) -> THREE.Group   (mat(color) = the zombie's own per-zombie material cache)
//
// The zombie model poses it (rattle, tip on a crash) by turning the returned group.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1);

export function buildCart(cfg, mat, random = Math.random) {
  const pieces = new Map(); // material -> [geometry]
  const add = (material, w, h, d, x, y, z, rotation = null) => {
    const g = unitBox.clone();
    g.scale(w, h, d);
    if (rotation) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    g.translate(x, y, z);
    if (!pieces.has(material)) pieces.set(material, []);
    pieces.get(material).push(g);
  };
  const frame = mat(cfg.frameColor);
  const bar = 0.02;
  const w = cfg.width;
  const back = cfg.handleZ - 0.06; // the basket starts just in front of the handle...
  const front = back - cfg.depth; // ...and ends here (the nose)
  const bottom = cfg.basketBottom;
  const top = cfg.basketTop;
  const midZ = (back + front) / 2;

  // Basket: floor, top rails, and wire bars on all four sides.
  add(frame, w, bar, cfg.depth, 0, bottom, midZ);
  for (const y of [bottom, (bottom + top) / 2, top]) {
    for (const side of [-1, 1]) add(frame, bar, bar, cfg.depth, side * w / 2, y, midZ); // side rails
    add(frame, w, bar, bar, 0, y, front); // front rail
    add(frame, w, bar, bar, 0, y, back); // back rail
  }
  const bars = 6;
  for (let i = 0; i <= bars; i++) {
    const z = back - (cfg.depth * i) / bars;
    for (const side of [-1, 1]) add(frame, bar, top - bottom, bar, side * w / 2, (top + bottom) / 2, z);
  }
  for (let i = 1; i < 5; i++) {
    const x = -w / 2 + (w * i) / 5;
    add(frame, bar, top - bottom, bar, x, (top + bottom) / 2, front);
    add(frame, bar, top - bottom, bar, x, (top + bottom) / 2, back);
  }

  // Chassis: two rails from the handle down to the casters, a lower tray, four wheels.
  const wheelY = 0.05;
  const legs = [back + 0.02, front + 0.06];
  for (const side of [-1, 1]) {
    const x = side * (w / 2 - 0.04);
    add(frame, bar * 1.5, bottom - wheelY, bar * 1.5, x, (bottom + wheelY) / 2, legs[0]);
    add(frame, bar * 1.5, bottom - wheelY, bar * 1.5, x, (bottom + wheelY) / 2, legs[1]);
    add(frame, bar * 1.5, bar * 1.5, legs[0] - legs[1], x, 0.16, (legs[0] + legs[1]) / 2); // tray rail
    add(frame, bar * 1.5, cfg.handleY - top, bar * 1.5, side * w / 2, (cfg.handleY + top) / 2, cfg.handleZ); // handle post
    for (const z of legs) add(mat(cfg.wheelColor), 0.05, 0.1, 0.1, x, wheelY, z);
  }
  add(frame, w - 0.08, bar, legs[0] - legs[1], 0, 0.16, (legs[0] + legs[1]) / 2); // lower tray
  add(mat(cfg.bumperColor), w + 0.03, 0.06, 0.04, 0, bottom + 0.04, front - 0.01); // nose bumper
  add(mat(cfg.handleColor), w + 0.06, 0.045, 0.045, 0, cfg.handleY, cfg.handleZ); // handle grip

  // A few boxes of shopping rattling around inside.
  const [minN, maxN] = cfg.contentsCount;
  const n = minN + Math.floor(random() * (maxN - minN + 1));
  for (let i = 0; i < n; i++) {
    const color = cfg.contents[Math.floor(random() * cfg.contents.length) % cfg.contents.length];
    const bw = 0.14 + random() * 0.12;
    const bh = 0.1 + random() * 0.14;
    const bx = (random() - 0.5) * (w - bw - 0.06);
    const bz = midZ + (random() - 0.5) * (cfg.depth - 0.25);
    add(mat(color), bw, bh, 0.12 + random() * 0.1, bx, bottom + bar / 2 + bh / 2, bz);
  }

  // A fixed heap (cfg.heap: Lorraine's returns, config/lastCustomerLook.js): { color, size, at, rotation? } each.
  for (const item of cfg.heap ?? []) add(mat(item.color), ...item.size, ...item.at, item.rotation);

  const group = new THREE.Group();
  group.name = 'cart';
  const geometries = [];
  for (const [material, list] of pieces) {
    const geometry = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    geometries.push(geometry);
    group.add(new THREE.Mesh(geometry, material));
  }
  group.userData.geometries = geometries; // owned: the zombie model disposes them
  group.userData.noseZ = front;
  return group;
}
