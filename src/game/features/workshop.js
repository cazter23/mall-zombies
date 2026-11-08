import * as THREE from 'three';
import { workshopBuilds } from '../../config/workshop.js';
import { castShot } from '../../weapons/hitscan.js';
import { createClearanceRack } from './clearanceRack.js';
import { createWorkshopRitual } from './workshopRitual.js';
import { createBuildEffects } from './workshopStuffings.js';
import { createWorkshopSpectacle } from './workshopSpectacle.js';
import { createLimitedEditionDrops } from './limitedEditions.js';

export function buildWorkshop(bench, { map, gun, pricing, interactions, events, player, scene, zombies, rounds, colliders, effects, sound, stats, state, input, wallet }) {
  const ritual = createWorkshopRitual({ bench, map, gun, pricing, interactions, events, player, zombies, rounds, scene, state, input, wallet, sound });
  const buildEffects = createBuildEffects({ events, gun, player, zombies, colliders, effects, stats, state, sound, scene });
  const spectacle = createWorkshopSpectacle({ bench, ritual, events, zombies, player, sound });
  const drops = createLimitedEditionDrops({ events, gun, player, scene, rounds, state, sound });
  const trap = workshopBuilds.partyTrap;
  const clearance = createClearanceRack({ gun, zombies, effects, sound });
  events.on('shot', ({ clearanceHit }) => { if (clearanceHit) clearance.hit(clearanceHit); });
  const traps = [];
  const up = new THREE.Vector3(0, 1, 0);
  const from = new THREE.Vector3(), direction = new THREE.Vector3();

  function removeTrap(index) {
    const [{ mesh }] = traps.splice(index, 1);
    mesh.removeFromParent();
    mesh.geometry.dispose();
    mesh.material.dispose();
  }

  events.on('shot', ({ workshopPlacement: position }) => {
    if (!position) return;
    if (traps.length >= trap.maxActive) removeTrap(0);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(.15, .19, .065, 8),
      new THREE.MeshStandardMaterial({ color: trap.color, emissive: trap.color, emissiveIntensity: .2 }));
    mesh.name = 'partyTrap';
    mesh.position.copy(position).addScaledVector(up, .05);
    scene.add(mesh);
    traps.push({ position: position.clone(), mesh, age: 0 });
  });

  function nearby(zombie, position, radius) {
    if (!zombie.isAlive || zombie.state === 'spawning') return false;
    const { x, y, z } = zombie.position;
    return Math.abs(y - position.y) <= trap.footTolerance && Math.hypot(x - position.x, z - position.z) <= radius;
  }

  function clearPath(zombie, position) {
    from.copy(position).addScaledVector(up, trap.blastHeight);
    direction.subVectors(zombie.position, position);
    const distance = direction.length();
    return distance === 0 || !castShot(from, direction.normalize(), distance, colliders, []).worldHit;
  }

  function updateTraps(dt) {
    for (let i = traps.length - 1; i >= 0; i--) {
      const charge = traps[i];
      charge.age += dt;
      if (charge.age >= trap.lifetimeSeconds) { removeTrap(i); continue; }
      if (charge.age < trap.armSeconds) continue;
      charge.mesh.material.emissiveIntensity = .85;
      const { position } = charge;
      if (!zombies.zombies.some(z => nearby(z, position, trap.triggerRadius) && clearPath(z, position))) continue;
      removeTrap(i);
      effects.confetti(position, up, { ...trap.pop, ...trap.blastPop });
      if (player.position.distanceTo(position) <= trap.soundRange) sound?.play('confettiShot');
      const targets = zombies.zombies.filter(z => nearby(z, position, trap.blastRadius) && clearPath(z, position));
      targets.sort((a, b) => a.position.distanceToSquared(position) - b.position.distanceToSquared(position));
      for (const target of targets.slice(0, trap.maxTargets)) {
        const { killed } = target.takeHit({ damage: trap.damage, part: 'body', source: 'partyTrap' });
        if (killed) zombies.playPartyTrapDeath(target, position);
      }
    }
  }

  return {
    ritual,
    drops,
    update(dt) {
      clearance.update();
      updateTraps(dt);
      ritual.update(dt);
      buildEffects.update(dt);
      spectacle.update(dt);
      drops.update(dt);
    },
    reset() {
      while (traps.length) removeTrap(traps.length - 1);
      clearance.reset();
      ritual.reset();
      buildEffects.reset();
      spectacle.reset();
      drops.reset();
    },
  };
}
