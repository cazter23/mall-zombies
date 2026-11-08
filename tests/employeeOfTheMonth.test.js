// Employee of the Month (config/zombies.js mascotGold): a rare gold version of any unlocked Mascot costume. Checked: the
// round gate and the chance, never two at once, the tougher health, the gold look with its name badge, the PA line on
// arrival, and the guaranteed power-up at its body (through the power-up system's own reward drop, outside the meter),
// but not once the player is dead.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js'; // (first: it stubs the browser globals)
import { zombieHealthFor } from '../src/config/economy.js';
import { mascotGold, mascotGoldTypes, mascotTypes } from '../src/config/zombies.js';
import { seededRandom } from '../src/world/textures.js';
import { MASCOT_VARIANT_IDS } from '../src/zombies/mascotVariants.js';

function fixture(t, round = mascotGold.fromRound) {
  const scene = new THREE.Scene();
  const game = headlessGame({ scene });
  const { g } = game;
  g.health.invulnerable = true;
  g.rounds.jumpTo(round);
  g.rounds.update = () => {};
  game.standAt(0, 12);
  t.after(() => {
    g.resetRun();
    g.map.dispose();
  });
  return { ...game, scene };
}
const at = (x = 0, z = 8) => new THREE.Vector3(x, 0, z);
const kill = (zombie) => zombie.takeHit({ damage: 1e9, part: 'body', source: 'hazard' });

test('every costume has a gold version: the same Mascot, tougher, in gold and black with a name badge', () => {
  for (const id of MASCOT_VARIANT_IDS) {
    const gold = mascotGoldTypes[id];
    assert.equal(gold.id, 'mascot');
    assert.equal(gold.variant, id);
    assert.equal(gold.gold, true);
    assert.equal(gold.guaranteedDrop, true);
    assert.equal(gold.mascot.head.kind, mascotTypes[id].mascot.head.kind, 'its own head, gilded');
    assert.notEqual(gold.mascot.colors.suit, mascotTypes[id].mascot.colors.suit);
    assert.ok(Object.values(mascotGold.palette).includes(gold.mascot.colors.suit), 'the suit is gold or black');
    assert.equal(gold.mascot.colors.skin, mascotTypes[id].mascot.colors.skin, 'the zombie inside is the same green');
    assert.equal(mascotTypes[id].gold, undefined, 'the everyday costume is not gold');
  }
  assert.ok(mascotGold.healthMultiplier > 1);
});

test('none before goldFromRound; from then a goldChance roll for each Mascot, in any costume, never two at once', (t) => {
  const { g } = fixture(t, mascotGold.fromRound - 1);
  // The dice say exactly what they say: just under the chance is gold, just over is not.
  let roll = 0;
  t.mock.method(Math, 'random', () => roll);
  const spawn = (options) => {
    const zombie = g.zombies.spawn('mascot', at(), options);
    const gold = !!zombie.type.gold;
    g.zombies.clear();
    return gold;
  };
  assert.equal(spawn(), false, 'not before its round, whatever the dice');
  g.rounds.jumpTo(mascotGold.fromRound);
  g.rounds.update = () => {};
  roll = mascotGold.chance - 1e-3;
  assert.equal(spawn(), true);
  roll = mascotGold.chance + 1e-3;
  assert.equal(spawn(), false);
  assert.equal(spawn({ gold: true }), true, '(a forced one: debug)');
  roll = 0;
  g.rounds.jumpTo(30);
  g.rounds.update = () => {};
  for (const id of MASCOT_VARIANT_IDS) {
    const zombie = g.zombies.spawn('mascot', at(), { variant: id });
    assert.equal(zombie.type, mascotGoldTypes[id], `a gold ${id}`);
    g.zombies.clear();
  }
  t.mock.restoreAll();
  t.mock.method(Math, 'random', seededRandom(77));

  const first = g.zombies.spawn('mascot', at(-1), { gold: true });
  assert.ok(first.type.gold);
  const second = g.zombies.spawn('mascot', at(1), { gold: true });
  assert.ok(second.type.mascot && !second.type.gold, 'one Employee of the Month at a time');
  kill(first);
  const third = g.zombies.spawn('mascot', at(3), { gold: true });
  assert.ok(third.type.gold, 'once the first is down, another may come');
});

