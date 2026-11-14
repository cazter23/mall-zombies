// =============================================================================
// ZOMBIE NAVIGATION (flow field)
// The ground floor is split into a grid of small cells, each walkable or not
// (built from the same collision boxes the player uses). A few times a second
// we compute, for every walkable cell, the walking distance to the player
// (Dijkstra outward from the player's cell). A zombie then just heads for the
// neighboring cell that is closer to the player: like water flowing downhill.
// One calculation serves every zombie, so crowds are cheap.
//
// If a zombie can see the player in a straight line (on the grid), it walks
// straight at them instead.
//
// FLOORS: a map can have several floors at different heights (opts.floors = their walking heights, e.g. [0, 6.3]).
// Each floor is its own layer of the grid (walkable where a box top sits at that height, blocked by anything solid
// between ankle and head above it). Floors are joined by LINKS (opts.links): a ramp or stairs between a lower and
// an upper floor. In the flow field a link is one extra edge between its two end cells, so the distance to the
// player simply continues across it. A zombie standing ON a link's ramp walks to whichever end is closer to the
// player; one at an end walks into the ramp when the route goes that way. With no `floors` / `links` it is the
// single ground floor it always was.
//
//   link: { id, lower: { x, z, floor }, upper: { x, z, floor }, halfWidth, profile? }
//     lower / upper = where the ramp starts and ends on the map (floor = index into `floors`; the cell there must be
//     open floor right at the ramp's foot / top); halfWidth = how wide the ramp is either side of that line;
//     profile = optional [[s, y], ...]: the surface height at distance s along it (default: a straight line).
// =============================================================================

import { zombieNav } from '../config/zombies.js';
import { colliderSignature } from '../world/collision.js';

const SQRT2 = Math.SQRT2;
// 8 neighbours, as three flat lists read by index (neighbour n = column step, row step, cost). Flat on purpose: the flow
// field visits every walkable cell's neighbours five times a second, and a list of [dx, dz, cost] triples read with
// `for (const [dc, dr, cost] of ...)` made a throwaway object per neighbour (about 200 MB of garbage a second in a full mall).
// The ORDER matters: the first of two equally good neighbours wins, so changing it changes routes.
const NEIGHBOR_COUNT = 8;
const NEIGHBOR_DC = [1, -1, 0, 0, 1, 1, -1, -1];
const NEIGHBOR_DR = [0, 0, 1, -1, 1, -1, 1, -1];
const NEIGHBOR_COST = [1, 1, 1, 1, SQRT2, SQRT2, SQRT2, SQRT2];
// How much of a zombie's lane offset to try, in turn (directionTo).
const LANE_FRACTIONS = [1, 0.5];

/**
 * @param colliders  the shared world collider list (Box3s); rebuilt automatically when it changes
 *                   (any add/remove marked with world/collision.js markCollidersChanged). The grid
 *                   covers every collider's footprint, so a bigger map needs no settings here.
 * @param agent      { radius, height } of the zombies using this grid
 */
