// =============================================================================
// PLAYER CONTROLLER
// First-person movement: mouse look, WASD, jump, limited sprint, prone, gravity,
// and collision. Runs on the fixed game tick; the camera is interpolated
// between ticks at render time so motion stays smooth on any monitor.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { moveAndCollide, hasHeadroom } from '../world/collision.js';
import { createSpring } from '../core/spring.js';
import { createVault } from './vault.js';

const DEG_TO_RAD = Math.PI / 180;

export class PlayerController {
  constructor({ camera, input, stats, colliders, spawn, getBodies = () => [] }) {
    this.camera = camera;
    this.input = input;
    this.stats = stats;
    this.colliders = colliders;
    this.spawn = spawn;

    this.position = new THREE.Vector3(); // feet position
    this.prevPosition = new THREE.Vector3(); // position at the previous tick (for interpolation)
    this.velocity = new THREE.Vector3();
    this.yaw = 0; // left/right look (radians)
    this.pitch = 0; // up/down look (radians)
    // Recoil and hit jolts on the view, springing back to 0 (radians, core/spring.js).
    // viewKick (pitch) is part of the aim, so shots go where the crosshair is; viewRoll is visual only.
    this.kickSpring = createSpring({ frequency: feel.look.recoilFrequency, damping: feel.look.recoilDamping });
    this.rollSpring = createSpring({ frequency: feel.look.recoilRollFrequency, damping: feel.look.recoilRollDamping });
    this.yawKickSpring = createSpring({ frequency: feel.look.recoilFrequency, damping: feel.look.recoilDamping });
    this.prevViewKickYaw = 0;
    this.prevViewKick = 0; // last tick's values, for smooth rendering between ticks
    this.prevViewRoll = 0;
    // Set by the weapon each tick (see weapons/aim.js): aiming blocks sprint and slows walking.
    this.isAiming = false;
    this.aimAmount = 0; // 0 = hip, 1 = fully aimed
    this.aimMoveMultiplier = 1; // optional weapon handling penalty, separate from perk/player stats
    this.lookScale = 1; // mouse sensitivity multiplier (lower while zoomed in)

    this.grounded = false;
    this.timeSinceGrounded = 0;
    this.jumpBuffer = 0;
    // Fall damage (feel.fall): the highest point of this unbroken fall, or the floor a ledge vault started from.
    this.fallPeakY = -Infinity;
    this.fallBase = null;
    this.moveWish = { x: 0, z: 0 }; // this tick's held move direction (world, unit or zero)
    this.dropVelocity = null; // { x, z } while dropping from a balcony rail (set by the vault, cleared on landing)
    this.onFall = null; // optional callback({ drop, damage }) when a landing hurts; the game wires it to health

    this.sprintMeter = stats.sprintDuration; // seconds of sprint left
    this.timeSinceSprint = 0;
    this.isSprinting = false;
    this.sprintExhausted = false;
    this.sprintLatched = false;

    // Stance: 'stand' | 'crouch' | 'slide' | 'prone'. Crouch/slide are unchanged; prone is a toggle.
    this.stance = 'stand';
    this.height = feel.player.height; // current collision height (shrinks when crouched/sliding)
    this.eyeHeight = feel.player.eyeHeight; // camera height; eases toward the stance's target
    this.prevEyeHeight = this.eyeHeight;
    this.slideTimer = 0; // seconds left in the current slide
    this.slideCooldownTimer = 0; // seconds until another slide is allowed
    this.slideDirX = 0;
    this.slideDirZ = 0;
    // Slide on landing / chain slides: jump while sprinting or sliding, press C, and you slide when
    // you land. C counts if it's tapped in the air, held through the landing, pressed just before a
    // jump out of a slide, or just after landing.
    this.airborneWithMomentum = false; // in the air after a sprint-jump or slide-jump (or sliding off a ledge)
    this.slideChainQueued = false; // C was pressed for this jump; slide on landing
    this.chainPressTimer = 0; // > 0 right after C is pressed mid-slide (C a hair before Space)
    this.chainGraceTimer = 0; // > 0 right after landing from a momentum jump (C a hair late)
    this.chainCount = 0; // chained slides in a row (each one starts slower; see feel.slide.chainSpeed)
    this.chainResetTimer = 0; // seconds on your feet since the last slide (resets chainCount)
    this.slideSpeedScale = 1; // this slide's start-speed multiplier
    this.sprintBlockTimer = 0; // > 0: no sprinting (just fired the gun)
    this.vaultHold = 0; // > 0: a jump press is waiting to become a vault (feel.vault.magnetSeconds)
    this.timeSinceJump = Infinity; // seconds since the last normal jump (a vault can still catch it)
    this.jumpFloorY = 0; // floor height the last jump started from

    // Melee lunge: a short forced dash toward a target (set by weapons/melee.js).
    this.lungeTimer = 0;
    this.lungeVX = 0;
    this.lungeVZ = 0;
    this.lungeExitSpeed = 0;
    this.meleeBusy = false; // slash + recovery: blocks a new vault
    this.meleeCommitted = false; // until impact: no new jump/slide or movement steering
    this.meleeFacingYaw = 0;
    this.meleeTurnLimit = 0;
    this.vault = createVault({ player: this, colliders, getBodies });

    // Sprint effects (visual only): 0..1 blend toward "sprinting", step phase, bob strength.
    this.sprintAmount = 0;
    this.bobPhase = 0;
    this.bobStrength = 0; // meters of head bob right now

    camera.rotation.order = 'YXZ'; // yaw first, then pitch: standard FPS camera
    this.respawn();
  }

