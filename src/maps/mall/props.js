// =============================================================================
// MALL PROPS
// Reusable mall furniture built with the map kit (world/mapKit.js):
//   shopFront   a decorative shop facade on a wall (colored front, dark window, sign)
//   pillar      a full-height pillar with a wider base (one solid collider)
//   bench       a low bench you can jump onto or vault over
//   planter     a planter box with a bush or a small tree
//   lightPanel  a glowing ceiling light panel (or a dead one)
// createMallProps(kit) returns these as functions; maps/mall/mall.js places them.
// =============================================================================

import * as THREE from 'three';
import { COLORS } from './palette.js';

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

  return { shopFront, pillar, bench, planter, lightPanel };
}
