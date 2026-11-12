// =============================================================================
// ROCKET VIEW (browser side: draws the Bottle Rocket Bazooka's rockets)
// Reads `rockets.list` (weapons/ballistics.js, g.rockets; the game runs without this) and shows each rocket as a firework: a striped body, a yellow
// cone nose and a wooden stick trailing behind, pointed along its flight, between its last tick's position and this tick's (the render's `alpha`).
// It also puffs a few sparks behind each rocket every trailSeconds of frame time (effects.confetti). One small pool of meshes, built once; a mesh is
// hidden when its rocket is gone (burst, death, Play again). The look is config/weapons.js bottleRocket.rocket.
// =============================================================================

import * as THREE from 'three';
import { weapons } from '../config/weapons.js';

const FORWARD = new THREE.Vector3(0, 0, -1);

export function createRocketView(scene, rockets, effects) {
  const r = weapons.bottleRocket.rocket;
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: r.look.body, roughness: 0.7, flatShading: true }),
    stripe: new THREE.MeshStandardMaterial({ color: r.look.stripe, roughness: 0.7, flatShading: true }),
    nose: new THREE.MeshStandardMaterial({ color: r.look.nose, roughness: 0.5, emissive: r.look.nose, emissiveIntensity: 0.3, flatShading: true }),
    stick: new THREE.MeshStandardMaterial({ color: r.look.stick, roughness: 0.9, flatShading: true }),
  };
  const geometries = {
    body: new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10).rotateX(Math.PI / 2),
    stripe: new THREE.CylinderGeometry(0.052, 0.052, 0.04, 10).rotateX(Math.PI / 2),
    nose: new THREE.ConeGeometry(0.05, 0.1, 10).rotateX(-Math.PI / 2), // (the point to -Z: forward)
    stick: new THREE.BoxGeometry(0.012, 0.012, 0.4),
  };
  const pool = [];
  const group = new THREE.Group();
  group.name = 'rockets';
  scene.add(group);
  const look = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const back = new THREE.Vector3();
  let sinceTrail = 0;

  function make() {
    const rocket = new THREE.Group();
    const mesh = (part, z, x = 0) => {
      const m = new THREE.Mesh(geometries[part], materials[part]);
      m.position.set(x, 0, z);
      rocket.add(m);
    };
    mesh('body', 0);
    mesh('stripe', -0.05);
    mesh('stripe', 0.07);
    mesh('nose', -0.18);
    mesh('stick', 0.3, 0.05);
    rocket.visible = false;
    group.add(rocket);
    return rocket;
  }

  return {
    group,
    update(alpha = 1, frameTime = 0) {
      const live = rockets.list;
      while (pool.length < live.length) pool.push(make());
      sinceTrail += frameTime;
      const puff = sinceTrail >= r.trailSeconds;
      if (puff) sinceTrail = 0;
      for (let i = 0; i < pool.length; i++) {
        const mesh = pool[i];
        const rocket = live[i];
        mesh.visible = !!rocket;
        if (!rocket) continue;
        mesh.position.lerpVectors(rocket.previous, rocket.position, alpha);
        if (rocket.velocity.lengthSq() > 1e-6) {
          heading.copy(rocket.velocity).normalize();
          mesh.quaternion.setFromUnitVectors(FORWARD, heading);
        }
        if (puff && effects) effects.confetti(back.copy(mesh.position).addScaledVector(heading, -0.2), look.copy(heading).negate(), r.trail);
      }
    },
    dispose() {
      scene.remove(group);
      for (const g of Object.values(geometries)) g.dispose();
      for (const m of Object.values(materials)) m.dispose();
    },
  };
}