  respawn() {
    this.teleport(this.spawn);
  }

  // Instantly move to { position, yaw }, standing still and upright.
  teleport({ position, yaw }) {
    this.fallPeakY = -Infinity;
    this.fallBase = null;
    this.dropVelocity = null;
    this.position.copy(position);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.kickSpring.reset();
    this.rollSpring.reset();
    this.yawKickSpring.reset();
    this.prevViewKick = 0;
    this.prevViewRoll = 0;
    this.prevViewKickYaw = 0;
    this.stance = 'stand';
    this.height = feel.player.height;
    this.eyeHeight = feel.player.eyeHeight;
    this.prevEyeHeight = this.eyeHeight;
    this.slideTimer = 0;
    this.slideCooldownTimer = 0;
    this.airborneWithMomentum = false;
    this.slideChainQueued = false;
    this.chainPressTimer = 0;
    this.chainGraceTimer = 0;
    this.chainCount = 0;
    this.chainResetTimer = 0;
    this.slideSpeedScale = 1;
    this.sprintBlockTimer = 0;
    this.sprintLatched = false;
    this.vaultHold = 0;
    this.timeSinceJump = Infinity;
    this.lungeTimer = 0;
    this.meleeBusy = false;
    this.meleeCommitted = false;
    this.vault.reset();
    this.grounded = false;
    this.timeSinceGrounded = feel.movement.coyoteTime;
    this.jumpBuffer = 0;
    this.sprintMeter = this.stats.sprintDuration;
    this.sprintExhausted = false;
  }

  // Dash in direction (dirX, dirZ) at `speed` for `seconds`, overriding normal movement.
  lunge(dirX, dirZ, speed, seconds) {
    this.lungeVX = dirX * speed;
    this.lungeVZ = dirZ * speed;
    this.lungeTimer = seconds;
    this.lungeExitSpeed = Math.max(
      Math.hypot(this.velocity.x, this.velocity.z) * this.stats.meleeLungeMomentumRetention,
      speed * feel.melee.lungeEndSpeedKeep,
    );
  }

  stopLunge() {
    if (this.lungeTimer <= 0) return;
    this.lungeTimer = 0;
    // Collision can already have stopped us: never restore speed through a wall or crowd.
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    const keep = speed > 0 ? Math.min(1, this.lungeExitSpeed / speed) : 0;
    this.velocity.x *= keep;
    this.velocity.z *= keep;
  }

  // 0..1, for the HUD health bar
  get healthFraction() {
    return this.stats.health / this.stats.maxHealth;
  }

  // 0..1, for the HUD sprint bar
  get sprintFraction() {
    return this.sprintMeter / this.stats.sprintDuration;
  }

  // Mouse look is applied every rendered frame (not per tick) so it feels instant.
  applyLook(dx, dy) {
    const look = feel.look;
    const invert = look.invertY ? -1 : 1;
    const sensitivity = look.mouseSensitivity * this.lookScale;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity * invert;
    this.clampPitch();
  }

  // Controller look, applied every rendered frame: yaw/pitch changes in radians
  // (+yaw = turn right, +pitch = look up). Scaled like the mouse by ADS zoom.
  applyStickLook(yawDelta, pitchDelta) {
    this.yaw -= yawDelta * this.lookScale;
    this.pitch += pitchDelta * this.lookScale;
    this.clampPitch();
  }

