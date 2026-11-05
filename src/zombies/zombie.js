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
//              (the last attack.slamSeconds of it are the slam coming down)
//   swing    -> the slam lands as this starts: the player is hit only if still in reach and in front;
//               then a short follow-through
//   (back to chasing, with a recovery before it may attack again: long after a hit, short after a miss)
//   Types with `winded` (Mall Walker) are winded after every swing instead: they stand panting
//   (no attacks), then follow slowly for a moment (windedTimer; still the 'chasing' state)
//   Types with `charge` (Cart Pusher), from chasing with a clear, wide lane at mid range:
//   chargeTelegraph -> stands rattling its cart, turning to aim; the direction LOCKS at the end
//   charging        -> straight line at charge speed; hits the player once (damage + knockback) ->
//   chargeRecover   -> stands a moment, then chasing again
//   crashed         -> the cart's nose hit something or it ran out of charge: stunned, takes extra damage
//   dead     -> tips over, lies there, sinks away, then `removed` is set
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { zombieCrowd } from '../config/zombies.js';
import { moveAndCollide } from '../world/collision.js';
import { createZombieModel } from './zombieModel.js';
import { isObserved } from './observation.js';
import { applyCartHitboxes } from './cartPose.js';

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const desired = { x: 0, z: 0 };
const reachRay = new THREE.Ray();
const reachHit = new THREE.Vector3();
const laneRay = new THREE.Ray();

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

    this.observed = false;
    this.observationHold = 0;
    this.frozen = false;
    this.state = 'spawning';
    this.stateTime = 0;
    this.flinchTimer = 0;
    this.flinchDuration = type.flinchSeconds;
    this.flinchStrength = 1;
    this.flinchPart = 'body';
    this.flinchSide = 1;
    this.hitstopTimer = 0;
    this.staggerTimer = 0;
    this.staggerDrag = 0;
    this.slowTimer = 0;
    this.slowFraction = 1;
    this.burn = null; // Fryer Oil: { perTick, tickSeconds, nextTick, left }, or null
    this.deathImpulse = 1;
    this.deathTwist = 0;
    this.lastHitDir = null;
    this.attackCooldown = 0; // seconds until it may start another attack
    const atk = type.attack;
    this.windupSeconds = Math.max(atk.minWindupSeconds, atk.windupSeconds - atk.windupShrinkPerRound * (round - 1));
    this.windedTimer = 0; // > 0 while winded after a swing (types with `winded`)
    // Charge (types with `charge`): cooldown, lane-check timer, the locked direction and how far is left.
    this.chargeCooldown = 0;
    this.chargeCheckTimer = Math.random() * (type.charge?.checkSeconds ?? 0);
    this.chargeDir = { x: 0, z: -1 };
    this.chargeLeft = 0;
    this.killedByHeadshot = false;
    this.killedByMelee = false;
    this.removed = false;
    // Chase sounds (types with `sounds`): random start so a group doesn't squeak in unison.
    this.stepSoundTimer = Math.random() * (type.sounds?.step?.interval ?? 0);
    this.huffSoundTimer = Math.random() * (type.sounds?.huff?.interval ?? 0); // set once the corpse has sunk away; the manager then deletes it

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

    if (type.cartHitbox) this.hitboxes.push({ part: 'body', box: new THREE.Box3() }); // the tipped cart (zombies/cartPose.js)
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

  // `source`: what dealt the damage, for kill credit ('gun' by default, 'melee' for the box cutter,
  // later 'hazard' / 'effect'...). Read as zombie.killedBy by the 'kill' event (game/events.js).
  takeHit({ damage, part, melee = false, source = melee ? 'melee' : 'gun', direction = null, impact = null }) {
    if (!this.isAlive) return { killed: false };
    // A crashed Cart Pusher is wide open: hits do extra damage.
    if (this.state === 'crashed') damage *= this.type.charge.crashDamageTakenMultiplier;
    this.health -= damage;
    const flinchMul = (impact?.flinch ?? 1) * (part === 'head' ? 1.35 : 1);
    this.flinchDuration = this.type.flinchSeconds * Math.min(1.6, Math.max(0.85, flinchMul * 0.85));
    this.flinchTimer = this.flinchDuration; // flinches, but an attack already winding up still comes
    this.flinchStrength = flinchMul;
    this.flinchPart = part === 'head' ? 'head' : 'body';
    this.flinchSide = -this.flinchSide;
    if (direction) {
      this.lastHitDir = { x: direction.x, y: direction.y ?? 0, z: direction.z };
    }
    if (this.health > 0) {
      // Physical stagger knockback & brief micro-hitstop on live chasing zombies
      if (impact && direction && this.state === 'chasing' && this.speed > 0) {
        const kb = (impact.knockback ?? 0) * (part === 'head' ? 1.25 : 1);
        if (kb > 0) {
          const len = Math.hypot(direction.x, direction.z) || 1;
          this.velocity.x += (direction.x / len) * kb;
          this.velocity.z += (direction.z / len) * kb;
        }
        if (impact.hitstopSeconds > 0) {
          this.hitstopTimer = Math.max(this.hitstopTimer, impact.hitstopSeconds * (part === 'head' ? 1.3 : 1));
        }
      }
      return { killed: false };
    }
    this.killedByHeadshot = part === 'head' && !melee;
    this.killedByMelee = melee;
    this.killedBy = source;
    this.deathImpulse = (impact?.deathImpulse ?? 1) * (this.killedByHeadshot ? 1.25 : 1);
    this.deathTwist = this.flinchSide * Math.min(0.42, 0.16 * this.deathImpulse);
    this.die();
    return { killed: true };
  }

  die() {
    this.setState('dead');
    this.velocity.set(0, 0, 0);
    if (this.onDeath) this.onDeath(this);
  }

  // Security Sweep interrupts attacks/charges without invoking damage or kill events.
  staggerAway(origin, { seconds, knockback, drag }) {
    if (!this.isAlive || this.state === 'spawning') return false;
    this.setState('chasing');
    this.staggerTimer = seconds;
    this.staggerDrag = drag;
    this.attackCooldown = Math.max(this.attackCooldown, seconds);
    this.chargeCooldown = Math.max(this.chargeCooldown, seconds);
    this.chargeLeft = 0;
    const dx = this.position.x - origin.x;
    const dz = this.position.z - origin.z;
    const length = Math.hypot(dx, dz);
    this.velocity.x = (length > 0 ? dx / length : Math.sin(this.yaw)) * knockback;
    this.velocity.z = (length > 0 ? dz / length : Math.cos(this.yaw)) * knockback;
    this.flinchTimer = seconds;
    this.flinchDuration = seconds;
    this.updateHitboxes();
    return true;
  }

  // Hitboxes are axis-aligned boxes that follow the zombie (and rise with it while spawning).
  applySlow(seconds, fraction) {
    if (!this.isAlive || this.state === 'spawning') return;
    this.slowFraction = this.slowTimer > 0 ? Math.min(this.slowFraction, fraction) : fraction;
    this.slowTimer = Math.max(this.slowTimer, seconds);
  }

  // Burning: `damage` in total over `seconds`, paid in ticks through takeHit, so a kill counts like any other. A new burn
  // restarts the clock and never weakens one already burning. Burns don't stack: re-lighting a zombie doesn't add damage.
  applyBurn(damage, seconds, tickSeconds) {
    if (!this.isAlive || this.state === 'spawning') return;
    const perTick = (damage * tickSeconds) / seconds;
    this.burn = { perTick: Math.max(perTick, this.burn?.perTick ?? 0), tickSeconds, nextTick: this.burn?.nextTick ?? tickSeconds, left: seconds };
  }

  updateBurn(dt) {
    if (!this.burn) return;
    if (!this.isAlive) {
      this.burn = null;
      return;
    }
    this.burn.left -= dt;
    this.burn.nextTick -= dt;
    if (this.burn.nextTick <= 1e-9) {
      this.burn.nextTick += this.burn.tickSeconds;
      this.takeHit({ damage: this.burn.perTick, part: 'body', source: 'build' });
    }
    if (this.burn && this.burn.left <= 1e-9) this.burn = null;
  }

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
    if (this.type.cartHitbox) applyCartHitboxes(this, y); // the Cart Pusher leans: its boxes follow the pose
  }

  // --- Tick ----------------------------------------------------------------------

  /**
   * ctx: { nav, player, colliders, zombies,
   *        canAttack: boolean (false once the player is dead),
   *        onPlayerHit(damage, zombie),
   *        onSound(name, volume) (optional: a zombie sound, volume 0..1 by distance) }
   */
  update(dt, ctx) {
    this.prevPosition.copy(this.position);
    this.prevYaw = this.yaw;
    this.stateTime += dt;
    this.flinchTimer = Math.max(0, this.flinchTimer - dt);
    this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.windedTimer = Math.max(0, this.windedTimer - dt);
    this.chargeCooldown = Math.max(0, this.chargeCooldown - dt);
    this.slowTimer = Math.max(0, this.slowTimer - dt);
    if (this.slowTimer === 0) this.slowFraction = 1;
    this.updateBurn(dt);
    const attack = this.type.attack;
    const charge = this.type.charge;

    this.frozen = false;
    if (this.type.observation && this.isAlive && this.state !== 'spawning') {
      const wasObserved = this.observed;
      this.observed = ctx.canAttack && isObserved(this, ctx.player, ctx.colliders);
      if (this.observed) this.observationHold = this.type.observation.releaseSeconds;
      else this.observationHold = Math.max(0, this.observationHold - dt);
      if (wasObserved && !this.observed) this.playSound(this.type.sounds.release, ctx);
      this.frozen = this.observed || this.observationHold > 0;
      if (this.frozen && this.staggerTimer <= 0) {
        if (this.state === 'windup' || this.state === 'swing') {
          if (this.state === 'swing') this.attackCooldown = Math.max(this.attackCooldown, attack.recoverSeconds);
          this.setState('chasing');
        }
        this.velocity.x = this.velocity.z = 0;
        this.standStill(dt, ctx); // gravity continues, including on stairs
        this.updateHitboxes();
        return;
      }
    }
    if (this.isAlive && this.staggerTimer > 0) {
      this.staggerTimer = Math.max(0, this.staggerTimer - dt);
      this.velocity.x *= Math.exp(-this.staggerDrag * dt);
      this.velocity.z *= Math.exp(-this.staggerDrag * dt);
      this.velocity.y = Math.max(this.velocity.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
      moveAndCollide(this.position, this.velocity, dt, this.type.radius, this.type.height, ctx.colliders, feel.movement.stepTolerance);
      this.updateHitboxes();
      return;
    }

    if (this.state === 'spawning') {
      this.faceToward(ctx.player.position, dt);
      if (this.stateTime >= this.type.spawnSeconds) this.setState('chasing');
    } else if (this.state === 'chasing') {
      const hitstopScale = this.hitstopTimer > 0 ? 0.15 : 1;
      this.chase(dt, ctx, this.windedSpeedScale() * hitstopScale);
      this.chaseSounds(dt, ctx);
      // Starts swinging on the way in (no stopping first), unless a wall is in the way.
      if (ctx.canAttack && this.attackCooldown <= 0 && this.inReach(ctx.player, attack.startRange) &&
          !this.wallBetween(ctx.player, ctx.colliders)) {
        this.setState('windup');
      } else if (charge && ctx.canAttack && this.chargeCooldown <= 0) {
        // Cart Pusher: every so often, look for a clear, wide lane to the player at mid range.
        this.chargeCheckTimer -= dt;
        if (this.chargeCheckTimer <= 0) {
          this.chargeCheckTimer = charge.checkSeconds;
          if (this.canStartCharge(ctx.player, ctx.colliders)) {
            this.setState('chargeTelegraph');
            this.playSound(this.type.sounds?.telegraph, ctx);
          }
        }
      }
    } else if (this.state === 'chargeTelegraph') {
      this.standStill(dt, ctx);
      this.faceToward(ctx.player.position, dt, charge.telegraphTurnSpeed);
      if (this.stateTime >= charge.telegraphSeconds) {
        // Lock the direction it's FACING (it tracked you at a limited turn speed): a late sidestep dodges it.
        this.chargeDir.x = -Math.sin(this.yaw);
        this.chargeDir.z = -Math.cos(this.yaw);
        this.chargeLeft = Math.min(charge.maxMeters, this.distanceTo(ctx.player) + charge.overshootMeters);
        this.setState('charging');
      }
    } else if (this.state === 'charging') {
      this.updateCharge(dt, ctx);
    } else if (this.state === 'chargeRecover') {
      this.standStill(dt, ctx);
      this.faceToward(ctx.player.position, dt);
      if (this.stateTime >= charge.hitRecoverSeconds) this.endCharge();
    } else if (this.state === 'crashed') {
      this.standStill(dt, ctx);
      if (this.stateTime >= charge.crashSeconds) this.endCharge();
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
        const winded = this.type.winded;
        if (winded) {
          // Winded after every swing: stands panting (no attacks), then follows slowly for a moment.
          this.windedTimer = winded.standSeconds + winded.slowSeconds;
          this.attackCooldown = Math.max(this.attackCooldown, winded.standSeconds);
          this.playSound(this.type.sounds?.winded, ctx);
        }
      }
    } else if (this.state === 'dead') {
      const t = this.type;
      if (this.stateTime >= t.fallSeconds + t.corpseSeconds + t.sinkSeconds) this.removed = true;
    }

    if (this.isAlive) this.updateHitboxes();
  }

  // --- Charge (Cart Pusher) -----------------------------------------------------------

  // Can it charge from here? The player at mid range, at about its own height, and a clear lane: three
  // horizontal rays at cart height (centre + both edges of a laneHalfWidth-wide lane), so walls, counters,
  // benches and stools all block it, and it never charges through a doorway it would only half fit.
  canStartCharge(player, colliders) {
    const charge = this.type.charge;
    const d = this.distanceTo(player);
    if (d < charge.minRange || d > charge.maxRange) return false;
    if (Math.abs(player.position.y - this.position.y) > 0.5) return false;
    const dx = (player.position.x - this.position.x) / d;
    const dz = (player.position.z - this.position.z) / d;
    for (const side of [0, -1, 1]) {
      const ox = -dz * side * charge.laneHalfWidth;
      const oz = dx * side * charge.laneHalfWidth;
      if (this.rayBlocked(this.position.x + ox, this.position.z + oz, dx, dz, d, colliders)) return false;
    }
    return true;
  }

  // Does a horizontal ray at cart height from (x, z) along (dx, dz) hit a collider within `length`?
  rayBlocked(x, z, dx, dz, length, colliders) {
    laneRay.origin.set(x, this.position.y + this.type.charge.laneCheckHeight, z);
    laneRay.direction.set(dx, 0, dz);
    for (const box of colliders) {
      if (box.containsPoint(laneRay.origin)) continue;
      if (laneRay.intersectBox(box, reachHit) && reachHit.distanceTo(laneRay.origin) < length) return true;
    }
    return false;
  }

  // One tick of the charge: dead straight along the locked direction. Crashes when the cart's nose meets
  // something (or it gets stuck), skids out when the distance runs out, and hits the player at most once.
  updateCharge(dt, ctx) {
    const charge = this.type.charge;
    const dir = this.chargeDir;
    const speed = Math.min(charge.speed * this.slowFraction, this.horizontalSpeed + charge.acceleration * dt);
    const step = speed * dt;
    if (this.rayBlocked(this.position.x, this.position.z, dir.x, dir.z, charge.noseReach + step, ctx.colliders)) {
      this.crash(ctx);
      return;
    }
    const startX = this.position.x;
    const startZ = this.position.z;
    this.velocity.x = dir.x * speed;
    this.velocity.z = dir.z * speed;
    this.velocity.y = Math.max(this.velocity.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
    moveAndCollide(this.position, this.velocity, dt, this.type.radius, this.type.height, ctx.colliders,
      feel.movement.stepTolerance);
    const moved = Math.hypot(this.position.x - startX, this.position.z - startZ);
    this.chargeLeft -= moved;
    this.faceDirection(dir.x, dir.z, dt, Infinity);

    if (ctx.canAttack && this.chargeCatches(ctx.player)) {
      ctx.onPlayerHit(charge.damage, this, { x: dir.x * charge.knockback, z: dir.z * charge.knockback });
      this.velocity.set(0, 0, 0);
      this.setState('chargeRecover');
    } else if (this.chargeLeft <= 0 || (this.stateTime > 0.2 && moved < step * 0.3)) {
      this.crash(ctx);
    }
  }

  // Is the player's body in the cart's path: ahead of it within the nose (+ padding) and within the
  // cart's width (+ padding) of its line? A sidestep of about a meter clears it.
  chargeCatches(player) {
    const charge = this.type.charge;
    const dx = player.position.x - this.position.x;
    const dz = player.position.z - this.position.z;
    if (player.position.y > this.position.y + this.type.height || player.position.y + player.height < this.position.y) return false;
    const along = dx * this.chargeDir.x + dz * this.chargeDir.z;
    const across = Math.abs(dx * this.chargeDir.z - dz * this.chargeDir.x);
    return along > -this.type.radius && along <= charge.noseReach + feel.player.radius + charge.hitPadding &&
      across <= charge.hitHalfWidth + feel.player.radius;
  }

  crash(ctx) {
    this.velocity.set(0, 0, 0);
    this.setState('crashed');
    this.playSound(this.type.sounds?.crash, ctx);
  }

  // Back to chasing after a charge (hit or crash): no charging again for a while.
  endCharge() {
    this.setState('chasing');
    this.chargeCooldown = this.type.charge.cooldownSeconds;
  }

  // Stop where it stands (still falls if in the air): telegraphing, recovering, crashed.
  standStill(dt, { colliders }) {
    this.velocity.x = 0;
    this.velocity.z = 0;
    this.velocity.y = Math.max(this.velocity.y - feel.movement.gravity * dt, -feel.movement.maxFallSpeed);
    moveAndCollide(this.position, this.velocity, dt, this.type.radius, this.type.height, colliders, feel.movement.stepTolerance);
  }

  // Walking speed while winded: 0 while standing panting, then slowSpeedFraction, then back to 1.
  windedSpeedScale() {
    const winded = this.type.winded;
    if (!winded || this.windedTimer <= 0) return 1;
    return this.windedTimer > winded.slowSeconds ? 0 : winded.slowSpeedFraction;
  }

  // Footstep squeaks and huffing while chasing (types with `sounds`), not while standing winded.
  chaseSounds(dt, ctx) {
    const sounds = this.type.sounds;
    if (!sounds || this.windedSpeedScale() === 0) return;
    if (sounds.step) {
      this.stepSoundTimer -= dt;
      if (this.stepSoundTimer <= 0) {
        this.stepSoundTimer += sounds.step.interval;
        if (Math.random() < sounds.step.chance) this.playSound(sounds.step, ctx);
      }
    }
    if (sounds.huff) {
      this.huffSoundTimer -= dt;
      if (this.huffSoundTimer <= 0) {
        this.huffSoundTimer += sounds.huff.interval;
        this.playSound(sounds.huff, ctx);
      }
    }
  }

  // Play a sound ({ name, maxDistance }) through ctx.onSound, louder the closer the player is.
  playSound(sound, ctx) {
    if (!sound || !ctx.onSound) return;
    const volume = 1 - this.distanceTo(ctx.player) / sound.maxDistance;
    if (volume > 0) ctx.onSound(sound.name, volume);
  }

  // Move toward the player. `speedScale` slows the walking part (e.g. mid-attack); `facePlayer`
  // keeps it turned toward the player (locked on while attacking).
  chase(dt, { nav, player, colliders, zombies }, speedScale = 1, facePlayer = false) {
    speedScale *= this.slowFraction;
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
      const w = Math.min(crowd.maxSeparationPush, ((sepR - d) / (sepR - crowd.minSpacing)) ** 2);
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

  // Start over at another spot (the stuck-zombie failsafe): rise out of the floor again,
  // keeping its health.
  respawnAt(position, yaw) {
    this.observed = this.frozen = false;
    this.observationHold = 0;
    this.position.copy(position);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.prevYaw = yaw;
    this.slot = null;
    this.slotKey = null;
    this.attackCooldown = 0;
    this.windedTimer = 0;
    this.chargeCooldown = 0;
    this.staggerTimer = 0;
    this.setState('spawning');
    this.updateHitboxes();
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
