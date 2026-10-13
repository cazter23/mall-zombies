// =============================================================================
// WALL BUY DISPLAY
// What a wall buy looks like (COD-style): a chalk outline on the wall with the
// weapon's name, and the gun itself hanging on two pegs in front of it, side on,
// so you can see what you're buying. Visual only: the buying is done by the
// interaction system (game/interactions.js), set up in main.js.
// =============================================================================

import * as THREE from 'three';
import { makeChalkTexture } from './textures.js';

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
  gunModel.rotation.y = Math.PI / 2; // muzzle points along the wall (to the left), left side faces out
  gunModel.scale.setScalar(cfg.gunScale);
  gunModel.position.set(0, 0.1, cfg.standOff);
  group.add(gunModel);

  return group;
}
