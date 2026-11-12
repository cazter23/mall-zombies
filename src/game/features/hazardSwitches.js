// =============================================================================
// HAZARD SWITCHES (docs/archive/hazards-plan.md): the thing you walk up to and throw, one model per hazard
// (config/hazards.js `switchStyle`):
//   'breaker'   the Electrified Fountain's industrial breaker box (knife switch, voltage needle, beacon)
//   'valve'     the Fryer Blast's gas-line valve on a riser pipe (red handwheel that spins while it vents, oil gauge)
//   'firePull'  the Fire Sprinklers' red wall pull station with a horn/strobe above it (the handle stays pulled)
//   'paging'    the PA System Lure's paging panel (ALL CALL button, speaker grille, gooseneck mic, ON AIR lamp)
// Every one carries the same status read-out (config/hazards.js `switchStatus`): a lamp (green ready, a slow blink
// while it runs, amber while it recharges) and a strip that is full when ready, runs down while active and refills
// over the cooldown.
//
// buildHazardSwitch(style, { position, normal, postBottomY, offset }) -> { rig, show(phase, progress, dt) }
//   rig        a THREE.Group to add to the scene, `userData.dynamic` (never a flagged child mesh: tests/staticBatch.test.js)
//   show(...)  every tick: phase 'ready' | 'active' | 'cooldown', progress 0..1 (what the strip shows), dt for spins
// Still parts of one material are merged into one mesh (a switch is 6 to 9 draw calls); no lights are made.
// Local frame: +Z faces out of the wall (along `normal`), the front face of the body sits at z = 0.
// =============================================================================

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { hazards } from '../../config/hazards.js';

function box(w, h, d, x = 0, y = 0, z = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(x, y, z);
  return g;
}

// A cylinder along `axis` ('y' upright, 'z' pointing out of the wall).
function cylinder(rTop, rBottom, h, segments, x = 0, y = 0, z = 0, axis = 'y') {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, segments);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** One mesh from several geometries that share a material (the sources are freed). */
function merged(geometries, material, name) {
  const geometry = mergeGeometries(geometries, false);
  for (const g of geometries) g.dispose();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  return mesh;
}

const lambert = (color) => new THREE.MeshLambertMaterial({ color });
const basic = (color) => new THREE.MeshBasicMaterial({ color });

/**
 * The lamp + recharge strip every switch shares. `lampGeometries` are merged into one lit-looking (unlit) mesh;
 * the strip is a dark back with a fill that scales from its left end.
 */
function statusReadout(rig, lampGeometries, strip) {
  const s = hazards.switchStatus;
  const lampMat = basic(s.readyColor);
  rig.add(merged(lampGeometries, lampMat, 'hazard_switch_lamp'));

  rig.add(merged([box(strip.width + 0.012, strip.height + 0.012, 0.01, strip.x, strip.y, 0.005)], basic(s.stripBackColor), 'hazard_switch_strip_back'));
  const fillGeometry = box(strip.width, strip.height, 0.01, strip.width / 2, 0, 0);
  const fillMat = basic(s.readyColor);
  const fill = new THREE.Mesh(fillGeometry, fillMat);
  fill.name = 'hazard_switch_strip';
  fill.position.set(strip.x - strip.width / 2, strip.y, 0.012);
  rig.add(fill);

  const ready = new THREE.Color(s.readyColor);
  const active = new THREE.Color(s.activeColor);
  const blink = new THREE.Color(s.activeBlinkColor);
  const cooldown = new THREE.Color(s.cooldownColor);
  let time = 0;
  return function show(phase, progress, dt) {
    time += dt;
    if (phase === 'active') {
      const k = 0.5 + 0.5 * Math.sin(time * Math.PI * 2 * s.activeBlinkHz);
      lampMat.color.copy(active).lerp(blink, k * 0.6);
      fillMat.color.copy(active);
    } else {
      const c = phase === 'cooldown' ? cooldown : ready;
      lampMat.color.copy(c);
      fillMat.color.copy(c);
    }
    fill.scale.x = Math.max(0.001, Math.min(1, progress));
  };
}

