// =============================================================================
// ZOMBIE
// One zombie: state machine, movement, hitboxes. Runs on the fixed tick.
// Implements the "shootable" interface from weapons/hitscan.js, so the staple
// gun (headshots, hit markers, splatter) works on it with no extra code.
//
// States:
//   spawning -> rises out of the floor (can already be shot)
//   chasing  -> follows the flow field toward the player, stops at arm's length
//   dead     -> tips over, lies there, sinks away, then `removed` is set
// (Attacking comes in the second half of step 3.)
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { zombieCrowd } from '../config/zombies.js';
import { moveAndCollide } from '../world/collision.js';
import { createZombieModel } from './zombieModel.js';

const ease = (t) => t * t * (3 - 2 * t);
const desired = { x: 0, z: 0 };

export class Zombie {
  constructor({ type, health, position, yaw }) {
    this.type = type;
    this.maxHealth = health;
    this.health = health;

    this.position = position.clone(); // feet
    this.prevPosition = position.clone();
    this.velocity = new THREE.Vector3();
    this.yaw = yaw;
    this.prevYaw = yaw;
    this.speed = type.speed * (1 + (Math.random() * 2 - 1) * type.speedVariation);

    this.state = 'spawning';
    this.stateTime = 0;
    this.flinchTimer = 0;
    this.killedByHeadshot = false;
    this.removed = false; // set once the corpse has sunk away; the manager then deletes it
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

  takeHit({ damage, part }) {
    if (!this.isAlive) return { killed: false };
    this.health -= damage;
    this.flinchTimer = this.type.flinchSeconds;
    if (this.health > 0) return { killed: false };
    this.killedByHeadshot = part === 'head';
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

  /** ctx: { nav, player, colliders, zombies } */
  update(dt, ctx) {
    this.prevPosition.copy(this.position);
    this.prevYaw = this.yaw;
    this.stateTime += dt;
    this.flinchTimer = Math.max(0, this.flinchTimer - dt);

    if (this.state === 'spawning') {
      this.faceToward(ctx.player.position, dt);
      if (this.stateTime >= this.type.spawnSeconds) this.setState('chasing');
    } else if (this.state === 'chasing') {
      this.chase(dt, ctx);
    } else if (this.state === 'dead') {
      const t = this.type;
      if (this.stateTime >= t.fallSeconds + t.corpseSeconds + t.sinkSeconds) this.removed = true;
    }

    if (this.isAlive) this.updateHitboxes();
  }

  chase(dt, { nav, player, colliders, zombies }) {
    const type = this.type;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    const distToPlayer = Math.hypot(dx, dz);
    const contact = type.radius + feel.player.radius + zombieCrowd.contactGap;

    // 1) Where the path says to go (straight at the player when there's a clear line).
    desired.x = 0;
    desired.z = 0;
    let hasPath = false;
    if (distToPlayer > contact) hasPath = nav.directionTo(this.position, player.position, desired);

    // 2) Crowd separation: push away from zombies that are too close.
    let pushX = 0;
    let pushZ = 0;
    const sepR = zombieCrowd.separationRadius;
    for (const other of zombies) {
      if (other === this || !other.isAlive) continue;
      const ox = this.position.x - other.position.x;
      const oz = this.position.z - other.position.z;
      const d = Math.hypot(ox, oz);
      if (d >= sepR || d < 1e-4) continue;
      const strength = 1 - d / sepR;
      pushX += (ox / d) * strength;
      pushZ += (oz / d) * strength;
    }

    // 3) Combine into a target velocity. Ease off when arriving, so they stop at arm's
    //    length instead of bumping into the player. Never faster than their walking speed.
    const s = zombieCrowd.separationStrength;
    const arrive = Math.max(0, Math.min(1, (distToPlayer - contact) / zombieCrowd.arriveDistance));
    let tx = (hasPath ? desired.x * arrive : 0) + pushX * s;
    let tz = (hasPath ? desired.z * arrive : 0) + pushZ * s;
    const len = Math.hypot(tx, tz);
    if (len > 1) {
      tx /= len;
      tz /= len;
    }
    tx *= this.speed;
    tz *= this.speed;

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

    // 5) Face the way we're walking; face the player when close or standing still.
    if (distToPlayer < contact * 2 || this.horizontalSpeed < 0.2) this.faceToward(player.position, dt);
    else this.faceDirection(this.velocity.x, this.velocity.z, dt);
  }

  faceToward(point, dt) {
    this.faceDirection(point.x - this.position.x, point.z - this.position.z, dt);
  }

  // Turn (at most turnSpeed rad/s) so the model's -Z faces direction (dx, dz).
  faceDirection(dx, dz, dt) {
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return;
    const target = Math.atan2(-dx, -dz);
    let diff = target - this.yaw;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    const maxTurn = this.type.turnSpeed * dt;
    this.yaw += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }
}
