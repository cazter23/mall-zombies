// =============================================================================
// THE GRAND FINALE SPARKLER CAKE (Kiosk Kevin, Lethal; numbers: config/kiosk.js products.sparklerCake).
// Once it lands it sits and sprays sparks: every pulse, each zombie round it (in sight of it) is set burning through
// zombie.applyBurn, the same burn as Build-A-Blaster's Fryer Oil, with source 'equipment' so the ticks (and a kill) are
// equipment's. A boss burns at half strength (equipmentDamage.js burnDamage). Burns don't stack: a zombie that stays in the
// sparks just keeps burning. No 'hit' events (no +10): kills pay through 'kill'.
//
//   pulseSparklerCake({ product, point, targets, round, effects }) -> the zombies it lit this pulse
// =============================================================================

import * as THREE from 'three';
import { burnDamage } from './equipmentDamage.js';

const UP = new THREE.Vector3(0, 1, 0);

export function pulseSparklerCake({ product, point, targets, round, effects }) {
  const { spray } = product;
  const lit = [];
  for (const target of targets) {
    if (!target.isAlive) continue;
    target.applyBurn(burnDamage(target, spray, round), spray.burn.seconds, spray.burn.tickSeconds, 'equipment');
    lit.push(target);
  }
  effects?.confetti(point.clone().setY(point.y + 0.25), UP, product.look.sparks);
  return lit;
}
