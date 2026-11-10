// The box cutter tiers at Customer Service (game/meleeUpgrades.js, the desk's second window in game/features/upgradeDesk.js, the multi-target
// swing in weapons/melee.js): order, prices, damage, the Pro's wider cone and two targets, Play again, and the melee payouts staying intact.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { headlessGame } from './helpers/headlessGame.js';
import { featuresOf } from '../src/game/features/index.js';
import { economy } from '../src/config/economy.js';
import { melee as meleeWeapons } from '../src/config/weapons.js';
import { upgrades } from '../src/config/upgrades.js';

const def = meleeWeapons.boxCutter;
const SWING = 30; // ticks: the hit lands at 0.15 s

// A real game in the hallway at the desk's box cutter window, with points.
function atWindow() {
  const t = headlessGame();
  const { g } = t;
  t.tick(1);
  g.zombies.clear();
  g.rounds.update = () => {};
  g.map.doors.find((d) => d.id === 'startShutter').open();
  t.tick(120);
  const desk = featuresOf(g.map, 'upgradeDesk')[0];
  const bought = [];
  g.events.on('purchase', (p) => bought.push(p));
  const stand = () => t.standAt(desk.meleePosition.x, desk.meleePosition.z - 1.4, 180);
  return { t, g, desk, bought, stand, buy: () => { stand(); t.press('KeyF', 30); } };
}

// A game in the start room for swinging at zombies, nothing spawning on its own.
function arena() {
  const t = headlessGame();
  t.tick(1);
  t.g.zombies.clear();
  t.g.rounds.update = () => {};
  t.g.wallet.points = 0;
  t.standAt(0, 12, 0, 0);
  return t;
}

// A zombie `meters` from the player at `degrees` off straight ahead (yaw 0 faces -Z), with `health` HP and no will to move.
function zombieAt(t, meters, degrees, health = 100_000) {
  const z = t.g.zombies.spawn('shopper', new THREE.Vector3(0, 0, 0));
  const p = t.g.player.position;
  const a = (degrees * Math.PI) / 180;
  z.position.set(p.x + Math.sin(a) * meters, 0, p.z - Math.cos(a) * meters);
  z.state = 'chasing';
  z.speed = 0;
  z.health = health;
  z.maxHealth = Math.max(z.maxHealth, health);
  z.updateHitboxes();
  return z;
}

const swing = (t) => { t.press('KeyV'); t.tick(SWING); };

test('the desk has a second window for the box cutter, beside the gun window', () => {
  const { g, desk } = atWindow();
  assert.ok(desk.meleePosition, 'the feature carries the second spot');
  assert.ok(desk.meleePosition.distanceTo(desk.position) > 0.8, 'clear of the gun window, so each has its own prompt');
  assert.equal(desk.meleePosition.y, desk.position.y);
  assert.equal(featuresOf(g.map, 'upgradeDesk').length, 1, 'still one feature');
});

test('tiers are bought one at a time at the window, charged from pricing, then nothing is left to sell', () => {
  const { t, g, buy, bought, stand } = atWindow();
  g.wallet.earn(20_000);
  stand();
  t.tick(2);
  assert.equal(g.interactions.prompt.kind, 'melee');
  assert.equal(g.interactions.prompt.label, 'Box Cutter → Sharpened Blade');
  assert.equal(g.interactions.prompt.cost, economy.upgrades.melee.sharpened);
  assert.ok(g.interactions.prompt.detailLines.length > 0, 'the ticket says what it does, in words');

  let points = g.wallet.points;
  for (const [n, tier] of upgrades.melee.entries()) {
    buy();
    assert.equal(g.stats.meleeTier, n + 1, `${tier.id} bought`);
    assert.equal(points - g.wallet.points, economy.upgrades.melee[tier.id], `${tier.id} price`);
    assert.deepEqual(bought.at(-1), { label: `Box Cutter → ${tier.name}`, cost: economy.upgrades.melee[tier.id], kind: 'melee', id: tier.id });
    points = g.wallet.points;
  }
  stand();
  t.tick(2);
  assert.notEqual(g.interactions.prompt?.kind, 'melee', 'no box cutter prompt once both are bought');
  buy();
  assert.equal(bought.filter((p) => p.kind === 'melee').length, 2, 'and nothing more to pay for the box cutter');
});

