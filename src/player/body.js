// =============================================================================
// PLAYER BODY (first-person legs and torso)
// A faceted low-poly body under the camera so you see your own torso, legs and
// sneakers when you look down. Purely visual: no collision, not shootable.
//
// Animated in code every rendered frame:
//   - Hip height follows the camera height (stand -> crouch -> slide -> prone blend smoothly)
//   - Feet are placed by pose (walk cycle / slide / airborne / vault), then each knee is
//     solved so thigh + shin reach from hip to foot (simple two-bone IK).
// The arms live on the gun model instead (weapons/viewmodel.js).
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const KNEE_POLE = new THREE.Vector3(0, 0, -1); // knees bend forward (the body faces -Z)
const UP = new THREE.Vector3(0, 1, 0);
const unitBox = new THREE.BoxGeometry(1, 1, 1);

// 8-sided octagonal prism radius so flat top/bottom/left/right facets sit at +-0.5.
const OCT_RADIUS = 0.5 / Math.cos(Math.PI / 8);
const limbGeoCache = new Map();

/**
 * Returns a unit-length (z in [-0.5, 0.5]) 8-sided faceted limb geometry whose
 * cross-section tapers from `startScale` at point `a` (z = -0.5) to `endScale`
 * at point `b` (z = +0.5), bounded within [-0.5, 0.5] when scales <= 1.
 */
export function getFacetedLimbGeometry(startScale = 1, endScale = 1) {
  const key = `${startScale.toFixed(3)}|${endScale.toFixed(3)}`;
  if (!limbGeoCache.has(key)) {
    const geo = new THREE.CylinderGeometry(
      endScale * OCT_RADIUS,
      startScale * OCT_RADIUS,
      1,
      8,
      1,
    );
    geo.rotateY(Math.PI / 8);
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    limbGeoCache.set(key, geo);
  }
  return limbGeoCache.get(key);
}

/**
 * Deforms a subdivided unit box in [-0.5, 0.5]^3 using `fn(x, y, z) -> [nx, ny, nz]`
 * and computes flat-shaded vertex normals.
 */
