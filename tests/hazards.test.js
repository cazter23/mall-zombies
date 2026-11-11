// Environmental hazards (docs/archive/hazards-plan.md, config/hazards.js, game/features/hazards.js,
// game/features/fountainHazard.js, game/features/fryerHazard.js, game/features/sprinklerHazard.js,
// game/features/paLureHazard.js):
// pay to trigger through g.pricing, active pulses with source 'hazard' (fountain shock + stagger +
// convulsion slow, fryer opening burst + slip, sprinkler chill + soak applyVulnerable on zombies,
// bosses, and Mascots, PA lure hold + feedback pop, boss/Mascot damage cap, boss slip/hold immunity),
// Kiosk Kevin nearest-prompt-wins, 3 m Service Corridor crowd + failsafe check, cooldowns, payouts
// (Mascot helmet bonus and regular power-up meter ignore hazard kills; Gold Mascot drops and kill
// multipliers still apply), Closing Time line 1 counts fountainKills only (not fryerKills, sprinklerKills,
// or paLureKills), player self-shock/scald/slow while standing inside, nothing paid after death,
// and Play again (resetRun) leaving nothing behind.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame, snapshot, dt } from './helpers/headlessGame.js';
import { hazards } from '../src/config/hazards.js';
import { economy } from '../src/config/economy.js';
import { hasStatNumber } from '../src/config/effectWords.js';

const cfg = hazards.fountain;
const fryerCfg = hazards.fryer;
const sprinklerCfg = hazards.sprinklers;
const paLureCfg = hazards.paLure;
const OUTSIDE_Z = 10.5; // 8.1 m south of fountain center (18.6), outside the 7.0 m radius
const FRYER_OUTSIDE_Z = -5.0; // north of the grease apron (minZ: -13.0, maxZ: -6.5)
const SPRINKLER_OUTSIDE_X = -15.0; // west of the drenched concourse (minX: -12, maxX: 12)
const PALURE_OUTSIDE = { x: 0, z: 12 }; // Start Room, well outside the 10 m radius around (-21.5, -4.5)

function standAtFountainSwitch(t, distance = 1.25) {
  const { x, z } = cfg.position;
  const { x: nx, z: nz } = cfg.normal;
  const yawDeg = (Math.atan2(nx, nz) * 180) / Math.PI;
  t.standAt(x + nx * distance, z + nz * distance, yawDeg);
}

function getFountainInstance(g) {
  return g.features.list.find((f) => f.feature.kind === 'fountainHazard')?.instance;
}

function standAtFryerSwitch(t, distance = 1.25) {
  const { x, z } = fryerCfg.position;
  const { x: nx, z: nz } = fryerCfg.normal;
  const yawDeg = (Math.atan2(nx, nz) * 180) / Math.PI;
  t.standAt(x + nx * distance, z + nz * distance, yawDeg);
}

function getFryerInstance(g) {
  return g.features.list.find((f) => f.feature.kind === 'fryerHazard')?.instance;
}

function standAtSprinklerSwitch(t, distance = 1.25) {
  const { x, z } = sprinklerCfg.position;
  const { x: nx, z: nz } = sprinklerCfg.normal;
  const yawDeg = (Math.atan2(nx, nz) * 180) / Math.PI;
  t.standAt(x + nx * distance, z + nz * distance, yawDeg);
}

function getSprinklerInstance(g) {
  return g.features.list.find((f) => f.feature.kind === 'sprinklerHazard')?.instance;
}

function standAtPaLureSwitch(t, distance = 1.25) {
  const { x, z } = paLureCfg.position;
  const { x: nx, z: nz } = paLureCfg.normal;
  const yawDeg = (Math.atan2(nx, nz) * 180) / Math.PI;
  t.standAt(x + nx * distance, z + nz * distance, yawDeg);
}

function getPaLureInstance(g) {
  return g.features.list.find((f) => f.feature.kind === 'paLureHazard')?.instance;
}

// Ticks past a hazard's stand-clear grace (the seconds after the switch is thrown in which it spares the player)
// and one more pulse, so the next pulse that can hurt the player has landed.
function pastGrace(game, hazardCfg) {
  game.tick(Math.ceil(((hazardCfg.playerGraceSeconds ?? 0) + hazardCfg.pulseInterval) / dt) + 1);
}

test('stand clear: the fountain and fryer spare the player for their grace after the switch is thrown, never the zombies', (t) => {
  for (const [hazardCfg, instance, standAtSwitch, zombieAt] of [
    [cfg, getFountainInstance, standAtFountainSwitch, [cfg.center.x + cfg.innerRadius + 1, cfg.center.z]],
    [fryerCfg, getFryerInstance, standAtFryerSwitch, [fryerCfg.bounds.minX + 1, fryerCfg.bounds.maxZ - 1]],
  ]) {
    const game = headlessGame();
    const { g } = game;
    game.tick(1);
    g.rounds.update = () => {};
    g.zombies.clear();
    g.wallet.earn(10_000);
    g.map.areaUnlocks.unlock(hazardCfg.zone);
    assert.ok(hazardCfg.playerGraceSeconds > hazardCfg.pulseInterval, `${hazardCfg.id}: the grace covers the opening pulse and more`);
    const zombie = g.zombies.spawn('shopper', new THREE.Vector3(zombieAt[0], 0, zombieAt[1]));
    zombie.setState('chasing');

    standAtSwitch(game); // (inside its own zone)
    const hazard = instance(g);
    const healthBefore = g.stats.health;
    assert.equal(hazard.trigger(), true);
    assert.equal(zombie.isAlive, false, `${hazardCfg.id}: the opening pulse still hits zombies`);
    assert.equal(hazard.sparingPlayer, true);
    game.tick(Math.floor(hazardCfg.playerGraceSeconds / dt) - 1);
    assert.equal(g.stats.health, healthBefore, `${hazardCfg.id}: no damage while the player steps clear`);
    assert.equal(g.stats.surfaceSpeed, 1, `${hazardCfg.id}: no slow either`);

    pastGrace(game, hazardCfg);
    assert.equal(hazard.sparingPlayer, false);
    assert.ok(g.stats.health < healthBefore, `${hazardCfg.id}: staying in it hurts once the grace is over`);
    assert.equal(g.stats.surfaceSpeed, hazardCfg.playerSlowFactor);
    g.map.dispose();
  }
});

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

  // Stand at the switch (inside the 7.0 m ring), trigger the fountain and stay past the stand-clear grace.
  standAtFountainSwitch(game);
  const healthBefore = g.stats.health;
  game.press('KeyF', 20);
  pastGrace(game, cfg);
  assert.ok(g.stats.health <= healthBefore - cfg.playerDamage, 'player took shock damage from the fountain');
  assert.equal(g.stats.surfaceSpeed, cfg.playerSlowFactor, 'player surfaceSpeed is slowed while inside the active ring');

  // Step outside the 7.0 m ring (center is z = 18.6; OUTSIDE_Z = 10.5 is 8.1 m away).
  game.standAt(20, OUTSIDE_Z, 180);
  assert.equal(g.stats.surfaceSpeed, 1, 'surfaceSpeed returns to 1 as soon as the player steps outside');
  const healthOutside = g.stats.health;
  game.tick(Math.ceil(cfg.pulseInterval / dt) + 2);
  assert.ok(g.stats.health >= healthOutside, 'no shock damage while outside the ring');
});

