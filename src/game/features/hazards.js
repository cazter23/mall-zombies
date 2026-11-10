// =============================================================================
// HAZARDS FRAMEWORK (game/features/hazards.js): shared switch prop, interaction prompt,
// ready -> active -> cooldown state machine, `source: 'hazard'` zombie damage helper,
// player-inside slow/hurt, and Play-again reset for environmental hazards (docs/hazards-plan.md).
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';

const DEG_TO_RAD = Math.PI / 180;

/**
 * Deals hazard damage to a zombie through `zombie.takeHit({ ..., source: 'hazard' })`.
 * Bosses and Mascots cap per-pulse damage to `zombie.maxHealth * cfg.maxHealthCap` so a single
 * switch softens a Boss or Mascot without melting a boss fight.
 */
export function dealHazardDamage(zombie, baseDamage, cfg) {
  if (!zombie || !zombie.isAlive || baseDamage <= 0) return false;
  const capped = (zombie.type?.boss || zombie.type?.mascot) && cfg?.maxHealthCap
    ? Math.min(baseDamage, zombie.maxHealth * cfg.maxHealthCap)
    : baseDamage;
  if (capped <= 0) return false;
  return zombie.takeHit({
    damage: capped,
    part: 'body',
    point: zombie.position,
    source: 'hazard',
  });
}

/**
 * Builds the 3D breaker/switch box at `position` facing `normal`.
 * Marked `userData.dynamic = true` on the parent Group (never on child meshes).
 */
