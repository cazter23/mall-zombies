import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Vector3 } from 'three';
import { dt, headlessGame } from './helpers/headlessGame.js';
import { feel } from '../src/config/feel.js';
import { hazards } from '../src/config/hazards.js';
import { receiptLinesFor } from '../src/ui/screens.js';

function atCustomerService(testContext, options) {
  const game = headlessGame(options);
  const { g } = game;
  testContext.after(() => g.map.dispose());
  game.tick();
  g.rounds.update = () => {};
  g.zombies.clear();
  const desk = g.map.features.find(({ kind }) => kind === 'upgradeDesk');
  const stand = (position = desk.secondChancePosition) => game.standAt(position.x, position.z - 1.4, 180);
  const openHallway = () => {
    g.map.areaUnlocks.unlock('hallway');
    game.tick(120);
  };
  const buy = () => {
    stand();
    game.press('KeyF', 30);
  };
  return { ...game, desk, stand, openHallway, buy };
}

test('Customer Service sells Second Chance once through shared pricing', (t) => {
  const { g, desk, stand, openHallway, buy, hud } = atCustomerService(t);
  stand();
  assert.notEqual(g.interactions.prompt?.kind, 'secondChance');
  openHallway();
  stand(desk.position);
  assert.equal(g.interactions.prompt.kind, 'tier');
  stand(desk.meleePosition);
  assert.equal(g.interactions.prompt.kind, 'melee');
  stand();
  assert.equal(g.interactions.prompt.kind, 'secondChance');
  assert.equal(g.interactions.prompt.cost, 2000);
  assert.equal(g.interactions.prompt.canAfford, false);
  buy();
  assert.equal(g.wallet.totalSpent, 0);
  assert.equal(g.interactions.prompt.blocked, null);

  g.pricing.setDiscount('secondChance', 0.25);
  g.wallet.earn(4000);
  const price = g.pricing.priceOf('secondChance');
  assert.equal(g.interactions.prompt.cost, price);
  buy();
  assert.equal(g.wallet.totalSpent, price);
  assert.deepEqual(hud.calls.filter(([method]) => method === 'setSecondChance'), [['setSecondChance', true]]);
  assert.equal(g.interactions.prompt.blocked, 'Already held');
  buy();
  assert.equal(g.wallet.totalSpent, price);

  g.resetRun();
  assert.deepEqual(hud.calls.filter(([method]) => method === 'setSecondChance').at(-1), ['setSecondChance', false]);
  g.health.takeDamage(g.stats.maxHealth);
  assert.equal(g.state.over, true, 'reset also clears an unused revive');
  assert.equal(receiptLinesFor(g.death.summary).some(([label]) => label === 'Second Chance'), false);
});

