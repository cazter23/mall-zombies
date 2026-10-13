// Deliberate, fixed-tick vaults over opt-in Box3 obstacles. We raise before crossing the
// near edge, travel above the top, then lower beyond the far edge. Every segment is
// checked with the full standing cylinder; no collider is disabled, even briefly.
//
// Forgiving to trigger (the controller does the timing, see controller.js):
//   - ahead(): is a vaultable obstacle on your path within feel.vault.magnetRange? A jump press then
//     waits (up to magnetSeconds) until you're in reach and vaults, instead of jumping early.
//   - a jump that started a moment ago (airGraceSeconds) can still turn into a vault in the air.
//   - if the straight-ahead landing is blocked (e.g. a wall right behind a bench), it tries a few
//     slightly angled paths (directionSearchDegrees) before giving up.
//   - preview(): would pressing jump right now end in a vault? (drives the HUD "Vault" prompt)
//   - lastResult: why the last attempt failed or "vaulted" (handy when testing in the console).
import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { overlapsSolid } from '../world/collision.js';

const DEG_TO_RAD = Math.PI / 180;
const ease = (t) => t * t * (3 - 2 * t);

// Ray interval through the footprint, optionally expanded for the player's radius.
function crossing(position, dx, dz, box, padding = 0) {
  let near = -Infinity;
  let far = Infinity;
  let approach = 0;
  for (const [axis, direction] of [['x', dx], ['z', dz]]) {
    const low = box.min[axis] - padding;
    const high = box.max[axis] + padding;
    if (Math.abs(direction) < 1e-6) {
      if (position[axis] < low || position[axis] > high) return null;
      continue;
    }
    const a = (low - position[axis]) / direction;
    const b = (high - position[axis]) / direction;
    const entry = Math.min(a, b);
    if (entry > near) {
      near = entry;
      approach = Math.abs(direction);
    }
    far = Math.min(far, Math.max(a, b));
  }
  return far > Math.max(0, near) ? { near, far, approach } : null;
}

