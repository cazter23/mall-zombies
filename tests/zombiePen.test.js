// The test range's ZOMBIE PEN (debug mode: maps/testRange/pen.js, its console a bench form): spawn every zombie type, Mascot costume
// (gold too) and mall boss at the pen's far end; they stand still (held, never "rescued" to the mall) or come at you; a boss is a real
// one from the director (one per round); leaving the range clears the pen.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';
import { feel } from '../src/config/feel.js';
import { zombieTypes, mascotVariants } from '../src/config/zombies.js';
import { zombieFailsafe } from '../src/config/zombies.js';

const dt = 1 / feel.simulation.tickRate;
const holdTicks = Math.ceil(feel.interact.holdSeconds / dt) + 1;

function penGame(t) {
  const run = headlessGame({ buildTestRange });
  t.after(() => run.g.map.dispose());
  run.tick(1);
  run.g.rounds.update = () => {};
  run.g.zombies.clear();
  run.g.health.invulnerable = true;
  return run;
}

// Walk up to the console's buy side (it faces north, the doorway side) and hold F.
function openConsole(run) {
  const { g } = run;
  for (let x = -33.3; x <= -31.7 && g.interactions.prompt?.kind !== 'zombiePen'; x += 0.4) {
    g.player.teleport({ position: new THREE.Vector3(x, 0, -100 + 20.2), yaw: Math.PI });
    g.player.pitch = -0.4;
    run.tick(2);
  }
  assert.equal(g.interactions.prompt?.kind, 'zombiePen', 'the console takes focus');
  run.press('KeyF', holdTicks);
  assert.equal(g.state.menu, 'zombiePen');
  return g.arena.pen;
}

test('the console spawns every zombie type and Mascot costume (gold too) at the far end, paying nothing, in the range', (t) => {
  const run = penGame(t);
  const { g } = run;
  const pen = openConsole(run);
  assert.ok(g.arena.contains(g.player.position), 'the pen is part of the range (rounds pause there)');
  const choices = [
    ...Object.keys(zombieTypes).filter((id) => id !== 'mascot').map((id) => ['zombie', `type:${id}`]),
    ...Object.keys(mascotVariants).map((id) => ['mascot', `mascot:${id}`]),
    ['mascot', `gold:${Object.keys(mascotVariants)[0]}`],
  ];
  for (const [column, choice] of choices) {
    if (column === 'mascot') { pen.form.choose('pen', 'clear'); run.tick(1); } // (the game caps Mascots alive at once)
    assert.match(pen.form.choose(column, choice), /^Spawned /, choice);
    const zombie = pen.zombies.at(-1);
    assert.ok(zombie.position.x < -45, `${choice}: at the pen's far end`);
    assert.equal(zombie.noRewards, true);
    if (column === 'mascot') assert.ok(zombie.type.mascot, `${choice} is a Mascot`);
    if (choice.startsWith('gold')) assert.ok(zombie.type.gold, 'the gold one is gold');
  }
  assert.equal(g.state.assisted, true, 'a debug run');
  // Past the game's Mascot cap the console says so (rather than handing over a Shopper).
  pen.form.choose('pen', 'clear');
  run.tick(1);
  let refused = '';
  for (let i = 0; i < 6 && !refused; i++) {
    const message = pen.form.choose('mascot', `mascot:${Object.keys(mascotVariants)[0]}`);
    if (!message.startsWith('Spawned')) refused = message;
  }
  assert.match(refused, /Mascots at once/);
  assert.ok(pen.zombies.every((z) => z.type.mascot), 'no stray Shopper left behind');
  assert.match(pen.form.choose('pen', 'clear'), /^Cleared /);
  run.tick(1);
  assert.equal(pen.zombies.length, 0);
});

test('standing still: held where they stand, facing you, never rescued to the mall; Come at me: they walk over', (t) => {
  const run = penGame(t);
  const { g } = run;
  const pen = openConsole(run);
  assert.equal(pen.still, true, 'they stand still to start with');
  pen.form.choose('zombie', 'type:shopper');
  pen.form.choose('zombie', 'type:cartPusher');
  const [shopper, cart] = pen.zombies;
  const from = [shopper.position.clone(), cart.position.clone()];
  run.tick(Math.ceil((zombieFailsafe.checkSeconds * 2 + 2) / dt)); // (past the failsafe's check, twice)
  assert.ok(shopper.isAlive && cart.isAlive);
  assert.ok(shopper.position.distanceTo(from[0]) < 0.3 && cart.position.distanceTo(from[1]) < 0.3, 'they stayed put');
  assert.ok(g.arena.contains(shopper.position), 'not rescued to the mall');
  pen.form.choose('behaviour', 'walk');
  const before = shopper.position.distanceTo(g.player.position);
  run.tick(Math.ceil(3 / dt));
  assert.ok(shopper.position.distanceTo(g.player.position) < before - 2, 'Come at me: it walks over');
});

test('a boss from the console is the director\'s (one per round), pinned while standing still; leaving the range clears the pen', (t) => {
  const run = penGame(t);
  const { g } = run;
  const pen = openConsole(run);
  const spawned = [];
  g.events.on('bossSpawn', (e) => spawned.push(e));
  assert.match(pen.form.choose('boss', 'boss:janitor'), /^Spawned /);
  assert.equal(spawned.length, 1, 'the boss director summoned it (health bar, phases)');
  const boss = pen.zombies.at(-1);
  assert.ok(boss.type.boss);
  const at = boss.position.clone();
  run.tick(Math.ceil(4 / dt));
  assert.ok(Math.hypot(boss.position.x - at.x, boss.position.z - at.z) < 0.05, 'a boss ignores holds: it is pinned');
  assert.match(pen.form.choose('boss', 'boss:guard'), /One boss/, 'one at a time, once per round');
  pen.form.choose('zombie', 'type:shopper');
  assert.equal(pen.zombies.length, 2);
  // Back to the mall: nothing from the pen follows.
  g.state.menu = null;
  g.player.teleport({ position: new THREE.Vector3(0, 0, 12), yaw: 0 });
  run.tick(2);
  assert.equal(pen.zombies.length, 0, 'the pen is cleared');
  assert.equal(boss.isAlive, false);
});
