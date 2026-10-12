// =============================================================================
// VIEWMODEL
// The first-person gun you see in the lower-right of the screen. It lives in
// its own little scene that is drawn AFTER the world with the depth buffer
// cleared, so the gun never pokes through walls. A "rig" copies the camera's
// position and rotation every frame; the gun hangs off the rig. The gun has its
// own camera with a fixed FOV, so ADS zoom narrows the world view but doesn't
// blow the gun up. While aiming it slides to the center, sight on the crosshair.
// The player's hands and forearms are attached to the gun, so they follow kick,
// ADS and reload automatically; the left hand also fetches a new staple strip.
// For a melee swing, the gun drops aside and a separate left arm holding a box
// cutter slashes across the screen.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { placeLimb, makeBoxMesh } from '../player/body.js';

const DEG_TO_RAD = Math.PI / 180;

/** Builds the low-poly staple gun. Points down -Z (the way the camera looks). */
function buildStapleGun(colors) {
  const gun = new THREE.Group();
  const mat = (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, flatShading: true });
  const body = mat(colors.bodyColor);
  const metal = mat(colors.metalColor);
  const grip = mat(colors.gripColor);

  function part(w, h, d, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    gun.add(mesh);
    return mesh;
  }

  // A chunky, boxy body (staple guns are short and tall, not long like a barrel).
  part(0.055, 0.075, 0.17, 0, 0, -0.04, body); // main housing
  part(0.04, 0.012, 0.15, 0, 0.043, -0.04, metal); // staple channel along the top
  part(0.06, 0.05, 0.035, 0, -0.012, -0.135, metal); // nose plate where staples come out
  part(0.018, 0.018, 0.018, 0, 0.055, -0.11, mat(colors.sightColor)); // little sight on top
  const handle = part(0.042, 0.12, 0.05, 0, -0.09, 0.02, grip); // grip at the back
  handle.rotation.x = 0.3;
  const lever = part(0.014, 0.075, 0.016, 0, -0.07, -0.06, metal); // squeeze lever / trigger
  lever.rotation.x = -0.45;

  // Where tracers start: the bottom front of the nose plate.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, -0.03, -0.155);
  gun.add(muzzle);

  return { gun, muzzle };
}

/**
 * Hands and forearms holding the gun, in the gun's own coordinates.
 * Right hand wraps the grip; left hand braces the left side of the body.
 * Returns the left arm group (animated during reloads) and the strip it carries.
 */
