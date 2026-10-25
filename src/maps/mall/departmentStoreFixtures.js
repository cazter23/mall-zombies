// =============================================================================
// HOFFMAN'S FIXTURES: the layout you fight in (positions and sizes in config/departmentStore.js).
//   front   cosmetics + fragrance glass counters (vaultable)
//   middle  six round clothing racks and three mannequins on plinths (weave through; never stand on)
//   back    the fitting rooms (zombies step out of the middle curtain), the shoe wall, the LAYAWAY counter (vaultable)
// The collision rule: counters are 0.95 m and vaultable; everything else is solid to tallMinHeight (2.1 m), because a jump
// from a counter top reaches about 2.0 m. Rack toppers are see-through colliders (bullets pass), like the glass railings.
// All of it is still and opaque, so the static batcher merges it (world/staticBatch.js); the map kit frees it on unload.
//
//   buildDepartmentFixtures({ kit, layout }) -> { fittingRoomSpawn: { x, z } }
// =============================================================================

import * as THREE from 'three';
import { seededRandom } from '../../world/textures.js';

const CHROME = 0xc9ccd1;
const GOLD = 0xc9a14a;
const CABINET = 0xf6efe4;
const BURGUNDY = 0x8c2f45;
const MANNEQUIN = 0xebe4d8;

