// Reusable low-poly incentive models, shared across every pickup & view instance (userData.shared).
// No dynamic lights or colliders; additive beacons (fx/beacon.js) make pickups read over crowds and in dark back halls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBeacon } from './beacon.js';
import { powerUps as config } from '../config/powerUps.js';
import { bossVouchers } from '../config/bosses.js';
import { rampHeightAt } from '../world/collision.js';

const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();
const _pos = new THREE.Vector3();
const _scale = new THREE.Vector3();
const _mat = new THREE.Matrix4();

function markShared(resource) {
  resource.userData.shared = true;
  return resource;
}

function addPart(buckets, key, prim, size, pos = [0, 0, 0], rot = [0, 0, 0]) {
  const geo = prim.clone();
  _pos.set(...pos);
  _euler.set(...rot);
  _quat.setFromEuler(_euler);
  _scale.set(...size);
  _mat.compose(_pos, _quat, _scale);
  geo.applyMatrix4(_mat);
  const clean = geo.index ? geo.toNonIndexed() : geo;
  if (clean !== geo) geo.dispose();
  if (clean.attributes.uv) clean.deleteAttribute('uv');
  buckets[key].push(clean);
}

const _tiltQ = new THREE.Quaternion();
const _tiltPos = new THREE.Vector3();
const _partQ = new THREE.Quaternion();
const _partEuler = new THREE.Euler();

function addTilted(buckets, key, prim, size, pos, rot, tiltZ) {
  _tiltQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), tiltZ);
  _tiltPos.set(...pos).applyQuaternion(_tiltQ);
  _partEuler.set(...(rot ?? [0, 0, 0]));
  _partQ.setFromEuler(_partEuler);
  _partQ.premultiply(_tiltQ);
  _euler.setFromQuaternion(_partQ);
  addPart(buckets, key, prim, size, [_tiltPos.x, _tiltPos.y, _tiltPos.z], [_euler.x, _euler.y, _euler.z]);
}

