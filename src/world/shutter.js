// =============================================================================
// SECURITY SHUTTER
// A roll-up door that blocks a doorway until opened. Later steps will open it
// by spending points (see `cost`); for now debug key O toggles it.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';

export function createShutter({ name, minX, maxX, minZ, maxZ, height, material, colliders, cost }) {
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // The visible slab is a bit thinner than the doorway so it hides inside the lintel when open.
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth * 0.5), material);
  mesh.name = name;
  mesh.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
  mesh.userData = { kind: 'shutter', id: name, cost };

  // The collider covers the full doorway thickness so the player can't wedge into it.
  const collider = new THREE.Box3(new THREE.Vector3(minX, 0, minZ), new THREE.Vector3(maxX, height, maxZ));
  colliders.push(collider);

  let state = 'closed'; // 'closed' | 'opening' | 'open' | 'closing'
  let raised = 0; // meters the shutter has rolled up

  function addCollider() {
    if (!colliders.includes(collider)) colliders.push(collider);
  }
  function removeCollider() {
    const i = colliders.indexOf(collider);
    if (i !== -1) colliders.splice(i, 1);
  }

  return {
    name,
    mesh,
    cost,
    get state() {
      return state;
    },
    get isOpen() {
      return state === 'open';
    },
    open() {
      if (state === 'closed' || state === 'closing') state = 'opening';
    },
    close() {
      if (state === 'open' || state === 'opening') {
        state = 'closing';
        addCollider(); // block immediately so nobody slips under a closing door
      }
    },
    toggle() {
      if (state === 'closed' || state === 'closing') this.open();
      else this.close();
    },
    update(dt) {
      const speed = height / feel.world.shutterOpenSeconds;
      if (state === 'opening') {
        raised = Math.min(height, raised + speed * dt);
        // Let the player through once there's head room.
        if (raised >= feel.player.height + 0.1) removeCollider();
        if (raised >= height) state = 'open';
      } else if (state === 'closing') {
        raised = Math.max(0, raised - speed * dt);
        if (raised <= 0) state = 'closed';
      }
      mesh.position.y = height / 2 + raised;
    },
  };
}