// --- 'breaker': the fountain's breaker box (the look phase 1 built, merged) ---
function buildBreaker(rig, { position, postBottomY }) {
  const c = hazards.switchBox;
  const { width: w, height: h, depth: d } = c;
  const cabinet = [box(w, h, d, 0, 0, -d / 2)];
  if (typeof postBottomY === 'number' && position.y - h / 2 > postBottomY + 0.02) {
    const postH = position.y - h / 2 - postBottomY;
    cabinet.push(box(c.postWidth, postH, c.postWidth, 0, -h / 2 - postH / 2, -d / 2)); // down to the rim it stands on
  }
  rig.add(merged(cabinet, lambert(c.cabinetColor), 'hazard_breaker_cabinet'));

  const bars = [];
  const ticks = [];
  for (const ySign of [1, -1]) {
    const barY = ySign * (h / 2 - 0.045);
    bars.push(box(w - 0.04, 0.05, 0.02, 0, barY, 0.025));
    for (let i = -2; i <= 2; i += 2) ticks.push(box(0.04, 0.052, 0.015, i * 0.055, barY, 0.045));
  }
  rig.add(merged(bars, lambert(c.trimColor), 'hazard_breaker_trim'));
  rig.add(merged(ticks, lambert(c.stripeDarkColor), 'hazard_breaker_stripes'));
  const metalMat = lambert(c.metalColor);
  rig.add(merged([box(0.11, 0.03, 0.11, 0, h / 2 + 0.015, -d / 2)], metalMat, 'hazard_breaker_beacon_base'));
  rig.add(merged([box(0.12, 0.09, 0.02, -0.085, 0.075, 0.025)], basic(c.meterBgColor), 'hazard_breaker_meter'));

  const needlePivot = new THREE.Group();
  needlePivot.position.set(-0.085, 0.045, 0.045);
  needlePivot.add(merged([box(0.012, 0.055, 0.01, 0, 0.024, 0)], basic(c.needleColor), 'hazard_breaker_needle'));
  rig.add(needlePivot);

  const handlePivot = new THREE.Group();
  handlePivot.position.set(0.075, 0.01, 0.03);
  handlePivot.add(merged([box(0.018, 0.16, 0.025, -0.035, 0.06, 0.02), box(0.018, 0.16, 0.025, 0.035, 0.06, 0.02)], metalMat, 'hazard_breaker_blades'));
  handlePivot.add(merged([box(0.11, 0.042, 0.045, 0, 0.13, 0.035)], lambert(c.handleColor), 'hazard_breaker_handle'));
  rig.add(handlePivot);

  // Lamp: the beacon dome on top + the indicator on the front.
  const status = statusReadout(rig, [box(0.08, 0.07, 0.08, 0, h / 2 + 0.065, -d / 2), box(0.075, 0.075, 0.03, -0.085, -0.055, 0.03)], c.strip);
  return (phase, progress, dt) => {
    handlePivot.rotation.x = c.handleAngles[phase];
    needlePivot.rotation.z = c.needleAngles[phase];
    status(phase, progress, dt);
  };
}

