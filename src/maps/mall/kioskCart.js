// =============================================================================
// KIOSK KEVIN'S CARTS (one per site in config/kiosk.js `sites`; game/features/kiosk.js keeps ONE live).
// A cart is a low counter (vaultable on its short side) with three product slots along its front, the KIOSK KEVIN sign,
// a notice strip above the counter (Kevin's Pick, "KEVIN IS HIDING", "BACK IN 5 MIN"...) and Kevin behind it.
// Built in the cart's own frame: u runs across the front (to the right of a shopper facing it), v from the middle towards
// the front; `faces` turns that frame to the world (axis-aligned, so the collider stays a Box3).
// Moving parts (the notice and Kevin) are in a `userData.dynamic` rig; the rest is static and gets batched.
//
// buildKioskCart(kit, site) -> { position, stand, normal, slots: [{ id, position }], show(state) }
//   position  the middle slot (where the prompt is);  stand  Kevin's spot behind the counter (the duck radius is measured from it)
//   show(state)  'closed' (before round two), 'away' (Kevin is at another site), 'hiding', or a product id (Kevin's Pick)
// =============================================================================
import * as THREE from 'three';
import { kiosk, productOf } from '../../config/kiosk.js';

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
  const slots = kiosk.stock.map((id, index) => {
    const u = (index - 1) * slotSpacing;
    sign(nameOf(id), u, productY, slotSpacing - .04, .15);
    return { id, position: point(u, height + .1, front + .09) };
  });

  const rig = new THREE.Group();
  rig.name = `kevin_rig_${site.id}`;
  rig.userData.dynamic = true;
  kit.group.add(rig);
  const notices = Object.fromEntries([
    ['closed', 'OPENS ROUND TWO'],
    ['away', 'BACK IN 5 MIN'],
    ['hiding', 'KEVIN IS HIDING'],
    ...kiosk.stock.map((id) => [id, `KEVIN'S PICK · ${nameOf(id)}`]),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const noticeWidth = signWidth + .1;
  const notice = new THREE.Mesh(new THREE.PlaneGeometry(noticeWidth, .13), new THREE.MeshBasicMaterial({ map: texture }));
  notice.name = 'kevin_notice';
  notice.position.copy(point(0, height + .09, front + .025));
  notice.rotation.y = frame.yaw;
  rig.add(notice);

  // Kevin (phase 8 dresses him): a shirt and a head behind the counter. Ducking drops him below it.
  const vendor = new THREE.Group();
  vendor.add(
    box(-.18, .96, back + .09, .18, 1.48, back + .34, kit.mat(0x34a9a1), { collide: false, name: 'kevin_shirt' }),
    box(-.11, 1.48, back + .12, .11, 1.74, back + .33, kit.mat(0xd5a16e), { collide: false, name: 'kevin_head' }),
  );
  rig.add(vendor);

  let shown;
  return {
    position: slots[1].position,
    stand: point(0, 0, back + .23),
    normal: new THREE.Vector3(frame.normal[0], 0, frame.normal[1]),
    slots,
    show(state) {
      if (state === shown) return;
      shown = state;
      ctx.fillStyle = '#1d1626';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ffe14d';
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(notices[state], canvas.width / 2, canvas.height / 2, canvas.width - 24);
      texture.needsUpdate = true;
      vendor.visible = state !== 'closed' && state !== 'away';
      vendor.position.y = state === 'hiding' ? -.73 : 0;
    },
  };
}
