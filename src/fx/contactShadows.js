import * as THREE from 'three';
import { atmosphere } from '../config/environment.js';
import { makeSoftFootprint } from '../world/atmosphereTextures.js';
import { rampHeightAt, colliderSignature } from '../world/collision.js';

/**
 * One instanced draw, independent of hitboxes, navigation and damage.
 * The floor under a zombie is the highest collider top below its feet. The mall has about 600 colliders, so each zombie
 * remembers the few whose footprint is within `searchMargin` of where it last looked and only checks those, until it has
 * walked further than that or the collider list changed (a door: world/collision.js colliderSignature). Heights are read
 * from the boxes every frame, so a shutter rolling under a zombie is still followed; a box moved SIDEWAYS in place is not.
 */
export function createContactShadows(scene, colliders) {
  const cfg = atmosphere.contact;
  const geometry = new THREE.PlaneGeometry(1, 1); geometry.rotateX(-Math.PI / 2);
  const map = makeSoftFootprint();
  const material = new THREE.MeshBasicMaterial({ map, color: 0x161c20, transparent: true,
    opacity: cfg.opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
  const mesh = new THREE.InstancedMesh(geometry, material, cfg.maxZombies);
  mesh.name = 'zombie_contact_shadows'; mesh.count = 0; mesh.frustumCulled = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(mesh);
  const transform = new THREE.Object3D(), position = new THREE.Vector3();
  const nearby = new WeakMap(); // zombie -> { x, z, signature, boxes }: the colliders around where it last looked
  function boxesNear(zombie, signature) {
    let entry = nearby.get(zombie);
    const m = cfg.searchMargin;
    if (!entry) nearby.set(zombie, entry = { x: NaN, z: 0, signature: '', boxes: [] });
    if (entry.signature !== signature || !(Math.abs(position.x - entry.x) <= m && Math.abs(position.z - entry.z) <= m)) {
      entry.x = position.x; entry.z = position.z; entry.signature = signature; entry.boxes.length = 0;
      for (const b of colliders) {
        if (b.min.x <= position.x + m && b.max.x >= position.x - m && b.min.z <= position.z + m && b.max.z >= position.z - m) entry.boxes.push(b);
      }
    }
    return entry.boxes;
  }
  return {
    mesh,
    update(zombies, alpha = 1) {
      let count = 0;
      const signature = colliderSignature(colliders);
      for (const zombie of zombies) {
        if (count === cfg.maxZombies) break;
        if (zombie.removed || zombie.state === 'spawning' || zombie.state === 'dead') continue;
        position.lerpVectors(zombie.prevPosition, zombie.position, alpha);
        let floor = -Infinity;
        for (const b of boxesNear(zombie, signature)) {
          if (b.max.y <= position.y + cfg.floorTolerance && b.max.y > floor && b.min.x <= position.x && b.max.x >= position.x
            && b.min.z <= position.z && b.max.z >= position.z) floor = b.max.y;
        }
        for (const ramp of colliders.ramps ?? []) { // (an escalator: its surface, not the blocks under it)
          const h = rampHeightAt(ramp, position.x, position.z);
          if (h !== null && h <= position.y + cfg.floorTolerance && h > floor) floor = h;
        }
        const height = position.y - floor;
        if (!Number.isFinite(floor) || height >= cfg.fadeHeight) continue;
        const radius = cfg.radius * (1 - Math.max(0, height) / cfg.fadeHeight);
        transform.position.set(position.x, floor + cfg.lift, position.z);
        transform.scale.set(radius * 2, 1, radius * 2 * cfg.depthRatio); transform.updateMatrix();
        mesh.setMatrixAt(count++, transform.matrix);
      }
      mesh.count = count; mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { mesh.count = 0; },
    dispose() { mesh.removeFromParent(); geometry.dispose(); material.dispose(); map.dispose(); },
  };
}