test('tier prices follow g.pricing (a sale applies) and too few points buys nothing', () => {
  const { t, g, buy } = atWindow();
  g.pricing.setDiscount('melee', 0.5);
  assert.equal(g.pricing.priceOf('melee', 'sharpened'), economy.upgrades.melee.sharpened / 2);
  assert.equal(g.pricing.basePriceOf('melee', 'sharpened'), economy.upgrades.melee.sharpened);
  g.pricing.setDiscount('melee', 0);
  g.wallet.points = economy.upgrades.melee.sharpened - 10;
  buy();
  assert.equal(g.stats.meleeTier, 0, 'not enough points');
  assert.equal(g.wallet.points, economy.upgrades.melee.sharpened - 10);
  t.tick(1);
});

test('damage per swing is the base x the tier, and the Loss Prevention / wardrobe multiplier still stacks on top', () => {
  const t = arena();
  const { g } = t;
  const z = zombieAt(t, 1.2, 0);
  const hpAfter = () => { const before = z.health; swing(t); return before - z.health; };
  assert.equal(hpAfter(), def.damage, 'plain');
  g.meleeUpgrades.accept(g.meleeUpgrades.offer());
  assert.equal(hpAfter(), def.damage * upgrades.melee[0].damage, 'Sharpened Blade');
  g.meleeUpgrades.accept(g.meleeUpgrades.offer());
  assert.equal(hpAfter(), def.damage * upgrades.melee[1].damage, 'Box Cutter Pro');
  g.stats.meleeDamageMultiplier = 1.5;
  assert.equal(hpAfter(), def.damage * upgrades.melee[1].damage * 1.5, 'stacks with meleeDamageMultiplier');
});

test('Sharpened Blade still hits ONE zombie and keeps the plain cone; Pro hits the nearest TWO and reaches wider', () => {
  // (a fresh set of zombies for every swing: a hit knocks its target back)
  const swingAtGroup = (tier) => {
    const t = arena();
    for (let n = 1; n <= tier; n++) t.g.meleeUpgrades.accept({ tier: n });
    const group = [zombieAt(t, 1.2, 0), zombieAt(t, 1.3, 20), zombieAt(t, 1.65, 55), zombieAt(t, 1.4, -10)]; // 55: outside the plain 40, inside the Pro's 70
    const hp = group.map((z) => z.health);
    swing(t);
    return group.map((z, i) => hp[i] - z.health > 0);
  };
  assert.deepEqual(swingAtGroup(0), [true, false, false, false], 'plain: the nearest only');
  assert.deepEqual(swingAtGroup(1), [true, false, false, false], 'Sharpened Blade: still one target');
  const pro = swingAtGroup(2);
  assert.equal(pro.filter(Boolean).length, 2, 'Pro: exactly two zombies');
  assert.ok(pro[0], 'the nearest is one of them');
  assert.ok(!pro[2], 'the 55-degree one is not among the two nearest');

  const loneAt55 = (tier) => {
    const t = arena();
    for (let n = 1; n <= tier; n++) t.g.meleeUpgrades.accept({ tier: n });
    const lone = zombieAt(t, 1.65, 55);
    const before = lone.health;
    swing(t);
    return before - lone.health > 0;
  };
  assert.equal(loneAt55(1), false, 'Sharpened Blade: 55 degrees off to the side is out of the plain cone');
  assert.equal(loneAt55(2), true, 'Pro: the wider cone reaches it');
});

