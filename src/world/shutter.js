// =============================================================================
// SECURITY SHUTTER
// A roll-up door that blocks a doorway until opened. It's just the physical
// barrier: price and zones are handled by world/door.js, which wraps it.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { markCollidersChanged } from './collision.js';
import { shutters } from '../config/shutters.js';

export function createShutter({ name, minX, maxX, minZ, maxZ, minY = 0, height, material, finish = shutters.finishes.public, colliders }) {
  const width = maxX - minX;
  const depth = maxZ - minZ;

  // The visible slab is a bit thinner than the doorway (along the wall's thickness, whichever axis
  // that is) so it hides inside the lintel when open.
  const geometry = width >= depth
    ? new THREE.BoxGeometry(width, height, depth * 0.5) // doorway in a wall running along X
    : new THREE.BoxGeometry(width * 0.5, height, depth); // doorway in a wall running along Z
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set((minX + maxX) / 2, minY + height / 2, (minZ + maxZ) / 2);
  mesh.userData = { kind: 'shutter', id: name };

  const alongX = width >= depth, span = Math.max(width, depth), thickness = Math.min(width, depth);
  // The frame never moves or enters the opening. The curtain and its fittings are excluded from static batching.
  const frame = new THREE.Group(); frame.name = `${name}_frame`;
  frame.position.set(mesh.position.x, minY, mesh.position.z); frame.rotation.y = alongX ? 0 : Math.PI / 2;
  const fittings = new THREE.Group(); fittings.rotation.y = frame.rotation.y; mesh.add(fittings);
  const accent = new THREE.MeshStandardMaterial({ color: finish.accent, roughness: .72, metalness: .15 });
  const trackMetal = new THREE.MeshStandardMaterial({ color: 0x9aa6a5, roughness: .5, metalness: .55 });
  const hardware = new THREE.MeshStandardMaterial({ color: finish.brass ? 0xb99a57 : 0x717d80, roughness: .4, metalness: .6 });
  const dark = new THREE.MeshStandardMaterial({ color: finish.ink, roughness: .8 });
  function box(part, size, at, mat, parent) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.name = part; m.position.set(...at); parent.add(m); return m;
  }
  const t = shutters.track, frameDepth = thickness + t.extraDepth;
  for (const side of [-1, 1]) {
    // Sit fully inside the jamb rather than sharing its opening-facing plane. Leave the
    // same hairline at the floor/header so the guide caps cannot fight those surfaces.
    const x = side * (span / 2 + t.width / 2 + t.frameClearance);
    box('shutter_guide', [t.width, height - 2 * t.frameClearance, frameDepth],
      [x, height / 2, 0], accent, frame);
    // A narrow inset on each room-facing side reads as the guide's channel, rather than painted-on rails.
    for (const face of [-1, 1]) box('shutter_channel', [t.width * .35, height - .04, .012],
      [x, height / 2, face * (frameDepth / 2 + .006 + t.channelLift)], dark, frame);
  }
  box('shutter_roller_housing', [span + 2 * t.housingOverhang, t.housingHeight, frameDepth + .04],
    [0, height + t.frameClearance + t.housingHeight / 2, 0], accent, frame);
  for (const face of [-1, 1]) box('housing_trim', [span + 2 * t.housingOverhang, .035, .015],
    [0, height + .035, face * (frameDepth / 2 + .035)], hardware, frame);
  const bottomRail = box('shutter_bottom_rail', [span, shutters.bottomRailHeight, thickness * .5 + .035], [0, 0, 0], trackMetal, fittings);
  const handles = [];
  for (const face of [-1, 1]) {
    const plate = box('shutter_handle_plate', [.32, .14, .014], [0, 0, face * (thickness * .25 + .012)], dark, fittings);
    const grip = box('shutter_lifting_handle', [.2, .028, .035], [0, 0, face * (thickness * .25 + .035)], hardware, fittings);
    const lock = box('shutter_lock_plate', [.055, .075, .014], [.22, 0, face * (thickness * .25 + .012)], hardware, fittings);
    const keyhole = box('shutter_keyhole', [.009, .023, .008], [.22, 0, face * (thickness * .25 + .027)], dark, fittings);
    handles.push(plate, grip, lock, keyhole);
  }
  // A closed shutter can lie just inside the room it seals. Keep the curtain and
  // frame on the always-drawn layer so room culling cannot hide the barrier from
  // someone standing on the opposite side of its closed portal.
  for (const part of [mesh, frame]) part.traverse((o) => {
    if (o.isMesh) o.userData.alwaysVisible = true;
  });
  const positions = geometry.attributes.position, uv = geometry.attributes.uv;
  const closedY = Float32Array.from(positions.array.filter((_, i) => i % 3 === 1));
  const closedV = Float32Array.from(uv.array.filter((_, i) => i % 2 === 1));

  // The collider covers the full doorway thickness so the player can't wedge into it.
  const collider = new THREE.Box3(new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, minY + height, maxZ));
  collider.noImpactMarks = true; // rolling shutters are excluded from persistent cosmetic impacts
  colliders.push(collider);
  markCollidersChanged(colliders);

  let state = 'closed'; // 'closed' | 'opening' | 'open' | 'closing'
  let raised = 0; // meters the shutter has rolled up

  function pose() {
    const remaining = Math.max(0, height - raised), fraction = remaining / height;
    // The lower, unrolled portion of the original curtain rises into a fixed housing.
    // Crop its UVs with its geometry so neither the painted lettering nor the slat spacing squashes.
    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, closedY[i] * fraction); uv.setY(i, closedV[i] * fraction);
    }
    positions.needsUpdate = true; uv.needsUpdate = true;
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    mesh.position.y = minY + raised + remaining / 2;
    bottomRail.position.y = -remaining / 2 + shutters.bottomRailHeight / 2;
    bottomRail.visible = remaining >= shutters.bottomRailHeight;
    for (const handle of handles) {
      handle.position.y = -remaining / 2 + shutters.handleHeight;
      handle.visible = remaining >= shutters.handleHeight + .08;
    }
    mesh.visible = state !== 'open';
  }
  pose();

  function addCollider() {
    if (colliders.includes(collider)) return;
    colliders.push(collider);
    markCollidersChanged(colliders);
  }
  function removeCollider() {
    const i = colliders.indexOf(collider);
    if (i === -1) return;
    colliders.splice(i, 1);
    markCollidersChanged(colliders);
  }

  return {
    kind: 'shutter',
    name,
    mesh,
    frame,
    collider, // the solid slab filling the doorway (the interaction system sees through it to the buy spot)
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
        mesh.visible = true;
        addCollider(); // block immediately so nobody slips under a closing door
      }
    },
    toggle() {
      if (state === 'closed' || state === 'closing') this.open();
      else this.close();
    },
    update(dt) {
      const before = raised;
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
      if (raised !== before) pose();
    },
  };
}