test('a lethal Cart Pusher charge revives in place and preserves the shove until protection expires', (t) => {
  let deathCallbacks = 0;
  const { g, tick, standAt, openHallway, buy, hud, sounds } = atCustomerService(t, {
    onPlayerDeath: () => { deathCallbacks += 1; },
  });
  openHallway();
  g.wallet.earn(2000);
  buy();

  standAt(4, 2, -90);
  const cart = g.zombies.spawn('cartPusher', new Vector3(14, 0, 2));
  cart.setState('chasing');
  cart.chargeCheckTimer = 0;
  g.stats.maxHealth = 125;
  g.stats.health = 1;
  let deaths = 0;
  let runsEnded = 0;
  let revivedAt;
  const beforeTick = new Vector3();
  g.events.on('playerDeath', () => { deaths += 1; });
  g.events.on('runEnd', () => { runsEnded += 1; });
  g.events.on('playerHit', () => {
    if (g.health.isReviveProtected) revivedAt = g.player.position.clone();
  });
  for (let i = 0; i < 360 && !g.health.isReviveProtected && !g.state.over; i++) {
    beforeTick.copy(g.player.position);
    tick();
  }

  assert.equal(g.health.isReviveProtected, true);
  assert.equal(g.health.invulnerable, false);
  assert.equal(g.stats.health, 125);
  assert.equal(g.health.killedBy, null);
  assert.ok(revivedAt.distanceTo(beforeTick) < 0.01, 'revived where the charge hit');
  assert.equal(g.player.velocity.x, 0, 'the charge did not launch the revived player');
  assert.equal(cart.state, 'chasing');
  assert.ok(cart.staggerTimer > 0 && cart.velocity.x > 0, 'the cart was pushed away');
  assert.deepEqual([g.state.over, g.death.summary, deaths, runsEnded, deathCallbacks], [false, null, 0, 0, 0]);
  assert.deepEqual(hud.calls.filter(([method]) => method === 'setSecondChance').at(-1), ['setSecondChance', false]);
  assert.ok(hud.calls.some(([method, message]) => method === 'showAnnouncement'
    && message.text === 'Second Chance redeemed. Please return to your shift.'));
  assert.ok(sounds.includes('paChime'));

  g.zombies.clear();
  g.state.forceRun = false;
  tick(240);
  g.health.takeDamage(125);
  assert.equal(g.stats.health, 125, 'pausing does not use up the protection');
  g.state.forceRun = true;
  const protectionTicks = Math.round(feel.health.secondChance.protectionSeconds / dt);
  tick(protectionTicks - 2);
  g.health.takeDamage(125);
  assert.equal(g.stats.health, 125);
  tick(2);
  assert.equal(g.health.isReviveProtected, false);

  buy();
  assert.equal(g.interactions.prompt.blocked, 'Used this run');
  assert.equal(g.wallet.totalSpent, 2000);
  const cause = { type: 'zombie', id: 'shopper' };
  g.health.takeDamage(125, cause);
  assert.equal(g.state.over, true);
  assert.deepEqual([deaths, runsEnded, deathCallbacks], [1, 1, 1]);
  assert.deepEqual(g.death.summary.killedBy, cause);
  assert.equal(g.death.summary.assisted, false);
  assert.ok(receiptLinesFor(g.death.summary).some(([label, value]) => label === 'Second Chance' && value === 'Used'));
  tick(Math.ceil(feel.death.resultsDelay / dt) + 1);
  assert.equal(hud.calls.find(([method]) => method === 'showResults')[1], g.death.summary);

  assert.ok(g.resetSteps.includes('secondChance'));
  g.resetRun();
  assert.equal(g.health.isReviveProtected, false);
  openHallway();
  g.wallet.earn(2000);
  buy();
  assert.equal(g.interactions.prompt.blocked, 'Already held');
  assert.equal(g.wallet.totalSpent, 2000);
});

test('a lethal fall pushes only active nearby zombies on the same level and in sight', (t) => {
  const { g, standAt, openHallway, buy } = atCustomerService(t);
  openHallway();
  g.wallet.earn(2000);
  buy();
  standAt(4, 2);
  const spawn = (x, y, z) => {
    const zombie = g.zombies.spawn('shopper', new Vector3(x, y, z));
    zombie.setState('chasing');
    return zombie;
  };
  const nearby = spawn(6, 0, 2);
  const hidden = spawn(2, 0, 2);
  const upstairs = spawn(6, 3, 2);
  const distant = spawn(9, 0, 2);
  const spawning = spawn(5, 0, 0);
  spawning.setState('spawning');
  g.colliders.push(new Box3(new Vector3(2.9, 0, 1), new Vector3(3.1, 3, 3)));
  g.player.onFall({ drop: 10, damage: g.stats.maxHealth });
  assert.equal(g.health.isReviveProtected, true);
  assert.ok(nearby.velocity.x > 0);
  assert.ok(nearby.staggerTimer > 0);
  for (const zombie of [hidden, upstairs, distant, spawning]) assert.equal(zombie.staggerTimer, 0);
  assert.equal(g.runStats.kills, 0);
});

