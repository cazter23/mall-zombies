// =============================================================================
// CORRIDOR LAYOUT (modular corridors as data)
// A corridor is described as a list of straight runs with 90-degree turns; this
// works out the floor rectangles, the side walls (with doorways and shared-wall
// gaps), the end caps and handy anchor points. Pure math, no three.js: the map
// kit (world/mapKit.js -> kit.corridor) turns the result into meshes + colliders,
// and tests/corridor.test.js checks it (floors never overlap, walls never stick into
// the walkway, the corridor is sealed everywhere you didn't ask for an opening).
// A spec that would break that (a corridor crossing itself, or two runs so close that
// one's wall lands in the other's walkway) throws an error instead of building it wrong.
//
// Spec:
//   {
//     width: 4, height: 3.5, thickness: 0.3,           // walkway width, ceiling height, wall thickness
//     start: { x, z },                                  // where the centerline begins
//     segments: [                                       // in walking order
//       { dir: 'west', length: 2 },
//       { dir: 'south', length: 18,                     // each run turns 90 degrees from the last
//         noWall: ['right'],                            // a side another room's wall already covers
//         openings: [{ side: 'left', at: 6, width: 2, top: 2.4 }] },  // doorway (no top = full height)
//     ],
//     startCap: false,                                  // true = wall across the start, false = open,
//     endCap: true,                                     //   or { opening: { width, top } } (doorway in it)
//   }
// Directions: 'north' = +Z, 'south' = -Z, 'east' = +X, 'west' = -X. 'left' / 'right' are as seen
// walking along the corridor (in this game's axes: right = (-dz, dx), the camera's screen right).
// `at` = meters along that run's centerline from where the run starts.
//
// Result:
//   points    centerline corners [{ x, z }] (start, every turn, end)
//   runs      [{ dir, dx, dz, from, to, length, left, right }]  (left/right = unit normals)
//   floors    [{ minX, maxX, minZ, maxZ }]  one per run; each corner square belongs to the run before it;
//             an open start / end reaches `thickness` further, under the doorway it joins
//   walls     [{ along, from, to, at0, at1, height, openings, side, run }]  ready for kit.wall()
//   caps      the same for the end caps that are closed
//   pointAt(run, at, side = 'center', inset = 0) -> { x, z, normal }  a point along a run: on its
//             centerline, or on a side wall's face (moved `inset` into the corridor); normal = into it
//   branchStart(run, at, side) -> { x, z, dir }  where a new corridor would start through a side
//             opening (on the wall's outer face, heading out): build a branch from an opening
// =============================================================================

const DIRECTIONS = {
  north: { dx: 0, dz: 1 },
  south: { dx: 0, dz: -1 },
  east: { dx: 1, dz: 0 },
  west: { dx: -1, dz: 0 },
};

const dirName = (dx, dz) => Object.keys(DIRECTIONS).find((k) => DIRECTIONS[k].dx === dx && DIRECTIONS[k].dz === dz);

