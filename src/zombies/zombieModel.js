// =============================================================================
// ZOMBIE MODEL
// Blocky low-poly zombies, built from the type's config (config/zombies.js):
//   Shopper:     grey-green skin, coordinated clothing/build/hair/accessories from config/shoppers.js
//   Mall Walker: matching tracksuit with stripes, headband, wristbands, white sneakers,
//                silver hair, maybe a fanny pack; slimmer (type.modelScale)
//   Cart Pusher: a shopper look pushing a shopping cart (type.cart, zombies/cartModel.js): arms out to the
//                handle, the cart rattles on its telegraph, leans into the charge, tips over on a crash
// Faces -Z like the player. All animation is done in code from the zombie's state
// each rendered frame:
//   shamble (legs swing, arms bob, torso sways, head lolls) or power walk (walkAnimation.style:
//   upright, elbows bent, arms pumping, hips twisting), flinch when hit, raise arms overhead
//   (wind-up), slam them down (swing), ease back (recovery), winded (bent over, hands on knees,
//   panting), rise out of the floor when spawning, tip over and sink when killed.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { shoppers } from '../config/shoppers.js';
import { chooseShopperAppearance } from './shopperAppearance.js';
import { buildCart } from './cartModel.js';
import { cartLean } from './cartPose.js';

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const skirtBox = new THREE.BoxGeometry(1, 1, 1);
const skirtVertices = skirtBox.attributes.position;
for (let i = 0; i < skirtVertices.count; i++) if (skirtVertices.getY(i) > 0) {
  skirtVertices.setX(i, skirtVertices.getX(i) * shoppers.skirt.taper);
  skirtVertices.setZ(i, skirtVertices.getZ(i) * shoppers.skirt.taper);
}
skirtBox.computeVertexNormals();
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

