// =============================================================================
// FOOD COURT SHOWPIECES: the Paper Hat burger, the Wheelie Sneakers ramp and the Giant Foam Finger.
// Each is one big themed fixture (docs/archive/wardrobe-showroom-plan.md, section 1): readable from across the court, alive while
// unsold (idle motion), dim with a SOLD OUT card once owned. Shapes + motion live here; the sold state, the buying pose
// and the motif are driven by game/features/wardrobeFixtures.js through the handle from showpiece.js.
//
//   paperHat         a fibreglass burger on Burger Barn's roof (lid bobs, steam) + a hat chute dropping paper hats into a
//                    tray on the counter where you buy
//   wheelieSneakers  a skate ramp on the court floor in front of Good Sports' east window: giant sneaker with spinning heels,
//                    skid marks, a hazard apron and a NO RUNNING sign on a post
//   foamFinger       a 3 m foam finger waggling out of a pennant-covered bin on the open court floor NW of the pillar (a pillar at (-13, -11.3)
//                    hides Good Sports' west half from the entrance, so the finger stands clear of it where the entrance sees it)
//
// All three face +Z (into the court). Each adds at most one plain collider (the ramp, the bin, a sign post); everything else
// is decoration. Placement numbers come from config/wardrobe.js (`at`); the survey that chose them is in docs/map.md.
// =============================================================================
import * as THREE from 'three';
import { makeSignTexture } from '../../../world/textures.js';
import { wardrobeItems } from '../../../config/wardrobe.js';
import { createShowpiece } from './showpiece.js';

const ink = 0x2e2332;
const cream = 0xffedca;
const ease = (p) => p * p;

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const drum = (r, h, segments = 14) => new THREE.CylinderGeometry(r, r, h, segments);
const wheel = (r, width) => new THREE.CylinderGeometry(r, r, width, 12).rotateZ(Math.PI / 2); // (axis along X: rotation.x spins it)

function begin(kit, spot, floorY) {
  if (spot.normal.z !== 1) throw new Error(`showpiece ${spot.name}: the Food Court showpieces face +Z`);
  const item = wardrobeItems[spot.item];
  const position = new THREE.Vector3(spot.position.x, floorY, spot.position.z);
  return { s: createShowpiece({ kit, name: spot.name, color: item.color, position, yaw: 0 }), item, origin: position };
}

