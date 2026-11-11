// =============================================================================
// THE GLITTER BOMB GREETING CARD (Kiosk Kevin, Tactical; numbers: config/kiosk.js products.glitterBomb).
// It opens where it first touches anything: up to maxTargets zombies round it (in sight of it, nearest first) are confused and
// fight each other. This is Build-A-Blaster's Glitter confusion, the SAME path: zombie.applyConfusion and zombies/confusion.js,
// with source 'equipment' so a kill made by a confused zombie is an equipment kill. Bosses refuse it (applyConfusion says no),
// and so do a rising zombie, a frozen Mannequin and one still immune from its last dose. It deals no damage itself.
//
//   openGlitterBomb({ product, point, targets, round, effects, sound }) -> the zombies it confused
//   `targets` = the zombies near the point (game/equipment.js targetsNear), nearest first.
// =============================================================================

import * as THREE from 'three';
import { confusionDamage } from './equipmentDamage.js';

const UP = new THREE.Vector3(0, 1, 0);

export function openGlitterBomb({ product, point, targets, round, effects, sound }) {
  const { confuse } = product;
  const damage = confusionDamage(confuse, round);
  const confused = [];
  for (const target of targets) {
    if (confused.length >= confuse.maxTargets) break;
    if (target.applyConfusion(confuse.seconds, damage, 'equipment')) confused.push(target);
  }
  effects?.confetti(point, UP, product.look.burst);
  sound?.play(product.sounds.open);
  return confused;
}
