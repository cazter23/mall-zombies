// =============================================================================
// WALL BUY DISPLAY
// What a wall buy looks like (COD-style): a chalk outline on the wall with the
// weapon's name, and the gun itself hanging on two pegs in front of it, side on,
// so you can see what you're buying. Visual only: the buying is done by the
// interaction system (game/interactions.js), set up in main.js.
// The gun never moves on the wall, so its parts are merged into one mesh per material (mergeByMaterial): a gun model is
// 25-50 meshes, and seven wall buys were ~260 draw calls the static batcher never saw (they aren't in the map's group).
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeChalkTexture } from './textures.js';

/** Merges a still model's meshes into one per material, in the model's own space (same look, far fewer draw calls). Parts that
 * can't merge (instanced, multi-material, odd attributes) are kept as they are. Returns a new Group to use in its place. */
export function mergeByMaterial(model) {
  model.updateMatrixWorld(true);
  const toModel = model.matrixWorld.clone().invert();
  const groups = new Map(); // material -> [geometry in model space]
  const keep = [];
  model.traverse((o) => {
    if (!o.isMesh) return;
    if (o.isInstancedMesh || Array.isArray(o.material) || !o.visible) { keep.push(o); return; }
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(toModel, o.matrixWorld));
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push({ g, mesh: o });
  });
  const out = new THREE.Group();
  out.name = model.name;
  out.position.copy(model.position); // (the root's own place carries over: the parts were baked relative to it)
  out.rotation.copy(model.rotation);
  out.scale.copy(model.scale);
  for (const [material, parts] of groups) {
    // Every part needs the same attributes to merge: drop uv where some part has none (an untextured material ignores it).
    const hasUv = parts.every((p) => p.g.attributes.uv);
    if (!hasUv) for (const p of parts) if (p.g.attributes.uv) p.g.deleteAttribute('uv');
    const merged = parts.length > 1 ? mergeGeometries(parts.map((p) => p.g), false) : parts[0].g;
    if (!merged) { for (const p of parts) keep.push(p.mesh); continue; }
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = `${model.name || 'model'}_merged`;
    out.add(mesh);
  }
  for (const o of keep) { // (unmerged parts keep their exact place)
    const copy = o.clone();
    copy.matrixAutoUpdate = false;
    copy.matrix.multiplyMatrices(toModel, o.matrixWorld);
    out.add(copy);
  }
  return out;
}

/**
 * @param position  point on the wall surface (center of the display)
 * @param normal    unit vector pointing out of the wall
 * @param name      weapon name for the chalk label
 * @param gunModel  the gun (no hands), pointing down its -Z; it's hung sideways along the wall
 * @param cfg       { width, height, gunScale, standOff } (config/weapons.js -> wallBuyDisplay)
 */
export function createWallBuyDisplay({ position, normal, name, gunModel, cfg }) {
  const group = new THREE.Group();
  group.position.copy(position);
  // Face out of the wall: the group's +Z points along the wall normal.
  group.lookAt(position.x + normal.x, position.y + normal.y, position.z + normal.z);

  // Chalk outline, flat on the wall (a hair in front so it doesn't flicker into the wall).
  const chalk = new THREE.Mesh(
    new THREE.PlaneGeometry(cfg.width, cfg.height),
    new THREE.MeshBasicMaterial({
      map: makeChalkTexture(name, { aspect: cfg.width / cfg.height }),
      transparent: true,
      depthWrite: false,
    }),
  );
  chalk.position.z = 0.005;
  group.add(chalk);

  // The gun on two pegs, lying along the wall with its side facing out, a little above center.
  const pegMaterial = new THREE.MeshStandardMaterial({ color: 0x6f757d, roughness: 0.5, metalness: 0.4 });
  for (const x of [-0.12, 0.12]) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, cfg.standOff, 6), pegMaterial);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(x, 0.02, cfg.standOff / 2);
    group.add(peg);
  }
  const gun = mergeByMaterial(gunModel); // (built at the origin, so merging bakes only its own parts' places)
  gun.rotation.y = Math.PI / 2; // muzzle points along the wall (to the left), left side faces out
  gun.scale.setScalar(cfg.gunScale);
  gun.position.set(0, 0.1, cfg.standOff);
  group.add(gun);

  return group;
}
