// A finished Build-A-Blaster gun's look, added to any gun model: a seam of thread along the top and a patch with stitches on the side, in the stuffing's colour. An
// Overstuffed gun also bulges: lumps of stuffing push out round the patch, and a few tufts leak from them. Reversible: show(null) hides it
// all, and the model itself is never changed.
// Placed from the gun's `build` mount, or its sticker mount when it has none: on its left face, where you see it in your hands. (Not from the
// model's bounds: model.root holds the hands and arms too.) The seam runs along the gun's top from its `top` mount, following the
// surface it finds (seamStitches).
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { workshopStuffings, qualityById } from '../../config/workshop.js';
import { gunStyle } from '../../config/gunStyle.js';

const PATCH = { height: .03, length: .05, thickness: .002 };
const STITCH = { count: 5, spacing: .0115, length: .012, width: .0016, offsetY: .02, proud: .0018 };
const RIM_BARS = 4; // the patch's dark edge: four bars, drawn as extra instances of the stitch mesh (config/gunStyle.js rim)
const SEAM = { count: 6, spacing: .017, length: .017, width: gunStyle.glow.width, lift: .0035, // thread down the top of the gun, the face you look at
  max: 20, min: 3, step: .012, reach: .035, inward: .004, centre: .006, skip: 2, edge: .005 }; // (seamStitches: how it finds the gun's top)
const LUMPS = [[.02, .012, -.024, .017], [.024, -.012, -.006, .021], [.02, .014, .014, .016], [.018, -.014, .028, .015]]; // out, up, along, radius
const TUFTS = 3, TUFT_SIZE = .005, TUFT_FALL = .05, TUFT_DRIFT = .012, TUFT_SPEED = .5;

const WHITE = new THREE.Color(0xffffff);
const hsl = { h: 0, s: 0, l: 0 };

// The Heart badge's shapes, each ONE merged geometry (so a built gun stays cheap): bars lying on the plate, in the plate's (up, along-the-gun) plane.
const INK = gunStyle.heart.thickness * 0.7;
const bar = (up, along, h, l, turn = 0) => {
  const geometry = new THREE.BoxGeometry(INK, h, l);
  if (turn) geometry.rotateX(turn);
  return geometry.translate(0, up, along);
};
const HEART_SHAPES = {
  crosshair: [bar(.0075, 0, .006, .002), bar(-.0075, 0, .006, .002), bar(0, .0075, .002, .006), bar(0, -.0075, .002, .006), bar(0, 0, .002, .002)],
  bullet: [bar(-.0015, 0, .01, .005), bar(.0055, 0, .004, .003), bar(-.0085, 0, .0018, .009)],
  ring: [bar(.007, 0, .002, .015), bar(-.007, 0, .002, .015), bar(0, .007, .015, .002), bar(0, -.007, .015, .002)],
  star: [bar(0, 0, .016, .002), bar(0, 0, .002, .016), bar(0, 0, .015, .002, Math.PI / 4), bar(0, 0, .015, .002, -Math.PI / 4)],
};
const heartGeometries = Object.fromEntries(Object.entries(HEART_SHAPES).map(([name, parts]) => [name, mergeGeometries(parts)]));

// Not the gun: the hands and arms (models/arms.js), and anything hidden (attachments not fitted).
const NOT_GUN = /arm|palm|finger|thumb|cuff|wrist|sleeve|watch|hand/i;
const gunMeshes = (gun) => {
  const out = [];
  gun.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p && p !== gun.parent; p = p.parent) if (!p.visible || NOT_GUN.test(p.name)) return;
    out.push(o);
  });
  return out;
};

/**
 * Where the seam's stitches go, in the gun's own frame. It starts at the `top` mount and walks along the gun both ways,
 * one SEAM.spacing at a time. At each step rays are dropped from above at the start's x and a little further in toward the middle (never
 * onto the middle itself: the sight line), and the surface nearest the last stitch's height wins (within SEAM.step of it, and SEAM.reach of
 * the start), so the seam follows the top as it rises and falls and never wanders down the side. It ends where the top drops away or something stands up (a barrel, a
 * hopper). Fewer than SEAM.min stitches found (or no surface at all): SEAM.count stitches straight along the line at the mount, as before.
 */
