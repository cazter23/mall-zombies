// The test range's SHOOTING GALLERY (debug mode: maps/testRange/gallery.js, numbers config/debug.js gallery): targets at the configured
// distances, a counter that sets the round they stand in for (health and round scaling), and the readout's numbers from real shots:
// each hit's damage, part, distance and range falloff, the hit rate by distance, and a kill's hit shots and time.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';
import { debug } from '../src/config/debug.js';
import { feel } from '../src/config/feel.js';
import { weapons } from '../src/config/weapons.js';
import { zombieHealthForRound } from '../src/config/economy.js';
import { damageFalloff, hitDamage } from '../src/weapons/gunStats.js';

const G = debug.gallery;

function rangeGame(t) {
  const run = headlessGame({ buildTestRange });
  t.after(() => run.g.map.dispose());
  run.tick(1);
  run.g.zombies.clear();
  run.g.health.invulnerable = true;
  return run;
}

const targetsOf = (g) => g.arena.shootables.filter((s) => g.arena.inGallery(s.hitboxes[0].box.getCenter(new THREE.Vector3())));
const bodyCentre = (dummy) => dummy.hitboxes.find((h) => h.part === 'body').box.getCenter(new THREE.Vector3());

test('the gallery: a target at each configured distance beyond the firing line, inside the range (rounds pause there)', (t) => {
  const { g } = rangeGame(t);
  const targets = targetsOf(g);
  assert.equal(targets.length, G.distances.length);
  const zs = targets.map((d) => bodyCentre(d).z);
  const firing = Math.max(...zs) + G.distances[0]; // (the nearest target is the first distance from the line)
  assert.deepEqual(zs.map((z) => Math.round(firing - z)), G.distances, 'each target stands at its distance');
  for (const d of targets) assert.ok(g.arena.contains(bodyCentre(d)), 'the gallery counts as the range');
  assert.equal(g.arena.gallery.round, G.rounds[0]);
});

test('the counter sets the targets\' round: their health follows it, and so does a gun\'s round scaling', (t) => {
  const run = rangeGame(t);
  const { g } = run;
  const [first] = targetsOf(g);
  // Walk to the counter: its two prompts, facing it.
  const counterZ = Math.max(...targetsOf(g).map((d) => bodyCentre(d).z)) + G.distances[0];
  // (The counter sits on the firing line, its prompts toward the range: find "Harder targets" along it.)
  const harder = () => g.interactions.prompt?.id === 'harder';
  for (let x = -1.5; x <= 1.5 && !harder(); x += 0.25) {
    g.player.teleport({ position: new THREE.Vector3(x, 0, counterZ + 1.1), yaw: 0 });
    g.player.pitch = -0.3;
    run.tick(2);
  }
  assert.ok(harder(), 'the Harder prompt takes focus at the counter');
  run.press('KeyF');
  assert.equal(g.arena.gallery.round, G.rounds[1]);
  for (const d of targetsOf(g)) {
    assert.equal(d.maxHealth, zombieHealthForRound(G.rounds[1]));
    assert.equal(d.health, d.maxHealth, 'full');
    assert.equal(d.round, G.rounds[1]);
  }
  // A gun with round scaling (the Balloon Launcher) hits a later-round target harder, as it does a zombie of that round.
  const balloon = weapons.balloonLauncher;
  const early = hitDamage(balloon, { blastDistance: 0 }, 0, g.stats, 1, { round: G.rounds[0] });
  const late = hitDamage(balloon, { blastDistance: 0 }, 0, g.stats, 1, first);
  assert.ok(late > early, `round scaling reads the target's round (${early} -> ${late})`);
  g.arena.gallery.stepRound(-5);
  assert.equal(g.arena.gallery.round, G.rounds[0], 'never below the first');
});

test('the readout: real shots give each hit\'s damage, part, distance and falloff, the hit rate by distance, and a kill\'s hits and time', (t) => {
  const run = rangeGame(t);
  const { g } = run;
  const targets = targetsOf(g);
  const index = G.distances.indexOf(20);
  const target = targets[index];
  const counterZ = Math.max(...targets.map((d) => bodyCentre(d).z)) + G.distances[0];
  // Stand on the firing line (beside the counter) and aim at the 20 m target's chest.
  const eyeAt = (stand) => { g.player.teleport({ position: stand, yaw: 0 }); run.tick(1); const o = new THREE.Vector3(), d = new THREE.Vector3(); g.player.getAim(o, d); return o; };
  const stand = new THREE.Vector3(2.5, 0, counterZ + 0.6); // (beside the counter, on the firing line)
  const eye = eyeAt(stand);
  const to = bodyCentre(target).sub(eye);
  const yaw = Math.atan2(-to.x, -to.z);
  const pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
  g.player.teleport({ position: stand, yaw });
  g.player.pitch = pitch;
  run.tick(1);
  const o = new THREE.Vector3(), d = new THREE.Vector3();
  g.player.getAim(o, d);
  assert.ok(d.angleTo(bodyCentre(target).sub(o)) < 0.02, 'aimed at the target');
  // The Rivet Rifle (no spread worth missing over at 20 m), steadied: fire until the target falls.
  g.gun.give(weapons.rivetRifle);
  run.tick(Math.ceil(2 / (1 / feel.simulation.tickRate)));
  g.player.pitch = pitch;
  let shots = 0;
  while (target.isAlive && shots < 40) {
    g.gun.weapon.magazine = Math.max(1, g.gun.weapon.magazine);
    g.gun.weapon.cooldown = 0;
    g.player.pitch = pitch;
    run.press('Mouse0');
    run.tick(6);
    shots++;
  }
  assert.equal(target.isAlive, false, `the 20 m target fell (${shots} shots)`);
  const view = g.arena.gallery.view;
  assert.equal(view.gun, g.gun.def.name);
  const hit = view.hits[0];
  assert.equal(hit.target, 20);
  assert.equal(hit.killed, true, 'the latest hit is the kill');
  assert.ok(Math.abs(hit.distance - 20) < 2, `the hit's distance is about 20 m (${hit.distance})`);
  assert.equal(hit.falloff, damageFalloff(hit.distance, g.gun.def.falloff), 'the falloff is the gun\'s own at that distance');
  const lane = view.lanes[index];
  assert.ok(lane.shots >= lane.hitShots && lane.hitShots >= 1, `the shots counted toward the 20 m target (${lane.hitShots}/${lane.shots})`);
  assert.ok(lane.lastKill && lane.lastKill.hits === lane.hitShots && lane.lastKill.seconds > 0, 'the kill: its hit shots and time');
  assert.ok(view.lanes.every((l, i) => i === index || l.shots === 0), 'no other target was aimed at');
  // A new round clears the numbers.
  g.arena.gallery.stepRound(1);
  assert.equal(g.arena.gallery.view.hits.length, 0);
});
