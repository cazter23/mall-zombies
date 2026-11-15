// =============================================================================
// BUILD-A-BLASTER WORKSHOP: the storefront off the Promenade and the ritual hall behind it.
//   Storefront  two entrances either side of the display window, the order bench in the middle.
//   Back hall   a run-round island (Stuffing Tank + conveyor behind a glass guard), the Naming Booth and
//               lever past the end of the conveyor, the Returns Chute in the north wall.
// Numbers are in config/promenade.js workshop; game/features/workshop*.js gives the room its gameplay.
//
// buildWorkshopRoom({ kit, props, floorY, layout }) ->
//   { purchasePosition, light, lamps, arrival, stations: { rooms, lever, booth, chute, path } }
// =============================================================================

import * as THREE from 'three';
import { COLORS } from './palette.js';
import { workshopHearts, workshopRitual, workshopStuffings } from '../../config/workshop.js';
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

// The belt: dark slats on a repeating texture, so sliding its offset runs the conveyor.
function beltTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64; canvas.height = 8;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2d36';
  ctx.fillRect(0, 0, 64, 8);
  ctx.fillStyle = '#4a4f5e';
  ctx.fillRect(0, 0, 10, 8);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
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
    kit.sign(text, { x, y: floorY + h, z, width, height: signHeight, facing, background, color, font: 'toyBrand' });
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
    sign(side < 0 ? 'CHOOSE YOUR BLASTER' : 'THE HEART CEREMONY', x, 2.03,
      front + 1.28, 1.16, .32, '#294679', '#fff0cb', facing);
    sign(side < 0 ? 'EVERY ONE NEEDS A HOME' : 'WARM IT · MAKE A WISH', x, 1.69,
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
    for (const h of side < 0 ? [.76, 1.21, 1.68, 2.13] : [1.68, 2.13]) { // (the east cubby's lower shelves are the Heart wall)
      box('shelf', x0 + .018, h, z0 + .055, x1 - .012, h + .048, z1 - .055, c.cream);
      for (let i = 0; i < 6; i++) {
        if ((i + Math.round(h * 10)) % 4 === 0 || (side < 0 && h < 1)) continue; // (the west cubby's bottom shelf holds the bins)
        const z = z0 + .17 + i * .47;
        const color = [0x74c9bb, 0xe57b79, 0xf7c75f, 0x94a9e6][(i + Math.round(h * 4)) % 4];
        box('parts_carton', x0 + .095, h + .051, z, x1 - .065, h + .20 + (i % 2) * .056, z + .27, color);
        const labelX = side < 0 ? x1 - .070 : x0 + .086;
        box('carton_label', labelX, h + .102, z + .091, labelX + .014, h + .158, z + .179, c.paper);
      }
    }
    sign(side < 0 ? '01  TODAY’S STUFFINGS' : '02  PICK A HEART', signX, 2.58,
      (z0 + z1) / 2, 2.48, .28, '#294679', '#fff0cb', facing);
  }

  // The bins: one per stuffing, on the west cubby's bottom shelf. The strip above a bin lights while it is in today's stock.
  const cubbyFace = from + .48, B0 = shop.bins, heartFace = to - .48, HW = shop.hearts;
  // (Shown and hidden at runtime: one dynamic group keeps them out of static batching, like the neon.)
  const binLamps = new THREE.Group();
  binLamps.name = 'workshop_bin_lamps';
  binLamps.userData.dynamic = true;
  kit.group.add(binLamps);
  const bins = Object.entries(workshopStuffings).map(([id, stuffing], i) => {
    const z = front + B0.firstOffsetZ + i * B0.spacing;
    box('bin', cubbyFace - .36, B0.sill, z - B0.width / 2, cubbyFace - .02, B0.top, z + B0.width / 2, stuffing.color);
    kit.sign(stuffing.name.toUpperCase(), { x: cubbyFace + .004, y: floorY + (B0.sill + B0.top) / 2, z, width: B0.width - .03, height: .11, facing: 'x+', background: '#fff0cb', color: '#253c87', font: 'toyBody' });
    const lamp = box('bin_lamp', cubbyFace - .12, B0.top + .012, z - B0.width / 2 + .02, cubbyFace - .03, B0.top + .04, z + B0.width / 2 - .02, stuffing.color,
      { emissive: stuffing.color, emissiveIntensity: 2.2 });
    binLamps.add(lamp);
    lamp.visible = false;
    return { id, position: new THREE.Vector3(cubbyFace + .1, floorY + B0.promptHeight, z), lamp };
  });
  // The Heart wall: one per Heart, on the back of the east cubby.
  const hearts = Object.keys(workshopHearts).map((id, i) => {
    const z = front + HW.firstOffsetZ + i * HW.spacing, half = HW.size / 2;
    box('heart_plaque', heartFace + .1, HW.height - half - .08, z - half - .08, heartFace + .44, HW.height + half + .08, z + half + .08, c.plum);
    kit.sign('♥', { x: heartFace + .08, y: floorY + HW.height + .05, z, width: HW.size, height: HW.size, facing: 'x-', background: 'transparent', color: '#e04a68', font: 'toyBody' });
    kit.sign(workshopHearts[id].name.toUpperCase(), { x: heartFace + .072, y: floorY + HW.height - half + .02, z, width: HW.size + .12, height: .09, facing: 'x-', background: 'transparent', color: '#fff0cb', font: 'toyBody' });
    return { id, position: new THREE.Vector3(heartFace - .1, floorY + HW.promptHeight, z) };
  });

  // Tucked beside the bench, outside the route between the doors.
  const stool = box('overturned_stool', right + .1, .11, benchBack - .46, right + .53, .20, benchBack, c.red);
  stool.rotation.z = -.36;
  for (const z of [benchBack - .4, benchBack - .08]) box('stool_leg', right + .34, .09, z, right + .7, .15, z + .045, c.metal);

  // --- Back hall ----------------------------------------------------------------------------------------------------------
  const H = hall, H0 = H.minZ - t, H1 = H.maxZ + t;
  addFloor('workshop_hall_checkerboard', H.minX, H.minZ, H.maxX, H.maxZ);
  kit.wall({ along: 'x', from: H.minX - t, to: H.maxX + t, at0: H0, at1: H.minZ, bottom: floorY, height: H.height,
    openings: [{ from, to, top: H.mouthTop }] }, kit.mat(c.wall), { name: 'workshop_hall_front' });
  box('hall_west', H.minX - t, 0, H.minZ, H.minX, H.height, H.maxZ, c.hallWall, solid); // (workshop grey: the factory floor)
  box('hall_east', H.maxX, 0, H.minZ, H.maxX + t, H.height, H.maxZ, c.hallWall, solid);
  box('hall_north', H.minX - t, 0, H.maxZ, H.maxX + t, H.height, H1, c.hallWall, solid);
  box('hall_roof', H.minX - t, H.height, H0, H.maxX + t, H.height + t, H1, c.hallRoof, solid);
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
    box('guard_rail', x0 - .02, 1, z0 - .02, x1 + .02, 1.08, z1 + .02, COLORS.balustradeRail);
  }
  const belt = H.conveyor, bx0 = I.minX + belt.inset, bx1 = I.maxX - belt.inset, bz0 = I.minZ + belt.inset, bz1 = I.maxZ - belt.inset;
  box('conveyor_south', bx0, 0, bz0, bx1, belt.height, bz0 + belt.width, c.metal, solid);
  box('conveyor_west', bx0, 0, bz0 + belt.width, bx0 + belt.width, belt.height, bz1 - belt.width, c.metal, solid);
  box('conveyor_north', bx0, 0, bz1 - belt.width, bx1, belt.height, bz1, c.metal, solid);
  // Hazard lips down both edges of the belt, then the belt itself: one texture, three strips, so a single offset runs them all.
  for (const [x0, z0, x1, z1] of [[bx0, bz0, bx1, bz0 + .05], [bx0 + belt.width, bz0 + belt.width - .05, bx1, bz0 + belt.width],
    [bx0, bz1 - .05, bx1, bz1], [bx0 + belt.width, bz1 - belt.width, bx1, bz1 - belt.width + .05],
    [bx0, bz0 + belt.width, bx0 + .05, bz1 - belt.width], [bx0 + belt.width - .05, bz0 + belt.width, bx0 + belt.width, bz1 - belt.width]]) {
    box('conveyor_lip', x0, belt.height, z0, x1, belt.height + .05, z1, c.cabinet);
  }
  const beltMaterial = new THREE.MeshStandardMaterial({ map: beltTexture(), roughness: .8 });
  const beltRig = new THREE.Group();
  beltRig.name = 'workshop_belt_rig';
  beltRig.userData.dynamic = true; // (its texture slides: keep it out of static batching)
  kit.group.add(beltRig);
  const beltY = floorY + belt.height + .012;
  const addBelt = (length, x, z, angle) => {
    const geometry = new THREE.PlaneGeometry(length, belt.width - .1);
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * length / belt.slatMeters);
    const strip = new THREE.Mesh(geometry, beltMaterial);
    strip.name = 'workshop_belt';
    strip.rotation.set(-Math.PI / 2, 0, angle);
    strip.position.set(x, beltY, z);
    beltRig.add(strip);
  };
  const beltMiddle = belt.width / 2;
  addBelt(bx1 - bx0, (bx0 + bx1) / 2, bz0 + beltMiddle, Math.PI); // south, running west
  addBelt(bz1 - bz0 - 2 * belt.width, bx0 + beltMiddle, (bz0 + bz1) / 2, Math.PI / 2); // west, running north
  addBelt(bx1 - bx0, (bx0 + bx1) / 2, bz1 - beltMiddle, 0); // north, running east

  // The Stuffing Tank: a glass drum with the quality marks painted up it, filling as the room does. A mascot on the lid, for the kids.
  const tank = H.tank, gaugeRange = tank.gaugeTop - tank.gaugeBase;
  kit.addCollider(tank.x - tank.radius, floorY, tank.z - tank.radius, tank.x + tank.radius, floorY + tank.height, tank.z + tank.radius);
  const cylinder = (name, r, h, y, color, options = {}, x = tank.x, z = tank.z) => {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), kit.mat(color, options));
    mesh.name = 'workshop_' + name;
    mesh.position.set(x, floorY + y, z);
    kit.group.add(mesh);
    return mesh;
  };
  cylinder('tank_pedestal', tank.radius, tank.gaugeBase, tank.gaugeBase / 2, c.plum);
  cylinder('tank_band_low', tank.radius + .05, .12, tank.gaugeBase + .06, 0x4268bd);
  cylinder('tank_band_high', tank.radius + .05, .16, tank.height - .46, 0x4268bd);
  cylinder('tank_lid', tank.radius - .04, .3, tank.height - .2, c.cream);
  cylinder('tank_spindle', .07, tank.height - tank.gaugeBase, (tank.height + tank.gaugeBase) / 2, c.metal);
  const glassHeight = tank.height - tank.gaugeBase - .4;
  cylinder('tank_glass', tank.radius - .08, glassHeight, tank.gaugeBase + glassHeight / 2, 0xc8eaff,
    { transparent: true, opacity: .2, roughness: .15, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    cylinder('tank_post', .035, glassHeight, tank.gaugeBase + glassHeight / 2, c.metal, {},
      tank.x + Math.cos(a) * (tank.radius - .04), tank.z + Math.sin(a) * (tank.radius - .04));
  }
  // The marks: a painted line at each quality's kill count, its name facing the room on both sides.
  const topKills = workshopRitual.qualities.at(-1).minKills;
  for (const quality of workshopRitual.qualities.slice(1)) {
    const y = tank.gaugeBase + (quality.minKills / topKills) * gaugeRange;
    cylinder('tank_mark', tank.radius - .065, .035, y, c.red);
    for (const [side, facing] of [[-1, -1], [1, 1]]) {
      kit.sign(quality.name.toUpperCase(), { x: tank.x, y: floorY + y + .09, z: tank.z + side * (tank.radius - .05), width: .95, height: .14, facing, background: 'transparent', color: '#c64140', font: 'toyBody' });
    }
  }
  sign('STUFFING TANK', tank.x, tank.gaugeBase / 2 + .06, tank.z - tank.radius - .03, 1.5, .28, '#ffe39b', '#253c87');
  sign('STUFF-O-MATIC', tank.x, tank.gaugeBase / 2 + .06, tank.z + tank.radius + .03, 1.5, .28, '#ffe39b', '#253c87', 1);
  const mascotAt = tank.height + .22, mascotColor = 0xf0b854, mascot = (name, r, dx, dy, dz, sx = 1, sy = 1, sz = 1, color = mascotColor) => {
    const part = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), kit.mat(color));
    part.name = 'workshop_' + name;
    part.position.set(tank.x + dx, floorY + mascotAt + dy, tank.z + dz);
    part.scale.set(sx, sy, sz);
    kit.group.add(part);
  };
  mascot('mascot', .34, 0, 0, 0, 1.14, 1, .87);
  mascot('mascot_ear', .17, -.27, .28, 0);
  mascot('mascot_ear', .17, .27, .28, 0);
  mascot('mascot_muzzle', .15, 0, -.07, -.25, 1, 1, 1, c.cream);
  for (const dx of [-.12, .12]) box('mascot_eye', tank.x + dx - .03, mascotAt + .07, tank.z - .3, tank.x + dx + .03, mascotAt + .13, tank.z - .25, c.metal);

  // What moves inside: stuffing rising in the drum, and fluff turning in it. One dynamic group, out of static batching.
  const fillRig = new THREE.Group();
  fillRig.name = 'workshop_tank_fill';
  fillRig.userData.dynamic = true;
  kit.group.add(fillRig);
  const fillGeometry = new THREE.CylinderGeometry(tank.radius - .16, tank.radius - .16, 1, 24);
  fillGeometry.translate(0, .5, 0); // scales up from the bottom
  const fillMaterial = new THREE.MeshStandardMaterial({ color: 0xfff5de, roughness: .9, flatShading: true });
  const fill = new THREE.Mesh(fillGeometry, fillMaterial);
  fill.name = 'workshop_tank_stuffing';
  fill.position.set(tank.x, floorY + tank.gaugeBase, tank.z);
  fill.scale.y = .02;
  fillRig.add(fill);
  const fluff = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), kit.mat(0xfff5de, { roughness: .9 }), tank.fluffCount);
  fluff.name = 'workshop_stuffing';
  fluff.position.set(tank.x, floorY + tank.gaugeBase, tank.z);
  const rng = seededRandom(86), form = new THREE.Object3D();
  for (let i = 0; i < fluff.count; i++) {
    const angle = rng() * Math.PI * 2, r = Math.sqrt(rng()) * (tank.radius - .4), size = .09 + rng() * .12;
    form.position.set(Math.cos(angle) * r, rng() * gaugeRange, Math.sin(angle) * r);
    form.rotation.set(rng() * 3, rng() * 3, rng() * 3);
    form.scale.set(size * 1.14, size, size * .93);
    form.updateMatrix();
    fluff.setMatrixAt(i, form.matrix);
  }
  fluff.count = 0; // grows with the gauge
  fillRig.add(fluff);

  // Past the end of the conveyor: a gantry carries the gun over the lane to the Naming Booth's counter, and the lever is further along the wall.
  const B = H.booth, L = H.lever, A = H.arm, boothZ = (B.minZ + B.maxZ) / 2, armStartX = bx1 - .3;
  box('naming_booth', B.minX, 0, B.minZ, B.maxX, B.height, B.maxZ, c.cabinet, solid);
  box('booth_counter', B.minX - .28, B.counterHeight - .08, B.minZ + .3, B.minX, B.counterHeight, B.maxZ - .3, c.wood, solid);
  box('booth_window', B.minX - .02, B.counterHeight + .15, B.minZ + .55, B.minX, B.height - .45, B.maxZ - .55, 0x1b1b20);
  box('booth_awning', B.minX - .36, B.height - .1, B.minZ - .05, B.minX, B.height, B.maxZ + .05, c.red);
  sign('NAMING BOOTH', B.minX - .03, B.height - .3, boothZ, 2.4, .3, '#294679', '#fff0cb', 'x-');
  box('stamp_base', B.minX - .22, B.counterHeight, B.maxZ - .75, B.minX - .04, B.counterHeight + .09, B.maxZ - .5, c.plum);
  box('stamp_arm', B.minX - .16, B.counterHeight + .09, B.maxZ - .66, B.minX - .1, B.counterHeight + .3, B.maxZ - .6, c.metal);
  box('arm_rail', armStartX - .1, A.railHeight, boothZ - .07, B.minX + .4, A.railHeight + .14, boothZ + .07, c.metal);
  box('arm_post', armStartX - .1, belt.height, boothZ - .1, armStartX + .1, A.railHeight, boothZ + .1, c.metal, solid);
  box('arm_mount', B.minX + .1, B.height, boothZ - .1, B.minX + .4, A.railHeight, boothZ + .1, c.metal);
  const arm = new THREE.Group();
  arm.name = 'workshop_arm';
  arm.userData.dynamic = true;
  arm.position.set(armStartX, floorY + A.railHeight, boothZ);
  const armMaterial = kit.mat(c.metal), clawMaterial = kit.mat(c.red);
  const addArmPart = (w, h, d, x, y, z, material) => {
    const part = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    part.position.set(x, y, z);
    arm.add(part);
    return part;
  };
  addArmPart(.26, .1, .22, 0, -.06, 0, armMaterial); // the trolley on the rail
  const cable = addArmPart(.03, 1, .03, 0, -.5, 0, armMaterial);
  const claw = new THREE.Group();
  arm.add(claw);
  for (const side of [-1, 1]) {
    const prong = new THREE.Mesh(new THREE.BoxGeometry(.04, .2, .05), clawMaterial);
    prong.position.set(side * .1, -.1, 0);
    claw.add(prong);
  }
  kit.group.add(arm);

  const leverRig = new THREE.Group();
  leverRig.name = 'workshop_lever';
  leverRig.userData.dynamic = true;
  leverRig.position.set(H.maxX - L.depth - .03, floorY + L.height, L.z);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .42, 8), kit.mat(c.metal));
  handle.position.y = .21;
  const knob = new THREE.Mesh(new THREE.IcosahedronGeometry(.07, 1), kit.mat(c.red));
  knob.position.y = .44;
  leverRig.add(handle, knob);
  leverRig.rotation.z = L.upAngle;
  kit.group.add(leverRig);
  box('lever_box', H.maxX - L.depth, L.height - .45, L.z - .3, H.maxX, L.height + .45, L.z + .3, c.plum);
  sign('FINISH EARLY', H.maxX - L.depth - .025, L.height + .7, L.z, 1.2, .24, '#ffe39b', '#253c87', 'x-');

  // The Returns Chute: a steel frame in the north wall, a slide, and a flap that swings while it is taking returns.
  const C = H.chute, chuteLeft = C.x - C.width / 2, chuteRight = C.x + C.width / 2, hatch = H.maxZ - .06;
  box('chute_hatch', chuteLeft, C.sill, hatch, chuteRight, C.top, H.maxZ, 0x1b1b20);
  for (const [x0, x1] of [[chuteLeft - .12, chuteLeft], [chuteRight, chuteRight + .12]]) box('chute_frame', x0, C.sill - .12, H.maxZ - .14, x1, C.top + .12, H.maxZ, c.metal);
  box('chute_frame', chuteLeft, C.top, H.maxZ - .14, chuteRight, C.top + .12, H.maxZ, c.metal);
  box('chute_frame', chuteLeft, C.sill - .12, H.maxZ - .14, chuteRight, C.sill, H.maxZ, c.metal);
  const slide = box('chute_slide', chuteLeft, .24, H.maxZ - .62, chuteRight, .29, H.maxZ - .02, c.metal);
  slide.rotation.x = -C.slideAngle;
  sign('RETURNS', C.x, C.top + .34, H.maxZ - .03, 1.5, .34, '#c64140', '#fff0cb');
  sign('NO RECEIPT? NO PROBLEM.', C.x, C.top + .1, H.maxZ - .155, 1.7, .13, 'transparent', '#fff0cb');
  const flap = new THREE.Group();
  flap.name = 'workshop_chute_flap';
  flap.userData.dynamic = true;
  flap.position.set(C.x, floorY + C.top, H.maxZ - .1);
  const flapPanel = new THREE.Mesh(new THREE.BoxGeometry(C.width - .06, C.top - C.sill - .05, .04), kit.mat(c.red, { roughness: .6 }));
  flapPanel.position.y = -(C.top - C.sill - .05) / 2;
  flap.add(flapPanel);
  kit.group.add(flap);

  // Party bulbs: a string round the hall. One instanced draw, and no real lights: ritual mode recolours the two hall lamps instead.
  const bulbSpots = [];
  const bulbH = H.bulbs.height;
  for (let x = H.minX + .3; x < H.maxX - .2; x += H.bulbs.spacing) bulbSpots.push([x, H.minZ + .06], [x, H.maxZ - .06]);
  for (let z = H.minZ + .3; z < H.maxZ - .2; z += H.bulbs.spacing) bulbSpots.push([H.minX + .06, z], [H.maxX - .06, z]);
  const bulbs = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.055, 0), new THREE.MeshBasicMaterial(), bulbSpots.length);
  bulbs.name = 'workshop_bulbs';
  bulbSpots.forEach(([x, z], i) => {
    form.position.set(x, floorY + bulbH, z);
    form.rotation.set(0, 0, 0);
    form.scale.setScalar(1);
    form.updateMatrix();
    bulbs.setMatrixAt(i, form.matrix);
    bulbs.setColorAt(i, new THREE.Color(H.bulbs.idleColor));
  });
  const bulbRig = new THREE.Group();
  bulbRig.name = 'workshop_bulb_rig';
  bulbRig.userData.dynamic = true;
  bulbRig.add(bulbs);
  kit.group.add(bulbRig);

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

  // The Limited Editions shelf is empty: the Limited Editions were retired (15 November 2026).
  sign('LIMITED EDITIONS · ASK A SHOPPER', center, 1.3, front + .68, 1.5, .2, '#c64140', '#fff0cb', 1);

  const lamp = shop.lamp;
  const rideY = floorY + belt.height + shop.rideHeight;
  const carryY = floorY + A.carryHeight, restY = floorY + B.counterHeight + .05;
  return {
    purchasePosition: new THREE.Vector3(center, floorY + bench.promptHeight, benchFront - bench.promptInset),
    arrival: { position: new THREE.Vector3(center, floorY, benchFront - 1.1), yaw: Math.PI }, // (debug: in front of the bench)
    stations: {
      rooms: layout.sections.filter(s => s.id.startsWith('workshop'))
        .map(({ minX, maxX, minZ, maxZ }) => ({ minX, maxX, minZ, maxZ, minY: floorY - .5, maxY: floorY + H.height })),
      lever: new THREE.Vector3(H.maxX - L.depth - .08, floorY + L.height, L.z),
      booth: new THREE.Vector3(B.minX - .4, floorY + B.promptHeight, boothZ),
      bins,
      hearts,
      chute: [-1.1, 0, 1.1].map((dx, i) => ({ name: `spawn_workshop_chute_${i}`, zone: 'upstairs',
        position: new THREE.Vector3(C.x + dx, floorY, H.maxZ - C.spawnInset) })),
      path: [
        ...[[bx1 - .3, bz0 + beltMiddle], [bx0 + beltMiddle, bz0 + beltMiddle], [bx0 + beltMiddle, bz1 - beltMiddle], [armStartX, bz1 - beltMiddle]]
          .map(([x, z]) => new THREE.Vector3(x, rideY, z)),
        new THREE.Vector3(armStartX, carryY, boothZ), // lifted off the end of the belt, over the lane, down onto the counter
        new THREE.Vector3(B.minX - .16, carryY, boothZ),
        new THREE.Vector3(B.minX - .16, restY, boothZ),
      ],
      tank: { fill, fluff, fillRig, height: gaugeRange, mouth: new THREE.Vector3(tank.x, floorY + tank.height - .5, tank.z), fluffCount: tank.fluffCount },
      belt: beltMaterial.map,
      arm: { group: arm, cable, claw, railY: floorY + A.railHeight, minX: armStartX, maxX: B.minX - .16 },
      leverHandle: leverRig,
      leverAngles: { up: L.upAngle, down: L.downAngle },
      flap,
      bulbs,
      chuteMouth: new THREE.Vector3(C.x, floorY + C.top - .3, H.maxZ - .3),
    },
    light: { ...lamp, x: center + lamp.x, y: floorY + lamp.height, z: front + lamp.offsetZ },
    lamps: H.lamps.map(l => ({ ...H.lampLight, x: l.x, y: floorY + H.lampLight.height, z: l.z })),
  };
}
