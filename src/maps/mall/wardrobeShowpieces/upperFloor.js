import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { showpieces } from '../../../config/wardrobe.js';
import { createFloorShowpiece } from './showpiece.js';

const ink = 0x272133;
const paper = 0xf4e1bd;
const idle = showpieces.upperFloorIdle;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const sphere = (r) => new THREE.SphereGeometry(r, 10, 7);

function silhouette(points, depth = 0.06) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

function glasses(kit, spot, floorY) {
  const s = createFloorShowpiece(kit, spot, floorY);
  s.base(1.2, 0.3, 0.62, ink);
  s.solid(box(1.22, 1.98, 0.085), 0xab7353, [0, 1.28, -0.52]);
  s.solid(box(1.11, 1.89, 0.04), 0x341c39, [0, 1.28, -0.462]);
  const monster = silhouette([
    [-.43, 0], [-.33, .62], [-.26, .7], [-.3, 1.05], [-.11, .95], [0, 1.18],
    [.13, .96], [.35, 1.08], [.29, .64], [.46, .52], [.5, 0],
  ]);
  s.solid(monster, 0xef3b65, [-.065, .58, -.395]);
  s.solid(monster, s.color, [.065, .57, -.31]);
  s.solid(monster, 0x49785e, [0, .59, -.223]);
  s.solid(box(.43, .18, .045), ink, [0, 1.42, -.127]);
  s.solid(box(.135, .105, .02), 0xe43d57, [-.119, 1.43, -.09]);
  s.solid(box(.135, .105, .02), s.color, [.119, 1.43, -.09]);
  s.solid(box(.29, .095, .028), paper, [0, 1.25, -.113], [0, 0, -.12]);
  const arm = s.group(1.18, -.08);
  arm.position.x = .28;
  s.moving(silhouette([[0, -.08], [.13, -.12], [.29, .06], [.39, .33], [.30, .31],
    [.31, .44], [.23, .32], [.18, .37], [.12, .18], [0, .09]], .075), 0x72a374, [0, 0, 0], undefined, { parent: arm });
  s.animate((t, pose) => { arm.rotation.z = .31 * Math.sin(t * idle.monster) * (1 - pose) + .55 * pose; });
  s.header('3D GLASSES', 1.82, 2.39, -.43);
  s.ticket('IT CAME FROM AISLE 3!', .85, -.107, .94);
  return s.handle;
}

function lightUpSneakers(kit, spot, floorY) {
  const s = createFloorShowpiece(kit, spot, floorY);
  s.base(.72, .33, .73, ink);
  s.solid(box(.11, 1.81, .11), ink, [0, 1.24, -.64]);
  s.solid(box(.91, .065, .54), 0x423253, [0, 1.16, -.35]);
  const sneaker = silhouette([[-.46, 0], [-.49, .14], [-.34, .31], [-.09, .38],
    [.09, .74], [.33, .75], [.47, .57], [.49, .12], [.43, 0]], .38);
  s.solid(sneaker, 0x593ca0, [-.12, 1.24, -.53], [0, -.18, 0]);
  s.solid(box(.93, .095, .407), paper, [-.12, 1.25, -.329], [0, -.18, 0]);
  for (let i = 0; i < 3; i++) {
    s.solid(box(.18, .032, .014), paper, [-.22 + i * .059, 1.59 + i * .073, -.147 + i * .01], [0, -.18, -.14]);
  }
  for (const [i, color] of [0xfd3ac5, 0x58eaff, s.color, 0xffd23a].entries()) {
    s.glow(box(.322, .017, .315), color, [(i % 2 ? 1 : -1) * .17, .351, i < 2 ? -.19 : -.525],
      undefined, { intensity: 1.1, pulse: t => .3 + .7 * Math.max(0, Math.cos(t * idle.disco + i * Math.PI / 2)) });
  }
  s.glow(box(.87, .042, .41), s.color, [-.12, 1.19, -.327], [0, -.18, 0]);
  s.header('LIGHT-UP SNEAKERS', 1.20, 2.34, -.566, -.17);
  s.ticket('EVERY STEP SAYS YOU ARE HERE', .17, .022, .9);
  return s.handle;
}

function orthopedicWalkers(kit, spot, floorY) {
  const s = createFloorShowpiece(kit, spot, floorY);
  // A compact depth leaves the existing east entrance's walk-through lane at x -5.25.
  s.still.scale.z = .64;
  s.live.scale.z = .64;
  s.base(.99, .26, 1.03, ink);
  s.solid(box(.76, .039, .89), 0x4c4750, [0, .283, -.516]);
  for (const x of [-.425, .425]) s.solid(box(.11, .08, 1), 0x9e7d53, [x, .287, -.515]);
  const strips = Array.from({ length: 7 }, (_, i) => box(.68, .011, .031).translate(0, 0, -.11 * i));
  const belt = mergeGeometries(strips);
  for (const strip of strips) strip.dispose();
  const tread = s.moving(belt, 0x8a8182, [0, .313, -.11]);
  s.solid(box(.29, .71, .24), 0x6a5d58, [-.12, .677, -.38], [.33, 0, .14]);
  s.solid(box(.26, .71, .22), 0x7c6c63, [.13, .689, -.66], [-.3, 0, -.13]);
  s.solid(box(.22, .14, .32), paper, [-.17, .374, -.26], [.12, 0, .07]);
  s.solid(box(.22, .14, .32), paper, [.17, .383, -.77], [-.13, 0, -.04]);
  s.solid(box(.42, .55, .29), 0x667c79, [0, 1.24, -.53], [.15, 0, 0]);
  s.solid(sphere(.163).scale(1, 1.16, .92), 0xe1b79a, [0, 1.7, -.55]);
  s.solid(new THREE.CylinderGeometry(.161, .168, .052, 12), 0xb95955, [0, 1.765, -.55]);
  const arm = s.group(1.427, -.48);
  arm.position.x = .275;
  s.moving(box(.11, .43, .12), 0xe1b79a, [0, -.19, -.06], [.37, 0, 0], { parent: arm });
  s.solid(box(.112, .42, .121), 0xe1b79a, [-.26, 1.24, -.63], [-.56, 0, .08]);
  s.solid(box(.075, 2.05, .076), ink, [-.45, 1.26, -.92]);
  s.animate((t, pose) => {
    tread.position.z = -.11 - (t * idle.treadmill % 1) * .11;
    arm.rotation.x = Math.sin(t * idle.stride) * .61 * (1 - pose) - .57 * pose;
  });
  s.header('ORTHOPEDIC WALKERS', 1.38, 2.34, -.55, -.49, -Math.PI / 2);
  s.ticket('MALL WALKING CLUB', .17, .024);
  return s.handle;
}

export const upperFloorShowpieces = { glasses, lightUpSneakers, orthopedicWalkers };
