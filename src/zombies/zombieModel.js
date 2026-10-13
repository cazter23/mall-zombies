// =============================================================================
// ZOMBIE MODEL
// Blocky low-poly zombies, built from the type's config (config/zombies.js):
//   Shopper:     grey-green skin, random outfit, arms out front, sometimes a shopping bag
//   Mall Walker: matching tracksuit with stripes, headband, wristbands, white sneakers,
//                silver hair, maybe a fanny pack; slimmer (type.modelScale)
// Faces -Z like the player. All animation is done in code from the zombie's state
// each rendered frame:
//   shamble (legs swing, arms bob, torso sways, head lolls) or power walk (walkAnimation.style:
//   upright, elbows bent, arms pumping, hips twisting), flinch when hit, raise arms overhead
//   (wind-up), slam them down (swing), ease back (recovery), winded (bent over, hands on knees,
//   panting), rise out of the floor when spawning, tip over and sink when killed.
// =============================================================================

import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;

// Body proportions (meters, feet at 0). Matches the hitboxes in config/zombies.js
// (a type's modelScale shrinks the whole body; its hitbox is set to match).
const SHAPE = {
  hipY: 0.8,
  legWidth: 0.17,
  legGap: 0.11, // each leg's distance from the center line
  torso: { w: 0.46, h: 0.6, d: 0.26 },
  shoulderY: 0.55, // above the hips
  shoulderX: 0.3,
  sleeve: 0.24, // upper arm (shirt) length
  forearm: 0.34, // lower arm (skin) length
  armThickness: 0.13,
  neckY: 0.62, // above the hips
  head: 0.3,
};