// Per-type low-poly silhouettes matching the HUD icons (ui/incentiveHud.js) and readable from any angle at 10-15 m.
function populateModel(id, def, prims, b, v) {
  const isJackpot = def.tier === 'jackpot';
  const ringPrim = isJackpot ? prims.jackpotRing : prims.commonRing;

  if (id === 'stockroomDelivery') {
    // Staggered stack of shipping cartons on pallet runners + tape straps + shipping labels.
    addPart(b, 'cardboard', prims.box, [0.56, 0.30, 0.44], [0, -0.06, 0]);
    addPart(b, 'cardboard', prims.box, [0.38, 0.22, 0.34], [0.05, 0.20, -0.02], [0, 0.28, 0]);
    for (const z of [-0.15, 0.15]) addPart(b, 'dark', prims.box, [0.56, 0.05, 0.08], [0, -0.235, z]);
    addPart(b, 'accent', prims.box, [0.10, 0.315, 0.455], [0, -0.06, 0]);
    addPart(b, 'accent', prims.box, [0.08, 0.232, 0.355], [0.05, 0.20, -0.02], [0, 0.28, 0]);
    for (const side of [-1, 1]) {
      addPart(b, 'cream', prims.box, [0.24, 0.14, 0.02], [side * 0.11, -0.04, side * 0.226]);
      addPart(b, 'dark', prims.box, [0.15, 0.03, 0.025], [side * 0.11, -0.05, side * 0.236]);
    }
  } else if (id === 'paidBreak') {
    // First-aid medical briefcase: cream chest, dark carry handle & clasps, glowing '+' cross on front & back.
    addPart(b, 'cream', prims.box, [0.56, 0.38, 0.20], [0, -0.02, 0]);
    addPart(b, 'dark', prims.box, [0.58, 0.05, 0.22], [0, 0.04, 0]);
    addPart(b, 'dark', prims.box, [0.24, 0.06, 0.07], [0, 0.24, 0]);
    for (const x of [-0.10, 0.10]) {
      addPart(b, 'dark', prims.box, [0.06, 0.10, 0.07], [x, 0.19, 0]);
      addPart(b, 'dark', prims.box, [0.06, 0.08, 0.23], [x * 1.7, 0.10, 0]);
    }
    addPart(b, 'accent', prims.box, [0.11, 0.27, 0.24], [0, -0.02, 0]);
    addPart(b, 'accent', prims.box, [0.27, 0.11, 0.24], [0, -0.02, 0]);
  } else if (id === 'shiftBonus') {
    // Winged punch-clock stopwatch: luminous bezel, dual cream faces, dark hands, crown & twin speed wings.
    addPart(b, 'accent', prims.cylinder, [0.44, 0.13, 0.44], [0, 0, 0], [Math.PI / 2, 0, 0]);
    addPart(b, 'cream', prims.cylinder, [0.33, 0.15, 0.33], [0, 0, 0], [Math.PI / 2, 0, 0]);
    addPart(b, 'dark', prims.box, [0.04, 0.13, 0.18], [0, 0.055, 0]);
    addPart(b, 'dark', prims.box, [0.11, 0.04, 0.18], [0.045, 0, 0]);
    addPart(b, 'dark', prims.cylinder, [0.07, 0.09, 0.07], [0, 0.25, 0]);
    addPart(b, 'dark', prims.box, [0.14, 0.05, 0.09], [0, 0.30, 0]);
    for (const side of [-1, 1]) {
      addPart(b, 'accent', prims.box, [0.24, 0.08, 0.07], [side * 0.27, 0.03, 0], [0, 0, side * 0.38]);
      addPart(b, 'accent', prims.box, [0.17, 0.06, 0.06], [side * 0.24, -0.06, 0], [0, 0, side * 0.24]);
    }
  } else if (id === 'lossPrevention') {
    // Heavy security shield badge with inner crest, security cross, and diagonal nightstick baton.
    addPart(b, 'accent', prims.box, [0.46, 0.30, 0.12], [0, 0.10, 0]);
    addPart(b, 'accent', prims.box, [0.32, 0.32, 0.12], [0, -0.05, 0], [0, 0, Math.PI / 4]);
    addPart(b, 'accent', prims.box, [0.48, 0.07, 0.14], [0, 0.26, 0]);
    addPart(b, 'cream', prims.box, [0.33, 0.24, 0.15], [0, 0.08, 0]);
    addPart(b, 'cream', prims.box, [0.22, 0.22, 0.15], [0, -0.04, 0], [0, 0, Math.PI / 4]);
    addPart(b, 'dark', prims.box, [0.07, 0.27, 0.18], [0, 0.05, 0]);
    addPart(b, 'dark', prims.box, [0.24, 0.07, 0.18], [0, 0.09, 0]);
    addPart(b, 'dark', prims.cylinder, [0.08, 0.56, 0.08], [0.17, -0.02, 0.02], [0, 0, -0.46]);
    addPart(b, 'dark', prims.cylinder, [0.11, 0.06, 0.11], [0.28, -0.24, 0.02], [0, 0, -0.46]);
  } else if (id === 'inventoryLiquidation') {
    // Tapered trapezoid shopping bag with twin loop handles, flying merch cubes & top starburst spikes.
    addPart(b, 'accent', prims.bag, [0.64, 0.40, 0.38], [0, -0.05, 0]);
    addPart(b, 'cream', prims.box, [0.48, 0.07, 0.28], [0, 0.15, 0]);
    for (const z of [-0.09, 0.09]) {
      for (const x of [-0.11, 0.11]) addPart(b, 'dark', prims.box, [0.04, 0.14, 0.04], [x, 0.24, z]);
      addPart(b, 'dark', prims.box, [0.26, 0.04, 0.04], [0, 0.31, z]);
    }
    addPart(b, 'cream', prims.box, [0.13, 0.13, 0.13], [-0.10, 0.22, 0.03], [0.3, 0.5, 0.2]);
    addPart(b, 'cream', prims.box, [0.12, 0.12, 0.12], [0.11, 0.21, -0.03], [-0.3, 0.4, -0.25]);
    addPart(b, 'accent', prims.oct, [0.22, 0.24, 0.22], [0, 0.28, 0]);
    for (const rotZ of [-0.55, 0.55]) addPart(b, 'accent', prims.oct, [0.09, 0.24, 0.09], [rotZ * 0.24, 0.30, 0], [0, 0, rotZ]);
  } else if (id === 'employeeDiscount') {
    // Tilted retail hang-tag with punched eyelet grommet, wire hook & double-sided '%' price emblem.
    const tiltZ = -0.28;
    addTilted(b, 'accent', prims.box, [0.40, 0.44, 0.10], [0, -0.02, 0], null, tiltZ);
    addTilted(b, 'accent', prims.bag, [0.565, 0.14, 0.14], [0, 0.27, 0], [0, 0, Math.PI], tiltZ);
    addTilted(b, 'cream', prims.box, [0.30, 0.36, 0.12], [0, -0.02, 0], null, tiltZ);
    addTilted(b, 'cream', prims.torus, [0.10, 0.10, 0.08], [0, 0.24, 0], null, tiltZ);
    addTilted(b, 'dark', prims.box, [0.04, 0.14, 0.04], [0, 0.36, 0], null, tiltZ);
    addTilted(b, 'dark', prims.box, [0.055, 0.28, 0.16], [0, -0.02, 0], [0, 0, -0.58], tiltZ);
    addTilted(b, 'dark', prims.oct, [0.095, 0.095, 0.16], [-0.08, 0.06, 0], null, tiltZ);
    addTilted(b, 'dark', prims.oct, [0.095, 0.095, 0.16], [0.08, -0.10, 0], null, tiltZ);
  } else if (id === 'mysteryShopper') {
    // Magnifying-loupe eye: luminous sclera lens inside almond eye rim, central dark iris & detective handle.
    addPart(b, 'accent', prims.torus, [0.46, 0.46, 0.34], [0, 0.05, 0]);
    for (const side of [-1, 1]) addPart(b, 'accent', prims.cone, [0.15, 0.18, 0.12], [side * 0.25, 0.05, 0], [0, 0, -side * Math.PI / 2]);
    addPart(b, 'cream', prims.cylinder, [0.34, 0.09, 0.34], [0, 0.05, 0], [Math.PI / 2, 0, 0]);
    addPart(b, 'dark', prims.oct, [0.17, 0.17, 0.16], [0, 0.05, 0]);
    addPart(b, 'dark', prims.cylinder, [0.085, 0.36, 0.085], [-0.21, -0.17, 0], [0, 0, 0.68]);
    addPart(b, 'cream', prims.cylinder, [0.10, 0.06, 0.10], [-0.30, -0.28, 0], [0, 0, 0.68]);
  } else if (id === 'spillCleanup') {
    // Janitor mop bucket with wringer hood, froth mop head, and tall diagonal mop handle.
    addPart(b, 'accent', prims.frustum, [0.48, 0.34, 0.42], [0, -0.07, 0]);
    addPart(b, 'accent', prims.cylinder, [0.54, 0.03, 0.54], [0, -0.25, 0]);
    addPart(b, 'cream', prims.box, [0.22, 0.16, 0.24], [-0.13, 0.13, 0]);
    addPart(b, 'cream', prims.oct, [0.21, 0.15, 0.21], [0.03, 0.10, 0]);
    addPart(b, 'dark', prims.cylinder, [0.055, 0.72, 0.055], [0.12, 0.22, 0], [0, 0, -0.44]);
    addPart(b, 'dark', prims.box, [0.46, 0.035, 0.035], [0, 0.06, 0.22]);
  } else if (id === 'storeWideClearance') {
    // Jackpot: heavyweight clearance nuke with gold trim bands, cream nose cone, and four wide tail fins.
    addPart(b, 'accent', prims.oct, [0.44, 0.54, 0.44], [0, 0.05, 0]);
    addPart(b, 'dark', prims.cylinder, [0.28, 0.30, 0.28], [0, -0.03, 0]);
    addPart(b, 'gold', prims.cylinder, [0.32, 0.07, 0.32], [0, 0.08, 0]);
    addPart(b, 'gold', prims.cylinder, [0.30, 0.06, 0.30], [0, -0.10, 0]);
    addPart(b, 'gold', prims.cone, [0.25, 0.27, 0.25], [0, 0.27, 0]);
    for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const fx = Math.sin(angle) * 0.17, fz = Math.cos(angle) * 0.17;
      addPart(b, 'dark', prims.box, [0.05, 0.22, 0.18], [fx, -0.18, fz], [0, angle, 0]);
      addPart(b, 'gold', prims.box, [0.06, 0.04, 0.19], [fx, -0.27, fz], [0, angle, 0]);
    }
  } else if (id === 'commissionDay') {
    // Jackpot: minted '$'' coin medallion framed by an 8-tooth gold bezel, crisp dark '$' bars, and orbiting diamonds.
    addPart(b, 'accent', prims.cylinder, [0.56, 0.13, 0.56], [0, 0.04, 0], [Math.PI / 2, 0, 0]);
    addPart(b, 'gold', prims.torus, [0.52, 0.52, 0.36], [0, 0.04, 0]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      addPart(b, 'gold', prims.box, [0.09, 0.10, 0.14], [Math.cos(a) * 0.28, 0.04 + Math.sin(a) * 0.28, 0], [0, 0, a]);
    }
    addPart(b, 'dark', prims.box, [0.055, 0.34, 0.18], [0, 0.04, 0]);
    addPart(b, 'dark', prims.box, [0.19, 0.045, 0.18], [0, 0.14, 0]);
    addPart(b, 'dark', prims.box, [0.19, 0.045, 0.18], [0, 0.04, 0]);
    addPart(b, 'dark', prims.box, [0.19, 0.045, 0.18], [0, -0.06, 0]);
    addPart(b, 'dark', prims.box, [0.045, 0.10, 0.18], [-0.072, 0.09, 0]);
    addPart(b, 'dark', prims.box, [0.045, 0.10, 0.18], [0.072, -0.01, 0]);
    for (const side of [-1, 1]) addPart(b, 'gold', prims.oct, [0.12, 0.17, 0.12], [side * 0.39, 0.07, 0]);
  } else if (id === 'blackFriday') {
    // Jackpot: crimson doorbuster tag armored with gold trim, crossed dark cleavers, and gold center burst.
    const tiltZ = 0.08;
    addTilted(b, 'accent', prims.box, [0.48, 0.56, 0.10], [0, 0.04, 0], null, tiltZ);
    addTilted(b, 'gold', prims.box, [0.52, 0.06, 0.12], [0, 0.31, 0], null, tiltZ);
    addTilted(b, 'gold', prims.box, [0.52, 0.06, 0.12], [0, -0.23, 0], null, tiltZ);
    addTilted(b, 'gold', prims.torus, [0.13, 0.13, 0.09], [0, 0.37, 0], null, tiltZ);
    for (const angle of [0.68, -0.68]) addPart(b, 'dark', prims.box, [0.10, 0.66, 0.15], [0, 0.03, 0], [0, 0, angle]);
    addPart(b, 'gold', prims.oct, [0.18, 0.18, 0.19], [0, 0.03, 0]);
  } else if (id === 'masterKey') {
    // Boss voucher: large security master key (ring bow, horizontal shaft, notched bitting teeth).
    addPart(b, 'accent', prims.torus, [0.28, 0.28, 0.26], [-0.16, 0.05, 0]);
    addPart(b, 'cream', prims.cylinder, [0.09, 0.42, 0.09], [0.11, 0.05, 0], [0, 0, Math.PI / 2]);
    addPart(b, 'dark', prims.box, [0.07, 0.14, 0.07], [0.22, -0.03, 0]);
    addPart(b, 'dark', prims.box, [0.06, 0.10, 0.07], [0.12, -0.01, 0]);
    addPart(b, 'dark', prims.cylinder, [0.11, 0.06, 0.11], [-0.02, 0.05, 0], [0, 0, Math.PI / 2]);
  } else if (id === 'signedApproval') {
    // Boss voucher: executive clipboard with top dark clip, glowing document, wax seal, and pen.
    addPart(b, 'cream', prims.box, [0.44, 0.54, 0.06], [0, 0, 0], [0, 0, -0.06]);
    addPart(b, 'accent', prims.box, [0.34, 0.40, 0.08], [0, -0.02, 0], [0, 0, -0.06]);
    addPart(b, 'dark', prims.box, [0.20, 0.09, 0.11], [0.02, 0.24, 0], [0, 0, -0.06]);
    addPart(b, 'gold', prims.oct, [0.13, 0.13, 0.12], [0.08, -0.12, 0]);
    addPart(b, 'dark', prims.cylinder, [0.05, 0.40, 0.05], [-0.12, -0.02, 0.06], [0, 0, 0.42]);
  } else {
    // VIP voucher fallback (e.g. Discount Code): diagonal VIP ribbon card + center wax/diamond badge.
    addPart(b, 'accent', prims.box, [0.48, 0.34, 0.08], [0, 0, 0], [0, 0, 0.22]);
    addPart(b, 'cream', prims.box, [0.50, 0.10, 0.10], [0, 0, 0], [0, 0, 0.22]);
    addPart(b, 'dark', prims.box, [0.10, 0.36, 0.10], [0, 0, 0], [0, 0, 0.22]);
    addPart(b, 'gold', prims.oct, [0.16, 0.16, 0.14], [0, 0, 0]);
  }

  // Pedestal ring merged straight into the prop so it stays grounded at zero extra draw calls.
  addPart(b, isJackpot ? 'gold' : 'accent', ringPrim, [1, 1, 1], [0, v.ringY, 0], [Math.PI / 2, 0, 0]);
}

