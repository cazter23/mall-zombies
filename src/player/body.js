// =============================================================================
// PLAYER BODY (first-person legs and torso)
// A blocky body under the camera so you see your own torso, legs and sneakers
// when you look down. Purely visual: no collision, not shootable.
//
// Animated in code every rendered frame:
//   - Hip height follows the camera height (stand -> crouch -> slide blend smoothly)
//   - Feet are placed by pose (walk cycle / slide / airborne), then each knee is
//     solved so thigh + shin reach from hip to foot (simple two-bone IK).
// The arms live on the gun model instead (weapons/viewmodel.js).
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const KNEE_POLE = new THREE.Vector3(0, 0, -1); // knees bend forward (the body faces -Z)
const unitBox = new THREE.BoxGeometry(1, 1, 1);

/**
 * Stretches a unit-box mesh into a limb from `a` to `b` (in its parent's space).
 * `width` and `depth` are its thickness. Shared with the viewmodel arms.
 */
export function placeLimb(mesh, a, b, width, depth = width) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const length = dir.length();
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  if (length > 1e-6) mesh.quaternion.setFromUnitVectors(Z_AXIS, dir.divideScalar(length));
  mesh.scale.set(width, depth, length);
}

export function makeBoxMesh(color) {
  return new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color, roughness: 0.8, flatShading: true }));
}

// Two-bone IK: where does the knee go so thigh (l1) + shin (l2) connect hip to foot?
// If the foot is out of reach, it is pulled in to full leg length. Writes knee into `outKnee`.
const tmpDir = new THREE.Vector3();
const tmpPole = new THREE.Vector3();
function solveKnee(hip, foot, l1, l2, outKnee) {
  tmpDir.subVectors(foot, hip);
  let d = tmpDir.length();
  if (d < 1e-6) {
    outKnee.copy(hip).add(KNEE_POLE);
    return;
  }
  tmpDir.divideScalar(d);
  const maxReach = l1 + l2 - 1e-3;
  if (d > maxReach) {
    foot.copy(hip).addScaledVector(tmpDir, maxReach);
    d = maxReach;
  }
  d = Math.max(d, Math.abs(l1 - l2) + 1e-3);
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d); // hip -> knee, measured along hip->foot
  const out = Math.sqrt(Math.max(0, l1 * l1 - along * along)); // how far the knee sticks out
  tmpPole.copy(KNEE_POLE).addScaledVector(tmpDir, -KNEE_POLE.dot(tmpDir));
  if (tmpPole.lengthSq() < 1e-6) tmpPole.set(0, 1, 0);
  tmpPole.normalize();
  outKnee.copy(hip).addScaledVector(tmpDir, along).addScaledVector(tmpPole, out);
}

