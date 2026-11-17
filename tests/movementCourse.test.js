// The test range's MOVEMENT COURSE (debug mode: maps/testRange/movementCourse.js, the readout's numbers moveTracker.js): each station
// follows today's rules (config/feel.js vault, fall; CLAUDE.md's standable rule), and the real player does what its sign says: the ramp
// climbs to the 6.3 m balcony, the counters up to 1.1 m vault and the others refuse, the balcony rails drop you (the 3 m drop is free,
// the 6.3 m one costs ~40), and the readout measures it all.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, dt } from './helpers/headlessGame.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';
import { feel } from '../src/config/feel.js';

const R = feel.player.radius;
const CZ = -100; // (the range's centre: local z + CZ = world z)

function courseGame(t, { invulnerable = true } = {}) {
  const run = headlessGame({ buildTestRange });
  t.after(() => run.g.map.dispose());
  run.tick(1);
  run.g.rounds.update = () => {};
  run.g.zombies.clear();
  run.g.health.invulnerable = invulnerable;
  return run;
}

// Run at something along (dx, dz) from `start` at sprint speed, jump at once, and watch for `ticks`. Returns { vaulted, end }.
function runAndJump(run, start, dx, dz, ticks = 150) {
  const { g, input } = run;
  const P = g.player;
  const yaw = Math.atan2(-dx, -dz);
  P.teleport({ position: start, yaw });
  P.pitch = 0;
  input.clear();
  run.tick(2); // (stand there first, as you would: the readout's drop counts from the floor you stood on)
  input.padMove.x = 0;
  input.padMove.y = 1;
  input.held.add('ShiftLeft');
  P.velocity.set(dx * feel.movement.sprintSpeed, 0, dz * feel.movement.sprintSpeed);
  input.pressed.add('Space');
  let vaulted = false;
  for (let i = 0; i < ticks; i++) {
    run.tick(1);
    input.pressed.clear();
    if (P.vault.active) vaulted = true;
    if (i > 30 && vaulted && P.grounded && !P.vault.active) break;
  }
  input.clear();
  input.padMove.y = 0;
  return { vaulted, end: P.position.clone() };
}

test('the stations follow today\'s rules: vault heights and depth, balcony rails, the ramp\'s heights, the reach rule', (t) => {
  const { g } = courseGame(t);
  const course = g.arena.course;
  for (const { collider, height, depth, vaults } of course.vaultRow) {
    assert.equal(collider.vaultable, height <= feel.vault.maxHeight && depth <= feel.vault.maxDepth, `${height} m x ${depth} m`);
    assert.ok(Math.abs(collider.max.y - height) < 1e-9);
    void vaults;
  }
  assert.deepEqual(course.vaultRow.map((r) => r.vaults), [true, true, true, false, false], '0.9, 1.0, 1.1 vault; 1.2 and the deep one do not');
  assert.equal(course.balcony.height, 6.3, 'the mall\'s upper floor');
  for (const rail of [...course.balcony.rails, course.landing.rail]) {
    assert.ok(rail.ledge, 'a balcony rail');
    assert.ok(rail.max.y - rail.min.y <= feel.vault.ledge.maxHeight, 'climbable');
    assert.ok(rail.max.y - rail.min.y > feel.movement.jumpVelocity ** 2 / (2 * feel.movement.gravity), 'taller than a jump peaks');
  }
  assert.ok(Math.abs(course.rampHeightAt(1e3) - 6.3) < 1e-9, 'the ramp arrives at the balcony');
  assert.ok(Math.abs(course.landing.height - feel.fall.safeDrop) < 1e-9, 'the landing is the free drop');
  const { counter, low, tall } = course.reach;
  const counterJumpPeak = counter.max.y + feel.movement.jumpVelocity ** 2 / (2 * feel.movement.gravity);
  assert.ok(counter.vaultable);
  assert.ok(low.max.y < counterJumpPeak, `2.0 m is within a jump from the counter (${counterJumpPeak.toFixed(2)} m)`);
  assert.ok(tall.max.y >= 2.1 && tall.max.y > counterJumpPeak, '2.1 m is out of reach');
});