export function createVault({ player, colliders, getBodies = () => [] }) {
  const cfg = feel.vault;
  const sample = new THREE.Vector3();
  const previous = new THREE.Vector3();
  let state = null;

  function clearAt(position) {
    if (overlapsSolid(position, feel.player.radius, feel.player.height, colliders, 0, 0)) return false;
    for (const body of getBodies()) {
      if (!body.isAlive) continue;
      for (const hitbox of body.hitboxes) {
        if (overlapsSolid(position, feel.player.radius, feel.player.height, [hitbox.box], 0, 0)) return false;
      }
    }
    return true;
  }

  // Require a supported landing at roughly the starting floor height, not a leap into a pit.
  function landingHeight(x, z, y) {
    const r = feel.player.radius;
    let result = -Infinity;
    for (const box of colliders) {
      if (Math.abs(box.max.y - y) > cfg.landingHeightTolerance) continue;
      if (x - r < box.min.x || x + r > box.max.x || z - r < box.min.z || z + r > box.max.z) continue;
      result = Math.max(result, box.max.y);
    }
    return result;
  }

  function positionAt(plan, time, out) {
    let distance;
    let y;
    if (time < plan.liftTime) {
      const t = time / plan.liftTime;
      distance = plan.near * t;
      y = plan.start.y + (plan.top - plan.start.y) * ease(t);
    } else if (time < plan.liftTime + plan.crossTime) {
      const t = (time - plan.liftTime) / plan.crossTime;
      distance = plan.near + (plan.far - plan.near) * t;
      y = plan.top;
    } else {
      const t = Math.min(1, (time - plan.liftTime - plan.crossTime) / plan.lowerTime);
      distance = plan.far + plan.landingDistance * t;
      y = plan.top + (plan.landingY - plan.top) * ease(t);
    }
    return out.set(plan.start.x + plan.dx * distance, y, plan.start.z + plan.dz * distance);
  }

  function pathClear(plan, from, to) {
    // Bound each sample by horizontal + vertical travel, sampling the actual raised path
    // rather than a straight chord that could cut through the obstacle's edge.
    const verticalSpeed = Math.max(
      (plan.top - plan.start.y) / plan.liftTime,
      (plan.top - plan.landingY) / plan.lowerTime,
    ) * 1.5; // maximum slope of smoothstep is 1.5
    const steps = Math.max(1, Math.ceil((to - from) * (plan.speed + verticalSpeed) / cfg.sweepStep));
    for (let i = 1; i <= steps; i++) {
      positionAt(plan, from + (to - from) * i / steps, sample);
      if (!clearAt(sample)) return false;
    }
    return true;
  }

  // The vaultable obstacle you'd cross going from `start` along (dx, dz), if one is within `maxReach`.
  // Returns { box, near, far } or { reason }.
  function findObstacle(start, floorY, dx, dz, maxReach) {
    const minApproach = Math.cos(cfg.maxApproachDegrees * DEG_TO_RAD);
    let best = null;
    let reason = 'nothing to vault ahead';
    for (const box of colliders) {
      if (!box.vaultable) continue;
      const raw = crossing(start, dx, dz, box);
      if (!raw || raw.near < 0) continue;
      const height = box.max.y - floorY;
      if (height < cfg.minHeight || height > player.stats.vaultMaxHeight) {
        reason = 'wrong height';
        continue;
      }
      if (raw.far - raw.near > cfg.maxDepth || raw.approach < minApproach) {
        reason = 'too steep an angle (along its long side)';
        continue;
      }
      const expanded = crossing(start, dx, dz, box, feel.player.radius + cfg.clearance);
      if (!expanded) continue;
      if (expanded.near > maxReach) {
        reason = 'too far away';
        continue;
      }
      if (!best || expanded.near < best.near) best = { box, near: Math.max(0, expanded.near), far: expanded.far };
    }
    return best ?? { reason };
  }

  // A full vault plan from `start` (feet) heading (dx, dz) at `speed`, or { reason } it can't work.
  function makePlan(start, floorY, dx, dz, speed) {
    const found = findObstacle(start, floorY, dx, dz, cfg.reach);
    if (!found.box) return found;
    // Horizontal speed never changes during a vault: the drop on the far side takes as long as covering
    // landingDistance at your speed (a quicker drop when you're fast), never a slowed-down minimum time.
    const landingDistance = cfg.landingDistance;
    const endDistance = found.far + landingDistance;
    const landingY = landingHeight(start.x + dx * endDistance, start.z + dz * endDistance, floorY);
    if (!Number.isFinite(landingY)) return { reason: 'no floor to land on' };
    const plan = {
      ...found, start: start.clone(), dx, dz, speed, landingY,
      top: Math.max(found.box.max.y + cfg.clearance, start.y),
      landingDistance,
      liftTime: Math.max(cfg.minLiftSeconds, found.near / speed),
      crossTime: (found.far - found.near) / speed,
      lowerTime: landingDistance / speed,
      time: 0,
    };
    plan.duration = plan.liftTime + plan.crossTime + plan.lowerTime;
    if (plan.duration > cfg.maxSeconds) return { reason: 'moving too slowly' };
    if (!clearAt(plan.start)) return { reason: 'no room to start' };
    if (!pathClear(plan, 0, plan.duration)) return { reason: 'path or landing blocked' };
    return { plan };
  }

  // Your travel direction, if it's fast enough and roughly where you're looking. { dx, dz, speed } or { reason }.
  function travel() {
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    if (speed < cfg.minSpeed) return { reason: 'moving too slowly' };
    const dx = player.velocity.x / speed;
    const dz = player.velocity.z / speed;
    if (-Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz < Math.cos(cfg.maxLookDegrees * DEG_TO_RAD)) {
      return { reason: 'not looking where you are going' };
    }
    return { dx, dz, speed };
  }

  // Try straight ahead, then a few slightly angled paths (a blocked landing can often be dodged).
  function searchPlan(start, floorY, t) {
    let firstReason = null;
    for (const degrees of cfg.directionSearchDegrees) {
      const a = degrees * DEG_TO_RAD;
      const dx = t.dx * Math.cos(a) - t.dz * Math.sin(a);
      const dz = t.dx * Math.sin(a) + t.dz * Math.cos(a);
      const result = makePlan(start, floorY, dx, dz, t.speed);
      if (result.plan) return result;
      firstReason ??= result.reason;
    }
    return { reason: firstReason };
  }

  // Can the player start a vault right now (grounded, or a moment into a jump)?
  function readiness() {
    if (state) return { reason: 'already vaulting' };
    if (player.stance !== 'stand') return { reason: 'not standing' };
    if (player.meleeBusy) return { reason: 'swinging the box cutter' };
    if (player.grounded) return { floorY: player.position.y };
    if (player.timeSinceJump < cfg.airGraceSeconds) return { floorY: player.jumpFloorY };
    return { reason: 'in the air' };
  }

  const projected = new THREE.Vector3();

  return {
    get active() { return state !== null; },
    get progress() { return state ? state.time / state.duration : null; },
    lastResult: '', // why the last attempt failed, or 'vaulted' (for testing / the console)

    // Is a vaultable obstacle on your path within magnetRange (worth holding a jump press for)?
    ahead() {
      const ready = readiness();
      if (ready.reason) return false;
      const t = travel();
      if (t.reason) return false;
      return !!findObstacle(player.position, ready.floorY, t.dx, t.dz, cfg.magnetRange).box;
    },

    // Would a jump press now end in a vault (now, or once the magnet brings you into reach)?
    preview() {
      const ready = readiness();
      if (ready.reason || !player.grounded) return false;
      const t = travel();
      if (t.reason) return false;
      const found = findObstacle(player.position, ready.floorY, t.dx, t.dz, cfg.magnetRange);
      if (!found.box) return false;
      // Where you'll be when it comes into reach (keep going straight until then).
      const advance = Math.max(0, found.near - cfg.reach * 0.9);
      projected.set(player.position.x + t.dx * advance, player.position.y, player.position.z + t.dz * advance);
      if (advance > 0 && !clearAt(projected)) return false;
      return !!searchPlan(projected, ready.floorY, t).plan;
    },

    tryStart() {
      const ready = readiness();
      if (ready.reason) {
        this.lastResult = ready.reason;
        return false;
      }
      const t = travel();
      if (t.reason) {
        this.lastResult = t.reason;
        return false;
      }
      const result = searchPlan(player.position, ready.floorY, t);
      if (!result.plan) {
        this.lastResult = result.reason;
        return false;
      }
      this.lastResult = 'vaulted';
      const plan = result.plan;
      state = plan;
      previous.copy(player.position);
      player.grounded = false;
      player.timeSinceGrounded = feel.movement.coyoteTime;
      player.jumpBuffer = 0;
      player.airborneWithMomentum = true;
      return true;
    },

    update(dt) {
      if (!state) return;
      const plan = state;
      const nextTime = Math.min(plan.duration, plan.time + dt);
      const endDistance = plan.far + plan.landingDistance;
      const supported = landingHeight(
        plan.start.x + plan.dx * endDistance, plan.start.z + plan.dz * endDistance, plan.landingY,
      ) === plan.landingY;
      // A moving body, closing door, or crowd shove cancels the motion at the last safe position.
      if (!supported || player.position.distanceTo(previous) > cfg.displacementTolerance || !pathClear(plan, plan.time, nextTime)) {
        state = null;
        player.grounded = false;
        player.timeSinceGrounded = feel.movement.coyoteTime;
        return;
      }
      positionAt(plan, nextTime, sample);
      player.velocity.subVectors(sample, player.position).divideScalar(dt);
      player.position.copy(sample);
      previous.copy(sample);
      plan.time = nextTime;
      if (plan.time >= plan.duration) {
        const keep = Math.max(0, Math.min(1, player.stats.vaultMomentumRetention));
        player.velocity.set(plan.dx * plan.speed * keep, 0, plan.dz * plan.speed * keep);
        player.grounded = true;
        player.timeSinceGrounded = 0;
        state = null;
      }
    },

    reset() { state = null; },
  };
}