// ---------------------------------------------------------------------------- Paper Hat
// Local z 0 = the counter's front rim; the stall's facade is at z -1.2 and its wall at -1.33, the counter top is y 1.2.
function buildPaperHat(kit, spot, floorY) {
  const { s, item } = begin(kit, spot, floorY);
  const roofY = 4.8;
  const burgerZ = -0.72;

  // The roof platform (a board on two brackets above the stall's name sign) and its neon strip + sign.
  s.solid(box(2.2, 0.25, 1.21), 0xb83239, [0, 4.675, -0.705]);
  for (const x of [-0.85, 0.85]) s.solid(box(0.1, 0.34, 0.14), 0x758891, [x, 4.45, -1.12]);
  s.sign('PAPER HATS', 1.5, 0.15, [0, 4.675, -0.075], { background: '#ad2934' });
  for (const y of [4.56, 4.79]) s.glow(box(2.1, 0.035, 0.035), item.color, [0, y, -0.09], undefined, { intensity: 1.2, pulse: (t) => 0.8 + 0.2 * Math.sin(t * 3 + y) });

  // The burger: five fixed layers and a lid that bobs.
  s.solid(drum(0.52, 0.2), 0xe0a040, [0, roofY + 0.1, burgerZ]);
  s.solid(drum(0.56, 0.11), 0x5b3421, [0, roofY + 0.255, burgerZ]);
  s.solid(box(0.7, 0.03, 0.7), 0xffc62e, [0, roofY + 0.325, burgerZ], [0, Math.PI / 4, 0]);
  s.solid(drum(0.58, 0.05, 10), 0x66b84a, [0, roofY + 0.37, burgerZ]);
  s.solid(drum(0.5, 0.06), 0xd62839, [0, roofY + 0.42, burgerZ]);
  const lid = new THREE.Group();
  lid.position.set(0, roofY + 0.45, burgerZ);
  s.live.add(lid);
  s.moving(new THREE.SphereGeometry(0.56, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1), 0xe0a040, [0, 0.02, 0], undefined, { parent: lid });
  s.moving(drum(0.56, 0.04), 0xc98a2e, [0, 0, 0], undefined, { parent: lid });
  for (const [x, z] of [[-0.25, 0.1], [0.05, 0.28], [0.3, 0.05], [-0.05, -0.15], [0.2, -0.22], [-0.3, -0.18], [0.12, 0.08]]) {
    const y = 0.02 + 0.476 * Math.sqrt(Math.max(0.05, 1 - (x * x + z * z) / (0.56 * 0.56))) - 0.01;
    s.moving(box(0.07, 0.03, 0.045), cream, [x, y, z], [0, x * 3, 0], { parent: lid });
  }
  // Steam from the patty's front edge: three puffs rising and fading, out of step.
  const puffs = [0, 1, 2].map((i) => {
    const puff = s.moving(new THREE.SphereGeometry(0.07, 8, 6), 0xffffff, [(i - 1) * 0.22, roofY + 0.3, burgerZ + 0.55], undefined, { transparent: true, opacity: 0, depthWrite: false });
    return puff;
  });

  // The counter end: a podium over the food trays, a tray on it, a hat stack, the chute tube and its funnel.
  s.solid(box(0.62, 0.22, 0.28), 0xb83239, [0, 1.31, -0.18]);
  s.solid(box(0.62, 0.03, 0.28), 0xffedca, [0, 1.435, -0.18]);
  for (const x of [-0.17, 0, 0.17]) {
    s.solid(box(0.15, 0.09, 0.12), cream, [x, 1.495, -0.18]);
    s.solid(box(0.17, 0.03, 0.14), 0xd62839, [x, 1.5, -0.18]); // (the band stands 1 cm proud of the hat all round)
  }
  s.moving(box(0.26, 0.74, 0.26), 0xbfe6ef, [0, 1.82, -0.18], undefined, { transparent: true, opacity: 0.28, depthWrite: false });
  s.solid(box(0.4, 0.05, 0.4), 0xd62839, [0, 2.2, -0.18]);
  s.solid(box(0.3, 0.05, 0.3), 0xb83239, [0, 2.25, -0.18]);
  const dropping = s.moving(box(0.14, 0.08, 0.11), cream, [0, 2.1, -0.18]);
  s.moving(box(0.16, 0.03, 0.13), 0xd62839, [0, 0.04, 0], undefined, { parent: dropping });
  s.card('PAPER HAT', 'SOLD OUT · IN YOUR SIZE', 0.5, 0.13, [0, 1.31, -0.015], { background: '#402641' });
  s.banner(1.3, 0.26, [0, 4.96, -0.13]);

  s.animate((t, pose) => {
    lid.position.y = roofY + 0.45 + 0.04 * (1 + Math.sin(t * 2.2)) + 0.1 * pose; // (the ceiling is at 6 m: the lid tops out at 5.93)
    lid.rotation.x = 0.04 * Math.sin(t * 2.2 + 1) - 0.25 * pose;
    puffs.forEach((puff, i) => {
      const p = (t * 0.45 + i / 3) % 1;
      puff.position.y = roofY + 0.3 + p * 0.5;
      puff.scale.setScalar(0.8 + p * 1.6);
      puff.material.opacity = t === 0 && pose === 0 ? 0 : 0.55 * Math.sin(Math.PI * p);
    });
    const p = (t / 2.6) % 1;
    dropping.visible = t > 0 && p < 0.6;
    dropping.position.y = 2.1 - 0.56 * ease(Math.min(1, p / 0.6));
  });
  s.handle.reset();
  return s.handle;
}

