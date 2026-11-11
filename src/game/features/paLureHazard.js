// =============================================================================
// PA SYSTEM LURE (map feature kind 'paLureHazard', docs/hazards-plan.md):
// Service Corridor west wall paging panel (`(-23.1, 1.35, -4.5)`).
// Pay to broadcast a clearance chime from the overhead corridor speaker (`(-21.5, -4.5)`,
// `10 m` radius); pulses every `0.5 s` to transfix normal zombies in place with
// `applyHold(lureSource, 1.2)` (bosses ignore `applyHold`), then finishes at the end of
// the `8 s` broadcast with a feedback pop (`source: 'hazard'`) before recharging.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildPaLureHazard(feature, ctx) {
  const cfg = hazards.paLure;
  const { scene, zombies, effects, sound, events, state } = ctx;
  const cx = cfg.center.x;
  const cz = cfg.center.z;
  const bx = cfg.beaconCenter.x;
  const bz = cfg.beaconCenter.z;
  const rInner = cfg.beaconInnerRadius;
  const rOuter = cfg.beaconRadius;
  const { minX, maxX, minZ, maxZ } = cfg.corridorBounds;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;

  // Dynamic visual group for the pulsing amber speaker beacon ring, corridor floor runner, and ceiling speaker horn (hidden unless active).
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'pa_lure_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 1. Subtle amber corridor floor runner + pulsing speaker beacon ring + crisp outer edge + expanding soundwave ripple.
  const runnerMat = new THREE.MeshBasicMaterial({
    color: cfg.ringColor,
    transparent: true,
    opacity: cfg.runnerOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const runnerGeo = new THREE.PlaneGeometry(spanX, spanZ);
  runnerGeo.rotateX(-Math.PI / 2);
  const floorRunner = new THREE.Mesh(runnerGeo, runnerMat);
  floorRunner.position.set((minX + maxX) / 2, cfg.runnerY, (minZ + maxZ) / 2);
  fieldGroup.add(floorRunner);

  const ringMat = new THREE.MeshBasicMaterial({
    color: cfg.ringColor,
    transparent: true,
    opacity: cfg.ringOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringGeo = new THREE.RingGeometry(rInner, rOuter, 40);
  ringGeo.rotateX(-Math.PI / 2);
  const beaconRing = new THREE.Mesh(ringGeo, ringMat);
  beaconRing.position.set(bx, cfg.ringY, bz);
  fieldGroup.add(beaconRing);

  const edgeMat = new THREE.MeshBasicMaterial({
    color: cfg.ringEdgeColor,
    transparent: true,
    opacity: cfg.edgeOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const edgeGeo = new THREE.RingGeometry(rOuter - 0.1, rOuter, 40);
  edgeGeo.rotateX(-Math.PI / 2);
  const outerEdge = new THREE.Mesh(edgeGeo, edgeMat);
  outerEdge.position.set(bx, cfg.edgeY, bz);
  fieldGroup.add(outerEdge);

  const waveMat = new THREE.MeshBasicMaterial({
    color: cfg.waveColor,
    transparent: true,
    opacity: cfg.waveOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const waveGeo = new THREE.RingGeometry(0.9, 1.0, 40);
  waveGeo.rotateX(-Math.PI / 2);
  const waveRing = new THREE.Mesh(waveGeo, waveMat);
  waveRing.position.set(bx, cfg.waveY, bz);
  fieldGroup.add(waveRing);

  // 2. Overhead ceiling PA speaker horn in the Service Corridor ceiling bay.
  const speakerMat = new THREE.MeshBasicMaterial({
    color: cfg.ringEdgeColor,
    transparent: true,
    opacity: cfg.speakerGlowOpacity,
    depthWrite: false,
  });
  const speakerOrigin = new THREE.Vector3(cfg.speakerPosition.x, cfg.speakerPosition.y, cfg.speakerPosition.z);
  const speakerMesh = new THREE.Mesh(
    new THREE.BoxGeometry(cfg.speakerSize.width, cfg.speakerSize.height, cfg.speakerSize.depth),
    speakerMat,
  );
  speakerMesh.position.copy(speakerOrigin);
  fieldGroup.add(speakerMesh);

  scene.add(fieldGroup);

  // Shared hold source for `zombie.applyHold(lureSource, cfg.holdDuration, lureSource.position)`.
  const lureSource = {
    isAlive: false,
    removed: false,
    position: new THREE.Vector3(cx, cfg.center.y, cz),
  };

  const targetVec = new THREE.Vector3();
  const prevPt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();
  const floorBeamEnd = new THREE.Vector3();
  let waveAge = 0;
  let idleCursor = 0;

  function fireAcousticBeam(from, to, jitterScale = 1) {
    if (!effects?.tracer) return;
    const segs = cfg.beamSegments;
    const jitter = cfg.beamJitter * jitterScale;
    prevPt.copy(from);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      nextPt.lerpVectors(from, to, t);
      if (i < segs) {
        const envelope = Math.sin(t * Math.PI);
        nextPt.x += (Math.random() - 0.5) * 2 * jitter * envelope;
        nextPt.y += (Math.random() - 0.5) * 1.4 * jitter * envelope;
        nextPt.z += (Math.random() - 0.5) * 2 * jitter * envelope;
      }
      effects.tracer(prevPt, nextPt, cfg.ringEdgeColor);
      effects.tracer(prevPt, nextPt, cfg.waveColor);
      prevPt.copy(nextPt);
    }
  }

  function releaseHolds() {
    lureSource.isAlive = false;
    for (const zombie of zombies?.zombies ?? []) {
      if (zombie.hold?.source === lureSource) {
        zombie.hold = null;
      }
    }
  }

  function isInside(pos) {
    if (!pos || Math.abs(pos.y) > cfg.maxHeight) return false;
    return Math.hypot(pos.x - cx, pos.z - cz) <= cfg.radius;
  }

  events?.on('playerDeath', () => {
    releaseHolds();
  });

  const hazard = createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      lureSource.isAlive = true;
      waveAge = 0;
      ringMat.opacity = cfg.ringOpacity;
      runnerMat.opacity = cfg.runnerOpacity;
      speakerMat.opacity = cfg.speakerGlowOpacity;
      waveMat.opacity = cfg.waveOpacity;
    },
    onTick(dt, remaining) {
      waveAge = (waveAge + dt) % cfg.pulseInterval;
      const progress = waveAge / cfg.pulseInterval;
      const rippleR = rInner + (rOuter - rInner) * progress;
      waveRing.scale.set(rippleR, 1, rippleR);
      waveMat.opacity = (1 - progress) * cfg.waveOpacity;

      const pulse = 0.78 + 0.22 * Math.sin(remaining * 20);
      ringMat.opacity = cfg.ringOpacity * pulse;
      runnerMat.opacity = cfg.runnerOpacity * pulse;
      speakerMat.opacity = cfg.speakerGlowOpacity * (0.82 + 0.18 * Math.cos(remaining * 26));
    },
    onPulse() {
      waveAge = 0;
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);
      effects?.flash?.(speakerOrigin, cfg.ringEdgeColor, cfg.flashRadius, cfg.flashDuration);

      // Ambient clearance-chime beams from the ceiling speaker to the corridor floor beacon.
      const idleCount = cfg.idleBeamCount;
      for (let i = 0; i < idleCount; i++) {
        idleCursor = (idleCursor + 0.31) % 1;
        const angle = (i / idleCount + idleCursor) * Math.PI * 2;
        const dist = rInner + 0.15 + ((i + idleCursor) % 1) * (rOuter - rInner - 0.2);
        floorBeamEnd.set(bx + Math.cos(angle) * dist, cfg.waveY, bz + Math.sin(angle) * dist);
        fireAcousticBeam(speakerOrigin, floorBeamEnd, 0.8);
        effects?.splat?.(floorBeamEnd, UP, cfg.hitSparkColors, cfg.idleSparkCount);
      }

      // Hold every live normal zombie in the lure radius in place (bosses ignore applyHold).
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireAcousticBeam(speakerOrigin, targetVec, 1.0);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        zombie.applyHold?.(lureSource, cfg.holdDuration, lureSource.position);
      }
    },
    onStop({ finished } = {}) {
      fieldGroup.visible = false;
      releaseHolds();
      if (!finished || state?.over) return;

      // Final feedback pop at the end of the broadcast window.
      if (cfg.popSound) sound?.play(cfg.popSound);
      effects?.flash?.(speakerOrigin, cfg.waveColor, cfg.popFlashRadius, cfg.popFlashDuration);
      effects?.splat?.(speakerOrigin, UP, cfg.hitSparkColors, cfg.popSparkCount);
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireAcousticBeam(speakerOrigin, targetVec, 1.25);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.popSparkCount);
        effects?.flash?.(targetVec, cfg.ringEdgeColor, cfg.flashRadius, cfg.flashDuration);
        const result = dealHazardDamage(zombie, cfg.popDamage, cfg);
        if (result?.killed) {
          events.emit('paLureKill', { zombie });
        }
      }
    },
  });

  if (cfg.switchOffset) {
    hazard.rig.position.addScaledVector(feature.normal, cfg.switchOffset);
  }

  return hazard;
}
