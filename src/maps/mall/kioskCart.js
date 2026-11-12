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

// World x/z from the cart's frame, per facing.
const FRAMES = {
  '+z': { map: (x, z, u, v) => [x + u, z + v], normal: [0, 1], sign: 1, yaw: 0 },
  '-z': { map: (x, z, u, v) => [x - u, z - v], normal: [0, -1], sign: -1, yaw: Math.PI },
  '+x': { map: (x, z, u, v) => [x + v, z - u], normal: [1, 0], sign: 'x+', yaw: Math.PI / 2 },
  '-x': { map: (x, z, u, v) => [x - v, z + u], normal: [-1, 0], sign: 'x-', yaw: -Math.PI / 2 },
};

const nameOf = (id) => productOf(id)?.name ?? kiosk.bubbleWrap.name;

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

  const sign = (text, u, y, w, h, color = '#fff3d6') => {
    const [x, z] = at(u, front + .025);
    return kit.sign(text, { x, y: fy + y, z, width: w, height: h, facing: frame.sign, background: '#1d1626', color });
  };
  sign('KIOSK KEVIN', 0, .36, signWidth, .24, '#ffe14d');
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
    mesh.position.copy(point(0, y, front + .025));
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
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    stock.forEach((id, index) => {
      ctx.fillStyle = '#1d1626';
      ctx.fillRect(index * step, 0, cell, canvas.height);
      ctx.fillStyle = '#fff3d6';
      ctx.fillText(nameOf(id), index * step + cell / 2, canvas.height / 2, cell - 12);
    });
    texture.needsUpdate = true;
  }

  // Kevin (phase 8 dresses him): a shirt and a head behind the counter. Ducking drops him below it.
  const vendor = new THREE.Group();
  vendor.add(
    box(-.18, .96, back + .09, .18, 1.48, back + .34, kit.mat(0x34a9a1), { collide: false, name: 'kevin_shirt' }),
    box(-.11, 1.48, back + .12, .11, 1.74, back + .33, kit.mat(0xd5a16e), { collide: false, name: 'kevin_head' }),
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
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(notices[state], canvas.width / 2, canvas.height / 2, canvas.width - 24);
      texture.needsUpdate = true;
      vendor.visible = state !== 'closed' && state !== 'away';
      beacon.root.visible = vendor.visible;
      vendor.position.y = state === 'hiding' ? -.73 : 0;
    },
  };
}
