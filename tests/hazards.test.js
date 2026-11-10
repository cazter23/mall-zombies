// Environmental hazards (docs/hazards-plan.md, config/hazards.js, game/features/hazards.js,
// game/features/fountainHazard.js): pay to trigger through g.pricing, active pulses with source
// 'hazard' (1-shot early rounds, 2-shot late rounds, opening stagger + convulsion slow, boss/Mascot
// cap), cooldowns, payouts (Mascot helmet bonus and regular power-up meter ignore hazard kills;
// Gold Mascot drops and kill multipliers still apply), player self-shock/slow while standing inside,
// nothing paid after death, and Play again (resetRun) leaving nothing behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { hazards } from '../src/config/hazards.js';
import { economy } from '../src/config/economy.js';
import { hasStatNumber } from '../src/config/effectWords.js';

const cfg = hazards.fountain;
const OUTSIDE_Z = 10.5; // 8.1 m south of fountain center (18.6), outside the 7.0 m radius

function standAtFountainSwitch(t, distance = 1.25) {
  const { x, z } = cfg.position;
  const { x: nx, z: nz } = cfg.normal;
  const yawDeg = (Math.atan2(nx, nz) * 180) / Math.PI;
  t.standAt(x + nx * distance, z + nz * distance, yawDeg);
}

function getFountainInstance(g) {
  return g.features.list.find((f) => f.feature.kind === 'fountainHazard')?.instance;
}

test('triggering, price and discounts: locked until Atrium opens, charges g.pricing ("hazard"), and respects Flash Sale discounts', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);

  // Atrium is locked at the start of a run: no prompt yet.
  standAtFountainSwitch(game);
  assert.equal(g.interactions.prompt, null, 'no prompt while Atrium is locked');

  // Unlock Atrium: prompt shows the shelf price from g.pricing.
  g.map.areaUnlocks.unlock('atrium');
  standAtFountainSwitch(game);
  assert.ok(g.interactions.prompt, 'prompt appears once Atrium is open');
  assert.equal(g.interactions.prompt.kind, 'hazard');
  assert.equal(g.interactions.prompt.id, 'fountain');
  assert.equal(g.interactions.prompt.cost, economy.hazards.fountain);

  // Apply a 40% hazard discount (e.g. Mall hazards Flash Sale).
  g.pricing.setDiscount('hazard', 0.4);
  const expectedPrice = g.pricing.priceOf('hazard', 'fountain');
  assert.equal(expectedPrice, 450);
  standAtFountainSwitch(game);
  assert.equal(g.interactions.prompt.cost, expectedPrice, 'prompt reflects the discounted hazard price');

  const before = g.wallet.points;
  const fountain = getFountainInstance(g);
  assert.equal(fountain.phase, 'ready');
  game.press('KeyF', 20);
  assert.equal(before - g.wallet.points, expectedPrice, 'charged the discounted hazard price');
  assert.equal(fountain.phase, 'active');
  assert.ok(game.sounds.includes(cfg.triggerSound), 'played the trigger sound');
});

test('cooldown: blocked while active ("Active") and recharging ("Recharging"), then ready again after cooldown elapses', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('atrium');

  const fountain = getFountainInstance(g);
  standAtFountainSwitch(game);
  game.press('KeyF', 20);
  assert.equal(fountain.phase, 'active');

  // Move outside the ring so the player isn't shocked while waiting out the timer, then step back to inspect prompt.
  game.standAt(20, OUTSIDE_Z, 180);
  standAtFountainSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.active);
  const walletWhileActive = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletWhileActive, 'cannot pay again while active');

  // Run out the remaining active time into cooldown.
  game.standAt(20, OUTSIDE_Z, 180);
  game.tick(Math.ceil(cfg.durationSeconds / dt) + 2);
  assert.equal(fountain.phase, 'cooldown');
  assert.ok(fountain.remaining > 0 && fountain.remaining <= cfg.cooldownSeconds);

  standAtFountainSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.cooldown);
  const walletDuringCooldown = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletDuringCooldown, 'cannot pay while recharging');

  // Finish the cooldown: ready to trigger again.
  game.standAt(20, OUTSIDE_Z, 180);
  game.tick(Math.ceil(cfg.cooldownSeconds / dt) + 5);
  assert.equal(fountain.phase, 'ready');
  standAtFountainSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, null);
});

