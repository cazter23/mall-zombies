// =============================================================================
// ZOMBIE MODEL
// Faceted low-poly zombies, built from the type's config (config/zombies.js):
//   Shopper:     grey-green skin, coordinated clothing/build/hair/accessories/face from config/shoppers.js
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
import { createMannequinModel } from './mannequinModel.js';
import { cartLean } from './cartPose.js';

function deformIndexedBox(segX, segY, segZ, fn) {
  const geo = new THREE.BoxGeometry(1, 1, 1, segX, segY, segZ);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [nx, ny, nz] = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, nx, ny, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

const unitBox = new THREE.BoxGeometry(1, 1, 1);

const skirtBox = deformIndexedBox(1, 1, 1, (x, y, z) => (
  y > 0 ? [x * shoppers.skirt.taper, y, z * shoppers.skirt.taper] : [x, y, z]
));

// Faceted upper skull/cranium: bevelled crown, angled temples, cheekbones, and recessed lower base.
const craniumBox = deformIndexedBox(2, 2, 2, (x, y, z) => {
  let nx = x;
  let ny = y;
  let nz = z;
  if (y > 0.25) {
    // Crown bevel
    nx *= 0.9;
    nz *= 0.92;
  } else if (y < -0.25) {
    // Cheekbone overhang tapering into upper jaw
    nx *= 0.86;
    if (z > 0) nz *= 0.88;
  }
  if (Math.abs(x) > 0.35 && Math.abs(z) > 0.35) {
    nx *= 0.88;
    nz *= 0.9;
  }
  return [nx, ny, nz];
});

// Tapered lower jaw & chin block: narrows toward the front (-Z) and chin bottom (-Y).
const jawBox = deformIndexedBox(2, 2, 2, (x, y, z) => {
  let nx = x;
  const ny = y;
  let nz = z;
  if (z < 0) nx *= 0.82;
  if (y < 0) {
    nx *= 0.84;
    nz *= 0.9;
  }
  if (Math.abs(x) > 0.35 && Math.abs(z) > 0.35) nx *= 0.88;
  return [nx, ny, nz];
});

// V-tapered torso: broad at shoulders (+Y), tapered toward waist (-Y), chamfered outer side ribs,
// while preserving the central front/back chest planes (z = +-0.5) so layered clothing sits flush.
const torsoBox = deformIndexedBox(2, 3, 2, (x, y, z) => {
  let nx = x;
  const waistTaper = 0.88 + 0.12 * (y + 0.5); // 0.88 at hips -> 1.0 at shoulders
  nx *= waistTaper;
  if (Math.abs(x) > 0.35 && Math.abs(z) > 0.35) {
    nx *= 0.92;
  }
  return [nx, y, z];
});

// Tapered vertical limb (legs): fuller at hip (+Y), tapering toward ankle (-Y) with chamfered corners.
const limbBoxY = deformIndexedBox(2, 3, 2, (x, y, z) => {
  const taper = 0.78 + 0.22 * (y + 0.5);
  let nx = x * taper;
  let nz = z * taper;
  if (Math.abs(x) > 0.35 && Math.abs(z) > 0.35) {
    nx *= 0.85;
    nz *= 0.85;
  }
  return [nx, y, nz];
});

// Tapered horizontal limb (arms along -Z): fuller at proximal joint (+Z), tapering toward distal (-Z).
const limbBoxZ = deformIndexedBox(2, 2, 3, (x, y, z) => {
  const taper = 0.8 + 0.2 * (z + 0.5);
  let nx = x * taper;
  let ny = y * taper;
  if (Math.abs(x) > 0.35 && Math.abs(y) > 0.35) {
    nx *= 0.85;
    ny *= 0.85;
  }
  return [nx, ny, z];
});

// Faceted shoe: sloped vamp toward -Z (toe), tapered toe cap, bevelled heel.
const shoeBox = deformIndexedBox(2, 2, 3, (x, y, z) => {
  let nx = x;
  let ny = y;
  if (z < 0) {
    const t = -z / 0.5;
    nx *= 1 - 0.22 * t * t;
    if (y > 0) ny = y * (1 - 0.48 * t) - 0.08 * t;
  } else if (z > 0.3 && Math.abs(x) > 0.3) {
    nx *= 0.88;
  }
  return [nx, ny, z];
});

// Faceted hand/palm block: narrower at wrist (+Z), wider at knuckles (-Z).
const handBox = deformIndexedBox(2, 2, 2, (x, y, z) => {
  let nx = x;
  let ny = y;
  if (z > 0) {
    nx *= 0.85;
    ny *= 0.82;
  }
  if (Math.abs(x) > 0.35 && Math.abs(y) > 0.35) {
    nx *= 0.86;
    ny *= 0.88;
  }
  return [nx, ny, z];
});

export const ANATOMY_GEOMETRIES = {
  unitBox,
  craniumBox,
  jawBox,
  torsoBox,
  limbBoxY,
  limbBoxZ,
  shoeBox,
  handBox,
};

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
  if (type.plastic) return createMannequinModel(type);
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
  function block(material, w, h, d, x, y, z, parent, geo = unitBox) {
    const mesh = new THREE.Mesh(geo, material);
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
    top: shirt, pants, skin, hair, eyes, inner: mat(look.palette.inner), trim: mat(look.palette.trim),
    accessory: mat(look.accessoryColor), hardware: mat(shoppers.colors.hardware), stain: mat(shoppers.colors.stain),
  } : {
    top: shirt, pants, skin, hair, eyes, inner: stripe ?? hair, trim: stripe ?? shirt,
    accessory: shirt, hardware: eyes, stain: hair,
  };
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

  // Legs (pivot at the hip so they can swing): tapered leg limbs + faceted shoes
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.name = side < 0 ? 'leftLeg' : 'rightLeg';
    hip.position.set(side * S.legGap * width, S.hipY, 0);
    if (look && look.bottom !== 'trousers') {
      block(skin, S.legWidth * width, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip, limbBoxY);
      if (look.bottom === 'shorts') block(pants, S.legWidth * width + shoppers.clothingPadding, shoppers.shortsLength,
        S.legWidth + 0.02 + shoppers.clothingPadding, 0, -shoppers.shortsLength / 2, 0, hip, limbBoxY);
    } else block(pants, S.legWidth * width, S.hipY, S.legWidth + 0.02, 0, -S.hipY / 2, 0, hip, limbBoxY);
    const barefoot = look?.wear === 'missingShoe' && side < 0;
    const shoeMat = barefoot ? skin : mat(look?.palette.shoes ?? type.shoeColor);
    block(shoeMat, S.legWidth + 0.01, 0.085, 0.26, 0, -S.hipY + 0.042, -0.04, hip, shoeBox);
    if (stripe) {
      block(stripe, 0.02, S.hipY - 0.1, 0.05, side * (S.legWidth / 2 + 0.006), -S.hipY / 2 + 0.02, 0, hip);
      // Mall Walker sneaker stripe accent
      block(shirt, S.legWidth + 0.016, 0.022, 0.09, 0, -S.hipY + 0.042, -0.03, hip);
    }
    fall.add(hip);
    return hip;
  });

  // Upper body (pivot at the hips): tapered torso, shoulders, arms, faceted head
  const upper = new THREE.Group();
  upper.name = 'upperBody';
  upper.position.y = S.hipY;
  fall.add(upper);
  const torsoMat = fabric?.[topStyle?.torsoMaterial] ?? shirt;
  block(torsoMat, S.torso.w * width, S.torso.h, S.torso.d, 0, S.torso.h / 2, 0, upper, torsoBox);
  // Subtle shoulder caps at top of torso to bridge into the upper arms
  block(shirt, (S.torso.w + 0.04) * width, 0.08, S.torso.d - 0.02, 0, S.torso.h - 0.035, 0, upper, jawBox);
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
    block(mat(pick(outfit.fannyPackColors)), 0.26, 0.11, 0.09, 0, 0.05, -S.torso.d / 2 - 0.04, upper, jawBox);
  }

  // Arms stick straight out in front (-Z), zombie-style. Pivot at the shoulder, with an elbow
  // joint (only the power walk bends it) and simple recognizable hands at the wrist.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.name = side < 0 ? 'leftArm' : 'rightArm';
    shoulder.position.set(side * S.shoulderX * width, S.shoulderY, 0);
    const t = S.armThickness;
    if (look) {
      block(skin, t, t, S.sleeve, 0, 0, -S.sleeve / 2, shoulder, limbBoxZ);
      const sleeve = look.wear === 'tornSleeve' && side < 0 ? shoppers.tornSleeveLength : shoppers.shortSleeveLength;
      block(fabric[topStyle.sleeveMaterial ?? 'top'], t + 0.02, t + 0.02, sleeve, 0, 0, -sleeve / 2, shoulder, limbBoxZ);
    } else block(shirt, t + 0.02, t + 0.02, S.sleeve, 0, 0, -S.sleeve / 2, shoulder, limbBoxZ);
    if (stripe) block(stripe, 0.02, 0.05, S.sleeve, side * (t / 2 + 0.016), 0, -S.sleeve / 2, shoulder);
    const elbow = new THREE.Group();
    elbow.position.z = -S.sleeve;
    shoulder.add(elbow);
    block(skin, t * 0.94, t * 0.94, S.forearm - 0.05, 0, 0, -(S.forearm - 0.05) / 2, elbow, limbBoxZ);
    // Simple recognizable hand at the wrist: shaped palm, curled fingers, and distinct inner thumb
    const handZ = -S.forearm + 0.035;
    block(skin, t * 0.62, t * 0.72, 0.065, 0, 0, handZ, elbow, handBox);
    const fingers = block(skin, t * 0.56, t * 0.64, 0.05, side * -0.01, -0.008, handZ - 0.042, elbow, jawBox);
    fingers.rotation.y = side * 0.28;
    const thumb = block(skin, 0.026, 0.028, 0.048, side * -0.028, 0.036, handZ - 0.008, elbow, jawBox);
    thumb.rotation.x = 0.35;
    if (look && topStyle.sleeve === 'long') {
      const length = look.wear === 'tornSleeve' && side < 0 ? shoppers.tornLongSleeveLength : shoppers.longSleeveLength;
      block(shirt, t + shoppers.clothingPadding, t + shoppers.clothingPadding, length, 0, 0, -length / 2, elbow, limbBoxZ);
    }
    if (outfit) block(mat(outfit.wristbandColor), t + 0.025, t + 0.025, 0.06, 0, 0, -S.forearm + 0.09, elbow);
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

  // Head (pivot at the neck so it can loll): faceted cranium, tapered jaw, brow ridge, ears & face profile
  const neck = new THREE.Group();
  neck.name = 'head';
  neck.position.y = S.neckY;
  upper.add(neck);
  const h = S.head;
  const faceProfile = shoppers.faceProfiles.find((fp) => fp.id === look?.face) ?? pick(shoppers.faceProfiles);
  const [jx, jy, jz] = faceProfile.jawOffset;
  block(skin, 0.11, 0.065, 0.11, 0, 0.005, 0.01, neck, limbBoxY); // tapered neck
  block(skin, h, h * 0.76, h * 0.98, 0, h * 0.62 + 0.02, 0.003, neck, craniumBox); // upper cranium & cheekbones
  const jaw = block(skin, h * 0.82, h * 0.36, h * 0.82, jx, h * 0.22 + 0.016 + jy, -0.018 + jz, neck, jawBox);
  jaw.rotation.z = faceProfile.jawTilt;
  // Brow ridge & small side ears
  block(skin, h * 0.82, 0.028, 0.026, 0, h * 0.74, -h / 2 + 0.004, neck, jawBox);
  block(skin, 0.028, 0.064, 0.044, -h / 2 - 0.004, h * 0.56, 0.01, neck, jawBox);
  block(skin, 0.028, 0.064, 0.044, h / 2 + 0.004, h * 0.56, 0.01, neck, jawBox);

  if (look) addParts(neck, shoppers.hair[look.hair]);
  else {
    block(hair, h + 0.02, 0.07, h + 0.02, 0, h + 0.04, 0.01, neck, craniumBox); // hair on top
    block(hair, h + 0.01, h * 0.55, 0.05, 0, h * 0.68, h / 2, neck, jawBox); // hair at the back
  }
  addParts(neck, faceProfile.parts);
  if (outfit) block(mat(pick(outfit.headbandColors)), h + 0.03, 0.06, h + 0.03, 0, h * 0.86, 0, neck); // headband
  if (look) {
    const accessory = shoppers.accessories[look.accessory];
    addParts(upper, accessory.torso ?? [], width);
    addParts(neck, accessory.head ?? []);
    addParts(arms[1].elbow, accessory.hand ?? []);
    root.userData.appearance = {
      profile: look.profile, palette: look.palette.id, top: look.top, bottom: look.bottom,
      build: look.build.id, hair: look.hair, accessory: look.accessory, wear: look.wear,
      face: faceProfile.id,
    };
  }

  // Batch meshes of the same material on each rigid bone across all zombie types.
  // Bones remain separate so clothes, bags and hair inherit the original walk/attack/death animation.
  const bones = [];
  root.traverse((node) => {
    if (node === cart) return;
    if (node.children.some((child) => child.isMesh)) bones.push(node);
  });
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
        // (Out of the Returns Chute it tumbles down instead.)
        root.position.y += zombie.dropHeight > 0 ? zombie.dropHeight * (1 - t) : -type.height * (1 - t);
        fall.rotation.x = zombie.dropHeight > 0 ? (1 - t) * 2.4 : 0;
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
      } else if (zombie.state !== 'spawning') {
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

/**
 * Shared static visual builder for decorative shop/booth zombie clerks (`src/maps/mall/props.js`).
 * Uses the refreshed faceted zombie anatomy (cranium, jaw, brow, ears, V-tapered torso, apron,
 * name badge, tapered arms, and recognizable hands resting on the counter).
 * Merges parts by material into map-owned BufferGeometries compatible with static batching and `kit.dispose()`.
 */
export function buildClerkFigure({
  group,
  mat,
  x,
  z,
  rotationY = 0,
  apron = 0xd62839,
  hair = 0x6b6b6b,
}) {
  const skinMat = mat(0x8fbf8a);
  const darkMat = mat(0x23262d);
  const pantsMat = mat(0x2f3340);
  const shirtMat = mat(0xd8d2c2);
  const apronMat = mat(apron);
  const badgeMat = mat(0xf1faee);
  const hairMat = mat(hair);

  const batches = new Map();
  const pivotY = 1.0;
  const rotQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const partQuat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scaleVec = new THREE.Vector3();
  const posVec = new THREE.Vector3();
  const mat4 = new THREE.Matrix4();

  // Adds a part in clerk-local space (feet at y = 0, facing -Z)
  function part(material, geo, w, h, d, lx, ly, lz, rx = 0, ry = 0, rz = 0) {
    const g = geo.clone();
    euler.set(rx, ry, rz);
    partQuat.setFromEuler(euler);
    posVec.set(lx, ly - pivotY, lz).applyQuaternion(rotQuat);
    partQuat.premultiply(rotQuat);
    scaleVec.set(w, h, d);
    mat4.compose(posVec, partQuat, scaleVec);
    g.applyMatrix4(mat4);
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(g);
  }

  // Legs & faceted shoes
  for (const side of [-1, 1]) {
    part(pantsMat, limbBoxY, 0.18, 0.87, 0.19, side * 0.13, 0.515, 0);
    part(darkMat, shoeBox, 0.19, 0.085, 0.26, side * 0.13, 0.042, -0.03);
  }

  // Tapered undershirt torso, shoulders & short sleeves
  part(shirtMat, torsoBox, 0.48, 0.68, 0.25, 0, 1.29, 0);
  part(shirtMat, jawBox, 0.54, 0.09, 0.23, 0, 1.59, 0);
  // Collar V-neck flaps
  part(shirtMat, unitBox, 0.1, 0.07, 0.024, -0.055, 1.58, -0.132, 0, 0, -0.35);
  part(shirtMat, unitBox, 0.1, 0.07, 0.024, 0.055, 1.58, -0.132, 0, 0, 0.35);

  // Retail apron (proud of torso so no coplanar overlap) + neck strap + waist ties
  part(apronMat, torsoBox, 0.44, 0.56, 0.04, 0, 1.23, -0.128);
  part(apronMat, unitBox, 0.502, 0.045, 0.274, 0, 1.18, 0); // waist tie band
  part(apronMat, unitBox, 0.032, 0.16, 0.025, -0.11, 1.55, -0.132, 0, 0, 0.18); // left neck strap
  part(apronMat, unitBox, 0.032, 0.16, 0.025, 0.11, 1.55, -0.132, 0, 0, -0.18); // right neck strap

  // Employee name badge & header stripe on the apron bib
  part(badgeMat, unitBox, 0.13, 0.095, 0.014, -0.1, 1.42, -0.156);
  part(darkMat, unitBox, 0.11, 0.022, 0.016, -0.1, 1.45, -0.16);

  // Tapered upper arms, forearms reaching forward (-Z), and recognizable hands resting on the counter
  for (const side of [-1, 1]) {
    const ax = side * 0.33;
    part(shirtMat, limbBoxY, 0.145, 0.2, 0.145, ax, 1.51, 0); // short sleeve
    part(skinMat, limbBoxY, 0.125, 0.31, 0.125, ax, 1.26, 0); // upper arm
    part(skinMat, limbBoxZ, 0.118, 0.105, 0.26, ax, 1.09, -0.14); // forearm reaching out
    part(skinMat, handBox, 0.095, 0.052, 0.09, ax, 1.075, -0.305); // palm on counter
    part(skinMat, jawBox, 0.088, 0.038, 0.065, ax - side * 0.008, 1.066, -0.37, 0.12, side * 0.18, 0); // fingers
    part(skinMat, jawBox, 0.032, 0.034, 0.055, ax - side * 0.052, 1.072, -0.31, 0, side * 0.45, 0); // thumb
  }

  // Tapered neck, faceted cranium, slightly crooked lower jaw, brow ridge & ears
  part(skinMat, limbBoxY, 0.115, 0.07, 0.115, 0, 1.66, 0.01);
  part(skinMat, craniumBox, 0.33, 0.25, 0.3, 0, 1.88, 0);
  part(skinMat, jawBox, 0.27, 0.12, 0.25, 0.008, 1.72, -0.02, 0, 0, 0.04);
  part(skinMat, jawBox, 0.27, 0.03, 0.028, 0, 1.91, -0.148); // brow ridge
  part(skinMat, jawBox, 0.03, 0.068, 0.046, -0.17, 1.85, 0.01); // left ear
  part(skinMat, jawBox, 0.03, 0.068, 0.046, 0.17, 1.85, 0.01); // right ear

  // Faceted hair cap, back & temples
  part(hairMat, craniumBox, 0.35, 0.085, 0.32, 0, 2.02, 0.005);
  part(hairMat, jawBox, 0.34, 0.18, 0.055, 0, 1.89, 0.145);
  part(hairMat, unitBox, 0.03, 0.14, 0.18, -0.168, 1.9, 0.04);
  part(hairMat, unitBox, 0.03, 0.14, 0.18, 0.168, 1.9, 0.04);

  // Undead clerk face: sunken staring eyes, one drooping lid, strained retail grin with teeth
  part(darkMat, unitBox, 0.062, 0.052, 0.02, -0.072, 1.855, -0.152);
  part(darkMat, unitBox, 0.062, 0.038, 0.02, 0.072, 1.848, -0.152);
  part(hairMat, unitBox, 0.068, 0.024, 0.022, 0.072, 1.872, -0.155, 0, 0, -0.1); // drooping eyelid
  part(darkMat, unitBox, 0.14, 0.042, 0.02, 0.005, 1.735, -0.148, 0, 0, 0.04); // retail smile mouth
  part(badgeMat, unitBox, 0.11, 0.02, 0.018, 0.005, 1.738, -0.152, 0, 0, 0.04); // strained retail teeth

  const meshes = [];
  for (const [material, list] of batches) {
    const merged = mergeGeometries(list, false);
    list.forEach((g) => g.dispose());
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'clerk';
    mesh.position.set(x, pivotY, z);
    group.add(mesh);
    meshes.push(mesh);
  }
  return meshes;
}

