// =============================================================================
// KIOSK KEVIN'S CARTS (one per site in config/kiosk.js `sites`; game/features/kiosk.js keeps ONE live).
// A cart is a low counter (vaultable on its short side) with three product slots along its front, the KIOSK KEVIN sign,
// a notice strip above the counter (Kevin's Pick, "KEVIN IS HIDING", "BACK IN 5 MIN"...) and Kevin behind it.
// Built in the cart's own frame: u runs across the front (to the right of a shopper facing it), v from the middle towards
// the front; `faces` turns that frame to the world (axis-aligned, so the collider stays a Box3).
// Moving parts (the notice, the product labels, Kevin and the beacon over an open cart) are in a `userData.dynamic` rig; the rest is static and gets batched.
//
// buildKioskCart(kit, site) -> { position, stand, normal, slots: [{ position }], show(state, stock) }
//   position  the middle slot (where the prompt is);  stand  Kevin's spot behind the counter (the duck radius is measured from it)
//   show(state, stock)  state: 'closed' (before round two), 'away' (Kevin is at another site), 'hiding', or a product id (Kevin's
//                       Pick); stock: the three product ids on the labels (a slot's product changes with the round), or leave as is
// =============================================================================
import * as THREE from 'three';
import { kiosk, productOf } from '../../config/kiosk.js';
import { look } from '../../config/look.js';
import { createBeacon } from '../../fx/beacon.js';
import { drawType } from '../../world/typeKit.js';

// World x/z from the cart's frame, per facing.
const FRAMES = {
  '+z': { map: (x, z, u, v) => [x + u, z + v], normal: [0, 1], sign: 1, yaw: 0 },
  '-z': { map: (x, z, u, v) => [x - u, z - v], normal: [0, -1], sign: -1, yaw: Math.PI },
  '+x': { map: (x, z, u, v) => [x + v, z - u], normal: [1, 0], sign: 'x+', yaw: Math.PI / 2 },
  '-x': { map: (x, z, u, v) => [x - v, z + u], normal: [-1, 0], sign: 'x-', yaw: -Math.PI / 2 },
};

const nameOf = (id) => productOf(id)?.name ?? kiosk.bubbleWrap.name;

const glow = (color) => new THREE.MeshBasicMaterial({ color });

/**
 * The cart's looks, all static decoration (nothing collides), in the cart's frame (u across, v out to the front):
 * a harlequin front panel over a dark plinth, a gold shelf lip for the products, a striped canopy on four posts with a scalloped
 * valance, a pegboard behind Kevin, a bulb-lit KIOSK KEVIN marquee on the roof, and a hanging board behind the notice strip.
 * `box(u0, y0, v0, u1, y1, v1, material, options)` and `signAt(text, u, y, v, w, h, background, color)` are the cart's own helpers.
 */
