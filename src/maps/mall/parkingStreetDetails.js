import * as THREE from 'three';
import { parkingDetails as D } from '../../config/parkingDetails.js';
import { parkingLot as P } from '../../config/parkingLot.js';
import { createParkingDetailKit } from './parkingDetailKit.js';

export function buildParkingStreetDetails(kit) {
  const { box, rod, sign, plane, mat } = createParkingDetailKit(kit, 'parking_street');
  const metal = mat(0x727d85, { metalness: .35 }), dark = mat(0x303740), cream = mat(0xc2b49c);
  const teal = mat(0x668e88), coral = mat(0xaf7f6e), glass = mat(0x6f8f98, { transparent: true, opacity: .22, depthWrite: false });
  const B = D.street.busStop;
  for (const dx of [-B.width * .4, B.width * .4]) for (const dz of [-B.length * .43, B.length * .43]) {
    rod('bus_shelter_post', [B.x + dx, .08, B.z + dz], [B.x + dx, B.height, B.z + dz], .035, metal);
  }
  box('bus_shelter_roof', B.x, B.height + .06, B.z, B.width + .25, .12, B.length + .3, teal);
  box('bus_shelter_rear_glass', B.x - B.width * .4, 1.3, B.z, .025, 2.25, B.length * .8, glass);
  for (const dz of [-B.length * .42, B.length * .42]) box('bus_shelter_side_glass', B.x, 1.3, B.z + dz,
    B.width * .75, 2.25, .025, glass);
  box('bus_bench_seat', B.x - .1, .55, B.z, .48, .1, B.length * .65, cream);
  box('bus_bench_back', B.x - .3, .85, B.z, .08, .5, B.length * .65, teal);
  for (const dz of [-.85, .85]) box('bus_bench_leg', B.x - .1, .28, B.z + dz, .32, .5, .12, metal);
  sign('bus_timetable', 'ROUTE 86 · SUNSET LOOP', { x: B.x - .62, y: 1.9, z: B.z,
    width: 1.6, height: .3, facing: 'x+', background: '#d4c7ae', color: '#3b4c51', font: 'wayfinding' });
  sign('bus_timetable_sub', 'NEXT BUS: PLEASE WAIT', { x: B.x - .62, y: 1.55, z: B.z,
    width: 1.6, height: .3, facing: 'x+', background: '#d4c7ae', color: '#5c4c55', font: 'officialBody' });
  sign('bus_ad', 'YOUR NEXT STOP: SUNSET GALLERIA', { x: B.x - .75, y: 1.8, z: B.z,
    width: 2, height: .55, facing: 'x-', background: '#536e78', color: '#ead3a5', font: 'mallBrand' });
  rod('bus_stop_pole', [69.5, .1, B.z - 2.5], [69.5, 3, B.z - 2.5], .035, metal);
  sign('bus_stop', '86 · BUS STOP', { x: 69.44, y: 2.7, z: B.z - 2.5,
    width: 1.05, height: .45, facing: 'x-', background: '#547a7d', color: '#eadbc0', font: 'wayfinding' });

  for (const [x, z] of D.street.bins) {
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(.25, .22, .85, 8), teal);
    bin.name = 'parking_street_bin'; bin.position.set(x, .5, z); kit.group.add(bin);
    box('bin_lid', x, .95, z, .53, .09, .53, metal);
    box('bin_slot', x - .26, .76, z, .022, .12, .3, dark);
    for (const dz of [-.3, -.08]) box('bin_litter', x + .4, .035, z + dz, .12, .015, .17, cream, [0, .4, 0]);
  }
  const N = D.street.streetNames;
  rod('street_name_post', [N.x, .1, N.z], [N.x, 3, N.z], .035, metal);
  sign('street_name', 'SUNSET BOULEVARD', { x: N.x - .05, y: 2.85, z: N.z,
    width: 2.2, height: .3, facing: 'x-', background: '#52796d', color: '#e0d8c5', font: 'wayfinding' });
  sign('street_name_cross', 'GALLERIA DRIVE', { x: N.x, y: 2.5, z: N.z + .05,
    width: 2, height: .3, facing: 1, background: '#52796d', color: '#e0d8c5', font: 'wayfinding' });

  const W = D.street.roadworks;
  box('road_repair_patch', W.x, .023, W.z, W.width, .02, W.length, dark);
  for (const dx of [-W.width / 2, W.width / 2]) for (const dz of [-W.length / 2, 0, W.length / 2]) {
    box('cone_base', W.x + dx, .05, W.z + dz, .34, .07, .34, dark);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(.14, .48, 6), coral);
    cone.name = 'parking_street_traffic_cone'; cone.position.set(W.x + dx, .32, W.z + dz); kit.group.add(cone);
    box('cone_band', W.x + dx, .32, W.z + dz, .17, .08, .17, cream);
  }
  for (const dx of [-.8, .8]) rod('barricade_leg', [W.x + dx, .1, W.z - 2.8], [W.x + dx, 1.1, W.z - 2.8], .035, metal);
  box('barricade', W.x, .95, W.z - 2.8, 2.2, .3, .1, coral);
  for (const dx of [-.7, -.1, .5]) box('barricade_stripe', W.x + dx, .95, W.z - 2.86, .28, .3, .02, cream, [0, 0, -.3]);
  sign('roadworks_notice', 'ROAD WORK · NO END IN SIGHT', { x: W.x, y: 1.45, z: W.z - 2.8,
    width: 2.2, height: .35, facing: -1, background: '#ba8b61', color: '#4b4146', font: 'hazard' });

  const C = D.street.stoppedCar, car = new THREE.Group();
  car.name = 'parking_street_stopped_car'; car.position.set(C.x, 0, C.z); car.rotation.y = C.yaw; kit.group.add(car);
  function carBox(name, x, y, z, w, h, depth, material, rotation = null) {
    const mesh = box(name, x, y, z, w, h, depth, material, rotation); car.add(mesh); return mesh;
  }
  carBox('stopped_body', 0, .65, 0, 1.8, .85, 4.1, mat(0x9b8f85));
  carBox('stopped_cabin', 0, 1.2, -.1, 1.55, .6, 2, dark);
  carBox('raised_bonnet', 0, 1.17, 1.28, 1.7, .06, 1.35, mat(0x9b8f85), [.5, 0, 0]);
  for (const dx of [-.86, .86]) for (const dz of [-1.25, 1.25]) carBox('stopped_tyre', dx, .26, dz, .13, .52, .52, dark);
  for (const dx of [-.57, .57]) carBox('stopped_lamp', dx, .75, 2.08, .25, .17, .04, cream);

  // Warm windows behind the original mullions, with no additional point lights.
  for (const shop of P.scenery.shops) {
    const front = shop.x - shop.depth / 2;
    const windowGlow = mat(shop.id === 'video' ? 0x8f91ae : 0xc3ac86,
      { emissive: shop.id === 'video' ? 0x565675 : 0x9e7849, emissiveIntensity: .35 });
    for (const side of [-1, 1]) plane('shop_window_glow', front - .051, 1.8, shop.z + side * shop.width * .3,
      shop.width * .26, 1.32, windowGlow, 'x-');
    sign('shop_delivery_notice', shop.id === 'diner' ? 'BACK IN 5 MINUTES' : 'DELIVERIES AT REAR',
      { x: front - .07, y: 1.35, z: shop.z, width: .75, height: .24,
        facing: 'x-', background: '#cfbea1', color: '#564b4e', font: 'marker' });
    box('shop_aircon', shop.x + .7, shop.height + .5, shop.z + 1.2, 1.5, .65, 1.1, metal);
    for (let dz = -.4; dz <= .4; dz += .2) box('shop_aircon_grille', shop.x - .06, shop.height + .5,
      shop.z + 1.2 + dz, .025, .4, .06, dark);
  }
}
