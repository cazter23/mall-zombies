// =============================================================================
// PLAYER GUN
// Connects the held weapon to everything else: reads the trigger/reload input,
// updates aim (ADS + spread), fires the hitscan ray inside the spread cone,
// applies damage (with headshots and the player's stat multipliers), and
// triggers the feedback: camera recoil, gun-model recoil, muzzle flash, sound,
// tracer, splatter and hit markers, all on the same tick as the shot.
// Reload sounds and bumps fire from the weapon's reload events, on the same clock
// as the reload animation, so they always line up.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { Weapon } from './weapon.js';
import { castShot } from './hitscan.js';
import { createAim } from './aim.js';

const DEG_TO_RAD = Math.PI / 180;

export function createPlayerGun({
  def,
  stats,
  player,
  input,
  colliders,
  shootables,
  effects,
  viewmodel,
  hud,
  sound = null, // optional (audio/sound.js)
  onShot = null,
  onHit = null, // ({ target, killed, headshot, melee }) after any hit on a shootable (points)
  aimAssist = null, // optional (weapons/aimAssist.js): controller aim help, applied before each shot
}) {
  const weapon = new Weapon(def, stats);
  const aim = createAim({ def, input, player });
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  let lastReloadProgress = null; // for spotting reload events as the clock passes them
  let reloadRequested = false; // set by requestReload() (e.g. a controller X tap next to a buyable)

  function fire() {
    player.getAim(origin, direction);
    aim.applySpread(direction); // random point inside the current spread cone
    aim.onShot(); // firing quickly widens the cone
    const shot = castShot(origin, direction, def.range, colliders, shootables);

    // Feedback, all this tick. Camera recoil (moves the crosshair, springs back) uses the aim
    // from before the kick, so this shot lands exactly where you were looking.
    const r = def.recoil;
    const ads = aim.amount;
    const cameraScale = 1 + (r.adsMultiplier - 1) * ads;
    const rollSide = Math.random() < 0.5 ? -1 : 1;
    player.addRecoil(r.pitchDegrees * DEG_TO_RAD * cameraScale, rollSide * r.rollDegrees * DEG_TO_RAD * cameraScale);
    viewmodel.fire(ads); // gun kick + muzzle flash (visual only)
    if (sound) sound.play(def.sounds.fire);
    effects.tracer(viewmodel.getMuzzleWorldPosition(muzzle), shot.point, def.tracerColor);

    if (shot.target) {
      const headshot = shot.part === 'head';
      const damage = def.damage * (headshot ? def.headshotMultiplier : 1) * stats.damageMultiplier;
      const { killed } = shot.target.takeHit({ damage, part: shot.part, point: shot.point });
      const count = headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount;
      effects.splat(shot.point, shot.normal, shot.target.splatColors, count);
      hud.showHitMarker({ headshot, killed });
      if (onHit) onHit({ target: shot.target, killed, headshot, melee: false });
    } else if (shot.distance < def.range) {
      effects.puff(shot.point, shot.normal); // hit a wall or prop
    }
    if (onShot) onShot(shot);
    return shot;
  }

  // Sounds and bumps placed along the reload (config: viewmodel.reload.events).
  function runReloadEvents() {
    const progress = weapon.reloadProgress;
    if (progress !== null) {
      const from = lastReloadProgress ?? -1; // a reload that just started counts from before 0
      for (const event of def.viewmodel.reload.events) {
        if (event.at <= from || event.at > progress) continue;
        if (event.sound && sound) sound.play(event.sound);
        if (event.jolt) viewmodel.jolt(event.jolt);
      }
    }
    lastReloadProgress = progress;
  }

  return {
    weapon,
    aim,
    lastShot: null, // most recent shot result (handy for debugging)

    // Fixed-tick update. `blocked` (e.g. mid melee swing): no firing or reloading this tick.
    update(dt, blocked = false) {
      aim.update(dt); // ADS + spread first, so this tick's shot uses them
      if (aimAssist) aimAssist.update(dt, aim); // then controller aim assist nudges the view
      const trigger = input.consumeAction('fire');
      const reload = input.consumeAction('reload') || reloadRequested;
      reloadRequested = false;
      const result = weapon.update(dt, { triggerPressed: trigger, reloadPressed: reload, blocked });
      if (result === 'fire') this.lastShot = fire();
      else if (result === 'empty') {
        // Dry click on an empty mag (the weapon starts reloading by itself).
        viewmodel.dryFire();
        if (sound) sound.play(def.sounds.dryFire);
      }
      runReloadEvents();
    },

    // Reload as if the reload button was pressed (next tick).
    requestReload() {
      reloadRequested = true;
    },

    // Full ammo and hip fire, for a new run.
    reset() {
      weapon.reset();
      aim.reset();
      reloadRequested = false;
      lastReloadProgress = null;
      this.lastShot = null;
    },
  };
}