  clampPitch() {
    const maxPitch = feel.look.maxPitchDegrees * DEG_TO_RAD;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
    if (this.meleeCommitted) {
      const offset = Math.atan2(Math.sin(this.yaw - this.meleeFacingYaw), Math.cos(this.yaw - this.meleeFacingYaw));
      this.yaw = this.meleeFacingYaw + Math.max(-this.meleeTurnLimit, Math.min(this.meleeTurnLimit, offset));
    }
  }

  // Upward view offset from recoil and jolts (radians). Included in the aim.
  get viewKick() {
    return this.kickSpring.value;
  }

  // An instant jolt of the view (e.g. getting hit: negative = down). It springs back.
  addViewKick(radians) {
    this.kickSpring.displace(radians);
  }

  // Sideways recoil offset (radians, + = left). Included in the aim.
  get viewKickYaw() {
    return this.yawKickSpring.value;
  }

  // A weapon shot: the view kicks up to `pitchRadians` and sideways `yawRadians` (peaks; both part
  // of the aim) and rolls `rollRadians` (visual only), then all spring back to where you were aiming.
  addRecoil(pitchRadians, rollRadians = 0, yawRadians = 0) {
    this.kickSpring.kick(pitchRadians);
    this.rollSpring.kick(rollRadians);
    this.yawKickSpring.kick(yawRadians);
  }

  // Advance the recoil springs. Called at the END of each tick (after shots and hits), so a
  // kick shows on the very next frame, in sync with the gun model and the muzzle flash.
  updateView(dt) {
    this.prevViewKick = this.kickSpring.value;
    this.prevViewRoll = this.rollSpring.value;
    this.prevViewKickYaw = this.yawKickSpring.value;
    this.kickSpring.update(dt);
    this.rollSpring.update(dt);
    this.yawKickSpring.update(dt);
  }

  // Eye position and aim direction at this tick (used for hitscan shots).
  // Includes view kick, so shots go exactly where the crosshair is.
  getAim(outOrigin, outDirection) {
    outOrigin.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    const pitch = this.pitch + this.viewKick;
    const yaw = this.yaw + this.viewKickYaw;
    const cosPitch = Math.cos(pitch);
    outDirection.set(-Math.sin(yaw) * cosPitch, Math.sin(pitch), -Math.cos(yaw) * cosPitch);
  }

  // Call while the game is paused so the camera doesn't interpolate stale motion.
  freeze() {
    this.prevPosition.copy(this.position);
    this.prevEyeHeight = this.eyeHeight;
  }

