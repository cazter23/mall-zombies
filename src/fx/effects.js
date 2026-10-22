// =============================================================================
// EFFECTS
// Purely visual, short-lived stuff: staple tracers and cartoon particle bursts
// (Halo CE-style colored splatter, wall dust). Nothing here affects gameplay,
// so it updates per rendered frame for smoothness.
//
// SPLATTER (feel.effects.blood.mode, the Settings > Comfort option): splat(..., { flesh: true }) is what a hit zombie
// does. 'confetti' (default): the zombie's own colors, as always. 'red': cartoon blood, more of it; droplets that land
// on the floor sometimes leave a flat stain, a corpse leaves a puddle that spreads (puddle()), and both fade away.
// 'off': nothing. Dust and everything not "flesh" is unaffected.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { makeSplatTexture } from '../world/textures.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createEffects(scene) {
  const fx = feel.effects;

  // --- Tracers: thin stretched cylinders that fade out quickly -------------------

  const tracerGeometry = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true);
  const tracers = [];
  for (let i = 0; i < fx.tracerPool; i++) {
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

  const bloodFlag = new Uint8Array(max); // 1 = a red-mode droplet (may leave a stain when it lands)
  const landed = new Uint8Array(max);

  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  const randomDir = new THREE.Vector3();

  // --- Stains: flat splat-shaped patches on the floor (red mode), a ring buffer so the oldest are replaced -------------
  // Each is a transparent plane drawn with a procedural splat texture (world/textures.js makeSplatTexture): a few
  // different splats (one InstancedMesh per variant) plus a rounder pool for corpses. `size` = the blob's width in
  // meters; the plane is larger so the thrown streaks and droplets fit around it.

  const blood = fx.blood;
  const PUDDLE = blood.splatVariants; // the last variant is the puddle
  const splatGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const stainMeshes = [];
  for (let v = 0; v <= PUDDLE; v++) {
    const mesh = new THREE.InstancedMesh(
      splatGeometry,
      new THREE.MeshBasicMaterial({
        transparent: true, // (the splat texture is drawn the first time a stain is needed: ensureSplatTextures)
        depthWrite: false,
        // Drawn over the floor with a depth offset so a stain never z-fights with it.
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
      blood.maxStains,
    );
    mesh.name = v === PUDDLE ? 'stains_puddle' : `stains_${v}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    stainMeshes.push(mesh);
  }
  let texturesReady = false;
  function ensureSplatTextures() {
    if (texturesReady) return;
    texturesReady = true;
    stainMeshes.forEach((mesh, v) => {
      mesh.material.map = makeSplatTexture({ seed: 7 + v * 13, puddle: v === PUDDLE, color: blood.stainColor, highlight: blood.stainHighlight });
      mesh.material.needsUpdate = true;
    });
  }
  const stain = { x: [], z: [], rot: [], size: [], flip: [], variant: [], age: [], life: [], grow: [] };
  let stainCount = 0;
  let nextStain = 0;

  function addStain(x, z, size, variant, seconds, growSeconds = 0.25) {
    ensureSplatTextures();
    const i = stainCount < blood.maxStains ? stainCount++ : nextStain;
    nextStain = (nextStain + 1) % blood.maxStains;
    stain.x[i] = x;
    stain.z[i] = z;
    stain.rot[i] = Math.random() * Math.PI * 2;
    stain.size[i] = size;
    stain.flip[i] = Math.random() < 0.5 ? -1 : 1;
    stain.variant[i] = variant;
    stain.age[i] = 0;
    stain.life[i] = seconds;
    stain.grow[i] = growSeconds;
  }
  const randomSplat = () => Math.floor(Math.random() * PUDDLE);
  const stainSizeNow = () => blood.stainSize.min + Math.random() * (blood.stainSize.max - blood.stainSize.min);

  function spawnParticle(point, velocity, hexColor, particleSize, isBlood = false) {
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
    bloodFlag[i] = isBlood ? 1 : 0;
    landed[i] = 0;
  }

  // A burst flying mostly away from the surface (along `normal`), in random colors from `colors`.
  function burst(point, normal, colors, count, speed, particleSize, isBlood = false) {
    const velocity = new THREE.Vector3();
    for (let n = 0; n < count; n++) {
      randomDir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      velocity
        .copy(normal)
        .multiplyScalar(speed * 0.6)
        .addScaledVector(randomDir, speed * (0.4 + Math.random() * 0.6));
      velocity.y += speed * 0.3; // a little pop upward reads as more cartoony
      spawnParticle(point, velocity, colors[n % colors.length], particleSize, isBlood);
    }
  }

  return {
    // Staple streak from `from` (gun muzzle) to `to` (where the shot landed).
    tracer(from, to, hexColor) {
      const t = tracers[nextTracer];
      nextTracer = (nextTracer + 1) % tracers.length;
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

    // Colored splatter when a shot hits something squishy. `flesh: true` = a zombie's body: it follows the Splatter
    // setting (see the header). Without it (dust, spawn puffs) the colors are used as given.
    splat(point, normal, colors, count, { flesh = false } = {}) {
      if (!flesh) {
        burst(point, normal, colors, count, fx.splatSpeed, fx.particleSize);
        return;
      }
      if (blood.mode === 'off') return;
      if (blood.mode === 'red') {
        burst(point, normal, blood.colors, Math.round(count * blood.countScale), fx.splatSpeed, fx.particleSize, true);
        return;
      }
      burst(point, normal, colors, count, fx.splatSpeed, fx.particleSize);
    },

    // A corpse's puddle on the floor at (x, z): spreads out under the body, then fades (red mode only).
    puddle(x, z) {
      if (blood.mode !== 'red') return;
      const r = blood.puddleRadius * (0.85 + Math.random() * 0.3);
      addStain(x, z, r * 2, PUDDLE, blood.puddleSeconds, blood.puddleGrowSeconds);
    },

    // What is alive right now (for tests and debugging).
    get counts() {
      return { particles: alive, stains: stainCount };
    },

    // Little dust puff when a shot hits a wall or prop.
    puff(point, normal) {
      burst(point, normal, [fx.puffColor], fx.puffCount, fx.puffSpeed, fx.particleSize * 0.7);
    },

    // Remove every tracer and particle (new run).
    clear() {
      for (const t of tracers) {
        t.life = 0;
        t.mesh.visible = false;
      }
      alive = 0;
      particles.count = 0;
      stainCount = 0;
      nextStain = 0;
      for (const mesh of stainMeshes) mesh.count = 0;
    },

    // Call every rendered frame with the real frame time (0 while paused).
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
          // A red droplet that ran out of life in the air splashes down where it was (so most droplets can stain).
          if (bloodFlag[i] && !landed[i] && Math.random() < blood.stainChance) {
            addStain(pos[i * 3], pos[i * 3 + 2], stainSizeNow(), randomSplat(), blood.stainSeconds);
          }
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
          bloodFlag[i] = bloodFlag[last];
          landed[i] = landed[last];
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
          if (!landed[i]) {
            landed[i] = 1;
            if (bloodFlag[i] && Math.random() < blood.stainChance) {
              addStain(pos[i * 3], pos[i * 3 + 2], stainSizeNow(), randomSplat(), blood.stainSeconds);
            }
          }
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

      // Stains: spread out when new, shrink away at the end, and free their slot when done.
      const used = new Array(stainMeshes.length).fill(0);
      let k = 0;
      while (k < stainCount) {
        stain.age[k] += dt;
        if (stain.age[k] >= stain.life[k]) {
          const last = --stainCount;
          for (const key of Object.keys(stain)) stain[key][k] = stain[key][last];
          if (nextStain >= stainCount) nextStain = 0;
          continue;
        }
        const grow = Math.min(1, stain.age[k] / stain.grow[k]);
        const fade = Math.min(1, (stain.life[k] - stain.age[k]) / blood.fadeSeconds);
        const scale = grow * fade;
        const v = stain.variant[k];
        // The plane is 1/blobShare times the blob so the thrown streaks and droplets fit around it.
        const plane = (stain.size[k] / (v === PUDDLE ? blood.puddleShare : blood.splatShare)) * scale;
        dummy.position.set(stain.x[k], 0.004, stain.z[k]);
        dummy.rotation.set(0, stain.rot[k], 0);
        dummy.scale.set(plane * stain.flip[k], 1, plane);
        dummy.updateMatrix();
        stainMeshes[v].setMatrixAt(used[v]++, dummy.matrix);
        k++;
      }
      stainMeshes.forEach((mesh, v) => {
        mesh.count = used[v];
        mesh.instanceMatrix.needsUpdate = true;
      });
    },
  };
}