test('a hazard slows the player through game/surfaceSlows.js: it never overwrites or wipes another source\'s slow (a boss wet floor, a melt)', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.unlock('atrium');
  const fountain = getFountainInstance(g);
  g.health.invulnerable = true; // (the whole activation, standing in the ring, would kill the player: that is not this test)
  game.standAt(cfg.center.x - 5, cfg.center.z, 0); // inside the ring, clear of the basin

  // A stronger slow from another source wins while both run; the fountain's own slot holds its factor.
  fountain.trigger();
  g.surfaces.set('testFloor', 0.5);
  pastGrace(game, cfg);
  assert.equal(g.surfaces.factorOf(`hazard:${cfg.id}`), cfg.playerSlowFactor, 'the fountain reports its slow as its own source');
  assert.equal(g.stats.surfaceSpeed, 0.5, 'the lowest slow wins');

  // A weaker one: the fountain decides, and when the fountain ends the other slow is still there (not reset to 1).
  g.surfaces.set('testFloor', 0.9);
  game.tick(1);
  assert.equal(g.stats.surfaceSpeed, cfg.playerSlowFactor);
  game.tick(Math.ceil(cfg.durationSeconds / dt) + 2);
  assert.equal(fountain.phase, 'cooldown');
  assert.equal(g.surfaces.factorOf(`hazard:${cfg.id}`), 1, 'the fountain cleared its own slot');
  assert.equal(g.stats.surfaceSpeed, 0.9, "the other source's slow survives the fountain ending");
  g.surfaces.clear('testFloor');
  assert.equal(g.stats.surfaceSpeed, 1);
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
  pastGrace(game, cfg);

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

  g.map.areaUnlocks.unlock('foodCourt');
  standAtFryerSwitch(game);
  const fryerPrompt = g.interactions.prompt;
  assert.ok(fryerPrompt);
  for (const key of ['label', 'title', 'detail', 'blocked']) {
    if (fryerPrompt[key]) {
      assert.ok(!hasStatNumber(fryerPrompt[key]), `fryerPrompt.${key}: "${fryerPrompt[key]}"`);
      assert.ok(!multiplierWords.test(fryerPrompt[key]), `fryerPrompt.${key}: "${fryerPrompt[key]}"`);
    }
  }

  g.map.areaUnlocks.unlock('hallway');
  standAtSprinklerSwitch(game);
  const sprinklerPrompt = g.interactions.prompt;
  assert.ok(sprinklerPrompt);
  for (const key of ['label', 'title', 'detail', 'blocked']) {
    if (sprinklerPrompt[key]) {
      assert.ok(!hasStatNumber(sprinklerPrompt[key]), `sprinklerPrompt.${key}: "${sprinklerPrompt[key]}"`);
      assert.ok(!multiplierWords.test(sprinklerPrompt[key]), `sprinklerPrompt.${key}: "${sprinklerPrompt[key]}"`);
    }
  }

  g.map.areaUnlocks.unlock('serviceCorridor');
  standAtPaLureSwitch(game);
  const paLurePrompt = g.interactions.prompt;
  assert.ok(paLurePrompt);
  for (const key of ['label', 'title', 'detail', 'blocked']) {
    if (paLurePrompt[key]) {
      assert.ok(!hasStatNumber(paLurePrompt[key]), `paLurePrompt.${key}: "${paLurePrompt[key]}"`);
      assert.ok(!multiplierWords.test(paLurePrompt[key]), `paLurePrompt.${key}: "${paLurePrompt[key]}"`);
    }
  }
});

test('fryer triggering, price and discounts: locked until Food Court opens, charges g.pricing ("hazard"), and respects Flash Sale discounts', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);

  // Food Court is locked at the start of a run: no prompt yet.
  standAtFryerSwitch(game);
  assert.equal(g.interactions.prompt, null, 'no prompt while Food Court is locked');

  // Unlock Food Court: prompt shows the shelf price from g.pricing.
  g.map.areaUnlocks.unlock('foodCourt');
  standAtFryerSwitch(game);
  assert.ok(g.interactions.prompt, 'prompt appears once Food Court is open');
  assert.equal(g.interactions.prompt.kind, 'hazard');
  assert.equal(g.interactions.prompt.id, 'fryer');
  assert.equal(g.interactions.prompt.cost, economy.hazards.fryer);

  // Apply a 40% hazard discount (e.g. Mall hazards Flash Sale).
  g.pricing.setDiscount('hazard', 0.4);
  const expectedPrice = g.pricing.priceOf('hazard', 'fryer');
  assert.equal(expectedPrice, 450);
  standAtFryerSwitch(game);
  assert.equal(g.interactions.prompt.cost, expectedPrice, 'prompt reflects the discounted hazard price');

  const before = g.wallet.points;
  const fryer = getFryerInstance(g);
  assert.equal(fryer.phase, 'ready');
  game.press('KeyF', 20);
  assert.equal(before - g.wallet.points, expectedPrice, 'charged the discounted hazard price');
  assert.equal(fryer.phase, 'active');
  assert.ok(game.sounds.includes(fryerCfg.triggerSound), 'played the trigger sound');
});

test('fryer cooldown: blocked while active ("Active") and recharging ("Recharging"), then ready again after cooldown elapses', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('foodCourt');

  const fryer = getFryerInstance(g);
  standAtFryerSwitch(game);
  game.press('KeyF', 20);
  assert.equal(fryer.phase, 'active');

  // Step back to inspect prompt while active.
  standAtFryerSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.active);
  const walletWhileActive = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletWhileActive, 'cannot pay again while active');

  // Run out the remaining active time into cooldown while standing outside the grease apron.
  game.standAt(5.75, FRYER_OUTSIDE_Z, 0);
  game.tick(Math.ceil(fryerCfg.durationSeconds / dt) + 2);
  assert.equal(fryer.phase, 'cooldown');
  assert.ok(fryer.remaining > 0 && fryer.remaining <= fryerCfg.cooldownSeconds);

  standAtFryerSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.cooldown);
  const walletDuringCooldown = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletDuringCooldown, 'cannot pay while recharging');

  // Finish the cooldown: ready to trigger again.
  game.standAt(5.75, FRYER_OUTSIDE_Z, 0);
  game.tick(Math.ceil(fryerCfg.cooldownSeconds / dt) + 5);
  assert.equal(fryer.phase, 'ready');
  standAtFryerSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, null);
});

