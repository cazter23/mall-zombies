// =============================================================================
// ZOMBIE MODEL
// Blocky low-poly shopper: grey-green skin, random outfit, arms out front,
// sometimes clutching a shopping bag. Faces -Z like the player. All animation
// is done in code from the zombie's state each rendered frame:
//   shamble (legs swing, arms bob, torso sways, head lolls), flinch when hit,
//   rise out of the floor when spawning, tip over and sink when killed.
// =============================================================================

import * as THREE from 'three';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const ease = (t) => t * t * (3 - 2 * t);

// Body proportions (meters, feet at 0). Matches the hitboxes in config/zombies.js.
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
  strideLength: 1.0, // meters per full walk cycle
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

  const skin = mat(pick(type.skinColors));
  const shirt = mat(pick(type.shirtColors));
  const pants = mat(pick(type.pantsColors));
  const hair = mat(pick(type.hairColors));
  const eyes = mat(type.eyeColor);
  const S = SHAPE;

  // root: at the feet, turned to face where the zombie faces.
  // fall: tips the whole body over when it dies (pivot at the feet).
  const root = new THREE.Group();
  const fall = new THREE.Group();
  root.add(fall);

  // Legs (pivot at the hip so they can swing)
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * S.legGap, S.hipY, 0);
    block(pants, S.legWidth, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip);
    block(mat(type.shoeColor), S.legWidth + 0.01, 0.08, 0.26, 0, -S.hipY + 0.04, -0.04, hip); // shoe
    fall.add(hip);
    return hip;
  });

  // Upper body (pivot at the hips): torso, arms, head
  const upper = new THREE.Group();
  upper.position.y = S.hipY;
  fall.add(upper);
  block(shirt, S.torso.w, S.torso.h, S.torso.d, 0, S.torso.h / 2, 0, upper);

  // Arms stick straight out in front (-Z), zombie-style. Pivot at the shoulder.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * S.shoulderX, S.shoulderY, 0);
    const t = S.armThickness;
    block(shirt, t + 0.02, t + 0.02, S.sleeve, 0, 0, -S.sleeve / 2, shoulder);
    block(skin, t, t, S.forearm, 0, 0, -S.sleeve - S.forearm / 2, shoulder);
    upper.add(shoulder);
    return shoulder;
  });

  // Sometimes clutching a shopping bag in the right hand.
  if (Math.random() < type.bagChance) {
    const bag = new THREE.Group();
    bag.position.set(0, -0.05, -S.sleeve - S.forearm + 0.02);
    block(mat(pick(type.bagColors)), 0.2, 0.26, 0.11, 0, -0.17, 0, bag);
    block(mat(type.bagBandColor), 0.21, 0.05, 0.115, 0, -0.08, 0, bag); // band across the top
    arms[1].add(bag);
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
      walkPhase += ((zombie.horizontalSpeed * frameTime) / S.strideLength) * Math.PI * 2;
      const swing = Math.sin(walkPhase);

      // Shamble
      legs[0].rotation.x = swing * 0.5 * moveAmount;
      legs[1].rotation.x = -swing * 0.5 * moveAmount;
      upper.rotation.set(-0.15, 0, Math.sin(walkPhase) * 0.07); // hunched forward, swaying
      arms[0].rotation.x = -0.1 + Math.sin(walkPhase + 0.6) * 0.12 * moveAmount;
      arms[1].rotation.x = -0.1 + Math.sin(walkPhase + 2.2) * 0.12 * moveAmount;
      arms[0].rotation.z = 0.05;
      arms[1].rotation.z = -0.05;
      neck.rotation.set(0.12, 0, Math.sin(walkPhase * 0.5) * 0.18); // lolling head

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
