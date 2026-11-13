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
import { colliderSignature, overlapsSolid, rampHeightAt } from '../world/collision.js';

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

/** Does this live body block a vault's path or landing? Not a dead one, and never one flagged ignoreVault (Sunny). */
export const blocksVault = (body) => body.isAlive && !body.ignoreVault;

// Why a straight vault can fail that a slightly turned path might get round (searchPlan): the landing side, not the approach.
const LANDING_REASONS = new Set(['no floor to land on', 'no room to start', 'path or landing blocked', 'not looking where it would take you']);

export function createVault({ player, colliders, getBodies = () => [] }) {
  const cfg = feel.vault;
  const sample = new THREE.Vector3();
  const previous = new THREE.Vector3();
  let state = null;

  function clearAt(position) {
    if (overlapsSolid(position, feel.player.radius, feel.player.height, colliders, 0, 0)) return false;
    for (const body of getBodies()) {
      if (!blocksVault(body)) continue;
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
  // A balcony rail ahead: you always climb STRAIGHT over it (along its normal), whatever angle you ran at it, so where you let
  // go, and so whether it is allowed, depends only on where along the rail you are. { box, near, far, dx, dz } or { reason }.
  function ledgeAhead(start, floorY, dx, dz, box) {
    const thinX = box.max.x - box.min.x < box.max.z - box.min.z;
    const centre = thinX ? (box.min.x + box.max.x) / 2 : (box.min.z + box.max.z) / 2;
    const nx = thinX ? Math.sign(centre - start.x) : 0;
    const nz = thinX ? 0 : Math.sign(centre - start.z);
    if (dx * nx + dz * nz < Math.cos(cfg.ledge.maxApproachDegrees * DEG_TO_RAD)) return { reason: 'too steep an angle (along its long side)' };
    const height = box.max.y - floorY;
    if (height < cfg.minHeight || height > cfg.ledge.maxHeight) return { reason: 'wrong height' };
    const raw = crossing(start, nx, nz, box); // (null past either end of the rail)
    if (!raw || raw.near < 0) return { reason: 'nothing to vault ahead' };
    const expanded = crossing(start, nx, nz, box, feel.player.radius + cfg.clearance);
    return { box, near: Math.max(0, expanded.near), far: expanded.far, dx: nx, dz: nz };
  }

  function findObstacle(start, floorY, dx, dz, maxReach, ledgeOnly = false) {
    const minApproach = Math.cos(cfg.maxApproachDegrees * DEG_TO_RAD);
    let best = null;
    let reason = 'nothing to vault ahead';
    for (const box of colliders) {
      if (box.ledge) {
        const ledge = ledgeAhead(start, floorY, dx, dz, box);
        if (ledge.reason) {
          if (ledge.reason !== 'nothing to vault ahead') reason = ledge.reason;
        } else if (ledge.near > maxReach) {
          reason = 'too far away';
        } else if (!best || ledge.near < best.near) {
          best = ledge;
        }
        continue;
      }
      if (!box.vaultable || ledgeOnly) continue;
      const raw = crossing(start, dx, dz, box);
      if (!raw || raw.near < 0) continue;
      const height = box.max.y - floorY;
      if (height < cfg.minHeight || height > (box.ledge ? cfg.ledge.maxHeight : player.stats.vaultMaxHeight)) {
        reason = 'wrong height';
        continue;
      }
      // maxDepth is the obstacle's THICKNESS straight through the face you enter (so a bench's length is refused), not the
      // longer diagonal an angled run takes through it: that made deep counters refuse angles the angle limit allows.
      if ((raw.far - raw.near) * raw.approach > cfg.maxDepth || raw.approach < minApproach) {
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

  // What's under a standing circle at (x, z), looking down from `fromY`: the highest box top and the highest escalator (ramp)
  // height touching it. Another balcony rail doesn't count: it is a wall you'd stop at, not something you'd land on.
  function under(x, z, fromY, margin = 0) {
    const r = feel.player.radius + margin;
    let box = -Infinity;
    for (const b of colliders) {
      if (b.max.y >= fromY || b.ledge) continue;
      if (x + r <= b.min.x || x - r >= b.max.x || z + r <= b.min.z || z - r >= b.max.z) continue;
      box = Math.max(box, b.max.y);
    }
    let ramp = -Infinity;
    for (const q of colliders.ramps ?? []) {
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
        const height = rampHeightAt(q, x + dx, z + dz);
        if (height !== null && height < fromY) ramp = Math.max(ramp, height);
      }
    }
    return { box, ramp, top: Math.max(box, ramp) };
  }

  // Is a balcony rail (other than the one being climbed) within `railMargin` of a standing circle at (x, z)?
  function railAt(x, z, climbed) {
    const reach = feel.player.radius + cfg.ledge.railMargin;
    return colliders.some((box) => box.ledge && box !== climbed && x + reach > box.min.x && x - reach < box.max.x && z + reach > box.min.z && z - reach < box.max.z);
  }

  // Where would you stand after landing at (x, z)? Bare floor, a bench or a counter (up to landingMaxY), or an escalator's walkway
  // (when the ramp is the highest thing there, not its side). Returns the surface height, or null (a kiosk, a lamp post, a fountain).
  function landingAt(x, z, fromY) {
    // (checked a little wider than your body: the real fall, tick by tick, can end a few centimetres from the prediction)
    const { box, ramp, top } = under(x, z, fromY, cfg.ledge.landingMargin);
    if (!Number.isFinite(top)) return null;
    const onRamp = Number.isFinite(ramp) && ramp >= box - cfg.ledge.pathClearance;
    if (!onRamp && box > cfg.ledge.landingMaxY) return null;
    sample.set(x, top, z);
    return clearAt(sample) ? top : null;
  }

  // How far out to drop, straight out from the rail (the drop can't be steered: controller.dropVelocity). Tries landing spots from
  // the preferred distance outward, and takes the first one you can stand on whose whole fall line is clear: at every point on the
  // way down, nothing under you is higher than your feet will be then (no landing on a lamp post or an escalator's side), and no
  // other rail is in the way. Returns the outward speed, or null if nowhere along the line works.
  // The answer only depends on the map and WHERE YOU LET GO (the same point all the way along a straight run at the rail), and the
  // prompt asks every tick near a rail: cache it per 5 cm of that point, dropped whenever a door or shutter changes the colliders.
  const dropCache = new Map();
  let dropCacheSignature = '';
  function chooseDrop(plan) {
    const signature = colliderSignature(colliders);
    if (signature !== dropCacheSignature) { dropCache.clear(); dropCacheSignature = signature; }
    const release = plan.far + plan.landingDistance;
    const key = `${Math.round((plan.start.x + plan.dx * release) * 20)},${Math.round((plan.start.z + plan.dz * release) * 20)},${Math.round(plan.top * 20)},${plan.dx},${plan.dz}`;
    if (!dropCache.has(key)) {
      if (dropCache.size > 4096) dropCache.clear();
      dropCache.set(key, findDrop(plan));
    }
    return dropCache.get(key);
  }

  function findDrop(plan) {
    const L = cfg.ledge;
    const g = feel.movement.gravity;
    const release = plan.far + plan.landingDistance;
    const at = (along) => [plan.start.x + plan.dx * along, plan.start.z + plan.dz * along];
    if (railAt(...at(release), plan.box)) return null;
    const outs = [];
    for (let out = 0; out <= L.maxOut + 1e-6; out += L.landingStep) outs.push(out);
    outs.sort((a, b) => Math.abs(a - L.preferredOut) - Math.abs(b - L.preferredOut));
    for (const out of outs) {
      const landY = landingAt(...at(release + out), plan.top);
      if (landY === null || plan.start.y - landY < L.minDrop) continue; // (the escalator's top end, just under the balcony: not a drop)
      const seconds = Math.sqrt(2 * (plan.top - landY) / g);
      const steps = Math.max(1, Math.ceil(out / L.pathStep));
      let clear = true;
      for (let i = 0; i < steps && clear; i++) {
        const f = i / steps;
        const [x, z] = at(release + out * f);
        if (railAt(x, z, plan.box)) clear = false;
        else if (under(x, z, plan.top, L.landingMargin).top > plan.top - 0.5 * g * (f * seconds) ** 2 - L.pathClearance) clear = false;
      }
      if (clear) return out / seconds;
    }
    return null;
  }

  // A full vault plan from `start` (feet) heading (dx, dz) at `speed`, or { reason } it can't work.
  function makePlan(start, floorY, dx, dz, speed, ledgeOnly = false) {
    const found = findObstacle(start, floorY, dx, dz, cfg.reach, ledgeOnly);
    if (!found.box) return found;
    if (found.box.ledge) return { ...makeLedgePlan(start, found.dx, found.dz, speed, found), ledge: true };
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

  // Over a balcony rail: the usual lift and cross, then you let go in the air above the open floor (the controller's gravity
  // does the fall, and the landing hurts: feel.fall). Nothing is lowered, so `landingY` stays at the top.
  function makeLedgePlan(start, dx, dz, speed, found) {
    const plan = {
      ...found, start: start.clone(), dx, dz, speed, ledge: true,
      top: Math.max(found.box.max.y + cfg.clearance, start.y),
      landingDistance: cfg.landingDistance,
      liftTime: Math.max(cfg.minLiftSeconds, found.near / speed),
      crossTime: (found.far - found.near) / speed,
      lowerTime: cfg.landingDistance / speed,
      time: 0,
    };
    plan.landingY = plan.top;
    plan.duration = plan.liftTime + plan.crossTime + plan.lowerTime;
    if (plan.duration > cfg.maxSeconds) return { reason: 'moving too slowly' };
    if (!clearAt(plan.start)) return { reason: 'no room to start' };
    if (!pathClear(plan, 0, plan.duration)) return { reason: 'path blocked' };
    plan.dropSpeed = chooseDrop(plan);
    if (plan.dropSpeed === null) return { reason: 'nowhere safe to drop' };
    return { plan };
  }

  // Your travel direction, if it's fast enough and roughly where you're looking. { dx, dz, speed } or { reason }.
  // Standing still against a balcony rail and pushing into it counts too, for rails only (feel.vault.ledge.pushSpeed).
  function travel() {
    const speed = Math.hypot(player.velocity.x, player.velocity.z);
    let dx, dz, ledgeOnly = false, moving = speed;
    if (speed >= cfg.minSpeed) {
      dx = player.velocity.x / speed;
      dz = player.velocity.z / speed;
    } else {
      const wish = player.moveWish;
      const length = wish ? Math.hypot(wish.x, wish.z) : 0;
      if (length < 0.5) return { reason: 'moving too slowly' };
      dx = wish.x / length;
      dz = wish.z / length;
      ledgeOnly = true;
      moving = cfg.ledge.pushSpeed;
    }
    return { dx, dz, speed: moving, ledgeOnly };
  }

  // Intent: a vault only goes roughly where you are LOOKING (feel.vault.maxLookDegrees between your view and the direction
  // the vault would carry you). Your movement says whether and how fast; your view says you meant it. Checked against the
  // vault's own direction (after any angled search, and a rail's straight-over line), not your velocity, so strafing along a
  // counter, or a search path turned toward something you aren't facing, never vaults you sideways.
  // A balcony rail (always climbed straight over) has its own, wider limit: ledge.maxLookDegrees.
  const facing = (dx, dz, degrees = cfg.maxLookDegrees) => -Math.sin(player.yaw) * dx - Math.cos(player.yaw) * dz >= Math.cos(degrees * DEG_TO_RAD);

  // Try straight ahead, then a few slightly angled paths (a blocked landing can often be dodged).
  function searchPlan(start, floorY, t) {
    let firstReason = null;
    for (const degrees of cfg.directionSearchDegrees) {
      const a = degrees * DEG_TO_RAD;
      const dx = t.dx * Math.cos(a) - t.dz * Math.sin(a);
      const dz = t.dx * Math.sin(a) + t.dz * Math.cos(a);
      const result = makePlan(start, floorY, dx, dz, t.speed, t.ledgeOnly);
      const plan = result.plan;
      if (plan && !facing(plan.dx, plan.dz, result.ledge ? cfg.ledge.maxLookDegrees : cfg.maxLookDegrees)) { firstReason ??= 'not looking where it would take you'; continue; }
      if (plan || result.ledge) return result; // (a rail is always climbed straight over: turning the path changes nothing)
      firstReason ??= result.reason;
      // The turned paths only dodge a blocked LANDING. They never rescue a straight path that was refused for anything else
      // (too steep an angle, too far, wrong height): turning 24 degrees into a counter you are running along is a sideways yank.
      if (degrees === 0 && !LANDING_REASONS.has(result.reason)) break;
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
      const found = findObstacle(player.position, ready.floorY, t.dx, t.dz, cfg.magnetRange, t.ledgeOnly);
      // (only worth holding the jump for if the vault would go where you look: a rail's is straight over it)
      return !!found.box && (found.box.ledge ? facing(found.dx, found.dz, cfg.ledge.maxLookDegrees) : facing(t.dx, t.dz));
    },

    // Would a jump press now end in a vault (now, or once the magnet brings you into reach)?
    preview() {
      const ready = readiness();
      if (ready.reason || !player.grounded) return false;
      const t = travel();
      if (t.reason) return false;
      const found = findObstacle(player.position, ready.floorY, t.dx, t.dz, cfg.magnetRange, t.ledgeOnly);
      if (!found.box) return false;
      // Where you'll be when it comes into reach (keep going straight until then). A rail's gap is measured straight at it,
      // so an angled run covers more ground to close it.
      const closing = found.box.ledge ? Math.max(cfg.ledge.minClosing, t.dx * found.dx + t.dz * found.dz) : 1;
      const advance = Math.max(0, found.near - cfg.reach * cfg.approachFraction) / closing;
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
      const supported = plan.ledge || landingHeight(
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
      if (plan.time >= plan.duration && plan.ledge) {
        // Let go over the edge: nearly straight down, falling from the floor you stood on.
        player.velocity.set(plan.dx * plan.dropSpeed, 0, plan.dz * plan.dropSpeed);
        player.dropVelocity = { x: player.velocity.x, z: player.velocity.z }; // (held for the whole drop: no steering)
        player.fallBase = plan.start.y;
        player.grounded = false;
        player.timeSinceGrounded = feel.movement.coyoteTime;
        state = null;
      } else if (plan.time >= plan.duration) {
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