// ---------------------------------------------------------------------------- Wheelie Sneakers
// Local z 0 = the ramp's low edge on the court floor; it rises toward -Z (the shop's windows), 1.3 m deep and 0.9 m high.
function buildWheelies(kit, spot, floorY) {
  const { s, item, origin } = begin(kit, spot, floorY);
  const depth = 1.3;
  const rise = 0.9;
  const half = 0.95;
  const slope = Math.atan2(rise, depth);

  // The ramp: a wedge (plain solid: you vault it like a counter, it is 0.9 m high and 1.3 m deep).
  const profile = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(depth, 0), new THREE.Vector2(depth, rise)]);
  const wedge = new THREE.ExtrudeGeometry(profile, { depth: half * 2, bevelEnabled: false }).rotateY(Math.PI / 2).translate(-half, 0, 0);
  s.solid(wedge, item.color, [0, 0, 0]);
  kit.addCollider(origin.x - half, floorY, origin.z - depth, origin.x + half, floorY + rise, origin.z).vaultable = true;
  // Skid marks on the slope and a hazard apron on the floor in front of it.
  for (const [x, len] of [[-0.45, 1.2], [0.25, 1.0], [0.38, 0.8]]) {
    const at = 0.5;
    s.solid(box(0.07, 0.008, len), ink, [x, rise * at + 0.012 * Math.cos(slope), -depth * at + 0.012 * Math.sin(slope)], [slope, 0, 0]);
  }
  for (let i = 0; i < 6; i++) s.solid(box(0.3, 0.03, 0.14), i % 2 ? 0x2e2332 : 0xffc61a, [-0.75 + i * 0.3, 0.015, 0.07]);

  // The giant sneaker, parked on the slope pointing down it.
  const along = 0.55;
  const normal = new THREE.Vector3(0, Math.cos(slope), Math.sin(slope));
  const shoe = new THREE.Group();
  shoe.position.set(0, rise * along, -depth * along).addScaledVector(normal, 0.3);
  shoe.rotation.x = slope;
  s.still.add(shoe);
  s.solid(box(0.5, 0.1, 1.1), 0xe1d3af, [0, -0.12, 0], undefined, shoe);
  s.solid(box(0.46, 0.34, 0.55), 0x7755aa, [0, 0.1, -0.26], undefined, shoe);
  s.solid(box(0.44, 0.2, 0.5), 0x8c6bc4, [0, 0.03, 0.28], undefined, shoe);
  s.solid(box(0.45, 0.12, 0.2), cream, [0, -0.02, 0.5], undefined, shoe);
  s.solid(box(0.34, 0.14, 0.06), cream, [0, 0.3, -0.1], undefined, shoe);
  for (const z of [0.0, 0.1, 0.2]) s.solid(box(0.3, 0.03, 0.04), cream, [0, 0.2, z], [-0.5, 0, 0], shoe);
  s.solid(box(0.47, 0.08, 0.3), 0xff8a1f, [0, 0.1, 0.0], undefined, shoe);
  // The heel wheels spin, so they live in the live group on a rig that sits exactly where the sneaker does.
  const rig = new THREE.Group();
  rig.position.copy(shoe.position);
  rig.rotation.x = slope;
  s.live.add(rig);
  const wheels = [];
  for (const [x, z] of [[-0.27, -0.38], [0.27, -0.38], [-0.27, 0.34], [0.27, 0.34]]) {
    wheels.push(s.moving(wheel(0.1, 0.08), ink, [x, -0.2, z], undefined, { parent: rig }));
  }

  // The NO RUNNING sign on a post at the ramp's east side, with a neon frame and the item's card below it.
  const postX = half + 0.2;
  const postZ = -0.4;
  s.solid(box(0.1, 3.0, 0.1), 0x758891, [postX, 1.5, postZ]);
  kit.addCollider(origin.x + postX - 0.05, floorY, origin.z + postZ - 0.05, origin.x + postX + 0.05, floorY + 3.0, origin.z + postZ + 0.05);
  s.sign('NO RUNNING', 0.9, 0.9, [postX, 2.05, postZ + 0.07], { background: '#c4262e' });
  s.neonFrame(0.98, 0.98, [postX, 2.05, postZ + 0.075]);
  s.card('WHEELIES', 'SOLD OUT · IN YOUR SIZE', 0.62, 0.15, [postX, 1.3, postZ + 0.07], { background: '#402641' });
  s.banner(1.0, 0.24, [postX, 2.78, postZ + 0.07]);

  s.animate((t, pose) => {
    for (const w of wheels) w.rotation.x = t * 7;
  });
  s.handle.reset();
  return s.handle;
}