  update(dt) {
    const m = feel.movement;
    const input = this.input;
    const stats = this.stats;

    this.prevPosition.copy(this.position);
    this.prevEyeHeight = this.eyeHeight;

    if (this.vault.active) {
      input.consumeAction('jump'); // a vault never banks another jump
      input.consumeAction('prone'); // no prone/dive queued across a vault
      if (input.consumeAction('crouch')) this.slideChainQueued = true;
      this.slideCooldownTimer = Math.max(0, this.slideCooldownTimer - dt);
      this.updateSprint(dt, this.isSprinting && (feel.sprint.toggle ? this.sprintLatched : input.actionDown('sprint')) && !this.isAiming);
      this.vault.update(dt);
      this.fallPeakY = -Infinity; // (a ledge vault sets fallBase as it lets go)
      this.updateMovementEffects(dt);
      return;
    }

    // --- Which way does the player want to go? (relative to where they look) ---
    // WASD and the left stick combined; a partly pushed stick walks slower.
    const move = input.moveAxis();
    const forwardInput = move.y;
    const rightInput = move.x;

    // Camera looks down -Z at yaw 0.  forward = (-sin, 0, -cos), right = (cos, 0, -sin)
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wishX = -sin * forwardInput + cos * rightInput;
    let wishZ = -cos * forwardInput - sin * rightInput;
    const wishLength = Math.hypot(wishX, wishZ);
    const moveStrength = Math.min(1, wishLength); // 1 for keys, 0..1 for a stick
    // Direction penalty: full speed forwards, slower sideways and slower still backwards.
    // Weighted by how much of the movement is in each direction (diagonals blend).
    const inputLength = Math.hypot(forwardInput, rightInput);
    let directionSpeed = 1;
    if (inputLength > 1e-6) {
      const f = forwardInput / inputLength;
      const r = rightInput / inputLength;
      const fwd = Math.max(0, f);
      const back = Math.max(0, -f);
      directionSpeed = fwd * fwd + back * back * stats.backpedalSpeed + r * r * stats.strafeSpeed;
    }
    if (wishLength > 0) {
      wishX /= wishLength;
      wishZ /= wishLength;
    }
    this.moveWish.x = wishX; // (the vault reads it: pushing into a balcony rail from a standstill climbs it)
    this.moveWish.z = wishZ;

    // --- Sprint meter (only while standing and not aiming: crouch, slide or ADS cancels a sprint) ---
    this.sprintBlockTimer = Math.max(0, this.sprintBlockTimer - dt);

    let wantsSprint = false;
    if (feel.sprint.toggle) {
      // Toggle sprint (a Comfort setting): a press starts a sprint, or ends the one you're in. It carries on until you
      // stop moving forward, fire, run dry, crouch or aim. The press is only READ, never consumed: aim.js sees the same
      // press and lowers the sights, and a toggled crouch stands up for it, so a press while aiming or crouched still
      // starts the sprint (on the next tick, once you're standing with the sights down).
      const pressed = input.actionPressed('sprint');
      if (pressed) this.sprintLatched = !this.isSprinting;
      const canRun =
        this.sprintBlockTimer <= 0 && // just fired the gun: walking
        wishLength > 0 &&
        !this.sprintExhausted &&
        this.sprintMeter > 0 &&
        (!feel.sprint.requiresForward || forwardInput >= feel.sprint.minForwardInput);
      const upright = this.stance === 'stand' && !this.isAiming;
      if (!canRun || (!upright && !pressed)) this.sprintLatched = false;
      wantsSprint = this.sprintLatched && upright;
    } else {
      wantsSprint =
        this.sprintBlockTimer <= 0 && // just fired the gun: walking
        input.actionDown('sprint') &&
        this.stance === 'stand' &&
        !this.isAiming &&
        wishLength > 0 &&
        (!feel.sprint.requiresForward || forwardInput >= feel.sprint.minForwardInput);
    }
    this.updateSprint(dt, wantsSprint);

    // --- Stance: crouch / slide / stand ---
    this.updateStance(dt, wishX, wishZ);

    // --- Accelerate toward the target velocity (a slide or melee lunge overrides this) ---
    if (this.lungeTimer > 0) {
      this.velocity.x = this.lungeVX;
      this.velocity.z = this.lungeVZ;
      if (this.lungeTimer <= dt) this.stopLunge();
      else this.lungeTimer -= dt;
    } else if (this.stance === 'slide') {
      // Fast at first, then drops off toward endSpeed. Direction is locked at slide start.
      const t = 1 - this.slideTimer / stats.slideDuration;
      const startSpeed = stats.slideSpeed * this.slideSpeedScale * stats.surfaceSpeed; // chained slides start slower
      const speed = feel.slide.endSpeed + (startSpeed - feel.slide.endSpeed) * (1 - t * t);
      this.velocity.x = this.slideDirX * speed;
      this.velocity.z = this.slideDirZ * speed;
    } else if (!this.meleeCommitted) {
      let targetSpeed = this.isSprinting ? stats.sprintSpeed : stats.walkSpeed;
      if (this.stance === 'crouch') targetSpeed = stats.crouchSpeed;
      if (this.stance === 'prone') targetSpeed = stats.proneSpeed;
      targetSpeed *= stats.surfaceSpeed;
      targetSpeed *= 1 + (stats.adsMoveSpeed * this.aimMoveMultiplier - 1) * this.aimAmount;
      if (!this.isSprinting) targetSpeed *= moveStrength * directionSpeed; // stick tilt, backpedal/strafe
      // In the air you keep your momentum: you can steer, but holding a direction never slows
      // you down (otherwise a slide-jump bleeds speed mid-air). Letting go of keys still does.
      if (!this.grounded) {
        targetSpeed = Math.max(targetSpeed, Math.hypot(this.velocity.x, this.velocity.z));
      }
      const accel = this.grounded ? m.groundAcceleration : m.airAcceleration;
      const speedBefore = Math.hypot(this.velocity.x, this.velocity.z);
      // Steering in the air: is the held direction no more than 90 degrees off where you're going?
      const steering = !this.grounded && wishLength > 0 && this.velocity.x * wishX + this.velocity.z * wishZ >= 0;
      let dvx = wishX * targetSpeed - this.velocity.x;
      let dvz = wishZ * targetSpeed - this.velocity.z;
      const dvLength = Math.hypot(dvx, dvz);
      const maxChange = accel * dt;
      if (dvLength > maxChange) {
        dvx *= maxChange / dvLength;
        dvz *= maxChange / dvLength;
      }
      this.velocity.x += dvx;
      this.velocity.z += dvz;
      // Turning the velocity toward a new direction shortens it a little each tick; while steering
      // in the air, put that speed back, so a slide-jump keeps its momentum through a turn.
      // (Holding the opposite way still brakes, and letting go still slows you.)
      if (steering) {
        const speedAfter = Math.hypot(this.velocity.x, this.velocity.z);
        if (speedAfter > 1e-6 && speedAfter < speedBefore) {
          this.velocity.x *= speedBefore / speedAfter;
          this.velocity.z *= speedBefore / speedAfter;
        }
      }
    }

    // --- Jump (with a small buffer and coyote time so it feels forgiving) ---
    if (input.consumeAction('jump') && !this.meleeCommitted) this.jumpBuffer = m.jumpBufferTime;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const canJump = !this.meleeCommitted && (this.grounded || this.timeSinceGrounded < m.coyoteTime);
    this.timeSinceJump += dt;
    let vaulted = this.jumpBuffer > 0 && this.vault.tryStart();
    // Pressed jump a bit early with a vaultable obstacle on your path: wait for it instead of jumping.
    // (ahead() remembers which obstacle; the wait only ever vaults that one: vault.js magnetBox)
    if (!vaulted && this.jumpBuffer > 0 && canJump && this.vaultHold <= 0 && this.vault.ahead()) {
      this.vaultHold = feel.vault.magnetSeconds;
      this.jumpBuffer = 0;
    }
    if (this.vaultHold > 0) {
      this.vaultHold -= dt;
      vaulted = this.vault.tryStart({ magnet: true });
      if (vaulted) {
        this.vaultHold = 0;
      } else if (this.vaultHold <= 0 || !canJump || !this.vault.ahead({ magnet: true })) {
        // Ran out of time, turned away or stopped: it was a normal jump after all.
        this.vaultHold = 0;
        if (canJump) this.jumpBuffer = m.jumpBufferTime;
      }
    }
    // A jump that just started can still turn into a vault in the air.
    if (!vaulted && !this.grounded && this.timeSinceJump < feel.vault.airGraceSeconds) {
      vaulted = this.vault.tryStart();
    }
    if (!vaulted && this.jumpBuffer > 0 && canJump && this.vaultHold <= 0) {
      this.velocity.y = stats.jumpVelocity;
      this.jumpBuffer = 0;
      this.timeSinceJump = 0;
      this.jumpFloorY = this.position.y;
      this.grounded = false;
      this.timeSinceGrounded = m.coyoteTime; // no double jumps
      // Jumping while sprinting or sliding: a C press before landing slides you on landing.
      const fromSlide = this.stance === 'slide';
      if (fromSlide || this.isSprinting) {
        this.airborneWithMomentum = true;
        this.slideChainQueued = fromSlide && this.chainPressTimer > 0; // C a split second before Space
      }
      if (fromSlide) this.endSlide(); // jumping out of a slide keeps the momentum
    }

    // Letting go over a balcony rail (feel.vault.ledge): no steering on the way down. You drop straight out from the rail at a fixed
    // pace, so where you land is exactly where the vault checked, whatever speed or angle you ran at it.
    if (this.dropVelocity && !this.grounded) {
      this.velocity.x = this.dropVelocity.x;
      this.velocity.z = this.dropVelocity.z;
    }

    // --- Gravity ---
    if (vaulted) {
      this.vault.update(dt);
    } else {
      this.velocity.y = Math.max(this.velocity.y - m.gravity * dt, -m.maxFallSpeed);

      // --- Move and collide ---
      const result = moveAndCollide(
        this.position,
        this.velocity,
        dt,
        feel.player.radius,
        this.height,
        this.colliders,
        m.stepTolerance,
      );
      this.grounded = result.grounded;
      this.timeSinceGrounded = this.grounded ? 0 : this.timeSinceGrounded + dt;
      this.trackFall();
    }

    this.updateMovementEffects(dt);

    // Safety net: if we ever fall out of the world, put the player back.
    if (this.position.y < feel.movement.fallOutHeight) this.respawn();
  }

