// A finished Build-A-Blaster gun's look, added to any gun model: a seam of thread along the top and a patch with stitches on the side, in the stuffing's colour. An
// Overstuffed gun also bulges: lumps of stuffing push out round the patch, and a few tufts leak from them. Reversible: show(null) hides it
// all, and the model itself is never changed.
// Placed from the gun's sticker mount, which sits on its left face on every gun. (Not from the model's bounds: model.root holds the hands and arms too.)
import * as THREE from 'three';
import { workshopStuffings, qualityById } from '../../config/workshop.js';
import { gunStyle } from '../../config/gunStyle.js';

const PATCH = { height: .03, length: .05, thickness: .002 };
const STITCH = { count: 5, spacing: .0115, length: .012, width: .0016, offsetY: .02, proud: .0018 };
const SEAM = { count: 6, spacing: .017, length: .017, width: gunStyle.glow.width, lift: .0035 }; // thread down the top of the gun, the face you look at
const LUMPS = [[.02, .012, -.024, .017], [.024, -.012, -.006, .021], [.02, .014, .014, .016], [.018, -.014, .028, .015]]; // out, up, along, radius
const TUFTS = 3, TUFT_SIZE = .005, TUFT_FALL = .05, TUFT_DRIFT = .012, TUFT_SPEED = .5;

const WHITE = new THREE.Color(0xffffff);

export function createBuildVisual(gun, mounts = {}) {
  const anchor = mounts.sticker;
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
  const stitchMaterial = new THREE.MeshStandardMaterial({ color: 0x1d1626, roughness: .7 });
  // (Instanced: a built gun is carried everywhere, so its dozens of stitches must stay one draw.)
  const form = new THREE.Object3D();
  const stitches = new THREE.InstancedMesh(stitchGeometry, stitchMaterial, 2 * 2 * STITCH.count);
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
  face.add(stitches);

  // The seam along the top, in the stuffing's colour.
  const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff }); // unlit: the seam GLOWS (config/gunStyle.js glow)
  if (mounts.top) {
    const [tx, ty, tz] = mounts.top.position;
    const threads = new THREE.InstancedMesh(new THREE.BoxGeometry(SEAM.length, SEAM.width, SEAM.width), seamMaterial, 2 * SEAM.count);
    threads.name = 'buildThread';
    threads.position.set(tx - ax, ty - ay + SEAM.lift, tz - az);
    let thread = 0;
    for (let i = 0; i < SEAM.count; i++) {
      for (const lean of [-.7, .7]) {
        form.position.set(0, 0, (i - (SEAM.count - 1) / 2) * SEAM.spacing);
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
      pillowMaterial.color.setHex(color).lerp(WHITE, puffStyle.tint);
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
