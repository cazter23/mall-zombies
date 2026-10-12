// =============================================================================
// ZOMBIE
// One zombie: state machine, movement, hitboxes. Runs on the fixed tick.
// Implements the "shootable" interface from weapons/hitscan.js, so the staple
// gun (headshots, hit markers, splatter) works on it with no extra code.
//
// States:
//   spawning -> rises out of the floor (can already be shot)
//   chasing  -> follows the flow field toward the player (along its own lane), then near the
//               player walks to its own surround slot (assigned by the manager), stops there
//   windup   -> nearly in reach (no wall between): arms raised (the telegraph) while still
//               stepping straight at the player at full speed
//   swing    -> arms slam down; the player is hit only if still in reach and in front
//   (back to chasing, with a recovery before it may attack again: long after a hit, short after a miss)
//   dead     -> tips over, lies there, sinks away, then `removed` is set
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { zombieCrowd } from '../config/zombies.js';
import { moveAndCollide } from '../world/collision.js';
import { createZombieModel } from './zombieModel.js';

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const desired = { x: 0, z: 0 };
const reachRay = new THREE.Ray();
const reachHit = new THREE.Vector3();

export class Zombie {
  // `speed`: this zombie's gait speed in m/s (defaults to the type's base walk).
  // `round`: the round it spawned in (later rounds wind up their attacks faster).
  constructor({ type, health, position, yaw, speed = type.speed, round = 1 }) {
    this.type = type;
    this.maxHealth = health;
    this.health = health;

    this.position = position.clone(); // feet
    this.prevPosition = position.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = yaw;
    this.prevYaw = yaw;
    this.speed = speed * (1 + (Math.random() * 2 - 1) * type.speedVariation);

    this.state = 'spawning';
    this.stateTime = 0;
    this.flinchTimer = 0;
    this.attackCooldown = 0; // seconds until it may start another attack
    const atk = type.attack;
    this.windupSeconds = Math.max(atk.minWindupSeconds, atk.windupSeconds - atk.windupShrinkPerRound * (round - 1));
    this.killedByHeadshot = false;
    this.killedByMelee = false;
    this.removed = false; // set once the corpse has sunk away; the manager then deletes it

    // Crowd personality, so a horde doesn't move as one: its own lane beside the shared route,
    // how far down the route it looks, and which side it prefers to step around others.
    const crowd = zombieCrowd;
    this.laneOffset = (Math.random() * 2 - 1) * crowd.laneMaxOffset;
    this.lookAhead = crowd.lookAheadMin + Math.floor(Math.random() * (crowd.lookAheadMax - crowd.lookAheadMin + 1));
    this.sideBias = Math.random() < 0.5 ? -1 : 1;
    // Surround slot near the player, assigned each tick by the manager: { x, z } or null.
    this.swingHit = false; // did the last swing connect? (decides the recovery time)
    this.slot = null;
    this.slotKey = null;
    this.onDeath = null; // optional callback(zombie), set by the manager

    // Shootable interface
    this.splatColors = type.splatColors;
    this.hitboxes = [
      { part: 'head', box: new THREE.Box3() },
      { part: 'body', box: new THREE.Box3() },
    ];

    this.model = createZombieModel(type);
    this.updateHitboxes();
  }

  get isAlive() {
    return this.state !== 'dead';
  }