// --- 'firePull': a wall pull station with a horn/strobe above ---
function buildFirePull(rig) {
  const c = hazards.firePull;
  const { width: w, height: h, depth: d } = c;
  rig.add(merged([box(w, h, d, 0, 0, -d / 2)], lambert(c.bodyColor), 'hazard_firepull_body'));
  // The darker bezel round the front, the white band where "FIRE" would be printed, and the horn's grille slots.
  const bezel = [box(w + 0.016, 0.012, 0.012, 0, h / 2 - 0.004, 0.002), box(w + 0.016, 0.012, 0.012, 0, -h / 2 + 0.004, 0.002),
    box(0.012, h, 0.012, w / 2 + 0.002, 0, 0.002), box(0.012, h, 0.012, -w / 2 - 0.002, 0, 0.002)];
  for (let i = -1; i <= 1; i++) bezel.push(box(c.strobe.width - 0.03, 0.008, 0.006, 0, c.strobe.y - 0.024 + i * 0.012 - 0.004, 0.004));
  rig.add(merged(bezel, lambert(c.bezelColor), 'hazard_firepull_bezel'));
  rig.add(merged([box(w - 0.03, 0.035, 0.008, 0, h / 2 - 0.05, 0.004)], basic(c.bandColor), 'hazard_firepull_band'));
  rig.add(merged([box(c.strobe.width, c.strobe.height, c.strobe.depth, 0, c.strobe.y, -c.strobe.depth / 2)], lambert(c.strobe.housingColor), 'hazard_firepull_horn'));

  // The handle: a T-bar on a stem, hinged at its top; thrown, it swings down and out and stays there.
  const handlePivot = new THREE.Group();
  handlePivot.position.set(0, 0.035, 0.0);
  handlePivot.add(merged([box(0.03, 0.05, 0.02, 0, -0.025, 0.012), box(0.11, 0.032, 0.03, 0, -0.055, 0.02)], lambert(c.handleColor), 'hazard_firepull_handle'));
  rig.add(handlePivot);

  // Lamp: the strobe lens on the horn's front.
  const status = statusReadout(rig, [box(c.strobe.width - 0.04, 0.03, 0.02, 0, c.strobe.y + 0.017, 0.008)], c.strip);
  return (phase, progress, dt) => {
    handlePivot.rotation.x = phase === 'ready' ? 0 : c.handlePulledAngle;
    status(phase, progress, dt);
  };
}

// --- 'valve': a gas-line valve on a riser pipe from the floor ---
function buildValve(rig, { position, postBottomY = 0 }) {
  const c = hazards.valve;
  const b = c.body;
  const bodyZ = -b.depth / 2;
  const pipeTop = -b.height / 2;
  const pipeBottom = postBottomY - position.y;
  const pipeH = pipeTop - pipeBottom;
  rig.add(merged([
    cylinder(c.pipeRadius, c.pipeRadius, pipeH, 12, 0, pipeBottom + pipeH / 2, bodyZ),
    cylinder(c.flangeRadius, c.flangeRadius, 0.03, 12, 0, pipeBottom + 0.015, bodyZ),
    cylinder(0.015, 0.015, 0.08, 8, 0, b.height / 2 + 0.04, bodyZ), // the gauge's stalk
    box(c.strip.width + 0.03, c.strip.height + 0.03, -bodyZ, 0, c.strip.y, bodyZ / 2), // the clamp plate the strip sits on
  ], lambert(c.pipeColor), 'hazard_valve_pipe'));
  // A yellow/black safety collar half-way up the riser.
  const collarY = pipeBottom + pipeH * 0.45;
  rig.add(merged([0, 2].map((i) => cylinder(c.pipeRadius + 0.006, c.pipeRadius + 0.006, 0.04, 12, 0, collarY + i * 0.04, bodyZ)), lambert(c.collarColor), 'hazard_valve_collar'));
  rig.add(merged([cylinder(c.pipeRadius + 0.006, c.pipeRadius + 0.006, 0.04, 12, 0, collarY + 0.04, bodyZ)], lambert(c.collarDarkColor), 'hazard_valve_collar_dark'));
  rig.add(merged([
    box(b.width, b.height, b.depth, 0, 0, bodyZ),
    cylinder(0.03, 0.03, c.wheel.z, 10, 0, 0, c.wheel.z / 2, 'z'), // the bonnet out to the wheel
  ], lambert(b.color), 'hazard_valve_body'));

  // The handwheel: rim, three spokes, hub.
  const wheel = new THREE.Group();
  wheel.position.set(0, 0, c.wheel.z);
  const rim = new THREE.TorusGeometry(c.wheel.radius, c.wheel.tube, 8, 22);
  const parts = [rim, cylinder(0.03, 0.03, 0.03, 10, 0, 0, 0, 'z')];
  for (let i = 0; i < 3; i++) {
    const spoke = box(0.018, c.wheel.radius, 0.018, 0, c.wheel.radius / 2, 0);
    spoke.rotateZ((i * Math.PI * 2) / 3);
    parts.push(spoke);
  }
  wheel.add(merged(parts, lambert(c.wheel.color), 'hazard_valve_wheel'));
  rig.add(wheel);

  // The oil-temperature gauge on its stalk, facing out; its needle swings into the red while it vents.
  const g = c.gauge;
  rig.add(merged([cylinder(g.radius, g.radius, g.depth, 18, 0, g.y, bodyZ, 'z')], lambert(g.rimColor), 'hazard_valve_gauge'));
  rig.add(merged([cylinder(g.radius - 0.01, g.radius - 0.01, 0.006, 18, 0, g.y, bodyZ + g.depth / 2 + 0.003, 'z')], basic(g.faceColor), 'hazard_valve_gauge_face'));
  const needlePivot = new THREE.Group();
  needlePivot.position.set(0, g.y, bodyZ + g.depth / 2 + 0.009);
  needlePivot.add(merged([box(0.008, g.radius * 0.8, 0.004, 0, g.radius * 0.4, 0)], basic(g.needleColor), 'hazard_valve_needle'));
  rig.add(needlePivot);

  const status = statusReadout(rig, [box(c.lamp.size, c.lamp.size, c.lamp.size, 0, c.lamp.y, bodyZ)], c.strip);
  return (phase, progress, dt) => {
    if (phase === 'active') wheel.rotation.z -= c.wheel.spinPerSecond * dt;
    needlePivot.rotation.z = c.needleAngles[phase];
    status(phase, progress, dt);
  };
}

