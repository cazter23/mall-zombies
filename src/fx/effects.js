// =============================================================================
// EFFECTS
// Purely visual tracers, cartoon particle bursts and capped persistent world impacts
// (Halo CE-style colored splatter, wall dust, gun-specific marks). Nothing here affects gameplay,
// so it updates per rendered frame for smoothness.
//
// SPLATTER (feel.effects.blood.mode, the Settings > Comfort option): splat(..., { flesh: true }) is what a hit zombie
// does. 'confetti' (default): the zombie's own colors, as always. 'red': cartoon blood droplets, and each corpse leaves
// one pool of blood that spreads out under it (pool()) and fades away after a while. 'off': nothing. Dust and everything
// not "flesh" is unaffected.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { mascotFoamColors } from '../config/zombies.js';
import { makePoolTexture } from '../world/textures.js';
import { createImpactMarks } from './impactMarks.js';

const UP = new THREE.Vector3(0, 1, 0);

export function createEffects(scene, { surfaces = [] } = {}) {
  const fx = feel.effects;

  // --- Tracers: thin stretched cylinders that fade out quickly -------------------

  const tracerGeometry = new THREE.CylinderGeometry(0.42, 1, 1, 6, 1, true);
  const tracers = [];
  for (let i = 0; i < fx.tracerPool; i++) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(tracerGeometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    tracers.push({ mesh, life: 0, length: 1, width: fx.tracerWidth, seconds: fx.tracerSeconds, flicker: 0 });
  }
  let nextTracer = 0;

  // --- Flashes: a few additive balls of light that swell and fade (a Build-A-Blaster proc), so no real light is needed ---
  const flashGeometry = new THREE.SphereGeometry(1, 12, 8);
  const flashes = [];
  for (let i = 0; i < 8; i++) {
    const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(flashGeometry, material);
    mesh.visible = false;
    mesh.frustumCulled = false;
    scene.add(mesh);
    flashes.push({ mesh, life: 0, seconds: 1, size: 1, opacity: 1 });
  }
  let nextFlash = 0;
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
  const spin = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const life = new Float32Array(max);
  const maxLife = new Float32Array(max);
  const size = new Float32Array(max);
  const paper = new Uint8Array(max);
  // 0 = unrelated dust; 1 = confetti flesh; 2 = red flesh. A changed comfort
  // setting can remove existing flesh effects without touching wall/spawn puffs.
  const fleshMode = new Uint8Array(max);
  let alive = 0;


  const color = new THREE.Color();
  const dummy = new THREE.Object3D();
  const randomDir = new THREE.Vector3();

  // --- Pools: a flat pool of blood under each corpse (red mode), a ring buffer so the oldest are replaced -------------
  // Each is a transparent plane drawn with a procedural pool texture (world/textures.js makePoolTexture), in a few
  // different shapes (one InstancedMesh per shape). Drawn the first time one is needed.

  const blood = fx.blood;
  const poolGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const poolMeshes = [];
  for (let v = 0; v < blood.poolVariants; v++) {
    const mesh = new THREE.InstancedMesh(
      poolGeometry,
      new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        // Drawn over the floor with a depth offset so a pool never z-fights with it.
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      }),
      blood.maxPools,
    );
    mesh.name = `pools_${v}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    poolMeshes.push(mesh);
  }
  let texturesReady = false;
  function ensurePoolTextures() {
    if (texturesReady) return;
    texturesReady = true;
    poolMeshes.forEach((mesh, v) => {
      mesh.material.map = makePoolTexture({ seed: 11 + v * 17 });
      mesh.material.needsUpdate = true;
    });
  }
  const pool = { x: [], z: [], rot: [], size: [], variant: [], age: [], life: [] };
  let poolCount = 0;
  let nextPool = 0;

  function addPool(x, z, size) {
    ensurePoolTextures();
    const i = poolCount < blood.maxPools ? poolCount++ : nextPool;
    nextPool = (nextPool + 1) % blood.maxPools;
    pool.x[i] = x;
    pool.z[i] = z;
    pool.rot[i] = Math.random() * Math.PI * 2;
    pool.size[i] = size;
    pool.variant[i] = Math.floor(Math.random() * blood.poolVariants);
    pool.age[i] = 0;
    pool.life[i] = blood.poolSeconds;
  }

  function spawnParticle(point, velocity, hexColor, particleSize, flesh = 0, isPaper = false) {
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
    spin[i * 3] = (Math.random() - 0.5) * 16;
    spin[i * 3 + 1] = (Math.random() - 0.5) * 16;
    spin[i * 3 + 2] = (Math.random() - 0.5) * 16;
    color.setHex(hexColor);
    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;
    maxLife[i] = fx.particleLife * (0.6 + Math.random() * 0.4) * (isPaper ? 2.1 : 1);
    paper[i] = isPaper;
    life[i] = maxLife[i];
    size[i] = particleSize * (0.6 + Math.random() * 0.8);
    fleshMode[i] = flesh;
  }

  // A burst flying mostly away from the surface (along `normal`), in random colors from `colors`.
  function burst(point, normal, colors, count, speed, particleSize, flesh = 0, biasDir = null, isPaper = false) {
    const velocity = new THREE.Vector3();
    for (let n = 0; n < count; n++) {
      randomDir.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      velocity
        .copy(normal)
        .multiplyScalar(speed * 0.6)
        .addScaledVector(randomDir, speed * (0.4 + Math.random() * 0.6));
      if (biasDir) {
        const through = (n & 1) === 0 ? 0.5 : -0.15;
        velocity.x += biasDir.x * speed * through;
        velocity.y += (biasDir.y ?? 0) * speed * through * 0.5;
        velocity.z += biasDir.z * speed * through;
      }
      velocity.y += speed * 0.35; // a little pop upward reads as more cartoony
      spawnParticle(point, velocity, colors[n % colors.length], particleSize, flesh, isPaper);
    }
  }

  const marks = createImpactMarks(scene, surfaces);
  return {
    prepare(renderer, camera) { marks.prepare(renderer, camera); },
    // Persistent, gun-specific world aftermath. Pure decoration: no colliders or damage.
    impact(gunId, origin, worldHit) { return marks.add(gunId, origin, worldHit); },
    // The map's meshes changed (a barrier opened, static batching ran): impact marks list their surfaces again (fx/impactMarks.js).
    refreshSurfaces() { marks.refresh(); },
    // Staple streak from `from` (gun muzzle) to `to` (where the shot landed).
    // `options` (all optional): width (metres), seconds (how long it stays) and flicker (flashes per second), for a fatter, longer arc than a bullet's streak.
    tracer(from, to, hexColor, { width = fx.tracerWidth, seconds = fx.tracerSeconds, flicker = 0 } = {}) {
      const t = tracers[nextTracer];
      nextTracer = (nextTracer + 1) % tracers.length;
      tracerDir.subVectors(to, from);
      const length = tracerDir.length();
      if (length < 0.01) return;
      t.length = length;
      t.mesh.position.copy(from).addScaledVector(tracerDir, 0.5);
      t.mesh.quaternion.setFromUnitVectors(UP, tracerDir.normalize());
      t.width = width;
      t.seconds = seconds;
      t.flicker = flicker;
      t.mesh.scale.set(width, length, width);
      t.mesh.material.color.setHex(hexColor);
      t.mesh.material.opacity = 1;
      t.mesh.visible = true;
      t.life = seconds;
    },

    // A ball of light at a point that swells and fades: where a Build-A-Blaster effect goes off.
    flash(point, hexColor, { size = 1.2, seconds = .2, opacity = .8 } = {}) {
      const f = flashes[nextFlash];
      nextFlash = (nextFlash + 1) % flashes.length;
      f.mesh.position.copy(point);
      f.mesh.material.color.setHex(hexColor);
      f.mesh.visible = true;
      f.life = f.seconds = seconds;
      f.size = size;
      f.opacity = opacity;
    },

    // Colored splatter when a shot hits something squishy. `flesh: true` = a zombie's body: it follows the Splatter
    // setting (see the header). Without it (dust, spawn puffs) the colors are used as given.
    splat(point, normal, colors, count, { flesh = false, speedScale = 1, direction = null } = {}) {
      const speed = fx.splatSpeed * speedScale;
      // Gun and melee impacts carry the shootable's palette. Foam keeps its
      // material colors even when the player's Splatter setting is Red (a Mascot's costume, or any palette
      // flagged `foam`: Sunny's stuffing, game/features/clawSunny.js).
      if (!flesh || colors === mascotFoamColors || colors?.foam) {
        burst(point, normal, colors, count, speed, fx.particleSize, 0, direction);
        return;
      }
      if (blood.mode === 'off') return;
      if (blood.mode === 'red') {
        burst(point, normal, blood.colors, Math.round(count * blood.countScale), speed, fx.particleSize, 2, direction);
        return;
      }
      burst(point, normal, colors, count, speed, fx.particleSize, 1, direction);
    },

    confetti(point, normal, { colors, count, speed, size }) {
      burst(point, normal, colors, count, speed, size, 0, null, true);
    },

    // A corpse's pool of blood on the floor at (x, z): spreads out under the body, then fades (red mode only).
    pool(x, z) {
      if (blood.mode !== 'red') return;
      addPool(x, z, blood.poolRadius * 2 * (0.85 + Math.random() * 0.3));
    },

    // What is alive right now (for tests and debugging).
    get counts() {
      return { particles: alive, pools: poolCount, marks: marks.count };
    },

    // Little dust puff when a shot hits a wall or prop.
    puff(point, normal) {
      burst(point, normal, [fx.puffColor], fx.puffCount, fx.puffSpeed, fx.particleSize * 0.7);
    },

    // Remove every tracer, particle, pool and persistent impact (new run).
    clear() {
      marks.clear();
      for (const t of tracers) {
        t.life = 0;
        t.mesh.visible = false;
      }
      for (const f of flashes) {
        f.life = 0;
        f.mesh.visible = false;
      }
      alive = 0;
      particles.count = 0;
      poolCount = 0;
      nextPool = 0;
      for (const mesh of poolMeshes) mesh.count = 0;
    },

    // Call every rendered frame with the real frame time (0 while paused).
    update(dt) {
      marks.update();
      // Runs even with dt=0: switching the option in a paused menu takes effect immediately.
      if (blood.mode !== 'red') {
        poolCount = 0;
        nextPool = 0;
      }
      const currentFlesh = blood.mode === 'red' ? 2 : blood.mode === 'confetti' ? 1 : 0;
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        const ratio = Math.max(0, t.life / t.seconds);
        // (A flickering arc blinks off and on as it fades.)
        const blink = t.flicker && Math.floor((t.seconds - t.life) * t.flicker * 2) % 2 ? .45 : 1;
        t.mesh.material.opacity = ratio * blink;
        const w = t.width * (0.35 + 0.65 * ratio);
        t.mesh.scale.set(w, t.length, w);
        if (t.life <= 0) t.mesh.visible = false;
      }
      for (const f of flashes) {
        if (f.life <= 0) continue;
        f.life -= dt;
        const ratio = Math.max(0, f.life / f.seconds);
        f.mesh.material.opacity = f.opacity * ratio;
        f.mesh.scale.setScalar(f.size * (0.35 + 0.65 * (1 - ratio)));
        if (f.life <= 0) f.mesh.visible = false;
      }

      let i = 0;
      while (i < alive) {
        life[i] -= dt;
        if (life[i] <= 0 || (fleshMode[i] && fleshMode[i] !== currentFlesh)) {
          // Swap the last live particle into this slot and shrink the live count.
          const last = --alive;
          for (const arr of [pos, vel, rot, spin, col]) {
            arr[i * 3] = arr[last * 3];
            arr[i * 3 + 1] = arr[last * 3 + 1];
            arr[i * 3 + 2] = arr[last * 3 + 2];
          }
          life[i] = life[last];
          maxLife[i] = maxLife[last];
          size[i] = size[last];
          paper[i] = paper[last];
          fleshMode[i] = fleshMode[last];
          continue; // re-check slot i (it now holds a different particle)
        }

        const isConfetti = paper[i] || (fleshMode[i] === 1 && (i & 1) === 0);
        const gravScale = isConfetti ? 0.62 : 1;
        vel[i * 3 + 1] -= fx.particleGravity * gravScale * dt;
        if (isConfetti && pos[i * 3 + 1] > 0.02) {
          vel[i * 3] += Math.sin(life[i] * 22 + i) * 1.8 * dt;
          vel[i * 3 + 2] += Math.cos(life[i] * 19 + i) * 1.8 * dt;
        }
        pos[i * 3] += vel[i * 3] * dt;
        pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
        pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        rot[i * 3] += spin[i * 3] * dt;
        rot[i * 3 + 1] += spin[i * 3 + 1] * dt;
        rot[i * 3 + 2] += spin[i * 3 + 2] * dt;

        const s = size[i] * (life[i] / maxLife[i]); // shrink away as it dies
        const floorY = s * 0.45;
        if (pos[i * 3 + 1] < floorY) {
          pos[i * 3 + 1] = floorY;
          if (vel[i * 3 + 1] < -0.45) {
            vel[i * 3 + 1] = -vel[i * 3 + 1] * 0.36;
            vel[i * 3] *= 0.62;
            vel[i * 3 + 2] *= 0.62;
            spin[i * 3] *= 0.55;
            spin[i * 3 + 1] *= 0.55;
            spin[i * 3 + 2] *= 0.55;
          } else if (vel[i * 3 + 1] < 0) {
            vel[i * 3] = vel[i * 3 + 1] = vel[i * 3 + 2] = 0;
            spin[i * 3] = spin[i * 3 + 1] = spin[i * 3 + 2] = 0;
          }
        }

        dummy.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
        dummy.rotation.set(rot[i * 3], rot[i * 3 + 1], rot[i * 3 + 2]);
        if (paper[i]) dummy.scale.set(s * (i % 3 === 0 ? 2.1 : 1.25), s * .13, s * .9);
        else if (isConfetti) dummy.scale.set(s * 1.38, s * 0.36, s * 1.05);
        else dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        particles.setMatrixAt(i, dummy.matrix);
        color.setRGB(col[i * 3], col[i * 3 + 1], col[i * 3 + 2]);
        particles.setColorAt(i, color);
        i++;
      }

      particles.count = alive;
      particles.instanceMatrix.needsUpdate = true;
      if (particles.instanceColor) particles.instanceColor.needsUpdate = true;

      // Pools: spread out under the body (fast at first, then slowing), shrink away at the end, free their slot when done.
      const used = new Array(poolMeshes.length).fill(0);
      let k = 0;
      while (k < poolCount) {
        pool.age[k] += dt;
        if (pool.age[k] >= pool.life[k]) {
          const last = --poolCount;
          for (const key of Object.keys(pool)) pool[key][k] = pool[key][last];
          if (nextPool >= poolCount) nextPool = 0;
          continue;
        }
        const t = Math.min(1, pool.age[k] / blood.poolGrowSeconds);
        const grow = 1 - (1 - t) ** 3; // ease out
        const fade = Math.min(1, (pool.life[k] - pool.age[k]) / blood.fadeSeconds);
        const plane = (pool.size[k] / blood.poolShare) * grow * fade;
        const v = pool.variant[k];
        dummy.position.set(pool.x[k], 0.004, pool.z[k]);
        dummy.rotation.set(0, pool.rot[k], 0);
        dummy.scale.set(plane, 1, plane);
        dummy.updateMatrix();
        poolMeshes[v].setMatrixAt(used[v]++, dummy.matrix);
        k++;
      }
      poolMeshes.forEach((mesh, v) => {
        mesh.count = used[v];
        mesh.instanceMatrix.needsUpdate = true;
      });
    },
  };
}
