// =============================================================================
// THROWABLE VIEW (browser side: draws Kiosk Kevin's thrown equipment)
// Reads `equipment.live` (game/equipment.js; the game runs without this): each thrown thing still out, in the air or sitting on
// the floor waiting for its fuse. Drawn between its last tick's position and this tick's (the render's `alpha`). The Soda Bomb is
// a stubby two-litre bottle (config/kiosk.js look) that tumbles while it flies and shakes harder as the fuse runs out.
// One small pool of meshes, built once; a mesh is hidden when its item is gone (burst, death, Play again). dispose() frees it all.
// =============================================================================

import * as THREE from 'three';
import { kiosk } from '../config/kiosk.js';

export function createThrowableView(scene, equipment) {
  const look = kiosk.products.sodaBomb.look;
  const bodyGeometry = new THREE.CylinderGeometry(0.075, 0.085, 0.24, 8);
  const neckGeometry = new THREE.CylinderGeometry(0.025, 0.07, 0.09, 8);
  const capGeometry = new THREE.CylinderGeometry(0.028, 0.028, 0.03, 8);
  const labelGeometry = new THREE.CylinderGeometry(0.087, 0.087, 0.09, 8, 1, true);
  const materials = {
    bottle: new THREE.MeshStandardMaterial({ color: look.bottle, roughness: 0.25, transparent: true, opacity: 0.88 }),
    label: new THREE.MeshStandardMaterial({ color: look.label, roughness: 0.6, side: THREE.DoubleSide }),
    cap: new THREE.MeshStandardMaterial({ color: look.cap, roughness: 0.5 }),
  };
  const pool = [];
  const group = new THREE.Group();
  group.name = 'throwables';
  scene.add(group);

  function make() {
    const root = new THREE.Group();
    const bottle = new THREE.Group(); // (spun around its middle)
    const body = new THREE.Mesh(bodyGeometry, materials.bottle);
    const label = new THREE.Mesh(labelGeometry, materials.label);
    const neck = new THREE.Mesh(neckGeometry, materials.bottle);
    neck.position.y = 0.165;
    const cap = new THREE.Mesh(capGeometry, materials.cap);
    cap.position.y = 0.225;
    bottle.add(body, label, neck, cap);
    bottle.position.y = -0.02;
    root.add(bottle);
    root.userData.bottle = bottle;
    root.visible = false;
    group.add(root);
    return root;
  }

  return {
    group,
    update(alpha = 1) {
      const live = equipment.live;
      while (pool.length < live.length) pool.push(make());
      for (let i = 0; i < pool.length; i++) {
        const mesh = pool[i];
        const item = live[i];
        mesh.visible = !!item;
        if (!item) continue;
        mesh.position.lerpVectors(item.previous, item.position, alpha);
        const bottle = mesh.userData.bottle;
        const left = Math.max(0, 1 - item.age / item.product.fuseSeconds);
        if (item.flying) {
          bottle.rotation.x += 0.35; // (it tumbles end over end)
          bottle.rotation.z += 0.12;
        } else {
          // On the floor: lying on its side, rattling harder as the fuse runs out.
          const shake = (1 - left) * 0.25;
          bottle.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * shake, bottle.rotation.y, (Math.random() - 0.5) * shake);
        }
        const swell = 1 + (1 - left) * 0.18; // (the pressure builds)
        mesh.scale.setScalar(swell);
      }
    },
    dispose() {
      scene.remove(group);
      for (const geometry of [bodyGeometry, neckGeometry, capGeometry, labelGeometry]) geometry.dispose();
      for (const material of Object.values(materials)) material.dispose();
      pool.length = 0;
    },
  };
}
