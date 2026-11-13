// =============================================================================
// KIOSK KEVIN'S CARTS (one per site in config/kiosk.js `sites`; game/features/kiosk.js keeps ONE live).
// A cart is a low counter (vaultable on its short side) with three product slots along its front, the KIOSK KEVIN sign,
// a notice strip above the counter (Kevin's Pick, "KEVIN IS HIDING", "BACK IN 5 MIN"...) and Kevin in it (mall/kioskKevin.js).
// On the counter, each slot shows what it sells (world/kioskProducts.js). While he's away (or before he opens) a slatted lid
// covers the counter with a notice on it; when he arrives it flips open behind him and he springs up.
// Built in the cart's own frame: u runs across the front (to the right of a shopper facing it), v from the middle towards
// the front; `faces` turns that frame to the world (axis-aligned, so the collider stays a Box3).
// Moving parts (the notice, the product labels and models, the lid, Kevin, his speech bubble and the beacon over an open cart)
// are in a `userData.dynamic` rig; the rest is static and gets batched.
//
// buildKioskCart(kit, site) -> { position, stand, normal, slots: [{ position }], show(state, stock), say(line), animate(dt, time, viewer) }
//   position  the middle slot (where the prompt is);  stand  Kevin's spot behind the counter (the duck radius is measured from it)
//   show(state, stock)  state: 'closed' (before round two), 'away' (Kevin is at another site), 'hiding', or a product id (Kevin's
//                       Pick); stock: the three product ids on the labels and the counter (a slot's product changes with the
//                       round), or leave as is. Called by game/features/kiosk.js every tick (DOM-free: it only sets targets)
//   say(line)           Kevin shouts: the line in a speech bubble over him ('kioskHawk', fx/kioskSpectacle.js)
//   animate(dt, time, viewer)   every rendered frame (fx/kioskSpectacle.js; never in the headless game): the lid, Kevin's
//                       ducking, waving and turning to `viewer` (a world point: the camera), the bubble, the demo Sentry's spinner
// =============================================================================
import * as THREE from 'three';
import { kiosk, productOf } from '../../config/kiosk.js';
import { look } from '../../config/look.js';
import { createBeacon } from '../../fx/beacon.js';
import { drawType } from '../../world/typeKit.js';
import { buildProductDisplay } from '../../world/kioskProducts.js';
import { buildKevin, buildSpeechBubble } from './kioskKevin.js';

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
    return kit.sign(text, { x, y: fy + y, z, width: w, height: h, facing: frame.sign, background: '#1d1626', color, font: 'kevin' });
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
    ['hiding', 'KEVIN IS HIDING'],
    ...productIds.map((id) => [id, `KEVIN'S PICK · ${nameOf(id)}`]),
  ]);
  let awayCount = 0; // each time this cart is left, its notice is the next of kiosk.lid.notices
  const noticeFor = (state) => (state === 'away' ? kiosk.lid.notices[awayCount % kiosk.lid.notices.length] : notices[state]);
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
    stock.forEach((id, index) => {
      ctx.fillStyle = '#1d1626';
      ctx.fillRect(index * step, 0, cell, canvas.height);
      drawType(ctx, nameOf(id), index * step + cell / 2, canvas.height / 2, { role: 'priceTag', size: 36, fill: '#fff3d6', maxWidth: cell - 12 });
    });
    texture.needsUpdate = true;
  }

  // The products on the counter: one model per product a slot can sell, the round's one shown (and only while the lid is up).
  const displays = kiosk.slots.map((choices, index) => Object.fromEntries(choices.map((id) => {
    const model = buildProductDisplay(id, kit.mat);
    model.position.copy(point((index - 1) * slotSpacing, height + .02, .12));
    model.rotation.y = frame.yaw;
    model.visible = false;
    rig.add(model);
    return [id, model];
  })));

  // The lid: a slatted roll-top hinged along the back edge. Shut, it lies over the counter (its notice on top); open, it has
  // swung up and over and hangs down the back. The hinge is 3 cm behind the back, level with the lid's top.
  const lidLength = depth + .025; // (stops 2 cm short of the notice strip on the front)
  const lidCanvas = document.createElement('canvas');
  lidCanvas.width = 512;
  lidCanvas.height = Math.round(512 * lidLength / (width + .06));
  const lidTexture = new THREE.CanvasTexture(lidCanvas);
  lidTexture.colorSpace = THREE.SRGBColorSpace;
  const slat = kit.mat(kiosk.lid.slatDark);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(width + .06, .06, lidLength),
    [slat, slat, new THREE.MeshStandardMaterial({ map: lidTexture, roughness: .55, metalness: .25 }), slat, slat, slat]);
  lidMesh.name = 'kevin_lid';
  lidMesh.position.set(0, -.03, lidLength / 2);
  const lid = new THREE.Group();
  lid.position.copy(point(0, height + .085, back - .03));
  lid.rotation.order = 'YXZ'; // (turned to the cart's facing first, then swung about its own hinge)
  lid.rotation.y = frame.yaw;
  lid.add(lidMesh);
  rig.add(lid);
  const hex = (color) => `#${color.toString(16).padStart(6, '0')}`;
  function drawLid(text) {
    const ctx = lidCanvas.getContext('2d');
    const { width: w, height: h } = lidCanvas;
    ctx.fillStyle = hex(kiosk.lid.slats);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(kiosk.lid.slatDark);
    for (let y = 0; y < h; y += 16) ctx.fillRect(0, y, w, 3);
    drawType(ctx, text, w / 2, h / 2, { role: 'marker', size: 46, fill: kiosk.lid.ink, maxWidth: w - 40 });
    lidTexture.needsUpdate = true;
  }

  // Kevin himself (mall/kioskKevin.js) on his stand point, facing out of the front, and the bubble over his head.
  const stand = point(0, 0, back + .23);
  const kevin = buildKevin(kit.mat);
  kevin.group.position.copy(stand);
  kevin.group.rotation.y = frame.yaw;
  rig.add(kevin.group);
  const bubble = buildSpeechBubble();
  bubble.sprite.position.copy(stand).setY(fy + 2.25);
  rig.add(bubble.sprite);
  // While Kevin is at this cart, a light column rises over it (fx/beacon.js), so the open cart reads across a room.
  const beacon = createBeacon({ color: look.beacons.kevin, ring: false, base: 1.95 });
  beacon.root.position.copy(point(0, 0, 0));
  beacon.root.visible = false;
  rig.add(beacon.root);

  let shown;
  let shownStock = '';
  let products = kiosk.slots.map((choices) => choices[0]);
  let lidOpen = 0; // 0 = shut over the counter, 1 = hanging down the back (animate eases it)
  const here = () => shown !== undefined && shown !== 'closed' && shown !== 'away';
  const facing = new THREE.Vector3(frame.normal[0], 0, frame.normal[1]);
  const toViewer = new THREE.Vector3();
  return {
    position: slots[1].position,
    stand,
    normal: facing.clone(),
    slots,
    show(state, stock = null) {
      if (stock && stock.join() !== shownStock) {
        shownStock = stock.join();
        products = [...stock];
        drawLabels(stock);
      }
      if (state === shown) return;
      if (state === 'away' && here()) awayCount++; // (he's just left: the next notice)
      shown = state;
      const text = noticeFor(state);
      const { canvas, ctx, texture } = notice;
      ctx.fillStyle = '#1d1626';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawType(ctx, text, canvas.width / 2, canvas.height / 2, { role: 'marker', size: 32, fill: '#ffe14d', maxWidth: canvas.width - 24 });
      texture.needsUpdate = true;
      if (!here()) {
        drawLid(text);
        bubble.hide();
      }
      beacon.root.visible = here();
    },
    say(line) {
      if (here()) bubble.say(line);
    },
    animate(dt, time, viewer = null) {
      // The lid swings open once he's here (he springs up as it clears the counter) and shuts once he's gone.
      const was = lidOpen;
      lidOpen = THREE.MathUtils.clamp(lidOpen + (here() ? dt : -dt) / kiosk.lid.seconds, 0, 1);
      if (was < .5 && lidOpen >= .5) kevin.popUp();
      lid.rotation.x = -lidOpen * lidOpen * (3 - 2 * lidOpen) * Math.PI * 1.5; // (smoothstep: up, over the back, down)
      const goods = lidOpen > .35;
      displays.forEach((models, index) => {
        for (const [id, model] of Object.entries(models)) model.visible = goods && products[index] === id;
      });
      const demo = displays[0].sentry;
      if (demo?.visible) demo.userData.spinner.rotation.y += dt * 9; // (the demo unit spins on the counter)
      // Kevin: gone until the lid is half open, ducked while hiding, otherwise turned to the viewer.
      let look = null;
      if (viewer) {
        toViewer.set(viewer.x - stand.x, 0, viewer.z - stand.z);
        // (the angle from his front to the viewer, positive to his left: a turn about +y)
        if (toViewer.lengthSq() > 1e-4) look = Math.atan2(facing.z * toViewer.x - facing.x * toViewer.z, facing.dot(toViewer));
      }
      kevin.animate(dt, time, { mode: lidOpen < .5 ? 'gone' : shown === 'hiding' ? 'hiding' : 'open', talking: bubble.talking, look });
      bubble.animate(dt);
    },
  };
}
