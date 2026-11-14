// =============================================================================
// MELEE: the box cutter (COD-style knife)
// Tap the melee key: a quick slash at whatever is right in front of you.
//   - If a target is just out of reach (but within lunge range), you lurch at it.
//   - The hit lands partway through the swing and strikes the nearest target in
//     a cone in front of you (walls block it). One target per swing, or the nearest
//     stats.meleeMaxTargets of them after the Box Cutter Pro (game/meleeUpgrades.js).
//   - Melee ignores headshots, like COD. Damage x stats.meleeDamageMultiplier x
//     stats.meleeUpgradeDamage (the Customer Service tiers); the cone is stats.meleeHalfAngleDegrees.
//   - Commit the attack direction until impact; misses recover more slowly than hits.
//   - Swinging cancels a reload, and the gun can't fire mid-swing/recovery.
// Runs on the fixed tick. The slash animation lives in viewmodel.js.
// =============================================================================

import * as THREE from 'three';
import { applyInstantKillDamage } from './gunStats.js';
import { castShot } from './hitscan.js';

const DEG_TO_RAD = Math.PI / 180;

export function createMelee({ def, stats, player, input, getWeapon, shootables, colliders, effects, hud, sound = null, onHit = null }) {
  let timer = -1; // seconds into the current swing; -1 = not swinging
  let hasHit = false;
  let recoverySeconds = def.missRecoverySeconds;
  let facingX = 0;
  let facingZ = -1;

  const eye = new THREE.Vector3();
  const aimDir = new THREE.Vector3();
  const point = new THREE.Vector3();
  const toPoint = new THREE.Vector3();
  const normal = new THREE.Vector3();

  /**
   * Every live target within `maxRange` of the eye, inside the cone in front of the player (horizontal angle),
   * with no wall in between, nearest first. One entry per target (its nearest part).
   * Returns [{ target, point, distance }].
   */
  function findTargets(maxRange) {
    player.getAim(eye, aimDir);
    const minCos = Math.cos(stats.meleeHalfAngleDegrees * DEG_TO_RAD);
    const found = [];

    for (const target of shootables) {
      if (!target.isAlive) continue;
      let best = null;
      for (const hitbox of target.hitboxes) {
        // Closest point on the box in its own space for articulated parts.
        if (hitbox.localBox) {
          point.copy(eye).applyMatrix4(hitbox.toLocal);
          hitbox.localBox.clampPoint(point, point).applyMatrix4(hitbox.toWorld);
        } else {
          hitbox.box.clampPoint(eye, point);
        }
        const distance = point.distanceTo(eye);
        if (distance > maxRange || (best && distance >= best.distance)) continue;

        // In front of us? (horizontal angle, so looking up/down doesn't matter)
        const center = hitbox.box.getCenter(toPoint);
        const hx = center.x - eye.x;
        const hz = center.z - eye.z;
        const hLen = Math.hypot(hx, hz);
        if (hLen > 1e-4 && (hx * facingX + hz * facingZ) / hLen < minCos) continue;

        // Nothing solid in the way?
        toPoint.subVectors(point, eye);
        if (distance > 1e-4) {
          toPoint.divideScalar(distance);
          const check = castShot(eye, toPoint, distance + 0.05, colliders, [target]);
          if (check.target !== target) continue;
        }
        best = { target, point: point.clone(), distance };
      }
      if (best) found.push(best);
    }
    return found.sort((a, b) => a.distance - b.distance);
  }

  function startSwing() {
    timer = 0;
    hasHit = false;
    recoverySeconds = def.missRecoverySeconds;
    facingX = -Math.sin(player.yaw);
    facingZ = -Math.cos(player.yaw);
    player.meleeBusy = true;
    player.meleeCommitted = true;
    player.meleeFacingYaw = player.yaw;
    player.meleeTurnLimit = def.commitTurnDegrees * DEG_TO_RAD;
    player.jumpBuffer = 0;
    getWeapon().cancelReload(); // the classic COD tradeoff: knifing interrupts a reload
    if (sound) sound.play(def.sounds.swing);

    // Lunge at a target that's just out of reach (not while sliding, prone or airborne).
    if (player.stance === 'slide' || player.stance === 'prone' || !player.grounded) return;
    const found = findTargets(def.lungeRange)[0];
    if (!found || found.distance <= def.range * def.lungeStopFraction) return;
    const dx = found.point.x - eye.x;
    const dz = found.point.z - eye.z;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return;
    const travel = found.distance - def.range * def.lungeStopFraction;
    const speed = Math.max(def.lungeSpeed, Math.hypot(player.velocity.x, player.velocity.z));
    const seconds = Math.min(def.lungeMaxSeconds, travel / speed);
    player.lunge(dx / len, dz / len, speed, seconds);
  }

  /** One target struck: damage, splatter, hit marker, 'hit' event. Returns whether it died. */
  function hitOne(found, damage) {
    const dir = { x: facingX, y: 0, z: facingZ };
    const { killed } = found.target.takeHit({
      damage,
      part: 'body',
      point: found.point,
      melee: true,
      direction: dir,
      impact: def.impact,
    });
    normal.subVectors(eye, found.point).setY(0).normalize(); // splatter flies back toward the player
    effects.splat(found.point, normal, found.target.splatColors, def.splatCount, {
      flesh: true,
      speedScale: 1.25,
      direction: dir,
    });
    hud.showHitMarker({ headshot: false, killed });
    if (onHit) onHit({ target: found.target, killed, headshot: false, melee: true });
    return killed;
  }

  function strike() {
    // The nearest stats.meleeMaxTargets in the cone (1 for the plain box cutter).
    const hits = findTargets(def.range).slice(0, stats.meleeMaxTargets);
    if (hits.length === 0) return null;
    const damage = def.damage * stats.meleeDamageMultiplier * stats.meleeUpgradeDamage;
    let first = null;
    let anyKilled = false;
    for (const found of hits) {
      if (!found.target.isAlive) continue; // already dead this swing (a kill listener got it): no hit on a corpse
      const killed = hitOne(found, applyInstantKillDamage(damage, found.target, stats));
      first ??= { target: found.target, killed, hits: 0 };
      first.hits++;
      anyKilled ||= killed;
    }
    if (!first) return null;
    if (sound) {
      sound.play('hitBody');
      if (anyKilled) sound.play('killConfirm');
    }
    player.addViewKick(-def.impactJoltDegrees * DEG_TO_RAD);
    return first;
  }

  return {
    lastStrike: null, // most recent hit result (handy for debugging)

    get isBusy() {
      return timer >= 0;
    },

    get phase() {
      return timer < 0 ? 'ready' : hasHit ? 'recovery' : 'windup';
    },

    // 0..1 through the swing, or null when not swinging (drives the viewmodel slash).
    get progress() {
      if (timer < 0) return null;
      if (!hasHit) return Math.min(def.impactProgress, timer / def.hitAtSeconds * def.impactProgress);
      return def.impactProgress + (1 - def.impactProgress) * Math.min(1, (timer - def.hitAtSeconds) / recoverySeconds);
    },

    update(dt, allowStart = true) {
      const pressed = input.consumeAction('melee'); // always consumed, so presses don't queue up
      if (timer >= 0 && !player.meleeBusy) this.reset(); // teleport/reset cancelled the action
      if (timer < 0) {
        if (pressed && allowStart && !player.vault.active) {
          this.lastStrike = null;
          startSwing();
        }
        return;
      }
      timer += dt;
      if (!hasHit && timer >= def.hitAtSeconds) {
        hasHit = true;
        this.lastStrike = strike();
        recoverySeconds = this.lastStrike ? def.hitRecoverySeconds : def.missRecoverySeconds;
        player.meleeCommitted = false; // movement/turning return immediately after impact
        player.stopLunge(); // don't keep driving into a target after the slash
      }
      if (timer >= def.hitAtSeconds + recoverySeconds) {
        timer = -1;
        player.meleeBusy = false;
      }
    },

    reset() {
      timer = -1;
      hasHit = false;
      this.lastStrike = null;
      player.meleeBusy = false;
      player.meleeCommitted = false;
      player.stopLunge();
    },
  };
}