  get horizontalSpeed() {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  setState(state) {
    this.state = state;
    this.stateTime = 0;
  }

  // --- Shootable ---------------------------------------------------------------

  takeHit({ damage, part, melee = false }) {
    if (!this.isAlive) return { killed: false };
    this.health -= damage;
    this.flinchTimer = this.type.flinchSeconds; // flinches, but an attack already winding up still comes
    if (this.health > 0) return { killed: false };
    this.killedByHeadshot = part === 'head' && !melee;
    this.killedByMelee = melee;
    this.die();
    return { killed: true };
  }

  die() {
    this.setState('dead');
    this.velocity.set(0, 0, 0);
    if (this.onDeath) this.onDeath(this);
  }

  // Hitboxes are axis-aligned boxes that follow the zombie (and rise with it while spawning).
  updateHitboxes() {
    const p = this.position;
    const hb = this.type.hitbox;
    let rise = 0;
    if (this.state === 'spawning') {
      rise = -this.type.height * (1 - ease(Math.min(1, this.stateTime / this.type.spawnSeconds)));
    }
    const y = p.y + rise;
    this.hitboxes[0].box.min.set(p.x - hb.headHalfSize, y + hb.headBottom, p.z - hb.headHalfSize);
    this.hitboxes[0].box.max.set(p.x + hb.headHalfSize, y + hb.headTop, p.z + hb.headHalfSize);
    this.hitboxes[1].box.min.set(p.x - hb.bodyHalfWidth, y, p.z - hb.bodyHalfWidth);
    this.hitboxes[1].box.max.set(p.x + hb.bodyHalfWidth, y + hb.bodyTop, p.z + hb.bodyHalfWidth);
  }

  // --- Tick ----------------------------------------------------------------------

  /**
   * ctx: { nav, player, colliders, zombies,
   *        canAttack: boolean (false once the player is dead),
   *        onPlayerHit(damage, zombie) }
   */
  update(dt, ctx) {
    this.prevPosition.copy(this.position);
    this.prevYaw = this.yaw;
    this.stateTime += dt;
    this.flinchTimer = Math.max(0, this.flinchTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    const attack = this.type.attack;

    if (this.state === 'spawning') {
      this.faceToward(ctx.player.position, dt);
      if (this.stateTime >= this.type.spawnSeconds) this.setState('chasing');
    } else if (this.state === 'chasing') {
      this.chase(dt, ctx);
      // Starts swinging on the way in (no stopping first), unless a wall is in the way.
      if (ctx.canAttack && this.attackCooldown <= 0 && this.inReach(ctx.player, attack.startRange) &&
          !this.wallBetween(ctx.player, ctx.colliders)) {
        this.setState('windup');
      }
    } else if (this.state === 'windup') {
      this.chase(dt, ctx, attack.moveSpeedFraction, true);
      if (this.stateTime >= this.windupSeconds) {
        this.setState('swing');
        this.swingHit = ctx.canAttack && this.canHit(ctx.player) && !this.wallBetween(ctx.player, ctx.colliders);
        if (this.swingHit) ctx.onPlayerHit(attack.damage, this);
      }
    } else if (this.state === 'swing') {
      this.chase(dt, ctx, attack.moveSpeedFraction, true);
      if (this.stateTime >= attack.swingSeconds) {
        this.setState('chasing');
        // A miss gets retried almost straight away, so stepping back isn't a free reset.
        this.attackCooldown = this.swingHit ? attack.recoverSeconds : attack.missRecoverSeconds;
      }
    } else if (this.state === 'dead') {
      const t = this.type;
      if (this.stateTime >= t.fallSeconds + t.corpseSeconds + t.sinkSeconds) this.removed = true;
    }

    if (this.isAlive) this.updateHitboxes();
  }

  // Move toward the player. `speedScale` slows the walking part (e.g. mid-attack); `facePlayer`
  // keeps it turned toward the player (locked on while attacking).
  chase(dt, { nav, player, colliders, zombies }, speedScale = 1, facePlayer = false) {
    const type = this.type;
    const crowd = zombieCrowd;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const distToPlayer = Math.hypot(dx, dz);
    const contact = type.radius + feel.player.radius + crowd.contactGap;

    // 1) Where to go: mid-attack, straight at the player (braking only just before touching them);
    //    else my surround slot near the player if I have one; otherwise the route to the player,
    //    along my own lane (which fades out as I get close).
    desired.x = 0;
    desired.z = 0;
    let hasPath = false;
    let arrive = 0;
    if (facePlayer) {
      if (distToPlayer > 1e-4) {
        desired.x = dx / distToPlayer;
        desired.z = dz / distToPlayer;
        hasPath = true;
      }
      arrive = clamp01((distToPlayer - contact) / type.attack.closeInBrakeDistance);
    } else if (this.slot) {
      const sx = this.slot.x - this.position.x;
      const sz = this.slot.z - this.position.z;
      const toSlot = Math.hypot(sx, sz);
      if (toSlot > 0.05) {
        desired.x = sx / toSlot;
        desired.z = sz / toSlot;
        hasPath = true;
        this.circleAroundPlayer(player, contact, sx, sz, toSlot);
      }
      arrive = clamp01(toSlot / crowd.arriveDistance);
    } else if (distToPlayer > contact) {
      const laneFade = clamp01((distToPlayer - crowd.surroundRadius) / crowd.laneFadeDistance);
      hasPath = nav.directionTo(this.position, player.position, desired, {
        laneOffset: this.laneOffset,
        laneFade,
        lookAhead: this.lookAhead,
      });
      arrive = clamp01((distToPlayer - contact) / crowd.arriveDistance);
    }
    // Never walk on into the player's body, whatever the slot says.
    if (hasPath && distToPlayer <= contact && desired.x * dx + desired.z * dz > 0) arrive = 0;

    // 2) Spacing: push away from nearby zombies, much harder the closer they are.
    let pushX = 0;
    let pushZ = 0;
    const sepR = crowd.separationRadius;
    for (const other of zombies) {
      if (other === this || !other.isAlive) continue;
      const ox = this.position.x - other.position.x;
      const oz = this.position.z - other.position.z;
      const d = Math.hypot(ox, oz);
      if (d >= sepR || d < 1e-4) continue;
      const w = Math.min(3, ((sepR - d) / (sepR - crowd.minSpacing)) ** 2);
      pushX += (ox / d) * w;
      pushZ += (oz / d) * w;
    }

    // 3) Queueing: if another zombie is close ahead on my way, slow down and step around it
    //    (to the side it isn't on) instead of shoving into its back.
    let walk = 1;
    let sideX = 0;
    let sideZ = 0;
    if (hasPath) {
      const coneCos = Math.cos((crowd.queueConeDegrees * Math.PI) / 180);
      let blocker = null;
      let blockerD = Infinity;
      for (const other of zombies) {
        if (other === this || !other.isAlive) continue;
        const ox = other.position.x - this.position.x;
        const oz = other.position.z - this.position.z;
        const d = Math.hypot(ox, oz);
        if (d >= crowd.queueDistance || d < 1e-4 || d >= blockerD) continue;
        if ((ox * desired.x + oz * desired.z) / d < coneCos) continue; // not ahead of me
        blocker = other;
        blockerD = d;
      }
      if (blocker) {
        const closeness = clamp01((crowd.queueDistance - blockerD) / (crowd.queueDistance - crowd.minSpacing));
        walk = 1 - crowd.queueSlowdown * closeness;
        const ox = blocker.position.x - this.position.x;
        const oz = blocker.position.z - this.position.z;
        // Which side of my path is it on? Step to the other side (or my preferred side if dead ahead).
        const cross = desired.x * oz - desired.z * ox;
        const side = Math.abs(cross) > 0.05 ? -Math.sign(cross) : this.sideBias;
        sideX = -desired.z * side * crowd.queueSidestep * closeness;
        sideZ = desired.x * side * crowd.queueSidestep * closeness;
      }
    }

    // 4) Combine: walking (slowed when arriving / queueing / attacking) + sidestep + spacing push.
    const walkSpeed = this.speed * speedScale * arrive * walk;
    let tx = (hasPath ? desired.x * walkSpeed : 0) + (sideX + pushX * crowd.separationStrength) * this.speed;
    let tz = (hasPath ? desired.z * walkSpeed : 0) + (sideZ + pushZ * crowd.separationStrength) * this.speed;
    const maxSpeed = this.speed * crowd.maxCrowdSpeed;
    const len = Math.hypot(tx, tz);
    if (len > maxSpeed) {
      tx *= maxSpeed / len;
      tz *= maxSpeed / len;
    }

    // 4) Accelerate toward it, then move with the same collision code as the player.
    let ax = tx - this.velocity.x;
    let az = tz - this.velocity.z;
    const aLen = Math.hypot(ax, az);
    const maxChange = type.acceleration * dt;
    if (aLen > maxChange) {
      ax *= maxChange / aLen;
      az *= maxChange / aLen;
    }
    this.velocity.x += ax;
    this.velocity.z += az;
    this.velocity.y = Math.max(this.velocity.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
    moveAndCollide(this.position, this.velocity, dt, type.radius, type.height, colliders, feel.movement.stepTolerance);

    // 5) Face where I'm TRYING to go (not where shoves push me, which looked like skating sideways);
    //    face the player when attacking, settled in my slot, at arm's length, or with nowhere to go.
    if (facePlayer) this.faceToward(player.position, dt, type.attack.turnSpeed); // locked on mid-attack
    else if (!hasPath || arrive < 0.5 || distToPlayer < contact * 2) this.faceToward(player.position, dt);
    else this.faceDirection(desired.x, desired.z, dt);
  }

  // If the straight line to my slot passes through the player's body (slot on their far side),
  // walk around them instead: sideways around the circle toward the slot, keeping my distance.
  // Overwrites `desired` only when needed.
  circleAroundPlayer(player, contact, sx, sz, toSlot) {
    const px = player.position.x - this.position.x; // me -> player
    const pz = player.position.z - this.position.z;
    const t = clamp01((px * sx + pz * sz) / (toSlot * toSlot)); // closest point on my path to the player
    const gap = Math.hypot(px - sx * t, pz - sz * t);
    // Only when the player is in the way PARTWAY along the path (the slot is round their far
    // side). The last stretch into a slot never counts: inner-ring slots sit at arm's length.
    const lastStretch = t > zombieCrowd.circleLastStretch || toSlot < zombieCrowd.circleLastStretchMeters;
    if (lastStretch || gap >= contact + zombieCrowd.circleMargin) return; // the way is clear
    const r = Math.hypot(px, pz);
    if (r < 1e-4) return;
    const ox = -px / r; // player -> me (outward)
    const oz = -pz / r;
    // Go round the side the slot is on (cross product of player->me and player->slot).
    const slx = this.slot.x - player.position.x;
    const slz = this.slot.z - player.position.z;
    const side = ox * slz - oz * slx >= 0 ? 1 : -1;
    // Tangent around the player, plus a pull outward/inward to hold a ring just outside arm's reach.
    const keepRadius = contact + zombieCrowd.circleMargin;
    let dx = -oz * side + ox * (keepRadius - r);
    let dz = ox * side + oz * (keepRadius - r);
    const len = Math.hypot(dx, dz);
    desired.x = dx / len;
    desired.z = dz / len;
  }

  distanceTo(player) {
    return Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z);
  }

  // Is the player within `range` (flat distance) and at a height the arms can reach?
  inReach(player, range) {
    if (this.distanceTo(player) > range) return false;
    const top = this.position.y + this.type.height;
    return player.position.y <= top && player.position.y + player.height >= this.position.y;
  }

  // Is a wall (or pillar, shutter...) between my reaching arms and the player's chest? Low things
  // like benches and counters don't count: the arms reach over them.
  wallBetween(player, colliders) {
    const reachY = this.position.y + this.type.attack.reachHeight;
    reachRay.origin.set(this.position.x, reachY, this.position.z);
    reachRay.direction.set(
      player.position.x - this.position.x,
      player.position.y + player.height * 0.6 - reachY,
      player.position.z - this.position.z,
    );
    const d = reachRay.direction.length();
    if (d < 1e-4) return false;
    reachRay.direction.divideScalar(d);
    for (const box of colliders) {
      if (box.ignoreShots || box.containsPoint(reachRay.origin)) continue;
      if (reachRay.intersectBox(box, reachHit) && reachHit.distanceTo(reachRay.origin) < d) return true;
    }
    return false;
  }

  // Is the player still in reach, roughly in front, and at a height the arms can reach?
  canHit(player) {
    const attack = this.type.attack;
    if (!this.inReach(player, attack.range)) return false;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return true;
    const facing = (-Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / d; // cos(angle off-center)
    return facing >= Math.cos((attack.hitHalfAngleDegrees * Math.PI) / 180);
  }

  faceToward(point, dt, turnSpeed = this.type.turnSpeed) {
    this.faceDirection(point.x - this.position.x, point.z - this.position.z, dt, turnSpeed);
  }

  // Turn (at most turnSpeed rad/s) so the model's -Z faces direction (dx, dz).
  faceDirection(dx, dz, dt, turnSpeed = this.type.turnSpeed) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return;
    const target = Math.atan2(-dx, -dz);
    let diff = target - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = turnSpeed * dt;
    this.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }
}