test('payout, high-round 2-shot scaling, opening stagger, Mascot helmet rule, boss cap, power-ups, and nothing paid after death', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('atrium');

  const kills = [];
  const headPops = [];
  g.events.on('kill', (e) => kills.push(e));
  g.events.on('mascotHeadPop', (e) => headPops.push(e));

  // 1. Round-1 full-health Shopper (150 HP) is one-shot vaporized; a high-round Shopper (1000 maxHealth) takes 55% (550),
  //    staggers and convulse-slows (0.25) on pulse 1 with zero +10 hit payout, then dies on pulse 2.
  const earlyShopper = g.zombies.spawn('shopper', new THREE.Vector3(24.0, 0, 18.6));
  earlyShopper.setState('chasing');
  const lateShopper = g.zombies.spawn('shopper', new THREE.Vector3(16.0, 0, 18.6));
  lateShopper.setState('chasing');
  lateShopper.maxHealth = 1000;
  lateShopper.health = 1000;

  const pointsBefore = g.wallet.points;
  const progressBefore = g.powerUps.progress;
  const fountain = getFountainInstance(g);
  game.standAt(20, OUTSIDE_Z, 180);
  fountain.trigger();

  assert.equal(earlyShopper.isAlive, false, 'round-1 full-health shopper is one-shot on the opening pulse');
  assert.equal(kills.length, 1);
  assert.equal(kills[0].source, 'hazard');
  assert.equal(kills[0].headshot, false);
  assert.equal(kills[0].melee, false);
  assert.equal(g.wallet.points - pointsBefore, economy.killValues.shopper, 'paid exact shopper killValue with zero +10 non-lethal hit points');
  assert.equal(g.runStats.kills, 1);
  assert.equal(g.powerUps.progress, progressBefore, 'hazard kills do not fill the regular power-up meter');

  assert.equal(lateShopper.isAlive, true);
  assert.equal(lateShopper.health, 1000 - 1000 * cfg.normalHealthFraction, 'high-round shopper took 55% maxHealth on pulse 1');
  assert.equal(lateShopper.slowFraction, cfg.slowFactor, 'high-round shopper is convulse-slowed to 0.25');
  assert.ok(lateShopper.staggerTimer > 0, 'opening surge staggered the shopper');

  // Second pulse finishes off the high-round shopper.
  game.tick(Math.ceil(cfg.pulseInterval / dt) + 1);
  assert.equal(lateShopper.isAlive, false, 'high-round shopper died on pulse 2');
  assert.equal(g.wallet.points - pointsBefore, economy.killValues.shopper * 2);

  // 2. Mascot helmet pop from a hazard: pops the helmet at 50% HP, but pays NO helmetPopBonus ("stuffings and hazards don't aim").
  g.zombies.clear();
  const mascot = g.zombies.spawn('mascot', new THREE.Vector3(24.0, 0, 18.6), { gold: false });
  const pulseCap = mascot.maxHealth * cfg.maxHealthCap;
  mascot.health = Math.floor(mascot.maxHealth * 0.5) + Math.min(10, pulseCap * 0.5);
  const healthBeforePulse = mascot.health;
  const walletBeforeMascot = g.wallet.points;
  game.tick(Math.ceil(cfg.pulseInterval / dt) + 1);
  assert.ok(Math.abs((healthBeforePulse - mascot.health) - pulseCap) < 1e-6, 'Mascot damage is capped by maxHealthCap (10%) per pulse');
  assert.equal(headPops.length, 1, 'Mascot helmet popped at 50% HP');
  assert.equal(headPops[0].source, 'hazard');
  assert.equal(g.wallet.points, walletBeforeMascot, 'hazard helmet pop does NOT pay helmetPopBonus');

  // 3. Employee of the Month (Gold Mascot): killing it with a hazard STILL drops its guaranteed power-up.
  g.zombies.clear();
  const goldMascot = g.zombies.spawn('mascot', new THREE.Vector3(24.0, 0, 18.6), { gold: true });
  goldMascot.health = 5;
  game.tick(Math.ceil(cfg.pulseInterval / dt) + 1);
  assert.equal(goldMascot.isAlive, false);
  assert.ok(g.powerUps.pickup, 'Gold Mascot killed by a hazard still drops its guaranteed power-up');

  // 4. Once the player is dead (state.over), nothing more is paid or counted.
  const doomed = g.zombies.spawn('shopper', new THREE.Vector3(24.0, 0, 18.6));
  doomed.health = 5;
  g.health.takeDamage(10_000);
  assert.equal(g.state.over, true);
  const walletAtDeath = g.wallet.points;
  const killsAtDeath = g.runStats.kills;
  game.tick(Math.ceil(cfg.pulseInterval / dt) + 2);
  assert.equal(g.wallet.points, walletAtDeath, 'nothing paid after player death');
  assert.equal(g.runStats.kills, killsAtDeath, 'no kills counted after player death');
});

