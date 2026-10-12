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
// straight at them instead. Ground floor only: multiple floors need the
// navmesh planned for step 7.
// =============================================================================

import { zombieNav } from '../config/zombies.js';

const SQRT2 = Math.SQRT2;
// 8 neighbours: [dx, dz, cost]
const NEIGHBORS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2],
];

/**
 * @param colliders  the shared world collider list (Box3s); rebuilt automatically when it changes
 * @param agent      { radius, height } of the zombies using this grid
 */
export function createNavigation(colliders, agent) {
  const cs = zombieNav.cellSize;
  let minX = 0;
  let minZ = 0;
  let cols = 0;
  let rows = 0;
  let walkable = new Uint8Array(0);
  let nearWall = new Uint8Array(0); // 1 = walkable cell touching a blocked one (costs extra to walk)
  let dist = new Float32Array(0);
  let builtForColliderCount = -1;
  let refreshTimer = 0;
  let hasField = false;

  // --- Grid building ---------------------------------------------------------

  function build() {
    const n = colliders.length;
    builtForColliderCount = n;
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
    walkable = new Uint8Array(cols * rows);
    nearWall = new Uint8Array(cols * rows);
    dist = new Float32Array(cols * rows);
    hasField = false;

    const floorTol = zombieNav.floorTolerance;
    // Pass 1: cells with a floor under their center.
    for (const box of colliders) {
      if (Math.abs(box.max.y) > floorTol) continue;
      forCellsIn(box.min.x, box.min.z, box.max.x, box.max.z, (i) => (walkable[i] = 1));
    }
    // Pass 2: anything solid between ankle and head height blocks, grown by the zombie's radius
    // so a zombie walking a cell's center never scrapes it.
    const solid = colliders.filter((box) => box.max.y > floorTol && box.min.y < agent.height);
    for (const box of solid) {
      const r = agent.radius;
      forCellsIn(box.min.x - r, box.min.z - r, box.max.x + r, box.max.z + r, (i) => (walkable[i] = 0));
    }
    // Pass 3: cells within a little extra clearance of something solid stay walkable but cost
    // extra (Dijkstra), so routes keep off walls and doorframes where there's room, yet narrow
    // gaps (e.g. between crates and a wall) still connect.
    for (const box of solid) {
      const r = agent.radius + zombieNav.extraClearance;
      forCellsIn(box.min.x - r, box.min.z - r, box.max.x + r, box.max.z + r, (i) => {
        if (walkable[i]) nearWall[i] = 1;
      });
    }
  }

  // Calls fn(index) for every cell whose CENTER lies inside the rectangle.
  function forCellsIn(x0, z0, x1, z1, fn) {
    const c0 = Math.max(0, Math.ceil((x0 - minX) / cs - 0.5));
    const c1 = Math.min(cols - 1, Math.floor((x1 - minX) / cs - 0.5));
    const r0 = Math.max(0, Math.ceil((z0 - minZ) / cs - 0.5));
    const r1 = Math.min(rows - 1, Math.floor((z1 - minZ) / cs - 0.5));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(r * cols + c);
  }

  const colOf = (x) => Math.floor((x - minX) / cs);
  const rowOf = (z) => Math.floor((z - minZ) / cs);
  const inside = (c, r) => c >= 0 && r >= 0 && c < cols && r < rows;
  const centerX = (c) => minX + (c + 0.5) * cs;
  const centerZ = (r) => minZ + (r + 0.5) * cs;

  function isWalkableAt(x, z) {
    const c = colOf(x);
    const r = rowOf(z);
    return inside(c, r) && walkable[r * cols + c] === 1;
  }

  // --- Flow field (Dijkstra from the player) -----------------------------------

  // Small binary min-heap of cell indices, keyed by dist[].
  const heap = [];
  function heapPush(i) {
    heap.push(i);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (dist[heap[p]] <= dist[heap[k]]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  }
  function heapPop() {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = 2 * k + 1;
        const r = l + 1;
        let m = k;
        if (l < heap.length && dist[heap[l]] < dist[heap[m]]) m = l;
        if (r < heap.length && dist[heap[r]] < dist[heap[m]]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  }

  function computeField(target) {
    dist.fill(Infinity);
    heap.length = 0;

    // Seed: walkable cells near the player (the player might stand on a bench zombies can't).
    const reach = zombieNav.playerSearchRadius;
    const pc = colOf(target.x);
    const pr = rowOf(target.z);
    const span = Math.ceil(reach / cs);
    let seeded = false;
    for (let r = pr - span; r <= pr + span; r++) {
      for (let c = pc - span; c <= pc + span; c++) {
        if (!inside(c, r) || !walkable[r * cols + c]) continue;
        const d = Math.hypot(centerX(c) - target.x, centerZ(r) - target.z);
        if (d > reach) continue;
        const i = r * cols + c;
        dist[i] = d / cs; // distances are stored in cells
        heapPush(i);
        seeded = true;
      }
    }
    hasField = seeded;
    if (!seeded) return;

    while (heap.length > 0) {
      const i = heapPop();
      const c = i % cols;
      const r = (i - c) / cols;
      const d = dist[i];
      for (const [dc, dr, cost] of NEIGHBORS) {
        const nc = c + dc;
        const nr = r + dr;
        if (!inside(nc, nr)) continue;
        const ni = nr * cols + nc;
        if (!walkable[ni]) continue;
        // No cutting corners diagonally past a blocked cell.
        if (dc !== 0 && dr !== 0 && (!walkable[r * cols + nc] || !walkable[nr * cols + c])) continue;
        const nd = d + cost * (1 + zombieNav.wallPenalty * nearWall[ni]);
        if (nd < dist[ni]) {
          dist[ni] = nd;
          heapPush(ni);
        }
      }
    }
  }

  // --- Queries -------------------------------------------------------------------

  // Is the straight line from (x0,z0) to (x1,z1) walkable? Ignores the first stretch,
  // because a zombie pressed against a wall can stand in a "blocked" (padded) cell.
  function clearLine(x0, z0, x1, z1) {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    const step = cs * 0.5;
    for (let t = Math.min(length, cs); t < length; t += step) {
      if (!isWalkableAt(x0 + (dx * t) / length, z0 + (dz * t) / length)) return false;
    }
    return true;
  }

  // The cell to path from for something standing at (x, z). Normally its own cell; if that
  // one is padding next to a wall (or unreachable), the best cell in the nearest ring around it.
  // Rings grow outward one at a time so we never pick a cell on the far side of a thin wall.
  function bestCellNear(x, z) {
    const c = colOf(x);
    const r = rowOf(z);
    if (inside(c, r) && dist[r * cols + c] < Infinity) return r * cols + c;
    for (let ring = 1; ring <= 2; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue; // just this ring
          const nc = c + dc;
          const nr = r + dr;
          if (!inside(nc, nr)) continue;
          const i = nr * cols + nc;
          if (dist[i] < bestD) {
            bestD = dist[i];
            best = i;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  return {
    // Fixed-tick update: rebuild the grid if colliders changed (e.g. a shutter opened),
    // and refresh the field toward the player a few times a second.
    update(dt, target) {
      let rebuilt = false;
      if (colliders.length !== builtForColliderCount) {
        build();
        rebuilt = true;
      }
      refreshTimer -= dt;
      if (rebuilt || refreshTimer <= 0) {
        computeField(target);
        refreshTimer = zombieNav.refreshSeconds;
      }
    },

    // Force a rebuild next tick (call if colliders change without the count changing).
    markDirty() {
      builtForColliderCount = -1;
    },

    // Walking distance (meters) from a point to the player, or Infinity if unreachable.
    distanceToTarget(x, z) {
      if (!hasField) return Infinity;
      const i = bestCellNear(x, z);
      return i < 0 ? Infinity : dist[i] * cs;
    },

    /**
     * Which way should something at `from` walk to reach `target`? Writes a unit
     * direction (x, z) into `out` and returns true, or returns false if there is no path.
     * opts.laneOffset: meters to walk to the side of the shared route (each zombie its own);
     * opts.laneFade:   0..1 how much of that offset to use (fades out near the player);
     * opts.lookAhead:  how many cells down the route to look (each zombie its own).
     */
    directionTo(from, target, out, { laneOffset = 0, laneFade = 1, lookAhead = 6 } = {}) {
      if (!hasField) return false;
      const offset = laneOffset * laneFade;

      // In the open: walk at the player, but along this zombie's own lane (so a crowd fans out).
      if (clearLine(from.x, from.z, target.x, target.z)) {
        if (offset !== 0 && setDir(out, target.x - from.x, target.z - from.z)) {
          const lx = target.x - out.z * offset;
          const lz = target.z + out.x * offset;
          if (isWalkableAt(lx, lz) && clearLine(from.x, from.z, lx, lz)) return setDir(out, lx - from.x, lz - from.z);
        }
        return setDir(out, target.x - from.x, target.z - from.z);
      }

      // Otherwise follow the field downhill a few cells, then aim at the furthest one
      // still in a straight line (smooths out the grid's zig-zags around corners).
      let i = bestCellNear(from.x, from.z);
      if (i < 0 || dist[i] === Infinity) return false;
      let aim = i;
      for (let step = 0; step < lookAhead; step++) {
        const c = i % cols;
        const r = (i - c) / cols;
        let next = -1;
        let nextD = dist[i];
        for (const [dc, dr] of NEIGHBORS) {
          const nc = c + dc;
          const nr = r + dr;
          if (!inside(nc, nr)) continue;
          const ni = nr * cols + nc;
          if (dc !== 0 && dr !== 0 && (!walkable[r * cols + nc] || !walkable[nr * cols + c])) continue;
          if (dist[ni] < nextD) {
            nextD = dist[ni];
            next = ni;
          }
        }
        if (next < 0) break;
        i = next;
        const nx = centerX(i % cols);
        const nz = centerZ(Math.floor(i / cols));
        if (step === 0 || clearLine(from.x, from.z, nx, nz)) aim = i;
      }
      const ax = centerX(aim % cols);
      const az = centerZ(Math.floor(aim / cols));
      if (!setDir(out, ax - from.x, az - from.z)) return false;

      // Shift the aim point sideways into this zombie's lane (full, then half) if there's room.
      for (const f of [1, 0.5]) {
        if (offset === 0) break;
        const lx = ax - out.z * offset * f;
        const lz = az + out.x * offset * f;
        if (isWalkableAt(lx, lz) && clearLine(from.x, from.z, lx, lz)) return setDir(out, lx - from.x, lz - from.z);
      }
      return true;
    },

    isWalkableAt,
    clearLine,
  };
}

function setDir(out, dx, dz) {
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return false;
  out.x = dx / length;
  out.z = dz / length;
  return true;
}