export function createNavigation(colliders, agent, { floors = [0], links = [] } = {}) {
  const cs = zombieNav.cellSize;
  const layers = floors.length;
  let cells = 0; // cells per layer (cols * rows)
  const rampTolerance = zombieNav.rampTolerance ?? 0.6; // a mover within this height of a ramp's surface is "on" it
  let minX = 0;
  let minZ = 0;
  let cols = 0;
  let rows = 0;
  let walkable = new Uint8Array(0); // all layers, layer-major: index = layer * cells + row * cols + col
  let nearWall = new Uint8Array(0); // 1 = walkable cell touching a blocked one (costs extra to walk)
  let dist = new Float32Array(0);
  let spreadFrom = new Float32Array(0); // computeField's own notes: the distance each cell last spread to its neighbours at
  let linkEdges = new Map(); // global cell index -> [{ to, cost (cells), link }]
  let hasLink = new Uint8Array(0); // 1 = this cell has an entry in linkEdges (a typed flag is cheaper to ask than the Map)
  let linkList = []; // links with their end cells resolved (see build)
  let builtForSignature = null; // colliderSignature() the grid was built for
  let refreshTimer = 0;
  let hasField = false;
  // Where the player stood when the field was last drawn (NaN = never, or the grid was rebuilt since): standing on
  // exactly the same spot, the field would come out the same, so update() skips the redraw.
  let fieldX = NaN;
  let fieldY = NaN;
  let fieldZ = NaN;

  // Does a solid box stand between (x0,z0) and (x1,z1), anywhere between heights yLow and yHigh?
  // A real physical check against the colliders (the grid alone can't see walls thinner than a cell).
  // (Written out per axis, with no temporary arrays: the field's seeding and bestCellNear call this for every box.)
  function wallBetween(x0, z0, x1, z1, yLow, yHigh) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    for (let n = 0; n < colliders.length; n++) {
      const box = colliders[n];
      if (box.max.y <= yLow || box.min.y >= yHigh) continue; // floors, or overhead
      if (x0 >= box.min.x && x0 <= box.max.x && z0 >= box.min.z && z0 <= box.max.z) continue; // starting inside
      // Slab test: does the segment's [0,1] range overlap the box on both axes at once?
      let t0 = 0;
      let t1 = 1;
      // x
      if (Math.abs(dx) < 1e-9) {
        if (x0 < box.min.x || x0 > box.max.x) continue; // parallel to this slab and outside it: misses the box
      } else {
        const a = (box.min.x - x0) / dx;
        const b = (box.max.x - x0) / dx;
        t0 = Math.max(t0, a > b ? b : a);
        t1 = Math.min(t1, a > b ? a : b);
        if (t0 > t1) continue;
      }
      // z
      if (Math.abs(dz) < 1e-9) {
        if (z0 < box.min.z || z0 > box.max.z) continue;
      } else {
        const a = (box.min.z - z0) / dz;
        const b = (box.max.z - z0) / dz;
        t0 = Math.max(t0, a > b ? b : a);
        t1 = Math.min(t1, a > b ? a : b);
        if (t0 > t1) continue;
      }
      if (t0 <= t1) return true;
    }
    return false;
  }

  // --- Grid building ---------------------------------------------------------

  function build() {
    const n = colliders.length;
    builtForSignature = colliderSignature(colliders);
    if (n === 0) return;

    // Grid covers every collider's footprint.
    let maxX = -Infinity;
    let maxZ = -Infinity;
    minX = Infinity;
    minZ = Infinity;
    for (const box of colliders) {
      minX = Math.min(minX, box.min.x);
      minZ = Math.min(minZ, box.min.z);
      maxX = Math.max(maxX, box.max.x);
      maxZ = Math.max(maxZ, box.max.z);
    }
    cols = Math.ceil((maxX - minX) / cs);
    rows = Math.ceil((maxZ - minZ) / cs);
    cells = cols * rows;
    walkable = new Uint8Array(layers * cells);
    nearWall = new Uint8Array(layers * cells);
    dist = new Float32Array(layers * cells);
    spreadFrom = new Float32Array(layers * cells);
    hasLink = new Uint8Array(layers * cells);
    hasField = false;
    fieldX = fieldY = fieldZ = NaN; // (a new grid: the next field is drawn wherever the player stands)

    const floorTol = zombieNav.floorTolerance;
    for (let layer = 0; layer < layers; layer++) {
      const base = layer * cells;
      const y = floors[layer];
      // Pass 1: cells with a floor under their center (a box whose top is at this floor's height).
      for (const box of colliders) {
        if (Math.abs(box.max.y - y) > floorTol) continue;
        forCellsIn(box.min.x, box.min.z, box.max.x, box.max.z, (i) => (walkable[base + i] = 1));
      }
      // Pass 2: anything solid between ankle and head height above it blocks, grown by the zombie's radius
      // so a zombie walking a cell's center never scrapes it.
      const solid = colliders.filter((box) => box.max.y > y + floorTol && box.min.y < y + agent.height);
      for (const box of solid) {
        const r = agent.radius;
        forCellsIn(box.min.x - r, box.min.z - r, box.max.x + r, box.max.z + r, (i) => (walkable[base + i] = 0));
      }
      // Pass 3: cells within a little extra clearance of something solid stay walkable but cost
      // extra (Dijkstra), so routes keep off walls and doorframes where there's room, yet narrow
      // gaps (e.g. between crates and a wall) still connect.
      for (const box of solid) {
        const r = agent.radius + zombieNav.extraClearance;
        forCellsIn(box.min.x - r, box.min.z - r, box.max.x + r, box.max.z + r, (i) => {
          if (walkable[base + i]) nearWall[base + i] = 1;
        });
      }
    }

    // Links: the cell at each end is open floor (forced walkable), and the two are joined by one edge.
    linkEdges = new Map();
    linkList = links.map((link) => {
      const lowerCell = cellIndex(link.lower.floor, link.lower.x, link.lower.z);
      const upperCell = cellIndex(link.upper.floor, link.upper.x, link.upper.z);
      for (const i of [lowerCell, upperCell]) {
        walkable[i] = 1;
        nearWall[i] = 0;
      }
      const dy = floors[link.upper.floor] - floors[link.lower.floor];
      const lengthMeters = Math.hypot(link.upper.x - link.lower.x, link.upper.z - link.lower.z, dy);
      const cost = (lengthMeters / cs) * (1 + (zombieNav.linkPenalty ?? 0));
      const resolved = { ...link, lowerCell, upperCell, dy };
      for (const [from, to] of [[lowerCell, upperCell], [upperCell, lowerCell]]) {
        if (!linkEdges.has(from)) linkEdges.set(from, []);
        linkEdges.get(from).push({ to, cost, link: resolved });
        hasLink[from] = 1;
      }
      return resolved;
    });
  }

  // Calls fn(index) for every cell whose CENTER lies inside the rectangle.
  function forCellsIn(x0, z0, x1, z1, fn) {
    const c0 = Math.max(0, Math.ceil((x0 - minX) / cs - 0.5));
    const c1 = Math.min(cols - 1, Math.floor((x1 - minX) / cs - 0.5));
    const r0 = Math.max(0, Math.ceil((z0 - minZ) / cs - 0.5));
    const r1 = Math.min(rows - 1, Math.floor((z1 - minZ) / cs - 0.5));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(r * cols + c);
  }

  // The global index of the cell at (x, z) on `layer` (no bounds check: link ends are inside the grid).
  const cellIndex = (layer, x, z) => layer * cells + rowOf(z) * cols + colOf(x);
  const colOf = (x) => Math.floor((x - minX) / cs);
  const rowOf = (z) => Math.floor((z - minZ) / cs);
  const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const centerX = (c) => minX + (c + 0.5) * cs;
  const centerZ = (r) => minZ + (r + 0.5) * cs;

  // Which floor is something at height y standing on? The highest floor level at or below it (a little slack
  // for a jump or a step), else the lowest.
  function layerOf(y = 0) {
    let best = 0;
    for (let l = 1; l < layers; l++) if (floors[l] <= y + rampTolerance && floors[l] > floors[best]) best = l;
    return best;
  }

  // The link whose ramp this mover is ON (inside its footprint and within rampTolerance of its surface), or null.
  function rampAt(x, y, z) {
    for (const link of linkList) {
      const ax = link.lower.x;
      const az = link.lower.z;
      const dx = link.upper.x - ax;
      const dz = link.upper.z - az;
      const len2 = dx * dx + dz * dz;
      if (len2 < 1e-9) continue;
      const t = ((x - ax) * dx + (z - az) * dz) / len2; // 0 at the foot of the ramp, 1 at the top
      if (t < 0 || t > 1) continue;
      const across = Math.abs((x - ax) * dz - (z - az) * dx) / Math.sqrt(len2);
      if (across > link.halfWidth) continue;
      const surface = link.profile ? profileHeight(link.profile, t * Math.sqrt(len2)) : floors[link.lower.floor] + t * link.dy;
      if (Math.abs(y - surface) <= rampTolerance) return link;
    }
    return null;
  }

  function isWalkableAt(x, z, y = 0) {
    const c = colOf(x);
    const r = rowOf(z);
    return inside(c, r) && walkable[layerOf(y) * cells + r * cols + c] === 1;
  }

  // --- Flow field (Dijkstra from the player) -----------------------------------

  // Small binary min-heap of cell indices, keyed by dist[]. One reused block of numbers (it grows when a bigger map
  // needs it and is never thrown away), and swaps through a plain temporary: no garbage per field.
  let heap = new Int32Array(1024);
  let heapSize = 0;
  function heapPush(i) {
    if (heapSize === heap.length) {
      const bigger = new Int32Array(heap.length * 2);
      bigger.set(heap);
      heap = bigger;
    }
    let k = heapSize++;
    heap[k] = i;
    while (k > 0) {
      const p = (k - 1) >> 1;
      const parent = heap[p];
      if (dist[parent] <= dist[i]) break;
      heap[p] = i;
      heap[k] = parent;
      k = p;
    }
  }
  function heapPop() {
    const top = heap[0];
    const last = heap[--heapSize];
    if (heapSize > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heapSize && dist[heap[l]] < dist[heap[m]]) m = l;
        if (r < heapSize && dist[heap[r]] < dist[heap[m]]) m = r;
        if (m === k) break;
        const moved = heap[m];
        heap[m] = heap[k];
        heap[k] = moved;
        k = m;
      }
    }
    return top;
  }

  function computeField(target, pocket = false) {
    dist.fill(Infinity);
    heapSize = 0;
    const ty = target.y ?? 0;

    // Seed: walkable cells near the player (the player might stand on a bench zombies can't),
    // but only ones with no wall in between: a cell on the far side of a wall isn't "next to the
    // player", it's a dead end (zombies would walk into the wall instead of around through a door).
    // A player standing ON a ramp seeds both of its ends (zombies come from either floor).
    const onRamp = rampAt(target.x, ty, target.z);
    let seeded = false;
    if (onRamp) {
      for (const [cell, end] of [[onRamp.lowerCell, onRamp.lower], [onRamp.upperCell, onRamp.upper]]) {
        dist[cell] = Math.hypot(end.x - target.x, end.z - target.z) / cs;
        heapPush(cell);
        seeded = true;
      }
    } else {
      const layer = layerOf(ty);
      const base = layer * cells;
      const yLow = ty + zombieNav.floorTolerance;
      const yHigh = ty + agent.height;
      const pc = colOf(target.x);
      const pr = rowOf(target.z);
      // Second pass, only when the first found nothing: the player is in a pocket zombies can't walk into (hopped over a
      // bench, a table, a kerb). Without a seed there is no field at all: every zombie in the mall stands still and no spawn
      // marker has a route, so the wave stops. Then the nearest cells within playerFallbackRadius count, wall between or not:
      // the horde comes as close as it can and the round goes on. (`pocket`: straight to that pass, see the end.)
      const passes = pocket ? [[zombieNav.playerFallbackRadius, false]]
        : [[zombieNav.playerSearchRadius, true], [zombieNav.playerFallbackRadius, false]];
      for (const [reach, clearOnly] of passes) {
        if (seeded) break;
        const span = Math.ceil(reach / cs);
        for (let r = pr - span; r <= pr + span; r++) {
          for (let c = pc - span; c <= pc + span; c++) {
            if (!inside(c, r) || !walkable[base + r * cols + c]) continue;
            const d = Math.hypot(centerX(c) - target.x, centerZ(r) - target.z);
            if (d > reach) continue;
            if (clearOnly && wallBetween(target.x, target.z, centerX(c), centerZ(r), yLow, yHigh)) continue;
            const i = base + r * cols + c;
            dist[i] = d / cs; // distances are stored in cells
            heapPush(i);
            seeded = true;
          }
        }
      }
    }
    hasField = seeded;
    if (!seeded) return;

    const wallPenalty = zombieNav.wallPenalty;
    let reached = 0; // cells the field got to
    spreadFrom.fill(Infinity);
    while (heapSize > 0) {
      const i = heapPop();
      const d = dist[i];
      // A cell is queued again every time a shorter way to it turns up, so most cells come out of the heap more than
      // once. Spreading from one again at the SAME distance can't shorten anything (its neighbours already have that
      // offer), so only the first visit at each distance does the work. Same field, fewer visits.
      if (spreadFrom[i] === d) continue;
      if (spreadFrom[i] === Infinity) reached += 1;
      spreadFrom[i] = d;
      const base = Math.floor(i / cells) * cells;
      const local = i - base;
      const c = local % cols;
      const r = (local - c) / cols;
      for (let n = 0; n < NEIGHBOR_COUNT; n++) {
        const dc = NEIGHBOR_DC[n];
        const dr = NEIGHBOR_DR[n];
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const ni = base + nr * cols + nc;
        if (!walkable[ni]) continue;
        // No cutting corners diagonally past a blocked cell.
        if (dc !== 0 && dr !== 0 && (!walkable[base + r * cols + nc] || !walkable[base + nr * cols + c])) continue;
        const nd = d + NEIGHBOR_COST[n] * (1 + wallPenalty * nearWall[ni]);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          heapPush(ni);
        }
      }
      if (hasLink[i]) { // a ramp to another floor
        const edges = linkEdges.get(i);
        for (let e = 0; e < edges.length; e++) {
          const edge = edges[e];
          const nd = d + edge.cost;
          if (nd < dist[edge.to]) {
            dist[edge.to] = nd;
            heapPush(edge.to);
          }
        }
      }
    }
    // The field stayed inside a few cells: the player's pocket has floor of its own, sealed off from the mall (behind a
    // bench between two machines). That is no field for the horde either: do it again from the cells around the pocket.
    if (!pocket && !onRamp && reached < zombieNav.pocketCells) computeField(target, true);
  }

  // --- Queries -------------------------------------------------------------------

  // Is the straight line from (x0,z0) to (x1,z1) walkable (on the floor at height y)? Ignores the first stretch,
  // because a zombie pressed against a wall can stand in a "blocked" (padded) cell.
  function clearLine(x0, z0, x1, z1, y = 0) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const step = cs * 0.5;
    for (let t = Math.min(length, cs); t < length; t += step) {
      if (!isWalkableAt(x0 + (dx * t) / length, z0 + (dz * t) / length, y)) return false;
    }
    return true;
  }

  // The cell to path from for something standing at (x, z) on `layer`. Normally its own cell; if that
  // one is padding next to a wall (or unreachable), the best cell in the nearest ring around it.
  // Rings grow outward one at a time, and a cell only counts if no wall stands between it and
  // (x, z), so we never pick a cell on the far side of a thin wall.
  function bestCellNear(x, z, layer = 0) {
    const base = layer * cells;
    const c = colOf(x);
    const r = rowOf(z);
    if (inside(c, r) && dist[base + r * cols + c] < Infinity) return base + r * cols + c;
    const yLow = floors[layer] + zombieNav.floorTolerance;
    const yHigh = floors[layer] + agent.height;
    for (let ring = 1; ring <= 2; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue; // just this ring
          const nc = c + dc;
          const nr = r + dr;
          if (!inside(nc, nr)) continue;
          const i = base + nr * cols + nc;
          if (dist[i] < bestD && !wallBetween(x, z, centerX(nc), centerZ(nr), yLow, yHigh)) {
            bestD = dist[i];
            best = i;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  // Cell index -> its position on the map.
  const cellX = (i) => centerX((i % cells) % cols);
  const cellZ = (i) => centerZ(Math.floor((i % cells) / cols));

  return {
    floors,
    layerOf,
    rampAt,

    // Fixed-tick update: rebuild the grid if colliders changed (e.g. a shutter opened),
    // and refresh the field toward the player a few times a second.
    update(dt, target) {
      let rebuilt = false;
      if (colliderSignature(colliders) !== builtForSignature) {
        build();
        rebuilt = true;
      }
      refreshTimer -= dt;
      if (rebuilt || refreshTimer <= 0) {
        // The field depends only on the grid and on exactly where the player stands. Same grid, same spot (holding a
        // corner, an open menu, the death camera): the field in hand is already the one this would draw, so keep it.
        const ty = target.y ?? 0;
        if (rebuilt || target.x !== fieldX || ty !== fieldY || target.z !== fieldZ) {
          computeField(target);
          fieldX = target.x;
          fieldY = ty;
          fieldZ = target.z;
        }
        refreshTimer = zombieNav.refreshSeconds;
      }
    },

    // Force a rebuild next tick (normally not needed: colliderSignature() catches every marked change).
    markDirty() {
      builtForSignature = null;
    },

    // Route cost in meter-scaled units (includes wall penalties), or Infinity if unreachable.
    // `y` = the height of the floor the point is on (default: the ground floor).
    distanceToTarget(x, z, y = 0) {
      if (!hasField) return Infinity;
      const ramp = rampAt(x, y, z);
      if (ramp) return Math.min(dist[ramp.lowerCell], dist[ramp.upperCell]) * cs;
      const i = bestCellNear(x, z, layerOf(y));
      return i < 0 ? Infinity : dist[i] * cs;
    },

    /**
     * Which way should something at `from` walk to reach `target`? Writes a unit
     * direction (x, z) into `out` and returns true, or returns false if there is no path.
     * `from` and `target` may carry a height (y): it picks the floor they are on (default: the ground floor).
     * opts.laneOffset: meters to walk to the side of the shared route (each zombie its own);
     * opts.laneFade:   0..1 how much of that offset to use (fades out near the player);
     * opts.lookAhead:  how many cells down the route to look (each zombie its own).
     */
    directionTo(from, target, out, { laneOffset = 0, laneFade = 1, lookAhead = 6 } = {}) {
      if (!hasField) return false;
      const offset = laneOffset * laneFade;
      const fy = from.y ?? 0;
      const ty = target.y ?? 0;

      // On a ramp: walk to whichever end is closer to the player (or straight at them if they are on this ramp too).
      const ramp = rampAt(from.x, fy, from.z);
      const targetRamp = rampAt(target.x, ty, target.z);
      if (ramp && ramp === targetRamp) return setDir(out, target.x - from.x, target.z - from.z);
      if (ramp) {
        const toUpper = dist[ramp.upperCell] <= dist[ramp.lowerCell];
        const end = toUpper ? ramp.upper : ramp.lower;
        const other = toUpper ? ramp.lower : ramp.upper;
        // aim a little past the end, along the ramp's own line, so it walks straight off the ramp
        const ax = end.x - other.x;
        const az = end.z - other.z;
        const al = Math.hypot(ax, az) || 1;
        return setDir(out, end.x + (ax / al) * cs - from.x, end.z + (az / al) * cs - from.z);
      }

      const layer = layerOf(fy);
      const floorY = floors[layer];

      // In the open (same floor): walk at the player, but along this zombie's own lane (so a crowd fans out).
      if (layerOf(ty) === layer && clearLine(from.x, from.z, target.x, target.z, floorY)) {
        if (offset !== 0 && setDir(out, target.x - from.x, target.z - from.z)) {
          const lx = target.x - out.z * offset;
          const lz = target.z + out.x * offset;
          if (isWalkableAt(lx, lz, floorY) && clearLine(from.x, from.z, lx, lz, floorY)) return setDir(out, lx - from.x, lz - from.z);
        }
        return setDir(out, target.x - from.x, target.z - from.z);
      }

      // Otherwise follow the field downhill a few cells, then aim at the furthest one
      // still in a straight line (smooths out the grid's zig-zags around corners).
      let i = bestCellNear(from.x, from.z, layer);
      if (i < 0 || dist[i] === Infinity) return false;
      let aim = i;
      const base = layer * cells;
      for (let step = 0; step < lookAhead; step++) {
        const local = i - base;
        const c = local % cols;
        const r = (local - c) / cols;
        let next = -1;
        let nextD = dist[i];
        for (let n = 0; n < NEIGHBOR_COUNT; n++) {
          const dc = NEIGHBOR_DC[n];
          const dr = NEIGHBOR_DR[n];
          const nc = c + dc;
          const nr = r + dr;
          if (!inside(nc, nr)) continue;
          const ni = base + nr * cols + nc;
          if (dc !== 0 && dr !== 0 && (!walkable[base + r * cols + nc] || !walkable[base + nr * cols + c])) continue;
          if (dist[ni] < nextD) {
            nextD = dist[ni];
            next = ni;
          }
        }
        if (next < 0) {
          // The downhill route may leave this floor: at the foot of a ramp, walk into it.
          for (const edge of linkEdges.get(i) ?? []) {
            if (!(dist[edge.to] < dist[i]) && edge.link !== targetRamp) continue; // (or the player is standing on this ramp)
            const here = edge.link.lowerCell === i ? edge.link.lower : edge.link.upper;
            const there = edge.link.lowerCell === i ? edge.link.upper : edge.link.lower;
            // Still a few cells away (round a wall, say): head for the ramp's end like any other cell, don't cut through to it.
            if (Math.hypot(here.x - from.x, here.z - from.z) > cs * 2) {
              if (clearLine(from.x, from.z, cellX(i), cellZ(i), floorY)) aim = i;
              break;
            }
            const ax = there.x - here.x;
            const az = there.z - here.z;
            const al = Math.hypot(ax, az) || 1;
            return setDir(out, here.x + (ax / al) * cs - from.x, here.z + (az / al) * cs - from.z);
          }
          break;
        }
        i = next;
        const nx = cellX(i);
        const nz = cellZ(i);
        if (step === 0 || clearLine(from.x, from.z, nx, nz, floorY)) aim = i;
      }
      const ax = cellX(aim);
      const az = cellZ(aim);
      if (!setDir(out, ax - from.x, az - from.z)) return false;

      // Shift the aim point sideways into this zombie's lane (full, then half) if there's room.
      for (let n = 0; n < LANE_FRACTIONS.length; n++) {
        const f = LANE_FRACTIONS[n];
        if (offset === 0) break;
        const lx = ax - out.z * offset * f;
        const lz = az + out.x * offset * f;
        if (isWalkableAt(lx, lz, floorY) && clearLine(from.x, from.z, lx, lz, floorY)) return setDir(out, lx - from.x, lz - from.z);
      }
      return true;
    },

    /**
     * Which way should something at `from` walk to get AWAY from the player? The field directionTo walks down, walked UP: a few cells
     * to ever-greater route cost (round corners, along corridors), aiming at the furthest one still in a straight line. Writes a unit
     * (x, z) into `out` and returns true, or false when there is nowhere further to go (cornered in a dead end) or no field.
     * On a ramp it heads for the ramp's end further from the player. Used by the Shoplifter's getaway (game/shoplifting.js).
     */
    directionAway(from, out, { lookAhead = 4 } = {}) {
      if (!hasField) return false;
      const fy = from.y ?? 0;
      const ramp = rampAt(from.x, fy, from.z);
      if (ramp) {
        const end = dist[ramp.upperCell] >= dist[ramp.lowerCell] ? ramp.upper : ramp.lower;
        return setDir(out, end.x - from.x, end.z - from.z);
      }
      const layer = layerOf(fy);
      const floorY = floors[layer];
      let i = bestCellNear(from.x, from.z, layer);
      if (i < 0 || dist[i] === Infinity) return false;
      const start = i;
      let aim = i;
      const base = layer * cells;
      for (let step = 0; step < lookAhead; step++) {
        const local = i - base;
        const c = local % cols;
        const r = (local - c) / cols;
        let next = -1;
        let nextD = dist[i];
        for (let n = 0; n < NEIGHBOR_COUNT; n++) {
          const dc = NEIGHBOR_DC[n];
          const dr = NEIGHBOR_DR[n];
          const nc = c + dc;
          const nr = r + dr;
          if (!inside(nc, nr)) continue;
          const ni = base + nr * cols + nc;
          if (!walkable[ni] || dist[ni] === Infinity) continue;
          if (dc !== 0 && dr !== 0 && (!walkable[base + r * cols + nc] || !walkable[base + nr * cols + c])) continue;
          if (dist[ni] > nextD) {
            nextD = dist[ni];
            next = ni;
          }
        }
        if (next < 0) break;
        i = next;
        if (step === 0 || clearLine(from.x, from.z, cellX(i), cellZ(i), floorY)) aim = i;
      }
      if (aim === start) return false;
      return setDir(out, cellX(aim) - from.x, cellZ(aim) - from.z);
    },

    isWalkableAt,
    clearLine,

    // Independent spot-to-spot routes for filming bosses. Never replaces the
    // shared player flow field used by the horde.
    reachablePoints(y) {
      const result=[];
      const layer=layerOf(y), base=layer*cells;
      for (let i=base;i<base+cells;i++) if (hasField && walkable[i] && dist[i]<Infinity) {
        result.push({x:cellX(i),y:floors[layer],z:cellZ(i)});
      }
      return result;
    },
    pathTo(from,to) {
      if (!hasField) return null;
      const start=bestCellNear(from.x,from.z,layerOf(from.y));
      const goal=cellIndex(layerOf(to.y),to.x,to.z);
      if (start<0 || goal<0 || !walkable[goal] || dist[goal]===Infinity) return null;
      const previous=new Int32Array(walkable.length).fill(-1);
      const queue=[start]; previous[start]=start;
      for (let cursor=0;cursor<queue.length && previous[goal]===-1;cursor++) {
        const i=queue[cursor], base=Math.floor(i/cells)*cells, local=i-base;
        const c=local%cols,r=Math.floor(local/cols);
        const visit=ni=>{ if (previous[ni]===-1 && walkable[ni]) { previous[ni]=i; queue.push(ni); } };
        for (let n=0;n<NEIGHBOR_COUNT;n++) {
          const dc=NEIGHBOR_DC[n],dr=NEIGHBOR_DR[n],nc=c+dc,nr=r+dr;
          if (!inside(nc,nr)) continue;
          if (dc!==0 && dr!==0 && (!walkable[base+r*cols+nc] || !walkable[base+nr*cols+c])) continue;
          visit(base+nr*cols+nc);
        }
        for (const edge of linkEdges.get(i)??[]) visit(edge.to);
      }
      if (previous[goal]===-1) return null;
      const indices=[];
      for (let i=goal;;i=previous[i]) { indices.push(i); if (i===start) break; }
      indices.reverse();
      const path=[];
      for (let k=0;k<indices.length;k++) {
        const i=indices[k],last=indices[k-1];
        if (last!==undefined && Math.floor(last/cells)!==Math.floor(i/cells)) {
          const edge=linkEdges.get(last).find(e=>e.to===i);
          const lower=edge.link.lowerCell===last;
          const a=lower?edge.link.lower:edge.link.upper,b=lower?edge.link.upper:edge.link.lower;
          path.push({x:a.x,y:floors[a.floor],z:a.z},{x:b.x,y:floors[b.floor],z:b.z});
        }
        path.push({x:cellX(i),y:floors[Math.floor(i/cells)],z:cellZ(i)});
      }
      return path;
    },
  };
}

// Height along a surface profile [[s, y], ...] (linear between points; clamped at the ends).
function profileHeight(points, s) {
  if (s <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (s <= points[i][0]) {
      const [s0, y0] = points[i - 1];
      const [s1, y1] = points[i];
      return y0 + ((s - s0) / (s1 - s0)) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

function setDir(out, dx, dz) {
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return false;
  out.x = dx / length;
  out.z = dz / length;
  return true;
}
