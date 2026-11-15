// =============================================================================
// COLLIDER GRID (performance): the boxes near a point, without reading the whole collider list.
// world/collision.js used to test every box (about 670 in the mall) for every body, several times a tick: a third of a
// late round's tick. The list is sorted once into a grid on the ground plane; each cell lists, IN THE LIST'S OWN ORDER,
// every box whose footprint comes within `reach` of the cell, so one cell's list holds every box a body in that cell could
// touch. Reading that list gives exactly the result of reading them all (the boxes left out are too far to matter, and the
// order of the rest is unchanged), which tests/colliderGrid.test.js checks against the plain loop.
//
//   const cell = cellFor(colliders, x, z, radius)   -> { boxes, order } or null (null = read the whole list)
//   covers(cell, x, z, radius)                      still good for a body that has been pushed to (x, z)?
//   indexAfter(cell.order, n)                       where to carry on in a cell's list after list index n
//   checkColliderGrid(colliders)                    once a tick (game/createGame.js): a box moved without being marked?
//
// WHEN IT IS REBUILT: when the list's length or version changes (world/collision.js markCollidersChanged: a shutter opening,
// a barrier). A box that is moved in place without a mark is caught by checkColliderGrid at the next tick, which compares
// every box with what the grid was built from. `colliders.noGrid = true` switches it off for that list (the tests' reference).
// Numbers: config/performance.js collisionGrid.
// =============================================================================

import { perf } from '../config/performance.js';

const EPS = 1e-6;
const same = (a, b) => a === b || (a !== a && b !== b); // (NaN counts as unchanged NaN)

function build(colliders) {
  const { cellSize, reach, maxCells } = perf.collisionGrid;
  const count = colliders.length;
  const snapshot = new Float64Array(count * 6);
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < count; i++) {
    const { min, max } = colliders[i];
    snapshot.set([min.x, min.y, min.z, max.x, max.y, max.z], i * 6);
    if (!(min.x <= max.x && min.z <= max.z)) continue; // (an empty box touches nothing)
    if (min.x < minX) minX = min.x;
    if (max.x > maxX) maxX = max.x;
    if (min.z < minZ) minZ = min.z;
    if (max.z > maxZ) maxZ = max.z;
  }
  const grid = { count, version: colliders.version ?? 0, snapshot, usable: false };
  minX -= reach; minZ -= reach; maxX += reach; maxZ += reach;
  const cols = Math.ceil((maxX - minX) / cellSize), rows = Math.ceil((maxZ - minZ) / cellSize);
  if (!(cols >= 1 && rows >= 1 && cols * rows <= maxCells)) return grid; // (nothing to sort, or spread too wide: read the list whole)

  const cells = new Array(cols * rows);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x0 = minX + c * cellSize, z0 = minZ + r * cellSize;
      // (x0..z1: where a body's whole footprint must lie for this cell's list to be complete for it)
      cells[r * cols + c] = { boxes: [], order: [], x0: x0 - reach, x1: x0 + cellSize + reach, z0: z0 - reach, z1: z0 + cellSize + reach };
    }
  }
  const clamp = (v, hi) => Math.max(0, Math.min(hi, v));
  for (let i = 0; i < count; i++) {
    const { min, max } = colliders[i];
    if (!(min.x <= max.x && min.z <= max.z)) continue;
    const c0 = clamp(Math.floor((min.x - reach - EPS - minX) / cellSize), cols - 1);
    const c1 = clamp(Math.floor((max.x + reach + EPS - minX) / cellSize), cols - 1);
    const r0 = clamp(Math.floor((min.z - reach - EPS - minZ) / cellSize), rows - 1);
    const r1 = clamp(Math.floor((max.z + reach + EPS - minZ) / cellSize), rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const cell = cells[r * cols + c];
        cell.boxes.push(colliders[i]); // (boxes are visited in list order, so every cell's list is in list order)
        cell.order.push(i);
      }
    }
  }
  return Object.assign(grid, { usable: true, minX, minZ, cols, rows, cellSize, cells });
}

/** The grid for this list, built or rebuilt if the list changed; null while the list is read whole. */
function gridOf(colliders) {
  const cfg = perf.collisionGrid;
  if (colliders.noGrid || colliders.length < cfg.minBoxes) return null;
  const version = colliders.version ?? 0;
  const grid = colliders.grid;
  if (grid && grid.count === colliders.length && grid.version === version) return grid.usable ? grid : null;
  // A changed (or new) list: sort it once it has been asked a few times in this state.
  const asked = colliders.gridAsked;
  if (!asked || asked.count !== colliders.length || asked.version !== version) {
    colliders.gridAsked = { count: colliders.length, version, times: 1 };
    return null;
  }
  if (++asked.times < cfg.buildAfterQueries) return null;
  colliders.grid = build(colliders);
  return colliders.grid.usable ? colliders.grid : null;
}

/**
 * The cell whose list holds every box a body of `radius` at (x, z) can touch: { boxes, order } (order[i] = boxes[i]'s
 * index in the full list), or null when the whole list has to be read (no grid, off the grid, a body wider than `reach`).
 */
export function cellFor(colliders, x, z, radius) {
  const grid = gridOf(colliders);
  if (!grid) return null;
  const c = Math.floor((x - grid.minX) / grid.cellSize), r = Math.floor((z - grid.minZ) / grid.cellSize);
  if (!(c >= 0 && c < grid.cols && r >= 0 && r < grid.rows)) return null; // (off the grid, or NaN)
  const cell = grid.cells[r * grid.cols + c];
  return covers(cell, x, z, radius) ? cell : null;
}

/** Is this cell's list still complete for a body of `radius` at (x, z)? */
export function covers(cell, x, z, radius) {
  return x - radius >= cell.x0 && x + radius <= cell.x1 && z - radius >= cell.z0 && z + radius <= cell.z1;
}

/** The position in a cell's `order` of the first box that comes after list index `n`. */
export function indexAfter(order, n) {
  let i = 0;
  while (i < order.length && order[i] <= n) i++;
  return i;
}

/**
 * Once a tick: has a box been moved in place since the grid was built (nothing does today; the rule is add / remove and
 * markCollidersChanged)? Then the grid is dropped and built again. Returns true if it was stale.
 */
export function checkColliderGrid(colliders) {
  const grid = colliders.grid;
  if (!grid || grid.count !== colliders.length) return false; // (none yet, or the length check will rebuild it anyway)
  const s = grid.snapshot;
  for (let i = 0, k = 0; i < grid.count; i++, k += 6) {
    const { min, max } = colliders[i];
    if (!(same(s[k], min.x) && same(s[k + 1], min.y) && same(s[k + 2], min.z) && same(s[k + 3], max.x) && same(s[k + 4], max.y) && same(s[k + 5], max.z))) {
      colliders.grid = null;
      colliders.gridStale = (colliders.gridStale ?? 0) + 1; // (counted, so a test can say nothing moves a box unmarked)
      return true;
    }
  }
  return false;
}
