// =============================================================================
// UPGRADE PARTS: what store attachments and Extended Warranty tiers LOOK like on a gun.
// Small faceted parts (config/upgrades.js ids), sized for a pistol and scaled by each gun's mount.
//
// Every gun model lists `mounts` (gun-local spots; see models/index.js):
//   barrel    the muzzle: Extended Nozzle (a tube that moves the muzzle/flash forward), Sawn-Off (taped band)
//   top       on top, off to the left so it never blocks the sights: Zoom Lens
//   side      the right side, toward the front: Laser Pointer (+ a faint red beam)
//   grip      the handle (centre + angle): Grip Tape
//   magazine  where more ammo would go: Jumbo Pack (weapon-suited reservoir/drum/box), Speed Loader (latch + pull loop)
//   sticker   the left side you see at the hip: the branded Extended Warranty service seal (hidden at Standard)
// The wristband goes on the right forearm (the same spot on every gun: arms.js).
// A mount: { position: [x, y, z], rotation?: [x, y, z] (radians), scale?: n, size?: { w, h, d } (what it wraps),
//            radius? (nozzle), twin?: half-spacing for double barrels, parent?: Object3D that moves (cannon barrels),
//            gunId?: string (optional weapon id for tailored magazine attachments) }
//
//   buildAttachmentPart(id, mount)  just the part (also the shop displays use it, scaled up)
//   createUpgradeVisuals(model)     builds every part up front (hidden), returns
//                                   { show({ tier, attachments }) } to switch them on/off per frame
// =============================================================================

import * as THREE from 'three';
import { workshopBuilds } from '../../config/workshop.js';
import { upgrades } from '../../config/upgrades.js';
import { attachmentVisuals } from '../../config/attachmentVisuals.js';
import { prepareShortBarrel } from './shortBarrel.js';

// Colors in the shops' brand colors, so a part reads as "from that store".
const C = {
  steel: 0x9aa3ad,
  chrome: 0xd4dce4,
  dark: 0x262a30,
  charcoal: 0x383e47,
  tape: 0x8d939a,
  hazard: 0xffd23f,
  brass: 0xd9a441,
  red: 0xff2a2a,
  lens: 0x9fe3ff,
  tapeLight: 0xf1faee,
  sportsOrange: 0xff8a3d,
  toyYellow: 0xffb800,
  toyRed: 0xe63946,
  toyBlue: 0x2563eb,
  green: 0x5fd068,
  greenDark: 0x2b8a3e,
  copper: 0xc87d4b,
  pink: 0xff5ea8,
};

const materials = new Map();
function mat(color, basic = false) {
  const key = `${color}|${basic}`;
  if (!materials.has(key)) {
    materials.set(key, basic
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, flatShading: true }));
  }
  return materials.get(key);
}

function box(group, w, h, d, x, y, z, color, basic) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, basic));
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

// A tube along -Z starting at z0 (toward the front).
function tube(group, radius, length, x, y, z0, color, basic, segs = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segs), mat(color, basic));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z0 - length / 2);
  group.add(mesh);
  return mesh;
}

// A vertical cylinder along Y centered at (x, y, z).
function cylY(group, radiusTop, radiusBottom, height, x, y, z, color, basic, segs = 10) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segs),
    mat(color, basic),
  );
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

let warrantySealTex = null;
function getWarrantySealTexture() {
  if (warrantySealTex) return warrantySealTex;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d');
  // Bright neutral base so face.material.color tints the seal cleanly per tier
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 128, 96);
  // Dark outer & inner certificate border
  ctx.strokeStyle = '#1f242b';
  ctx.lineWidth = 6;
  ctx.strokeRect(5, 5, 118, 86);
  ctx.lineWidth = 2;
  ctx.strokeRect(11, 11, 106, 74);
  // Header ribbon bar
  ctx.fillStyle = '#1f242b';
  ctx.fillRect(14, 15, 100, 20);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WARRANTY', 64, 30);
  // Center seal text
  ctx.fillStyle = '#1f242b';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('★ CERTIFIED ★', 64, 54);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('SERVICE SEAL', 64, 72);
  warrantySealTex = new THREE.CanvasTexture(c);
  warrantySealTex.colorSpace = THREE.SRGBColorSpace;
  return warrantySealTex;
}

export const NOZZLE_LENGTH = 0.095; // visible extension; also moves the tracer/flash origin

