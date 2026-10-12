// =============================================================================
// ZOMBIE MANAGER
// Owns every zombie: spawning at the map's spawn markers, the shared flow-field
// navigation, handing out surround slots near the player, ticking each zombie,
// keeping zombies from overlapping each other or the player (never through
// walls), adding/removing them from the shootables list, and death effects.
// Waves (how many, how often) come in step 4; for now spawning is on demand.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { zombieTypes, zombieCrowd } from '../config/zombies.js';
import { zombieHealthForRound } from '../config/economy.js';
import { createNavigation } from './navigation.js';
import { overlapsSolid } from '../world/collision.js';
import { Zombie } from './zombie.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * @param scene        three.js scene to add zombie models to
 * @param colliders    shared world collider list (walls, props, shutter, ...)
 * @param player       PlayerController (the target)
 * @param shootables   shared list the gun shoots at; zombies are added/removed here
 * @param effects      fx (splatter, dust)
 * @param spawnPoints  map markers: [{ name, zone, position }]
 * @param isZoneOpen   (zoneId) => boolean; zombies only spawn in zones the player has opened
 * @param getRound     () => current round number (for health scaling)
 * @param canAttack    () => false once the player is dead
 * @param onPlayerHit  (damage, zombie) => apply a landed zombie hit to the player
 * @param onKill       optional (zombie) => called when a zombie dies (run stats, later points)
 */
