// =============================================================================
// ZOMBIE MANAGER
// Owns every zombie: spawning at the map's spawn markers, the shared flow-field
// navigation, ticking each zombie, keeping the player from walking through
// them, adding/removing them from the shootables list, and death effects.
// Waves (how many, how often) come in step 4; for now spawning is on demand.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { zombieTypes, zombieCrowd } from '../config/zombies.js';
import { zombieHealthForRound } from '../config/economy.js';
import { createNavigation } from './navigation.js';
import { Zombie } from './zombie.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * @param scene        three.js scene to add zombie models to
 * @param colliders    shared world collider list (walls, props, shutter, ...)
 * @param player       PlayerController (the target)
 * @param shootables   shared list the gun shoots at; zombies are added/removed here
 * @param effects      fx (splatter, dust)
 * @param spawnPoints  map markers: [{ name, zone, position }]
 * @param getRound     () => current round number (for health scaling)
 */
export function createZombieManager({ scene, colliders, player, shootables, effects, spawnPoints, getRound }) {
  // Every zombie type shares one grid for now; sized for the shopper.
  const base = zombieTypes.shopper;
  const nav = createNavigation(colliders, { radius: base.radius, height: base.height });
  const zombies = [];
  const ctx = { nav, player, colliders, zombies };
  const scratch = new THREE.Vector3();

  // Prefer spawn points the player can be reached from, not right on top of them.
  function pickSpawnPoint() {
    const reachable = spawnPoints.filter((s) => nav.distanceToTarget(s.position.x, s.position.z) < Infinity);
    if (reachable.length === 0) return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
    const farEnough = reachable.filter(
      (s) => s.position.distanceTo(player.position) >= zombieCrowd.minSpawnDistance,
    );
    if (farEnough.length > 0) return farEnough[Math.floor(Math.random() * farEnough.length)];
    // Everything is close: use the farthest one.
    return reachable.reduce((a, b) =>
      a.position.distanceTo(player.position) > b.position.distanceTo(player.position) ? a : b,
    );
  }

  function onZombieDeath(zombie) {
    // A final burst of splatter from the chest.
    scratch.copy(zombie.position);
    scratch.y += zombie.type.hitbox.bodyTop * 0.75;
    effects.splat(scratch, UP, zombie.type.splatColors, zombie.type.deathSplatCount);
  }

  // Push the player out of any zombie they're overlapping, so zombies are solid to walk into.
  function keepPlayerOutOfZombies() {
    const p = player.position;
    for (const z of zombies) {
      if (!z.isAlive || z.state === 'spawning') continue;
      const verticalOverlap = p.y < z.position.y + z.type.height && p.y + player.height > z.position.y;
      if (!verticalOverlap) continue;
      const dx = p.x - z.position.x;
      const dz = p.z - z.position.z;
      const d = Math.hypot(dx, dz);
      const minD = z.type.radius + feel.player.radius;
      if (d >= minD) continue;
      if (d < 1e-4) {
        p.x += minD; // exactly on top of each other: pick any direction
      } else {
        p.x += (dx / d) * (minD - d);
        p.z += (dz / d) * (minD - d);
      }
    }
  }

  return {
    zombies,
    nav,

    get aliveCount() {
      return zombies.reduce((n, z) => n + (z.isAlive ? 1 : 0), 0);
    },

    // Spawn one zombie of `typeId` at a good spawn point (or at `at`, a Vector3, if given).
    spawn(typeId = 'shopper', at = null) {
      const type = zombieTypes[typeId];
      const position = at ? at.clone() : pickSpawnPoint().position.clone();
      position.y = 0;
      const yaw = Math.atan2(-(player.position.x - position.x), -(player.position.z - position.z));
      const zombie = new Zombie({ type, health: zombieHealthForRound(getRound()), position, yaw });
      zombie.onDeath = onZombieDeath;
      scene.add(zombie.model.root);
      zombies.push(zombie);
      shootables.push(zombie);
      // Floor-tile dust as it breaks through.
      scratch.copy(position);
      scratch.y += 0.05;
      effects.splat(scratch, UP, zombieCrowd.spawnDustColors, zombieCrowd.spawnDustCount);
      return zombie;
    },

    // Remove every zombie immediately (debug).
    clear() {
      for (const z of zombies) {
        z.model.dispose();
        const i = shootables.indexOf(z);
        if (i !== -1) shootables.splice(i, 1);
      }
      zombies.length = 0;
    },

    // Fixed-tick update.
    update(dt) {
      nav.update(dt, player.position);
      for (const z of zombies) z.update(dt, ctx);
      keepPlayerOutOfZombies();

      // Clean up corpses that have finished sinking.
      for (let i = zombies.length - 1; i >= 0; i--) {
        const z = zombies[i];
        if (!z.removed) continue;
        z.model.dispose();
        zombies.splice(i, 1);
        const s = shootables.indexOf(z);
        if (s !== -1) shootables.splice(s, 1);
      }
    },

    // Every rendered frame: animate and interpolate the models.
    render(frameTime, alpha) {
      for (const z of zombies) z.model.update(frameTime, z, alpha);
    },
  };
}
