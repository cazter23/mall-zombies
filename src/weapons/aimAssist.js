// =============================================================================
// AIM ASSIST (controller only)
// Three COD-style helpers, all aimed at the target's CHEST so headshots stay a skill:
//   1) Slowdown:   stick look slows when the crosshair is on/near a zombie.
//   2) Rotational: while you're using a stick, your aim follows part of the
//                  target's movement across your view (it never moves a still aim).
//   3) ADS snap:   pressing aim near a zombie nudges you part of the way to it,
//                  with a cooldown so tapping aim can't be spammed.
// Targets must be alive, finished spawning, in range, and visible (no walls).
// Never active for mouse/keyboard (input.device). Strengths: config/controls.js.
// Runs on the fixed tick (before the gun fires); the slowdown is read every frame.
// =============================================================================

import * as THREE from 'three';
import { aimAssist as cfg } from '../config/controls.js';
import { castShot } from './hitscan.js';

const DEG_TO_RAD = Math.PI / 180;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** Can aim assist ever help toward this shootable? Not a dead or spawning one, and never one flagged ignoreAimAssist (Sunny). */
export const assistable = (shootable) => shootable.isAlive && shootable.state !== 'spawning' && !shootable.ignoreAimAssist;

export function createAimAssist({ player, input, shootables, colliders }) {
  let target = null; // the shootable currently being assisted
  let prevYaw = 0; // that target's direction last tick (to measure its movement across the view)
  let prevPitch = 0;
  let snapCooldown = 0;
  let slowdown = 1;

  const eye = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const chest = new THREE.Vector3();
  const toChest = new THREE.Vector3();

  function chestOf(shootable, out) {
    const body = shootable.hitboxes.find((h) => h.part === 'body') || shootable.hitboxes[0];
    const b = body.box;
    return out.set(
      (b.min.x + b.max.x) / 2,
      b.min.y + (b.max.y - b.min.y) * cfg.chestHeightFraction,
      (b.min.z + b.max.z) / 2,
    );
  }

  // How assistable is this target right now? null if not at all.
  function evaluate(shootable) {
    if (!assistable(shootable)) return null;
    chestOf(shootable, chest);
    toChest.subVectors(chest, eye);
    const distance = toChest.length();
    if (distance > cfg.maxRange || distance < 0.3) return null;
    toChest.divideScalar(distance);

    // Inside the assist zone around the chest? (bigger up close, smaller far away)
    const angle = Math.acos(Math.max(-1, Math.min(1, toChest.dot(aimDir))));
    const outer = Math.min(
      cfg.maxConeDegrees * DEG_TO_RAD,
      Math.max(cfg.minConeDegrees * DEG_TO_RAD, Math.atan(cfg.assistRadius / distance)),
    );
    if (angle > outer) return null;
    const inner = Math.min(outer * 0.999, Math.atan(cfg.coreRadius / distance));

    // No help through walls.
    if (castShot(eye, toChest, distance + 0.05, colliders, [shootable]).target !== shootable) return null;

    const rangeFalloff =
      distance <= cfg.fullRange ? 1 : Math.max(0, 1 - (distance - cfg.fullRange) / (cfg.maxRange - cfg.fullRange));
    // Slowdown is strongest right on the body and fades across the zone...
    const closeness = angle <= inner ? 1 : 1 - (angle - inner) / (outer - inner);
    // ...rotational assist holds full strength across most of the zone, fading only near its edge.
    const edgeFade = Math.min(1, (outer - angle) / (outer * cfg.rotationalEdgeFade));
    return {
      angle,
      weight: closeness * rangeFalloff,
      rotationalWeight: edgeFade * rangeFalloff,
      yaw: Math.atan2(-toChest.x, -toChest.z), // same convention as player.yaw
      pitch: Math.asin(toChest.y),
    };
  }

  function clear() {
    target = null;
    slowdown = 1;
  }

  return {
    // Look speed multiplier for the controller stick right now (1 = no slowdown).
    get slowdown() {
      return slowdown;
    },
    get target() {
      return target;
    },

    /** aim: { amount (0..1 ADS), justStartedAiming } */
    update(dt, aim) {
      snapCooldown = Math.max(0, snapCooldown - dt);
      const strength = cfg.strength;
      if (input.device !== 'gamepad' || strength <= 0) {
        clear();
        return;
      }

      player.getAim(eye, aimDir);

      // Stick with the current target while it's still valid (no flicking between zombies in a
      // crowd); otherwise pick the one closest to the crosshair.
      let best = target ? evaluate(target) : null;
      let bestTarget = best ? target : null;
      if (!best) {
        for (const s of shootables) {
          const e = evaluate(s);
          if (e && (!best || e.angle < best.angle)) {
            best = e;
            bestTarget = s;
          }
        }
      }
      if (!bestTarget) {
        clear();
        return;
      }
      const sameTarget = bestTarget === target;
      target = bestTarget;
      const ads = aim.amount;
      const weight = best.weight;

      // 1) Slowdown
      const minFactor = cfg.slowdownHip + (cfg.slowdownAds - cfg.slowdownHip) * ads;
      slowdown = 1 - (1 - minFactor) * weight * Math.min(1, strength);

      // 2) Rotational: follow the target's movement across the view (caused by it moving OR by
      //    you strafing), but only while a stick is in use.
      const stickInUse =
        Math.hypot(input.padMove.x, input.padMove.y) > cfg.stickActiveThreshold ||
        Math.hypot(input.padLook.x, input.padLook.y) > cfg.stickActiveThreshold;
      if (sameTarget && stickInUse) {
        const follow =
          (cfg.rotationalHip + (cfg.rotationalAds - cfg.rotationalHip) * ads) * strength * best.rotationalWeight;
        player.yaw += wrapAngle(best.yaw - prevYaw) * follow;
        player.pitch += (best.pitch - prevPitch) * follow * cfg.rotationalPitchScale;
        player.clampPitch();
      }

      // 3) ADS snap: a partial nudge toward the chest when you start aiming near a zombie.
      if (aim.justStartedAiming && snapCooldown <= 0 && best.angle <= cfg.snapDegrees * DEG_TO_RAD) {
        const f = cfg.snapFraction * Math.min(1, strength);
        player.yaw += wrapAngle(best.yaw - player.yaw) * f;
        player.pitch += (best.pitch - (player.pitch + player.viewKick)) * f;
        player.clampPitch();
        snapCooldown = cfg.snapCooldownSeconds;
      }

      prevYaw = best.yaw;
      prevPitch = best.pitch;
    },

    reset() {
      clear();
      snapCooldown = 0;
    },
  };
}