export function createPlayerBody(scene) {
  const b = feel.body;
  const c = b.colors;

  const root = new THREE.Group(); // at the feet, turned with the player's yaw
  root.name = 'playerBody';
  scene.add(root);

  const torso = makeBoxMesh(c.shirt); // lower torso only: a slim waist with the polo hem
  const belt = makeBoxMesh(c.belt);
  const pelvis = makeBoxMesh(c.pants);
  root.add(torso, belt, pelvis);

  const legs = [-1, 1].map((side) => {
    const thigh = makeBoxMesh(c.pants);
    const shin = makeBoxMesh(c.pants);
    const shoe = makeBoxMesh(c.shoes);
    const sole = makeBoxMesh(c.soles);
    root.add(thigh, shin, shoe, sole);
    return {
      side, // -1 = left, +1 = right
      thigh,
      shin,
      shoe,
      sole,
      hip: new THREE.Vector3(),
      knee: new THREE.Vector3(),
      foot: new THREE.Vector3(),
    };
  });

  // Animation state
  let walkPhase = 0;
  let moveAmount = 0; // 0 = standing still, 1 = walking speed (more when sprinting)
  let slideAmount = 0; // 0..1 blend into the slide pose
  let airAmount = 0; // 0..1 blend into the airborne tuck
  const swingDir = new THREE.Vector2(0, -1); // local direction the feet swing along (last movement dir)
  const walkFoot = new THREE.Vector3();
  const slideFoot = new THREE.Vector3();

  // Hip height that follows the (smoothly easing) camera height between the stance poses.
  function hipHeightForEye(eye) {
    const standEye = feel.player.eyeHeight;
    const crouchEye = feel.crouch.eyeHeight;
    const slideEye = feel.slide.eyeHeight;
    const h = b.hipHeight;
    if (eye >= crouchEye) {
      const t = Math.min(1, (eye - crouchEye) / (standEye - crouchEye));
      return h.crouch + (h.stand - h.crouch) * t;
    }
    const t = Math.max(0, (eye - slideEye) / (crouchEye - slideEye));
    return h.slide + (h.crouch - h.slide) * t;
  }

  return {
    root,

    // Call every rendered frame (after the player has updated).
    update(frameTime, player, alpha) {
      // Follow the player (interpolated like the camera) and face where they look.
      root.position.lerpVectors(player.prevPosition, player.position, alpha);
      root.rotation.y = player.yaw;
      const eye = player.prevEyeHeight + (player.eyeHeight - player.prevEyeHeight) * alpha;

      // --- Movement in the body's own frame (local -Z is forward) ---
      const vx = player.velocity.x;
      const vz = player.velocity.z;
      const sin = Math.sin(player.yaw);
      const cos = Math.cos(player.yaw);
      const localX = vx * cos - vz * sin;
      const localZ = vx * sin + vz * cos;
      const speed = Math.hypot(vx, vz);
      if (speed > 0.1) swingDir.set(localX / speed, localZ / speed);

      const blend = Math.min(1, b.blendSpeed * frameTime);
      const walking = player.grounded && player.stance !== 'slide';
      const targetMove = walking ? Math.min(speed / player.stats.walkSpeed, 1.6) : 0;
      moveAmount += (targetMove - moveAmount) * blend;
      slideAmount += ((player.stance === 'slide' ? 1 : 0) - slideAmount) * blend;
      airAmount += ((player.grounded ? 0 : 1) - airAmount) * blend;
      if (walking) walkPhase += ((speed * frameTime) / b.strideLength) * Math.PI * 2;

      // --- Torso and hips ---
      const hipY = hipHeightForEye(eye);
      torso.position.set(0, hipY + 0.05 + b.torsoHeight / 2, b.backOffset);
      torso.scale.set(b.waistWidth, b.torsoHeight, b.waistDepth);
      belt.position.set(0, hipY + 0.035, b.backOffset);
      belt.scale.set(b.waistWidth + 0.01, 0.035, b.waistDepth + 0.01);
      pelvis.position.set(0, hipY - 0.01, b.backOffset);
      pelvis.scale.set(b.waistWidth - 0.01, 0.1, b.waistDepth - 0.01);

      // --- Legs ---
      for (const leg of legs) {
        const x = leg.side * b.hipWidth;
        leg.hip.set(x, hipY, b.backOffset);

        // Walk cycle: feet swing along the movement direction, opposite each other, lifting on the way forward.
        const phase = walkPhase + (leg.side > 0 ? 0 : Math.PI);
        const swing = Math.sin(phase) * b.stepSwing * moveAmount;
        const lift = Math.max(0, Math.cos(phase)) * b.stepLift * moveAmount;
        const footZ = b.backOffset - b.feetForward;
        walkFoot.set(x + swingDir.x * swing, b.ankleHeight + lift, footZ + swingDir.y * swing);

        // Slide: both legs out in front in a loose V (right leads, left splays out),
        // so no knee folds up into the camera.
        if (leg.side > 0) slideFoot.set(x, b.ankleHeight, -b.slideFrontFoot);
        else slideFoot.set(x - b.slideSplay, b.ankleHeight, -b.slideBackFoot);

        leg.foot.copy(walkFoot).lerp(slideFoot, slideAmount);
        // Airborne: pull the feet up a little (not during a slide).
        leg.foot.y += b.airTuck * airAmount * (1 - slideAmount);

        solveKnee(leg.hip, leg.foot, b.thighLength, b.shinLength, leg.knee);
        placeLimb(leg.thigh, leg.hip, leg.knee, 0.14, 0.15);
        placeLimb(leg.shin, leg.knee, leg.foot, 0.12, 0.13);

        // Sneaker: flat, toe pointing forward, ankle near the back.
        leg.shoe.position.set(leg.foot.x, leg.foot.y - 0.03, leg.foot.z - 0.07);
        leg.shoe.rotation.set(0, 0, 0);
        leg.shoe.scale.set(0.12, 0.08, 0.27);
        leg.sole.position.set(leg.foot.x, leg.foot.y - 0.075, leg.foot.z - 0.07);
        leg.sole.scale.set(0.125, 0.02, 0.28);
      }
    },
  };
}
