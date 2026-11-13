// =============================================================================
// SALT TRAIL: the short-lived coarse salt patches Twisty drops when his helmet
// pops (config/zombies.js mascotVariants.twisty.saltPatch). One shared pool in
// the scene, flat floors only, and a sound cue when the player or any bare-headed
// Twisty walks across: never deals damage and never slows the player.
// =============================================================================

import * as THREE from 'three';
import { mascotVariants } from '../config/zombies.js';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function buildPatchGroup(config, dustGeometry, crystalGeometry) {
  const group = new THREE.Group();
  group.name = 'saltPatch';
  group.visible = false;

  const dustMaterial = new THREE.MeshBasicMaterial({
    color: config.dustColor,
    transparent: true,
    opacity: config.dustOpacity,
    depthWrite: false,
  });
  const dust = new THREE.Mesh(dustGeometry, dustMaterial);
  dust.scale.setScalar(config.radius);
  group.add(dust);

  const materials = config.crystalColors.map((hex) => new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity: config.opacity,
    depthWrite: false,
  }));

  const count = config.crystalCount;
  const maxR = config.radius * config.crystalSpread;
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) : 0;
    const angle = i * GOLDEN_ANGLE;
    const dist = maxR * Math.sqrt((i + 0.5) / count);
    const width = config.crystalSizeMin + (config.crystalSizeMax - config.crystalSizeMin) * ((i % 3) / 2);
    const depth = config.crystalSizeMin + (config.crystalSizeMax - config.crystalSizeMin) * (((i + 1) % 3) / 2);
    const height = config.crystalHeightMin + (config.crystalHeightMax - config.crystalHeightMin) * (1 - t);
    const mesh = new THREE.Mesh(crystalGeometry, materials[i % materials.length]);
    mesh.position.set(Math.cos(angle) * dist, height / 2, Math.sin(angle) * dist);
    mesh.rotation.y = angle;
    mesh.scale.set(width, height, depth);
    group.add(mesh);
  }

  return { group, dustMaterial, materials };
}

const makeWalker = () => ({ hasPos: false, lastX: 0, lastZ: 0, stepAccum: 0, wasInside: false });