  // Landing from a height hurts (feel.fall). Measures each unbroken stretch in the air; a landing past safeDrop calls onFall.
  trackFall() {
    if (!this.grounded) {
      this.fallPeakY = Math.max(this.fallPeakY, this.position.y);
      return;
    }
    const from = this.fallBase ?? this.fallPeakY;
    this.fallPeakY = -Infinity;
    this.fallBase = null;
    this.dropVelocity = null;
    const drop = from - this.position.y;
    const fall = feel.fall;
    if (!(drop > fall.safeDrop)) return;
    const damage = (drop - fall.safeDrop) * fall.damagePerMeter * this.stats.fallDamageScale;
    if (damage > 0) this.onFall?.({ drop, damage });
  }

  updateMovementEffects(dt) {
    // --- Sprint effects (visual only): blend, footstep phase, head bob strength ---
    const fx = feel.sprintFx;
    const blend = Math.min(1, fx.blendSpeed * dt);
    // Shooting out of a sprint snaps the running pose away fast, so the gun is up for the shot.
    const poseBlend = this.sprintBlockTimer > 0 ? Math.min(1, fx.fireBlendOutSpeed * dt) : blend;
    this.sprintAmount += ((this.isSprinting ? 1 : 0) - this.sprintAmount) * poseBlend;
    const onFeet = this.grounded && this.stance !== 'slide' && this.stance !== 'prone';
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (onFeet) this.bobPhase += ((speed * dt) / fx.bobStride) * Math.PI * 2;
    const walkFactor = Math.min(1, speed / this.stats.walkSpeed);
    const targetBob = onFeet ? walkFactor * fx.walkBobHeight + this.sprintAmount * fx.sprintBobHeight : 0;
    this.bobStrength += (targetBob - this.bobStrength) * blend;
  }