function dressCart({ kit, box, signAt, half, front, back, height, signWidth }) {
  const own = { collide: false };
  const purple = kit.mat(0x45246e), plum = kit.mat(0x2d1750), gold = kit.mat(0xf1cc70);
  const teal = kit.mat(0x34a9a1), pink = kit.mat(0xd23f8e);

  // Front: a plinth, a harlequin panel (teal and pink diamonds in squares), and a gold rail under the product labels.
  box(-half, 0, front + .005, half, .12, front + .03, plum, own);
  const cols = 8, cw = (half * 2 - .2) / cols, rows = [.14, .327, .513];
  for (let i = 0; i < cols; i++) {
    rows.forEach((y, j) => box(-half + .1 + i * cw, y, front + .005, -half + .1 + (i + 1) * cw - .012, y + .18, front + .02, (i + j) % 2 ? pink : teal, own));
  }
  box(-half + .04, .7, front + .005, half - .04, .735, front + .03, gold, own);

  // Product shelf: a gold lip past the counter edge where the three products sit.
  box(-.95, height + .02, front + .015, .95, height + .06, front + .2, gold, own);

  // Canopy: four posts, a purple roof with gold stripes, a striped valance with a scalloped edge.
  const roofY = 2.4, pw = .07;
  for (const u of [-half + .06, half - .06 - pw]) {
    box(u, height, front + .02, u + pw, roofY, front + .02 + pw, gold, own);
    box(u, height, back, u + pw, roofY, back + pw, gold, own);
  }
  box(-half - .1, roofY, back, half + .1, roofY + .07, front + .2, purple, own);
  for (let u = -half - .1 + .12, k = 0; u < half + .1 - .24; u += .48, k++) box(u, roofY + .07, back, u + .24, roofY + .09, front + .2, gold, own);
  const stripes = 10, sw = (half * 2 + .2) / stripes;
  for (let i = 0; i < stripes; i++) {
    const u0 = -half - .1 + i * sw;
    box(u0, 2.12, front + .2, u0 + sw, roofY, front + .22, i % 2 ? gold : purple, own);
    if (i % 2 === 0) box(u0 + .02, 2.05, front + .2, u0 + sw - .02, 2.12, front + .22, purple, own); // scallop
  }
  // The roof's underside lights the counter: a warm strip with a few bulbs along it.
  box(-half + .2, roofY - .02, front - .1, half - .2, roofY, front + .1, glow(0xffe9b0), own);

  // The notice strip (the dynamic plane at height + .09) gets a dark hanging board behind it.
  box(-signWidth / 2 - .06, height + .01, front + .01, signWidth / 2 + .06, height + .17, front + .035, kit.mat(0x1d1626), own);

  // Pegboard behind Kevin, with hung stock.
  box(-half + .2, height + .02, back + .01, half - .2, 2.1, back + .05, kit.mat(0x3a2160), own);
  const hung = [0xd23f8e, 0xffe14d, 0xfff3d6, 0xff7a3d, 0x8b5cf6];
  for (let i = 0; i < 9; i++) {
    const u = -half + .3 + i * ((half * 2 - .6) / 8), y = 1.35 + (i % 3) * .22;
    box(u, y, back + .05, u + .16, y + .14, back + .07, kit.mat(hung[i % hung.length]), own);
  }

  // The marquee on the roof: a purple board with a gold frame, bulbs round the edge, KIOSK KEVIN in the middle.
  const my = roofY + .09, mh = .62, mv = front - .3;
  box(-1.02, my, mv - .02, 1.02, my + mh, mv + .03, gold, own);
  box(-.98, my + .04, mv + .03, .98, my + mh - .04, mv + .05, plum, own);
  const bulbA = glow(0xffe14d), bulbB = glow(0xff6fb5);
  for (let u = -.94, k = 0; u <= .94; u += .17, k++) {
    box(u, my + mh - .035, mv + .05, u + .05, my + mh - .005, mv + .07, k % 2 ? bulbA : bulbB, own);
    box(u, my + .005, mv + .05, u + .05, my + .035, mv + .07, k % 2 ? bulbB : bulbA, own);
  }
  signAt('KIOSK KEVIN', 0, my + mh / 2 + .0, mv + .06, 1.82, .42, '#1d1626', '#ffe14d');
  // Feet for the marquee so it doesn't float: two small gold blocks onto the roof.
  box(-.8, roofY + .07, mv - .02, -.7, my, mv + .03, purple, own);
  box(.7, roofY + .07, mv - .02, .8, my, mv + .03, purple, own);
}