let sharedAssets = null;
function ensureSharedAssets() {
  if (sharedAssets) return sharedAssets;
  const v = config.visual;
  const bagGeo = new THREE.CylinderGeometry(0.5, 0.34, 1, 4);
  bagGeo.rotateY(Math.PI / 4);
  const prims = {
    box: new THREE.BoxGeometry(1, 1, 1),
    cylinder: new THREE.CylinderGeometry(0.5, 0.5, 1, 14),
    frustum: new THREE.CylinderGeometry(0.5, 0.34, 1, 8),
    bag: bagGeo,
    oct: new THREE.OctahedronGeometry(0.5),
    cone: new THREE.ConeGeometry(0.5, 1, 12),
    torus: new THREE.TorusGeometry(0.5, 0.14, 6, 16),
    commonRing: new THREE.TorusGeometry(v.ringRadius, v.ringTube, 4, 24),
    jackpotRing: new THREE.TorusGeometry(v.jackpotRingRadius, v.jackpotRingTube, 5, 24),
  };

  function makeMat({ color, emissive = 0, emissiveIntensity = 0, roughness = 0.55, metalness = 0.08 }) {
    return markShared(new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity, roughness, metalness }));
  }

  const baseMats = {
    dark: makeMat({ color: v.darkColor, emissive: v.darkColor, emissiveIntensity: v.darkEmissive, roughness: 0.55 }),
    cream: makeMat({ color: v.creamColor, emissive: v.creamColor, emissiveIntensity: v.creamEmissive, roughness: 0.52 }),
    cardboard: makeMat({ color: v.cardboardColor, emissive: v.cardboardColor, emissiveIntensity: v.cardboardEmissive, roughness: 0.72 }),
    gold: makeMat({ color: v.goldColor, emissive: v.goldEmissive, emissiveIntensity: v.goldEmissiveIntensity, roughness: 0.35, metalness: 0.15 }),
  };

  const accents = new Map();
  function accentMat(color, isJackpot) {
    const key = `${color}:${isJackpot ? 1 : 0}`;
    if (!accents.has(key)) {
      accents.set(key, makeMat({
        color,
        emissive: color,
        emissiveIntensity: isJackpot ? v.jackpotEmissive : v.commonEmissive,
        roughness: isJackpot ? 0.42 : 0.52,
      }));
    }
    return accents.get(key);
  }

  const models = {};
  for (const [id, def] of Object.entries({ ...config.types, ...bossVouchers })) {
    const isJackpot = def.tier === 'jackpot';
    const buckets = { accent: [], cardboard: [], cream: [], dark: [], gold: [] };
    populateModel(id, def, prims, buckets, v);
    const mats = { ...baseMats, accent: accentMat(def.color, isJackpot) };
    const parts = [];
    for (const [matKey, list] of Object.entries(buckets)) {
      if (!list.length) continue;
      const merged = markShared(mergeGeometries(list, false));
      list.forEach((g) => g.dispose());
      parts.push({ geometry: merged, material: mats[matKey] });
    }
    models[id] = parts;
  }

  const haloGeo = markShared(prims.jackpotRing);
  const markerGeo = markShared(new THREE.OctahedronGeometry(v.markerRadius));
  const markerMat = accentMat(config.types.mysteryShopper.color, false);

  for (const [name, p] of Object.entries(prims)) {
    if (name !== 'jackpotRing') p.dispose();
  }

  sharedAssets = { models, haloGeo, haloMat: baseMats.gold, markerGeo, markerMat };
  return sharedAssets;
}