test('the ramp climbs to the balcony: walk up it from its foot', (t) => {
  const run = courseGame(t);
  const { g, input } = run;
  g.player.teleport({ position: new THREE.Vector3(10.5, 0, CZ - 5), yaw: 0 });
  input.padMove.y = 1;
  run.tick(Math.ceil(6 / dt));
  input.padMove.y = 0;
  assert.ok(Math.abs(g.player.position.y - 6.3) < 0.05, `on the balcony's floor (y ${g.player.position.y.toFixed(2)})`);
  assert.ok(g.player.position.z < CZ - 22, 'past the top of the ramp');
});

test('the vault row: 1.1 m vaults over, 1.2 m does not; the readout measures the vault', (t) => {
  const run = courseGame(t);
  const { g } = run;
  const [, , vault11, high12] = g.arena.course.vaultRow;
  const before = (row) => new THREE.Vector3(0, 0, row.collider.max.z + 0.6 + R);
  const over = runAndJump(run, before(vault11), 0, -1);
  assert.ok(over.vaulted, 'vaulted the 1.1 m counter');
  assert.ok(over.end.z < vault11.collider.min.z, 'landed beyond it');
  assert.ok(g.arena.movement.view.vault?.distance > 1, `the readout's vault (${g.arena.movement.view.vault?.distance})`);
  const refused = runAndJump(run, before(high12), 0, -1, 60);
  assert.equal(refused.vaulted, false, 'no vault over 1.2 m');
  assert.ok(refused.end.z > high12.collider.max.z - 0.01, 'still this side of it');
});

test('the balcony rails: off the 3 m landing is free, off the 6.3 m balcony costs ~40; the readout shows both', (t) => {
  const run = courseGame(t, { invulnerable: false });
  const { g } = run;
  const course = g.arena.course;
  // The landing: its rail is on its west side; run west at it from the landing's floor.
  const [lz0, lz1] = course.landing.z;
  const landingX = course.landing.rail.max.x + 0.6 + R;
  const free = runAndJump(run, new THREE.Vector3(landingX, course.landing.height, CZ + (lz0 + lz1) / 2), -1, 0, 240);
  assert.ok(free.vaulted, 'climbed over the landing\'s rail');
  assert.ok(free.end.y < 0.05, 'down on the floor');
  const freeView = g.arena.movement.view;
  assert.ok(Math.abs(freeView.air.drop - course.landing.height) < 0.1, `dropped ~3 m (${freeView.air.drop.toFixed(2)})`);
  assert.equal(freeView.fall, null, 'no fall damage');
  // The balcony: its west rail; run west at it.
  const westRail = course.balcony.rails[0];
  const health = g.health.current ?? g.stats.health;
  const hurt = runAndJump(run, new THREE.Vector3(westRail.max.x + 0.6 + R, 6.3, (westRail.min.z + westRail.max.z) / 2), -1, 0, 300);
  assert.ok(hurt.vaulted, 'climbed over the balcony rail');
  assert.ok(hurt.end.y < 0.05, 'down on the floor');
  const fall = g.arena.movement.view.fall;
  const expected = (6.3 - feel.fall.safeDrop) * feel.fall.damagePerMeter * (g.stats.fallDamageScale ?? 1);
  assert.ok(fall && Math.abs(fall.damage - expected) < 2, `the readout's fall damage (${fall?.damage?.toFixed(1)} vs ${expected.toFixed(1)})`);
  assert.ok((g.health.current ?? g.stats.health) < health, 'it hurt');
});

test('the readout measures a slide on the runway', (t) => {
  const run = courseGame(t);
  const { g, input } = run;
  g.player.teleport({ position: new THREE.Vector3(-24.5, 0, CZ + 22), yaw: 0 });
  input.padMove.y = 1;
  input.held.add('ShiftLeft');
  run.tick(Math.ceil(1 / dt));
  run.press('KeyC');
  run.tick(Math.ceil(2 / dt));
  input.clear();
  input.padMove.y = 0;
  const slide = g.arena.movement.view.slide;
  assert.ok(slide && slide.distance > 2 && slide.seconds > 0.2, `a slide (${slide?.distance?.toFixed(2)} m in ${slide?.seconds?.toFixed(2)} s)`);
  assert.ok(g.arena.movement.view.topSpeed >= feel.movement.sprintSpeed - 0.5, 'sprint speed shows');
});
