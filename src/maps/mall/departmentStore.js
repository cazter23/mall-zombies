// =============================================================================
// HOFFMAN'S · Est. Forever: the department store north of the hallway's west half (config/departmentStore.js has every
// number). This module builds the room itself: floor, walls, roof, ceiling panels, the stockroom door and vent where
// zombies get in, and their spawn markers. mall.js builds its gate (in the hallway's north wall), the zone, the lamps and
// the map wiring (room culling, zone lighting, horror areas).
//
//   buildDepartmentStore({ kit, props, layout, thickness }) -> { spawns, lamps: [{ x, y, z }] }
//
// Walls: west and north are its own; the south wall is the hallway's north wall; on the east the start room's west wall
// (4m) stands below a strip of the store's own wall up to its 5m roof, and the store's own wall runs north of the start room.
// =============================================================================

import * as THREE from 'three';
import { buildDepartmentFixtures } from './departmentStoreFixtures.js';
import { buildDepartmentStoreDetails } from './departmentStoreDetails.js';

export function buildDepartmentStore({ kit, props, layout, thickness: T }) {
  const { box, mat, tiledFloor, wall } = kit;
  const S = layout;
  const r = S.rect;
  const C = S.colors;
  const startRoomBack = 16.3; // the start room's back wall (outer face): the store's east wall carries on north of it
  const wallMat = mat(C.wall);

  // Floor (it reaches under the hallway's north wall, so the gate has floor beneath it) and roof.
  tiledFloor(r.minX, r.minZ - T, r.maxX, r.maxZ, C.floor);
  box(r.minX - T, S.height, r.minZ, r.maxX + T, S.height + 0.3, r.maxZ + T, mat(C.ceiling), { name: 'deptstore_ceiling' });

  // Walls.
  wall({ along: 'z', from: r.minZ, to: r.maxZ + T, at0: r.minX - T, at1: r.minX, height: S.height }, wallMat, { name: 'deptstore_wall_west' });
  wall({ along: 'x', from: r.minX, to: r.maxX + T, at0: r.maxZ, at1: r.maxZ + T, height: S.height }, wallMat, { name: 'deptstore_wall_north' });
  wall({ along: 'z', from: startRoomBack, to: r.maxZ, at0: r.maxX, at1: r.maxX + T, height: S.height }, wallMat, { name: 'deptstore_wall_east' });
  // Above the start room (its walls are 4m, its ceiling slab 4.0-4.3): the store's wall up to the roof.
  box(r.maxX, 4.3, r.minZ, r.maxX + T, S.height, startRoomBack, wallMat, { name: 'deptstore_wall_east_upper' });

  // Ceiling light panels.
  for (const p of S.panels) props.lightPanel(p.x - 1.2, p.z - 0.6, p.x + 1.2, p.z + 0.6, S.height, { dead: p.dead });

  // Where zombies get in: the stockroom door in the back wall and a boarded vent in the west wall.
  props.wallDoor({
    along: 'x', center: S.stockroomDoorX, wallAt: r.maxZ, facing: -1, width: 1.8, color: C.serviceDoor,
    label: 'STOCKROOM · EMPLOYEES ONLY',
  });
  props.boardedVent({ along: 'z', center: S.westVentZ, wallAt: r.minX, facing: 1 });
  // The fixtures (counters, racks, mannequins, fitting rooms, shoe wall, layaway): maps/mall/departmentStoreFixtures.js
  const fixtures = buildDepartmentFixtures({ kit, layout: S });
  const detailing = buildDepartmentStoreDetails({ kit, layout: S }); // the detail pass: stock, scenes, ceiling, ambience
  const spawns = [
    { name: 'spawn_departmentStore_stockroom', zone: 'departmentStore', position: new THREE.Vector3(S.stockroomDoorX, 0, r.maxZ - 0.8) },
    { name: 'spawn_departmentStore_ventWest', zone: 'departmentStore', position: new THREE.Vector3(r.minX + 0.8, 0, S.westVentZ) },
    // Out of the middle fitting room's curtain
    { name: 'spawn_departmentStore_fittingRoom', zone: 'departmentStore', position: new THREE.Vector3(fixtures.fittingRoomSpawn.x, 0, fixtures.fittingRoomSpawn.z) },
  ];

  const lamps = S.lamps.map((l) => ({ x: l.x, y: S.height * 0.6, z: l.z }));
  return { spawns, lamps, emitters: detailing.emitters };
}