function buildArms(gun, gunColors) {
  const c = feel.body.colors;
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function limb(color, a, b, width, depth, parent) {
    const mesh = makeBoxMesh(color);
    placeLimb(mesh, a, b, width, depth);
    parent.add(mesh);
    return mesh;
  }
  function block(color, w, h, d, x, y, z, parent) {
    const mesh = makeBoxMesh(color);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Right arm: hand around the grip, forearm running back and down out of view, red polo sleeve.
  const rightHand = block(c.skin, 0.062, 0.085, 0.075, 0.004, -0.1, 0.026, gun);
  rightHand.rotation.x = 0.3; // matches the grip's angle
  block(c.skin, 0.02, 0.025, 0.05, -0.03, -0.055, -0.005, gun); // thumb over the top of the grip
  limb(c.skin, V(0.01, -0.13, 0.05), V(0.07, -0.38, 0.17), 0.058, 0.054, gun);
  limb(c.shirt, V(0.07, -0.38, 0.17), V(0.09, -0.5, 0.23), 0.09, 0.09, gun);

  // Left arm: palm flat on the left side, fingers curled under, forearm back-left. Grouped so
  // it can let go of the gun during a reload.
  const leftArm = new THREE.Group();
  gun.add(leftArm);
  block(c.skin, 0.028, 0.07, 0.1, -0.042, -0.012, -0.07, leftArm); // palm
  block(c.skin, 0.07, 0.024, 0.085, -0.012, -0.05, -0.07, leftArm); // fingers under the body
  limb(c.skin, V(-0.05, -0.045, -0.04), V(-0.24, -0.3, 0.06), 0.056, 0.052, leftArm);
  limb(c.shirt, V(-0.24, -0.3, 0.06), V(-0.32, -0.4, 0.1), 0.09, 0.09, leftArm);

  // A fresh strip of staples, only visible in the left hand mid-reload.
  const strip = block(gunColors.metalColor, 0.03, 0.014, 0.12, -0.03, -0.07, -0.07, leftArm);
  strip.visible = false;

  return { leftArm, strip };
}

/** Left forearm + hand holding a little yellow box cutter, pointing -Z. Hidden until a melee swing. */
function buildMeleeArm(meleeColors) {
  const c = feel.body.colors;
  const arm = new THREE.Group();
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const add = (mesh) => (arm.add(mesh), mesh);

  // Forearm runs back and down-left from the hand, out the bottom-left of the screen.
  const hand = add(makeBoxMesh(c.skin));
  hand.scale.set(0.06, 0.06, 0.08);
  const forearm = add(makeBoxMesh(c.skin));
  placeLimb(forearm, V(0, -0.01, 0.03), V(-0.07, -0.24, 0.22), 0.056, 0.052);
  const sleeve = add(makeBoxMesh(c.shirt));
  placeLimb(sleeve, V(-0.07, -0.24, 0.22), V(-0.1, -0.36, 0.3), 0.09, 0.09);

  // Box cutter angled up and forward out of the fist (pointing straight ahead it would be
  // seen end-on and vanish): yellow body, dark slider, silver blade.
  const cutter = new THREE.Group();
  cutter.rotation.x = 1.0;
  arm.add(cutter);
  const part = (color, sx, sy, sz, y, z) => {
    const mesh = makeBoxMesh(color);
    mesh.scale.set(sx, sy, sz);
    mesh.position.set(0, y, z);
    cutter.add(mesh);
  };
  part(meleeColors.handle, 0.034, 0.03, 0.13, 0.012, -0.07);
  part(meleeColors.grip, 0.014, 0.01, 0.035, 0.031, -0.05);
  part(meleeColors.blade, 0.006, 0.03, 0.06, 0.008, -0.165);

  arm.visible = false;
  return arm;
}

export function createViewmodel(weaponDef, meleeDef) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x4a3f55, 1.6));

  const rig = new THREE.Group(); // follows the camera
  scene.add(rig);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4); // fixed relative to the view
  keyLight.position.set(1, 2, 1);
  rig.add(keyLight);
  rig.add(keyLight.target);

  const holder = new THREE.Group(); // positioned at the resting offset; animated for kick/reload
  rig.add(holder);
  const { gun, muzzle } = buildStapleGun(weaponDef.viewmodel);
  holder.add(gun);
  const { leftArm, strip } = buildArms(gun, weaponDef.viewmodel);
  const meleeArm = buildMeleeArm(meleeDef.colors);
  rig.add(meleeArm);

  const vm = feel.viewmodel;
  const ads = weaponDef.ads.offset;
  let kickTimer = 0; // counts down from kickReturnSeconds after each shot
  const camera = new THREE.PerspectiveCamera(vm.fov, 1, 0.01, 10);

  return {
    scene,
    camera, // render the viewmodel scene with this, not the world camera

    // Call when a shot fires.
    kick() {
      kickTimer = vm.kickReturnSeconds;
    },

    // Call every rendered frame, after the world camera has been placed.
    // `aimAmount` is 0 (hip) .. 1 (fully aimed down sights).
    // `meleeProgress` is 0..1 through a box cutter swing, or null.
    // `sprintAmount` 0..1 blends in the running pose; `bobPhase` is the player's footstep phase.
    update(frameTime, worldCamera, weapon, aimAmount, meleeProgress = null, sprintAmount = 0, bobPhase = 0) {
      rig.position.copy(worldCamera.position);
      rig.quaternion.copy(worldCamera.quaternion);
      camera.position.copy(worldCamera.position);
      camera.quaternion.copy(worldCamera.quaternion);
      if (camera.aspect !== worldCamera.aspect) {
        camera.aspect = worldCamera.aspect;
        camera.updateProjectionMatrix();
      }

      kickTimer = Math.max(0, kickTimer - frameTime);
      const k = kickTimer / vm.kickReturnSeconds; // 1 right after firing -> 0 when settled
      const kick = k * k;

      // Reload: dip and roll down, then come back up (a smooth hump over the reload).
      const progress = weapon.reloadProgress;
      const dip = progress === null ? 0 : Math.sin(progress * Math.PI);

      // Left hand during a reload: drops away, comes back holding a strip, slaps it in.
      const handOut = progress === null ? 0 : Math.sin(Math.min(1, progress / 0.75) * Math.PI);
      leftArm.position.set(-0.05 * handOut, -vm.reloadHandDrop * handOut, 0.1 * handOut);
      strip.visible = progress !== null && progress > 0.3 && progress < 0.72;

      // Resting spot slides from the hip offset to the centered ADS offset.
      const lerp = (a, b) => a + (b - a) * aimAmount;
      holder.position.set(
        lerp(vm.offset.x, ads.x),
        lerp(vm.offset.y, ads.y) - dip * vm.reloadDrop,
        lerp(vm.offset.z, ads.z) + kick * vm.kickBack,
      );
      holder.rotation.set(
        kick * vm.kickRotateDegrees * DEG_TO_RAD - dip * vm.reloadDipDegrees * DEG_TO_RAD,
        lerp(vm.aimYawDegrees, 0) * DEG_TO_RAD,
        dip * vm.reloadRollDegrees * DEG_TO_RAD,
      );

      // Sprinting: lower the gun and turn it across the body, swinging with each step.
      const s = sprintAmount * (1 - aimAmount);
      if (s > 0.001) {
        const fx = feel.sprintFx;
        holder.position.x += s * (fx.gunRight + Math.sin(bobPhase) * fx.gunBobSide);
        holder.position.y -= s * (fx.gunDrop + Math.abs(Math.cos(bobPhase)) * fx.gunBobUp);
        holder.position.z += s * fx.gunBack;
        holder.rotation.x -= s * fx.gunPitchDegrees * DEG_TO_RAD;
        holder.rotation.y += s * fx.gunYawDegrees * DEG_TO_RAD;
        holder.rotation.z += s * fx.gunRollDegrees * DEG_TO_RAD;
      }

      // Melee: drop the gun aside, swap the left hand for the box cutter arm and slash.
      const mel = vm.melee;
      meleeArm.visible = meleeProgress !== null;
      leftArm.visible = meleeProgress === null;
      if (meleeProgress !== null) {
        const p = meleeProgress;
        const out = Math.sin(p * Math.PI); // gun drops out and comes back
        holder.position.y -= out * mel.gunDrop;
        holder.rotation.z -= out * mel.gunTiltDegrees * DEG_TO_RAD;
        // Path: enterFrom -> slashFrom -> slashTo -> exitTo
        let a;
        let b;
        let t;
        if (p < mel.slashStart) [a, b, t] = [mel.enterFrom, mel.slashFrom, p / mel.slashStart];
        else if (p < mel.slashEnd)
          [a, b, t] = [mel.slashFrom, mel.slashTo, (p - mel.slashStart) / (mel.slashEnd - mel.slashStart)];
        else [a, b, t] = [mel.slashTo, mel.exitTo, (p - mel.slashEnd) / (1 - mel.slashEnd)];
        const e = t * t * (3 - 2 * t);
        meleeArm.position.set(a.x + (b.x - a.x) * e, a.y + (b.y - a.y) * e, a.z + (b.z - a.z) * e);
        // Blade angled along the slash (down and to the right), turning through it.
        meleeArm.rotation.set(0.15, 0.3 - 0.6 * Math.min(1, p / mel.slashEnd), -0.5);
      }
    },

    // World-space position of the gun's muzzle (where tracers start).
    getMuzzleWorldPosition(out) {
      rig.updateMatrixWorld(true);
      return muzzle.getWorldPosition(out);
    },
  };
}
