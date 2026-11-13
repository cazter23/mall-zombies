// =============================================================================
// LOOT VIEW (browser side: the Shoplifter's getaway, game/shoplifting.js)
// A big gold coin spins and bobs over the head of every live zombie that is holding your points (zombie.loot > 0), so you can pick the
// thief out of a crowd and chase it down. One small pool, built once; the game runs without this. Look: config/zombies.js
// shoplifter.lootMarker.
// =============================================================================

import * as THREE from 'three';
import { zombieTypes } from '../config/zombies.js';

export function createLootView(scene, zombies) {
  const look = zombieTypes.shoplifter.lootMarker;
  const face = new THREE.MeshBasicMaterial({ color: look.color });
  const rim = new THREE.MeshBasicMaterial({ color: look.rimColor });
  const coin = new THREE.CylinderGeometry(look.radius, look.radius, look.thickness, 18).rotateX(Math.PI / 2);
  const edge = new THREE.TorusGeometry(look.radius, look.thickness * 0.45, 4, 18);
  const group = new THREE.Group();
  group.name = 'lootMarkers';
  scene.add(group);
  const pool = [];

  function make() {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(coin, face), new THREE.Mesh(edge, rim));
    root.visible = false;
    group.add(root);
    return root;
  }

  let clock = 0;
  return {
    group,
    update(dt) {
      clock += dt;
      const thieves = zombies.zombies.filter((z) => z.loot > 0 && z.isAlive && !z.removed);
      while (pool.length < thieves.length) pool.push(make());
      for (let i = 0; i < pool.length; i++) {
        const mesh = pool[i];
        const zombie = thieves[i];
        mesh.visible = !!zombie;
        if (!zombie) continue;
        mesh.position.copy(zombie.position);
        mesh.position.y += (zombie.type.height ?? 1.8) + look.above + Math.sin(clock * 3 + i) * look.bob;
        mesh.rotation.y = clock * look.spin + i;
      }
    },
    dispose() {
      scene.remove(group);
      for (const resource of [face, rim, coin, edge]) resource.dispose();
    },
  };
}
