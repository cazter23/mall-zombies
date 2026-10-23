import * as THREE from 'three';
import { atmosphere } from '../config/environment.js';
import { makeSoftFootprint } from '../world/atmosphereTextures.js';

/** One instanced draw, independent of hitboxes, navigation and damage. */
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
  return {
    mesh,
    update(zombies, alpha = 1) {
      let count = 0;
      for (const zombie of zombies) {
        if (count === cfg.maxZombies) break;
        if (zombie.removed || zombie.state === 'spawning' || zombie.state === 'dead') continue;
        position.lerpVectors(zombie.prevPosition, zombie.position, alpha);
        let floor = -Infinity;
        for (const b of colliders) {
          if (b.max.y <= position.y + cfg.floorTolerance && b.max.y > floor && b.min.x <= position.x && b.max.x >= position.x
            && b.min.z <= position.z && b.max.z >= position.z) floor = b.max.y;
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