export function buildDeformedBoxGeometry(segX, segY, segZ, fn) {
  const geo = new THREE.BoxGeometry(1, 1, 1, segX, segY, segZ).toNonIndexed();
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const [nx, ny, nz] = fn(pos.getX(i), pos.getY(i), pos.getZ(i));
    pos.setXYZ(i, nx, ny, nz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Faceted sneaker upper bounded strictly within [-0.5, 0.5]^3:
// sloped vamp toward -Z (toe), tapered faceted toe box, and shaped ankle collar at +Z.
const unitSneakerGeo = buildDeformedBoxGeometry(2, 2, 4, (x, y, z) => {
  let nx = x;
  let ny = y;
  const nz = z;
  if (z < 0.05) {
    // Front vamp & toe box (-Z is forward): slope top down and taper width toward the toe
    const t = Math.min(1, (0.05 - z) / 0.55); // 0 at mid-foot -> 1 at toe tip
    if (y > 0) {
      ny = y * (1 - 0.52 * t) - 0.08 * t;
      // Bevel upper side ridges of the toe box
      if (Math.abs(x) > 0.2) nx *= 1 - 0.14 * t;
    }
    nx *= 1 - 0.24 * t * t;
  } else {
    // Ankle collar (+Z is heel): slight inward taper at the top rim and heel bevel
    const h = (z - 0.05) / 0.45;
    if (y > 0) nx *= 1 - 0.1 * h;
    if (z > 0.4 && Math.abs(x) > 0.2) nx *= 0.88;
  }
  return [
    Math.max(-0.5, Math.min(0.5, nx)),
    Math.max(-0.5, Math.min(0.5, ny)),
    Math.max(-0.5, Math.min(0.5, nz)),
  ];
});

// Faceted sneaker outsole bounded within [-0.5, 0.5]^3: tapered toe bumper at -Z.
const unitSoleGeo = buildDeformedBoxGeometry(2, 1, 4, (x, y, z) => {
  let nx = x;
  if (z < 0) {
    const t = Math.min(1, -z / 0.5);
    nx *= 1 - 0.22 * t * t;
  } else if (z > 0.35 && Math.abs(x) > 0.2) {
    nx *= 0.9;
  }
  return [nx, y, z];
});

/**
 * Stretches a unit mesh into a limb from `a` to `b` (in its parent's space).
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

export function makeFacetedLimbMesh(color, startScale = 1, endScale = 1, roughness = 0.8) {
  return new THREE.Mesh(
    getFacetedLimbGeometry(startScale, endScale),
    new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }),
  );
}

// Two-bone IK: where does the knee go so thigh (l1) + shin (l2) connect hip to foot?
// If the foot is out of reach, it is pulled in to full leg length. Writes knee into `outKnee`.
const tmpDir = new THREE.Vector3();
const tmpPole = new THREE.Vector3();
function solveKnee(hip, foot, l1, l2, outKnee, proneAmount = 0) {
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
  tmpPole.copy(KNEE_POLE).lerp(UP, proneAmount);
  tmpPole.addScaledVector(tmpDir, -tmpPole.dot(tmpDir));
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

  // Lower torso (children[0]): tapered faceted polo waist
  const torsoGeo = getFacetedLimbGeometry(0.94, 1.0).clone();
  torsoGeo.rotateX(Math.PI / 2); // align taper along Y
  const upperBody = new THREE.Group();
  upperBody.name = 'playerUpperBody';
  const torso = new THREE.Mesh(
    torsoGeo,
    new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.78, flatShading: true }),
  );
  const belt = new THREE.Mesh(
    torsoGeo,
    new THREE.MeshStandardMaterial({ color: c.belt, roughness: 0.65, flatShading: true }),
  );
  // Small brass belt buckle on the front (-Z) of the belt
  const buckle = makeBoxMesh(c.buckle ?? 0xd4af37);
  buckle.scale.set(0.18, 0.92, 0.08);
  buckle.position.set(0, 0, -0.49);
  belt.add(buckle);

  const addDetail = (parent, color, size, position) => {
    const detail = makeBoxMesh(color);
    detail.scale.set(...size);
    detail.position.set(...position);
    parent.add(detail);
    return detail;
  };
  // The shift card peeks over the waistband, where it can be seen from above.
  const card = addDetail(torso, c.shirtStripe, [.19, .25, .025], [.24, -.26, -.49]);
  card.name = 'shiftCard';
  card.rotation.z = -.14;
  addDetail(card, c.shoeAccent, [.82, .22, .2], [0, .30, -.55]);
  addDetail(card, c.belt, [.58, .07, .2], [0, -.12, -.55]);
  addDetail(belt, c.uniformGold, [.07, .84, .05], [-.29, -.02, -.50]);
  const key = addDetail(belt, c.uniformGold, [.029, 1.55, .05], [-.29, -.88, -.51]);
  key.rotation.z = -.08;
  addDetail(belt, c.uniformGold, [.05, .32, .04], [-.26, -1.50, -.51]);

  const chest = new THREE.Mesh(torsoGeo, torso.material);
  chest.name = 'playerChest';
  chest.position.y = .26;
  chest.scale.set(.38, .36, .20);
  upperBody.add(torso, chest);
  for (const side of [-1, 1]) {
    const sleeve = addDetail(upperBody, c.shirt, [.115, .18, .16], [side * .191, .338, 0]);
    sleeve.rotation.z = side * .25;
    addDetail(sleeve, c.shirtStripe, [1.02, .09, 1.02], [0, -.38, 0]);
    const collar = addDetail(upperBody, c.shirtTrim, [.065, .065, .022], [side * .05, .433, -.092]);
    collar.rotation.z = side * -.43;
  }
  addDetail(upperBody, c.shirtStripe, [.065, .036, .012], [.107, .36, -.107]);
  addDetail(upperBody, c.skinShade, [.095, .087, .097], [0, .462, 0]);

  const head = new THREE.Group();
  head.name = 'playerHead';
  head.position.y = .58;
  upperBody.add(head);
  const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ color: c.skin, roughness: .86, flatShading: true }));
  skull.scale.set(.103, .127, .096);
  head.add(skull);
  const hair = new THREE.Mesh(skull.geometry, new THREE.MeshStandardMaterial({ color: c.belt, roughness: .94, flatShading: true }));
  hair.scale.set(.108, .073, .101);
  hair.position.set(0, .067, .014);
  head.add(hair);
  for (const side of [-1, 1]) {
    addDetail(head, c.skinShade, [.026, .047, .037], [side * .095, -.015, .001]);
    addDetail(head, c.belt, [.027, .011, .009], [side * .039, .014, -.089]);
  }
  addDetail(head, c.skinShade, [.028, .039, .032], [0, -.014, -.093]);

  const pelvis = new THREE.Mesh(
    torsoGeo,
    new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.8, flatShading: true }),
  );
  root.add(upperBody, belt, pelvis);
  // The viewmodel supplies the first-person arms. An external view can show the head.
  head.visible = false;

  const shoeMat = new THREE.MeshStandardMaterial({ color: c.shoes, roughness: 0.72, flatShading: true });
  const soleMat = new THREE.MeshStandardMaterial({ color: c.soles, roughness: 0.85, flatShading: true });
  const accentMat = new THREE.MeshStandardMaterial({ color: c.shoeAccent ?? c.shirt, roughness: 0.65, flatShading: true });

  const legs = [-1, 1].map((side) => {
    const thigh = makeFacetedLimbMesh(c.pants, 1.0, 0.84);
    const shin = makeFacetedLimbMesh(c.pants, 0.94, 0.76);
    const shoe = new THREE.Mesh(unitSneakerGeo, shoeMat);
    // Raised tongue, contrasting quarter panels, laces, and a gold heel pull.
    const tongue = new THREE.Mesh(unitBox, accentMat);
    tongue.scale.set(0.36, 0.18, 0.22);
    tongue.position.set(0, 0.26, -0.02);
    shoe.add(tongue);
    for (const edge of [-1, 1]) {
      const panel = addDetail(shoe, c.shoeAccent, [.055, .31, .39], [edge * .47, -.11, .12]);
      panel.rotation.x = -.12;
    }
    for (const [y, z] of [[.38, -.04], [.32, -.14], [.26, -.24]]) {
      addDetail(shoe, c.shirtStripe, [.45, .055, .045], [0, y, z]);
    }
    addDetail(shoe, c.uniformGold, [.22, .36, .055], [0, .24, .49]);
    const kneeFold = addDetail(shin, c.pantsShade, [.62, .045, .052], [0, -.47, -.29]);
    kneeFold.rotation.y = .10 * side;
    addDetail(shin, c.pantsShade, [.62, .045, .040], [0, -.39, .37]);
    const sole = new THREE.Mesh(unitSoleGeo, soleMat);
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
  let runAmount = 0;
  let slideAmount = 0; // 0..1 blend into the slide pose
  let airAmount = 0; // 0..1 blend into the airborne tuck
  let vaultAmount = 0; // 0..1 how far into the vault's leg swing
  const swingDir = new THREE.Vector2(0, -1); // local direction the feet swing along (last movement dir)
  const walkFoot = new THREE.Vector3();
  const slideFoot = new THREE.Vector3();
  const vaultFoot = new THREE.Vector3();
  const proneFoot = new THREE.Vector3();

  // Hip height that follows the (smoothly easing) camera height between the stance poses.
  function hipHeightForEye(eye) {
    const standEye = feel.player.eyeHeight;
    const crouchEye = feel.crouch.eyeHeight;
    const slideEye = feel.slide.eyeHeight;
    const h = b.hipHeight;
    if (eye < slideEye) {
      const t = Math.max(0, (eye - feel.prone.eyeHeight) / (slideEye - feel.prone.eyeHeight));
      return h.prone + (h.slide - h.prone) * t;
    }
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
    update(frameTime, player, alpha, { firstPerson = true } = {}) {
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
      const walking = player.grounded && player.stance !== 'slide' && player.stance !== 'prone';
      const proneAmount = Math.max(0, Math.min(1, (feel.slide.eyeHeight - eye)
        / (feel.slide.eyeHeight - feel.prone.eyeHeight)));
      const targetMove = walking ? Math.min(speed / player.stats.walkSpeed, 1.6) : 0;
      moveAmount += (targetMove - moveAmount) * blend;
      const running = walking && player.isSprinting;
      runAmount += ((running ? Math.min(1, speed / player.stats.sprintSpeed) : 0) - runAmount) * blend;
      slideAmount += ((player.stance === 'slide' ? 1 : 0) - slideAmount) * blend;
      airAmount += ((player.grounded ? 0 : 1) - airAmount) * blend;
      // Vault: the legs swing up and over and back down along with the vault itself.
      const vp = player.vault ? player.vault.progress : null;
      vaultAmount = vp === null ? Math.max(0, vaultAmount - blend) : Math.sin(Math.min(1, vp) * Math.PI);
      const stride = THREE.MathUtils.lerp(b.strideLength, b.run.strideLength, runAmount);
      if (walking) walkPhase = (walkPhase + ((speed * frameTime) / stride) * Math.PI * 2) % (Math.PI * 2);

      // --- Torso and hips ---
      const hipY = hipHeightForEye(eye) - (1 - Math.cos(walkPhase * 2)) * .5 * b.run.hipRise * runAmount;
      upperBody.position.set(0, hipY, b.backOffset);
      const crouchAmount = THREE.MathUtils.clamp((feel.player.eyeHeight - eye)
        / (feel.player.eyeHeight - feel.crouch.eyeHeight), 0, 1);
      upperBody.rotation.set(THREE.MathUtils.lerp(b.crouchTorsoLean * crouchAmount,
        Math.PI / 2, proneAmount) - b.run.lean * runAmount,
        Math.sin(walkPhase) * b.run.twist * runAmount, 0);
      head.visible = !firstPerson;
      torso.position.set(0, 0.05 + b.torsoHeight / 2, 0);
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
        // Ground contact sweeps backward at a steady rate; only the recovery foot lifts.
        const cycle = (phase / (Math.PI * 2) + .25) % 1;
        const planted = cycle < b.run.plantFraction;
        const recovery = (cycle - b.run.plantFraction) / (1 - b.run.plantFraction);
        const runSwing = planted ? 1 - 2 * cycle / b.run.plantFraction : -Math.cos(recovery * Math.PI);
        const swing = THREE.MathUtils.lerp(Math.sin(phase) * b.stepSwing * Math.min(1, moveAmount),
          runSwing * b.run.swing, runAmount);
        const lift = THREE.MathUtils.lerp(Math.max(0, Math.cos(phase)) * b.stepLift * Math.min(1, moveAmount),
          planted ? 0 : Math.sin(recovery * Math.PI) * b.run.lift, runAmount);
        const footZ = b.backOffset - b.feetForward;
        walkFoot.set(x + swingDir.x * swing, b.ankleHeight + lift, footZ + swingDir.y * swing);

        // Slide: both legs out in front in a loose V (right leads, left splays out),
        // so no knee folds up into the camera.
        if (leg.side > 0) slideFoot.set(x, b.ankleHeight, -b.slideFrontFoot);
        else slideFoot.set(x - b.slideSplay, b.ankleHeight, -b.slideBackFoot);

        leg.foot.copy(walkFoot).lerp(slideFoot, slideAmount);
        proneFoot.set(x, b.proneAnkleHeight, b.backOffset + b.proneLegBack);
        leg.foot.lerp(proneFoot, proneAmount);
        // Airborne: pull the feet up a little (not during a slide or a vault).
        leg.foot.y += b.airTuck * airAmount * (1 - slideAmount) * (1 - vaultAmount);

        // Vault: both feet together, up near hip height, out to one side and forward over the obstacle.
        if (vaultAmount > 0) {
          vaultFoot.set(
            b.vaultSide * b.vaultFootOut + leg.side * 0.05,
            hipY + b.vaultFootRaise,
            -b.vaultFootForward + (leg.side === b.vaultSide ? -b.vaultFeetGap : 0),
          );
          leg.foot.lerp(vaultFoot, vaultAmount);
        }

        solveKnee(leg.hip, leg.foot, b.thighLength, b.shinLength, leg.knee, proneAmount);
        placeLimb(leg.thigh, leg.hip, leg.knee, 0.14, 0.15);
        placeLimb(leg.shin, leg.knee, leg.foot, 0.12, 0.13);

        // Sneaker: faceted upper + sole, toe pointing forward, ankle near the back.
        const toeOffset = 0.07 * (2 * proneAmount - 1);
        const pitch = (planted ? 0 : -Math.sin(recovery * Math.PI * 2) * b.run.toeOff)
          * runAmount * (1 - slideAmount) * (1 - airAmount) * (1 - vaultAmount);
        const cosPitch = Math.cos(pitch), sinPitch = Math.sin(pitch);
        leg.shoe.position.set(leg.foot.x, leg.foot.y - .03 * cosPitch - toeOffset * sinPitch,
          leg.foot.z + toeOffset * cosPitch - .03 * sinPitch);
        leg.shoe.rotation.set(pitch, proneAmount * Math.PI, 0);
        leg.shoe.scale.set(0.12, 0.08, 0.27);
        leg.sole.position.set(leg.foot.x, leg.foot.y - .075 * cosPitch - toeOffset * sinPitch,
          leg.foot.z + toeOffset * cosPitch - .075 * sinPitch);
        leg.sole.rotation.set(pitch, proneAmount * Math.PI, 0);
        leg.sole.scale.set(0.125, 0.02, 0.28);
      }
    },
  };
}
