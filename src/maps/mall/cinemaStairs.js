// A genuine second route between floors. Static construction, one standard
// purchase, and metadata for the existing navigation/culling/lighting systems.
import * as THREE from 'three';

export function buildCinemaStairs({ kit, layout: c, cinema, floorY: Y, zones, price }) {
  const S = c.shaft, H = c.returnHall, K = c.connector, T = c.wallThickness, C = c.colors;
  const roof = Y + cinema.height, upper = c.upperLandingEnd, lower = c.lowerLandingStart;
  const box = (name, x0, y0, z0, x1, y1, z1, color, collide = true, options = {}) =>
    kit.box(x0, y0, z0, x1, y1, z1, kit.mat(color, options), { name: `cinema_stairs_${name}`, collide });
  const sign = (text, x, y, z, width, facing) => kit.sign(text, { x, y, z, width, height: .36,
    facing, background: '#38434a', color: '#d7e9d4', font: 'wayfinding' });
  // All horizontal slabs meet edge to edge, including the original cinema floor
  // through the upper doorway and the original Service Corridor below.
  box('upper_landing', S.minX, 0, S.minZ, S.maxX, Y, upper, C.base);
  box('lower_landing', S.minX, -.3, lower, S.maxX, 0, S.maxZ, C.step);
  for (const [id, r] of [['return', H], ['connector', K]]) {
    box(`${id}_floor`, r.minX, -.3, r.minZ, r.maxX, 0, r.maxZ, C.step);
    box(`${id}_roof`, r.minX, c.corridorHeight, r.minZ, r.maxX, c.corridorHeight + T, r.maxZ, C.base);
  }
  box('west_wall', S.minX - T, 0, S.minZ - T, S.minX, roof, S.maxZ + T, C.wall);
  box('south_wall', S.minX, 0, S.minZ - T, S.maxX, roof, S.minZ, C.wall);
  box('north_wall', S.minX, 0, S.maxZ, S.maxX, roof, S.maxZ + T, C.wall);
  box('roof', S.minX - T, roof, S.minZ - T, S.maxX, roof + T, S.maxZ + T, C.base);
  // The cinema owns the east wall above its floor, including the open exit.
  // Below it, only the bottom landing opens east into the return passage.
  box('east_under_cinema', S.maxX, 0, S.minZ, S.maxX + T, Y - cinema.slabThickness, lower, C.wall);
  box('landing_header', S.maxX, c.serviceDoor.top, lower, S.maxX + T, c.corridorHeight, S.maxZ, C.wall);
  box('landing_upper_wall', S.maxX, c.corridorHeight + T, lower, S.maxX + T, Y - cinema.slabThickness, S.maxZ, C.wall);
  // (It ends at the connector's outer face, x -20.3, where HOFFMAN'S west wall begins: running on to -20.0 put this wall's end
  // face exactly on the store's inner wall face, a grey strip fighting the cream one.)
  box('return_north_wall', H.minX, 0, H.maxZ, K.maxX, c.corridorHeight, H.maxZ + T, C.wall);
  box('return_south_wall', H.minX, 0, H.minZ - T, K.minX - T, c.corridorHeight, H.minZ, C.wall);
  box('connector_west_wall', K.minX - T, 0, K.minZ + T, K.minX, c.corridorHeight, H.minZ, C.wall);
  // The hallway owns the lower stretch of this shared wall, including its
  // north-wall corner. Only extend it where there is no existing wall.
  // (HOFFMAN'S department store's west wall (x -20.3..-20, z 6.3..26.3, 5 m) is this stretch of wall now: a second box here
  // doubled it and flickered against it, so the connector's east side is the store's wall. See departmentStore.js.)

  const run = lower - upper, plateau = c.landingRun, slope = run - 2 * plateau;
  const points = [[0, 0], [plateau, 0], [plateau + slope, Y], [run, Y]];
  const ramp = kit.ramp({ id: 'cinemaStairs', axis: 'z', origin: lower, dir: -1,
    minX: S.minX, maxX: S.maxX, minZ: upper, maxZ: lower, points });
  // The visible treads follow the ramp. Solid support stays below the cylinder's
  // leading edge, so neither a player nor a wide cart collides with the risers.
  for (let i = 0; i < c.treadCount; i++) {
    const a = plateau + i * slope / c.treadCount, b = plateau + (i + 1) * slope / c.treadCount;
    const top = (i + 1) * Y / c.treadCount;
    box('tread', S.minX, Math.max(0, top - .2), lower - b, S.maxX, top, lower - a, C.step, false);
    box('nosing', S.minX, top + .008, lower - a - .035, S.maxX, top + .025, lower - a, C.edge, false);
    const support = i * Y / c.treadCount - c.supportClearance;
    if (support > 0) kit.addCollider(S.minX, 0, lower - b, S.maxX, support, lower - a);
  }
  box('upper_plate', S.minX, Y - .18, upper, S.maxX, Y, upper + plateau, C.step, false);
  kit.addCollider(S.minX, 0, upper, S.maxX, Y - c.supportClearance, upper + plateau);
  box('lower_plate', S.minX, -.15, lower - plateau, S.maxX, 0, lower, C.step);
  for (const rx of [S.minX + .07, S.maxX - .07]) {
    const a = new THREE.Vector3(rx, 1, lower - plateau), b = new THREE.Vector3(rx, Y + 1, upper + plateau);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, a.distanceTo(b), 6), kit.mat(C.edge, { metalness: .6, roughness: .45 }));
    rail.name = 'cinema_stairs_handrail'; rail.position.copy(a).add(b).multiplyScalar(.5);
    rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); kit.group.add(rail);
  }
  const x = (S.minX + S.maxX) / 2;
  const link = { id: 'cinemaStairs', lower: { x, z: lower, floor: 0 }, upper: { x, z: upper, floor: 1 },
    halfWidth: (S.maxX - S.minX) / 2, profile: points }; // (the whole width: hugging a side wall you are still on the stairs for the horde)
  const e = c.serviceDoor;
  const door = kit.shutterDoor({ id: 'cinemaStairs', label: 'Cinema Service Stairs', price,
    opensZones: ['cinema', 'serviceCorridor'], zones,
    doorway: { minX: e.from, maxX: e.to, minZ: e.at, maxZ: e.at + T, height: e.top } });

  // Wall-mounted lights and markings leave the entire flight and both turns clear.
  const light = { emissive: C.exit, emissiveIntensity: .7 };
  for (const z of [-7, -1, 5, 9]) {
    const h = z < upper ? Y + 1.1 : Math.max(0, Math.min(Y, (lower - z - plateau) / slope * Y)) + 1.1;
    box('wall_light', S.minX + .025, h, z - .35, S.minX + .06, h + .10, z + .35, C.exit, false, light);
  }
  for (const px of [-39, -33, -27]) {
    box('return_light', px - .8, c.corridorHeight - .10, 8.5, px + .8, c.corridorHeight - .06, 8.7, C.exit, false, light);
  }
  box('connector_light', -22.5, c.corridorHeight - .10, 5.7, -21.1, c.corridorHeight - .06, 5.9, C.exit, false, light);
  sign('← Service Corridor', -27, 2.45, H.maxZ - .035, 3.1, -1);
  sign('← Cinema', -38, 2.45, H.minZ + .035, 2.7, 1);
  sign('Cinema →', -21.8, 2.45, K.maxZ - .035, 2.5, -1);
  sign('Sunset Cinema ↑', -21.8, 3.05, e.at - .07, 2.9, -1);
  sign('Service Corridor ↓', -21.8, 3.05, e.at + .37, 2.9, 1);
  sign('Exit / Service Corridor ↓', S.minX + .06, Y + 2.3, -7.2, 3.0, 'x+');
  sign('Service Corridor', S.maxX - .04, 3.1, 8.6, 2.6, 'x-');
  sign('Cinema ↑', S.maxX + T + .03, 3.1, 8.6, 2.3, 'x+');
  sign('Cinema ←', S.minX + .04, 1.9, 8.6, 2.5, 'x+');
  const rooms = [
    { id: 'cinemaStairwell', ...S, minY: 0, maxY: roof + T },
    { id: 'cinemaReturn', minX: H.minX, maxX: K.maxX, minZ: K.minZ, maxZ: H.maxZ, minY: 0, maxY: c.corridorHeight + T },
  ];
  const portals = [
    { a: 'cinemaLobby', b: 'cinemaStairwell', minX: S.maxX, maxX: S.maxX + T, minZ: cinema.stairsEntry.from,
      maxZ: cinema.stairsEntry.to, minY: Y, maxY: Y + cinema.stairsEntry.top },
    { a: 'cinemaStairwell', b: 'cinemaReturn', minX: S.maxX, maxX: S.maxX + T, minZ: lower, maxZ: S.maxZ, minY: 0, maxY: e.top },
    { a: 'cinemaReturn', b: 'serviceCorridor', door: 'cinemaStairs', minX: e.from, maxX: e.to, minZ: e.at, maxZ: e.at + T, minY: 0, maxY: e.top },
  ];
  return { door, ramp, link, rooms, portals, grades: rooms.map(r => ({ ...r, grade: 'cinemaService' })) };
}

