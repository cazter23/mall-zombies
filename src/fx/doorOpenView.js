// =============================================================================
// DOOR OPEN VIEW (browser side): what a bought door looks like as it goes up (config/shutters.js opening).
// Listens to game/doorOpenings.js:
//   'barrierOpening'  dust puffs along the doorway's floor line; for the door you bought, light from the area you just
//                     opened spills through (an additive card just inside the opening, revealed as the curtain lifts,
//                     and a tongue of light across your side's floor)
//   'barrierOpened'   dust falls from the roller housing as it clunks home (the escalator: a puff at its foot)
// Free connections (opened because you now own both sides) get light dust only: no glow.
// Dust goes through the shared particle pool (fx/effects.js). The glow is `opening.glow.slots` pooled pairs of meshes
// made once and hidden when idle: no real lights, no draw calls between openings.
//
//   const view = createDoorOpenView({ scene, events, effects, player })
//   view.update(dt)   each rendered frame (0 while paused). The light follows the barrier's REAL roll (game time), then
//                     fades over opening.glow.tail seconds once it is up
//   view.dispose()
// =============================================================================

import * as THREE from 'three';
import { shutters } from '../config/shutters.js';

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A greyscale ramp (additive: black adds nothing). shape(u, v) -> 0..1, u across, v up the texture.
function rampTexture(shape) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const value = Math.round(255 * shape((x + 0.5) / size, 1 - (y + 0.5) / size));
      const i = (y * size + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

export function createDoorOpenView({ scene, events, effects, player }) {
  const cfg = shutters.opening;
  const edge = (u) => smooth(0, 0.22, u) * smooth(0, 0.22, 1 - u);
  // The opening: soft at the jambs, brightest low down (light pools on the floor), fading toward the head.
  const cardTexture = rampTexture((u, v) => edge(u) * smooth(0, 0.08, v) * (1 - 0.6 * v));
  // The floor tongue: brightest at the doorway (v = 1), dying away into your side.
  const floorTexture = rampTexture((u, v) => edge(u) * v ** 1.6);
  const geometry = new THREE.PlaneGeometry(1, 1);
  const material = (map) => new THREE.MeshBasicMaterial({
    map, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    toneMapped: false,
  });
  const slots = [];
  for (let i = 0; i < cfg.glow.slots; i++) {
    const card = new THREE.Mesh(geometry, material(cardTexture));
    const floor = new THREE.Mesh(geometry, material(floorTexture));
    card.name = 'doorOpenGlow'; floor.name = 'doorOpenGlowFloor';
    floor.rotation.order = 'YXZ';
    for (const mesh of [card, floor]) { mesh.visible = false; mesh.renderOrder = 2; scene.add(mesh); }
    slots.push({ card, floor, barrier: null, tail: Infinity });
  }
  let nextSlot = 0;
  const at = new THREE.Vector3();

  /** The doorway a shutter fills: its collider (kept even once it leaves the colliders list). */
  function doorway(door) {
    const box = door.barrier.kind === 'shutter' ? door.barrier.collider : null;
    if (!box) return null;
    const alongX = box.max.x - box.min.x >= box.max.z - box.min.z;
    return {
      box, alongX,
      span: alongX ? box.max.x - box.min.x : box.max.z - box.min.z,
      height: box.max.y - box.min.y,
    };
  }

  /** `spots` evenly spaced points across the doorway at height y. */
  function* across(d, spots, y) {
    const { box, alongX } = d;
    for (let i = 0; i < spots; i++) {
      const f = (i + 0.5) / spots;
      at.set(
        alongX ? box.min.x + (box.max.x - box.min.x) * f : (box.min.x + box.max.x) / 2,
        y,
        alongX ? (box.min.z + box.max.z) / 2 : box.min.z + (box.max.z - box.min.z) * f,
      );
      yield at;
    }
  }

  function dust(d, y, normal, perSpot, scale) {
    const { dust: dc } = cfg;
    const spots = Math.min(dc.maxSpots, Math.max(2, Math.round(d.span * dc.perMetre * scale)));
    const count = Math.max(1, Math.round(perSpot * scale));
    for (const point of across(d, spots, y)) effects.splat(point, normal, dc.colors, count, { speedScale: dc.speedScale });
  }

  function glow(d, areaId, barrier) {
    const slot = slots[nextSlot];
    nextSlot = (nextSlot + 1) % slots.length;
    const { box, alongX, span, height } = d;
    const color = cfg.glowColor[areaId] ?? cfg.glowColor.color;
    // Which side you are on: the light comes from the far side (the area just opened) toward you.
    const p = player.position;
    const side = alongX ? Math.sign(p.z - (box.min.z + box.max.z) / 2) || 1 : Math.sign(p.x - (box.min.x + box.max.x) / 2) || 1;
    const nearFace = alongX ? (side > 0 ? box.max.z : box.min.z) : (side > 0 ? box.max.x : box.min.x);
    const farFace = alongX ? (side > 0 ? box.min.z : box.max.z) : (side > 0 ? box.min.x : box.max.x);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    // The card stands just past the curtain, on the far side: the rising curtain uncovers it.
    const card = slot.card;
    card.position.set(alongX ? cx : farFace - side * 0.05, box.min.y + height / 2, alongX ? farFace - side * 0.05 : cz);
    card.rotation.set(0, alongX ? 0 : Math.PI / 2, 0);
    card.scale.set(span, height, 1);
    // The tongue lies on your side's floor, bright edge at the doorway, reaching `floorDepth` toward you.
    const depth = cfg.glow.floorDepth, floor = slot.floor;
    const dx = alongX ? 0 : side, dz = alongX ? side : 0;
    floor.position.set(alongX ? cx : nearFace + dx * depth / 2, box.min.y + 0.02, alongX ? nearFace + dz * depth / 2 : cz);
    floor.rotation.set(-Math.PI / 2, Math.atan2(dx, dz), 0);
    floor.scale.set(span, depth, 1);
    for (const mesh of [card, floor]) { mesh.material.color.setHex(color); mesh.material.opacity = 0; mesh.visible = true; }
    slot.barrier = barrier;
    slot.height = height;
    slot.tail = 0;
  }

  const off = [
    events.on('barrierOpening', ({ door, areaId, bought, profile }) => {
      const scale = cfg.profiles[profile].dustScale * (bought ? 1 : cfg.lightScale);
      const d = doorway(door);
      if (!d) {
        at.copy(door.position); at.y -= 1;
        effects.splat(at, UP, cfg.dust.colors, Math.max(1, Math.round(cfg.dust.count * 2 * scale)), { speedScale: cfg.dust.speedScale });
        return;
      }
      dust(d, d.box.min.y + 0.05, UP, cfg.dust.count, scale);
      if (bought) glow(d, areaId, door.barrier);
    }),
    events.on('barrierOpened', ({ door, bought, profile }) => {
      const d = doorway(door);
      if (!d) return;
      dust(d, d.box.max.y - 0.08, DOWN, cfg.dust.topCount, cfg.profiles[profile].dustScale * (bought ? 1 : cfg.lightScale));
    }),
    events.on('runReset', () => { for (const slot of slots) hide(slot); }),
  ];

  function hide(slot) {
    slot.barrier = null;
    slot.tail = Infinity;
    slot.card.visible = slot.floor.visible = false;
  }

  return {
    update(dt) {
      const { rise, tail, peak, floorPeak } = cfg.glow;
      for (const slot of slots) {
        if (!slot.barrier) continue;
        let envelope;
        if (slot.barrier.state === 'opening') {
          // Brightens with the REAL roll (game time: a paused game or a long frame cannot use it up).
          envelope = smooth(0, rise, slot.barrier.raised / slot.height);
        } else {
          slot.tail += Math.min(dt, 0.1); // (up, or slammed shut: fade out)
          if (slot.tail >= tail) { hide(slot); continue; }
          envelope = (1 - slot.tail / tail) ** 2;
        }
        slot.card.material.opacity = peak * envelope;
        slot.floor.material.opacity = floorPeak * envelope;
      }
    },
    /** Glow slots lit right now (for checks in the browser). */
    get active() {
      return slots.filter((s) => s.barrier).length;
    },
    dispose() {
      for (const unsubscribe of off) unsubscribe();
      for (const slot of slots) {
        scene.remove(slot.card, slot.floor);
        slot.card.material.dispose(); slot.floor.material.dispose();
      }
      geometry.dispose(); cardTexture.dispose(); floorTexture.dispose();
    },
  };
}