export function corridorLayout(spec) {
  const { width: w, height, thickness: T = 0.3, start, segments, startCap = false, endCap = true } = spec;
  const half = w / 2;
  if (!segments.length) throw new Error('corridor needs at least one segment');

  // --- Centerline and runs ---
  const points = [{ x: start.x, z: start.z }];
  const runs = segments.map((seg, i) => {
    const d = DIRECTIONS[seg.dir];
    if (!d) throw new Error(`corridor segment ${i}: unknown dir "${seg.dir}"`);
    if (i > 0) {
      const prev = DIRECTIONS[segments[i - 1].dir];
      if (prev.dx * d.dx + prev.dz * d.dz !== 0) throw new Error(`corridor segment ${i}: must turn 90 degrees from the last one`);
    }
    // A run needs half the width at each end that's a turn (that's where the inside corner is).
    const minLength = (i > 0 ? half : 0) + (i < segments.length - 1 ? half : 0);
    if (seg.length < minLength - 1e-9) throw new Error(`corridor segment ${i}: length ${seg.length} is shorter than ${minLength} (half the width per turn)`);
    const from = points[i];
    const to = { x: from.x + d.dx * seg.length, z: from.z + d.dz * seg.length };
    points.push(to);
    return {
      dir: seg.dir, dx: d.dx, dz: d.dz, from, to, length: seg.length,
      right: { x: -d.dz, z: d.dx }, left: { x: d.dz, z: -d.dx },
    };
  });
  const n = runs.length;

  // --- Floors: each run's rectangle; at a turn, the run before it reaches across the corner square ---
  // An OPEN start/end joins a doorway in some other wall, so the floor reaches back through that
  // wall's thickness (nothing else covers the floor under a doorway; the nav grid needs it).
  const floors = runs.map((r, i) => {
    const s = i > 0 ? half : startCap ? 0 : -T; // trimmed at a turn; reaches back through an open start
    const e = i < n - 1 ? half : endCap ? 0 : T; // reaches across a turn; or out through an open end
    const a = { x: r.from.x + r.dx * s, z: r.from.z + r.dz * s };
    const b = { x: r.to.x + r.dx * e, z: r.to.z + r.dz * e };
    return {
      minX: Math.min(a.x, b.x) - (r.dx === 0 ? half : 0), maxX: Math.max(a.x, b.x) + (r.dx === 0 ? half : 0),
      minZ: Math.min(a.z, b.z) - (r.dz === 0 ? half : 0), maxZ: Math.max(a.z, b.z) + (r.dz === 0 ? half : 0),
    };
  });

  // --- Side walls: offset the centerline by +-half (square corners), one wall per run per side ---
  // At a turn the offset point is the corner + half * (this run's normal + the next run's normal).
  function offsetLine(side) {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = points[i];
      if (i === 0) pts.push({ x: p.x + runs[0][side].x * half, z: p.z + runs[0][side].z * half });
      else if (i === n) pts.push({ x: p.x + runs[n - 1][side].x * half, z: p.z + runs[n - 1][side].z * half });
      else {
        const a = runs[i - 1][side];
        const b = runs[i][side];
        pts.push({ x: p.x + (a.x + b.x) * half, z: p.z + (a.z + b.z) * half });
      }
    }
    return pts;
  }

  const walls = [];
  for (const side of ['left', 'right']) {
    const line = offsetLine(side);
    runs.forEach((r, i) => {
      if (segments[i].noWall?.includes(side)) return;
      const p = line[i];
      const q = line[i + 1];
      const len = Math.abs(q.x - p.x) + Math.abs(q.z - p.z);
      if (len < 1e-6) return; // the inner side of a short run before a turn has no wall
      const out = r[side]; // the wall's thickness goes outward, away from the walkway
      const alongX = r.dz === 0;
      // On the OUTSIDE of a turn, run the wall on past the corner by its thickness so the corner is
      // filled. (Never on the inside: that would stick a post into the next run's walkway. The end
      // caps already reach across the corners at the corridor's ends.)
      const next = runs[i + 1];
      const outsideTurn = next && next.dx * out.x + next.dz * out.z < 0;
      const ext = outsideTurn ? T : 0;
      const qx = alongX ? q.x + r.dx * ext : q.x;
      const qz = alongX ? q.z : q.z + r.dz * ext;
      const openings = (segments[i].openings ?? [])
        .filter((o) => o.side === side)
        .map((o) => {
          const c = alongX ? r.from.x + r.dx * o.at : r.from.z + r.dz * o.at;
          return { from: c - o.width / 2, to: c + o.width / 2, top: o.top };
        });
      const edge = alongX ? p.z : p.x;
      walls.push({
        along: alongX ? 'x' : 'z',
        from: alongX ? Math.min(p.x, qx) : Math.min(p.z, qz),
        to: alongX ? Math.max(p.x, qx) : Math.max(p.z, qz),
        at0: (alongX ? out.z : out.x) > 0 ? edge : edge - T,
        at1: (alongX ? out.z : out.x) > 0 ? edge + T : edge,
        height, openings, side, run: i,
      });
    });
  }

  // --- End caps: a wall across the corridor, just beyond its start / end, spanning the side walls ---
  const caps = [];
  function cap(capSpec, point, r, outward) {
    if (!capSpec) return;
    const across = r.dz === 0 ? 'z' : 'x'; // the cap runs across the corridor
    const center = across === 'z' ? point.z : point.x;
    const edge = across === 'z' ? point.x : point.z;
    const o = across === 'z' ? r.dx * outward : r.dz * outward;
    const opening = capSpec.opening;
    const run = outward > 0 ? n - 1 : 0;
    const missing = segments[run].noWall ?? [];
    const negativeSide = r.left[across] < 0 ? 'left' : 'right';
    const positiveSide = negativeSide === 'left' ? 'right' : 'left';
    caps.push({
      // Extend across our own side walls only. A shared wall on a noWall side
      // already fills that corner; overlapping it creates coplanar, flickering faces.
      along: across,
      from: center - half - (missing.includes(negativeSide) ? 0 : T),
      to: center + half + (missing.includes(positiveSide) ? 0 : T),
      at0: o > 0 ? edge : edge - T, at1: o > 0 ? edge + T : edge, height,
      openings: opening ? [{ from: center - opening.width / 2, to: center + opening.width / 2, top: opening.top }] : [],
      side: outward > 0 ? 'end' : 'start', run,
    });
  }
  cap(startCap, points[0], runs[0], -1);
  cap(endCap, points[n], runs[n - 1], 1);

  // --- Sanity: no part of the corridor may land on another part ---
  const overlap = (a, b) => Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX) > 1e-6
    && Math.min(a.maxZ, b.maxZ) - Math.max(a.minZ, b.minZ) > 1e-6;
  for (let i = 0; i < floors.length; i++) {
    for (let j = i + 1; j < floors.length; j++) {
      if (overlap(floors[i], floors[j])) throw new Error(`corridor crosses itself: runs ${i} and ${j} overlap`);
    }
  }
  for (const w of [...walls, ...caps]) {
    const rect = w.along === 'x'
      ? { minX: w.from, maxX: w.to, minZ: w.at0, maxZ: w.at1 }
      : { minX: w.at0, maxX: w.at1, minZ: w.from, maxZ: w.to };
    floors.forEach((f, i) => {
      if (overlap(rect, f)) throw new Error(`corridor runs too close: a wall of run ${w.run} lands in run ${i}'s walkway`);
    });
  }

  function pointAt(run, at, side = 'center', inset = 0) {
    const r = runs[run];
    const c = { x: r.from.x + r.dx * at, z: r.from.z + r.dz * at };
    if (side === 'center') return { x: c.x, z: c.z, normal: null };
    const nrm = r[side];
    return { x: c.x + nrm.x * (half - inset), z: c.z + nrm.z * (half - inset), normal: { x: -nrm.x, z: -nrm.z } };
  }

  function branchStart(run, at, side) {
    const r = runs[run];
    const nrm = r[side];
    const c = { x: r.from.x + r.dx * at, z: r.from.z + r.dz * at };
    return { x: c.x + nrm.x * (half + T), z: c.z + nrm.z * (half + T), dir: dirName(nrm.x, nrm.z) };
  }

  return { width: w, height, thickness: T, points, runs, floors, walls, caps, pointAt, branchStart };
}
