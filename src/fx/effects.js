// =============================================================================
// EFFECTS
// Purely visual, short-lived stuff: staple tracers and cartoon particle bursts
// (Halo CE-style colored splatter, wall dust). Nothing here affects gameplay,
// so it updates per rendered frame for smoothness.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

const UP = new THREE.Vector3(0, 1, 0);
const TRACER_POOL = 8;

export function createEffects(scene) {
  const fx = feel.effects;

  // --- Tracers: thin stretched cylinders that fade out quickly -------------------

  const tracerGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const tracers = [];
  for (let i = 0; i < TRACER_POOL; i++) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
    const mesh = new THREE.Mesh(tracerGeometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0 });
  }
  let nextTracer = 0;
  const tracerDir = new THREE.Vector3();

  // --- Particles: one instanced mesh of little cubes ----------------------------

  const max = fx.maxParticles;
  const particles = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial(),
    max,
  );
  particles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  particles.frustumCulled = false;
  particles.count = 0;
  const white = new THREE.Color(1, 1, 1);
  for (let i = 0; i < max; i++) particles.setColorAt(i, white); // creates the color buffer
  scene.add(particles);

  // Per-particle state in flat arrays; live particles are packed at the front.
  const pos = new Float32Array(max * 3);
  const vel = new Float32Array(max * 3);
  const rot = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const size = new Float32Array(max);
  let alive = 0;

  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  const randomDir = new THREE.Vector3();

  function spawnParticle(point, velocity, hexColor, particleSize) {
    if (alive >= max) return; // pool full: skip (it's just decoration)
    const i = alive++;
    pos[i * 3] = point.x;
    pos[i * 3 + 1] = point.y;
    pos[i * 3 + 2] = point.z;
    vel[i * 3] = velocity.x;
    vel[i * 3 + 1] = velocity.y;
    vel[i * 3 + 2] = velocity.z;
    rot[i * 3] = Math.random() * Math.PI;
    rot[i * 3 + 1] = Math.random() * Math.PI;
    rot[i * 3 + 2] = Math.random() * Math.PI;
    color.setHex(hexColor);
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
    maxLife[i] = fx.particleLife * (0.6 + Math.random() * 0.4);
    life[i] = maxLife[i];
    size[i] = particleSize * (0.6 + Math.random() * 0.8);
  }

  // A burst flying mostly away from the surface (along `normal`), in random colors from `colors`.
  function burst(point, normal, colors, count, speed, particleSize) {
    const velocity = new THREE.Vector3();
    for (let n = 0; n < count; n++) {
      randomDir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      velocity
        .copy(normal)
        .multiplyScalar(speed * 0.6)
        .addScaledVector(randomDir, speed * (0.4 + Math.random() * 0.6));
      velocity.y += speed * 0.3; // a little pop upward reads as more cartoony
      spawnParticle(point, velocity, colors[n % colors.length], particleSize);
    }
  }

  return {
    // Staple streak from `from` (gun muzzle) to `to` (where the shot landed).
    tracer(from, to, hexColor) {
      const t = tracers[nextTracer];
      nextTracer = (nextTracer + 1) % TRACER_POOL;
      tracerDir.subVectors(to, from);
      const length = tracerDir.length();
      if (length < 0.01) return;
      t.mesh.position.copy(from).addScaledVector(tracerDir, 0.5);
      t.mesh.quaternion.setFromUnitVectors(UP, tracerDir.normalize());
      t.mesh.scale.set(fx.tracerWidth, length, fx.tracerWidth);
      t.mesh.material.color.setHex(hexColor);
      t.mesh.material.opacity = 1;
      t.mesh.visible = true;
      t.life = fx.tracerSeconds;
    },

    // Colored splatter when a shot hits something squishy.
    splat(point, normal, colors, count) {
      burst(point, normal, colors, count, fx.splatSpeed, fx.particleSize);
    },

    // Little dust puff when a shot hits a wall or prop.
    puff(point, normal) {
      burst(point, normal, [fx.puffColor], fx.puffCount, fx.puffSpeed, fx.particleSize * 0.7);
    },

    // Call every rendered frame with the real frame time (skip while paused).
    update(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.mesh.material.opacity = Math.max(0, t.life / fx.tracerSeconds);
        if (t.life <= 0) t.mesh.visible = false;
      }

      let i = 0;
      while (i < alive) {
        life[i] -= dt;
        if (life[i] <= 0) {
          // Swap the last live particle into this slot and shrink the live count.
          const last = --alive;
          for (const arr of [pos, vel, rot, col]) {
            arr[i * 3] = arr[last * 3];
            arr[i * 3 + 1] = arr[last * 3 + 1];
            arr[i * 3 + 2] = arr[last * 3 + 2];
          }
          life[i] = life[last];
          maxLife[i] = maxLife[last];
          size[i] = size[last];
          continue; // re-check slot i (it now holds a different particle)
        }

        vel[i * 3 + 1] -= fx.particleGravity * dt;
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        if (pos[i * 3 + 1] < 0) {
          // Land on the ground floor and stop (good enough for little bits of fluff).
          pos[i * 3 + 1] = 0;
          vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0;
        }

        const s = size[i] * (life[i] / maxLife[i]); // shrink away as it dies
        dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        dummy.rotation.set(rot[i * 3], rot[i * 3 + 1], rot[i * 3 + 2]);
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
        color.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
        particles.setColorAt(i, color);
        i++;
      }

      particles.count = alive;
      particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true;
    },
  };
}
