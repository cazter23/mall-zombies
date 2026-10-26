import * as THREE from 'three';
import { parkingLot as config } from '../../config/parkingLot.js';
import { economy } from '../../config/economy.js';
import { seededRandom } from '../../world/textures.js';
import { buildParkingSurroundings } from './parkingSurroundings.js';
import { buildParkingStreetDetails } from './parkingStreetDetails.js';

// All geometry, lights and textures belong to the mall kit and unload with it.
export function buildParkingLot(kit, { zones, mallWallX, wallThickness }) {
  const P = config, R = P.rect, C = P.palette, G = P.gate;
  const { box, mat, sign, group } = kit;
  const solid = (name, x0, y0, z0, x1, y1, z1, material) =>
    box(x0, y0, z0, x1, y1, z1, material, { name: `parking_${name}` });
  const detail = (name, x, y, z, w, h, d, material) =>
    box(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2,
      material, { name: `parking_${name}`, collide: false });
  const concrete = mat(C.concrete), paint = mat(C.stripe), metal = mat(C.fence, { metalness: .45 });
  const asphalt = asphaltMaterial();
  buildParkingSurroundings(kit);
  buildParkingStreetDetails(kit);
  solid('asphalt', mallWallX, -.22, R.minZ, R.maxX, 0, R.maxZ, asphalt);
  // A flush walkway keeps the player and navigation on one continuous floor.
  detail('sidewalk', R.minX + P.sidewalkWidth / 2, .008, (R.minZ + R.maxZ) / 2,
    P.sidewalkWidth, .016, R.maxZ - R.minZ, concrete);
  for (let z = R.minZ + 2; z < R.maxZ; z += 2) {
    detail('sidewalk_joint', R.minX + P.sidewalkWidth / 2, .02, z, P.sidewalkWidth, .006, .025, metal);
  }
  // The shared mall wall has the opening; this thin exterior finish clears its outer face.
  kit.wall({ along: 'z', from: R.minZ, to: R.maxZ, at0: R.minX + .015, at1: R.minX + .13,
    height: 6.4, openings: [{ from: G.from, to: G.to, top: G.height }] }, mat(C.wall), { name: 'parking_facade' });
  detail('facade_band', R.minX + .16, 4.1, (R.minZ + R.maxZ) / 2, .07, .5, R.maxZ - R.minZ - .04, mat(0x628c8c));
  detail('facade_coping', R.minX + .12, 6.45, (R.minZ + R.maxZ) / 2, .32, .16, R.maxZ - R.minZ, concrete);
  sign('MEGA MART · CUSTOMER PARKING', { x: R.minX + .21, y: 4.95, z: -8,
    width: 12, height: .85, facing: 'x+', background: '#264653', color: '#ffe2a3' }).name = 'parking_facade_sign';
  sign('RETURN TO MEGA MART', { x: R.minX + .21, y: 3.55, z: 2.5,
    width: 3.4, height: .4, facing: 'x+', background: '#264653', color: '#fff0ce' }).name = 'parking_return_sign';
  const door = kit.shutterDoor({ id: 'parkingLot', label: 'Customer Parking', price: economy.doors.parkingLot,
    opensZone: 'parkingLot', zones, doorway: { minX: mallWallX, maxX: mallWallX + wallThickness,
      minZ: G.from, maxZ: G.to, height: G.height }, text: 'PARKING CLOSED' });

  // Concrete base and metal fence: one faithful collider per side, with no climbable ledges.
  const B = P.boundary;
  fence('north', R.minX, R.maxZ, R.maxX, R.maxZ + B.thickness);
  fence('south', R.minX, R.minZ - B.thickness, R.maxX, R.minZ);
  fence('east', R.maxX, R.minZ - B.thickness, R.maxX + B.thickness, R.maxZ + B.thickness);
  function fence(id, x0, z0, x1, z1) {
    // Closely spaced bars match the boundary volume; bullets pass through the gaps.
    const collider = kit.addCollider(x0, 0, z0, x1, B.height, z1);
    collider.ignoreShots = true;
    const alongX = x1 - x0 > z1 - z0, length = alongX ? x1 - x0 : z1 - z0;
    detail(`${id}_base`, (x0 + x1) / 2, .15, (z0 + z1) / 2, x1 - x0, .3, z1 - z0, concrete);
    for (const y of [.65, 2.9]) detail(`${id}_rail`, (x0 + x1) / 2, y, (z0 + z1) / 2,
      alongX ? length : .075, .07, alongX ? .075 : length, metal);
    for (let at = .12; at < length; at += .42) detail(`${id}_bar`, alongX ? x0 + at : (x0 + x1) / 2,
      1.83, alongX ? (z0 + z1) / 2 : z0 + at, .045, 3.06, .045, metal);
  }
  // A locked vehicle gate makes the perimeter's dead end legible.
  sign('EXIT CLOSED · PLEASE REMAIN A CUSTOMER', { x: 51, y: 2.1, z: R.minZ + .09,
    width: 6.4, height: .6, facing: 1, background: '#93566b', color: '#ffe7bb' }).name = 'parking_exit_notice';
  for (const spawn of P.spawns) {
    const east = spawn.id === 'eastFence';
    sign('KEEP CLEAR', { x: east ? R.maxX - .09 : spawn.x, y: .72,
      z: east ? spawn.z : spawn.z > 0 ? R.maxZ - .09 : R.minZ + .09,
      width: 1.6, height: .3, facing: east ? 'x-' : spawn.z > 0 ? -1 : 1,
      background: '#d6b16e', color: '#3f3543' }).name = `parking_spawn_notice_${spawn.id}`;
  }

  // One row with empty bays between the vehicles and broad lanes on all four sides.
  const bays = P.bays;
  for (let x = bays.fromX; x <= bays.toX + .01; x += bays.spacing) {
    detail('bay_line', x, .014, (bays.minZ + bays.maxZ) / 2, .09, .012, bays.maxZ - bays.minZ, paint);
    if (x < bays.toX) detail('bay_end', x + 1.75, .014, bays.minZ, 3.42, .012, .09, paint);
  }
  for (let x = 39; x < 60; x += 4) detail('lane_dash', x, .015, -3.5, 1.7, .012, .11, paint);
  for (let z = -20; z < -14; z += .6) detail('crosswalk', 36.5, .026, z, 3.2, .012, .28, paint);
  for (const vehicle of P.vehicles) buildVehicle(vehicle);

  function buildVehicle(v) {
    const { x, z, width: w, length: d, height: h } = v;
    const body = mat(v.color, { roughness: .66, metalness: .18 }), trim = mat(v.stripe);
    const chrome = mat(C.chrome, { roughness: .4, metalness: .65 }), glass = mat(C.glass, { roughness: .3, metalness: .35 });
    // Full-height body silhouettes and matching colliders prevent safe spots on roofs.
    solid(`${v.id}_body`, x - w / 2, .25, z - d / 2, x + w / 2, h, z + d / 2, body);
    detail(`${v.id}_roof`, x, h + .045, z, w + .08, .09, d + .06, trim);
    for (const side of [-1, 1]) {
      detail('car_bumper', x, .45, z + side * (d / 2 + .045), w + .08, .18, .09, chrome);
      detail('car_windshield', x, h - .55, z + side * (d / 2 + .014), w - .26, .68, .018, glass);
      detail('car_grille', x, .85, z + d / 2 + .018, w * .42, .25, .024, metal);
      for (const dx of [-w * .34, w * .34]) {
        detail('car_light', x + dx, .9, z + side * (d / 2 + .03), .32, .22, .04,
          mat(side > 0 ? 0xe7ce8e : 0xa24c60));
      }
      detail('car_side_stripe', x + side * (w / 2 + .016), .83, z, .024, .24, d - .15, trim);
      for (const dz of [-d * .29, d * .29]) {
        detail('car_tyre', x + side * (w / 2 + .035), .31, z + dz, .08, .62, .62, mat(C.rubber));
        detail('car_hubcap', x + side * (w / 2 + .083), .31, z + dz, .025, .3, .3, chrome);
      }
      for (const dz of [-d * .29, 0, d * .29]) {
        detail('car_window', x + side * (w / 2 + .017), h - .55, z + dz, .024, .65, d * .22, glass);
        detail('car_handle', x + side * (w / 2 + .04), h - 1.03, z + dz + .3, .045, .045, .23, chrome);
      }
    }
    if (v.id === 'delivery') sign('SUNSET GALLERIA · SAME DAY DELIVERY*', { x: x + w / 2 + .04, y: 1.12, z,
      width: 3.7, height: .32, facing: 'x+', background: '#b86476', color: '#fff0ce' }).name = 'parking_van_logo';
  }
  const lamps = P.lamps.map(l => {
    solid('lamp_post', l.x - .11, 0, l.z - .11, l.x + .11, l.y + .3, l.z + .11, metal);
    detail('lamp_arm', l.x + .55, l.y + .2, l.z, 1.2, .14, .15, metal);
    detail('lamp_housing', l.x + 1.1, l.y + .1, l.z, .8, .22, .5, metal);
    detail('lamp_lens', l.x + 1.1, l.y - .025, l.z, .66, .025, .4,
      mat(l.color, { emissive: l.color, emissiveIntensity: .7 }));
    const light = new THREE.PointLight(l.color, l.intensity, l.distance, 2);
    light.position.set(l.x + 1.1, l.y - .1, l.z); group.add(light); return light;
  });
  // Empty bags and oil stains sit on the asphalt and never shrink the routes.
  const random = seededRandom(198610);
  for (let i = 0; i < 20; i++) {
    const x = 38 + random() * 23, z = R.minZ + .4 + random() * 1.2;
    const litter = detail('litter', x, .025, z, .12 + random() * .18, .018, .14, mat(0xc6b29d));
    litter.rotation.y = random() * Math.PI;
  }
  buildSky();

  return { door, lamps,
    spawns: P.spawns.map(s => ({ name: `spawn_parkingLot_${s.id}`, zone: 'parkingLot', position: new THREE.Vector3(s.x, 0, s.z) })),
    room: { id: 'parkingLot', ...R, minY: -.3, maxY: 12 },
    portal: { a: 'megaMart', b: 'parkingLot', door: door.id, minX: mallWallX, maxX: R.minX + .14,
      minY: 0, maxY: G.height, minZ: G.from, maxZ: G.to },
  };

  function asphaltMaterial() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d'), random = seededRandom(863);
    ctx.fillStyle = C.asphalt; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = random() > .5 ? '#57535d' : '#3c3a46';
      ctx.fillRect(random() * 128, random() * 128, 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(12, 12);
    return new THREE.MeshStandardMaterial({ map: texture, roughness: .98 });
  }
  function buildSky() {
    const geometry = new THREE.SphereGeometry(P.sky.radius, 32, 16), positions = geometry.attributes.position;
    const horizon = new THREE.Color(P.sky.horizon), zenith = new THREE.Color(P.sky.zenith), color = new THREE.Color();
    const colors = [];
    for (let i = 0; i < positions.count; i++) {
      color.copy(horizon).lerp(zenith, Math.min(1, Math.max(0, positions.getY(i) / P.sky.radius) * 2.5));
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const sky = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, depthWrite: false }));
    sky.name = 'parking_sunset_sky'; sky.position.fromArray(P.sky.center); sky.renderOrder = -100;
    // Preserve the authored vertex gradient through static batching.
    sky.userData.dynamic = true; group.add(sky);
  }
}
