// =============================================================================
// ELECTRIFIED FOUNTAIN (map feature kind 'fountainHazard', docs/archive/hazards-plan.md):
// Grand Atrium center fountain breaker switch (switch style 'breaker'). Pay to energize the fountain tower, basin,
// waterfall sheets, and conductive floor ring; pulses jagged multi-segment lightning bolts
// (`source: 'hazard'`) that stagger, shock, and convulse-slow zombies (and lightly shock/slow
// a player standing inside the ring), then enters a recharging cooldown.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { closingTime } from '../../config/closingTime.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

export function buildFountainHazard(feature, ctx) {
  const cfg = hazards.fountain;
  const { scene, zombies, effects, sound, events } = ctx;
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
  const ringGeo = new THREE.RingGeometry(r, cfg.radius, cfg.ringSegments);
  ringGeo.rotateX(-Math.PI / 2);
  const floorRing = new THREE.Mesh(ringGeo, ringMat);
  floorRing.position.set(fx, cfg.ringY, fz);
  fieldGroup.add(floorRing);

  const edgeMat = new THREE.MeshBasicMaterial({
    color: cfg.ringEdgeColor,
    transparent: true,
    opacity: cfg.edgeOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const edgeGeo = new THREE.RingGeometry(cfg.radius - cfg.edgeWidth, cfg.radius, cfg.ringSegments);
  edgeGeo.rotateX(-Math.PI / 2);
  const outerEdge = new THREE.Mesh(edgeGeo, edgeMat);
  outerEdge.position.set(fx, cfg.edgeY, fz);
  fieldGroup.add(outerEdge);

  const rippleMat = new THREE.MeshBasicMaterial({
    color: cfg.arcCoreColor,
    transparent: true,
    opacity: cfg.rippleOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const rippleGeo = new THREE.RingGeometry(1 - cfg.rippleWidth, 1.0, cfg.ringSegments);
  rippleGeo.rotateX(-Math.PI / 2);
  const rippleMesh = new THREE.Mesh(rippleGeo, rippleMat);
  rippleMesh.position.set(fx, cfg.rippleY, fz);
  fieldGroup.add(rippleMesh);

  // 2. Energized fountain basin water, upper bowl water, 3.7 m center jet, 4 waterfall sheets, and 4 corner post coronas.
  const waterMat = new THREE.MeshBasicMaterial({
    color: cfg.arcColor,
    transparent: true,
    opacity: cfg.waterGlowOpacity,
    depthWrite: false,
  });
  const gl = cfg.glow;
  const basinSpan = (r - gl.basinInset) * 2;
  const waterGlow = new THREE.Mesh(new THREE.BoxGeometry(basinSpan, gl.basinThickness, basinSpan), waterMat);
  waterGlow.position.set(fx, gl.basinY, fz);
  fieldGroup.add(waterGlow);

  const upperBowlGlow = new THREE.Mesh(new THREE.CylinderGeometry(gl.bowl.radiusTop, gl.bowl.radiusBottom, gl.bowl.height, 18), waterMat);
  upperBowlGlow.position.set(fx, gl.bowl.y, fz);
  fieldGroup.add(upperBowlGlow);

  const jetMat = new THREE.MeshBasicMaterial({
    color: cfg.arcCoreColor,
    transparent: true,
    opacity: cfg.jetGlowOpacity,
    depthWrite: false,
  });
  const centerJetGlow = new THREE.Mesh(new THREE.CylinderGeometry(gl.jet.radiusTop, gl.jet.radiusBottom, gl.jet.height, 12), jetMat);
  centerJetGlow.position.set(fx, gl.jet.y, fz);
  fieldGroup.add(centerJetGlow);

  // Four vertical overflow waterfall sheets around the lower bowl (matching atrium.js lines 172-174).
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const sx = dz ? gl.sheets.width : gl.sheets.thickness;
    const sz = dx ? gl.sheets.width : gl.sheets.thickness;
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(sx, gl.sheets.height, sz), waterMat);
    sheet.position.set(fx + dx * gl.sheets.offset, gl.sheets.y, fz + dz * gl.sheets.offset);
    fieldGroup.add(sheet);
  }

  // Four corner brass post plasma nodes at (fx ± r, 2.24, fz ± r).
  const cornerPosts = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Vector3(fx + sx * r, cfg.cornerPostY, fz + sz * r);
    cornerPosts.push(p);
    const node = new THREE.Mesh(new THREE.BoxGeometry(gl.cornerNodeSize, gl.cornerNodeSize, gl.cornerNodeSize), jetMat);
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
    const segs = cfg.arcSegments;
    const jitter = cfg.arcJitter * jitterScale;
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
            cfg.arcForkLength * jitterScale,
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
    // Closing Time's line 1: while Murray's Key Ring is held and the line is open, the switch shows the count (both run modes).
    note: () => {
      const progress = ctx.closing?.dutyProgress('janitor');
      return progress ? closingTime.lines.janitor.promptCount(progress) : null;
    },
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
      rippleMat.opacity = (1 - progress) * cfg.rippleOpacity;

      const sh = cfg.shimmer;
      const wave = sh.base + sh.amplitude * Math.sin(remaining * sh.speed);
      ringMat.opacity = cfg.ringOpacity * wave;
      waterMat.opacity = cfg.waterGlowOpacity * wave;
      const jf = cfg.jetFlicker;
      jetMat.opacity = cfg.jetGlowOpacity * (jf.base + jf.amplitude * Math.cos(remaining * jf.speed));
    },
    onPulse(isOpening) {
      rippleAge = 0;
      effects?.flash?.(spoutOrigin, cfg.arcColor, { size: cfg.flashRadius, seconds: cfg.flashDuration });
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);

      // Ambient crackling bolts from the spout & corner brass posts to the wet floor ring.
      const idleCount = cfg.idleArcCount;
      for (let i = 0; i < idleCount; i++) {
        idleAngle += cfg.idleArcTurn.base + Math.random() * cfg.idleArcTurn.random;
        const dist = r + 0.5 + ((i + 0.35) / idleCount) * (cfg.radius - r - 0.7);
        floorArcEnd.set(fx + Math.cos(idleAngle) * dist, 0.06, fz + Math.sin(idleAngle) * dist);
        const from = i === 0 ? spoutOrigin : cornerPosts[i % cornerPosts.length];
        fireJaggedBolt(from, floorArcEnd, 0.75);
        effects?.splat?.(floorArcEnd, UP, cfg.hitSparkColors, cfg.idleSparkCount);
      }

      // Shock, convulse-slow, and stagger every live zombie in the energized ring.
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireJaggedBolt(spoutOrigin, targetVec, 1.0);
        fireJaggedBolt(nearestCornerPost(zombie.position), targetVec, 0.7);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        effects?.flash?.(targetVec, cfg.arcColor, { size: cfg.hitFlashRadius, seconds: cfg.hitFlashDuration });
        if (isOpening && cfg.openingSurge) {
          zombie.staggerAway?.(centerGround, cfg.openingSurge);
        }
        zombie.applySlow?.(cfg.slowDuration, cfg.slowFactor, 'shock');
        if (dealHazardDamage(zombie, cfg.zombieDamage, cfg)?.killed) {
          events.emit('fountainKill', { zombie });
        }
      }
    },
    onStop() {
      fieldGroup.visible = false;
    },
  });
}