function seamStitches(gun, start) {
  const [sx, sy, sz] = start.position;
  const straight = () => Array.from({ length: SEAM.count }, (_, i) => new THREE.Vector3(sx, sy + SEAM.lift, sz + (i - (SEAM.count - 1) / 2) * SEAM.spacing));
  const meshes = gunMeshes(gun);
  if (!meshes.length) return straight();
  gun.updateWorldMatrix(true, true);
  const toLocal = gun.matrixWorld.clone().invert();
  const bounds = new THREE.Box3();
  for (const mesh of meshes) bounds.expandByObject(mesh);
  bounds.applyMatrix4(toLocal);
  const down = new THREE.Vector3(0, -1, 0).transformDirection(gun.matrixWorld);
  const ray = new THREE.Raycaster();
  const sides = meshes.map((m) => m.material.side);
  meshes.forEach((m) => { m.material.side = THREE.DoubleSide; }); // (a ray must stop at the first surface, whichever way it faces)
  const xs = [sx];
  for (let x = sx - Math.sign(sx) * SEAM.inward; Math.abs(x) >= SEAM.centre; x -= Math.sign(sx) * SEAM.inward) xs.push(x);
  // The surface under this step nearest in height to `near` (the outermost on a tie), within `reach` of it and of the start's height.
  const heightAt = (x, z) => {
    ray.set(gun.localToWorld(new THREE.Vector3(x, bounds.max.y + .05, z)), down);
    const hit = ray.intersectObjects(meshes, false)[0];
    return hit ? hit.point.clone().applyMatrix4(toLocal).y : null;
  };
  const surfaceAt = (z, near, reach) => {
    let best = null;
    for (const x of xs) {
      const y = heightAt(x, z);
      if (y === null) continue;
      const off = Math.abs(y - near);
      if (off > reach || Math.abs(y - sy) > SEAM.reach) continue;
      // A stitch needs the same surface a little in front and behind it: never on an edge (a barrel's lip, the end of a part).
      if ([-1, 1].some((side) => { const h = heightAt(x, z + side * SEAM.edge); return h === null || Math.abs(h - y) > SEAM.step / 2; })) continue;
      if (!best || off < best.off) best = { off, at: new THREE.Vector3(x, y + SEAM.lift, z) };
    }
    return best?.at ?? null;
  };
  const run = [];
  for (const dir of [-1, 1]) { // from the start forward (-z), then back (+z)
    let last = sy;
    let found = false;
    for (let i = dir < 0 ? 0 : 1; run.length < SEAM.max; i++) {
      const z = sz + dir * i * SEAM.spacing;
      if (z < bounds.min.z || z > bounds.max.z) break;
      const at = surfaceAt(z, last, found ? SEAM.step : SEAM.reach);
      if (!at) {
        if (found || i > SEAM.skip) break; // (the first step or two may land on an edge: look a little further before giving up)
        continue;
      }
      found = true;
      last = at.y - SEAM.lift;
      run.push(at);
    }
  }
  meshes.forEach((m, i) => { m.material.side = sides[i]; });
  return run.length >= SEAM.min ? run.sort((a, b) => a.z - b.z) : straight();
}