export function createPowerUpView(scene, colliders) {
  const root = new THREE.Group();
  root.name = 'employeeIncentives';
  scene.add(root);

  const shared = ensureSharedAssets();
  const v = config.visual;
  const props = {};
  const beacons = {};
  const isJackpotById = {};
  for (const [id, def] of Object.entries({ ...config.types, ...bossVouchers })) {
    const isJackpot = def.tier === 'jackpot';
    isJackpotById[id] = isJackpot;
    const beacon = createBeacon({ color: def.color });
    beacon.root.visible = false;
    if (isJackpot) beacon.root.scale.set(v.jackpotBeacon.widthScale, v.jackpotBeacon.heightScale, v.jackpotBeacon.widthScale);
    root.add(beacon.root);
    beacons[id] = beacon;

    const group = new THREE.Group();
    group.name = id;
    group.visible = false;
    for (const { geometry, material } of shared.models[id]) group.add(new THREE.Mesh(geometry, material));
    if (isJackpot) {
      group.scale.setScalar(v.jackpotGlowScale);
      const halo = new THREE.Mesh(shared.haloGeo, shared.haloMat);
      halo.rotation.set(v.haloTiltX, 0, v.haloTiltZ);
      halo.position.y = v.haloOffsetY;
      group.add(halo);
      group.userData.halo = halo;
    }
    root.add(group);
    props[id] = group;
  }

  const floorOffsetRingRay = new THREE.Ray();
  const hit = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  function floorAt(x, z, nearY) {
    let best = null;
    for (const b of colliders) {
      if (x >= b.min.x && x <= b.max.x && z >= b.min.z && z <= b.max.z
          && Math.abs(b.max.y - nearY) <= config.floorTolerance) best = Math.max(best ?? -Infinity, b.max.y);
    }
    for (const ramp of colliders.ramps ?? []) {
      const height = rampHeightAt(ramp, x, z);
      if (height !== null && Math.abs(height - nearY) <= config.floorTolerance) best = Math.max(best ?? -Infinity, height);
    }
    return best;
  }

  function placeZone(position, mesh, template) {
    const attribute = mesh.geometry.attributes.position;
    for (let triangle = 0; triangle < attribute.count; triangle += 3) {
      let supported = true;
      for (let i = triangle; i < triangle + 3; i++) {
        const x = position.x + template[i * 3];
        const z = position.z + template[i * 3 + 1];
        const y = floorAt(x, z, position.y);
        if (y === null) { supported = false; continue; }
        attribute.setXYZ(i, x, y + v.floorOffset, z);
        floorOffsetRingRay.origin.copy(position).y += config.sightHeight;
        vertex.set(x, y + config.sightHeight, z);
        floorOffsetRingRay.direction.subVectors(vertex, floorOffsetRingRay.origin);
        const distance = floorOffsetRingRay.direction.length();
        floorOffsetRingRay.direction.normalize();
        if (colliders.some((b) => floorOffsetRingRay.intersectBox(b, hit) && hit.distanceTo(floorOffsetRingRay.origin) < distance)) supported = false;
      }
      // No floating ring across balcony voids or painted onto the other side of a wall.
      if (!supported) for (let i = triangle; i < triangle + 3; i++) attribute.setXYZ(i, position.x, position.y + v.floorOffset, position.z);
    }
    attribute.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }

  const ownedGeometries = [];
  const ownedMaterials = [];
  const benefitZones = {};
  for (const id of ['paidBreak', 'spillCleanup']) {
    const def = config.types[id];
    const source = new THREE.RingGeometry(def.radius - 0.12, def.radius, 48);
    const geo = source.toNonIndexed();
    source.dispose();
    const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${id}Zone`;
    mesh.visible = false;
    root.add(mesh);
    ownedGeometries.push(geo);
    ownedMaterials.push(mat);
    benefitZones[id] = { mesh, template: geo.attributes.position.array.slice(), position: null };
  }

  const markers = [];
  for (const id of ['mysteryShopper']) {
    for (let i = 0; i < (config.types[id].targets ?? 1); i++) {
      const mesh = new THREE.Mesh(shared.markerGeo, shared.markerMat);
      mesh.name = `${id}Marker${i}`;
      mesh.visible = false;
      root.add(mesh);
      markers.push({ id, index: i, mesh });
    }
  }

  return {
    root,
    update(pickup, dt = 0, effects = []) {
      for (const prop of Object.values(props)) prop.visible = false;
      for (const beacon of Object.values(beacons)) beacon.root.visible = false;
      if (pickup) {
        const prop = props[pickup.id];
        prop.visible = pickup.remaining > v.blinkLastSeconds || Math.floor(pickup.age * v.blinkHz * 2) % 2 === 0;
        const beacon = beacons[pickup.id];
        beacon.root.visible = prop.visible; // (blinks with the prop in its last seconds)
        beacon.root.position.copy(pickup.position);
        beacon.update(pickup.age);
        prop.position.copy(pickup.position);
        if (isJackpotById[pickup.id]) {
          prop.position.y += v.jackpotHover + Math.sin(pickup.age * v.jackpotBobSpeed) * v.jackpotBob;
          prop.rotation.y = pickup.age * v.jackpotSpinSpeed;
          prop.rotation.z = Math.sin(pickup.age * v.jackpotBobSpeed * 0.5) * v.jackpotTilt;
          if (prop.userData.halo) prop.userData.halo.rotation.z = v.haloTiltZ + pickup.age * v.jackpotHaloSpinSpeed;
        } else {
          prop.position.y += v.hover + Math.sin(pickup.age * v.bobSpeed) * v.bob;
          prop.rotation.y = pickup.age * v.spinSpeed;
          prop.rotation.z = 0;
        }
      }
      for (const [id, visual] of Object.entries(benefitZones)) {
        const effect = effects.find(e => e.id === id);
        visual.mesh.visible = !!effect;
        if (effect && visual.position !== effect.position) {
          placeZone(effect.position, visual.mesh, visual.template);
          visual.position = effect.position;
        }
        if (!effect) visual.position = null;
      }
      for (const marker of markers) {
        const target = effects.find(e => e.id === marker.id)?.targets?.[marker.index];
        marker.mesh.visible = !!target?.isAlive;
        if (target) {
          marker.mesh.position.copy(target.position).y += target.type.height + v.markerHoverAboveTarget;
          marker.mesh.rotation.y += dt * v.spinSpeed;
        }
      }
    },
    dispose() {
      for (const beacon of Object.values(beacons)) beacon.dispose();
      root.removeFromParent();
      ownedGeometries.forEach((g) => g.dispose());
      ownedMaterials.forEach((m) => m.dispose());
    },
  };
}