export function buildDepartmentFixtures({ kit, layout: S }) {
  const { box, mat, sign, addCollider, group } = kit;
  const r = S.rect;
  const rand = seededRandom(1987);
  const deco = { collide: false };
  const tall = S.tallMinHeight;

  // A mesh from any geometry, placed and turned (decoration: no collider).
  const shape = (geometry, color, x, y, z, ry = 0, opts = {}) => {
    const mesh = new THREE.Mesh(geometry, opts.material ?? mat(color));
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    if (opts.rx) mesh.rotation.x = opts.rx;
    if (opts.rz) mesh.rotation.z = opts.rz;
    if (opts.name) mesh.name = opts.name;
    group.add(mesh);
    return mesh;
  };

  // --- Glass counters (cosmetics, fragrance, layaway) --------------------------------------------------------------------
  function counter({ x0, x1, z, name, glow, sides = CABINET, glass = true, register = false }) {
    const h = S.counterHeight;
    const d = S.counterDepth / 2;
    box(x0, 0, z - d, x1, h, z + d, mat(sides), { name: `deptstore_counter_${name}`, vaultable: true }); // (one vaultable collider)
    box(x0 - 0.02, 0, z - d - 0.02, x1 + 0.02, 0.1, z + d + 0.02, mat(BURGUNDY), deco); // kick plate
    box(x0 - 0.02, h - 0.04, z - d - 0.02, x1 + 0.02, h + 0.006, z + d + 0.02, mat(GOLD, { metalness: 0.6, roughness: 0.35 }), deco); // brass top (6 mm proud of the cabinet: no shared plane)
    if (glass) {
      // The case front: a lit panel of little bottles and compacts behind glass (the glass itself is the cabinet colour band).
      for (const side of [-1, 1]) {
        box(x0 + 0.08, 0.5, z + side * (d + 0.005), x1 - 0.08, 0.86, z + side * (d + 0.012), mat(glow, { emissive: glow, emissiveIntensity: 0.35 }), deco);
        for (let x = x0 + 0.2; x < x1 - 0.15; x += 0.22 + rand() * 0.1) {
          const hh = 0.08 + rand() * 0.12;
          const c = [0xffffff, GOLD, 0xe5989b, 0x2b2d42, 0xc1121f][Math.floor(rand() * 5)];
          box(x, 0.56, z + side * (d + 0.013), x + 0.08, 0.56 + hh, z + side * (d + 0.02), mat(c), deco);
        }
      }
    }
    if (register) {
      box(x1 - 0.55, h, z - 0.2, x1 - 0.1, h + 0.12, z + 0.2, mat(0x2b2d42), deco);
      box(x1 - 0.5, h + 0.12, z - 0.12, x1 - 0.15, h + 0.3, z - 0.08, mat(0x1d1626, { emissive: 0x63e6be, emissiveIntensity: 0.25 }), deco);
    }
    // A hanging name sign over it, readable from the gate side and from the back.
    for (const facing of [-1, 1]) {
      sign(name, { x: (x0 + x1) / 2, y: 3.2, z: z + facing * 0.01, width: Math.min(2.6, x1 - x0), height: 0.4, facing, background: '#8c2f45', color: '#f6e7c8' });
    }
    for (const x of [x0 + 0.3, x1 - 0.3]) box(x - 0.01, 3.4, z - 0.01, x + 0.01, S.height, z + 0.01, mat(CHROME), deco);
  }
  for (const c of S.counters) counter(c);
  counter({ ...S.layaway, name: 'LAYAWAY', glow: 0xffd6a5, sides: 0x6d2638, glass: false, register: true });

  // --- Mannequins on plinths ------------------------------------------------------------------------------------------
  const P = S.plinth;
  const limb = new THREE.CylinderGeometry(0.055, 0.045, 1, 6);
  const torsoGeo = new THREE.CylinderGeometry(0.17, 0.13, 0.55, 6);
  const hipGeo = new THREE.CylinderGeometry(0.15, 0.16, 0.2, 6);
  const headGeo = new THREE.IcosahedronGeometry(0.11, 0);
  const dressGeo = new THREE.CylinderGeometry(0.17, 0.3, 0.75, 6);
  const POSES = { // shoulder swing (forward, out) per arm in radians: [left, right]
    hip: [[0.2, 0.9], [0.1, -0.25]],
    wave: [[0.05, 0.25], [-0.2, -2.6]],
    point: [[0.1, 0.25], [1.4, -0.15]],
  };
  S.mannequins.forEach((m, i) => {
    const half = P.size / 2;
    box(m.x - half, 0, m.z - half, m.x + half, P.height, m.z + half, mat(0x2b2d42), { name: 'deptstore_plinth' });
    box(m.x - half - 0.02, P.height - 0.03, m.z - half - 0.02, m.x + half + 0.02, P.height + 0.006, m.z + half + 0.02, mat(GOLD), deco); // (6 mm proud)
    const b = P.body / 2;
    addCollider(m.x - b, P.height, m.z - b, m.x + b, tall, m.z + b); // the figure: nothing to stand on
    const fig = new THREE.Group();
    fig.position.set(m.x, P.height, m.z);
    fig.rotation.y = m.yaw;
    group.add(fig);
    const part = (geo, color, x, y, z, rx = 0, rz = 0, sy = 1) => {
      const mesh = new THREE.Mesh(geo, mat(color));
      mesh.position.set(x, y, z);
      mesh.rotation.set(rx, 0, rz);
      mesh.scale.y = sy;
      fig.add(mesh);
    };
    const outfit = S.rackColors[(i * 3 + 1) % S.rackColors.length];
    for (const s of [-1, 1]) part(limb, MANNEQUIN, s * 0.09, 0.42, 0, 0, s * 0.04, 0.84); // legs
    part(hipGeo, MANNEQUIN, 0, 0.9, 0);
    part(dressGeo, outfit, 0, 0.92, 0); // a shift dress over the hips
    part(torsoGeo, outfit, 0, 1.28, 0);
    part(limb, MANNEQUIN, 0, 1.62, 0, 0, 0, 0.14); // neck
    part(headGeo, MANNEQUIN, 0, 1.76, 0);
    POSES[m.pose].forEach(([forward, out], k) => {
      const s = k === 0 ? -1 : 1;
      const len = 0.62;
      // The arm hangs from the shoulder, swung forward and out (a big negative `out` raises it overhead)
      const dirX = s * Math.sin(out);
      const dirY = -Math.cos(forward) * Math.cos(out);
      const dirZ = Math.sin(forward);
      const mesh = new THREE.Mesh(limb, mat(MANNEQUIN));
      mesh.position.set(s * 0.21 + (dirX * len) / 2, 1.5 + (dirY * len) / 2, (dirZ * len) / 2);
      mesh.scale.y = len;
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dirX, dirY, dirZ).normalize());
      fig.add(mesh);
    });
    fig.updateMatrixWorld(true);
  });

  // --- Round clothing racks -------------------------------------------------------------------------------------------
  const R = S.rackRadius;
  const ring = new THREE.TorusGeometry(R - 0.08, 0.018, 4, 16);
  const pole = new THREE.CylinderGeometry(0.028, 0.028, 1, 6);
  const base = new THREE.CylinderGeometry(0.34, 0.38, 0.06, 8);
  const garment = new THREE.BoxGeometry(0.34, 0.78, 0.05);
  S.racks.forEach((k, i) => {
    addCollider(k.x - R, 0, k.z - R, k.x + R, S.rackHeight, k.z + R); // the clothes (stop bullets)
    addCollider(k.x - R, S.rackHeight, k.z - R, k.x + R, tall, k.z + R).ignoreShots = true; // the topper: nothing to stand on
    shape(base, CHROME, k.x, 0.03, k.z);
    shape(pole, CHROME, k.x, 1.05, k.z).scale.y = 2.0;
    shape(ring, CHROME, k.x, S.rackHeight - 0.05, k.z, 0, { rx: Math.PI / 2 });
    const colors = [S.rackColors[i % S.rackColors.length], S.rackColors[(i + 3) % S.rackColors.length]];
    const n = 14;
    for (let j = 0; j < n; j++) {
      if (rand() < 0.12) continue; // a few gaps: picked over
      const a = (j / n) * Math.PI * 2 + rand() * 0.08;
      const rr = R - 0.1;
      shape(garment, colors[j % 2], k.x + Math.cos(a) * rr, S.rackHeight - 0.45, k.z + Math.sin(a) * rr, -a + Math.PI / 2, { rz: (rand() - 0.5) * 0.08 });
    }
    // The topper: a SALE card on the pole
    box(k.x - 0.26, 1.82, k.z - 0.015, k.x + 0.26, 2.06, k.z + 0.015, mat(i % 2 ? 0xc1121f : BURGUNDY), deco);
  });

  // --- Fitting rooms (north-west corner): one solid block, three curtained booths facing south ------------------------
  const F = S.fittingRooms;
  const front = r.maxZ - F.depth;
  box(F.x0, 0, front, F.x1, F.height, r.maxZ, mat(CABINET), { name: 'deptstore_fitting_rooms' });
  const boothW = (F.x1 - F.x0) / F.booths;
  for (let b = 0; b < F.booths; b++) {
    const bx0 = F.x0 + b * boothW + 0.18;
    const bx1 = F.x0 + (b + 1) * boothW - 0.18;
    box(bx0, 0.12, front - 0.03, bx1, 2.05, front - 0.01, mat(F.curtain), deco); // curtain
    for (let x = bx0 + 0.12; x < bx1 - 0.05; x += 0.16) box(x, 0.12, front - 0.045, x + 0.05, 2.05, front - 0.03, mat(0x6d2638), deco); // folds
    box(bx0 - 0.05, 2.07, front - 0.06, bx1 + 0.05, 2.11, front - 0.01, mat(CHROME), deco); // rail
    box((bx0 + bx1) / 2 - 0.12, 2.18, front - 0.02, (bx0 + bx1) / 2 + 0.12, 2.32, front - 0.01, mat(GOLD), deco); // booth number plate
  }
  box(F.x0, F.height - 0.08, front - 0.06, F.x1, F.height, front, mat(GOLD), deco); // cornice
  sign('FITTING ROOMS', { x: (F.x0 + F.x1) / 2, y: 2.8, z: front - 0.02, width: 3.4, height: 0.45, facing: -1, background: '#8c2f45', color: '#f6e7c8' });

  // --- Shoe wall (east wall, north of the start room) ------------------------------------------------------------------
  const W = S.shoeWall;
  const wx = r.maxX - W.depth;
  box(wx, 0, W.z0, r.maxX, W.height, W.z1, mat(0x6d2638), { name: 'deptstore_shoe_wall' });
  for (const y of [0.35, 0.8, 1.25, 1.7]) {
    box(wx - 0.04, y - 0.03, W.z0 + 0.05, wx, y, W.z1 - 0.05, mat(GOLD), deco); // shelf lip
    for (let z = W.z0 + 0.2; z < W.z1 - 0.35; z += 0.42 + rand() * 0.1) {
      if (rand() < 0.25) continue; // sold out
      const c = [0xffffff, 0x2b2d42, 0xc1121f, 0xf4a259, 0x8c2f45][Math.floor(rand() * 5)];
      box(wx - 0.03, y, z, wx - 0.005, y + 0.11, z + 0.26, mat(c), deco); // a shoe, side on
    }
  }
  sign('SHOES', { x: wx - 0.02, y: 2.6, z: (W.z0 + W.z1) / 2, width: 2.2, height: 0.45, facing: 'x-', background: '#8c2f45', color: '#f6e7c8' });

  return { fittingRoomSpawn: { x: (F.x0 + F.x1) / 2, z: front - 0.8 } };
}
