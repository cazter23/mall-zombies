// =============================================================================
// PLAYER CONTROLLER
// First-person movement: mouse look, WASD, jump, limited sprint, gravity,
// and collision. Runs on the fixed game tick; the camera is interpolated
// between ticks at render time so motion stays smooth on any monitor.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { moveAndCollide, hasHeadroom } from '../world/collision.js';

const DEG_TO_RAD = Math.PI / 180;

export class PlayerController {
  constructor({ camera, input, stats, colliders, spawn }) {
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
    this.viewKick = 0; // extra upward pitch from weapon recoil; settles back to 0 (radians)
    // Set by the weapon each tick (see weapons/aim.js): aiming blocks sprint and slows walking.
    this.isAiming = false;
    this.aimAmount = 0; // 0 = hip, 1 = fully aimed
    this.lookScale = 1; // mouse sensitivity multiplier (lower while zoomed in)

    this.grounded = false;
    this.timeSinceGrounded = 0;
    this.jumpBuffer = 0;

    this.sprintMeter = stats.sprintDuration; // seconds of sprint left
    this.timeSinceSprint = 0;
    this.isSprinting = false;
    this.sprintExhausted = false;

    // Stance: 'stand' | 'crouch' | 'slide'. Crouch is hold C; slide is tap C while sprinting.
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

    // Melee lunge: a short forced dash toward a target (set by weapons/melee.js).
    this.lungeTimer = 0;
    this.lungeVX = 0;
    this.lungeVZ = 0;

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
    this.position.copy(position);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.viewKick = 0;
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
    this.lungeTimer = 0;
    this.sprintMeter = this.stats.sprintDuration;
    this.sprintExhausted = false;
  }

  // Dash in direction (dirX, dirZ) at `speed` for `seconds`, overriding normal movement.
  lunge(dirX, dirZ, speed, seconds) {
    this.lungeVX = dirX * speed;
    this.lungeVZ = dirZ * speed;
    this.lungeTimer = seconds;
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
  }

  // Weapon recoil: nudges the view up; it settles back over time (see feel.look.kickRecovery).
  addViewKick(radians) {
    this.viewKick += radians;
  }

