// =============================================================================
// MELT TRAIL: Scoops' twist (config/zombies.js mascotVariants.scoops.melt; built and ticked by game/mascotCostumes.js).
// Every Scoops drops a melt puddle every dropEvery seconds where it walks (exposedDropEvery once its cone is off), never
// two on the same spot while it stands still. A player standing in one moves at slowFactor, through game/surfaceSlows.js
// (so the Janitor's wet floor and the melt never stack: the lowest wins). Zombies don't care.
// The puddles are one fixed pool of flat discs shared by every Scoops (maxPuddles; the oldest gives way), each with its
// own material so it can fade out on its own: a drop allocates nothing. clear() empties it (round end, death, Play again).
// =============================================================================

import * as THREE from 'three';
import { mascotTypes } from '../config/zombies.js';

export function createMeltTrail({ scene, zombies, player, colliders, surfaces, config = mascotTypes.scoops.mascot.melt }) {
  const geometry = new THREE.CircleGeometry(1, config.segments).rotateX(-Math.PI / 2);
  const puddles = Array.from({ length: config.maxPuddles }, () => {
    const material = new THREE.MeshBasicMaterial({ color: config.colors[0], transparent: true, opacity: config.opacity, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'meltPuddle';
    mesh.visible = false;
    scene.add(mesh); // (in the scene, not the map's group: the static batcher never sees it)
    return { mesh, material, remaining: 0, floor: 0 };
  });
  const timers = new Map(); // a Scoops -> { left: seconds to its next drop, x, z: where it dropped the last one }
  let drops = 0; // (colours take turns)

  // The top of the floor under (x, z) at about this height, or null (on a ramp or an escalator: no puddle there).
  function floorUnder(x, y, z) {
    let best = null;
    for (const box of colliders) {
      if (x < box.min.x || x > box.max.x || z < box.min.z || z > box.max.z) continue;
      if (Math.abs(box.max.y - y) <= config.floorTolerance && (best === null || box.max.y > best)) best = box.max.y;
    }
    return best;
  }

  function drop(x, y, z) {
    const floor = floorUnder(x, y, z);
    if (floor === null) return false;
    let puddle = puddles[0];
    for (const p of puddles) if (p.remaining < puddle.remaining) puddle = p; // a free one, else the oldest gives way
    puddle.remaining = config.lifeSeconds;
    puddle.floor = floor;
    puddle.mesh.position.set(x, floor + config.lift, z);
    puddle.mesh.scale.setScalar(config.radius);
    puddle.material.color.setHex(config.colors[drops % config.colors.length]);
    puddle.material.opacity = config.opacity;
    puddle.mesh.visible = true;
    drops += 1;
    return true;
  }

  function clear() {
    for (const puddle of puddles) {
      puddle.remaining = 0;
      puddle.mesh.visible = false;
    }
    timers.clear();
    drops = 0;
    surfaces.clear('melt');
  }

  return {
    get puddles() { return puddles; },
    get active() { return puddles.filter((p) => p.remaining > 0); }, // (tests, debugging)

    update(dt) {
      for (const puddle of puddles) {
        if (puddle.remaining <= 0) continue;
        puddle.remaining -= dt;
        if (puddle.remaining <= 0) {
          puddle.mesh.visible = false;
          continue;
        }
        puddle.material.opacity = config.opacity * Math.min(1, puddle.remaining / config.fadeSeconds);
      }

      for (const zombie of zombies.zombies) {
        const melt = zombie.type.mascot?.melt;
        if (!melt) continue;
        if (!zombie.isAlive || zombie.state === 'spawning') {
          timers.delete(zombie);
          continue;
        }
        let timer = timers.get(zombie);
        if (!timer) timers.set(zombie, (timer = { left: melt.dropEvery, x: Infinity, z: Infinity }));
        timer.left -= dt;
        if (timer.left > 0) continue;
        timer.left += zombie.mascotHeadOff ? melt.exposedDropEvery : melt.dropEvery;
        const { x, y, z } = zombie.position;
        if (Math.hypot(x - timer.x, z - timer.z) < melt.minSpacing) continue; // (standing still: no stack of puddles)
        if (drop(x, y, z)) {
          timer.x = x;
          timer.z = z;
        }
      }

      // The player, feet on the floor, in any puddle: slowed.
      let factor = 1;
      if (player.grounded) {
        const p = player.position;
        for (const puddle of puddles) {
          if (puddle.remaining <= 0 || Math.abs(p.y - puddle.floor) > config.floorTolerance) continue;
          const { x, z } = puddle.mesh.position;
          if (Math.hypot(p.x - x, p.z - z) <= config.radius) {
            factor = config.slowFactor;
            break;
          }
        }
      }
      surfaces.set('melt', factor);
    },

    clear,
    reset: clear,

    dispose() {
      clear();
      for (const { mesh, material } of puddles) {
        mesh.removeFromParent();
        material.dispose();
      }
      geometry.dispose();
    },
  };
}