  // Grow a stance only if the newly occupied space is clear. A blocked stand may
  // rise to crouch; if even that is blocked, the player keeps crawling.
  riseFromProne(crouchOnly = false) {
    const room = (height) => hasHeadroom(this.position, feel.player.radius,
      this.height, height, this.colliders, feel.crouch.headroomMargin);
    if (!crouchOnly && room(feel.player.height)) this.stance = 'stand';
    else if (room(feel.crouch.height)) this.stance = 'crouch';
  }

  // Decides stand / crouch / slide / prone, then sets collision and camera height.
  updateStance(dt, wishX, wishZ) {
    const input = this.input;
    const stats = this.stats;
    const cPressed = input.consumeAction('crouch') && !this.meleeCommitted;
    const cHeld = input.actionDown('crouch') && !this.meleeCommitted;
    const pronePressed = input.consumeAction('prone') && !this.meleeBusy;

    this.slideCooldownTimer = Math.max(0, this.slideCooldownTimer - dt);
    this.chainPressTimer = Math.max(0, this.chainPressTimer - dt);
    this.chainGraceTimer = Math.max(0, this.chainGraceTimer - dt);
    // Back on your feet for a moment: chained slides are back to full speed.
    if (this.grounded && this.stance !== 'slide') {
      this.chainResetTimer += dt;
      if (this.chainResetTimer >= feel.slide.chainResetSeconds) this.chainCount = 0;
    }

    // Landing slides skip the slide cooldown and don't need sprint; that's the reward for timing it.
    if (this.stance === 'prone') {
      const jumpPressed = input.consumeAction('jump');
      this.jumpBuffer = 0; // Space gets up, never banks a jump under a low ceiling
      if (!this.meleeCommitted && (pronePressed || cPressed || jumpPressed)) this.riseFromProne(cPressed);
    } else if (pronePressed && this.grounded) {
      if (this.stance === 'slide') this.endSlide();
      this.stance = 'prone';
      this.isSprinting = false;
      this.airborneWithMomentum = false;
      this.slideChainQueued = false;
      this.chainPressTimer = 0;
      this.chainGraceTimer = 0;
      this.vaultHold = 0;
      this.jumpBuffer = 0;
      this.timeSinceJump = Infinity;
      input.consumeAction('jump');
      // No dolphin dive or retained slide boost in a prone-sized collision body.
      const speed = Math.hypot(this.velocity.x, this.velocity.z);
      const keep = speed > 0 ? Math.min(1, stats.proneSpeed / speed) : 0;
      this.velocity.x *= keep;
      this.velocity.z *= keep;
    } else if (this.meleeCommitted) {
      // Existing slides keep running, but a swing cannot start a slide or queue a chain.
      if (this.stance === 'slide') {
        this.slideTimer -= dt;
        if (!this.grounded) this.airborneWithMomentum = true;
        if (this.slideTimer <= 0 || !this.grounded) this.endSlide();
      }
    } else if (this.stance === 'slide') {
      this.slideTimer -= dt;
      // C pressed mid-slide is remembered briefly, in case Space comes a split second later.
      if (cPressed) this.chainPressTimer = feel.slide.chainPressBefore;
      // The slide ends on its own, or if you slide off a ledge.
      if (this.slideTimer <= 0) {
        this.endSlide();
      } else if (!this.grounded) {
        this.endSlide();
        this.airborneWithMomentum = true; // sliding off a ledge can chain too
        this.slideChainQueued = this.chainPressTimer > 0;
      }
    } else if (this.airborneWithMomentum && this.grounded) {
      // Landed after a sprint/slide-jump: slide if C was pressed in the air or is held.
      if (this.slideChainQueued || cPressed || cHeld) {
        this.startSlide(wishX, wishZ, true);
      } else {
        this.chainGraceTimer = feel.slide.chainPressAfterLanding; // still a moment to press C
      }
      this.airborneWithMomentum = false;
      this.slideChainQueued = false;
    } else if (this.airborneWithMomentum && cPressed) {
      this.slideChainQueued = true;
    } else if (cPressed && this.grounded && this.chainGraceTimer > 0) {
      // C pressed just after landing from a sprint/slide-jump: still counts.
      this.startSlide(wishX, wishZ, true);
    } else if (
      cPressed &&
      this.isSprinting &&
      this.grounded &&
      this.slideCooldownTimer <= 0
    ) {
      // Tap C while sprinting: start a slide in the direction we're moving.
      this.startSlide(wishX, wishZ);
    } else if (feel.crouch.toggle) {
      // Toggle crouch (a Comfort setting): a press crouches; another press, a jump or a sprint press stands up
      // (the jump is spent standing up; the sprint starts once you're up).
      const jumpPressed = input.actionPressed('jump') && !this.meleeCommitted;
      const sprintPressed = input.actionPressed('sprint');
      if (this.stance === 'stand' && cPressed && !this.slideChainQueued) {
        this.stance = 'crouch';
      } else if (this.stance === 'crouch' && (cPressed || jumpPressed || sprintPressed)) {
        const roomToStand = hasHeadroom(
          this.position,
          feel.player.radius,
          feel.crouch.height,
          feel.player.height,
          this.colliders,
          feel.crouch.headroomMargin,
        );
        if (roomToStand) {
          this.stance = 'stand';
          if (jumpPressed) {
            input.consumeAction('jump');
            this.jumpBuffer = 0;
          }
        }
      }
    } else if (this.stance === 'stand' && cHeld && !this.slideChainQueued) {
      this.stance = 'crouch';
    } else if (this.stance === 'crouch' && !cHeld) {
      // Only stand up if there's room above (e.g. not under a low shelf).
      const roomToStand = hasHeadroom(
        this.position,
        feel.player.radius,
        feel.crouch.height,
        feel.player.height,
        this.colliders,
        feel.crouch.headroomMargin,
      );
      if (roomToStand) this.stance = 'stand';
    }

    // Stand/crouch/slide collision changes right away; prone lowers with its camera below.
    this.height = this.stance === 'stand' ? feel.player.height
      : this.stance === 'prone' ? feel.prone.height : feel.crouch.height;
    let targetEye = feel.player.eyeHeight;
    if (this.stance === 'crouch') targetEye = feel.crouch.eyeHeight;
    if (this.stance === 'slide') targetEye = feel.slide.eyeHeight;
    if (this.stance === 'prone') targetEye = feel.prone.eyeHeight;
    const maxEyeChange = (this.stance === 'prone' ? feel.prone.eyeTransitionSpeed : feel.crouch.eyeTransitionSpeed) * dt;
    const eyeDiff = targetEye - this.eyeHeight;
    this.eyeHeight += Math.max(-maxEyeChange, Math.min(maxEyeChange, eyeDiff));
    // Lower smoothly without letting the eye pass through an overhead: the body
    // shrinks with the camera, reaching prone clearance only when fully lowered.
    if (this.stance === 'prone') this.height = Math.max(feel.prone.height,
      this.eyeHeight + feel.prone.height - feel.prone.eyeHeight);
  }