test('fryer payout, opening burst vs pulse scaling, zombie slip, boss slip immunity & cap, Mascot helmet rule, Gold Mascot drop, and nothing paid after death', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('foodCourt');

  const kills = [];
  const fryerKills = [];
  const headPops = [];
  g.events.on('kill', (e) => kills.push(e));
  g.events.on('fryerKill', (e) => fryerKills.push(e));
  g.events.on('mascotHeadPop', (e) => headPops.push(e));

  // 1. Round-1 full-health Shopper (150 HP) in the apron is one-shot by the 180-damage opening burst;
  //    a high-round Shopper (1000 maxHealth) takes 45% (450) and slips (0.9 s) on pulse 1 with zero +10 hit payout,
  //    takes another 45% (450) on pulse 2, and dies on pulse 3.
  const earlyShopper = g.zombies.spawn('shopper', new THREE.Vector3(4.5, 0, -9.5));
  earlyShopper.setState('chasing');
  const lateShopper = g.zombies.spawn('shopper', new THREE.Vector3(7.0, 0, -9.5));
  lateShopper.setState('chasing');
  lateShopper.maxHealth = 1000;
  lateShopper.health = 1000;

  // Boss standing in the grease apron: ignores applySlip and caps damage at maxHealthCap (10%).
  const boss = g.zombies.spawn('janitor', new THREE.Vector3(5.75, 0, -8.5));
  boss.setState('chasing');
  const bossInitialHealth = boss.health;

  const pointsBefore = g.wallet.points;
  const progressBefore = g.powerUps.progress;
  const fryer = getFryerInstance(g);
  game.standAt(5.75, FRYER_OUTSIDE_Z, 0);
  fryer.trigger();

  assert.equal(earlyShopper.isAlive, false, 'round-1 full-health shopper is one-shot by the opening fryer burst');
  assert.equal(kills.length, 1);
  assert.equal(fryerKills.length, 1);
  assert.equal(kills[0].source, 'hazard');
  assert.equal(kills[0].headshot, false);
  assert.equal(kills[0].melee, false);
  assert.equal(g.wallet.points - pointsBefore, economy.killValues.shopper, 'paid exact shopper killValue with zero +10 non-lethal hit points');
  assert.equal(g.runStats.kills, 1);
  assert.equal(g.powerUps.progress, progressBefore, 'hazard kills do not fill the regular power-up meter');

  assert.equal(lateShopper.isAlive, true);
  assert.equal(lateShopper.health, 1000 - 1000 * fryerCfg.normalHealthFraction, 'high-round shopper took 45% maxHealth on pulse 1');
  assert.equal(lateShopper.slipTimer, fryerCfg.slipDuration, 'normal zombie slipped on the scalding grease apron');
  assert.equal(lateShopper.staggerDrag, fryerCfg.slipDrag);

  assert.equal(boss.slipTimer, 0, 'bosses ignore applySlip');
  assert.ok(Math.abs((bossInitialHealth - boss.health) - boss.maxHealth * fryerCfg.maxHealthCap) < 1e-6, 'boss damage is capped by maxHealthCap (10%) per pulse');

  // Move the boss outside the apron before ticking through the remaining pulses for the high-round shopper.
  boss.position.set(5.75, 0, FRYER_OUTSIDE_Z);

  // Pulse 2 deals another 45% (100 HP left); pulse 3 finishes the high-round shopper.
  game.tick(Math.ceil(fryerCfg.pulseInterval / dt) + 1);
  assert.equal(lateShopper.isAlive, true);
  assert.equal(lateShopper.health, 100);
  game.tick(Math.ceil(fryerCfg.pulseInterval / dt) + 1);
  assert.equal(lateShopper.isAlive, false, 'high-round shopper died on pulse 3');
  assert.equal(g.wallet.points - pointsBefore, economy.killValues.shopper * 2);
  assert.equal(fryerKills.length, 2);

  // 2. Mascot helmet pop from the fryer: pops the helmet at 50% HP and caps damage at 10%, paying NO helmetPopBonus.
  g.zombies.clear();
  const mascot = g.zombies.spawn('mascot', new THREE.Vector3(5.75, 0, -9.5), { gold: false });
  const pulseCap = mascot.maxHealth * fryerCfg.maxHealthCap;
  mascot.health = Math.floor(mascot.maxHealth * 0.5) + Math.min(10, pulseCap * 0.5);
  const healthBeforePulse = mascot.health;
  const walletBeforeMascot = g.wallet.points;
  game.tick(Math.ceil(fryerCfg.pulseInterval / dt) + 1);
  assert.ok(Math.abs((healthBeforePulse - mascot.health) - pulseCap) < 1e-6, 'Mascot damage is capped by maxHealthCap (10%) per pulse');
  assert.equal(headPops.length, 1, 'Mascot helmet popped at 50% HP');
  assert.equal(headPops[0].source, 'hazard');
  assert.equal(g.wallet.points, walletBeforeMascot, 'hazard helmet pop does NOT pay helmetPopBonus');

  // 3. Employee of the Month (Gold Mascot): killing it with the fryer STILL drops its guaranteed power-up.
  g.zombies.clear();
  const goldMascot = g.zombies.spawn('mascot', new THREE.Vector3(5.75, 0, -9.5), { gold: true });
  goldMascot.health = 5;
  game.tick(Math.ceil(fryerCfg.pulseInterval / dt) + 1);
  assert.equal(goldMascot.isAlive, false);
  assert.ok(g.powerUps.pickup, 'Gold Mascot killed by the fryer still drops its guaranteed power-up');

  // 4. Once the player is dead (state.over), nothing more is paid or counted.
  const doomed = g.zombies.spawn('shopper', new THREE.Vector3(5.75, 0, -9.5));
  doomed.health = 5;
  g.health.takeDamage(10_000);
  assert.equal(g.state.over, true);
  const walletAtDeath = g.wallet.points;
  const killsAtDeath = g.runStats.kills;
  game.tick(Math.ceil(fryerCfg.pulseInterval / dt) + 2);
  assert.equal(g.wallet.points, walletAtDeath, 'nothing paid after player death');
  assert.equal(g.runStats.kills, killsAtDeath, 'no kills counted after player death');
});

test('Closing Time line 1 isolation: fryer kills emit fryerKill and leave line 1 (janitor fountain duty) untouched', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('foodCourt');
  g.closing.debug('grant', 'janitor');
  assert.equal(g.closing.hasKey('janitor'), true);
  assert.equal(g.closing.checklist.find((c) => c.bossId === 'janitor')?.count, 0);

  let fountainKillEvents = 0;
  let fryerKillEvents = 0;
  g.events.on('fountainKill', () => { fountainKillEvents++; });
  g.events.on('fryerKill', () => { fryerKillEvents++; });

  for (let i = 0; i < 3; i++) {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(4.5 + i * 1.2, 0, -9.5));
    z.setState('chasing');
  }
  game.standAt(5.75, FRYER_OUTSIDE_Z, 0);
  const fryer = getFryerInstance(g);
  fryer.trigger();

  assert.equal(fryerKillEvents, 3, 'fryer kills emitted fryerKill');
  assert.equal(fountainKillEvents, 0, 'fryer kills never emit fountainKill');
  assert.equal(g.closing.checklist.find((c) => c.bossId === 'janitor')?.count, 0, 'Closing Time line 1 count remains 0 after fryer kills');
  assert.equal(g.closing.isDone('janitor'), false);
});

