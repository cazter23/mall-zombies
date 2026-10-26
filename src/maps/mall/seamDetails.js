// =============================================================================
// THE SEAM: where HOFFMAN'S and the cinema meet (data: config/departmentStoreDetails.js `seam`). Decoration only, built with the
// shared look kit; no collision, lights or purchases.
//   the connector     the stair connector's east wall IS the store's west wall: a painted RECEIVING door and dock plate on it
//   the front door    the Promenade side of the cinema's shutter: a row of now-showing one-sheets under Codex's banners, and a trail
//                     of dropped ticket stubs leading to it
//
//   buildSeamDetails({ kit, looks, props, floorY })
// =============================================================================

import { seededRandom } from '../../world/textures.js';
import { departmentStoreDetails } from '../../config/departmentStoreDetails.js';
import { COLORS } from './palette.js';

export function buildSeamDetails({ kit, looks, props, floorY }) {
  const D = departmentStoreDetails.seam;
  const rand = seededRandom(1986);

  // The receiving door: painted on the connector's east wall (the store's west wall), facing into the corridor (-X).
  const R = D.receiving;
  props.wallDoor({ along: 'z', center: R.z, wallAt: R.wallX, facing: -1, width: 1.6, color: 0x8c2f45, label: R.label, labelBackground: '#2b2d42' });
  const dock = (name, z0, z1, y0, y1, color) => kit.box(R.wallX - 0.05, y0, z0, R.wallX - 0.012, y1, z1, kit.mat(color), { collide: false, name: `seam_${name}` });
  dock('dock_bumper', R.z - 0.95, R.z + 0.95, 0.12, 0.3, 0x2b2d42); // a rubber bumper strip across the foot of the door
  dock('dock_plate', R.z - 0.4, R.z + 0.4, 2.62, 2.82, COLORS.shopFrame);
  kit.sign(R.note, { x: R.wallX - 0.055, y: 2.72, z: R.z, width: 0.78, height: 0.17, facing: 'x-', background: '#c9a14a', color: '#2b2d42' });

  // The cinema's front door from the Promenade: one-sheets and a trail of stubs
  const P = D.posters;
  P.zs.forEach((z, i) => looks.poster('notice', { title: P.films[i][0], body: P.films[i][1], header: i === 4 ? '#6b4a8c' : '#c9a14a', typeface: 'cinema' }, P.x + 0.03, floorY + P.y, z, P.w, P.h, 'x+'));
  const S = D.stubs;
  for (let i = 0; i < S.count; i++) {
    const t = i / (S.count - 1);
    const x = S.from[0] + (S.to[0] - S.from[0]) * t + (rand() - 0.5) * 0.35;
    const z = S.from[1] + (S.to[1] - S.from[1]) * t + (rand() - 0.5) * 0.35;
    const stub = kit.box(x - 0.035, floorY + 0.02, z - 0.05, x + 0.035, floorY + 0.023, z + 0.05, kit.mat(i % 3 ? 0xf4e7c0 : 0xe8b4bc), { collide: false, name: 'seam_ticket_stub' });
    stub.rotation.y = rand() * Math.PI;
  }
}
