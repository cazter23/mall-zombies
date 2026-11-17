// =============================================================================
// THE TEST RANGE'S LOOK (debug mode): the mall's STAFF TRAINING CENTER, a back-of-house warehouse. Painted concrete-block walls up to
// a ceiling, a yellow safety stripe at their foot, fluorescent strips overhead, cones and pallets, and staff signage (the signs
// themselves are painted by testRange.js's label() with the game's sign styles). Decoration only: no collision, no lights (the
// strips are unlit colour; the range is lit by the mall's sky lights and the range's one lamp), few draw calls (the strips and
// cones are one instanced draw each).
//
//   blockWallMaterial()          the walls' material: concrete blocks, 1 m of texture = 1 m of wall (use with worldUVs)
//   worldUVs(mesh)               rescale a box mesh's UVs to metres on every face (so one material suits walls of any size)
//   dressInterior({ group, rooms, ceilingHeight, stripes, cones, pallets, cx, cz })
//     rooms     [{ x0, x1, z0, z1 }] range-local rectangles the ceiling and strips cover
//     stripes   [{ x0, x1, z0, z1 }] range-local footprints of the yellow stripe pieces (thin, against a wall's inner face)
//     cones     [[x, z], ...]   pallets [[x, z, layers], ...]
// =============================================================================

import * as THREE from 'three';
import { seededRandom } from '../../world/textures.js';

export const BACK_OF_HOUSE = {
  ceilingHeight: 9.5, // metres: clear of your eyes on the 6.3 m balcony (6.3 + 1.6), and of its rails
  block: { width: 0.4, height: 0.2 }, // metres: one concrete block's face
  colors: { block: '#c9c3b6', mortar: '#9d968a', ceiling: 0x2b2e35, strip: 0xf3f7ff, stripHousing: 0x6d737c,
    stripe: 0xffd23f, cone: 0xff6a13, coneBand: 0xf4f4f4, pallet: 0xb48a57 },
  strip: { length: 2.4, width: 0.22, spacing: 6 }, // fluorescent strips: size and the grid they hang on
  stripeHeight: 0.14, // the yellow safety stripe at the foot of the walls
};

let blockTexture = null;

/** The concrete-block canvas: one metre of wall. Made once, shared. */
function makeBlockTexture() {
  if (blockTexture) return blockTexture;
  const C = BACK_OF_HOUSE.colors;
  const px = 256; // pixels per metre
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(19);
  const bw = BACK_OF_HOUSE.block.width * px;
  const bh = BACK_OF_HOUSE.block.height * px;
  ctx.fillStyle = C.mortar;
  ctx.fillRect(0, 0, px, px);
  for (let row = 0; row * bh < px; row++) {
    const offset = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < px + bw; x += bw) {
      const shade = Math.round((rand() - 0.5) * 14);
      ctx.fillStyle = C.block;
      ctx.fillRect(x + offset + 2, row * bh + 2, bw - 4, bh - 4);
      ctx.fillStyle = shade >= 0 ? `rgba(255,255,255,${shade / 100})` : `rgba(0,0,0,${-shade / 100})`;
      ctx.fillRect(x + offset + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  blockTexture = new THREE.CanvasTexture(canvas);
  blockTexture.colorSpace = THREE.SRGBColorSpace;
  blockTexture.wrapS = blockTexture.wrapT = THREE.RepeatWrapping;
  return blockTexture;
}

export function blockWallMaterial() {
  return new THREE.MeshStandardMaterial({ map: makeBlockTexture(), roughness: 0.9 });
}

/** Rescale a BoxGeometry mesh's UVs so 1 unit of texture = 1 metre on every face (faces: +x, -x, +y, -y, +z, -z; 4 vertices each). */
export function worldUVs(mesh) {
  const geometry = mesh.geometry;
  const { width: w, height: h, depth: d } = geometry.parameters;
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const uv = geometry.attributes.uv;
  for (let face = 0; face < 6; face++) {
    const [su, sv] = sizes[face];
    for (let i = face * 4; i < face * 4 + 4; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
  return mesh;
}

export function dressInterior({ group, rooms, stripes = [], cones = [], pallets = [], cx, cz }) {
  const B = BACK_OF_HOUSE;
  const C = B.colors;
  const root = new THREE.Group();
  root.name = 'staffTrainingCenter';
  group.add(root);
  const add = (mesh, name) => { mesh.name = name; root.add(mesh); return mesh; };

  // The ceiling: one slab over every room, and the fluorescent strips under it (one instanced draw).
  const ceiling = new THREE.MeshStandardMaterial({ color: C.ceiling, roughness: 1 });
  const stripSpots = [];
  for (const r of rooms) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(r.x1 - r.x0, 0.2, r.z1 - r.z0), ceiling);
    slab.position.set(cx + (r.x0 + r.x1) / 2, B.ceilingHeight + 0.1, cz + (r.z0 + r.z1) / 2);
    add(slab, 'trainingCeiling');
    for (let x = r.x0 + B.strip.spacing / 2; x < r.x1; x += B.strip.spacing) {
      for (let z = r.z0 + B.strip.spacing / 2; z < r.z1; z += B.strip.spacing) stripSpots.push([x, z]);
    }
  }
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(B.strip.width, 0.06, B.strip.length), new THREE.MeshBasicMaterial({ color: C.strip }), stripSpots.length);
  const form = new THREE.Object3D();
  stripSpots.forEach(([x, z], i) => {
    form.position.set(cx + x, B.ceilingHeight - 0.05, cz + z);
    form.updateMatrix();
    strips.setMatrixAt(i, form.matrix);
  });
  add(strips, 'trainingStrips');

  // The yellow safety stripe at the foot of the walls.
  const stripe = new THREE.MeshStandardMaterial({ color: C.stripe, roughness: 0.6 });
  for (const s of stripes) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.x1 - s.x0, B.stripeHeight, s.z1 - s.z0), stripe);
    mesh.position.set(cx + (s.x0 + s.x1) / 2, B.stripeHeight / 2 + 0.01, cz + (s.z0 + s.z1) / 2);
    add(mesh, 'trainingStripe');
  }

  // Cones (one instanced draw: an orange cone with a white band is two parts, so two draws) and pallets.
  if (cones.length) {
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.55, 10).translate(0, 0.3, 0), new THREE.MeshStandardMaterial({ color: C.cone, roughness: 0.6 }), cones.length);
    const band = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 0.08, 10).translate(0, 0.36, 0), new THREE.MeshStandardMaterial({ color: C.coneBand }), cones.length);
    const base = new THREE.InstancedMesh(new THREE.BoxGeometry(0.4, 0.04, 0.4).translate(0, 0.02, 0), new THREE.MeshStandardMaterial({ color: C.cone, roughness: 0.6 }), cones.length);
    cones.forEach(([x, z], i) => {
      form.position.set(cx + x, 0, cz + z);
      form.updateMatrix();
      for (const m of [cone, band, base]) m.setMatrixAt(i, form.matrix);
    });
    add(cone, 'trainingCones');
    add(band, 'trainingConeBands');
    add(base, 'trainingConeBases');
  }
  const pallet = new THREE.MeshStandardMaterial({ color: C.pallet, roughness: 0.9 });
  for (const [x, z, layers = 1] of pallets) {
    for (let k = 0; k < layers; k++) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.14, 1.0), pallet);
      mesh.position.set(cx + x, 0.07 + k * 0.15, cz + z);
      mesh.rotation.y = (k % 2) * 0.08;
      add(mesh, 'trainingPallet');
    }
  }
  return root;
}
