// =============================================================================
// THE SPIN-O-MATIC SENTRY (Kiosk Kevin, Lethal; numbers: config/kiosk.js products.sentry.turret).
// Once deployed (game/equipment.js settles it where it lands) it fires at the nearest zombie it can see, every fireSeconds, for
// lifeSeconds. Targets: alive, a zombie type, not noRewards (never Sunny, fans or dummies), up out of the floor, within range,
// with nothing solid between its muzzle and the zombie's body. The shot is the hitscan (weapons/hitscan.js castShot) from its own
// muzzle, against zombies only, so nothing else can soak it up. Damage: turret.damage x equipmentPower(round), always a body hit
// (it can't aim: no headshot pay, no helmet bonus); bosses are hit normally. takeHit source 'equipment', weaponId 'sentry': its
// kills pay through 'kill', and it never emits 'hit' (no +10). It has no collider and nothing can target it (decision 5).
//
//   sentryTarget({ muzzle, turret, shootables, colliders })  the zombie it would shoot now, or null
//   fireSentry({ muzzle, turret, target, shootables, colliders, round, effects, sound, fireSound, look }) -> { target, damage, killed } or null
// =============================================================================

import * as THREE from 'three';
import { castShot } from '../../weapons/hitscan.js';
import { equipmentPower } from './equipmentDamage.js';

const centre = new THREE.Vector3();
const toTarget = new THREE.Vector3();

const canTarget = (target) => target.isAlive && target.type && !target.noRewards && target.state !== 'spawning';

/** The middle of a zombie's body hitbox (where it aims). */
function bodyCentre(target, out) {
  const hitbox = target.hitboxes?.find((h) => h.part === 'body') ?? target.hitboxes?.[0];
  if (hitbox) return hitbox.box.getCenter(out);
  return out.copy(target.position).setY(target.position.y + (target.type.height ?? 1.8) * 0.55);
}

export function sentryTarget({ muzzle, turret, shootables, colliders }) {
  const inRange = [];
  for (const target of shootables) {
    if (!canTarget(target)) continue;
    const distance = bodyCentre(target, centre).distanceTo(muzzle);
    if (distance <= turret.range) inRange.push({ target, distance });
  }
  inRange.sort((a, b) => a.distance - b.distance);
  for (const { target, distance } of inRange) { // nearest first; the first with a clear line wins
    toTarget.copy(bodyCentre(target, centre)).sub(muzzle).divideScalar(Math.max(distance, 1e-6));
    if (!castShot(muzzle, toTarget, distance, colliders, []).worldHit) return target;
  }
  return null;
}

export function fireSentry({ muzzle, turret, target, shootables, colliders, round, effects, sound, fireSound, look }) {
  const direction = bodyCentre(target, centre).sub(muzzle).normalize();
  const zombiesOnly = shootables.filter(canTarget);
  const shot = castShot(muzzle, direction, turret.range, colliders, zombiesOnly);
  effects?.tracer(muzzle, shot.target ? shot.point : shot.end, look.tracer);
  if (fireSound) sound?.play(fireSound, { volume: 0.55 });
  if (!shot.target) return null;
  const damage = turret.damage * equipmentPower(round);
  const { killed } = shot.target.takeHit({
    damage, part: 'body', source: 'equipment', weaponId: turret.weaponId, direction: direction.clone(), impact: turret.impact,
  });
  effects?.splat(shot.point, shot.normal, shot.target.splatColors, 4, { flesh: true, direction });
  return { target: shot.target, damage, killed };
}
