// =============================================================================
// ELECTRIFIED FOUNTAIN (map feature kind 'fountainHazard', docs/hazards-plan.md):
// Grand Atrium center fountain breaker switch. Pay to energize the fountain tower, basin,
// waterfall sheets, and conductive floor ring; pulses jagged multi-segment lightning bolts
// (`source: 'hazard'`) that stagger, shock, and convulse-slow zombies (and lightly shock/slow
// a player standing inside the ring), then enters a recharging cooldown.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildFountainHazard(feature, ctx) {
  const cfg = hazards.fountain;
  const { scene, zombies, effects, sound } = ctx;
  const fx = cfg.center.x;
  const fz = cfg.center.z;
  const r = cfg.innerRadius;

  // Dynamic visual group for the energized fountain tower, water sheets, and floor rings (hidden unless active).
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'fountain_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 1. Conductive wet floor apron + crisp outer neon perimeter ring + expanding shockwave ripple.
  const ringMat = new THREE.MeshBasicMaterial({
    color: cfg.ringColor,
    transparent: true,
    opacity: cfg.ringOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringGeo = new THREE.RingGeometry(r, cfg.radius, 48);
  ringGeo.rotateX(-Math.PI / 2);
  const floorRing = new THREE.Mesh(ringGeo, ringMat);
  floorRing.position.set(fx, 0.03, fz);
  fieldGroup.add(floorRing);

  const edgeMat = new THREE.MeshBasicMaterial({
    color: cfg.ringEdgeColor,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const edgeGeo = new THREE.RingGeometry(cfg.radius - 0.14, cfg.radius, 48);
  edgeGeo.rotateX(-Math.PI / 2);
  const outerEdge = new THREE.Mesh(edgeGeo, edgeMat);
  outerEdge.position.set(fx, 0.035, fz);
  fieldGroup.add(outerEdge);

  const rippleMat = new THREE.MeshBasicMaterial({
    color: cfg.arcCoreColor,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rippleGeo = new THREE.RingGeometry(0.94, 1.0, 48);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
  rippleMesh.position.set(fx, 0.04, fz);
  fieldGroup.add(rippleMesh);

  // 2. Energized fountain basin water, upper bowl water, 3.7 m center jet, 4 waterfall sheets, and 4 corner post coronas.
  const waterMat = new THREE.MeshBasicMaterial({
    color: cfg.arcColor,
    transparent: true,
    opacity: cfg.waterGlowOpacity,
    depthWrite: false,
  });
  const basinSpan = (r - 0.28) * 2;
  const waterGlow = new THREE.Mesh(new THREE.BoxGeometry(basinSpan, 0.045, basinSpan), waterMat);
  waterGlow.position.set(fx, 1.08, fz);
  fieldGroup.add(waterGlow);

  const upperBowlGlow = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.24, 0.04, 18), waterMat);
  upperBowlGlow.position.set(fx, 2.48, fz);
  fieldGroup.add(upperBowlGlow);

  const jetMat = new THREE.MeshBasicMaterial({
    color: cfg.arcCoreColor,
    transparent: true,
    opacity: cfg.jetGlowOpacity,
    depthWrite: false,
  });
  const centerJetGlow = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 1.32, 12), jetMat);
  centerJetGlow.position.set(fx, 3.12, fz);
  fieldGroup.add(centerJetGlow);

  // Four vertical overflow waterfall sheets around the lower bowl (matching atrium.js lines 172-174).
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const sx = dz ? 0.74 : 0.07;
    const sz = dx ? 0.74 : 0.07;
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(sx, 1.15, sz), waterMat);
    sheet.position.set(fx + dx * 1.3, 1.64, fz + dz * 1.3);
    fieldGroup.add(sheet);
  }

  // Four corner brass post plasma nodes at (fx ± r, 2.24, fz ± r).
  const cornerPosts = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Vector3(fx + sx * r, cfg.cornerPostY, fz + sz * r);
    cornerPosts.push(p);
    const node = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), jetMat);
    node.position.copy(p);
    fieldGroup.add(node);
  }

  scene.add(fieldGroup);

  const centerGround = new THREE.Vector3(fx, 0, fz);
  const spoutOrigin = new THREE.Vector3(fx, cfg.arcOriginY, fz);
  const targetVec = new THREE.Vector3();
  const prevPt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();
  const forkPt = new THREE.Vector3();
  const floorArcEnd = new THREE.Vector3();
  let rippleAge = 0;
  let idleAngle = 0;

  /** Fires a jagged multi-segment lightning bolt (with a forked side branch) from `from` to `to`. */
  function fireJaggedBolt(from, to, jitterScale = 1) {
    if (!effects?.tracer) return;
    const segs = cfg.arcSegments ?? 4;
    const jitter = (cfg.arcJitter ?? 0.4) * jitterScale;
    prevPt.copy(from);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      nextPt.lerpVectors(from, to, t);
      if (i < segs) {
        const envelope = Math.sin(t * Math.PI);
        nextPt.x += (Math.random() - 0.5) * 2 * jitter * envelope;
        nextPt.y += (Math.random() - 0.35) * 1.6 * jitter * envelope;
        nextPt.z += (Math.random() - 0.5) * 2 * jitter * envelope;
        if (i === Math.ceil(segs / 2)) {
          forkPt.copy(nextPt).addScaledVector(
            new THREE.Vector3(Math.random() - 0.5, -0.35, Math.random() - 0.5).normalize(),
            0.75 * jitterScale,
          );
          effects.tracer(nextPt, forkPt, cfg.arcColor);
        }
      }
      effects.tracer(prevPt, nextPt, cfg.arcColor);
      effects.tracer(prevPt, nextPt, cfg.arcCoreColor);
      prevPt.copy(nextPt);
    }
  }

  function nearestCornerPost(pos) {
    let best = cornerPosts[0];
    let bestD = Infinity;
    for (const p of cornerPosts) {
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function isInside(pos) {
    if (!pos || Math.abs(pos.y) > 1.2) return false;
    return Math.hypot(pos.x - fx, pos.z - fz) <= cfg.radius;
  }

  return createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      rippleAge = 0;
      ringMat.opacity = cfg.ringOpacity;
      waterMat.opacity = cfg.waterGlowOpacity;
      jetMat.opacity = cfg.jetGlowOpacity;
    },
    onTick(dt, remaining) {
      rippleAge = (rippleAge + dt) % cfg.pulseInterval;
      const progress = rippleAge / cfg.pulseInterval;
      const rippleR = r + (cfg.radius - r) * progress;
      rippleMesh.scale.set(rippleR, 1, rippleR);
      rippleMat.opacity = (1 - progress) * 0.85;

      const wave = 0.78 + 0.22 * Math.sin(remaining * 22);
      ringMat.opacity = cfg.ringOpacity * wave;
      waterMat.opacity = cfg.waterGlowOpacity * wave;
      jetMat.opacity = cfg.jetGlowOpacity * (0.85 + 0.15 * Math.cos(remaining * 30));
    },
    onPulse(isOpening) {
      rippleAge = 0;
      effects?.flash?.(spoutOrigin, cfg.arcColor, cfg.flashRadius, cfg.flashDuration);
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);

      // Ambient crackling bolts from the spout & corner brass posts to the wet floor ring.
      const idleCount = cfg.idleArcCount ?? 3;
      for (let i = 0; i < idleCount; i++) {
        idleAngle += 2.15 + Math.random() * 0.4;
        const dist = r + 0.5 + ((i + 0.35) / idleCount) * (cfg.radius - r - 0.7);
        floorArcEnd.set(fx + Math.cos(idleAngle) * dist, 0.06, fz + Math.sin(idleAngle) * dist);
        const from = i === 0 ? spoutOrigin : cornerPosts[i % cornerPosts.length];
        fireJaggedBolt(from, floorArcEnd, 0.75);
        effects?.splat?.(floorArcEnd, UP, cfg.hitSparkColors, 4);
      }

      // Shock, convulse-slow, and stagger every live zombie in the energized ring.
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + 0.95, zombie.position.z);
        fireJaggedBolt(spoutOrigin, targetVec, 1.0);
        fireJaggedBolt(nearestCornerPost(zombie.position), targetVec, 0.7);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        effects?.flash?.(targetVec, cfg.arcColor, 1.25, 0.12);
        if (isOpening && cfg.openingSurge) {
          zombie.staggerAway?.(centerGround, cfg.openingSurge);
        }
        zombie.applySlow?.(cfg.slowDuration, cfg.slowFactor, 'shock');
        dealHazardDamage(zombie, cfg.zombieDamage, cfg);
      }
    },
    onStop() {
      fieldGroup.visible = false;
    },
  });
}