test('player standing in the active grease apron takes scald damage and is slowed, then recovers when stepping out', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('foodCourt');

  // Stand at the fryer switch (inside the x: 2.5..9.0, z: -13.0..-6.5 apron) and trigger the fryer.
  standAtFryerSwitch(game);
  const healthBefore = g.stats.health;
  game.press('KeyF', 20);
  pastGrace(game, fryerCfg);
  assert.ok(g.stats.health <= healthBefore - fryerCfg.playerDamage, 'player took scald damage from the fryer apron');
  assert.equal(g.stats.surfaceSpeed, fryerCfg.playerSlowFactor, 'player surfaceSpeed is slowed while inside the active grease apron');

  // Step outside the grease apron (z = -5.0 is north of maxZ = -6.5).
  game.standAt(5.75, FRYER_OUTSIDE_Z, 0);
  assert.equal(g.stats.surfaceSpeed, 1, 'surfaceSpeed returns to 1 as soon as the player steps outside the apron');
  const healthOutside = g.stats.health;
  game.tick(Math.ceil(fryerCfg.pulseInterval / dt) + 2);
  assert.ok(g.stats.health >= healthOutside, 'no scald damage while outside the apron');
});

test('Play again (resetRun) clears active fryer state, cooldowns, visuals, and player slow (snapshot equality)', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  const fresh = snapshot(g);

  game.tick(1);
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('foodCourt');
  standAtFryerSwitch(game);
  game.press('KeyF', 20);
  pastGrace(game, fryerCfg);

  const fryer = getFryerInstance(g);
  assert.equal(fryer.phase, 'active');
  assert.equal(g.stats.surfaceSpeed, fryerCfg.playerSlowFactor);

  g.resetRun();
  assert.equal(fryer.phase, 'ready');
  assert.equal(fryer.remaining, 0);
  assert.equal(g.stats.surfaceSpeed, 1);
  assert.deepEqual(snapshot(g), fresh);
});

test('sprinklers triggering, price, discounts, and Kiosk Kevin nearest-prompt-wins along the south hallway wall', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);

  // Hallway is locked at the start of a run: no prompt yet.
  standAtSprinklerSwitch(game);
  assert.equal(g.interactions.prompt, null, 'no prompt while Hallway is locked');

  // Unlock Hallway and advance to round 2 so Kiosk Kevin (at x = -8.5 on the same south wall, inside the spray zone) is open too.
  g.map.areaUnlocks.unlock('hallway');
  g.rounds.jumpTo(2);
  game.tick(1);

  // Nearest-prompt-wins rule: standing at the Fire Alarm Pull (-6.6) gives the sprinkler prompt, while standing at
  // each of Kiosk Kevin's three slots (-9.22, -8.5, -7.78) gives that slot's own kiosk prompt.
  const kioskFeature = g.map.features.find((f) => f.kind === 'kiosk');
  assert.ok(kioskFeature, 'Kiosk Kevin feature exists on the south hallway wall');
  for (const slot of kioskFeature.slots) {
    game.standAt(slot.position.x, slot.position.z + 0.9, 0); // facing -Z toward the south wall
    assert.equal(g.interactions.prompt?.kind, 'kiosk', `standing at Kevin slot ${slot.id} selects kiosk prompt`);
    assert.equal(g.interactions.prompt?.id, slot.id);
  }

  standAtSprinklerSwitch(game);
  assert.ok(g.interactions.prompt, 'standing at the Fire Alarm Pull selects the sprinkler prompt');
  assert.equal(g.interactions.prompt.kind, 'hazard');
  assert.equal(g.interactions.prompt.id, 'sprinklers');
  assert.equal(g.interactions.prompt.cost, economy.hazards.sprinklers);

  // Apply a 40% hazard discount (e.g. Mall hazards Flash Sale).
  g.pricing.setDiscount('hazard', 0.4);
  const expectedPrice = g.pricing.priceOf('hazard', 'sprinklers');
  assert.equal(expectedPrice, 360);
  standAtSprinklerSwitch(game);
  assert.equal(g.interactions.prompt.cost, expectedPrice, 'prompt reflects the discounted hazard price');

  const before = g.wallet.points;
  const sprinklers = getSprinklerInstance(g);
  assert.equal(sprinklers.phase, 'ready');
  game.press('KeyF', 20);
  assert.equal(before - g.wallet.points, expectedPrice, 'charged the discounted hazard price');
  assert.equal(sprinklers.phase, 'active');
  assert.ok(game.sounds.includes(sprinklerCfg.triggerSound), 'played the trigger sound');

  // Even while the sprinklers are active over x: -12..12 (covering Kiosk Kevin at x = -8.5), Kevin's prompts still work at his cart.
  for (const slot of kioskFeature.slots) {
    game.standAt(slot.position.x, slot.position.z + 0.9, 0);
    assert.equal(g.interactions.prompt?.kind, 'kiosk');
    assert.equal(g.interactions.prompt?.id, slot.id);
  }
});

test("the sprinkler pull never takes the Food Court gate's prompt: anywhere along the closed gate, holding F is for the gate", (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.map.areaUnlocks.unlock('hallway');
  const gate = g.map.doors.find((d) => d.id === 'foodCourt');
  assert.equal(gate.isOpen, false);
  // The gate spans x -3.5..3.5 on the hallway's south wall; walk its whole width, near and a little back, facing it
  // and turned towards the pull.
  for (let x = -3.5; x <= 3.5; x += 0.25) {
    for (const z of [-0.6, 0.4]) {
      for (const yaw of [0, 30, 60]) {
        game.standAt(x, z, yaw);
        assert.notEqual(g.interactions.prompt?.kind, 'hazard', `at x ${x}, z ${z}, yaw ${yaw}`);
      }
    }
  }
  // ...and at the pull itself the prompt is the sprinklers'.
  standAtSprinklerSwitch(game);
  assert.equal(g.interactions.prompt?.id, 'sprinklers');
});

test('sprinklers cooldown: blocked while active ("Active") and recharging ("Recharging"), then ready again after cooldown elapses', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('hallway');

  const sprinklers = getSprinklerInstance(g);
  standAtSprinklerSwitch(game);
  game.press('KeyF', 20);
  assert.equal(sprinklers.phase, 'active');

  standAtSprinklerSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.active);
  const walletWhileActive = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletWhileActive, 'cannot pay again while active');

  // Run out the remaining active time into cooldown while standing outside the spray zone.
  game.standAt(SPRINKLER_OUTSIDE_X, 2, 0);
  game.tick(Math.ceil(sprinklerCfg.durationSeconds / dt) + 2);
  assert.equal(sprinklers.phase, 'cooldown');
  assert.ok(sprinklers.remaining > 0 && sprinklers.remaining <= sprinklerCfg.cooldownSeconds);

  standAtSprinklerSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.cooldown);
  const walletDuringCooldown = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletDuringCooldown, 'cannot pay while recharging');

  // Finish the cooldown: ready to trigger again.
  game.standAt(SPRINKLER_OUTSIDE_X, 2, 0);
  game.tick(Math.ceil(sprinklerCfg.cooldownSeconds / dt) + 5);
  assert.equal(sprinklers.phase, 'ready');
  standAtSprinklerSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, null);
});