export function createBuildVisual(gun, mounts = {}) {
  const anchor = mounts.build ?? mounts.sticker;
  if (!anchor) return { show() {}, animate() {} };
  const [ax, ay, az] = anchor.position;
  const outward = Math.sign(ax) || -1; // away from the middle of the gun

  const root = new THREE.Group();
  root.name = 'buildVisual';
  root.visible = false;
  root.position.set(ax, ay, az);
  const patchMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .9, flatShading: true });
  const patch = new THREE.Mesh(new THREE.BoxGeometry(PATCH.thickness, PATCH.height, PATCH.length), patchMaterial);
  patch.name = 'buildPatch';
  patch.position.x = outward * PATCH.thickness;
  const face = new THREE.Group(); // the patch and its stitches: they ride out on the pillow (see show())
  face.name = 'buildFace';
  root.add(face);
  face.add(patch);

  const stitchGeometry = new THREE.BoxGeometry(STITCH.width, STITCH.length, STITCH.width);
  const stitchMaterial = new THREE.MeshStandardMaterial({ color: gunStyle.rim.color, roughness: .7 });
  // (Instanced: a built gun is carried everywhere, so its dozens of stitches must stay one draw.)
  const form = new THREE.Object3D();
  const stitches = new THREE.InstancedMesh(stitchGeometry, stitchMaterial, 2 * 2 * STITCH.count + RIM_BARS);
  stitches.name = 'buildStitch';
  let placed = 0;
  for (const row of [-1, 1]) {
    for (let i = 0; i < STITCH.count; i++) {
      for (const lean of [-.7, .7]) { // each stitch is a small cross
        form.position.set(outward * (PATCH.thickness + STITCH.proud), row * STITCH.offsetY, (i - (STITCH.count - 1) / 2) * STITCH.spacing);
        form.rotation.set(lean, 0, 0);
        form.updateMatrix();
        stitches.setMatrixAt(placed++, form.matrix);
      }
    }
  }
  // The rim: a dark frame just round the patch, a hair proud of it (the stitch box scaled into bars: no extra draw).
  const rim = gunStyle.rim.width;
  for (const [up, along, height, length] of [
    [(PATCH.height + rim) / 2, 0, rim, PATCH.length + 2 * rim], [-(PATCH.height + rim) / 2, 0, rim, PATCH.length + 2 * rim],
    [0, (PATCH.length + rim) / 2, PATCH.height, rim], [0, -(PATCH.length + rim) / 2, PATCH.height, rim],
  ]) {
    form.position.set(outward * PATCH.thickness, up, along);
    form.rotation.set(0, 0, 0);
    form.scale.set(PATCH.thickness * 1.4 / STITCH.width, height / STITCH.length, length / STITCH.width);
    form.updateMatrix();
    stitches.setMatrixAt(placed++, form.matrix);
  }
  form.scale.set(1, 1, 1);
  face.add(stitches);

  // The HEART BADGE: a coloured plate on the patch with the Heart's shape in cream on it (config/gunStyle.js heart).
  const badgeStyle = gunStyle.heart;
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7, flatShading: true });
  const inkMaterial = new THREE.MeshBasicMaterial({ color: badgeStyle.ink });
  const badge = new THREE.Group();
  badge.name = 'buildBadge';
  badge.position.x = outward * (PATCH.thickness + badgeStyle.thickness / 2 + .001);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(badgeStyle.thickness, badgeStyle.plate, badgeStyle.plate), plateMaterial);
  plate.name = 'buildBadgePlate';
  const shape = new THREE.Mesh(heartGeometries.crosshair, inkMaterial);
  shape.name = 'buildBadgeShape';
  shape.position.x = outward * (badgeStyle.thickness / 2 + INK / 2 + .0004);
  badge.add(plate, shape);
  badge.visible = false;
  face.add(badge);

  // The seam along the top, in the stuffing's colour.
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // unlit: the seam GLOWS (config/gunStyle.js glow)
  if (mounts.top) {
    const stitchesAt = seamStitches(gun, mounts.top);
    const threads = new THREE.InstancedMesh(new THREE.BoxGeometry(SEAM.length, SEAM.width, SEAM.width), seamMaterial, 2 * stitchesAt.length);
    threads.name = 'buildThread';
    let thread = 0;
    for (const at of stitchesAt) {
      for (const lean of [-.7, .7]) {
        form.position.set(at.x - ax, at.y - ay, at.z - az); // (relative to the patch, which root sits at)
        form.rotation.set(0, lean, 0);
        form.updateMatrix();
        threads.setMatrixAt(thread++, form.matrix);
      }
    }
    root.add(threads);
  }

  // The PUFF: a stuffed pillow on each side of the body, bigger with the quality (config/gunStyle.js puff). The left one carries the patch.
  const puffStyle = gunStyle.puff;
  const pillowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, flatShading: true });
  const pillowGeometry = new THREE.IcosahedronGeometry(1, 1);
  const pillows = [outward, -outward].map((side) => {
    const pillow = new THREE.Mesh(pillowGeometry, pillowMaterial);
    pillow.name = 'buildPuff';
    pillow.scale.setScalar(.001); // (sized by show())
    root.add(pillow);
    return { pillow, side };
  });

  const bulge = new THREE.Group();
  bulge.name = 'buildBulge';
  const stuffingMaterial = new THREE.MeshStandardMaterial({ color: 0xfff5de, roughness: .95, flatShading: true });
  const lumpGeometry = new THREE.IcosahedronGeometry(1, 1);
  for (const [out, up, along, radius] of LUMPS) {
    const lump = new THREE.Mesh(lumpGeometry, stuffingMaterial);
    lump.name = 'buildLump';
    lump.position.set(outward * out * .5, up, along);
    lump.scale.set(radius * 1.1, radius * .85, radius * 1.2);
    bulge.add(lump);
  }
  const tuftGeometry = new THREE.IcosahedronGeometry(TUFT_SIZE, 0);
  const tufts = [];
  for (let i = 0; i < TUFTS; i++) {
    const tuft = new THREE.Mesh(tuftGeometry, stuffingMaterial);
    tuft.name = 'buildTuft';
    tuft.userData.home = new THREE.Vector3(outward * .014, -.018, (i - 1) * .018);
    tuft.position.copy(tuft.userData.home);
    tufts.push(tuft);
    bulge.add(tuft);
  }
  root.add(bulge);
  gun.add(root);

  let leaking = false;
  return {
    show(build) {
      root.visible = !!build;
      if (!build) return;
      const color = workshopStuffings[build.stuffing]?.color ?? 0xffffff;
      patchMaterial.color.setHex(color);
      seamMaterial.color.setHex(color);
      leaking = !!qualityById(build.quality)?.bulge;
      bulge.visible = leaking;
      const puff = puffStyle[build.quality] ?? puffStyle.regular;
      // The pillow's colour: the stuffing's, more or less vivid and lit from within by the quality (config/gunStyle.js quality).
      const look = gunStyle.quality[build.quality] ?? gunStyle.quality.regular;
      pillowMaterial.color.setHex(color);
      if (look.saturation !== 1) {
        pillowMaterial.color.getHSL(hsl);
        pillowMaterial.color.setHSL(hsl.h, Math.min(1, hsl.s * look.saturation), hsl.l);
      }
      pillowMaterial.emissive.copy(pillowMaterial.color).multiplyScalar(look.glow);
      pillowMaterial.color.lerp(WHITE, puffStyle.tint);
      seamMaterial.color.setHex(color).lerp(WHITE, look.seamHot); // (the best builds' seams run hot)
      const heart = badgeStyle.shapes[build.heart];
      badge.visible = !!heart;
      if (heart) {
        shape.geometry = heartGeometries[heart];
        plateMaterial.color.setHex(badgeStyle.colors[build.heart]);
      }
      for (const { pillow, side } of pillows) {
        const left = side === outward;
        const k = left ? 1 : puffStyle.rightScale;
        pillow.position.set(left ? 0 : -2 * ax, puff.rise, left ? 0 : puffStyle.rightBack);
        pillow.scale.set(puff.out * k, puff.h / 2 * k, puff.len / 2 * k);
      }
      face.position.x = outward * puff.out * .85; // on the pillow's outer face
      face.position.y = puff.rise;
    },
    /** Tufts of stuffing drift down out of the seam. `time` in seconds. */
    animate(time) {
      if (!root.visible || !leaking) return;
      tufts.forEach((tuft, i) => {
        const t = (time * TUFT_SPEED + i / TUFTS) % 1;
        tuft.position.copy(tuft.userData.home);
        tuft.position.y -= t * TUFT_FALL;
        tuft.position.x += outward * t * TUFT_DRIFT;
        tuft.scale.setScalar(1 - t * .6);
      });
    },
  };
}
