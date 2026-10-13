// =============================================================================
// MALL PROPS
// Reusable mall furniture built with the map kit (world/mapKit.js):
//   shopFront   a decorative shop facade on a wall (colored front, dark window, sign)
//   pillar      a full-height pillar with a wider base (one solid collider)
//   bench       a low bench you can jump onto or vault over
//   planter     a planter box with a bush or a small tree
//   lightPanel  a glowing ceiling light panel (or a dead one)
//   gondola     a double-sided store shelf stocked with product boxes (Mega Mart)
//   checkout    a vaultable checkout counter with belt, register and lane light
//   wallDoor    a painted-on service / exit door with an optional sign
//   boardedVent planks over a vent (zombie spawn dressing)
//   wallStripe  a painted stripe along a wall
// createMallProps(kit) returns these as functions; maps/mall/mall.js places them.
// =============================================================================

import * as THREE from 'three';
import { COLORS } from './palette.js';
import { seededRandom } from '../../world/textures.js';

export function createMallProps(kit) {
  const { box, mat, sign, addCollider, group } = kit;

  /**
   * A shop facade on a wall (decorative, not enterable).
   *   along:   'x' (the wall runs along X, like the concourse's long walls) or 'z' (a side wall)
   *   from/to: the shop's extent along the wall
   *   wallAt:  the wall's inner face (z for along 'x', x for along 'z')
   *   facing:  +1 or -1, the direction the shop front faces (into the room)
   */
  function shopFront({ along = 'x', from, to, wallAt, facing, color, text, textColor }) {
    const d = (offset) => wallAt + facing * offset; // depth out from the wall
    const depth = (a, b) => [Math.min(d(a), d(b)), Math.max(d(a), d(b))];
    // A box from u0..u1 along the wall, y0..y1 high, a..b out from the wall.
    const place = (u0, y0, u1, y1, [a, b], material, options) => (along === 'x'
      ? box(u0, y0, a, u1, y1, b, material, options)
      : box(a, y0, u0, b, y1, u1, material, options));

    // Colored facade
    place(from, 0, to, 4.7, depth(0, 0.12), mat(color), { collide: false, name: `shop_${text}` });
    // Dark glass window
    place(from + 0.6, 0.35, to - 0.6, 3.15, depth(0.12, 0.15), mat(COLORS.glass, { roughness: 0.15, metalness: 0.3 }), { collide: false });
    // Window frame mullions
    const frame = mat(COLORS.shopFrame);
    for (let i = 1; i < 3; i++) {
      const u = from + 0.6 + ((to - from - 1.2) * i) / 3;
      place(u - 0.05, 0.35, u + 0.05, 3.15, depth(0.15, 0.18), frame, { collide: false });
    }
    // Sign band
    const mid = (from + to) / 2;
    sign(text, {
      ...(along === 'x' ? { x: mid, z: d(0.14), facing } : { x: d(0.14), z: mid, facing: facing > 0 ? 'x+' : 'x-' }),
      y: 3.9, width: to - from - 1, height: 0.85,
      background: '#1f1a24', color: textColor,
    });
  }

  /** A full-height pillar centered at (x, z). The collider includes the wider base. */
  function pillar(x, z, height) {
    box(x - 0.4, 0.3, z - 0.4, x + 0.4, height, z + 0.4, mat(COLORS.pillar), { collide: false, name: 'pillar' });
    box(x - 0.45, 0, z - 0.45, x + 0.45, 0.3, z + 0.45, mat(COLORS.pillarBase), { collide: false });
    addCollider(x - 0.45, 0, z - 0.45, x + 0.45, height, z + 0.45);
  }

  /** A bench: low enough (0.45m) to jump onto, and marked vaultable. */
  function bench(x0, z0, x1, z1) {
    const legs = mat(COLORS.metal);
    const alongX = x1 - x0 > z1 - z0;
    if (alongX) {
      box(x0 + 0.1, 0, z0 + 0.05, x0 + 0.25, 0.38, z1 - 0.05, legs, { collide: false });
      box(x1 - 0.25, 0, z0 + 0.05, x1 - 0.1, 0.38, z1 - 0.05, legs, { collide: false });
    } else {
      box(x0 + 0.05, 0, z0 + 0.1, x1 - 0.05, 0.38, z0 + 0.25, legs, { collide: false });
      box(x0 + 0.05, 0, z1 - 0.25, x1 - 0.05, 0.38, z1 - 0.1, legs, { collide: false });
    }
    box(x0, 0.38, z0, x1, 0.45, z1, mat(COLORS.wood), { collide: false, name: 'bench' });
    addCollider(x0, 0, z0, x1, 0.45, z1).vaultable = true;
  }

  /** A planter box (0.6m) with low-poly greenery: a bush, or a tree with { tree: true }. */
  function planter(x0, z0, x1, z1, { tree = false } = {}) {
    const h = 0.6;
    box(x0, 0, z0, x1, h, z1, mat(COLORS.planter), { name: 'planter' });
    box(x0 + 0.12, h, z0 + 0.12, x1 - 0.12, h + 0.02, z1 - 0.12, mat(COLORS.soil), { collide: false });
    const cx = (x0 + x1) / 2;
    const cz = (z0 + z1) / 2;
    if (tree) {
      box(cx - 0.15, h, cz - 0.15, cx + 0.15, h + 2.1, cz + 0.15, mat(COLORS.woodDark), { name: 'tree_trunk' });
      const foliage = new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 0), mat(COLORS.leaves));
      foliage.position.set(cx, h + 2.9, cz);
      group.add(foliage);
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat(COLORS.leavesDark));
      top.position.set(cx + 0.3, h + 3.7, cz - 0.2);
      group.add(top);
    } else {
      const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(COLORS.leaves));
      bush.position.set(cx, h + 0.35, cz);
      bush.scale.y = 0.8;
      group.add(bush);
    }
  }

  /** A ceiling light panel spanning x0..x1 / z0..z1, just under a ceiling at `ceilingY`. */
  function lightPanel(x0, z0, x1, z1, ceilingY, { dead = false } = {}) {
    const material = dead
      ? mat(COLORS.deadLightPanel)
      : mat(COLORS.lightPanel, { emissive: COLORS.lightPanel, emissiveIntensity: 0.9 });
    box(x0, ceilingY - 0.06, z0, x1, ceilingY, z1, material, { collide: false });
  }

  // --- Big-box store props (Mega Mart) ----------------------------------------

  // Maps a position along a wall + depth out of it to x/z, for props that can sit on either kind of
  // wall: along 'x' -> (u, depth) = (x, z); along 'z' -> (u, depth) = (z, x).
  function wallPlacer(along) {
    return (u0, y0, u1, y1, a, b, material, options) => (along === 'x'
      ? box(u0, y0, Math.min(a, b), u1, y1, Math.max(a, b), material, options)
      : box(Math.min(a, b), y0, u0, Math.max(a, b), y1, u1, material, options));
  }

  /**
   * A double-sided shelving unit ("gondola") stocked with product boxes. One solid collider
   * (blocks walking, sight and bullets). Runs along its longer side. Products are one
   * InstancedMesh per gondola (hundreds of boxes, one draw call); `seed` keeps the stock the
   * same every load; about `looted` of the slots are empty.
   */
  function gondola(x0, z0, x1, z1, { height = 2.0, seed = 1, looted = 0.12 } = {}) {
    addCollider(x0, 0, z0, x1, height, z1);
    const alongX = x1 - x0 >= z1 - z0;
    // Work in (u = along the gondola, w = across it) and map back to (x, z).
    const [u0, u1, w0, w1] = alongX ? [x0, x1, z0, z1] : [z0, z1, x0, x1];
    const wMid = (w0 + w1) / 2;
    const put = (a0, y0, a1, y1, b0, b1, material) => (alongX
      ? box(a0, y0, b0, a1, y1, b1, material, { collide: false })
      : box(b0, y0, a0, b1, y1, a1, material, { collide: false }));

    put(u0, 0, u1, 0.12, w0, w1, mat(COLORS.gondolaBase)); // base / kick plate
    put(u0, 0.12, u1, height, wMid - 0.03, wMid + 0.03, mat(COLORS.gondolaPanel)); // center spine
    put(u0, height - 0.04, u1, height, w0 + 0.05, w1 - 0.05, mat(COLORS.gondolaShelf)); // top cap
    const levels = [0.12, 0.62, 1.12, 1.62]; // shelf tops (the base is the bottom shelf)
    for (const y of levels.slice(1)) {
      put(u0 + 0.02, y - 0.03, u1 - 0.02, y, w0, wMid - 0.03, mat(COLORS.gondolaShelf));
      put(u0 + 0.02, y - 0.03, u1 - 0.02, y, wMid + 0.03, w1, mat(COLORS.gondolaShelf));
    }

    // Product boxes on every shelf, both faces.
    const rand = seededRandom(seed);
    const items = [];
    for (const side of [-1, 1]) {
      const face = side < 0 ? w0 : w1; // the shelf's open edge on this side
      for (const y of levels) {
        let u = u0 + 0.06;
        while (u < u1 - 0.3) {
          const width = 0.22 + rand() * 0.2;
          if (u + width > u1 - 0.06) break;
          if (rand() > looted) {
            const h = 0.18 + rand() * 0.24;
            const depth = 0.24 + rand() * 0.12;
            items.push({ u: u + width / 2, y: y + h / 2, w: face - side * (0.03 + depth / 2), width, h, depth, color: COLORS.products[Math.floor(rand() * COLORS.products.length)] });
          }
          u += width + 0.02 + rand() * 0.05;
        }
      }
    }
    const products = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }),
      items.length,
    );
    products.name = 'products';
    const m = new THREE.Matrix4();
    const color = new THREE.Color();
    items.forEach((it, i) => {
      if (alongX) m.makeScale(it.width, it.h, it.depth).setPosition(it.u, it.y, it.w);
      else m.makeScale(it.depth, it.h, it.width).setPosition(it.w, it.y, it.u);
      products.setMatrixAt(i, m);
      products.setColorAt(i, color.setHex(it.color));
    });
    group.add(products);
  }

  /**
   * A checkout counter running along X (vaultable across its short side, like the start room's
   * counter) with a belt, a register at the +X end and a numbered lane light.
   */
  function checkout(x0, z0, x1, z1, lane) {
    box(x0, 0, z0, x1, 0.95, z1, mat(COLORS.checkoutBody), { name: 'checkout', vaultable: true });
    box(x0 - 0.04, 0.95, z0 - 0.04, x1 + 0.04, 1.0, z1 + 0.04, mat(COLORS.checkoutTop), { collide: false });
    box(x0 + 0.1, 1.0, z0 + 0.15, x1 - 0.7, 1.015, z1 - 0.15, mat(COLORS.checkoutBelt), { collide: false });
    // Register + screen (decorative: the vault only checks colliders)
    box(x1 - 0.55, 1.0, z0 + 0.2, x1 - 0.13, 1.28, z1 - 0.2, mat(COLORS.register), { collide: false });
    box(x1 - 0.5, 1.28, z0 + 0.3, x1 - 0.42, 1.48, z1 - 0.3, mat(COLORS.registerScreen, { emissive: COLORS.registerScreen, emissiveIntensity: 0.6 }), { collide: false });
    // Lane light: a thin pole with the lane number on top, readable from both sides.
    const px = x1 - 0.08;
    const pz = (z0 + z1) / 2;
    box(px - 0.03, 1.0, pz - 0.03, px + 0.03, 2.3, pz + 0.03, mat(COLORS.metal), { collide: false });
    for (const facing of [1, -1]) {
      sign(String(lane), {
        x: px, y: 2.48, z: pz + facing * 0.04, width: 0.32, height: 0.32, facing,
        background: '#1d4e89', color: '#ffd23f',
      });
    }
  }

  /**
   * A (closed, decorative) door on a wall: a service door, double doors, or an exit, with a small
   * window per leaf and an optional sign above. Not solid: it's painted on the wall.
   *   along/wallAt/facing as for shopFront; `center` = middle of the door along the wall.
   */
  function wallDoor({ along, center, wallAt, facing, width = 1.6, height = 2.2, leaves = 2, color, label, labelColor = '#ffffff', labelBackground = '#2b2b2b' }) {
    const place = wallPlacer(along);
    const d = (offset) => wallAt + facing * offset;
    const half = width / 2;
    const leafW = width / leaves;
    place(center - half - 0.08, 0, center + half + 0.08, height + 0.08, d(0), d(0.04), mat(COLORS.shopFrame), { collide: false }); // frame
    for (let i = 0; i < leaves; i++) {
      const a = center - half + i * leafW;
      place(a + 0.02, 0, a + leafW - 0.02, height, d(0.04), d(0.08), mat(color), { collide: false });
      const wc = a + leafW / 2;
      place(wc - 0.12, height * 0.62, wc + 0.12, height * 0.8, d(0.08), d(0.09), mat(COLORS.doorWindow, { roughness: 0.2 }), { collide: false });
    }
    if (label) {
      sign(label, {
        ...(along === 'x' ? { x: center, z: d(0.1), facing } : { x: d(0.1), z: center, facing: facing > 0 ? 'x+' : 'x-' }),
        y: height + 0.35, width: Math.max(width, 1.8), height: 0.36,
        background: labelBackground, color: labelColor,
      });
    }
  }

  /** A boarded-up vent low on a wall (where zombies crawl in). Decorative. */
  function boardedVent({ along, center, wallAt, facing, width = 1.4 }) {
    const place = wallPlacer(along);
    for (const y of [0.45, 0.8, 1.15]) {
      place(center - width / 2, y, center + width / 2, y + 0.2, wallAt, wallAt + facing * 0.06, mat(COLORS.plank), { collide: false });
    }
  }

  /** A painted stripe along a wall's inner face (decorative), from..to along the wall, y0..y1 high. */
  function wallStripe({ along, from, to, wallAt, facing, y0, y1, color }) {
    wallPlacer(along)(from, y0, to, y1, wallAt, wallAt + facing * 0.02, mat(color), { collide: false });
  }

  return { shopFront, pillar, bench, planter, lightPanel, gondola, checkout, wallDoor, boardedVent, wallStripe };
}
