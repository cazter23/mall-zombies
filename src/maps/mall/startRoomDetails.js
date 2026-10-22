// The picked-over clearance store. Decoration only: no colliders, interactables or spawn changes.
// Positions are relative to the room's centre X / front Z. Static boxes are merged by material
// so small details don't each cost a draw call. The map kit owns/disposes all resulting resources.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { startRoomLighting } from '../../config/environment.js';

export function buildStartRoomDetails(kit, room) {
  const details = new THREE.Group();
  details.name = 'start_room_details';
  kit.group.add(details);
  const cx = (room.minX + room.maxX) / 2;
  const front = room.minZ;
  const boxes = [];
  const material = (color, options) => kit.mat(color, options);
  const wood = material(0xb38c58), dark = material(0x34383a), metal = material(0x707d80);
  const cream = material(0xeee3c8), red = material(0xb93f39), dust = material(0xbbb09a);
  const tape = material(0xd2bd84);

  function box(name, x0, y0, z0, x1, y1, z1, mat) {
    const mesh = kit.box(cx + x0, y0, front + z0, cx + x1, y1, front + z1, mat, { collide: false, name });
    details.add(mesh);
    boxes.push(mesh);
    return mesh;
  }
  function sign(name, text, x, y, z, width, height, facing, background, color = '#f6edda') {
    const mesh = kit.sign(text, { x: cx + x, y, z: front + z, width, height, facing, background, color });
    mesh.name = name;
    details.add(mesh);
    return mesh;
  }
  function sheet(name, lines, width, height, position, rotation) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ece3c9'; ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = '#514d46'; ctx.font = 'bold 19px monospace'; ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, 128, 45 + i * 37));
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, side: THREE.DoubleSide }));
    mesh.name = name;
    mesh.position.set(cx + position[0], position[1], front + position[2]);
    mesh.rotation.set(...rotation);
    details.add(mesh);
    return mesh;
  }

  // Checkout: keep the right 1.8m of the original counter completely clear for vaulting.
  box('register_drawer', -4.03, 1.025, 7.75, -3.43, 1.15, 8.22, dark);
  box('register_body', -3.98, 1.15, 7.83, -3.48, 1.43, 8.19, cream);
  box('register_display', -3.93, 1.44, 8.02, -3.53, 1.62, 8.14, dark);
  sign('register_screen', '0.00', -3.73, 1.53, 8.009, 0.32, 0.11, -1, '#254438', '#bde2a9');
  box('register_keypad', -3.93, 1.43, 7.82, -3.53, 1.45, 7.99, metal);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
    const x = -3.90 + col * 0.09, z = 7.83 + row * 0.05;
    box('register_key', x, 1.45, z, x + 0.055, 1.465, z + 0.032, row === 2 && col === 3 ? red : cream);
  }
  box('receipt_top', -4.01, 1.025, 7.55, -3.82, 1.035, 7.75, cream);
  sheet('checkout_receipt', ['FINAL SALE', '------------', 'STAPLES x9999', 'STAPLES x9999', 'STAPLES x9999', '------------', 'NO REFUNDS', 'THANK YOU!'],
    0.19, 0.54, [-3.915, 0.755, 7.535], [0, Math.PI, 0]);
  // Two paper bags at the till end; simple rigid handles fit the low-poly style.
  for (const [x, z] of [[-3.34, 7.92], [-3.30, 8.25]]) {
    box('shopping_bag', x, 1.025, z, x + 0.20, 1.32, z + 0.19, wood);
    for (const hx of [x + 0.04, x + 0.15]) box('bag_handle', hx, 1.32, z + 0.08, hx + 0.015, 1.43, z + 0.10, tape);
    box('bag_handle', x + 0.04, 1.415, z + 0.08, x + 0.165, 1.43, z + 0.10, tape);
  }
  sign('no_refunds', 'NO REFUNDS', -2.7, 0.67, 7.589, 1.15, 0.25, -1, '#8f342f');
  // Clipboard rests at the far end, away from the vault route.
  box('inventory_clipboard', -4.12, 1.024, 8.05, -3.88, 1.035, 8.42, wood);
  sheet('inventory_sheet', ['INVENTORY', 'STOCK: 0', 'STAFF: 0', 'PROBLEMS:', 'TOO MANY'], 0.17, 0.28, [-3.99, 1.04, 8.25], [-Math.PI / 2, 0, -0.15]);

  // Shelving: the existing solid carcass remains unchanged. Dress its room-facing edge as shallow
  // shelves; products stay within that silhouette, leaving the walking lane beside it alone.
  for (const y of [0.60, 1.20, 1.80]) {
    box('shelf_dust', -4.99, y + 0.055, 2.08, -4.405, y + 0.06, 5.43, dust);
    for (const z of [2.45, 3.55, 4.70]) {
      box('stock_outline', -4.66, y + 0.061, z, -4.43, y + 0.065, z + 0.31, material(0xd3c9b4));
    }
  }
  for (const [z, y, color] of [[2.3, 0.66, 0xc58346], [4.8, 1.26, 0x83a49a], [3.7, 1.86, 0xb64d45]]) {
    box('last_product', -4.66, y, z, -4.40, y + 0.24, z + 0.20, material(color));
    box('product_label', -4.394, y + 0.06, z + 0.025, -4.387, y + 0.17, z + 0.17, cream);
  }
  box('empty_packaging', -4.70, 0.665, 4.20, -4.40, 0.71, 4.56, wood);
  for (const [z, y, label] of [[2.6, 0.57, '99c'], [4.1, 1.17, 'SOLD'], [5, 1.77, '70% OFF']]) {
    const tag = sign('shelf_tag', label, -4.365, y, z, 0.34, 0.12, 'x+', '#c5ae68', '#403a30');
    tag.rotation.x = 0.06;
  }

  // Boarded entrances: dark backing inset visually into the wall, framed and scraped. No new
  // obstacle in front of either spawn (at z=15.4); all geometry stays behind z=15.82.
  for (const vx of [-3.5, 3.5]) {
    box('vent_shadow', vx - 0.75, 0.18, 9.975, vx + 0.75, 1.70, 9.985, material(0x202629));
    for (const dx of [-0.82, 0.75]) box('vent_frame', vx + dx, 0.12, 9.84, vx + dx + 0.07, 1.78, 9.97, metal);
    for (const y of [0.12, 1.70]) box('vent_frame', vx - 0.82, y, 9.84, vx + 0.82, y + 0.08, 9.97, metal);
    for (const y of [0.38, 0.70, 1.05, 1.40]) {
      const grille = box('bent_grille', vx - 0.71, y, 9.91, vx + 0.71, y + 0.035, 9.94, dark);
      grille.rotation.z = y === 1.40 ? 0.07 : -0.025;
    }
    for (const [i, y] of [0.45, 0.80, 1.15].entries()) {
      const plank = box('vent_board', vx - 0.70, y, 9.82, vx + 0.70, y + 0.20, 9.88, wood);
      plank.rotation.z = (i - 1) * 0.045;
      for (const dx of [-0.60, 0.60]) box('board_nail', vx + dx, y + 0.08, 9.811, vx + dx + 0.025, y + 0.105, 9.819, dark);
    }
    for (let i = 0; i < 3; i++) {
      const scrape = box('vent_scrape', vx + 0.85 + i * 0.065, 0.65 + i * 0.09, 9.981, vx + 0.87 + i * 0.065, 1.20 + i * 0.09, 9.988, dust);
      scrape.rotation.z = -0.12;
    }
  }

  // Final-sale walls: faded patches where posters were removed, leftover tape, a peeled sticker.
  box('faded_poster', -4.986, 2.35, 3.1, -4.976, 3.21, 4.15, material(0xd8cbb4));
  for (const z of [3.15, 3.98]) box('poster_tape', -4.966, 3.13, z, -4.956, 3.24, z + 0.12, tape);
  sign('sale_sticker', '70% OFF', -4.945, 2.73, 3.65, 0.73, 0.35, 'x+', '#ac3d35');
  box('peeled_sticker_corner', -4.94, 2.87, 3.9, -4.91, 2.92, 4.01, cream).rotation.x = -0.16;
  const final = sign('final_sale_banner', 'ALL SALES FINAL', 0.35, 3.30, 9.96, 3.25, 0.40, -1, '#b44638');
  final.rotation.z = -0.045;
  box('employee_frame', 4.91, 2.02, 6.35, 4.98, 2.98, 7.15, wood);
  sign('employee_title', 'EMPLOYEE OF THE MONTH', 4.899, 2.82, 6.75, 0.69, 0.14, 'x-', '#574b3a');
  box('missing_photo', 4.89, 2.10, 6.46, 4.90, 2.65, 7.04, material(0xe1d2b2));
  for (const z of [6.5, 6.93]) box('photo_tape', 4.875, 2.53, z, 4.885, 2.70, z + 0.07, tape);

  // Price Gun station: frame around the existing outline, never over the gun or its label.
  sign('pricing_station_title', 'FINAL MARKDOWN', 4.97, 2.23, 4, 1.42, 0.28, 'x-', '#8f342f');
  box('pricing_station_sill', 4.72, 0.92, 3.20, 4.99, 0.98, 4.80, wood);
  for (const z of [3.32, 4.40]) {
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.14, 10), cream);
    roll.rotation.z = Math.PI / 2;
    roll.position.set(cx + 4.83, 1.065, front + z);
    roll.name = 'price_label_roll'; details.add(roll);
    box('label_roll_core', 4.751, 1.04, z - 0.023, 4.761, 1.09, z + 0.023, wood);
  }
  sign('pricing_station_note', 'MARK IT DOWN. AGAIN.', 4.97, 0.67, 4, 1.35, 0.19, 'x-', '#c5ae68', '#403a30');

  // Floor wear and scraps are thin decoration, placed near existing furniture/perimeter only.
  for (const [x, z, length, angle] of [[-3.8, 7.05, 0.45, 0.2], [-3.45, 7.20, 0.35, -0.3], [-4.05, 5.5, 0.28, 0.35], [4.35, 4.65, 0.30, -0.5]]) {
    box('floor_scuff', x, 0.006, z, x + 0.035, 0.009, z + length, dust).rotation.y = angle;
  }
  for (const [x, z, angle] of [[-4.15, 6.6, 0.3], [4.15, 6.9, -0.25], [3.9, 8.8, 0.6]]) {
    const paper = box('floor_receipt', x, 0.012, z, x + 0.12, 0.015, z + 0.28, cream);
    paper.rotation.y = angle;
  }
  box('flattened_carton', 3.5, 0.006, 9.04, 4.35, 0.018, 9.48, wood);
  box('carton_fold', 3.92, 0.019, 9.05, 3.94, 0.022, 9.47, tape);

  // Broken ceiling fitting around the existing dead panel; the working panel gets a slim frame.
  for (const z of [3.4, 7]) {
    for (const x of [-1.05, 1.0]) box('light_housing', x, room.height - 0.11, z - 0.05, x + 0.05, room.height - 0.065, z + 1.05, metal);
    for (const zz of [z - 0.05, z + 1]) box('light_housing', -1, room.height - 0.11, zz, 1, room.height - 0.065, zz + 0.05, metal);
  }
  box('damaged_diffuser', 0.60, room.height - 0.17, 7.12, 0.95, room.height - 0.12, 7.86, dust).rotation.z = -0.12;
  for (const z of [7.25, 7.70]) box('broken_light_tube', -0.72, room.height - 0.12, z, 0.42, room.height - 0.08, z + 0.035, dark);

  for (const cfg of startRoomLighting) {
    const light = new THREE.PointLight(cfg.color, cfg.intensity, cfg.distance, 2);
    light.name = cfg.name;
    light.position.set(cx + cfg.x, cfg.y, front + cfg.z);
    details.add(light);
  }

  // Keep text and cylinders separate; batch the many static boxes by shared material.
  const batches = new Map();
  for (const mesh of boxes) {
    mesh.updateMatrix(); mesh.geometry.applyMatrix4(mesh.matrix);
    if (!batches.has(mesh.material)) batches.set(mesh.material, []);
    batches.get(mesh.material).push(mesh.geometry);
    mesh.removeFromParent();
  }
  for (const [mat, geometries] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(geometries), mat);
    mesh.name = 'start_room_detail_batch'; details.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  return details;
}
