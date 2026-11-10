// Ground-floor showpieces. Local +Z faces the buyer, with the solid base behind the prompt.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { showpieces } from '../../../config/wardrobe.js';
import { createFloorShowpiece } from './showpiece.js';

const ink = 0x302536;
const cream = 0xffedca;
const brass = 0xd5a252;
const velvet = 0x84182c;
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const drum = (r, h, sides = 12) => new THREE.CylinderGeometry(r, r, h, sides);
const ball = (r) => new THREE.SphereGeometry(r, 12, 8);
const at = (geometry, x, y, z) => geometry.translate(x, y, z);

// Bake parts that share a material into one draw, particularly on the moving displays.
function joined(...parts) {
  const geometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return geometry;
}

function begin(kit, spot, floorY) {
  const s = createFloorShowpiece(kit, spot, floorY);
  return {
    ...s,
    rope(width, z) {
      for (const x of [-width / 2, width / 2]) {
        s.solid(drum(0.092, 0.035), ink, [x, 0.018, z]);
        s.solid(drum(0.023, 0.57), brass, [x, 0.3, z]);
        s.solid(ball(0.044), brass, [x, 0.61, z]);
      }
      const rope = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(-width / 2, 0.57, z),
        new THREE.Vector3(0, 0.34, z + 0.055),
        new THREE.Vector3(width / 2, 0.57, z),
      );
      s.solid(new THREE.TubeGeometry(rope, 10, 0.023, 6, false), velvet, [0, 0, 0], undefined, s.still);
    },
  };
}

function goldCard(kit, spot, floorY) {
  const s = begin(kit, spot, floorY);
  s.base(0.84, 0.86, 0.6, 0x513124, -0.43);
  s.solid(box(1.12, 0.024, 0.77), velvet, [0, 0.021, -0.385]);
  s.solid(box(0.91, 0.068, 0.66), brass, [0, 0.88, -0.43]);
  s.solid(box(0.13, 1.2, 0.12), ink, [0, 1.49, -0.62]);
  s.solid(box(0.98, 0.64, 0.1), brass, [0, 1.62, -0.405]);
  s.solid(box(0.86, 0.51, 0.08), 0xc88816, [0, 1.62, -0.35]);
  s.sign('GALLERIA GOLD', 0.77, 0.38, [0, 1.62, -0.29], { background: '#ac7410', textColor: '#fff7c4' });
  const glint = s.glow(box(0.045, 0.31, 0.015), 0xffe9a8, [0, 1.62, -0.266], [0, 0, -0.34]);
  s.animate((t, pose) => { glint.position.x = 0.27 * Math.sin(t * showpieces.groundFloorIdle.glint) * (1 - pose); });
  s.header('MEMBERS ONLY', 1.1, 2.19, -0.53);
  s.ticket('GALLERIA GOLD CARD', 0.73, -0.103);
  s.rope(0.92, -0.033);
  return s.handle;
}

function sandwichBoard(kit, spot, floorY) {
  const s = begin(kit, spot, floorY);
  s.base(0.86, 0.33, 0.72, 0x443649);
  s.solid(joined(
    at(box(0.18, 0.57, 0.19), -0.14, 0.62, 0),
    at(box(0.18, 0.57, 0.19), 0.14, 0.62, 0),
    at(box(0.43, 0.51, 0.28), 0, 1.13, 0),
    at(box(0.15, 0.5, 0.15).rotateZ(0.95), 0.36, 1.39, 0),
    at(box(0.14, 0.45, 0.15).rotateZ(-0.13), -0.27, 1.05, 0),
  ), ink, [0, 0, -0.36]);
  s.solid(ball(0.17).scale(0.87, 1.13, 0.87), cream, [0, 1.57, -0.36]);
  s.solid(new THREE.CylinderGeometry(0.15, 0.062, 0.3, 12, 1, true).rotateX(Math.PI / 2), s.color, [0.52, 1.64, -0.27], undefined, s.still, { side: THREE.DoubleSide });
  s.solid(box(0.66, 0.59, 0.06), 0x9f622d, [0, 1.16, -0.18], [-0.09, 0, 0]);
  s.solid(box(0.62, 0.55, 0.055), 0xbf894a, [0, 1.15, -0.55], [0.13, 0, 0]);
  s.sign('FINAL SALE', 0.54, 0.21, [0, 1.21, -0.12], { background: '#e5bc80', textColor: '#4c2333' });
  s.solid(box(0.055, 2.15, 0.06), ink, [-0.39, 1.11, -0.66]);
  s.header('EVERYTHING MUST GO', 1.36, 2.24, -0.51);
  for (let i = 0; i < 4; i++) {
    s.glow(ball(0.046), i % 2 ? 0xffad4c : s.color, [-0.45 + i * 0.3, 2.045, -0.465], undefined, {
      pulse: (t) => 0.25 + 0.75 * Math.max(0, Math.cos(t * showpieces.groundFloorIdle.chase - i * Math.PI / 2)),
    });
  }
  s.ticket('SANDWICH BOARD', 0.21, 0.025);
  return s.handle;
}

