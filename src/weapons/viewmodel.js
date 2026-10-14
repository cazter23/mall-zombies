// =============================================================================
// VIEWMODEL
// The first-person gun you see in the lower-right of the screen. It lives in
// its own little scene that is drawn AFTER the world with the depth buffer
// cleared, so the gun never pokes through walls. A "rig" copies the camera's
// position and rotation every frame; the gun hangs off the rig. The gun has its
// own camera with a fixed FOV, so ADS zoom narrows the world view but doesn't
// blow the gun up. While aiming it slides to the center, sight on the crosshair.
//
// This file is the part every gun shares; the gun + hands model and its own
// animation (trigger, hands while reloading) come from weapons/models/. Every
// gun's model is built up front and only the one in your hands is shown. Layers,
// all added together on the "holder" each frame:
//   rest pose    hip offset sliding to the ADS offset
//   reload pose  keyframes from weapons.<id>.viewmodel.reload.gunKeys (eases out if cancelled)
//   recoil       springs kicked on every shot (and by reload jolts): snap back, settle forward
//   sway         lags behind when you turn, catches up when you stop
//   walk bob     gentle side-to-side "smile" with your steps; breathing when idle
//   landing      a quick dip when you land from a jump
//   sprint pose  lowered and turned across the body (feel.sprintFx)
//   switching    the gun drops out of view and the next one comes up (feel.weaponSwitch)
//   melee        the gun drops aside while a box cutter arm slashes across
// Everything that wiggles is scaled way down while aiming, so it never fights your aim.
// All of it is visual only: shots come from the camera, not the gun model.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { placeLimb, makeBoxMesh } from '../player/body.js';
import { createSpring, createSpring3 } from '../core/spring.js';
import { samplePose } from '../core/keyframes.js';
import { buildWeaponModel } from './models/index.js';
import { createMuzzleFlash } from './muzzleFlash.js';

const DEG_TO_RAD = Math.PI / 180;
const clamp = (v, max) => Math.max(-max, Math.min(max, v));

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

/**
 * @param weaponDefs every gun the player can hold (config/weapons.js entries); a model is built for each
 * @param meleeDef   the box cutter
 */
