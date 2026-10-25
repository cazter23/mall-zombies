// Physical cinema wing and its map metadata. Construction stays here so the
// shared mall module only registers its door, zone and returned systems/data.
import * as THREE from 'three';

export function buildCinema({ kit, layout: c, floorY: Y, promenade, zones, price }) {
  const { box, mat, wall } = kit, T = c.wallThickness;
  const L = c.lobby, A = c.auditorium, P = c.passage, C = c.colors;
  const entry = promenade.expansionConnections.find(e => e.id === 'westWing');
  const y = h => Y + h;
  for (const [id, r] of [['lobby', L], ['screen', A], ['passage', P]]) {
    box(r.minX - T, Y - c.slabThickness, r.minZ - T, r.maxX, Y, r.maxZ,
      mat(C.carpet, { roughness: .98 }), { name: `cinema_floor_${id}` });
    box(r.minX - T, y(c.height), r.minZ - T, r.maxX, y(c.height) + T, r.maxZ,
      mat(C.ceiling), { name: `cinema_roof_${id}` });
  }
  const wallX = (name, from, to, at, color, openings = []) => wall({ along: 'x', from, to,
    at0: at, at1: at + T, bottom: Y, height: c.height, openings }, mat(color), { name });
  const wallZ = (name, from, to, at, color, openings = []) => wall({ along: 'z', from, to,
    at0: at, at1: at + T, bottom: Y, height: c.height, openings }, mat(color), { name });
  wallX('cinema_south', L.minX - T, L.maxX, L.minZ - T, C.lobbyWall,
    c.futureScreens.map(s => ({ ...s, top: 2.8 })));
  for (const s of c.futureScreens) box(s.from, Y, L.minZ - T, s.to, y(2.8), L.minZ, mat(C.trim), { name: 'cinema_future_screen' });
  wallZ('cinema_west', L.minZ, L.maxZ, L.minX - T, C.lobbyWall, [c.stairsEntry]);
  // The Promenade already owns the shared wall and its opening. Build only
  // the lobby's extension below it, plus the taller wall above the old roof.
  wallZ('cinema_east_extension', L.minZ, promenade.rect.minZ - T, L.maxX, C.lobbyWall);
  box(L.maxX, Y + promenade.height + T, promenade.rect.minZ - T, L.maxX + T, y(c.height), promenade.rect.minZ,
    mat(C.lobbyWall), { name: 'cinema_east_corner_header' });
  box(L.maxX, Y + promenade.height + T, promenade.rect.minZ, L.maxX + T, y(c.height), L.maxZ, mat(C.lobbyWall), { name: 'cinema_east_header' });
  wallX('cinema_lobby_north', L.minX - T, L.maxX, L.maxZ, C.lobbyWall, [c.auditoriumEntry, c.passageEntry]);
  wallZ('cinema_screen_west', A.minZ, A.maxZ + T, A.minX - T, C.theaterWall);
  wallX('cinema_screen_north', A.minX, P.maxX + T, A.maxZ, C.theaterWall);
  wallZ('cinema_screen_partition', A.minZ, A.maxZ, A.maxX, C.theaterWall, [c.auditoriumExit]);
  wallZ('cinema_passage_east', promenade.rect.maxZ + T, P.maxZ, P.maxX, C.serviceWall);
  box(P.maxX, Y + promenade.height + T, P.minZ, P.maxX + T, y(c.height), promenade.rect.maxZ + T, mat(C.serviceWall), { name: 'cinema_passage_header' });

  for (const [name, r] of [['island', c.island], ['concessions', c.concessions], ['ticket_booth', c.ticketBooth]]) {
    const island = name === 'island';
    if (!island) kit.addCollider(r.minX, Y, r.minZ, r.maxX, y(r.height), r.maxZ);
    box(r.minX, Y, r.minZ, r.maxX, y(island ? r.height : 1.05), r.maxZ, mat(island ? C.aisle : C.trim),
      { name: `cinema_${name}`, collide: island, vaultable: island });
  }
  // Four seating groups: wide side aisles, a central aisle and a broad crossing.
  // Row collision follows the seats, leaving the visible inter-row gaps usable.
  // Every back is low enough for zombies to reach a perched player.
  for (const [x0, x1] of c.seats.columns) for (const [z0, z1] of c.seats.rows) {
    const count = c.seats.perRow, spacing = (x1 - x0) / count;
    for (let row = 0; row < c.seats.rowsPerBlock; row++) {
      const z = z0 + .38 + row * (z1 - z0 - .7) / (c.seats.rowsPerBlock - 1);
      kit.addCollider(x0, Y, z - .29, x1, y(c.seats.colliderHeight), z + .32);
      for (let i = 0; i < count; i++) {
        const x = x0 + spacing * (i + .5);
        box(x - spacing * .42, y(.12), z - .19, x + spacing * .42, y(c.seats.seatHeight), z + .32, mat(C.seatEdge), { collide: false, name: 'cinema_seat_base' });
        box(x - spacing * .39, y(c.seats.seatHeight), z - .20, x + spacing * .39, y(c.seats.seatHeight + .08), z + .32, mat(C.seat), { collide: false, name: 'cinema_seat' });
        box(x - spacing * .42, y(.40), z - .29, x + spacing * .42, y(c.seats.colliderHeight), z - .19, mat(C.seat), { collide: false, name: 'cinema_seat_back' });
        for (const side of [-1, 1]) box(x + side * spacing * .45 - .025, y(.45), z - .13,
          x + side * spacing * .45 + .025, y(.62), z + .3, mat(C.seatEdge), { collide: false, name: 'cinema_armrest' });
      }
    }
  }
  const door = kit.shutterDoor({ id: 'cinema', label: 'Sunset Cinema', price, opensZones: ['cinema', 'upstairs'], zones,
    doorway: { minX: L.maxX, maxX: promenade.rect.minX, minZ: entry.from, maxZ: entry.to, minY: Y, height: entry.top } });
  const spawns = c.spawns.map(s => ({ name: `spawn_cinema_${s.id}`, zone: 'cinema', position: new THREE.Vector3(s.x, Y, s.z) }));
  const rooms = [['cinemaLobby', L], ['cinemaScreen', A], ['cinemaPassage', P]].map(([id, r]) => ({ id, ...r, minY: Y, maxY: y(c.height) + T }));
  const portal = (a, b, opening, at, along = 'x', door) => ({ a, b, door,
    ...(along === 'x' ? { minX: opening.from, maxX: opening.to, minZ: at, maxZ: at + T }
      : { minX: at, maxX: at + T, minZ: opening.from, maxZ: opening.to }), minY: Y, maxY: y(opening.top) });
  return { door, spawns, rooms,
    portals: [portal('cinemaLobby', 'level2', entry, L.maxX, 'z', 'cinema'),
      portal('cinemaLobby', 'cinemaScreen', c.auditoriumEntry, L.maxZ),
      portal('cinemaLobby', 'cinemaPassage', c.passageEntry, L.maxZ),
      portal('cinemaScreen', 'cinemaPassage', c.auditoriumExit, A.maxX, 'z')],
    grades: rooms.map(r => ({ ...r, grade: r.id === 'cinemaScreen' ? 'cinemaScreen' : 'cinemaLobby' })),
    emitters: c.ambience.map(e => ({ id: e.id, kind: e.kind, zone: 'cinema', position: [e.x, y(e.h), e.z], range: e.range })),
    lamps: c.lighting.map(l => ({ ...l, y: y(l.h) })),
  };
}
