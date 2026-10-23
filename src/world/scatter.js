// CLUTTER SCATTER: places decoration-kit models (world/decor.js) on a floor area, deterministically per seed,
// and merges them into ONE mesh per kit material (per chunk when distance culling is on), so a whole room of
// clutter costs a few draw calls. Decoration only: it reads colliders, never adds any.
//
// scatter({ kit, area, kinds, density, seed, keepClear, colliders, floors, perSquareMeter, maxDistance, parent })
//   area       { minX, maxX, minZ, maxZ, y = 0 }: where items may go (y = the floor height, e.g. 6.3 on level 2)
//   kinds      ['receipts', ...] (weights from config/decor.js) or { receipts: 3, puddle: 1 }; default = every kind
//   density    starting tier: 'none' | 'some' | 'full' ('some' = a fixed subset of 'full')
//   keepClear  [{ minX, maxX, minZ, maxZ }]: combat lanes, doorways, vault landings, spawn points...
//   colliders  the map's Box3 list: boxes whose top is at the floor height are floor (support); anything else
//              reaching into an item's height is an obstacle (an overhead beam above it is fine)
//   floors     optional [{ minX, maxX, minZ, maxZ }] to use as the support instead of the colliders' tops
//              (with neither colliders nor floors, the whole area counts as floor)
//   maxDistance  optional: items batch per chunk and update(camera) hides chunks farther than this
// Returns { group, placements, meshes, density, setDensity(tier), update(camera), drawCalls, dispose() }.
// placements are in rank order: the first `someCount` are the 'some' tier, so changing the tier only changes
// each mesh's draw range: items never move.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { seededRandom } from './textures.js';
import { decor } from '../config/decor.js';

export const DENSITY_TIERS = Object.freeze(['none', 'some', 'full']);

const circleHitsRect = (x, z, r, rect) => {
  const dx = x - Math.max(rect.minX, Math.min(x, rect.maxX));
  const dz = z - Math.max(rect.minZ, Math.min(z, rect.maxZ));
  return dx * dx + dz * dz < r * r;
};
const pointInRect = (x, z, rect) => x >= rect.minX && x <= rect.maxX && z >= rect.minZ && z <= rect.maxZ;
const rectOfBox = (box) => ({ minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });

function checkTier(tier) {
  if (!DENSITY_TIERS.includes(tier)) throw new Error(`Unknown decor density "${tier}" (use ${DENSITY_TIERS.join(' | ')})`);
  return tier;
}

function weightedKinds(kit, kinds) {
  const entries = kinds === undefined ? kit.kinds.map((kind) => [kind, decor.kinds[kind].weight])
    : Array.isArray(kinds) ? kinds.map((kind) => [kind, decor.kinds[kind]?.weight ?? 1])
      : Object.entries(kinds);
  for (const [kind] of entries) kit.variantsOf(kind); // throws for an unknown kind
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (!(total > 0)) throw new Error('scatter needs at least one kind with a positive weight');
  return (u) => {
    let acc = 0;
    for (const [kind, w] of entries) if (u * total < (acc += w)) return kind;
    return entries[entries.length - 1][0];
  };
}