function packBody() {
  return ball(1).scale(0.22, 0.13, 0.14);
}

function packBelt() {
  return new THREE.TorusGeometry(0.24, 0.022, 6, 14).rotateX(Math.PI / 2).scale(1, 1, 0.64);
}

function fannyPack(kit, spot, floorY) {
  const s = begin(kit, spot, floorY);
  s.base(1.03, 0.74, 0.7, 0x265b59);
  s.solid(box(1.02, 0.115, 0.67), ink, [0, 0.744, -0.35]);
  s.solid(joined(...[-0.36, -0.18, 0, 0.18, 0.36].map((x) => at(box(0.026, 0.44, 0.032), x, 0.39, 0.018))), 0x519c8e, [0, 0, 0]);
  const packs = [
    [-0.24, 0.85, -0.2, 0.21, 0xff658d], [0.22, 0.84, -0.19, -0.36, 0xf8ad44],
    [-0.25, 0.83, -0.49, -0.48, 0x7b59c4], [0.2, 0.9, -0.49, 0.38, 0x2684b6],
    [0.02, 0.97, -0.32, -0.19, 0xcf3764],
  ];
  for (const [x, y, z, yaw, color] of packs) {
    s.solid(packBelt(), ink, [x, y - 0.026, z], [0, yaw, 0]);
    s.solid(packBody(), color, [x, y, z], [0, yaw, 0]);
  }
  const top = s.group(1.22, -0.3);
  s.moving(packBody().scale(1.18, 1.18, 1.18), s.color, [0, 0, 0], undefined, { parent: top });
  s.moving(joined(packBelt(), at(box(0.19, 0.025, 0.022), 0, 0.032, 0.16)), ink, [0, 0, 0], undefined, { parent: top });
  s.animate((t, pose) => {
    top.position.y = 1.22 + 0.19 * Math.abs(Math.sin(t * showpieces.groundFloorIdle.bounce)) + 0.19 * pose;
    top.rotation.z = 0.14 * Math.sin(t * showpieces.groundFloorIdle.bounce);
  });
  s.solid(box(0.085, 1.6, 0.085), ink, [0.35, 1.31, -0.64]);
  s.header('AS SEEN ON TV', 1.14, 2.24, -0.59);
  s.ticket('FANNY PACKS', 0.6, 0.032);
  return s.handle;
}

function hiVisVest(kit, spot, floorY) {
  const s = begin(kit, spot, floorY);
  s.base(0.69, 2.11, 0.4, 0x4a6773);
  // The recessed-looking panel and angled door use the existing locker palette.
  s.solid(box(0.55, 1.66, 0.026), 0x233039, [0, 1.03, 0.018]);
  s.solid(box(0.27, 1.75, 0.044), 0x67858e, [-0.266, 1.06, 0.038], [0, 0.43, 0]);
  s.solid(box(0.08, 0.038, 0.067), brass, [0.08, 1.66, 0.067]);
  s.solid(joined(
    at(box(0.15, 0.55, 0.085).rotateZ(-0.09), -0.04, 1.28, 0.095),
    at(box(0.15, 0.55, 0.079).rotateZ(0.09), 0.14, 1.28, 0.095),
    at(box(0.32, 0.28, 0.088), 0.05, 1.12, 0.092),
  ), s.color, [0, 0, 0]);
  s.solid(joined(
    at(box(0.32, 0.053, 0.018), 0.05, 1.2, 0.145),
    at(box(0.32, 0.053, 0.018), 0.05, 1.04, 0.145),
  ), cream, [0, 0, 0]);
  s.solid(drum(0.13, 0.07), ink, [0, 2.15, -0.2]);
  const beacon = s.group(2.25, -0.2);
  s.glow(box(0.23, 0.13, 0.1), 0xffa32f, [0, 0, 0], undefined, { parent: beacon });
  s.animate((t, pose) => { beacon.rotation.y = t * showpieces.groundFloorIdle.beacon + pose * Math.PI; });
  // Blade sign faces the corridor entrance, where the locker's face is almost edge-on.
  s.header('HI-VIS VEST', 0.78, 2.0, -0.015, -0.35, -Math.PI / 2);
  s.ticket('HI-VIS VEST', 0.68, 0.05, 0.64);
  return s.handle;
}