test('sprinklers payout, chill + soak (applyVulnerable) on zombies, bosses, and Mascots, Mascot helmet rule, Gold Mascot drop, and nothing paid after death', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('hallway');

  const kills = [];
  const sprinklerKills = [];
  const headPops = [];
  g.events.on('kill', (e) => kills.push(e));
  g.events.on('sprinklerKill', (e) => sprinklerKills.push(e));
  g.events.on('mascotHeadPop', (e) => headPops.push(e));

  // 1. Normal Shopper (1000 maxHealth) in the concourse takes 25% (250) on pulse 1 with zero +10 hit payout,
  //    is chilled (slowFraction 0.45, 'smoothie') and soaked (vulnerableMultiplier 1.35 for 1.2 s), and dies on subsequent pulses.
  const shopper = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 2));
  shopper.setState('chasing');
  shopper.maxHealth = 1000;
  shopper.health = 1000;

  // Boss and Mascot in the concourse: each pulse caps hazard damage at 6% of maxHealth, and applyVulnerable (1.35x)
  // makes weapon hits on both the soaked boss and the soaked Mascot deal 1.35x damage.
  const boss = g.zombies.spawn('janitor', new THREE.Vector3(-4, 0, 2));
  boss.setState('chasing');
  const bossInitialHealth = boss.health;

  const mascot = g.zombies.spawn('mascot', new THREE.Vector3(4, 0, 2), { gold: false });
  mascot.setState('chasing');
  const mascotInitialHealth = mascot.health;

  const pointsBefore = g.wallet.points;
  const progressBefore = g.powerUps.progress;
  const sprinklers = getSprinklerInstance(g);
  game.standAt(SPRINKLER_OUTSIDE_X, 2, 0);
  sprinklers.trigger();

  assert.equal(shopper.isAlive, true);
  assert.equal(shopper.health, 1000 - 1000 * sprinklerCfg.normalHealthFraction, 'shopper took 25% maxHealth on pulse 1');
  assert.equal(shopper.slowFraction, sprinklerCfg.slowFactor, 'shopper is chilled to 0.45');
  assert.equal(shopper.slowKind, sprinklerCfg.slowKind);
  assert.equal(shopper.vulnerableMultiplier, sprinklerCfg.vulnerableMultiplier, 'shopper is soaked with 1.35x vulnerableMultiplier');
  assert.equal(shopper.vulnerableTimer, sprinklerCfg.vulnerableDuration);
  assert.equal(g.wallet.points, pointsBefore, 'non-lethal hazard pulse pays zero +10 hit points');

  // Verify Boss and Mascot pulse damage cap (6% maxHealth) and soak (applyVulnerable -> 1.35x weapon damage).
  const bossPulseCap = boss.maxHealth * sprinklerCfg.maxHealthCap;
  const mascotPulseCap = mascot.maxHealth * sprinklerCfg.maxHealthCap;
  assert.ok(Math.abs((bossInitialHealth - boss.health) - bossPulseCap) < 1e-6, 'boss pulse damage is capped at 6% of maxHealth');
  assert.ok(Math.abs((mascotInitialHealth - mascot.health) - mascotPulseCap) < 1e-6, 'Mascot pulse damage is capped at 6% of maxHealth');
  assert.equal(boss.vulnerableMultiplier, sprinklerCfg.vulnerableMultiplier, 'boss is soaked (vulnerableMultiplier 1.35)');
  assert.ok(boss.vulnerableTimer > 0);
  assert.equal(mascot.vulnerableMultiplier, sprinklerCfg.vulnerableMultiplier, 'Mascot is soaked (vulnerableMultiplier 1.35)');
  assert.ok(mascot.vulnerableTimer > 0);

  // Shoot the soaked boss and soaked Mascot with a 100-damage gun hit: both take 135 damage (1.35x).
  const bossBeforeShot = boss.health;
  boss.takeHit({ damage: 100, part: 'body', point: boss.position, source: 'gun' });
  assert.ok(Math.abs((bossBeforeShot - boss.health) - 100 * sprinklerCfg.vulnerableMultiplier) < 1e-6, 'soaked boss takes 1.35x weapon damage');

  const mascotBeforeShot = mascot.health;
  mascot.takeHit({ damage: 100, part: 'body', point: mascot.position, source: 'gun' });
  assert.ok(Math.abs((mascotBeforeShot - mascot.health) - 100 * sprinklerCfg.vulnerableMultiplier) < 1e-6, 'soaked Mascot takes 1.35x weapon damage');

  // Move boss and Mascot outside while ticking pulses 2..4 to finish off the shopper.
  boss.position.set(SPRINKLER_OUTSIDE_X, 0, 2);
  mascot.position.set(SPRINKLER_OUTSIDE_X, 0, -1);

  for (let p = 0; p < 3 && shopper.isAlive; p++) {
    game.tick(Math.ceil(sprinklerCfg.pulseInterval / dt) + 1);
  }
  assert.equal(shopper.isAlive, false, 'soaked shopper died from sprinkler pulses');
  assert.equal(kills.length, 1);
  assert.equal(sprinklerKills.length, 1);
  assert.equal(kills[0].source, 'hazard');
  assert.equal(g.wallet.points - pointsBefore, economy.killValues.shopper, 'paid exact shopper killValue');
  assert.equal(g.powerUps.progress, progressBefore, 'hazard kills do not fill the regular power-up meter');

  // 2. Mascot helmet pop from the sprinklers: pops the helmet at 50% HP and caps damage at 6% even while soaked, paying NO helmetPopBonus.
  mascot.position.set(4, 0, 2);
  mascot.health = Math.floor(mascot.maxHealth * 0.5) + Math.min(10, mascotPulseCap * 0.5);
  const mascotHealthBeforePop = mascot.health;
  const walletBeforeMascot = g.wallet.points;
  game.tick(Math.ceil(sprinklerCfg.pulseInterval / dt) + 1);
  assert.ok(Math.abs((mascotHealthBeforePop - mascot.health) - mascotPulseCap) < 1e-6, 'soaked Mascot pulse damage stays capped at 6%');
  assert.equal(headPops.length, 1, 'Mascot helmet popped at 50% HP');
  assert.equal(headPops[0].source, 'hazard');
  assert.equal(g.wallet.points, walletBeforeMascot, 'hazard helmet pop does NOT pay helmetPopBonus');

  // 3. Employee of the Month (Gold Mascot): killing it with the sprinklers STILL drops its guaranteed power-up.
  g.zombies.clear();
  const goldMascot = g.zombies.spawn('mascot', new THREE.Vector3(0, 0, 2), { gold: true });
  goldMascot.health = 5;
  game.tick(Math.ceil(sprinklerCfg.pulseInterval / dt) + 1);
  assert.equal(goldMascot.isAlive, false);
  assert.ok(g.powerUps.pickup, 'Gold Mascot killed by the sprinklers still drops its guaranteed power-up');

  // 4. Once the player is dead (state.over), nothing more is paid or counted.
  const doomed = g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 2));
  doomed.health = 5;
  g.health.takeDamage(10_000);
  assert.equal(g.state.over, true);
  const walletAtDeath = g.wallet.points;
  const killsAtDeath = g.runStats.kills;
  game.tick(Math.ceil(sprinklerCfg.pulseInterval / dt) + 2);
  assert.equal(g.wallet.points, walletAtDeath, 'nothing paid after player death');
  assert.equal(g.runStats.kills, killsAtDeath, 'no kills counted after player death');
});

