// =============================================================================
// PLAYER CONTROLLER
// First-person movement: mouse look, WASD, jump, limited sprint, gravity,
// and collision. Runs on the fixed game tick; the camera is interpolated
// between ticks at render time so motion stays smooth on any monitor.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { moveAndCollide } from '../world/collision.js';

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

    this.grounded = false;
    this.timeSinceGrounded = 0;
    this.jumpBuffer = 0;

    this.sprintMeter = stats.sprintDuration; // seconds of sprint left
    this.timeSinceSprint = 0;
    this.isSprinting = false;
    this.sprintExhausted = false;

    camera.rotation.order = 'YXZ'; // yaw first, then pitch: standard FPS camera
    this.respawn();
  }

  respawn() {
    this.position.copy(this.spawn.position);
    this.prevPosition.copy(this.position);
    this.velocity.set(0, 0, 0);
    this.yaw = this.spawn.yaw;
    this.pitch = 0;
  }

  // 0..1, for the HUD sprint bar
  get sprintFraction() {
    return this.sprintMeter / this.stats.sprintDuration;
  }

  // Mouse look is applied every rendered frame (not per tick) so it feels instant.
  applyLook(dx, dy) {
    const look = feel.look;
    const invert = look.invertY ? -1 : 1;
    this.yaw -= dx * look.mouseSensitivity;
    this.pitch -= dy * look.mouseSensitivity * invert;
    const maxPitch = look.maxPitchDegrees * DEG_TO_RAD;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
  }

  // Call while the game is paused so the camera doesn't interpolate stale motion.
  freeze() {
    this.prevPosition.copy(this.position);
  }

  update(dt) {
    const m = feel.movement;
    const input = this.input;
    const stats = this.stats;

    this.prevPosition.copy(this.position);

    // --- Which way does the player want to go? (relative to where they look) ---
    const forwardInput = (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0);
    const rightInput = (input.isDown('KeyD') ? 1 : 0) - (input.isDown('KeyA') ? 1 : 0);

    // Camera looks down -Z at yaw 0.  forward = (-sin, 0, -cos), right = (cos, 0, -sin)
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wishX = -sin * forwardInput + cos * rightInput;
    let wishZ = -cos * forwardInput - sin * rightInput;
    const wishLength = Math.hypot(wishX, wishZ);
    if (wishLength > 0) {
      wishX /= wishLength;
      wishZ /= wishLength;
    }

    // --- Sprint meter ---
    const shiftHeld = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const wantsSprint =
      shiftHeld && wishLength > 0 && (!feel.sprint.requiresForward || forwardInput > 0);
    this.updateSprint(dt, wantsSprint);

    // --- Accelerate toward the target velocity ---
    const targetSpeed = this.isSprinting ? stats.sprintSpeed : stats.walkSpeed;
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

    // --- Jump (with a small buffer and coyote time so it feels forgiving) ---
    if (input.consumePress('Space')) this.jumpBuffer = m.jumpBufferTime;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);

    const canJump = this.grounded || this.timeSinceGrounded < m.coyoteTime;
    if (this.jumpBuffer > 0 && canJump) {
      this.velocity.y = stats.jumpVelocity;
      this.jumpBuffer = 0;
      this.grounded = false;
      this.timeSinceGrounded = m.coyoteTime; // no double jumps
    }

    // --- Gravity ---
    this.velocity.y = Math.max(this.velocity.y - m.gravity * dt, -m.maxFallSpeed);

    // --- Move and collide ---
    const result = moveAndCollide(
      this.position,
      this.velocity,
      dt,
      feel.player.radius,
      feel.player.height,
      this.colliders,
      m.stepTolerance,
    );
    this.grounded = result.grounded;
    this.timeSinceGrounded = this.grounded ? 0 : this.timeSinceGrounded + dt;

    // Safety net: if we ever fall out of the world, put the player back.
    if (this.position.y < -20) this.respawn();
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
    this.camera.position.y += feel.player.eyeHeight;
    this.camera.rotation.set(this.pitch, this.yaw, 0);
  }
}
