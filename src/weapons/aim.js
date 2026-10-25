// =============================================================================
// AIM: hip-fire spread + aim down sights (ADS)
// Runs on the fixed tick, before the weapon fires.
//
// Spread is a cone around the crosshair (half-angle in degrees). It grows when
// moving, airborne or firing quickly, and recovers smoothly when you stop.
// ADS (hold the 'aim' action) eases in/out over def.ads.seconds, shrinks spread,
// zooms the camera, slows walking and blocks sprinting. Pressing sprint while
// aiming cancels ADS until the aim key is pressed again (the COD way).
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

const DEG_TO_RAD = Math.PI / 180;
const WORLD_UP = new THREE.Vector3(0, 1, 0);
const WORLD_RIGHT = new THREE.Vector3(1, 0, 0);
const coneRight = new THREE.Vector3();
const coneUp = new THREE.Vector3();

/** Uniform random offset in a cone; modifies the unit direction in place. */
export function applyConeSpread(direction, degrees) {
  const halfAngle = degrees * DEG_TO_RAD;
  if (halfAngle <= 0) return direction;
  const radius = Math.tan(halfAngle) * Math.sqrt(Math.random());
  const angle = Math.random() * Math.PI * 2;
  coneRight.crossVectors(direction, Math.abs(direction.y) > 0.99 ? WORLD_RIGHT : WORLD_UP).normalize();
  coneUp.crossVectors(coneRight, direction);
  return direction.addScaledVector(coneRight, radius * Math.cos(angle))
    .addScaledVector(coneUp, radius * Math.sin(angle)).normalize();
}

// ADS blends the pellet cone independently of the gun's ordinary bloom/spread.
export function pelletSpreadDegrees(def, aimAmount) {
  const p = def.pellets;
  return p ? p.spreadDegrees * (1 + ((p.adsMultiplier ?? 0.5) - 1) * aimAmount) : 0;
}

// Smooth start and stop for the ADS transition (0..1 -> 0..1).
const ease = (t) => t * t * (3 - 2 * t);

export function createAim({ def, input, player }) {
  let s = def.spread; // (both replaced by setDef when the gun's stats change)
  let amount = 0; // linear ADS progress, 0 = hip, 1 = fully aimed
  let prevAmount = 0; // last tick's value, for smooth rendering between ticks
  let cancelledBySprint = false;
  let movementSpread = s.base; // smoothed base + moving + airborne part (degrees)
  let bloom = 0; // extra spread from firing quickly (degrees)
  let bloomRecoveryTimer = 0; // seconds before bloom can recover after the latest shot


  return {
    // True while the aim key is held (and not cancelled by sprinting).
    isAiming: false,
    justStartedAiming: false, // true on the tick ADS begins

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

    // `allowAim` false (e.g. mid weapon switch): hip fire this tick even if the aim button is held.
    update(dt, allowAim = true) {
      // --- ADS ---
      const held = input.actionDown('aim') && allowAim;
      if (input.consumeAction('aim') || !held) cancelledBySprint = false; // a fresh press re-enables aiming
      const sprintPressed = input.actionPressed('sprint') && input.moveAxis().y > 0;
      if (held && sprintPressed) cancelledBySprint = true;

      const wasAiming = this.isAiming;
      this.isAiming = held && !cancelledBySprint;
      this.justStartedAiming = this.isAiming && !wasAiming; // for aim assist's ADS snap
      prevAmount = amount;
      amount += ((this.isAiming ? 1 : -1) * dt) / def.ads.seconds;
      amount = Math.max(0, Math.min(1, amount));

      // The controller reads these on its next tick (blocks sprint, slows walking).
      player.isAiming = this.isAiming;
      player.aimAmount = ease(amount);
      player.aimMoveMultiplier = def.ads.moveSpeedMultiplier ?? 1;

      // --- Spread ---
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const movingFactor = Math.min(speed / player.stats.walkSpeed, s.maxMovingFactor);
      const target = s.base + s.moving * movingFactor + (player.grounded ? 0 : s.airborne);
      movementSpread += (target - movementSpread) * Math.min(1, s.smoothing * dt);
      // Only the part of this tick after the delay expires can recover bloom.
      const recoveryTime = Math.max(0, dt - bloomRecoveryTimer);
      bloomRecoveryTimer = Math.max(0, bloomRecoveryTimer - dt);
      bloom = Math.max(0, bloom - s.bloomRecovery * recoveryTime);
    },

    // The gun's stats changed (an upgrade): read the new spread/ADS numbers from now on.
    setDef(newDef) {
      def = newDef;
      s = newDef.spread;
      movementSpread = s.base; // takes effect now, not after the smoothing catches up
    },

    // New run: hip fire, resting spread.
    reset() {
      amount = 0;
      prevAmount = 0;
      cancelledBySprint = false;
      movementSpread = s.base;
      bloom = 0;
      bloomRecoveryTimer = 0;
      this.isAiming = false;
      this.justStartedAiming = false;
      player.isAiming = false;
      player.aimAmount = 0;
      player.aimMoveMultiplier = 1;
    },

    // Call after each shot: rapid firing widens the cone.
    onShot() {
      bloom = Math.min(s.maxBloom, bloom + s.perShot);
      bloomRecoveryTimer = s.bloomRecoveryDelay ?? 0;
    },

    // Nudges `direction` (unit vector) to a random point inside the current cone.
    // Points are spread evenly over the crosshair circle, so the gap shows the real cone.
    applySpread(direction) {
      return applyConeSpread(direction, this.spreadDegrees);
    },
  };
}