test('Closing Time line 1 isolation: sprinkler kills emit sprinklerKill and leave line 1 (janitor fountain duty) untouched', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('hallway');
  g.closing.debug('grant', 'janitor');
  assert.equal(g.closing.hasKey('janitor'), true);
  assert.equal(g.closing.checklist.find((c) => c.bossId === 'janitor')?.count, 0);

  let fountainKillEvents = 0;
  let sprinklerKillEvents = 0;
  g.events.on('fountainKill', () => { fountainKillEvents++; });
  g.events.on('sprinklerKill', () => { sprinklerKillEvents++; });

  for (let i = 0; i < 3; i++) {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(-2 + i * 2, 0, 2));
    z.setState('chasing');
    z.health = 20;
  }
  game.standAt(SPRINKLER_OUTSIDE_X, 2, 0);
  const sprinklers = getSprinklerInstance(g);
  sprinklers.trigger();

  assert.equal(sprinklerKillEvents, 3, 'sprinkler kills emitted sprinklerKill');
  assert.equal(fountainKillEvents, 0, 'sprinkler kills never emit fountainKill');
  assert.equal(g.closing.checklist.find((c) => c.bossId === 'janitor')?.count, 0, 'Closing Time line 1 count remains 0 after sprinkler kills');
  assert.equal(g.closing.isDone('janitor'), false);
});

test('player standing in the active sprinkler zone takes no damage and is wet-tile slowed, then recovers when stepping out', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('hallway');

  // Stand at the Fire Alarm Pull (inside x: -12..12, z: -2..6) and trigger the sprinklers.
  standAtSprinklerSwitch(game);
  const healthBefore = g.stats.health;
  game.press('KeyF', 20);
  assert.equal(g.stats.health, healthBefore, 'sprinklers deal zero player damage');
  assert.equal(g.stats.surfaceSpeed, sprinklerCfg.playerSlowFactor, 'player surfaceSpeed is slowed to 0.9 on the wet concourse tiles');

  // Step outside the drenched concourse (x = -15 is west of minX = -12).
  game.standAt(SPRINKLER_OUTSIDE_X, 2, 0);
  assert.equal(g.stats.surfaceSpeed, 1, 'surfaceSpeed returns to 1 as soon as the player steps outside');
  game.tick(Math.ceil(sprinklerCfg.pulseInterval / dt) + 2);
  assert.equal(g.stats.health, healthBefore, 'still no player damage');
});

test('Play again (resetRun) clears active sprinkler state, cooldowns, visuals, and player slow (snapshot equality)', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  const fresh = snapshot(g);

  game.tick(1);
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('hallway');
  standAtSprinklerSwitch(game);
  game.press('KeyF', 20);

  const sprinklers = getSprinklerInstance(g);
  assert.equal(sprinklers.phase, 'active');
  assert.equal(g.stats.surfaceSpeed, sprinklerCfg.playerSlowFactor);

  g.resetRun();
  assert.equal(sprinklers.phase, 'ready');
  assert.equal(sprinklers.remaining, 0);
  assert.equal(g.stats.surfaceSpeed, 1);
  assert.deepEqual(snapshot(g), fresh);
});

test('paLure triggering, price and discounts: locked until Service Corridor opens, charges g.pricing ("hazard"), and respects Flash Sale discounts', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);

  // Service Corridor is locked at the start of a run: no prompt yet.
  standAtPaLureSwitch(game);
  assert.equal(g.interactions.prompt, null, 'no prompt while Service Corridor is locked');

  // Unlock Service Corridor: prompt shows the shelf price from g.pricing.
  g.map.areaUnlocks.unlock('serviceCorridor');
  standAtPaLureSwitch(game);
  assert.ok(g.interactions.prompt, 'prompt appears once Service Corridor is open');
  assert.equal(g.interactions.prompt.kind, 'hazard');
  assert.equal(g.interactions.prompt.id, 'paLure');
  assert.equal(g.interactions.prompt.cost, economy.hazards.paLure);

  // Apply a 40% hazard discount (e.g. Mall hazards Flash Sale).
  g.pricing.setDiscount('hazard', 0.4);
  const expectedPrice = g.pricing.priceOf('hazard', 'paLure');
  assert.equal(expectedPrice, 300);
  standAtPaLureSwitch(game);
  assert.equal(g.interactions.prompt.cost, expectedPrice, 'prompt reflects the discounted hazard price');

  const before = g.wallet.points;
  const paLure = getPaLureInstance(g);
  assert.equal(paLure.phase, 'ready');
  game.press('KeyF', 20);
  assert.equal(before - g.wallet.points, expectedPrice, 'charged the discounted hazard price');
  assert.equal(paLure.phase, 'active');
  assert.ok(game.sounds.includes(paLureCfg.triggerSound), 'played the trigger sound');
});

test('paLure cooldown: blocked while active ("Active") and recharging ("Recharging"), then ready again after cooldown elapses', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('serviceCorridor');

  const paLure = getPaLureInstance(g);
  standAtPaLureSwitch(game);
  game.press('KeyF', 20);
  assert.equal(paLure.phase, 'active');

  standAtPaLureSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.active);
  const walletWhileActive = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletWhileActive, 'cannot pay again while active');

  // Run out the remaining active time into cooldown.
  game.standAt(PALURE_OUTSIDE.x, PALURE_OUTSIDE.z, 0);
  game.tick(Math.ceil(paLureCfg.durationSeconds / dt) + 2);
  assert.equal(paLure.phase, 'cooldown');
  assert.ok(paLure.remaining > 0 && paLure.remaining <= paLureCfg.cooldownSeconds);

  standAtPaLureSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, hazards.status.cooldown);
  const walletDuringCooldown = g.wallet.points;
  game.press('KeyF', 20);
  assert.equal(g.wallet.points, walletDuringCooldown, 'cannot pay while recharging');

  // Finish the cooldown: ready to trigger again.
  game.standAt(PALURE_OUTSIDE.x, PALURE_OUTSIDE.z, 0);
  game.tick(Math.ceil(paLureCfg.cooldownSeconds / dt) + 5);
  assert.equal(paLure.phase, 'ready');
  standAtPaLureSwitch(game);
  assert.equal(g.interactions.prompt?.blocked, null);
});

