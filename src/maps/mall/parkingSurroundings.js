import * as THREE from 'three';
import { parkingLot } from '../../config/parkingLot.js';

// Scenic streets and businesses sit beyond the fenced play space. No colliders
// or real lights: distance, batching and the existing lighting keep this inexpensive.
export function buildParkingSurroundings(kit) {
  const S = parkingLot.scenery, R = S.road, C = S.crossStreet;
  const { mat, group } = kit;
  const concrete = mat(0xada4a3), asphalt = mat(0x484551), grass = mat(0x646e66);
  const paint = mat(0xd8c79d), metal = mat(0x5a5965), glass = mat(0x344453);
  const wood = mat(0x786968), leaf = mat(0x4a635c), darkLeaf = mat(0x405651);
  function box(name, x, y, z, w, h, d, material) {
    return kit.box(x - w / 2, y - h / 2, z - d / 2, x + w / 2, y + h / 2, z + d / 2,
      material, { name: `parking_scenery_${name}`, collide: false });
  }
  function label(name, text, options) {
    const mesh = kit.sign(text, options); mesh.name = `parking_scenery_${name}`; return mesh;
  }
  const G = S.ground;
  box('ground', (G.minX + G.maxX) / 2, -.16, (G.minZ + G.maxZ) / 2,
    G.maxX - G.minX, .1, G.maxZ - G.minZ, grass);
  box('street', (R.minX + R.maxX) / 2, -.035, (R.minZ + R.maxZ) / 2,
    R.maxX - R.minX, .05, R.maxZ - R.minZ, asphalt);
  for (const [from, to] of [[C.minX, R.minX], [R.maxX, C.maxX]]) {
    box('cross_street', (from + to) / 2, -.035, (C.minZ + C.maxZ) / 2,
      to - from, .05, C.maxZ - C.minZ, asphalt);
  }
  const sw = S.sidewalkWidth, curb = S.curbHeight;
  for (const x of [R.minX - sw / 2, R.maxX + sw / 2]) {
    for (const [from, to] of [[R.minZ, C.minZ], [C.maxZ, R.maxZ]]) {
      box('sidewalk', x, curb / 2 - .08, (from + to) / 2, sw, curb, to - from, concrete);
      for (let z = from + 2; z < to; z += 3) box('sidewalk_joint', x, curb - .073, z, sw - .04, .008, .025, metal);
    }
  }
  for (let z = R.minZ + 3; z < R.maxZ; z += 5) {
    if (z > C.minZ - 2 && z < C.maxZ + 2) continue;
    for (const dx of [-.1, .1]) box('road_center', 75 + dx, .008, z, .055, .012, 2.5, paint);
  }
  for (let x = C.minX + 3; x < C.maxX; x += 5) {
    if (x > R.minX - 2 && x < R.maxX + 2) continue;
    box('cross_center', x, .008, (C.minZ + C.maxZ) / 2, 2.5, .012, .08, paint);
  }
  for (let x = R.minX + .4; x < R.maxX; x += 1) {
    for (const z of [C.minZ - 1.5, C.maxZ + 1.5]) box('crosswalk', x, .015, z, .5, .012, 1.7, concrete);
  }

  // Hedge islands break up the fence line, with gaps preserving each spawn's silhouette.
  for (const z of [-19, -12, 1, 13, 28]) {
    box('hedge_bed', 65.7, .04, z, 2.4, .1, 4.8, concrete);
    box('hedge', 65.7, .57, z, 1.8, 1, 4.1, leaf);
  }
  for (const [i, [x, z]] of S.trees.entries()) {
    box('tree_trunk', x, 1.35, z, .3, 2.9, .3, wood);
    for (const [y, radius] of [[3.2, 1.6], [4.5, 1.25]]) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius + (i % 3) * .13, 0), i % 2 ? leaf : darkLeaf);
      crown.name = 'parking_scenery_tree_crown'; crown.position.set(x, y, z); group.add(crown);
    }
  }

  for (const shop of S.shops) {
    const { x, z, width: w, depth: d, height: h } = shop;
    const front = x - d / 2, wall = mat(shop.color), accent = mat(shop.accent);
    box(`${shop.id}_body`, x, h / 2, z, d, h, w, wall);
    box(`${shop.id}_roof`, x, h + .12, z, d + .45, .24, w + .45, metal);
    box(`${shop.id}_fascia`, front - .08, h - .65, z, .14, .8, w - .12, accent);
    box(`${shop.id}_apron`, (front + R.maxX + sw) / 2, .015, z,
      front - R.maxX - sw, .05, w + 1.4, asphalt);
    for (const dz of [-w * .3, w * .3]) {
      box(`${shop.id}_window`, front - .025, 1.8, z + dz, .03, 1.5, w * .29, glass);
      box(`${shop.id}_sill`, front - .07, 1.02, z + dz, .13, .08, w * .31, concrete);
      for (const offset of [-.45, .45]) box('window_mullion', front - .047, 1.8, z + dz + offset, .025, 1.53, .035, accent);
    }
    box(`${shop.id}_door`, front - .03, 1.15, z, .04, 2.3, 1.15, glass);
    box('door_handle', front - .065, 1.05, z + .4, .04, .34, .04, concrete);
    box(`${shop.id}_awning`, front - .6, 2.85, z, 1.15, .18, w * .8, accent);
    label(`${shop.id}_sign`, shop.sign, { x: front - .165, y: h - .65, z,
      width: w - .6, height: .65, facing: 'x-', background: '#394454', color: shop.ink });
    label(`${shop.id}_sub`, shop.sub, { x: front - .08, y: .6, z,
      width: w - .8, height: .28, facing: 'x-', background: '#d9c7aa', color: '#514451' });
    // Wheel stops and bay stripes make these read as roadside businesses.
    for (let dz = -w / 2 + 1; dz < w / 2; dz += 3) {
      box('shop_bay', front - 3, .052, z + dz, 4.2, .012, .08, paint);
      box('shop_wheel_stop', front - .8, .17, z + dz + .9, .16, .25, 1.5, concrete);
    }
  }
  for (const [x, z, w, h, d] of S.distantBuildings) {
    box('distant_building', x, h / 2 - .1, z, w, h, d, mat(0x7e7c8b));
    box('distant_roof', x, h, z, w + .3, .2, d + .3, metal);
    for (let dx = -w / 2 + 1.5; dx < w / 2; dx += 3) {
      for (const y of [2.5, 5.5]) box('distant_window', x + dx, y, z + d / 2 + .025, 1.3, 1.3, .03, glass);
    }
  }
  for (const [x, z, color] of S.parkedCars) {
    box('distant_car', x, .65, z, 4, .85, 1.8, mat(color, { roughness: .6 }));
    box('distant_car_cabin', x - .15, 1.25, z, 2.1, .65, 1.55, glass);
    for (const dx of [-1.2, 1.2]) for (const dz of [-.87, .87]) box('distant_tyre', x + dx, .25, z + dz, .5, .5, .12, metal);
  }

  for (const [x, z] of S.poles) {
    box('utility_pole', x, 4.3, z, .24, 8.6, .24, wood);
    box('utility_crossbar', x, 7.9, z, .17, .15, 2.4, wood);
    box('street_light_arm', x - 1, 6.1, z, 2, .12, .12, metal);
    box('street_light', x - 1.9, 6.02, z, .65, .12, .36, mat(0xe8c895, { emissive: 0xc8a575, emissiveIntensity: .45 }));
  }
  // Thin cylinders batch with the poles; a shallow sag makes the overhead wires legible.
  for (let i = 1; i < S.poles.length; i++) {
    const [x0, z0] = S.poles[i - 1], [x1, z1] = S.poles[i];
    for (const offset of [-.8, .8]) {
      const points = [new THREE.Vector3(x0, 7.95, z0 + offset),
        new THREE.Vector3((x0 + x1) / 2, 7.2, (z0 + z1) / 2 + offset), new THREE.Vector3(x1, 7.95, z1 + offset)];
      for (let j = 1; j < points.length; j++) {
        const delta = points[j].clone().sub(points[j - 1]);
        const wire = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, delta.length(), 4), metal);
        wire.name = 'parking_scenery_wire'; wire.position.copy(points[j]).add(points[j - 1]).multiplyScalar(.5);
        wire.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); group.add(wire);
      }
    }
  }
  const p = S.pylon;
  box('pylon_post', p.x, p.height / 2, p.z, .35, p.height, .35, metal);
  box('pylon_case', p.x, p.height - 1.3, p.z, .35, 2.7, 4.8, mat(0x557d7d));
  for (const side of [-1, 1]) {
    label('pylon_title', 'SUNSET GALLERIA', { x: p.x + side * .205, y: p.height - .7, z: p.z,
      width: 4.5, height: .75, facing: side < 0 ? 'x-' : 'x+', background: '#344954', color: '#edc986' });
    label('pylon_hours', 'OPEN FOREVER', { x: p.x + side * .205, y: p.height - 1.6, z: p.z,
      width: 4.5, height: .5, facing: side < 0 ? 'x-' : 'x+', background: '#344954', color: '#e8c9ca' });
  }
  box('stop_post', R.minX - 1, 1.3, C.maxZ + 2, .08, 2.6, .08, metal);
  label('stop_sign', 'STOP', { x: R.minX - 1, y: 2.25, z: C.maxZ + 2.06, width: .7, height: .7,
    facing: 1, background: '#954f61', color: '#f7e4d7' });
}