function buildJumboPackForGun(g, gunId) {
  if (gunId === 'priceGun') {
    // Auxiliary twin label-roll feeder cassette mounted under the frame
    box(g, 0.036, 0.012, 0.052, 0, -0.005, 0, C.dark); // top mounting bracket
    box(g, 0.04, 0.046, 0.068, 0, -0.03, 0, C.toyYellow); // yellow cassette housing
    box(g, 0.042, 0.011, 0.07, 0, -0.042, 0, C.toyRed); // red retail stripe
    // Exposed jumbo secondary sticker roll inside the side cradle
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.044, 12), mat(C.tapeLight));
    roll.rotation.z = Math.PI / 2;
    roll.position.set(0, -0.028, -0.004);
    g.add(roll);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.046, 10), mat(C.brass));
    core.rotation.z = Math.PI / 2;
    core.position.set(0, -0.028, -0.004);
    g.add(core);
    return;
  }

  if (gunId === 'stapleGun') {
    // Heavy-duty twin-channel staple reservoir box under the staple channel
    box(g, 0.034, 0.01, 0.072, 0, -0.004, 0, C.chrome); // chrome rail clamp
    box(g, 0.04, 0.042, 0.08, 0, -0.026, 0, C.toyYellow); // reservoir body
    box(g, 0.042, 0.01, 0.082, 0, -0.036, 0, C.toyRed); // "XL" band
    // Twin visible brass/steel staple stack strips on the sides
    box(g, 0.043, 0.012, 0.058, 0, -0.02, 0, C.brass);
    return;
  }

  if (gunId === 'nailGun') {
    // Extended dual-track stick-nail magazine pack with visible collated nail row
    box(g, 0.034, 0.012, 0.064, 0, -0.005, 0, C.dark); // rail clamp collar
    box(g, 0.036, 0.05, 0.076, 0, -0.03, 0, C.toyYellow); // yellow magazine booster
    box(g, 0.038, 0.011, 0.078, 0, -0.042, 0, C.toyRed); // red warning band
    box(g, 0.04, 0.018, 0.058, 0, -0.024, 0, C.brass); // exposed collated brass nail rack
    return;
  }

  if (gunId === 'foamDartBlaster') {
    // Oversized toy auxiliary dart drum / side-pod with visible orange dart tips
    box(g, 0.034, 0.012, 0.056, 0, -0.005, 0, C.toyBlue); // blue clamp adapter
    box(g, 0.044, 0.05, 0.074, 0, -0.03, 0, C.toyYellow); // yellow drum box
    box(g, 0.046, 0.012, 0.076, 0, -0.042, 0, C.toyRed); // red "PLAY TIME XL" band
    for (const x of [-0.011, 0.011]) {
      tube(g, 0.006, 0.012, x, -0.026, -0.036, C.sportsOrange); // foam dart tips peeking out
    }
    return;
  }

  if (gunId === 'coilNailer') {
    // Deep high-capacity auxiliary wire-coil canister beneath the drum
    cylY(g, 0.03, 0.032, 0.012, 0, -0.005, 0, C.dark);
    cylY(g, 0.034, 0.032, 0.044, 0, -0.028, 0, C.toyYellow, false, 12);
    cylY(g, 0.035, 0.035, 0.012, 0, -0.028, 0, C.copper, false, 12); // visible copper nail coil band
    cylY(g, 0.0355, 0.0355, 0.009, 0, -0.042, 0, C.toyRed, false, 12);
    return;
  }

  if (gunId === 'barcodeScanner') {
    // High-capacity twin-cell Li-Ion battery expansion pack
    box(g, 0.036, 0.01, 0.056, 0, -0.004, 0, C.dark);
    box(g, 0.04, 0.044, 0.068, 0, -0.028, 0, C.toyYellow);
    box(g, 0.042, 0.01, 0.07, 0, -0.038, 0, C.toyRed);
    for (const x of [-0.012, 0.012]) {
      tube(g, 0.008, 0.064, x, -0.026, 0.032, C.charcoal); // twin cylindrical cells
    }
    return;
  }

  if (gunId === 'confettiCannon') {
    // Side-saddle twin party shell carrier
    box(g, 0.034, 0.01, 0.066, 0, -0.004, 0, C.dark); // mounting plate
    box(g, 0.038, 0.038, 0.072, 0, -0.024, 0, C.toyYellow); // yellow shell clip
    for (const z of [-0.016, 0.016]) {
      cylY(g, 0.011, 0.011, 0.048, 0, -0.028, z, C.pink, false, 10);
      cylY(g, 0.012, 0.012, 0.01, 0, -0.008, z, C.brass, false, 10);
    }
    return;
  }

  // Default / Rivet Rifle / shop display: molded high-capacity "XL" box magazine extension
  box(g, 0.032, 0.012, 0.068, 0, -0.005, 0, C.dark); // top feed-lip adapter collar
  box(g, 0.036, 0.052, 0.075, 0, -0.03, 0, C.toyYellow); // main yellow reservoir body
  box(g, 0.038, 0.012, 0.077, 0, -0.041, 0, C.toyRed); // red "XL" band
  box(g, 0.039, 0.008, 0.042, 0, -0.022, 0, C.brass); // side ammo-window strip
  box(g, 0.038, 0.006, 0.079, 0, -0.054, 0, C.dark); // reinforced rubberized baseplate
}

