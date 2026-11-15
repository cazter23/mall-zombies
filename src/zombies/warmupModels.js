// One model of every kind of zombie, for the shader warm-up (fx/shaderWarmup.js): a zombie's materials only exist once it
// spawns, so without this the first Shopper, Cart Pusher, Mannequin, Mascot or boss to walk into view froze the game while
// its shader was built. These are never in the game: no manager, no hitboxes in the shootables, nothing ticks them.
//
//   const { roots, dispose } = buildWarmupZombies()   roots: their model roots (add to the scene, draw once), then dispose()
import * as THREE from 'three';
import { Zombie } from './zombie.js';
import { zombieTypes, mascotTypes, mascotGoldTypes } from '../config/zombies.js';
import { bossTypes } from '../config/bosses.js';

/** Every type a zombie can be: the roster, each Mascot costume plain and gold, each boss. */
export function warmupTypes() {
  return [...new Set([...Object.values(zombieTypes), ...Object.values(mascotTypes), ...Object.values(mascotGoldTypes), ...Object.values(bossTypes)])];
}

export function buildWarmupZombies() {
  const below = new THREE.Vector3(0, -40, 0); // (under the mall: never seen, even for the one frame it is drawn in a pixel)
  const zombies = warmupTypes().map((type) => new Zombie({ type, health: 1, position: below, yaw: 0, lookSeed: 1 }));
  for (const z of zombies) z.model.root.visible = false; // (the warm-up shows each for its one draw: fx/shaderWarmup.js drawOnce)
  return {
    roots: zombies.map((z) => z.model.root),
    dispose() {
      for (const z of zombies) z.model.dispose();
      zombies.length = 0;
    },
  };
}
