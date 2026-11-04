import * as THREE from 'three';
import { seededRandom } from '../../world/textures.js';

function checkerboard({ light, dark, grout, tileSize }, width, depth) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = grout;
  ctx.fillRect(0, 0, 128, 128);
  for (let row = 0; row < 2; row++) for (let column = 0; column < 2; column++) {
    const x = column * 64, y = row * 64;
    ctx.fillStyle = (row + column) % 2 ? dark : light;
    ctx.fillRect(x + 1, y + 1, 62, 62);
    ctx.fillStyle = 'rgba(255,255,255,.07)';
    ctx.fillRect(x + 3, y + 3, 58, 4);
    ctx.fillRect(x + 3, y + 8, 3, 52);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(width / (2 * tileSize), depth / (2 * tileSize));
  return map;
}

export function buildWorkshopRoom({ kit, floorY, layout }) {
  const { workshop: shop, rect, wallThickness: t, height } = layout;
  const { from, to, window, bench, colors: c } = shop;
  const front = rect.maxZ, back = front + shop.depth, center = (from + to) / 2;
  const benchFront = front + bench.offsetZ, benchBack = benchFront + bench.depth;
  const box = (name, x0, h0, z0, x1, h1, z1, color, { collide = false, ...material } = {}) =>
    kit.box(x0, floorY + h0, z0, x1, floorY + h1, z1, kit.mat(color, material),
      { collide, name: 'workshop_' + name });
  const sign = (text, x, h, z, width, signHeight, background = '#523a54', color = '#fff1d7', facing = -1) =>
    kit.sign(text, { x, y: floorY + h, z, width, height: signHeight, facing, background, color });
  const solid = { collide: true };

  box('west_wall', from - t, 0, front + t, from, height, back + t, c.wall, solid);
  box('east_wall', to, 0, front + t, to + t, height, back + t, c.wall, solid);
  box('back_wall', from, 0, back, to, height, back + t, c.wall, solid);
  box('roof', from - t, height, front + t, to + t, height + t, back + t, c.cream, solid);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(to - from, back - front),
    new THREE.MeshStandardMaterial({ map: checkerboard(shop.floor, to - from, back - front), roughness: .74 }));
  floor.name = 'workshop_checkerboard';
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(center, floorY + .012, (front + back) / 2);
  kit.group.add(floor);

  // Both entrances stay open. Only the central display window blocks crossing.
  box('sill', window.from, 0, front, window.to, window.sill, front + t, c.plum, solid);
  box('glass', window.from, window.sill, front + .11, window.to, window.top, front + .15, c.glass,
    { collide: true, transparent: true, opacity: .18, roughness: .18 });
  box('window_mullion', center - .025, window.sill, front + .067, center + .025, window.top, front + .095, c.plum);
  for (const entry of shop.entrances) {
    // The roller sits above each opening, with staggered bands suggesting coiled slats.
    box('shutter_housing', entry.from + .04, entry.top + .025, front - .13, entry.to - .04, entry.top + .18, front - .015, c.metal);
    box('shutter_lip', entry.from + .07, entry.top + .035, front - .16, entry.to - .07, entry.top + .07, front - .132, c.cabinet);
  }
  sign('CHOOSE  •  BUILD  •  NAME YOUR BLASTER', center, 1.38, front + .1, 1.48, .16, 'transparent', '#fff4dc');
  box('display_deck', window.from + .09, .69, front + .24, window.to - .09, .77, front + .65, c.plum);
  for (const [i, color] of [c.red, 0x74c9bb, c.cabinet].entries()) {
    const x = center + (i - 1) * .48;
    const top = .98 + (i % 2) * .13;
    box('display_kit', x - .17, .78, front + .30, x + .17, top, front + .56, color);
    sign('MAKE KIT', x, top - .08, front + .274, .28, .09, '#fff0cb', '#253c87');
  }
  for (const side of [-1, 1]) {
    const x = side < 0 ? from + .035 : to - .035;
    const facing = side < 0 ? 'x+' : 'x-';
    sign(side < 0 ? 'TODAY’S BUILD CLUB' : 'MADE AT SUNSET GALLERIA', x, 2.03,
      front + 1.28, 1.16, .32, '#294679', '#fff0cb', facing);
    sign(side < 0 ? 'PICK  /  STUFF  /  STAMP' : 'TAKE HOME SOMETHING LOUD', x, 1.69,
      front + 1.28, 1.16, .23, '#ffe39b', '#253c87', facing);
  }

  // Back bench. Everything on the counter is over its collision footprint.
  const left = center - bench.halfWidth, right = center + bench.halfWidth;
  box('bench_base', left, 0, benchFront, right, bench.height - .07, benchBack, c.cabinet, solid);
  box('bench_top', left, bench.height - .07, benchFront, right, bench.height, benchBack, c.wood, solid);
  for (let i = 0; i < 3; i++) {
    const x = left + .13 + i * .99;
    box('drawer_face', x, .28, benchFront - .025, x + .88, .8, benchFront - .008, c.cream);
    box('drawer_pull', x + .32, .61, benchFront - .067, x + .56, .65, benchFront - .027, c.metal);
  }
  const viseX = left + .25;
  box('vise_body', viseX, bench.height + .005, benchFront + .12, viseX + .4, bench.height + .18, benchFront + .39, c.red);
  for (const dx of [.012, .278]) box('vise_jaw', viseX + dx, bench.height + .17, benchFront + .1,
    viseX + dx + .11, bench.height + .25, benchFront + .42, c.metal);
  box('vise_handle', viseX + .11, bench.height + .085, benchFront + .047, viseX + .33, bench.height + .113, benchFront + .1, c.metal);
  box('receipt_printer', right - .55, bench.height + .005, benchFront + .12, right - .16, bench.height + .17, benchFront + .43, c.plum);
  box('receipt_tail', right - .44, bench.height + .06, benchFront + .04, right - .28, bench.height + .072, benchFront + .13, c.paper);
  const receipt = box('receipt_curl', right - .44, bench.height + .016, benchFront + .008, right - .28, bench.height + .026, benchFront + .082, c.paper);
  receipt.rotation.x = -.6;
  box('unfinished_order', center - .3, bench.height + .006, benchFront + .2, center + .18, bench.height + .016, benchFront + .53, c.paper);
  box('order_pencil', center - .22, bench.height + .018, benchFront + .36, center + .06, bench.height + .038, benchFront + .385, c.red);
  box('parts_tray', center + .28, bench.height + .004, benchFront + .47, center + .82, bench.height + .06, benchFront + .72, c.plum);
  for (const [i, color] of [c.red, c.cabinet, 0x74c9bb].entries()) {
    const x = center + .33 + i * .16;
    box('tray_divider', x + .13, bench.height + .06, benchFront + .49, x + .15, bench.height + .105, benchFront + .7, c.cream);
    box('tray_part', x, bench.height + .065, benchFront + .53, x + .10, bench.height + .13, benchFront + .65, color);
  }

  box('pegboard', left, 1.38, back - .09, right, 2.44, back - .04, c.wood);
  for (let i = 0; i < 8; i++) {
    const x = left + .15 + i * .37;
    for (const y of [1.56, 1.82, 2.08, 2.30]) box('peg', x, y, back - .11, x + .036, y + .036, back - .094, c.metal);
    if (i % 3 === 1) continue; // gaps in the tool rack
    box('tool_handle', x - .01, 1.65 + i % 2 * .1, back - .155, x + .056, 2.05, back - .115, i % 2 ? c.metal : c.red);
    box('tool_head', x - .048, 2.05, back - .15, x + .102, 2.13, back - .117, c.metal);
  }
  sign('CUSTOM WORK ORDERS · WHILE YOU WAIT', center, 2.78, back - .055, 3.9, .42);
  sign('WORK ORDER 018', left + .54, 1.57, back - .183, .72, .19, '#f5ebd6', '#593c50');
  box('lamp_bracket', center - .38, 2.39, back - .57, center + .38, 2.55, back - .095, c.plum);
  box('lamp_diffuser', center - .33, 2.345, back - .55, center + .33, 2.382, back - .19, c.lamp,
    { emissive: c.lamp, emissiveIntensity: 1.5 });

  // Product-neutral cubbies and a fitting station leave room for future work orders.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? from + .045 : to - .48, x1 = x0 + .435;
    const facing = side < 0 ? 'x+' : 'x-';
    const signX = side < 0 ? x1 + .024 : x0 - .024;
    const z0 = front + 2.25, z1 = front + 5.8;
    kit.addCollider(x0, floorY, z0, x1, floorY + 2.46, z1);
    box('cubby_base', x0, 0, z0, x1, .42, z1, c.cream);
    box('cubby_back', side < 0 ? x0 : x1 - .04, .44, z0, side < 0 ? x0 + .04 : x1, 2.46, z1, c.plum);
    for (const h of [.76, 1.21, 1.68, 2.13]) {
      box('shelf', x0 + .018, h, z0 + .055, x1 - .012, h + .048, z1 - .055, c.cream);
      for (let i = 0; i < 6; i++) {
        if ((i + Math.round(h * 10)) % 4 === 0) continue;
        const z = z0 + .20 + i * .52;
        const color = [0x74c9bb, 0xe57b79, 0xf7c75f, 0x94a9e6][(i + Math.round(h * 4)) % 4];
        box('parts_carton', x0 + .095, h + .051, z, x1 - .065, h + .20 + (i % 2) * .056, z + .27, color);
        const labelX = side < 0 ? x1 - .070 : x0 + .086;
        box('carton_label', labelX, h + .102, z + .091, labelX + .014, h + .158, z + .179, c.paper);
      }
    }
    sign(side < 0 ? '01  PICK YOUR PARTS' : '02  MAKE IT YOURS', signX, 2.58,
      (z0 + z1) / 2, 2.48, .28, '#294679', '#fff0cb', facing);
  }

  // A tall stuffing tower is the landmark. Keep the two broad lanes beside it open.
  const machineZ = front + shop.machine.offsetZ, radius = shop.machine.radius;
  kit.addCollider(center - radius, floorY, machineZ - radius, center + radius, floorY + 2.82, machineZ + radius);
  const cylinder = (name, r, h, y, color, options = {}, x = center, z = machineZ) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 16), kit.mat(color, options));
    mesh.name = 'workshop_' + name;
    mesh.position.set(x, floorY + y, z);
    kit.group.add(mesh);
    return mesh;
  };
  cylinder('tower_pedestal', radius, .78, .41, c.plum);
  cylinder('tower_lower_band', radius + .05, .12, .86, 0x4268bd);
  cylinder('tower_upper_band', radius + .045, .20, 2.41, 0x4268bd);
  cylinder('tower_lid', radius - .04, .1, 2.56, c.cream);
  cylinder('stuffing_glass', radius - .082, 1.42, 1.62, 0xc8eaff,
    { transparent: true, opacity: .2, roughness: .15, depthWrite: false });
  cylinder('stuffing_spindle', .047, 1.51, 1.58, c.metal);
  const fluffGeometry = new THREE.IcosahedronGeometry(1, 1);
  const fluffMaterial = kit.mat(0xfff5de, { roughness: .9 });
  const fluff = new THREE.InstancedMesh(fluffGeometry, fluffMaterial, 58);
  fluff.name = 'workshop_stuffing';
  const rng = seededRandom(86), form = new THREE.Object3D();
  for (let i = 0; i < fluff.count; i++) {
    const angle = rng() * Math.PI * 2, r = Math.sqrt(rng()) * .49, size = .085 + rng() * .10;
    form.position.set(center + Math.cos(angle) * r, floorY + .99 + rng() * .39, machineZ + Math.sin(angle) * r);
    form.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    form.scale.set(size * 1.14, size, size * .93);
    form.updateMatrix();
    fluff.setMatrixAt(i, form.matrix);
  }
  kit.group.add(fluff);
  sign('STUFF-O-MATIC', center, .50, machineZ - radius - .026, 1.11, .27, '#ffe39b', '#253c87');
  // The operator station faces the rear bench. Keep its controls over the tower footprint.
  box('control_panel', center - .25, .39, machineZ + .60, center + .25, .70, machineZ + .695, c.metal);
  sign('FILL  /  PURGE', center, .625, machineZ + .723, .43, .10, '#ffe39b', '#253c87', 1);
  for (const [i, color] of [0x74c9bb, c.cabinet, c.red].entries()) {
    const x = center - .15 + i * .12;
    box('panel_button', x, .46, machineZ + .698, x + .06, .52, machineZ + .716, color);
  }
  for (const dx of [-.44, .44]) {
    cylinder('glass_support', .034, 1.43, 1.62, c.metal, {}, center + dx, machineZ + .43);
    cylinder('support_collar', .057, .09, .98, c.cabinet, {}, center + dx, machineZ + .43);
    cylinder('support_collar', .057, .09, 2.28, c.cabinet, {}, center + dx, machineZ + .43);
  }
  for (const dx of [-.31, .31]) {
    const ear = new THREE.Mesh(new THREE.IcosahedronGeometry(.123, 1), kit.mat(0xf0b854));
    ear.position.set(center + dx * .68, floorY + 2.95, machineZ);
    kit.group.add(ear);
  }
  const mascot = new THREE.Mesh(new THREE.IcosahedronGeometry(.24, 1), kit.mat(0xf0b854));
  mascot.name = 'workshop_mascot';
  mascot.position.set(center, floorY + 2.82, machineZ);
  mascot.scale.set(1.14, 1, .87);
  kit.group.add(mascot);
  const muzzle = new THREE.Mesh(new THREE.IcosahedronGeometry(.105, 1), kit.mat(c.cream));
  muzzle.position.set(center, floorY + 2.77, machineZ - .177);
  kit.group.add(muzzle);
  for (const dx of [-.086, .086]) box('mascot_eye', center + dx - .022, 2.85, machineZ - .208,
    center + dx + .022, 2.895, machineZ - .172, c.metal);
  box('mascot_nose', center - .03, 2.781, machineZ - .285, center + .03, 2.824, machineZ - .24, c.metal);
  sign('03  FINISH YOUR BUILD', center, 3.18, back - .053, 3.2, .24, '#ffe39b', '#253c87');

  // Tucked beside the bench, outside the route between the doors.
  const stool = box('overturned_stool', right + .36, .11, benchFront + .16, right + .79, .20, benchFront + .62, c.red);
  stool.rotation.z = -.36;
  for (const z of [benchFront + .22, benchFront + .54]) box('stool_leg', right + .6, .09, z, right + .96, .15, z + .045, c.metal);
  const lamp = shop.lamp;
  return {
    purchasePosition: new THREE.Vector3(center, floorY + bench.promptHeight, benchFront - bench.promptInset),
    light: { ...lamp, x: center + lamp.x, y: floorY + lamp.height, z: front + lamp.offsetZ },
  };
}