// Each builder: (mount) -> Group in mount space (origin = the mount, -Z = forward).
const PARTS = {
  extendedNozzle(m) {
    const g = new THREE.Group();
    const r = m.radius ?? 0.017;
    for (const x of m.twin ? [-m.twin, m.twin] : [0]) {
      // Stepped clamp adapter collar at the base with top/bottom clamping lug
      tube(g, r + 0.0032, 0.014, x, 0, 0.003, C.dark);
      box(g, r * 0.9, r * 2.35, 0.01, x, 0, -0.002, C.charcoal);
      // Main machined steel barrel extension
      tube(g, r, NOZZLE_LENGTH, x, 0, 0, C.steel);
      // Mid-barrel knurled cooling ring
      tube(g, r + 0.0016, 0.008, x, 0, -NOZZLE_LENGTH * 0.5, C.chrome);
      // High-visibility hazard band near the muzzle tip
      tube(g, r + 0.0022, 0.011, x, 0, -NOZZLE_LENGTH + 0.011, C.hazard);
      // Recessed dark bore opening
      tube(g, r * 0.65, 0.002, x, 0, -NOZZLE_LENGTH - 0.0005, C.dark, true);
    }
    return g;
  },
  sawnOff(m) {
    const g = new THREE.Group();
    const w = (m.size?.w ?? 0.05) + 0.008;
    const h = (m.size?.h ?? 0.045) + 0.008;
    // An open clamp surrounds the cut muzzle; the bore stays visibly open.
    for (const y of [-h / 2, h / 2]) box(g, w, .005, .02, 0, y, .013, C.tape);
    for (const x of [-w / 2, w / 2]) box(g, .005, h, .02, x, 0, .013, C.steel);
    const r = m.radius ?? .017;
    for (const x of m.twin ? [-m.twin, m.twin] : [0]) {
      tube(g, r + .002, .012, x, 0, .008, C.chrome);
      tube(g, r * .72, .002, x, 0, -.0045, C.dark, true);
    }
    box(g, w, .005, .006, 0, h / 2, .004, C.red);
    box(g, .009, .01, .008, w * .45, h * .38, .024, C.brass);
    return g;
  },
  laserPointer() {
    const g = new THREE.Group();
    // Side rail clamp bracket extending inward (-X) to grip the receiver flank
    box(g, 0.014, 0.012, 0.032, -0.007, 0, 0.004, C.charcoal);
    box(g, 0.02, 0.005, 0.026, -0.004, 0.007, 0.004, C.steel);
    // Knurled brass locking thumbscrew on the outer side (+X)
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.005, 8), mat(C.brass));
    screw.rotation.z = Math.PI / 2;
    screw.position.set(0.01, 0, 0.006);
    g.add(screw);
    // Faceted dark anodized laser module housing + red accent collar
    box(g, 0.016, 0.016, 0.052, 0, 0, 0, C.dark);
    box(g, 0.0172, 0.0172, 0.006, 0, 0, -0.016, C.red);
    box(g, 0.013, 0.013, 0.004, 0, 0, -0.027, C.steel); // aperture bezel
    box(g, 0.009, 0.009, 0.003, 0, 0, -0.0285, C.red, true); // glowing emitter lens
    const beam = box(g, 0.0025, 0.0025, 0.7, 0, 0, -0.38, C.red, true);
    beam.material = new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0.16, depthWrite: false });
    beam.name = 'laserBeam';
    return g;
  },
  zoomLens() {
    const g = new THREE.Group();
    // Dovetail rail mounting base sitting directly on the receiver top (y = 0..0.005)
    box(g, 0.016, 0.005, 0.054, 0, 0.0025, 0, C.charcoal);
    // Two split scope rings clamping the tube, with brass locking nuts
    for (const z of [-0.018, 0.018]) {
      box(g, 0.012, 0.014, 0.009, 0, 0.006, z, C.dark);
      tube(g, 0.0142, 0.009, 0, 0.015, z + 0.0045, C.charcoal);
      box(g, 0.004, 0.005, 0.006, 0.009, 0.004, z, C.brass);
    }
    // Main optic tube + flared objective (front) and ocular (rear) bells
    tube(g, 0.0115, 0.072, 0, 0.015, 0.036, C.dark);
    tube(g, 0.0145, 0.018, 0, 0.015, -0.02, C.dark); // front objective bell
    tube(g, 0.0135, 0.014, 0, 0.015, 0.037, C.dark); // rear ocular bell
    // Top elevation & side windage adjustment turret caps
    cylY(g, 0.0045, 0.0045, 0.006, 0, 0.028, 0, C.steel);
    box(g, 0.006, 0.007, 0.007, 0.013, 0.015, 0, C.steel);
    // Cyan anti-reflective glass lenses at front and back
    tube(g, 0.0125, 0.002, 0, 0.015, -0.0372, C.lens, true);
    tube(g, 0.0115, 0.002, 0, 0.015, 0.0375, C.lens, true);
    return g;
  },
  gripTape() {
    // Athletic tape wound round the hand AND the grip, with overlapped cross-wraps and a frayed tail tab.
    const g = new THREE.Group();
    for (const y of [-0.032, 0.002]) {
      box(g, 0.072, 0.016, 0.086, 0.004, y, 0.006, C.tapeLight);
      box(g, 0.073, 0.003, 0.087, 0.004, y + 0.008, 0.006, C.dark);
      box(g, 0.073, 0.0025, 0.087, 0.004, y - 0.008, 0.006, C.tape);
    }
    // Diagonal cross-wrap strip across the backstrap/palm
    const cross = box(g, 0.0735, 0.01, 0.087, 0.004, -0.015, 0.006, C.tapeLight);
    cross.rotation.z = 0.18;
    // Small loose tape tail tab at the lower rear edge
    const tail = box(g, 0.014, 0.014, 0.004, 0.018, -0.044, 0.048, C.tapeLight);
    tail.rotation.x = 0.25;
    box(g, .004, .032, .045, -.034, -.015, .008, C.sportsOrange);
    return g;
  },
  wristband() {
    const g = new THREE.Group();
    // Ribbed terrycloth sweatband sitting proud of the forearm
    box(g, 0.088, 0.036, 0.084, 0, 0, 0, C.sportsOrange);
    box(g, 0.09, 0.005, 0.086, 0, 0.014, 0, C.toyRed); // upper ribbed trim
    box(g, 0.09, 0.005, 0.086, 0, -0.014, 0, C.toyRed); // lower ribbed trim
    box(g, 0.091, 0.008, 0.0865, 0, 0, 0, C.tapeLight); // center white athletic stripe
    // Stitched woven brand tag on the outer wrist
    box(g, 0.003, 0.012, 0.024, 0.045, 0, 0, C.dark);
    box(g, 0.0035, 0.008, 0.02, 0.0455, 0, 0, C.hazard);
    box(g, .004, .018, .03, -.045, 0, .006, C.tapeLight);
    box(g, .0045, .006, .02, -.046, 0, .006, C.sportsOrange);
    return g;
  },
  jumboPack(m = {}) {
    const g = new THREE.Group();
    buildJumboPackForGun(g, m.gunId);
    return g;
  },
  speedLoader(m = {}) {
    const g = new THREE.Group();
    // Quick-release baseplate collar + spring cam latch
    box(g, 0.032, 0.01, 0.034, 0, -0.005, 0, C.dark);
    box(g, 0.035, 0.008, 0.022, 0, -0.006, 0, C.greenDark);
    // Thumb release latch lever on the rear face
    const latch = box(g, 0.014, 0.014, 0.006, 0, -0.007, 0.019, C.steel);
    latch.rotation.x = -0.25;
    // Tactile ribbed finger pull loop (two vertical straps + ribbed bottom pull bar)
    box(g, 0.005, 0.024, 0.006, -0.008, -0.022, 0.006, C.green);
    box(g, 0.005, 0.024, 0.006, 0.008, -0.022, 0.006, C.green);
    box(g, 0.024, 0.007, 0.009, 0, -0.035, 0.006, C.green);
    box(g, 0.025, 0.003, 0.011, 0, -0.038, 0.006, C.greenDark); // grip ridge
    // The release/feed hardware matches the ammunition, rather than a universal extra magazine.
    if (m.gunId === 'confettiCannon') {
      for (const z of [-.018, .018]) cylY(g, .008, .008, .028, 0, -.026, z, C.brass);
    } else if (m.gunId === 'coilNailer') {
      cylY(g, .026, .026, .007, 0, -.014, 0, C.greenDark);
      box(g, .012, .018, .035, .023, -.02, 0, C.sportsOrange);
    } else if (m.gunId === 'barcodeScanner') {
      for (const x of [-.009, .009]) box(g, .006, .012, .025, x, -.015, -.012, C.brass);
      box(g, .025, .006, .008, 0, -.02, -.025, C.green, true);
    } else if (m.gunId === 'nailGun' || m.gunId === 'stapleGun') {
      box(g, .026, .006, .07, 0, -.015, -.02, C.chrome);
      box(g, .03, .012, .012, 0, -.02, -.048, C.brass);
    } else if (m.gunId === 'foamDartBlaster') {
      cylY(g, .02, .02, .012, 0, -.015, 0, C.toyBlue);
      box(g, .025, .012, .024, 0, -.027, -.018, C.sportsOrange);
    } else if (m.gunId === 'priceGun') {
      tube(g, .01, .035, 0, -.02, .01, C.tapeLight);
      box(g, .032, .008, .015, 0, -.012, -.02, C.sportsOrange);
    } else box(g, .035, .012, .05, 0, -.017, -.012, C.steel);
    return g;
  },
};

