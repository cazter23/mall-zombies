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

test('Build-A-Blaster: a Stuffing that left today\'s bins while the order form was open cannot be ordered', (context) => {
  const t = quietGame(context);
  const { g } = t;
  g.wallet.earn(20000);
  for (const id of Object.keys(g.map.zones)) if (!g.map.zones[id].open) g.map.areaUnlocks.unlock(id, { instant: true });
  t.tick(5);
  const ritual = g.features.instanceOf('workshop').ritual;
  ritual.orderForm.open();
  const picked = ritual.form.stuffings.find((s) => s.selected).id;
  // The world doesn't stop for the form: rounds start, and every round start re-rolls the bins.
  for (let i = 0; i < 400 && ritual.today.includes(picked); i++) g.events.emit('roundStart', { round: g.rounds.round });
  assert.ok(!ritual.today.includes(picked), 'the scenario: the filled-in Stuffing is no longer in the bins');
  const points = g.wallet.points;
  t.press('Enter', 1);
  if (ritual.phase === 'idle') {
    assert.equal(g.wallet.points, points, 'nothing ordered, nothing paid');
  } else {
    assert.ok(ritual.today.includes(ritual.pick.stuffing), `ordered ${ritual.pick.stuffing}, which is not in today's bins (${ritual.today})`);
  }
  const selected = ritual.form?.stuffings.find((s) => s.selected);
  if (selected) assert.ok(selected.available, 'the form never shows a pick it marks unavailable');
});

test('a gun with no reserve in config has none in the hand: the Leaf Blower carries 0 spare, so a Platinum one can run dry and claim', (context) => {
  assert.equal(weapons.leafBlower.startingReserve, 0, 'the scenario: a tank gun, nothing spare');
  assert.equal(resolveGun(weapons.leafBlower, []).startingReserve, 0, 'resolving a gun must not invent a round');
  const t = quietGame(context);
  const { g } = t;
  g.gun.give(weapons.leafBlower);
  t.tick(60);
  assert.equal(g.gun.weapon.reserve, 0, 'no phantom round in the reserve');
  // Platinum's promise (config/upgrades.js claim): a gun that runs completely dry is refilled, once a round.
  g.gun.setMods('leafBlower', withTier(weapons.leafBlower, g.gun.modsFor('leafBlower'), 'platinum'));
  const claims = [];
  g.events.on('warrantyClaim', (claim) => claims.push(claim.weaponId));
  g.gun.weapon.magazine = 0;
  t.tick(2);
  assert.deepEqual(claims, ['leafBlower'], 'the dry Platinum Leaf Blower made its claim');
});
