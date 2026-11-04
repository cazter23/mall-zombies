import * as THREE from 'three';
import { workshopBuilds } from '../../config/workshop.js';

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
  sign('IF THE CONFETTI MOVES, STEP BACK.', center, 1.38, front + .1, 1.48, .16, 'transparent', '#fff4dc');

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

  // Pink trap and mint slide displays along the side walls leave the middle free.
  const bayFront = front + 2.15, bayBack = front + 3.71;
  for (const side of [-1, 1]) {
    const id = side === -1 ? 'partyTrap' : 'skateFeed', build = workshopBuilds[id];
    const x0 = side === -1 ? from + .075 : to - .61, x1 = x0 + .535;
    const mid = (x0 + x1) / 2;
    box(id + '_cabinet', x0, 0, bayFront, x1, .94, bayBack, c.cream, solid);
    box(id + '_trim', x0 + .025, .947, bayFront + .015, x1 - .025, .996, bayBack - .015, build.color);
    box(id + '_backboard', side === -1 ? x0 : x1 - .08, 1.02, bayFront, side === -1 ? x0 + .08 : x1,
      2.38, bayBack, c.plum);
    sign(build.name.toUpperCase(), side === -1 ? x0 + .094 : x1 - .094, 2.15,
      (bayFront + bayBack) / 2, 1.4, .30, side === -1 ? '#87395e' : '#2a605a', '#fff7e3', side === -1 ? 'x+' : 'x-');
    sign(side === -1 ? '01 SHELL / 02 FUSE / 03 POP' : 'RESERVE > ROLLERS > MAG',
      side === -1 ? x0 + .095 : x1 - .095, 1.65, (bayFront + bayBack) / 2, 1.38, .22,
      '#eed9be', '#49384e', side === -1 ? 'x+' : 'x-');
    if (side === -1) {
      box('confetti_bin', x0 + .1, 1.005, bayFront + .16, x1 - .08, 1.13, bayFront + .56, build.color);
      for (let i = 0; i < 7; i++) {
        const x = x0 + .13 + i % 3 * .075, z = bayFront + .21 + Math.floor(i / 3) * .093;
        box('confetti_sample', x, 1.134, z, x + .043, 1.146, z + .045, [build.color, c.paper, 0x50cbb9][i % 3]);
      }
      box('charge_cutaway', mid - .13, 1.008, bayBack - .69, mid + .13, 1.2, bayBack - .24, build.color);
      box('exposed_fuse', mid - .08, 1.205, bayBack - .63, mid + .08, 1.24, bayBack - .28, c.metal);
    } else {
      box('feed_magazine', mid - .13, 1.006, bayFront + .18, mid + .13, 1.16, bayFront + .67, c.metal);
      for (const z of [bayFront + .3, bayFront + .49]) box('feed_roller', mid - .11, 1.167, z, mid + .11, 1.228, z + .06, build.color);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.118, .118, .095, 16), kit.mat(0x496862));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(mid, floorY + 1.116, bayBack - .38);
      wheel.name = 'workshop_skate_wheel';
      kit.group.add(wheel);
    }
  }

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
