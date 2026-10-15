// =============================================================================
// UPGRADE PARTS: what store attachments and Extended Warranty tiers LOOK like on a gun.
// Small cartoon parts (config/upgrades.js ids), sized for a pistol and scaled by each gun's mount.
//
// Every gun model lists `mounts` (gun-local spots; see models/index.js):
//   barrel    the muzzle: Extended Nozzle (a tube that moves the muzzle/flash forward), Sawn-Off (taped band)
//   top       on top, off to the left so it never blocks the sights: Zoom Lens
//   side      the right side, toward the front: Laser Pointer (+ a faint red beam)
//   grip      the handle (centre + angle): Grip Tape
//   magazine  where more ammo would go: Jumbo Pack (a big bright box), Speed Loader (a pull tab)
//   sticker   the left side you see at the hip: the tier sticker (hidden at Standard)
// The wristband goes on the right forearm (the same spot on every gun: arms.js).
// A mount: { position: [x, y, z], rotation?: [x, y, z] (radians), scale?: n, size?: { w, h, d } (what it wraps),
//            radius? (nozzle), twin?: half-spacing for double barrels, parent?: Object3D that moves (cannon barrels) }
//
//   buildAttachmentPart(id)       just the part (also the shop displays use it, scaled up)
//   createUpgradeVisuals(model)   builds every part up front (hidden), returns
//                                 { show({ tier, attachments }) } to switch them on/off per frame
// =============================================================================

import * as THREE from 'three';
import { upgrades } from '../../config/upgrades.js';

// Colors in the shops' brand colors, so a part reads as "from that store".
const C = {
  steel: 0x9aa3ad, dark: 0x262a30, tape: 0x8d939a, hazard: 0xffd23f, red: 0xff2a2a,
  lens: 0x9fe3ff, tapeLight: 0xf1faee, sportsOrange: 0xff8a3d, toyYellow: 0xffc83d, toyRed: 0xe63946, green: 0x5fd068,
};

const materials = new Map();
function mat(color, basic = false) {
  const key = `${color}|${basic}`;
  if (!materials.has(key)) {
    materials.set(key, basic
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.15, flatShading: true }));
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
function tube(group, radius, length, x, y, z0, color, basic) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), mat(color, basic));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z0 - length / 2);
  group.add(mesh);
  return mesh;
}

export const NOZZLE_LENGTH = 0.06; // how far the Extended Nozzle moves the muzzle forward (at scale 1)