export function buildKioskCart(kit, site) {
  const frame = FRAMES[site.faces];
  if (!frame) throw new Error(`kiosk site "${site.id}": faces must be one of ${Object.keys(FRAMES).join(', ')}`);
  const { width, depth, height, slotSpacing, signWidth, productY } = kiosk.cart;
  const fy = site.floorY ?? 0;
  const at = (u, v) => frame.map(site.x, site.z, u, v);
  const point = (u, y, v) => { const [x, z] = at(u, v); return new THREE.Vector3(x, fy + y, z); };
  // An axis-aligned box from two corners in the cart's frame.
  const box = (u0, y0, v0, u1, y1, v1, material, options) => {
    const [ax, az] = at(u0, v0);
    const [bx, bz] = at(u1, v1);
    return kit.box(Math.min(ax, bx), fy + y0, Math.min(az, bz), Math.max(ax, bx), fy + y1, Math.max(az, bz), material, options);
  };
  const front = depth / 2;
  const back = -depth / 2;
  const half = width / 2;

  box(-half, 0, back, half, height, front, kit.mat(0x45246e), { vaultable: true, name: 'kevin_cart' });
  box(-half + .02, height - .04, back + .02, half - .02, height + .02, front + .015,
    kit.mat(0xf1cc70), { collide: false, name: 'kevin_countertop' });
  dressCart({ kit, box, signAt: (text, u, y, v, w, h, background, color) => {
    const [x, z] = at(u, v);
    return kit.sign(text, { x, y: fy + y, z, width: w, height: h, facing: frame.sign, background, color, font: 'kevin' });
  }, half, front, back, height, signWidth });
  const slots = kiosk.slots.map((_, index) => ({ position: point((index - 1) * slotSpacing, height + .1, front + .09) }));

  const rig = new THREE.Group();
  rig.name = `kevin_rig_${site.id}`;
  rig.userData.dynamic = true;
  kit.group.add(rig);
  const productIds = kiosk.slots.flat();
  const notices = Object.fromEntries([
    ['closed', 'OPENS ROUND TWO'],
    ['away', 'BACK IN 5 MIN'],
    ['hiding', 'KEVIN IS HIDING'],
    ...productIds.map((id) => [id, `KEVIN'S PICK · ${nameOf(id)}`]),
  ]);
  // A canvas strip on the front (the notice above the counter, and the product labels: they change with the round).
  const strip = (name, w, h, pixels, y) => {
    const canvas = document.createElement('canvas');
    canvas.width = pixels;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture }));
    mesh.name = name;
    mesh.position.copy(point(0, y, front + (name === "kevin_notice" ? .05 : .025)));
    mesh.rotation.y = frame.yaw;
    rig.add(mesh);
    return { canvas, ctx, texture };
  };
  const notice = strip('kevin_notice', signWidth + .1, .13, 768, height + .09);
  const labelsWidth = kiosk.slots.length * slotSpacing - .04; // (as wide as the three old signs: .04 gaps between cells)
  const labels = strip('kevin_labels', labelsWidth, .15, Math.round(labelsWidth / .15 * 50), productY);
  function drawLabels(stock) {
    const { canvas, ctx, texture } = labels;
    const cell = (slotSpacing - .04) / labelsWidth * canvas.width;
    const step = slotSpacing / labelsWidth * canvas.width;
    ctx.fillStyle = '#45246e'; // (the cart's body shows between the cells)
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    stock.forEach((id, index) => {
      ctx.fillStyle = '#1d1626';
      ctx.fillRect(index * step, 0, cell, canvas.height);
      drawType(ctx, nameOf(id), index * step + cell / 2, canvas.height / 2, { role: 'priceTag', size: 36, fill: '#fff3d6', maxWidth: cell - 12 });
    });
    texture.needsUpdate = true;
  }

  // Kevin (phase 8 dresses him): a shirt and a head behind the counter. Ducking drops him below it.
  const vendor = new THREE.Group();
  const own = { collide: false };
  const skin = kit.mat(0xd5a16e), ink = kit.mat(0x1c1b1e), shirt = kit.mat(0x34a9a1);
  const fz = back + .335; // the face plane (the head's front)
  vendor.add(
    box(-.18, .96, back + .09, .18, 1.48, back + .34, shirt, { ...own, name: 'kevin_shirt' }),
    box(-.11, 1.48, back + .12, .11, 1.74, back + .33, skin, { ...own, name: 'kevin_head' }),
    // Arms resting on the counter, hands on the glass.
    box(-.25, 1.1, back + .12, -.18, 1.46, back + .3, shirt, own),
    box(.18, 1.1, back + .12, .25, 1.46, back + .3, shirt, own),
    box(-.25, 1.06, back + .3, -.17, 1.12, back + .46, skin, own),
    box(.17, 1.06, back + .3, .25, 1.12, back + .46, skin, own),
    // Hair, a visor with its brim, eyes, a grin, a bow tie and a name tag.
    box(-.12, 1.7, back + .1, .12, 1.8, back + .34, kit.mat(0x5a3a22), own),
    box(-.12, 1.66, fz, .12, 1.7, fz + .13, kit.mat(0xffe14d), own),
    box(-.07, 1.57, fz, -.04, 1.62, fz + .008, ink, own),
    box(.04, 1.57, fz, .07, 1.62, fz + .008, ink, own),
    box(-.06, 1.5, fz, .06, 1.53, fz + .008, kit.mat(0x8a2f2f), own),
    box(-.06, 1.43, back + .34, .06, 1.48, back + .36, kit.mat(0xd23f8e), own),
    box(.08, 1.28, back + .34, .16, 1.36, back + .352, kit.mat(0xfff3d6), own),
  );
  rig.add(vendor);
  // While Kevin is at this cart, a light column rises over it (fx/beacon.js), so the open cart reads across a room.
  const beacon = createBeacon({ color: look.beacons.kevin, ring: false, base: 1.95 });
  beacon.root.position.copy(point(0, 0, 0));
  beacon.root.visible = false;
  rig.add(beacon.root);

  let shown;
  let shownStock = '';
  return {
    position: slots[1].position,
    stand: point(0, 0, back + .23),
    normal: new THREE.Vector3(frame.normal[0], 0, frame.normal[1]),
    slots,
    show(state, stock = null) {
      if (stock && stock.join() !== shownStock) {
        shownStock = stock.join();
        drawLabels(stock);
      }
      if (state === shown) return;
      shown = state;
      const { canvas, ctx, texture } = notice;
      ctx.fillStyle = '#1d1626';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawType(ctx, notices[state], canvas.width / 2, canvas.height / 2, { role: 'marker', size: 32, fill: '#ffe14d', maxWidth: canvas.width - 24 });
      texture.needsUpdate = true;
      vendor.visible = state !== 'closed' && state !== 'away';
      beacon.root.visible = vendor.visible;
      vendor.position.y = state === 'hiding' ? -.73 : 0;
    },
  };
}
