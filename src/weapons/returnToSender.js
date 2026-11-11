import { Vector3 } from 'three';
import { weapons } from '../config/weapons.js';
import { INSTANT_KILL_DAMAGE, isReturnable } from './gunStats.js';

const UP = new Vector3(0, 1, 0);

// Both finishes use the real damage/kill path. No payout or checklist state is changed here.
export function returnToSender(target, { effects, sound, point = target.position, normal = UP, part = 'body', direction = null, impact = null, distance = null }) {
  if (!target.isAlive || !isReturnable(target)) return { killed: false };
  const def = weapons.returnToSender;
  const result = target.takeHit({ damage: INSTANT_KILL_DAMAGE, part, source: 'gun', returnHit: true, weaponId: def.id, direction, impact, distance });
  if (result.killed) {
    effects.confetti(point, normal, def.instantKill.box);
    sound?.play('returnStamp');
  }
  return result;
}