export function createZombieModel(type, { random = Math.random, appearance } = {}) {
  const materials = [];
  const materialCache = new Map(); // per zombie: hit flashes must never affect its neighbours
  const ownedGeometry = [];
  const pick = (list) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];
  function mat(color) {
    if (materialCache.has(color)) return materialCache.get(color);
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    materials.push(m);
    materialCache.set(color, m);
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
  const look = (type.id === 'shopper' || type.cart) && !outfit ? appearance ?? chooseShopperAppearance(random) : null;
  const topStyle = look ? shoppers.tops[look.top] : null;
  const width = look?.build.width ?? 1;
  const skin = mat(pick(type.skinColors));
  const shirt = outfit ? mat(pick(outfit.tracksuitColors)) : mat(look?.palette.top ?? pick(type.shirtColors));
  const pants = outfit ? shirt : mat(look?.palette.pants ?? pick(type.pantsColors));
  const hair = mat(pick(type.hairColors));
  const eyes = mat(type.eyeColor);
  const stripe = outfit ? mat(outfit.stripeColor) : null;
  const S = SHAPE;
  const fabric = look ? {
    top: shirt, pants, skin, hair, inner: mat(look.palette.inner), trim: mat(look.palette.trim),
    accessory: mat(look.accessoryColor), hardware: mat(shoppers.colors.hardware), stain: mat(shoppers.colors.stain),
  } : null;
  function addParts(parent, parts, scaleWidth = 1, forward = 0) {
    for (const part of parts) {
      const [w, h, d] = part.size;
      const [x, y, z] = part.position;
      const mesh = block(fabric[part.material], w * scaleWidth, h, d, x * scaleWidth, y, z - forward, parent);
      mesh.rotation.z = part.rz;
    }
  }

  // root: at the feet, turned to face where the zombie faces.
  // fall: tips the whole body over when it dies (pivot at the feet); also scales slimmer types.
  const root = new THREE.Group();
  root.name = type.id;
  const fall = new THREE.Group();
  root.add(fall);
  if (type.modelScale) fall.scale.set(type.modelScale.width, type.modelScale.height, type.modelScale.width);

  // Legs (pivot at the hip so they can swing)
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg';
    hip.position.set(side * S.legGap * width, S.hipY, 0);
    if (look && look.bottom !== 'trousers') {
      block(skin, S.legWidth * width, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip);
      if (look.bottom === 'shorts') block(pants, S.legWidth * width + shoppers.clothingPadding, shoppers.shortsLength,
        S.legWidth + 0.02 + shoppers.clothingPadding, 0, -shoppers.shortsLength / 2, 0, hip);
    } else block(pants, S.legWidth * width, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip);
    const barefoot = look?.wear === 'missingShoe' && side < 0;
    block(barefoot ? skin : mat(look?.palette.shoes ?? type.shoeColor),
      S.legWidth + 0.01, 0.08, 0.26, 0, -S.hipY + 0.04, -0.04, hip); // shoe or bare foot
    if (stripe) block(stripe, 0.02, S.hipY - 0.1, 0.05, side * (S.legWidth / 2 + 0.006), -S.hipY / 2 + 0.02, 0, hip);
    fall.add(hip);
    return hip;
  });

  // Upper body (pivot at the hips): torso, arms, head
  const upper = new THREE.Group();
  upper.name = 'upperBody';
  upper.position.y = S.hipY;
  fall.add(upper);
  block(fabric?.[topStyle?.torsoMaterial] ?? shirt, S.torso.w * width, S.torso.h, S.torso.d, 0, S.torso.h / 2, 0, upper);
  if (look) {
    addParts(upper, topStyle.parts, width);
    // Jacket/cardigan fronts already supply their own layering: don't paint stripes over them.
    if (!topStyle.torsoMaterial && look.top !== 'buttonUp') addParts(upper, shoppers.patterns[look.pattern], width);
    if (look.wear === 'stain') addParts(upper, shoppers.stain, width, topStyle.stainForward ?? 0);
    if (look.bottom === 'skirt') {
      const skirt = new THREE.Mesh(skirtBox, pants);
      skirt.scale.set(shoppers.skirt.width * width, shoppers.skirt.height, shoppers.skirt.depth);
      skirt.position.y = -shoppers.skirt.height / 2;
      upper.add(skirt);
    }
  }
  if (stripe) block(stripe, 0.03, S.torso.h * 0.85, 0.02, 0, S.torso.h * 0.45, -S.torso.d / 2 - 0.006, upper); // zip
  if (outfit && random() < outfit.fannyPackChance) {
    block(mat(pick(outfit.fannyPackColors)), 0.26, 0.11, 0.09, 0, 0.05, -S.torso.d / 2 - 0.04, upper);
  }

  // Arms stick straight out in front (-Z), zombie-style. Pivot at the shoulder, with an elbow
  // joint (only the power walk bends it).
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'leftArm' : 'rightArm';
    shoulder.position.set(side * S.shoulderX * width, S.shoulderY, 0);
    const t = S.armThickness;
    if (look) {
      block(skin, t, t, S.sleeve, 0, 0, -S.sleeve / 2, shoulder);
      const sleeve = look.wear === 'tornSleeve' && side < 0 ? shoppers.tornSleeveLength : shoppers.shortSleeveLength;
      block(fabric[topStyle.sleeveMaterial ?? 'top'], t + 0.02, t + 0.02, sleeve, 0, 0, -sleeve / 2, shoulder);
    } else block(shirt, t + 0.02, t + 0.02, S.sleeve, 0, 0, -S.sleeve / 2, shoulder);
    if (stripe) block(stripe, 0.02, 0.05, S.sleeve, side * (t / 2 + 0.016), 0, -S.sleeve / 2, shoulder);
    const elbow = new THREE.Group();
    elbow.position.z = -S.sleeve;
    shoulder.add(elbow);
    block(skin, t, t, S.forearm, 0, 0, -S.forearm / 2, elbow);
    if (look && topStyle.sleeve === 'long') {
      const length = look.wear === 'tornSleeve' && side < 0 ? shoppers.tornLongSleeveLength : shoppers.longSleeveLength;
      block(shirt, t + shoppers.clothingPadding, t + shoppers.clothingPadding, length, 0, 0, -length / 2, elbow);
    }
    if (outfit) block(mat(outfit.wristbandColor), t + 0.03, t + 0.03, 0.06, 0, 0, -S.forearm + 0.08, elbow);
    upper.add(shoulder);
    return { shoulder, elbow };
  });

  // Cart Pusher: the cart stands on `root` (not `fall`), so it stays put when the zombie tips over dead.
  const cart = type.cart ? buildCart(type.cart, mat, random) : null;
  if (cart) {
    root.add(cart);
    ownedGeometry.push(...cart.userData.geometries);
  }

  // Sometimes clutching a shopping bag in the right hand.
  if (!look && !cart && random() < type.bagChance) {
    const bag = new THREE.Group();
    bag.position.set(0, -0.05, -S.forearm + 0.02);
    block(mat(pick(type.bagColors)), 0.2, 0.26, 0.11, 0, -0.17, 0, bag);
    block(mat(type.bagBandColor), 0.21, 0.05, 0.115, 0, -0.08, 0, bag); // band across the top
    arms[1].elbow.add(bag);
  }

  // Head (pivot at the neck so it can loll)
  const neck = new THREE.Group();
  neck.name = 'head';
  neck.position.y = S.neckY;
  upper.add(neck);
  const h = S.head;
  block(skin, 0.1, 0.06, 0.1, 0, 0.0, 0, neck); // neck
  block(skin, h, h, h, 0, h / 2 + 0.02, 0, neck);
  if (look) addParts(neck, shoppers.hair[look.hair]);
  else {
    block(hair, h + 0.02, 0.07, h + 0.02, 0, h + 0.04, 0.01, neck); // hair on top
    block(hair, h + 0.02, h * 0.55, 0.05, 0, h * 0.68, h / 2, neck); // hair at the back
  }
  block(eyes, 0.06, 0.05, 0.02, -0.07, h * 0.62, -h / 2 - 0.005, neck); // eyes
  block(eyes, 0.06, 0.05, 0.02, 0.07, h * 0.62, -h / 2 - 0.005, neck);
  block(eyes, 0.12, 0.035, 0.02, 0, h * 0.28, -h / 2 - 0.005, neck); // slack mouth
  if (outfit) block(mat(pick(outfit.headbandColors)), h + 0.03, 0.06, h + 0.03, 0, h * 0.86, 0, neck); // headband
  if (look) {
    const accessory = shoppers.accessories[look.accessory];
    addParts(upper, accessory.torso ?? [], width);
    addParts(neck, accessory.head ?? []);
    addParts(arms[1].elbow, accessory.hand ?? []);
    root.userData.appearance = {
      profile: look.profile, palette: look.palette.id, top: look.top, bottom: look.bottom,
      build: look.build.id, hair: look.hair, accessory: look.accessory, wear: look.wear,
    };
    // Batch boxes of the same material on each rigid bone. Bones remain separate
    // so clothes, bags and hair inherit the original walk/attack/death animation.
    const bones = [];
    root.traverse((node) => { if (node.children.some((child) => child.isMesh)) bones.push(node); });
    for (const bone of bones) {
      const batches = new Map();
      for (const mesh of bone.children.filter((child) => child.isMesh)) {
        if (!batches.has(mesh.material)) batches.set(mesh.material, []);
        batches.get(mesh.material).push(mesh);
      }
      for (const [material, meshes] of batches) {
        if (meshes.length < 2) continue;
        const pieces = meshes.map((mesh) => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
        const geometry = mergeGeometries(pieces, false);
        pieces.forEach((piece) => piece.dispose());
        ownedGeometry.push(geometry);
        meshes.forEach((mesh) => mesh.removeFromParent());
        bone.add(new THREE.Mesh(geometry, material));
      }
    }
  }

  // --- Animation state ---
  let walkPhase = random() * Math.PI * 2; // random start so a crowd isn't in sync
  let lastFlash = -1;

  // Cart Pusher poses on top of the shamble: pushing (arms on the handle, leaning in), the telegraph (cart
  // rattling side to side, crouching lower, head down), the charge (leaning hard), crashed (cart tipped onto two
  // wheels, body slumped over the handle). `attacking`: the normal slam is posing the arms, leave them.
  function poseCart(zombie, type, attacking) {
    const ca = type.cartAnimation;
    const t = zombie.stateTime;
    cart.rotation.set(0, 0, 0);
    cart.position.y = 0;
    const lean = cartLean(zombie, type); // (shared with the hitboxes: zombies/cartPose.js)
    if (zombie.state === 'chargeTelegraph') {
      const r = clamp01(t / type.charge.telegraphSeconds);
      cart.rotation.y = Math.sin(t * 45) * ca.telegraphShake * (0.5 + r);
      neck.rotation.x = 0.35 * r;
    } else if (zombie.state === 'charging') {
      cart.rotation.y = Math.sin(t * 30) * ca.telegraphShake * 0.4;
    } else if (zombie.state === 'crashed') {
      const r = ease(clamp01(t / 0.2)) * (1 - ease(clamp01((t - type.charge.crashSeconds + 0.3) / 0.3)));
      cart.rotation.z = ca.crashTilt * r;
      cart.position.y = Math.sin(ca.crashTilt * r) * type.cart.width * 0.5;
    }
    if (zombie.state === 'dead' || zombie.state === 'spawning') return;
    if (attacking) return; // the slam over the handle poses the body and arms itself
    upper.rotation.x = -lean;
    for (const arm of arms) {
      arm.shoulder.rotation.x = ca.armAngle + lean; // keep the hands on the handle as the body leans
      arm.elbow.rotation.x = 0;
    }
  }

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

      // Cart Pusher: hands on the handle (unless slamming), and the charge poses.
      if (cart) poseCart(zombie, type, armPose !== null);

      // Flinch: jolt the upper body, shoulders and head back when shot, and flash white.
      const flinchDur = zombie.flinchDuration || type.flinchSeconds;
      const flinch = flinchDur > 0 ? clamp01(zombie.flinchTimer / flinchDur) : 0;
      const strength = Math.min(2.2, zombie.flinchStrength ?? 1);
      const isHead = zombie.flinchPart === 'head';
      const side = zombie.flinchSide ?? 1;
      const snap = flinch * flinch;
      upper.rotation.x += flinch * (isHead ? 0.3 : 0.44) * strength;
      upper.rotation.y += snap * 0.2 * side * strength;
      upper.rotation.z += snap * 0.1 * side * strength;
      neck.rotation.x -= flinch * (isHead ? 0.62 : 0.34) * strength;
      neck.rotation.y -= snap * (isHead ? 0.3 : 0.12) * side * strength;
      if (armPose === null && !cart && flinch > 0) {
        arms[0].shoulder.rotation.x -= snap * 0.3 * strength;
        arms[1].shoulder.rotation.x -= snap * 0.3 * strength;
        arms[0].shoulder.rotation.z -= snap * 0.15 * strength;
        arms[1].shoulder.rotation.z += snap * 0.15 * strength;
      }
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
        fall.rotation.y = 0;
      }

      // Dead: tip over backwards (faster and with a slight twist on heavy/headshot kills), lie there, then sink.
      if (zombie.state === 'dead') {
        const t = zombie.stateTime;
        const impulse = Math.max(1, zombie.deathImpulse ?? 1);
        const fallDur = type.fallSeconds / Math.min(1.55, Math.sqrt(impulse));
        const tip = ease(Math.min(1, t / fallDur));
        fall.rotation.x = tip * (Math.PI / 2 - 0.08);
        fall.rotation.y = tip * (zombie.deathTwist ?? 0);
        legs[0].rotation.x = legs[1].rotation.x = 0;
        const sinkStart = type.fallSeconds + type.corpseSeconds;
        const sink = Math.max(0, Math.min(1, (t - sinkStart) / type.sinkSeconds));
        root.position.y -= sink * 0.6;
      } else {
        fall.rotation.x = 0;
        fall.rotation.y = 0;
      }
    },

    dispose() {
      root.removeFromParent();
      for (const m of materials) m.dispose();
      for (const geometry of ownedGeometry) geometry.dispose();
    },
  };
}