test('player standing in the active fountain takes shock damage and is slowed, then recovers when stepping out', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('atrium');

  // Stand at the switch (inside the 7.0 m ring) and trigger the fountain.
  standAtFountainSwitch(game);
  const healthBefore = g.stats.health;
  game.press('KeyF', 20);
  assert.ok(g.stats.health <= healthBefore - cfg.playerDamage, 'player took shock damage from the fountain');
  assert.equal(g.stats.surfaceSpeed, cfg.playerSlowFactor, 'player surfaceSpeed is slowed while inside the active ring');

  // Step outside the 7.0 m ring (center is z = 18.6; OUTSIDE_Z = 10.5 is 8.1 m away).
  game.standAt(20, OUTSIDE_Z, 180);
  assert.equal(g.stats.surfaceSpeed, 1, 'surfaceSpeed returns to 1 as soon as the player steps outside');
  const healthOutside = g.stats.health;
  game.tick(Math.ceil(cfg.pulseInterval / dt) + 2);
  assert.ok(g.stats.health >= healthOutside, 'no shock damage while outside the ring');
});

test('Play again (resetRun) clears active hazard state, cooldowns, visuals, and player slow (snapshot equality)', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  const fresh = snapshot(g);

  game.tick(1);
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('atrium');
  standAtFountainSwitch(game);
  game.press('KeyF', 20);

  const fountain = getFountainInstance(g);
  assert.equal(fountain.phase, 'active');
  assert.equal(g.stats.surfaceSpeed, cfg.playerSlowFactor);

  g.resetRun();
  assert.equal(fountain.phase, 'ready');
  assert.equal(fountain.remaining, 0);
  assert.equal(g.stats.surfaceSpeed, 1);
  assert.deepEqual(snapshot(g), fresh);
});

test('words-only guard: every hazard config string and live prompt has no stat numbers or multiplier words', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.map.areaUnlocks.unlock('atrium');

  const multiplierWords = /\b(half|twice|double|triple|quadruple|times)\b/i;
  const strings = (value, out = []) => {
    if (typeof value === 'string') out.push(value);
    else if (value && typeof value === 'object') for (const v of Object.values(value)) strings(v, out);
    return out;
  };
  for (const text of strings(hazards)) {
    assert.ok(!hasStatNumber(text), `hazard config string "${text}" shows a stat number`);
    assert.ok(!multiplierWords.test(text), `hazard config string "${text}" says a multiplier in words`);
  }

  standAtFountainSwitch(game);
  const prompt = g.interactions.prompt;
  assert.ok(prompt);
  for (const key of ['label', 'title', 'detail', 'blocked']) {
    if (prompt[key]) {
      assert.ok(!hasStatNumber(prompt[key]), `prompt.${key}: "${prompt[key]}"`);
      assert.ok(!multiplierWords.test(prompt[key]), `prompt.${key}: "${prompt[key]}"`);
    }
  }
});