  // Eye position and aim direction at this tick (used for hitscan shots).
  // Includes view kick, so shots go exactly where the crosshair is.
  getAim(outOrigin, outDirection) {
    outOrigin.set(this.position.x, this.position.y + this.eyeHeight, this.position.z);
    const pitch = this.pitch + this.viewKick;
    const cosPitch = Math.cos(pitch);
    outDirection.set(-Math.sin(this.yaw) * cosPitch, Math.sin(pitch), -Math.cos(this.yaw) * cosPitch);
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

    // Weapon recoil settles back toward zero.
    this.viewKick *= Math.max(0, 1 - feel.look.kickRecovery * dt);

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

    // --- Sprint meter (only while standing and not aiming: crouch, slide or ADS cancels a sprint) ---
    const wantsSprint =
      input.actionDown('sprint') &&
      this.stance === 'stand' &&
      !this.isAiming &&
      wishLength > 0 &&
      (!feel.sprint.requiresForward || forwardInput >= feel.sprint.minForwardInput);
    this.updateSprint(dt, wantsSprint);

    // --- Stance: crouch / slide / stand ---
    this.updateStance(dt, wishX, wishZ);

    // --- Accelerate toward the target velocity (a slide or melee lunge overrides this) ---
    if (this.lungeTimer > 0) {
      this.lungeTimer -= dt;
      this.velocity.x = this.lungeVX;
      this.velocity.z = this.lungeVZ;
      if (this.lungeTimer <= 0) {
        // Bleed most of the lunge speed so you don't skate past the target.
        this.velocity.x *= feel.melee.lungeEndSpeedKeep;
        this.velocity.z *= feel.melee.lungeEndSpeedKeep;
      }
    } else if (this.stance === 'slide') {
      // Fast at first, then drops off toward endSpeed. Direction is locked at slide start.
      const t = 1 - this.slideTimer / stats.slideDuration;
      const speed = feel.slide.endSpeed + (stats.slideSpeed - feel.slide.endSpeed) * (1 - t * t);
      this.velocity.x = this.slideDirX * speed;
      this.velocity.z = this.slideDirZ * speed;
    } else {
      let targetSpeed = this.isSprinting ? stats.sprintSpeed : stats.walkSpeed;
      if (this.stance === 'crouch') targetSpeed = stats.crouchSpeed;
      targetSpeed *= 1 + (stats.adsMoveSpeed - 1) * this.aimAmount; // slower while aiming
      if (!this.isSprinting) targetSpeed *= moveStrength * directionSpeed; // stick tilt, backpedal/strafe
      // In the air you keep your momentum: you can steer, but holding a direction never slows
      // you down (otherwise a slide-jump bleeds speed mid-air). Letting go of keys still does.
      if (!this.grounded) {
        targetSpeed = Math.max(targetSpeed, Math.hypot(this.velocity.x, this.velocity.z));
      }
      const accel = this.grounded ? m.groundAcceleration : m.airAcceleration;
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
    }

    // --- Jump (with a small buffer and coyote time so it feels forgiving) ---
    if (input.consumeAction('jump')) this.jumpBuffer = m.jumpBufferTime;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const canJump = this.grounded || this.timeSinceGrounded < m.coyoteTime;
    if (this.jumpBuffer > 0 && canJump) {
      this.velocity.y = stats.jumpVelocity;
      this.jumpBuffer = 0;
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

    // --- Gravity ---
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

    // --- Sprint effects (visual only): blend, footstep phase, head bob strength ---
    const fx = feel.sprintFx;
    const blend = Math.min(1, fx.blendSpeed * dt);
    this.sprintAmount += ((this.isSprinting ? 1 : 0) - this.sprintAmount) * blend;
    const onFeet = this.grounded && this.stance !== 'slide';
    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (onFeet) this.bobPhase += ((speed * dt) / fx.bobStride) * Math.PI * 2;
    const walkFactor = Math.min(1, speed / stats.walkSpeed);
    const targetBob = onFeet ? walkFactor * fx.walkBobHeight + this.sprintAmount * fx.sprintBobHeight : 0;
    this.bobStrength += (targetBob - this.bobStrength) * blend;

    // Safety net: if we ever fall out of the world, put the player back.
    if (this.position.y < -20) this.respawn();
  }

  // Decides stand / crouch / slide, then sets collision height and eases the camera height.
  updateStance(dt, wishX, wishZ) {
    const input = this.input;
    const stats = this.stats;
    const cPressed = input.consumeAction('crouch');
    const cHeld = input.actionDown('crouch');

    this.slideCooldownTimer = Math.max(0, this.slideCooldownTimer - dt);
    this.chainPressTimer = Math.max(0, this.chainPressTimer - dt);
    this.chainGraceTimer = Math.max(0, this.chainGraceTimer - dt);

    // Landing slides skip the slide cooldown and don't need sprint; that's the reward for timing it.
    if (this.stance === 'slide') {
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
        this.startSlide(wishX, wishZ);
      } else {
        this.chainGraceTimer = feel.slide.chainPressAfterLanding; // still a moment to press C
      }
      this.airborneWithMomentum = false;
      this.slideChainQueued = false;
    } else if (this.airborneWithMomentum && cPressed) {
      this.slideChainQueued = true;
    } else if (cPressed && this.grounded && this.chainGraceTimer > 0) {
      // C pressed just after landing from a sprint/slide-jump: still counts.
      this.startSlide(wishX, wishZ);
    } else if (
      cPressed &&
      this.isSprinting &&
      this.grounded &&
      this.slideCooldownTimer <= 0
    ) {
      // Tap C while sprinting: start a slide in the direction we're moving.
      this.startSlide(wishX, wishZ);
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

    // Collision height changes right away; the camera eases so it doesn't snap.
    this.height = this.stance === 'stand' ? feel.player.height : feel.crouch.height;
    let targetEye = feel.player.eyeHeight;
    if (this.stance === 'crouch') targetEye = feel.crouch.eyeHeight;
    if (this.stance === 'slide') targetEye = feel.slide.eyeHeight;
    const maxEyeChange = feel.crouch.eyeTransitionSpeed * dt;
    const eyeDiff = targetEye - this.eyeHeight;
    this.eyeHeight += Math.max(-maxEyeChange, Math.min(maxEyeChange, eyeDiff));
  }

  // Slide in the direction we're moving (or want to move, if nearly stopped).
  startSlide(wishX, wishZ) {
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
    this.camera.rotation.set(this.pitch + this.viewKick, this.yaw, roll);
  }
}