/** Pooled floor salt patches with underfoot & bare-headed Twisty crunch audio (no damage, no slow). */
export function createSaltTrail({ scene, zombies = null, player, colliders, sound, config = mascotVariants.twisty.saltPatch }) {
  const dustGeometry = new THREE.CircleGeometry(1, config.dustSegments).rotateX(-Math.PI / 2);
  const crystalGeometry = new THREE.BoxGeometry(1, 1, 1);

  const patches = Array.from({ length: config.maxPatches }, () => {
    const { group, dustMaterial, materials } = buildPatchGroup(config, dustGeometry, crystalGeometry);
    scene.add(group);
    return { group, dustMaterial, materials, remaining: 0, floor: 0, x: 0, z: 0 };
  });

  let drops = 0;
  const playerWalker = makeWalker();
  const zombieWalkers = new Map();

  // Flat floor under (x, z) near height y, or null on ramps/escalators.
  function floorUnder(x, y, z) {
    let best = null;
    for (const box of colliders) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (Math.abs(box.max.y - y) <= config.floorTolerance && (best === null || box.max.y > best)) best = box.max.y;
    }
    return best;
  }

  function dropAt(x, y, z) {
    const floor = floorUnder(x, y, z);
    if (floor === null) return false;
    let patch = patches[0];
    for (const p of patches) if (p.remaining < patch.remaining) patch = p;
    patch.remaining = config.lifeSeconds;
    patch.floor = floor;
    patch.x = x;
    patch.z = z;
    patch.group.position.set(x, floor + config.lift, z);
    patch.group.rotation.y = drops * GOLDEN_ANGLE;
    patch.dustMaterial.opacity = config.dustOpacity;
    for (const m of patch.materials) m.opacity = config.opacity;
    patch.group.visible = true;
    drops += 1;
    return true;
  }

  function clear() {
    for (const patch of patches) {
      patch.remaining = 0;
      patch.group.visible = false;
    }
    drops = 0;
    playerWalker.hasPos = false;
    playerWalker.stepAccum = 0;
    playerWalker.wasInside = false;
    zombieWalkers.clear();
  }

  function isInsidePatch(pos) {
    const r2 = config.radius * config.radius;
    for (const patch of patches) {
      if (patch.remaining <= 0) continue;
      if (Math.abs(pos.y - patch.floor) > config.floorTolerance) continue;
      const dx = pos.x - patch.x;
      const dz = pos.z - patch.z;
      if (dx * dx + dz * dz <= r2) return true;
    }
    return false;
  }

  function stepThroughSalt(walker, pos, grounded, dt, stepMeters, entryStepMeters, onCrunch) {
    const dx = walker.hasPos ? pos.x - walker.lastX : 0;
    const dz = walker.hasPos ? pos.z - walker.lastZ : 0;
    walker.lastX = pos.x;
    walker.lastZ = pos.z;
    walker.hasPos = true;

    if (!grounded || !isInsidePatch(pos)) {
      walker.wasInside = false;
      walker.stepAccum = 0;
      return;
    }

    if (!walker.wasInside) {
      walker.wasInside = true;
      walker.stepAccum = Math.max(0, stepMeters - entryStepMeters);
    }

    const dist = Math.hypot(dx, dz);
    const speed = dt > 0 ? dist / dt : 0;
    if (speed < config.minSpeed || speed > config.maxStepSpeed) return;

    walker.stepAccum += dist;
    if (walker.stepAccum >= stepMeters) {
      walker.stepAccum -= stepMeters;
      if (walker.stepAccum > stepMeters) walker.stepAccum = 0;
      onCrunch();
    }
  }

  return {
    get patches() { return patches; },
    get active() { return patches.filter((p) => p.remaining > 0); },
    dropAt,
    clear,
    reset() {
      clear();
    },
    update(dt) {
      for (const patch of patches) {
        if (patch.remaining <= 0) continue;
        patch.remaining -= dt;
        if (patch.remaining <= 0) {
          patch.remaining = 0;
          patch.group.visible = false;
          continue;
        }
        const fade = patch.remaining < config.fadeSeconds ? patch.remaining / config.fadeSeconds : 1;
        patch.dustMaterial.opacity = config.dustOpacity * fade;
        for (const m of patch.materials) m.opacity = config.opacity * fade;
      }

      stepThroughSalt(playerWalker, player.position, player.grounded, dt, config.stepMeters, config.entryStepMeters, () => {
        sound?.play(config.sound, { volume: config.volume });
      });

      if (!zombies) return;
      const list = zombies.zombies;
      for (const tracked of zombieWalkers.keys()) {
        if (!tracked.isAlive || tracked.state === 'spawning' || !tracked.mascotHeadOff || !list.includes(tracked)) {
          zombieWalkers.delete(tracked);
        }
      }
      for (const zombie of list) {
        if (!zombie.type.mascot?.saltPatch || !zombie.isAlive || zombie.state === 'spawning' || !zombie.mascotHeadOff) continue;
        let walker = zombieWalkers.get(zombie);
        if (!walker) zombieWalkers.set(zombie, (walker = makeWalker()));
        stepThroughSalt(walker, zombie.position, true, dt, config.zombieStepMeters, config.zombieEntryStepMeters, () => {
          // Match Zombie.playSound / distanceTo (src/zombies/zombie.js:822-826, 1019-1021).
          const distToPlayer = Math.hypot(player.position.x - zombie.position.x, player.position.z - zombie.position.z);
          const volume = 1 - distToPlayer / config.maxDistance;
          if (volume > 0) sound?.play(config.sound, { volume });
        });
      }
    },
    dispose() {
      clear();
      for (const patch of patches) {
        scene.remove(patch.group);
        patch.dustMaterial.dispose();
        for (const m of patch.materials) m.dispose();
      }
      dustGeometry.dispose();
      crystalGeometry.dispose();
    },
  };
}
