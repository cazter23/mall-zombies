// =============================================================================
// FIRE SPRINKLERS (map feature kind 'sprinklerHazard', docs/hazards-plan.md):
// Main Hallway south concourse wall fire alarm pull station (`(-3.9, 1.35, -1.95)`).
// Pay to trigger the overhead concourse sprinklers across `x: -12..12, z: -2..6`;
// pulses cold water spray (`source: 'hazard'`) that chills (`applySlow`) and soaks
// (`applyVulnerable`) zombies, bosses, and Mascots while lightly wet-slowing a player
// standing in the drenched concourse, then enters a recharging cooldown.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildSprinklerHazard(feature, ctx) {
  const cfg = hazards.sprinklers;
  const { scene, zombies, effects, sound, events } = ctx;
  const { minX, maxX, minZ, maxZ } = cfg.bounds;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Dynamic visual group for the drenched concourse floor film, rain wave, and glowing ceiling nozzles (hidden unless active).
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'sprinkler_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 1. Drenched concourse floor sheet + crisp cyan perimeter frame + sweeping rain curtain bar.
  const slickMat = new THREE.MeshBasicMaterial({
    color: cfg.slickColor,
    transparent: true,
    opacity: cfg.slickOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const slickGeo = new THREE.PlaneGeometry(spanX, spanZ);
  slickGeo.rotateX(-Math.PI / 2);
  const floorSlick = new THREE.Mesh(slickGeo, slickMat);
  floorSlick.position.set(centerX, cfg.slickY, centerZ);
  fieldGroup.add(floorSlick);

  const edgeMat = new THREE.MeshBasicMaterial({
    color: cfg.slickEdgeColor,
    transparent: true,
    opacity: cfg.edgeOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ew = cfg.edgeWidth;
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

  const waveMat = new THREE.MeshBasicMaterial({
    color: cfg.waveColor,
    transparent: true,
    opacity: cfg.waveOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const waveGeo = new THREE.PlaneGeometry(spanX - ew * 2, cfg.waveDepth);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.position.set(centerX, cfg.waveY, minZ + cfg.waveDepth / 2);
  fieldGroup.add(waveMesh);

  // 2. Overhead ceiling sprinkler nozzles along the north and south hallway ceiling bays.
  const nozzleMat = new THREE.MeshBasicMaterial({
    color: cfg.slickEdgeColor,
    transparent: true,
    opacity: cfg.nozzleGlowOpacity,
    depthWrite: false,
  });
  const nozzles = [];
  for (const n of cfg.nozzlePositions) {
    const p = new THREE.Vector3(n.x, n.y, n.z);
    nozzles.push(p);
    const nozzleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.nozzleSize.width, cfg.nozzleSize.height, cfg.nozzleSize.depth),
      nozzleMat,
    );
    nozzleMesh.position.copy(p);
    fieldGroup.add(nozzleMesh);
  }

  scene.add(fieldGroup);

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

  const hazard = createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      waveAge = 0;
      slickMat.opacity = cfg.slickOpacity;
      nozzleMat.opacity = cfg.nozzleGlowOpacity;
      waveMat.opacity = cfg.waveOpacity;
    },
    onTick(dt, remaining) {
      waveAge = (waveAge + dt) % cfg.pulseInterval;
      const progress = waveAge / cfg.pulseInterval;
      waveMesh.position.z = minZ + cfg.waveDepth / 2 + (spanZ - cfg.waveDepth) * progress;
      waveMat.opacity = (1 - progress) * cfg.waveOpacity;

      const shimmer = 0.8 + 0.2 * Math.sin(remaining * 18);
      slickMat.opacity = cfg.slickOpacity * shimmer;
      nozzleMat.opacity = cfg.nozzleGlowOpacity * shimmer;
    },
    onPulse() {
      waveAge = 0;
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);

      // Overhead water-drop streaks from the ceiling nozzles to the drenched concourse floor.
      const idleCount = cfg.idleStreakCount;
      for (let i = 0; i < idleCount; i++) {
        idleCursor = (idleCursor + 0.29) % 1;
        const nozzle = nozzles[(i * 2 + Math.floor(idleCursor * nozzles.length)) % nozzles.length];
        const u = ((i + idleCursor) / idleCount) % 1;
        const v = (idleCursor * 1.61 + i * 0.37) % 1;
        floorDropEnd.set(minX + ew + u * (spanX - ew * 2), cfg.waveY, minZ + ew + v * (spanZ - ew * 2));
        fireSprayStreak(nozzle, floorDropEnd, 0.85);
        effects?.splat?.(floorDropEnd, UP, cfg.hitSparkColors, cfg.idleSparkCount);
        effects?.flash?.(floorDropEnd, cfg.slickColor, cfg.flashRadius, cfg.flashDuration);
      }

      // Drench, chill, and soak every live zombie in the concourse spray zone.
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireSprayStreak(nearestNozzle(zombie.position), targetVec, 1.0);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        effects?.flash?.(targetVec, cfg.slickEdgeColor, cfg.hitFlashRadius, cfg.hitFlashDuration);
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
    },
  });

  if (cfg.switchOffset) {
    hazard.rig.position.addScaledVector(feature.normal, cfg.switchOffset);
  }

  return hazard;
}
