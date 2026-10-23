// Cosmetic map dressing. Boxes are batched by material; none enter the collider list.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atmosphere } from '../../config/environment.js';
import { makeSoftFootprint } from '../../world/atmosphereTextures.js';

export function buildMallAtmosphere(kit, layout, { service, ceilingHole }) {
  const group = new THREE.Group(); group.name = 'mall_atmosphere'; kit.group.add(group);
  const batches = new Map();
  const metal = kit.mat(0x849395, atmosphere.surfaces.metal);
  const trim = kit.mat(0xaaa99e), dark = kit.mat(0x333f42), teal = kit.mat(0x237d83);
  const cream = kit.mat(0xf1dfb9), paper = kit.mat(0xf3e7cd, atmosphere.surfaces.cardboard);
  const red = kit.mat(0xb95448), ochre = kit.mat(0xb18c51, atmosphere.surfaces.cardboard);
  function box(name, x, y, z, w, h, d, material, rotation = [0, 0, 0]) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
    geometry.applyMatrix4(transform);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(geometry);
    return { name, x, y, z, w, h, d };
  }
  function sign(text, options) {
    const mesh = kit.sign(text, { background: '#246d76', color: '#fff0cb', ...options });
    group.attach(mesh); mesh.name = 'galleria_notice'; return mesh;
  }

  // Ceiling seams follow the actual rooms. The escalator well remains completely open.
  for (const key of ['startRoom', 'hallway', 'foodCourt', 'megaMart']) {
    const r = layout[key], y = r.height - 0.012;
    const inHole = (x, z, w = 0, d = 0) => key === 'hallway'
      && x + w / 2 > ceilingHole.minX - 0.03 && x - w / 2 < ceilingHole.maxX + 0.03
      && z + d / 2 > ceilingHole.minZ - 0.03 && z - d / 2 < ceilingHole.maxZ + 0.03;
    // Short segments let us omit the well rather than running long beams across it.
    for (let x = r.minX + 1; x < r.maxX; x += atmosphere.ceiling.spacing) {
      for (let z = r.minZ + 1; z < r.maxZ; z += atmosphere.ceiling.spacing) {
        const w = Math.min(atmosphere.ceiling.spacing, r.maxX - x);
        const d = Math.min(atmosphere.ceiling.spacing, r.maxZ - z);
        if (!inHole(x + w / 2, z, w, atmosphere.ceiling.seamWidth)) {
          box('ceiling_seam', x + w / 2, y, z, w, 0.012, atmosphere.ceiling.seamWidth, trim);
        }
        if (!inHole(x, z + d / 2, atmosphere.ceiling.seamWidth, d)) {
          box('ceiling_seam', x, y, z + d / 2, atmosphere.ceiling.seamWidth, 0.012, d, trim);
        }
      }
    }
    for (let x = r.minX + 2.5; x < r.maxX - 1; x += atmosphere.ceiling.ventSpacing) {
      const z = r.minZ + 1.35;
      if (inHole(x, z, 0.65, 0.43) || inHole(x + 1, z + 0.7, 0.11, 0.11)) continue;
      box('ceiling_vent', x, y - 0.025, z, 0.65, 0.035, 0.43, metal);
      for (let i = -3; i <= 3; i++) box('vent_louvre', x + i * 0.075, y - 0.047, z, 0.026, 0.012, 0.32, dark);
      box('sprinkler_base', x + 1, y - 0.03, z + 0.7, 0.11, 0.04, 0.11, cream);
      box('sprinkler_head', x + 1, y - 0.08, z + 0.7, 0.065, 0.05, 0.065, metal);
    }
  }

  // One visual access panel and exposed back-of-house cable trays, above jump height.
  const cx = service.points[1].x, scY = layout.serviceCorridor.height;
  box('service_cable_tray', cx - 0.8, scY - 0.18, -5.5, 0.32, 0.1, 13, metal);
  for (const dx of [-0.1, 0, 0.1]) box('service_cable', cx - 0.8 + dx, scY - 0.11, -5.5, 0.035, 0.03, 13, dark);
  box('access_panel_recess', cx + 0.5, scY - 0.015, -7.3, 0.8, 0.016, 0.8, dark);
  box('loose_access_panel', cx + 0.5, scY - 0.16, -7.05, 0.77, 0.03, 0.5, trim, [0.45, 0, 0]);
  box('maintenance_tag', cx + 0.5, scY - 0.27, -7.35, 0.04, 0.34, 0.04, red);
  sign('MAINTENANCE: BACK IN 5 MINUTES', { x: -23.25, y: 2.65, z: -7.2, width: 1.8, height: 0.24, facing: 'x+' });

  // Mall-owned signage shares a palette; store identities stay their own.
  sign('SUNSET GALLERIA', { x: 0, y: 3.35, z: 15.94, width: 3.6, height: 0.48, facing: -1 });
  sign('TRADING HOURS: UNTIL FURTHER NOTICE', { x: -4.94, y: 2.65, z: 11.5, width: 2.5, height: 0.28, facing: 'x+' });
  sign('SUNSET GALLERIA / DIRECTORY', { x: -18, y: 2.6, z: 5.95, width: 2.3, height: 0.34, facing: -1 });
  for (const [i, text] of ['FOOD COURT  -  SOUTH', 'MEGA MART  -  EAST', 'CUSTOMER SERVICE  -  CENTRE'].entries()) {
    sign(text, { x: -18, y: 2.19 - i * 0.29, z: 5.94, width: 2.3, height: 0.25, facing: -1,
      background: '#eee1c1', color: '#2e5158' });
  }
  sign('PLEASE ENJOY YOUR STAY', { x: 18.8, y: 3.6, z: 5.95, width: 1.8, height: 0.28, facing: -1 });
  sign('TABLES ARE FOR CUSTOMERS. MOSTLY.', { x: -16.9, y: 2.8, z: -14.25, width: 3.1, height: 0.3, facing: 1 });
  sign('RESTOCK IN PROGRESS', { x: 29.05, y: 2.1, z: -23.95, width: 1.8, height: 0.28, facing: 1 });

  const hanging = sign('FOOD COURT  /  MEGA MART >', { x: 3.4, y: 4.5, z: 2,
    width: 3.2, height: 0.42, facing: 1 });
  // A second face for the return trip; both pivot around the same centre.
  const reverse = sign('< FOOD COURT  /  MEGA MART', { x: 3.4, y: 4.5, z: 1.98,
    width: 3.2, height: 0.42, facing: -1 });
  for (const x of [2.2, 4.6]) box('sign_suspension', x, 5.35, 2, 0.025, 1.3, 0.025, metal);

  // Interrupted lunch. Trays, cups and cartons stay on existing table tops.
  for (const [x, z, angle] of [[-9, -6.5, 0.2], [5.5, -10.6, -0.25]]) {
    box('lunch_tray', x, 0.761, z, 0.58, 0.025, 0.34, teal, [0, angle, 0]);
    for (const dx of [-0.14, 0.14]) {
      box('food_carton', x + dx, 0.84, z - 0.02, 0.18, 0.14, 0.17, dx < 0 ? cream : red, [0, angle, 0]);
    }
    box('drink_cup', x + 0.12, 0.86, z + 0.2, 0.1, 0.2, 0.1, paper);
    box('drink_lid', x + 0.12, 0.966, z + 0.2, 0.12, 0.018, 0.12, cream);
    box('straw', x + 0.12, 1.025, z + 0.2, 0.018, 0.12, 0.018, red);
  }
  // A fallen folding seat tucked under a table, inside its existing central solid.
  box('fallen_seat', -5.5, 0.14, -7.5, 0.38, 0.055, 0.34, teal, [0, 0.3, 0.5]);
  for (const dx of [-0.16, 0.16]) box('fallen_seat_leg', -5.5 + dx, 0.18, -7.5, 0.025, 0.28, 0.025, metal, [0.8, 0, 0]);
  // An open restocking carton on a shelf end; never in an aisle or the rear crossing.
  box('restock_carton', 27.5, 0.29, -8.35, 0.57, 0.32, 0.5, ochre);
  box('carton_interior', 27.5, 0.455, -8.35, 0.47, 0.012, 0.4, dark);
  for (const side of [-1, 1]) box('carton_flap', 27.5 + side * 0.33, 0.48, -8.35,
    0.22, 0.016, 0.49, ochre, [0, 0, side * 0.35]);

  // A single shared texture/material family for localized leaks, dust and contact shadows.
  const soft = makeSoftFootprint();
  function patches(name, entries, color, opacity) {
    const material = new THREE.MeshBasicMaterial({ map: soft, color, transparent: true, opacity,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    const pieces = [];
    for (const [x, z, w, d] of entries) {
      const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, atmosphere.contact.lift, z); pieces.push(g);
    }
    if (!pieces.length) { material.dispose(); return; }
    const mesh = new THREE.Mesh(mergeGeometries(pieces), material); mesh.name = name; group.add(mesh);
    for (const g of pieces) g.dispose();
  }
  // Floor-resting fixtures only. Walls, doors, floor slabs and full-height pillars are excluded.
  const footprints = kit.colliders.filter(b => b.min.y >= -0.01 && b.min.y <= 0.05 && b.max.y > 0.12 && b.max.y < 3
    && b.max.x - b.min.x > 0.35 && b.max.z - b.min.z > 0.35
    && (b.max.x - b.min.x) * (b.max.z - b.min.z) < 20);
  patches('fixture_contact_shadows', footprints.map(b => [(b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2,
    b.max.x - b.min.x + atmosphere.contact.fixturePadding * 2, b.max.z - b.min.z + atmosphere.contact.fixturePadding * 2]),
  0x222326, atmosphere.contact.fixtureOpacity);
  patches('perimeter_dust', [[-4.65, 14.2, 0.5, 2], [4.65, 8, 0.5, 1.5], [-18.7, -13.8, 1.4, 0.5],
    [18.9, -13.7, 1.4, 0.6], [33.6, -18, 0.5, 3], [28.5, -23.6, 1.2, 0.6]], 0x786d52, 0.23);
  patches('table_spill', [[-9.28, -6.45, 0.4, 0.7], [5.2, -10.5, 0.55, 0.35]], 0x835c38, 0.23);
  patches('service_leak', [[cx + 0.85, -7.3, 0.65, 1.3]], 0x4a645b, 0.24);

  // Gentle local tube variation, without flashing an entire room or extinguishing a route.
  const tubeMaterial = kit.mat(0xe6f3ef, { emissive: 0x9abcb6, emissiveIntensity: 0.9 });
  const tube = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.035, 1.2), tubeMaterial);
  tube.name = 'service_aging_tube'; tube.position.set(cx + 0.3, scY - 0.08, -7.3); group.add(tube);
  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.name = 'atmosphere_detail_batch'; group.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  const emitters = [
    { id: 'start_vent', kind: 'ventilation', zone: 'startRoom', position: [-3.4, 3, 14.6], range: 8 },
    { id: 'hall_music', kind: 'music', zone: 'hallway', position: [2, 4.5, 2], range: 23 },
    { id: 'food_fridge', kind: 'refrigerator', zone: 'foodCourt', position: [6.5, 2, -13.8], range: 12 },
    { id: 'mart_hvac', kind: 'ventilation', zone: 'megaMart', position: [27.5, 4, -14], range: 16 },
    { id: 'service_hvac', kind: 'ventilation', zone: 'serviceCorridor', position: [cx, 3, -7], range: 12 },
  ];
  let time = 0;
  function pose() {
    hanging.rotation.z = reverse.rotation.z = Math.sin(time * Math.PI * 2 / atmosphere.motion.signPeriod) * atmosphere.motion.signRadians;
    tubeMaterial.emissiveIntensity = atmosphere.motion.tubeMin + (1 - atmosphere.motion.tubeMin)
      * (0.5 + 0.5 * Math.sin(time * Math.PI * 2 / atmosphere.motion.tubePeriod));
  }
  pose();
  return { group, emitters, update(dt) { time += dt; pose(); }, reset() { time = 0; pose(); } };
}
