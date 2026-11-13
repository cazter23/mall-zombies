// Reusable low-poly incentive props. Emissive materials, no dynamic lights or colliders. A pickup on the floor also gets a
// beacon in its colour (fx/beacon.js: a light column and a pulsing floor ring), so it reads over a crowd and in the dark.
import * as THREE from 'three';
import { createBeacon } from './beacon.js';
import { powerUps as config } from '../config/powerUps.js';
import { bossVouchers } from '../config/bosses.js';
import { rampHeightAt } from '../world/collision.js';

export function createPowerUpView(scene, colliders) {
  const root = new THREE.Group();
  root.name = 'employeeIncentives';
  scene.add(root);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  const oct = new THREE.OctahedronGeometry(0.5);
  const cone = new THREE.ConeGeometry(0.5, 1, 12);
  const materials = [];
  const geometry = [cube, cylinder, oct, cone];
  function material(color, glow = false) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, emissive: glow ? color : 0, emissiveIntensity: glow ? 0.7 : 0 });
    materials.push(m);
    return m;
  }
  const dark = material(0x202334);
  const cream = material(0xffedc9);
  function part(geo, parent, size, at, mat) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(...size);
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }
  const box = (parent, size, at, mat) => part(cube, parent, size, at, mat);
  const props = {};
  const beacons = {};
  for (const [id, def] of Object.entries({ ...config.types, ...bossVouchers })) {
    const beacon = createBeacon({ color: def.color });
    beacon.root.visible = false;
    root.add(beacon.root);
    beacons[id] = beacon;
    const group = new THREE.Group();
    group.name = id;
    group.visible = false;
    root.add(group);
    props[id] = group;
    const isJackpot = def.tier === 'jackpot';
    const color = material(def.color, true);
    if (id === 'stockroomDelivery') {
      box(group, [0.54, 0.4, 0.42], [0, 0, 0], material(0xb8814d));
      box(group, [0.09, 0.41, 0.43], [0, 0, 0], color);
      box(group, [0.28, 0.15, 0.015], [0, 0.02, 0.22], cream);
      box(group, [0.15, 0.03, 0.02], [0, 0.02, 0.235], dark);
    } else if (id === 'shiftBonus') {
      // Winged punch-clock dial: octagonal housing, cream face, hands and forward speed chevrons.
      const dial = part(cylinder, group, [0.36, 0.1, 0.36], [0, 0, 0], color);
      dial.rotation.x = Math.PI / 2;
      const face = part(cylinder, group, [0.27, 0.12, 0.27], [0, 0, 0], cream);
      face.rotation.x = Math.PI / 2;
      box(group, [0.035, 0.12, 0.14], [0, 0.05, 0], dark);
      box(group, [0.1, 0.035, 0.14], [0.04, 0, 0], dark);
      for (const side of [-1, 1]) {
        const wing = box(group, [0.22, 0.08, 0.06], [side * 0.24, 0.02, 0], color);
        wing.rotation.z = side * 0.35;
      }
      part(oct, group, [0.09, 0.12, 0.09], [0, 0.25, 0], dark);
    } else if (id === 'lossPrevention') {
      // Heavy bevelled security shield + protruding grip handle.
      box(group, [0.42, 0.34, 0.11], [0, 0.08, 0], color);
      box(group, [0.29, 0.29, 0.11], [0, -0.06, 0], color).rotation.z = Math.PI / 4;
      box(group, [0.3, 0.3, 0.13], [0, 0.04, 0], cream);
      box(group, [0.22, 0.07, 0.15], [0, 0.12, 0], dark);
      box(group, [0.07, 0.24, 0.15], [0, 0.02, 0], dark);
      part(cylinder, group, [0.08, 0.22, 0.08], [0, -0.22, 0], dark);
    } else if (id === 'storeWideClearance') {
      // Jackpot: clearance nose-cone nuke with four tail fins and a glowing band.
      const shell = part(oct, group, [0.42, 0.54, 0.42], [0, 0.06, 0], color);
      shell.scale.y = 0.62;
      part(cylinder, group, [0.26, 0.28, 0.26], [0, -0.02, 0], dark);
      part(cylinder, group, [0.29, 0.09, 0.29], [0, 0.04, 0], color);
      part(cone, group, [0.24, 0.26, 0.24], [0, 0.25, 0], cream);
      for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
        const fin = box(group, [0.05, 0.2, 0.16], [Math.sin(angle) * 0.16, -0.18, Math.cos(angle) * 0.16], dark);
        fin.rotation.y = angle;
      }
    } else if (id === 'commissionDay') {
      // Jackpot: chunky stamped brass/gold medallion coin flanked by diamond pips.
      const coin = part(cylinder, group, [0.54, 0.12, 0.54], [0, 0.04, 0], color);
      coin.rotation.x = Math.PI / 2;
      const rim = part(cylinder, group, [0.4, 0.14, 0.4], [0, 0.04, 0], cream);
      rim.rotation.x = Math.PI / 2;
      box(group, [0.06, 0.28, 0.16], [0, 0.04, 0], dark);
      box(group, [0.18, 0.05, 0.16], [0, 0.12, 0], dark);
      box(group, [0.18, 0.05, 0.16], [0, -0.04, 0], dark);
      for (const side of [-1, 1]) {
        part(oct, group, [0.11, 0.15, 0.11], [side * 0.36, 0.08, 0], cream);
      }
    } else if (id === 'blackFriday') {
      // Jackpot: jagged doorbuster price tag pierced by crossed dark cleaver blades.
      const tag = box(group, [0.46, 0.56, 0.09], [0, 0.04, 0], color);
      tag.rotation.z = 0.08;
      part(cylinder, group, [0.12, 0.12, 0.12], [0, 0.25, 0], cream).rotation.x = Math.PI / 2;
      for (const angle of [0.7, -0.7]) {
        const blade = box(group, [0.09, 0.58, 0.13], [0, 0.02, 0], dark);
        blade.rotation.z = angle;
      }
      part(oct, group, [0.16, 0.16, 0.16], [0, 0.02, 0], cream);
    } else {
      // A colored staff badge plus a distinct silhouette for each benefit.
      box(group, [0.42, 0.5, 0.06], [0, 0, 0], cream);
      box(group, [0.16, 0.06, 0.08], [0, 0.23, 0], dark);
      const glyph = (size, at = [0, 0, 0.06], mat = color) => box(group, size, at, mat);
      if (def.icon === 'burst') {
        for (let i = 0; i < 4; i++) glyph([0.06, 0.34, 0.08]).rotation.z = i * Math.PI / 4;
      } else if (def.icon === 'ticket') {
        glyph([0.3, 0.16, 0.08]).rotation.z = 0.45;
        glyph([0.04, 0.21, 0.1], [0, 0, 0.08], dark);
      } else if (def.icon === 'eye') {
        glyph([0.3, 0.12, 0.08]); glyph([0.1, 0.21, 0.08]); glyph([0.06, 0.07, 0.1], [0, 0, 0.08], dark);
      } else if (def.icon === 'spill') {
        glyph([0.34, 0.07, 0.08], [0, -0.1, 0.06]); glyph([0.17, 0.2, 0.08], [0.04, 0.02, 0.06]).rotation.z = 0.35;
      }
    }
    const ringGeo = new THREE.TorusGeometry(isJackpot ? 0.52 : 0.44, isJackpot ? 0.032 : 0.025, 4, 24);
    geometry.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, color);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.34;
    group.add(ring);
    if (isJackpot) {
      group.scale.setScalar(config.visual.jackpotGlowScale);
      const halo = new THREE.Mesh(ringGeo, cream);
      halo.rotation.set(Math.PI / 2 - 0.45, 0, 0.3);
      halo.position.y = 0.05;
      group.add(halo);
    }
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
        attribute.setXYZ(i, x, y + config.visual.floorOffset, z);
        floorOffsetRingRay.origin.copy(position).y += config.sightHeight;
        vertex.set(x, y + config.sightHeight, z);
        floorOffsetRingRay.direction.subVectors(vertex, floorOffsetRingRay.origin);
        const distance = floorOffsetRingRay.direction.length();
        floorOffsetRingRay.direction.normalize();
        if (colliders.some((b) => floorOffsetRingRay.intersectBox(b, hit) && hit.distanceTo(floorOffsetRingRay.origin) < distance)) supported = false;
      }
      // No floating ring across balcony voids or painted onto the other side of a wall.
      if (!supported) for (let i = triangle; i < triangle + 3; i++) attribute.setXYZ(i, position.x, position.y + config.visual.floorOffset, position.z);
    }
    attribute.needsUpdate = true;
    mesh.geometry.computeBoundingSphere();
  }

  const benefitZones = {};
  for (const id of ['spillCleanup']) {
    const def = config.types[id];
    const source = new THREE.RingGeometry(def.radius - 0.12, def.radius, 48);
    const geo = source.toNonIndexed();
    source.dispose();
    const mat = new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${id}Zone`;
    mesh.visible = false;
    root.add(mesh);
    geometry.push(geo); materials.push(mat);
    benefitZones[id] = { mesh, template: geo.attributes.position.array.slice(), position: null };
  }
  const markerGeo = new THREE.OctahedronGeometry(0.18);
  geometry.push(markerGeo);
  const markers = [];
  for (const id of ['mysteryShopper']) {
    const mat = material(config.types[id].color, true);
    for (let i = 0; i < (config.types[id].targets ?? 1); i++) {
      const mesh = new THREE.Mesh(markerGeo, mat);
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
        const v = config.visual;
        prop.visible = pickup.remaining > v.blinkLastSeconds || Math.floor(pickup.age * v.blinkHz * 2) % 2 === 0;
        const beacon = beacons[pickup.id];
        beacon.root.visible = prop.visible; // (blinks with the prop in its last seconds)
        beacon.root.position.copy(pickup.position);
        beacon.update(pickup.age);
        prop.position.copy(pickup.position);
        prop.position.y += v.hover + Math.sin(pickup.age * v.bobSpeed) * v.bob;
        prop.rotation.y = pickup.age * v.spinSpeed;
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
          marker.mesh.position.copy(target.position).y += target.type.height + 0.45;
          marker.mesh.rotation.y += dt * config.visual.spinSpeed;
        }
      }
    },
    dispose() {
      for (const beacon of Object.values(beacons)) beacon.dispose();
      root.removeFromParent();
      geometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
