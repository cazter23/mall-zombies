import * as THREE from 'three';
import { kiosk, productOf } from '../../config/kiosk.js';

export function buildKioskCart(kit) {
  const { x, backZ, width, depth, height, slotSpacing } = kiosk.site;
  const front = backZ + depth;
  const left = x - width / 2;
  const right = x + width / 2;
  const body = kit.mat(0x45246e);
  kit.box(left, 0, backZ, right, height, front, body, { vaultable: true, name: 'kevin_cart' });
  kit.box(left + .02, height - .04, backZ + .02, right - .02, height + .02, front + .015,
    kit.mat(0xf1cc70), { collide: false, name: 'kevin_countertop' });

  const sign = (text, sx, y, w, h, color = '#fff3d6') => kit.sign(text, {
    x: sx, y, z: front + .025, width: w, height: h, background: '#1d1626', color,
  });
  sign('KIOSK KEVIN', x, .36, 1.9, .24, '#ffe14d');
  const slots = kiosk.stock.map((id, index) => {
    const sx = x + (index - 1) * slotSpacing;
    sign(productOf(id)?.name ?? kiosk.bubbleWrap.name, sx, .83, .68, .15);
    return { id, position: new THREE.Vector3(sx, height + .1, front + .09) };
  });

  const rig = new THREE.Group();
  rig.userData.dynamic = true;
  kit.group.add(rig);
  const notices = Object.fromEntries([
    ['closed', 'OPENS ROUND TWO'],
    ['hiding', 'KEVIN IS HIDING'],
    ...kiosk.stock.map((id) => [id, `KEVIN'S PICK · ${productOf(id)?.name ?? kiosk.bubbleWrap.name}`]),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const notice = new THREE.Mesh(new THREE.PlaneGeometry(2, .13), new THREE.MeshBasicMaterial({ map: texture }));
  notice.name = 'kevin_notice';
  notice.position.set(x, 1.14, front + .025);
  rig.add(notice);
  let shown;
  const vendor = new THREE.Group();
  vendor.add(
    kit.box(x - .18, .96, backZ + .09, x + .18, 1.48, backZ + .34,
      kit.mat(0x34a9a1), { collide: false, name: 'kevin_shirt' }),
    kit.box(x - .11, 1.48, backZ + .12, x + .11, 1.74, backZ + .33,
      kit.mat(0xd5a16e), { collide: false, name: 'kevin_head' }),
  );
  rig.add(vendor);

  return {
    position: slots[1].position,
    stand: new THREE.Vector3(x, 0, backZ + .23),
    normal: new THREE.Vector3(0, 0, 1),
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
      vendor.visible = state !== 'closed';
      vendor.position.y = state === 'hiding' ? -.73 : 0;
    },
  };
}