// --- 'paging': a wall paging panel ---
function buildPaging(rig) {
  const c = hazards.paging;
  const { width: w, height: h, depth: d } = c;
  // Housing + the mic's base on top.
  rig.add(merged([box(w, h, d, 0, 0, -d / 2), box(0.05, 0.03, 0.05, w / 2 - 0.06, h / 2 + 0.015, -0.03)], lambert(c.housingColor), 'hazard_paging_housing'));
  // Speaker grille slots (top right) and the gooseneck mic.
  const dark = [];
  for (let i = 0; i < 5; i++) dark.push(box(0.11, 0.012, 0.006, 0.07, 0.165 - i * 0.026, 0.003));
  rig.add(merged(dark, lambert(c.grilleColor), 'hazard_paging_grille'));
  const neck = cylinder(0.008, 0.008, 0.15, 6, 0, 0.075, 0);
  const head = cylinder(0.022, 0.022, 0.06, 10, 0, 0.17, 0);
  const mic = merged([neck, head], lambert(c.micColor), 'hazard_paging_mic');
  mic.position.set(w / 2 - 0.06, h / 2 + 0.03, -0.03);
  mic.rotation.x = c.micLean;
  rig.add(mic);
  // ALL CALL label plate and the big red button (pressed in while it broadcasts).
  rig.add(merged([box(0.16, 0.03, 0.006, 0, 0.03, 0.003)], lambert(c.plateColor), 'hazard_paging_plate'));
  const button = merged([cylinder(0.045, 0.045, 0.03, 18, 0, 0, 0, 'z')], lambert(c.buttonColor), 'hazard_paging_button');
  button.position.set(0, -0.05, 0.015);
  rig.add(button);

  const status = statusReadout(rig, [box(c.lamp.width, c.lamp.height, 0.012, c.lamp.x, c.lamp.y, 0.006)], c.strip);
  return (phase, progress, dt) => {
    button.position.z = phase === 'active' ? 0.015 - c.buttonPress : 0.015;
    status(phase, progress, dt);
  };
}

const builders = { breaker: buildBreaker, firePull: buildFirePull, valve: buildValve, paging: buildPaging };
const HAZARD_SWITCH_STYLES = Object.keys(builders);

/** Builds a hazard's switch at `position` facing `normal`, `offset` metres out along it. */
export function buildHazardSwitch(style, { position, normal, postBottomY, offset = 0 }) {
  const build = builders[style];
  if (!build) throw new Error(`unknown hazard switch style "${style}" (${HAZARD_SWITCH_STYLES.join(', ')})`);
  const rig = new THREE.Group();
  rig.name = `hazard_switch_${style}`;
  rig.userData.dynamic = true;
  rig.position.set(position.x, position.y, position.z).addScaledVector(normal, offset);
  rig.rotation.y = Math.atan2(normal.x, normal.z);
  const show = build(rig, { position, postBottomY });
  show('ready', 1, 0);
  return { rig, show };
}
