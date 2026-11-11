// =============================================================================
// FRYER BLAST (map feature kind 'fryerHazard', docs/hazards-plan.md):
// Food Court CORN DOG CORRAL counter fryer valve switch. Pay to vent superheated
// oil from both deep fryers across the counter apron (`x: 2.5..9.0, z: -13.0..-6.5`);
// blasts scalding oil (`source: 'hazard'`) that scalds and slips zombies flat on their
// backs (and lightly scalds/slows a player standing in the grease apron), then enters
// a recharging cooldown.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildFryerHazard(feature, ctx) {
  const cfg = hazards.fryer;
  const { scene, zombies, effects, sound, events } = ctx;
  const { minX, maxX, minZ, maxZ } = cfg.bounds;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;

  // Dynamic visual group for the scalding grease apron, sweeping oil wave, and glowing fryer vats (hidden unless active).
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'fryer_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 1. Bubbling amber grease slick across the 6.5m x 6.5m counter apron + golden perimeter frame + sweeping hot-oil wave.
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

  // 2. Superheated fryer vat glow behind the counter + twin counter-lip vent nozzles.
  const vatMat = new THREE.MeshBasicMaterial({
    color: cfg.slickEdgeColor,
    transparent: true,
    opacity: cfg.vatGlowOpacity,
    depthWrite: false,
  });
  for (const vat of cfg.vatCenters) {
    const vatGlow = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.vatSize.width, cfg.vatSize.height, cfg.vatSize.depth),
      vatMat,
    );
    vatGlow.position.set(vat.x, vat.y, vat.z);
    fieldGroup.add(vatGlow);
  }

  const nozzles = [];
  for (const n of cfg.nozzlePositions) {
    const p = new THREE.Vector3(n.x, n.y, n.z);
    nozzles.push(p);
    const nozzleMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cfg.nozzleSize.width, cfg.nozzleSize.height, cfg.nozzleSize.depth),
      waveMat,
    );
    nozzleMesh.position.copy(p);
    fieldGroup.add(nozzleMesh);
  }

  scene.add(fieldGroup);

  const targetVec = new THREE.Vector3();
  const prevPt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();
  const floorJetEnd = new THREE.Vector3();
  let waveAge = 0;
  let idleCursor = 0;

  /** Fires an arcing multi-segment stream of scalding oil from `from` to `to`. */
  function fireOilJet(from, to, jitterScale = 1) {
    if (!effects?.tracer) return;
    const segs = cfg.jetSegments;
    const jitter = cfg.jetJitter * jitterScale;
    prevPt.copy(from);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      nextPt.lerpVectors(from, to, t);
      if (i < segs) {
        const arc = Math.sin(t * Math.PI);
        nextPt.x += (Math.random() - 0.5) * 2 * jitter * arc;
        nextPt.y += cfg.jetArcHeight * arc + (Math.random() - 0.5) * jitter * arc;
        nextPt.z += (Math.random() - 0.5) * 2 * jitter * arc;
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
      vatMat.opacity = cfg.vatGlowOpacity;
      waveMat.opacity = cfg.waveOpacity;
    },
    onTick(dt, remaining) {
      waveAge = (waveAge + dt) % cfg.pulseInterval;
      const progress = waveAge / cfg.pulseInterval;
      waveMesh.position.z = minZ + cfg.waveDepth / 2 + (spanZ - cfg.waveDepth) * progress;
      waveMat.opacity = (1 - progress) * cfg.waveOpacity;

      const simmer = 0.8 + 0.2 * Math.sin(remaining * 20);
      slickMat.opacity = cfg.slickOpacity * simmer;
      vatMat.opacity = cfg.vatGlowOpacity * simmer;
    },
    onPulse(isOpening) {
      waveAge = 0;
      for (const nozzle of nozzles) {
        effects?.flash?.(nozzle, cfg.slickEdgeColor, cfg.flashRadius, cfg.flashDuration);
      }
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);

      // Ambient hot-oil streams jetting from the counter nozzles across the grease apron.
      const idleCount = cfg.idleJetCount;
      for (let i = 0; i < idleCount; i++) {
        idleCursor = (idleCursor + 0.37) % 1;
        const u = ((i + idleCursor) / idleCount) % 1;
        const v = 0.15 + 0.75 * ((idleCursor * 1.7 + i * 0.29) % 1);
        floorJetEnd.set(minX + ew + u * (spanX - ew * 2), cfg.waveY, minZ + ew + v * (spanZ - ew * 2));
        const from = nozzles[i % nozzles.length];
        fireOilJet(from, floorJetEnd, 0.75);
        effects?.splat?.(floorJetEnd, UP, cfg.hitSparkColors, cfg.idleSparkCount);
      }

      // Scald and slip every live zombie standing on the counter apron.
      const baseDamage = isOpening ? cfg.burstDamage : cfg.zombieDamage;
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireOilJet(nearestNozzle(zombie.position), targetVec, 1.0);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        effects?.flash?.(targetVec, cfg.slickEdgeColor, cfg.hitFlashRadius, cfg.hitFlashDuration);
        zombie.applySlip?.(cfg.slipDuration, cfg.slipDrag);
        if (dealHazardDamage(zombie, baseDamage, cfg)?.killed) {
          events.emit('fryerKill', { zombie });
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
