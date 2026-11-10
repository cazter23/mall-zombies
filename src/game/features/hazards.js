// =============================================================================
// HAZARDS FRAMEWORK (game/features/hazards.js): shared switch prop, interaction prompt,
// ready -> active -> cooldown state machine, `source: 'hazard'` zombie damage helper,
// player-inside slow/hurt, and Play-again reset for environmental hazards (docs/hazards-plan.md).
// =============================================================================

import * as THREE from 'three';
import { hazards } from '../../config/hazards.js';

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
  const damage = isBig && cfg?.maxHealthCap
    ? Math.min(Math.max(baseDamage, zombie.maxHealth * cfg.maxHealthCap), zombie.maxHealth * cfg.maxHealthCap)
    : Math.max(baseDamage, zombie.maxHealth * (cfg?.normalHealthFraction ?? 0));
  if (damage <= 0) return false;
  return zombie.takeHit({
    damage,
    part: 'body',
    point: zombie.position,
    source: 'hazard',
  });
}

/**
 * Builds the 3D industrial breaker/switch box at `position` facing `normal`.
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
  const darkMat = new THREE.MeshLambertMaterial({ color: boxCfg.stripeDarkColor });
  const metalMat = new THREE.MeshLambertMaterial({ color: boxCfg.metalColor });
  const meterBgMat = new THREE.MeshBasicMaterial({ color: boxCfg.meterBgColor });
  const needleMat = new THREE.MeshBasicMaterial({ color: boxCfg.needleColor });
  const handleMat = new THREE.MeshLambertMaterial({ color: boxCfg.handleColor });
  const lampMat = new THREE.MeshBasicMaterial({ color: boxCfg.readyColor });

  // Support post + conduit pipe down to the rim or floor when mounted above a low wall.
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

  // Top & bottom yellow/black hazard warning bars (proud of the front face by 2.5 cm).
  const barW = boxCfg.width - 0.04;
  for (const ySign of [1, -1]) {
    const barY = ySign * (boxCfg.height / 2 - 0.045);
    const yellowBar = new THREE.Mesh(new THREE.BoxGeometry(barW, 0.05, 0.02), trimMat);
    yellowBar.position.set(0, barY, 0.025);
    rig.add(yellowBar);
    for (let i = -2; i <= 2; i += 2) {
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.052, 0.015), darkMat);
      tick.position.set(i * 0.055, barY, 0.045);
      rig.add(tick);
    }
  }

  // Top beacon dome (glows in the current status color).
  const beaconBase = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.03, 0.11), metalMat);
  beaconBase.position.set(0, boxCfg.height / 2 + 0.015, -boxCfg.depth / 2);
  rig.add(beaconBase);
  const beaconDome = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.07, 0.08), lampMat);
  beaconDome.position.set(0, boxCfg.height / 2 + 0.065, -boxCfg.depth / 2);
  rig.add(beaconDome);

  // Analog voltage gauge on the upper-left front face + rotating needle.
  const meterFace = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.02), meterBgMat);
  meterFace.position.set(-0.085, 0.075, 0.025);
  rig.add(meterFace);
  const needlePivot = new THREE.Group();
  needlePivot.position.set(-0.085, 0.045, 0.045);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.055, 0.01), needleMat);
  needle.position.set(0, 0.024, 0);
  needlePivot.add(needle);
  rig.add(needlePivot);

  // Status indicator lamp on the lower-left front face (proud by 3 cm).
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.075, 0.03),
    lampMat,
  );
  lamp.position.set(-0.085, -0.055, 0.03);
  rig.add(lamp);

  // Heavy twin-blade knife switch on the right half of the box.
  const handlePivot = new THREE.Group();
  handlePivot.position.set(0.075, 0.01, 0.03);
  for (const dx of [-0.035, 0.035]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.16, 0.025), metalMat);
    blade.position.set(dx, 0.06, 0.02);
    handlePivot.add(blade);
  }
  const crossbar = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.042, 0.045),
    handleMat,
  );
  crossbar.position.set(0, 0.13, 0.035);
  handlePivot.add(crossbar);
  rig.add(handlePivot);

  function setPhaseVisual(phase) {
    if (phase === 'active') {
      lampMat.color.setHex(boxCfg.activeColor);
      handlePivot.rotation.x = 2.15;
      needlePivot.rotation.z = -0.65;
    } else if (phase === 'cooldown') {
      lampMat.color.setHex(boxCfg.cooldownColor);
      handlePivot.rotation.x = 0.45;
      needlePivot.rotation.z = 0.25;
    } else {
      lampMat.color.setHex(boxCfg.readyColor);
      handlePivot.rotation.x = -0.35;
      needlePivot.rotation.z = 0.55;
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
  const { scene, map, events, pricing, interactions, player, stats, health, state, sound, effects } = ctx;
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

  function runPulse(isOpening = false) {
    if (state.over) return;
    onPulse?.(isOpening);
    if (cfg.playerDamage > 0 && isPlayerInside?.(player.position) && !health.isDead) {
      health.takeDamage(cfg.playerDamage, { type: 'hazard', id: cfg.id }); // (the death receipt's incident report names it)
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
    effects?.splat?.(feature.position, UP, hazards.switchBox.sparkColors, hazards.switchBox.sparkCount);
    effects?.flash?.(feature.position, hazards.switchBox.activeColor, 1.1, 0.15);
    onActivate?.();
    applyPlayerSlow(Boolean(isPlayerInside?.(player.position)));
    runPulse(true);
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
        runPulse(false);
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
