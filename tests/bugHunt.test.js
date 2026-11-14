// THE NOVEMBER 2026 BUG HUNT: one regression test per bug found by reading the whole game and proving each suspicion
// in the real game (tests/helpers/headlessGame.js). Each test names what the player would have seen. docs/history.md
// has the list; a test here guards a RULE (ammo is never taken away, a sold-out bin can't be ordered...), not a number.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { weapons } from '../src/config/weapons.js';
import { returnToSender } from '../src/weapons/returnToSender.js';
import { resolveGun } from '../src/weapons/gunStats.js';
import { withTier } from '../src/weapons/upgrades.js';
import { headlessGame } from './helpers/headlessGame.js';

// A real game with the rounds held still (no zombies of its own) and the hallway bought.
function quietGame(context) {
  const t = headlessGame();
  context.after(() => { t.g.resetRun(); t.g.map.dispose(); });
  const { g } = t;
  g.rounds.update = () => {};
  t.tick();
  g.map.areaUnlocks.unlock('hallway');
  t.tick(60);
  const spawn = (type, x, z, options) => {
    const zombie = g.zombies.spawn(type, new THREE.Vector3(x, 0, z), options);
    zombie.setState('chasing');
    zombie.speed = 0;
    zombie.attackCooldown = 99;
    return zombie;
  };
  return { ...t, spawn };
}

// With Math.random pinned for the length of `run` (the map is built first: Three.js makes ids with it).
function withRandom(value, run) {
  const real = Math.random;
  Math.random = () => value;
  try { return run(); } finally { Math.random = real; }
}

test('Full Refund never takes ammo away: a reserve above the cap (the Fanny Pack came off) keeps every round', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.wardrobe.buy('fannyPack');
  g.gun.give(weapons.returnToSender);
  t.tick(60);
  const weapon = g.gun.weapon;
  g.wardrobe.buy('goldCard'); // (same slot: the Fanny Pack comes off, the rounds it let you carry stay)
  assert.ok(weapon.reserve > weapon.reserveCap, 'the scenario: more rounds than the cap');
  const before = weapon.reserve;
  g.returnQuest.debug('labels');
  while (g.returnQuest.fitted !== 'refund') g.returnQuest.cycleLabel();
  const zombie = t.spawn('shopper', 0, 0);
  withRandom(0, () => { // (the roll says "a round back")
    returnToSender(zombie, { effects: g.effects, sound: null });
    g.returnQuest.blastDone();
  });
  assert.ok(weapon.reserve >= before, `the label's "round back" left ${weapon.reserve} of ${before} rounds`);
});