// Each builder: (mount) -> Group in mount space (origin = the mount, -Z = forward).
const PARTS = {
  extendedNozzle(m) {
    const g = new THREE.Group();
    const r = m.radius ?? 0.017;
    for (const x of m.twin ? [-m.twin, m.twin] : [0]) {
      tube(g, r, NOZZLE_LENGTH, x, 0, 0, C.steel);
      tube(g, r + 0.002, 0.01, x, 0, -NOZZLE_LENGTH + 0.01, C.hazard); // a bright band at the tip
      tube(g, r * 0.65, 0.002, x, 0, -NOZZLE_LENGTH - 0.0005, C.dark, true); // dark opening
    }
    return g;
  },
  sawnOff(m) {
    const g = new THREE.Group();
    const w = (m.size?.w ?? 0.05) + 0.008;
    const h = (m.size?.h ?? 0.045) + 0.008;
    box(g, w, h, 0.018, 0, 0, 0.016, C.tape); // duct tape round the cut end
    box(g, w + 0.002, 0.006, 0.006, 0, h / 2 - 0.004, 0.006, C.red); // a red "cut here" line
    return g;
  },
  laserPointer() {
    const g = new THREE.Group();
    box(g, 0.016, 0.016, 0.05, 0, 0, 0, C.dark);
    box(g, 0.01, 0.01, 0.003, 0, 0, -0.026, C.red, true); // the glowing lens
    const beam = box(g, 0.0025, 0.0025, 0.7, 0, 0, -0.38, C.red, true);
    beam.material = new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0.35, depthWrite: false });
    beam.name = 'laserBeam';
    return g;
  },
  zoomLens() {
    const g = new THREE.Group();
    tube(g, 0.013, 0.07, 0, 0.014, 0.035, C.dark);
    tube(g, 0.0115, 0.002, 0, 0.014, -0.0352, C.lens, true); // front glass
    tube(g, 0.0115, 0.002, 0, 0.014, 0.0362, C.lens, true); // back glass
    box(g, 0.008, 0.012, 0.008, 0, 0.003, 0.02, C.dark); // two little legs
    box(g, 0.008, 0.012, 0.008, 0, 0.003, -0.02, C.dark);
    return g;
  },
  gripTape() {
    // Athletic tape wound round the hand AND the grip (the hand hides the handle itself), white with dark edges.
    const g = new THREE.Group();
    for (const y of [-0.032, 0.002]) {
      box(g, 0.072, 0.016, 0.086, 0.004, y, 0.006, C.tapeLight);
      box(g, 0.073, 0.003, 0.087, 0.004, y + 0.008, 0.006, C.dark);
    }
    return g;
  },
  wristband() {
    const g = new THREE.Group();
    box(g, 0.088, 0.034, 0.084, 0, 0, 0, C.sportsOrange); // (the forearm is ~0.08 thick: this sits proud of it)
    box(g, 0.09, 0.008, 0.086, 0, 0, 0, C.tapeLight); // white stripe
    return g;
  },
  jumboPack() {
    const g = new THREE.Group();
    box(g, 0.034, 0.055, 0.075, 0, -0.0275, 0, C.toyYellow);
    box(g, 0.036, 0.012, 0.077, 0, -0.04, 0, C.toyRed); // "XL" band
    return g;
  },
  speedLoader() {
    const g = new THREE.Group();
    box(g, 0.03, 0.012, 0.03, 0, -0.006, 0, C.green);
    box(g, 0.006, 0.026, 0.006, 0, -0.024, 0.008, C.green); // the pull tab
    box(g, 0.018, 0.006, 0.006, 0, -0.037, 0.008, C.green);
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
  const parts = {};
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
    if (mount) parts[id] = place(buildAttachmentPart(id, mount), mount);
  }

  // Tier sticker: a colored square on a white backing. One sticker, recolored per tier.
  let sticker = null;
  if (mounts.sticker) {
    const s = new THREE.Group();
    box(s, 0.0015, 0.03, 0.036, 0, 0, 0, C.tapeLight, true);
    const face = box(s, 0.002, 0.024, 0.03, -0.0005, 0, 0, upgrades.tiers[0].color, true);
    face.material = new THREE.MeshBasicMaterial({ color: upgrades.tiers[0].color });
    sticker = { holder: place(s, mounts.sticker), face };
  }

  // The Extended Nozzle carries the muzzle (and its flash) forward to its tip.
  const muzzleHome = model.muzzle.position.clone();
  const nozzleScale = mounts.barrel?.scale ?? 1;
  const nozzleMovesMuzzle = (mounts.barrel?.parent ?? gun) === model.muzzle.parent;
  let shownKey = null;

  return {
    parts,
    show({ tier = 'standard', attachments = {} } = {}) {
      const key = `${tier}|${Object.values(attachments).join(',')}`;
      if (key === shownKey) return;
      shownKey = key;
      const fitted = new Set(Object.values(attachments));
      for (const [id, holder] of Object.entries(parts)) holder.visible = fitted.has(id);
      model.muzzle.position.copy(muzzleHome);
      if (parts.extendedNozzle?.visible && nozzleMovesMuzzle) model.muzzle.position.z -= NOZZLE_LENGTH * nozzleScale;
      if (sticker) {
        const t = upgrades.tiers.find((x) => x.id === tier);
        sticker.holder.visible = !!t && t.id !== 'standard';
        if (t) sticker.face.material.color.setHex(t.color);
      }
    },
  };
}