export function createViewmodel(weaponDefs, meleeDef) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x4a3f55, 1.6));

  const rig = new THREE.Group(); // follows the camera
  scene.add(rig);

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.4); // fixed relative to the view
  keyLight.position.set(1, 2, 1);
  rig.add(keyLight);
  rig.add(keyLight.target);

  const holder = new THREE.Group(); // rest pose + every animation layer, recomputed each frame
  rig.add(holder);

  // The muzzle-flash lights are shared by all guns (lights must never come and go: see muzzleFlash.js).
  const handLight = new THREE.PointLight(0xffffff, 0, 1, 1);
  const worldLight = new THREE.PointLight(0xffffff, 0, 1, 2);

  // One model + flash per gun; only the active one is visible.
  const guns = new Map();
  for (const def of weaponDefs) {
    const model = buildWeaponModel(def);
    model.root.visible = false;
    holder.add(model.root);
    const flash = createMuzzleFlash(def.muzzleFlash, { handLight, worldLight });
    model.muzzle.add(flash.object);
    guns.set(def.id, { def, model, flash });
  }
  let active = guns.get(weaponDefs[0].id);
  active.model.root.visible = true;
  active.flash.object.add(handLight);

  const meleeArm = buildMeleeArm(meleeDef.colors);
  rig.add(meleeArm);

  const vm = feel.viewmodel;
  const camera = new THREE.PerspectiveCamera(vm.fov, 1, 0.01, 10);

  // Recoil (and reload jolts): one spring for position, one for rotation (tuned per gun).
  const kickPos = createSpring3(active.def.recoil.model);
  const kickRot = createSpring3(active.def.recoil.model);
  // Landing dip: a softer spring.
  const landY = createSpring(vm.landing);
  const landPitch = createSpring(vm.landing);

  let time = 0; // for breathing
  let sinceFire = Infinity; // seconds since the last trigger squeeze (drives the model's trigger)
  let reloadWeight = 0; // 1 while reloading; eases to 0 if a reload is cancelled
  let reloadShown = 0; // reload progress being shown (kept after a cancel so it can ease out)
  let prevYaw = null;
  let prevPitch = null;
  let yawRate = 0; // smoothed turn speeds (radians/second) for sway
  let pitchRate = 0;
  let walkBlend = 0;
  let wasGrounded = true;
  let fallSpeed = 0; // fastest downward speed during the current fall
  const reloadPos = { x: 0, y: 0, z: 0 };
  const reloadRot = { x: 0, y: 0, z: 0 };

  // Random left-or-right, 50..100% strength: every shot twists a little differently.
  const randomSide = () => (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);

  // Show another gun's model (weapon switch / new gun bought).
  function setActive(def) {
    const next = guns.get(def.id);
    if (!next || next === active) return;
    active.model.root.visible = false;
    active.flash.reset();
    handLight.intensity = 0;
    worldLight.intensity = 0;
    active = next;
    active.model.root.visible = true;
    active.flash.object.add(handLight); // the hand light follows the gun in hand
    kickPos.setParams(active.def.recoil.model);
    kickRot.setParams(active.def.recoil.model);
    sinceFire = Infinity;
    reloadWeight = 0;
  }

  return {
    scene,
    camera, // render the viewmodel scene with this, not the world camera
    worldLight, // add to the world scene: the muzzle flash lights up the room

    // A shot just fired. `aimAmount` 0..1 (ADS kicks the model much less).
    fire(aimAmount = 0) {
      const rk = active.def.recoil.model;
      const m = 1 + (rk.adsMultiplier - 1) * aimAmount;
      kickPos.kick(0, rk.up * m, rk.back * m);
      kickRot.kick(
        rk.pitchDegrees * DEG_TO_RAD * m,
        rk.yawDegrees * DEG_TO_RAD * m * randomSide(),
        rk.rollDegrees * DEG_TO_RAD * m * randomSide(),
      );
      active.flash.trigger(aimAmount);
      sinceFire = 0;
    },

    // Trigger squeezed on an empty gun: the trigger moves, the gun barely does, no flash.
    dryFire() {
      kickRot.kick(active.def.recoil.model.pitchDegrees * DEG_TO_RAD * vm.dryFireKick, 0, 0);
      sinceFire = 0;
    },

    // A bump from an animation event (e.g. slapping in a new magazine). Meters / degrees.
    jolt({ back = 0, up = 0, pitchDegrees = 0, rollDegrees = 0 }) {
      kickPos.kick(0, up, back);
      kickRot.kick(pitchDegrees * DEG_TO_RAD, 0, rollDegrees * DEG_TO_RAD);
    },

    /**
     * Call every rendered frame, after the world camera has been placed.
     * `weapon` is the gun in hand (its reload drives the reload pose); `shownDef` which model to show
     * (mid-switch it's still the old gun while it drops away); `switchLower` 0 (up) .. 1 (out of view).
     * `aimAmount` 0 (hip) .. 1 (fully aimed). `meleeProgress` 0..1 through a box cutter
     * swing, or null. `player` gives look angles, movement and footstep phase.
     */
    update(frameTime, worldCamera, { weapon, shownDef = weapon.def, switchLower = 0, aimAmount, meleeProgress = null, player }) {
      const dt = frameTime;
      setActive(shownDef);
      const { model, flash } = active;
      const look = active.def.viewmodel;
      const ads = active.def.ads.offset;
      rig.position.copy(worldCamera.position);
      rig.quaternion.copy(worldCamera.quaternion);
      camera.position.copy(worldCamera.position);
      camera.quaternion.copy(worldCamera.quaternion);
      if (camera.aspect !== worldCamera.aspect) {
        camera.aspect = worldCamera.aspect;
        camera.updateProjectionMatrix();
      }
      const adsScale = (multiplier) => 1 + (multiplier - 1) * aimAmount;

      time += dt;
      sinceFire += dt;
      kickPos.update(dt);
      kickRot.update(dt);
      landY.update(dt);
      landPitch.update(dt);
      flash.update(dt);

      // --- Reload pose (this gun's keyframes; a cancelled reload eases back instead of snapping) ---
      const progress = weapon.def.id === active.def.id ? weapon.reloadProgress : null; // (ids: guns are resolved copies)
      if (progress !== null) {
        reloadShown = progress;
        reloadWeight = 1;
      } else if (dt > 0) {
        reloadWeight = Math.max(0, reloadWeight - dt / vm.reloadBlendOutSeconds);
      }
      samplePose(look.reload.gunKeys, reloadShown, reloadPos, reloadRot);
      const rw = reloadWeight;

      // --- Sway: lag behind the turn ---
      const sw = vm.sway;
      if (dt > 0) {
        const rawYaw = prevYaw === null ? 0 : (player.yaw - prevYaw) / dt;
        const rawPitch = prevPitch === null ? 0 : (player.pitch - prevPitch) / dt;
        const k = Math.min(1, sw.smoothing * dt);
        yawRate += (clamp(rawYaw, sw.maxTurnSpeed) - yawRate) * k;
        pitchRate += (clamp(rawPitch, sw.maxTurnSpeed) - pitchRate) * k;
      }
      prevYaw = player.yaw;
      prevPitch = player.pitch;
      const swayK = adsScale(sw.adsMultiplier);
      // Turning right (yaw falling) swings the gun left and rolls it into the turn; looking up dips it.
      const swayX = clamp(yawRate * sw.metersPerTurnSpeed, sw.maxMeters) * swayK;
      const swayY = clamp(-pitchRate * sw.metersPerTurnSpeed, sw.maxMeters) * swayK;
      const swayYaw = clamp(-yawRate * sw.degreesPerTurnSpeed, sw.maxDegrees) * DEG_TO_RAD * swayK;
      const swayPitch = clamp(-pitchRate * sw.degreesPerTurnSpeed, sw.maxDegrees) * DEG_TO_RAD * swayK;
      const swayRoll = clamp(yawRate * sw.rollDegreesPerTurnSpeed, sw.maxDegrees) * DEG_TO_RAD * swayK;

      // --- Walk bob ("smile" path with your steps) and breathing ---
      const wb = vm.walkBob;
      const speed = Math.hypot(player.velocity.x, player.velocity.z);
      const onFeet = player.grounded && player.stance !== 'slide';
      const walkTarget = onFeet ? Math.min(1, speed / player.stats.walkSpeed) : 0;
      walkBlend += (walkTarget - walkBlend) * Math.min(1, wb.blendSpeed * dt);
      const bob = walkBlend * (1 - player.sprintAmount) * adsScale(wb.adsMultiplier); // sprint has its own pose
      const step = Math.sin(player.bobPhase);
      const bobX = step * wb.side * bob;
      const bobY = (Math.abs(step) - 1) * wb.up * bob;
      const bobRoll = step * wb.rollDegrees * DEG_TO_RAD * bob;
      const br = vm.breathing;
      const breath = adsScale(br.adsMultiplier) * (1 - walkBlend * 0.6);
      const breathY = Math.sin(time * br.speed) * br.up * breath;
      const breathPitch = Math.sin(time * br.speed - 0.6) * br.pitchDegrees * DEG_TO_RAD * breath;

      // --- Landing dip, stronger after a longer fall ---
      const ld = vm.landing;
      if (!player.grounded) {
        fallSpeed = Math.max(fallSpeed, -player.velocity.y);
      } else {
        if (!wasGrounded && fallSpeed > ld.minFallSpeed) {
          const s = adsScale(ld.adsMultiplier);
          landY.kick(-Math.min(ld.maxDip, fallSpeed * ld.dipPerSpeed) * s);
          landPitch.kick(-Math.min(ld.maxPitchDegrees, fallSpeed * ld.pitchPerSpeed) * DEG_TO_RAD * s);
        }
        fallSpeed = 0;
      }
      wasGrounded = player.grounded;

      // --- Add the layers up ---
      const lerp = (a, b) => a + (b - a) * aimAmount;
      const hip = look.hipOffset;
      holder.position.set(
        lerp(hip.x, ads.x) + reloadPos.x * rw + kickPos.x + swayX + bobX,
        lerp(hip.y, ads.y) + reloadPos.y * rw + kickPos.y + landY.value + swayY + bobY + breathY,
        lerp(hip.z, ads.z) + reloadPos.z * rw + kickPos.z,
      );
      holder.rotation.set(
        lerp(look.hipPitchDegrees, 0) * DEG_TO_RAD + reloadRot.x * rw + kickRot.x + landPitch.value + swayPitch + breathPitch,
        lerp(look.aimYawDegrees, 0) * DEG_TO_RAD + reloadRot.y * rw + kickRot.y + swayYaw,
        lerp(look.hipRollDegrees, 0) * DEG_TO_RAD + reloadRot.z * rw + kickRot.z + swayRoll + bobRoll,
      );

      // Sprinting: lower the gun and turn it across the body, swinging with each step.
      const s = player.sprintAmount * (1 - aimAmount);
      if (s > 0.001) {
        const fx = feel.sprintFx;
        holder.position.x += s * (fx.gunRight + step * fx.gunBobSide);
        holder.position.y -= s * (fx.gunDrop + Math.abs(Math.cos(player.bobPhase)) * fx.gunBobUp);
        holder.position.z += s * fx.gunBack;
        holder.rotation.x -= s * fx.gunPitchDegrees * DEG_TO_RAD;
        holder.rotation.y += s * fx.gunYawDegrees * DEG_TO_RAD;
        holder.rotation.z += s * fx.gunRollDegrees * DEG_TO_RAD;
      }

      // Switching: drop out of view (and come back up).
      if (switchLower > 0) {
        const ws = feel.weaponSwitch;
        const e = switchLower * switchLower * (3 - 2 * switchLower);
        holder.position.y -= e * ws.dropMeters;
        holder.rotation.x -= e * ws.tiltDegrees * DEG_TO_RAD;
      }

      // Vaulting: tuck the gun away while the standing body rises over the obstacle.
      const vaultProgress = player.vault.progress;
      if (vaultProgress !== null) {
        const tuck = Math.sin(vaultProgress * Math.PI);
        holder.position.y -= tuck * feel.vault.gunDrop;
        holder.rotation.x -= tuck * feel.vault.gunTiltDegrees * DEG_TO_RAD;
      }

      // The gun's own moving parts (trigger, hands during the reload).
      model.animate({ sinceFire, reloadProgress: reloadShown, reloadWeight: rw });

      // Melee: drop the gun aside, swap the left hand for the box cutter arm and slash.
      const mel = vm.melee;
      meleeArm.visible = meleeProgress !== null;
      model.leftHandVisible = meleeProgress === null;
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

      // The world flash light sits at the muzzle (only matters while it's lit).
      if (worldLight.intensity > 0) this.getMuzzleWorldPosition(worldLight.position);
    },

    // World-space position of the gun's muzzle (where tracers start).
    getMuzzleWorldPosition(out) {
      rig.updateMatrixWorld(true);
      return active.model.muzzle.getWorldPosition(out);
    },

    // New run: everything settled.
    reset() {
      kickPos.reset();
      kickRot.reset();
      landY.reset();
      landPitch.reset();
      for (const g of guns.values()) g.flash.reset();
      handLight.intensity = 0;
      worldLight.intensity = 0;
      sinceFire = Infinity;
      reloadWeight = 0;
      prevYaw = null;
      prevPitch = null;
      yawRate = 0;
      pitchRate = 0;
    },
  };
}
