// =============================================================================
// PLAYER GUN (loadout)
// The guns the player carries (two slots, COD-style) and everything that connects
// the one in hand to the rest of the game: reads the trigger/reload/switch input,
// updates aim (ADS + spread), fires the hitscan ray inside the spread cone,
// applies damage (with headshots and the player's stat multipliers), and
// triggers the feedback: camera recoil, gun-model recoil, muzzle flash, sound,
// tracer, splatter and hit markers, all on the same tick as the shot.
// Reload sounds and bumps fire from the weapon's reload events, on the same clock
// as the reload animation, so they always line up.
//
// Slots: you start with one gun. Buying a gun fills the empty slot; with both full
// it replaces the gun in your hands. Each gun keeps its own ammo. Switching
// (feel.weaponSwitch) drops the gun out of view and raises the other; no shooting
// or aiming until it's up, and a reload in progress is cancelled.
// =============================================================================

import * as THREE from 'three';
import { feel } from '../config/feel.js';
import { Weapon } from './weapon.js';
import { castShot } from './hitscan.js';
import { createAim } from './aim.js';

const DEG_TO_RAD = Math.PI / 180;
const MAX_SLOTS = 2;

export function createPlayerGun({
  def, // the starting gun
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
  const startDef = def;
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const muzzle = new THREE.Vector3();
  let lastReloadProgress = null; // for spotting reload events as the clock passes them
  let reloadRequested = false; // set by requestReload() (e.g. a controller X tap next to a buyable)

  // A slot = one carried gun: its ammo/cooldown state and its own aim (ADS/spread) settings.
  const makeSlot = (d) => ({ def: d, weapon: new Weapon(d, stats), aim: createAim({ def: d, input, player }) });
  let slots = [makeSlot(startDef)];
  let current = 0; // index of the gun in hand

  // Switching: null, or { from: slot shown while it drops away, timer: seconds since the switch started }.
  // (`from` can be a slot that was just replaced by a bought gun: it still drops away visibly.)
  let switching = null;

  const ws = feel.weaponSwitch;

  function startSwitch(toIndex, fromSlot = slots[current]) {
    if (toIndex === current && fromSlot === slots[current]) return;
    slots[current].weapon.cancelReload();
    current = toIndex;
    slots[current].weapon.cancelReload();
    slots[current].aim.reset(); // comes up at the hip
    switching = { from: fromSlot, timer: 0 };
  }

  function fire(slot) {
    const { def: d, aim } = slot;
    player.getAim(origin, direction);
    aim.applySpread(direction); // random point inside the current spread cone
    aim.onShot(); // firing quickly widens the cone
    // Piercing guns (def.pierce) go through several zombies in a line, weaker after each one.
    const pierce = d.pierce ?? null;
    const shot = castShot(origin, direction, d.range, colliders, shootables, pierce ? pierce.maxTargets : 1);

    // Feedback, all this tick. Camera recoil (moves the crosshair, springs back) uses the aim
    // from before the kick, so this shot lands exactly where you were looking.
    const r = d.recoil;
    const ads = aim.amount;
    const cameraScale = 1 + (r.adsMultiplier - 1) * ads;
    const side = () => (Math.random() < 0.5 ? -1 : 1);
    player.addRecoil(
      r.pitchDegrees * DEG_TO_RAD * cameraScale,
      side() * r.rollDegrees * DEG_TO_RAD * cameraScale,
      side() * (r.yawDegrees ?? 0) * DEG_TO_RAD * cameraScale * (0.5 + Math.random() * 0.5),
    );
    viewmodel.fire(ads); // gun kick + muzzle flash (visual only)
    if (sound) sound.play(d.sounds.fire);
    effects.tracer(viewmodel.getMuzzleWorldPosition(muzzle), shot.end, d.tracerColor);

    // Every zombie the shot went through (just one for most guns), nearest first.
    let anyKilled = false;
    shot.hits.forEach((hit, i) => {
      const headshot = hit.part === 'head';
      const falloff = pierce ? pierce.damageFalloff[Math.min(i, pierce.damageFalloff.length - 1)] : 1;
      const damage = d.damage * (headshot ? d.headshotMultiplier : 1) * falloff * stats.damageMultiplier;
      const { killed } = hit.target.takeHit({ damage, part: hit.part, point: hit.point });
      anyKilled = anyKilled || killed;
      const count = headshot ? feel.effects.headshotSplatCount : feel.effects.splatCount;
      effects.splat(hit.point, hit.normal, hit.target.splatColors, count);
      if (onHit) onHit({ target: hit.target, killed, headshot, melee: false });
    });
    if (shot.hits.length > 0) {
      hud.showHitMarker({ headshot: shot.hits[0].part === 'head', killed: anyKilled });
    }
    // Hit a wall or prop (if the shot made it that far).
    if (shot.hits.length < (pierce ? pierce.maxTargets : 1) && shot.end.distanceTo(origin) < d.range - 1e-3) {
      effects.puff(shot.end, shot.endNormal);
    }
    if (onShot) onShot(shot);
    return shot;
  }

  // Sounds and bumps placed along the reload (config: viewmodel.reload.events).
  function runReloadEvents(slot) {
    const progress = slot.weapon.reloadProgress;
    if (progress !== null) {
      const from = lastReloadProgress ?? -1; // a reload that just started counts from before 0
      for (const event of slot.def.viewmodel.reload.events) {
        if (event.at <= from || event.at > progress) continue;
        if (event.sound && sound) sound.play(event.sound);
        if (event.jolt) viewmodel.jolt(event.jolt);
      }
    }
    lastReloadProgress = progress;
  }

  return {
    lastShot: null, // most recent shot result (handy for debugging)

    // The gun in hand.
    get weapon() {
      return slots[current].weapon;
    },
    get aim() {
      return slots[current].aim;
    },
    get def() {
      return slots[current].def;
    },
    get slots() {
      return slots.map((s) => s.def.id);
    },

    // For the viewmodel: which gun model is showing, and how far out of view it is (0 up .. 1 gone).
    get shownDef() {
      if (switching && switching.timer < ws.lowerSeconds) return switching.from.def;
      return slots[current].def;
    },
    get switchLower() {
      if (!switching) return 0;
      if (switching.timer < ws.lowerSeconds) return switching.timer / ws.lowerSeconds;
      return 1 - Math.min(1, (switching.timer - ws.lowerSeconds) / ws.raiseSeconds);
    },
    get isSwitching() {
      return switching !== null;
    },

    owns(id) {
      return slots.some((s) => s.def.id === id);
    },

    // The carried Weapon with this id (or null).
    weaponFor(id) {
      const slot = slots.find((s) => s.def.id === id);
      return slot ? slot.weapon : null;
    },

    /**
     * Bought a gun off the wall. Already have it: full ammo. Room in the loadout: added and
     * switched to. Loadout full: it replaces the gun in your hands (the old one drops away).
     */
    give(newDef) {
      const owned = slots.findIndex((s) => s.def.id === newDef.id);
      if (owned !== -1) {
        slots[owned].weapon.refill();
        return;
      }
      if (slots.length < MAX_SLOTS) {
        slots.push(makeSlot(newDef));
        startSwitch(slots.length - 1);
      } else {
        const old = slots[current];
        old.weapon.cancelReload();
        slots[current] = makeSlot(newDef);
        startSwitch(current, old);
      }
    },

    // Fixed-tick update. `blocked` (e.g. mid melee swing): no firing, reloading or switching this tick.
    // `reloadPaused` (e.g. vaulting): a reload in progress waits instead of continuing.
    update(dt, blocked = false, reloadPaused = false) {
      // --- Weapon switching ---
      const swap = input.consumeAction('switchWeapon');
      const pick1 = input.consumeAction('weapon1');
      const pick2 = input.consumeAction('weapon2');
      if (!blocked && !switching && slots.length > 1) {
        if (swap) startSwitch((current + 1) % slots.length);
        else if (pick1 && current !== 0) startSwitch(0);
        else if (pick2 && current !== 1) startSwitch(1);
      }
      if (switching) {
        switching.timer += dt;
        if (switching.timer >= ws.lowerSeconds + ws.raiseSeconds) switching = null;
      }

      const slot = slots[current];
      const busy = blocked || switching !== null;
      slot.aim.update(dt, !busy); // melee/vaulting also lower ADS; no snap during a committed action
      if (aimAssist) {
        if (busy) aimAssist.reset();
        else aimAssist.update(dt, slot.aim);
      }
      const trigger = input.consumeAction('fire');
      const triggerHeld = input.actionDown('fire');
      const reload = input.consumeAction('reload') || reloadRequested;
      reloadRequested = false;
      // Shooting while sprinting: drop to a walk and bring the gun up out of the running pose before
      // the shot goes off (the click is buffered, so it fires as soon as the gun is up).
      const wantsToFire = trigger || (triggerHeld && slot.def.fireMode === 'auto');
      if (wantsToFire && !busy) {
        if (player.isSprinting || player.sprintAmount > 0.3) {
          slot.weapon.cooldown = Math.max(slot.weapon.cooldown, feel.sprint.sprintOutSeconds * player.sprintAmount);
        }
        player.blockSprint(feel.sprint.fireBlocksSprintSeconds);
      }
      const result = slot.weapon.update(dt, {
        triggerPressed: trigger,
        triggerHeld,
        reloadPressed: reload,
        blocked: busy,
        reloadPaused,
      });
      if (result === 'fire') this.lastShot = fire(slot);
      else if (result === 'empty') {
        // Dry click on an empty mag (the weapon starts reloading by itself).
        viewmodel.dryFire();
        if (sound) sound.play(slot.def.sounds.dryFire);
      }
      runReloadEvents(slot);
    },

    // Reload as if the reload button was pressed (next tick).
    requestReload() {
      reloadRequested = true;
    },

    // New run: just the starting gun, full ammo, hip fire.
    reset() {
      slots = [makeSlot(startDef)];
      current = 0;
      switching = null;
      reloadRequested = false;
      lastReloadProgress = null;
      this.lastShot = null;
    },
  };
}