function cardigan(kit, spot, floorY) {
  const s = begin(kit, spot, floorY);
  const z = -0.46;
  s.base(1.1, 0.26, 0.79, velvet, z);
  s.solid(drum(0.43, 0.05), brass, [0, 0.285, z]);
  s.rope(1.18, -0.04);
  const turntable = s.group(0.31, z);
  s.moving(joined(
    drum(0.39, 0.05),
    at(box(0.13, 0.61, 0.15), -0.115, 0.31, 0),
    at(box(0.13, 0.61, 0.15), 0.115, 0.31, 0),
  ), ink, [0, 0, 0], undefined, { parent: turntable });
  s.moving(joined(
    at(box(0.46, 0.55, 0.29), 0, 0.86, 0),
    at(box(0.12, 0.53, 0.14).rotateZ(-0.17), -0.27, 0.84, 0),
    at(box(0.12, 0.53, 0.14).rotateZ(0.17), 0.27, 0.84, 0),
  ), s.color, [0, 0, 0], undefined, { parent: turntable });
  s.moving(joined(
    at(ball(0.14).scale(0.9, 1.17, 0.88), 0, 1.31, 0),
    at(box(0.034, 0.52, 0.023), 0, 0.86, 0.154),
    at(box(0.031, 0.43, 0.026), -0.14, 0.84, 0.155),
    at(box(0.031, 0.43, 0.026), 0.14, 0.84, 0.155),
  ), cream, [0, 0, 0], undefined, { parent: turntable });
  s.animate((t, pose) => { turntable.rotation.y = t * showpieces.groundFloorIdle.turn * (1 - pose); });
  s.solid(box(0.067, 2.17, 0.07), ink, [0.43, 1.1, -0.78]);
  s.solid(box(0.91, 0.07, 0.47), ink, [0, 2.17, -0.65]);
  s.glow(drum(0.19, 0.025), 0xffd5a1, [0, 2.121, -0.49], undefined, { intensity: 0.7 });
  s.header('HEIRLOOM COLLECTION', 1.26, 2.37, -0.49);
  s.ticket('HOFFMAN’S CARDIGAN', 0.165, -0.036);
  return s.handle;
}

function aviators(kit, spot, floorY) {
  const s = begin(kit, spot, floorY);
  s.base(0.34, 2.11, 0.28, 0x374858, -0.35);
  s.solid(drum(0.31, 0.09), ink, [0, 0.052, -0.35]);
  s.solid(box(0.26, 1.67, 0.04), 0x6c899e, [0, 0.93, -0.193]);
  s.header('MIRRORED AVIATORS', 1.1, 2.25, -0.35);
  const glasses = s.group(1.77, -0.35);
  // Chunky teardrops with a double bridge and a bright reflected stripe baked into each lens.
  const lens = (x, y, scale, tilt) => at(ball(1).scale(0.27 * scale, 0.2 * scale, 0.051).rotateZ(tilt), x, y, 0);
  s.moving(joined(
    lens(-0.28, 0, 1, 0.27), lens(0.28, 0, 1, -0.27),
    at(box(0.31, 0.026, 0.055), 0, 0.105, 0),
    at(box(0.18, 0.028, 0.055), 0, 0.038, 0),
  ), ink, [0, 0, 0], undefined, { parent: glasses });
  s.moving(joined(lens(-0.28, 0.006, 0.86, 0.27), lens(0.28, 0.006, 0.86, -0.27)), s.color, [0, 0, 0.022], undefined, { parent: glasses, metalness: 0.48, roughness: 0.24 });
  s.moving(joined(
    at(box(0.3, 0.026, 0.012).rotateZ(0.32), -0.28, 0.022, 0.072),
    at(box(0.3, 0.026, 0.012).rotateZ(0.32), 0.28, 0.022, 0.072),
  ), 0xe4f4ff, [0, 0, 0], undefined, { parent: glasses });
  const spots = s.group(0.033, -0.2);
  const ellipse = (x, z) => at(new THREE.CircleGeometry(0.23, 12).scale(1, 0.62, 1).rotateX(-Math.PI / 2), x, 0, z);
  s.glow(joined(ellipse(-0.48, 0.29), ellipse(0.48, -0.29)), s.color, [0, 0, 0], undefined, { parent: spots, intensity: 0.58 });
  s.animate((t, pose) => {
    glasses.rotation.y = t * showpieces.groundFloorIdle.spin * (1 - pose);
    spots.rotation.y = glasses.rotation.y;
  });
  s.ticket('SHADE SHACK', 0.99, -0.148);
  return s.handle;
}

export const groundFloorShowpieces = { goldCard, sandwichBoard, fannyPack, hiVisVest, cardigan, aviators };