  // The gun is being fired: stop sprinting now and for `seconds` (you walk while shooting).
  blockSprint(seconds) {
    this.sprintBlockTimer = Math.max(this.sprintBlockTimer, seconds);
    this.isSprinting = false;
    this.sprintLatched = false;
  }

  // Slide in the direction we're moving (or want to move, if nearly stopped). `chained`: a landing
  // slide straight out of a jump/vault, which starts slower the more of them you chain in a row.
  startSlide(wishX, wishZ, chained = false) {
    if (chained) {
      const speeds = feel.slide.chainSpeed;
      this.slideSpeedScale = speeds[Math.min(this.chainCount, speeds.length - 1)];
      this.chainCount += 1;
    } else {
      this.slideSpeedScale = 1;
      this.chainCount = 0;
    }
    this.chainResetTimer = 0;
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    this.slideDirX = speed > 0.01 ? this.velocity.x / speed : wishX;
    this.slideDirZ = speed > 0.01 ? this.velocity.z / speed : wishZ;
    this.slideTimer = this.stats.slideDuration;
    this.stance = 'slide';
    this.chainPressTimer = 0;
    this.chainGraceTimer = 0;
  }

  // A finished slide drops into a crouch; the crouch logic stands you up if C isn't held.
  endSlide() {
    this.stance = 'crouch';
    this.slideTimer = 0;
    this.slideCooldownTimer = this.stats.slideCooldown;
  }

