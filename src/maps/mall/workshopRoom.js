// =============================================================================
// BUILD-A-BLASTER WORKSHOP: the storefront off the Promenade and the ritual hall behind it.
//   Storefront  two entrances either side of the display window, the order bench in the middle.
//   Back hall   a run-round island (Stuffing Tank + conveyor behind a glass guard), the Naming Booth and
//               lever past the end of the conveyor, the Returns Chute in the north wall.
// Numbers are in config/promenade.js workshop; game/features/workshop*.js gives the room its gameplay.
//
// buildWorkshopRoom({ kit, props, floorY, layout }) ->
//   { purchasePosition, limitedEdition, light, lamps, arrival, stations: { rooms, lever, booth, chute, path } }
// =============================================================================

import * as THREE from 'three';
import { COLORS } from './palette.js';

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

export function buildWorkshopRoom({ kit, props, floorY, layout }) {
  const { workshop: shop, rect, wallThickness: t, height } = layout;
  const { from, to, window, bench, colors: c, hall } = shop;
  const front = rect.maxZ, back = front + shop.depth, center = (from + to) / 2;
  const benchFront = front + bench.offsetZ, benchBack = benchFront + bench.depth;
  const box = (name, x0, h0, z0, x1, h1, z1, color, { collide = false, ...material } = {}) =>
    kit.box(x0, floorY + h0, z0, x1, floorY + h1, z1, kit.mat(color, material),
      { collide, name: 'workshop_' + name });
  const sign = (text, x, h, z, width, signHeight, background = '#523a54', color = '#fff1d7', facing = -1) =>
    kit.sign(text, { x, y: floorY + h, z, width, height: signHeight, facing, background, color });
  const solid = { collide: true };
  const addFloor = (name, x0, z0, x1, z1) => {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0),
      new THREE.MeshStandardMaterial({ map: checkerboard(shop.floor, x1 - x0, z1 - z0), roughness: .74 }));
    floor.name = name;
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((x0 + x1) / 2, floorY + .012, (z0 + z1) / 2);
    kit.group.add(floor);
  };

  // --- Storefront ---------------------------------------------------------------------------------------------------------
  box('west_wall', from - t, 0, front + t, from, height, back, c.wall, solid);
  box('east_wall', to, 0, front + t, to + t, height, back, c.wall, solid);
  box('roof', from - t, height, front + t, to + t, height + t, back, c.cream, solid);
  addFloor('workshop_checkerboard', from, front, to, hall.minZ);

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

  // The order bench, in the middle of the storefront with a lane either side. Everything on the counter is over its footprint.
  const left = center - bench.halfWidth, right = center + bench.halfWidth;
  box('bench_base', left, 0, benchFront, right, bench.height - .07, benchBack, c.cabinet, solid);
  box('bench_top', left, bench.height - .07, benchFront, right, bench.height, benchBack, c.wood, solid);
  for (let i = 0; i < 2; i++) {
    const x = left + .13 + i * .99;
    box('drawer_face', x, .28, benchFront - .025, x + .88, .8, benchFront - .008, c.cream);
    box('drawer_pull', x + .32, .61, benchFront - .067, x + .56, .65, benchFront - .027, c.metal);
  }
  const viseX = left + .1;
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
  box('parts_tray', center + .2, bench.height + .004, benchFront + .47, center + .74, bench.height + .06, benchFront + .72, c.plum);
  for (const [i, color] of [c.red, c.cabinet, 0x74c9bb].entries()) {
    const x = center + .25 + i * .16;
    box('tray_divider', x + .13, bench.height + .06, benchFront + .49, x + .15, bench.height + .105, benchFront + .7, c.cream);
    box('tray_part', x, bench.height + .065, benchFront + .53, x + .10, bench.height + .13, benchFront + .65, color);
  }

  // Parts cubbies down both side walls.
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? from + .045 : to - .48, x1 = x0 + .435;
    const facing = side < 0 ? 'x+' : 'x-';
    const signX = side < 0 ? x1 + .024 : x0 - .024;
    const z0 = front + 2.25, z1 = front + 5.4;
    kit.addCollider(x0, floorY, z0, x1, floorY + 2.46, z1);
    box('cubby_base', x0, 0, z0, x1, .42, z1, c.cream);
    box('cubby_back', side < 0 ? x0 : x1 - .04, .44, z0, side < 0 ? x0 + .04 : x1, 2.46, z1, c.plum);
    for (const h of [.76, 1.21, 1.68, 2.13]) {
      box('shelf', x0 + .018, h, z0 + .055, x1 - .012, h + .048, z1 - .055, c.cream);
      for (let i = 0; i < 6; i++) {
        if ((i + Math.round(h * 10)) % 4 === 0) continue;
        const z = z0 + .17 + i * .47;
        const color = [0x74c9bb, 0xe57b79, 0xf7c75f, 0x94a9e6][(i + Math.round(h * 4)) % 4];
        box('parts_carton', x0 + .095, h + .051, z, x1 - .065, h + .20 + (i % 2) * .056, z + .27, color);
        const labelX = side < 0 ? x1 - .070 : x0 + .086;
        box('carton_label', labelX, h + .102, z + .091, labelX + .014, h + .158, z + .179, c.paper);
      }
    }
    sign(side < 0 ? '01  PICK YOUR PARTS' : '02  MAKE IT YOURS', signX, 2.58,
      (z0 + z1) / 2, 2.48, .28, '#294679', '#fff0cb', facing);
  }

  // Tucked beside the bench, outside the route between the doors.
  const stool = box('overturned_stool', right + .1, .11, benchBack - .46, right + .53, .20, benchBack, c.red);
  stool.rotation.z = -.36;
  for (const z of [benchBack - .4, benchBack - .08]) box('stool_leg', right + .34, .09, z, right + .7, .15, z + .045, c.metal);

  // --- Back hall ----------------------------------------------------------------------------------------------------------
  const H = hall, H0 = H.minZ - t, H1 = H.maxZ + t;
  addFloor('workshop_hall_checkerboard', H.minX, H.minZ, H.maxX, H.maxZ);
  kit.wall({ along: 'x', from: H.minX - t, to: H.maxX + t, at0: H0, at1: H.minZ, bottom: floorY, height: H.height,
    openings: [{ from, to, top: H.mouthTop }] }, kit.mat(c.wall), { name: 'workshop_hall_front' });
  box('hall_west', H.minX - t, 0, H.minZ, H.minX, H.height, H.maxZ, c.wall, solid);
  box('hall_east', H.maxX, 0, H.minZ, H.maxX + t, H.height, H.maxZ, c.wall, solid);
  box('hall_north', H.minX - t, 0, H.maxZ, H.maxX + t, H.height, H1, c.wall, solid);
  box('hall_roof', H.minX - t, H.height, H0, H.maxX + t, H.height + t, H1, c.cream, solid);
  for (const [x, z] of H.panels) props.lightPanel(x - 1.1, z - .55, x + 1.1, z + .55, floorY + H.height, { tint: c.lamp, glow: 1.4 });

  // The island: a glass guard round the conveyor and the tank. One solid block stops feet but not bullets, so nothing
  // inside can be reached or stood on (a player in there would be out of every zombie's reach).
  const I = H.island, rail = .12;
  kit.addCollider(I.minX, floorY, I.minZ, I.maxX, floorY + I.solidHeight, I.maxZ).ignoreShots = true;
  const guardGlass = { transparent: true, opacity: .3, roughness: .1, depthWrite: false };
  for (const [x0, z0, x1, z1] of [[I.minX, I.minZ, I.maxX, I.minZ + rail], [I.minX, I.maxZ - rail, I.maxX, I.maxZ],
    [I.minX, I.minZ + rail, I.minX + rail, I.maxZ - rail], [I.maxX - rail, I.minZ + rail, I.maxX, I.maxZ - rail]]) {
    const thinX = x1 - x0 < z1 - z0;
    box('guard_glass', x0 + (thinX ? .04 : 0), .05, z0 + (thinX ? 0 : .04), x1 - (thinX ? .04 : 0), 1, z1 - (thinX ? 0 : .04), COLORS.balustradeGlass, guardGlass);
    box('guard_rail', x0 - .02, 1, z0 - .02, x1 + .02, 1.08, z1 + .02, COLORS.handrail);
  }
  const belt = H.conveyor, bx0 = I.minX + belt.inset, bx1 = I.maxX - belt.inset, bz0 = I.minZ + belt.inset, bz1 = I.maxZ - belt.inset;
  box('conveyor_south', bx0, 0, bz0, bx1, belt.height, bz0 + belt.width, c.metal, solid);
  box('conveyor_west', bx0, 0, bz0 + belt.width, bx0 + belt.width, belt.height, bz1 - belt.width, c.metal, solid);
  box('conveyor_north', bx0, 0, bz1 - belt.width, bx1, belt.height, bz1, c.metal, solid);
  const tank = H.tank;
  kit.addCollider(tank.x - tank.radius, floorY, tank.z - tank.radius, tank.x + tank.radius, floorY + tank.height, tank.z + tank.radius);
  const cylinder = (name, r, h, y, color, options = {}) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20), kit.mat(color, options));
    mesh.name = 'workshop_' + name;
    mesh.position.set(tank.x, floorY + y, tank.z);
    kit.group.add(mesh);
    return mesh;
  };
  cylinder('tank_pedestal', tank.radius, .7, .35, c.plum);
  cylinder('tank_glass', tank.radius - .08, tank.height - 1.1, .7 + (tank.height - 1.1) / 2, 0xc8eaff,
    { transparent: true, opacity: .22, roughness: .15, depthWrite: false });
  cylinder('tank_stuffing', tank.radius - .2, .9, 1.15, 0xfff5de, { roughness: .9 });
  cylinder('tank_lid', tank.radius, .4, tank.height - .2, c.cream);
  sign('STUFFING TANK', tank.x, .42, tank.z - tank.radius - .03, 1.5, .28, '#ffe39b', '#253c87');

  // Past the end of the conveyor: the Naming Booth, then the lever further along the east wall.
  const B = H.booth, L = H.lever;
  box('naming_booth', B.minX, 0, B.minZ, B.maxX, B.height, B.maxZ, c.cabinet, solid);
  sign('NAMING BOOTH', B.minX - .025, 2.2, (B.minZ + B.maxZ) / 2, 2.4, .36, '#294679', '#fff0cb', 'x-');
  box('lever_box', H.maxX - L.depth, .9, L.z - .3, H.maxX, 1.8, L.z + .3, c.red);
  sign('FINISH EARLY', H.maxX - L.depth - .025, 2.05, L.z, 1.2, .24, '#ffe39b', '#253c87', 'x-');

  // The Returns Chute: a dark hatch in the north wall, with room on the floor below it.
  const C = H.chute;
  box('chute_hatch', C.x - C.width / 2, C.sill, H.maxZ - .06, C.x + C.width / 2, C.top, H.maxZ, 0x1b1b20);
  sign('RETURNS', C.x, C.top + .3, H.maxZ - .03, 1.5, .34, '#c64140', '#fff0cb');

  // Work-order board on the north wall, opposite the mouth.
  const boardX = (H.minX + H.maxX) / 2 + 3, boardZ = H.maxZ;
  box('pegboard', boardX - 1.55, 1.38, boardZ - .09, boardX + 1.55, 2.44, boardZ - .04, c.wood);
  for (let i = 0; i < 8; i++) {
    const x = boardX - 1.4 + i * .37;
    for (const y of [1.56, 1.82, 2.08, 2.30]) box('peg', x, y, boardZ - .11, x + .036, y + .036, boardZ - .094, c.metal);
    if (i % 3 === 1) continue; // gaps in the tool rack
    box('tool_handle', x - .01, 1.65 + i % 2 * .1, boardZ - .155, x + .056, 2.05, boardZ - .115, i % 2 ? c.metal : c.red);
    box('tool_head', x - .048, 2.05, boardZ - .15, x + .102, 2.13, boardZ - .117, c.metal);
  }
  sign('CUSTOM WORK ORDERS · WHILE YOU WAIT', boardX, 2.78, boardZ - .055, 3.9, .42);
  sign('WORK ORDER 018', boardX - 1.01, 1.57, boardZ - .183, .72, .19, '#f5ebd6', '#593c50');

  // The Limited Editions shelf: the display deck behind the window, facing into the shop.
  sign('LIMITED EDITIONS', center, 1.3, front + .68, 1.5, .2, '#c64140', '#fff0cb', 1);

  const lamp = shop.lamp;
  const rideY = floorY + belt.height + shop.rideHeight;
  const beltMiddle = belt.width / 2;
  return {
    purchasePosition: new THREE.Vector3(center, floorY + bench.promptHeight, benchFront - bench.promptInset),
    limitedEdition: new THREE.Vector3(center, floorY + 1.2, front + .75),
    arrival: { position: new THREE.Vector3(center, floorY, benchFront - 1.1), yaw: Math.PI }, // (debug: in front of the bench)
    stations: {
      rooms: layout.sections.filter(s => s.id.startsWith('workshop'))
        .map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ, minY: floorY - .5, maxY: floorY + H.height })),
      lever: new THREE.Vector3(H.maxX - L.depth - .08, floorY + L.height, L.z),
      booth: new THREE.Vector3(B.minX - .08, floorY + B.promptHeight, (B.minZ + B.maxZ) / 2),
      chute: [-1.1, 0, 1.1].map((dx, i) => ({ name: `spawn_workshop_chute_${i}`, zone: 'upstairs',
        position: new THREE.Vector3(C.x + dx, floorY, H.maxZ - C.spawnInset) })),
      path: [[bx1 - .3, bz0 + beltMiddle], [bx0 + beltMiddle, bz0 + beltMiddle], [bx0 + beltMiddle, bz1 - beltMiddle], [bx1 - .3, bz1 - beltMiddle]]
        .map(([x, z]) => new THREE.Vector3(x, rideY, z)),
    },
    light: { ...lamp, x: center + lamp.x, y: floorY + lamp.height, z: front + lamp.offsetZ },
    lamps: H.lamps.map(l => ({ ...H.lampLight, x: l.x, y: floorY + H.lampLight.height, z: l.z })),
  };
}
