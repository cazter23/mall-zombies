import * as THREE from 'three';
import { overlapsSolid } from '../../world/collision.js';

// Murray follows the normal chase and attack loop. His job adds a trail of
// temporary world hazards, kept separate from the navigation and collision grid.
export function createJanitorBehavior({ zombie, scene, colliders, player, powerUps, onPhase }) {
  const cfg = zombie.type.wetFloor;
  const group = new THREE.Group();
  group.name = 'janitorWetFloor';
  const fill = new THREE.CircleGeometry(cfg.radius, cfg.segments);
  const rim = new THREE.RingGeometry(cfg.radius - cfg.rimWidth, cfg.radius, cfg.segments);
  const material = new THREE.MeshBasicMaterial({ color: cfg.color, opacity: cfg.opacity, transparent: true, depthWrite: false });
  const edge = new THREE.MeshBasicMaterial({ color: cfg.rim, opacity: cfg.rimOpacity, transparent: true, depthWrite: false });
  scene.add(group);

  const patches = [];
  const feet = new THREE.Vector3();
  let last = null;

  function leavePatch() {
    const { x, y, z } = zombie.position;
    if (last && last.distanceToSquared(zombie.position) < cfg.spacing ** 2) return;
    // Keep a puddle wholly on its floor. On stairs, beside furniture or
    // against a balcony edge, Murray waits for the next clear stretch.
    const floor = colliders.find((box) => Math.abs(box.max.y - y) <= cfg.floorTolerance &&
      x - cfg.radius >= box.min.x && x + cfg.radius <= box.max.x &&
      z - cfg.radius >= box.min.z && z + cfg.radius <= box.max.z);
    if (!floor) return;
    feet.set(x, floor.max.y, z);
    if (overlapsSolid(feet, cfg.radius, cfg.clearanceHeight, colliders, 0)) return;

    const mesh = new THREE.Mesh(fill, material);
    mesh.name = 'janitorPuddle';
    mesh.add(new THREE.Mesh(rim, edge));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(feet).y += cfg.surfaceOffset;
    if (patches.length >= cfg.maxPatches) patches.shift().mesh.removeFromParent();
    group.add(mesh);
    patches.push({ position: feet.clone(), mesh, remaining: cfg.seconds });
    if (!last) onPhase('wetFloor');
    last = zombie.position.clone();
  }

  return {
    get patches() { return patches; },
    update(dt) {
      for (let i = patches.length - 1; i >= 0; i--) {
        const patch = patches[i];
        patch.remaining -= dt;
        if (patch.remaining > 0) continue;
        patch.mesh.removeFromParent();
        patches.splice(i, 1);
      }
      if (zombie.state !== 'spawning') {
        powerUps.cleanSpill(zombie.position);
        leavePatch();
      }
      const { x, y, z } = player.position;
      const wet = player.grounded && patches.some(({ position }) => Math.abs(y - position.y) <= cfg.floorTolerance
        && Math.hypot(x - position.x, z - position.z) <= cfg.radius);
      return wet ? cfg.speedFraction : 1;
    },
    dispose() {
      group.removeFromParent();
      group.clear();
      patches.length = 0;
      fill.dispose();
      rim.dispose();
      material.dispose();
      edge.dispose();
    },
  };
}