test('the fountain hazard can trigger Second Chance', (t) => {
  const { g, standAt, openHallway, buy } = atCustomerService(t);
  openHallway();
  g.wallet.earn(2000);
  buy();
  g.map.areaUnlocks.unlock('atrium');
  const fountain = g.features.list.find(({ feature }) => feature.kind === 'fountainHazard').instance;
  const { x, z } = hazards.fountain.center;
  standAt(x + hazards.fountain.radius - 1, z);
  g.stats.health = 1;
  assert.equal(fountain.trigger(), true);
  assert.equal(g.health.isReviveProtected, true);
  assert.equal(g.stats.health, g.stats.maxHealth);
  assert.equal(g.state.over, false);
});

test('hits and falls during the protection are not announced, and nothing reacts to them', (t) => {
  const { g, tick, standAt, openHallway, buy } = atCustomerService(t);
  openHallway();
  g.wallet.earn(2000);
  buy();
  g.wardrobe.grantAll(); // the Cardigan's tag swings when its extra health soaks up a hit
  assert.equal(g.wardrobe.wearing('torso'), 'cardigan');
  standAt(4, 2);
  let hits = 0;
  let falls = 0;
  g.events.on('playerHit', () => { hits += 1; });
  g.events.on('playerFall', () => { falls += 1; });
  const attacker = () => {
    const zombie = g.zombies.spawn('shopper', new Vector3(5, 0, 2));
    zombie.setState('chasing');
    return zombie;
  };

  attacker();
  g.stats.health = 1;
  for (let i = 0; i < 240 && !g.health.isReviveProtected; i++) tick();
  assert.equal(g.health.isReviveProtected, true);
  assert.equal(hits, 1, 'the lethal hit itself is announced');
  assert.equal(g.outfitRail.pulseCount('cardigan'), 0, 'full health after the revive is not the cardigan at work');

  // A fresh zombie (not shoved) swings at the protected player; a hard landing happens too.
  g.zombies.clear();
  const fresh = attacker();
  const velocity = g.player.velocity.clone();
  let swings = 0;
  for (let i = 0; i < 600 && g.health.isReviveProtected; i++) {
    const before = fresh.state;
    tick();
    if (before !== 'swing' && fresh.state === 'swing') swings += 1;
    if (i === 30) g.player.onFall({ drop: 10, damage: 50 });
  }
  assert.ok(swings > 0, 'it did swing while the player was protected');
  assert.deepEqual([hits, falls], [1, 0]);
  assert.equal(g.stats.health, g.stats.maxHealth);
  assert.equal(g.outfitRail.pulseCount('cardigan'), 0);
  assert.equal(g.player.velocity.x, velocity.x);

  // Protection over: the same zombie's next swing is an ordinary hit again.
  for (let i = 0; i < 600 && hits === 1; i++) tick();
  assert.equal(hits, 2);
  assert.ok(g.stats.health < g.stats.maxHealth);
  g.player.onFall({ drop: 10, damage: 1 });
  assert.equal(falls, 1);
});

test('Second Chance announces each change, and Play again mid-protection leaves nothing behind', (t) => {
  const { g, openHallway, buy, hud } = atCustomerService(t);
  const changes = [];
  g.events.on('secondChance', ({ status }) => changes.push(status));
  assert.equal(g.secondChance.status, 'available');
  openHallway();
  g.wallet.earn(2000);
  buy();
  assert.equal(g.secondChance.status, 'held');

  g.health.takeDamage(g.stats.maxHealth, { type: 'zombie', id: 'shopper' });
  assert.equal(g.secondChance.status, 'used');
  assert.equal(g.health.isReviveProtected, true);
  g.resetRun(); // (still protected)
  assert.deepEqual(changes, ['held', 'used', 'available']);
  assert.equal(g.health.isReviveProtected, false);
  assert.deepEqual(hud.calls.filter(([method]) => method === 'setSecondChance').map(([, held]) => held), [true, false, false]);
  g.health.takeDamage(10);
  assert.equal(g.stats.health, g.stats.maxHealth - 10, 'the new run starts unprotected');

  g.resetRun(); // nothing to clear: no change is announced
  assert.deepEqual(changes, ['held', 'used', 'available']);
});
