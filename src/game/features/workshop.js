import * as THREE from 'three';
import { workshopBuilds, workshopModOf } from '../../config/workshop.js';
import { castShot } from '../../weapons/hitscan.js';
import { createClearanceRack } from './clearanceRack.js';
import { createWorkshopRitual } from './workshopRitual.js';

export function buildWorkshop(bench, { map, gun, pricing, interactions, events, player, scene, zombies, colliders, effects, sound }) {
  const builds = Object.entries(workshopBuilds);
  const currentBuild = () => builds.find(([, build]) => build.weapon === gun.def.id);
  interactions.add({
    get label() { const [, build] = currentBuild(); return build.name + ' installed. ' + build.instructions; },
    get title() { return currentBuild()[1].name; },
    get detail() { return currentBuild()[1].instructions; },
    get id() { return currentBuild()[0]; },
    get cost() { return pricing.priceOf('workshop', this.id); },
    verb: 'install',
    kind: 'workshop',
    position: bench.limitedEdition, // the display case: the bench itself takes guns for the ritual
    available() {
      const match = currentBuild();
      return map.zones[bench.zone].open && !!match && !gun.isSwitching &&
        !gun.weapon.isReloading && workshopModOf(gun.modsFor(gun.def.id)) !== match[0];
    },
    use() {
      const id = gun.def.id;
      const mods = gun.modsFor(id).filter(m => m.id !== 'workshop');
      gun.setMods(id, [...mods, { id: 'workshop', workshop: this.id }]);
    },
  });

  const ritual = createWorkshopRitual({ bench, map, gun, pricing, interactions, events, player, zombies, scene });
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
      effects.confetti(position, up, { ...trap.pop, count: 24, speed: 3.4 });
      if (player.position.distanceTo(position) <= trap.placementRange * 2) sound?.play('confettiShot');
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
    update(dt) {
      clearance.update();
      updateTraps(dt);
      ritual.update(dt);
    },
    reset() {
      while (traps.length) removeTrap(traps.length - 1);
      clearance.reset();
      ritual.reset();
    },
  };
}
