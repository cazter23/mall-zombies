// =============================================================================
// SCAN LINE (browser side: the Barcode Scanner's scan, while the trigger is held and the charge fills)
// A thin red laser from the gun's window to whatever you aim at, and a red bar sweeping up and down across it (a checkout scanner
// reading a barcode), both brightening as the scan fills. On a zombie the bar is as wide as config says; on a wall it is a small
// dot-sized line. Hidden the moment you stop scanning. Numbers: config/weapons.js barcodeScanner.scanLine. The game runs without this.
// =============================================================================

import * as THREE from 'three';
import { castShot } from '../weapons/hitscan.js';

export function createScanLine(scene, def) {
  const cfg = def.scanLine;
  const material = new THREE.MeshBasicMaterial({ color: cfg.color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const laser = new THREE.Mesh(unit, material);
  const bar = new THREE.Mesh(unit, material);
  laser.name = 'scanLaser';
  bar.name = 'scanBar';
  laser.frustumCulled = bar.frustumCulled = false;
  const group = new THREE.Group();
  group.name = 'scanLine';
  group.add(laser, bar);
  group.visible = false;
  scene.add(group);

  const eye = new THREE.Vector3();
  const look = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  const mid = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const lookAt = new THREE.Matrix4();

  return {
    group,
    /**
     * progress: the scan's 0..1 (0 = not scanning: hidden). player.getAim gives the ray; colliders/shootables find what it lands on;
     * viewmodel.getMuzzleWorldPosition is where the laser leaves; time drives the sweep.
     */
    update({ progress, player, colliders, shootables, viewmodel, time }) {
      group.visible = progress > 0;
      if (!group.visible) return;
      player.getAim(eye, look);
      const shot = castShot(eye, look, cfg.maxRange, colliders, shootables, 1);
      viewmodel.getMuzzleWorldPosition(muzzle);
      material.opacity = cfg.opacity * (0.35 + 0.65 * progress);
      // The laser: a thin box stretched from the muzzle to the point, turned to face along it.
      const length = muzzle.distanceTo(shot.point);
      mid.addVectors(muzzle, shot.point).multiplyScalar(0.5);
      laser.position.copy(mid);
      lookAt.lookAt(muzzle, shot.point, up);
      laser.quaternion.setFromRotationMatrix(lookAt);
      laser.scale.set(cfg.laserWidth, cfg.laserWidth, length);
      // The bar: across the target, square to the view, sweeping up and down over it (a full zombie gets the full width).
      const onZombie = !!shot.target;
      const height = onZombie ? (shot.target.type?.height ?? 1.8) : 0;
      const sweep = onZombie ? Math.sin(time * cfg.sweepHz * Math.PI * 2) * cfg.sweep * height * 0.5 : 0;
      bar.position.copy(shot.point);
      if (onZombie) bar.position.y = shot.target.position.y + height * 0.5 + sweep;
      bar.quaternion.setFromRotationMatrix(lookAt.lookAt(eye, bar.position, up));
      bar.scale.set(onZombie ? cfg.barWidth : cfg.barWidth * 0.2, cfg.barHeight, cfg.barHeight);
    },
    dispose() {
      scene.remove(group);
      material.dispose();
      unit.dispose();
    },
  };
}
