// =============================================================================
// AIM: hip-fire spread + aim down sights (ADS)
// Runs on the fixed tick, before the weapon fires.
//
// Spread is a cone around the crosshair (half-angle in degrees). It grows when
// moving, airborne or firing quickly, and recovers smoothly when you stop.
// ADS (hold feel.ads.key) eases in/out over def.ads.seconds, shrinks spread,
// zooms the camera, slows walking and blocks sprinting. Pressing sprint while
// aiming cancels ADS until the aim key is pressed again (the COD way).
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

const DEG_TO_RAD = Math.PI / 180;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);

// Smooth start and stop for the ADS transition (0..1 -> 0..1).
const ease = (t) => t * t * (3 - 2 * t);

export function createAim({ def, input, player }) {
  const s = def.spread;
  let amount = 0; // linear ADS progress, 0 = hip, 1 = fully aimed
  let prevAmount = 0; // last tick's value, for smooth rendering between ticks
  let cancelledBySprint = false;
  let movementSpread = s.base; // smoothed base + moving + airborne part (degrees)
  let bloom = 0; // extra spread from firing quickly (degrees)

  const right = new THREE.Vector3();
  const up = new THREE.Vector3();

  return {
    // True while the aim key is held (and not cancelled by sprinting).
    isAiming: false,

    // Eased ADS amount (0..1) for gameplay this tick.
    get amount() {
      return ease(amount);
    },

    // Eased ADS amount interpolated between ticks, for the camera zoom and gun position.
    renderAmount(alpha) {
      return ease(prevAmount + (amount - prevAmount) * alpha);
    },

    // Current cone half-angle in degrees (what the next shot will use).
    get spreadDegrees() {
      return (movementSpread + bloom) * (1 + (s.adsMultiplier - 1) * ease(amount));
    },

    update(dt) {
      // --- ADS ---
      const key = feel.ads.key;
      const held = input.isDown(key);
      if (input.consumePress(key) || !held) cancelledBySprint = false; // a fresh press re-enables aiming
      const sprintPressed =
        (input.wasPressed('ShiftLeft') || input.wasPressed('ShiftRight')) && input.isDown('KeyW');
      if (held && sprintPressed) cancelledBySprint = true;

      this.isAiming = held && !cancelledBySprint;
      prevAmount = amount;
      amount += ((this.isAiming ? 1 : -1) * dt) / def.ads.seconds;
      amount = Math.max(0, Math.min(1, amount));

      // The controller reads these on its next tick (blocks sprint, slows walking).
      player.isAiming = this.isAiming;
      player.aimAmount = ease(amount);

      // --- Spread ---
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const movingFactor = Math.min(speed / player.stats.walkSpeed, s.maxMovingFactor);
      const target = s.base + s.moving * movingFactor + (player.grounded ? 0 : s.airborne);
      movementSpread += (target - movementSpread) * Math.min(1, s.smoothing * dt);
      bloom = Math.max(0, bloom - s.bloomRecovery * dt);
    },

    // Call after each shot: rapid firing widens the cone.
    onShot() {
      bloom = Math.min(s.maxBloom, bloom + s.perShot);
    },

    // Nudges `direction` (unit vector) to a random point inside the current cone.
    // Points are spread evenly over the crosshair circle, so the gap shows the real cone.
    applySpread(direction) {
      const halfAngle = this.spreadDegrees * DEG_TO_RAD;
      if (halfAngle <= 0) return direction;
      const radius = Math.tan(halfAngle) * Math.sqrt(Math.random());
      const angle = Math.random() * Math.PI * 2;
      right.crossVectors(direction, Math.abs(direction.y) > 0.99 ? WORLD_RIGHT : WORLD_UP).normalize();
      up.crossVectors(right, direction);
      return direction
        .addScaledVector(right, radius * Math.cos(angle))
        .addScaledVector(up, radius * Math.sin(angle))
        .normalize();
    },
  };
}
