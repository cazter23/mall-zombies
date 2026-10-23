// Reusable low-poly incentive props. Emissive materials, no dynamic lights or colliders.
import * as THREE from 'three';
import { powerUps as config } from '../config/powerUps.js';
import { rampHeightAt } from '../world/collision.js';

export function createPowerUpView(scene, colliders) {
  const root = new THREE.Group();
  root.name = 'employeeIncentives';
  scene.add(root);
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const materials = [];
  const geometry = [cube];
  function material(color, glow = false) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.65, emissive: glow ? color : 0, emissiveIntensity: glow ? 0.7 : 0 });
    materials.push(m);
    return m;
  }
  const dark = material(0x202334);
  const cream = material(0xffedc9);
  function box(parent, size, at, mat) {
    const mesh = new THREE.Mesh(cube, mat);
    mesh.scale.set(...size);
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }
  const props = {};
  for (const [id, def] of Object.entries(config.types)) {
    const group = new THREE.Group();
    group.name = id;
    group.visible = false;
    root.add(group);
    props[id] = group;
    const color = material(def.color, true);
    if (id === 'stockroomDelivery') {
      box(group, [0.54, 0.4, 0.42], [0, 0, 0], material(0xb8814d));
      box(group, [0.09, 0.41, 0.43], [0, 0, 0], color);
      box(group, [0.28, 0.15, 0.015], [0, 0.02, 0.22], cream);
      box(group, [0.15, 0.03, 0.02], [0, 0.02, 0.235], dark);
    } else if (id === 'blueLightSpecial') {
      box(group, [0.48, 0.1, 0.4], [0, -0.18, 0], dark);
      box(group, [0.3, 0.32, 0.3], [0, 0.03, 0], color);
      box(group, [0.06, 0.34, 0.32], [0, 0.03, 0], cream);
    } else {
      box(group, [0.42, 0.52, 0.1], [0, 0, 0], color);
      box(group, [0.29, 0.32, 0.12], [0, -0.02, 0], cream);
      box(group, [0.1, 0.27, 0.14], [0, 0, 0], dark);
      box(group, [0.27, 0.1, 0.14], [0, 0, 0], dark);
    }
    const ringGeo = new THREE.TorusGeometry(0.44, 0.025, 4, 24);
    geometry.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, color);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.34;
    group.add(ring);
  }

  const sourceRing = new THREE.RingGeometry(config.types.blueLightSpecial.radius - 0.12, config.types.blueLightSpecial.radius, 64);
  const zoneGeo = sourceRing.toNonIndexed();
  sourceRing.dispose();
  geometry.push(zoneGeo);
  const zoneMat = new THREE.MeshBasicMaterial({
    color: config.types.blueLightSpecial.color, transparent: true, opacity: 0.75,
    side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
  });
  materials.push(zoneMat);
  const zone = new THREE.Mesh(zoneGeo, zoneMat);
  zone.visible = false;
  root.add(zone);
  let zonePosition = null;
  const ringTemplate = zoneGeo.attributes.position.array.slice();
  const zoneRay = new THREE.Ray();
  const hit = new THREE.Vector3();
  const vertex = new THREE.Vector3();

  function floorAt(x, z, nearY) {
    let best = null;
    for (const box of colliders) {
      if (x >= box.min.x && x <= box.max.x && z >= box.min.z && z <= box.max.z
          && Math.abs(box.max.y - nearY) <= config.floorTolerance) best = Math.max(best ?? -Infinity, box.max.y);
    }
    for (const ramp of colliders.ramps ?? []) {
      const height = rampHeightAt(ramp, x, z);
      if (height !== null && Math.abs(height - nearY) <= config.floorTolerance) best = Math.max(best ?? -Infinity, height);
    }
    return best;
  }

  function placeZone(position) {
    const attribute = zoneGeo.attributes.position;
    for (let triangle = 0; triangle < attribute.count; triangle += 3) {
      let supported = true;
      for (let i = triangle; i < triangle + 3; i++) {
        const x = position.x + ringTemplate[i * 3];
        const z = position.z + ringTemplate[i * 3 + 1];
        const y = floorAt(x, z, position.y);
        if (y === null) { supported = false; continue; }
        attribute.setXYZ(i, x, y + config.visual.floorOffset, z);
        zoneRay.origin.copy(position).y += config.sightHeight;
        vertex.set(x, y + config.sightHeight, z);
        zoneRay.direction.subVectors(vertex, zoneRay.origin);
        const distance = zoneRay.direction.length();
        zoneRay.direction.normalize();
        if (colliders.some((box) => zoneRay.intersectBox(box, hit) && hit.distanceTo(zoneRay.origin) < distance)) supported = false;
      }
      // No floating ring across balcony voids or painted onto the other side of a wall.
      if (!supported) for (let i = triangle; i < triangle + 3; i++) attribute.setXYZ(i, position.x, position.y + config.visual.floorOffset, position.z);
    }
    attribute.needsUpdate = true;
    zoneGeo.computeBoundingSphere();
  }

  return {
    root,
    update(pickup, active) {
      for (const prop of Object.values(props)) prop.visible = false;
      if (pickup) {
        const prop = props[pickup.id];
        const v = config.visual;
        prop.visible = pickup.remaining > v.blinkLastSeconds || Math.floor(pickup.age * v.blinkHz * 2) % 2 === 0;
        prop.position.copy(pickup.position);
        prop.position.y += v.hover + Math.sin(pickup.age * v.bobSpeed) * v.bob;
        prop.rotation.y = pickup.age * v.spinSpeed;
      }
      zone.visible = !!active;
      if (active) {
        if (zonePosition !== active.position) {
          placeZone(active.position);
          zonePosition = active.position;
        }
        zoneMat.opacity = active.remaining < config.visual.blinkLastSeconds ? 0.35 + 0.35 * Math.abs(Math.sin(active.remaining * 5)) : 0.75;
      } else zonePosition = null;
    },
    dispose() {
      root.removeFromParent();
      geometry.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
