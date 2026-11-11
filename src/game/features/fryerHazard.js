// =============================================================================
// FRYER BLAST (map feature kind 'fryerHazard', docs/archive/hazards-plan.md):
// Food Court CORN DOG CORRAL counter fryer valve (switch style 'valve'). Pay to vent superheated
// oil from both deep fryers across the counter apron (`x: 2.5..9.0, z: -13.0..-6.5`);
// blasts scalding oil (`source: 'hazard'`) that scalds and slips zombies flat on their
// backs (and lightly scalds/slows a player standing in the grease apron), then enters
// a recharging cooldown.
// Looks: a dark glossy oil slick with a bright rim and a hot wave sweeping across it, bubbles that swell and pop
// all over it, boiling vats behind the counter, steam puffs and oil streams each pulse. Every bubble is one
// instance of one mesh (two draw calls for all of them); no lights.
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { createHazard, dealHazardDamage } from './hazards.js';

const UP = new THREE.Vector3(0, 1, 0);

function floorMaterial(color, opacity) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
}

export function buildFryerHazard(feature, ctx) {
  const cfg = hazards.fryer;
  const { scene, zombies, effects, sound, events } = ctx;
  const { minX, maxX, minZ, maxZ } = cfg.bounds;
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const ew = cfg.edgeWidth;

  // Everything the blast shows, hidden unless it is venting.
  const fieldGroup = new THREE.Group();
  fieldGroup.name = 'fryer_hazard_field';
  fieldGroup.userData.dynamic = true;
  fieldGroup.visible = false;

  // 1. The slick: dark hot oil over the whole apron, a bright rim round it, and a hot wave sweeping away from the counter.
  const slickMat = floorMaterial(cfg.slickColor, cfg.slickOpacity);
  const slickGeo = new THREE.PlaneGeometry(spanX, spanZ);
  slickGeo.rotateX(-Math.PI / 2);
  const floorSlick = new THREE.Mesh(slickGeo, slickMat);
  floorSlick.position.set(centerX, cfg.slickY, centerZ);
  fieldGroup.add(floorSlick);

  const edgeMat = floorMaterial(cfg.slickEdgeColor, cfg.edgeOpacity);
  for (const zEdge of [minZ + ew / 2, maxZ - ew / 2]) {
    const hGeo = new THREE.PlaneGeometry(spanX, ew);
    hGeo.rotateX(-Math.PI / 2);
    const hStrip = new THREE.Mesh(hGeo, edgeMat);
    hStrip.position.set(centerX, cfg.edgeY, zEdge);
    fieldGroup.add(hStrip);
  }
  for (const xEdge of [minX + ew / 2, maxX - ew / 2]) {
    const vGeo = new THREE.PlaneGeometry(ew, spanZ - ew * 2);
    vGeo.rotateX(-Math.PI / 2);
    const vStrip = new THREE.Mesh(vGeo, edgeMat);
    vStrip.position.set(xEdge, cfg.edgeY, centerZ);
    fieldGroup.add(vStrip);
  }

  const waveMat = floorMaterial(cfg.waveColor, cfg.waveOpacity);
  const waveGeo = new THREE.PlaneGeometry(spanX - ew * 2, cfg.waveDepth);
  waveGeo.rotateX(-Math.PI / 2);
  const waveMesh = new THREE.Mesh(waveGeo, waveMat);
  waveMesh.position.set(centerX, cfg.waveY, minZ + cfg.waveDepth / 2);
  fieldGroup.add(waveMesh);

  // 2. Superheated fryer vat glow behind the counter + twin counter-lip vent nozzles.
  const vatMat = new THREE.MeshBasicMaterial({ color: cfg.slickEdgeColor, transparent: true, opacity: cfg.vatGlowOpacity, depthWrite: false });
  for (const vat of cfg.vatCenters) {
    const vatGlow = new THREE.Mesh(new THREE.BoxGeometry(cfg.vatSize.width, cfg.vatSize.height, cfg.vatSize.depth), vatMat);
    vatGlow.position.set(vat.x, vat.y, vat.z);
    fieldGroup.add(vatGlow);
  }
  const nozzles = cfg.nozzlePositions.map((n) => new THREE.Vector3(n.x, n.y, n.z));
  for (const p of nozzles) {
    const nozzleMesh = new THREE.Mesh(new THREE.BoxGeometry(cfg.nozzleSize.width, cfg.nozzleSize.height, cfg.nozzleSize.depth), waveMat);
    nozzleMesh.position.copy(p);
    fieldGroup.add(nozzleMesh);
  }

  // 3. Bubbles on the slick: each swells and pops over `seconds`, then comes back somewhere else.
  const fb = cfg.floorBubbles;
  const bubbleGeo = new THREE.CircleGeometry(1, fb.segments);
  bubbleGeo.rotateX(-Math.PI / 2);
  const floorBubbles = new THREE.InstancedMesh(bubbleGeo, new THREE.MeshBasicMaterial({ color: fb.color, depthWrite: false }), fb.count);
  floorBubbles.name = 'fryer_floor_bubbles';
  floorBubbles.frustumCulled = false; // (instances spread over the apron; the base geometry sits at the origin)
  const bubbles = Array.from({ length: fb.count }, (_, i) => ({ x: 0, z: 0, size: 0, age: (i / fb.count) * fb.seconds }));
  const placeBubble = (b) => {
    b.x = minX + ew + Math.random() * (spanX - ew * 2);
    b.z = minZ + ew + Math.random() * (spanZ - ew * 2);
    b.size = fb.minSize + Math.random() * (fb.maxSize - fb.minSize);
  };
  bubbles.forEach(placeBubble);
  fieldGroup.add(floorBubbles);

  // ...and boiling in the vats.
  const vb = cfg.vatBubbles;
  const vatBubbles = new THREE.InstancedMesh(new THREE.BoxGeometry(vb.size, vb.size, vb.size), new THREE.MeshBasicMaterial({ color: vb.color }), vb.perVat * cfg.vatCenters.length);
  vatBubbles.name = 'fryer_vat_bubbles';
  vatBubbles.frustumCulled = false;
  const vatSpots = [];
  for (const vat of cfg.vatCenters) {
    for (let i = 0; i < vb.perVat; i++) {
      vatSpots.push({
        x: vat.x + ((i + 0.5) / vb.perVat - 0.5) * cfg.vatSize.width * 0.85,
        z: vat.z + (((i * 7) % vb.perVat) / vb.perVat - 0.5) * cfg.vatSize.depth * 0.7,
        phase: (i * 0.37) % 1,
      });
    }
  }
  fieldGroup.add(vatBubbles);

  scene.add(fieldGroup);

  const dummy = new THREE.Object3D();
  function animateBubbles(dt, time) {
    bubbles.forEach((b, i) => {
      b.age += dt;
      if (b.age >= fb.seconds) {
        b.age -= fb.seconds;
        placeBubble(b);
      }
      const s = b.size * Math.sin((b.age / fb.seconds) * Math.PI); // swells, then pops
      dummy.position.set(b.x, fb.y, b.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s, 1, s);
      dummy.updateMatrix();
      floorBubbles.setMatrixAt(i, dummy.matrix);
    });
    floorBubbles.instanceMatrix.needsUpdate = true;
    vatSpots.forEach((spot, i) => {
      const t = (time * vb.hz + spot.phase) % 1;
      dummy.position.set(spot.x, vb.y + t * vb.rise, spot.z);
      dummy.rotation.set(t * 3, t * 5, 0);
      const s = Math.sin(t * Math.PI);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      vatBubbles.setMatrixAt(i, dummy.matrix);
    });
    vatBubbles.instanceMatrix.needsUpdate = true;
  }

  const targetVec = new THREE.Vector3();
  const prevPt = new THREE.Vector3();
  const nextPt = new THREE.Vector3();
  const floorJetEnd = new THREE.Vector3();
  const steamPoint = new THREE.Vector3();
  let waveAge = 0;
  let idleCursor = 0;
  let time = 0;

  /** Fires an arcing multi-segment stream of scalding oil from `from` to `to`. */
  function fireOilJet(from, to, jitterScale = 1) {
    if (!effects?.tracer) return;
    const segs = cfg.jetSegments;
    const jitter = cfg.jetJitter * jitterScale;
    prevPt.copy(from);
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      nextPt.lerpVectors(from, to, t);
      if (i < segs) {
        const arc = Math.sin(t * Math.PI);
        nextPt.x += (Math.random() - 0.5) * 2 * jitter * arc;
        nextPt.y += cfg.jetArcHeight * arc + (Math.random() - 0.5) * jitter * arc;
        nextPt.z += (Math.random() - 0.5) * 2 * jitter * arc;
      }
      effects.tracer(prevPt, nextPt, cfg.slickEdgeColor);
      effects.tracer(prevPt, nextPt, cfg.waveColor);
      prevPt.copy(nextPt);
    }
  }

  function nearestNozzle(pos) {
    let best = nozzles[0];
    let bestD = Infinity;
    for (const p of nozzles) {
      const d = (p.x - pos.x) ** 2 + (p.z - pos.z) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function isInside(pos) {
    if (!pos || Math.abs(pos.y) > cfg.maxHeight) return false;
    return pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ;
  }

  return createHazard({
    feature,
    ctx,
    cfg,
    isPlayerInside: isInside,
    onActivate() {
      fieldGroup.visible = true;
      waveAge = 0;
      slickMat.opacity = cfg.slickOpacity;
      vatMat.opacity = cfg.vatGlowOpacity;
      waveMat.opacity = cfg.waveOpacity;
      animateBubbles(0, time);
    },
    onTick(dt, remaining) {
      time += dt;
      waveAge = (waveAge + dt) % cfg.pulseInterval;
      const progress = waveAge / cfg.pulseInterval;
      waveMesh.position.z = minZ + cfg.waveDepth / 2 + (spanZ - cfg.waveDepth) * progress;
      waveMat.opacity = (1 - progress) * cfg.waveOpacity;
      const simmer = cfg.simmer.base + cfg.simmer.amplitude * Math.sin(remaining * cfg.simmer.speed);
      slickMat.opacity = cfg.slickOpacity * simmer;
      vatMat.opacity = cfg.vatGlowOpacity * simmer;
      animateBubbles(dt, time);
    },
    onPulse(isOpening) {
      waveAge = 0;
      for (const nozzle of nozzles) {
        effects?.flash?.(nozzle, cfg.slickEdgeColor, { size: cfg.flashRadius, seconds: cfg.flashDuration });
      }
      if (cfg.pulseSound) sound?.play(cfg.pulseSound);

      // Steam off the vats and off the slick.
      for (const vat of cfg.vatCenters) {
        effects?.splat?.(steamPoint.set(vat.x, vat.y + 0.1, vat.z), UP, cfg.steam.colors, cfg.steam.perVat);
      }
      for (let i = 0; i < cfg.steam.onApron; i++) {
        steamPoint.set(minX + Math.random() * spanX, cfg.waveY, minZ + Math.random() * spanZ);
        effects?.splat?.(steamPoint, UP, cfg.steam.colors, cfg.steam.perVat);
      }

      // Ambient hot-oil streams jetting from the counter nozzles across the grease apron.
      for (let i = 0; i < cfg.idleJetCount; i++) {
        idleCursor = (idleCursor + 0.37) % 1;
        const u = ((i + idleCursor) / cfg.idleJetCount) % 1;
        const v = 0.15 + 0.75 * ((idleCursor * 1.7 + i * 0.29) % 1);
        floorJetEnd.set(minX + ew + u * (spanX - ew * 2), cfg.waveY, minZ + ew + v * (spanZ - ew * 2));
        fireOilJet(nozzles[i % nozzles.length], floorJetEnd, 0.75);
        effects?.splat?.(floorJetEnd, UP, cfg.hitSparkColors, cfg.idleSparkCount);
      }

      // Scald and slip every live zombie standing on the counter apron.
      const baseDamage = isOpening ? cfg.burstDamage : cfg.zombieDamage;
      for (const zombie of [...(zombies?.zombies ?? [])]) {
        if (!zombie.isAlive || !isInside(zombie.position)) continue;
        targetVec.set(zombie.position.x, zombie.position.y + cfg.zombieTargetYOffset, zombie.position.z);
        fireOilJet(nearestNozzle(zombie.position), targetVec, 1.0);
        effects?.splat?.(targetVec, UP, cfg.hitSparkColors, cfg.hitSparkCount);
        effects?.flash?.(targetVec, cfg.slickEdgeColor, { size: cfg.hitFlashRadius, seconds: cfg.hitFlashDuration });
        zombie.applySlip?.(cfg.slipDuration, cfg.slipDrag);
        if (dealHazardDamage(zombie, baseDamage, cfg)?.killed) {
          events.emit('fryerKill', { zombie });
        }
      }
    },
    onStop() {
      fieldGroup.visible = false;
    },
  });
}