const MOUNT_OF = {
  extendedNozzle: 'barrel', sawnOff: 'barrel', laserPointer: 'side', zoomLens: 'top',
  gripTape: 'grip', wristband: 'wrist', jumboPack: 'magazine', speedLoader: 'magazine',
};

// Where the wristband goes: around the right forearm just behind the hand (arms.js buildPistolArms).
const WRIST = (() => {
  const a = new THREE.Vector3(0.01, -0.13, 0.05);
  const b = new THREE.Vector3(0.07, -0.38, 0.17);
  const position = a.clone().lerp(b, 0.1);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return { position, quaternion };
})();

/** Just the part (pistol-sized). `display`: for a shop display (no laser beam across the shop). */
export function buildAttachmentPart(id, mount = {}, { display = false } = {}) {
  if (!Object.hasOwn(PARTS, id)) throw new Error(`upgradeParts: no part for attachment "${id}"`);
  const part = PARTS[id](mount);
  if (display) part.getObjectByName('laserBeam')?.removeFromParent();
  return part;
}

/**
 * Adds every attachment part + the tier sticker to a gun model (all hidden) at its mounts.
 * model = { root, muzzle, mounts }. Returns { show({ tier, attachments }), parts } where attachments is
 * attachmentsOf() ({ barrel: 'sawnOff', ... }) and tier a tier id. Parts the gun has no mount for are skipped.
 */