export function createZombieManager({
  scene,
  colliders,
  player,
  shootables,
  effects,
  spawnPoints,
  isZoneOpen = () => true,
  getRound,
  canAttack,
  onPlayerHit,
  onKill = null,
}) {
  // Every zombie type shares one grid for now; sized for the shopper.
  const base = zombieTypes.shopper;
  const nav = createNavigation(colliders, { radius: base.radius, height: base.height });
  const zombies = [];
  const ctx = { nav, player, colliders, zombies, canAttack: true, onPlayerHit };
  const scratch = new THREE.Vector3();

  // Only spawn points in open zones; prefer ones the player can be reached from, not right on top of them.
  function pickSpawnPoint() {
    const open = spawnPoints.filter((s) => isZoneOpen(s.zone));
    const pool = open.length > 0 ? open : spawnPoints;
    const reachable = pool.filter((s) => nav.distanceToTarget(s.position.x, s.position.z) < Infinity);
    if (reachable.length === 0) return pool[Math.floor(Math.random() * pool.length)];
    const farEnough = reachable.filter(
      (s) => s.position.distanceTo(player.position) >= zombieCrowd.minSpawnDistance,
    );
    if (farEnough.length > 0) return farEnough[Math.floor(Math.random() * farEnough.length)];
    // Everything is close: use the farthest one.
    return reachable.reduce((a, b) =>
      a.position.distanceTo(player.position) > b.position.distanceTo(player.position) ? a : b,
    );
  }

  // Walk / jog / run, picked by chance from the round's row in type.gaitsByRound.
  function pickGaitSpeed(type, round) {
    if (!type.gaitsByRound) return type.speed;
    let row = type.gaitsByRound[0];
    for (const r of type.gaitsByRound) if (round >= r.fromRound) row = r;
    let roll = Math.random();
    for (const gait of Object.keys(type.gaits)) {
      const chance = row[gait] ?? 0;
      if (roll < chance) return type.gaits[gait];
      roll -= chance;
    }
    return type.speed;
  }

  function onZombieDeath(zombie) {
    // A final burst of splatter from the chest.
    scratch.copy(zombie.position);
    scratch.y += zombie.type.hitbox.bodyTop * 0.75;
    effects.splat(scratch, UP, zombie.type.splatColors, zombie.type.deathSplatCount);
    if (onKill) onKill(zombie);
  }

  const stepTol = feel.movement.stepTolerance;
  const trial = new THREE.Vector3();

  // Move `pos` by (mx, mz) only if that doesn't put the body inside a wall or prop.
  // Returns true if it moved. (A crowd must never shove anyone through a wall.)
  function shoveIfClear(pos, mx, mz, radius, height) {
    trial.set(pos.x + mx, pos.y, pos.z + mz);
    if (overlapsSolid(trial, radius, height, colliders, stepTol)) return false;
    pos.x = trial.x;
    pos.z = trial.z;
    return true;
  }

  // Push the player out of any zombie they're overlapping, so zombies are solid to walk into.
  // If the player is pinned against a wall, the zombie is pushed back instead.
  function keepPlayerOutOfZombies() {
    const p = player.position;
    for (const z of zombies) {
      if (!z.isAlive || z.state === 'spawning') continue;
      const verticalOverlap = p.y < z.position.y + z.type.height && p.y + player.height > z.position.y;
      if (!verticalOverlap) continue;
      let dx = p.x - z.position.x;
      let dz = p.z - z.position.z;
      let d = Math.hypot(dx, dz);
      const minD = z.type.radius + feel.player.radius;
      if (d >= minD) continue;
      if (d < 1e-4) {
        dx = 1; // exactly on top of each other: pick any direction
        dz = 0;
        d = 0;
      }
      const len = Math.hypot(dx, dz);
      const push = minD - d;
      const nx = dx / len;
      const nz = dz / len;
      if (!shoveIfClear(p, nx * push, nz * push, feel.player.radius, player.height)) {
        shoveIfClear(z.position, -nx * push, -nz * push, z.type.radius, z.type.height);
      }
    }
  }

  // Hard rule after moving: no two zombies overlap. Each gives way half (or all, if the other is
  // against a wall). Spacing steering keeps this rare; this catches what it can't (doorways, crowds).
  function resolveZombieOverlaps() {
    const minSpacing = zombieCrowd.minSpacing;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < zombies.length; i++) {
        const a = zombies[i];
        if (!a.isAlive || a.state === 'spawning') continue;
        for (let j = i + 1; j < zombies.length; j++) {
          const b = zombies[j];
          if (!b.isAlive || b.state === 'spawning') continue;
          let dx = b.position.x - a.position.x;
          let dz = b.position.z - a.position.z;
          let d = Math.hypot(dx, dz);
          if (d >= minSpacing) continue;
          if (d < 1e-4) {
            dx = Math.random() - 0.5;
            dz = Math.random() - 0.5;
            d = Math.hypot(dx, dz);
          }
          const nx = dx / d;
          const nz = dz / d;
          const overlap = minSpacing - Math.min(d, minSpacing);
          const half = overlap / 2;
          const aMoved = shoveIfClear(a.position, -nx * half, -nz * half, a.type.radius, a.type.height);
          const bMoved = shoveIfClear(b.position, nx * (aMoved ? half : overlap), nz * (aMoved ? half : overlap), b.type.radius, b.type.height);
          if (!bMoved && aMoved) shoveIfClear(a.position, -nx * half, -nz * half, a.type.radius, a.type.height);
        }
      }
    }
  }

  // --- Surround slots -------------------------------------------------------------
  // Rings of spots around the player (inner ring at arm's length). Zombies near the player
  // (with a clear line to them) each claim one, so a crowd fans out around you instead of
  // queueing behind each other. A zombie keeps its slot while it stays free and valid.
  const slotPoint = { x: 0, z: 0 };
  function assignSurroundSlots() {
    const crowd = zombieCrowd;
    const p = player.position;
    const contact = base.radius + feel.player.radius + crowd.contactGap;

    // Build this tick's valid slots (walkable, and no wall between the player and the slot).
    const slots = new Map(); // key -> { x, z, ring }
    for (let ring = 0; ring < crowd.surroundRings; ring++) {
      const radius = contact + ring * crowd.surroundRingSpacing;
      const count = Math.max(1, Math.floor((2 * Math.PI * radius) / crowd.surroundSlotSpacing));
      const stagger = (ring % 2) * (Math.PI / count); // rings offset so outer zombies stand in the gaps
      for (let k = 0; k < count; k++) {
        const angle = stagger + (k * 2 * Math.PI) / count;
        slotPoint.x = p.x + Math.cos(angle) * radius;
        slotPoint.z = p.z + Math.sin(angle) * radius;
        if (!nav.isWalkableAt(slotPoint.x, slotPoint.z)) continue;
        if (!nav.clearLine(p.x, p.z, slotPoint.x, slotPoint.z)) continue;
        slots.set(ring * 1000 + k, { x: slotPoint.x, z: slotPoint.z, ring });
      }
    }

    // Who's close enough to take a slot? Nearest first, so the front of the crowd gets the inner ring.
    const candidates = [];
    for (const z of zombies) {
      z.slot = null;
      if (!z.isAlive || z.state === 'spawning') continue;
      const d = z.distanceTo(player);
      if (d > crowd.surroundRadius) continue;
      if (!nav.clearLine(z.position.x, z.position.z, p.x, p.z)) continue;
      candidates.push({ z, d });
    }
    candidates.sort((a, b) => a.d - b.d);

    const taken = new Set();
    // Innermost ring that still has a free slot (inner rings fill first, so zombies close in).
    const innermostFreeRing = () => {
      let ring = Infinity;
      for (const [k, s] of slots) if (!taken.has(k) && s.ring < ring) ring = s.ring;
      return ring;
    };
    for (const { z } of candidates) {
      const freeRing = innermostFreeRing();
      if (freeRing === Infinity) {
        z.slotKey = null;
        continue; // all slots taken: just follow the route with spacing
      }
      // Keep my slot if it's still there, nobody nearer took it, and there's no free spot further in.
      const prev = z.slotKey !== null ? slots.get(z.slotKey) : null;
      let key = prev && !taken.has(z.slotKey) && prev.ring <= freeRing ? z.slotKey : null;
      if (key === null) {
        // Otherwise the free slot on the innermost free ring that's closest to me.
        let best = Infinity;
        for (const [k, s] of slots) {
          if (taken.has(k) || s.ring !== freeRing) continue;
          const d = Math.hypot(s.x - z.position.x, s.z - z.position.z);
          if (d < best) {
            best = d;
            key = k;
          }
        }
      }
      if (key === null) {
        z.slotKey = null;
        continue; // all slots taken: just follow the route with spacing
      }
      taken.add(key);
      const s = slots.get(key);
      z.slot = { x: s.x, z: s.z };
      z.slotKey = key;
    }
    for (const z of zombies) if (!z.slot) z.slotKey = null;
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
      const round = getRound();
      const speed = pickGaitSpeed(type, round);
      const zombie = new Zombie({ type, health: zombieHealthForRound(round), position, yaw, speed, round });
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
      ctx.canAttack = canAttack();
      assignSurroundSlots();
      for (const z of zombies) z.update(dt, ctx);
      resolveZombieOverlaps();
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
