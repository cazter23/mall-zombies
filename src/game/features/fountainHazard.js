// =============================================================================
// ELECTRIFIED FOUNTAIN (map feature kind 'fountainHazard', docs/hazards-plan.md):
// Grand Atrium center fountain breaker switch. Pay to energize the basin and its surrounding
// conductive floor ring; pulses electric arcs (`source: 'hazard'`) that shock and slow zombies
// (and lightly shock/slow a player standing inside the ring), then enters a recharging cooldown.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

export function buildFountainHazard(feature, ctx) {
  const cfg = hazards.fountain;
  const { scene, zombies, effects, sound } = ctx;

  // Dynamic visual group for the energized water glow and floor ring (hidden unless active).
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'fountain_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  const ringMat = new THREE.MeshBasicMaterial({
    color: cfg.ringColor,
    transparent: true,
    opacity: cfg.ringOpacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ringGeo = new THREE.RingGeometry(cfg.innerRadius, cfg.radius, 36);
  ringGeo.rotateX(-Math.PI / 2);
  const floorRing = new THREE.Mesh(ringGeo, ringMat);
  floorRing.position.set(cfg.center.x, 0.03, cfg.center.z);
  fieldGroup.add(floorRing);

  const waterMat = new THREE.MeshBasicMaterial({
    color: cfg.arcColor,
    transparent: true,
    opacity: cfg.waterGlowOpacity,
    depthWrite: false,
  });
  const basinSpan = (cfg.innerRadius - 0.25) * 2;
  const waterGlow = new THREE.Mesh(
    new THREE.BoxGeometry(basinSpan, 0.04, basinSpan),
    waterMat,
  );
  waterGlow.position.set(cfg.center.x, cfg.center.y + 0.06, cfg.center.z);
  fieldGroup.add(waterGlow);

  scene.add(fieldGroup);

  const arcOrigin = new THREE.Vector3(cfg.center.x, cfg.arcOriginY, cfg.center.z);
  const arcTarget = new THREE.Vector3();

  function isInside(pos) {
    if (!pos || Math.abs(pos.y) > 1.2) return false;
    return Math.hypot(pos.x - cfg.center.x, pos.z - cfg.center.z) <= cfg.radius;
  }

  return createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      ringMat.opacity = cfg.ringOpacity;
      waterMat.opacity = cfg.waterGlowOpacity;
    },
    onTick(dt, remaining) {
      const wave = 0.75 + 0.25 * Math.sin(remaining * 16);
      ringMat.opacity = cfg.ringOpacity * wave;
      waterMat.opacity = cfg.waterGlowOpacity * wave;
    },
    onPulse() {
      effects?.flash?.(arcOrigin, cfg.arcColor, cfg.flashRadius, cfg.flashDuration);
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        arcTarget.set(zombie.position.x, zombie.position.y + 0.9, zombie.position.z);
        effects?.tracer?.(arcOrigin, arcTarget, cfg.arcColor);
        zombie.applySlow?.(cfg.slowDuration, cfg.slowFactor, 'shock');
        dealHazardDamage(zombie, cfg.zombieDamage, cfg);
      }
    },
    onStop() {
      fieldGroup.visible = false;
    },
  });
}
