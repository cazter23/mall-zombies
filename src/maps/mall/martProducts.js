// Small low-poly stock models, built at the origin with their feet on y=0. The stock arranger
// fits each whole product to its shelf cell before batching it; none of these add collision.
import * as THREE from 'three';

export const MART_PRODUCTS = {
  outdoor: ['charcoal', 'cooler', 'sleepingMat', 'lantern', 'thermos', 'foldingChair', 'tackleBox', 'stackedCoolers'],
  snacks: ['cereal', 'can', 'crisps', 'biscuits', 'sodaPack', 'jar', 'noodleCup'],
  holidays: ['pumpkin', 'gift', 'egg', 'wreath', 'candyCane', 'halloweenBucket', 'giftWrap', 'chocolateBunny'],
  housewares: ['detergent', 'paperTowels', 'buckets', 'sprayBottle', 'dishSoap', 'tissues', 'towels', 'pan'],
};

export function buildMartProduct(id, mat) {
  const root = new THREE.Group(); root.name = id;
  const cream = mat(0xeee5ca), steel = mat(0x78868b), dark = mat(0x354044);
  const red = mat(0xc95045), blue = mat(0x4479a6), green = mat(0x638363);
  const yellow = mat(0xe8bd56), orange = mat(0xd68138), pink = mat(0xc8a4c5);
  const brown = mat(0x72503a);
  const add = (geometry, material, x, y, z, rotation = [0, 0, 0]) => {
    // Polyhedra are non-indexed in Three.js; boxes/cylinders are indexed. Normalise here so
    // products sharing a material can all merge into the same draw call.
    if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z); mesh.rotation.set(...rotation); root.add(mesh); return mesh;
  };
  const box = (x, y, z, w, h, d, m, rotation) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rotation);
  const cyl = (x, y, z, r, h, m, top = r, rotation) => add(new THREE.CylinderGeometry(top, r, h, 8), m, x, y, z, rotation);
  const ball = (x, y, z, r, m) => add(new THREE.IcosahedronGeometry(r, 1), m, x, y, z);
  const ring = (x, y, z, r, tube, m, rotation, arc = Math.PI * 2) =>
    add(new THREE.TorusGeometry(r, tube, 4, 12, arc), m, x, y, z, rotation);
  // Front labels on both faces, so a product reads from either aisle direction.
  const label = (y, w = 0.15, h = 0.13, depth = 0.122) => {
    for (const side of [-1, 1]) box(side * depth, y, 0, 0.008, h, w, cream);
  };
  const cooler = (base, color) => {
    box(0, base + 0.075, 0, 0.24, 0.15, 0.31, color);
    box(0, base + 0.165, 0, 0.27, 0.03, 0.34, cream);
    for (const side of [-1, 1]) box(side * 0.13, base + 0.09, 0, 0.025, 0.045, 0.09, dark);
  };
  const bucket = (base, r, color) => {
    add(new THREE.CylinderGeometry(r, r * 0.72, 0.16, 8, 1, true), color, 0, base + 0.08, 0);
    ring(0, base + 0.16, 0, r, 0.012, color, [Math.PI / 2, 0, 0]);
    cyl(0, base + 0.008, 0, r * 0.72, 0.016, color);
  };

  switch (id) {
    case 'charcoal':
      box(0, 0.16, 0, 0.24, 0.32, 0.28, dark); label(0.16);
      box(0, 0.326, 0, 0.24, 0.012, 0.04, brown); break;
    case 'cooler': cooler(0, blue); break;
    case 'stackedCoolers': cooler(0, blue); cooler(0.18, red); break;
    case 'sleepingMat':
      cyl(0, 0.1, 0, 0.1, 0.27, green, 0.1, [0, 0, Math.PI / 2]);
      for (const x of [-0.08, 0.08]) cyl(x, 0.1, 0, 0.104, 0.025, dark, 0.104, [0, 0, Math.PI / 2]); break;
    case 'lantern':
      box(0, 0.03, 0, 0.21, 0.06, 0.21, dark); box(0, 0.15, 0, 0.15, 0.18, 0.15, yellow);
      for (const x of [-0.09, 0.09]) for (const z of [-0.09, 0.09]) box(x, 0.15, z, 0.025, 0.22, 0.025, steel);
      box(0, 0.27, 0, 0.22, 0.045, 0.22, green);
      ring(0, 0.3, 0, 0.065, 0.012, dark, [0, Math.PI / 2, 0], Math.PI); break;
    case 'thermos':
      cyl(0, 0.15, 0, 0.075, 0.30, steel); cyl(0, 0.16, 0, 0.078, 0.13, green);
      cyl(0, 0.32, 0, 0.08, 0.04, dark); break;
    case 'foldingChair':
      for (const z of [-0.075, 0.075]) {
        box(-0.055, 0.19, z, 0.025, 0.38, 0.025, steel, [0, 0, -0.18]);
        box(0.055, 0.19, z, 0.025, 0.38, 0.025, steel, [0, 0, 0.18]);
      }
      box(0, 0.27, 0, 0.035, 0.20, 0.18, green); box(0, 0.12, 0, 0.14, 0.03, 0.18, green); break;
    case 'tackleBox':
      box(0, 0.07, 0, 0.25, 0.14, 0.32, green); box(0, 0.15, 0, 0.26, 0.025, 0.33, dark);
      for (const z of [-0.055, 0.055]) box(0, 0.185, z, 0.025, 0.055, 0.025, steel);
      box(0, 0.21, 0, 0.025, 0.02, 0.13, steel); break;
    case 'cereal': box(0, 0.18, 0, 0.23, 0.36, 0.28, red); label(0.19); break;
    case 'can': cyl(0, 0.115, 0, 0.1, 0.23, yellow); cyl(0, 0.235, 0, 0.1, 0.012, steel); break;
    case 'crisps':
      add(new THREE.CylinderGeometry(0.085, 0.12, 0.28, 4), yellow, 0, 0.14, 0, [0, Math.PI / 4, 0]);
      box(0, 0.286, 0, 0.16, 0.018, 0.025, red); label(0.14, 0.10, 0.09, 0.09); break;
    case 'biscuits':
      for (const y of [0.045, 0.135]) {
        box(0, y, 0, 0.22, 0.085, 0.32, brown);
        box(0, y + 0.044, 0, 0.22, 0.008, 0.09, cream);
      } break;
    case 'sodaPack':
      for (const x of [-0.052, 0.052]) for (const z of [-0.105, 0, 0.105]) cyl(x, 0.09, z, 0.047, 0.18, steel);
      box(0, 0.085, 0, 0.205, 0.12, 0.32, blue); label(0.085, 0.16, 0.07, 0.106); break;
    case 'jar':
      cyl(0, 0.11, 0, 0.09, 0.22, green); cyl(0, 0.24, 0, 0.095, 0.04, cream);
      label(0.11, 0.13, 0.10, 0.09); break;
    case 'noodleCup':
      cyl(0, 0.09, 0, 0.075, 0.18, red, 0.105); cyl(0, 0.187, 0, 0.11, 0.015, cream);
      label(0.1, 0.10, 0.07, 0.09); break;
    case 'pumpkin':
      add(new THREE.SphereGeometry(0.13, 8, 5), orange, 0, 0.13, 0);
      box(0, 0.27, 0, 0.035, 0.07, 0.035, green); break;
    case 'gift':
      box(0, 0.13, 0, 0.24, 0.26, 0.28, red); label(0.13, 0.035, 0.26);
      box(0, 0.266, 0, 0.24, 0.012, 0.035, cream); break;
    case 'egg': { const egg = ball(0, 0.143, 0, 0.11, pink); egg.scale.y = 1.3; break; }
    case 'wreath':
      ring(0, 0.17, 0, 0.12, 0.04, green, [0, Math.PI / 2, 0]);
      for (const z of [-0.045, 0.045]) box(-0.045, 0.075, z, 0.035, 0.065, 0.08, red, [0.15, 0, 0]); break;
    case 'candyCane':
      cyl(0, 0.14, -0.07, 0.023, 0.28, cream);
      ring(0, 0.28, 0, 0.07, 0.023, cream, [0, Math.PI / 2, 0], Math.PI);
      for (const y of [0.055, 0.13, 0.205]) cyl(0, y, -0.07, 0.024, 0.035, red); break;
    case 'halloweenBucket':
      bucket(0, 0.115, orange);
      for (const z of [-0.04, 0.04]) box(-0.115, 0.1, z, 0.012, 0.035, 0.025, dark);
      box(-0.115, 0.055, 0, 0.012, 0.025, 0.085, dark);
      ring(0, 0.17, 0, 0.10, 0.012, dark, [0, Math.PI / 2, 0], Math.PI); break;
    case 'giftWrap':
      for (const [i, color] of [red, green, pink].entries()) {
        cyl((i - 1) * 0.07, 0.17, 0, 0.031, 0.34, color);
        cyl((i - 1) * 0.07, 0.12, 0, 0.033, 0.025, cream);
      } break;
    case 'chocolateBunny':
      ball(0, 0.11, 0, 0.095, brown); ball(0, 0.245, 0, 0.065, brown);
      for (const z of [-0.035, 0.035]) box(0, 0.33, z, 0.045, 0.12, 0.035, brown, [z * 3, 0, 0]);
      box(-0.08, 0.16, 0, 0.02, 0.03, 0.13, red); break;
    case 'detergent':
      box(0, 0.15, 0, 0.23, 0.30, 0.24, blue); box(0, 0.33, 0, 0.09, 0.06, 0.09, yellow); label(0.15); break;
    case 'paperTowels': cyl(0, 0.16, 0, 0.11, 0.32, cream); cyl(0, 0.326, 0, 0.028, 0.012, brown); break;
    case 'buckets': bucket(0, 0.10, green); bucket(0.065, 0.11, blue); bucket(0.13, 0.12, green); break;
    case 'sprayBottle':
      cyl(0, 0.11, 0, 0.08, 0.22, blue, 0.055); cyl(0, 0.25, 0, 0.035, 0.06, cream);
      box(0, 0.30, -0.025, 0.06, 0.045, 0.15, red); box(0, 0.255, -0.07, 0.022, 0.07, 0.025, red); break;
    case 'dishSoap':
      cyl(0, 0.125, 0, 0.085, 0.25, green, 0.045); cyl(0, 0.28, 0, 0.035, 0.06, red);
      label(0.12, 0.09, 0.09, 0.073); break;
    case 'tissues':
      box(0, 0.06, 0, 0.24, 0.12, 0.31, pink); box(0, 0.124, 0, 0.025, 0.008, 0.15, dark);
      box(0, 0.165, 0, 0.01, 0.08, 0.11, cream, [0.1, 0, 0.14]); break;
    case 'towels':
      for (const [i, color] of [cream, blue, cream].entries()) {
        box(0, 0.025 + i * 0.05, 0, 0.25, 0.045, 0.32, color);
        for (const x of [-0.115, 0.115]) box(x, 0.049 + i * 0.05, 0, 0.015, 0.006, 0.31, color === cream ? yellow : cream);
      } break;
    case 'pan':
      cyl(0, 0.025, -0.065, 0.11, 0.05, dark);
      ring(0, 0.05, -0.065, 0.105, 0.01, steel, [Math.PI / 2, 0, 0]);
      box(0, 0.03, 0.13, 0.055, 0.035, 0.22, dark); break;
    default: throw new Error(`Unknown Mega Mart product: ${id}`);
  }
  return root;
}
