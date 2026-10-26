import * as THREE from 'three';
import { parkingDetails as D } from '../../config/parkingDetails.js';
import { parkingLot as P } from '../../config/parkingLot.js';
import { atmosphere } from '../../config/environment.js';
import { seededRandom } from '../../world/textures.js';
import { createParkingDetailKit } from './parkingDetailKit.js';

export function buildParkingDetails({ kit, looks }) {
  const d = createParkingDetailKit(kit), { box, rod, sign, plane, mat } = d;
  const metal = mat(0x8f989e, { roughness: .55, metalness: .4 }), dark = mat(0x343741);
  const cream = mat(0xd5c4a7), rust = mat(0x806354), paper = mat(0xdacdb6), teal = mat(0x739c96);
  const random = seededRandom(D.seed);
  surfaceWear(); facadeDetails(); P.vehicles.forEach(vehicleDetails); abandonedScenes();

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
    facing: 1, background: '#ccb58d', color: '#574650' }); sway.add(loose);
  let elapsed = 0;
  return {
    update(dt) {
      elapsed += dt;
      haze.visible = atmosphere.ambient.enabled;
      sway.rotation.z = atmosphere.ambient.enabled ? Math.sin(elapsed * Math.PI * 2 / S.period) * S.radians : 0;
    },
    reset() { elapsed = 0; sway.rotation.z = 0; haze.visible = atmosphere.ambient.enabled; },
  };

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
    const b = D.facade.cabinet;
    box('power_cabinet', b.x, b.height / 2, b.z, b.width, b.height, b.depth, mat(0x82918b));
    kit.addCollider(b.x - b.width / 2, 0, b.z - b.depth / 2, b.x + b.width / 2, b.height, b.z + b.depth / 2);
    box('cabinet_door', b.x + b.width / 2 + .015, 1.2, b.z, .025, 1.65, b.depth - .09, metal);
    sign('high_voltage', 'DANGER · HIGH VOLTAGE', { x: b.x + b.width / 2 + .04, y: 1.65, z: b.z,
      width: .58, height: .26, facing: 'x+', background: '#cdb16b', color: '#493e3d' });
    for (const camera of D.facade.cameras) {
      box('camera_mount', wallX + .1, camera.y, camera.z, .12, .22, .2, dark);
      rod('camera_arm', [wallX + .1, camera.y, camera.z], [wallX + .6, camera.y, camera.z], .03, metal);
      box('security_camera', wallX + .6, camera.y + .06, camera.z + .12, .22, .16, .38, cream, [-.16, 0, 0]);
      box('camera_lens', wallX + .6, camera.y + .025, camera.z + .32, .1, .09, .025, dark);
    }
    for (const notice of D.facade.notices) {
      sign('service_notice', notice.text, { x: wallX + .055, y: 1.8, z: notice.z,
        width: 1.4, height: .35, facing: 'x+', background: '#cbbca0', color: '#51454b' });
      sign('service_notice_sub', notice.sub, { x: wallX + .055, y: 1.47, z: notice.z,
        width: 1.4, height: .22, facing: 'x+', background: '#cbbca0', color: '#51454b' });
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
        width: .55, height: .14, facing: side, background: '#c6bda3', color: '#494451' });
      for (const dx of [-.4, .4]) box('rv_wiper', x + dx, h - .7, side > 0 ? front + .047 : back - .047,
        .55, .024, .018, dark, [0, 0, dx > 0 ? .24 : -.24]);
    }
    box('rv_roof_vent', x, h + .16, z - .7, .7, .12, .6, cream);
    box('rv_vent_cap', x, h + .25, z - .7, .75, .06, .65, metal);
    rod('rv_aerial', [x + .5, h + .1, z + 1], [x + .5, h + .7, z + 1], .012, metal);
    rod('rv_aerial_cross', [x + .1, h + .65, z + 1], [x + .9, h + .65, z + 1], .009, metal);
    sign('rv_travel_sticker', D.vehicle.stickers[index], { x: x - .65, y: 1.18, z: back - .05,
      width: .7, height: .19, facing: -1, background: '#aa8f71', color: '#e5d7b5' });
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
}
