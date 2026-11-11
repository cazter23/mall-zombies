// =============================================================================
// PA SYSTEM LURE (map feature kind 'paLureHazard', docs/archive/hazards-plan.md):
// Service Corridor west wall paging panel (switch style 'paging', `(-23.1, 1.35, -4.5)`).
// Pay to broadcast a clearance chime from the overhead corridor speaker (`(-21.5, -4.5)`,
// `10 m` radius); pulses every `0.5 s` to transfix normal zombies in place with
// `applyHold(lureSource, 1.2)` (bosses ignore `applyHold`), then finishes at the end of
// the `8 s` broadcast with a feedback pop (`source: 'hazard'`) before recharging.
// Looks: the ceiling speaker horn is always there and its mouth glows while it broadcasts; sound waves run out along
// the floor to the lure's real reach (the same `radius` that holds zombies, so they pass under walls into the rooms
// next door, as the hold does); a spinning sale tag floats over every shopper it holds (one instanced mesh);
// the beacon ring and corridor runner pulse. No lights.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

function floorMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
}

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
  const speakerOrigin = new THREE.Vector3(cfg.speakerPosition.x, cfg.speakerPosition.y, cfg.speakerPosition.z);

  // 1. The ceiling speaker horn, always mounted: a bracket from the ceiling, the driver can, and the flared horn
  //    tilted down the corridor.
  const hn = cfg.horn;
  const hornRig = new THREE.Group();
  hornRig.name = 'pa_lure_speaker';
  hornRig.userData.dynamic = true; // (its mouth glow is switched on and off)
  hornRig.position.copy(speakerOrigin);
  const hornMat = new THREE.MeshLambertMaterial({ color: hn.color });
  const bracketH = cfg.ceilingY - speakerOrigin.y - 0.005;
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.04, bracketH, 0.04), hornMat);
  bracket.position.y = bracketH / 2;
  hornRig.add(bracket);
  const hornBody = new THREE.Group();
  hornBody.rotation.x = hn.tilt; // (leaning its mouth down and along the corridor)
  const driver = new THREE.Mesh(new THREE.CylinderGeometry(hn.driverRadius, hn.driverRadius, hn.driverHeight, hn.segments), hornMat);
  driver.position.y = -hn.driverHeight / 2;
  hornBody.add(driver);
  const horn = new THREE.Mesh(new THREE.CylinderGeometry(hn.throatRadius, hn.mouthRadius, hn.length, hn.segments, 1, true), new THREE.MeshLambertMaterial({ color: hn.color, side: THREE.DoubleSide }));
  horn.position.y = -hn.driverHeight - hn.length / 2;
  hornBody.add(horn);
  const mouthMat = new THREE.MeshBasicMaterial({ color: cfg.ringEdgeColor, transparent: true, opacity: cfg.speakerGlowOpacity, depthWrite: false, side: THREE.DoubleSide });
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(hn.mouthRadius * 0.92, hn.segments), mouthMat);
  mouth.rotation.x = Math.PI / 2;
  mouth.position.y = -hn.driverHeight - hn.length + 0.01;
  mouth.visible = false;
  hornBody.add(mouth);
  hornRig.add(hornBody);
  scene.add(hornRig);

  // Everything the broadcast shows on the floor, hidden unless it is on air.
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'pa_lure_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 2. Corridor runner, the beacon ring under the speaker with its edge, and a ripple running out from it.
  const runnerMat = floorMaterial(cfg.ringColor, cfg.runnerOpacity);
  const runnerGeo = new THREE.PlaneGeometry(maxX - minX, maxZ - minZ);
  runnerGeo.rotateX(-Math.PI / 2);
  const floorRunner = new THREE.Mesh(runnerGeo, runnerMat);
  floorRunner.position.set((minX + maxX) / 2, cfg.runnerY, (minZ + maxZ) / 2);
  fieldGroup.add(floorRunner);

  const ringMat = floorMaterial(cfg.ringColor, cfg.ringOpacity);
  const ringGeo = new THREE.RingGeometry(rInner, rOuter, cfg.ringSegments);
  ringGeo.rotateX(-Math.PI / 2);
  const beaconRing = new THREE.Mesh(ringGeo, ringMat);
  beaconRing.position.set(bx, cfg.ringY, bz);
  fieldGroup.add(beaconRing);

  const edgeGeo = new THREE.RingGeometry(rOuter - cfg.edgeWidth, rOuter, cfg.ringSegments);
  edgeGeo.rotateX(-Math.PI / 2);
  const outerEdge = new THREE.Mesh(edgeGeo, floorMaterial(cfg.ringEdgeColor, cfg.edgeOpacity));
  outerEdge.position.set(bx, cfg.edgeY, bz);
  fieldGroup.add(outerEdge);

  const waveMat = floorMaterial(cfg.waveColor, cfg.waveOpacity);
  const waveGeo = new THREE.RingGeometry(1 - cfg.rippleWidth, 1, cfg.ringSegments);
  waveGeo.rotateX(-Math.PI / 2);
  const waveRing = new THREE.Mesh(waveGeo, waveMat);
  waveRing.position.set(bx, cfg.waveY, bz);
  fieldGroup.add(waveRing);

  // 3. Sound waves out to the lure's reach: `count` thin rings from the speaker to `radius`, staggered, fading as they go.
  const rw = cfg.reachWaves;
  const reachGeo = new THREE.RingGeometry(1 - rw.width, 1, rw.segments);
  reachGeo.rotateX(-Math.PI / 2);
  const reachWaves = Array.from({ length: rw.count }, () => {
    const mat = floorMaterial(cfg.ringEdgeColor, rw.opacity);
    const mesh = new THREE.Mesh(reachGeo, mat);
    mesh.position.set(cx, rw.y, cz);
    fieldGroup.add(mesh);
    return { mesh, mat };
  });

  // 4. A spinning sale tag over every shopper the lure holds.
  const tg = cfg.tags;
  // (two tags crossed at right angles, so it never turns edge-on to the camera as it spins)
  const tagFace = new THREE.BoxGeometry(tg.width, tg.height, tg.depth);
  const tagCross = new THREE.BoxGeometry(tg.width, tg.height, tg.depth).rotateY(Math.PI / 2);
  const tagGeometry = mergeGeometries([tagFace, tagCross], false);
  tagFace.dispose();
  tagCross.dispose();
  const tags = new THREE.InstancedMesh(tagGeometry, new THREE.MeshBasicMaterial({ color: tg.color }), tg.max);
  tags.name = 'pa_lure_tags';
  tags.frustumCulled = false; // (instances float over held zombies; the base geometry sits at the origin)
  tags.count = 0;
  fieldGroup.add(tags);

  scene.add(fieldGroup);

  // Shared hold source for `zombie.applyHold(lureSource, cfg.holdDuration, lureSource.position)`.
  const lureSource = {
    isAlive: false,
    removed: false,
    position: new THREE.Vector3(cx, cfg.center.y, cz),
  };

  const dummy = new THREE.Object3D();
  const targetVec = new THREE.Vector3();
  const prevPt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();
  const floorBeamEnd = new THREE.Vector3();
  let waveAge = 0;
  let idleCursor = 0;
  let time = 0;

  function animateReachAndTags() {
    reachWaves.forEach(({ mesh, mat }, i) => {
      const t = ((time / rw.sweepSeconds) + i / rw.count) % 1;
      const radius = Math.max(0.01, t * cfg.radius);
      mesh.scale.set(radius, 1, radius);
      mat.opacity = rw.opacity * (1 - t);
    });
    let n = 0;
    for (const zombie of zombies?.zombies ?? []) {
      if (n >= tg.max) break;
      if (!zombie.isAlive || zombie.hold?.source !== lureSource) continue;
      const bob = Math.sin((time * tg.bobHz + n * 0.3) * Math.PI * 2) * tg.bob;
      dummy.position.set(zombie.position.x, zombie.position.y + (zombie.type?.height ?? 1.8) + tg.above + bob, zombie.position.z);
      dummy.rotation.set(0, time * tg.spinPerSecond + n, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      tags.setMatrixAt(n, dummy.matrix);
      n += 1;
    }
    tags.count = n;
    tags.instanceMatrix.needsUpdate = true;
  }

  /** Fires a multi-segment acoustic beam from the ceiling speaker to `to`. */
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
    tags.count = 0;
  }

  function isInside(pos) {
    if (!pos || Math.abs(pos.y) > cfg.maxHeight) return false;
    return Math.hypot(pos.x - cx, pos.z - cz) <= cfg.radius;
  }

  events?.on('playerDeath', () => {
    releaseHolds();
  });

  return createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      mouth.visible = true;
      lureSource.isAlive = true;
      waveAge = 0;
      ringMat.opacity = cfg.ringOpacity;
      runnerMat.opacity = cfg.runnerOpacity;
      mouthMat.opacity = cfg.speakerGlowOpacity;
      waveMat.opacity = cfg.waveOpacity;
      animateReachAndTags();
    },
    onTick(dt, remaining) {
      time += dt;
      waveAge = (waveAge + dt) % cfg.pulseInterval;
      const progress = waveAge / cfg.pulseInterval;
      const rippleR = rInner + (rOuter - rInner) * progress;
      waveRing.scale.set(rippleR, 1, rippleR);
      waveMat.opacity = (1 - progress) * cfg.waveOpacity;
      const w = cfg.pulseWobble;
      const pulse = w.base + w.amplitude * Math.sin(remaining * w.speed);
      ringMat.opacity = cfg.ringOpacity * pulse;
      runnerMat.opacity = cfg.runnerOpacity * pulse;
      const s = cfg.speakerWobble;
      mouthMat.opacity = cfg.speakerGlowOpacity * (s.base + s.amplitude * Math.cos(remaining * s.speed));
      animateReachAndTags();
    },
    onPulse() {
      waveAge = 0;
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);
      effects?.flash?.(speakerOrigin, cfg.ringEdgeColor, { size: cfg.flashRadius, seconds: cfg.flashDuration });

      // Ambient clearance-chime beams from the ceiling speaker to the corridor floor beacon.
      for (let i = 0; i < cfg.idleBeamCount; i++) {
        idleCursor = (idleCursor + 0.31) % 1;
        const angle = (i / cfg.idleBeamCount + idleCursor) * Math.PI * 2;
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
      mouth.visible = false;
      releaseHolds();
      if (!finished || state?.over) return;

      // Final feedback pop at the end of the broadcast window.
      if (cfg.popSound) sound?.play(cfg.popSound);
      effects?.flash?.(speakerOrigin, cfg.waveColor, { size: cfg.popFlashRadius, seconds: cfg.popFlashDuration });
      effects?.splat?.(speakerOrigin, UP, cfg.hitSparkColors, cfg.popSparkCount);
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireAcousticBeam(speakerOrigin, targetVec, 1.25);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.popSparkCount);
        effects?.flash?.(targetVec, cfg.ringEdgeColor, { size: cfg.flashRadius, seconds: cfg.flashDuration });
        const result = dealHazardDamage(zombie, cfg.popDamage, cfg);
        if (result?.killed) {
          events.emit('paLureKill', { zombie });
        }
      }
    },
  });
}