export function createZombieModel(type) {
  const materials = [];
  function mat(color) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    materials.push(m);
    return m;
  }
  function block(material, w, h, d, x, y, z, parent) {
    const mesh = new THREE.Mesh(unitBox, material);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Outfit: a matching tracksuit (one color for top and bottom) or a random shirt + pants.
  const outfit = type.outfit ?? null;
  const skin = mat(pick(type.skinColors));
  const shirt = outfit ? mat(pick(outfit.tracksuitColors)) : mat(pick(type.shirtColors));
  const pants = outfit ? shirt : mat(pick(type.pantsColors));
  const hair = mat(pick(type.hairColors));
  const eyes = mat(type.eyeColor);
  const stripe = outfit ? mat(outfit.stripeColor) : null;
  const S = SHAPE;

  // root: at the feet, turned to face where the zombie faces.
  // fall: tips the whole body over when it dies (pivot at the feet); also scales slimmer types.
  const root = new THREE.Group();
  const fall = new THREE.Group();
  root.add(fall);
  if (type.modelScale) fall.scale.set(type.modelScale.width, type.modelScale.height, type.modelScale.width);

  // Legs (pivot at the hip so they can swing)
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * S.legGap, S.hipY, 0);
    block(pants, S.legWidth, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip);
    block(mat(type.shoeColor), S.legWidth + 0.01, 0.08, 0.26, 0, -S.hipY + 0.04, -0.04, hip); // shoe
    if (stripe) block(stripe, 0.02, S.hipY - 0.1, 0.05, side * (S.legWidth / 2 + 0.006), -S.hipY / 2 + 0.02, 0, hip);
    fall.add(hip);
    return hip;
  });

  // Upper body (pivot at the hips): torso, arms, head
  const upper = new THREE.Group();
  upper.position.y = S.hipY;
  fall.add(upper);
  block(shirt, S.torso.w, S.torso.h, S.torso.d, 0, S.torso.h / 2, 0, upper);
  if (stripe) block(stripe, 0.03, S.torso.h * 0.85, 0.02, 0, S.torso.h * 0.45, -S.torso.d / 2 - 0.006, upper); // zip
  if (outfit && Math.random() < outfit.fannyPackChance) {
    block(mat(pick(outfit.fannyPackColors)), 0.26, 0.11, 0.09, 0, 0.05, -S.torso.d / 2 - 0.04, upper);
  }

  // Arms stick straight out in front (-Z), zombie-style. Pivot at the shoulder, with an elbow
  // joint (only the power walk bends it).
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * S.shoulderX, S.shoulderY, 0);
    const t = S.armThickness;
    block(shirt, t + 0.02, t + 0.02, S.sleeve, 0, 0, -S.sleeve / 2, shoulder);
    if (stripe) block(stripe, 0.02, 0.05, S.sleeve, side * (t / 2 + 0.016), 0, -S.sleeve / 2, shoulder);
    const elbow = new THREE.Group();
    elbow.position.z = -S.sleeve;
    shoulder.add(elbow);
    block(skin, t, t, S.forearm, 0, 0, -S.forearm / 2, elbow);
    if (outfit) block(mat(outfit.wristbandColor), t + 0.03, t + 0.03, 0.06, 0, 0, -S.forearm + 0.08, elbow);
    upper.add(shoulder);
    return { shoulder, elbow };
  });

  // Sometimes clutching a shopping bag in the right hand.
  if (Math.random() < type.bagChance) {
    const bag = new THREE.Group();
    bag.position.set(0, -0.05, -S.forearm + 0.02);
    block(mat(pick(type.bagColors)), 0.2, 0.26, 0.11, 0, -0.17, 0, bag);
    block(mat(type.bagBandColor), 0.21, 0.05, 0.115, 0, -0.08, 0, bag); // band across the top
    arms[1].elbow.add(bag);
  }

  // Head (pivot at the neck so it can loll)
  const neck = new THREE.Group();
  neck.position.y = S.neckY;
  upper.add(neck);
  const h = S.head;
  block(skin, 0.1, 0.06, 0.1, 0, 0.0, 0, neck); // neck
  block(skin, h, h, h, 0, h / 2 + 0.02, 0, neck);
  block(hair, h + 0.02, 0.07, h + 0.02, 0, h + 0.04, 0.01, neck); // hair on top
  block(hair, h + 0.02, h * 0.55, 0.05, 0, h * 0.68, h / 2, neck); // hair at the back
  block(eyes, 0.06, 0.05, 0.02, -0.07, h * 0.62, -h / 2 - 0.005, neck); // eyes
  block(eyes, 0.06, 0.05, 0.02, 0.07, h * 0.62, -h / 2 - 0.005, neck);
  block(eyes, 0.12, 0.035, 0.02, 0, h * 0.28, -h / 2 - 0.005, neck); // slack mouth
  if (outfit) block(mat(pick(outfit.headbandColors)), h + 0.03, 0.06, h + 0.03, 0, h * 0.86, 0, neck); // headband

  // --- Animation state ---
  let walkPhase = Math.random() * Math.PI * 2; // random start so a crowd isn't in sync
  let lastFlash = -1;

  return {
    root,

    // Call every rendered frame. `zombie` supplies state; `alpha` interpolates between ticks.
    update(frameTime, zombie, alpha) {
      // Position and facing, interpolated like the player's camera.
      root.position.lerpVectors(zombie.prevPosition, zombie.position, alpha);
      let dYaw = zombie.yaw - zombie.prevYaw;
      dYaw = Math.atan2(Math.sin(dYaw), Math.cos(dYaw)); // shortest way around
      root.rotation.y = zombie.prevYaw + dYaw * alpha;

      const type = zombie.type;
      const moveAmount = Math.min(1.3, zombie.horizontalSpeed / type.speed);
      // Joggers and runners take longer strides (so legs don't blur) and lean forward more.
      const gaitScale = Math.max(1, zombie.speed / type.speed);
      const runLean = Math.min(1, (gaitScale - 1) / 1.3) * Math.min(1, zombie.horizontalSpeed / zombie.speed);
      const wa = type.walkAnimation;
      walkPhase += ((zombie.horizontalSpeed * frameTime) / (wa.strideLength * Math.sqrt(gaitScale))) * Math.PI * 2;
      const swing = Math.sin(walkPhase);

      legs[0].rotation.x = swing * wa.legSwing * moveAmount;
      legs[1].rotation.x = -swing * wa.legSwing * moveAmount;
      if (wa.style === 'powerWalk') {
        // Power walk: upright, shoulders twisting against the hips, bent arms pumping opposite the legs.
        upper.rotation.set(-wa.hunch, swing * wa.torsoTwist * moveAmount, swing * wa.torsoSway);
        arms[0].shoulder.rotation.x = wa.armHang - swing * wa.armSwing * moveAmount;
        arms[1].shoulder.rotation.x = wa.armHang + swing * wa.armSwing * moveAmount;
        arms[0].elbow.rotation.x = wa.elbowBend;
        arms[1].elbow.rotation.x = wa.elbowBend;
        arms[0].shoulder.rotation.z = 0.1;
        arms[1].shoulder.rotation.z = -0.1;
        neck.rotation.set(-0.05, 0, Math.sin(walkPhase * 0.5) * wa.headLoll);
      } else {
        // Shamble: hunched forward, swaying, arms out front bobbing, head lolling.
        upper.rotation.set(-wa.hunch - wa.runLean * runLean, 0, swing * wa.torsoSway);
        arms[0].shoulder.rotation.x = -0.1 + Math.sin(walkPhase + 0.6) * wa.armBob * moveAmount;
        arms[1].shoulder.rotation.x = -0.1 + Math.sin(walkPhase + 2.2) * wa.armBob * moveAmount;
        arms[0].elbow.rotation.x = 0;
        arms[1].elbow.rotation.x = 0;
        arms[0].shoulder.rotation.z = 0.05;
        arms[1].shoulder.rotation.z = -0.05;
        neck.rotation.set(0.12, 0, Math.sin(walkPhase * 0.5) * wa.headLoll);
      }
      const elbowRest = arms[0].elbow.rotation.x;

      // Attack: arms rise overhead and the body leans back (the telegraph), then they slam down,
      // landing at the end of the wind-up: the exact moment the hit is checked. Bent elbows straighten.
      const atk = type.attack;
      let armPose = null; // overrides the walking arm angle when set
      let elbowPose = elbowRest;
      if (zombie.state === 'windup') {
        const raiseSeconds = Math.max(0.01, zombie.windupSeconds - atk.slamSeconds);
        if (zombie.stateTime < raiseSeconds) {
          const t = ease(zombie.stateTime / raiseSeconds);
          armPose = arms[0].shoulder.rotation.x + (atk.armsRaisedRadians - arms[0].shoulder.rotation.x) * t;
          elbowPose = elbowRest * (1 - t);
          upper.rotation.x += 0.2 * t;
          neck.rotation.x -= 0.25 * t;
        } else {
          // The slam: accelerates down (t^2) so it hits hard at the end.
          const s = Math.min(1, (zombie.stateTime - raiseSeconds) / atk.slamSeconds);
          const t = s * s;
          armPose = atk.armsRaisedRadians + (atk.armsSlammedRadians - atk.armsRaisedRadians) * t;
          elbowPose = 0;
          upper.rotation.x += 0.2 - 0.55 * t;
          neck.rotation.x -= 0.25 * (1 - t);
        }
      } else if (zombie.state === 'swing') {
        // Follow-through: arms stay down, body leaning into the hit.
        armPose = atk.armsSlammedRadians;
        elbowPose = 0;
        upper.rotation.x -= 0.35;
      } else if (zombie.state === 'chasing' && zombie.attackCooldown > 0 && !(zombie.windedTimer > 0)) {
        // Recovery: arms ease back up from the slam during the first part of the cooldown.
        const r = clamp01((zombie.attackCooldown / atk.recoverSeconds - 0.6) / 0.4); // 1 -> 0
        armPose = arms[0].shoulder.rotation.x + (atk.armsSlammedRadians - arms[0].shoulder.rotation.x) * r;
        elbowPose = elbowRest * (1 - r);
        upper.rotation.x -= 0.35 * r;
      }
      if (armPose !== null) {
        arms[0].shoulder.rotation.x = armPose;
        arms[1].shoulder.rotation.x = armPose;
      }
      arms[0].elbow.rotation.x = elbowPose;
      arms[1].elbow.rotation.x = elbowPose;

      // Winded (Mall Walker, after a swing): bent over, hands on knees, shoulders heaving, looking
      // up at you. Eases in, holds while it stands still, eases out as it starts moving again.
      const winded = type.winded;
      const wpose = type.windedAnimation;
      if (winded && wpose && zombie.windedTimer > 0 && zombie.state === 'chasing') {
        const elapsed = winded.standSeconds + winded.slowSeconds - zombie.windedTimer;
        const w = ease(Math.min(clamp01(elapsed / 0.15), clamp01((zombie.windedTimer - winded.slowSeconds + 0.3) / 0.3)));
        const breath = Math.sin(elapsed * wpose.breathRate) * wpose.breathAmount;
        upper.rotation.x = lerp(upper.rotation.x, -wpose.hunch + breath, w);
        upper.rotation.y *= 1 - w;
        for (const arm of arms) {
          arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, wpose.armAngle - breath, w);
          arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, wpose.elbowBend, w);
        }
        neck.rotation.x = lerp(neck.rotation.x, 0.55, w);
      }

      // Flinch: jolt the upper body and head back when shot, and flash white.
      const flinch = type.flinchSeconds > 0 ? zombie.flinchTimer / type.flinchSeconds : 0;
      upper.rotation.x += flinch * 0.35;
      neck.rotation.x -= flinch * 0.3;
      const flash = flinch > 0 ? 0.5 : 0;
      if (flash !== lastFlash) {
        for (const m of materials) m.emissive.setScalar(flash);
        lastFlash = flash;
      }

      // Spawning: rise up out of the floor.
      if (zombie.state === 'spawning') {
        const t = ease(Math.min(1, zombie.stateTime / type.spawnSeconds));
        root.position.y -= type.height * (1 - t);
        fall.rotation.x = 0;
      }

      // Dead: tip over backwards, lie there, then sink through the floor.
      if (zombie.state === 'dead') {
        const t = zombie.stateTime;
        const tip = ease(Math.min(1, t / type.fallSeconds));
        fall.rotation.x = tip * (Math.PI / 2 - 0.08);
        legs[0].rotation.x = legs[1].rotation.x = 0;
        const sinkStart = type.fallSeconds + type.corpseSeconds;
        const sink = Math.max(0, Math.min(1, (t - sinkStart) / type.sinkSeconds));
        root.position.y -= sink * 0.6;
      } else {
        fall.rotation.x = 0;
      }
    },

    dispose() {
      root.removeFromParent();
      for (const m of materials) m.dispose();
    },
  };
}
