// =============================================================================
// FIRE SPRINKLERS (map feature kind 'sprinklerHazard', docs/archive/hazards-plan.md):
// Main Hallway south wall fire alarm pull station (switch style 'firePull', between Kiosk Kevin's cart and the planter).
// Pay to trigger the overhead concourse sprinklers across `x: -12..12, z: -2..6`;
// pulses cold water spray (`source: 'hazard'`) that chills (`applySlow`) and soaks
// (`applyVulnerable`) zombies, bosses, and Mascots while lightly wet-slowing a player
// standing in the drenched concourse, then enters a recharging cooldown.
// Looks: ten sprinkler heads always on the ceiling (one merged mesh; cyan while they spray), a cone of falling drops
// under each and splash rings where they land (one instanced mesh each), a wet sheet with a bright edge over the
// drenched floor, a rain curtain sweeping across it, and spray streaks each pulse. No lights.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

function floorMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
}

export function buildSprinklerHazard(feature, ctx) {
  const cfg = hazards.sprinklers;
  const { scene, zombies, effects, sound, events } = ctx;
  const { minX, maxX, minZ, maxZ } = cfg.bounds;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const ew = cfg.edgeWidth;
  const nozzles = cfg.nozzlePositions.map((n) => new THREE.Vector3(n.x, n.y, n.z));

  // 1. The sprinkler heads: always on the ceiling (a stem down from it and a deflector disc), one merged mesh.
  const h = cfg.head;
  const headParts = [];
  for (const p of nozzles) {
    const stemH = cfg.ceilingY - 0.005 - p.y;
    const stem = new THREE.CylinderGeometry(h.stemRadius, h.stemRadius, stemH, h.segments);
    stem.translate(p.x, p.y + stemH / 2, p.z);
    const deflector = new THREE.CylinderGeometry(h.deflectorRadius, h.deflectorRadius, h.deflectorHeight, h.segments);
    deflector.translate(p.x, p.y - h.deflectorHeight / 2, p.z);
    headParts.push(stem, deflector);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: h.color });
  const heads = new THREE.Mesh(mergeGeometries(headParts, false), headMat);
  for (const g of headParts) g.dispose();
  heads.name = 'sprinkler_heads';
  const headGroup = new THREE.Group(); // (its material changes colour while spraying)
  headGroup.name = 'sprinkler_heads_rig';
  headGroup.userData.dynamic = true;
  headGroup.add(heads);
  scene.add(headGroup);

  // Everything the spray shows, hidden unless it is running.
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'sprinkler_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 2. The drenched floor: a wet sheet, a bright edge round it, and a rain curtain sweeping across it.
  const slickMat = floorMaterial(cfg.slickColor, cfg.slickOpacity);
  const slickGeo = new THREE.PlaneGeometry(spanX, spanZ);
  slickGeo.rotateX(-Math.PI / 2);
  const floorSlick = new THREE.Mesh(slickGeo, slickMat);
  floorSlick.position.set(centerX, cfg.slickY, centerZ);
  fieldGroup.add(floorSlick);

  const edgeMat = floorMaterial(cfg.slickEdgeColor, cfg.edgeOpacity);
  for (const zEdge of [minZ + ew / 2, maxZ - ew / 2]) {
    const hGeo = new THREE.PlaneGeometry(spanX, ew);
    hGeo.rotateX(-Math.PI / 2);
    const hStrip = new THREE.Mesh(hGeo, edgeMat);
    hStrip.position.set(centerX, cfg.edgeY, zEdge);
    fieldGroup.add(hStrip);
  }
  for (const xEdge of [minX + ew / 2, maxX - ew / 2]) {
    const vGeo = new THREE.PlaneGeometry(ew, spanZ - ew * 2);
    vGeo.rotateX(-Math.PI / 2);
    const vStrip = new THREE.Mesh(vGeo, edgeMat);
    vStrip.position.set(xEdge, cfg.edgeY, centerZ);
    fieldGroup.add(vStrip);
  }

  const waveMat = floorMaterial(cfg.waveColor, cfg.waveOpacity);
  const waveGeo = new THREE.PlaneGeometry(spanX - ew * 2, cfg.waveDepth);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.position.set(centerX, cfg.waveY, minZ + cfg.waveDepth / 2);
  fieldGroup.add(waveMesh);

  // 3. Falling drops: a cone of them under every head, each falling from the head to the floor and starting again.
  const r = cfg.rain;
  const drops = new THREE.InstancedMesh(
    new THREE.BoxGeometry(r.width, r.length, r.width),
    new THREE.MeshBasicMaterial({ color: r.color, transparent: true, opacity: r.opacity, depthWrite: false }),
    r.perHead * nozzles.length,
  );
  drops.name = 'sprinkler_drops';
  drops.frustumCulled = false; // (instances spread over the hallway; the base geometry sits at the origin)
  const dropList = [];
  nozzles.forEach((p, n) => {
    for (let i = 0; i < r.perHead; i++) {
      const angle = (i / r.perHead) * Math.PI * 2 + n * 0.7;
      const spread = r.minSpread + ((i * 5 + n * 3) % r.perHead) / r.perHead * (r.maxSpread - r.minSpread);
      dropList.push({ head: p, dx: Math.cos(angle) * spread, dz: Math.sin(angle) * spread, phase: ((i * 7 + n * 3) % r.perHead) / r.perHead });
    }
  });
  fieldGroup.add(drops);

  // 4. Splash rings on the floor under every head, swelling outward.
  const sp = cfg.splash;
  const splashGeo = new THREE.RingGeometry(0.85, 1, sp.segments);
  splashGeo.rotateX(-Math.PI / 2);
  const splashes = new THREE.InstancedMesh(splashGeo, floorMaterial(sp.color, sp.opacity), sp.perHead * nozzles.length);
  splashes.name = 'sprinkler_splashes';
  splashes.frustumCulled = false;
  fieldGroup.add(splashes);

  scene.add(fieldGroup);

  const dummy = new THREE.Object3D();
  let time = 0;
  function animateWater() {
    dropList.forEach((d, i) => {
      const t = ((time / r.fallSeconds) + d.phase) % 1;
      dummy.position.set(d.head.x + d.dx * t, d.head.y - t * (d.head.y - r.floorY) - r.length / 2, d.head.z + d.dz * t);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      drops.setMatrixAt(i, dummy.matrix);
    });
    drops.instanceMatrix.needsUpdate = true;
    let i = 0;
    for (const p of nozzles) {
      for (let k = 0; k < sp.perHead; k++, i++) {
        const t = ((time / sp.seconds) + k / sp.perHead) % 1;
        const s = Math.max(0.01, t * sp.radius);
        dummy.position.set(p.x, sp.y, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(s, 1, s);
        dummy.updateMatrix();
        splashes.setMatrixAt(i, dummy.matrix);
      }
    }
    splashes.instanceMatrix.needsUpdate = true;
  }

  const targetVec = new THREE.Vector3();
  const prevPt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();
  const floorDropEnd = new THREE.Vector3();
  let waveAge = 0;
  let idleCursor = 0;

  /** Fires a multi-segment overhead water spray streak from `from` down to `to`. */
  function fireSprayStreak(from, to, jitterScale = 1) {
    if (!effects?.tracer) return;
    const segs = cfg.spraySegments;
    const jitter = cfg.sprayJitter * jitterScale;
    prevPt.copy(from);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      nextPt.lerpVectors(from, to, t);
      if (i < segs) {
        nextPt.x += (Math.random() - 0.5) * 2 * jitter * t;
        nextPt.z += (Math.random() - 0.5) * 2 * jitter * t;
      }
      effects.tracer(prevPt, nextPt, cfg.slickEdgeColor);
      effects.tracer(prevPt, nextPt, cfg.waveColor);
      prevPt.copy(nextPt);
    }
  }

  function nearestNozzle(pos) {
    let best = nozzles[0];
    let bestD = Infinity;
    for (const p of nozzles) {
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function isInside(pos) {
    if (!pos || Math.abs(pos.y) > cfg.maxHeight) return false;
    return pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ;
  }

  return createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      headMat.color.setHex(h.sprayColor);
      waveAge = 0;
      slickMat.opacity = cfg.slickOpacity;
      waveMat.opacity = cfg.waveOpacity;
      animateWater();
    },
    onTick(dt, remaining) {
      time += dt;
      waveAge = (waveAge + dt) % cfg.pulseInterval;
      const progress = waveAge / cfg.pulseInterval;
      waveMesh.position.z = minZ + cfg.waveDepth / 2 + (spanZ - cfg.waveDepth) * progress;
      waveMat.opacity = (1 - progress) * cfg.waveOpacity;
      slickMat.opacity = cfg.slickOpacity * (cfg.shimmer.base + cfg.shimmer.amplitude * Math.sin(remaining * cfg.shimmer.speed));
      animateWater();
    },
    onPulse() {
      waveAge = 0;
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);

      // Overhead water-drop streaks from the ceiling nozzles to the drenched concourse floor.
      for (let i = 0; i < cfg.idleStreakCount; i++) {
        idleCursor = (idleCursor + 0.29) % 1;
        const nozzle = nozzles[(i * 2 + Math.floor(idleCursor * nozzles.length)) % nozzles.length];
        const u = ((i + idleCursor) / cfg.idleStreakCount) % 1;
        const v = (idleCursor * 1.61 + i * 0.37) % 1;
        floorDropEnd.set(minX + ew + u * (spanX - ew * 2), cfg.waveY, minZ + ew + v * (spanZ - ew * 2));
        fireSprayStreak(nozzle, floorDropEnd, 0.85);
        effects?.splat?.(floorDropEnd, UP, cfg.hitSparkColors, cfg.idleSparkCount);
        effects?.flash?.(floorDropEnd, cfg.slickColor, { size: cfg.flashRadius, seconds: cfg.flashDuration });
      }

      // Drench, chill, and soak every live zombie in the concourse spray zone.
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireSprayStreak(nearestNozzle(zombie.position), targetVec, 1.0);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        effects?.flash?.(targetVec, cfg.slickEdgeColor, { size: cfg.hitFlashRadius, seconds: cfg.hitFlashDuration });
        const result = dealHazardDamage(zombie, cfg.zombieDamage, cfg);
        if (result?.killed) {
          events.emit('sprinklerKill', { zombie });
        } else {
          zombie.applySlow?.(cfg.slowDuration, cfg.slowFactor, cfg.slowKind);
          zombie.applyVulnerable?.(cfg.vulnerableDuration, cfg.vulnerableMultiplier);
        }
      }
    },
    onStop() {
      fieldGroup.visible = false;
      headMat.color.setHex(h.color);
    },
  });
}