export function scatter({
  kit, area, kinds, density = decor.scatter.defaultDensity, seed = 1, keepClear = [], colliders = [], floors,
  perSquareMeter = decor.scatter.perSquareMeter, maxDistance = null, parent = null, name = 'decor_scatter',
}) {
  const cfg = decor.scatter;
  let tier = checkTier(density);
  const y = area.y ?? 0;
  const rand = seededRandom((Math.abs(Math.floor(seed)) % 2147483645) + 1);
  const pickKind = weightedKinds(kit, kinds);

  // What holds clutter up, and what it must stay out of.
  const solid = colliders.filter((box) => !box.isEmpty());
  const supports = floors ?? (solid.length ? solid.filter((box) => Math.abs(box.max.y - y) <= cfg.floorTolerance).map(rectOfBox) : null);
  const obstacles = solid.filter((box) => box.max.y > y + cfg.floorTolerance);

  const supported = (x, z, r) => !supports || [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r],
    [r * Math.SQRT1_2, r * Math.SQRT1_2], [-r * Math.SQRT1_2, r * Math.SQRT1_2], [r * Math.SQRT1_2, -r * Math.SQRT1_2], [-r * Math.SQRT1_2, -r * Math.SQRT1_2]]
    .every(([dx, dz]) => supports.some((rect) => pointInRect(x + dx, z + dz, rect)));
  const blocked = (x, z, r, height) => obstacles.some((box) => box.min.y < y + height + cfg.headroom
    && circleHitsRect(x, z, r + cfg.margin, rectOfBox(box)));

  // --- placement ---
  const width = area.maxX - area.minX, depth = area.maxZ - area.minZ;
  const target = Math.max(0, Math.round(perSquareMeter * width * depth));
  const placements = [];
  for (let attempt = 0; placements.length < target && attempt < target * cfg.attemptsPerItem; attempt++) {
    // Always draw the same random numbers per attempt, so a rejection never shifts the rest.
    const kind = pickKind(rand()), u = rand(), [s0, s1] = decor.kinds[kind]?.scale ?? [1, 1];
    const scale = s0 + (s1 - s0) * rand(), yaw = rand() * Math.PI * 2;
    const x = area.minX + rand() * width, z = area.minZ + rand() * depth, rank = rand();
    const variant = Math.floor(u * kit.variantsOf(kind));
    const model = kit.model(kind, variant), radius = model.radius * scale, height = model.height * scale;
    if (x - radius < area.minX || x + radius > area.maxX || z - radius < area.minZ || z + radius > area.maxZ) continue;
    if (keepClear.some((rect) => circleHitsRect(x, z, radius + cfg.margin, rect))) continue;
    if (!supported(x, z, radius) || blocked(x, z, radius, height)) continue;
    if (placements.some((p) => Math.hypot(p.x - x, p.z - z) < (p.radius + radius) * cfg.spacing)) continue;
    placements.push({ kind, variant, x, y, z, yaw, scale, radius, height, rank });
  }
  placements.sort((a, b) => a.rank - b.rank);
  const someCount = Math.round(placements.length * cfg.someFraction);
  placements.forEach((p, i) => { p.tier = i < someCount ? 'some' : 'full'; });

  // --- batching: one merged mesh per (chunk, material), items in rank order ---
  const group = new THREE.Group();
  group.name = name;
  const chunkSize = maxDistance ? cfg.chunkSize : Infinity;
  const chunkKey = (p) => (maxDistance ? `${Math.floor((p.x - area.minX) / chunkSize)},${Math.floor((p.z - area.minZ) / chunkSize)}` : 'all');
  const chunks = new Map();
  const matrix = new THREE.Matrix4(), lift = new THREE.Matrix4(), quat = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  placements.forEach((p, index) => {
    const key = chunkKey(p);
    if (!chunks.has(key)) chunks.set(key, { bounds: new THREE.Box3(), byMaterial: new Map(), inRange: true, meshes: [] });
    const chunk = chunks.get(key);
    chunk.bounds.expandByPoint(new THREE.Vector3(p.x - p.radius, y, p.z - p.radius));
    chunk.bounds.expandByPoint(new THREE.Vector3(p.x + p.radius, y + p.height, p.z + p.radius));
    matrix.compose(new THREE.Vector3(p.x, y + cfg.lift, p.z), quat.setFromAxisAngle(up, p.yaw), new THREE.Vector3(p.scale, p.scale, p.scale));
    for (const part of kit.model(p.kind, p.variant).parts) {
      const geometry = part.geometry.clone();
      geometry.applyMatrix4(matrix);
      if (part.material === 'decal') geometry.applyMatrix4(lift.makeTranslation(0, cfg.decalLift + (index % cfg.decalLiftSteps) * cfg.decalLiftStep, 0));
      if (!chunk.byMaterial.has(part.material)) chunk.byMaterial.set(part.material, { list: [], someVertices: 0 });
      const entry = chunk.byMaterial.get(part.material);
      entry.list.push(geometry);
      if (p.tier === 'some') entry.someVertices += geometry.attributes.position.count;
    }
  });
  const meshes = [];
  for (const [key, chunk] of chunks) {
    for (const [material, { list, someVertices }] of chunk.byMaterial) {
      const geometry = mergeGeometries(list);
      list.forEach((g) => g.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, kit.materials[material]);
      mesh.name = `${name}_${material}_${key}`;
      mesh.matrixAutoUpdate = false;
      mesh.userData.decor = { material, chunk: key, someVertices, fullVertices: geometry.attributes.position.count };
      group.add(mesh);
      chunk.meshes.push(mesh);
      meshes.push(mesh);
    }
  }
  if (parent) parent.add(group);

  function apply() {
    for (const chunk of chunks.values()) {
      for (const mesh of chunk.meshes) {
        const { someVertices, fullVertices } = mesh.userData.decor;
        const count = tier === 'full' ? fullVertices : tier === 'some' ? someVertices : 0;
        mesh.geometry.setDrawRange(0, count);
        mesh.visible = count > 0 && chunk.inRange;
      }
    }
  }
  apply();

  const eye = new THREE.Vector3();
  return {
    group,
    placements,
    meshes,
    get density() { return tier; },
    setDensity(next) { tier = checkTier(next); apply(); },
    // Hides chunks whose clutter is all farther than maxDistance from the camera (a hard cut: clutter is
    // small and low, so it reads as fading into the gloom). No-op without maxDistance.
    update(camera) {
      if (!maxDistance) return;
      if (camera.getWorldPosition) camera.getWorldPosition(eye); else eye.copy(camera.position);
      let changed = false;
      for (const chunk of chunks.values()) {
        const inRange = chunk.bounds.distanceToPoint(eye) <= maxDistance;
        if (inRange !== chunk.inRange) { chunk.inRange = inRange; changed = true; }
      }
      if (changed) apply();
    },
    get drawCalls() { return meshes.filter((mesh) => mesh.visible).length; },
    // Frees the merged geometries (the kit keeps its shared templates and materials: kit.dispose()).
    dispose() {
      group.removeFromParent();
      for (const mesh of meshes) { mesh.geometry.dispose(); group.remove(mesh); }
      meshes.length = 0;
      chunks.clear();
    },
  };
}