test('paLure holds normal zombies on pulses, deals feedback pop damage (source: "hazard") on completion, caps boss/Mascot damage, respects Mascot helmet rule and Gold Mascot drop, and pays nothing after death', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('serviceCorridor');

  const kills = [];
  const paLureKills = [];
  const headPops = [];
  g.events.on('kill', (e) => kills.push(e));
  g.events.on('paLureKill', (e) => paLureKills.push(e));
  g.events.on('mascotHeadPop', (e) => headPops.push(e));

  // 1. Early-round Shopper (100 HP) and high-round Shopper (1000 HP) in the corridor, plus a Boss and a Mascot.
  const earlyShopper = g.zombies.spawn('shopper', new THREE.Vector3(-21.8, 0, -4.5));
  earlyShopper.setState('chasing');
  const lateShopper = g.zombies.spawn('shopper', new THREE.Vector3(-21.8, 0, -6.5));
  lateShopper.setState('chasing');
  lateShopper.maxHealth = 1000;
  lateShopper.health = 1000;

  const boss = g.zombies.spawn('janitor', new THREE.Vector3(-21.8, 0, -2.5));
  boss.setState('chasing');
  boss.speed = 0;
  const bossInitialHealth = boss.health;

  const mascot = g.zombies.spawn('mascot', new THREE.Vector3(-21.8, 0, -8.5), { gold: false });
  mascot.setState('chasing');
  const mascotPopCap = mascot.maxHealth * paLureCfg.maxHealthCap;
  mascot.health = Math.floor(mascot.maxHealth * 0.5) + Math.min(10, mascotPopCap * 0.5);
  const mascotHealthBeforePop = mascot.health;

  const goldMascot = g.zombies.spawn('mascot', new THREE.Vector3(-21.8, 0, -10.5), { gold: true });
  goldMascot.setState('chasing');
  goldMascot.health = 5;

  const pointsBefore = g.wallet.points;
  const progressBefore = g.powerUps.progress;
  const paLure = getPaLureInstance(g);
  game.standAt(PALURE_OUTSIDE.x, PALURE_OUTSIDE.z, 0);
  paLure.trigger();

  // During the broadcast pulses, normal zombies and Mascots are held with zero pulse damage, while bosses ignore applyHold.
  assert.ok(earlyShopper.hold, 'early shopper is held by the PA lure on pulse');
  assert.equal(earlyShopper.hold.seconds, paLureCfg.holdDuration);
  assert.ok(lateShopper.hold, 'high-round shopper is held by the PA lure on pulse');
  assert.equal(boss.hold, null, 'bosses ignore applyHold');
  assert.equal(earlyShopper.isAlive, true, 'broadcast pulses deal zero damage before the feedback pop');
  assert.equal(lateShopper.health, 1000, 'no damage dealt during broadcast pulses');
  assert.equal(boss.health, bossInitialHealth, 'no damage dealt to boss during broadcast pulses');

  // Tick partway through the broadcast: holds are refreshed every 0.5 s pulse so held zombies stay in place.
  const heldPos = earlyShopper.position.clone();
  game.tick(Math.ceil(2.0 / dt));
  assert.ok(earlyShopper.hold, 'hold is refreshed by subsequent pulses');
  assert.ok(earlyShopper.position.distanceTo(heldPos) < 1e-4, 'held shopper stays in place during broadcast');
  assert.equal(kills.length, 0, 'no kills before the final feedback pop');

  // Tick to the end of the 8 s broadcast: the feedback pop fires once as the lure stops.
  game.tick(Math.ceil((paLureCfg.durationSeconds - 2.0) / dt) + 2);
  assert.equal(paLure.phase, 'cooldown');
  assert.ok(game.sounds.includes(paLureCfg.popSound), 'played the feedback pop sound');

  // Early shopper (100 HP) and low-HP Gold Mascot died on the feedback pop; high-round shopper (1000 HP) took 60% (600) and was released from hold.
  assert.equal(earlyShopper.isAlive, false, 'round-1 shopper died on the feedback pop');
  assert.equal(lateShopper.isAlive, true);
  assert.equal(lateShopper.hold, null, 'surviving shopper is released when the lure stops');
  assert.equal(lateShopper.health, 1000 - 1000 * paLureCfg.normalHealthFraction, 'high-round shopper took 60% maxHealth on the feedback pop');

  // Boss and Mascot feedback pop damage is capped at maxHealthCap (10%), and Mascot helmet pop pays no helmetPopBonus.
  assert.ok(Math.abs((bossInitialHealth - boss.health) - boss.maxHealth * paLureCfg.maxHealthCap) < 1e-6, 'boss feedback pop damage is capped at 10% of maxHealth');
  assert.ok(Math.abs((mascotHealthBeforePop - mascot.health) - mascotPopCap) < 1e-6, 'Mascot feedback pop damage is capped at 10% of maxHealth');
  assert.equal(headPops.length, 1, 'Mascot helmet popped at 50% HP on the feedback pop');
  assert.equal(headPops[0].source, 'hazard');

  // Gold Mascot died and dropped its guaranteed power-up; regular power-up meter did not advance; wallet got exact killValues (shopper + mascot) and no helmetPopBonus.
  assert.equal(goldMascot.isAlive, false);
  assert.ok(g.powerUps.pickup, 'Gold Mascot killed by the PA lure feedback pop drops its guaranteed power-up');
  assert.equal(kills.length, 2);
  assert.equal(paLureKills.length, 2);
  assert.ok(kills.every((k) => k.source === 'hazard' && !k.headshot && !k.melee));
  assert.equal(g.wallet.points - pointsBefore, economy.killValues.shopper + economy.killValues.mascot, 'paid exact killValues with zero +10 hit points and zero helmetPopBonus');
  assert.equal(g.powerUps.progress, progressBefore, 'hazard kills do not fill the regular power-up meter');

  // 2. Once the player is dead (state.over), the feedback pop does not fire or pay anything.
  g.zombies.clear();
  game.tick(Math.ceil(paLureCfg.cooldownSeconds / dt) + 5);
  assert.equal(paLure.phase, 'ready');
  const doomed = g.zombies.spawn('shopper', new THREE.Vector3(-21.8, 0, -4.5));
  doomed.health = 5;
  paLure.trigger();
  assert.ok(doomed.hold);
  g.health.takeDamage(10_000);
  assert.equal(g.state.over, true);
  const walletAtDeath = g.wallet.points;
  const killsAtDeath = g.runStats.kills;
  game.tick(Math.ceil(paLureCfg.durationSeconds / dt) + 5);
  assert.equal(g.wallet.points, walletAtDeath, 'nothing paid after player death');
  assert.equal(g.runStats.kills, killsAtDeath, 'no kills counted after player death');
});