export function buildHazardSwitchBox({ position, normal, postBottomY }) {
  const boxCfg = hazards.switchBox;
  const rig = new THREE.Group();
  rig.name = 'hazard_switch_rig';
  rig.userData.dynamic = true;
  rig.position.copy(position);
  rig.rotation.y = Math.atan2(normal.x, normal.z);

  const cabinetMat = new THREE.MeshLambertMaterial({ color: boxCfg.cabinetColor });
  const trimMat = new THREE.MeshLambertMaterial({ color: boxCfg.trimColor });
  const handleMat = new THREE.MeshLambertMaterial({ color: boxCfg.handleColor });
  const lampMat = new THREE.MeshBasicMaterial({ color: boxCfg.readyColor });

  // Support post down to the rim or floor when mounted above a low wall.
  if (typeof postBottomY === 'number' && position.y - boxCfg.height / 2 > postBottomY + 0.02) {
    const postH = position.y - boxCfg.height / 2 - postBottomY;
    const post = new THREE.Mesh(
      new THREE.BoxGeometry(boxCfg.postWidth, postH, boxCfg.postWidth),
      cabinetMat,
    );
    post.position.set(0, -boxCfg.height / 2 - postH / 2, -boxCfg.depth / 2);
    rig.add(post);
  }

  // Main breaker cabinet body (recessed behind local z = 0 so its front face sits at z = 0).
  const cabinet = new THREE.Mesh(
    new THREE.BoxGeometry(boxCfg.width, boxCfg.height, boxCfg.depth),
    cabinetMat,
  );
  cabinet.position.set(0, 0, -boxCfg.depth / 2);
  rig.add(cabinet);

  // Warning header strip proud of the front face by 2.5 cm.
  const header = new THREE.Mesh(
    new THREE.BoxGeometry(boxCfg.width - 0.04, 0.06, 0.02),
    trimMat,
  );
  header.position.set(0, boxCfg.height / 2 - 0.06, 0.025);
  rig.add(header);

  // Status indicator lamp proud of the front face by 3 cm.
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.07, 0.07, 0.03),
    lampMat,
  );
  lamp.position.set(-0.07, 0.02, 0.03);
  rig.add(lamp);

  // Throw lever pivot proud of the front face.
  const handlePivot = new THREE.Group();
  handlePivot.position.set(0.06, 0.02, 0.025);
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.14, 0.04),
    handleMat,
  );
  handle.position.set(0, 0.05, 0.02);
  handlePivot.add(handle);
  rig.add(handlePivot);

  function setPhaseVisual(phase) {
    if (phase === 'active') {
      lampMat.color.setHex(boxCfg.activeColor);
      handlePivot.rotation.x = 0.85;
    } else if (phase === 'cooldown') {
      lampMat.color.setHex(boxCfg.cooldownColor);
      handlePivot.rotation.x = 0.35;
    } else {
      lampMat.color.setHex(boxCfg.readyColor);
      handlePivot.rotation.x = -0.35;
    }
  }

  setPhaseVisual('ready');
  return { rig, setPhaseVisual };
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
}) {
  const { scene, map, events, pricing, interactions, player, stats, health, state, sound } = ctx;
  const { rig, setPhaseVisual } = buildHazardSwitchBox({
    position: feature.position,
    normal: feature.normal,
    postBottomY: cfg.postBottomY,
  });
  scene.add(rig);

  let phase = 'ready'; // 'ready' | 'active' | 'cooldown'
  let timer = 0;
  let pulseTimer = 0;
  let slowingPlayer = false;

  function applyPlayerSlow(inside) {
    const shouldSlow = inside && !state.over && phase === 'active' && cfg.playerSlowFactor < 1;
    if (shouldSlow) {
      slowingPlayer = true;
      if (stats.surfaceSpeed > cfg.playerSlowFactor) stats.surfaceSpeed = cfg.playerSlowFactor;
    } else if (slowingPlayer) {
      slowingPlayer = false;
      if (stats.surfaceSpeed === cfg.playerSlowFactor) stats.surfaceSpeed = 1;
    }
  }

  function runPulse() {
    if (state.over) return;
    onPulse?.();
    if (cfg.playerDamage > 0 && isPlayerInside?.(player.position) && !health.isDead) {
      health.takeDamage(cfg.playerDamage);
      if (cfg.playerViewJoltDegrees) {
        player.addViewKick(-cfg.playerViewJoltDegrees * DEG_TO_RAD);
      }
    }
  }

  function trigger() {
    if (state.over || phase !== 'ready') return false;
    phase = 'active';
    timer = cfg.durationSeconds;
    pulseTimer = cfg.pulseInterval;
    setPhaseVisual(phase);
    if (cfg.triggerSound) sound?.play(cfg.triggerSound);
    onActivate?.();
    applyPlayerSlow(Boolean(isPlayerInside?.(player.position)));
    runPulse();
    return true;
  }

  interactions.add({
    label: cfg.label,
    title: cfg.title,
    verb: cfg.verb ?? 'trigger',
    detail: cfg.detail,
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
      applyPlayerSlow(Boolean(isPlayerInside?.(player.position)));
      onTick?.(dt, timer);
      timer -= dt;
      pulseTimer -= dt;
      if (pulseTimer <= 1e-9 && timer > -1e-9) {
        pulseTimer += cfg.pulseInterval;
        runPulse();
      }
      if (timer <= 1e-9) {
        applyPlayerSlow(false);
        onStop?.();
        phase = 'cooldown';
        timer = cfg.cooldownSeconds;
        pulseTimer = 0;
        setPhaseVisual(phase);
      }
    } else if (phase === 'cooldown') {
      timer = Math.max(0, timer - dt);
      if (timer <= 1e-9) {
        phase = 'ready';
        timer = 0;
        setPhaseVisual(phase);
      }
    }
  }

  function reset() {
    applyPlayerSlow(false);
    if (phase === 'active') onStop?.();
    phase = 'ready';
    timer = 0;
    pulseTimer = 0;
    setPhaseVisual(phase);
  }

  return {
    id: cfg.id,
    rig,
    get phase() { return phase; },
    get remaining() { return timer; },
    get active() { return phase === 'active'; },
    get coolingDown() { return phase === 'cooldown'; },
    get ready() { return phase === 'ready'; },
    trigger,
    update,
    reset,
  };
}
