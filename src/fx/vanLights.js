// =============================================================================
// VAN LIGHTS: Skylar's van in Customer Parking comes alive at the end of a won run. Browser side, visual and audio only:
// it reads the game's state and changes nothing in it (config/closingTime.js vanShow has every number).
//
//   dark      until the Last Customer is returned (the van's own painted lamps show)
//   waiting   the run can be won: the amber hazards blink, with the relay's click when you are near
//   starting  start(onReceipt): the starter cranks, the headlights stutter; the engine catches, the lights come on full,
//             the screen fades to black and onReceipt() shows the SHIFT COMPLETE receipt, then the fade lifts
//   running   after the win (overtime, or a loaded overtime save): headlights, beams and tail lights on, the cracked
//             right headlight flickering
//
//   const lights = createVanLights({ scene, sound })
//   lights.update(frameTime, { ready, won, listener })   every rendered frame (listener: the camera's position)
//   lights.start(onReceipt)                              on 'runWon'
// No real light is added (that would rebuild every shader at the moment of the win): unlit lenses, additive beams and
// a pool on the asphalt.
// =============================================================================

import * as THREE from 'three';
import { parkingLot } from '../config/parkingLot.js';
import { closingTime } from '../config/closingTime.js';

// A 1 x n (or n x n) alpha ramp: bright where v = 1 (at the lamp), clear where v = 0; `across` adds a soft edge on u.
function ramp(n, across = false) {
  const width = across ? n : 1;
  const data = new Uint8Array(width * n * 4);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < width; col++) {
      const edge = across ? Math.sin(Math.PI * (col + 0.5) / width) : 1;
      const value = Math.round(255 * (row / (n - 1)) ** 1.5 * edge);
      data.set([value, value, value, 255], (row * width + col) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, width, n);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createVanLights({ scene, sound = null, doc = globalThis.document ?? null }) {
  const cfg = closingTime.vanShow;
  const van = parkingLot.vehicles.find(({ id }) => id === 'abandoned');
  const owned = [];
  const keep = (thing) => (owned.push(thing), thing);

  const root = new THREE.Group();
  root.name = 'vanLights';
  root.userData.dynamic = true;
  root.position.set(van.x, 0, van.z);
  root.visible = false;
  scene.add(root);

  const plane = keep(new THREE.PlaneGeometry(1, 1));
  const front = van.length / 2 + cfg.proud;
  function lenses(spec, faces) {
    return [-1, 1].map((side) => {
      const material = keep(new THREE.MeshBasicMaterial({ color: spec.color, toneMapped: false }));
      const mesh = new THREE.Mesh(plane, material);
      mesh.scale.set(...spec.size, 1);
      mesh.position.set(side * spec.x * van.width, spec.y, faces * front);
      if (faces < 0) mesh.rotation.y = Math.PI;
      mesh.userData.side = side;
      root.add(mesh);
      return mesh;
    });
  }
  const head = lenses(cfg.headlights, 1);
  const tail = lenses(cfg.tailLights, -1);
  const hazards = [...lenses(cfg.hazards, 1), ...lenses(cfg.hazards, -1)];

  // Beams: open cones from each headlight, additive and fading with distance. The pool: the light on the asphalt ahead.
  const glow = (alphaMap, opacity) => keep(new THREE.MeshBasicMaterial({
    color: cfg.headlights.color, alphaMap, transparent: true, opacity, depthWrite: false,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
  }));
  const beamMaterial = glow(keep(ramp(16)), cfg.beam.opacity);
  const cone = keep(new THREE.ConeGeometry(cfg.beam.radius, cfg.beam.length, 14, 1, true));
  const beams = head.map((lens) => {
    const beam = new THREE.Mesh(cone, beamMaterial);
    beam.rotation.x = -Math.PI / 2 + cfg.beam.tilt; // apex at the lamp, opening ahead (+Z), dipped a little
    beam.position.set(lens.position.x, lens.position.y, front + cfg.beam.length / 2);
    beam.position.y -= Math.sin(cfg.beam.tilt) * cfg.beam.length / 2;
    root.add(beam);
    return beam;
  });
  const pool = new THREE.Mesh(plane, glow(keep(ramp(16, true)), cfg.pool.opacity));
  pool.rotation.x = -Math.PI / 2;
  pool.scale.set(cfg.pool.width, cfg.pool.length, 1);
  pool.position.set(0, cfg.pool.y, front + cfg.pool.length / 2);
  root.add(pool);

  // The fade to the receipt (a plain DOM layer; none in tests).
  let fade = null;
  function fadeTo(opacity, seconds) {
    if (!doc) return;
    if (!fade) {
      fade = doc.createElement('div');
      fade.className = 'van-fade';
      Object.assign(fade.style, { position: 'fixed', inset: '0', background: cfg.fade.color, opacity: '0',
        pointerEvents: 'none', zIndex: String(cfg.fade.zIndex) });
      doc.body.append(fade);
    }
    fade.style.transition = `opacity ${seconds}s ease-in-out`;
    fade.style.opacity = String(opacity);
  }

  let clock = 0, starting = -1, onReceipt = null, hazardOn = false;
  const colour = new THREE.Color();
  const toListener = new THREE.Vector3();
  const show = (list, on, brightness = 1, color = null) => list.forEach((mesh) => {
    mesh.visible = on;
    if (color !== null) mesh.material.color.copy(colour.setHex(color).multiplyScalar(brightness));
  });

  function update(dt, { ready = false, won = false, listener = null } = {}) {
    clock += dt;
    if (starting >= 0) {
      const before = starting;
      starting += dt;
      if (before < cfg.catchSeconds && starting >= cfg.catchSeconds) sound?.play(cfg.engine);
      if (before < cfg.fadeFrom && starting >= cfg.fadeFrom) fadeTo(1, cfg.receiptSeconds - cfg.fadeFrom);
      if (starting >= cfg.receiptSeconds) {
        const done = onReceipt;
        starting = -1;
        onReceipt = null;
        done?.();
        fadeTo(0, cfg.fade.outSeconds);
      }
    }
    if (!won && starting < 0) onReceipt = null;
    const cranking = starting >= 0 && starting < cfg.catchSeconds;
    const blinking = (ready && !won) || cranking;
    const engineOn = won && !cranking;
    root.visible = blinking || engineOn;
    if (!root.visible) { hazardOn = false; return; }

    // Hazards: on for half of each blink; the relay clicks at each change, quieter with distance.
    const on = blinking && (clock * cfg.hazardHz) % 1 < 0.5;
    if (on !== hazardOn && blinking && listener) {
      const volume = 1 - toListener.copy(root.position).sub(listener).length() / cfg.tick.hearMeters;
      if (volume > 0) sound?.play(cfg.tick.sound, { volume: on ? volume : volume * 0.6 });
    }
    hazardOn = on;
    show(hazards, on);

    // Headlights: a stutter while the starter cranks, then full; the cracked one never quite settles.
    const crank = cranking ? 0.25 + 0.25 * Math.abs(Math.sin(starting * 23)) : 1;
    for (const lens of head) {
      const flicker = lens.userData.side === cfg.flicker.side
        ? 1 - cfg.flicker.depth * Math.max(0, Math.sin(clock * cfg.flicker.rate) * Math.sin(clock * cfg.flicker.rate * 0.37)) : 1;
      lens.visible = cranking || engineOn;
      lens.material.color.copy(colour.setHex(cfg.headlights.color).multiplyScalar(crank * flicker));
    }
    show(tail, engineOn);
    for (const beam of beams) beam.visible = engineOn;
    pool.visible = engineOn;
  }

  return {
    root,
    update,
    get starting() { return starting >= 0; },
    /** The drive-off: crank, catch, lights, fade; onReceipt() when the screen is black. */
    start(receipt) {
      starting = 0;
      onReceipt = receipt;
      sound?.play(cfg.starter);
    },
    dispose() {
      root.removeFromParent();
      for (const thing of owned) thing.dispose();
      fade?.remove();
    },
  };
}