test('Closing Time line 1 isolation: paLure kills emit paLureKill and leave line 1 (janitor fountain duty) untouched', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('serviceCorridor');
  g.closing.debug('grant', 'janitor');
  assert.equal(g.closing.hasKey('janitor'), true);
  assert.equal(g.closing.checklist.find((c) => c.bossId === 'janitor')?.count, 0);

  let fountainKillEvents = 0;
  let paLureKillEvents = 0;
  g.events.on('fountainKill', () => { fountainKillEvents++; });
  g.events.on('paLureKill', () => { paLureKillEvents++; });

  for (let i = 0; i < 3; i++) {
    const z = g.zombies.spawn('shopper', new THREE.Vector3(-21.8, 0, -3.5 - i * 1.5));
    z.setState('chasing');
  }
  game.standAt(PALURE_OUTSIDE.x, PALURE_OUTSIDE.z, 0);
  const paLure = getPaLureInstance(g);
  paLure.trigger();
  game.tick(Math.ceil(paLureCfg.durationSeconds / dt) + 2);

  assert.equal(paLureKillEvents, 3, 'PA lure kills emitted paLureKill');
  assert.equal(fountainKillEvents, 0, 'PA lure kills never emit fountainKill');
  assert.equal(g.closing.checklist.find((c) => c.bossId === 'janitor')?.count, 0, 'Closing Time line 1 count remains 0 after PA lure kills');
  assert.equal(g.closing.isDone('janitor'), false);
});

test('3 m-wide Service Corridor: a held crowd does not trigger zombieManager failsafe or block an unheld zombie or boss (which ignores applyHold) from walking through', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.health.invulnerable = true;
  g.map.areaUnlocks.unlock('hallway');
  g.map.areaUnlocks.unlock('serviceCorridor');
  game.tick(1);

  // Place the player near the north end of the Service Corridor (z = 1.0) so zombies in the corridor route north (+Z) toward the player,
  // while the held crowd (> 4.5 m south of the player) is far enough to be subject to zombieFailsafe if not properly excluded.
  game.standAt(-21.8, 1.0, 180);

  // Spawn a dense crowd of 3 Shoppers abreast across the 3 m-wide Service Corridor (x = -23.3..-20.3) at z = -5.5 (6.5 m from the player).
  const heldCrowd = [
    g.zombies.spawn('shopper', new THREE.Vector3(-22.5, 0, -5.5)),
    g.zombies.spawn('shopper', new THREE.Vector3(-21.8, 0, -5.5)),
    g.zombies.spawn('shopper', new THREE.Vector3(-21.1, 0, -5.5)),
  ];
  for (const z of heldCrowd) {
    z.setState('chasing');
    z.maxHealth = 2000;
    z.health = 2000;
  }

  // Spawn a Boss (janitor) and an unheld walker south of the held crowd at z = -8.5: bosses ignore applyHold, and both
  // must be able to walk right past the held crowd in the 3 m-wide corridor without getting wedged or triggering rescueStuckZombies.
  const boss = g.zombies.spawn('janitor', new THREE.Vector3(-21.8, 0, -8.5));
  boss.setState('chasing');
  const unheldShopper = g.zombies.spawn('shopper', new THREE.Vector3(-22.2, 0, -9.2));
  unheldShopper.setState('chasing');
  unheldShopper.applyHold = () => false;

  const paLure = getPaLureInstance(g);
  paLure.trigger();

  for (const z of heldCrowd) {
    assert.ok(z.hold, 'corridor crowd shopper is held');
  }
  assert.equal(boss.hold, null, 'boss ignores applyHold');
  assert.equal(unheldShopper.hold, null);

  // Tick for 6.5 s (past zombieFailsafe.checkSeconds = 6.0 s, while the 8.0 s lure is still active).
  let anyRespawned = false;
  for (const z of [...heldCrowd, boss, unheldShopper]) {
    const origRespawn = z.respawnAt.bind(z);
    z.respawnAt = (...args) => {
      anyRespawned = true;
      return origRespawn(...args);
    };
  }
  game.tick(Math.ceil(6.5 / dt));

  assert.equal(anyRespawned, false, 'neither the held crowd, the unheld zombie, nor the boss triggered the stuck-zombie failsafe in the 3 m corridor');
  for (const z of heldCrowd) {
    assert.ok(z.hold, 'crowd remains held during the broadcast');
    assert.equal(z.stuckTimer, 0, 'held zombies keep stuckTimer at 0');
  }
  assert.equal(boss.hold, null, 'boss still has no hold');
  assert.ok(boss.position.z > -4.0, `boss walked right past the held crowd at z = -5.5 in the 3 m corridor (reached z = ${boss.position.z.toFixed(2)})`);
  assert.ok(unheldShopper.position.z > -4.0, `unheld zombie walked right past the held crowd at z = -5.5 in the 3 m corridor (reached z = ${unheldShopper.position.z.toFixed(2)})`);
});

test('player standing in the active paLure zone takes no damage and is not slowed', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('serviceCorridor');

  standAtPaLureSwitch(game);
  const healthBefore = g.stats.health;
  game.press('KeyF', 20);
  assert.equal(g.stats.health, healthBefore, 'PA lure deals zero player damage on activation');
  assert.equal(g.stats.surfaceSpeed, 1, 'PA lure does not slow the player');

  game.tick(Math.ceil(paLureCfg.pulseInterval / dt) + 2);
  assert.equal(g.stats.health, healthBefore, 'PA lure deals zero player damage on pulse');
  assert.equal(g.stats.surfaceSpeed, 1);
});

test('Play again (resetRun) clears active paLure state, releases holds without firing the feedback pop, and matches a fresh snapshot', (t) => {
  const game = headlessGame();
  t.after(() => game.g.map.dispose());
  const { g } = game;
  const fresh = snapshot(g);

  game.tick(1);
  g.rounds.update = () => {};
  g.zombies.clear();
  g.wallet.earn(10_000);
  g.map.areaUnlocks.unlock('serviceCorridor');

  const shopper = g.zombies.spawn('shopper', new THREE.Vector3(-21.8, 0, -4.5));
  shopper.setState('chasing');
  standAtPaLureSwitch(game);
  game.press('KeyF', 20);

  const paLure = getPaLureInstance(g);
  assert.equal(paLure.phase, 'active');
  assert.ok(shopper.hold);

  let paLureKills = 0;
  g.events.on('paLureKill', () => { paLureKills++; });

  g.resetRun();
  assert.equal(paLure.phase, 'ready');
  assert.equal(paLure.remaining, 0);
  assert.equal(paLureKills, 0, 'resetRun stops the active lure without firing the feedback pop');
  assert.deepEqual(snapshot(g), fresh);
});
