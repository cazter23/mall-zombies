// =============================================================================
// SUNNY, the Galleria's sun mascot, as a small low-poly plush (game/features/clawSunny.js walks him; his poster face is in
// world/posterTextures.js and mall/clawCabinet.js drawSunny). A round yellow body ringed with stubby rays, one staring eye, one
// button eye, a smile that's trying, and two little legs. Its feet are at the group's origin and it faces -Z (like a gun model).
// The rays are merged into one mesh, so he is a handful of draws. Only one exists at a time.
//
//   buildSunnyModel(size = 0.62) -> { root, legs: [left, right], body }   (dispose with disposeSunnyModel(root))
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const COLORS = { body: 0xffd23f, rays: 0xffb21a, eye: 0xffffff, pupil: 0x1d1626, button: 0x3a86ff, mouth: 0x8a3a1a, legs: 0xff8a2a, cheek: 0xff8fa8 };

export function buildSunnyModel(size = 0.62) {
  const s = size / 0.62; // (built at 0.62 m, scaled)
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  const root = new THREE.Group();
  root.name = 'sunny';
  const r = 0.21 * s;
  const cy = 0.36 * s; // the body's centre

  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), mat(COLORS.body));
  body.position.y = cy;
  root.add(body);

  // Twelve stubby rays in a ring round his face (in the XY plane, so they read from the front), merged into one mesh.
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const cone = new THREE.ConeGeometry(0.045 * s, 0.11 * s, 5);
    cone.translate(0, r + 0.04 * s, 0);
    cone.rotateZ(a);
    rays.push(cone);
  }
  const rayMesh = new THREE.Mesh(mergeGeometries(rays), mat(COLORS.rays));
  rays.forEach((g) => g.dispose());
  rayMesh.position.y = cy;
  root.add(rayMesh);

  // The face, on the front (-Z): a staring eye, a button eye, a crooked smile, cheeks.
  const front = -r * 0.92;
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05 * s, 10, 8), mat(COLORS.eye));
  eye.position.set(-0.07 * s, cy + 0.04 * s, front);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.016 * s, 8, 6), mat(COLORS.pupil));
  pupil.position.set(-0.07 * s, cy + 0.04 * s, front - 0.045 * s);
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.042 * s, 0.042 * s, 0.02 * s, 12), mat(COLORS.button));
  button.rotation.x = Math.PI / 2;
  button.position.set(0.075 * s, cy + 0.04 * s, front - 0.01 * s);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.075 * s, 0.012 * s, 6, 12, Math.PI * 0.8), mat(COLORS.mouth));
  mouth.rotation.set(0, Math.PI, Math.PI * 1.1); // a smile, not quite level
  mouth.position.set(0.005 * s, cy - 0.03 * s, front - 0.012 * s);
  root.add(eye, pupil, button, mouth);

  // Two little legs (they swing as he waddles).
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07 * s, 0.16 * s, 0.08 * s).translate(0, -0.08 * s, -0.01 * s), mat(COLORS.legs));
    leg.position.set(side * 0.08 * s, 0.16 * s, 0);
    root.add(leg);
    return leg;
  });
  return { root, legs, body };
}

/** Free a Sunny model's GPU memory (and take it out of the scene). */
export function disposeSunnyModel(root) {
  root.removeFromParent();
  root.traverse((o) => {
    o.geometry?.dispose?.();
    o.material?.dispose?.();
  });
}
