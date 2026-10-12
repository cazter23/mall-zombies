// =============================================================================
// PLAYER GUN
// Connects the held weapon to everything else: reads the trigger/reload input,
// updates aim (ADS + spread), fires the hitscan ray inside the spread cone,
// applies damage (with headshots and the player's stat multipliers), and
// triggers recoil, tracers, splatter and hit markers.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { Weapon } from './weapon.js';
import { castShot } from './hitscan.js';
import { createAim } from './aim.js';

const DEG_TO_RAD = Math.PI / 180;

export function createPlayerGun({ def, stats, player, input, colliders, shootables, effects, viewmodel, hud }) {
  const weapon = new Weapon(def, stats);
  const aim = createAim({ def, input, player });
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const muzzle = new THREE.Vector3();

  function fire() {
    player.getAim(origin, direction);
    aim.applySpread(direction); // random point inside the current spread cone
    aim.onShot(); // firing quickly widens the cone
    const shot = castShot(origin, direction, def.range, colliders, shootables);

    // Recoil: kick the view (affects aim) and the gun model (just visual).
    player.addViewKick(def.viewKickDegrees * DEG_TO_RAD);
    viewmodel.kick();
    effects.tracer(viewmodel.getMuzzleWorldPosition(muzzle), shot.point, def.tracerColor);

    if (shot.target) {
      const headshot = shot.part === 'head';
      const damage = def.damage * (headshot ? def.headshotMultiplier : 1) * stats.damageMultiplier;
      const { killed } = shot.target.takeHit({ damage, part: shot.part, point: shot.point });
      const count = headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount;
      effects.splat(shot.point, shot.normal, shot.target.splatColors, count);
      hud.showHitMarker({ headshot, killed });
    } else if (shot.distance < def.range) {
      effects.puff(shot.point, shot.normal); // hit a wall or prop
    }
    return shot;
  }

  return {
    weapon,
    aim,
    lastShot: null, // most recent shot result (handy for debugging)

    // Fixed-tick update.
    update(dt) {
      aim.update(dt); // ADS + spread first, so this tick's shot uses them
      const result = weapon.update(dt, {
        triggerPressed: input.consumePress('Mouse0'),
        reloadPressed: input.consumePress('KeyR'),
      });
      if (result === 'fire') this.lastShot = fire();
    },
  };
}
