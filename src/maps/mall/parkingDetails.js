import * as THREE from 'three';
import { parkingDetails as D } from '../../config/parkingDetails.js';
import { parkingLot as P } from '../../config/parkingLot.js';
import { atmosphere } from '../../config/environment.js';
import { seededRandom } from '../../world/textures.js';
import { createParkingDetailKit } from './parkingDetailKit.js';
import { paintAccessible, paintCampaign } from '../../world/paintedInteriors.js';
import { concourse } from '../../config/concourse.js';
import { zombieTypes } from '../../config/zombies.js';
import { buildCart } from '../../zombies/cartModel.js';

export function buildParkingDetails({ kit, looks }) {
  const d = createParkingDetailKit(kit), { box, rod, sign, plane, mat } = d;
  const metal = mat(0x8f989e, { roughness: .55, metalness: .4 }), dark = mat(0x343741);
  const cream = mat(0xd5c4a7), rust = mat(0x806354), paper = mat(0xdacdb6), teal = mat(0x739c96);
  const random = seededRandom(D.seed);
  surfaceWear(); facadeDetails(); P.vehicles.forEach(vehicleDetails); abandonedScenes(); realism(); landmarks();

  // Painted light follows the existing Neon glow setting and needs no extra lamps.
  for (const l of P.lamps) {
    looks.pool(l.x + 1.1, .044, l.z, 10, 10, 'floor', l.color, D.atmosphere.lampPoolOpacity);
    looks.pool(l.x + 1.1, .047, l.z, 3.6, 3.6, 'floor', l.color, D.atmosphere.lampPoolOpacity * .6);
  }
  looks.pool(60, .043, -12, 6, 13, 'floor', 0x7f9ab3, D.atmosphere.coolPoolOpacity);

  const haze = new THREE.Group(); haze.name = 'parking_distant_haze'; haze.userData.dynamic = true; kit.group.add(haze);
  const hazeCanvas = document.createElement('canvas'); hazeCanvas.width = 4; hazeCanvas.height = 128;
  const hc = hazeCanvas.getContext('2d'), fade = hc.createLinearGradient(0, 0, 0, 128);
  fade.addColorStop(0, 'rgba(255,255,255,0)'); fade.addColorStop(.5, 'rgba(255,255,255,.8)');
  fade.addColorStop(1, 'rgba(255,255,255,0)'); hc.fillStyle = fade; hc.fillRect(0, 0, 4, 128);
  const hazeTexture = new THREE.CanvasTexture(hazeCanvas);
  for (const spec of D.atmosphere.haze) {
    const material = new THREE.MeshBasicMaterial({ map: hazeTexture, color: 0xcba997,
      transparent: true, opacity: spec.opacity, depthWrite: false, side: THREE.DoubleSide });
    const mesh = plane('haze', spec.x, spec.height / 2, spec.z, spec.width, spec.height, material, 'x-');
    haze.add(mesh);
  }
  const sway = new THREE.Group(), S = D.atmosphere.sign;
  sway.name = 'parking_loose_sign'; sway.userData.dynamic = true;
  sway.position.set(S.x, S.y, S.z); sway.rotation.y = -Math.PI / 2; kit.group.add(sway);
  const loose = sign('loose_notice', 'NO OVERNIGHT PARKING', { x: 0, y: -.2, z: 0, width: 1.6, height: .45,
    facing: 1, background: '#ccb58d', color: '#574650', font: 'stencil' }); sway.add(loose);
  let elapsed = 0;
  return {
    update(dt) {
      elapsed += dt;
      haze.visible = atmosphere.ambient.enabled;
      sway.rotation.z = atmosphere.ambient.enabled ? Math.sin(elapsed * Math.PI * 2 / S.period) * S.radians : 0;
    },
    reset() { elapsed = 0; sway.rotation.z = 0; haze.visible = atmosphere.ambient.enabled; },
  };

  // The lot's landmarks (config/parkingDetails.js landmarks): pylon sign, facade neon, wet gloss, cones, a box truck.
  function landmarks() {
    const L = D.landmarks;
    const neon = looks.neon('parkingLot');
    // The pylon: two posts, a cabinet with the name in neon and a neon sun over it, facing the lot.
    const Y = L.pylon, half = Y.postSpacing / 2, post = mat(0x3b3846, { roughness: .6, metalness: .35 });
    for (const dz of [-half, half]) {
      box('pylon_post', Y.x, Y.height / 2, Y.z + dz, Y.post, Y.height, Y.post, post);
      kit.addCollider(Y.x - Y.post / 2, 0, Y.z + dz - Y.post / 2, Y.x + Y.post / 2, Y.height, Y.z + dz + Y.post / 2);
    }
    const C = Y.cabinet;
    box('pylon_cabinet', Y.x, (C.bottom + C.top) / 2, Y.z, C.depth, C.top - C.bottom, C.width, mat(0x2a1838, { roughness: .7 }));
    neon.sign({ text: Y.text, style: 'block', x: Y.x - C.depth / 2 - .02, y: (C.bottom + C.top) / 2, z: Y.z, facing: 'x-', height: Y.textHeight,
      color: 0xff5ea8, backing: false, border: 0xffa04d, flickerLetters: [11] });
    neon.shape('sun', { x: Y.x - C.depth / 2 - .02, y: Y.sunY, z: Y.z, facing: 'x-', size: Y.sunSize, color: 0xffa04d });
    looks.pool(Y.x - .03, (C.bottom + C.top) / 2, Y.z, C.width + 1.4, 3.2, 'x-', 0xff5ea8, .12);
    // The name in neon on the facade, over the faded ghost sign (the mall still says who it is after dark).
    const F = L.facadeNeon, wallX = P.rect.minX + .15; // (the cladding's face, as the facade details use)
    neon.sign({ text: F.text, style: 'deco', x: wallX + .08, y: F.y, z: F.z, facing: 'x+', height: F.height, color: 0xffd9a8, backing: true, border: 0xff5ea8 });
    // Gloss over the painted puddles: low roughness, so the lamps leave a highlight on the wet asphalt.
    const wet = mat(L.gloss.color, { roughness: L.gloss.roughness, metalness: .1 });
    for (const [x, z, w, h] of D.wear.puddles) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(.5, 20).rotateX(-Math.PI / 2), wet);
      mesh.scale.set(w * .9, 1, h * .9);
      mesh.position.set(x, L.gloss.y, z);
      mesh.name = 'parking_detail_puddle_gloss';
      kit.group.add(mesh);
    }
    // Traffic cones by the fence (decoration: knee-high, so you walk through rather than catch on them).
    const orange = mat(0xff6a1f, { roughness: .6 }), white = mat(0xf2efe6), rubber = mat(0x24232c);
    for (const [x, z, over] of L.cones) {
      const cone = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(.03, .16, .5, 10), orange); body.position.y = .28;
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.075, .1, .08, 10), white); band.position.y = .3;
      const foot = new THREE.Mesh(new THREE.BoxGeometry(.36, .03, .36), rubber); foot.position.y = .015;
      cone.add(body, band, foot);
      cone.position.set(x, 0, z);
      if (over) { cone.rotation.z = Math.PI / 2; cone.position.y = .18; cone.rotation.y = random() * Math.PI; }
      cone.traverse((o) => { if (o.isMesh) o.name = 'parking_detail_cone'; });
      kit.group.add(cone);
    }
    // The box truck: cab and box, wheels, a windscreen, the mall's name on its side. Solid, and too tall to stand on.
    const T = L.truck, len = T.x1 - T.x0, width = T.z1 - T.z0, zc = (T.z0 + T.z1) / 2;
    const bodyX0 = T.x0 + T.cabLength;
    box('truck_box', (bodyX0 + T.x1) / 2, .45 + (T.bodyHeight - .45) / 2, zc, T.x1 - bodyX0, T.bodyHeight - .45, width, mat(T.body, { roughness: .7 }));
    box('truck_cab', T.x0 + T.cabLength / 2, .4 + (T.cabHeight - .4) / 2, zc, T.cabLength - .08, T.cabHeight - .4, width - .1, mat(T.cab, { roughness: .55 }));
    box('truck_windscreen', T.x0 + .02, T.cabHeight - .55, zc, .04, .6, width - .4, mat(0x344a60, { roughness: .15, metalness: .3 }));
    box('truck_chassis', (T.x0 + T.x1) / 2, .32, zc, len - .2, .16, width - .3, dark);
    for (const x of [T.x0 + .55, bodyX0 + .9, T.x1 - .7]) {
      for (const z of [T.z0 + .25, T.z1 - .25]) box('truck_wheel', x, .4, z, .8, .8, .3, mat(0x24232c));
    }
    for (const [z, facing] of [[T.z1 + .012, 1], [T.z0 - .012, -1]]) {
      sign('truck_logo', T.logo, { x: (bodyX0 + T.x1) / 2, y: 1.75, z, width: Math.min(4.2, T.x1 - bodyX0 - .4), height: .5,
        facing, background: '#d9d2c4', color: '#7a2f45', font: 'mallBrand' });
    }
    kit.addCollider(bodyX0, 0, T.z0, T.x1, T.bodyHeight, T.z1);
    kit.addCollider(T.x0, 0, T.z0, bodyX0, T.cabHeight, T.z1);
  }

  function surfaceWear() {
    const R = P.rect, size = D.textureSize, width = R.maxX - R.minX, depth = R.maxZ - R.minZ;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
    const c = canvas.getContext('2d'), sx = size / width, sz = size / depth;
    const point = (x, z) => [(x - R.minX) * sx, (z - R.minZ) * sz];
    // Broad repairs, gritty edges and fine branching cracks share a single decal draw.
    for (const [x, z, w, h] of D.wear.patches) {
      const [u, v] = point(x, z); c.fillStyle = 'rgba(24,27,33,.40)';
      c.fillRect(u - w * sx / 2, v - h * sz / 2, w * sx, h * sz);
      c.strokeStyle = 'rgba(23,22,28,.5)'; c.lineWidth = 3; c.strokeRect(u - w * sx / 2, v - h * sz / 2, w * sx, h * sz);
    }
    for (let i = 0; i < D.wear.cracks; i++) {
      let u = random() * size, v = random() * size;
      c.beginPath(); c.moveTo(u, v);
      for (let j = 0; j < 5; j++) { u += (random() - .45) * 34; v += 9 + random() * 23; c.lineTo(u, v); }
      c.strokeStyle = 'rgba(18,20,26,.55)'; c.lineWidth = .55 + random() * .6; c.stroke();
      c.beginPath(); c.moveTo(u, v); c.lineTo(u + 15, v - 20); c.lineTo(u + 23, v - 28); c.lineWidth = .8; c.stroke();
    }
    for (const [x, z, length, angle] of D.wear.skidMarks) {
      const [u, v] = point(x, z); c.save(); c.translate(u, v); c.rotate(angle);
      for (const offset of [-.65, .65]) {
        c.fillStyle = 'rgba(20,22,27,.23)'; c.fillRect(offset * sx, 0, .15 * sx, length * sz);
      } c.restore();
    }
    // Break up the paint itself, rather than drawing fresh flawless lines over old asphalt.
    for (let x = P.bays.fromX; x <= P.bays.toX + .01; x += P.bays.spacing) {
      for (let i = 0; i < 12; i++) {
        const [u, v] = point(x, P.bays.minZ + random() * (P.bays.maxZ - P.bays.minZ));
        c.fillStyle = 'rgba(65,63,74,.8)'; c.fillRect(u - 2, v, 4, 2 + random() * 5);
      }
    }
    for (const vehicle of P.vehicles) {
      const [u, v] = point(vehicle.x, vehicle.z + vehicle.length * .22);
      c.fillStyle = 'rgba(20,23,28,.45)'; c.beginPath(); c.ellipse(u, v, sx * .5, sz * .7, .2, 0, Math.PI * 2); c.fill();
    }
    plane('asphalt_wear', (R.minX + R.maxX) / 2, .036, (R.minZ + R.maxZ) / 2,
      width, depth, d.labelMaterial(canvas));
    const water = new THREE.MeshStandardMaterial({ color: 0x73818a, roughness: .18, metalness: .35,
      transparent: true, opacity: .52, depthWrite: false });
    for (const [x, z, w, h] of D.wear.puddles) {
      const mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 11), water);
      mesh.name = 'parking_detail_puddle'; mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, .041, z); mesh.scale.set(w / 2, h / 2, 1); kit.group.add(mesh);
      plane('puddle_sheen', x, .043, z, w * .55, h * .12,
        new THREE.MeshBasicMaterial({ color: 0xd1bdb0, transparent: true, opacity: .18, depthWrite: false }));
    }
    for (const [x, z] of D.wear.drains) {
      box('drain_frame', x, .022, z, .72, .025, .46, dark);
      for (let j = 0; j < 8; j++) box('drain_bar', x - .3 + j * .085, .042, z, .035, .02, .4, metal);
    }
    for (const [x, z] of D.wear.weeds) {
      for (let i = 0; i < 5; i++) {
        const mesh = box('kerb_weed', x + (random() - .5) * .3, .085, z + (random() - .5) * .3,
          .018, .11 + random() * .1, .025, mat(0x6c7754)); mesh.rotation.z = (random() - .5) * .8;
      }
    }
  }

  function facadeDetails() {
    const wallX = P.rect.minX + .15;
    for (const z of D.facade.downpipes) {
      rod('downpipe', [wallX + .1, .1, z], [wallX + .1, 6.3, z], .055, metal);
      for (const y of [1.2, 3.2, 5.2]) box('pipe_clip', wallX + .08, y, z, .19, .05, .17, dark);
      rod('pipe_elbow', [wallX + .1, .12, z], [wallX + .38, .12, z], .055, metal);
    }
    const weather = document.createElement('canvas'); weather.width = 256; weather.height = 256;
    const c = weather.getContext('2d');
    for (let i = 0; i < 85; i++) {
      c.fillStyle = `rgba(61,54,51,${.015 + random() * .05})`;
      c.fillRect(random() * 256, random() * 70, 1 + random() * 3, 15 + random() * 180);
    }
    const grime = d.labelMaterial(weather);
    plane('facade_weathering', wallX + .025, 2.95, -9, 29.6, 5.8, grime, 'x+');
    for (const v of D.facade.vents) {
      box('vent_frame', wallX + .08, v.y, v.z, .12, v.height + .1, v.width + .1, metal);
      box('vent_dark', wallX + .15, v.y, v.z, .025, v.height, v.width, dark);
      for (let y = v.y - v.height / 2 + .07; y < v.y + v.height / 2; y += .1) {
        box('vent_louvre', wallX + .18, y, v.z, .06, .025, v.width - .05, metal, [0, 0, -.2]);
      }
    }
    // The ghost sign: a faded painted advert, 2.5 cm in front of the weathering.
    const g = D.facade.ghostSign;
    looks.poster('ghost', { text: g.text, sub: g.sub, wall: g.wall, ink: g.ink }, wallX + .05, g.y, g.z, g.width, g.height, 'x+');
    const b = D.facade.cabinet;
    box('power_cabinet', b.x, b.height / 2, b.z, b.width, b.height, b.depth, mat(0x82918b));
    kit.addCollider(b.x - b.width / 2, 0, b.z - b.depth / 2, b.x + b.width / 2, b.height, b.z + b.depth / 2);
    box('cabinet_door', b.x + b.width / 2 + .015, 1.2, b.z, .025, 1.65, b.depth - .09, metal);
    sign('high_voltage', 'DANGER · HIGH VOLTAGE', { x: b.x + b.width / 2 + .04, y: 1.65, z: b.z,
      width: .58, height: .26, facing: 'x+', background: '#cdb16b', color: '#493e3d', font: 'hazard' });
    for (const camera of D.facade.cameras) {
      box('camera_mount', wallX + .1, camera.y, camera.z, .12, .22, .2, dark);
      rod('camera_arm', [wallX + .1, camera.y, camera.z], [wallX + .6, camera.y, camera.z], .03, metal);
      box('security_camera', wallX + .6, camera.y + .06, camera.z + .12, .22, .16, .38, cream, [-.16, 0, 0]);
      box('camera_lens', wallX + .6, camera.y + .025, camera.z + .32, .1, .09, .025, dark);
    }
    for (const notice of D.facade.notices) {
      sign('service_notice', notice.text, { x: wallX + .055, y: 1.8, z: notice.z,
        width: 1.4, height: .35, facing: 'x+', background: '#cbbca0', color: '#51454b', font: 'wayfinding' });
      sign('service_notice_sub', notice.sub, { x: wallX + .055, y: 1.47, z: notice.z,
        width: 1.4, height: .22, facing: 'x+', background: '#cbbca0', color: '#51454b', font: 'officialBody' });
    }
    // Roof hardware is beyond the wall edge, where it cannot overlap an indoor ceiling face.
    for (const [x, y, z] of D.facade.roofUnits) {
      box('roof_duct', x - .8, y + 1, z, 1.4, .5, 1, metal);
      box('roof_duct_cap', x - .8, y + 1.28, z, 1.5, .06, 1.1, dark);
    }
  }

  function vehicleDetails(v, index) {
    const { x, z, width: w, length: length, height: h } = v, front = z + length / 2, back = z - length / 2;
    const curtain = mat(D.vehicle.curtain[index]);
    for (const side of [-1, 1]) {
      for (const dz of [-length * .29, 0, length * .29]) {
        for (const offset of [-length * .085, length * .085]) {
          box('rv_curtain', x + side * (w / 2 + .045), h - .55, z + dz + offset,
            .018, .59, .12, curtain);
        }
      }
      rod('mirror_arm', [x + side * w / 2, h - .8, front - .25],
        [x + side * (w / 2 + .23), h - .8, front - .25], .018, metal);
      const mirror = box('rv_mirror', x + side * (w / 2 + .24), h - .7, front - .25, .09, .25, .17, dark);
      if (index === 2 && side === 1) mirror.rotation.z = -.45;
      sign('rv_plate', D.vehicle.plates[index], { x, y: .62, z: side > 0 ? front + .11 : back - .11,
        width: .55, height: .14, facing: side, background: '#c6bda3', color: '#494451', font: 'wayfinding' });
      for (const dx of [-.4, .4]) box('rv_wiper', x + dx, h - .7, side > 0 ? front + .047 : back - .047,
        .55, .024, .018, dark, [0, 0, dx > 0 ? .24 : -.24]);
    }
    box('rv_roof_vent', x, h + .16, z - .7, .7, .12, .6, cream);
    box('rv_vent_cap', x, h + .25, z - .7, .75, .06, .65, metal);
    rod('rv_aerial', [x + .5, h + .1, z + 1], [x + .5, h + .7, z + 1], .012, metal);
    rod('rv_aerial_cross', [x + .1, h + .65, z + 1], [x + .9, h + .65, z + 1], .009, metal);
    sign('rv_travel_sticker', D.vehicle.stickers[index], { x: x - .65, y: 1.18, z: back - .05,
      width: .7, height: .19, facing: -1, background: '#aa8f71', color: '#e5d7b5', font: 'marker' });
    const dirt = document.createElement('canvas'); dirt.width = 256; dirt.height = 64;
    const c = dirt.getContext('2d');
    for (let i = 0; i < 150; i++) {
      c.fillStyle = `rgba(59,48,40,${random() * .35})`;
      c.fillRect(random() * 256, 36 + random() * 27, 1 + random() * 6, 1 + random() * 3);
    }
    const dirtMaterial = d.labelMaterial(dirt);
    for (const side of [-1, 1]) plane('rv_road_dirt', x + side * (w / 2 + .055), .65, z,
      length - .1, .75, dirtMaterial, side > 0 ? 'x+' : 'x-');
    if (index === 2) {
      box('rv_broken_lamp', x + w * .34, .9, front + .06, .3, .21, .018, dark);
      box('rv_lamp_crack', x + w * .34, .9, front + .073, .2, .013, .01, metal, [0, 0, .5]);
      // A small boarded rear window, distinct from the family van's curtains.
      for (const y of [h - .72, h - .42]) box('rv_window_board', x + .25, y, back - .062, 1.15, .15, .04, rust, [0, 0, .08]);
    }
  }

  function abandonedScenes() {
    const shopping = D.scenes.shopping, delivery = D.scenes.delivery, waiting = D.scenes.waiting;
    // A discarded trolley and groceries, kept to one compact footprint behind the family RV.
    const { x, z } = shopping;
    for (const dx of [-.29, .29]) {
      rod('trolley_frame', [x + dx, .15, z - .4], [x + dx, .85, z + .35], .022, metal);
      rod('trolley_handle', [x + dx, .85, z + .35], [x + dx, 1, z + .5], .02, metal);
      for (const dz of [-.34, .32]) box('trolley_wheel', x + dx, .1, z + dz, .09, .18, .13, dark);
      for (let dz = -.32; dz < .4; dz += .14) rod('trolley_wire', [x + dx, .45, z + dz], [x + dx, .82, z + dz], .009, metal);
    }
    for (const y of [.45, .8]) {
      rod('trolley_rim', [x - .3, y, z - .35], [x + .3, y, z - .35], .016, metal);
      rod('trolley_rim', [x - .3, y, z + .35], [x + .3, y, z + .35], .016, metal);
      for (const dx of [-.3, .3]) rod('trolley_rim', [x + dx, y, z - .35], [x + dx, y, z + .35], .016, metal);
    }
    rod('trolley_grip', [x - .32, 1, z + .5], [x + .32, 1, z + .5], .028, teal);
    const cartCollider = kit.addCollider(x - .33, 0, z - .42, x + .33, 1.03, z + .55); cartCollider.vaultable = true;
    bag(x - .05, .48, z); bag(x + .58, 0, z - .1);
    box('spilled_carton', x + .59, .1, z - .48, .15, .19, .13, cream, [.1, .3, .9]);
    box('spilled_tin', x + .38, .06, z - .62, .1, .1, .18, mat(0x93696c), [0, .4, .2]);

    // Unfinished delivery: two packages, a hand truck and a dropped route sheet.
    const tx = delivery.x, tz = delivery.z;
    for (const dx of [-.2, .2]) {
      rod('handtruck_rail', [tx + dx, .1, tz], [tx + dx, 1.13, tz + .2], .022, metal);
      box('handtruck_wheel', tx + dx, .13, tz, .1, .26, .24, dark);
    }
    rod('handtruck_handle', [tx - .2, 1.13, tz + .2], [tx + .2, 1.13, tz + .2], .025, metal);
    box('handtruck_toe', tx, .06, tz - .16, .46, .05, .35, metal);
    for (const [dx, dz, size] of [[0, -.18, .4], [.65, -.18, .32]]) {
      box('delivery_package', tx + dx, size / 2 + .08, tz + dz, size, size, size * .8, mat(0xa88c68));
      box('packing_tape', tx + dx, size + .09, tz + dz, .065, .012, size * .8, paper);
    }
    box('delivery_route_sheet', tx + .6, .026, tz + .45, .2, .012, .28, paper, [0, -.2, 0]);

    // A place someone expected to return to: chair, drink and travel case.
    const wx = waiting.x, wz = waiting.z;
    for (const dx of [-.23, .23]) {
      rod('chair_leg', [wx + dx, .04, wz - .24], [wx + dx, .48, wz + .22], .018, metal);
      rod('chair_leg', [wx + dx, .04, wz + .24], [wx + dx, .48, wz - .22], .018, metal);
      rod('chair_back', [wx + dx, .48, wz + .22], [wx + dx, .93, wz + .29], .018, metal);
    }
    box('chair_seat', wx, .46, wz, .48, .035, .47, mat(0x98697c));
    box('chair_back_fabric', wx, .74, wz + .26, .48, .32, .035, mat(0x98697c), [-.14, 0, 0]);
    kit.addCollider(wx - .25, 0, wz - .24, wx + .25, .49, wz + .24).vaultable = true;
    box('suitcase', wx + .65, .3, wz + .12, .38, .5, .24, teal);
    rod('suitcase_handle', [wx + .54, .6, wz + .12], [wx + .75, .6, wz + .12], .025, dark);
    box('suitcase_strap', wx + .65, .31, wz - .01, .06, .5, .018, cream);
    box('drink_carton', wx + .08, .57, wz, .12, .18, .12, cream);
    rod('drink_straw', [wx + .1, .66, wz], [wx + .12, .82, wz], .008, mat(0xa16875));
    function bag(bx, bottom, bz) {
      box('shopping_bag', bx, bottom + .18, bz, .3, .36, .2, paper);
      for (const dx of [-.08, .08]) rod('bag_handle', [bx + dx, bottom + .36, bz], [bx + dx, bottom + .47, bz], .01, rust);
      rod('bag_handle', [bx - .08, bottom + .47, bz], [bx + .08, bottom + .47, bz], .01, rust);
    }
  }
  // What makes it a real mall car park (config/parkingDetails.js realism).
  function realism() {
    const Rz = D.realism, bays = P.bays;
    const canvasOf = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const textureOf = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
    // The accessible bay nearest the door: painted blue, the symbol at the aisle end (canvas top = the south end).
    const bx0 = bays.fromX + Rz.accessibleBay * bays.spacing + .15, bx1 = bx0 + bays.spacing - .3;
    const bayCanvas = canvasOf(128, 300), bc = bayCanvas.getContext('2d');
    bc.fillStyle = '#2f62b0'; bc.fillRect(0, 0, 128, 300);
    bc.save(); bc.translate(14, 190); paintAccessible(bc, 100); bc.restore();
    plane('accessible_bay', (bx0 + bx1) / 2, Rz.accessibleY, (bays.minZ + bays.maxZ) / 2, bx1 - bx0, bays.maxZ - bays.minZ - .1,
      new THREE.MeshStandardMaterial({ map: textureOf(bayCanvas), roughness: .9 }));
    // The cart corral: a three-sided rail pen, one cart in it and one stray (both solid to waist height).
    const K = Rz.corral, cx = bays.fromX + (K.bay + .5) * bays.spacing, cz = (bays.minZ + bays.maxZ) / 2;
    const cx0 = cx - K.width / 2, cx1 = cx + K.width / 2, cz0 = cz - K.length / 2, cz1 = cz + K.length / 2;
    for (const y of [.5, K.height]) {
      rod('corral_rail', [cx0, y, cz0], [cx0, y, cz1], .03, metal);
      rod('corral_rail', [cx1, y, cz0], [cx1, y, cz1], .03, metal);
      rod('corral_rail', [cx0, y, cz0], [cx1, y, cz0], .03, metal);
    }
    for (const [x, z] of [[cx0, cz0], [cx1, cz0], [cx0, cz1], [cx1, cz1]]) rod('corral_post', [x, 0, z], [x, K.height, z], .035, metal);
    box('corral_sign', cx, K.height + .22, cz0, K.width - .1, .34, .03, mat(0x264653));
    sign('corral_sign_text', 'RETURN CARTS HERE', { x: cx, y: K.height + .22, z: cz0 - .02, width: K.width - .16, height: .28, facing: -1, background: '#264653', color: '#ffe2a3', font: 'wayfinding' });
    kit.addCollider(cx0 - .04, 0, cz0 - .04, cx1 + .04, K.height, cz1 + .04).vaultable = true;
    const cartRandom = seededRandom(D.seed + 7);
    for (const [x, z, yaw] of K.carts) {
      const cart = buildCart(zombieTypes.cartPusher.cart, (color) => mat(color), cartRandom);
      cart.position.set(x, 0, z);
      cart.rotation.y = yaw;
      cart.name = 'parking_cart';
      kit.group.add(cart);
      const inPen = x > cx0 && x < cx1 && z > cz0 && z < cz1;
      if (!inPen) kit.addCollider(x - .45, 0, z - .45, x + .45, 1.0, z + .45).vaultable = true;
    }
    // Row letters and campaign banners on the light poles.
    const campaignCanvas = canvasOf(256, 512);
    paintCampaign(campaignCanvas.getContext('2d'), 256, 512, concourse.campaign);
    const bannerMaterial = new THREE.MeshBasicMaterial({ map: textureOf(campaignCanvas), toneMapped: false });
    const B = Rz.poleBanner;
    P.lamps.forEach((l, i) => {
      for (const facing of ['x+', 'x-']) {
        const side = facing === 'x+' ? 1 : -1;
        sign('row_letter', `ROW ${Rz.rowLetters[i] ?? 'A'}`, { x: l.x + side * .12, y: 2.6, z: l.z, width: .5, height: .5, facing,
          background: '#264653', color: '#ffe2a3', font: 'stencil' });
      }
      const bx = l.x - .11 - B.out - B.width / 2;
      rod('banner_arm', [l.x - .11, B.y + B.height / 2, l.z], [bx - B.width / 2, B.y + B.height / 2, l.z], .02, metal);
      plane('pole_banner', bx, B.y, l.z + .006, B.width, B.height, bannerMaterial, 'z'); // (two faces, back to back: no mirrored text)
      plane('pole_banner', bx, B.y, l.z - .006, B.width, B.height, bannerMaterial, 'z').rotation.y = Math.PI;
    });
    // A planted kerb island at the west end of the row (a 0.15 m step), with a young tree.
    const I = Rz.island;
    kit.box(I.minX, 0, I.minZ, I.maxX, I.kerb, I.maxZ, mat(0xb8a4a2), { name: 'parking_detail_island_kerb', collide: false });
    kit.addCollider(I.minX, 0, I.minZ, I.maxX, I.kerb, I.maxZ);
    kit.box(I.minX + .12, I.kerb, I.minZ + .12, I.maxX - .12, I.kerb + .02, I.maxZ - .12, mat(0x5f7a48), { name: 'parking_detail_island_grass', collide: false });
    const [tx, tz] = I.tree;
    kit.box(tx - .09, I.kerb, tz - .09, tx + .09, I.kerb + 2.2, tz + .09, mat(0x6e4a26), { name: 'parking_detail_island_tree', collide: true });
    for (const [r, dy, color] of [[.9, 2.7, 0x3f6e3a], [.6, 3.3, 0x4f8a46]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(color));
      crown.position.set(tx, I.kerb + dy, tz); crown.name = 'parking_detail_island_crown'; kit.group.add(crown);
    }
    // The entrance vestibule: glass sides (solid), a canopy roof, an open front.
    const V = Rz.vestibule, glass = mat(0x9fc6d8, { transparent: true, opacity: .25, roughness: .05, depthWrite: false });
    const frame = mat(0x3a4250);
    for (const z of [V.minZ, V.maxZ]) {
      kit.box(V.minX, 0, z - .025, V.maxX, V.height, z + .025, glass, { name: 'parking_detail_vestibule_glass', collide: false });
      kit.addCollider(V.minX, 0, z - .04, V.maxX, V.height, z + .04);
      kit.box(V.maxX - .06, 0, z - .05, V.maxX + .02, V.height, z + .05, frame, { name: 'parking_detail_vestibule_post', collide: false });
      kit.box(V.minX + .01, V.height - .08, z - .05, V.maxX - .06, V.height, z + .05, frame, { name: 'parking_detail_vestibule_rail', collide: false });
    }
    kit.box(V.minX, V.height, V.minZ - .1, V.maxX + .15, V.height + V.roof, V.maxZ + .1, mat(0x628c8c), { name: 'parking_detail_vestibule_roof', collide: false });
    kit.box(V.maxX - .06, V.height - .3, V.minZ, V.maxX + .02, V.height, V.maxZ, frame, { name: 'parking_detail_vestibule_header', collide: false });
    sign('vestibule_sign', 'MEGA MART · ENTRANCE', { x: V.maxX + .025, y: V.height - .15, z: (V.minZ + V.maxZ) / 2, width: 2.2, height: .24, facing: 'x+',
      background: '#264653', color: '#ffe2a3', font: 'wayfinding' });
  }

}