export function createUpgradeVisuals(model, gun = model.root) {
  const mounts = model.mounts ?? {};
  const profile = attachmentVisuals.profiles[mounts.magazine?.gunId];
  const short = profile ? prepareShortBarrel(model, profile.span, attachmentVisuals.shortFactor) : null;
  const barrelParent = mounts.barrel?.parent ?? gun;
  if (model.muzzle.parent !== barrelParent) { gun.updateWorldMatrix(true, true); barrelParent.attach(model.muzzle); }
  const parts = {};
  const reloadParts = [];
  const place = (object, mount) => {
    const holder = new THREE.Group();
    holder.position.fromArray(mount.position);
    if (mount.rotation) holder.rotation.set(...mount.rotation);
    holder.scale.setScalar(mount.scale ?? 1);
    holder.add(object);
    (mount.parent ?? gun).add(holder);
    holder.visible = false;
    return holder;
  };
  for (const id of Object.keys(PARTS)) {
    if (id === 'wristband') {
      const holder = new THREE.Group();
      holder.position.copy(WRIST.position);
      holder.quaternion.copy(WRIST.quaternion);
      holder.add(PARTS.wristband());
      holder.visible = false;
      gun.add(holder);
      parts[id] = holder;
      continue;
    }
    const mount = mounts[MOUNT_OF[id]];
    if (mount) {
      const adjusted = { ...mount, position: [...mount.position] };
      const scale = profile ? (id === 'zoomLens' ? profile.optic : id === 'laserPointer' ? profile.laser : ['jumboPack', 'speedLoader'].includes(id) ? profile.pack : 1) : 1;
      adjusted.scale = (mount.scale ?? 1) * scale;
      if (id === 'zoomLens' && profile?.opticX) adjusted.position[0] = profile.opticX;
      if (id === 'laserPointer') adjusted.position[0] = profile?.laserX ?? -mount.position[0]; // visible near-side rail
      const part = buildAttachmentPart(id, mount);
      if (id === 'zoomLens' && profile?.opticX) {
        const reach = (mount.position[0] - adjusted.position[0]) / adjusted.scale;
        box(part, Math.abs(reach) + .016, .008, .04, reach / 2, .002, 0, C.charcoal);
      }
      const holder = place(part, adjusted);
      if (id === 'laserPointer') holder.scale.x *= -1;
      parts[id] = holder;
      const held = profile?.held && gun.getObjectByName(profile.held);
      if (held && ['jumboPack', 'speedLoader'].includes(id)) {
        const copy = holder.clone(); held.add(copy); copy.position.fromArray(mount.position);
        reloadParts.push({ id, copy });
      }
    }
  }

  // Branded Extended Warranty service seal: foil seal backing + tier-colored certificate face.
  // Keep `s.children.length === 2` (backing + face) so existing model inspection checks match.
  let sticker = null;
  if (mounts.sticker) {
    const s = new THREE.Group();
    const backing = box(s, 0.0016, 0.032, 0.04, 0, 0, 0, C.brass);
    // Attach serrated seal points + ribbon tails as children of `backing`
    const rosette = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.028, 0.028), mat(C.tapeLight, true));
    rosette.rotation.x = Math.PI / 4;
    backing.add(rosette);
    for (const z of [-0.007, 0.007]) {
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.01, 0.006), mat(C.toyRed, true));
      ribbon.position.set(0.0001, -0.018, z);
      ribbon.rotation.x = z < 0 ? 0.22 : -0.22;
      backing.add(ribbon);
    }

    const sealTex = getWarrantySealTexture();
    const face = box(s, 0.002, 0.025, 0.033, -0.0006, 0, 0, upgrades.tiers[0].color, true);
    face.material = new THREE.MeshBasicMaterial({
      color: upgrades.tiers[0].color,
      ...(sealTex ? { map: sealTex } : {}),
    });
    sticker = { holder: place(s, mounts.sticker), face };
  }

  const buildPart = mounts.workshop && new THREE.Group();
  if (buildPart) {
    const { id } = mounts.workshop;
    box(buildPart, .012, .021, .048, 0, 0, 0, C.brass);
    box(buildPart, .008, .013, .032, -.007, 0, 0, workshopBuilds[id].color, true);
    place(buildPart, mounts.workshop).visible = true;
    buildPart.visible = false;
  }

  // The Extended Nozzle carries the muzzle (and its flash) forward to its tip.
  const muzzleHome = model.muzzle.position.clone();
  const nozzleScale = mounts.barrel?.scale ?? 1;
  const nozzleMovesMuzzle = (mounts.barrel?.parent ?? gun) === model.muzzle.parent;
  let shownKey = null;

  return {
    parts,
    show({ tier = 'standard', attachments = {}, workshop } = {}) {
      const key = `${tier}|${Object.values(attachments).join(',')}|${workshop ?? ''}`;
      if (key === shownKey) return;
      shownKey = key;
      if (buildPart) buildPart.visible = workshop === mounts.workshop.id;
      const fitted = new Set(Object.values(attachments));
      for (const [id, holder] of Object.entries(parts)) holder.visible = fitted.has(id);
      for (const { id, copy } of reloadParts) copy.visible = fitted.has(id);
      short?.show(fitted.has('sawnOff'));
      if (parts.sawnOff) parts.sawnOff.position.z = mounts.barrel.position[2] + (fitted.has('sawnOff') ? short?.shift ?? 0 : 0);
      model.muzzle.position.copy(muzzleHome);
      if (fitted.has('sawnOff')) model.muzzle.position.z += short?.shift ?? 0;
      if (parts.extendedNozzle?.visible && nozzleMovesMuzzle) model.muzzle.position.z -= NOZZLE_LENGTH * nozzleScale;
      if (sticker) {
        const t = upgrades.tiers.find((x) => x.id === tier);
        sticker.holder.visible = !!t && t.id !== 'standard';
        if (t) sticker.face.material.color.setHex(t.color);
      }
    },
  };
}
