// Cosmetic map dressing. Boxes are batched by material; none enter the collider list.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { atmosphere } from '../../config/environment.js';
import { makeSoftFootprint, makeDustMoteTexture } from '../../world/atmosphereTextures.js';
import { seededRandom } from '../../world/textures.js';

export function buildMallAtmosphere(kit, layout, { service, ceilingHole, ceilingHoles = ceilingHole ? [ceilingHole] : [] }) {
  const group = new THREE.Group(); group.name = 'mall_atmosphere'; kit.group.add(group);
  const batches = new Map();
  const metal = kit.mat(0x849395, atmosphere.surfaces.metal);
  const trim = kit.mat(0xaaa99e), dark = kit.mat(0x333f42), teal = kit.mat(0x237d83);
  const cream = kit.mat(0xf1dfb9), paper = kit.mat(0xf3e7cd, atmosphere.surfaces.cardboard);
  const red = kit.mat(0xb95448), ochre = kit.mat(0xb18c51, atmosphere.surfaces.cardboard);
  const yellow = kit.mat(0xffd23f, atmosphere.surfaces.plastic);
  const exitGlow = kit.mat(0xff4a3d, { emissive: 0xff2b1f, emissiveIntensity: 1.45, roughness: 0.25 });
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

  // Ceiling seams follow the actual rooms. The escalator well and the balcony voids remain completely open.
  for (const key of ['startRoom', 'hallway', 'foodCourt', 'megaMart']) {
    const r = layout[key], y = r.height - 0.012;
    const inHole = (x, z, w = 0, d = 0) => key === 'hallway' && ceilingHoles.some((hole) =>
      x + w / 2 > hole.minX - 0.03 && x - w / 2 < hole.maxX + 0.03
      && z + d / 2 > hole.minZ - 0.03 && z - d / 2 < hole.maxZ + 0.03);
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

  // Exposed overhead HVAC trunk ductwork, flange joints, and PA speaker horns in the high ceilings.
  box('hall_hvac_trunk', 6.5, 5.72, 5.35, 24, 0.28, 0.42, metal);
  for (let x = -4; x <= 16; x += 4) {
    box('hvac_flange', x, 5.72, 5.35, 0.06, 0.32, 0.46, dark);
    box('hvac_strap', x, 5.88, 5.35, 0.03, 0.22, 0.46, dark);
  }
  // (The duct has a 2.3 m gap over Burger Barn, x -6.9..-4.6, and no riser there: the Paper Hat showpiece's burger stands in it,
  // maps/mall/wardrobeShowpieces/foodCourt.js.)
  box('food_exhaust_duct', -7.7, 5.68, -13.55, 1.6, 0.34, 0.48, metal);
  box('food_exhaust_duct', 1.95, 5.68, -13.55, 13.1, 0.34, 0.48, metal);
  for (let x = -7; x <= 7; x += 3.5) box('food_duct_flange', x, 5.68, -13.55, 0.06, 0.38, 0.52, dark);
  box('food_duct_flange', -4.6, 5.68, -13.55, 0.06, 0.38, 0.52, dark);
  for (const x of [0, 5.75]) box('stall_exhaust_riser', x, 5.15, -13.55, 0.36, 0.75, 0.36, metal);
  for (const [sx, sy, sz, ry] of [[-5.5, 4.85, 5.88, 0], [12.5, 4.85, 5.88, 0], [-12.6, 4.6, -8.3, 0.4], [12.6, 4.6, -8.3, -0.4]]) {
    box('pa_speaker_mount', sx, sy, sz, 0.08, 0.14, 0.12, dark, [0, ry, 0]);
    box('pa_speaker_horn', sx, sy - 0.02, sz + ( sz > 0 ? -0.14 : 0.14), 0.22, 0.18, 0.2, cream, [0.18, ry, 0]);
  }

  // Hanging overhead promotional cloth banners in the Main Concourse and Food Court (well above routes).
  function promoBanner(bx, bz, primaryMat, accentMat) {
    for (const dx of [-0.85, 0.85]) box('banner_wire', bx + dx, 5.55, bz, 0.02, 0.88, 0.02, metal);
    box('banner_top_rod', bx, 5.12, bz, 1.95, 0.035, 0.035, metal);
    box('banner_bottom_rod', bx, 4.18, bz, 1.95, 0.03, 0.03, metal);
    box('banner_cloth', bx, 4.65, bz, 1.82, 0.92, 0.022, primaryMat);
    box('banner_header_stripe', bx, 4.98, bz, 1.84, 0.14, 0.028, accentMat);
    box('banner_footer_stripe', bx, 4.32, bz, 1.84, 0.12, 0.028, yellow);
    box('banner_center_emblem', bx, 4.65, bz, 1.25, 0.22, 0.03, cream);
  }
  promoBanner(-1.8, 4.6, red, cream); // (beside the balcony void, not over it)
  promoBanner(11.5, 2.0, teal, cream);
  promoBanner(-4.5, -5.5, teal, red);
  promoBanner(4.5, -5.5, red, teal);

  // One visual access panel and exposed back-of-house cable trays, above jump height.
  const cx = service.points[1].x, scY = layout.serviceCorridor.height;
  const upperY = layout.hallway.height + 0.3; // level 2's floor
  box('service_cable_tray', cx - 0.8, scY - 0.18, -5.5, 0.32, 0.1, 13, metal);
  for (const dx of [-0.1, 0, 0.1]) box('service_cable', cx - 0.8 + dx, scY - 0.11, -5.5, 0.035, 0.03, 13, dark);
  box('access_panel_recess', cx + 0.5, scY - 0.015, -7.3, 0.8, 0.016, 0.8, dark);
  box('loose_access_panel', cx + 0.5, scY - 0.16, -7.05, 0.77, 0.03, 0.5, trim, [0.45, 0, 0]);
  box('maintenance_tag', cx + 0.5, scY - 0.27, -7.35, 0.04, 0.34, 0.04, red);
  sign('MAINTENANCE: BACK IN 5 MINUTES', { x: -23.25, y: 2.65, z: -7.2, width: 1.8, height: 0.24, facing: 'x+' });

  // Glowing red emergency exit beacons above sealed exit doors and dark back-of-house corners.
  box('exit_beacon_hall', 13, 3.35, 5.93, 0.52, 0.2, 0.07, exitGlow);
  box('exit_beacon_mart', 33.93, 2.95, 2.5, 0.07, 0.2, 0.52, exitGlow);
  box('exit_beacon_service', cx, 2.75, -13.93, 0.48, 0.18, 0.07, exitGlow);
  box('exit_beacon_upper', -19.96, upperY + 2.95, 2, 0.07, 0.2, 0.52, exitGlow); // level 2, over the escalator

  const emergencyLights = []; // (dimmed to 0 by Settings > Video > Dust and flickering lights)
  if (atmosphere.flicker) {
    const { emergencyLightColor, emergencyLightIntensity, emergencyLightDistance } = atmosphere.flicker;
    for (const [ex, ey, ez] of [[cx, 2.8, -12.8], [-19.3, upperY + 2.6, 2.0]]) {
      const emergencyLight = new THREE.PointLight(emergencyLightColor, emergencyLightIntensity, emergencyLightDistance, 2);
      emergencyLight.position.set(ex, ey, ez);
      group.add(emergencyLight);
      emergencyLights.push(emergencyLight);
    }
  }

  // Mall-owned signage shares a palette; store identities stay their own.
  sign('SUNSET GALLERIA', { x: 0, y: 3.35, z: 15.94, width: 3.6, height: 0.48, facing: -1 });
  // (North of HOFFMAN'S side door, which took the stretch of wall this notice hung on.)
  sign('TRADING HOURS: UNTIL FURTHER NOTICE', { x: -4.94, y: 2.65, z: 14.9, width: 2.0, height: 0.25, facing: 'x+' });
  // (The directory hung at x -18 until HOFFMAN'S gate took that stretch of wall: now over the hallway's north-west vent.)
  // (Raised 0.25 m: that vent is boarded with planks up to y 1.35 at the same z as these rows, so the lowest row flickered against them.)
  const directoryRise = 0.25;
  sign('Sunset Galleria / Directory', { x: -6.9, y: 2.6 + directoryRise, z: 5.95, width: 2.3, height: 0.34, facing: -1, font: 'Arial, "Helvetica Neue", sans-serif' });
  for (const [i, text] of ['Food Court  ·  South', 'Mega Mart  ·  East', "Hoffman's  ·  North-West", 'Cinema  ·  Upstairs, West'].entries()) {
    sign(text, { x: -6.9, y: 2.19 + directoryRise - i * 0.29, z: 5.94, width: 2.3, height: 0.25, facing: -1,
      background: '#eee1c1', color: '#2e5158', font: 'Arial, "Helvetica Neue", sans-serif' });
  }
  sign('Please enjoy your stay', { x: 18.8, y: 3.6, z: 5.95, width: 1.8, height: 0.28, facing: -1, font: 'Arial, "Helvetica Neue", sans-serif' });
  sign('TABLES ARE FOR CUSTOMERS. MOSTLY.', { x: -16.9, y: 2.8, z: -14.25, width: 3.1, height: 0.3, facing: 1 });
  sign('RESTOCK IN PROGRESS', { x: 29.05, y: 2.1, z: -23.95, width: 1.8, height: 0.28, facing: 1 });

  // (Hung under the bridge between the two balcony voids.)
  const hanging = sign('Food Court  /  Mega Mart  →', { x: 0.5, y: 4.5, z: 2,
    width: 3.2, height: 0.42, facing: 1, font: 'Arial, "Helvetica Neue", sans-serif' });
  // A second face for the return trip; both pivot around the same centre.
  const reverse = sign('←  Food Court  /  Mega Mart', { x: 0.5, y: 4.5, z: 1.98,
    width: 3.2, height: 0.42, facing: -1, font: 'Arial, "Helvetica Neue", sans-serif' });
  for (const x of [-0.7, 1.7]) box('sign_suspension', x, 5.35, 2, 0.025, 1.3, 0.025, metal);

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

  // Yellow "CAUTION: WET FLOOR" A-frame cones & janitor mop bucket near spills and leaks.
  function wetFloorCone(wx, wz, yaw = 0, fallen = false) {
    if (fallen) {
      box('wet_cone_fallen_a', wx, 0.045, wz, 0.28, 0.022, 0.56, yellow, [0.06, yaw, 0.08]);
      box('wet_cone_fallen_b', wx, 0.022, wz + 0.04, 0.28, 0.022, 0.56, yellow, [-0.04, yaw, 0]);
      box('wet_cone_badge', wx, 0.06, wz, 0.16, 0.01, 0.22, red, [0.06, yaw, 0.08]);
      return;
    }
    const s = Math.sin(yaw), c = Math.cos(yaw);
    for (const side of [-1, 1]) {
      const ox = s * side * 0.09, oz = c * side * 0.09;
      box('wet_cone_board', wx + ox, 0.29, wz + oz, 0.28, 0.58, 0.022, yellow, [side * 0.19, yaw, 0]);
      box('wet_cone_stripe', wx + ox * 1.12, 0.31, wz + oz * 1.12, 0.19, 0.18, 0.012, red, [side * 0.19, yaw, 0]);
      box('wet_cone_icon', wx + ox * 1.18, 0.31, wz + oz * 1.18, 0.04, 0.11, 0.012, dark, [side * 0.19, yaw, 0.25]);
    }
    box('wet_cone_top', wx, 0.57, wz, 0.24, 0.03, 0.05, yellow, [0, yaw, 0]);
  }
  wetFloorCone(cx + 0.72, -6.55, 0.35);
  wetFloorCone(-8.65, -6.15, -0.42);
  wetFloorCone(-6.4, -1.15, 0.28, true); // overturned wet floor cone beside the Food Court doorway planter

  // Janitor mop bucket & leaning mop at the Service Corridor ceiling leak.
  const bx = cx + 0.88, bz = -7.85;
  box('mop_bucket', bx, 0.19, bz, 0.34, 0.3, 0.42, yellow, [0, 0.18, 0]);
  box('mop_wringer', bx - 0.02, 0.38, bz - 0.08, 0.26, 0.18, 0.22, yellow, [0, 0.18, 0]);
  box('mop_wringer_lever', bx - 0.16, 0.48, bz - 0.08, 0.025, 0.26, 0.025, metal, [0.25, 0, -0.15]);
  for (const [dx, dz] of [[-0.14, -0.16], [0.14, -0.16], [-0.14, 0.16], [0.14, 0.16]]) {
    box('mop_bucket_wheel', bx + dx, 0.025, bz + dz, 0.045, 0.045, 0.045, dark);
  }
  box('mop_handle', bx + 0.04, 0.68, bz - 0.04, 0.028, 1.25, 0.028, ochre, [-0.12, 0, -0.16]);
  box('mop_head', bx - 0.04, 0.12, bz + 0.02, 0.22, 0.12, 0.18, cream, [0, 0.3, 0]);

  // Tipped chrome shopping cart & spilled grocery boxes in the north-east hallway corner (outside Mega Mart).
  const cartX = 18.85, cartZ = 5.18;
  box('tipped_cart_basket', cartX, 0.24, cartZ, 0.82, 0.44, 0.52, metal, [0.12, -0.28, 1.38]);
  box('tipped_cart_base', cartX + 0.22, 0.18, cartZ + 0.12, 0.78, 0.04, 0.46, metal, [0, -0.28, 0.15]);
  box('tipped_cart_handle', cartX + 0.48, 0.28, cartZ + 0.16, 0.04, 0.48, 0.04, red, [0.28, 0, 1.45]);
  for (const [dx, dy, dz] of [[-0.22, 0.12, 0.28], [-0.22, 0.38, 0.22], [0.32, 0.12, 0.18], [0.32, 0.38, 0.12]]) {
    box('tipped_cart_wheel', cartX + dx, dy, cartZ + dz, 0.08, 0.08, 0.04, dark, [0, 0.4, 0]);
  }
  for (const [gx, gz, gw, gh, gd, gmat, rotY] of [
    [18.12, 4.95, 0.24, 0.16, 0.18, red, 0.45],
    [18.38, 4.72, 0.2, 0.12, 0.22, yellow, -0.35],
    [17.92, 5.28, 0.22, 0.18, 0.16, teal, 0.7],
    [18.45, 5.42, 0.28, 0.14, 0.2, ochre, -0.18],
  ]) {
    box('spilled_cart_item', gx, gh / 2, gz, gw, gh, gd, gmat, [0, rotY, 0]);
  }

  // Scattered trash, crumpled bags, receipts and soda cups near bins and benches.
  for (const [lx, lz, yaw] of [[-10.75, -8.05, 0.5], [-11.55, -8.55, -0.4], [10.78, -8.1, -0.6], [11.52, -8.5, 0.35], [-6.2, -4.15, 0.25], [6.4, -4.15, -0.3]]) {
    box('litter_bag', lx, 0.065, lz, 0.15, 0.13, 0.12, ochre, [0.15, yaw, -0.2]);
    box('litter_receipt', lx + 0.18, 0.008, lz + 0.08, 0.09, 0.006, 0.21, paper, [0, yaw + 0.7, 0]);
  }
  for (const [cx0, cz0, yaw] of [[-7.7, -4.25, 0.8], [7.65, -4.2, -0.55], [-10.85, -8.52, 0.2]]) {
    box('dropped_cup', cx0, 0.055, cz0, 0.09, 0.09, 0.18, paper, [0.08, yaw, 0]);
    box('dropped_cup_stripe', cx0, 0.058, cz0, 0.094, 0.094, 0.06, red, [0.08, yaw, 0]);
    box('dropped_straw', cx0 + 0.06, 0.02, cz0 + 0.1, 0.015, 0.015, 0.14, red, [0, yaw + 0.3, 0]);
  }

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

  // Failing ballast fluorescent tubes (Service Corridor, West Hallway dead troffer, Rear Mega Mart) + local floor shimmer.
  const tubeMaterial = kit.mat(0xe6f3ef, { emissive: 0xa8dcd6, emissiveIntensity: 1.0, roughness: 0.2 });
  tubeMaterial.userData.animated = true; // (its glow changes every frame: world/staticBatch.js keeps it its own material)
  const tubeSpecs = [
    [cx + 0.3, scY - 0.08, -7.3, 0.13, 0.035, 1.2],
    [-14.5, layout.hallway.height - 0.068, 4.35, 1.8, 0.035, 0.16],
    [27.2, layout.megaMart.height - 0.068, -21.75, 1.8, 0.035, 0.16],
  ];
  const tubePieces = tubeSpecs.map(([tx, ty, tz, tw, th, td]) => {
    const g = new THREE.BoxGeometry(tw, th, td);
    g.translate(tx, ty, tz);
    return g;
  });
  const tube = new THREE.Mesh(mergeGeometries(tubePieces), tubeMaterial);
  for (const g of tubePieces) g.dispose();
  tube.name = 'service_aging_tube';
  group.add(tube);

  const flickerCfg = atmosphere.flicker ?? { hallwayLightColor: 0xbbe2ff, hallwayLightIntensity: 7.5, hallwayLightDistance: 12 };
  const hallwayFlickerLight = new THREE.PointLight(
    flickerCfg.hallwayLightColor,
    flickerCfg.hallwayLightIntensity,
    flickerCfg.hallwayLightDistance,
    2,
  );
  hallwayFlickerLight.position.set(-14.5, layout.hallway.height - 0.7, 4.35);
  group.add(hallwayFlickerLight);

  for (const [material, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), material);
    mesh.name = 'atmosphere_detail_batch'; group.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }

  // Floating dust motes suspended in overhead light cones (one THREE.Points draw call).
  const dustCfg = atmosphere.dust ?? { count: 140, size: 0.075, opacity: 0.42, color: 0xeef6ff, driftY: 0.16, driftXZ: 0.12, period: 11 };
  const dustRandom = seededRandom(404);
  const dustZones = [
    [-3.8, 3.8, 0.7, 3.3, 7.0, 14.8], // Start Room
    [-17.5, 17.5, 0.8, 4.8, -1.5, 4.8], // Main Hallway
    [-16.5, 16.5, 0.8, 4.8, -12.5, -3.5], // Food Court
    [21.5, 32.5, 0.8, 4.2, -21.0, 3.5], // Mega Mart
    [cx - 0.9, cx + 0.9, 0.8, 2.8, -12.5, -1.5], // Service Corridor
  ];
  const dustBase = new Float32Array(dustCfg.count * 3);
  const dustPositions = new Float32Array(dustCfg.count * 3);
  const dustPhases = new Float32Array(dustCfg.count);
  for (let i = 0; i < dustCfg.count; i++) {
    const [x0, x1, y0, y1, z0, z1] = dustZones[i % dustZones.length];
    const i3 = i * 3;
    dustBase[i3] = x0 + dustRandom() * (x1 - x0);
    dustBase[i3 + 1] = y0 + dustRandom() * (y1 - y0);
    dustBase[i3 + 2] = z0 + dustRandom() * (z1 - z0);
    dustPhases[i] = dustRandom() * Math.PI * 2;
  }
  dustPositions.set(dustBase);
  const dustGeometry = new THREE.BufferGeometry();
  const dustPosAttr = new THREE.BufferAttribute(dustPositions, 3);
  dustGeometry.setAttribute('position', dustPosAttr);
  const dustMaterial = new THREE.PointsMaterial({
    map: makeDustMoteTexture(),
    color: dustCfg.color,
    size: dustCfg.size,
    transparent: true,
    opacity: dustCfg.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const dustPoints = new THREE.Points(dustGeometry, dustMaterial);
  dustPoints.name = 'mall_dust_motes';
  group.add(dustPoints);

  const emitters = [
    { id: 'start_music', kind: 'music', zone: 'startRoom', position: [0, 3.5, 11], range: 14 },
    { id: 'food_music', kind: 'music', zone: 'foodCourt', position: [0, 5.5, -8], range: 24 },
    { id: 'mart_music', kind: 'music', zone: 'megaMart', position: [27.5, 4.5, -10], range: 22 },
    { id: 'service_music', kind: 'music', zone: 'serviceCorridor', position: [cx, 3, -7], range: 16 },
    { id: 'start_vent', kind: 'ventilation', zone: 'startRoom', position: [-3.4, 3, 14.6], range: 8 },
    { id: 'hall_music', kind: 'music', zone: 'hallway', position: [2, 4.5, 2], range: 23 },
    { id: 'food_fridge', kind: 'refrigerator', zone: 'foodCourt', position: [6.5, 2, -13.8], range: 12 },
    { id: 'mart_hvac', kind: 'ventilation', zone: 'megaMart', position: [27.5, 4, -14], range: 16 },
    { id: 'service_hvac', kind: 'ventilation', zone: 'serviceCorridor', position: [cx, 3, -7], range: 12 },
    { id: 'hall_buzz', kind: 'fluorescentBuzz', zone: 'hallway', position: [0, 5.5, 2], range: 10 },
    { id: 'start_buzz', kind: 'fluorescentBuzz', zone: 'startRoom', position: [0, 3.8, 13.5], range: 8 },
    { id: 'mart_buzz', kind: 'fluorescentBuzz', zone: 'megaMart', position: [27, 4.5, -21], range: 10 },
    // Level 2 (the Sunset Promenade, on top of the hallway's ceiling slab: the slab muffles it from below)
    { id: 'level2_music', kind: 'music', zone: 'upstairs', position: [0, upperY + 3, 2], range: 22 },
    { id: 'level2_hvac', kind: 'ventilation', zone: 'upstairs', position: [12, upperY + 3.2, 2], range: 12 },
  ];
  let time = 0;
  function ballastWave(t) {
    const slow = 0.5 + 0.5 * Math.sin((t * Math.PI * 2) / atmosphere.motion.tubePeriod);
    // Failing fluorescent starter stutter when the ballast cycle dips into its trough
    const stutter = slow < 0.35 ? 0.55 + 0.45 * Math.sin(t * 43) * Math.cos(t * 29) : 1;
    return atmosphere.motion.tubeMin + (1.2 - atmosphere.motion.tubeMin) * slow * stutter;
  }
  function pose() {
    hanging.rotation.z = reverse.rotation.z = Math.sin(time * Math.PI * 2 / atmosphere.motion.signPeriod) * atmosphere.motion.signRadians;
    const tubeLevel = ballastWave(time);
    tubeMaterial.emissiveIntensity = tubeLevel;
    // The ambient extras can be switched off (weak computers): lights to zero (kept in the scene, so no shader
    // recompile), the dust motes hidden and not animated.
    const ambient = atmosphere.ambient?.enabled !== false;
    hallwayFlickerLight.intensity = ambient ? flickerCfg.hallwayLightIntensity * tubeLevel : 0;
    for (const light of emergencyLights) light.intensity = ambient ? atmosphere.flicker.emergencyLightIntensity : 0;
    dustPoints.visible = ambient;
    if (!ambient) return;

    const w = (time * Math.PI * 2) / dustCfg.period;
    for (let i = 0; i < dustCfg.count; i++) {
      const i3 = i * 3;
      const phase = dustPhases[i];
      dustPositions[i3] = dustBase[i3] + Math.sin(w + phase) * dustCfg.driftXZ;
      dustPositions[i3 + 1] = dustBase[i3 + 1] + Math.sin(w * 0.85 + phase * 1.7) * dustCfg.driftY;
      dustPositions[i3 + 2] = dustBase[i3 + 2] + Math.cos(w * 0.9 + phase * 1.3) * dustCfg.driftXZ;
    }
    dustPosAttr.needsUpdate = true;
  }
  pose();
  return { group, emitters, update(dt) { time += dt; pose(); }, reset() { time = 0; pose(); } };
}