  updateSprint(dt, wantsSprint) {
    const stats = this.stats;

    if (this.sprintExhausted && this.sprintMeter >= feel.sprint.minToStart) {
      this.sprintExhausted = false;
    }

    this.isSprinting = wantsSprint && !this.sprintExhausted && this.sprintMeter > 0;

    if (this.isSprinting) {
      this.sprintMeter = Math.max(0, this.sprintMeter - dt);
      this.timeSinceSprint = 0;
      if (this.sprintMeter === 0) {
        this.sprintExhausted = true;
        this.isSprinting = false;
        this.sprintLatched = false;
      }
    } else {
      this.timeSinceSprint += dt;
      if (this.timeSinceSprint >= stats.sprintRefillDelay) {
        this.sprintMeter = Math.min(
          stats.sprintDuration,
          this.sprintMeter + stats.sprintRefillRate * dt,
        );
      }
    }
  }

  // Place the camera at the interpolated eye position.
  syncCamera(alpha) {
    this.camera.position.lerpVectors(this.prevPosition, this.position, alpha);
    this.camera.position.y += this.prevEyeHeight + (this.eyeHeight - this.prevEyeHeight) * alpha;
    // Head bob: dips on each footstep (twice per cycle), with a slight roll while sprinting.
    // Visual only: shots still come from the true eye position.
    this.camera.position.y -= Math.abs(Math.sin(this.bobPhase)) * this.bobStrength;
    const roll = Math.sin(this.bobPhase) * this.sprintAmount * feel.sprintFx.sprintBobRollDegrees * DEG_TO_RAD;
    // Recoil, interpolated between ticks. Roll turns the view around its center, so it never moves the crosshair.
    const kick = this.prevViewKick + (this.viewKick - this.prevViewKick) * alpha;
    const kickRoll = this.prevViewRoll + (this.rollSpring.value - this.prevViewRoll) * alpha;
    const kickYaw = this.prevViewKickYaw + (this.viewKickYaw - this.prevViewKickYaw) * alpha;
    // Vaulting: the view dips to look over the obstacle and tilts toward the side the legs swing out
    // to, so you see them go over (visual only; the gun is tucked away during a vault).
    let vaultDip = 0;
    let vaultRoll = 0;
    const vp = this.vault.progress;
    if (vp !== null) {
      const s = Math.sin(Math.min(1, vp) * Math.PI);
      vaultDip = -feel.vault.cameraDipDegrees * DEG_TO_RAD * s;
      vaultRoll = -feel.body.vaultSide * feel.vault.cameraRollDegrees * DEG_TO_RAD * s;
    }
    this.camera.rotation.set(this.pitch + kick + vaultDip, this.yaw + kickYaw, roll + kickRoll + vaultRoll);
  }
}
