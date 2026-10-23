// An ordinary shopping day interrupted. Layout data is shared with mall.js, so dressing and
// the existing solid fixtures cannot drift apart. Small static meshes are batched by material.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from '../../world/textures.js';
import { megaMartLighting, atmosphere } from '../../config/environment.js';
import { buildMartProduct, MART_PRODUCTS } from './martProducts.js';

export const MART_FIXTURES = {
  gondolas: [
    { x: 24, faces: ['outdoor', 'snacks'], seed: 31 },
    { x: 27.5, faces: ['snacks', 'holidays'], seed: 47 },
    { x: 31, faces: ['holidays', 'housewares'], seed: 61 },
  ],
  checkoutZs: [4.1, 1.3, -1.5, -4.3],
};

export function buildMegaMartDetails(kit, room) {
  const details = new THREE.Group(); details.name = 'mega_mart_details'; kit.group.add(details);
  const meshes = [];
  const mat = (color, options) => kit.mat(color, options);
  const cream = mat(0xeee5ca), metal = mat(0x78868b, atmosphere.surfaces.metal), dark = mat(0x354044);
  const red = mat(0xc95045), blue = mat(0x4479a6), green = mat(0x638363);
  const cardboard = mat(0xb48b56, atmosphere.surfaces.cardboard), yellow = mat(0xe8bd56), white = mat(0xd8ded9);
  function shape(name, geometry, material, x, y, z, rotation = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name;
    mesh.position.set(x, y, z); mesh.rotation.set(...rotation); meshes.push(mesh); return mesh;
  }
  const box = (name, x, y, z, w, h, d, material, rotation) =>
    shape(name, new THREE.BoxGeometry(w, h, d), material, x, y, z, rotation);
  const cylinder = (name, x, y, z, radius, height, material, rotation, top = radius) =>
    shape(name, new THREE.CylinderGeometry(top, radius, height, 8), material, x, y, z, rotation);
  function sign(name, text, x, y, z, width, height, facing = 1, background = '#244d79', color = '#f7e7b8') {
    const mesh = kit.sign(text, { x, y, z, width, height, facing, background, color });
    mesh.name = name; details.add(mesh); return mesh;
  }
  // All stock stays INSIDE the existing 1m-wide gondola footprints. Shapes, palette and sparse
  // stretches vary by department; fixed per-shelf seeds keep it stable without repeating rows.
  for (const fixture of MART_FIXTURES.gondolas) {
    for (const [face, department] of fixture.faces.entries()) {
      const side = face === 0 ? -1 : 1;
      for (const [level, y0] of [0.12, 0.62, 1.12, 1.62].entries()) {
        const random = seededRandom(fixture.seed * 1009 + face * 7919 + level * 104729);
        const products = MART_PRODUCTS[department];
        let cursor = -19.25;
        while (cursor < -8.25) {
          // Unequal runs tell small stories: untouched stock, a disturbed patch, or a stripped
          // section. Neither their boundaries nor their contents line up with the shelf above.
          const end = Math.min(-8.25, cursor + 0.8 + random() * 2.5);
          const condition = random();
          const bare = condition < 0.28, disturbed = condition > 0.64;
          const groupId = products[Math.floor(random() * products.length)];
          const frontEdge = 0.40 + random() * 0.08;
          if (bare) cursor += (end - cursor) * (0.55 + random() * 0.4);
          while (cursor < end - 0.08) {
            const id = random() < (disturbed ? 0.30 : 0.07)
              ? products[Math.floor(random() * products.length)] : groupId;
            const product = buildMartProduct(id, mat);
            product.rotation.y = (random() - 0.5) * (disturbed ? 0.75 : 0.10);
            if (random() < (disturbed ? 0.32 : 0.025)) product.rotation.z = Math.PI / 2;
            let bounds = new THREE.Box3().setFromObject(product);
            const size = bounds.getSize(new THREE.Vector3());
            product.scale.setScalar(Math.min(1, 0.34 / size.x, 0.40 / size.y, 0.38 / size.z));
            bounds = new THREE.Box3().setFromObject(product);
            bounds.getSize(size);
            // Advance by actual width along the shelf: clusters can be packed or scattered,
            // but even toppled products never intersect their neighbours or cross a run's end.
            if (cursor + size.z > end) {
              product.traverse((mesh) => { if (mesh.isMesh) mesh.geometry.dispose(); });
              break;
            }
            const centre = bounds.getCenter(new THREE.Vector3());
            const depth = disturbed || bare
              ? 0.05 + size.x / 2 + random() * (0.43 - size.x)
              : frontEdge - size.x / 2;
            product.position.set(fixture.x + side * depth - centre.x,
              y0 + 0.004 - bounds.min.y, cursor + size.z / 2 - centre.z);
            product.updateMatrixWorld(true);
            product.traverse((mesh) => {
              if (!mesh.isMesh) return;
              mesh.geometry.applyMatrix4(mesh.matrixWorld);
              mesh.position.set(0, 0, 0); mesh.rotation.set(0, 0, 0); mesh.scale.setScalar(1);
              meshes.push(mesh);
            });
            cursor += size.z + (disturbed ? 0.10 + random() * 0.50 : 0.035 + random() * 0.12);
            if (bare) break;
          }
          cursor = end + 0.06 + random() * 0.25;
        }
      }
      for (const [i, z] of [-17.5, -12.6, -9.0].entries()) {
        const ticket = sign('mart_shelf_ticket', ['99c', '2 FOR 1', 'LAST FEW'][i], fixture.x + side * 0.512, 0.58, z,
          0.44, 0.10, side < 0 ? 'x-' : 'x+', '#e8d9ab', '#3a423d');
        ticket.rotation.x = i === 1 ? -0.06 : 0;
      }
    }
  }

  // Groceries and bags stay at the register ends (x>26.6). The belt's left 1.8m stays clear.
  for (const [i, z] of MART_FIXTURES.checkoutZs.entries()) {
    box('checkout_divider', 26.72, 1.045, z - 0.15, 0.32, 0.055, 0.045, yellow);
    box('abandoned_grocery', 26.91, 1.12, z + 0.21, 0.20, 0.23, 0.15, i % 2 ? blue : red);
    cylinder('checkout_can', 26.67, 1.105, z + 0.13, 0.065, 0.19, green);
    box('bag_dispenser', 27.22, 0.65, z - 0.422, 0.32, 0.20, 0.035, metal);
    box('hanging_bags', 27.22, 0.46, z - 0.45, 0.24, 0.30, 0.018, cream);
    box('checkout_receipt', 27.12, 0.85, z - 0.447, 0.08, 0.32, 0.008, cream);
    for (let j = 0; j < 4; j++) box('receipt_print', 27.12, 0.77 + j * 0.045, z - 0.456, 0.05, 0.009, 0.005, dark);
    box('shopping_list', 26.82, 1.022, z - 0.23, 0.16, 0.009, 0.18, cream, [0, 0.18, 0]);
  }
  sign('express_lane', 'EXPRESS: APPROXIMATELY 12 ITEMS', 26, 3.25, 4.1, 3.0, 0.30, -1);
  sign('holiday_slogan', 'ALL HOLIDAYS, ALL YEAR', 29.25, 4.05, -7.6, 2.7, 0.32);

  // Receiving doors: hardware sits against the existing wall, well behind spawn bodies.
  for (const x of [26.5, 31.8]) {
    box('door_kickplate', x, 0.42, room.minZ + 0.102, 1.50, 0.48, 0.024, metal);
    for (const dx of [-1.12, 1.12]) {
      box('rubber_bumper', x + dx, 0.73, room.minZ + 0.12, 0.13, 1.4, 0.12, dark);
    }
    for (let i = 0; i < 3; i++) box('receiving_scuff', x - 0.5 + i * 0.25, 0.42 + i * 0.11,
      room.minZ + 0.124, 0.22, 0.016, 0.01, cardboard, [0, 0, -0.12]);
  }
  sign('delivery_clipboard', 'DELIVERY: STILL WAITING', 29.05, 1.55, room.minZ + 0.04, 1.35, 0.31);
  sign('delivery_label', 'FRAGILE. PROBABLY.', 31.8, 1.12, room.minZ + 0.115, 0.95, 0.19, 1, '#dfd2af', '#414337');
  sign('safety_board', 'DAYS WITHOUT INCIDENT: 0', 23.9, 2.85, room.minZ + 0.04, 2.0, 0.38);
  box('safety_old_number', 24.57, 2.85, room.minZ + 0.05, 0.035, 0.30, 0.012, red, [0, 0, -0.55]);
  for (const dx of [-0.8, 0.8]) box('rear_vent_frame', 21.8 + dx, 0.90, room.minZ + 0.08, 0.07, 1.62, 0.12, metal);
  for (const y of [0.12, 1.68]) box('rear_vent_frame', 21.8, y, room.minZ + 0.08, 1.67, 0.07, 0.12, metal);

  // Wall buy: clear centre for the existing outline/weapon, with a toy-promotion surround.
  sign('foam_promotion', 'TRY BEFORE YOU BUY', 31.5, 2.30, room.maxZ - 0.04, 2.2, 0.33, -1, '#944358');
  sign('foam_promotion_note', 'FOAM DARTS. REAL CONSEQUENCES.', 31.5, 0.83, room.maxZ - 0.04, 2.2, 0.24, -1);
  for (const x of [30.55, 32.45]) {
    box('toy_package', x, 1.5, room.maxZ - 0.05, 0.25, 0.70, 0.05, yellow);
    box('toy_package_stripe', x, 1.49, room.maxZ - 0.085, 0.19, 0.25, 0.012, blue);
  }

  // A dropped basket fits within an existing shelf end, rather than becoming a new aisle obstacle.
  const basketX = 31, basketZ = -8.45;
  box('dropped_basket_base', basketX, 0.19, basketZ, 0.57, 0.05, 0.42, red);
  for (const dz of [-0.21, 0.21]) {
    box('basket_rim', basketX, 0.43, basketZ + dz, 0.58, 0.035, 0.03, red);
    for (const dx of [-0.25, -0.08, 0.08, 0.25]) box('basket_slats', basketX + dx, 0.32, basketZ + dz, 0.025, 0.22, 0.025, red);
  }
  // Flat wear and spill at the perimeter do not hide bodies or alter footing.
  for (const [x, z, angle] of [[33.65, -4.8, 0.3], [33.5, -5.25, -0.2], [28.9, -23.65, 0.5], [22.8, 5.65, -0.4]]) {
    box('mart_floor_scuff', x, 0.008, z, 0.05, 0.008, 0.55, mat(0xb0a992), [0, angle, 0]);
  }
  shape('perimeter_spill', new THREE.CircleGeometry(0.36, 9), mat(0xa2b3a1, { transparent: true, opacity: 0.5, depthWrite: false }),
    33.55, 0.014, -7, [-Math.PI / 2, 0, 0]);
  // A trolley parked snugly against the east wall; its ONE visible-size collider keeps it honest.
  // It never enters aisle 4 or the front crossing's central route.
  const tx = room.maxX - 0.33, tz = -5.5;
  for (const z of [tz - 0.35, tz + 0.35]) for (const x of [tx - 0.19, tx + 0.19]) {
    cylinder('trolley_wheel', x, 0.10, z, 0.09, 0.06, dark, [0, 0, Math.PI / 2]);
    box('trolley_upright', x, 0.56, z, 0.025, 0.85, 0.025, metal);
  }
  for (const y of [0.25, 0.55, 0.85]) {
    for (const dx of [-0.21, 0.21]) box('trolley_wire', tx + dx, y, tz, 0.025, 0.025, 0.76, metal);
    for (const dz of [-0.38, 0.38]) box('trolley_wire', tx, y, tz + dz, 0.44, 0.025, 0.025, metal);
  }
  box('trolley_handle', tx, 0.98, tz + 0.39, 0.46, 0.035, 0.04, red);
  kit.addCollider(tx - 0.24, 0, tz - 0.40, tx + 0.24, 1, tz + 0.42);

  // Slim housings around existing strips; missing/broken diffusers only on the dead fittings.
  const strips = [
    ...[21.9, 25.75, 29.25, 32.75].flatMap((x) => [
      { x, z: -16.5, w: 0.5, d: 5, dead: x === 29.25 }, { x, z: -10.5, w: 0.5, d: 5 },
    ]),
    { x: 27.25, z: 3, w: 11.5, d: 0.5 }, { x: 27.25, z: -3, w: 11.5, d: 0.5 },
    { x: 27.25, z: -21.75, w: 11.5, d: 0.5, dead: true },
  ];
  for (const s of strips) {
    for (const side of [-1, 1]) {
      box('strip_frame', s.x + side * (s.w / 2 + 0.025), room.height - 0.09, s.z, 0.045, 0.055, s.d + 0.1, metal);
      box('strip_frame', s.x, room.height - 0.09, s.z + side * (s.d / 2 + 0.025), s.w, 0.055, 0.045, metal);
    }
    if (s.dead) box('broken_diffuser', s.x, room.height - 0.14, s.z, Math.min(0.3, s.w), 0.035,
      Math.min(1.2, s.d), white, [0, 0, 0.10]);
  }
  for (const cfg of megaMartLighting) {
    const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance, 2);
    light.name = cfg.name; light.position.set(cfg.x, cfg.y, cfg.z); details.add(light);
  }

  const batches = new Map();
  for (const mesh of meshes) {
    mesh.updateMatrix(); mesh.geometry.applyMatrix4(mesh.matrix);
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh.geometry);
  }
  for (const [material, geometries] of batches) {
    const merged = new THREE.Mesh(mergeGeometries(geometries), material);
    merged.name = 'mart_detail_batch'; details.add(merged);
    for (const geometry of geometries) geometry.dispose();
  }
  return details;
}
