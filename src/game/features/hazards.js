// =============================================================================
// HAZARDS FRAMEWORK (game/features/hazards.js): the switch (game/features/hazardSwitches.js), interaction prompt,
// ready -> active -> cooldown state machine, `source: 'hazard'` zombie damage helper,
// player-inside slow/hurt, and Play-again reset for environmental hazards (docs/archive/hazards-plan.md).
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';
import { buildHazardSwitch } from './hazardSwitches.js';

const DEG_TO_RAD = Math.PI / 180;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Deals hazard damage to a zombie through `zombie.takeHit({ ..., source: 'hazard' })`.
 * Normal zombies take at least `baseDamage` or `zombie.maxHealth * cfg.normalHealthFraction`
 * so hazards stay lethal at any round. Bosses and Mascots cap per-pulse damage to
 * `zombie.maxHealth * cfg.maxHealthCap` so a single switch softens a Boss or Mascot without melting a boss fight.
 */
export function dealHazardDamage(zombie, baseDamage, cfg) {
  if (!zombie || !zombie.isAlive || baseDamage <= 0) return false;
  const isBig = Boolean(zombie.type?.boss || zombie.type?.mascot);
  let damage = isBig && cfg?.maxHealthCap
    ? Math.min(Math.max(baseDamage, zombie.maxHealth * cfg.maxHealthCap), zombie.maxHealth * cfg.maxHealthCap)
    : Math.max(baseDamage, zombie.maxHealth * (cfg?.normalHealthFraction ?? 0));
  if (isBig && cfg?.maxHealthCap && zombie.vulnerableTimer > 0 && zombie.vulnerableMultiplier > 1) {
    damage /= zombie.vulnerableMultiplier;
  }
  if (damage <= 0) return false;
  return zombie.takeHit({
    damage,
    part: 'body',
    point: zombie.position,
    source: 'hazard',
  });
}

/**
 * Shared lifecycle for a pay-to-trigger environmental hazard feature.
 */
export function createHazard({
  feature,
  ctx,
  cfg,
  isPlayerInside,
  onActivate,
  onPulse,
  onTick,
  onStop,
  note = null, // optional () => text | null: one more term on the switch's own prompt (the fountain's closing-duty count)
}) {
  const { scene, map, events, pricing, interactions, player, health, state, sound, effects, surfaces } = ctx;
  const { rig, show } = buildHazardSwitch(cfg.switchStyle ?? 'breaker', {
    position: feature.position,
    normal: feature.normal,
    postBottomY: cfg.postBottomY,
    offset: cfg.switchOffset ?? 0,
  });
  scene.add(rig);

  let phase = 'ready'; // 'ready' | 'active' | 'cooldown'
  let timer = 0;
  let pulseTimer = 0;
  // Seconds after the switch is thrown in which the hazard spares the player (cfg.playerGraceSeconds): every switch
  // stands inside its own zone, so this is the time to step clear. Zombies are hit from the first pulse.
  let graceLeft = 0;
  // The player's slow goes through game/surfaceSlows.js like every other floor slow (a boss's wet floor, Scoops' melt):
  // this hazard reports its own factor under its own source name and clears it, so it never overwrites or wipes another's.
  const slowSource = `hazard:${cfg.id}`;

  function applyPlayerSlow(inside) {
    const shouldSlow = inside && !state.over && phase === 'active' && graceLeft <= 1e-9 && cfg.playerSlowFactor < 1;
    if (shouldSlow) surfaces.set(slowSource, cfg.playerSlowFactor);
    else if (surfaces.factorOf(slowSource) < 1) surfaces.clear(slowSource);
  }

  function runPulse(isOpening = false) {
    if (state.over) return;
    onPulse?.(isOpening);
    // (not during the stand-clear grace, nor Second Chance's grace period: a pulse that can't hurt doesn't jolt the view either)
    if (cfg.playerDamage > 0 && graceLeft <= 1e-9 && isPlayerInside?.(player.position) && !health.isDead && !health.isReviveProtected) {
      health.takeDamage(cfg.playerDamage, { type: 'hazard', id: cfg.id }); // (the death receipt's incident report names it)
      if (cfg.playerViewJoltDegrees) {
        player.addViewKick(-cfg.playerViewJoltDegrees * DEG_TO_RAD);
      }
    }
  }

  /** What the switch's strip shows: full when ready, the time left while active, the recharge while cooling down. */
  function progress() {
    if (phase === 'active') return timer / cfg.durationSeconds;
    if (phase === 'cooldown') return 1 - timer / cfg.cooldownSeconds;
    return 1;
  }

  function trigger() {
    if (state.over || phase !== 'ready') return false;
    phase = 'active';
    timer = cfg.durationSeconds;
    pulseTimer = cfg.pulseInterval;
    graceLeft = cfg.playerGraceSeconds ?? 0;
    show(phase, progress(), 0);
    const s = hazards.switchStatus;
    if (cfg.triggerSound) sound?.play(cfg.triggerSound);
    effects?.splat?.(rig.position, UP, s.sparkColors, s.sparkCount);
    effects?.flash?.(rig.position, s.activeColor, { size: s.flashSize, seconds: s.flashSeconds });
    onActivate?.();
    applyPlayerSlow(Boolean(isPlayerInside?.(player.position)));
    runPulse(true);
    return true;
  }

  interactions.add({
    label: cfg.label,
    title: cfg.title,
    verb: cfg.verb ?? 'trigger',
    get detail() {
      const extra = note?.();
      return extra ? [cfg.detail, extra].filter(Boolean).join(' · ') : cfg.detail;
    },
    kind: 'hazard',
    id: cfg.id,
    get cost() {
      return pricing.priceOf('hazard', cfg.id);
    },
    position: feature.position,
    available: () => Boolean(map.zones[feature.zone]?.open),
    get blocked() {
      if (phase === 'active') return hazards.status.active;
      if (phase === 'cooldown') return hazards.status.cooldown;
      return null;
    },
    use: () => trigger(),
  });

  events?.on('playerDeath', () => {
    applyPlayerSlow(false);
  });

  function update(dt) {
    if (state.over) {
      applyPlayerSlow(false);
      return;
    }
    if (phase === 'active') {
      graceLeft = Math.max(0, graceLeft - dt);
      applyPlayerSlow(Boolean(isPlayerInside?.(player.position)));
      onTick?.(dt, timer);
      timer -= dt;
      pulseTimer -= dt;
      if (pulseTimer <= 1e-9 && timer > -1e-9) {
        pulseTimer += cfg.pulseInterval;
        runPulse(false);
      }
      if (timer <= 1e-9) {
        applyPlayerSlow(false);
        onStop?.({ finished: true });
        phase = 'cooldown';
        timer = cfg.cooldownSeconds;
        pulseTimer = 0;
      }
    } else if (phase === 'cooldown') {
      timer = Math.max(0, timer - dt);
      if (timer <= 1e-9) {
        phase = 'ready';
        timer = 0;
      }
    }
    show(phase, progress(), dt);
  }

  function reset() {
    applyPlayerSlow(false);
    if (phase === 'active') onStop?.({ finished: false });
    phase = 'ready';
    timer = 0;
    pulseTimer = 0;
    graceLeft = 0;
    show(phase, progress(), 0);
  }

  return {
    id: cfg.id,
    rig,
    get phase() { return phase; },
    get remaining() { return timer; },
    get active() { return phase === 'active'; },
    get coolingDown() { return phase === 'cooldown'; },
    get ready() { return phase === 'ready'; },
    get sparingPlayer() { return phase === 'active' && graceLeft > 1e-9; },
    trigger,
    update,
    reset,
  };
}