test('tougher by goldHealth, announced on the PA with a chime, wearing its badge', (t) => {
  const { g, hud, sounds } = fixture(t, 20);
  const gold = g.zombies.spawn('mascot', at(), { variant: 'poppyCorn', gold: true });
  assert.equal(gold.maxHealth, Math.round(zombieHealthFor('mascot', 20) * mascotGold.healthMultiplier));
  assert.equal(gold.health, gold.maxHealth);
  assert.equal(gold.type, mascotGoldTypes.poppyCorn);
  const plain = g.zombies.spawn('mascot', at(2), { variant: 'poppyCorn' });
  assert.equal(plain.maxHealth, zombieHealthFor('mascot', 20));
  assert.ok(gold.model.root.getObjectByName('mascotBadge'), 'the name badge');
  assert.equal(plain.model.root.getObjectByName('mascotBadge'), undefined);
  assert.equal(hud.calls.filter(([name, line]) => name === 'showAnnouncement' && line.text === mascotGold.spawnLine.text).length, 1);
  assert.ok(sounds.includes('paChime'));
});

test('it always drops a power-up at its body, outside the drop meter, whatever killed it', (t) => {
  const { g, tick } = fixture(t, 20);
  const drops = [];
  g.events.on('powerUpDrop', (drop) => drops.push(drop));
  tick(1);
  const progress = g.powerUps.progress;
  const gold = g.zombies.spawn('mascot', at(2, 9), { gold: true });
  const body = gold.position.clone();
  kill(gold); // (a hazard kill: no meter credit at all)
  tick(2);
  assert.equal(drops.length, 1, 'one power-up');
  assert.ok(drops[0].position.distanceTo(body) < 1.6, 'at its body');
  assert.equal(g.powerUps.pickup.id, drops[0].id);
  assert.equal(g.powerUps.dropsThisRound, 0, 'not counted against the round\'s drops');
  assert.equal(g.powerUps.progress, progress, 'and the meter is untouched');

  const plain = g.zombies.spawn('mascot', at(-2, 9), { gold: false });
  kill(plain);
  tick(2);
  assert.equal(drops.length, 1, 'an everyday Mascot drops nothing extra');
});

test('no drop once the player is dead', (t) => {
  const { g, tick } = fixture(t, 20);
  const drops = [];
  g.events.on('powerUpDrop', (drop) => drops.push(drop));
  const gold = g.zombies.spawn('mascot', at(2, 9), { gold: true });
  g.health.invulnerable = false;
  g.health.takeDamage(1e6);
  assert.ok(g.state.over);
  kill(gold);
  tick(5);
  assert.equal(drops.length, 0);
  assert.equal(g.powerUps.pickup, null);
});

test('the debug key spawns an Employee of the Month in each costume in turn', (t) => {
  const { g, tick } = fixture(t, 20);
  g.zombies.clear();
  assert.equal(g.debug.resolve('KeyM', true).id, 'spawnGoldMascot');
  const seen = [];
  for (let i = 0; i < MASCOT_VARIANT_IDS.length; i++) {
    let message = g.debug.run('spawnGoldMascot');
    for (let tries = 0; tries < 20 && !message.startsWith('Spawned'); tries++) { tick(20); message = g.debug.run('spawnGoldMascot'); }
    const zombie = g.zombies.zombies.at(-1);
    assert.ok(zombie.type.gold, message);
    seen.push(zombie.type.variant);
    kill(zombie);
  }
  assert.deepEqual(seen, MASCOT_VARIANT_IDS);
});