// ---------------------------------------------------------------------------- Giant Foam Finger
// Local z 0 = the bin's front face; the bin is 0.9 wide and 0.7 deep, the finger's pivot sits in its middle.
function buildFoamFinger(kit, spot, floorY) {
  const { s, item, origin } = begin(kit, spot, floorY);
  const binDepth = 0.8;
  const binHeight = 0.65;
  const binHalf = 0.5;
  s.solid(box(binHalf * 2, binHeight, binDepth), 0x334677, [0, binHeight / 2, -binDepth / 2]);
  s.solid(box(binHalf * 2 + 0.08, 0.06, binDepth + 0.08), 0x4a62a8, [0, binHeight + 0.03, -binDepth / 2]);
  kit.addCollider(origin.x - binHalf, floorY, origin.z - binDepth, origin.x + binHalf, floorY + binHeight, origin.z).vaultable = true;
  // Pennants strung across the bin's face.
  s.solid(box(0.92, 0.012, 0.012), cream, [0, 0.5, 0.025]);
  [0xbb314d, 0xffc61a, 0xf4f0e6, 0xbb314d, 0xffc61a, 0xf4f0e6].forEach((hex, i) => {
    s.solid(box(0.15, 0.15, 0.012), hex, [-0.4 + i * 0.16, 0.43, 0.03], [0, 0, Math.PI / 4]);
  });

  // The finger (a pivot that waggles): a fat fist, three curled fingers, a thumb, a tapered index finger with its tip, '#1' on the fist.
  const light = 0x4d83ff;
  const indexX = -0.27;
  const pivot = new THREE.Group();
  pivot.position.set(0, binHeight + 0.03, -binDepth / 2);
  s.live.add(pivot);
  s.moving(box(0.84, 0.72, 0.4), item.color, [0, 0.36, 0], undefined, { parent: pivot });
  for (const x of [-0.04, 0.17, 0.38]) s.moving(drum(0.1, 0.62, 10), light, [x, 0.36, 0.23], undefined, { parent: pivot });
  s.moving(drum(0.1, 0.5, 10), light, [-0.4, 0.3, 0.2], [0, 0, 1.2], { parent: pivot });
  s.moving(new THREE.CylinderGeometry(0.13, 0.19, 2.0, 12), item.color, [indexX, 1.6, 0], undefined, { parent: pivot });
  s.moving(new THREE.SphereGeometry(0.13, 12, 8), item.color, [indexX, 2.6, 0], undefined, { parent: pivot });
  const fist = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: makeSignTexture('#1', { background: '#2f6bff', color: '#ffffff', aspect: 1 }) }));
  fist.position.set(indexX, 0.3, 0.205);
  pivot.add(fist);
  // A neon ring sliding up and down the finger.
  const ring = s.glow(new THREE.TorusGeometry(0.26, 0.025, 8, 24).rotateX(Math.PI / 2), item.color, [indexX, 1.5, 0], undefined, { parent: pivot, intensity: 1.3 });
  s.card('FOAM FINGER', 'SOLD OUT · IN YOUR SIZE', 0.62, 0.14, [0, 0.14, 0.022], { background: '#402641' });
  s.banner(0.8, 0.22, [indexX + 0.18, 1.05, 0.24], { parent: pivot });

  s.animate((t, pose) => {
    pivot.rotation.z = 0.15 * Math.sin(t * 3.2) * (1 - 0.7 * pose);
    pivot.scale.y = 1 + 0.12 * pose;
    ring.position.y = 1.1 + 0.8 * (0.5 + 0.5 * Math.sin(t * 1.7));
  });
  s.handle.reset();
  return s.handle;
}

/** Item id -> builder(kit, spot, floorY) -> handle. mall.js uses these instead of the generic rack display. */
export const foodCourtShowpieces = {
  paperHat: buildPaperHat,
  wheelieSneakers: buildWheelies,
  foamFinger: buildFoamFinger,
};