export function dressCinemaStairs({ kit, looks, layout: c, floorY: Y }) {
  for (const l of c.lightPools) looks.pool(l.x, l.y, l.z, l.width, l.height, l.facing, l.color, l.opacity);
  if (!kit) return;

  // The flight's west wall (x = shaft.minX, facing +X). Tread height along the flight, z -> y: flat on each landing,
  // straight between (the same profile as the ramp in buildCinemaStairs).
  const S = c.shaft, D = c.dressing, wallX = S.minX;
  const upper = c.upperLandingEnd, lower = c.lowerLandingStart, plateau = c.landingRun;
  const low = lower - plateau, high = upper + plateau; // where the slope starts (floor) and ends (Y)
  const floorAt = (z) => Y * Math.min(1, Math.max(0, (low - z) / (low - high)));

  // Wayfinding stripes: one ribbon each, following the treads from the bottom landing to the top one. A shape in the
  // wall's plane (shape x = -z, shape y = height), extruded 15 mm from 4 cm out: clear of the wall and of the painted
  // light pool on it (3 cm out), so no two faces share a plane.
  const along = [[lower, 0], [low, 0], [high, Y], [upper, Y]];
  for (const s of D.stripes) {
    const shape = new THREE.Shape();
    along.forEach(([z, y], i) => (i === 0 ? shape.moveTo(-z, y + s.low) : shape.lineTo(-z, y + s.low)));
    for (const [z, y] of [...along].reverse()) shape.lineTo(-z, y + s.high);
    const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: .015, bevelEnabled: false }), kit.mat(s.color, { roughness: .5 }));
    mesh.rotation.y = Math.PI / 2; // shape x -> world -z, extrusion -> world +x
    mesh.position.x = wallX + .04;
    mesh.name = 'cinema_stairs_stripe';
    kit.group.add(mesh);
  }

  // A level mark on each landing's end wall.
  const midX = (S.minX + S.maxX) / 2;
  for (const l of D.levels) {
    const top = l.wall === 'south';
    kit.sign(l.text, { x: midX, y: (top ? Y : 0) + l.height, z: top ? S.minZ + .03 : S.maxZ - .03, facing: top ? 1 : -1,
      width: l.width, height: .5, background: '#2b2233', color: '#ffd6ec' });
  }

  // Notices, high enough to clear the stripes under their lower (uphill) corner, 2 cm in front of the light pool.
  for (const p of D.posters) {
    const y = floorAt(p.z - p.width / 2) + D.posterClearance + p.height / 2;
    looks.poster(p.kind, p.options, wallX + .05, y, p.z, p.width, p.height, 'x+');
  }
}
