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
