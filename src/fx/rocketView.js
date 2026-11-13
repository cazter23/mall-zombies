// =============================================================================
// ROCKET VIEW (browser side: draws what flies on g.rockets, the guns with `blast` + `flight`)
// Reads `rockets.list` (weapons/ballistics.js; the game runs without this) and draws each one by its gun's flight.look.model (config/weapons.js):
//   rocket   the Bottle Rocket Bazooka: a firework (striped body, yellow nose, a wooden stick trailing) pointed along its flight, puffing a few
//            sparks behind it every flight.trailSeconds of frame time (effects.confetti, flight.trail)
//   balloon  the Balloon Launcher: a party balloon (one of look.colors, by the balloon's id) with a knot and a dangling string, bobbing as it drifts
// Each is drawn between its last tick's position and this tick's (the render's `alpha`). One small pool of meshes per model, built as needed; a mesh
// is hidden when its flight is over (burst, pop, death, Play again).
// =============================================================================

import * as THREE from 'three';
import { weapons } from '../config/weapons.js';

const FORWARD = new THREE.Vector3(0, 0, -1);

export function createRocketView(scene, rockets, effects) {
  const materials = new Map(); // colour -> material (shared across the pool)
  const material = (color, extra = {}) => {
    const key = `${color}:${extra.emissive ?? ''}:${extra.roughness ?? ''}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, flatShading: true, ...extra }));
    return materials.get(key);
  };
  const geometries = {
    body: new THREE.CylinderGeometry(0.05, 0.05, 0.26, 10).rotateX(Math.PI / 2),
    stripe: new THREE.CylinderGeometry(0.052, 0.052, 0.04, 10).rotateX(Math.PI / 2),
    nose: new THREE.ConeGeometry(0.05, 0.1, 10).rotateX(-Math.PI / 2), // (the point to -Z: forward)
    stick: new THREE.BoxGeometry(0.012, 0.012, 0.4),
    balloon: new THREE.SphereGeometry(0.15, 12, 9).scale(1, 1.18, 1),
    knot: new THREE.ConeGeometry(0.025, 0.04, 6),
    string: new THREE.BoxGeometry(0.004, 0.4, 0.004),
  };
  const pools = { rocket: [], balloon: [] };
  const group = new THREE.Group();
  group.name = 'rockets';
  scene.add(group);
  const heading = new THREE.Vector3();
  const back = new THREE.Vector3();
  const look = new THREE.Vector3();
  let sinceTrail = 0;
  let time = 0;

  function makeRocket(flight) {
    const r = flight.look;
    const rocket = new THREE.Group();
    const part = (geometry, color, z, x = 0, extra) => {
      const m = new THREE.Mesh(geometries[geometry], material(color, extra));
      m.position.set(x, 0, z);
      rocket.add(m);
    };
    part('body', r.body, 0);
    part('stripe', r.stripe, -0.05);
    part('stripe', r.stripe, 0.07);
    part('nose', r.nose, -0.18, 0, { emissive: r.nose, emissiveIntensity: 0.3 });
    part('stick', r.stick, 0.3, 0.05);
    return rocket;
  }
  function makeBalloon(flight) {
    const balloon = new THREE.Group();
    const skin = new THREE.Mesh(geometries.balloon, material(flight.look.colors[0], { roughness: 0.35 }));
    skin.name = 'balloonSkin';
    const knot = new THREE.Mesh(geometries.knot, skin.material);
    knot.position.y = -0.19;
    const string = new THREE.Mesh(geometries.string, material(flight.look.string));
    string.position.y = -0.4;
    balloon.add(skin, knot, string);
    balloon.userData.skin = skin;
    balloon.userData.knot = knot;
    return balloon;
  }

  return {
    group,
    update(alpha = 1, frameTime = 0) {
      time += frameTime;
      sinceTrail += frameTime;
      const used = { rocket: 0, balloon: 0 };
      let puffed = false;
      for (const item of rockets.list) {
        const flight = weapons[item.weaponId]?.flight;
        if (!flight) continue;
        const model = flight.look.model ?? 'rocket';
        const pool = pools[model];
        if (!pool) continue;
        if (pool.length <= used[model]) {
          const mesh = model === 'balloon' ? makeBalloon(flight) : makeRocket(flight);
          group.add(mesh);
          pool.push(mesh);
        }
        const mesh = pool[used[model]++];
        mesh.visible = true;
        mesh.position.lerpVectors(item.previous, item.position, alpha);
        if (model === 'balloon') {
          const color = flight.look.colors[item.id % flight.look.colors.length];
          const skin = mesh.userData.skin;
          if (skin.material.color.getHex() !== color) skin.material = mesh.userData.knot.material = material(color, { roughness: 0.35 });
          mesh.rotation.set(Math.sin(time * 3 + item.id) * 0.15, item.id, Math.cos(time * 2.4 + item.id) * 0.15); // (a lazy bob)
          continue;
        }
        if (item.velocity.lengthSq() > 1e-6) {
          heading.copy(item.velocity).normalize();
          mesh.quaternion.setFromUnitVectors(FORWARD, heading);
        }
        if (flight.trail && effects && sinceTrail >= flight.trailSeconds) {
          puffed = true;
          effects.confetti(back.copy(mesh.position).addScaledVector(heading, -0.2), look.copy(heading).negate(), flight.trail);
        }
      }
      if (puffed) sinceTrail = 0;
      for (const [model, pool] of Object.entries(pools)) for (let i = used[model]; i < pool.length; i++) pool[i].visible = false;
    },
    dispose() {
      scene.remove(group);
      for (const g of Object.values(geometries)) g.dispose();
      for (const m of materials.values()) m.dispose();
    },
  };
}
