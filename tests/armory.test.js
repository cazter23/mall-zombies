// The test range's ARMORY BENCH (debug mode: maps/testRange/armory.js): hold F at the bench, pick from pages of columns, and each choice is
// applied at once through the game's own code: the gun, its warranty and renewals, attachments that fit, a Build-A-Blaster build
// (with its real gun boost), wardrobe items, Kevin's pockets and Bubble Wrap. Using it marks the run as a debug run.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { buildTestRange } from '../src/maps/testRange/testRange.js';
import { feel } from '../src/config/feel.js';
import { weapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';
import { buildOf } from '../src/config/workshop.js';
import { productOf } from '../src/config/kiosk.js';
import { tierOf, renewalsOf, attachmentsOf, attachmentFits } from '../src/weapons/upgrades.js';

const dt = 1 / feel.simulation.tickRate;
const holdTicks = Math.ceil(feel.interact.holdSeconds / dt) + 1;

function benchGame(t) {
  const run = headlessGame({ buildTestRange });
  t.after(() => run.g.map.dispose());
  run.tick(1);
  run.g.rounds.update = () => {};
  run.g.zombies.clear();
  run.g.health.invulnerable = true;
  return run;
}

// Walk up to the bench's buy side, facing it, and hold F: the form opens.
function openBench(run) {
  const { g } = run;
  for (let x = 9.2; x <= 12.8 && g.interactions.prompt?.kind !== 'armory'; x += 0.4) {
    g.player.teleport({ position: new THREE.Vector3(x, 0, -100 + 24.6), yaw: Math.PI });
    g.player.pitch = -0.4;
    run.tick(2);
  }
  assert.equal(g.interactions.prompt?.kind, 'armory', 'the bench takes focus');
  run.press('KeyF', holdTicks);
  assert.equal(g.state.menu, 'armory');
  return g.arena.armory;
}

test('the bench opens a form with five pages, and applies the gun, warranty, renewals and attachments through the game', (t) => {
  const run = benchGame(t);
  const { g } = run;
  assert.equal(g.state.assisted, false, 'a fresh run');
  const armory = openBench(run);
  assert.deepEqual(armory.view.pages.map((p) => p.name), ['Gun', 'Attachments', 'Build', 'Wardrobe', 'Equipment']);
  assert.equal(armory.view.columns.find((c) => c.id === 'gun').items.find((i) => i.current).id, g.gun.def.id, 'what is in hand is marked');

  armory.choose('gun', 'rivetRifle');
  assert.equal(g.gun.def.id, 'rivetRifle');
  assert.equal(g.state.assisted, true, 'a choice makes it a debug run');
  armory.choose('tier', 'platinum');
  assert.equal(tierOf(g.gun.modsFor('rivetRifle')), 'platinum');
  armory.choose('renewals', '2');
  assert.equal(renewalsOf(g.gun.modsFor('rivetRifle')), 2);
  const fits = Object.keys(upgrades.attachments).find((id) => attachmentFits(weapons.rivetRifle, id));
  const slot = upgrades.attachments[fits].slot;
  armory.choose(`attachment:${slot}`, fits);
  assert.equal(attachmentsOf(g.gun.modsFor('rivetRifle'))[slot], fits);
  armory.choose(`attachment:${slot}`, 'none');
  assert.equal(attachmentsOf(g.gun.modsFor('rivetRifle'))[slot], undefined, 'None takes it off');
  // An attachment that does not fit is offered greyed and refused.
  const misfit = Object.entries(upgrades.attachments).find(([id]) => !attachmentFits(weapons.rivetRifle, id));
  if (misfit) {
    const before = JSON.stringify(g.gun.modsFor('rivetRifle'));
    assert.equal(armory.choose(`attachment:${misfit[1].slot}`, misfit[0]), 'Does not fit');
    assert.equal(JSON.stringify(g.gun.modsFor('rivetRifle')), before, 'nothing changed');
  }
  // Back closes it.
  run.press('KeyQ');
  assert.equal(g.state.menu, null);
});

test('a build from the bench is a real one (the quality\'s gun boost, the stuffing), and No build takes it off', (t) => {
  const run = benchGame(t);
  const { g } = run;
  const armory = openBench(run);
  armory.choose('gun', 'nailGun');
  const plain = g.gun.def.damage;
  assert.equal(armory.choose('heart', 'reload'), 'Pick a stuffing', 'a Heart needs a build first');
  armory.choose('stuffing', 'smoothie');
  armory.choose('quality', 'overstuffed');
  armory.choose('heart', 'reload');
  const build = buildOf(g.gun.modsFor('nailGun'));
  assert.deepEqual([build.stuffing, build.quality, build.heart], ['smoothie', 'overstuffed', 'reload']);
  assert.ok(g.gun.def.damage > plain * 2, `an Overstuffed build more than doubles the damage (${plain} -> ${g.gun.def.damage})`);
  armory.choose('stuffing', 'none');
  assert.equal(buildOf(g.gun.modsFor('nailGun')), null);
  assert.equal(g.gun.def.damage, plain);
});

test('the wardrobe, Kevin\'s pockets and Bubble Wrap from the bench; walking away closes it', (t) => {
  const run = benchGame(t);
  const { g } = run;
  const armory = openBench(run);
  armory.choose('wardrobe:accessory', 'goldCard');
  assert.equal(g.wardrobe.wearing('accessory'), 'goldCard');
  armory.choose('wardrobe:accessory', 'foamFinger');
  armory.choose('wardrobe:accessory', 'goldCard');
  assert.equal(g.wardrobe.wearing('accessory'), 'goldCard', 'an owned item changes back');
  armory.choose('pocket:lethal', 'sodaBomb');
  assert.deepEqual(g.equipment.pockets.lethal, { id: 'sodaBomb', count: productOf('sodaBomb').charges });
  armory.choose('pocket:tactical', 'airHorn');
  assert.equal(g.equipment.pockets.tactical.id, 'airHorn');
  armory.choose('armour', '2');
  assert.equal(g.health.armour.length, 2);
  armory.choose('armour', '0');
  assert.equal(g.health.armour.length, 0);
  g.player.teleport({ position: new THREE.Vector3(0, 0, -100 + 15), yaw: 0 });
  run.tick(2);
  assert.equal(g.state.menu, null, 'closed once you are away from the bench');
});