test('the plain cone does not reach 55 degrees, and a wall still blocks a Pro swing', () => {
  const t = arena();
  const lone = zombieAt(t, 1.3, 55);
  const before = lone.health;
  swing(t);
  assert.equal(lone.health, before, 'plain box cutter: out of the cone');

  t.g.meleeUpgrades.accept({ tier: 1 });
  t.g.meleeUpgrades.accept({ tier: 2 });
  t.g.zombies.clear();
  // Behind the start room's south wall (the room spans z 6..16; the player is at z 12 facing -Z, so go up to the north wall at z 6).
  t.standAt(0, 6.7, 0, 0);
  const behind = zombieAt(t, 1.2, 0);
  assert.ok(behind.position.z < 6, 'the zombie is on the far side of the wall');
  const hp = behind.health;
  swing(t);
  assert.equal(behind.health, hp, 'walls block it');
});

test('a Pro swing pays the 70-point melee bonus for EACH kill, and nobody already dead is hit twice', () => {
  const t = arena();
  const { g } = t;
  g.meleeUpgrades.accept({ tier: 1 });
  g.meleeUpgrades.accept({ tier: 2 });
  const a = zombieAt(t, 1.2, 0, 100);
  const b = zombieAt(t, 1.3, 15, 100);
  const c = zombieAt(t, 1.4, -15, 100);
  const kills = [];
  g.events.on('kill', (k) => kills.push(k));
  swing(t);
  assert.equal([a, b, c].filter((z) => !z.isAlive).length, 2, 'two die, the third is not touched');
  assert.equal(kills.length, 2);
  assert.ok(kills.every((k) => k.melee && k.source === 'melee'));
  assert.equal(g.wallet.points, 2 * (economy.killValues.shopper + economy.payouts.meleeKillBonus), 'a kill bonus each, and no +10 for a corpse');
  assert.equal(g.runStats.meleeKills, 2);
});

test('the single-kill melee bonus is unchanged at every tier', () => {
  for (let tier = 0; tier <= 2; tier++) {
    const t = arena();
    for (let n = 1; n <= tier; n++) t.g.meleeUpgrades.accept({ tier: n });
    zombieAt(t, 1.2, 0, 100);
    swing(t);
    assert.equal(t.g.wallet.points, economy.killValues.shopper + economy.payouts.meleeKillBonus, `tier ${tier}`);
  }
});

test('the helmet-pop bonus still pays when a box cutter swing (any tier) knocks a Mascot helmet off', () => {
  for (let tier = 0; tier <= 2; tier++) {
    const t = arena();
    const { g } = t;
    for (let n = 1; n <= tier; n++) g.meleeUpgrades.accept({ tier: n });
    const mascot = g.zombies.spawn('mascot', new THREE.Vector3(0, 0, 10.8));
    mascot.setState('chasing');
    mascot.speed = 0;
    const damage = def.damage * g.stats.meleeUpgradeDamage;
    mascot.maxHealth = damage * 4; // the helmet comes off at half health
    mascot.health = mascot.maxHealth * 0.5 + damage * 0.5; // so this swing takes it just under, alive
    mascot.updateHitboxes();
    g.wallet.points = 0;
    swing(t);
    assert.ok(mascot.isAlive, `tier ${tier}: alive`);
    assert.equal(g.wallet.points, economy.payouts.nonLethalHit + economy.payouts.helmetPopBonus, `tier ${tier}: the hit and the pop bonus`);
  }
});

test('Play again puts the box cutter back to plain (stats and viewmodel colours)', () => {
  const t = arena();
  const { g } = t;
  g.meleeUpgrades.accept({ tier: 1 });
  g.meleeUpgrades.accept({ tier: 2 });
  assert.equal(g.stats.meleeTier, 2);
  g.resetRun();
  assert.equal(g.stats.meleeTier, 0);
  assert.equal(g.stats.meleeUpgradeDamage, 1);
  assert.equal(g.stats.meleeMaxTargets, 1);
  assert.equal(g.stats.meleeHalfAngleDegrees, def.hitHalfAngleDegrees);
  assert.equal(g.meleeUpgrades.offer().id, upgrades.melee[0].id, 'the desk sells the first tier again');
});
